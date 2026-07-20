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
      const isAvatar = req.body?.type === 'avatar' || req.query?.type === 'avatar';
      const customFolder = isAvatar ? `avatars/${userId}` : `uploads/${userId}`;

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

  return router;
};
