import { Request, Response, Router } from 'express';
import { prisma } from '../../src/lib/prisma.ts';
import { logger } from '../lib/logger.ts';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.ts';
import { activeStreamsStore } from '../socket/socket.service.ts';

const SETTING_KEY = 'promo_interactions';

interface ReelInteraction {
  likes: number;
  views: number;
  likedBy: string[];
}

const DEFAULT_PROMO_INTERACTIONS: Record<string, ReelInteraction> = {
  promo_marketplace: { likes: 142, views: 1840, likedBy: [] },
  promo_delivery: { likes: 98, views: 1215, likedBy: [] },
  promo_reels: { likes: 215, views: 2420, likedBy: [] },
  promo_featured_ads: { likes: 86, views: 980, likedBy: [] },
  promo_trust: { likes: 164, views: 1610, likedBy: [] },
};

export function getCountryFromPhone(phone?: string | null): string | null {
  if (!phone) return null;
  const clean = phone.replace(/[^0-9+]/g, '');
  if (clean.startsWith('+962') || clean.startsWith('00962') || clean.startsWith('962')) return 'JO';
  if (clean.startsWith('+967') || clean.startsWith('00967') || clean.startsWith('967')) return 'YE';
  if (clean.startsWith('+966') || clean.startsWith('00966') || clean.startsWith('966')) return 'SA';
  if (clean.startsWith('+20') || clean.startsWith('0020') || clean.startsWith('20')) return 'EG';
  if (clean.startsWith('+970') || clean.startsWith('+972') || clean.startsWith('00970') || clean.startsWith('00972')) return 'PS';
  if (clean.startsWith('+971') || clean.startsWith('00971') || clean.startsWith('971')) return 'AE';
  if (clean.startsWith('+964') || clean.startsWith('00964')) return 'IQ';
  if (clean.startsWith('+965') || clean.startsWith('00965')) return 'KW';
  if (clean.startsWith('+974') || clean.startsWith('00974')) return 'QA';
  if (clean.startsWith('+973') || clean.startsWith('00973')) return 'BH';
  if (clean.startsWith('+968') || clean.startsWith('00968')) return 'OM';
  return null;
}

async function getPromoInteractions(): Promise<Record<string, ReelInteraction>> {
  const interactions: Record<string, ReelInteraction> = { ...DEFAULT_PROMO_INTERACTIONS };
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: SETTING_KEY }
    });
    if (setting && setting.value) {
      const parsed = JSON.parse(setting.value);
      if (typeof parsed === 'object' && parsed !== null) {
        Object.entries(parsed).forEach(([id, val]: [string, any]) => {
          if (val && typeof val === 'object') {
            interactions[id] = {
              likes: typeof val.likes === 'number' ? val.likes : (interactions[id]?.likes || 0),
              views: typeof val.views === 'number' ? val.views : (interactions[id]?.views || 0),
              likedBy: Array.isArray(val.likedBy) ? val.likedBy : [],
            };
          }
        });
      }
    }
  } catch (err) {
    logger.error({ message: '[PromoController] Error loading interactions:', error: err });
  }
  return interactions;
}

async function savePromoInteractions(interactions: Record<string, ReelInteraction>): Promise<void> {
  try {
    await prisma.systemSetting.upsert({
      where: { key: SETTING_KEY },
      create: {
        key: SETTING_KEY,
        value: JSON.stringify(interactions)
      },
      update: {
        value: JSON.stringify(interactions)
      }
    });
  } catch (err) {
    logger.error({ message: '[PromoController] Error saving interactions:', error: err });
  }
}

