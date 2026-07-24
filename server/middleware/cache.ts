/**
 * server/middleware/cache.ts
 * 
 * Reusable HTTP Cache Middleware for Aswaq Platform
 * 
 * Adds:
 * - Redis-backed response caching for GET endpoints
 * - HTTP ETag support to allow 304 Not Modified responses
 * - Cache-Control headers for browser/CDN caching
 */

import { Request, Response, NextFunction } from 'express';
import { redis } from '../../src/lib/redis.ts';

// ── HTTP Cache-Control headers ────────────────────────────────────────────────

/** Apply Cache-Control: public, max-age=<seconds> for fully public, cacheable responses */
export function httpCache(seconds: number) {
  return (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', `public, max-age=${seconds}, stale-while-revalidate=${seconds * 2}`);
    next();
  };
}

/** Disable cache on all authenticated or sensitive endpoints */
export function noCache() {
  return (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  };
}

// ── Redis Response Cache Middleware ───────────────────────────────────────────

/** 
 * Redis cache middleware for GET endpoints.
 * Caches the full JSON response in Redis for `ttlSeconds`.
 * Returns 304 Not Modified if ETag matches.
 */
export function redisCache(ttlSeconds: number, keyPrefix: string = '') {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET') return next();

    const cacheKey = `${keyPrefix}:${req.originalUrl || req.url}`;

    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        // Simple ETag: md5-like hash of the cache key + content length
        const etag = `"${Buffer.from(cacheKey).toString('base64').substring(0, 16)}-${cached.length}"`;
        
        if (req.headers['if-none-match'] === etag) {
          return res.status(304).end();
        }

        res.setHeader('ETag', etag);
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('Cache-Control', `public, max-age=${Math.floor(ttlSeconds / 2)}`);
        return res.json(JSON.parse(cached));
      }
    } catch (_err) {
      // Redis miss — proceed to handler
    }

    // Intercept res.json to save to Redis
    const originalJson = res.json.bind(res);
    res.json = (body: any) => {
      if (res.statusCode === 200 && body) {
        const payload = JSON.stringify(body);
        redis.set(cacheKey, payload, ttlSeconds).catch(() => null);

        const etag = `"${Buffer.from(cacheKey).toString('base64').substring(0, 16)}-${payload.length}"`;
        res.setHeader('ETag', etag);
        res.setHeader('X-Cache', 'MISS');
      }
      return originalJson(body);
    };

    next();
  };
}

// ── Cache Invalidation Helpers ────────────────────────────────────────────────

/** Invalidate all Redis keys matching a pattern prefix (e.g. after a write) */
export async function invalidateCacheByPrefix(prefix: string): Promise<void> {
  try {
    // Use SCAN instead of KEYS for production safety
    let cursor = '0';
    do {
      const [nextCursor, keys] = await (redis as any).scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 100);
      cursor = nextCursor;
      if (keys.length > 0) {
        await (redis as any).del(...keys);
      }
    } while (cursor !== '0');
  } catch (_err) {
    // Non-critical: cache invalidation failure doesn't block writes
  }
}
