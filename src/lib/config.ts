/**
 * Centralized runtime configuration for the Aswaq web/native app.
 * The native (Capacitor) build injects VITE_API_URL at build time so the
 * production app always talks to the production backend over HTTPS.
 */

const isBrowser = typeof window !== 'undefined';
const isLocalhost = isBrowser && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

const defaultUrl = isLocalhost ? 'http://localhost:5000' : 'https://api.aswaq22.com';
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

  // If it's already a full URL (http/https), normalize any domain mismatches
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    // Fix wrong domain (www or media subdomain) → correct API origin
    if (trimmed.includes('/uploads/')) {
      trimmed = trimmed.replace(/^https?:\/\/(www\.|media\.|api\.)?aswaq22\.com\/uploads\//i, `${API_ORIGIN}/uploads/`);
    }
    if (trimmed.startsWith('https://media.aswaq22.com') || trimmed.startsWith('http://media.aswaq22.com')) {
      trimmed = trimmed.replace(/^https?:\/\/media\.aswaq22\.com/i, API_ORIGIN);
    }
    return trimmed;
  }

  // Relative path or objectKey → build full URL
  if (trimmed.startsWith('/')) {
    return `${API_ORIGIN}${trimmed}`;
  }
  return `${API_ORIGIN}/${trimmed}`;
}
