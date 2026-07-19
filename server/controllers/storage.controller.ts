import { Router, Response } from 'express';
import multer from 'multer';
import { storageService } from '../services/storage.service.ts';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.ts';
import { validateUploadedFile } from '../middleware/file-validation.ts';
import { isFeatureEnabled } from '../lib/feature-flags.ts';
import { queues } from '../../src/lib/queues.ts';
import { prisma } from '../../src/lib/prisma.ts';
import { logger } from '../lib/logger.ts';

export const StorageController = () => {
  const router = Router();

  // Configure multer memory storage
  const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 12 * 1024 * 1024 } // 12MB limit (allowing overhead over 10MB)
  });

  // Handle image or video uploads with auth and validation
  router.post('/upload', authMiddleware as any, upload.single('file'), async (req: AuthenticatedRequest, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'لم يتم رفع أي ملف' });
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'غير مصرح للعملية' });
    }

    // 1. File Validation (magic bytes, MIME type, XSS vectors, size)
    const validation = validateUploadedFile(req.file.buffer, req.file.mimetype, req.file.originalname);
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: validation.reason });
    }

    try {
      // 2. Check if enterprise R2 storage pipeline is enabled for this user
      const r2Enabled = await isFeatureEnabled('r2_storage', userId);

      if (!r2Enabled) {
        // Fallback to legacy upload strategy (directly process + save, returns full legacy URL)
        const fileUrl = await storageService.uploadFile({
          buffer: req.file.buffer,
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
        });

        return res.json({
          url: fileUrl,
          success: true,
          message: 'تم رفع الملف بنجاح (وضع التوافق)'
        });
      }

      // ── Enterprise R2 upload + BullMQ processing pipeline ──

      // A. Create MediaObject in DB with status PENDING
      const mediaObject = await prisma.mediaObject.create({
        data: {
          uploadedBy: userId,
          status: 'PENDING',
          objectKey: '', // Will be filled once processed, or set to placeholder temp key
          bucket: process.env.R2_BUCKET_NAME || 'aswaq-media',
          mimeType: req.file.mimetype,
          size: req.file.buffer.length,
        }
      });

      // B. Create variants in DB with status PENDING
      const variants = ['master', 'large', 'medium', 'thumb'];
      await prisma.mediaVariant.createMany({
        data: variants.map(variant => ({
          mediaId: mediaObject.id,
          variantKey: variant,
          objectKey: '',
          status: 'PENDING',
        }))
      });

      // C. Upload original file as a temp object in R2
      const tempKey = `uploads/temp/${mediaObject.id}_original.tmp`;
      await storageService.uploadFileByKey(tempKey, req.file.buffer, req.file.mimetype);

      // D. Update MediaObject with temp key as objectKey initially
      await prisma.mediaObject.update({
        where: { id: mediaObject.id },
        data: { objectKey: tempKey }
      });

      // E. Enqueue BullMQ worker job for asynchronous processing
      // We pass 'undefined' for adId because it's uploaded before the ad exists.
      await queues.addMediaProcessingJob({
        mediaId: mediaObject.id,
        tempObjectKey: tempKey,
        adId: 'undefined',
        userId: userId
      });

      logger.info(`[StorageController] Enqueued media processing job for media: ${mediaObject.id}`);

      // F. Return success response with mediaId and expected url immediately to the frontend
      const publicBaseUrl = (process.env.MEDIA_PUBLIC_BASE_URL || 'https://media.aswaq22.com').replace(/\/$/, '');
      const destinationKey = `uploads/media/${mediaObject.id}_master.webp`;
      const futureUrl = `${publicBaseUrl}/${destinationKey}`;

      return res.json({
        success: true,
        mediaId: mediaObject.id,
        url: futureUrl,
        status: 'PENDING',
        message: 'تم رفع الملف بنجاح وجارٍ معالجته في الخلفية'
      });

    } catch (e: any) {
      logger.error(`[StorageController] File upload error: ${e.message}`);
      return res.status(500).json({
        success: false,
        message: 'فشل في رفع الملف',
        error: e.message
      });
    }
  });

  return router;
};
