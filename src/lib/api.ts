import { API_BASE_URL } from './config';

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function subscribeTokenRefresh(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

function onRefreshed(token: string) {
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
 */
export async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem('aswaq_refresh_token');
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${API_BASE_URL}/v1/auth/refresh`, {
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
        return newToken;
      }
    }
  } catch (err) {
    console.error('[API] Token refresh request failed:', err);
  }

  // Refresh failed -> clear expired access token only (do NOT force logout)
  localStorage.removeItem('aswaq_access_token');
  localStorage.removeItem('auth_token');
  return null;
}

/**
 * Wrapper for fetch that automatically:
 * 1. Injects the Authorization header (JWT access token).
 * 2. Injects the x-csrf-token header for mutating HTTP methods (POST, PUT, PATCH, DELETE).
 * 3. Handles 401 Unauthorized by attempting a token refresh and retrying.
 */
export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const method = (options.method || 'GET').toUpperCase();
  const headers = new Headers(options.headers || {});
  const token = localStorage.getItem('aswaq_access_token') || localStorage.getItem('auth_token');

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Attach CSRF token for mutating requests
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && !headers.has('x-csrf-token')) {
    let csrfToken = getCookie('csrf_token');
    if (!csrfToken) {
      try {
        const csrfRes = await fetch(`${API_BASE_URL}/csrf-token`, { credentials: 'include' });
        if (csrfRes.ok) {
          const csrfData = await csrfRes.json();
          csrfToken = csrfData.csrfToken;
        }
      } catch (e) {
        console.error('[API] Failed to pre-fetch CSRF token:', e);
      }
    }
    if (csrfToken) {
      headers.set('x-csrf-token', csrfToken);
    }
  }

  let response = await fetch(url, { credentials: 'include', ...options, headers });

  if (response.status === 401) {
    if (!isRefreshing) {
      isRefreshing = true;
      const newToken = await refreshAccessToken();
      isRefreshing = false;

      if (newToken) {
        onRefreshed(newToken);
        headers.set('Authorization', `Bearer ${newToken}`);
        return fetch(url, { credentials: 'include', ...options, headers });
      }
    } else {
      // Wait for the ongoing refresh to complete
      const newToken = await new Promise<string | null>((resolve) => {
        subscribeTokenRefresh((t) => resolve(t));
      });

      if (newToken) {
        headers.set('Authorization', `Bearer ${newToken}`);
        return fetch(url, { credentials: 'include', ...options, headers });
      }
    }

    // Unhandled 401 Unauthorized -> Prompt user to log in via AuthModal
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('aswaq:auth-required'));
    }
  }

  return response;
}
