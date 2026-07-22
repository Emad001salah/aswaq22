/**
 * server/services/cache.service.ts
 *
 * Professional Redis Cache Management Service
 *
 * Provides safe, non-blocking cache invalidation using SCAN instead of KEYS.
 */

import { redis } from '../../src/lib/redis.ts';
import { logger } from '../lib/logger.ts';

export class CacheService {
  /**
   * Safely invalidates cache keys matching a pattern using non-blocking SCAN.
   */
  async invalidatePattern(pattern: string): Promise<void> {
    const client = redis.getClient();
    if (!client) return;

    try {
      let cursor = '0';
      const keysToDelete: string[] = [];

      do {
        const [nextCursor, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = nextCursor;
        if (keys.length > 0) {
          keysToDelete.push(...keys);
        }
      } while (cursor !== '0');

      if (keysToDelete.length > 0) {
        // Delete in batches to avoid blocking
        const batchSize = 100;
        for (let i = 0; i < keysToDelete.length; i += batchSize) {
          const batch = keysToDelete.slice(i, i + batchSize);
          await client.del(...batch);
        }
        logger.info({ message: `[CacheService] Invalidated ${keysToDelete.length} keys matching pattern: ${pattern}` });
      }
    } catch (err: any) {
      logger.warn({ message: `[CacheService] Error during cache invalidation: ${err.message}` });
    }
  }

  /**
   * Invalidates all listing feed caches (e.g. on ad creation/update/deletion)
   */
  async invalidateFeedCaches(): Promise<void> {
    await this.invalidatePattern('*ads:latest:*');
  }
}

export const cacheService = new CacheService();
