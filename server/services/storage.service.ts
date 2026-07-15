import fs from 'fs';
import path from 'path';
import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { logger } from '../lib/logger.ts';

export interface FileData {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
}

export interface StorageStrategy {
  uploadFile(file: FileData): Promise<string>;
  deleteFile(fileUrl: string): Promise<void>;
}

export class LocalStorageStrategy implements StorageStrategy {
  private uploadDir = path.join(process.cwd(), 'uploads');

  constructor() {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async uploadFile(file: FileData): Promise<string> {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname) || (file.mimetype === 'video/webm' ? '.webm' : '.jpg');
    const filename = `file-${uniqueSuffix}${ext}`;
    const filePath = path.join(this.uploadDir, filename);

    await fs.promises.writeFile(filePath, file.buffer);
    logger.info(`[Storage] File uploaded locally: ${filename}`);
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

  async uploadFile(file: FileData): Promise<string> {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname) || (file.mimetype === 'video/webm' ? '.webm' : '.jpg');
    const key = `uploads/file-${uniqueSuffix}${ext}`;

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

    const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
    await this.s3Client.send(new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    }));
    logger.info(`[Storage] File deleted from S3/R2: ${key}`);
  }
}

export class StorageService {
  private static instance: StorageService;
  private strategy: StorageStrategy;

  private constructor() {
    const provider = (process.env.STORAGE_PROVIDER || 'local').toLowerCase();
    if (provider === 's3' || provider === 'r2') {
      try {
        this.strategy = new S3StorageStrategy(provider);
      } catch (err: any) {
        logger.error(`[Storage] Failed to initialize S3/R2 strategy, falling back to local. Error: ${err.message}`);
        this.strategy = new LocalStorageStrategy();
      }
    } else {
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
}

export const storageService = StorageService.getInstance();
