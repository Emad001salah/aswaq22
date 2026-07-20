import React, { Component } from 'react';
import {createRoot} from 'react-dom/client';
import './i18n.ts';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import App from './App.tsx';
import ComingSoon from './components/ComingSoon.tsx';
import './index.css';
import { ThemeProvider } from './context/ThemeContext.tsx';
import { MarketProvider } from './context/MarketContext.tsx';
import { Capacitor } from '@capacitor/core';
import { getDeviceLocation } from './lib/native.ts';
import { API_ORIGIN } from './lib/config.ts';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  public static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  public componentDidCatch(error: any, errorInfo: any) {
    console.error('[Aswaq ErrorBoundary] Caught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          backgroundColor: '#090d16',
          color: '#f1f5f9',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          textAlign: 'center'
        }}>
          <div style={{
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '16px',
            padding: '32px 24px',
            maxWidth: '420px',
            width: '100%',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🛍️</div>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '12px' }}>مرحباً بك في أسواق</h2>
            <p style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '24px', lineHeight: '1.6' }}>
              حدث استجابة غير متوقعة أثناء التحميل. انقر أدناه لإعادة تشغيل المنصة وسحب النسخة المحدثة.
            </p>
            <button
              onClick={() => {
                try {
                  localStorage.clear();
                  sessionStorage.clear();
                  if ('caches' in window) {
                    caches.keys().then(names => {
                      names.forEach(name => caches.delete(name));
                    });
                  }
                  if ('serviceWorker' in navigator) {
                    navigator.serviceWorker.getRegistrations().then(regs => {
                      regs.forEach(r => r.unregister());
                    });
                  }
                } catch (_) {}
                window.location.href = '/?reload=' + Date.now();
              }}
              style={{
                width: '100%',
                backgroundColor: '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: '12px',
                padding: '12px 20px',
                fontSize: '15px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              تحديث المنصة 🔄
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

if (Capacitor.isNativePlatform()) {
  if (window.location.pathname && window.location.pathname.includes('/api/')) {
    window.location.replace('/');
  }
  document.documentElement.classList.add('native-platform');

  // Polyfill geolocation since browser disables it on HTTP origins (http://localhost)
  if (!(navigator as any).geolocation) {
    try {
      Object.defineProperty(navigator, 'geolocation', {
        value: {},
        writable: true,
        configurable: true
      });
    } catch (e) {
      (navigator as any).geolocation = {};
    }
  }
  navigator.geolocation.getCurrentPosition = function(success, error, options) {
    getDeviceLocation()
      .then(coords => {
        success({
          coords: {
            latitude: coords.lat,
            longitude: coords.lng,
            accuracy: 10,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null
          },
          timestamp: Date.now()
        } as any);
      })
      .catch(err => {
        if (error) error(err);
      });
  };

  const API_BASE_URL = API_ORIGIN;
  const originalFetch = window.fetch;
  window.fetch = function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    if (typeof input === 'string' && input.startsWith('/')) {
      input = API_BASE_URL + input;
    }
    return originalFetch.call(this, input, init);
  };
}

let csrfToken: string | null = null;
let csrfFetching = false;

async function ensureCsrfToken(): Promise<string | null> {
  if (csrfToken) return csrfToken;
  if (csrfFetching) return null;
  csrfFetching = true;
  try {
    const res = await fetch('/api/csrf-token', { method: 'GET' });
    if (res.ok) {
      const data = await res.json();
      csrfToken = data.csrfToken;
    }
  } catch (e) {
    // ignore
  } finally {
    csrfFetching = false;
  }
  return csrfToken;
}

const appOriginalFetch = window.fetch;
window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const method = (init?.method || (typeof input === 'string' ? 'GET' : 'GET')).toUpperCase();
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && typeof input === 'string' && input.startsWith('/api/')) {
    const token = await ensureCsrfToken();
    if (token) {
      init = {
        ...init,
        headers: {
          ...(init?.headers || {}),
          'x-csrf-token': token,
        }
      } as RequestInit;
    }
  }
  return appOriginalFetch.call(this, input, init);
};

// Register PWA Service Worker
if (import.meta.env.VITE_MAINTENANCE_MODE !== 'true' && 'serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('Aswaq ServiceWorker registered successfully with scope: ', registration.scope);
      })
      .catch((error) => {
        console.error('Aswaq ServiceWorker registration failed: ', error);
      });
  });
}

const RouterComponent = Capacitor.isNativePlatform() ? HashRouter : BrowserRouter;

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <ThemeProvider>
      <MarketProvider>
        <RouterComponent>
          {false ? ( // Hardcoded to false to override any Vercel maintenance variable settings
            <ComingSoon />
          ) : (
            <App />
          )}
        </RouterComponent>
      </MarketProvider>
    </ThemeProvider>
  </ErrorBoundary>,
);
