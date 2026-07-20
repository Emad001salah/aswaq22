import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { S3Client, HeadObjectCommand, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { logger } from '../lib/logger.ts';
import { prisma } from '../../src/lib/prisma.ts';

export interface FileData {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
}

export interface StorageStrategy {
  uploadFile(file: FileData): Promise<string>;
  deleteFile(fileUrl: string): Promise<void>;
  uploadFileByKey(key: string, buffer: Buffer, mimeType: string): Promise<void>;
  deleteFileByKey(key: string): Promise<void>;
  headObject(key: string): Promise<boolean>;
  getFileBuffer(key: string): Promise<Buffer>;
}

export class LocalStorageStrategy implements StorageStrategy {
  private uploadDir = path.join(process.cwd(), 'uploads');

  constructor() {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  private resolveKeyToPath(key: string): string {
    // If key has folder structure like uploads/ads/..., put it inside process.cwd()
    if (key.startsWith('uploads/')) {
      const fullPath = path.join(process.cwd(), key);
      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      return fullPath;
    }
    return path.join(this.uploadDir, path.basename(key));
  }

  async uploadFile(file: FileData, customFolder?: string): Promise<string> {
    const uniqueUuid = crypto.randomUUID();
    const ext = path.extname(file.originalname) || (file.mimetype === 'image/webp' ? '.webp' : '.jpg');
    const folder = customFolder || 'uploads';
    const filename = `${uniqueUuid}${ext}`;
    const key = `${folder}/${filename}`;
    const filePath = this.resolveKeyToPath(key);

    await fs.promises.writeFile(filePath, file.buffer);
    logger.info(`[Storage] File uploaded locally: ${key}`);
    return `/uploads/${filename}`;
  }

  async deleteFile(fileUrl: string): Promise<void> {
    const filename = path.basename(fileUrl);
    const filePath = path.join(this.uploadDir, filename);
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
      logger.info(`[Storage] File deleted locally: ${filename}`);
    }
  }

  async uploadFileByKey(key: string, buffer: Buffer, mimeType: string): Promise<void> {
    const filePath = this.resolveKeyToPath(key);
    await fs.promises.writeFile(filePath, buffer);
    logger.info(`[Storage] File uploaded locally by key: ${key}`);
  }

  async deleteFileByKey(key: string): Promise<void> {
    const filePath = this.resolveKeyToPath(key);
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
      logger.info(`[Storage] File deleted locally by key: ${key}`);
    }
  }

  async headObject(key: string): Promise<boolean> {
    const filePath = this.resolveKeyToPath(key);
    return fs.existsSync(filePath);
  }

  async getFileBuffer(key: string): Promise<Buffer> {
    const filePath = this.resolveKeyToPath(key);
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${key}`);
    }
    return fs.promises.readFile(filePath);
  }
}

export class S3StorageStrategy implements StorageStrategy {
  private s3Client: S3Client;
  private bucket: string;
  private publicUrl?: string;

  constructor(provider: 's3' | 'r2') {
    if (provider === 'r2') {
      const accountId = process.env.R2_ACCOUNT_ID;
      const accessKeyId = process.env.R2_ACCESS_KEY_ID;
      const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
      this.bucket = process.env.R2_BUCKET_NAME || 'aswaq-uploads';
      this.publicUrl = process.env.R2_PUBLIC_URL;

      if (!accountId || !accessKeyId || !secretAccessKey) {
        throw new Error('Cloudflare R2 configuration missing from environment variables.');
      }

      this.s3Client = new S3Client({
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
        region: 'auto',
      });
      logger.info('[Storage] Initialized Cloudflare R2 storage strategy.');
    } else {
      const accessKeyId = process.env.S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
      const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
      this.bucket = process.env.S3_BUCKET_NAME || process.env.AWS_BUCKET_NAME || 'aswaq-uploads';
      this.publicUrl = process.env.S3_PUBLIC_URL;
      const region = process.env.S3_REGION || process.env.AWS_REGION || 'us-east-1';
      const endpoint = process.env.S3_ENDPOINT;

      if (!accessKeyId || !secretAccessKey) {
        throw new Error('S3 configuration credentials missing from environment variables.');
      }

      this.s3Client = new S3Client({
        region,
        endpoint,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
        forcePathStyle: endpoint ? true : undefined,
      });
      logger.info('[Storage] Initialized AWS S3 (or compatible) storage strategy.');
    }
  }

  async uploadFile(file: FileData, customFolder?: string): Promise<string> {
    const uniqueUuid = crypto.randomUUID();
    const ext = path.extname(file.originalname) || (file.mimetype === 'image/webp' ? '.webp' : '.jpg');
    const folder = customFolder || 'uploads';
    const key = `${folder}/${uniqueUuid}${ext}`;

    const upload = new Upload({
      client: this.s3Client,
      params: {
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      },
    });

    await upload.done();
    logger.info(`[Storage] File uploaded to S3/R2: ${key}`);

    if (this.publicUrl) {
      const base = this.publicUrl.endsWith('/') ? this.publicUrl.slice(0, -1) : this.publicUrl;
      return `${base}/${key}`;
    }

    return `https://${this.bucket}.s3.amazonaws.com/${key}`;
  }

  async deleteFile(fileUrl: string): Promise<void> {
    let key = '';
    if (this.publicUrl && fileUrl.startsWith(this.publicUrl)) {
      key = fileUrl.replace(this.publicUrl, '');
    } else {
      const match = fileUrl.match(/amazonaws\.com\/(.+)$/);
      if (match) {
        key = match[1];
      } else {
        const idx = fileUrl.indexOf('uploads/');
        if (idx !== -1) {
          key = fileUrl.substring(idx);
        }
      }
    }

    if (key.startsWith('/')) {
      key = key.substring(1);
    }

    if (!key) {
      logger.warn(`[Storage] Could not resolve S3 key from file URL: ${fileUrl}`);
      return;
    }

    await this.s3Client.send(new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    }));
    logger.info(`[Storage] File deleted from S3/R2: ${key}`);
  }

  async uploadFileByKey(key: string, buffer: Buffer, mimeType: string): Promise<void> {
    await this.s3Client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    }));
    logger.info(`[Storage] File uploaded to S3/R2 by key: ${key}`);
  }

  async deleteFileByKey(key: string): Promise<void> {
    await this.s3Client.send(new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    }));
    logger.info(`[Storage] File deleted from S3/R2 by key: ${key}`);
  }

  async headObject(key: string): Promise<boolean> {
    try {
      await this.s3Client.send(new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }));
      return true;
    } catch (err: any) {
      if (err.name === 'NotFound') return false;
      throw err;
    }
  }

  async getFileBuffer(key: string): Promise<Buffer> {
    const res = await this.s3Client.send(new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    }));

    if (!res.Body) throw new Error(`Empty body returned for key: ${key}`);
    const chunks: Buffer[] = [];
    for await (const chunk of res.Body as any) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
}

