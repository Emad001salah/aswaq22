/**
 * Centralized runtime configuration for the Aswaq web/native app.
 * The native (Capacitor) build injects VITE_API_URL at build time so the
 * production app always talks to the production backend over HTTPS.
 */

const rawApiUrl = (import.meta.env.VITE_API_URL as string | undefined) || 'https://aswaq22.com';

/** API origin without any `/api` suffix or trailing slash, e.g. https://aswaq22.com */
export const API_ORIGIN = rawApiUrl
  .replace(/\/api\/?$/i, '')
  .replace(/\/+$/, '');

/** Full API base URL including the `/api` path segment. */
export const API_BASE_URL = `${API_ORIGIN}/api`;

/** Whether the running build targets production (used for logging/telemetry). */
export const IS_PRODUCTION = import.meta.env.PROD === true;
