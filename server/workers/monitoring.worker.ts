import { prisma } from '../../src/lib/prisma.ts';
import { storageService } from '../services/storage.service.ts';
import { logger } from '../lib/logger.ts';

export async function runMediaHealthCheck(): Promise<void> {
  logger.info('[MonitoringWorker] Starting media integrity health checks...');
  try {
    const totalVariants = await prisma.mediaVariant.count({ where: { status: 'READY' } });
    if (totalVariants === 0) {
      logger.info('[MonitoringWorker] No active media files found to check.');
      return;
    }

    const skip = Math.max(0, Math.floor(Math.random() * (totalVariants - 50)));
    const variants = await prisma.mediaVariant.findMany({
      where: { status: 'READY' },
      skip: skip,
      take: 50
    });

    let brokenCount = 0;
    for (const v of variants) {
      if (!v.objectKey) continue;
      const exists = await storageService.headObject(v.objectKey);
      if (!exists) {
        brokenCount++;
        logger.error(`[MonitoringWorker] Broken media reference detected: ${v.objectKey} (MediaID: ${v.mediaId})`);
      }
    }

    if (brokenCount > 0) {
      logger.error(`[MonitoringWorker] Media health check completed with warning: ${brokenCount} broken link(s) found!`);
    } else {
      logger.info('[MonitoringWorker] Media health check passed: All checked files exist in storage.');
    }
  } catch (err: any) {
    logger.error(`[MonitoringWorker] Health check error: ${err.message}`);
  }
}
