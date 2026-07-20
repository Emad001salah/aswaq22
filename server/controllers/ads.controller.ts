import express, { Router } from 'express';
import { prisma } from '../../src/lib/prisma.ts';
import { redis } from '../../src/lib/redis.ts';
import { searchEngine } from '../../src/lib/meilisearch.ts';
import { eventBus } from '../../src/lib/events.ts';
import { validationMiddleware } from '../middleware/validation.ts';
import { CreateAdDto } from '../dto/ads.dto.ts';
import { authMiddleware, AuthenticatedRequest, hasPermission, permissionsGuard } from '../middleware/auth.ts';
import { logger } from '../lib/logger.ts';
import { storageService } from '../services/storage.service.ts';
import { JobType } from '@prisma/client';
import { getDeterministicUuid, getLegacyName } from '../utils/db-helpers.ts';
import { resolveMediaUrl } from '../utils/media-url.ts';

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const AdsController = () => {
  const router = Router();

  // GET /api/ads (With Cursor Pagination + Redis Caching)
  /**
   * @openapi
   * /ads:
   *   get:
   *     summary: Get list of active ads with pagination
   *     tags: [Ads]
   *     parameters:
   *       - in: query
   *         name: city
   *         schema:
   *           type: string
   *         description: Filter ads by city
   *       - in: query
   *         name: category
   *         schema:
   *           type: string
   *         description: Filter ads by category
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 20
   *         description: Maximum number of ads to return
   *       - in: query
   *         name: cursor
   *         schema:
   *           type: string
   *         description: Cursor for pagination
   *     responses:
   *       200:
   *         description: List of ads retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 ads:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/Ad'
   *                 nextCursor:
   *                   type: string
   *       500:
   *         description: Database error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  router.get('/', async (req, res) => {
    const { city, cursor, limit = '20', category } = req.query;
    const take = parseInt(limit as string);

    // Try Redis cache if no cursor/category is requested (caching general homepage feeds)
    const cacheKey = `ads:latest:${city || 'all'}:${category || 'all'}:${limit}`;
    if (!cursor) {
      const cachedData = await redis.get(cacheKey);
      if (cachedData) {
        const parsed = JSON.parse(cachedData);
        return res.json(parsed);
      }
    }

    try {
      const ads = await prisma.ad.findMany({
        take,
        skip: cursor ? 1 : 0,
        cursor: cursor ? { id: String(cursor) } : undefined,
        where: {
          city: city ? String(city) : undefined,
          categoryId: category ? (uuidRegex.test(String(category)) ? String(category) : getDeterministicUuid(String(category))) : undefined,
          status: 'ACTIVE',
        },
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          images: {
            orderBy: { sortOrder: 'asc' }
          },
          user: {
            select: { id: true, name: true, avatar: true, isVerified: true }
          },
          _count: {
            select: { likedBy: true }
          }
        }
      });

      const mappedAds = ads.map(ad => ({
        ...ad,
        category: getLegacyName(ad.categoryId) || '',
        subCategory: getLegacyName(ad.subCategoryId) || null,
        likes: ad._count?.likedBy || 0,
        userName: ad.user?.name,
        userAvatar: ad.user?.avatar,
        userVerified: ad.user?.isVerified === 'verified'
      }));
      const nextCursor = mappedAds.length === take ? mappedAds[mappedAds.length - 1].id : undefined;
      const responseData = { ads: mappedAds, nextCursor };

      // Save to cache for 60 seconds if no pagination cursor was used
      if (!cursor) {
        await redis.set(cacheKey, JSON.stringify(responseData), 60);
      }

      res.json(responseData);
    } catch (e: any) {
      res.status(500).json({ error: 'Database Error', message: e.message });
    }
  });

  // GET /api/ads/search (Fuzzy search in Meilisearch with dynamic Prisma FTS fallback)
  /**
   * @openapi
   * /ads/search:
   *   get:
   *     summary: Search ads with query
   *     tags: [Ads]
   *     parameters:
   *       - in: query
   *         name: q
   *         schema:
   *           type: string
   *         description: Search query
   *       - in: query
   *         name: city
   *         schema:
   *           type: string
   *       - in: query
   *         name: category
   *         schema:
   *           type: string
   *       - in: query
   *         name: minPrice
   *         schema:
   *           type: number
   *       - in: query
   *         name: maxPrice
   *         schema:
   *           type: number
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 20
   *     responses:
   *       200:
   *         description: Search results
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/Ad'
   *       500:
   *         description: Search error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  router.get('/search', async (req, res) => {
    const { q, city, category, minPrice, maxPrice, limit = '20' } = req.query;
    const searchLimit = parseInt(limit as string);
    const searchQuery = q ? String(q) : '';

    try {
      // 1. Try Meilisearch first if online and searchQuery is non-empty
      if (searchQuery && searchEngine.isAvailable()) {
        console.log(`[Search] Performing fuzzy query in Meilisearch: "${searchQuery}"`);
        const hits = await searchEngine.search(searchQuery, {
          city: city ? String(city) : undefined,
          category: category ? String(category) : undefined,
          status: 'ACTIVE',
        }, searchLimit);

        if (hits && hits.length > 0) {
          // Resolve full ads documents from PostgreSQL using matched IDs
          const adIds = hits.map(h => h.id);
          const ads = await prisma.ad.findMany({
            where: { id: { in: adIds } },
            include: { images: true, user: { select: { id: true, name: true, avatar: true, isVerified: true } } }
          });
          const mappedAds = ads.map(ad => ({
            ...ad,
            category: getLegacyName(ad.categoryId) || '',
            subCategory: getLegacyName(ad.subCategoryId) || null,
            userName: ad.user?.name,
            userAvatar: ad.user?.avatar,
            userVerified: ad.user?.isVerified === 'verified'
          }));
          // Sort results based on Meilisearch matched order
          const sortedAds = adIds.map(id => mappedAds.find(a => a.id === id)).filter(Boolean);
          return res.json(sortedAds);
        }
      }

      // 2. Database Fallback (Prisma full-text query)
      console.log(`[Search] Meilisearch offline/returned null. Querying database using Prisma...`);
      const ads = await prisma.ad.findMany({
        where: {
          status: 'ACTIVE',
          city: city ? String(city) : undefined,
          categoryId: category ? (uuidRegex.test(String(category)) ? String(category) : getDeterministicUuid(String(category))) : undefined,
          price: {
            gte: minPrice ? parseFloat(String(minPrice)) : undefined,
            lte: maxPrice ? parseFloat(String(maxPrice)) : undefined,
          },
          OR: searchQuery ? [
            { title: { contains: searchQuery, mode: 'insensitive' } },
            { description: { contains: searchQuery, mode: 'insensitive' } }
          ] : undefined,
        },
        orderBy: { createdAt: 'desc' },
        include: { images: true, user: { select: { id: true, name: true, avatar: true, isVerified: true } } },
        take: searchLimit
      });

      const mappedAds = ads.map(ad => ({
        ...ad,
        category: getLegacyName(ad.categoryId) || '',
        subCategory: getLegacyName(ad.subCategoryId) || null,
        userName: ad.user?.name,
        userAvatar: ad.user?.avatar,
        userVerified: ad.user?.isVerified === 'verified'
      }));

      res.json(mappedAds);
    } catch (e: any) {
      res.status(500).json({ error: 'Search Error', message: e.message });
    }
  });

  // POST /api/ads (Decoupled ad creation + event emitting)
  /**
   * @openapi
   * /ads:
   *   post:
   *     summary: Create a new ad
   *     tags: [Ads]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - title
   *               - description
   *               - price
   *               - category
   *               - city
   *             properties:
   *               title:
   *                 type: string
   *               description:
   *                 type: string
   *               price:
   *                 type: number
   *               currency:
   *                 type: string
   *                 default: YER
   *               category:
   *                 type: string
   *               subCategory:
   *                 type: string
   *               city:
   *                 type: string
   *               district:
   *                 type: string
   *               contactNumber:
   *                 type: string
   *               latitude:
   *                 type: number
   *               longitude:
   *                 type: number
   *               images:
   *                 type: array
   *                 items:
   *                   type: object
   *                   required:
   *                     - url
   *                   properties:
   *                     url:
   *                       type: string
   *                     width:
   *                       type: number
   *                     height:
   *                       type: number
   *                     blurHash:
   *                       type: string
   *     responses:
   *       201:
   *         description: Ad created successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 ad:
   *                   $ref: '#/components/schemas/Ad'
   *       401:
   *         description: Unauthorized
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  router.post('/', authMiddleware, validationMiddleware(CreateAdDto), async (req: AuthenticatedRequest, res) => {
    const dto = req.body as CreateAdDto;

    try {
      const result = await prisma.$transaction(async (tx) => {
        // Create the core Ad
        const ad = await tx.ad.create({
          data: {
            title: dto.title,
            description: dto.description,
            price: dto.price,
            currency: dto.currency || 'YER',
            categoryId: uuidRegex.test(dto.category) ? dto.category : getDeterministicUuid(dto.category),
            subCategoryId: dto.subCategory ? (uuidRegex.test(dto.subCategory) ? dto.subCategory : getDeterministicUuid(dto.subCategory)) : null,
            jobType: dto.jobType as JobType,
            city: dto.city,
            district: dto.district,
            latitude: dto.latitude,
            longitude: dto.longitude,
            contactNumber: dto.contactNumber,
            userId: req.user!.id, // Securely mapped from JWT
            status: (dto as any).status || 'PENDING',
          }
        });

        // Insert initial images
        let imagesToProcess: any[] = [];
        if (dto.images && dto.images.length > 0) {
          const imageRecords = [];
          for (let idx = 0; idx < dto.images.length; idx++) {
            const img = dto.images[idx];
            let url = img.url || '';
            let objectKey = null;

            if (img.mediaId && uuidRegex.test(img.mediaId)) {
              const media = await tx.mediaObject.findUnique({
                where: { id: img.mediaId }
              });
              if (media) {
                if (media.uploadedBy !== req.user!.id) {
                  throw new Error('Unauthorized or invalid media resource');
                }
                
                const resolvedUrl = resolveMediaUrl(media);
                if (resolvedUrl) {
                  url = resolvedUrl;
                }
                objectKey = media.objectKey;
              }
            }

            imageRecords.push({
              adId: ad.id,
              mediaId: (img.mediaId && uuidRegex.test(img.mediaId)) ? img.mediaId : null,
              objectKey: objectKey || img.url || null,
              url: url,
              sortOrder: idx,
              width: img.width || null,
              height: img.height || null,
              blurHash: img.blurHash || null,
            });
          }

          await tx.adImage.createMany({ data: imageRecords });
          
          // Re-fetch to retrieve auto-generated IDs
          const insertedImages = await tx.adImage.findMany({ where: { adId: ad.id } });
          imagesToProcess = insertedImages;
        }

        return { ad, imagesToProcess };
      });

      // Emit event asynchronously to trigger Search indexing and BullMQ resizing worker
      eventBus.emit('ad.created', {
        ...result.ad,
        imagesToProcess: result.imagesToProcess,
      });

      // Clear related Redis latest ad feeds caches
      const keys = await redis.getClient()?.keys('ads:latest:*');
      if (keys && keys.length > 0) {
        await Promise.all(keys.map(k => redis.del(k)));
      }

      const adWithUser = await prisma.ad.findUnique({
        where: { id: result.ad.id },
        include: {
          images: { orderBy: { sortOrder: 'asc' } },
          user: { select: { id: true, name: true, avatar: true, isVerified: true } }
        }
      });
      const mappedAd = adWithUser ? {
        ...adWithUser,
        userName: adWithUser.user?.name,
        userAvatar: adWithUser.user?.avatar,
        userVerified: adWithUser.user?.isVerified === 'verified'
      } : { ...result.ad, images: result.imagesToProcess };

      res.status(201).json({
        message: 'تم نشر الإعلان بنجاح.',
        ad: mappedAd
      });
    } catch (e: any) {
      res.status(500).json({ error: 'Ad Creation Failed', message: e.message });
    }
  });

  // GET /api/ads/:id
  router.get('/:id', async (req, res) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(req.params.id)) {
      return res.status(404).json({ error: 'Ad not found', message: 'الإعلان غير موجود.' });
    }

    try {
      const ad = await prisma.ad.findUnique({
        where: { id: req.params.id },
        include: {
          images: { orderBy: { sortOrder: 'asc' } },
          user: { select: { id: true, name: true, avatar: true, phone: true, isVerified: true } },
          comments: {
            include: {
              author: { select: { id: true, name: true, avatar: true } }
            },
            orderBy: { createdAt: 'desc' }
          },
          _count: { select: { likedBy: true } }
        }
      });

      if (!ad) return res.status(404).json({ error: 'Ad not found' });

      const mappedAd = {
        ...ad,
        likes: ad._count?.likedBy || 0,
        userName: ad.user?.name,
        userAvatar: ad.user?.avatar,
        userVerified: ad.user?.isVerified === 'verified'
      };
      res.json(mappedAd);
    } catch (e: any) {
      res.status(500).json({ error: 'Database Error', message: e.message });
    }
  });

  // POST /api/ads/:id/view
  router.post('/:id/view', async (req, res) => {
    try {
      const updated = await prisma.ad.update({
        where: { id: req.params.id },
        data: { views: { increment: 1 } }
      });
      // Optionally trigger meilisearch update or event bus if needed
      res.json({ views: updated.views });
    } catch (e: any) {
      res.status(500).json({ error: 'Failed to increment view' });
    }
  });

  // POST /api/ads/:id/comments (Create a comment)
  router.post('/:id/comments', authMiddleware, express.json(), async (req: AuthenticatedRequest, res) => {
    try {
      const adId = req.params.id;
      const { text } = req.body;
      const authorId = req.user!.id;

      if (!text || !text.trim()) {
        return res.status(400).json({ error: 'Comment text is required' });
      }

      // Check if ad exists
      const ad = await prisma.ad.findUnique({ where: { id: adId } });
      if (!ad) return res.status(404).json({ error: 'Ad not found' });

      // Create comment
      const comment = await prisma.comment.create({
        data: {
          text,
          adId,
          authorId
        },
        include: {
          author: { select: { id: true, name: true, avatar: true } }
        }
      });

      res.status(201).json(comment);
    } catch (e: any) {
      res.status(500).json({ error: 'Database Error', message: e.message });
    }
  });

  // POST /api/ads/:id/like
  router.post('/:id/like', authMiddleware, express.json(), async (req: AuthenticatedRequest, res) => {
    try {
      const action = req.body?.action;
      const adId = req.params.id;
      const userId = req.user!.id;

      if (action === 'unlike') {
        await prisma.adLike.deleteMany({
          where: { adId, userId }
        });
      } else {
        await prisma.adLike.upsert({
          where: { adId_userId: { adId, userId } },
          create: { adId, userId },
          update: {}
        });
      }
      
      const likesCount = await prisma.adLike.count({ where: { adId } });
      res.json({ likes: likesCount });
    } catch (e: any) {
      console.error('[Ads] Like Error:', e);
      res.status(500).json({ error: 'Failed to update like' });
    }
  });

  // PUT /api/ads/:id (Secure via authMiddleware)
  router.put('/:id', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const ad = await prisma.ad.findUnique({ where: { id: req.params.id } });
      if (!ad) return res.status(404).json({ error: 'Ad not found' });

      if (ad.userId !== req.user!.id && req.user!.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const statusValue = (hasPermission(req.user?.role, 'BYPASS_MODERATION') || (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test'))
        ? (req.body.status || ad.status)
        : 'PENDING';

      const dataUpdate: any = {
        title: req.body.title,
        description: req.body.description,
        price: req.body.price ? parseFloat(req.body.price) : undefined,
        city: req.body.city,
        district: req.body.district,
        jobType: req.body.jobType ? (req.body.jobType as JobType) : undefined,
        status: statusValue,
        contactNumber: req.body.contactNumber !== undefined ? req.body.contactNumber : undefined,
      };

      if (req.body.category) {
        dataUpdate.categoryId = uuidRegex.test(req.body.category) ? req.body.category : getDeterministicUuid(req.body.category);
      }
      if (req.body.subCategory) {
        dataUpdate.subCategoryId = uuidRegex.test(req.body.subCategory) ? req.body.subCategory : getDeterministicUuid(req.body.subCategory);
      }

      const updated = await prisma.ad.update({
        where: { id: req.params.id },
        data: dataUpdate,
        include: {
          images: true,
          user: { select: { id: true, name: true, avatar: true, isVerified: true } }
        }
      });

      const mappedAd = {
        ...updated,
        category: getLegacyName(updated.categoryId) || '',
        subCategory: getLegacyName(updated.subCategoryId) || null,
        userName: updated.user?.name,
        userAvatar: updated.user?.avatar,
        userVerified: updated.user?.isVerified === 'verified'
      };

      eventBus.emit('ad.updated', mappedAd);

      res.json({ message: 'تم تحديث الإعلان بنجاح.', ad: mappedAd });
    } catch (e: any) {
      res.status(500).json({ error: 'Update Failed', message: e.message });
    }
  });

  // DELETE /api/ads/:id (Secure)
  router.delete('/:id', authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const ad = await prisma.ad.findUnique({ 
        where: { id: req.params.id },
        include: { images: true }
      });
      if (!ad) return res.status(404).json({ error: 'Ad not found' });

      if (ad.userId !== req.user!.id && req.user!.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Forbidden' });
      }

      // Delete physical files from local/cloud storage
      if (ad.images && ad.images.length > 0) {
        for (const img of ad.images) {
          try {
            await storageService.deleteFile(img.url);
          } catch (err: any) {
            logger.error(`[Storage] Failed to delete file during ad deletion: ${img.url}. Error: ${err.message}`);
          }
        }
      }

      await prisma.ad.delete({ where: { id: req.params.id } });
      eventBus.emit('ad.deleted', req.params.id);

      res.json({ message: 'تم حذف الإعلان بنجاح.' });
    } catch (e: any) {
      res.status(500).json({ error: 'Delete Failed', message: e.message });
    }
  });
  
  // PATCH /api/v1/ads/:id/approve (Secure via authMiddleware)
  router.patch('/:id/approve', authMiddleware, permissionsGuard('APPROVE_REJECT_ADS'), async (req: AuthenticatedRequest, res) => {
    try {
      const ad = await prisma.ad.findUnique({ where: { id: req.params.id } });
      if (!ad) return res.status(404).json({ error: 'Ad not found', message: 'الإعلان غير موجود.' });

      // Rules: Only ADMIN can approve a previously rejected ad
      if (ad.status === 'REJECTED' && req.user.role !== 'ADMIN') {
        return res.status(403).json({ 
          error: 'Forbidden', 
          message: 'لا يمكن إعادة تفعيل إعلان مرفوض مسبقاً إلا بواسطة مدير النظام (ADMIN).' 
        });
      }

      const result = await prisma.$transaction(async (tx) => {
        const updated = await tx.ad.update({
          where: { id: req.params.id },
          data: { status: 'ACTIVE' },
          include: { images: true }
        });

        // Audit Log
        await tx.adminLog.create({
          data: {
            adminId: req.user!.id,
            action: 'APPROVE_AD',
            details: JSON.stringify({
              adId: ad.id,
              ownerId: ad.userId,
              correlationId: req.correlationId,
            }),
            ipAddress: req.ip,
          }
        });

        // Notification to owner
        await tx.notification.create({
          data: {
            userId: ad.userId,
            title: 'تمت الموافقة على إعلانك 🎉',
            description: `تمت الموافقة ونشر إعلانك بنجاح: "${ad.title}"`,
            type: 'system',
          }
        });

        return updated;
      });

      eventBus.emit('ad.updated', result);

      logger.info({ 
        message: 'Ad approved by admin', 
        adId: ad.id, 
        adminId: req.user.id, 
        correlationId: req.correlationId 
      });

      res.json({ success: true, message: 'تمت الموافقة على الإعلان ونشره.', ad: result });
    } catch (e: any) {
      res.status(500).json({ error: 'Approve Failed', message: e.message });
    }
  });

  // PATCH /api/v1/ads/:id/reject (Secure via authMiddleware)
  router.patch('/:id/reject', authMiddleware, permissionsGuard('APPROVE_REJECT_ADS'), async (req: AuthenticatedRequest, res) => {
    const { reason } = req.body;
    if (!reason) {
      return res.status(400).json({ error: 'Validation Failed', message: 'سبب الرفض مطلوب.' });
    }

    try {
      const ad = await prisma.ad.findUnique({ where: { id: req.params.id } });
      if (!ad) return res.status(404).json({ error: 'Ad not found', message: 'الإعلان غير موجود.' });

      const result = await prisma.$transaction(async (tx) => {
        const updated = await tx.ad.update({
          where: { id: req.params.id },
          data: { status: 'REJECTED' },
          include: { images: true }
        });

        // Audit Log
        await tx.adminLog.create({
          data: {
            adminId: req.user!.id,
            action: 'REJECT_AD',
            details: JSON.stringify({
              adId: ad.id,
              ownerId: ad.userId,
              reason,
              correlationId: req.correlationId,
            }),
            ipAddress: req.ip,
          }
        });

        // Notification to owner
        await tx.notification.create({
          data: {
            userId: ad.userId,
            title: 'تم رفض إعلانك ⚠️',
            description: `تم رفض إعلانك: "${ad.title}". السبب: ${reason}`,
            type: 'system',
          }
        });

        return updated;
      });

      eventBus.emit('ad.updated', result);

      logger.info({ 
        message: 'Ad rejected by admin', 
        adId: ad.id, 
        adminId: req.user.id, 
        reason,
        correlationId: req.correlationId 
      });

      res.json({ success: true, message: 'تم رفض الإعلان وإشعار المستخدم.', ad: result });
    } catch (e: any) {
      res.status(500).json({ error: 'Reject Failed', message: e.message });
    }
  });

  // POST /api/ads/:id/report (Secure)
  router.post('/:id/report', authMiddleware, async (req: AuthenticatedRequest, res) => {
    const { id } = req.params;
    const { reason } = req.body;
    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'Reason is required for reporting an ad' });
    }
    try {
      const ad = await prisma.ad.findUnique({ where: { id } });
      if (!ad) return res.status(404).json({ error: 'Ad not found' });

      const report = await prisma.report.create({
        data: {
          adId: id,
          reporterId: req.user!.id,
          reason: reason.trim(),
          status: 'pending'
        }
      });

      res.status(201).json({ success: true, message: 'تم إرسال البلاغ بنجاح للإدارة وسيتم مراجعته.', report });
    } catch (e: any) {
      res.status(500).json({ error: 'Report Failed', message: e.message });
    }
  });

  return router;
};
