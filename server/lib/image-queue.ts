import { Queue, Worker, Job } from 'bullmq';
import { redis } from '../../src/lib/redis.ts';
import { logger } from './logger.ts';
import { processAdImageJob } from '../workers/image-resize.worker.ts';

export interface AdImageJobData {
  adImageId: string;
  objectKey: string;
  userId: string;
}

const QUEUE_NAME = 'ad-image-processing';

// Redis connection options for BullMQ
const connection = redis ? (redis as any).options : { host: '127.0.0.1', port: 6379 };

export let imageQueue: Queue<AdImageJobData> | null = null;
export let imageWorker: Worker<AdImageJobData> | null = null;

if (process.env.NODE_ENV !== 'test') {
  try {
    imageQueue = new Queue<AdImageJobData>(QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    });

    imageWorker = new Worker<AdImageJobData>(
      QUEUE_NAME,
      async (job: Job<AdImageJobData>) => {
        logger.info(`[ImageWorker] Processing job ${job.id} for adImageId: ${job.data.adImageId}`);
        await processAdImageJob(job.data);
      },
      { connection, concurrency: 4 }
    );

    imageWorker.on('completed', (job) => {
      logger.info(`[ImageWorker] Job ${job.id} completed successfully`);
    });

    imageWorker.on('failed', (job, err) => {
      logger.error(`[ImageWorker] Job ${job?.id} failed with error: ${err.message}`);
    });

    logger.info('[ImageWorker] BullMQ queue and worker initialized.');
  } catch (err: any) {
    logger.warn(`[ImageWorker] Failed to initialize BullMQ worker: ${err.message}`);
  }
}

/**
 * Enqueue an ad image for processing. If BullMQ is unavailable, runs inline asynchronously.
 */
export async function enqueueAdImageJob(data: AdImageJobData): Promise<void> {
  if (imageQueue) {
    try {
      await imageQueue.add('resize-image', data);
      return;
    } catch (err: any) {
      logger.warn(`[ImageWorker] Enqueue failed: ${err.message}. Executing job inline.`);
    }
  }

  // In production, forbid inline processing to protect API event-loop & memory limits
  if (process.env.NODE_ENV === 'production') {
    logger.error(`[ImageWorker] CRITICAL: Redis BullMQ queue unavailable in production for job ${data.adImageId}. Image processing queued for worker when Redis recovers.`);
    return;
  }

  // Fallback for development/testing environments: execute inline asynchronously
  setImmediate(async () => {
    try {
      await processAdImageJob(data);
    } catch (err: any) {
      logger.error(`[ImageWorker] Inline image processing failed for ${data.adImageId}: ${err.message}`);
    }
  });
}
