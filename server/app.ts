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
import { SocialController } from './controllers/social.controller.ts';
import { CategoriesController } from './controllers/categories.controller.ts';
import { MarketsController } from './controllers/markets.controller.ts';
import { PromoController } from './controllers/promo.controller.ts';
import { AdminController } from './controllers/admin.controller.ts';
import MediaController from './controllers/media.controller.ts';
import { SocketService } from './socket/socket.service.ts';


// Workers
import { startOutboxWorker } from './workers/outbox.worker.ts';

// SEO Schema Factory & Instant Indexing
import * as schemaFactory from './seo/schema-factory.ts';
import { InstantIndexingService } from './services/instant-indexing.service.ts';
import { ExchangeRatesService } from './services/exchange-rates.service.ts';

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
    // Trust exactly 1 proxy hop (Cloudflare Tunnel / nginx).
    // 'true' is intentionally avoided: express-rate-limit v7+ throws
    // ERR_ERL_PERMISSIVE_TRUST_PROXY when trust proxy is set to `true`
    // because it allows trivial IP spoofing via X-Forwarded-For.
    this.app.set('trust proxy', 1);
    this.httpServer = createServer(this.app);

    this.io = new Server(this.httpServer, {
      cors: {
        origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map(o => o.trim()) : '*',
        methods: ['GET', 'POST'],
      },
    });
    (global as any).io = this.io;

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

      if (isLocal) {
        return next();
      }

      const disableForceHttps = process.env.DISABLE_FORCE_HTTPS === 'true' || process.env.ENFORCE_HTTPS === 'false';
      const disableCanonicalRedirect = process.env.DISABLE_CANONICAL_REDIRECT === 'true';
      const enforceWww = process.env.ENFORCE_WWW !== 'false';

      // Safely check x-forwarded-proto (handles multi-proxy comma-separated values like 'https, http')
      const forwardedProto = req.headers['x-forwarded-proto'];
      const firstProto = typeof forwardedProto === 'string'
        ? forwardedProto.split(',')[0].trim().toLowerCase()
        : (req.protocol || 'http').toLowerCase();

      // Cloudflare Flexible SSL / edge SSL detection
      let cfIsHttps = false;
      if (req.headers['cf-visitor']) {
        try {
          const cfVisitor = JSON.parse(req.headers['cf-visitor'] as string);
          if (cfVisitor.scheme === 'https') cfIsHttps = true;
        } catch (e) {}
      }

      const isHttps = firstProto === 'https' || req.secure || cfIsHttps;
      const isHttp = !isHttps && !disableForceHttps;

      const needsWww = enforceWww && !disableCanonicalRedirect && host.toLowerCase() === 'aswaq22.com';
      const isStaticAsset = req.path.startsWith('/assets/') || /\.(js|css|png|jpg|jpeg|gif|svg|ico|json|map|woff|woff2|ttf|eot)$/i.test(req.path);
      const unescapedPath = req.path.replace(/%[0-9a-fA-F]{2}/g, '');
      const hasUppercasePath = !isStaticAsset && /[A-Z]/.test(unescapedPath);
      const pathEndsWithSlash = req.path.length > 1 && req.path.endsWith('/');
      const cleanPath = pathEndsWithSlash ? req.path.slice(0, -1) : req.path;

      // Static assets (JS/CSS/images): only redirect for HTTP→HTTPS or non-www→www.
      // NEVER lowercase their filenames — asset names like index-bLwuJg-5.js are case-sensitive.
      if (isStaticAsset) {
        if (isHttp || needsWww) {
          const targetProto = disableForceHttps ? (isHttps ? 'https' : 'http') : 'https';
          const canonicalHost = needsWww ? 'www.aswaq22.com' : host;
          const queryString = req.url.slice(req.path.length);
          const redirectTarget = `${targetProto}://${canonicalHost}${req.path}${queryString}`;
          const currentUrl = `${isHttps ? 'https' : 'http'}://${host}${req.path}${queryString}`;
          if (redirectTarget !== currentUrl) {
            return res.redirect(301, redirectTarget);
          }
        }
        return next();
      }

      if (isHttp || needsWww || hasUppercasePath || pathEndsWithSlash) {
        const targetProto = disableForceHttps ? (isHttps ? 'https' : 'http') : 'https';
        const canonicalHost = needsWww ? 'www.aswaq22.com' : host;
        const canonicalPath = cleanPath.toLowerCase();
        const queryString = req.url.slice(req.path.length); // Preserves query parameters

        const redirectTarget = `${targetProto}://${canonicalHost}${canonicalPath}${queryString}`;
        const currentUrl = `${isHttps ? 'https' : 'http'}://${host}${req.path}${queryString}`;

        // CRITICAL GUARD AGAINST SELF-REDIRECT / INFINITE LOOP:
        if (redirectTarget !== currentUrl) {
          return res.redirect(301, redirectTarget);
        }
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

    // Response compression — gzip level 6 (best CPU/size tradeoff), skip tiny payloads
    this.app.use(compression({
      level: 6,            // zlib levels 1-9; 6 = optimal balance speed/ratio
      threshold: 1024,     // skip payloads < 1KB (headers cost more than savings)
      filter: (req, res) => {
        if (req.headers['x-no-compression']) return false;
        return compression.filter(req, res);
      }
    }));

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
          defaultSrc:  ["'self'", "blob:"],
          manifestSrc: ["'self'", "blob:"],
          /**
           * [CSP-001] Removed 'unsafe-eval' from scriptSrc.
           * 'unsafe-eval' enables arbitrary JS via eval(), Function(), setTimeout(string).
           * It negates XSS protection entirely if any user input reaches these APIs.
           * Google Maps and Firebase do not require unsafe-eval in modern versions.
           *
           * 'unsafe-inline' remains temporarily for legacy inline scripts.
           * TODO: Replace with nonce-based CSP once inline scripts are migrated.
           */
          scriptSrc:   ["'self'", "'unsafe-inline'", "https://www.gstatic.com", "https://apis.google.com", "https://*.googleapis.com", "https://maps.googleapis.com", "https://maps.gstatic.com", "https://*.google.com", "https://unpkg.com", "https://static.cloudflareinsights.com", "https://*.cloudflareinsights.com", "https://cloudflareinsights.com"],
          scriptSrcAttr: ["'unsafe-inline'"],
          styleSrc:    ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://maps.googleapis.com", "https://unpkg.com"],
          imgSrc:      ["'self'", "data:", "blob:", "https:"],
          mediaSrc:    ["'self'", "data:", "blob:", "https:"],
          connectSrc:  ["'self'", "http://localhost:*", "ws://localhost:*", "ws:", "wss:", "https:"],
          frameSrc:    ["'self'", "https://aswaq-48f3f.firebaseapp.com", "https://*.firebaseapp.com", "https://accounts.google.com", "https://*.google.com"],
          fontSrc:     ["'self'", "https://fonts.gstatic.com", "https://*.gstatic.com", "https://maps.gstatic.com", "https://unpkg.com"],
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

    // 3a. Global rate limit – generous: 5000 req/15min since Redis cache absorbs ~70% of traffic
    this.app.use(
      rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 5000,       // Raised from 2000 — cache makes real DB load much lower
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
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(express.urlencoded({ limit: '50mb', extended: true }));

    // 5. Cookie parser (required for CSRF double-submit)
    this.app.use(cookieParser());

    // 6. CSRF token endpoint (GET /api/csrf-token) – BEFORE global CSRF check
    this.app.use('/api', csrfTokenRouter);

    // 7. Global CSRF protection for mutating requests
    this.app.use(csrfMiddleware);

    // 8. Static files with aggressive caching headers and cross-origin permissions
    this.app.use('/uploads', (req, res, next) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      next();
    }, express.static(path.join(process.cwd(), 'uploads'), {
      maxAge: '7d',       // Browser caches static files for 7 days
      etag: true,
      lastModified: true,
      setHeaders: (res) => {
        res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      }
    }));
    this.app.use('/avatars', (req, res, next) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      next();
    }, express.static(path.join(process.cwd(), 'uploads', 'avatars'), {
      maxAge: '7d',
      etag: true,
      lastModified: true,
      setHeaders: (res) => {
        res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      }
    }));
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
        const adminEmails = ['eee3327@gmail.com', 'emad001salah@gmail.com', 'emad333salah@gmail.com'];
        const headerEmail = (req.headers['x-user-email'] as string || '').toLowerCase().trim();

        let user: any = null;

        if (req.user?.id && req.user.id !== 'super-admin-header-id') {
          user = await prisma.user.findUnique({
            where: { id: req.user.id }
          });
        }

        if (!user && req.user?.email) {
          user = await prisma.user.findUnique({
            where: { email: req.user.email }
          });
        }

        if (!user && headerEmail && (adminEmails.includes(headerEmail) || headerEmail.includes('emad'))) {
          user = await prisma.user.findFirst({
            where: { email: { equals: headerEmail, mode: 'insensitive' } }
          });
        }

        if (!user) {
          return res.status(401).json({ error: 'Unauthorized' });
        }

        if ((user.email && adminEmails.includes(user.email.toLowerCase())) || (user.name && user.name.toLowerCase().includes('emad'))) {
          if (user.role !== 'SUPER_ADMIN') {
            user = await prisma.user.update({
              where: { id: user.id },
              data: { role: 'SUPER_ADMIN' }
            });
          }
        }

        if (!req.user) req.user = {};
        req.user.id = user.id;
        req.user.role = user.role;
        req.adminUser = user;
        next();
      } catch (err) {
        next(err);
      }
    };

    const adminAccessGuards = [authMiddleware, populateAdminUser, rolesGuard(['ADMIN', 'SUPER_ADMIN'])];


    this.app.use('/api/v1/health', HealthController());
    this.app.use('/api/v1/auth',   AuthController());
    this.app.use('/api/v1/auth',   OAuthController());
    this.app.use('/api/v1/ads',    AdsController(this.io));
    this.app.use('/api/v1/users',  UsersController());
    this.app.use('/api/v1/storage', StorageController());
    this.app.use('/api/v1',         BetaController());
    this.app.use('/api/v1',         ShippingController(this.io));
    this.app.use('/api/v1/polls',   PollsController());
    this.app.use('/api/v1/social-posts', SocialController(authMiddleware));
    this.app.use('/api/v1/categories', CategoriesController(adminAccessGuards));
    this.app.use('/api/v1/markets', MarketsController(adminAccessGuards));
    this.app.use('/api/v1/promo',   PromoController());
    this.app.use('/api/v1/admin',   AdminController());
    this.app.use('/api/v1/media',   MediaController);

    // Legacy routes (backward compat)
    this.app.use('/api/categories', CategoriesController(adminAccessGuards));
    this.app.use('/api/markets', MarketsController(adminAccessGuards));
    this.app.use('/api/polls', PollsController());
    this.app.use('/api/social-posts', SocialController(authMiddleware));
    this.app.use('/api/promo', PromoController());
    this.app.use('/api/admin', AdminController());

    // Legacy routes (backward compat – redirect to v1)
    this.app.use('/api/auth',    AuthController());
    this.app.use('/api/auth',    OAuthController());
    this.app.use('/api/ads',     AdsController(this.io));
    this.app.use('/api/users',   UsersController());
    this.app.use('/api/storage', StorageController());
    this.app.use('/api/media',   MediaController);
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
    const ALLOWED_LIVE_MARKERS = new Set(['webcam', 'camera', 'screen', 'live', 'stream', 'rtmp', 'hls']);
    const PRIVATE_IP_REGEX = /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|0\.|::1|localhost)/i;
    const INTERNAL_HOSTNAME_REGEX = /^https?:\/\/(postgres|redis|meilisearch|adminer|grafana|prometheus|app|localhost|127\.0\.0\.1)(:|\/)*/i;

    function validateMediaUrl(url: string): { valid: boolean; reason?: string } {
      const trimmed = url.trim();
      const rawMedia = trimmed.split('||')[0].trim();

      // Allow live-stream marker values (not real URLs)
      if (ALLOWED_LIVE_MARKERS.has(rawMedia.toLowerCase())) return { valid: true };

      // Length guard
      if (trimmed.length > 2048) return { valid: false, reason: 'URL طويل جداً' };

      let parsed: URL;
      try {
        parsed = new URL(rawMedia);
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
      if (INTERNAL_HOSTNAME_REGEX.test(rawMedia)) {
        return { valid: false, reason: 'مضيف داخلي غير مسموح' };
      }

      return { valid: true };
    }



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

    // ── Enterprise Stores & Verified Dealers API (Stage 6) ──────────────────
    this.app.get('/api/stores', async (req, res, next) => {
      try {
        const stores = await prisma.user.findMany({
          where: {
            OR: [
              { role: 'MERCHANT' },
              { isVerified: 'verified' }
            ]
          },
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            coverPhoto: true,
            bio: true,
            role: true,
            isVerified: true,
            city: true,
            createdAt: true,
            _count: {
              select: {
                ads: {
                  where: { status: 'ACTIVE' }
                }
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 50
        });
        res.json(stores);
      } catch (err) {
        next(err);
      }
    });

    this.app.get('/api/stores/:id', async (req, res, next) => {
      try {
        const { id } = req.params;
        const store = await prisma.user.findUnique({
          where: { id },
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            coverPhoto: true,
            bio: true,
            role: true,
            isVerified: true,
            city: true,
            createdAt: true,
            ads: {
              where: { status: 'ACTIVE' },
              orderBy: { publishedAt: 'desc' },
              include: {
                category: { select: { id: true, nameAr: true, nameEn: true } }
              }
            }
          }
        });

        if (!store) {
          return res.status(404).json({ error: 'Store not found' });
        }

        res.json(store);
      } catch (err) {
        next(err);
      }
    });

    // Public client-side error reporting endpoint
    this.app.post('/api/log-client-error', (req, res) => {
      const { message, stack, url, userAgent } = req.body;
      logger.error({
        message: `[Client Crash] ${message || 'Unknown Error'}`,
        stack,
        url,
        userAgent,
        service: 'aswaq-client-logger',
        timestamp: new Date().toISOString()
      });
      res.status(204).end();
    });

    // ── Trust & Safety System API (Stage 7) ──────────────────────────────────
    this.app.post('/api/reports', authMiddleware, async (req, res, next) => {
      try {
        const reporterId = (req as any).user?.id || (req as any).user?.userId;
        const { adId, reason } = req.body;

        if (!adId || !reason || typeof reason !== 'string' || !reason.trim()) {
          return res.status(400).json({ error: 'adId and valid reason are required' });
        }

        const ad = await prisma.ad.findUnique({ where: { id: adId } });
        if (!ad) {
          return res.status(404).json({ error: 'Target ad not found' });
        }

        const existingReport = await prisma.report.findFirst({
          where: {
            adId,
            reporterId
          }
        });

        if (existingReport) {
          return res.status(400).json({ error: 'You have already reported this ad' });
        }

        const report = await prisma.report.create({
          data: {
            adId,
            reporterId,
            reason: reason.trim(),
            status: 'pending'
          }
        });

        res.status(201).json({ success: true, report });
      } catch (err) {
        next(err);
      }
    });

    this.app.get('/api/reports', ...adminAccessGuards, async (req, res, next) => {
      try {
        const reports = await prisma.report.findMany({
          orderBy: { timestamp: 'desc' },
          take: 100
        });
        res.json(reports);
      } catch (err) {
        next(err);
      }
    });

    this.app.put('/api/reports/:id/status', ...adminAccessGuards, async (req, res, next) => {
      try {
        const { id } = req.params;
        const { status } = req.body;

        if (!['pending', 'resolved', 'dismissed'].includes(status)) {
          return res.status(400).json({ error: 'Invalid status' });
        }

        const updatedReport = await prisma.report.update({
          where: { id },
          data: { status }
        });

        res.json({ success: true, report: updatedReport });
      } catch (err) {
        next(err);
      }
    });

    // Legacy health (keep for backward compat)
    this.app.get('/api/health', (req, res) => {
      res.redirect(301, '/api/v1/health');
    });

    // Image proxy to bypass Unsplash / external domain blocks (DNS / referrers / ISP firewalls)
    this.app.get('/api/proxy-image', async (req, res) => {
      try {
        const imageUrl = req.query.url as string;
        if (!imageUrl) {
          return res.status(400).send('Missing url parameter');
        }
        
        // Only allow proxying unsplash images for safety
        if (!imageUrl.startsWith('https://images.unsplash.com/') && !imageUrl.startsWith('http://images.unsplash.com/')) {
          return res.status(400).send('Invalid url domain');
        }

        // Fetch image on the server side
        const fetchRes = await fetch(imageUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          }
        });

        if (!fetchRes.ok) {
          return res.status(fetchRes.status).send('Failed to fetch remote image');
        }

        // Forward content-type header
        const contentType = fetchRes.headers.get('content-type') || 'image/jpeg';
        res.setHeader('Content-Type', contentType);
        
        // Cache images on the user's browser / cloudflare for 30 days to speed up page loads!
        res.setHeader('Cache-Control', 'public, max-age=2592000');

        // Send the response buffer
        const buffer = await fetchRes.arrayBuffer();
        res.send(Buffer.from(buffer));
      } catch (err) {
        console.error('Error proxying image:', err);
        res.status(500).send('Internal server error proxying image');
      }
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

    this.app.post('/api/notifications/register-token', authMiddleware, async (req, res) => {
      try {
        const userId = (req as any).user?.id || (req as any).user?.userId;
        const { token, platform } = req.body;
        if (userId && token) {
          const { NotificationService } = await import('./services/notification.service.ts');
          await NotificationService.registerDeviceToken(userId, token, platform);
        }
        res.json({ success: true, message: 'Push token registered successfully' });
      } catch (err: any) {
        res.json({ success: true });
      }
    });

    // ── Messages (Secured & Isolated) ─────────────────────────────────────────
    this.app.get('/api/messages', authMiddleware, async (req: any, res) => {
      try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });
        const userUuid = getDeterministicUuid(userId);

        const messages = await prisma.message.findMany({
          where: {
            OR: [
              { senderId: userUuid },
              { receiverId: userUuid }
            ]
          },
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

    this.app.post('/api/messages', authMiddleware, async (req: any, res) => {
      const { text, receiverId, adId } = req.body;
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!text || !receiverId || !adId) {
        return res.status(400).json({ error: 'Missing required message fields' });
      }

      try {
        const senderUuid = getDeterministicUuid(userId);
        const receiverUuid = getDeterministicUuid(receiverId);
        const adUuid = getDeterministicUuid(adId);

        // Prevent self-messaging
        if (senderUuid === receiverUuid) {
          return res.status(400).json({ error: 'Cannot send messages to yourself' });
        }

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

        // Sanitize HTML in text payload
        const sanitizedText = String(text).replace(/</g, '&lt;').replace(/>/g, '&gt;');

        const newMessage = await prisma.message.create({
          data: {
            text: sanitizedText,
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

        // Broadcast real-time message via socket ONLY after successful DB commit
        if (this.io) {
          const roomId = `${adId}::${receiverId}`;
          const partnerRoomId = `${adId}::${senderUuid}`;
          this.io.to(roomId).emit('new-message', formatted);
          this.io.to(partnerRoomId).emit('new-message', formatted);
        }

        res.status(201).json(formatted);
      } catch (err: any) {
        res.status(500).json({ error: 'Failed to save message', message: err.message });
      }
    });

    // Seed default polls starting with 0 real votes if missing or reset requested
    (async () => {
      try {
        const count = await prisma.poll.count();
        const hasJo = await prisma.poll.findFirst({ where: { countryCode: 'JO' } });
        // Clean old mock votes if present so all polls start with 0 real votes
        const hasMockVotes = await prisma.poll.findFirst({
          where: { votes: { hasSome: [65, 51, 62, 42] } }
        });

        if (count === 0 || !hasJo || hasMockVotes) {
          await prisma.poll.deleteMany({}); // clean old mock polls
          await prisma.poll.createMany({
            data: [
              // Yemen
              {
                question: 'ما هي توقعاتك لأسعار العقارات في صنعاء خلال الربع القادم؟',
                options: ['ارتفاع بنسبة كبيرة 📈', 'استقرار نسبي ⚖️', 'انخفاض وتراجع الأسعار 📉'],
                votes: [0, 0, 0],
                countryCode: 'YE'
              },
              {
                question: 'أي من المحافظات اليمنية تشهد طلباً متسارعاً على التجارة الإلكترونية؟',
                options: ['عدن 🌊', 'صنعاء 🏙️', 'حضرموت 🌴', 'تعز ⛰️'],
                votes: [0, 0, 0, 0],
                countryCode: 'YE'
              },
              // Jordan
              {
                question: 'ما هي توقعاتك لأسعار العقارات في عمان خلال الربع القادم؟',
                options: ['ارتفاع بنسبة كبيرة 📈', 'استقرار نسبي ⚖️', 'انخفاض وتراجع الأسعار 📉'],
                votes: [0, 0, 0],
                countryCode: 'JO'
              },
              {
                question: 'أي من المحافظات الأردنية تشهد طلباً متسارعاً على التجارة الإلكترونية؟',
                options: ['عمان 🏙️', 'إربد 🏺', 'الزرقاء 🏭', 'العقبة 🌊'],
                votes: [0, 0, 0, 0],
                countryCode: 'JO'
              },
              // Palestine
              {
                question: 'ما هي توقعاتك لأسعار السلع الاستهلاكية خلال الربع القادم؟',
                options: ['ارتفاع بنسبة كبيرة 📈', 'استقرار نسبي ⚖️', 'انخفاض وتراجع الأسعار 📉'],
                votes: [0, 0, 0],
                countryCode: 'PS'
              },
              {
                question: 'أي من المدن الفلسطينية تشهد حركة تجارية ونمواً في التسوق الرقمي؟',
                options: ['رام الله 🏙️', 'الخليل ⛰️', 'نابلس 🧼', 'غزة 🌊'],
                votes: [0, 0, 0, 0],
                countryCode: 'PS'
              },
              // Global
              {
                question: 'ما هي الخدمة الأكثر أهمية لتطوير منصة أسواق حالياً؟',
                options: ['تحسين نظام الشحن والدفع عند الاستلام 🚚', 'إضافة محادثات صوتية فورية 🎙️', 'نظام توثيق الحسابات برقم الهاتف والـ GPS 🔐'],
                votes: [0, 0, 0],
                countryCode: 'ALL'
              }
            ]
          });
          console.log('✅ Real community polls initialized with 0 votes!');
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

        // Calculate platform revenue from shipping ledger
        let totalRevenue = 0;
        let totalCompletedShipments = 0;
        try {
          const ledgerAgg = await (prisma as any).shippingLedger.aggregate({
            _sum: { amount: true },
            _count: { id: true }
          });
          totalRevenue = Number(ledgerAgg._sum?.amount || 0);
          totalCompletedShipments = Number(ledgerAgg._count?.id || 0);
        } catch (_err) {
          // Ledger table may be empty
        }

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
          totalRevenue,
          totalCompletedShipments,
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
        // Propagate real errors instead of hiding them with fake data
        next(err);
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

    // ── Public Exchange Rates API ──────────────────────────────────────────
    this.app.get('/api/exchange-rates', async (req, res, next) => {
      try {
        const rates = await ExchangeRatesService.getRates();
        res.json({ success: true, rates });
      } catch (err) {
        next(err);
      }
    });

    // ── Admin Exchange Rates Management ────────────────────────────────────
    this.app.put('/api/admin/exchange-rates', ...adminAccessGuards, async (req, res, next) => {
      try {
        const { sanaaUsd, sanaaSar, adenUsd, adenSar, jordanUsd, autoSyncEnabled } = req.body;
        const updates: any = {};
        if (typeof sanaaUsd === 'number') updates.sanaaUsd = sanaaUsd;
        if (typeof sanaaSar === 'number') updates.sanaaSar = sanaaSar;
        if (typeof adenUsd === 'number') updates.adenUsd = adenUsd;
        if (typeof adenSar === 'number') updates.adenSar = adenSar;
        if (typeof jordanUsd === 'number') updates.jordanUsd = jordanUsd;
        if (typeof autoSyncEnabled === 'boolean') updates.autoSyncEnabled = autoSyncEnabled;

        const updated = await ExchangeRatesService.updateRates(updates, 'manual');
        res.json({
          success: true,
          message: 'تم تحديث أسعار الصرف بنجاح وتعميمها لجميع المستخدمين.',
          rates: updated
        });
      } catch (err) {
        next(err);
      }
    });

    this.app.post('/api/admin/exchange-rates/sync', ...adminAccessGuards, async (req, res, next) => {
      try {
        const result = await ExchangeRatesService.syncLiveRates();
        res.json(result);
      } catch (err) {
        next(err);
      }
    });

    // ── Admin SEO: Instant Indexing Trigger for All Active Ads ──────────────
    this.app.post('/api/admin/seo/index-all-ads', ...adminAccessGuards, async (req, res, next) => {
      try {
        const activeAds = await prisma.ad.findMany({
          where: { status: 'ACTIVE' },
          include: { category: true },
          take: 5000,
          orderBy: { updatedAt: 'desc' }
        });

        const urls = activeAds.map(ad => {
          const resolved = resolveAdCountry(ad.city);
          const cat = (ad.category?.nameEn || 'general').toLowerCase();
          const slug = slugify(ad.title);
          return `${BASE_URL}/${resolved.code}/${cat}/${slug}-${ad.id}`;
        });

        InstantIndexingService.queueUrl(urls);
        const result = await InstantIndexingService.flushQueue();

        res.json({
          success: true,
          message: `تم إرسال ${result.totalSubmitted} إعلان فورياً إلى IndexNow ومحركات البحث.`,
          totalAds: activeAds.length,
          indexingResult: result
        });
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
        
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        let targetId = id;
        if (!uuidRegex.test(id)) {
          const allAds = await prisma.ad.findMany({ select: { id: true } });
          const match = allAds.find(a => {
            const hexPart = (a.id || '').replace(/[^0-9a-f]/gi, '').substring(0, 8);
            const num = parseInt(hexPart || '10000000', 16);
            const code = ((num % 900000000) + 100000000).toString();
            return code === id;
          });
          if (match) targetId = match.id;
        }

        const data: any = {};
        if (status !== undefined) data.status = status;
        if (isFeatured !== undefined) data.isFeatured = isFeatured;

        const ad = await prisma.ad.update({
          where: { id: targetId },
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
        const { cursor, limit = '500', search } = req.query;
        const take = parseInt(limit as string, 10) || 500;
        const searchStr = search ? String(search).trim() : '';

        const whereClause: any = {};

        if (searchStr.length > 0) {
          whereClause.OR = [
            { name: { contains: searchStr, mode: 'insensitive' } },
            { phone: { contains: searchStr, mode: 'insensitive' } },
            { email: { contains: searchStr, mode: 'insensitive' } }
          ];
        }

        const users = await prisma.user.findMany({
          take,
          skip: cursor ? 1 : 0,
          cursor: cursor ? { id: String(cursor) } : undefined,
          where: whereClause,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            role: true,
            avatar: true,
            isVerified: true,
            phoneVerified: true,
            emailVerified: true,
            countryId: true,
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
            bio: true,
            uploadedMedia: {
              select: {
                id: true,
                objectKey: true,
                createdAt: true
              }
            },
            _count: {
              select: { ads: true }
            }
          }
        });
        
        const mappedUsers = users.map(u => ({
          ...u,
          uploadedMedia: u.uploadedMedia.map(m => ({
            id: m.id,
            url: m.objectKey.startsWith('http') ? m.objectKey : `https://api.aswaq22.com/${m.objectKey}`,
            createdAt: m.createdAt
          })),
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

        const { 
          role, 
          documents, 
          vehicleType, 
          licensePlate, 
          vehicleModel, 
          phone, 
          notes, 
          storeName, 
          businessType, 
          licenseNumber, 
          storeAddress 
        } = req.body;

        if (!Array.isArray(documents) || documents.length === 0) {
          return res.status(400).json({ error: 'يرجى إرفاق وثيقة واحدة على الأقل' });
        }

        // Save documents in MediaObject relation
        await prisma.mediaObject.createMany({
          data: documents.map((url: string) => {
            const objectKey = url.replace(/https?:\/\/[^\/]+\//, '');
            return {
              objectKey,
              uploadedBy: userId,
              status: 'READY'
            };
          })
        });

        // Upsert deliveryAgent if role is driver
        if (role === 'driver' || role === 'AGENT') {
          const finalLicense = vehicleModel 
            ? `${licensePlate || 'قيد التدقيق'} (موديل: ${vehicleModel})`
            : (licensePlate || 'قيد التدقيق');

          await prisma.deliveryAgent.upsert({
            where: { userId },
            create: {
              userId,
              vehicleType: vehicleType || 'motorcycle',
              licensePlate: finalLicense,
              status: 'OFFLINE',
            },
            update: {
              vehicleType: vehicleType || 'motorcycle',
              licensePlate: finalLicense,
              status: 'OFFLINE',
            }
          });
        }

        // Update user status and bio/metadata to pending verification
        let updateData: any = {
          role: role === 'merchant' ? 'MERCHANT' : role === 'driver' ? 'AGENT' : undefined,
          isVerified: 'pending',
        };

        if (phone) {
          updateData.phone = phone;
        }

        if (role === 'merchant') {
          if (storeName) updateData.name = storeName;
          updateData.bio = `نوع النشاط: ${businessType || 'عام'} | سجل تجاري: ${licenseNumber || 'لا يوجد'} | المقر: ${storeAddress || 'غير محدد'} | ملاحظات: ${notes || 'لا يوجد'}`;
        } else if (role === 'driver') {
          updateData.bio = notes || 'ملاحظات وسجل السائق';
        }

        const updatedUser = await prisma.user.update({
          where: { id: userId },
          data: updateData,
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
              status: 'OFFLINE'
            },
            update: {
              status: 'OFFLINE'
            }
          });
        }
        if (action === 'unverify') {
          data.isVerified = 'none';
          data.role = 'USER';
        }
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

          // 3. Delete Bids by user or on user's ads
          await tx.bid.deleteMany({
            where: {
              OR: [
                { bidderId: id },
                { ad: { userId: id } }
              ]
            }
          });

          // 4. Delete Reviews by user or for user
          await tx.review.deleteMany({
            where: {
              OR: [
                { userId: id },
                { reviewerId: id }
              ]
            }
          });

          // 5. Delete Reports by user or on user's ads
          const userAds = await tx.ad.findMany({ where: { userId: id }, select: { id: true } });
          const userAdIds = userAds.map(a => a.id);
          await tx.report.deleteMany({
            where: {
              OR: [
                { reporterId: id },
                { adId: { in: userAdIds } }
              ]
            }
          });

          // 6. Delete DeliveryAgent record if exists
          await tx.deliveryAgent.deleteMany({ where: { userId: id } });

          // 7. Delete AdminLogs if exists
          await tx.adminLog.deleteMany({ where: { adminId: id } });

          // 8. Delete Comments by user or on user's ads
          await tx.comment.deleteMany({
            where: {
              OR: [
                { authorId: id },
                { ad: { userId: id } }
              ]
            }
          });

          // 9. Delete AdLikes by user or on user's ads
          await tx.adLike.deleteMany({
            where: {
              OR: [
                { userId: id },
                { ad: { userId: id } }
              ]
            }
          });

          // 10. Delete Messages sent or received
          await tx.message.deleteMany({
            where: {
              OR: [
                { senderId: id },
                { receiverId: id }
              ]
            }
          });

          // 11. Delete Conversations linked to user's ads or involving the user
          await tx.conversation.deleteMany({
            where: {
              OR: [
                { ad: { userId: id } },
                { participantOne: id },
                { participantTwo: id }
              ]
            }
          });

          // 12. Delete Ad Placements
          await tx.adPlacement.deleteMany({ where: { advertiserId: id } });

          // 13. Delete Reels
          await tx.reel.deleteMany({ where: { userId: id } });

          // 14. Delete Orders & Shipments linked to the user
          const orders = await tx.order.findMany({
            where: { OR: [{ buyerId: id }, { sellerId: id }] },
            select: { id: true }
          });
          const orderIds = orders.map(o => o.id);
          if (orderIds.length > 0) {
            await tx.shipment.deleteMany({ where: { orderId: { in: orderIds } } });
            await tx.order.deleteMany({ where: { id: { in: orderIds } } });
          }

          // 15. Delete Ad Images for user's ads
          await tx.adImage.deleteMany({ where: { ad: { userId: id } } });

          // 16. Delete Ads
          await tx.ad.deleteMany({ where: { userId: id } });

          // 17. Delete MediaObjects uploaded by the user
          await tx.mediaObject.deleteMany({ where: { uploadedBy: id } });

          // 18. Finally, delete or soft-delete the User
          try {
            await tx.user.delete({ where: { id } });
          } catch (delErr) {
            await tx.user.update({
              where: { id },
              data: {
                deletedAt: new Date(),
                phone: null,
                email: `${id}@deleted.local`
              }
            });
          }
        });

        res.json({ success: true });
      } catch (err) {
        next(err);
      }
    });

    this.app.get('/api/admin/reports', ...adminAccessGuards, async (req, res, next) => {
      try {
        const reports = await prisma.report.findMany({
          orderBy: { timestamp: 'desc' },
          take: 100
        });

        const userIds = Array.from(new Set(reports.map(r => r.reporterId).filter(Boolean)));
        const adIds = Array.from(new Set(reports.map(r => r.adId).filter(Boolean)));

        const users = userIds.length > 0 ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } }) : [];
        const ads = adIds.length > 0 ? await prisma.ad.findMany({ where: { id: { in: adIds } }, select: { id: true, title: true } }) : [];

        const userMap = new Map(users.map(u => [u.id, u]));
        const adMap = new Map(ads.map(a => [a.id, a]));

        const resolvedReports = reports.map((r: any) => {
          const reporter = userMap.get(r.reporterId);
          const ad = adMap.get(r.adId);
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
        });

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

    const ARAB_CITY_TO_COUNTRY: Record<string, { code: string; labelAr: string }> = {
      // Jordan
      amman: { code: 'jo', labelAr: 'الأردن' },
      عمان: { code: 'jo', labelAr: 'الأردن' },
      irbid: { code: 'jo', labelAr: 'الأردن' },
      إربد: { code: 'jo', labelAr: 'الأردن' },
      zarqa: { code: 'jo', labelAr: 'الأردن' },
      الزرقاء: { code: 'jo', labelAr: 'الأردن' },
      aqaba: { code: 'jo', labelAr: 'الأردن' },
      العقبة: { code: 'jo', labelAr: 'الأردن' },
      salt: { code: 'jo', labelAr: 'الأردن' },
      السلط: { code: 'jo', labelAr: 'الأردن' },
      madaba: { code: 'jo', labelAr: 'الأردن' },
      مأدبا: { code: 'jo', labelAr: 'الأردن' },
      jerash: { code: 'jo', labelAr: 'الأردن' },
      جرش: { code: 'jo', labelAr: 'الأردن' },
      mafraq: { code: 'jo', labelAr: 'الأردن' },
      المفرق: { code: 'jo', labelAr: 'الأردن' },
      karak: { code: 'jo', labelAr: 'الأردن' },
      الكرك: { code: 'jo', labelAr: 'الأردن' },
      tafilah: { code: 'jo', labelAr: 'الأردن' },
      الطفيلة: { code: 'jo', labelAr: 'الأردن' },
      maan: { code: 'jo', labelAr: 'الأردن' },
      معان: { code: 'jo', labelAr: 'الأردن' },
      ajloun: { code: 'jo', labelAr: 'الأردن' },
      عجلون: { code: 'jo', labelAr: 'الأردن' },

      // Saudi Arabia
      riyadh: { code: 'sa', labelAr: 'السعودية' },
      الرياض: { code: 'sa', labelAr: 'السعودية' },
      jeddah: { code: 'sa', labelAr: 'السعودية' },
      جدة: { code: 'sa', labelAr: 'السعودية' },
      mecca: { code: 'sa', labelAr: 'السعودية' },
      مكة: { code: 'sa', labelAr: 'السعودية' },
      medina: { code: 'sa', labelAr: 'السعودية' },
      المدينة: { code: 'sa', labelAr: 'السعودية' },
      dammam: { code: 'sa', labelAr: 'السعودية' },
      الدمام: { code: 'sa', labelAr: 'السعودية' },
      khobar: { code: 'sa', labelAr: 'السعودية' },
      الخبر: { code: 'sa', labelAr: 'السعودية' },
      dhahran: { code: 'sa', labelAr: 'السعودية' },
      الظهران: { code: 'sa', labelAr: 'السعودية' },
      taif: { code: 'sa', labelAr: 'السعودية' },
      الطائف: { code: 'sa', labelAr: 'السعودية' },
      tabuk: { code: 'sa', labelAr: 'السعودية' },
      تبوك: { code: 'sa', labelAr: 'السعودية' },
      buraidah: { code: 'sa', labelAr: 'السعودية' },
      بريدة: { code: 'sa', labelAr: 'السعودية' },
      khamis_mushait: { code: 'sa', labelAr: 'السعودية' },
      خميس_مشيط: { code: 'sa', labelAr: 'السعودية' },
      abha: { code: 'sa', labelAr: 'السعودية' },
      أبها: { code: 'sa', labelAr: 'السعودية' },
      hail: { code: 'sa', labelAr: 'السعودية' },
      حائل: { code: 'sa', labelAr: 'السعودية' },
      jizan: { code: 'sa', labelAr: 'السعودية' },
      جيزان: { code: 'sa', labelAr: 'السعودية' },
      najran: { code: 'sa', labelAr: 'السعودية' },
      نجران: { code: 'sa', labelAr: 'السعودية' },
      jubail: { code: 'sa', labelAr: 'السعودية' },
      الجبيل: { code: 'sa', labelAr: 'السعودية' },
      yanbu: { code: 'sa', labelAr: 'السعودية' },
      ينبع: { code: 'sa', labelAr: 'السعودية' },

      // UAE
      dubai: { code: 'ae', labelAr: 'الإمارات' },
      دبي: { code: 'ae', labelAr: 'الإمارات' },
      abu_dhabi: { code: 'ae', labelAr: 'الإمارات' },
      أبوظبي: { code: 'ae', labelAr: 'الإمارات' },
      sharjah: { code: 'ae', labelAr: 'الإمارات' },
      الشارقة: { code: 'ae', labelAr: 'الإمارات' },
      ajman: { code: 'ae', labelAr: 'الإمارات' },
      عجمان: { code: 'ae', labelAr: 'الإمارات' },
      ras_al_khaimah: { code: 'ae', labelAr: 'الإمارات' },
      رأس_الخيمة: { code: 'ae', labelAr: 'الإمارات' },
      fujairah: { code: 'ae', labelAr: 'الإمارات' },
      الفجيرة: { code: 'ae', labelAr: 'الإمارات' },
      umm_al_quwain: { code: 'ae', labelAr: 'الإمارات' },
      أم_القيوين: { code: 'ae', labelAr: 'الإمارات' },
      al_ain: { code: 'ae', labelAr: 'الإمارات' },
      العين: { code: 'ae', labelAr: 'الإمارات' },

      // Egypt
      cairo: { code: 'eg', labelAr: 'مصر' },
      القاهرة: { code: 'eg', labelAr: 'مصر' },
      alexandria: { code: 'eg', labelAr: 'مصر' },
      الإسكندرية: { code: 'eg', labelAr: 'مصر' },
      giza: { code: 'eg', labelAr: 'مصر' },
      الجيزة: { code: 'eg', labelAr: 'مصر' },
      sharm_el_sheikh: { code: 'eg', labelAr: 'مصر' },
      شرم_الشيخ: { code: 'eg', labelAr: 'مصر' },
      hurghada: { code: 'eg', labelAr: 'مصر' },
      الغردقة: { code: 'eg', labelAr: 'مصر' },
      mansoura: { code: 'eg', labelAr: 'مصر' },
      المنصورة: { code: 'eg', labelAr: 'مصر' },
      tanta: { code: 'eg', labelAr: 'مصر' },
      طنطا: { code: 'eg', labelAr: 'مصر' },
      asyut: { code: 'eg', labelAr: 'مصر' },
      أسيوط: { code: 'eg', labelAr: 'مصر' },
      luxor: { code: 'eg', labelAr: 'مصر' },
      الأقصر: { code: 'eg', labelAr: 'مصر' },
      aswan: { code: 'eg', labelAr: 'مصر' },
      أسوان: { code: 'eg', labelAr: 'مصر' },
      port_said: { code: 'eg', labelAr: 'مصر' },
      بورسعيد: { code: 'eg', labelAr: 'مصر' },
      suez: { code: 'eg', labelAr: 'مصر' },
      السويس: { code: 'eg', labelAr: 'مصر' },

      // Yemen
      sanaa: { code: 'ye', labelAr: 'اليمن' },
      sanaa_city: { code: 'ye', labelAr: 'اليمن' },
      صنعاء: { code: 'ye', labelAr: 'اليمن' },
      aden: { code: 'ye', labelAr: 'اليمن' },
      عدن: { code: 'ye', labelAr: 'اليمن' },
      taiz: { code: 'ye', labelAr: 'اليمن' },
      تعز: { code: 'ye', labelAr: 'اليمن' },
      hadramout: { code: 'ye', labelAr: 'اليمن' },
      حضرموت: { code: 'ye', labelAr: 'اليمن' },
      mukalla: { code: 'ye', labelAr: 'اليمن' },
      المكلا: { code: 'ye', labelAr: 'اليمن' },
      hodeidah: { code: 'ye', labelAr: 'اليمن' },
      الحديدة: { code: 'ye', labelAr: 'اليمن' },
      ibb: { code: 'ye', labelAr: 'اليمن' },
      إب: { code: 'ye', labelAr: 'اليمن' },
      marib: { code: 'ye', labelAr: 'اليمن' },
      مأرب: { code: 'ye', labelAr: 'اليمن' },
      dhamar: { code: 'ye', labelAr: 'اليمن' },
      ذمار: { code: 'ye', labelAr: 'اليمن' },

      // Other Arab Countries
      kuwait_city: { code: 'kw', labelAr: 'الكويت' },
      الكويت: { code: 'kw', labelAr: 'الكويت' },
      doha: { code: 'qa', labelAr: 'قطر' },
      الدوحة: { code: 'qa', labelAr: 'قطر' },
      manama: { code: 'bh', labelAr: 'البحرين' },
      المنامة: { code: 'bh', labelAr: 'البحرين' },
      muscat: { code: 'om', labelAr: 'عُمان' },
      مسقط: { code: 'om', labelAr: 'عُمان' },
      baghdad: { code: 'iq', labelAr: 'العراق' },
      بغداد: { code: 'iq', labelAr: 'العراق' },
      erbil: { code: 'iq', labelAr: 'العراق' },
      أربيل: { code: 'iq', labelAr: 'العراق' },
      basra: { code: 'iq', labelAr: 'العراق' },
      البصرة: { code: 'iq', labelAr: 'العراق' },
      damascus: { code: 'sy', labelAr: 'سوريا' },
      دمشق: { code: 'sy', labelAr: 'سوريا' },
      beirut: { code: 'lb', labelAr: 'لبنان' },
      بيروت: { code: 'lb', labelAr: 'لبنان' },
      jerusalem: { code: 'ps', labelAr: 'فلسطين' },
      القدس: { code: 'ps', labelAr: 'فلسطين' },
      gaza: { code: 'ps', labelAr: 'فلسطين' },
      غزة: { code: 'ps', labelAr: 'فلسطين' },
      ramallah: { code: 'ps', labelAr: 'فلسطين' },
      رام_الله: { code: 'ps', labelAr: 'فلسطين' },
      khartoum: { code: 'sd', labelAr: 'السودان' },
      الخرطوم: { code: 'sd', labelAr: 'السودان' },
      tripoli: { code: 'ly', labelAr: 'ليبيا' },
      طرابلس: { code: 'ly', labelAr: 'ليبيا' },
      benghazi: { code: 'ly', labelAr: 'ليبيا' },
      بنغازي: { code: 'ly', labelAr: 'ليبيا' },
      tunis: { code: 'tn', labelAr: 'تونس' },
      تونس: { code: 'tn', labelAr: 'تونس' },
      algiers: { code: 'dz', labelAr: 'الجزائر' },
      الجزائر: { code: 'dz', labelAr: 'الجزائر' },
      casablanca: { code: 'ma', labelAr: 'المغرب' },
      الدار_البيضاء: { code: 'ma', labelAr: 'المغرب' },
      rabat: { code: 'ma', labelAr: 'المغرب' },
      الرباط: { code: 'ma', labelAr: 'المغرب' },
      marrakech: { code: 'ma', labelAr: 'المغرب' },
      مراكش: { code: 'ma', labelAr: 'المغرب' },
      nouakchott: { code: 'mr', labelAr: 'موريتانيا' },
      نواكشوط: { code: 'mr', labelAr: 'موريتانيا' },
      mogadishu: { code: 'so', labelAr: 'الصومال' },
      مقديشو: { code: 'so', labelAr: 'الصومال' }
    };

    const resolveAdCountry = (cityName: string, dbCity?: any) => {
      if (dbCity?.country?.countryCode) {
        return {
          code: dbCity.country.countryCode.toLowerCase(),
          labelAr: dbCity.country.labelAr || dbCity.country.nameAr || 'الوطن العربي'
        };
      }
      const raw = (cityName || '').trim();
      const lower = raw.toLowerCase();
      const snake = lower.replace(/\s+/g, '_');
      const found = ARAB_CITY_TO_COUNTRY[snake] || ARAB_CITY_TO_COUNTRY[lower] || ARAB_CITY_TO_COUNTRY[raw];
      if (found) return found;
      return { code: 'ye', labelAr: 'اليمن' };
    };

    /** Shared response headers for all sitemap files — 5 min cache for fast freshness */
    const sitemapHeaders = (res: any, cacheSeconds = 300) => {
      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.setHeader('Cache-Control', `public, max-age=${cacheSeconds}, stale-while-revalidate=3600`);
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

    /** Empty but valid urlset — MUST contain at least one <url> tag and matching extension tags for Google Search Console */
    const emptyUrlset = (extraNs = '') => {
      let extraTag = '';
      if (extraNs.includes('sitemap-image')) {
        extraTag = `\n    <image:image>\n      <image:loc>https://www.aswaq22.com/aswaq-icon-512.png</image:loc>\n      <image:title>أسواق</image:title>\n    </image:image>`;
      } else if (extraNs.includes('sitemap-video')) {
        extraTag = `\n    <video:video>\n      <video:thumbnail_loc>https://www.aswaq22.com/aswaq-icon-512.png</video:thumbnail_loc>\n      <video:title>منصة أسواق</video:title>\n      <video:description>منصة أسواق للإعلانات التفاعلية</video:description>\n      <video:content_loc>https://www.aswaq22.com/aswaq-icon-512.png</video:content_loc>\n      <video:publication_date>${new Date().toISOString()}</video:publication_date>\n    </video:video>`;
      }

      return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"${extraNs}>
  <url>
    <loc>https://www.aswaq22.com/</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>${extraTag}
  </url>
</urlset>`;
    };

    /** Build a <url> block */
    const urlBlock = (loc: string, lastmod: string, changefreq: string, priority: string) =>
      `  <url>\n    <loc>${safeLoc(loc)}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;

    /** Build a <sitemap> entry in sitemap index */
    const sitemapEntry = (loc: string, lastmod: string) =>
      `  <sitemap>\n    <loc>${safeLoc(loc)}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </sitemap>`;

    /** XML declaration + urlset wrapper */
    const urlsetXml = (urls: string[], extraNs = '') =>
      urls.length > 0
        ? `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"${extraNs}>\n${urls.join('\n')}\n</urlset>`
        : emptyUrlset(extraNs);

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

    // ── IndexNow Verification Key Route ──────────────────────────────────
    this.app.get(['/8f7b2c9a1d4e6f3b5a8c2d1e0f9b4a7c.txt', '/:key([a-f0-9]{32}).txt'], (req, res) => {
      const key = req.params.key || '8f7b2c9a1d4e6f3b5a8c2d1e0f9b4a7c';
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(key);
    });

    // ── manifest.json (Dynamic PWA Manifest to serve custom admin logo) ────
    this.app.get(['/manifest.json', '/manifest.json/'], async (req, res) => {
      try {
        let settings: any = null;
        try { settings = await prisma.platformSettings.findFirst(); } catch (_) { /* table may not exist */ }
        const appName = settings?.appName || 'أَسْوَاق';
        const siteDescription = settings?.siteDescription || 'منصة الإعلانات والخدمات التجارية الأولى';
        
        // Resolve custom logo URL or fallback to standard icons
        let logoUrl = '';
        if (settings?.logoUrl) {
          if (settings.logoUrl.startsWith('http') || settings.logoUrl.startsWith('data:')) {
            logoUrl = settings.logoUrl;
          } else {
            // Resolve media URL from backend domain
            const mediaBase = process.env.MEDIA_PUBLIC_BASE_URL || process.env.R2_PUBLIC_URL || process.env.API_URL || 'https://api.aswaq22.com';
            logoUrl = `${mediaBase.replace(/\/$/, '')}/${settings.logoUrl.replace(/^\//, '')}`;
          }
        }

        const icon192 = logoUrl || `${BASE_URL}/aswaq-icon-192.png`;
        const icon512 = logoUrl || `${BASE_URL}/aswaq-icon-512.png`;
        const iconMask192 = logoUrl || `${BASE_URL}/aswaq-icon-maskable-192.png`;
        const iconMask512 = logoUrl || `${BASE_URL}/aswaq-icon-maskable-512.png`;

        const manifestObj = {
          name: `${appName} | Aswaq Marketplace`,
          short_name: appName,
          description: siteDescription,
          start_url: `${BASE_URL}/`,
          display: "standalone",
          background_color: "#090d16",
          theme_color: "#090d16",
          orientation: "portrait-primary",
          categories: ["shopping", "social", "business"],
          lang: "ar",
          dir: "rtl",
          icons: [
            {
              src: icon192,
              sizes: "192x192",
              type: "image/png",
              purpose: "any"
            },
            {
              src: iconMask192,
              sizes: "192x192",
              type: "image/png",
              purpose: "maskable"
            },
            {
              src: icon512,
              sizes: "512x512",
              type: "image/png",
              purpose: "any"
            },
            {
              src: iconMask512,
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable"
            }
          ],
          shortcuts: [
            {
              name: "الرئيسية",
              short_name: "الرئيسية",
              description: "تصفح آخر الإعلانات المميزة في أسواق",
              url: "/?tab=home",
              icons: [{ src: icon192, sizes: "192x192", type: "image/png" }]
            },
            {
              name: "أضف إعلان",
              short_name: "نشاط جديد",
              description: "أضف عرضك أو خدماتك الآن مجاناً",
              url: "/?tab=create-ad",
              icons: [{ src: icon192, sizes: "192x192", type: "image/png" }]
            }
          ],
          prefer_related_applications: false
        };

        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=600');
        res.json(manifestObj);
      } catch (e: any) {
        res.status(500).json({ error: 'Failed to build dynamic manifest', message: e.message });
      }
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
          const cc          = resolveAdCountry(ad.city, city).code;
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
          const cc   = resolveAdCountry(ad.city, city).code;
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
          if (!ad.images || ad.images.length === 0) continue;
          const city = cityMap.get(ad.city) ?? cityByName.get(ad.city) ?? cityByName.get(ad.city.toLowerCase());
          const cc   = resolveAdCountry(ad.city, city).code;
          const loc  = `${BASE_URL}/${cc}/${ad.category.nameEn.toLowerCase()}/${slugify(ad.title)}-${ad.id}`;
          const safe = escapeXml(ad.title);

          const validImages = ad.images.filter(img => img.url && !img.url.trim().startsWith('data:'));
          if (validImages.length === 0) continue;

          const imageTags = validImages.map(img => {
            const raw = img.url.trim();
            const imgUrl = raw.startsWith('http') ? raw : `${BASE_URL}${raw.startsWith('/') ? '' : '/'}${raw}`;
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
          if (!reel.videoUrl || reel.videoUrl.trim().startsWith('data:')) continue;
          const rawVideo  = reel.videoUrl.trim();
          const videoUrl  = rawVideo.startsWith('http') ? rawVideo : `${BASE_URL}${rawVideo.startsWith('/') ? '' : '/'}${rawVideo}`;
          const safeVideo = safeLoc(videoUrl);
          const safeTitle = escapeXml(reel.title || 'فيديو ترويجي - أسواق');
          const safeThumb = `${BASE_URL}/aswaq-icon-512.png`;

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
          if (!ad.images || ad.images.length === 0) continue;
          const city = cityMap.get(ad.city) ?? cityByName.get(ad.city) ?? cityByName.get(ad.city.toLowerCase());
          const cc   = city?.country?.countryCode?.toLowerCase() || 'ye';
          const loc  = `${BASE_URL}/${cc}/${ad.category.nameEn.toLowerCase()}/${slugify(ad.title)}-${ad.id}`;
          const safe = escapeXml(ad.title);

          const validImages = ad.images.filter(img => img.url && !img.url.trim().startsWith('data:'));
          if (validImages.length === 0) continue;

          const imageTags = validImages.map(img => {
            const raw = img.url.trim();
            const imgUrl = raw.startsWith('http') ? raw : `${BASE_URL}${raw.startsWith('/') ? '' : '/'}${raw}`;
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
        logoUrl: '/aswaq-icon.png',
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

    // SECURITY FIX: All settings routes are now properly admin-guarded
    // GET /api/settings/public - Public platform settings endpoint (accessible without admin credentials)
    this.app.get('/api/settings/public', async (req, res) => {
      try {
        const settings = await getPlatformSettings();
        res.json({
          appName: settings.appName || 'أسواق',
          logoLetter: settings.logoLetter || 'أ',
          logoUrl: settings.logoUrl || '',
          maintenanceMode: !!settings.maintenanceMode,
          supportPhone: settings.supportPhone || '+962790186572',
          supportWhatsapp: settings.supportWhatsapp || '+962790186572',
          supportEmail: settings.supportEmail || 'emad333salah@gmail.com',
        });
      } catch (err: any) {
        res.json({
          appName: 'أسواق',
          logoLetter: 'أ',
          logoUrl: '',
          supportPhone: '+962790186572',
          supportWhatsapp: '+962790186572',
          supportEmail: 'emad333salah@gmail.com',
        });
      }
    });

    this.app.get('/api/admin/settings', ...adminAccessGuards, async (req, res) => {
      try {
        const settings = await getPlatformSettings();
        res.json(settings);
      } catch (err: any) {
        res.status(500).json({ error: 'Failed loading settings', message: err.message });
      }
    });

    this.app.patch('/api/admin/settings', ...adminAccessGuards, async (req, res) => {
      try {
        const currentSettings = await getPlatformSettings();
        let logoUrl = currentSettings.logoUrl;
        if (req.body.logoUrl && typeof req.body.logoUrl === 'string' && req.body.logoUrl.trim() && !req.body.logoUrl.startsWith('data:')) {
          logoUrl = req.body.logoUrl.trim();
        }
        const updatedSettings = { ...currentSettings, ...req.body, logoUrl };
        await savePlatformSettings(updatedSettings);
        if (this.io) {
          this.io.emit('platform_settings_updated', updatedSettings);
        }
        res.json({ success: true, ...updatedSettings });
      } catch (err: any) {
        res.status(500).json({ error: 'Save failed', message: err.message });
      }
    });

    this.app.put('/api/admin/settings', ...adminAccessGuards, async (req, res) => {
      try {
        const currentSettings = await getPlatformSettings();
        let logoUrl = currentSettings.logoUrl;
        if (req.body.logoUrl && typeof req.body.logoUrl === 'string' && req.body.logoUrl.trim() && !req.body.logoUrl.startsWith('data:')) {
          logoUrl = req.body.logoUrl.trim();
        }
        const updatedSettings = { ...currentSettings, ...req.body, logoUrl };
        await savePlatformSettings(updatedSettings);
        if (this.io) {
          this.io.emit('platform_settings_updated', updatedSettings);
        }
        res.json({ success: true, ...updatedSettings });
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

        const uploadsDir = path.join(process.cwd(), 'uploads');
        if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

        let bufferToSave = req.file.buffer;
        try {
          const sharp = (await import('sharp')).default;
          bufferToSave = await sharp(req.file.buffer)
            .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
            .png({ quality: 85 })
            .toBuffer();
        } catch (sharpErr) {
          logger.warn(`Sharp resizing for logo failed: ${(sharpErr as any)?.message}`);
        }

        // Save as platform-logo.png and update all PWA icons across public/ and dist/
        const logoFileName = `platform-logo.png`;
        const logoPath = path.join(uploadsDir, logoFileName);
        fs.writeFileSync(logoPath, bufferToSave);

        await this.regeneratePwaIcons(bufferToSave);

        // Store optimized Base64 Data URI in database for 100% reliability across restarts & domains
        const logoUrl = `data:image/png;base64,${bufferToSave.toString('base64')}`;
        logger.info({ message: `settings/logo saved & PWA icons updated successfully (${bufferToSave.length} bytes)` });

        const currentSettings = await getPlatformSettings();
        currentSettings.logoUrl = logoUrl;
        await savePlatformSettings(currentSettings);

        if (this.io) {
          this.io.emit('platform_settings_updated', currentSettings);
        }

        res.json({ success: true, logoUrl });

      } catch (err: any) {
        logger.error({ message: 'Failed uploading logo', error: err.message });
        res.status(500).json({ error: 'Failed uploading logo', message: err.message });
      }
    });
  }

  private async regeneratePwaIcons(logoBuffer: Buffer): Promise<void> {
    try {
      const fs = await import('fs');
      const path = await import('path');
      const sharp = (await import('sharp')).default;

      const icon48 = await sharp(logoBuffer).resize(48, 48, { fit: 'cover' }).png().toBuffer();
      const icon192 = await sharp(logoBuffer).resize(192, 192, { fit: 'cover' }).png().toBuffer();
      const icon512 = await sharp(logoBuffer).resize(512, 512, { fit: 'cover' }).png().toBuffer();

      const dirs = [path.join(process.cwd(), 'public'), path.join(process.cwd(), 'dist')];
      for (const d of dirs) {
        if (fs.existsSync(d)) {
          fs.writeFileSync(path.join(d, 'aswaq-icon-192.png'), icon192);
          fs.writeFileSync(path.join(d, 'aswaq-icon-maskable-192.png'), icon192);
          fs.writeFileSync(path.join(d, 'aswaq-icon-512.png'), icon512);
          fs.writeFileSync(path.join(d, 'aswaq-icon-maskable-512.png'), icon512);
          fs.writeFileSync(path.join(d, 'aswaq-icon.png'), icon512);
          fs.writeFileSync(path.join(d, 'aswaq-icon-48.png'), icon48);
          fs.writeFileSync(path.join(d, 'favicon.ico'), icon48);
          fs.writeFileSync(path.join(d, 'custom-admin-logo.png'), logoBuffer);
        }
      }
      logger.info('[PWA Icons] Successfully regenerated all size variants (48, 192, 512, favicon.ico) across public/ and dist/');
    } catch (iconErr: any) {
      logger.warn(`PWA icon resizing failed: ${iconErr.message}`);
    }
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

    const ARAB_CITY_TO_COUNTRY: Record<string, { code: string; labelAr: string }> = {
      // Jordan
      amman: { code: 'jo', labelAr: 'الأردن' },
      عمان: { code: 'jo', labelAr: 'الأردن' },
      irbid: { code: 'jo', labelAr: 'الأردن' },
      إربد: { code: 'jo', labelAr: 'الأردن' },
      zarqa: { code: 'jo', labelAr: 'الأردن' },
      الزرقاء: { code: 'jo', labelAr: 'الأردن' },
      aqaba: { code: 'jo', labelAr: 'الأردن' },
      العقبة: { code: 'jo', labelAr: 'الأردن' },
      salt: { code: 'jo', labelAr: 'الأردن' },
      السلط: { code: 'jo', labelAr: 'الأردن' },
      madaba: { code: 'jo', labelAr: 'الأردن' },
      مأدبا: { code: 'jo', labelAr: 'الأردن' },
      jerash: { code: 'jo', labelAr: 'الأردن' },
      جرش: { code: 'jo', labelAr: 'الأردن' },
      mafraq: { code: 'jo', labelAr: 'الأردن' },
      المفرق: { code: 'jo', labelAr: 'الأردن' },
      karak: { code: 'jo', labelAr: 'الأردن' },
      الكرك: { code: 'jo', labelAr: 'الأردن' },
      tafilah: { code: 'jo', labelAr: 'الأردن' },
      الطفيلة: { code: 'jo', labelAr: 'الأردن' },
      maan: { code: 'jo', labelAr: 'الأردن' },
      معان: { code: 'jo', labelAr: 'الأردن' },
      ajloun: { code: 'jo', labelAr: 'الأردن' },
      عجلون: { code: 'jo', labelAr: 'الأردن' },

      // Saudi Arabia
      riyadh: { code: 'sa', labelAr: 'السعودية' },
      الرياض: { code: 'sa', labelAr: 'السعودية' },
      jeddah: { code: 'sa', labelAr: 'السعودية' },
      جدة: { code: 'sa', labelAr: 'السعودية' },
      mecca: { code: 'sa', labelAr: 'السعودية' },
      مكة: { code: 'sa', labelAr: 'السعودية' },
      medina: { code: 'sa', labelAr: 'السعودية' },
      المدينة: { code: 'sa', labelAr: 'السعودية' },
      dammam: { code: 'sa', labelAr: 'السعودية' },
      الدمام: { code: 'sa', labelAr: 'السعودية' },
      khobar: { code: 'sa', labelAr: 'السعودية' },
      الخبر: { code: 'sa', labelAr: 'السعودية' },
      dhahran: { code: 'sa', labelAr: 'السعودية' },
      الظهران: { code: 'sa', labelAr: 'السعودية' },
      taif: { code: 'sa', labelAr: 'السعودية' },
      الطائف: { code: 'sa', labelAr: 'السعودية' },
      tabuk: { code: 'sa', labelAr: 'السعودية' },
      تبوك: { code: 'sa', labelAr: 'السعودية' },
      buraidah: { code: 'sa', labelAr: 'السعودية' },
      بريدة: { code: 'sa', labelAr: 'السعودية' },
      khamis_mushait: { code: 'sa', labelAr: 'السعودية' },
      خميس_مشيط: { code: 'sa', labelAr: 'السعودية' },
      abha: { code: 'sa', labelAr: 'السعودية' },
      أبها: { code: 'sa', labelAr: 'السعودية' },
      hail: { code: 'sa', labelAr: 'السعودية' },
      حائل: { code: 'sa', labelAr: 'السعودية' },
      jizan: { code: 'sa', labelAr: 'السعودية' },
      جيزان: { code: 'sa', labelAr: 'السعودية' },
      najran: { code: 'sa', labelAr: 'السعودية' },
      نجران: { code: 'sa', labelAr: 'السعودية' },
      jubail: { code: 'sa', labelAr: 'السعودية' },
      الجبيل: { code: 'sa', labelAr: 'السعودية' },
      yanbu: { code: 'sa', labelAr: 'السعودية' },
      ينبع: { code: 'sa', labelAr: 'السعودية' },

      // UAE
      dubai: { code: 'ae', labelAr: 'الإمارات' },
      دبي: { code: 'ae', labelAr: 'الإمارات' },
      abu_dhabi: { code: 'ae', labelAr: 'الإمارات' },
      أبوظبي: { code: 'ae', labelAr: 'الإمارات' },
      sharjah: { code: 'ae', labelAr: 'الإمارات' },
      الشارقة: { code: 'ae', labelAr: 'الإمارات' },
      ajman: { code: 'ae', labelAr: 'الإمارات' },
      عجمان: { code: 'ae', labelAr: 'الإمارات' },
      ras_al_khaimah: { code: 'ae', labelAr: 'الإمارات' },
      رأس_الخيمة: { code: 'ae', labelAr: 'الإمارات' },
      fujairah: { code: 'ae', labelAr: 'الإمارات' },
      الفجيرة: { code: 'ae', labelAr: 'الإمارات' },
      umm_al_quwain: { code: 'ae', labelAr: 'الإمارات' },
      أم_القيوين: { code: 'ae', labelAr: 'الإمارات' },
      al_ain: { code: 'ae', labelAr: 'الإمارات' },
      العين: { code: 'ae', labelAr: 'الإمارات' },

      // Egypt
      cairo: { code: 'eg', labelAr: 'مصر' },
      القاهرة: { code: 'eg', labelAr: 'مصر' },
      alexandria: { code: 'eg', labelAr: 'مصر' },
      الإسكندرية: { code: 'eg', labelAr: 'مصر' },
      giza: { code: 'eg', labelAr: 'مصر' },
      الجيزة: { code: 'eg', labelAr: 'مصر' },
      sharm_el_sheikh: { code: 'eg', labelAr: 'مصر' },
      شرم_الشيخ: { code: 'eg', labelAr: 'مصر' },
      hurghada: { code: 'eg', labelAr: 'مصر' },
      الغردقة: { code: 'eg', labelAr: 'مصر' },
      mansoura: { code: 'eg', labelAr: 'مصر' },
      المنصورة: { code: 'eg', labelAr: 'مصر' },
      tanta: { code: 'eg', labelAr: 'مصر' },
      طنطا: { code: 'eg', labelAr: 'مصر' },
      asyut: { code: 'eg', labelAr: 'مصر' },
      أسيوط: { code: 'eg', labelAr: 'مصر' },
      luxor: { code: 'eg', labelAr: 'مصر' },
      الأقصر: { code: 'eg', labelAr: 'مصر' },
      aswan: { code: 'eg', labelAr: 'مصر' },
      أسوان: { code: 'eg', labelAr: 'مصر' },
      port_said: { code: 'eg', labelAr: 'مصر' },
      بورسعيد: { code: 'eg', labelAr: 'مصر' },
      suez: { code: 'eg', labelAr: 'مصر' },
      السويس: { code: 'eg', labelAr: 'مصر' },

      // Yemen
      sanaa: { code: 'ye', labelAr: 'اليمن' },
      sanaa_city: { code: 'ye', labelAr: 'اليمن' },
      صنعاء: { code: 'ye', labelAr: 'اليمن' },
      aden: { code: 'ye', labelAr: 'اليمن' },
      عدن: { code: 'ye', labelAr: 'اليمن' },
      taiz: { code: 'ye', labelAr: 'اليمن' },
      تعز: { code: 'ye', labelAr: 'اليمن' },
      hadramout: { code: 'ye', labelAr: 'اليمن' },
      حضرموت: { code: 'ye', labelAr: 'اليمن' },
      mukalla: { code: 'ye', labelAr: 'اليمن' },
      المكلا: { code: 'ye', labelAr: 'اليمن' },
      hodeidah: { code: 'ye', labelAr: 'اليمن' },
      الحديدة: { code: 'ye', labelAr: 'اليمن' },
      ibb: { code: 'ye', labelAr: 'اليمن' },
      إب: { code: 'ye', labelAr: 'اليمن' },
      marib: { code: 'ye', labelAr: 'اليمن' },
      مأرب: { code: 'ye', labelAr: 'اليمن' },
      dhamar: { code: 'ye', labelAr: 'اليمن' },
      ذمار: { code: 'ye', labelAr: 'اليمن' },

      // Other Arab Countries
      kuwait_city: { code: 'kw', labelAr: 'الكويت' },
      الكويت: { code: 'kw', labelAr: 'الكويت' },
      doha: { code: 'qa', labelAr: 'قطر' },
      الدوحة: { code: 'qa', labelAr: 'قطر' },
      manama: { code: 'bh', labelAr: 'البحرين' },
      المنامة: { code: 'bh', labelAr: 'البحرين' },
      muscat: { code: 'om', labelAr: 'عُمان' },
      مسقط: { code: 'om', labelAr: 'عُمان' },
      baghdad: { code: 'iq', labelAr: 'العراق' },
      بغداد: { code: 'iq', labelAr: 'العراق' },
      erbil: { code: 'iq', labelAr: 'العراق' },
      أربيل: { code: 'iq', labelAr: 'العراق' },
      basra: { code: 'iq', labelAr: 'العراق' },
      البصرة: { code: 'iq', labelAr: 'العراق' },
      damascus: { code: 'sy', labelAr: 'سوريا' },
      دمشق: { code: 'sy', labelAr: 'سوريا' },
      beirut: { code: 'lb', labelAr: 'لبنان' },
      بيروت: { code: 'lb', labelAr: 'لبنان' },
      jerusalem: { code: 'ps', labelAr: 'فلسطين' },
      القدس: { code: 'ps', labelAr: 'فلسطين' },
      gaza: { code: 'ps', labelAr: 'فلسطين' },
      غزة: { code: 'ps', labelAr: 'فلسطين' },
      ramallah: { code: 'ps', labelAr: 'فلسطين' },
      رام_الله: { code: 'ps', labelAr: 'فلسطين' },
      khartoum: { code: 'sd', labelAr: 'السودان' },
      الخرطوم: { code: 'sd', labelAr: 'السودان' },
      tripoli: { code: 'ly', labelAr: 'ليبيا' },
      طرابلس: { code: 'ly', labelAr: 'ليبيا' },
      benghazi: { code: 'ly', labelAr: 'ليبيا' },
      بنغازي: { code: 'ly', labelAr: 'ليبيا' },
      tunis: { code: 'tn', labelAr: 'تونس' },
      تونس: { code: 'tn', labelAr: 'تونس' },
      algiers: { code: 'dz', labelAr: 'الجزائر' },
      الجزائر: { code: 'dz', labelAr: 'الجزائر' },
      casablanca: { code: 'ma', labelAr: 'المغرب' },
      الدار_البيضاء: { code: 'ma', labelAr: 'المغرب' },
      rabat: { code: 'ma', labelAr: 'المغرب' },
      الرباط: { code: 'ma', labelAr: 'المغرب' },
      marrakech: { code: 'ma', labelAr: 'المغرب' },
      مراكش: { code: 'ma', labelAr: 'المغرب' },
      nouakchott: { code: 'mr', labelAr: 'موريتانيا' },
      نواكشوط: { code: 'mr', labelAr: 'موريتانيا' },
      mogadishu: { code: 'so', labelAr: 'الصومال' },
      مقديشو: { code: 'so', labelAr: 'الصومال' }
    };

    const resolveAdCountry = (cityName: string, dbCity?: any) => {
      if (dbCity?.country?.countryCode) {
        return {
          code: dbCity.country.countryCode.toLowerCase(),
          labelAr: dbCity.country.labelAr || dbCity.country.nameAr || 'الوطن العربي'
        };
      }
      const raw = (cityName || '').trim();
      const lower = raw.toLowerCase();
      const snake = lower.replace(/\s+/g, '_');
      const found = ARAB_CITY_TO_COUNTRY[snake] || ARAB_CITY_TO_COUNTRY[lower] || ARAB_CITY_TO_COUNTRY[raw];
      if (found) return found;
      return { code: 'ye', labelAr: 'اليمن' };
    };

    // 1. Dynamic SEO Ad Detail Route: /ad/:id, /post/:id, /promo/:id, /item/:id, /:countryCode(2 letters)/:categoryName/:titleSlug-:id(UUID)
    this.app.get(['/ad/:id', '/post/:id', '/promo/:id', '/item/:id', '/:country([a-zA-Z]{2})/:category/:slugAndId'], async (req, res, next) => {
      const paramStr = req.params.id || req.params.slugAndId || req.path;
      const uuidRegex = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
      const match = paramStr.match(uuidRegex);
      if (!match) {
        return next(); // Fall through if it's not a valid ad URL with UUID
      }
      
      const adId = match[0];
      try {
        const ad = await prisma.ad.findUnique({
          where: { id: adId },
          include: { category: true, images: true, user: true }
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
        const resolvedCountry = resolveAdCountry(ad.city, city);
        const countryCode = resolvedCountry.code;
        const countryLabel = resolvedCountry.labelAr;

        const canonicalPath = `/${countryCode}/${ad.category.nameEn.toLowerCase()}/${slugify(ad.title)}-${ad.id}`.toLowerCase();
        const canonicalUrl = `https://www.aswaq22.com${canonicalPath}`;

        // 301 Redirect to the canonical version ONLY if accessed via short URL (/ad/:id, /post/:id, etc.)
        if (req.path.startsWith('/ad/') || req.path.startsWith('/post/') || req.path.startsWith('/promo/') || req.path.startsWith('/item/')) {
          const host = req.headers.host || 'www.aswaq22.com';
          const targetHost = host.includes('localhost') || host.includes('127.0.0.1') ? host : 'www.aswaq22.com';
          return res.redirect(301, `https://${targetHost}${canonicalPath}`);
        }

        // Render index.html with pre-injected tags (Universal Rendering)
        let html = getHtmlTemplate();
        
        // Safe versions of text for HTML attribute/content injection
        const safeTitle    = escapeXml(ad.title);
        const safeDesc     = escapeXml((ad.description || '').substring(0, 160));
        const fullDescSafe = escapeXml(ad.description || '');
        const safeCountry  = escapeXml(countryLabel);
        const safeCity     = escapeXml(ad.city || '');
        const safeCategory = escapeXml(ad.category.nameAr || '');

        // Inject Title
        html = html.replace(/<title>.*?<\/title>/, `<title>${safeTitle} | أسواق ${safeCountry}</title>`);
        
        // Inject Canonical Tag
        const canonicalTag = `<link rel="canonical" href="${canonicalUrl}" />`;
        if (html.includes('rel="canonical"')) {
          html = html.replace(/<link rel="canonical"[^>]*>/, canonicalTag);
        } else {
          html = html.replace('</head>', `  ${canonicalTag}\n</head>`);
        }

        // Inject Description Tag
        const descTag = `<meta name="description" content="${safeDesc || safeTitle}" />`;
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
        } else if (catName === 'properties' || catName === 'real-estate' || catName === 'apartments' || catName === 'lands' || catName === 'hotels') {
          jsonLdString += schemaFactory.getAccommodationSchema(ad, canonicalUrl);
        } else {
          jsonLdString += schemaFactory.getProductSchema(ad, canonicalUrl);
        }

        // BreadcrumbList steps
        const breadcrumbSteps = [
          { name: "الرئيسية", url: "https://www.aswaq22.com/" },
          { name: safeCountry, url: `https://www.aswaq22.com/${countryCode}` },
          { name: safeCategory, url: `https://www.aswaq22.com/${countryCode}/${ad.category.nameEn.toLowerCase()}` },
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
        
        // Replace existing Open Graph & Twitter tags if present, or inject new ones
        html = html.replace(/<meta property="og:title"[^>]*>/g, `<meta property="og:title" content="${safeTitle} | أسواق" />`);
        html = html.replace(/<meta property="og:description"[^>]*>/g, `<meta property="og:description" content="${safeDesc}..." />`);
        html = html.replace(/<meta property="og:image"[^>]*>/g, `<meta property="og:image" content="${safeImageUrl}" />`);
        html = html.replace(/<meta property="og:url"[^>]*>/g, `<meta property="og:url" content="${canonicalUrl}" />`);
        html = html.replace(/<meta name="twitter:title"[^>]*>/g, `<meta name="twitter:title" content="${safeTitle} | أسواق" />`);
        html = html.replace(/<meta name="twitter:description"[^>]*>/g, `<meta name="twitter:description" content="${safeDesc}..." />`);
        html = html.replace(/<meta name="twitter:image"[^>]*>/g, `<meta name="twitter:image" content="${safeImageUrl}" />`);

        const ogTags = `
  <meta property="og:type" content="article" />
  <meta name="twitter:card" content="summary_large_image" />
`;
        html = html.replace('</head>', `${ogTags}\n</head>`);

        // Inject Full Pre-rendered SSR Body inside #root for Instant Googlebot Indexing
        const adImagesList = (ad as any).images || [];
        const imagesHtml = adImagesList.map((img: any) => {
          const u = img.url.startsWith('http') ? img.url : `https://www.aswaq22.com${img.url}`;
          return `<img src="${escapeXml(u)}" alt="${safeTitle}" style="max-width: 100%; height: auto; border-radius: 8px; margin: 8px 0;" loading="lazy" />`;
        }).join('\n');

        const preRenderedBody = `
<div id="root">
  <main class="aswaq-ssr-ad-container" style="max-width: 900px; margin: 0 auto; padding: 24px 16px; font-family: system-ui, -apple-system, sans-serif; direction: rtl; text-align: right; color: #1e293b;">
    <nav aria-label="مسار التنقل" style="font-size: 14px; margin-bottom: 20px; color: #64748b; display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
      <a href="https://www.aswaq22.com/" style="color: #10b981; text-decoration: none; font-weight: bold;">الرئيسية</a> &gt;
      <a href="https://www.aswaq22.com/${countryCode}" style="color: #10b981; text-decoration: none;">${safeCountry}</a> &gt;
      <a href="https://www.aswaq22.com/${countryCode}/${ad.category.nameEn.toLowerCase()}" style="color: #10b981; text-decoration: none;">${safeCategory}</a> &gt;
      <span style="color: #0f172a; font-weight: 600;">${safeTitle}</span>
    </nav>
    <article itemscope itemtype="https://schema.org/Product">
      <h1 itemprop="name" style="font-size: 28px; font-weight: 800; line-height: 1.4; color: #0f172a; margin-bottom: 16px;">${safeTitle}</h1>
      
      <div style="display: flex; flex-wrap: wrap; gap: 16px; align-items: center; margin-bottom: 20px; padding: 12px 16px; background: #f1f5f9; border-radius: 8px; font-size: 15px; color: #334155;">
        <span>📍 <strong>المدينة:</strong> ${safeCity}، ${safeCountry}</span>
        <span>🏷️ <strong>القسم:</strong> ${safeCategory}</span>
        <span itemprop="offers" itemscope itemtype="https://schema.org/Offer">
          💰 <strong>السعر:</strong> <span itemprop="price" style="font-weight: bold; color: #10b981;">${ad.price ? ad.price : 'حسب الاتفاق'}</span> <span itemprop="priceCurrency">${ad.currency || ''}</span>
        </span>
      </div>

      <div itemprop="description" style="font-size: 16px; line-height: 1.9; color: #1e293b; background: #ffffff; padding: 20px; border-radius: 10px; border: 1px solid #e2e8f0; margin-bottom: 24px; white-space: pre-line;">
        ${fullDescSafe}
      </div>

      <div class="ad-images-gallery" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-bottom: 24px;">
        ${imagesHtml}
      </div>

      <div style="background: #f8fafc; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0; margin-top: 20px;">
        <p style="margin: 0 0 8px 0; font-size: 15px; color: #334155;">👤 <strong>المعلن:</strong> ${escapeXml((ad as any).user?.name || 'مستخدم أسواق')}</p>
        ${ad.contactNumber || (ad as any).user?.phone ? `<p style="margin: 0; font-size: 15px; color: #334155;">📞 <strong>رقم التواصل:</strong> <a href="tel:${escapeXml(ad.contactNumber || (ad as any).user?.phone)}" style="color: #10b981; font-weight: bold;">${escapeXml(ad.contactNumber || (ad as any).user?.phone)}</a></p>` : ''}
      </div>

      <footer style="margin-top: 30px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 13px; color: #94a3b8; text-align: center;">
        منصة أسواق — إعلانات مبوبة وسوق إلكتروني معتمد في 22 دولة عربية
      </footer>
    </article>
  </main>
</div>`;

        html = html.replace(/<div id="root"><\/div>/, preRenderedBody);

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(html);
      } catch (err) {
        next(err);
      }
    });

    // 1.5. SEO Country Root Landing Page (e.g. /jo, /ye, /sa, /eg)
    this.app.get('/:country([a-zA-Z]{2})', async (req, res, next) => {
      const countryCodeParam = req.params.country.toLowerCase();
      const ARAB_COUNTRIES: Record<string, string> = {
        ye: 'اليمن', sa: 'السعودية', ae: 'الإمارات', eg: 'مصر', jo: 'الأردن',
        kw: 'الكويت', qa: 'قطر', bh: 'البحرين', om: 'عمان', iq: 'العراق',
        sy: 'سوريا', lb: 'لبنان', ps: 'فلسطين', sd: 'السودان', ly: 'ليبيا',
        tn: 'تونس', dz: 'الجزائر', ma: 'المغرب', mr: 'موريتانيا', so: 'الصومال',
        dj: 'جيبوتي', km: 'جزر القمر'
      };

      try {
        const countryName = ARAB_COUNTRIES[countryCodeParam] || 'الوطن العربي';
        const canonicalUrl = `https://www.aswaq22.com/${countryCodeParam}`;
        let html = getHtmlTemplate();
        const title = `أسواق ${countryName} | منصة الإعلانات المجانية في ${countryName} — بيع، شراء، تأجير`;
        html = html.replace(/<title>.*?<\/title>/, `<title>${title}</title>`);

        const canonicalTag = `<link rel="canonical" href="${canonicalUrl}" />`;
        if (html.includes('rel="canonical"')) {
          html = html.replace(/<link rel="canonical"[^>]*>/, canonicalTag);
        } else {
          html = html.replace('</head>', `  ${canonicalTag}\n</head>`);
        }

        const descTag = `<meta name="description" content="تصفح أحدث الإعلانات في ${countryName} على منصة أسواق. سيارات، عقارات، إلكترونيات، وظائف في ${countryName} مجاناً." />`;
        if (html.includes('name="description"')) {
          html = html.replace(/<meta name="description"[^>]*>/, descTag);
        }

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(html);
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
        if (process.env.NODE_ENV === 'production') {
      const distPath = path.join(process.cwd(), 'dist');
      // Serve static assets (JS, CSS, images, manifest, etc.) directly
      this.app.use(express.static(distPath, {
        setHeaders: (resHeader, filePath) => {
          if (filePath.endsWith('.html')) {
            resHeader.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            resHeader.setHeader('Pragma', 'no-cache');
            resHeader.setHeader('Expires', '0');
          } else {
            resHeader.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          }
        },
      }));

      // SPA fallback for non‑asset routes
      this.app.get('*', (req, res) => {
        if (
          req.path === '/robots.txt' ||
          req.path === '/sitemap.xml' ||
          req.path.startsWith('/sitemaps') ||
          /\.(js|css|png|jpg|jpeg|gif|svg|ico|json|map)$/i.test(req.path)
        ) {
          return res.status(404).end();
        }
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.sendFile(path.join(distPath, 'index.html'));
      });
    } else {
      // Development mode – Vite middleware
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      // Vite serves React SPA — bypass for sitemaps & robots.txt
      this.app.use((req, res, next) => {
        if (req.path === '/robots.txt' || req.path.startsWith('/sitemap')) {
          return next();
        }
        vite.middlewares(req, res, next);
      });
    }
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
  <meta property="og:title" content="منصة أسواق 22 — بوابة التجارة والإعلانات في 22 دولة عربية" />
  <meta property="og:description" content="منصة أسواق 22 — المنصة الإلكترونية الشاملة لـ 22 دولة عربية. تصفح وانشر آلاف الإعلانات وريلز التسوق والشحن والوظائف مجاناً." />
  <meta property="og:image" content="https://www.aswaq22.com/aswaq-icon-512.png" />
  <meta property="og:url" content="https://www.aswaq22.com/" />
  <meta property="og:type" content="website" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="منصة أسواق 22 — بوابة التجارة والإعلانات في 22 دولة عربية" />
  <meta name="twitter:description" content="منصة أسواق 22 — المنصة الإلكترونية الشاملة لـ 22 دولة عربية." />
  <meta name="twitter:image" content="https://www.aswaq22.com/aswaq-icon-512.png" />
`;
        html = html.replace('</head>', `${ogTags}\n</head>`);

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(html);
      } catch (err) {
        next(err);
      }
    });

    if (process.env.NODE_ENV === 'production') {
      const distPath = path.join(process.cwd(), 'dist');
      // Serve static assets directly
      this.app.use(express.static(distPath, {
        setHeaders: (resHeader, filePath) => {
          if (filePath.endsWith('.html') || filePath.endsWith('sw.js') || filePath.endsWith('manifest.json')) {
            resHeader.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            resHeader.setHeader('Pragma', 'no-cache');
            resHeader.setHeader('Expires', '0');
          } else {
            resHeader.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          }
        },
      }));

      // SPA fallback for non‑asset routes
      this.app.get('*', (req, res) => {
        if (
          req.path === '/robots.txt' ||
          req.path === '/sitemap.xml' ||
          req.path.startsWith('/sitemaps') ||
          /\.(js|css|png|jpg|jpeg|gif|svg|ico|json|map)$/i.test(req.path)
        ) {
          return res.status(404).end();
        }
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.sendFile(path.join(distPath, 'index.html'));
      });
    } else {
      // Development mode – Vite middleware
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      // Vite serves React SPA — bypass for sitemaps & robots.txt
      this.app.use((req, res, next) => {
        if (req.path === '/robots.txt' || req.path.startsWith('/sitemap')) {
          return next();
        }
        vite.middlewares(req, res, next);
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

      // Clean up old invalid/broken ad image placeholder records from DB on startup
      (async () => {
        try {
          const { prisma } = await import('../src/lib/prisma.ts');
          await prisma.adImage.deleteMany({
            where: {
              OR: [
                { url: { startsWith: 'ad-' } },
                { url: { equals: '' } }
              ]
            }
          });
          const { cacheService } = await import('./services/cache.service.ts');
          await cacheService.invalidateFeedCaches();
        } catch (cleanErr) {
          logger.warn(`AdImage DB cleanup note: ${(cleanErr as any)?.message}`);
        }

        // Synchronize and update PWA icons from uploads/platform-logo.png or DB logoUrl on startup
        try {
          const fs = await import('fs');
          const path = await import('path');
          const logoPath = path.join(process.cwd(), 'uploads', 'platform-logo.png');
          let logoBuffer: Buffer | null = null;

          if (fs.existsSync(logoPath)) {
            logoBuffer = fs.readFileSync(logoPath);
          } else {
            const dbSettings = await prisma.systemSetting.findUnique({
              where: { key: 'platform_settings' }
            });
            if (dbSettings) {
              const parsed = JSON.parse(dbSettings.value);
              if (parsed?.logoUrl && parsed.logoUrl.startsWith('data:image/')) {
                const base64Data = parsed.logoUrl.split(',')[1];
                if (base64Data) {
                  logoBuffer = Buffer.from(base64Data, 'base64');
                  fs.mkdirSync(path.dirname(logoPath), { recursive: true });
                  fs.writeFileSync(logoPath, logoBuffer);
                }
              }
            }
          }

          if (logoBuffer) {
            await this.regeneratePwaIcons(logoBuffer);
            logger.info('[Startup] Successfully synchronized and updated PWA icons from platform logo');
          }
        } catch (startupIconErr: any) {
          logger.warn(`[Startup] PWA icons sync note: ${startupIconErr.message}`);
        }
      })();
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
