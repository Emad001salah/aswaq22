import { Router } from 'express';
import multer from 'multer';
import { storageService } from '../services/storage.service.ts';

export const StorageController = () => {
  const router = Router();

  // Configure multer memory storage
  const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
  });

  // Handle both single image or video uploads
  router.post('/upload', upload.single('file'), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'لم يتم رفع أي ملف' });
    }

    try {
      const fileUrl = await storageService.uploadFile({
        buffer: req.file.buffer,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
      });

      res.json({
        url: fileUrl,
        success: true,
        message: 'تم رفع الملف بنجاح'
      });
    } catch (e: any) {
      res.status(500).json({
        success: false,
        message: 'فشل في رفع الملف',
        error: e.message
      });
    }
  });

  return router;
};
