import Redis from 'ioredis';

let redisClient: Redis | null = null;
let isRedisAvailable = false;

const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = parseInt(process.env.REDIS_PORT || '6379');
const redisPassword = process.env.REDIS_PASSWORD || undefined;

try {
  console.log(`[Redis] Connecting to ${redisHost}:${redisPort}...`);
  redisClient = new Redis({
    host: redisHost,
    port: redisPort,
    password: redisPassword,
    lazyConnect: true,        // Don't block event loop on start
    maxRetriesPerRequest: 1,  // Fail fast if unreachable
    enableOfflineQueue: false, // Don't queue commands when down
    retryStrategy: () => null, // Disable auto-retry — we run in DB-only mode
  });

  let _warnedOnce = false;
  redisClient.on('connect', () => {
    isRedisAvailable = true;
    _warnedOnce = false;
    console.log('\x1b[32m[Redis] ✅ Connection established successfully.\x1b[0m');
  });

  redisClient.on('error', () => {
    isRedisAvailable = false;
    if (!_warnedOnce) {
      _warnedOnce = true;
      console.warn('\x1b[33m[Redis] ⚠️  Redis not available. Running in database-only mode (caching disabled).\x1b[0m');
    }
  });

  // Attempt async connection in background
  redisClient.connect().catch(() => {
    isRedisAvailable = false;
  });
} catch (e) {
  console.warn('[Redis] Failed to instantiate ioredis:', e);
}

export const redis = {
  getClient(): Redis | null {
    return isRedisAvailable ? redisClient : null;
  },

  async quit(): Promise<void> {
    if (redisClient) {
      try {
        await redisClient.quit();
      } catch (e) {
        // Ignore
      }
    }
  },


  async get(key: string): Promise<string | null> {
    if (!isRedisAvailable || !redisClient) return null;
    try {
      return await redisClient.get(key);
    } catch (e) {
      return null;
    }
  },

  async set(key: string, value: string, ttlSeconds?: number): Promise<string | null> {
    if (!isRedisAvailable || !redisClient) return null;
    try {
      if (ttlSeconds) {
        return await redisClient.set(key, value, 'EX', ttlSeconds);
      }
      return await redisClient.set(key, value);
    } catch (e) {
      return null;
    }
  },

  async del(key: string): Promise<number> {
    if (!isRedisAvailable || !redisClient) return 0;
    try {
      return await redisClient.del(key);
    } catch (e) {
      return 0;
    }
  },

  async isRateLimited(ip: string, limit: number, windowSeconds: number): Promise<boolean> {
    if (!isRedisAvailable || !redisClient) return false; // Fail open if Redis is down
    try {
      const key = `ratelimit:${ip}`;
      const requests = await redisClient.incr(key);
      if (requests === 1) {
        await redisClient.expire(key, windowSeconds);
      }
      return requests > limit;
    } catch (e) {
      return false; // Fail open
    }
  }
};
