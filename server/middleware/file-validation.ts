/**
 * server/middleware/file-validation.ts
 *
 * فحص الملفات قبل المعالجة
 * ────────────────────────
 * - Magic Bytes: يتحقق أن الملف فعلاً صورة، لا مجرد MIME مزيف
 * - SVG/XML: يمنع XSS vectors مخفية
 * - MIME Allowlist: jpeg, png, webp, avif فقط
 * - حجم: 10MB كحد أقصى
 *
 * ملاحظة: ClamAV يُضاف عند الحاجة لامتثال خاص (healthcare, government).
 * لمنصة مثل Aswaq22، Magic Bytes كافية وأسرع بكثير.
 */

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/avif',
]);

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Magic Bytes الخاصة بكل نوع صورة
 * (أول N بايتات من الملف)
 */
const MAGIC_SIGNATURES: Record<string, number[][]> = {
  'image/jpeg': [
    [0xFF, 0xD8, 0xFF, 0xE0],  // JFIF
    [0xFF, 0xD8, 0xFF, 0xE1],  // Exif
    [0xFF, 0xD8, 0xFF, 0xDB],  // Raw JPEG
    [0xFF, 0xD8, 0xFF, 0xEE],  // Adobe
  ],
  'image/jpg': [
    [0xFF, 0xD8, 0xFF, 0xE0],
    [0xFF, 0xD8, 0xFF, 0xE1],
    [0xFF, 0xD8, 0xFF, 0xDB],
  ],
  'image/png': [
    [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A],  // PNG header
  ],
  'image/webp': [
    [0x52, 0x49, 0x46, 0x46],  // RIFF header (تحقق إضافي: bytes 8-11 = "WEBP")
  ],
  'image/avif': [
    // AVIF يستخدم container ISOBMFF — أكثر مرونة
    // نتحقق من فتغ "ftyp"
    [0x00, 0x00, 0x00],  // placeholder — سنتحقق بطريقة خاصة
  ],
};

/**
 * التحقق الرئيسي من صحة الملف
 */
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
    return { valid: false, reason: `حجم الملف (${sizeMB}MB) يتجاوز الحد الأقصى (10MB)` };
  }

  // ── 2. MIME مسموح ────────────────────────────────────────────────────
  if (!ALLOWED_MIME_TYPES.has(mime)) {
    return { valid: false, reason: `نوع الملف "${mime}" غير مسموح. المسموح: JPEG, PNG, WebP, AVIF` };
  }

  // ── 3. Magic Bytes ────────────────────────────────────────────────────
  if (mime === 'image/avif') {
    // AVIF: يبحث عن "ftyp" في bytes 4-7
    const ftypStr = buffer.slice(4, 8).toString('ascii');
    if (!ftypStr.includes('ftyp')) {
      return { valid: false, reason: 'ملف AVIF غير صالح (magic bytes)' };
    }
  } else {
    const signatures = MAGIC_SIGNATURES[mime];
    if (signatures) {
      const matchesMagic = signatures.some(sig =>
        sig.every((byte, i) => buffer[i] === byte)
      );
      if (!matchesMagic) {
        return {
          valid: false,
          reason: `محتوى الملف لا يطابق نوعه المُعلن (${mime}). قد يكون الملف تالفاً أو مزيفاً.`,
        };
      }
    }

    // تحقق إضافي لـ WebP: bytes 8-11 يجب أن تكون "WEBP"
    if (mime === 'image/webp') {
      const webpStr = buffer.slice(8, 12).toString('ascii');
      if (webpStr !== 'WEBP') {
        return { valid: false, reason: 'ملف WebP غير صالح (RIFF header موجود لكن WEBP signature مفقودة)' };
      }
    }
  }

  // ── 4. منع SVG/XML/HTML مخفية (XSS Vector) ──────────────────────────
  const startStr = buffer.slice(0, 300).toString('utf8', 0, 300).toLowerCase();
  const dangerousPatterns = ['<svg', '<?xml', '<html', '<!doctype', '<script', 'javascript:'];
  const foundDangerous = dangerousPatterns.find(p => startStr.includes(p));
  if (foundDangerous) {
    return {
      valid: false,
      reason: `محتوى الملف يحتوي على "${foundDangerous}" وهو غير مسموح للأمان`,
    };
  }

  // ── 5. امتداد الملف يجب أن يتطابق ───────────────────────────────────
  if (filename) {
    const ext = filename.split('.').pop()?.toLowerCase();
    const allowedExtensions = new Set(['jpg', 'jpeg', 'png', 'webp', 'avif']);
    if (ext && !allowedExtensions.has(ext)) {
      return {
        valid: false,
        reason: `امتداد الملف ".${ext}" غير مسموح`,
      };
    }
  }

  return { valid: true };
}
