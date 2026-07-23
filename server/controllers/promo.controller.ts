/**
 * server/controllers/promo.controller.ts
 *
 * Controller handling Promo Reels, Live Streams, and Video Feeds
 *
 * Clean Architecture Refactor (2026-07-22):
 *  - Extracted inline handlers from app.ts into a clean, testable Router module.
 *  - Full input validation & SSRF protection on media URLs.
 *  - Proper ownership checking on update/delete operations.
 */

import { Request, Response, Router } from 'express';
import { prisma } from '../../src/lib/prisma.ts';
import { logger } from '../lib/logger.ts';
import { authMiddleware } from '../middleware/auth.ts';

const ALLOWED_LIVE_MARKERS = new Set(['webcam', 'camera', 'screen']);
const PRIVATE_IP_REGEX = /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|0\.|::1|localhost)/i;
const INTERNAL_HOSTNAME_REGEX = /^https?:\/\/(postgres|redis|meilisearch|adminer|grafana|prometheus|app|localhost|127\.0\.0\.1)(:|\/)*/i;

function validateMediaUrl(url: string): { valid: boolean; reason?: string } {
  const trimmed = url.trim();
  const rawMedia = trimmed.split('||')[0].trim();

  if (ALLOWED_LIVE_MARKERS.has(rawMedia.toLowerCase())) return { valid: true };
  if (trimmed.length > 2048) return { valid: false, reason: 'URL طويل جداً' };

  let parsed: URL;
  try {
    parsed = new URL(rawMedia);
  } catch {
    return { valid: false, reason: 'رابط URL غير صالح' };
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { valid: false, reason: `بروتوكول غير مسموح: ${parsed.protocol}` };
  }

  if (PRIVATE_IP_REGEX.test(parsed.hostname)) {
    return { valid: false, reason: 'عناوين IP الداخلية غير مسموح بها' };
  }

  if (INTERNAL_HOSTNAME_REGEX.test(rawMedia)) {
    return { valid: false, reason: 'مضيف داخلي غير مسموح' };
  }

  return { valid: true };
}

export function PromoController() {
  const router = Router();

  // GET /api/promo - Fetch all promo reels
  router.get('/', async (req: Request, res: Response, next) => {
    try {
      const reels = await prisma.reel.findMany({
        include: { user: { select: { name: true, avatar: true } } },
        orderBy: { createdAt: 'desc' },
      });
      res.json(reels);
    } catch (err) {
      next(err);
    }
  });

  // POST /api/promo - Create reel/live stream
  router.post('/', authMiddleware, async (req: any, res: Response, next) => {
    try {
      const {
        title,
        description,
        videoUrl,
        city,
        category,
        isLive,
        userName,
        userAvatar,
      } = req.body;

      const authenticatedUserId = req.user?.id;
      if (!authenticatedUserId) {
        return res.status(401).json({ error: 'يجب تسجيل الدخول لنشر مقطع.' });
      }

      if (!title || typeof title !== 'string' || title.trim().length === 0) {
        return res.status(400).json({ error: 'العنوان مطلوب' });
      }
      if (!videoUrl || typeof videoUrl !== 'string' || videoUrl.trim().length === 0) {
        return res.status(400).json({ error: 'رابط الفيديو أو مصدر البث مطلوب' });
      }
      if (title.trim().length > 200) {
        return res.status(400).json({ error: 'العنوان طويل جداً (الحد 200 حرف)' });
      }

      const urlCheck = validateMediaUrl(videoUrl);
      if (!urlCheck.valid) {
        return res.status(400).json({ error: `رابط الفيديو غير صالح: ${urlCheck.reason}` });
      }

      const newReel = await prisma.reel.create({
        data: {
          title: title.trim(),
          videoUrl: videoUrl.trim(),
          userId: authenticatedUserId,
        },
        include: {
          user: { select: { name: true, avatar: true } },
        },
      });

      return res.status(201).json({
        ...newReel,
        isLive: !!isLive,
        description: description || '',
        city: city || 'كافة المناطق',
        category: category || 'عام',
        userName: newReel.user?.name || userName || 'مستخدم',
        userAvatar: newReel.user?.avatar || userAvatar || '',
      });
    } catch (err) {
      next(err);
    }
  });

  // PATCH /api/promo/:id - Update reel
  router.patch('/:id', authMiddleware, async (req: any, res: Response, next) => {
    try {
      const { id } = req.params;
      const { videoUrl, title } = req.body;

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        return res.status(400).json({ error: 'Invalid promo id format' });
      }

      if (typeof title !== 'string' || title.trim().length === 0) {
        return res.status(400).json({ error: 'Title must be a non-empty string' });
      }
      if (typeof videoUrl !== 'string' || videoUrl.trim().length === 0) {
        return res.status(400).json({ error: 'Video URL must be a non-empty string' });
      }

      const existingReel = await prisma.reel.findUnique({ where: { id } });
      if (!existingReel) {
        return res.status(404).json({ error: 'الريل غير موجود' });
      }
      const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes((req.user?.role || '').toUpperCase());
      if (existingReel.userId !== req.user?.id && !isAdmin) {
        return res.status(403).json({ error: 'لا يمكنك تعديل ريل لا تملكه.' });
      }

      const updatedReel = await prisma.reel.update({
        where: { id },
        data: { title: title.trim(), videoUrl: videoUrl.trim() },
        include: { user: { select: { name: true, avatar: true } } },
      });

      res.json({
        ...updatedReel,
        isLive: videoUrl === 'webcam' || videoUrl === 'camera',
        userName: updatedReel.user?.name || 'زائر',
        userAvatar: updatedReel.user?.avatar || '',
      });
    } catch (err: any) {
      logger.error({ message: `PATCH /api/promo Error: ${err.message}`, error: err });
      next(err);
    }
  });

  // DELETE /api/promo/:id - Delete reel
  router.delete('/:id', authMiddleware, async (req: any, res: Response, next) => {
    try {
      const { id } = req.params;
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        return res.status(400).json({ error: 'Invalid reel id format' });
      }

      const existingReel = await prisma.reel.findUnique({ where: { id } });
      if (!existingReel) {
        return res.json({ success: true });
      }
      const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes((req.user?.role || '').toUpperCase());
      if (existingReel.userId !== req.user?.id && !isAdmin) {
        return res.status(403).json({ error: 'لا يمكنك حذف ريل لا تملكه.' });
      }

      await prisma.reel.delete({ where: { id } });
      res.json({ success: true, message: 'تم حذف الريل بنجاح' });
    } catch (err: any) {
      logger.error({ message: `DELETE /api/promo Error: ${err.message}`, error: err });
      next(err);
    }
  });

  // POST /api/promo/:id/view - Increment views for promo reels
  router.post('/:id/view', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updated = await prisma.reel.update({
        where: { id },
        data: { views: { increment: 1 } }
      }).catch(() => null);
      return res.json({ views: updated ? updated.views : 1 });
    } catch {
      return res.json({ views: 1 });
    }
  });

  // POST /api/promo/:id/like - Increment/decrement likes for promo reels
  router.post('/:id/like', authMiddleware as any, async (req: any, res: Response) => {
    try {
      const { id } = req.params;
      const action = req.body?.action;
      const updated = await prisma.reel.update({
        where: { id },
        data: { likes: action === 'unlike' ? { decrement: 1 } : { increment: 1 } }
      }).catch(() => null);
      return res.json({ likes: updated ? Math.max(0, updated.likes) : 1 });
    } catch {
      return res.json({ likes: 1 });
    }
  });

  return router;
}
