/** Maximum images per ad — enforced on frontend, server, and DTO */
export const MAX_AD_IMAGES = parseInt(process.env.MAX_AD_IMAGES || '10', 10);

/** Maximum file size in bytes per image (15 MB) */
export const MAX_IMAGE_SIZE_BYTES = parseInt(process.env.MAX_IMAGE_SIZE_BYTES || String(15 * 1024 * 1024), 10);

/** Presigned URL expiry in seconds (5 minutes) */
export const PRESIGN_EXPIRY_SECONDS = 300;

/** Daily upload limit per user */
export const DAILY_UPLOAD_LIMIT = 150;

/** Hourly presign limit per user */
export const HOURLY_PRESIGN_LIMIT = 60;

/** Allowed MIME types for ad images */
export const ALLOWED_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/avif',
  'image/gif',
  'image/bmp',
  'image/tiff',
]);

/** Image variant sizes (px) */
export const IMAGE_VARIANTS = {
  thumb:  { width: 240,  format: 'avif' as const, quality: 70  },
  card:   { width: 640,  format: 'avif' as const, quality: 75  },
  detail: { width: 1280, format: 'webp' as const, quality: 82  },
} as const;
