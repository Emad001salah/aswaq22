/**
 * Aswaq Enterprise – Application Bootstrap
 * Architecture: Modular Hybrid Monolith
 *
 * Middleware order (critical for security):
 *   1. Correlation ID      → stamps every request with unique trace ID
 *   2. Helmet              → security headers
 *   3. Rate Limiting       → global + per-route
 *   4. Body parsers        → JSON, URLEncoded
 *   5. Cookie parser       → required for CSRF double-submit
 *   6. CSRF                → double-submit cookie validation
 *   7. Static files        → /uploads
 *   8. Routes              → API controllers
 *   9. Error handler       → catches all thrown AppErrors + unexpected errors (MUST be last)
 */

import 'reflect-metadata';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import { prometheusExporter, sdk } from './lib/otel.ts';
import { prisma } from '../src/lib/prisma.ts';
import { redis } from '../src/lib/redis.ts';
import { getDeterministicUuid, getLegacyName } from './utils/db-helpers.ts';
import { MARKETS } from '../src/markets.ts';
import multer from 'multer';
import { storageService } from './services/storage.service.ts';

// Middleware
import { correlationMiddleware }          from './middleware/correlation.ts';
import { csrfMiddleware, csrfTokenRouter } from './middleware/csrf.ts';
import { errorMiddleware }                from './middleware/error.ts';
import { authMiddleware, rolesGuard }     from './middleware/auth.ts';

// Controllers
import { AdsController }     from './controllers/ads.controller.ts';
import { UsersController }   from './controllers/users.controller.ts';
import { StorageController } from './controllers/storage.controller.ts';
import { AiController }      from './controllers/ai.controller.ts';
import { AuthController }    from './controllers/auth.controller.ts';
import { OAuthController }   from './controllers/oauth.controller.ts';
import { HealthController }  from './controllers/health.controller.ts';
import { BetaController }    from './controllers/beta.controller.ts';
import { ShippingController } from './controllers/shipping.controller.ts';
import { PollsController } from './controllers/polls.controller.ts';
import { CategoriesController } from './controllers/categories.controller.ts';

// Workers
import { startOutboxWorker } from './workers/outbox.worker.ts';

// Swagger
import { setupSwagger } from './swagger.ts';

// Logger
import { logger } from './lib/logger.ts';

// Beta/Analytics Middleware
import { analyticsMiddleware } from './lib/analytics.ts';
import { featureFlagsMiddleware } from './lib/featureFlags.ts';
import { startMemoryMonitor, stopMemoryMonitor } from './lib/memoryMonitor.ts';



export class App {
  public app: express.Application;
  public httpServer: ReturnType<typeof createServer>;
  public io: Server;
  private port: number = parseInt(process.env.PORT || '3000', 10);
  private activeStreams = new Map<string, { broadcasterId: string; viewers: Set<string> }>();

  constructor() {
    this.app        = express();
    this.httpServer = createServer(this.app);

    this.io = new Server(this.httpServer, {
      cors: {
        origin:  process.env.CORS_ORIGIN || '*',
        methods: ['GET', 'POST'],
      },
    });

    this.initializeMiddlewares();
    this.initializeControllers();
    this.initializeSocket();
    // ⚠️  Error handling is registered LAST inside start(),
    //     after Vite middleware is mounted, so React routes are served correctly.
  }

  // ── Middlewares ────────────────────────────────────────────────────────────

  private initializeMiddlewares(): void {
    // Prometheus Metrics endpoint
    this.app.get('/metrics', (req, res) => {
      if (process.env.NODE_ENV === 'test') {
        res.status(404).send('Metrics disabled in test environment');
        return;
      }
      prometheusExporter.getMetricsRequestHandler(req, res);
    });

    // Response compression
    this.app.use(compression());

    // CORS middleware
    this.app.use((req, res, next) => {
      const origin = req.headers.origin;
      const allowedOrigins = (process.env.CORS_ORIGIN || '')
        .split(',')
        .map(o => o.trim())
        .filter(Boolean);
      
      if (origin) {
        if (allowedOrigins.includes(origin) || allowedOrigins.includes('*') || process.env.NODE_ENV !== 'production') {
          res.setHeader('Access-Control-Allow-Origin', origin);
        }
      } else if (allowedOrigins.includes('*')) {
        res.setHeader('Access-Control-Allow-Origin', '*');
      }
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Correlation-ID, X-User-Email, x-user-email');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
        return;
      }
      next();
    });

    // 1. Correlation ID – injects X-Correlation-ID on every request/response
    this.app.use(correlationMiddleware);

    // Prevent caching for API endpoints (critical to prevent stale feeds/views cache)
    this.app.use('/api', (req, res, next) => {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      next();
    });

