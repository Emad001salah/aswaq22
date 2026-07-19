/**
 * server/utils/media-url.ts
 *
 * بناء روابط الوسائط من objectKey
 * ─────────────────────────────────
 * المصدر الأساسي للحقيقة هو objectKey في DB.
 * الـ URL يُبنى ديناميكياً من MEDIA_PUBLIC_BASE_URL.
 * عند تغيير النطاق مستقبلاً → يكفي تغيير المتغير فقط.
 *
 * Dual Read:
 *   - objectKey موجود → يبني من R2
 *   - objectKey غير موجود → يرجع url القديم (backward compat)
 */

const MEDIA_BASE = (process.env.MEDIA_PUBLIC_BASE_URL || '').replace(/\/$/, '');

/**
 * يبني رابط CDN كامل من objectKey
 */
export function buildMediaUrl(objectKey: string): string {
  if (!MEDIA_BASE) {
    throw new Error('[MediaUrl] MEDIA_PUBLIC_BASE_URL is not configured');
  }
  return `${MEDIA_BASE}/${objectKey}`;
}

/**
 * Dual Read: يُفضّل objectKey على url القديم
 * يُستخدم أثناء الهجرة من Local إلى R2
 */
export function resolveMediaUrl(media: {
  objectKey?: string | null;
  url?: string | null;
}): string | null {
  if (media.objectKey) {
    try {
      return buildMediaUrl(media.objectKey);
    } catch {
      // MEDIA_PUBLIC_BASE_URL غير مضبوط — الرجوع للـ url القديم
    }
  }
  return media.url ?? null;
}

/**
 * يبني URL لنسخة محددة من MediaVariant
 */
export function resolveVariantUrl(
  variantObjectKey: string | null | undefined,
  fallbackUrl?: string | null
): string | null {
  if (variantObjectKey) {
    try {
      return buildMediaUrl(variantObjectKey);
    } catch {
      // fallthrough
    }
  }
  return fallbackUrl ?? null;
}

/**
 * مجموعة روابط كل نسخ MediaObject
 */
export function resolveAllVariantUrls(media: {
  masterKey?: string | null;
  largeKey?: string | null;
  mediumKey?: string | null;
  thumbKey?: string | null;
  url?: string | null; // Dual Read fallback
}): {
  master: string | null;
  large: string | null;
  medium: string | null;
  thumb: string | null;
} {
  return {
    master: resolveVariantUrl(media.masterKey, media.url),
    large:  resolveVariantUrl(media.largeKey,  media.url),
    medium: resolveVariantUrl(media.mediumKey, media.url),
    thumb:  resolveVariantUrl(media.thumbKey,  media.url),
  };
}
