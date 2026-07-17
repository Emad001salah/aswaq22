import Redis from 'ioredis';

let redisClient: Redis | null = null;
let isRedisAvailable = false;

const redisUrl = process.env.REDIS_URL;
const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = parseInt(process.env.REDIS_PORT || '6379');
const redisPassword = process.env.REDIS_PASSWORD || undefined;

try {
  if (redisUrl) {
    console.log(`[Redis] Connecting via REDIS_URL...`);
    redisClient = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy: () => null,
    });
  } else {
    console.log(`[Redis] Connecting to ${redisHost}:${redisPort}...`);
    redisClient = new Redis({
      host: redisHost,
      port: redisPort,
      password: redisPassword,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy: () => null,
    });
  }

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
      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 500));
      return await Promise.race([redisClient.get(key), timeoutPromise]);
    } catch (e) {
      return null;
    }
  },

  async set(key: string, value: string, ttlSeconds?: number): Promise<string | null> {
    if (!isRedisAvailable || !redisClient) return null;
    try {
      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 500));
      const setPromise = ttlSeconds 
        ? redisClient.set(key, value, 'EX', ttlSeconds) 
        : redisClient.set(key, value);
      return await Promise.race([setPromise, timeoutPromise]);
    } catch (e) {
      return null;
    }
  },

  async del(key: string): Promise<number> {
    if (!isRedisAvailable || !redisClient) return 0;
    try {
      const timeoutPromise = new Promise<number>((resolve) => setTimeout(() => resolve(0), 500));
      return await Promise.race([redisClient.del(key), timeoutPromise]);
    } catch (e) {
      return 0;
    }
  },

  async isRateLimited(ip: string, limit: number, windowSeconds: number): Promise<boolean> {
    if (!isRedisAvailable || !redisClient) return false;
    try {
      const key = `ratelimit:${ip}`;
      const timeoutPromise = new Promise<number>((resolve) => setTimeout(() => resolve(0), 500));
      const incrPromise = redisClient.incr(key);
      const requests = await Promise.race([incrPromise, timeoutPromise]);
      if (requests === 0) return false;
      if (requests === 1) {
        await redisClient.expire(key, windowSeconds);
      }
      return requests > limit;
    } catch (e) {
      return false;
    }
  }
};
