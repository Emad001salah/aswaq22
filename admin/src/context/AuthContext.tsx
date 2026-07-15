import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User } from '../types';
import { API_BASE_URL } from '../utils/api';

interface AuthContextType {
  token: string | null;
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  apiFetch: (path: string, options?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('admin_token'));
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('admin_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Parse URL params for OAuth callback
    const params = new URLSearchParams(window.location.search);
    const oauthSuccess = params.get('access_token');
    if (oauthSuccess) {
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      const userStr = params.get('user');

      if (accessToken && userStr) {
        try {
          const parsedUser = JSON.parse(decodeURIComponent(userStr));
          const role = parsedUser.role ? parsedUser.role.toLowerCase() : '';
          if (role === 'admin' || role === 'super_admin' || role === 'moderator') {
            setToken(accessToken);
            setUser(parsedUser);
            localStorage.setItem('admin_token', accessToken);
            if (refreshToken) localStorage.setItem('admin_refresh_token', refreshToken);
            localStorage.setItem('admin_user', JSON.stringify(parsedUser));
          } else {
            alert('غير مصرح لك بالدخول إلى لوحة التحكم بصفتك مستخدم عادي.');
          }
        } catch (e) {
          console.error('Failed to parse OAuth user:', e);
        }
      }
      // Clean up URL query parameters
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        throw new Error('بيانات الدخول غير صحيحة');
      }

      const data = await res.json();
      if (data.success && (data.user.role === 'admin' || data.user.role === 'super_admin' || data.user.role === 'moderator')) {
        setToken(data.accessToken);
        setUser(data.user);
        localStorage.setItem('admin_token', data.accessToken);
        localStorage.setItem('admin_refresh_token', data.refreshToken);
        localStorage.setItem('admin_user', JSON.stringify(data.user));
        return true;
      } else {
        throw new Error('غير مصرح لك بالدخول إلى لوحة التحكم');
      }
    } catch (err) {
      console.error('Login error:', err);
      throw err;
    }
  };

  const logout = async () => {
    const refreshToken = localStorage.getItem('admin_refresh_token');
    if (refreshToken) {
      try {
        await fetch(`${API_BASE_URL}/api/v1/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refreshToken }),
        });
      } catch (e) {
        console.error('Logout API call failed:', e);
      }
    }
    setToken(null);
    setUser(null);
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_refresh_token');
    localStorage.removeItem('admin_user');
  };

  // Wrapper for fetch requests to append credentials and auto refresh tokens
  const apiFetch = async (path: string, options: RequestInit = {}): Promise<Response> => {
    let currentToken = token;

    // Build headers
    const headers = new Headers(options.headers || {});
    if (currentToken) {
      headers.set('Authorization', `Bearer ${currentToken}`);
    }
    if (user?.email) {
      headers.set('x-user-email', user.email);
    }
    
    // Ensure content type defaults to json if sending body
    if (options.body && !headers.has('Content-Type') && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }

    const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
    let response = await fetch(url, { ...options, headers });

    // Handle 401 Unauthorized (Token might have expired, try to refresh)
    if (response.status === 401) {
      const refreshToken = localStorage.getItem('admin_refresh_token');
      if (refreshToken) {
        try {
          const refreshRes = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ refreshToken }),
          });

          if (refreshRes.ok) {
            const refreshData = await refreshRes.json();
            if (refreshData.success && refreshData.accessToken) {
              // Update state and storage
              setToken(refreshData.accessToken);
              localStorage.setItem('admin_token', refreshData.accessToken);
              if (refreshData.refreshToken) {
                localStorage.setItem('admin_refresh_token', refreshData.refreshToken);
              }

              // Retry original request with new token
              const retryHeaders = new Headers(options.headers || {});
              retryHeaders.set('Authorization', `Bearer ${refreshData.accessToken}`);
              if (user?.email) {
                retryHeaders.set('x-user-email', user.email);
              }
              if (options.body && !retryHeaders.has('Content-Type') && !(options.body instanceof FormData)) {
                retryHeaders.set('Content-Type', 'application/json');
              }

              response = await fetch(url, { ...options, headers: retryHeaders });
            }
          } else {
            // Refresh token expired or invalid, log out
            logout();
          }
        } catch (e) {
          console.error('Auto refresh token failed:', e);
          logout();
        }
      } else {
        logout();
      }
    }

    return response;
  };

  return (
    <AuthContext.Provider value={{ token, user, loading, login, logout, apiFetch }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
