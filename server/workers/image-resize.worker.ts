import sharp from 'sharp';
import path from 'path';
import { storageService } from '../services/storage.service.ts';
import { prisma } from '../../src/lib/prisma.ts';
import { logger } from '../lib/logger.ts';
import { ALLOWED_IMAGE_MIMES, IMAGE_VARIANTS } from '../../shared/constants.ts';
import { AdImageJobData } from '../lib/image-queue.ts';

function formatToMime(format?: string): string {
  if (!format) return 'image/jpeg';
  const f = format.toLowerCase();
  if (f === 'jpeg' || f === 'jpg') return 'image/jpeg';
  if (f === 'png') return 'image/png';
  if (f === 'webp') return 'image/webp';
  if (f === 'avif') return 'image/avif';
  if (f === 'heif') return 'image/heif';
  return `image/${f}`;
}

export async function processAdImageJob(data: AdImageJobData): Promise<void> {
  const { adImageId, objectKey, userId } = data;
  logger.info(`[ImageProcessor] Starting image processing for adImageId: ${adImageId}, key: ${objectKey}`);

  // 1. Update status to 'processing'
  await prisma.adImage.update({
    where: { id: adImageId },
    data: { status: 'processing' },
  }).catch((err) => {
    logger.warn(`[ImageProcessor] Could not update adImage ${adImageId} status to processing: ${err.message}`);
  });

  try {
    // 2. Fetch original file buffer from storage (R2/S3 or local)
    const rawBuffer = await storageService.getFileBuffer(objectKey);

    // 3. Inspect metadata with Sharp to verify magic bytes / real format
    const imagePipeline = sharp(rawBuffer);
    const metadata = await imagePipeline.metadata();

    const realMime = formatToMime(metadata.format);
    if (!ALLOWED_IMAGE_MIMES.has(realMime)) {
      logger.error(`[ImageProcessor] Invalid image format detected (${realMime}) for adImage ${adImageId}`);
      await storageService.deleteFileByKey(objectKey).catch(() => {});
      await prisma.adImage.update({
        where: { id: adImageId },
        data: { status: 'failed' },
      });
      await prisma.pendingUpload.deleteMany({ where: { objectKey } });
      return;
    }

    // Extract base UUID from objectKey (e.g., uploads/ads/userId/UUID.orig.jpg -> UUID)
    const parsedPath = path.parse(objectKey);
    const baseNameWithoutOrig = parsedPath.name.replace(/\.orig$/, '');
    const keyPrefix = `uploads/ads/${userId}/${baseNameWithoutOrig}`;

    const thumbKey = `${keyPrefix}.thumb.avif`;
    const cardKey = `${keyPrefix}.card.avif`;
    const detailKey = `${keyPrefix}.detail.webp`;

    // 4. Generate 3 image variants in parallel
    let thumbBuf: Buffer;
    let cardBuf: Buffer;
    let detailBuf: Buffer;

    try {
      [thumbBuf, cardBuf, detailBuf] = await Promise.all([
        sharp(rawBuffer)
          .resize(IMAGE_VARIANTS.thumb.width, IMAGE_VARIANTS.thumb.width, { fit: 'cover' })
          .avif({ quality: IMAGE_VARIANTS.thumb.quality })
          .toBuffer(),
        sharp(rawBuffer)
          .resize(IMAGE_VARIANTS.card.width, IMAGE_VARIANTS.card.width, { fit: 'cover' })
          .avif({ quality: IMAGE_VARIANTS.card.quality })
          .toBuffer(),
        sharp(rawBuffer)
          .resize(IMAGE_VARIANTS.detail.width, IMAGE_VARIANTS.detail.width, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality: IMAGE_VARIANTS.detail.quality })
          .toBuffer(),
      ]);
    } catch (avifErr: any) {
      logger.warn(`[ImageProcessor] AVIF conversion failed (${avifErr.message}), falling back to WebP for all variants`);
      [thumbBuf, cardBuf, detailBuf] = await Promise.all([
        sharp(rawBuffer)
          .resize(IMAGE_VARIANTS.thumb.width, IMAGE_VARIANTS.thumb.width, { fit: 'cover' })
          .webp({ quality: IMAGE_VARIANTS.thumb.quality })
          .toBuffer(),
        sharp(rawBuffer)
          .resize(IMAGE_VARIANTS.card.width, IMAGE_VARIANTS.card.width, { fit: 'cover' })
          .webp({ quality: IMAGE_VARIANTS.card.quality })
          .toBuffer(),
        sharp(rawBuffer)
          .resize(IMAGE_VARIANTS.detail.width, IMAGE_VARIANTS.detail.width, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality: IMAGE_VARIANTS.detail.quality })
          .toBuffer(),
      ]);
    }

    // 5. Upload 3 variants to storage
    await Promise.all([
      storageService.uploadFileByKey(thumbKey, thumbBuf, 'image/avif'),
      storageService.uploadFileByKey(cardKey, cardBuf, 'image/avif'),
      storageService.uploadFileByKey(detailKey, detailBuf, 'image/webp'),
    ]);

    // 6. Verify uploads via headObject
    const [tOk, cOk, dOk] = await Promise.all([
      storageService.headObject(thumbKey),
      storageService.headObject(cardKey),
      storageService.headObject(detailKey),
    ]);

    if (!tOk || !cOk || !dOk) {
      throw new Error(`Variant upload verification failed for adImage ${adImageId}`);
    }

    // 7. Update AdImage record to status 'ready'
    await prisma.adImage.update({
      where: { id: adImageId },
      data: {
        status: 'ready',
        thumbKey,
        cardKey,
        detailKey,
        width: metadata.width || null,
        height: metadata.height || null,
        mimeType: realMime,
        sizeBytes: rawBuffer.length,
        updatedAt: new Date(),
      },
    });

    // 8. Delete pending_uploads record
    await prisma.pendingUpload.deleteMany({ where: { objectKey } });

    logger.info(`[ImageProcessor] Successfully processed all variants for adImage: ${adImageId}`);
  } catch (err: any) {
    logger.error(`[ImageProcessor] Error processing adImage ${adImageId}: ${err.message}`);
    await prisma.adImage.update({
      where: { id: adImageId },
      data: { status: 'failed' },
    }).catch(() => {});
    throw err;
  }
}
