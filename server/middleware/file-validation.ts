/**
 * server/middleware/file-validation.ts
 *
 * File Validation for Media Uploads (Images, Videos, Audio)
 */

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

const ALLOWED_MIME_TYPES = new Set([
  // Images
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/heic',
  'image/heif',
  'image/gif',
  'image/bmp',
  'image/tiff',
  'image/x-bmp',
  'image/x-tiff',
  // Videos
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-matroska',
  'video/ogg',
  'video/x-msvideo',
  'video/3gpp',
  // Audio
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/m4a',
  'audio/x-m4a',
  'audio/webm',
  'audio/ogg',
  'audio/aac',
  'audio/flac',
]);

const ALLOWED_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'webp', 'avif', 'heic', 'heif', 'gif', 'bmp', 'tiff', 'tif',
  'mp4', 'webm', 'mov', 'mkv', 'ogv', 'avi', '3gp',
  'mp3', 'wav', 'm4a', 'ogg', 'aac', 'flac'
]);

const MAX_FILE_SIZE_BYTES = 60 * 1024 * 1024; // 60 MB

export function validateUploadedFile(
  buffer: Buffer,
  declaredMime: string,
  filename: string
): ValidationResult {
  const mime = declaredMime.toLowerCase().split(';')[0].trim();

  // ── 1. حجم الملف ─────────────────────────────────────────────────────
  if (buffer.length === 0) {
    return { valid: false, reason: 'الملف فارغ' };
  }
  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    const sizeMB = (buffer.length / 1024 / 1024).toFixed(1);
    return { valid: false, reason: `حجم الملف (${sizeMB}MB) يتجاوز الحد الأقصى (60MB)` };
  }

  // ── 2. MIME مسموح ────────────────────────────────────────────────────
  if (!ALLOWED_MIME_TYPES.has(mime) && !mime.startsWith('image/') && !mime.startsWith('video/') && !mime.startsWith('audio/')) {
    return { valid: false, reason: `نوع الملف "${mime}" غير مسموح.` };
  }

  // ── 3. Magic Bytes Check for common image files ─────────────────────────
  if (mime === 'image/jpeg' || mime === 'image/jpg') {
    if (buffer[0] !== 0xFF || buffer[1] !== 0xD8) {
      return { valid: false, reason: 'ملف JPG/JPEG غير صالح' };
    }
  } else if (mime === 'image/png') {
    if (buffer[0] !== 0x89 || buffer[1] !== 0x50 || buffer[2] !== 0x4E || buffer[3] !== 0x47) {
      return { valid: false, reason: 'ملف PNG غير صالح' };
    }
  }

  // ── 4. منع SVG/XML/HTML مخفية (XSS Vector) ──────────────────────────
  if (mime.startsWith('image/')) {
    const startStr = buffer.slice(0, 300).toString('utf8', 0, 300).toLowerCase();
    const dangerousPatterns = ['<svg', '<?xml', '<html', '<!doctype', '<script', 'javascript:'];
    const foundDangerous = dangerousPatterns.find(p => startStr.includes(p));
    if (foundDangerous) {
      return {
        valid: false,
        reason: `محتوى الملف يحتوي على "${foundDangerous}" وهو غير مسموح للأمان`,
      };
    }
  }

  // ── 5. امتداد الملف ───────────────────────────────────
  if (filename) {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext && !ALLOWED_EXTENSIONS.has(ext)) {
      return {
        valid: false,
        reason: `امتداد الملف ".${ext}" غير مدعوم.`,
      };
    }
  }

  return { valid: true };
}
