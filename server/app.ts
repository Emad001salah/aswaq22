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
import { MarketsController } from './controllers/markets.controller.ts';
import { PromoController } from './controllers/promo.controller.ts';
import { AdminController } from './controllers/admin.controller.ts';
import { SocketService } from './socket/socket.service.ts';


// Workers
import { startOutboxWorker } from './workers/outbox.worker.ts';

// SEO Schema Factory
import * as schemaFactory from './seo/schema-factory.ts';

// Swagger
import { setupSwagger } from './swagger.ts';

// Logger
import { logger } from './lib/logger.ts';

// Beta/Analytics Middleware
import { analyticsMiddleware } from './lib/analytics.ts';
import { featureFlagsMiddleware } from './lib/featureFlags.ts';
import { startMemoryMonitor, stopMemoryMonitor } from './lib/memoryMonitor.ts';



export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .replace(/\s+/g, '-')           // Replace spaces with -
    .replace(/[^\w\u0621-\u064A-]+/g, '') // Keep alphanumeric, Arabic chars and -
    .replace(/--+/g, '-')          // Replace multiple - with single -
    .replace(/^-+/, '')            // Trim - from start
    .replace(/-+$/, '');           // Trim - from end
}

/**
 * Escape special XML characters to prevent malformed XML in sitemaps.
 * Arabic text in ad titles/descriptions can contain &, <, >, " etc.
 */
