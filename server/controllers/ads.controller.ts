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
import { cacheService } from '../services/cache.service.ts';
import { AppError } from '../middleware/error.ts';


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
    const take = Math.min(parseInt(limit as string) || 20, 100); // Cap at 100

    // Try Redis cache if no cursor (caching general homepage feeds)
    const cacheKey = `ads:latest:${city || 'all'}:${category || 'all'}:${take}`;
    if (!cursor) {
      const cachedData = await redis.get(cacheKey);
      if (cachedData) {
        const etag = `"ads-${cacheKey.length}-${cachedData.length}"`;
        if (req.headers['if-none-match'] === etag) {
          return res.status(304).end();
        }
        res.setHeader('ETag', etag);
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');
        return res.json(JSON.parse(cachedData));
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

      const mappedAds = ads.map(ad => {
        const safeImgs = Array.isArray(ad.images) ? ad.images.map((img: any) => {
          const rawUrl = typeof img === 'object' && img !== null ? img.url : img;
          const resolved = resolveMediaUrl(rawUrl);
          return typeof img === 'object' && img !== null ? { ...img, url: resolved } : resolved;
        }) : [];
        return {
          ...ad,
          images: safeImgs,
          category: getLegacyName(ad.categoryId) || '',
          subCategory: getLegacyName(ad.subCategoryId) || null,
          likes: ad._count?.likedBy || 0,
          userName: ad.user?.name,
          userAvatar: ad.user?.avatar,
          userVerified: ad.user?.isVerified === 'verified'
        };
      });
      const nextCursor = mappedAds.length === take ? mappedAds[mappedAds.length - 1].id : undefined;
      const responseData = { ads: mappedAds, nextCursor };

      // Cache for 120 seconds — higher than before, still fresh enough
      if (!cursor) {
        const payload = JSON.stringify(responseData);
        await redis.set(cacheKey, payload, 120);
        const etag = `"ads-${cacheKey.length}-${payload.length}"`;
        res.setHeader('ETag', etag);
        res.setHeader('X-Cache', 'MISS');
        res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');
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
    const { q, city, category, minPrice, maxPrice, condition, hasImages, sortBy, market, limit = '20' } = req.query;
    const searchLimit = Math.min(parseInt(limit as string) || 20, 100);
    const searchQuery = q ? String(q) : '';

    try {
      // 1. Try Meilisearch first if online and searchQuery is non-empty
      if (searchQuery && searchEngine.isAvailable()) {
        console.log(`[Search] Performing fuzzy query in Meilisearch: "${searchQuery}"`);
        const hits = await searchEngine.search(searchQuery, {
          city: city ? String(city) : undefined,
          category: category ? String(category) : undefined,
          status: 'ACTIVE',
          minPrice: minPrice ? parseFloat(String(minPrice)) : undefined,
          maxPrice: maxPrice ? parseFloat(String(maxPrice)) : undefined,
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

      // Determine sorting order with deterministic secondary sort (id: desc)
      let orderByClause: any[] = [{ createdAt: 'desc' }, { id: 'desc' }];
      if (sortBy === 'price_asc') orderByClause = [{ price: 'asc' }, { id: 'desc' }];
      if (sortBy === 'price_desc') orderByClause = [{ price: 'desc' }, { id: 'desc' }];
      if (sortBy === 'views') orderByClause = [{ views: 'desc' }, { id: 'desc' }];

      // 2. Database Fallback (Prisma full-text & filter query)
      console.log(`[Search] Querying database using Prisma for market: ${market || 'ALL'}...`);
      const ads = await prisma.ad.findMany({
        where: {
          status: 'ACTIVE',
          ...(market && market !== 'ALL' ? { countryCode: String(market).toUpperCase() } : {}),
          city: city ? String(city) : undefined,
          categoryId: category ? (uuidRegex.test(String(category)) ? String(category) : getDeterministicUuid(String(category))) : undefined,
          price: (minPrice || maxPrice) ? {
            gte: minPrice ? parseFloat(String(minPrice)) : undefined,
            lte: maxPrice ? parseFloat(String(maxPrice)) : undefined,
          } : undefined,
          images: hasImages === 'true' ? { some: {} } : undefined,
          OR: searchQuery ? [
            { title: { contains: searchQuery, mode: 'insensitive' } },
            { description: { contains: searchQuery, mode: 'insensitive' } }
          ] : undefined,
        },
        orderBy: orderByClause,
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

    // Pre-process Base64 image decoding OUTSIDE of database transaction to prevent I/O transaction timeouts
    const preparedImages: Array<{ url: string; mediaId: string | null; objectKey: string | null; width: number | null; height: number | null; blurHash: string | null }> = [];
    if (dto.images && dto.images.length > 0) {
      for (let idx = 0; idx < dto.images.length; idx++) {
        const img = dto.images[idx];
        let url = img.url || '';
        let objectKey = null;

        if (url && typeof url === 'string' && url.startsWith('data:image/')) {
          try {
            const sharp = (await import('sharp')).default;
            const fs = await import('fs');
            const path = await import('path');
            const commaIdx = url.indexOf(',');
            if (commaIdx !== -1) {
              const base64Data = url.substring(commaIdx + 1);
              const buffer = Buffer.from(base64Data.trim(), 'base64');

              // Compress to ultra-light WebP (~25KB per photo)
              let compressedBuffer = buffer;
              try {
                compressedBuffer = await sharp(buffer)
                  .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
                  .webp({ quality: 75 })
                  .toBuffer();
              } catch (sharpErr) {
                logger.warn(`Sharp ad image compression fallback: ${(sharpErr as any)?.message}`);
              }

              // Also write static file to disk
              const uploadsDir = path.join(process.cwd(), 'uploads');
              if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
              const filename = `ad-img-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}.webp`;
              const filePath = path.join(uploadsDir, filename);
              await fs.promises.writeFile(filePath, compressedBuffer);

              // Store permanent compressed WebP Base64 Data URI in Postgres DB so images NEVER get lost on Render disk restarts
              url = `data:image/webp;base64,${compressedBuffer.toString('base64')}`;
            }
          } catch (base64Err) {
            logger.error({ message: 'Failed decoding ad base64 image', error: (base64Err as any)?.message });
          }
        }

        preparedImages.push({
          url,
          mediaId: (img.mediaId && uuidRegex.test(img.mediaId)) ? img.mediaId : null,
          objectKey: objectKey || img.url || null,
          width: img.width || null,
          height: img.height || null,
          blurHash: img.blurHash || null,
        });
      }
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        // Resolve category — must already exist in DB; never auto-create to prevent ghost categories
        const catRaw = dto.category || '';
        const catSlug = catRaw.toLowerCase().trim();
        const catUuid = uuidRegex.test(catRaw) ? catRaw : getDeterministicUuid(catSlug);

        const category = await tx.category.findFirst({
          where: {
            OR: [
              { id: catUuid },
              { nameEn: { equals: catRaw, mode: 'insensitive' } },
              { nameAr: { equals: catRaw, mode: 'insensitive' } }
            ]
          }
        });

        if (!category) {
          throw new AppError(400, `القسم المحدد غير موجود: "${catRaw}". يرجى اختيار قسم صحيح من القائمة.`, ['INVALID_CATEGORY']);
        }
        const categoryId = category.id;

        // Resolve subcategory — only look up, never auto-create
        let subCategoryId: string | null = null;
        if (dto.subCategory) {
          const subRaw = dto.subCategory;
          const subSlug = subRaw.toLowerCase().trim();
          const subUuid = uuidRegex.test(subRaw) ? subRaw : getDeterministicUuid(subSlug);

          const subCategory = await tx.subCategory.findFirst({
            where: {
              OR: [
                { id: subUuid },
                { nameEn: { equals: subRaw, mode: 'insensitive' } },
                { nameAr: { equals: subRaw, mode: 'insensitive' } }
              ],
              categoryId  // must belong to the resolved parent category
            }
          });

          // Reject unknown or mismatched subcategory — never silently ignore
          if (!subCategory) {
            throw new AppError(
              400,
              `القسم الفرعي المحدد "${subRaw}" غير موجود أو لا يتبع القسم الرئيسي "${category.nameAr}".`,
              ['INVALID_SUBCATEGORY']
            );
          }
          subCategoryId = subCategory.id;
        }

        // Create the core Ad
        const ad = await tx.ad.create({
          data: {
            title: dto.title,
            description: dto.description,
            price: dto.price,
            currency: dto.currency || 'YER',
            categoryId,
            subCategoryId,
            jobType: dto.jobType as JobType,
            city: dto.city,
            district: dto.district,
            latitude: dto.latitude,
            longitude: dto.longitude,
            contactNumber: dto.contactNumber,
            userId: req.user!.id, // Securely mapped from JWT
            // Status is ALWAYS determined server-side — never trust the client
            status: (['ADMIN', 'SUPER_ADMIN'].includes(req.user!.role.toUpperCase())
              ? 'ACTIVE'
              : 'ACTIVE') as any, // Regular users publish as ACTIVE (auto-approve flow)
          }
        });

        // Insert initial images
        let imagesToProcess: any[] = [];
        if (preparedImages.length > 0) {
          const imageRecords = [];
          for (let idx = 0; idx < preparedImages.length; idx++) {
            const img = preparedImages[idx];
            let url = img.url;
            let objectKey = img.objectKey;

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
              mediaId: img.mediaId,
              objectKey: objectKey || img.url || null,
              url: url,
              sortOrder: idx,
              width: img.width,
              height: img.height,
              blurHash: img.blurHash,
            });
          }

          await tx.adImage.createMany({ data: imageRecords });
          
          // Re-fetch to retrieve auto-generated IDs
          const insertedImages = await tx.adImage.findMany({ where: { adId: ad.id } });
          imagesToProcess = insertedImages;
        }

        return { ad, imagesToProcess };
      }, { maxWait: 15000, timeout: 30000 });

      // Emit event asynchronously to trigger Search indexing and BullMQ resizing worker
      eventBus.emit('ad.created', {
        ...result.ad,
        imagesToProcess: result.imagesToProcess,
      });

      // Clear related Redis latest ad feeds caches non-blockingly using SCAN
      await cacheService.invalidateFeedCaches();


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
      // AppError carries the correct HTTP status — pass it through
      if (e instanceof AppError) {
        return res.status(e.statusCode).json({
          success: false,
          error: e.message,
          details: e.details,
        });
      }
      res.status(500).json({ error: 'Ad Creation Failed', message: e.message });
    }
  });

  // GET /api/ads/:id
  router.get('/:id', async (req, res) => {
    const idParam = req.params.id;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isUuid = uuidRegex.test(idParam);

    try {
      let ad: any = null;
      if (isUuid) {
        ad = await prisma.ad.findUnique({
          where: { id: idParam },
          include: {
            images: { orderBy: { sortOrder: 'asc' } },
            user: { select: { id: true, name: true, avatar: true, phone: true, isVerified: true } },
            bids: {
              include: {
                bidder: { select: { id: true, name: true, avatar: true } }
              },
              orderBy: { amount: 'desc' },
              take: 10
            },
            comments: {
              include: {
                author: { select: { id: true, name: true, avatar: true } }
              },
              orderBy: { createdAt: 'desc' }
            },
            _count: { select: { likedBy: true } }
          }
        });
      } else {
        const allActiveAds = await prisma.ad.findMany({
          take: 100,
          include: {
            images: { orderBy: { sortOrder: 'asc' } },
            user: { select: { id: true, name: true, avatar: true, phone: true, isVerified: true } },
            bids: {
              include: { bidder: { select: { id: true, name: true, avatar: true } } },
              orderBy: { amount: 'desc' },
              take: 10
            },
            comments: {
              include: { author: { select: { id: true, name: true, avatar: true } } },
              orderBy: { createdAt: 'desc' }
            },
            _count: { select: { likedBy: true } }
          }
        });
        ad = allActiveAds.find(a => {
          const hexPart = (a.id || '').replace(/[^0-9a-f]/gi, '').substring(0, 8);
          const num = parseInt(hexPart || '10000000', 16);
          const code = ((num % 900000000) + 100000000).toString();
          return code === idParam;
        }) || allActiveAds[0];
      }

      if (!ad) return res.status(404).json({ error: 'Ad not found', message: 'الإعلان غير موجود.' });

      const highestBid = (ad as any).bids && (ad as any).bids.length > 0 ? (ad as any).bids[0].amount : (ad.startingPrice || ad.price);

      const safeImgs = Array.isArray(ad.images) ? ad.images.map((img: any) => {
        const rawUrl = typeof img === 'object' && img !== null ? img.url : img;
        const resolved = resolveMediaUrl(rawUrl);
        return typeof img === 'object' && img !== null ? { ...img, url: resolved } : resolved;
      }) : [];

      const mappedAd = {
        ...ad,
        images: safeImgs,
        likes: ad._count?.likedBy || 0,
        highestBid,
        totalBids: (ad as any).bids ? (ad as any).bids.length : 0,
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
      if (!uuidRegex.test(req.params.id)) {
        return res.json({ views: 1 });
      }
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

      if (!uuidRegex.test(adId)) {
        return res.status(201).json({
          id: `c_mock_${Date.now()}`,
          text,
          adId,
          authorId,
          author: {
            id: authorId,
            name: req.user!.name,
            avatar: req.user!.avatar
          },
          createdAt: new Date().toISOString()
        });
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

      if (!uuidRegex.test(adId)) {
        return res.json({ likes: 1 });
      }

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
      await prisma.ad.update({
        where: { id: adId },
        data: { likes: likesCount }
      }).catch(() => {});
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

      // Status on update: admins with BYPASS_MODERATION can set any status; others preserve current
      const statusValue = hasPermission(req.user?.role, 'BYPASS_MODERATION')
        ? ((req.body.status ? req.body.status.toString().toUpperCase() : null) || ad.status)
        : ad.status; // Regular users cannot change the status field

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

      // Validate category exists before accepting update
      if (req.body.category) {
        const catRaw = req.body.category as string;
        const catUuid = uuidRegex.test(catRaw) ? catRaw : getDeterministicUuid(catRaw.toLowerCase().trim());
        const cat = await prisma.category.findUnique({ where: { id: catUuid } });
        if (!cat) {
          return res.status(400).json({
            success: false,
            error: `القسم المحدد غير موجود: "${catRaw}". يرجى اختيار قسم صحيح.`,
            details: ['INVALID_CATEGORY'],
          });
        }
        dataUpdate.categoryId = cat.id;
      }
      if (req.body.subCategory) {
        const subRaw = req.body.subCategory as string;
        const subUuid = uuidRegex.test(subRaw) ? subRaw : getDeterministicUuid(subRaw.toLowerCase().trim());
        const sub = await prisma.subCategory.findFirst({
          where: { id: subUuid, categoryId: dataUpdate.categoryId || ad.categoryId }
        });
        if (!sub) {
          return res.status(400).json({
            success: false,
            error: `القسم الفرعي "${subRaw}" غير موجود أو لا يتبع القسم الرئيسي المحدد.`,
            details: ['INVALID_SUBCATEGORY'],
          });
        }
        dataUpdate.subCategoryId = sub.id;
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
      await cacheService.invalidateFeedCaches();

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
      await cacheService.invalidateFeedCaches();

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

  // POST /api/ads/:id/bids - Place a bid on an auction ad
  router.post('/:id/bids', authMiddleware, async (req: AuthenticatedRequest, res) => {
    const { id } = req.params;
    const { amount } = req.body;
    const bidderId = req.user!.id;

    const bidAmount = parseFloat(String(amount));
    if (isNaN(bidAmount) || bidAmount <= 0) {
      return res.status(400).json({ error: 'قيمة المزايدة يجب أن تكون رقماً أكبر من صفر.' });
    }

    try {
      const ad = await prisma.ad.findUnique({
        where: { id },
        include: {
          bids: { orderBy: { amount: 'desc' }, take: 1 }
        }
      });

      if (!ad) return res.status(404).json({ error: 'الإعلان غير موجود' });
      if (ad.userId === bidderId) {
        return res.status(400).json({ error: 'لا يمكنك المزايدة على إعلانك الخاص.' });
      }

      const currentHighest = ad.bids && ad.bids.length > 0 ? ad.bids[0].amount : (ad.startingPrice || ad.price);
      const minStep = ad.minBidStep || 5;

      if (bidAmount < currentHighest + minStep) {
        return res.status(400).json({
          error: `يجب أن تكون قيمة المزايدة على الأقل ${currentHighest + minStep} (${currentHighest} + ${minStep} أدنى حد للزيادة)`
        });
      }

      // Check auction expiration
      if (ad.auctionEndsAt && new Date(ad.auctionEndsAt) < new Date()) {
        return res.status(400).json({ error: 'عفواً، انتهى وقت المزاد لهذا الإعلان.' });
      }

      const newBid = await (prisma as any).bid.create({
        data: {
          adId: id,
          bidderId,
          amount: bidAmount
        },
        include: {
          bidder: { select: { id: true, name: true, avatar: true } }
        }
      });

      // Update ad price to current highest bid
      await prisma.ad.update({
        where: { id },
        data: { price: bidAmount }
      }).catch(() => null);

      // Async notify ad owner
      const { NotificationService } = await import('../services/notification.service.ts');
      NotificationService.sendPushToUser(ad.userId, {
        title: '🏷️ عرض مزايدة جديد!',
        body: `قدم ${req.user!.name} مزايدة جديدة بقيمة ${bidAmount} على إعلانك "${ad.title}"`,
        data: { adId: id, type: 'NEW_BID' }
      }).catch(() => null);

      res.status(201).json({
        success: true,
        message: 'تم تقديم المزايدة بنجاح! 🎯',
        bid: newBid
      });
    } catch (e: any) {
      res.status(500).json({ error: 'Bid Failed', message: e.message });
    }
  });

  return router;
};
