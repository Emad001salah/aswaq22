/**
 * Centralized runtime configuration for the Aswaq web/native app.
 * The native (Capacitor) build injects VITE_API_URL at build time so the
 * production app always talks to the production backend over HTTPS.
 */

const isBrowser = typeof window !== 'undefined';
const defaultUrl = isBrowser ? window.location.origin : 'https://api.aswaq22.com';
const rawApiUrl = (import.meta.env.VITE_API_URL as string | undefined) || defaultUrl;

/** API origin without any `/api` suffix or trailing slash, e.g. https://api.aswaq22.com */
export const API_ORIGIN = rawApiUrl
  .replace(/\/api\/?$/i, '')
  .replace(/\/+$/, '');

/** Full API base URL including the `/api` path segment. */
export const API_BASE_URL = `${API_ORIGIN}/api`;

/** Whether the running build targets production (used for logging/telemetry). */
export const IS_PRODUCTION = import.meta.env.PROD === true;

/** Safely resolves any logo URL to a full accessible URL across domains */
export function getPublicLogoUrl(url?: string | null): string {
  if (!url || typeof url !== 'string') return '/aswaq-icon.png';
  let trimmed = url.trim();
  if (!trimmed) return '/aswaq-icon.png';

  if (trimmed.includes('/uploads/')) {
    trimmed = trimmed.replace(/^https?:\/\/(www\.|media\.)?aswaq22\.com\/uploads\//i, `${API_ORIGIN}/uploads/`);
  }
  if (trimmed.startsWith('https://media.aswaq22.com') || trimmed.startsWith('http://media.aswaq22.com')) {
    trimmed = trimmed.replace(/^https?:\/\/media\.aswaq22\.com/i, API_ORIGIN);
  }

  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return trimmed;
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  if (trimmed.startsWith('/')) {
    return `${API_ORIGIN}${trimmed}`;
  }
  return `${API_ORIGIN}/${trimmed}`;
}

export function resolveMediaUrl(url?: string | null): string {
  if (!url || typeof url !== 'string') return '';
  let trimmed = url.trim();
  if (!trimmed) return '';

  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return trimmed;
  }

  // Normalize legacy avatars/ path to /uploads/avatars/
  if (trimmed.startsWith('avatars/')) {
    trimmed = `uploads/${trimmed}`;
  } else if (trimmed.startsWith('/avatars/')) {
    trimmed = `/uploads${trimmed}`;
  }

  // If it's already a full URL (http/https), check if it points to R2/uploads and route via backend proxy
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    if (trimmed.includes('r2.dev/')) {
      const parts = trimmed.split('r2.dev/');
      const key = parts[1];
      if (key) {
        return `${API_ORIGIN}/api/storage/serve?key=${encodeURIComponent(key)}`;
      }
    }
    if (trimmed.includes('/uploads/')) {
      const idx = trimmed.indexOf('/uploads/');
      const key = trimmed.substring(idx + 1); // "uploads/..."
      return `${API_ORIGIN}/api/storage/serve?key=${encodeURIComponent(key)}`;
    }
    return trimmed;
  }

  // Relative path or objectKey → route via backend proxy
  if (trimmed.startsWith('uploads/')) {
    return `${API_ORIGIN}/api/storage/serve?key=${encodeURIComponent(trimmed)}`;
  }
  if (trimmed.startsWith('/uploads/')) {
    return `${API_ORIGIN}/api/storage/serve?key=${encodeURIComponent(trimmed.substring(1))}`;
  }

  if (trimmed.startsWith('/')) {
    return `${API_ORIGIN}${trimmed}`;
  }
  return `${API_ORIGIN}/${trimmed}`;
}