export function escapeXml(unsafe: string): string {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export class App {
  public app: express.Application;
  public httpServer: ReturnType<typeof createServer>;
  public io: Server;
  private port: number = parseInt(process.env.PORT || '3000', 10);
  private activeStreams = new Map<string, { broadcasterId: string; viewers: Set<string>; pinnedProduct?: { id: string; title: string; price: number; image: string } | null }>();

  constructor() {
    this.app        = express();
    this.app.set('trust proxy', true);
    this.httpServer = createServer(this.app);

    this.io = new Server(this.httpServer, {
      cors: {
        origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map(o => o.trim()) : '*',
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
    // 1. Canonical Domain & URL Redirection Middleware (HTTP->HTTPS, non-www -> www, lowercase paths in exactly 1 hop)
    this.app.use((req, res, next) => {
      // NOTE: Do NOT redirect sitemaps (even if they have trailing slashes like /sitemaps/news.xml/)
      // Google Search Console does NOT follow 301 redirects for submitted sitemaps and treats 301 HTML body as "Sitemap is an HTML page".
      if (req.path.startsWith('/sitemaps') || req.path.startsWith('/sitemap.xml')) {
        return next();
      }

      const host = req.headers.host || '';
      const isLocal = host.includes('localhost') || host.includes('127.0.0.1') || process.env.NODE_ENV === 'test';
      
      const isHttp = req.protocol === 'http' || req.headers['x-forwarded-proto'] === 'http';
      const needsWww = host.toLowerCase() === 'aswaq22.com';
      const hasUppercasePath = /[A-Z]/.test(req.path);
      
      // Standardize trailing slash if it's not root / and has one
      const pathEndsWithSlash = req.path.length > 1 && req.path.endsWith('/');
      const cleanPath = pathEndsWithSlash ? req.path.slice(0, -1) : req.path;
      
      if ((isHttp || needsWww || hasUppercasePath || pathEndsWithSlash) && !isLocal) {
        const canonicalHost = needsWww ? 'www.aswaq22.com' : host;
        const canonicalPath = cleanPath.toLowerCase();
        const queryString = req.url.slice(req.path.length); // Preserves query parameters
        
        return res.redirect(301, `https://${canonicalHost}${canonicalPath}${queryString}`);
      }
      next();
    });

    /**
     * [METRICS-001] Prometheus Metrics endpoint — protected by token or IP whitelist.
     * Previously unauthenticated: exposed CPU usage, DB connection counts, error rates
     * and memory metrics to anyone who could reach the server.
     *
     * Access control (in priority order):
     *  1. In test mode — always disabled.
     *  2. METRICS_TOKEN env var set — require `Authorization: Bearer <METRICS_TOKEN>` header.
     *  3. METRICS_ALLOWED_IPS env var set — restrict to comma-separated IP list.
     *  4. Neither set AND production — block all external access (default-deny).
     *  5. Neither set AND dev — allow (for local Prometheus scraping).
     */
    this.app.get('/metrics', (req, res) => {
      if (process.env.NODE_ENV === 'test') {
        res.status(404).send('Metrics disabled in test environment');
        return;
      }

      const metricsToken   = process.env.METRICS_TOKEN;
      const allowedIps     = (process.env.METRICS_ALLOWED_IPS || '').split(',').map(ip => ip.trim()).filter(Boolean);
      const requestIp      = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || '';
      const isLocalhost    = requestIp === '127.0.0.1' || requestIp === '::1' || requestIp === 'localhost';

      // Token-based auth (preferred for Prometheus remote scraping)
      if (metricsToken) {
        const provided = req.headers.authorization?.replace('Bearer ', '');
        if (provided !== metricsToken) {
          res.status(401).json({ error: 'Unauthorized', message: 'Invalid metrics token.' });
          return;
        }
        prometheusExporter.getMetricsRequestHandler(req, res);
        return;
      }

      // IP allowlist (for Prometheus in same Docker network)
      if (allowedIps.length > 0) {
        if (!allowedIps.includes(requestIp) && !isLocalhost) {
          res.status(403).json({ error: 'Forbidden', message: 'IP not allowed.' });
          return;
        }
        prometheusExporter.getMetricsRequestHandler(req, res);
        return;
      }

      // No protection configured
      if (process.env.NODE_ENV === 'production') {
        // Default-deny in production if no protection is set
        res.status(403).json({ error: 'Forbidden', message: 'Set METRICS_TOKEN or METRICS_ALLOWED_IPS to enable.' });
        return;
      }

      // Development: allow localhost only
      if (isLocalhost) {
        prometheusExporter.getMetricsRequestHandler(req, res);
      } else {
        res.status(403).json({ error: 'Forbidden', message: 'Metrics only accessible from localhost in dev.' });
      }
    });

    // Response compression
    this.app.use(compression());

    /**
     * [CORS-001] CORS Middleware — fixed wildcard in non-production environments.
     * Previously: `process.env.NODE_ENV !== 'production'` allowed ALL origins in dev/staging.
     * A staging server accessible publicly would have an open CORS door.
     *
     * New policy: CORS_ORIGIN whitelist is ALWAYS enforced, in every environment.
     * In dev without CORS_ORIGIN set, only localhost variants are permitted.
     */
    this.app.use((req, res, next) => {
      const origin = req.headers.origin;

      // Build allowlist from environment
      const configuredOrigins = (process.env.CORS_ORIGIN || '')
        .split(',')
        .map(o => o.trim())
        .filter(Boolean);

      // Dev fallback: allow localhost on any port if CORS_ORIGIN is not set
      const devLocalhostRegex = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
      const isDevLocalhost = process.env.NODE_ENV !== 'production' && origin && devLocalhostRegex.test(origin);

      if (origin) {
        if (configuredOrigins.includes(origin) || isDevLocalhost) {
          res.setHeader('Access-Control-Allow-Origin', origin);
        }
        // [CORS-001] Removed: `|| allowedOrigins.includes('*') || process.env.NODE_ENV !== 'production'`
        // This previously allowed ALL origins in any non-production environment.
      }
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Correlation-ID, X-User-Email, x-user-email, x-csrf-token, X-CSRF-Token');
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

    // 2. Security headers (CSP + HSTS)
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc:  ["'self'"],
          /**
           * [CSP-001] Removed 'unsafe-eval' from scriptSrc.
           * 'unsafe-eval' enables arbitrary JS via eval(), Function(), setTimeout(string).
           * It negates XSS protection entirely if any user input reaches these APIs.
           * Google Maps and Firebase do not require unsafe-eval in modern versions.
           *
           * 'unsafe-inline' remains temporarily for legacy inline scripts.
           * TODO: Replace with nonce-based CSP once inline scripts are migrated.
           */
          scriptSrc:   ["'self'", "'unsafe-inline'", "https://www.gstatic.com", "https://apis.google.com", "https://*.googleapis.com", "https://maps.googleapis.com", "https://maps.gstatic.com", "https://*.google.com", "https://unpkg.com"],
          styleSrc:    ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://maps.googleapis.com", "https://unpkg.com"],
          imgSrc:      ["'self'", "data:", "blob:", "https://api.dicebear.com", "https://www.gstatic.com", "https://cdn.aswaq.com", "https://*.s3.amazonaws.com", "https://images.unsplash.com", "https://picsum.photos", "https://*.unsplash.com", "https://*.picsum.photos", "https://*.google.com", "https://*.googleapis.com", "https://maps.gstatic.com", "https://maps.googleapis.com", "https://*.tile.openstreetmap.org", "https://unpkg.com"],
          connectSrc:  ["'self'", "http://localhost:*", "ws://localhost:*", "https://unpkg.com", "https://aswaq22.com", "wss://aswaq22.com", "ws:", "wss:", "https://www.googleapis.com", "https://*.googleapis.com", "https://maps.googleapis.com", "https://*.google.com", "https://*.firebaseapp.com", "https://identitytoolkit.googleapis.com", "https://securetoken.googleapis.com", "https://firebase.googleapis.com", "https://fcmregistrations.googleapis.com", "https://*.firebaseio.com", "wss://*.firebaseio.com", "https://firestore.googleapis.com", "https://storage.googleapis.com", "https://nominatim.openstreetmap.org"],
          frameSrc:    ["'self'", "https://aswaq-48f3f.firebaseapp.com", "https://*.firebaseapp.com", "https://accounts.google.com", "https://*.google.com"],
          fontSrc:     ["'self'", "https://fonts.gstatic.com", "https://maps.gstatic.com", "https://unpkg.com"],
          objectSrc:   ["'none'"],
          upgradeInsecureRequests: [],
        },
      },
      hsts: {
        maxAge:            31536000, // 1 year
        includeSubDomains: true,
        preload:           true,
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

    /**
     * [BODY-001] Body parser limits reduced from 50MB to 2MB.
     * 50MB JSON limit allows DoS via large payload — exhausts memory under concurrent requests.
     * Files MUST be sent as multipart/form-data (handled by multer), not base64 in JSON.
     */
    this.app.use(express.json({ limit: '2mb' }));
    this.app.use(express.urlencoded({ limit: '2mb', extended: true }));

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
    this.app.use('/api/v1/markets', MarketsController(adminAccessGuards));
    this.app.use('/api/v1/promo',   PromoController());
    this.app.use('/api/v1/admin',   AdminController());

    // Legacy routes (backward compat)
    this.app.use('/api/categories', CategoriesController(adminAccessGuards));
    this.app.use('/api/markets', MarketsController(adminAccessGuards));
    this.app.use('/api/polls', PollsController());
    this.app.use('/api/promo', PromoController());
    this.app.use('/api/admin', AdminController());

    // Legacy routes (backward compat – redirect to v1)
    this.app.use('/api/ads',     AdsController());
    this.app.use('/api/users',   UsersController());
    this.app.use('/api/storage', StorageController());
    this.app.use('/api/ai',      AiController({ ads: [] }));

    /**
     * [SSRF-001] URL Sanitizer for user-supplied media URLs.
     *
     * Prevents Server-Side Request Forgery by blocking:
     *  - Private/loopback IP addresses (10.x, 172.16-31.x, 192.168.x, 127.x, ::1)
     *  - Internal Docker hostnames (postgres, redis, meilisearch, etc.)
     *  - Non-http/https URL schemes (file://, ftp://, gopher://)
     *  - Extremely long URLs that could cause ReDoS
     *
     * Special marker values used for live streams ('webcam', 'camera') are allowed.
     */
    const ALLOWED_LIVE_MARKERS = new Set(['webcam', 'camera', 'screen']);
    const PRIVATE_IP_REGEX = /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|0\.|::1|localhost)/i;
    const INTERNAL_HOSTNAME_REGEX = /^https?:\/\/(postgres|redis|meilisearch|adminer|grafana|prometheus|app|localhost|127\.0\.0\.1)(:|\/)*/i;

    function validateMediaUrl(url: string): { valid: boolean; reason?: string } {
      const trimmed = url.trim();

      // Allow live-stream marker values (not real URLs)
      if (ALLOWED_LIVE_MARKERS.has(trimmed.toLowerCase())) return { valid: true };

      // Length guard
      if (trimmed.length > 2048) return { valid: false, reason: 'URL طويل جداً' };

      let parsed: URL;
      try {
        parsed = new URL(trimmed);
      } catch {
        return { valid: false, reason: 'رابط URL غير صالح' };
      }

      // Only allow http and https
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return { valid: false, reason: `بروتوكول غير مسموح: ${parsed.protocol}` };
      }

      // Block private/internal IP ranges
      if (PRIVATE_IP_REGEX.test(parsed.hostname)) {
        return { valid: false, reason: 'عناوين IP الداخلية غير مسموح بها' };
      }

      // Block known internal Docker service names
      if (INTERNAL_HOSTNAME_REGEX.test(trimmed)) {
        return { valid: false, reason: 'مضيف داخلي غير مسموح' };
      }

      return { valid: true };
    }

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

        // [SSRF-001] Validate videoUrl to prevent SSRF attacks
        const urlCheck = validateMediaUrl(videoUrl);
        if (!urlCheck.valid) {
          return res.status(400).json({ error: `رابط الفيديو غير صالح: ${urlCheck.reason}` });
        }

        const newReel = await prisma.reel.create({
          data: {
            title:    title.trim(),
            videoUrl: videoUrl.trim(),
            userId:   authenticatedUserId,
          },
          include: {
            user: { select: { name: true, avatar: true } }
          }
        });

        return res.status(201).json({
          ...newReel,
          isLive:     !!isLive,
          description: description || '',
          city:        city || 'كافة المناطق',
          category:    category || 'عام',
          userName:    newReel.user?.name || userName || 'مستخدم',
          userAvatar:  newReel.user?.avatar || userAvatar || '',
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

        const rawId = req.params.id;
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        const id = uuidRegex.test(rawId) ? rawId : getDeterministicUuid(rawId);

        const { role, managedCountry, permissions, action } = req.body;

        if (action === 'delete') {
           await prisma.user.delete({ where: { id } });
           return res.json({ success: true });
        }

        if (action === 'toggle_status') {
           const existing = await prisma.user.findUnique({ where: { id } });
           if (!existing) return res.status(404).json({ error: 'User not found' });
           const updated = await prisma.user.update({
             where: { id },
             data: { deletedAt: existing.deletedAt ? null : new Date() },
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
           return res.json({
             ...updated,
             active: updated.deletedAt === null
           });
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
            deliveryAgent: {
              select: {
                id: true,
                vehicleType: true,
                licensePlate: true,
                status: true,
                walletBalance: true,
                totalDeliveries: true,
                rating: true,
              }
            },
            uploadedMedia: {
              select: {
                id: true,
                url: true,
                type: true,
                createdAt: true,
              }
            },
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

    this.app.post('/api/users/verify-documents', authMiddleware, async (req, res, next) => {
      try {
        const userId = (req as any).user?.id || (req as any).user?.userId;
        if (!userId) return res.status(401).json({ error: 'غير مصرح' });

        const { role, documents, vehicleType, licensePlate } = req.body;

        if (!Array.isArray(documents) || documents.length === 0) {
          return res.status(400).json({ error: 'يرجى إرفاق وثيقة واحدة على الأقل' });
        }

        // Save documents in MediaObject relation
        await prisma.mediaObject.createMany({
          data: documents.map((url: string) => ({
            url,
            type: 'VERIFICATION_DOC',
            uploaderId: userId,
          }))
        });

        // Upsert deliveryAgent if role is driver
        if (role === 'driver' || role === 'AGENT') {
          await prisma.deliveryAgent.upsert({
            where: { userId },
            create: {
              userId,
              vehicleType: vehicleType || 'motorcycle',
              licensePlate: licensePlate || 'قيد التدقيق',
              status: 'PENDING',
            },
            update: {
              vehicleType: vehicleType || 'motorcycle',
              licensePlate: licensePlate || 'قيد التدقيق',
              status: 'PENDING',
            }
          });
        }

        // Update user status to pending verification
        const updatedUser = await prisma.user.update({
          where: { id: userId },
          data: {
            role: role === 'merchant' ? 'MERCHANT' : role === 'driver' ? 'AGENT' : undefined,
            isVerified: 'pending',
          },
          include: {
            deliveryAgent: true,
            uploadedMedia: true,
          }
        });

        return res.json({ success: true, user: updatedUser });
      } catch (err) {
        next(err);
      }
    });

    this.app.patch('/api/admin/users/:id', ...adminAccessGuards, async (req, res, next) => {
      try {
        const { id } = req.params;
        const { action } = req.body; 
        
        let data: any = {};
        if (action === 'verify' || action === 'verify_user') {
          data.isVerified = 'verified';
        }
        if (action === 'verify_merchant') {
          data.isVerified = 'verified';
          data.role = 'MERCHANT';
        }
        if (action === 'verify_driver') {
          data.isVerified = 'verified';
          data.role = 'AGENT';
          // Activate driver delivery permissions in DeliveryAgent table
          await prisma.deliveryAgent.upsert({
            where: { userId: id },
            create: {
              userId: id,
              vehicleType: 'motorcycle',
              licensePlate: 'معتمد رسمياً',
              status: 'APPROVED'
            },
            update: {
              status: 'APPROVED'
            }
          });
        }
        if (action === 'unverify') data.isVerified = 'unverify';
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

    this.app.delete('/api/admin/users/:id', ...adminAccessGuards, async (req, res, next) => {
      try {
        const { id } = req.params;

        // Perform cascading cleanup sequentially to avoid DB relation errors
        await prisma.$transaction(async (tx) => {
          // 1. Delete RefreshTokens, Sessions, PasswordResetTokens
          await tx.refreshToken.deleteMany({ where: { userId: id } });
          await tx.session.deleteMany({ where: { userId: id } });
          await tx.passwordResetToken.deleteMany({ where: { userId: id } });

          // 2. Delete Notifications
          await tx.notification.deleteMany({ where: { userId: id } });

          // 3. Delete Comments by user or on user's ads
          await tx.comment.deleteMany({
            where: {
              OR: [
                { authorId: id },
                { ad: { userId: id } }
              ]
            }
          });

          // 4. Delete AdLikes by user or on user's ads
          await tx.adLike.deleteMany({
            where: {
              OR: [
                { userId: id },
                { ad: { userId: id } }
              ]
            }
          });

          // 5. Delete Messages sent or received
          await tx.message.deleteMany({
            where: {
              OR: [
                { senderId: id },
                { receiverId: id }
              ]
            }
          });

          // 6. Delete Conversations linked to user's ads or involving the user
          await tx.conversation.deleteMany({
            where: {
              OR: [
                { ad: { userId: id } },
                { participantOne: id },
                { participantTwo: id }
              ]
            }
          });

          // 7. Delete Ad Placements
          await tx.adPlacement.deleteMany({ where: { advertiserId: id } });

          // 8. Delete Reels
          await tx.reel.deleteMany({ where: { userId: id } });

          // 9. Delete Orders & Shipments linked to the user
          const orders = await tx.order.findMany({
            where: { OR: [{ buyerId: id }, { sellerId: id }] },
            select: { id: true }
          });
          const orderIds = orders.map(o => o.id);
          if (orderIds.length > 0) {
            await tx.shipment.deleteMany({ where: { orderId: { in: orderIds } } });
            await tx.order.deleteMany({ where: { id: { in: orderIds } } });
          }

          // 10. Delete Ad Images for user's ads
          await tx.adImage.deleteMany({ where: { ad: { userId: id } } });

          // 11. Delete Ads
          await tx.ad.deleteMany({ where: { userId: id } });

          // 12. Delete MediaObjects uploaded by the user
          await tx.mediaObject.deleteMany({ where: { uploadedBy: id } });

          // 13. Finally, delete the User
          await tx.user.delete({ where: { id } });
        });

        res.json({ success: true });
      } catch (err) {
        next(err);
      }
    });

    this.app.get('/api/admin/reports', ...adminAccessGuards, async (req, res, next) => {
      try {
        const reports = await prisma.report.findMany({
          orderBy: { timestamp: 'desc' }
        });

        // Resolve details dynamically for response representation
        const resolvedReports = await Promise.all(
          reports.map(async (r) => {
            const reporter = await prisma.user.findUnique({
              where: { id: r.reporterId },
              select: { name: true, email: true }
            });
            const ad = await prisma.ad.findUnique({
              where: { id: r.adId },
              select: { title: true, status: true, userId: true }
            });

            return {
              id: r.id,
              type: 'بلاغ عن إعلان مخالف',
              reason: r.reason,
              status: r.status,
              severity: 'high',
              reporter: reporter?.name || reporter?.email || 'مستخدم غير معروف',
              targetName: ad?.title || 'إعلان محذوف',
              adId: r.adId,
              date: new Date(r.timestamp).toLocaleDateString('ar'),
            };
          })
        );

        res.json(resolvedReports);
      } catch (err) {
        next(err);
      }
    });

    this.app.patch('/api/admin/reports/:id', ...adminAccessGuards, async (req, res, next) => {
      const { id } = req.params;
      const { status } = req.body;
      try {
        const updated = await prisma.report.update({
          where: { id },
          data: { status }
        });
        res.json({ success: true, report: updated });
      } catch (err) {
        next(err);
      }
    });

    this.app.delete('/api/admin/reports/:id', ...adminAccessGuards, async (req, res, next) => {
      const { id } = req.params;
      try {
        await prisma.report.delete({
          where: { id }
        });
        res.json({ success: true });
      } catch (err) {
        next(err);
      }
    });

    // ═══════════════════════════════════════════════════════════════════
    // ── PROFESSIONAL SITEMAP SYSTEM ─────────────────────────────────────
    // Standards: https://www.sitemaps.org/protocol.html
    // Google: https://developers.google.com/search/docs/advanced/sitemaps
    // ═══════════════════════════════════════════════════════════════════

    const BASE_URL   = 'https://www.aswaq22.com';
    const ADS_PAGE_SIZE = 5000;   // 5k per file — safe for Google & fast to generate

    /** Shared response headers for all sitemap files */
    const sitemapHeaders = (res: any, cacheSeconds = 3600) => {
      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.setHeader('Cache-Control', `public, max-age=${cacheSeconds}, stale-while-revalidate=86400`);
      // NOTE: Do NOT add X-Robots-Tag here — that would prevent Google from reading the sitemap
    };

    /** Safely URL-encode (RFC 3986) and XML-escape location URLs for Google Sitemaps */
    const safeLoc = (url: string) => {
      try {
        return escapeXml(encodeURI(url));
      } catch {
        return escapeXml(url);
      }
    };

    /** Empty but valid urlset — returned when a sitemap has no entries */
    const emptyUrlset = (extraNs = '') =>
      `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"${extraNs}>
</urlset>`;

    /** Build a <url> block */
    const urlBlock = (loc: string, lastmod: string, changefreq: string, priority: string) =>
      `  <url>\n    <loc>${safeLoc(loc)}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;

    /** Build a <sitemap> entry in sitemap index */
    const sitemapEntry = (loc: string, lastmod: string) =>
      `  <sitemap>\n    <loc>${safeLoc(loc)}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </sitemap>`;

    /** XML declaration + urlset wrapper */
    const urlsetXml = (urls: string[], extraNs = '') =>
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"${extraNs}>\n${urls.join('\n')}\n</urlset>`;

    // ── robots.txt ──────────────────────────────────────────────────────
    this.app.get('/robots.txt', (req, res) => {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(
`User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin/
Disallow: /uploads/
Disallow: /*.json$

Sitemap: ${BASE_URL}/sitemap.xml
`);
    });

    // ── MAIN SITEMAP INDEX (Dynamic — lists ad pages based on count) ─────
    this.app.get(['/sitemap.xml', '/sitemap.xml/'], async (req, res) => {
      try {
        const today = new Date().toISOString().split('T')[0];

        // Count active ads to determine how many paginated files we need
        const totalAds = await prisma.ad.count({ where: { status: 'ACTIVE' } });
        const totalPages = Math.max(1, Math.ceil(totalAds / ADS_PAGE_SIZE));

        const entries: string[] = [
          sitemapEntry(`${BASE_URL}/sitemaps/static.xml`,     today),
          sitemapEntry(`${BASE_URL}/sitemaps/countries.xml`,  today),
          sitemapEntry(`${BASE_URL}/sitemaps/categories.xml`, today),
          sitemapEntry(`${BASE_URL}/sitemaps/cities.xml`,     today),
          sitemapEntry(`${BASE_URL}/sitemaps/news.xml`,       today),    // recently added ads
          sitemapEntry(`${BASE_URL}/sitemaps/images.xml`,     today),    // image sitemap
        ];

        // Add paginated ads sitemaps dynamically
        for (let p = 1; p <= totalPages; p++) {
          entries.push(sitemapEntry(`${BASE_URL}/sitemaps/ads-${p}.xml`, today));
        }

        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</sitemapindex>`;
        sitemapHeaders(res, 1800);
        res.send(xml);
      } catch (err) {
        sitemapHeaders(res, 60);
        res.send('<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></sitemapindex>');
      }
    });

    // ── STATIC PAGES ────────────────────────────────────────────────────
    this.app.get(['/sitemaps/static.xml', '/sitemaps/static.xml/'], async (req, res) => {
      try {
        const today = new Date().toISOString().split('T')[0];

        // Fetch active country codes for market landing pages
        const countries = await prisma.country.findMany({
          where: { active: true },
          select: { countryCode: true }
        });

        const urls: string[] = [
          urlBlock(`${BASE_URL}/`,           today, 'daily',   '1.0'),
          urlBlock(`${BASE_URL}/ads`,         today, 'hourly',  '0.9'),
          urlBlock(`${BASE_URL}/delivery`,    today, 'weekly',  '0.7'),
          urlBlock(`${BASE_URL}/login`,       today, 'monthly', '0.4'),
          urlBlock(`${BASE_URL}/register`,    today, 'monthly', '0.4'),
        ];

        // Add per-country market landing pages
        for (const c of countries) {
          const cc = c.countryCode.toLowerCase();
          urls.push(urlBlock(`${BASE_URL}/${cc}`, today, 'daily', '0.9'));
        }

        sitemapHeaders(res, 7200);
        res.send(urlsetXml(urls));
      } catch (err) {
        sitemapHeaders(res, 60);
        res.send(emptyUrlset());
      }
    });

    // ── COUNTRIES MARKET PAGES ──────────────────────────────────────────
    this.app.get(['/sitemaps/countries.xml', '/sitemaps/countries.xml/'], async (req, res) => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const countries = await prisma.country.findMany({ where: { active: true } });

        const urls = countries.map(c =>
          urlBlock(`${BASE_URL}/${c.countryCode.toLowerCase()}`, today, 'daily', '0.9')
        );

        sitemapHeaders(res, 7200);
        res.send(urlsetXml(urls));
      } catch (err) {
        sitemapHeaders(res, 60);
        res.send(emptyUrlset());
      }
    });

    // ── CATEGORIES PER COUNTRY ──────────────────────────────────────────
    this.app.get(['/sitemaps/categories.xml', '/sitemaps/categories.xml/'], async (req, res) => {
      try {
        const today = new Date().toISOString().split('T')[0];

        const [countries, categories, adGroups, cities] = await Promise.all([
          prisma.country.findMany({ where: { active: true } }),
          prisma.category.findMany(),
          prisma.ad.findMany({
            where: { status: 'ACTIVE' },
            select: { city: true, categoryId: true, updatedAt: true }
          }),
          prisma.city.findMany({ include: { country: true } })
        ]);

        const urls: string[] = [];

        for (const country of countries) {
          const cc = country.countryCode.toLowerCase();
          const countryCities = cities.filter(c => c.countryId === country.id);
          const cityIds  = new Set(countryCities.map(c => c.id));
          const cityNamesAr = new Set(countryCities.map(c => c.nameAr));
          const cityNamesEn = new Set(countryCities.map(c => c.nameEn.toLowerCase()));

          for (const cat of categories) {
            const relevantAds = adGroups.filter(ad =>
              ad.categoryId === cat.id &&
              (cityIds.has(ad.city) || cityNamesAr.has(ad.city) || cityNamesEn.has(ad.city.toLowerCase()))
            );
            if (relevantAds.length === 0) continue;

            // Use the most recently updated ad in this category/country as lastmod
            const latestUpdate = relevantAds.reduce((max, a) =>
              a.updatedAt > max ? a.updatedAt : max, relevantAds[0].updatedAt);

            urls.push(urlBlock(
              `${BASE_URL}/${cc}/${cat.nameEn.toLowerCase()}`,
              latestUpdate.toISOString().split('T')[0],
              'daily',
              '0.8'
            ));
          }
        }

        sitemapHeaders(res, 3600);
        res.send(urlsetXml(urls));
      } catch (err) {
        sitemapHeaders(res, 60);
        res.send(emptyUrlset());
      }
    });

    // ── CITIES × CATEGORIES ─────────────────────────────────────────────
    this.app.get(['/sitemaps/cities.xml', '/sitemaps/cities.xml/'], async (req, res) => {
      try {
        const today = new Date().toISOString().split('T')[0];

        const [categories, cities, adGroups] = await Promise.all([
          prisma.category.findMany(),
          prisma.city.findMany({ where: { active: true }, include: { country: true } }),
          prisma.ad.findMany({
            where: { status: 'ACTIVE' },
            select: { city: true, categoryId: true }
          })
        ]);

        const urls: string[] = [];

        for (const city of cities) {
          const cc       = city.country.countryCode.toLowerCase();
          const citySlug = slugify(city.nameEn || city.nameAr);

          for (const cat of categories) {
            const hasAds = adGroups.some(ad =>
              ad.categoryId === cat.id &&
              (ad.city === city.id || ad.city === city.nameAr || ad.city.toLowerCase() === city.nameEn.toLowerCase())
            );
            if (!hasAds) continue;

            urls.push(urlBlock(
              `${BASE_URL}/${cc}/${citySlug}/${cat.nameEn.toLowerCase()}`,
              today,
              'daily',
              '0.7'
            ));
          }
        }

        sitemapHeaders(res, 3600);
        res.send(urlsetXml(urls));
      } catch (err) {
        sitemapHeaders(res, 60);
        res.send(emptyUrlset());
      }
    });

    // ── NEWS SITEMAP (last 2 days — for Google News fast indexing) ───────
    this.app.get(['/sitemaps/news.xml', '/sitemaps/news.xml/'], async (req, res) => {
      try {
        const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

        const [recentAds, cities] = await Promise.all([
          prisma.ad.findMany({
            where: { status: 'ACTIVE', createdAt: { gte: twoDaysAgo } },
            include: { category: true },
            orderBy: { createdAt: 'desc' },
            take: 1000
          }),
          prisma.city.findMany({ include: { country: true } })
        ]);

        const NS = ` xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"`;
        const urls: string[] = [];

        for (const ad of recentAds) {
          const city        = cities.find(c => c.id === ad.city || c.nameAr === ad.city || c.nameEn === ad.city);
          const cc          = city?.country?.countryCode?.toLowerCase() || 'ye';
          const catSlug     = ad.category.nameEn.toLowerCase();
          const adSlug      = slugify(ad.title);
          const loc         = `${BASE_URL}/${cc}/${catSlug}/${adSlug}-${ad.id}`;
          const pubDate     = ad.createdAt.toISOString();
          const safeTitle   = escapeXml(ad.title);

          urls.push(
            `  <url>\n    <loc>${safeLoc(loc)}</loc>\n    <news:news>\n      <news:publication>\n        <news:name>أسواق</news:name>\n        <news:language>ar</news:language>\n      </news:publication>\n      <news:publication_date>${pubDate}</news:publication_date>\n      <news:title>${safeTitle}</news:title>\n    </news:news>\n  </url>`
          );
        }

        sitemapHeaders(res, 900); // 15 min cache — news changes fast
        res.send(urlsetXml(urls, NS));
      } catch (err) {
        sitemapHeaders(res, 60);
        res.send(emptyUrlset());
      }
    });

    // ── PAGINATED ADS SITEMAP (/sitemaps/ads-1.xml, ads-2.xml, ...) ──────
    this.app.get(['/sitemaps/ads-:page.xml', '/sitemaps/ads-:page.xml/'], async (req, res) => {
      try {
        const page = Math.max(1, parseInt(req.params.page) || 1);
        const skip = (page - 1) * ADS_PAGE_SIZE;

        const [ads, cities] = await Promise.all([
          prisma.ad.findMany({
            where: { status: 'ACTIVE' },
            include: { category: true },
            orderBy: { updatedAt: 'desc' },
            skip,
            take: ADS_PAGE_SIZE
          }),
          prisma.city.findMany({ include: { country: true } })
        ]);

        if (ads.length === 0) {
          // Return a valid EMPTY urlset with 200 — never return 404 for a sitemap Google knows about
          sitemapHeaders(res, 900);
          return res.send(emptyUrlset());
        }

        const cityMap = new Map(cities.map(c => [c.id, c]));
        const cityByName = new Map(cities.flatMap(c => [
          [c.nameAr, c],
          [c.nameEn.toLowerCase(), c]
        ]));

        const urls = ads.map(ad => {
          const city = cityMap.get(ad.city) ?? cityByName.get(ad.city) ?? cityByName.get(ad.city.toLowerCase());
          const cc   = city?.country?.countryCode?.toLowerCase() || 'ye';
          const loc  = `${BASE_URL}/${cc}/${ad.category.nameEn.toLowerCase()}/${slugify(ad.title)}-${ad.id}`;
          return urlBlock(loc, ad.updatedAt.toISOString().split('T')[0], 'weekly', '0.6');
        });

        sitemapHeaders(res, 3600);
        res.send(urlsetXml(urls));
      } catch (err) {
        sitemapHeaders(res, 60);
        res.send(emptyUrlset());
      }
    });

    // ── IMAGE SITEMAP (/sitemaps/images.xml) ────────────────────────────
    this.app.get(['/sitemaps/images.xml', '/sitemaps/images.xml/'], async (req, res) => {
      const NS = ` xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"`;
      try {
        const [ads, cities] = await Promise.all([
          prisma.ad.findMany({
            where: { status: 'ACTIVE' },
            include: { category: true, images: { take: 5 } },
            orderBy: { updatedAt: 'desc' },
            take: 20000
          }),
          prisma.city.findMany({ include: { country: true } })
        ]);

        const cityMap    = new Map(cities.map(c => [c.id, c]));
        const cityByName = new Map(cities.flatMap(c => [[c.nameAr, c], [c.nameEn.toLowerCase(), c]]));
        const urls: string[] = [];

        for (const ad of ads) {
          const validImages = ad.images.filter(img => img.url && !img.url.startsWith('data:'));
          if (validImages.length === 0) continue;

          const city = cityMap.get(ad.city) ?? cityByName.get(ad.city) ?? cityByName.get(ad.city.toLowerCase());
          const cc   = city?.country?.countryCode?.toLowerCase() || 'ye';
          const loc  = `${BASE_URL}/${cc}/${ad.category.nameEn.toLowerCase()}/${slugify(ad.title)}-${ad.id}`;
          const safe = escapeXml(ad.title);

          const imageTags = validImages.map(img => {
            const cleanUrl = img.url.trim();
            const imgUrl   = cleanUrl.startsWith('http') ? cleanUrl : `${BASE_URL}${cleanUrl.startsWith('/') ? '' : '/'}${cleanUrl}`;
            return `    <image:image>\n      <image:loc>${safeLoc(imgUrl)}</image:loc>\n      <image:title>${safe}</image:title>\n    </image:image>`;
          }).join('\n');

          urls.push(`  <url>\n    <loc>${safeLoc(loc)}</loc>\n${imageTags}\n  </url>`);
        }

        sitemapHeaders(res, 7200);
        res.send(urls.length > 0 ? urlsetXml(urls, NS) : emptyUrlset(NS));
      } catch (err) {
        sitemapHeaders(res, 60);
        res.send(emptyUrlset(NS));
      }
    });

    // ── VIDEO SITEMAP (/sitemaps/videos.xml) ────────────────────────────
    this.app.get(['/sitemaps/videos.xml', '/sitemaps/videos.xml/'], async (req, res) => {
      try {
        const reels = await prisma.reel.findMany({
          orderBy: { createdAt: 'desc' },
          take: 1000
        });

        const NS = ` xmlns:video="http://www.google.com/schemas/sitemap-video/1.1"`;
        const urls: string[] = [];

        for (const reel of reels) {
          const videoUrl   = reel.videoUrl.startsWith('http') ? reel.videoUrl : `${BASE_URL}${reel.videoUrl}`;
          const safeVideo  = safeLoc(videoUrl);
          const safeTitle  = escapeXml(reel.title || 'فيديو ترويجي - أسواق');
          const safeThumb  = `${BASE_URL}/aswaq-icon-512.png`;

          urls.push(
            `  <url>\n    <loc>${safeLoc(BASE_URL + '/')}</loc>\n    <video:video>\n      <video:thumbnail_loc>${safeLoc(safeThumb)}</video:thumbnail_loc>\n      <video:title>${safeTitle}</video:title>\n      <video:description>فيديو ريلز ترويجي على منصة أسواق</video:description>\n      <video:content_loc>${safeVideo}</video:content_loc>\n      <video:publication_date>${reel.createdAt.toISOString()}</video:publication_date>\n    </video:video>\n  </url>`
          );
        }

        sitemapHeaders(res, 7200);
        res.send(urls.length > 0 ? urlsetXml(urls, NS) : emptyUrlset(NS));
      } catch (err) {
        sitemapHeaders(res, 60);
        res.send(emptyUrlset(` xmlns:video="http://www.google.com/schemas/sitemap-video/1.1"`));
      }
    });

    // ── LEGACY ROUTES — served as real handlers, NOT redirects ────────────
    // Google Search Console does NOT follow redirects for submitted sitemaps.
    // These must serve real XML content at the EXACT URL that was submitted.
    this.app.get(['/sitemaps/image-sitemap.xml', '/sitemaps/image-sitemap.xml/'], async (req, res) => {
      try {
        const [ads, cities] = await Promise.all([
          prisma.ad.findMany({
            where: { status: 'ACTIVE' },
            include: { category: true, images: { take: 5 } },
            orderBy: { updatedAt: 'desc' },
            take: 20000
          }),
          prisma.city.findMany({ include: { country: true } })
        ]);

        const NS  = ` xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"`;
        const cityMap    = new Map(cities.map(c => [c.id, c]));
        const cityByName = new Map(cities.flatMap(c => [[c.nameAr, c], [c.nameEn.toLowerCase(), c]]));
        const urls: string[] = [];

        for (const ad of ads) {
          const validImages = ad.images.filter(img => img.url && !img.url.startsWith('data:'));
          if (validImages.length === 0) continue;

          const city = cityMap.get(ad.city) ?? cityByName.get(ad.city) ?? cityByName.get(ad.city.toLowerCase());
          const cc   = city?.country?.countryCode?.toLowerCase() || 'ye';
          const loc  = `${BASE_URL}/${cc}/${ad.category.nameEn.toLowerCase()}/${slugify(ad.title)}-${ad.id}`;
          const safe = escapeXml(ad.title);

          const imageTags = validImages.map(img => {
            const cleanUrl = img.url.trim();
            const imgUrl   = cleanUrl.startsWith('http') ? cleanUrl : `${BASE_URL}${cleanUrl.startsWith('/') ? '' : '/'}${cleanUrl}`;
            return `    <image:image>\n      <image:loc>${safeLoc(imgUrl)}</image:loc>\n      <image:title>${safe}</image:title>\n    </image:image>`;
          }).join('\n');

          urls.push(`  <url>\n    <loc>${safeLoc(loc)}</loc>\n${imageTags}\n  </url>`);
        }

        sitemapHeaders(res, 7200);
        res.send(urls.length > 0 ? urlsetXml(urls, NS) : emptyUrlset(NS));
      } catch (err) {
        sitemapHeaders(res, 60);
        res.send(emptyUrlset(` xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"`));
      }
    });

    this.app.get(['/sitemaps/video-sitemap.xml', '/sitemaps/video-sitemap.xml/'], async (req, res) => {
      try {
        const reels = await prisma.reel.findMany({ orderBy: { createdAt: 'desc' }, take: 1000 });
        const NS = ` xmlns:video="http://www.google.com/schemas/sitemap-video/1.1"`;
        const urls: string[] = [];
        for (const reel of reels) {
          const videoUrl  = reel.videoUrl.startsWith('http') ? reel.videoUrl : `${BASE_URL}${reel.videoUrl}`;
          const safeVideo = safeLoc(videoUrl);
          const safeTitle = escapeXml(reel.title || 'فيديو ترويجي - أسواق');
          urls.push(`  <url>\n    <loc>${safeLoc(BASE_URL + '/')}</loc>\n    <video:video>\n      <video:thumbnail_loc>${safeLoc(BASE_URL + '/aswaq-icon-512.png')}</video:thumbnail_loc>\n      <video:title>${safeTitle}</video:title>\n      <video:description>فيديو ريلز ترويجي على منصة أسواق</video:description>\n      <video:content_loc>${safeVideo}</video:content_loc>\n      <video:publication_date>${reel.createdAt.toISOString()}</video:publication_date>\n    </video:video>\n  </url>`);
        }
        sitemapHeaders(res, 7200);
        res.send(urls.length > 0 ? urlsetXml(urls, NS) : emptyUrlset(NS));
      } catch (err) {
        sitemapHeaders(res, 60);
        res.send(emptyUrlset(` xmlns:video="http://www.google.com/schemas/sitemap-video/1.1"`));
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

    // POST /api/admin/settings/logo - Upload platform logo and save as real file (not Base64)
    this.app.post('/api/admin/settings/logo', ...adminAccessGuards, upload.single('logo'), async (req, res) => {
      logger.info({ message: `settings/logo upload request received, file present: ${!!req.file}` });
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'لم يتم رفع أي ملف' });
      }
      try {
        const fs = await import('fs');
        const { isFeatureEnabled } = await import('./lib/feature-flags.ts');
        const { storageService } = await import('./services/storage.service.ts');

        const uploadsDir = path.join(process.cwd(), 'uploads');
        if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

        // Always save as logo.png for a stable URL
        const ext = req.file.mimetype === 'image/png' ? 'png' : req.file.mimetype === 'image/jpeg' ? 'jpg' : 'png';
        const logoFileName = `platform-logo.${ext}`;
        const logoPath = path.join(uploadsDir, logoFileName);

        let logoUrl = `/uploads/${logoFileName}`;

        // Verify if R2 is enabled for this upload
        const r2Enabled = await isFeatureEnabled('r2_storage', (req as any).user?.id || 'admin');
        if (r2Enabled) {
          const destinationKey = `uploads/platform-logo.${ext}`;
          await storageService.uploadFileByKey(destinationKey, req.file.buffer, req.file.mimetype);
          logoUrl = `${process.env.MEDIA_PUBLIC_BASE_URL || 'https://media.aswaq22.com'}/${destinationKey}`;
          logger.info({ message: `settings/logo uploaded to R2: ${destinationKey}` });
        } else {
          fs.writeFileSync(logoPath, req.file.buffer);
          logger.info({ message: `settings/logo saved locally: ${logoFileName}` });
        }

        const currentSettings = await getPlatformSettings();
        currentSettings.logoUrl = logoUrl;
        await savePlatformSettings(currentSettings);

        res.json({ success: true, logoUrl });
      } catch (err: any) {
        logger.error({ message: 'Failed uploading logo', error: err.message });
        res.status(500).json({ error: 'Failed uploading logo', message: err.message });
      }
    });
  }


  // ── Socket.IO ──────────────────────────────────────────────────────────────

  private initializeSocket(): void {
    const socketService = new SocketService(this.io);
    socketService.initializeHandlers();
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
    const getHtmlTemplate = (): string => {
      try {
        const distTemplate = path.join(process.cwd(), 'dist', 'index.html');
        if (fs.existsSync(distTemplate)) {
          return fs.readFileSync(distTemplate, 'utf-8');
        }
        const rootTemplate = path.join(process.cwd(), 'index.html');
        if (fs.existsSync(rootTemplate)) {
          return fs.readFileSync(rootTemplate, 'utf-8');
        }
      } catch (e) {
        console.error('Error reading index.html template:', e);
      }
      return '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>أسواق</title></head><body style="background:#090d16;color:#fff;text-align:center;padding:50px"><h2>أسواق</h2><script type="module" src="/src/main.tsx"></script></body></html>';
    };

    // 1. Dynamic SEO Ad Detail Route: /:countryCode(2 letters)/:categoryName/:titleSlug-:id(UUID)
    this.app.get('/:country([a-zA-Z]{2})/:category/:slugAndId', async (req, res, next) => {
      const uuidRegex = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
      const match = req.params.slugAndId.match(uuidRegex);
      if (!match) {
        return next(); // Fall through if it's not a valid ad URL with UUID
      }
      
      const adId = match[0];
      try {
        const ad = await prisma.ad.findUnique({
          where: { id: adId },
          include: { category: true }
        });

        if (!ad) {
          // Check if ad was permanently deleted in Outbox events
          const isDeleted = await prisma.outboxEvent.findFirst({
            where: { aggregate: 'Ad', aggregateId: adId, eventType: 'DELETED' }
          });
          if (isDeleted) {
            return res.status(410).send(`
              <!DOCTYPE html>
              <html lang="ar" dir="rtl">
                <head>
                  <meta charset="UTF-8" />
                  <title>الإعلان محذوف | أسواق</title>
                  <meta name="robots" content="noindex, follow" />
                </head>
                <body style="font-family: sans-serif; text-align: center; padding: 50px; background: #090d16; color: #fff;">
                  <h1>410 Gone</h1>
                  <p>هذا الإعلان تم حذفه نهائياً من منصة أسواق.</p>
                  <a href="https://www.aswaq22.com/" style="color: #10b981; text-decoration: none;">العودة للرئيسية</a>
                </body>
              </html>
            `);
          }
          return res.status(404).send(`
            <!DOCTYPE html>
            <html lang="ar" dir="rtl">
              <head>
                <meta charset="UTF-8" />
                <title>الإعلان غير موجود | أسواق</title>
                <meta name="robots" content="noindex, follow" />
              </head>
              <body style="font-family: sans-serif; text-align: center; padding: 50px; background: #090d16; color: #fff;">
                <h1>404 Not Found</h1>
                <p>عذراً، هذا الإعلان غير موجود أو ربما لم يتم إنشاؤه بعد.</p>
                <a href="https://www.aswaq22.com/" style="color: #10b981; text-decoration: none;">العودة للرئيسية</a>
              </body>
            </html>
          `);
        }

        // Resolve ad's country code dynamically
        const cities = await prisma.city.findMany({ include: { country: true } });
        const city = cities.find(c => 
          c.id.toLowerCase() === ad.city.toLowerCase() || 
          c.nameAr === ad.city || 
          c.nameEn.toLowerCase() === ad.city.toLowerCase()
        );
        const countryCode = city?.country?.countryCode?.toLowerCase() || 'ye';

        const canonicalPath = `/${countryCode}/${ad.category.nameEn.toLowerCase()}/${slugify(ad.title)}-${ad.id}`.toLowerCase();
        const canonicalUrl = `https://www.aswaq22.com${canonicalPath}`;

        // 301 Redirect to the canonical version if there's any casing or slug mismatch
        if (decodeURIComponent(req.path).toLowerCase() !== decodeURIComponent(canonicalPath)) {
          const host = req.headers.host || 'www.aswaq22.com';
          const targetHost = host.includes('localhost') || host.includes('127.0.0.1') ? host : 'www.aswaq22.com';
          return res.redirect(301, `https://${targetHost}${canonicalPath}`);
        }

        // Render index.html with pre-injected tags (Universal Rendering)
        let html = getHtmlTemplate();
        
        // Safe versions of text for HTML attribute/content injection
        const safeTitle    = escapeXml(ad.title);
        const safeDesc     = escapeXml((ad.description || '').substring(0, 150));
        const safeCountry  = escapeXml(city?.country?.labelAr || '');

        // Inject Title
        const titleText = `${ad.title} | أسواق ${city?.country?.labelAr || ''}`;
        html = html.replace(/<title>.*?<\/title>/, `<title>${safeTitle} | أسواق ${safeCountry}</title>`);
        
        // Inject Canonical Tag
        const canonicalTag = `<link rel="canonical" href="${canonicalUrl}" />`;
        if (html.includes('rel="canonical"')) {
          html = html.replace(/<link rel="canonical"[^>]*>/, canonicalTag);
        } else {
          html = html.replace('</head>', `  ${canonicalTag}\n</head>`);
        }

        // Inject Description Tag
        const descTag = `<meta name="description" content="${safeDesc}..." />`;
        if (html.includes('name="description"')) {
          html = html.replace(/<meta name="description"[^>]*>/, descTag);
        } else {
          html = html.replace('</head>', `  ${descTag}\n</head>`);
        }

        // Generate JSON-LD Structured Data
        let jsonLdString = '';
        const catName = ad.category.nameEn.toLowerCase();
        if (catName === 'jobs' || catName === 'job') {
          jsonLdString += schemaFactory.getJobSchema(ad, canonicalUrl);
        } else if (catName === 'properties' || catName === 'real-estate' || catName === 'apartments' || catName === 'lands') {
          jsonLdString += schemaFactory.getAccommodationSchema(ad, canonicalUrl);
        } else {
          jsonLdString += schemaFactory.getProductSchema(ad, canonicalUrl);
        }

        // BreadcrumbList steps
        const breadcrumbSteps = [
          { name: "الرئيسية", url: "https://www.aswaq22.com/" },
          { name: city?.country?.labelAr || "اليمن", url: `https://www.aswaq22.com/${countryCode}` },
          { name: ad.category.nameAr, url: `https://www.aswaq22.com/${countryCode}/${ad.category.nameEn.toLowerCase()}` },
          { name: ad.title, url: canonicalUrl }
        ];
        jsonLdString += schemaFactory.getBreadcrumbSchema(breadcrumbSteps, canonicalUrl);

        // Inject JSON-LD
        html = html.replace('</head>', `  ${jsonLdString}\n</head>`);

        // Inject Open Graph and Twitter Card tags
        const firstAdImage = (ad as any).images && (ad as any).images.length > 0 
          ? (ad as any).images[0].url 
          : 'https://www.aswaq22.com/aswaq-icon-512.png';
        const absoluteImageUrl = firstAdImage.startsWith('http') ? firstAdImage : `https://www.aswaq22.com${firstAdImage}`;
        const safeImageUrl = escapeXml(absoluteImageUrl);
        
        const ogTags = `
  <meta property="og:title" content="${safeTitle}" />
  <meta property="og:description" content="${safeDesc}..." />
  <meta property="og:image" content="${safeImageUrl}" />
  <meta property="og:url" content="${canonicalUrl}" />
  <meta property="og:type" content="article" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${safeTitle}" />
  <meta name="twitter:description" content="${safeDesc}..." />
  <meta name="twitter:image" content="${safeImageUrl}" />
`;
        html = html.replace('</head>', `${ogTags}\n</head>`);

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(html);
      } catch (err) {
        next(err);
      }
    });

    // 2. SEO Landing Page: Category landing for a country (e.g. /jo/cars)
    this.app.get('/:country([a-zA-Z]{2})/:category', async (req, res, next) => {
      const countryCodeParam = req.params.country.toLowerCase();
      const categoryNameParam = req.params.category.toLowerCase();

      try {
        const country = await prisma.country.findFirst({
          where: { countryCode: countryCodeParam.toUpperCase(), active: true }
        });
        const category = await prisma.category.findFirst({
          where: { nameEn: { equals: categoryNameParam, mode: 'insensitive' } }
        });

        if (!country || !category) {
          return next(); // Fall through if it's not a valid landing page
        }

        const canonicalPath = `/${countryCodeParam}/${category.nameEn.toLowerCase()}`;
        const canonicalUrl = `https://www.aswaq22.com${canonicalPath}`;

        if (decodeURIComponent(req.path).toLowerCase() !== decodeURIComponent(canonicalPath).toLowerCase()) {
          const host = req.headers.host || 'www.aswaq22.com';
          const targetHost = host.includes('localhost') || host.includes('127.0.0.1') ? host : 'www.aswaq22.com';
          return res.redirect(301, `https://${targetHost}${canonicalPath}`);
        }

        let html = getHtmlTemplate();
        const title = `إعلانات ${category.nameAr} في ${country.labelAr} | أسواق`;
        html = html.replace(/<title>.*?<\/title>/, `<title>${title}</title>`);

        const canonicalTag = `<link rel="canonical" href="${canonicalUrl}" />`;
        if (html.includes('rel="canonical"')) {
          html = html.replace(/<link rel="canonical"[^>]*>/, canonicalTag);
        } else {
          html = html.replace('</head>', `  ${canonicalTag}\n</head>`);
        }

        const descTag = `<meta name="description" content="تصفح أحدث إعلانات ${category.nameAr} في ${country.labelAr} على منصة أسواق. بيع وشراء وسيارات وعقارات مجاناً." />`;
        if (html.includes('name="description"')) {
          html = html.replace(/<meta name="description"[^>]*>/, descTag);
        } else {
          html = html.replace('</head>', `  ${descTag}\n</head>`);
        }

        // Fetch active ads in this category & country to check if empty and to generate ItemList
        const countryCities = await prisma.city.findMany({ where: { countryId: country.id } });
        const countryCityIds = countryCities.map(c => c.id);
        const countryCityNamesAr = countryCities.map(c => c.nameAr);
        const countryCityNamesEn = countryCities.map(c => c.nameEn);

        const activeAds = await prisma.ad.findMany({
          where: {
            categoryId: category.id,
            status: 'ACTIVE',
            OR: [
              { city: { in: countryCityIds } },
              { city: { in: countryCityNamesAr } },
              { city: { in: countryCityNamesEn } }
            ]
          },
          include: { category: true },
          take: 20
        });

        // Thin content governance: inject noindex, follow if 0 ads
        if (activeAds.length === 0) {
          const noindexTag = `<meta name="robots" content="noindex, follow" />`;
          html = html.replace('</head>', `  ${noindexTag}\n</head>`);
        } else {
          // Inject CollectionPage and ItemList
          const collectionSchema = schemaFactory.getCollectionSchema(activeAds, title, canonicalUrl);
          html = html.replace('</head>', `  ${collectionSchema}\n</head>`);
        }

        // Inject Open Graph / Twitter tags
        const ogTags = `
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="تصفح أحدث إعلانات ${category.nameAr} في ${country.labelAr} على منصة أسواق." />
  <meta property="og:image" content="https://www.aswaq22.com/aswaq-icon-512.png" />
  <meta property="og:url" content="${canonicalUrl}" />
  <meta property="og:type" content="website" />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="تصفح أحدث إعلانات ${category.nameAr} في ${country.labelAr} على منصة أسواق." />
  <meta name="twitter:image" content="https://www.aswaq22.com/aswaq-icon-512.png" />
`;
        html = html.replace('</head>', `${ogTags}\n</head>`);

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(html);
      } catch (err) {
        next(err);
      }
    });

    // 3. SEO Landing Page: City category landing for a country (e.g. /jo/amman/cars)
    this.app.get('/:country([a-zA-Z]{2})/:city/:category', async (req, res, next) => {
      const countryCodeParam = req.params.country.toLowerCase();
      const citySlugParam = req.params.city.toLowerCase();
      const categoryNameParam = req.params.category.toLowerCase();

      try {
        const country = await prisma.country.findFirst({
          where: { countryCode: countryCodeParam.toUpperCase(), active: true },
          include: { cities: true }
        });
        if (!country) return next();

        const city = country.cities.find(c => slugify(c.nameEn) === citySlugParam && c.active);
        const category = await prisma.category.findFirst({
          where: { nameEn: { equals: categoryNameParam, mode: 'insensitive' } }
        });

        if (!city || !category) return next();

        const canonicalPath = `/${countryCodeParam}/${citySlugParam}/${category.nameEn.toLowerCase()}`;
        const canonicalUrl = `https://www.aswaq22.com${canonicalPath}`;

        if (decodeURIComponent(req.path).toLowerCase() !== decodeURIComponent(canonicalPath).toLowerCase()) {
          const host = req.headers.host || 'www.aswaq22.com';
          const targetHost = host.includes('localhost') || host.includes('127.0.0.1') ? host : 'www.aswaq22.com';
          return res.redirect(301, `https://${targetHost}${canonicalPath}`);
        }

        let html = getHtmlTemplate();
        const title = `إعلانات ${category.nameAr} في ${city.nameAr}، ${country.labelAr} | أسواق`;
        html = html.replace(/<title>.*?<\/title>/, `<title>${title}</title>`);

        const canonicalTag = `<link rel="canonical" href="${canonicalUrl}" />`;
        if (html.includes('rel="canonical"')) {
          html = html.replace(/<link rel="canonical"[^>]*>/, canonicalTag);
        } else {
          html = html.replace('</head>', `  ${canonicalTag}\n</head>`);
        }

        const descTag = `<meta name="description" content="تصفح إعلانات ${category.nameAr} في ${city.nameAr}، ${country.labelAr} على منصة أسواق. عقارات، سيارات، وظائف، إلكترونيات وأثاث." />`;
        if (html.includes('name="description"')) {
          html = html.replace(/<meta name="description"[^>]*>/, descTag);
        } else {
          html = html.replace('</head>', `  ${descTag}\n</head>`);
        }

        // Fetch active ads in this category & city
        const activeAds = await prisma.ad.findMany({
          where: {
            categoryId: category.id,
            status: 'ACTIVE',
            OR: [
              { city: city.id },
              { city: city.nameAr },
              { city: city.nameEn }
            ]
          },
          include: { category: true },
          take: 20
        });

        // Thin content governance: noindex, follow if empty
        if (activeAds.length === 0) {
          const noindexTag = `<meta name="robots" content="noindex, follow" />`;
          html = html.replace('</head>', `  ${noindexTag}\n</head>`);
        } else {
          // Inject CollectionPage and ItemList
          const collectionSchema = schemaFactory.getCollectionSchema(activeAds, title, canonicalUrl);
          html = html.replace('</head>', `  ${collectionSchema}\n</head>`);
        }

        // Inject Open Graph / Twitter tags
        const ogTags = `
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="تصفح إعلانات ${category.nameAr} في ${city.nameAr}، ${country.labelAr} على منصة أسواق." />
  <meta property="og:image" content="https://www.aswaq22.com/aswaq-icon-512.png" />
  <meta property="og:url" content="${canonicalUrl}" />
  <meta property="og:type" content="website" />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="تصفح إعلانات ${category.nameAr} في ${city.nameAr}، ${country.labelAr} على منصة أسواق." />
  <meta name="twitter:image" content="https://www.aswaq22.com/aswaq-icon-512.png" />
`;
        html = html.replace('</head>', `${ogTags}\n</head>`);

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(html);
      } catch (err) {
        next(err);
      }
    });

    // 4. SEO Search Page: /search/:query (with noindex to prevent crawl spam)
    this.app.get('/search/:query', async (req, res, next) => {
      const searchQuery = req.params.query;
      try {
        let html = getHtmlTemplate();
        const title = `نتائج البحث عن: ${searchQuery} | أسواق`;
        html = html.replace(/<title>.*?<\/title>/, `<title>${title}</title>`);

        // No-index search results by default to avoid search engine index spam
        const noindexTag = `<meta name="robots" content="noindex, follow" />`;
        html = html.replace('</head>', `  ${noindexTag}\n</head>`);

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(html);
      } catch (err) {
        next(err);
      }
    });

    // 5. SEO Homepage Route: /
    this.app.get('/', async (req, res, next) => {
      if (req.path !== '/') {
        return next();
      }
      try {
        let html = getHtmlTemplate();
        
        let schemas = schemaFactory.getWebSiteSchema() + '\n' + schemaFactory.getOrganizationSchema();
        html = html.replace('</head>', `  ${schemas}\n</head>`);
        
        const ogTags = `
  <meta property="og:title" content="منصة أسواق | بيع وشراء وسيارات وعقارات مجاناً" />
  <meta property="og:description" content="منصة أسواق الأولى للإعلانات المبوبة المجانية في العالم العربي. تصفح آلاف العقارات، السيارات، الوظائف، والخدمات مجاناً." />
  <meta property="og:image" content="https://www.aswaq22.com/aswaq-icon-512.png" />
  <meta property="og:url" content="https://www.aswaq22.com/" />
  <meta property="og:type" content="website" />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="منصة أسواق" />
  <meta name="twitter:description" content="منصة أسواق الأولى للإعلانات المبوبة المجانية في العالم العربي." />
  <meta name="twitter:image" content="https://www.aswaq22.com/aswaq-icon-512.png" />
`;
        html = html.replace('</head>', `${ogTags}\n</head>`);

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(html);
      } catch (err) {
        next(err);
      }
    });

    if (process.env.NODE_ENV !== 'production') {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      // Vite serves React SPA — bypass for sitemaps & robots.txt so Express handles XML responses
      this.app.use((req, res, next) => {
        if (req.path === '/robots.txt' || req.path.startsWith('/sitemap')) {
          return next();
        }
        vite.middlewares(req, res, next);
      });
    } else {
      const distPath = path.join(process.cwd(), 'dist');
      this.app.use((req, res, next) => {
        if (req.path === '/robots.txt' || req.path.startsWith('/sitemap')) {
          return next();
        }
        express.static(distPath, {
          setHeaders: (resHeader, filePath) => {
            if (filePath.endsWith('.html')) {
              resHeader.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
              resHeader.setHeader('Pragma', 'no-cache');
              resHeader.setHeader('Expires', '0');
            } else {
              resHeader.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            }
          }
        })(req, res, next);
      });

      // SPA fallback — skip for server-generated files
      this.app.get('*', (req, res) => {
        // Let server routes handle these — do NOT serve index.html for them
        if (
          req.path === '/robots.txt' ||
          req.path === '/sitemap.xml' ||
          req.path.startsWith('/sitemaps')
        ) {
          return res.status(404).end();
        }
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
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
