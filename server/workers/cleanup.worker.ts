import { prisma } from '../../src/lib/prisma.ts';
import { storageService } from '../services/storage.service.ts';
import { logger } from '../lib/logger.ts';

/**
 * Clean up expired pending uploads and orphaned images.
 * Runs periodically (e.g., hourly).
 */
export async function cleanupExpiredPendingUploads(): Promise<{ deletedCount: number }> {
  const now = new Date();
  logger.info('[CleanupWorker] Starting expired pending uploads cleanup...');

  try {
    const expiredRecords = await prisma.pendingUpload.findMany({
      where: {
        expiresAt: { lt: now },
        status: 'pending',
      },
      take: 100,
    });

    let deletedCount = 0;
    for (const record of expiredRecords) {
      try {
        await storageService.deleteFileByKey(record.objectKey).catch(() => {});
        await prisma.pendingUpload.delete({ where: { id: record.id } });
        deletedCount++;
        logger.info(`[CleanupWorker] Deleted expired pending upload: ${record.objectKey}`);
      } catch (err: any) {
        logger.warn(`[CleanupWorker] Failed deleting record ${record.id}: ${err.message}`);
      }
    }

    logger.info(`[CleanupWorker] Finished cleanup. Total deleted: ${deletedCount}`);
    return { deletedCount };
  } catch (err: any) {
    logger.error(`[CleanupWorker] Error during pending upload cleanup: ${err.message}`);
    return { deletedCount: 0 };
  }
}
