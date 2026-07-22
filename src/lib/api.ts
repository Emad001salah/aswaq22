import { API_BASE_URL, API_ORIGIN } from './config';

// Store reference to native fetch before any window.fetch overrides
const rawFetch = typeof window !== 'undefined' ? window.fetch.bind(window) : fetch;

let isRefreshing = false;
let refreshSubscribers: ((token: string | null) => void)[] = [];

function subscribeTokenRefresh(cb: (token: string | null) => void) {
  refreshSubscribers.push(cb);
}

function onRefreshed(token: string | null) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
  return undefined;
}

/**
 * Refreshes the access token using the stored refresh token.
 * - Returns the new access token on success.
 * - Returns null on failure.
 * - ONLY clears tokens when the server explicitly rejects them (401/403/400).
 * - Does NOT clear tokens on network errors to preserve the existing session.
 */
export async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem('aswaq_refresh_token');
  if (!refreshToken) return null;

  try {
    const res = await rawFetch(`${API_BASE_URL}/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      credentials: 'include',
    });

    if (res.ok) {
      const data = await res.json();
      const newToken = data.accessToken;
      if (newToken) {
        localStorage.setItem('aswaq_access_token', newToken);
        localStorage.setItem('auth_token', newToken);
        if (data.refreshToken) {
          localStorage.setItem('aswaq_refresh_token', data.refreshToken);
        }
        console.log('[API] Access token refreshed successfully.');
        return newToken;
      }
    }

    // Server explicitly rejected the refresh token → tokens are truly invalid
    if (res.status === 401 || res.status === 403 || res.status === 400) {
      console.warn('[API] Refresh token rejected by server (status:', res.status, '). Clearing stored tokens.');
      localStorage.removeItem('aswaq_access_token');
      localStorage.removeItem('auth_token');
      localStorage.removeItem('aswaq_refresh_token');
      return null;
    }

    // Server error (5xx) or unexpected → keep existing tokens, don't invalidate session
    console.warn('[API] Refresh endpoint returned unexpected status:', res.status, '— keeping existing token, will retry later.');
    return null;

  } catch (err) {
    // IMPORTANT: Network error — DO NOT clear access token.
    // The user may still be authenticated; this is a transient failure.
    console.warn('[API] Token refresh failed due to network error (keeping existing token):', err);
    return null;
  }
}

/**
 * apiFetch — authenticated fetch wrapper.
 *
 * Automatically:
 * 1. Injects Authorization: Bearer <token> from localStorage.
 * 2. On 401: attempts a single token refresh, retries, then prompts login only
 *    if refresh was truly rejected by the server.
 * 3. Bearer-token requests bypass CSRF (server exempts them by design).
 */
export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  // Bypass internal interceptor for external third-party requests (e.g. Firebase, Google APIs, Maps)
  if (url.startsWith('http://') || url.startsWith('https://')) {
    const isInternal = url.startsWith(API_ORIGIN) || url.startsWith(API_BASE_URL) || url.includes('aswaq22.com');
    if (!isInternal) {
      return rawFetch(url, options);
    }
  }

  const method = (options.method || 'GET').toUpperCase();

  // Resolve relative URLs
  let targetUrl = url;
  if (targetUrl.startsWith('/')) {
    targetUrl = targetUrl.startsWith('/api') 
      ? `${API_ORIGIN}${targetUrl}`
      : `${API_BASE_URL}${targetUrl}`;
  }

  const headers = new Headers(options.headers || {});

  // For FormData, let the browser set the correct multipart/form-data boundary
  if (options.body instanceof FormData) {
    headers.delete('Content-Type');
    headers.delete('content-type');
  }

  // Read token from storage and inject Authorization header
  const token = localStorage.getItem('aswaq_access_token') || localStorage.getItem('auth_token');
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Bearer-authenticated requests are CSRF-exempt on the server.
  // Only attach CSRF token for unauthenticated mutating requests (rare).
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && !token && !headers.has('x-csrf-token')) {
    const csrfToken = getCookie('csrf_token');
    if (csrfToken) {
      headers.set('x-csrf-token', csrfToken);
    }
  }

  // Execute the request using native rawFetch
  let response = await rawFetch(targetUrl, { credentials: 'include', ...options, headers });

  // Handle 401 Unauthorized: attempt one refresh cycle then retry
  if (response.status === 401) {
    if (!isRefreshing) {
      isRefreshing = true;
      let newToken: string | null = null;

      try {
        newToken = await refreshAccessToken();
      } finally {
        isRefreshing = false;
        onRefreshed(newToken);
      }

      if (newToken) {
        // Retry original request with new token
        headers.set('Authorization', `Bearer ${newToken}`);
        return rawFetch(targetUrl, { credentials: 'include', ...options, headers });
      }

      // Refresh failed — only prompt re-login if refresh token existed
      // (avoids showing login modal for truly anonymous requests)
      const refreshTokenExists = !!localStorage.getItem('aswaq_refresh_token');
      if (typeof window !== 'undefined' && refreshTokenExists) {
        window.dispatchEvent(new CustomEvent('aswaq:auth-required'));
      }

    } else {
      // Another request is already refreshing — wait for it to complete
      const newToken = await new Promise<string | null>((resolve) => {
        subscribeTokenRefresh((t) => resolve(t));
      });

      if (newToken) {
        headers.set('Authorization', `Bearer ${newToken}`);
        return rawFetch(targetUrl, { credentials: 'include', ...options, headers });
      }
    }
  }

  return response;
}

