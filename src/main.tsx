import {createRoot} from 'react-dom/client';
import './i18n.ts';
import App from './App.tsx';
import ComingSoon from './components/ComingSoon.tsx';
import './index.css';
import { ThemeProvider } from './context/ThemeContext.tsx';
import { MarketProvider } from './context/MarketContext.tsx';
import { Capacitor } from '@capacitor/core';
import { getDeviceLocation } from './lib/native.ts';
import { API_ORIGIN } from './lib/config.ts';

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

createRoot(document.getElementById('root')!).render(
  <ThemeProvider>
    <MarketProvider>
      {false ? ( // Hardcoded to false to override any Vercel maintenance variable settings
        <ComingSoon />
      ) : (
        <App />
      )}
    </MarketProvider>
  </ThemeProvider>,
);
