import { Queue, Worker, Job } from 'bullmq';
import { prisma } from './prisma.ts';
import * as path from 'path';
import * as fs from 'fs';

let connectionOpts: any;

if (process.env.REDIS_URL) {
  connectionOpts = {
    url: process.env.REDIS_URL,
    enableOfflineQueue: false,
    maxRetriesPerRequest: null,
  };
} else {
  const redisHost = process.env.REDIS_HOST || 'localhost';
  const redisPort = parseInt(process.env.REDIS_PORT || '6379');
  const redisPassword = process.env.REDIS_PASSWORD || undefined;

  connectionOpts = {
    host: redisHost,
    port: redisPort,
    password: redisPassword,
    enableOfflineQueue: false,
    maxRetriesPerRequest: null,
  };
}

let imageQueue: Queue | null = null;
let notificationQueue: Queue | null = null;
let dispatchQueue: Queue | null = null;
let imageWorker: Worker | null = null;
let notificationWorker: Worker | null = null;
let dispatchWorker: Worker | null = null;
let isQueueSystemAvailable = false;

// Test Redis connectivity once before creating workers
async function initQueues() {
  const { default: Redis } = await import('ioredis');
  const testClient = process.env.REDIS_URL
    ? new Redis(process.env.REDIS_URL, { lazyConnect: true, enableOfflineQueue: false })
    : new Redis({ ...connectionOpts, lazyConnect: true });
  testClient.on('error', (err) => {
    // Silently catch connection/DNS errors to prevent unhandled rejection crashes when Redis is down
  });
  
  try {
    await testClient.connect();
    await testClient.ping();
    await testClient.quit();
    // Redis is available – set up full queue system
    console.log('[Queue] ✅ Redis available. Initializing BullMQ queues...');
    imageQueue = new Queue('image-processing', { connection: connectionOpts });
    notificationQueue = new Queue('notifications', { connection: connectionOpts });
    dispatchQueue = new Queue('shipping-dispatch', { connection: connectionOpts });
    isQueueSystemAvailable = true;

    imageQueue.on('error', (err) => console.error('[Queue] Image queue error:', err.message));
    notificationQueue.on('error', (err) => console.error('[Queue] Notification queue error:', err.message));
    dispatchQueue.on('error', (err) => console.error('[Queue] Dispatch queue error:', err.message));

    imageWorker = new Worker('image-processing', async (job: Job) => {
      const { imageId, imageUrl } = job.data;
      await prisma.adImage.update({
        where: { id: imageId },
        data: { width: 800, height: 600, blurHash: 'LEHV6nWB2yk8pyo0adRgCQcDx[y?', url: imageUrl },
      });
    }, { connection: connectionOpts });

    notificationWorker = new Worker('notifications', async (job: Job) => {
      const { userId, title, body } = job.data;
      await prisma.notification.create({ data: { userId, title, description: body, type: 'chat' } });
    }, { connection: connectionOpts });

    dispatchWorker = new Worker('shipping-dispatch', async (job: Job) => {
      const { shipmentId, attempt } = job.data;
      const { DispatchEngine } = await import('../../server/lib/shipping/dispatchEngine.ts');
      await DispatchEngine.broadcastShipmentOffer(shipmentId, attempt);
    }, { connection: connectionOpts });

    imageWorker.on('error', (err) => console.error('[Queue] Image worker error:', err.message));
    notificationWorker.on('error', (err) => console.error('[Queue] Notification worker error:', err.message));
    dispatchWorker.on('error', (err) => console.error('[Queue] Dispatch worker error:', err.message));

  } catch {
    isQueueSystemAvailable = false;
    console.warn('[Queue] ⚠️  Redis not available. BullMQ disabled. Running in synchronous fallback mode.');
    testClient.disconnect();
  }
}

async function closeQueues() {
  if (imageWorker) {
    await imageWorker.close();
    imageWorker = null;
  }
  if (notificationWorker) {
    await notificationWorker.close();
    notificationWorker = null;
  }
  if (dispatchWorker) {
    await dispatchWorker.close();
    dispatchWorker = null;
  }
  if (imageQueue) {
    await imageQueue.close();
    imageQueue = null;
  }
  if (notificationQueue) {
    await notificationQueue.close();
    notificationQueue = null;
  }
  if (dispatchQueue) {
    await dispatchQueue.close();
    dispatchQueue = null;
  }
  isQueueSystemAvailable = false;
}

// Initialize in background – don't block server startup
initQueues().catch(() => {
  isQueueSystemAvailable = false;
});

export const queues = {
  async addImageJob(data: { imageId: string; imageUrl: string; outputPath: string }): Promise<void> {
    if (!isQueueSystemAvailable || !imageQueue) {
      // Fallback: update DB synchronously with mock values immediately
      console.log(`[Queue Fallback] Redis offline. Synchronously processing image: ${data.imageId}`);
      try {
        await prisma.adImage.update({
          where: { id: data.imageId },
          data: {
            width: 800,
            height: 600,
            blurHash: 'LEHV6nWB2yk8pyo0adRgCQcDx[y?',
            url: data.imageUrl,
          },
        });
      } catch (err) {
        console.error('[Queue Fallback] Image update failed:', err);
      }
      return;
    }

    try {
      await imageQueue.add('resize', data, { removeOnComplete: true });
    } catch (e) {
      console.error('[Queue] Failed to enqueue image processing job:', e);
    }
  },

  async addNotificationJob(data: { userId: string; title: string; body: string }): Promise<void> {
    if (!isQueueSystemAvailable || !notificationQueue) {
      // Fallback: insert directly into Database synchronously
      try {
        await prisma.notification.create({
          data: {
            userId: data.userId,
            title: data.title,
            description: data.body,
            type: 'chat',
          },
        });
      } catch (err) {
        console.error('[Queue Fallback] Notification creation failed:', err);
      }
      return;
    }

    try {
      await notificationQueue.add('push', data, { removeOnComplete: true });
    } catch (e) {
      console.error('[Queue] Failed to enqueue notification job:', e);
    }
  },

  async addDispatchJob(data: { shipmentId: string; attempt: number }, delayMs: number): Promise<void> {
    if (!isQueueSystemAvailable || !dispatchQueue) {
      // Fallback: run directly after setTimeout to simulate async processing when Redis is offline
      setTimeout(async () => {
        try {
          const { DispatchEngine } = await import('../../server/lib/shipping/dispatchEngine.ts');
          await DispatchEngine.broadcastShipmentOffer(data.shipmentId, data.attempt);
        } catch (err) {
          console.error('[Queue Fallback] Dispatch offer broadcast failed:', err);
        }
      }, delayMs);
      return;
    }

    try {
      await dispatchQueue.add('dispatch-expand', data, { delay: delayMs, removeOnComplete: true });
    } catch (e) {
      console.error('[Queue] Failed to enqueue dispatch job:', e);
    }
  },

  async close(): Promise<void> {
    await closeQueues();
  }
};
