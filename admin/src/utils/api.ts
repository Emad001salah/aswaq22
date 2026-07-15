/**
 * Aswaq Admin Dashboard API URL Resolver
 */
export const getApiUrl = (): string => {
  const configuredApiUrl = import.meta.env.VITE_API_URL;
  if (configuredApiUrl) {
    return configuredApiUrl;
  }

  if (import.meta.env.PROD) {
    throw new Error('VITE_API_URL is required in production builds.');
  }

  const { hostname, protocol } = window.location;

  if (hostname.startsWith('admin.')) {
    return `${protocol}//${hostname.replace('admin.', 'api.')}`;
  }

  return 'http://localhost:3000';
};

export const API_BASE_URL = getApiUrl();
