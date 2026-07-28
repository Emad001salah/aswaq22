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

  // 2. Direct Base64 or URL fallback (preferred when R2 worker hasn't generated keys)
  if (img.url) {
    let legacyUrl: string = img.url;
    if (!legacyUrl.startsWith('data:image/') && !legacyUrl.startsWith('blob:') && !legacyUrl.startsWith('http://') && !legacyUrl.startsWith('https://')) {
      legacyUrl = `${base}/${legacyUrl.replace(/^\//, '')}`;
    }
    const thumbFallback = img.blurHash && img.blurHash.startsWith('data:image/') ? img.blurHash : legacyUrl;
    return {
      thumbUrl: thumbFallback,
      cardUrl: legacyUrl,
      detailUrl: legacyUrl,
    };
  }

  // 3. Fallback: If variants/url are not generated yet but original objectKey is present
  if (img.objectKey) {
    const origUrl = `${base}/${img.objectKey.replace(/^\//, '')}`;
    return {
      thumbUrl: origUrl,
      cardUrl: origUrl,
      detailUrl: origUrl,
    };
  }

  return {
    thumbUrl: null,
    cardUrl: null,
    detailUrl: null,
  };
}