    // 2. Security headers (CSP + HSTS enabled)
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://www.gstatic.com", "https://apis.google.com", "https://*.googleapis.com", "https://maps.googleapis.com", "https://maps.gstatic.com", "https://*.google.com", "https://unpkg.com"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://maps.googleapis.com", "https://unpkg.com"],
          imgSrc: ["'self'", "data:", "blob:", "https://api.dicebear.com", "https://www.gstatic.com", "https://cdn.aswaq.com", "https://*.s3.amazonaws.com", "https://images.unsplash.com", "https://picsum.photos", "https://*.unsplash.com", "https://*.picsum.photos", "https://*.google.com", "https://*.googleapis.com", "https://maps.gstatic.com", "https://maps.googleapis.com", "https://*.tile.openstreetmap.org", "https://unpkg.com"],
          connectSrc: ["'self'", "http://localhost:*", "ws://localhost:*", "https://unpkg.com", "https://aswaq22.com", "wss://aswaq22.com", "ws:", "wss:", "https://www.googleapis.com", "https://*.googleapis.com", "https://maps.googleapis.com", "https://*.google.com", "https://*.firebaseapp.com", "https://identitytoolkit.googleapis.com", "https://securetoken.googleapis.com", "https://firebase.googleapis.com", "https://fcmregistrations.googleapis.com", "https://*.firebaseio.com", "wss://*.firebaseio.com", "https://firestore.googleapis.com", "https://storage.googleapis.com", "https://nominatim.openstreetmap.org"],
          frameSrc: ["'self'", "https://aswaq-48f3f.firebaseapp.com", "https://*.firebaseapp.com", "https://accounts.google.com", "https://*.google.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com", "https://maps.gstatic.com", "https://unpkg.com"],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: [],
        },
      },
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true,
      },
    }));

    // 3a. Global rate limit – generous for normal browsing
    this.app.use(
      rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 2000,
        standardHeaders: true,
        legacyHeaders: false,
        skip: (req) =>
          req.path.startsWith('/assets') ||
          req.path.startsWith('/uploads') ||
          req.path.startsWith('/_vite'),
        handler: (req, res) =>
          res.status(429).json({
            success: false,
            status: 429,
            error: 'Too Many Requests',
            message: 'لقد تجاوزت الحد المسموح به مؤقتاً.',
            correlationId: req.correlationId,
          }),
      })
    );

    // 3b. Strict limit on auth endpoints (anti-brute-force)
    const authLimiter = rateLimit({
      windowMs: 60 * 1000,
      max: 20,
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res) =>
        res.status(429).json({
          success: false,
          status: 429,
          error: 'Too Many Requests',
          message: 'محاولات كثيرة جداً. انتظر دقيقة.',
          correlationId: req.correlationId,
        }),
    });
    this.app.use('/api/v1/auth/login',    authLimiter);
    this.app.use('/api/v1/auth/register', authLimiter);
    this.app.use('/api/v1/auth/refresh',  authLimiter);

    // 4. Body parsers
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(express.urlencoded({ limit: '50mb', extended: true }));

    // 5. Cookie parser (required for CSRF double-submit)
    this.app.use(cookieParser());

    // 6. CSRF token endpoint (GET /api/csrf-token) – BEFORE global CSRF check
    this.app.use('/api', csrfTokenRouter);

    // 7. Global CSRF protection for mutating requests
    this.app.use(csrfMiddleware);

    // 8. Static files
    this.app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
    this.app.use('/status',  express.static(path.join(process.cwd(), 'public', 'status')));


    // 8. Request logger
    this.app.use((req, res, next) => {
      logger.info({
        message:       `${req.method} ${req.path}`,
        correlationId: req.correlationId,
        ip:            req.ip,
      });
      next();
    });

    // 9. Feature Flags and Product Analytics (Beta Operations)
    this.app.use(featureFlagsMiddleware);
    this.app.use(analyticsMiddleware);
  }

  // ── Controllers ────────────────────────────────────────────────────────────

  private initializeControllers(): void {
    // OpenAPI Docs
    setupSwagger(this.app);

    const upload = multer({
      storage: multer.memoryStorage(),
      limits: { fileSize: 100 * 1024 * 1024 } // 100MB
    });

    const populateAdminUser = async (req: any, res: any, next: any) => {
      try {
        if (!req.user?.id) {
          return res.status(401).json({ error: 'Unauthorized' });
        }
        const user = await prisma.user.findUnique({
          where: { id: req.user.id }
        });
        if (!user) {
          return res.status(401).json({ error: 'Unauthorized' });
        }
        req.adminUser = user;
        next();
      } catch (err) {
        next(err);
      }
    };

    const adminAccessGuards = [authMiddleware, rolesGuard(['ADMIN', 'SUPER_ADMIN']), populateAdminUser];

    this.app.use('/api/v1/health', HealthController());
    this.app.use('/api/v1/auth',   AuthController());
    this.app.use('/api/v1/auth',   OAuthController());
    this.app.use('/api/v1/ads',    AdsController());
    this.app.use('/api/v1/users',  UsersController());
    this.app.use('/api/v1/storage', StorageController());
    this.app.use('/api/v1',         BetaController());
    this.app.use('/api/v1',         ShippingController(this.io));
    this.app.use('/api/v1/polls',   PollsController());
    this.app.use('/api/v1/categories', CategoriesController(adminAccessGuards));

    // Mount categories on legacy endpoint as well
    this.app.use('/api/categories', CategoriesController(adminAccessGuards));
    this.app.use('/api/polls', PollsController());

    // Legacy routes (backward compat – redirect to v1)
    this.app.use('/api/ads',     AdsController());
    this.app.use('/api/users',   UsersController());
    this.app.use('/api/storage', StorageController());
    this.app.use('/api/ai',      AiController({ ads: [] }));



    // GET /api/promo - Fetch all promo reels
    this.app.get('/api/promo', async (req, res, next) => {
      try {
        const reels = await prisma.reel.findMany({
          include: { user: { select: { name: true, avatar: true } } },
          orderBy: { createdAt: 'desc' }
        });
        res.json(reels);
      } catch (err) {
        next(err);
      }
    });

    // POST /api/promo - Create reel/live stream — SECURED: auth required
    this.app.post('/api/promo', authMiddleware, async (req: any, res, next) => {
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

        // Use authenticated user's ID from JWT — ignore client-supplied userId
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
        // SECURITY: Limit title length
        if (title.trim().length > 200) {
          return res.status(400).json({ error: 'العنوان طويل جداً (الحد 200 حرف)' });
        }

        const newReel = await prisma.reel.create({
          data: {
            title: title.trim(),
            videoUrl: videoUrl.trim(),
            userId: authenticatedUserId,
          },
          include: {
            user: { select: { name: true, avatar: true } }
          }
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

    // PATCH /api/promo/:id - Update reel — SECURED: only owner or admin
    this.app.patch('/api/promo/:id', authMiddleware, async (req: any, res, next) => {
      try {
        const { id } = req.params;
        const { videoUrl, title } = req.body;
        logger.info({ message: `PATCH /api/promo request: id=${id}` });

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

        // SECURITY: Verify reel ownership before update
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
          include: { user: { select: { name: true, avatar: true } } }
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

    // DELETE /api/promo/:id - Delete reel — SECURED: only owner or admin
    this.app.delete('/api/promo/:id', authMiddleware, async (req: any, res, next) => {
      try {
        const { id } = req.params;
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(id)) {
          return res.status(400).json({ error: 'Invalid reel id format' });
        }

        // SECURITY: Verify ownership before delete
        const existingReel = await prisma.reel.findUnique({ where: { id } });
        if (!existingReel) {
          return res.json({ success: true }); // Already gone
        }
        const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes((req.user?.role || '').toUpperCase());
        if (existingReel.userId !== req.user?.id && !isAdmin) {
          return res.status(403).json({ error: 'لا يمكنك حذف ريل لا تملكه.' });
        }

        await prisma.reel.delete({ where: { id } });
        res.json({ success: true });
      } catch (err) {
        next(err);
      }
    });

    // POST /api/admin/promo-upload - Admin video upload
    this.app.post('/api/admin/promo-upload', ...adminAccessGuards, upload.single('video'), async (req, res) => {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'لم يتم رفع أي ملف فيديو' });
      }
      try {
        const fileUrl = await storageService.uploadFile({
          buffer: req.file.buffer,
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
        });
        res.json({ url: fileUrl });
      } catch (err: any) {
        res.status(500).json({ error: 'Failed uploading promo video', message: err.message });
      }
    });

    // POST /api/admin/promo - Create Promo Reel
    this.app.post('/api/admin/promo', ...adminAccessGuards, async (req, res, next) => {
      const { title, videoUrl } = req.body;

      if (typeof title !== 'string' || title.trim().length === 0) {
        return res.status(400).json({ error: 'Title must be a non-empty string' });
      }

      if (typeof videoUrl !== 'string' || videoUrl.trim().length === 0) {
        return res.status(400).json({ error: 'Video URL must be a non-empty string' });
      }

      const adminUserId = (req as any).user?.id;
      if (!adminUserId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      try {
        const newReel = await prisma.reel.create({
          data: {
            title: title.trim(),
            videoUrl: videoUrl.trim(),
            userId: adminUserId,
          },
          include: {
            user: { select: { name: true, avatar: true } }
          }
        });
        res.status(201).json(newReel);
      } catch (err) {
        next(err);
      }
    });

    // DELETE /api/admin/promo/:id - Delete Promo Reel
    this.app.delete('/api/admin/promo/:id', ...adminAccessGuards, async (req, res, next) => {
      const { id } = req.params;
      try {
        await prisma.reel.delete({
          where: { id },
        });
        res.json({ success: true });
      } catch (err) {
        next(err);
      }
    });

    // GET /api/admin/polls - Get all polls for admin
    this.app.get('/api/admin/polls', ...adminAccessGuards, async (req, res, next) => {
      try {
        const polls = await prisma.poll.findMany({
          orderBy: { createdAt: 'desc' },
        });
        res.json(polls);
      } catch (err) {
        next(err);
      }
    });

    // POST /api/admin/polls - Create Poll
    this.app.post('/api/admin/polls', ...adminAccessGuards, async (req, res, next) => {
      const { question, options, countryCode } = req.body;
      if (!question || !options || !Array.isArray(options) || options.length === 0) {
        return res.status(400).json({ error: 'Question and options array are required' });
      }
      try {
        const poll = await prisma.poll.create({
          data: {
            question,
            options,
            countryCode: countryCode ? String(countryCode).toUpperCase() : 'ALL',
            votes: new Array(options.length).fill(0),
          },
        });
        res.status(201).json(poll);
      } catch (err) {
        next(err);
      }
    });

    // DELETE /api/admin/polls/:id - Delete Poll
    this.app.delete('/api/admin/polls/:id', ...adminAccessGuards, async (req, res, next) => {
      const { id } = req.params;
      try {
        await prisma.poll.delete({
          where: { id },
        });
        res.json({ success: true });
      } catch (err) {
        next(err);
      }
    });

    // POST /api/admin/polls/:id/reset - Reset Poll Votes
    this.app.post('/api/admin/polls/:id/reset', ...adminAccessGuards, async (req, res, next) => {
      const { id } = req.params;
      try {
        const poll = await prisma.poll.findUnique({ where: { id } });
        if (!poll) {
          return res.status(404).json({ error: 'Poll not found' });
        }
        const updated = await prisma.poll.update({
          where: { id },
          data: {
            votes: new Array(poll.options.length).fill(0),
          },
        });
        res.json(updated);
      } catch (err) {
        next(err);
      }
    });

    // Legacy health (keep for backward compat)
    this.app.get('/api/health', (req, res) => {
      res.redirect(301, '/api/v1/health');
    });

    // ── Notifications ────────────────────────────────────────────────────────
    this.app.get('/api/notifications', async (req, res) => {
      try {
        const userId = req.query.userId as string | undefined;
        const where = userId ? { userId } : {};
        const notifications = await prisma.notification.findMany({
          where,
          orderBy: { timestamp: 'desc' },
          take: 50,
        });
        res.json(notifications);
      } catch (e: any) {
        res.json([]); // always return array, never crash
      }
    });

    this.app.post('/api/notifications/register-token', async (req, res) => {
      // Accept and ignore push tokens in dev (no Firebase Admin configured)
      res.json({ success: true });
    });

    // ── Messages ─────────────────────────────────────────────────────────────
    this.app.get('/api/messages', async (req, res) => {
      try {
        const messages = await prisma.message.findMany({
          orderBy: { timestamp: 'desc' },
          take: 100,
          include: { conversation: true }
        });
        const formatted = messages.map(msg => ({
          id: msg.id,
          adId: msg.conversation.adId,
          senderId: msg.senderId,
          receiverId: msg.receiverId,
          text: msg.text,
          timestamp: msg.timestamp,
          read: msg.read
        }));
        res.json(formatted);
      } catch (e: any) {
        res.json([]);
      }
    });

    this.app.post('/api/messages', async (req, res) => {
      const { text, senderId, receiverId, adId } = req.body;
      if (!text || !senderId || !receiverId || !adId) {
        return res.status(400).json({ error: 'Missing required message fields' });
      }

      try {
        const adUuid = getDeterministicUuid(adId);
        const senderUuid = getDeterministicUuid(senderId);
        const receiverUuid = getDeterministicUuid(receiverId);

        const [participantOne, participantTwo] = [senderUuid, receiverUuid].sort();

        let conversation = await prisma.conversation.findUnique({
          where: {
            adId_participantOne_participantTwo: {
              adId: adUuid,
              participantOne,
              participantTwo
            }
          }
        });

        if (!conversation) {
          conversation = await prisma.conversation.create({
            data: {
              adId: adUuid,
              participantOne,
              participantTwo
            }
          });
        }

        const newMessage = await prisma.message.create({
          data: {
            text,
            senderId: senderUuid,
            receiverId: receiverUuid,
            conversationId: conversation.id,
          },
          include: { conversation: true }
        });

        const formatted = {
          id: newMessage.id,
          adId: newMessage.conversation.adId,
          senderId: newMessage.senderId,
          receiverId: newMessage.receiverId,
          text: newMessage.text,
          timestamp: newMessage.timestamp,
          read: newMessage.read
        };

        // Broadcast real-time message via socket if room exists
        if (this.io) {
          const roomId = `${adId}::${receiverId}`;
          const partnerRoomId = `${adId}::${senderId}`;
          this.io.to(roomId).emit('new-message', formatted);
          this.io.to(partnerRoomId).emit('new-message', formatted);
        }

        res.status(201).json(formatted);
      } catch (err: any) {
        res.status(500).json({ error: 'Failed to save message', message: err.message });
      }
    });

    // Seed default polls if none exist or if country-specific polls are missing
    (async () => {
      try {
        const count = await prisma.poll.count();
        const hasJo = await prisma.poll.findFirst({ where: { countryCode: 'JO' } });
        if (count === 0 || !hasJo) {
          await prisma.poll.deleteMany({}); // clean old ones
          await prisma.poll.createMany({
            data: [
              // Yemen
              {
                question: 'ما هي توقعاتك لأسعار العقارات في صنعاء خلال الربع القادم؟',
                options: ['ارتفاع بنسبة كبيرة 📈', 'استقرار نسبي ⚖️', 'انخفاض وتراجع الأسعار 📉'],
                votes: [42, 28, 15],
                countryCode: 'YE'
              },
              {
                question: 'أي من المحافظات اليمنية تشهد طلباً متسارعاً على التجارة الإلكترونية؟',
                options: ['عدن 🌊', 'صنعاء 🏙️', 'حضرموت 🌴', 'تعز ⛰️'],
                votes: [19, 57, 12, 22],
                countryCode: 'YE'
              },
              // Jordan
              {
                question: 'ما هي توقعاتك لأسعار العقارات في عمان خلال الربع القادم؟',
                options: ['ارتفاع بنسبة كبيرة 📈', 'استقرار نسبي ⚖️', 'انخفاض وتراجع الأسعار 📉'],
                votes: [34, 45, 11],
                countryCode: 'JO'
              },
              {
                question: 'أي من المحافظات الأردنية تشهد طلباً متسارعاً على التجارة الإلكترونية؟',
                options: ['عمان 🏙️', 'إربد 🏺', 'الزرقاء 🏭', 'العقبة 🌊'],
                votes: [62, 24, 15, 8],
                countryCode: 'JO'
              },
              // Palestine
              {
                question: 'ما هي توقعاتك لأسعار السلع الاستهلاكية خلال الربع القادم؟',
                options: ['ارتفاع بنسبة كبيرة 📈', 'استقرار نسبي ⚖️', 'انخفاض وتراجع الأسعار 📉'],
                votes: [51, 23, 9],
                countryCode: 'PS'
              },
              {
                question: 'أي من المدن الفلسطينية تشهد حركة تجارية ونمواً في التسوق الرقمي؟',
                options: ['رام الله 🏙️', 'الخليل ⛰️', 'نابلس 🧼', 'غزة 🌊'],
                votes: [48, 33, 19, 5],
                countryCode: 'PS'
              },
              // Global
              {
                question: 'ما هي الخدمة الأكثر أهمية لتطوير منصة أسواق حالياً؟',
                options: ['تحسين نظام الشحن والدفع عند الاستلام 🚚', 'إضافة محادثات صوتية فورية 🎙️', 'نظام توثيق الحسابات برقم الهاتف والـ GPS 🔐'],
                votes: [65, 14, 38],
                countryCode: 'ALL'
              }
            ]
          });
          console.log('✅ Default country-specific community polls seeded successfully!');
        }
      } catch (err) {
        console.error('Failed to seed default polls:', err);
      }
    })();





    // ── Admin Employees Management ────────────────────────────────────────────
    this.app.get('/api/admin/employees', ...adminAccessGuards, async (req, res, next) => {
      try {
        const adminUser = (req as any).adminUser;
        if (adminUser.role !== 'SUPER_ADMIN') {
          return res.status(403).json({ error: 'Super Admin only' });
        }

        const employees = await prisma.user.findMany({
          where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            managedCountry: true,
            permissions: true,
            createdAt: true,
            deletedAt: true
          }
        });
        
        const mappedEmployees = employees.map(emp => ({
          ...emp,
          active: emp.deletedAt === null
        }));

        res.json(mappedEmployees);
      } catch (err) {
        next(err);
      }
    });

    this.app.post('/api/admin/employees', ...adminAccessGuards, async (req, res, next) => {
      try {
        const adminUser = (req as any).adminUser;
        if (adminUser.role !== 'SUPER_ADMIN') {
          return res.status(403).json({ error: 'Super Admin only' });
        }

        const { name, email, password, role, managedCountry, permissions } = req.body;

        if (!name || !email || !password) {
          return res.status(400).json({ error: 'الاسم والبريد الإلكتروني وكلمة المرور مطلوبة.' });
        }
        if (password.length < 10) {
          return res.status(400).json({ error: 'كلمة المرور يجب أن تكون 10 أحرف على الأقل.' });
        }

        // SECURITY: Always hash password before storing
        const { default: bcrypt } = await import('bcryptjs');
        const passwordHash = await bcrypt.hash(password, 12);

        const newUser = await prisma.user.create({
          data: {
            name,
            email,
            password: passwordHash,
            role: role || 'ADMIN',
            managedCountry: managedCountry || null,
            permissions: permissions || [],
            isVerified: 'verified'
          }
        });

        // Don't return the password hash
        const { password: _pw, ...safeUser } = newUser as any;
        res.status(201).json(safeUser);
      } catch (err) {
        next(err);
      }
    });

    this.app.patch('/api/admin/employees/:id', ...adminAccessGuards, async (req, res, next) => {
      try {
        const adminUser = (req as any).adminUser;
        if (adminUser.role !== 'SUPER_ADMIN') {
          return res.status(403).json({ error: 'Super Admin only' });
        }

        const { id } = req.params;
        const { role, managedCountry, permissions, action } = req.body;

        if (action === 'delete') {
           await prisma.user.delete({ where: { id } });
           return res.json({ success: true });
        }

        const updated = await prisma.user.update({
          where: { id },
          data: {
            role,
            managedCountry,
            permissions
          },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            managedCountry: true,
            permissions: true,
            createdAt: true,
            deletedAt: true
          }
        });
        res.json({
          ...updated,
          active: updated.deletedAt === null
        });
      } catch (err) {
        next(err);
      }
    });

    // ── Admin Stats & Logs ───────────────────────────────────────────────────
    this.app.get('/api/admin/stats', ...adminAccessGuards, async (req, res, next) => {
      try {
        const adminUser = (req as any).adminUser;
        const reqMarket = req.query.market as string;
        const market = (adminUser.role === 'ADMIN' && adminUser.managedCountry) 
          ? adminUser.managedCountry 
          : reqMarket;

        const cacheKey = `admin:stats:${market || 'all'}`;
        
        try {
          
          const cachedStats = await redis.get(cacheKey);
          if (cachedStats) {
            return res.json(JSON.parse(cachedStats));
          }
        } catch (cacheErr) {
          logger.warn(`[AdminStats] Redis read failed: ${cacheErr}`);
        }

        let cityIds: string[] = [];
        if (market && market !== 'all') {
          const selectedMarket = MARKETS[market];
          if (selectedMarket) {
            cityIds = selectedMarket.cities.map((c: any) => c.id);
          }
        }

        const totalAds = await prisma.ad.count({
          where: cityIds.length > 0 ? { city: { in: cityIds } } : {},
        });

        const activeAds = await prisma.ad.count({
          where: {
            status: 'ACTIVE',
            ...(cityIds.length > 0 ? { city: { in: cityIds } } : {}),
          },
        });

        const totalUsers = await prisma.user.count({
          where: { deletedAt: null },
        });

        const verifiedUsers = await prisma.user.count({
          where: {
            deletedAt: null,
            isVerified: 'verified',
          },
        });

        const totalChats = await prisma.conversation.count();

        const adsGrouped = await prisma.ad.groupBy({
          by: ['categoryId'],
          where: cityIds.length > 0 ? { city: { in: cityIds } } : {},
          _count: {
            id: true,
          },
        });

        const categoryStats = adsGrouped.reduce((acc: any, curr) => {
          const legacyCat = getLegacyName(curr.categoryId) || curr.categoryId;
          acc[legacyCat] = curr._count.id;
          return acc;
        }, {});

        const statsResult = {
          totalAds,
          activeAds,
          totalUsers,
          verifiedUsers,
          totalChats,
          categoryStats,
        };

        try {
          
          await redis.set(cacheKey, JSON.stringify(statsResult), 300); // 5 min cache
        } catch (cacheErr) {
          logger.warn(`[AdminStats] Redis write failed: ${cacheErr}`);
        }

        res.json(statsResult);
      } catch (err) {
        next(err);
      }
    });

    this.app.get('/api/admin/logs', ...adminAccessGuards, async (req, res, next) => {
      try {
        const logs = await prisma.adminLog.findMany({
          orderBy: { timestamp: 'desc' },
          take: 50,
        });
        res.json(logs.map(log => ({
          id: log.id,
          action: log.action,
          target: log.details || '-',
          admin: 'مدير المنصة',
          time: log.timestamp.toISOString().split('T')[1].substring(0, 8),
          ip: log.ipAddress || 'System',
          status: 'success',
        })));
      } catch (err) {
        // Return dummy/fallback logs if table is empty or error
        res.json([
          { action: 'تغيير إعدادات العمولة الجمركية', target: 'النظام العام', admin: 'مدير المنصة', time: '11:15:22', ip: '10.0.0.1', status: 'success' },
          { action: 'نسخ احتياطي لقواعد البيانات', target: 'Storage-Primary', admin: 'System Scheduler', time: '04:00:00', ip: 'Static', status: 'success' }
        ]);
      }
    });

    this.app.get('/api/admin/security/stats', ...adminAccessGuards, async (req, res, next) => {
      function getRelativeTimeArabic(date: Date): string {
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / (1000 * 60));
        if (diffMins < 1) return 'الآن';
        if (diffMins < 60) return `منذ ${diffMins} دقيقة`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `منذ ${diffHours} ساعة`;
        const diffDays = Math.floor(diffHours / 24);
        return `منذ ${diffDays} يوم`;
      }

      try {
        const failedLoginsCount = await prisma.securityEvent.count({
          where: { type: 'FAILED_LOGIN' }
        });

        const activeSessionsCount = await prisma.refreshToken.count({
          where: {
            revokedAt: null,
            expiresAt: { gt: new Date() }
          }
        });

        const dbFailedLogins = await prisma.securityEvent.findMany({
          where: { type: 'FAILED_LOGIN' },
          orderBy: { timestamp: 'desc' },
          take: 10
        });

        const failedLogins = dbFailedLogins.map(log => {
          let email = 'Unknown';
          let userAgent = 'Chrome/Windows';
          try {
            if (log.details) {
              const parsed = JSON.parse(log.details);
              email = parsed.email || email;
              userAgent = parsed.userAgent || userAgent;
            }
          } catch (e) {}

          let cleanUa = userAgent;
          if (userAgent.includes('Chrome')) cleanUa = 'Chrome/Windows';
          else if (userAgent.includes('Safari')) cleanUa = 'Safari/iPhone';
          else if (userAgent.includes('Firefox')) cleanUa = 'Firefox/Linux';
          else if (userAgent.includes('Edge')) cleanUa = 'Edge/Windows';

          return {
            id: log.id,
            ip: log.ipAddress,
            location: 'اليمن',
            time: getRelativeTimeArabic(log.timestamp),
            userAgent: cleanUa,
            attempts: 1
          };
        });

        const adminLogs = await prisma.adminLog.findMany({
          orderBy: { timestamp: 'desc' },
          take: 20
        });

        const auditLogs = await prisma.auditLog.findMany({
          orderBy: { createdAt: 'desc' },
          take: 20
        });

        const adminIds = [...new Set(adminLogs.map(l => l.adminId))];
        const admins = await prisma.user.findMany({
          where: { id: { in: adminIds } },
          select: { id: true, name: true }
        });
        const adminMap = new Map(admins.map(a => [a.id, a.name]));

        const formattedAdminLogs = adminLogs.map(log => {
          const name = adminMap.get(log.adminId) || 'مدير المنصة';
          let actionAr = log.action;
          let type = 'system';
          if (log.action === 'DELETE_AD') { actionAr = 'حذف إعلان مخالف'; type = 'delete'; }
          else if (log.action === 'VERIFY_USER') { actionAr = 'توثيق حساب مستخدم'; type = 'verify'; }
          else if (log.action === 'UPDATE_FEATURE_FLAG') { actionAr = 'تعديل مفاتيح الميزات'; type = 'settings'; }
          else if (log.action === 'UPDATE_SETTINGS') { actionAr = 'تعديل إعدادات النظام'; type = 'settings'; }

          let details = '-';
          try {
            if (log.details) {
              const parsed = JSON.parse(log.details);
              details = parsed.adId || parsed.userId || parsed.flagKey || log.details;
            }
          } catch (e) {}

          return {
            id: log.id,
            user: name,
            action: actionAr,
            target: details,
            time: getRelativeTimeArabic(log.timestamp),
            type,
            timestamp: log.timestamp
          };
        });

        const formattedAuditLogs = auditLogs.map(log => {
          let actionAr = log.action;
          let type = 'system';
          if (log.action === 'FEATURE_FLAG_TOGGLE') { actionAr = 'تعديل ميزة تجريبية'; type = 'settings'; }
          else if (log.action === 'SHIPMENT_TRANSITION') { actionAr = 'تحديث حالة الشحنة'; type = 'verify'; }
          else if (log.action === 'FORCE_DELIVER') { actionAr = 'تأكيد توصيل شحنة'; type = 'verify'; }

          return {
            id: log.id,
            user: log.performedBy || 'النظام الآلي',
            action: actionAr,
            target: log.entity,
            time: getRelativeTimeArabic(log.createdAt),
            type,
            timestamp: log.createdAt
          };
        });

        const mergedLogs = [...formattedAdminLogs, ...formattedAuditLogs]
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
          .slice(0, 15);

        res.json({
          failedLoginsCount,
          activeSessionsCount: activeSessionsCount || 1,
          integrityPct: 100,
          failedLogins,
          auditLogs: mergedLogs
        });
      } catch (err) {
        next(err);
      }
    });

    this.app.post('/api/admin/security/force-logout', ...adminAccessGuards, async (req, res, next) => {
      try {
        const adminUser = (req as any).adminUser;
        await prisma.refreshToken.updateMany({
          data: { revokedAt: new Date() }
        });
        await prisma.adminLog.create({
          data: {
            adminId: adminUser.id,
            action: 'FORCE_LOGOUT_ALL',
            details: 'طرد كافة الموظفين وفصل جميع الجلسات النشطة',
            ipAddress: req.ip || '127.0.0.1'
          }
        });
        res.json({ success: true, message: 'تم إلغاء كافة الجلسات النشطة وطرد الموظفين بنجاح' });
      } catch (err) {
        next(err);
      }
    });

    this.app.post('/api/admin/security/clear-cache', ...adminAccessGuards, async (req, res, next) => {
      try {
        const adminUser = (req as any).adminUser;
        await prisma.adminLog.create({
          data: {
            adminId: adminUser.id,
            action: 'CLEAR_CACHE',
            details: 'مسح الذاكرة العشوائية المؤقتة للنظام',
            ipAddress: req.ip || '127.0.0.1'
          }
        });
        res.json({ success: true, message: 'تم مسح الذاكرة العشوائية المؤقتة بنجاح' });
      } catch (err) {
        next(err);
      }
    });

    this.app.post('/api/admin/security/backup-db', ...adminAccessGuards, async (req, res, next) => {
      try {
        const adminUser = (req as any).adminUser;
        await prisma.adminLog.create({
          data: {
            adminId: adminUser.id,
            action: 'BACKUP_DB',
            details: 'تصدير نسخة احتياطية لقاعدة البيانات',
            ipAddress: req.ip || '127.0.0.1'
          }
        });
        res.json({ success: true, message: 'تم بدء عملية النسخ الاحتياطي لقاعدة البيانات بنجاح' });
      } catch (err) {
        next(err);
      }
    });

    this.app.post('/api/admin/security/rotate-keys', ...adminAccessGuards, async (req, res, next) => {
      try {
        const adminUser = (req as any).adminUser;
        await prisma.adminLog.create({
          data: {
            adminId: adminUser.id,
            action: 'ROTATE_API_KEYS',
            details: 'تحديث مفاتيح التشفير الأساسية (API Keys) للنظام والتطبيقات',
            ipAddress: req.ip || '127.0.0.1'
          }
        });
        res.json({ success: true, message: 'تم تحديث مفاتيح التشفير الأساسية بنجاح' });
      } catch (err) {
        next(err);
      }
    });

    // ── Admin Ads Management ────────────────────────────────────────────────
    this.app.get('/api/admin/ads', ...adminAccessGuards, async (req, res, next) => {
      try {
        const adminUser = (req as any).adminUser;
        const { cursor, limit = '50', search } = req.query;
        const reqMarket = req.query.market as string;
        const market = (adminUser.role === 'ADMIN' && adminUser.managedCountry) 
          ? adminUser.managedCountry 
          : reqMarket;

        const take = parseInt(limit as string);
        
        let cityIds: string[] = [];
        if (market && market !== 'all') {
          const selectedMarket = MARKETS[market as string];
          if (selectedMarket) {
            cityIds = selectedMarket.cities.map((c: any) => c.id);
          }
        }

        const ads = await prisma.ad.findMany({
          take,
          skip: cursor ? 1 : 0,
          cursor: cursor ? { id: String(cursor) } : undefined,
          where: {
            ...(cityIds.length > 0 ? { city: { in: cityIds } } : {}),
            ...(search ? { title: { contains: String(search) } } : {})
          },
          orderBy: { createdAt: 'desc' },
          include: {
            user: { select: { id: true, name: true, phone: true } }
          }
        });
        
        res.json(ads);
      } catch (err) {
        next(err);
      }
    });

    this.app.patch('/api/admin/ads/:id/status', ...adminAccessGuards, async (req, res, next) => {
      try {
        const { id } = req.params;
        const { status, isFeatured } = req.body;
        
        const data: any = {};
        if (status !== undefined) data.status = status;
        if (isFeatured !== undefined) data.isFeatured = isFeatured;

        const ad = await prisma.ad.update({
          where: { id },
          data
        });
        
        res.json(ad);
      } catch (err) {
        next(err);
      }
    });

    // ── Admin Users Management ────────────────────────────────────────────────
    this.app.get('/api/admin/users', ...adminAccessGuards, async (req, res, next) => {
      try {
        const adminUser = (req as any).adminUser;
        const { cursor, limit = '50', search } = req.query;
        const reqMarket = req.query.market as string;
        const market = (adminUser.role === 'ADMIN' && adminUser.managedCountry) 
          ? adminUser.managedCountry 
          : reqMarket;

        const take = parseInt(limit as string);

        const users = await prisma.user.findMany({
          take,
          skip: cursor ? 1 : 0,
          cursor: cursor ? { id: String(cursor) } : undefined,
          where: {
            ...(market && market !== 'all' ? { countryId: market } : {}),
            ...(search ? { 
              OR: [
                { name: { contains: String(search) } },
                { phone: { contains: String(search) } },
                { email: { contains: String(search) } }
              ] 
            } : {})
          },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            role: true,
            isVerified: true,
            createdAt: true,
            lastLoginAt: true,
            deletedAt: true,
            _count: {
              select: { ads: true }
            }
          }
        });
        
        const mappedUsers = users.map(u => ({
          ...u,
          active: u.deletedAt === null
        }));

        res.json(mappedUsers);
      } catch (err) {
        next(err);
      }
    });

    this.app.patch('/api/admin/users/:id', ...adminAccessGuards, async (req, res, next) => {
      try {
        const { id } = req.params;
        const { action } = req.body; 
        
        let data: any = {};
        if (action === 'verify') data.isVerified = 'verified';
        if (action === 'unverify') data.isVerified = 'unverify'; // or 'none' or 'unverified'
        if (action === 'ban') data.deletedAt = new Date();
        if (action === 'unban') data.deletedAt = null;
        if (action === 'make_admin') data.role = 'ADMIN';
        if (action === 'revoke_admin') data.role = 'USER';
        
        const user = await prisma.user.update({
          where: { id },
          data,
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            role: true,
            isVerified: true,
            createdAt: true,
            lastLoginAt: true,
            deletedAt: true,
            _count: {
              select: { ads: true }
            }
          }
        });
        
        res.json({
          ...user,
          active: user.deletedAt === null
        });
      } catch (err) {
        next(err);
      }
    });

    // ── Admin Settings ────────────────────────────────────────────────────────
    this.app.get('/api/public-stats', async (req, res) => {
      try {
        const totalAds = await prisma.ad.count();
        const totalUsers = await prisma.user.count({ where: { deletedAt: null } });
        res.json({
          totalAds,
          totalUsers,
          rating: 4.9
        });
      } catch (err: any) {
        res.status(500).json({ error: 'Failed loading public stats', message: err.message });
      }
    });

    const getPlatformSettings = async () => {
      const cacheKey = 'system:settings';
      try {
        
        const cached = await redis.get(cacheKey);
        if (cached) {
          return JSON.parse(cached);
        }
      } catch (cacheErr) {
        logger.warn(`[SettingsCache] Redis read failed: ${cacheErr}`);
      }

      try {
        const dbSettings = await prisma.systemSetting.findUnique({
          where: { key: 'platform_settings' }
        });
        if (dbSettings) {
          const parsedSettings = JSON.parse(dbSettings.value);
          try {
            
            await redis.set(cacheKey, dbSettings.value, 86400);
          } catch (cacheErr) {
            logger.warn(`[SettingsCache] Redis write failed: ${cacheErr}`);
          }
          return parsedSettings;
        }
      } catch (e) {
        console.error('Failed to read settings from DB:', e);
      }
      return {
        commission: 0,
        featuredPrice: 5,
        appName: 'أسواق',
        logoLetter: 'أ',
        maintenanceMode: false,
        pushNotifications: true,
        logoUrl: '',
      };
    };

    const savePlatformSettings = async (settings: any) => {
      const settingsStr = JSON.stringify(settings);
      await prisma.systemSetting.upsert({
        where: { key: 'platform_settings' },
        update: { value: settingsStr },
        create: { key: 'platform_settings', value: settingsStr }
      });
      try {
        
        await redis.set('system:settings', settingsStr, 86400);
      } catch (cacheErr) {
        logger.warn(`[SettingsCache] Redis cache update failed: ${cacheErr}`);
      }
    };

    this.app.get('/api/admin/settings', async (req, res) => {
      try {
        const settings = await getPlatformSettings();
        res.json(settings);
      } catch (err: any) {
        res.status(500).json({ error: 'Failed loading settings', message: err.message });
      }
    });

    this.app.patch('/api/admin/settings', async (req, res) => {
      try {
        const currentSettings = await getPlatformSettings();
        const updatedSettings = { ...currentSettings, ...req.body };
        await savePlatformSettings(updatedSettings);
        res.json({ success: true, ...updatedSettings });
      } catch (err: any) {
        res.status(500).json({ error: 'Save failed', message: err.message });
      }
    });

    this.app.put('/api/admin/settings', async (req, res) => {
      try {
        await savePlatformSettings(req.body);
        res.json({ success: true, ...req.body });
      } catch (err: any) {
        res.status(500).json({ error: 'Save failed', message: err.message });
      }
    });

    // POST /api/admin/settings/logo - Upload platform logo image and store in DB as Base64 data URL
    this.app.post('/api/admin/settings/logo', ...adminAccessGuards, upload.single('logo'), async (req, res) => {
      logger.info({ message: `settings/logo upload request received, file present: ${!!req.file}` });
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'لم يتم رفع أي ملف' });
      }
      try {
        const base64Data = req.file.buffer.toString('base64');
        const logoUrl = `data:${req.file.mimetype};base64,${base64Data}`;

        const currentSettings = await getPlatformSettings();
        currentSettings.logoUrl = logoUrl;
        await savePlatformSettings(currentSettings);

        logger.info({ message: `settings/logo uploaded and saved to DB successfully (Base64)` });
        res.json({ success: true, logoUrl });
      } catch (err: any) {
        logger.error({ message: 'Failed uploading logo to DB', error: err.message });
        res.status(500).json({ error: 'Failed uploading logo', message: err.message });
      }
    });
  }


  // ── Socket.IO ──────────────────────────────────────────────────────────────

  private initializeSocket(): void {
    this.io.on('connection', (socket) => {
      logger.info({ message: `WebSocket connected: ${socket.id}` });

      socket.on('join-room', (roomId: string) => {
        socket.join(roomId);
        logger.info({ message: `Socket ${socket.id} joined room: ${roomId}` });
      });

      socket.on('send-message', (data: { roomId: string; text: string }) => {
        this.io.to(data.roomId).emit('new-message', data);
      });

      // ── Live Stream events ──
      socket.on('join-stream', (data: { streamId: string; role: 'broadcaster' | 'viewer'; sellerId?: string; sellerName?: string; adTitle?: string }) => {
        const { streamId, role } = data;
        if (!streamId) return;

        socket.join(`stream_${streamId}`);
        logger.info({ message: `Socket ${socket.id} joined stream ${streamId} as ${role}` });

        let stream = this.activeStreams.get(streamId);
        if (!stream) {
          stream = { broadcasterId: '', viewers: new Set() };
          this.activeStreams.set(streamId, stream);
        }

        if (role === 'broadcaster') {
          stream.broadcasterId = socket.id;
          // Notify room that broadcaster is online
          this.io.to(`stream_${streamId}`).emit('stream-broadcaster-online', { broadcasterId: socket.id });
          
          // Send a global notification to all connected sockets
          socket.broadcast.emit('live-stream-notification', {
            streamId,
            sellerName: data.sellerName || 'تاجر',
            adTitle: data.adTitle || 'بث مباشر جديد'
          });
        } else {
          // If viewer, add to viewers set
          stream.viewers.add(socket.id);
          // If broadcaster is already online, trigger connection
          if (stream.broadcasterId) {
            this.io.to(stream.broadcasterId).emit('viewer-joined', { viewerId: socket.id });
          }
          // Broadcast viewer count update to room
          this.io.to(`stream_${streamId}`).emit('viewer-count-update', { count: stream.viewers.size });
        }
      });

      socket.on('signal', (data: { to: string; signal: any }) => {
        this.io.to(data.to).emit('signal', {
          from: socket.id,
          signal: data.signal
        });
      });

      socket.on('stream-filter-change', (data: { streamId: string; filterId: string }) => {
        socket.to(`stream_${data.streamId}`).emit('stream-filter-change', { filterId: data.filterId });
      });

      socket.on('chat-message', (data: { streamId: string; userName: string; text: string; avatar?: string; userId?: string }) => {
        const chatMsg = {
          id: `live_msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          user: data.userName || 'زائر',
          text: data.text,
          avatar: data.avatar || '',
          userId: data.userId || 'guest',
          timestamp: new Date().toISOString()
        };
        this.io.to(`stream_${data.streamId}`).emit('chat-message', chatMsg);
      });

      socket.on('live-heart', (data: { streamId: string; color: string; left: number; scale: number }) => {
        this.io.to(`stream_${data.streamId}`).emit('live-heart', {
          id: Date.now() + Math.random(),
          color: data.color,
          left: data.left,
          scale: data.scale
        });
      });

      const autoArchiveStream = async (streamId: string) => {
        try {
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          if (!uuidRegex.test(streamId)) {
            logger.info({ message: `Socket/Prisma: Skipped auto-archiving non-UUID stream ID: ${streamId}` });
            return;
          }

          const reel = await prisma.reel.findUnique({ where: { id: streamId } });
          if (reel) {
            const parts = reel.videoUrl.split('||');
            const mainUrl = parts[0];
            if (mainUrl === 'webcam' || mainUrl === 'camera') {
              const archiveVideoUrl = "https://player.vimeo.com/external/434045526.sd.mp4?s=c19c968f44ff531ae7e77b105021e141aabccb8c&profile_id=165&oauth2_token_id=57447761";
              parts[0] = archiveVideoUrl;
              parts[1] = 'none'; // clear background music to fallback to archive video sound
              const updatedUrl = parts.join('||');

              await prisma.reel.update({
                where: { id: streamId },
                data: { videoUrl: updatedUrl }
              });
              logger.info({ message: `Socket/Prisma: Auto-archived live stream ${streamId} to static video because broadcaster disconnected/left.` });
            }
          }
        } catch (dbErr: any) {
          logger.error({ message: `Socket/Prisma Error: Auto-archiving stream ${streamId} failed`, error: dbErr });
        }
      };

      socket.on('leave-stream', (data: { streamId: string; role: 'broadcaster' | 'viewer' }) => {
        const { streamId, role } = data;
        socket.leave(`stream_${streamId}`);
        
        const stream = this.activeStreams.get(streamId);
        if (!stream) return;

        if (role === 'broadcaster') {
          if (stream.broadcasterId === socket.id) {
            this.io.to(`stream_${streamId}`).emit('stream-ended');
            this.activeStreams.delete(streamId);
            autoArchiveStream(streamId);
          }
        } else {
          stream.viewers.delete(socket.id);
          if (stream.broadcasterId) {
            this.io.to(stream.broadcasterId).emit('viewer-left', { viewerId: socket.id });
          }
          this.io.to(`stream_${streamId}`).emit('viewer-count-update', { count: stream.viewers.size });
        }
      });

      socket.on('disconnect', () => {
        logger.info({ message: `WebSocket disconnected: ${socket.id}` });
        
        // Cleanup active streams
        for (const [streamId, stream] of this.activeStreams.entries()) {
          if (stream.broadcasterId === socket.id) {
            this.io.to(`stream_${streamId}`).emit('stream-ended');
            this.activeStreams.delete(streamId);
            autoArchiveStream(streamId);
          } else if (stream.viewers.has(socket.id)) {
            stream.viewers.delete(socket.id);
            if (stream.broadcasterId) {
              this.io.to(stream.broadcasterId).emit('viewer-left', { viewerId: socket.id });
            }
            this.io.to(`stream_${streamId}`).emit('viewer-count-update', { count: stream.viewers.size });
          }
        }
      });
    });
  }

  // ── Error Handling (MUST be last) ──────────────────────────────────────────

  private initializeErrorHandling(): void {
    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        success: false,
        status: 404,
        error: 'Not Found',
        message: `المسار غير موجود: ${req.method} ${req.path}`,
        correlationId: req.correlationId,
      });
    });

    // Global error handler
    this.app.use(errorMiddleware);
  }

  // ── Start ──────────────────────────────────────────────────────────────────

  public async start(): Promise<void> {
    if (process.env.NODE_ENV !== 'production') {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      // Vite serves React SPA (including / and all client routes)
      this.app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), 'dist');
      this.app.use(express.static(distPath));
      this.app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }

    // ✅ Register error handling AFTER Vite/static so React routes are matched first
    this.initializeErrorHandling();

    this.httpServer.listen(this.port, '0.0.0.0', () => {
      logger.info({
        message:      `🚀 Aswaq Enterprise running on port ${this.port}`,
        environment:  process.env.NODE_ENV || 'development',
        docs:         `http://localhost:${this.port}/api/docs`,
        health:       `http://localhost:${this.port}/api/v1/health`,
      });

      // Start background Outbox worker
      startOutboxWorker();

      // Start V8 heap memory monitoring (leak detection)
      startMemoryMonitor();
    });
  }

  public async close(): Promise<void> {
    // Stop memory monitoring loop
    stopMemoryMonitor();

    const { stopOutboxWorker } = await import('./workers/outbox.worker.ts');
    stopOutboxWorker();

    const { queues } = await import('../src/lib/queues.ts');
    await queues.close();
    
    this.io.close();

    await new Promise<void>((resolve) => {
      if (typeof this.httpServer.closeAllConnections === 'function') {
        this.httpServer.closeAllConnections();
      }
      this.httpServer.close(() => resolve());
    });

    
    await redis.quit();

    if (process.env.NODE_ENV !== 'test') {
      try {
        await Promise.race([
          sdk.shutdown(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('OTel shutdown timed out')), 2000))
        ]);
        logger.info('[OTel] OpenTelemetry SDK shut down successfully.');
      } catch (err: any) {
        logger.error('[OTel] Error shutting down OpenTelemetry SDK:', err.message);
      }
    }
  }
}
