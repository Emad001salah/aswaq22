/**
 * src/lib/redis.ts
 *
 * Redis Client with Graceful Degradation
 *
 * SECURITY HARDENING (2026-07-22):
 * [RATELIMIT-001] Fixed critical issue where isRateLimited() returned `false`
 * (allow all) when Redis was unavailable.
 * An attacker could trigger Redis downtime (e.g. memory exhaustion) and then
 * brute-force auth endpoints with no rate limiting.
 *
 * New behaviour:
 *  - isRateLimited() uses an in-memory LRU Map as fallback when Redis is down.
 *  - The in-memory fallback is intentionally conservative (lower limits).
 *  - This means rate limiting is ALWAYS active regardless of Redis status.
 *  - Tradeoff: in multi-instance deployments, each instance has its own in-memory
 *    counter. The real fix is a Redis HA setup, but this prevents the total bypass.
 *
 * Key namespacing:
 * [NAMESPACE-001] All keys are prefixed with env:service to prevent collision
 * between development and production if they share a Redis instance.
 */

import Redis from 'ioredis';

const ENV_PREFIX = `${process.env.NODE_ENV || 'dev'}:aswaq`;

let redisClient: Redis | null = null;
let isRedisAvailable = false;

const redisUrl      = process.env.REDIS_URL;
const redisHost     = process.env.REDIS_HOST || 'localhost';
const redisPort     = parseInt(process.env.REDIS_PORT || '6379');
const redisPassword = process.env.REDIS_PASSWORD || undefined;

try {
  if (redisUrl) {
    console.log(`[Redis] Connecting via REDIS_URL...`);
    redisClient = new Redis(redisUrl, {
      lazyConnect:          true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue:   false,
      retryStrategy:        () => null,
    });
  } else {
    console.log(`[Redis] Connecting to ${redisHost}:${redisPort}...`);
    redisClient = new Redis({
      host:                 redisHost,
      port:                 redisPort,
      password:             redisPassword,
      lazyConnect:          true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue:   false,
      retryStrategy:        () => null,
    });
  }

  let _warnedOnce = false;
  redisClient.on('connect', () => {
    isRedisAvailable = true;
    _warnedOnce      = false;
    console.log('\x1b[32m[Redis] ✅ Connection established successfully.\x1b[0m');
  });

  redisClient.on('error', () => {
    isRedisAvailable = false;
    if (!_warnedOnce) {
      _warnedOnce = true;
      console.warn('\x1b[33m[Redis] ⚠️  Redis not available. Running in database-only mode (caching disabled). Rate limiting uses in-memory fallback.\x1b[0m');
    }
  });

  redisClient.connect().catch(() => {
    isRedisAvailable = false;
  });
} catch (e) {
  console.warn('[Redis] Failed to instantiate ioredis:', e);
}

// ── In-memory fallback for rate limiting ─────────────────────────────────────
// [RATELIMIT-001] Used when Redis is unavailable.
// Structure: key → { count, expiresAt }
const _inMemoryRateLimiter = new Map<string, { count: number; expiresAt: number }>();

/**
 * Enforces rate limiting using the in-memory map.
 * Intentionally uses stricter limits than the Redis version since it doesn't
 * persist across restarts and isn't shared between instances.
 *
 * Conservative limit factor: 0.5 (half the Redis limit for safety).
 */
function inMemoryRateLimit(key: string, limit: number, windowSeconds: number): boolean {
  const now    = Date.now();
  const namespaced = `${ENV_PREFIX}:${key}`;
  const entry  = _inMemoryRateLimiter.get(namespaced);

  // Purge expired entry
  if (entry && entry.expiresAt < now) {
    _inMemoryRateLimiter.delete(namespaced);
  }

  const current = _inMemoryRateLimiter.get(namespaced);
  if (!current) {
    _inMemoryRateLimiter.set(namespaced, { count: 1, expiresAt: now + windowSeconds * 1000 });
    return false; // not rate limited
  }

  current.count++;
  // Use half the limit as a conservative in-memory threshold
  const conservativeLimit = Math.max(1, Math.floor(limit * 0.5));
  return current.count > conservativeLimit;
}

// Periodically clean expired in-memory rate limit entries (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of _inMemoryRateLimiter.entries()) {
    if (entry.expiresAt < now) _inMemoryRateLimiter.delete(key);
  }
}, 5 * 60 * 1000);


// ── Public Redis facade ────────────────────────────────────────────────────────
export const redis = {
  getClient(): Redis | null {
    return isRedisAvailable ? redisClient : null;
  },

  async quit(): Promise<void> {
    if (redisClient) {
      try { await redisClient.quit(); } catch (_) {}
    }
  },

  /**
   * Get a cached value.
   * Returns null on cache miss, Redis unavailability, or timeout.
   */
  async get(key: string): Promise<string | null> {
    if (!isRedisAvailable || !redisClient) return null;
    try {
      const namespacedKey  = `${ENV_PREFIX}:${key}`;
      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 500));
      return await Promise.race([redisClient.get(namespacedKey), timeoutPromise]);
    } catch (_) {
      return null;
    }
  },

  /**
   * Set a cached value with optional TTL.
   * [NAMESPACE-001] Automatically prefixes key with env:service.
   */
  async set(key: string, value: string, ttlSeconds?: number): Promise<string | null> {
    if (!isRedisAvailable || !redisClient) return null;
    try {
      const namespacedKey  = `${ENV_PREFIX}:${key}`;
      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 500));
      const setPromise     = ttlSeconds
        ? redisClient.set(namespacedKey, value, 'EX', ttlSeconds)
        : redisClient.set(namespacedKey, value);
      return await Promise.race([setPromise, timeoutPromise]);
    } catch (_) {
      return null;
    }
  },

  /**
   * Delete a cache key.
   */
  async del(key: string): Promise<number> {
    if (!isRedisAvailable || !redisClient) return 0;
    try {
      const namespacedKey  = `${ENV_PREFIX}:${key}`;
      const timeoutPromise = new Promise<number>((resolve) => setTimeout(() => resolve(0), 500));
      return await Promise.race([redisClient.del(namespacedKey), timeoutPromise]);
    } catch (_) {
      return 0;
    }
  },

  /**
   * [RATELIMIT-001] Rate limit check — ALWAYS active.
   *
   * When Redis is available: uses Redis INCR + EXPIRE (shared across instances).
   * When Redis is down:      uses in-memory LRU map (per-instance, conservative limits).
   *
   * PREVIOUSLY: returned `false` (allow all) when Redis was unavailable.
   * This meant that any Redis outage disabled ALL rate limiting, enabling brute-force.
   */
  async isRateLimited(ip: string, limit: number, windowSeconds: number): Promise<boolean> {
    const key = `ratelimit:${ip}`;

    // Redis path: shared, accurate across all instances
    if (isRedisAvailable && redisClient) {
      try {
        const namespacedKey  = `${ENV_PREFIX}:${key}`;
        const timeoutPromise = new Promise<number>((resolve) => setTimeout(() => resolve(0), 500));
        const incrPromise    = redisClient.incr(namespacedKey);
        const requests       = await Promise.race([incrPromise, timeoutPromise]);
        if (requests === 0) {
          // Timeout — fall through to in-memory
        } else {
          if (requests === 1) {
            await redisClient.expire(namespacedKey, windowSeconds);
          }
          return requests > limit;
        }
      } catch (_) {
        // Redis error — fall through to in-memory fallback
      }
    }

    // In-memory fallback — [RATELIMIT-001] NEVER returns false unconditionally
    return inMemoryRateLimit(key, limit, windowSeconds);
  },
};
