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
    limits: { fileSize: 60 * 1024 * 1024 } // 60MB limit for video reels
  });

  // Handle image or video uploads with auth and validation
  router.post('/upload', authMiddleware as any, upload.single('file'), async (req: AuthenticatedRequest, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'لم يتم رفع أي ملف' });
    }

    const userId = req.user?.id || (req.headers['x-user-id'] as string) || 'admin';

    // 1. File Validation (magic bytes, MIME type, XSS vectors, size)
    const validation = validateUploadedFile(req.file.buffer, req.file.mimetype, req.file.originalname);
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: validation.reason });
    }

    try {
      const isAvatar = req.body?.type === 'avatar' || req.query?.type === 'avatar';
      const customFolder = isAvatar ? `uploads/avatars/${userId}` : `uploads/${userId}`;

      const fileUrl = await storageService.uploadFile({
        buffer: req.file.buffer,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
      }, customFolder);

      return res.json({
        url: fileUrl,
        success: true,
        message: 'تم رفع الملف بنجاح'
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

  // GET /serve?key=... - Proxy route to fetch and serve files from private R2 bucket using S3 credentials
  router.get('/serve', async (req, res) => {
    try {
      const key = req.query.key as string;
      if (!key) {
        return res.status(400).json({ success: false, message: 'مفتاح الملف مطلوب' });
      }

      // Check if file exists in R2/S3
      const exists = await storageService.headObject(key);
      if (!exists) {
        logger.warn(`[StorageController] File not found in storage: ${key}`);
        return res.status(404).json({ success: false, message: 'الملف غير موجود' });
      }

      // Fetch file buffer from R2/S3
      const buffer = await storageService.getFileBuffer(key);
      
      // Determine content type
      let mimeType = 'application/octet-stream';
      if (key.endsWith('.webp')) mimeType = 'image/webp';
      else if (key.endsWith('.jpg') || key.endsWith('.jpeg')) mimeType = 'image/jpeg';
      else if (key.endsWith('.png')) mimeType = 'image/png';
      else if (key.endsWith('.gif')) mimeType = 'image/gif';
      else if (key.endsWith('.mp4')) mimeType = 'video/mp4';

      res.setHeader('Content-Type', mimeType);
      res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
      return res.send(buffer);
    } catch (e: any) {
      logger.error(`[StorageController] File serve error: ${e.message}`);
      return res.status(500).json({
        success: false,
        message: 'فشل في جلب الملف من التخزين',
        error: e.message
      });
    }
  });

  return router;
};
