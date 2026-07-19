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
    });

    if (res.ok) {
      const data = await res.json();
      const newToken = data.accessToken;
      if (newToken) {
        localStorage.setItem('aswaq_access_token', newToken);
        if (data.refreshToken) {
          localStorage.setItem('aswaq_refresh_token', data.refreshToken);
        }
        return newToken;
      }
    }
  } catch (err) {
    console.error('[API] Token refresh request failed:', err);
  }

  // Refresh failed -> clear stale credentials
  localStorage.removeItem('aswaq_current_user');
  localStorage.removeItem('aswaq_access_token');
  localStorage.removeItem('aswaq_refresh_token');
  return null;
}

/**
 * Wrapper for fetch that automatically injects the Authorization header
 * and handles 401 Unauthorized by attempting a token refresh and retrying.
 */
export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers || {});
  const token = localStorage.getItem('aswaq_access_token') || localStorage.getItem('auth_token');

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let response = await fetch(url, { ...options, headers });

  if (response.status === 401) {
    if (!isRefreshing) {
      isRefreshing = true;
      const newToken = await refreshAccessToken();
      isRefreshing = false;

      if (newToken) {
        onRefreshed(newToken);
        headers.set('Authorization', `Bearer ${newToken}`);
        return fetch(url, { ...options, headers });
      }
    } else {
      // Wait for the ongoing refresh to complete
      const newToken = await new Promise<string | null>((resolve) => {
        subscribeTokenRefresh((t) => resolve(t));
      });

      if (newToken) {
        headers.set('Authorization', `Bearer ${newToken}`);
        return fetch(url, { ...options, headers });
      }
    }
  }

  return response;
}
