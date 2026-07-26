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

  // 1. New Cloudflare R2 pipeline (status === 'ready' or keys present)
  if (img.thumbKey || img.cardKey || img.detailKey) {
    return {
      thumbUrl: img.thumbKey ? `${base}/${img.thumbKey.replace(/^\//, '')}` : null,
      cardUrl: img.cardKey ? `${base}/${img.cardKey.replace(/^\//, '')}` : null,
      detailUrl: img.detailKey ? `${base}/${img.detailKey.replace(/^\//, '')}` : null,
    };
  }

  // 2. Legacy Base64 or direct URL backward compatibility
  let legacyUrl: string | null = null;
  if (img.url) {
    if (img.url.startsWith('data:image/') || img.url.startsWith('http://') || img.url.startsWith('https://')) {
      legacyUrl = img.url;
    } else {
      legacyUrl = `${base}/${img.url.replace(/^\//, '')}`;
    }
  }

  const thumbFallback = img.blurHash && img.blurHash.startsWith('data:image/') ? img.blurHash : legacyUrl;

  return {
    thumbUrl: thumbFallback,
    cardUrl: legacyUrl,
    detailUrl: legacyUrl,
  };
}
