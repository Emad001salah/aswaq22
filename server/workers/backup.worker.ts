import { prisma } from '../../src/lib/prisma.ts';
import { storageService } from '../services/storage.service.ts';
import { logger } from '../lib/logger.ts';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

export async function runDailyBackup(): Promise<void> {
  const accessKeyId = process.env.BACKUP_S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.BACKUP_S3_SECRET_ACCESS_KEY;
  const backupBucket = process.env.BACKUP_S3_BUCKET || 'aswaq-backup';

  if (!accessKeyId || !secretAccessKey) {
    logger.warn('[BackupWorker] Backup credentials missing in environment variables. Skipping daily backup.');
    return;
  }

  logger.info('[BackupWorker] Starting daily sync backup operation...');
  try {
    const backupClient = new S3Client({
      endpoint: process.env.BACKUP_S3_ENDPOINT || 'https://s3.us-east-1.amazonaws.com',
      region: process.env.BACKUP_S3_REGION || 'us-east-1',
      credentials: { accessKeyId, secretAccessKey }
    });

    const variants = await prisma.mediaVariant.findMany({
      where: { status: 'READY' }
    });

    logger.info(`[BackupWorker] Found ${variants.length} media variants to backup.`);
    let successCount = 0;

    for (const v of variants) {
      if (!v.objectKey) continue;
      try {
        const buffer = await storageService.getFileBuffer(v.objectKey);
        await backupClient.send(new PutObjectCommand({
          Bucket: backupBucket,
          Key: v.objectKey,
          Body: buffer
        }));
        successCount++;
      } catch (err: any) {
        logger.error(`[BackupWorker] Failed backing up key ${v.objectKey}: ${err.message}`);
      }
    }
    logger.info(`[BackupWorker] Backup completed. Success: ${successCount}/${variants.length}`);
  } catch (err: any) {
    logger.error(`[BackupWorker] Backup process failed: ${err.message}`);
  }
}