export class StorageService {
  private static instance: StorageService;
  private strategy: StorageStrategy;

  private constructor() {
    const provider = (process.env.STORAGE_PROVIDER || 'local').toLowerCase();
    const isProduction = process.env.NODE_ENV === 'production';

    if (provider === 's3' || provider === 'r2') {
      try {
        this.strategy = new S3StorageStrategy(provider);
      } catch (err: any) {
        if (isProduction) {
          logger.error(`[Storage] CRITICAL: Failed to initialize S3/R2 storage strategy in production: ${err.message}`);
          throw new Error(`CRITICAL: Failed to initialize S3/R2 storage strategy in production: ${err.message}`);
        }
        logger.error(`[Storage] Failed to initialize S3/R2 strategy, falling back to local. Error: ${err.message}`);
        this.strategy = new LocalStorageStrategy();
      }
    } else {
      if (isProduction) {
        logger.error(`[Storage] CRITICAL: Local storage strategy is forbidden in production. STORAGE_PROVIDER must be 's3' or 'r2'.`);
        throw new Error(`CRITICAL: Local storage strategy is forbidden in production. STORAGE_PROVIDER must be 's3' or 'r2'.`);
      }
      this.strategy = new LocalStorageStrategy();
    }
  }

  public static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  public async uploadFile(file: FileData): Promise<string> {
    let processedFile = { ...file };

    if (file.mimetype.startsWith('image/')) {
      try {
        const sharp = (await import('sharp')).default;
        logger.info(`[Storage] Processing and compressing image: ${file.originalname}`);

        const compressedBuffer = await sharp(file.buffer)
          .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 80 })
          .toBuffer();

        processedFile.buffer = compressedBuffer;
        processedFile.mimetype = 'image/webp';

        const ext = path.extname(file.originalname);
        processedFile.originalname = file.originalname.substring(0, file.originalname.length - ext.length) + '.webp';
      } catch (err: any) {
        logger.error(`[Storage] Image processing failed: ${err.message}. Uploading original file.`);
      }
    }

    return this.strategy.uploadFile(processedFile);
  }

  public async deleteFile(fileUrl: string): Promise<void> {
    return this.strategy.deleteFile(fileUrl);
  }

  public async uploadFileByKey(key: string, buffer: Buffer, mimeType: string): Promise<void> {
    return this.strategy.uploadFileByKey(key, buffer, mimeType);
  }

  public async deleteFileByKey(key: string): Promise<void> {
    return this.strategy.deleteFileByKey(key);
  }

  public async headObject(key: string): Promise<boolean> {
    return this.strategy.headObject(key);
  }

  public async getFileBuffer(key: string): Promise<Buffer> {
    return this.strategy.getFileBuffer(key);
  }
}