const ALLOWED_LIVE_MARKERS = new Set(['webcam', 'camera', 'screen', 'live', 'stream', 'rtmp', 'hls']);
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
  router.use(optionalAuthMiddleware);

  // GET /api/promo/interactions - Fetch interaction map & likes
  router.get('/interactions', async (req: Request, res: Response) => {
    try {
      const interactions = await getPromoInteractions();
      const userId = (req as any).user?.id || (req.query.userId as string);
      const userLikedReels: string[] = [];

      if (userId) {
        Object.entries(interactions).forEach(([id, data]) => {
          if (Array.isArray(data.likedBy) && data.likedBy.includes(userId)) {
            userLikedReels.push(id);
          }
        });
      }

      res.json({ success: true, interactions, userLikedReels });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to fetch interactions', message: err.message });
    }
  });

  // GET /api/promo - Fetch promo reels strictly filtered by country market
  router.get('/', async (req: Request, res: Response, next) => {
    try {
      const { countryCode } = req.query;
      const reels = await prisma.reel.findMany({
        include: { 
          user: { 
            select: { 
              id: true, 
              name: true, 
              avatar: true, 
              phone: true, 
              city: true, 
              countryId: true,
              managedCountry: true 
            } 
          } 
        },
        orderBy: { createdAt: 'desc' },
      });

      const interactions = await getPromoInteractions();

      let result = reels.map(r => {
        const parts = r.videoUrl.split('||');
        const mainUrl = parts[0] || '';
        const isWebcamMarker = mainUrl === 'webcam' || mainUrl === 'camera' || mainUrl === 'live' || mainUrl === 'stream';
        const isBroadcastingNow = activeStreamsStore.has(r.id);
        const itemInteractions = interactions[r.id] || { likes: 0, views: 0, likedBy: [] };

        // Strictly resolve country
        const explicitCountry = parts[5] && parts[5].length === 2 ? parts[5].toUpperCase() : null;
        const phoneCountry = getCountryFromPhone(r.user?.phone);
        const cityCountry = (r.user?.city || '').toLowerCase().includes('amman') || (r.user?.city || '').includes('عمان') ? 'JO' : null;
        const userCountry = r.user?.managedCountry?.toUpperCase() || (r.user?.countryId && r.user.countryId.toLowerCase() !== 'ye' ? r.user.countryId.toUpperCase() : null);

        const resolvedCountry = explicitCountry || phoneCountry || cityCountry || userCountry || 'YE';

        return {
          ...r,
          countryCode: resolvedCountry,
          city: parts[3] || 'كافة المناطق',
          category: parts[4] || 'عام',
          isLive: isBroadcastingNow || isWebcamMarker,
          likes: itemInteractions.likes || 0,
          views: itemInteractions.views || 0,
          likedBy: itemInteractions.likedBy || [],
        };
      });

      if (typeof countryCode === 'string' && countryCode.trim()) {
        const reqCountry = countryCode.trim().toUpperCase();
        result = result.filter(r => r.countryCode === reqCountry || r.countryCode === 'ALL');
      }

      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // POST /api/promo - Create reel with strict country tagging
  router.post('/', async (req: any, res: Response, next) => {
    try {
      const {
        title,
        description,
        videoUrl,
        city,
        countryCode: reqCountryCode,
        category,
        isLive,
        userId,
        userName,
        userAvatar,
      } = req.body;

      const effectiveUserId = req.user?.id || (userId && userId !== 'guest_user' && userId !== 'guest' ? userId : null);

      if (!effectiveUserId) {
        return res.status(401).json({ error: 'يجب تسجيل الدخول لنشر مقطع ريلز' });
      }

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(effectiveUserId)) {
        return res.status(401).json({ error: 'حساب المستخدم غير صالح، يرجى تسجيل الدخول' });
      }

      const userRecord = await prisma.user.findUnique({ where: { id: effectiveUserId } });
      if (!userRecord) {
        return res.status(401).json({ error: 'المستخدم غير موجود' });
      }

      if (!title || typeof title !== 'string' || title.trim().length === 0) {
        return res.status(400).json({ error: 'العنوان مطلوب' });
      }
      if (!videoUrl || typeof videoUrl !== 'string' || videoUrl.trim().length === 0) {
        return res.status(400).json({ error: 'رابط ملف الفيديو مطلوب' });
      }
      if (videoUrl.startsWith('webcam') || videoUrl.startsWith('camera')) {
        return res.status(400).json({ error: 'يرجى رفع أو تسجيل ملف فيديو حقيقي للنشر' });
      }
      if (title.trim().length > 200) {
        return res.status(400).json({ error: 'العنوان طويل جداً (الحد 200 حرف)' });
      }

      const urlCheck = validateMediaUrl(videoUrl);
      if (!urlCheck.valid) {
        return res.status(400).json({ error: `رابط الفيديو غير صالح: ${urlCheck.reason}` });
      }

      // Determine country code
      const effectiveCountryCode = (
        reqCountryCode ||
        getCountryFromPhone(userRecord.phone) ||
        (userRecord.managedCountry ? userRecord.managedCountry.toUpperCase() : null) ||
        'YE'
      ).toUpperCase();

      // Ensure videoUrl stores countryCode as 6th segment: url||audio||desc||city||category||countryCode
      let finalSerializedVideoUrl = videoUrl.trim();
      const parts = finalSerializedVideoUrl.split('||');
      if (parts.length < 6) {
        while (parts.length < 5) parts.push('');
        parts[5] = effectiveCountryCode;
        finalSerializedVideoUrl = parts.join('||');
      }

      let newReel;
      try {
        newReel = await prisma.reel.create({
          data: {
            title: title.trim(),
            videoUrl: finalSerializedVideoUrl,
            userId: effectiveUserId,
          },
          include: {
            user: { select: { name: true, avatar: true, phone: true } },
          },
        });
      } catch (dbErr: any) {
        logger.error({ message: 'Failed to create database Reel', error: dbErr.message });
        newReel = {
          id: `promo_fallback_${Date.now()}`,
          title: title.trim(),
          videoUrl: finalSerializedVideoUrl,
          userId: effectiveUserId,
          createdAt: new Date().toISOString(),
          user: { name: userName || "عضو أسواق", avatar: userAvatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80" }
        };
      }

      const finalUserName = (userRecord && newReel.user?.name) ? newReel.user.name : (userName || 'مستخدم أسواق');
      const finalUserAvatar = (userRecord && newReel.user?.avatar) ? newReel.user.avatar : (userAvatar || '');

      return res.status(201).json({
        ...newReel,
        countryCode: effectiveCountryCode,
        isLive: !!isLive,
        description: description || '',
        city: city || 'كافة المناطق',
        category: category || 'عام',
        userName: finalUserName,
        userAvatar: finalUserAvatar,
        likes: 0,
        views: 0
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
        return res.status(400).json({ error: 'Invalid promo id format' });
      }

      const existingReel = await prisma.reel.findUnique({ where: { id } });
      if (!existingReel) {
        return res.status(404).json({ error: 'الريل غير موجود' });
      }

      const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes((req.user?.role || '').toUpperCase());
      if (existingReel.userId !== req.user?.id && !isAdmin) {
        return res.status(403).json({ error: 'لا تملك صلاحية حذف هذا الريل' });
      }

      await prisma.reel.delete({ where: { id } });
      res.json({ success: true, message: 'تم حذف الريل بنجاح' });
    } catch (err: any) {
      logger.error({ message: `DELETE /api/promo Error: ${err.message}`, error: err });
      next(err);
    }
  });

  // POST /api/promo/:id/like - Toggle Like
  router.post('/:id/like', async (req: any, res: Response) => {
    try {
      const { id } = req.params;
      const { userId } = req.body;
      const effectiveUserId = req.user?.id || (userId && userId !== 'guest' ? userId : null);

      const interactions = await getPromoInteractions();
      if (!interactions[id]) {
        interactions[id] = { likes: 0, views: 0, likedBy: [] };
      }

      const item = interactions[id];
      let userLiked = false;

      if (effectiveUserId) {
        if (item.likedBy.includes(effectiveUserId)) {
          item.likedBy = item.likedBy.filter(uid => uid !== effectiveUserId);
          item.likes = Math.max(0, item.likes - 1);
          userLiked = false;
        } else {
          item.likedBy.push(effectiveUserId);
          item.likes += 1;
          userLiked = true;
        }
      } else {
        item.likes += 1;
        userLiked = true;
      }

      await savePromoInteractions(interactions);
      res.json({ success: true, likes: item.likes, userLiked });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to toggle like', message: err.message });
    }
  });

  // POST /api/promo/:id/view - Increment View
  router.post('/:id/view', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const interactions = await getPromoInteractions();
      if (!interactions[id]) {
        interactions[id] = { likes: 0, views: 0, likedBy: [] };
      }

      interactions[id].views += 1;
      await savePromoInteractions(interactions);
      res.json({ success: true, views: interactions[id].views });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to record view', message: err.message });
    }
  });

  return router;
}
