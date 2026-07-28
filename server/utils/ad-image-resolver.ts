export function getMediaPublicBase(): string {
  const envUrl = process.env.MEDIA_PUBLIC_BASE_URL || process.env.R2_PUBLIC_URL || process.env.API_URL || 'https://api.aswaq22.com';
  return envUrl.replace(/\/$/, '');
}

export interface ResolvedAdImageUrls {
  thumbUrl: string | null;
  cardUrl: string | null;
  detailUrl: string | null;
}

export function resolveAdImageUrls(img: {
  status?: string | null;
  objectKey?: string | null;
  thumbKey?: string | null;
  cardKey?: string | null;
  detailKey?: string | null;
  url?: string | null;
  blurHash?: string | null;
}): ResolvedAdImageUrls {
  const base = getMediaPublicBase();

  const toFullUrl = (keyOrUrl: string | null | undefined): string | null => {
    if (!keyOrUrl) return null;
    const str = keyOrUrl.trim();
    if (!str) return null;
    if (str.startsWith('data:') || str.startsWith('blob:') || str.startsWith('http://') || str.startsWith('https://')) {
      return str;
    }
    return `${base}/${str.replace(/^\//, '')}`;
  };

  const R2Thumb = toFullUrl(img.thumbKey);
  const R2Card = toFullUrl(img.cardKey);
  const R2Detail = toFullUrl(img.detailKey);
  const DirectUrl = toFullUrl(img.url);
  const OrigKey = toFullUrl(img.objectKey);

  // Highest priority to lowest priority fallback chain:
  const primaryDetail = R2Detail || R2Card || R2Thumb || DirectUrl || OrigKey;
  const primaryCard = R2Card || R2Detail || R2Thumb || DirectUrl || OrigKey;
  const primaryThumb = R2Thumb || R2Card || R2Detail || DirectUrl || OrigKey;

  return {
    thumbUrl: primaryThumb,
    cardUrl: primaryCard,
    detailUrl: primaryDetail,
  };
}
