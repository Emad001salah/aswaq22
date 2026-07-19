const CACHE_NAME = 'aswaq-pwa-cache-v2';
const ASSETS_TO_CACHE = [
  '/aswaq-icon.png',
  '/aswaq-icon-192.png',
  '/aswaq-icon-512.png',
  '/manifest.json',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.css',
  'https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.Default.css',
  'https://unpkg.com/leaflet.markercluster@1.4.1/dist/leaflet.markercluster.js'
];

// Install Event - Pre-cache essential app shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching Core Offline Shell...');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event - Clean up stale cache versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Removing stale cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Handle off-grid caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Exclude API routes, Live streams, Socket.io, and non-HTTP(S) schemes (e.g. chrome-extension://)
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/socket') || request.method !== 'GET' || !url.protocol.startsWith('http')) {
    return; // Pass through to standard browser fetch
  }

  // Bypass service worker cache completely for the main HTML file to prevent broken asset hashes
  if (url.pathname === '/' || url.pathname === '/index.html') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html') || caches.match('/'))
    );
    return;
  }

  // Caching Strategy: Stale-While-Revalidate for app assets, Network-First for main documents
  if (ASSETS_TO_CACHE.includes(url.pathname) || url.pathname.endsWith('.js') || url.pathname.endsWith('.css') || url.hostname.includes('unpkg.com')) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        }).catch(() => null);

        return cachedResponse || fetchPromise;
      })
    );
  } else {
    // Default Cache Strategy: Network first, fallback to cached offline shell
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200 && !url.pathname.startsWith('/src/')) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cachedResponse) => {
            return cachedResponse || caches.match('/');
          });
        })
    );
  }
});