export const storageService = StorageService.getInstance();

/**
 * BullMQ Image processing worker handler
 */
export async function processMediaObject(
  mediaId: string,
  tempObjectKey: string,
  adId: string,
  userId: string
): Promise<void> {
  logger.info(`[StorageWorker] Starting media processing for: ${mediaId}`);

  // Update MediaObject status to PROCESSING
  await prisma.mediaObject.update({
    where: { id: mediaId },
    data: { status: 'PROCESSING' }
  });

  const variants = ['master', 'large', 'medium', 'thumb'] as const;
  const results: { variant: string; success: boolean; objectKey?: string; size?: number; width?: number; height?: number }[] = [];

  try {
    const rawBuffer = await storageService.getFileBuffer(tempObjectKey);
    const sharp = (await import('sharp')).default;

    for (const variant of variants) {
      // Mark variant as UPLOADING
      await prisma.mediaVariant.update({
        where: { mediaId_variantKey: { mediaId, variantKey: variant } },
        data: { status: 'UPLOADING' }
      });

      try {
        let pipeline = sharp(rawBuffer);
        let metadata = await pipeline.metadata();

        if (variant === 'master') {
          pipeline = pipeline.resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true });
        } else if (variant === 'large') {
          pipeline = pipeline.resize({ width: 800, height: 800, fit: 'inside', withoutEnlargement: true });
        } else if (variant === 'medium') {
          pipeline = pipeline.resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true });
        } else if (variant === 'thumb') {
          pipeline = pipeline.resize({ width: 320, height: 320, fit: 'cover' });
        }

        const processedBuffer = await pipeline.webp({ quality: variant === 'thumb' ? 70 : 80 }).toBuffer();
        const finalMeta = await sharp(processedBuffer).metadata();

        const destinationKey = adId && adId !== 'undefined'
          ? `uploads/ads/${adId}/${mediaId}_${variant}.webp`
          : `uploads/media/${mediaId}_${variant}.webp`;
        await storageService.uploadFileByKey(destinationKey, processedBuffer, 'image/webp');

        await prisma.mediaVariant.update({
          where: { mediaId_variantKey: { mediaId, variantKey: variant } },
          data: {
            status: 'READY',
            objectKey: destinationKey,
            size: processedBuffer.length,
            width: finalMeta.width,
            height: finalMeta.height,
            uploadedAt: new Date()
          }
        });

        results.push({
          variant,
          success: true,
          objectKey: destinationKey,
          size: processedBuffer.length,
          width: finalMeta.width,
          height: finalMeta.height
        });
      } catch (err: any) {
        logger.error(`[StorageWorker] Failed variant ${variant} for media ${mediaId}: ${err.message}`);
        await prisma.mediaVariant.update({
          where: { mediaId_variantKey: { mediaId, variantKey: variant } },
          data: { status: 'FAILED', error: err.message }
        });
        results.push({ variant, success: false });
      }
    }

    const succeeded = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    if (failed.length === variants.length) {
      // Compensating delete if all variants failed
      await Promise.allSettled(
        succeeded.map(r => r.objectKey ? storageService.deleteFileByKey(r.objectKey) : Promise.resolve())
      );

      await prisma.mediaObject.update({
        where: { id: mediaId },
        data: { status: 'FAILED' }
      });
      logger.error(`[StorageWorker] Media ${mediaId} completely failed image processing.`);
    } else {
      const finalStatus = failed.length > 0 ? 'PARTIAL' : 'READY';
      const thumb = succeeded.find(r => r.variant === 'thumb') || succeeded[0];

      await prisma.mediaObject.update({
        where: { id: mediaId },
        data: {
          status: finalStatus,
          processedAt: new Date(),
          size: succeeded.reduce((acc, curr) => acc + (curr.size || 0), 0),
          width: thumb?.width,
          height: thumb?.height
        }
      });

      logger.info(`[StorageWorker] Media ${mediaId} processed successfully with status: ${finalStatus}`);
    }

    // Cleanup temp file
    try {
      await storageService.deleteFileByKey(tempObjectKey);
    } catch (cleanupErr: any) {
      logger.warn(`[StorageWorker] Failed to delete temp file ${tempObjectKey}: ${cleanupErr.message}`);
    }

  } catch (err: any) {
    logger.error(`[StorageWorker] Critical error processing media ${mediaId}: ${err.message}`);
    await prisma.mediaObject.update({
      where: { id: mediaId },
      data: { status: 'FAILED' }
    });
  }
}

