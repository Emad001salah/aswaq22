/**
 * server/workers/search-indexer.worker.ts
 *
 * BullMQ Worker for Search-on-Write indexing to Meilisearch
 *
 * Ensures ad indexing happens asynchronously without slowing down ad creation responses.
 */

import { Worker, Job } from 'bullmq';
import { searchEngine } from '../../src/lib/meilisearch.ts';
import { logger } from '../lib/logger.ts';

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
};

export interface SearchIndexJobData {
  adId: string;
  title: string;
  description: string;
  city: string;
  price?: number;
  categoryId: string;
  status: string;
  action: 'INDEX' | 'DELETE';
}

let searchWorker: Worker | null = null;

export function startSearchWorker() {
  if (process.env.NODE_ENV === 'test') return;

  try {
    searchWorker = new Worker<SearchIndexJobData>(
      'search-indexing-queue',
      async (job: Job<SearchIndexJobData>) => {
        const { adId, title, description, city, price = 0, categoryId, status, action } = job.data;

        if (action === 'DELETE') {
          if (searchEngine.isAvailable()) {
            await searchEngine.deleteAd(adId);
            logger.info({ message: `[SearchWorker] Deleted ad ${adId} from Meilisearch.` });
          }
          return;
        }

        if (searchEngine.isAvailable()) {
          await searchEngine.indexAd({
            id: adId,
            title,
            description,
            city,
            price,
            category: categoryId,
            status,
          });
          logger.info({ message: `[SearchWorker] Indexed ad ${adId} in Meilisearch.` });
        }
      },
      { connection, concurrency: 5 }
    );

    searchWorker.on('failed', (job, err) => {
      logger.error({ message: `[SearchWorker] Job ${job?.id} failed: ${err.message}` });
    });
  } catch (err: any) {
    logger.warn({ message: `[SearchWorker] Failed to start worker: ${err.message}` });
  }
}

export async function stopSearchWorker() {
  if (searchWorker) {
    await searchWorker.close();
  }
}
