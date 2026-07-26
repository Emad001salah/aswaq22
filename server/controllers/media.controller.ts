import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import path from 'path';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.ts';
import { storageService } from '../services/storage.service.ts';
import { prisma } from '../../src/lib/prisma.ts';
import { logger } from '../lib/logger.ts';
import { AppError } from '../middleware/error.ts';
import {
  ALLOWED_IMAGE_MIMES,
  MAX_IMAGE_SIZE_BYTES,
  PRESIGN_EXPIRY_SECONDS,
  HOURLY_PRESIGN_LIMIT,
  DAILY_UPLOAD_LIMIT,
} from '../../shared/constants.ts';

const router = Router();

/**
 * POST /api/media/presign
 * Generates a presigned URL (or local upload endpoint) for direct client-side image upload.
 * Enforces rate limiting per user, MIME whitelist, file size limit, and registers a PendingUpload record.
 */
router.post('/presign', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new AppError(401, 'مصادقة غير صالحة');
  }

  const { filename, mimeType, sizeBytes } = req.body || {};

  if (!filename || typeof filename !== 'string') {
    throw new AppError(400, 'اسم الملف مطلوب');
  }

  if (!mimeType || typeof mimeType !== 'string' || !ALLOWED_IMAGE_MIMES.has(mimeType.toLowerCase())) {
    throw new AppError(400, `نوع الملف غير مدعوم: ${mimeType}. الأنواع المسموحة هي: ${Array.from(ALLOWED_IMAGE_MIMES).join(', ')}`);
  }

  if (!sizeBytes || typeof sizeBytes !== 'number' || sizeBytes <= 0 || sizeBytes > MAX_IMAGE_SIZE_BYTES) {
    const maxMb = MAX_IMAGE_SIZE_BYTES / (1024 * 1024);
    throw new AppError(400, `حجم الملف غير صالح. الحد الأقصى هو ${maxMb} ميجابايت`);
  }

  // 1. Rate limiting checks
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [hourlyCount, dailyCount] = await Promise.all([
    prisma.pendingUpload.count({
      where: {
        userId,
        createdAt: { gte: oneHourAgo },
      },
    }),
    prisma.pendingUpload.count({
      where: {
        userId,
        createdAt: { gte: oneDayAgo },
      },
    }),
  ]);

  if (hourlyCount >= HOURLY_PRESIGN_LIMIT) {
    throw new AppError(429, `تجاوزت الحد المسموح لطلبات الرفع في الساعة (${HOURLY_PRESIGN_LIMIT} صور/ساعة). يرجى الانتظار قليلاً.`);
  }

  if (dailyCount >= DAILY_UPLOAD_LIMIT) {
    throw new AppError(429, `تجاوزت الحد اليومي المسموح لرفع الصور (${DAILY_UPLOAD_LIMIT} صور/يوم).`);
  }

  // 2. Generate secure objectKey on server
  const ext = path.extname(filename) || (mimeType === 'image/webp' ? '.webp' : '.jpg');
  const uniqueUuid = crypto.randomUUID();
  const objectKey = `uploads/ads/${userId}/${uniqueUuid}.orig${ext}`;

  // 3. Create PendingUpload DB record
  const expiresAt = new Date(Date.now() + PRESIGN_EXPIRY_SECONDS * 1000);
  await prisma.pendingUpload.create({
    data: {
      userId,
      objectKey,
      mimeType: mimeType.toLowerCase(),
      sizeBytes,
      status: 'pending',
      expiresAt,
    },
  });

  // 4. Generate presigned URL from storage service
  const result = await storageService.createPresignedUpload(
    objectKey,
    mimeType.toLowerCase(),
    PRESIGN_EXPIRY_SECONDS
  );

  logger.info(`[MediaController] Presigned URL generated for user ${userId}: ${objectKey}`);

  res.json({
    success: true,
    uploadUrl: result.uploadUrl,
    objectKey: result.objectKey,
    fields: result.fields,
    expiresIn: result.expiresIn,
  });
});

/**
 * PUT /api/media/upload-local
 * Fallback endpoint when STORAGE_PROVIDER=local (development/testing mode).
 * Direct binary stream write to disk.
 */
router.put('/upload-local', async (req: Request, res: Response) => {
  const keyParam = req.query.key as string;
  if (!keyParam || !keyParam.startsWith('uploads/ads/')) {
    return res.status(400).json({ error: 'مفتاح ملف غير صالح' });
  }

  // Verify pending record exists
  const pending = await prisma.pendingUpload.findUnique({
    where: { objectKey: keyParam },
  });

  if (!pending) {
    return res.status(404).json({ error: 'طلب الرفع غير موجود أو منتهي الصلاحية' });
  }

  if (new Date() > pending.expiresAt) {
    return res.status(410).json({ error: 'انتهت صلاحية طلب الرفع' });
  }

  const chunks: Buffer[] = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', async () => {
    try {
      const buffer = Buffer.concat(chunks);
      await storageService.uploadFileByKey(keyParam, buffer, pending.mimeType);
      res.json({ success: true, objectKey: keyParam });
    } catch (err: any) {
      logger.error(`[MediaController] Local upload error for ${keyParam}: ${err.message}`);
      res.status(500).json({ error: 'فشل حفظ الملف محلياً' });
    }
  });
});

export default router;
