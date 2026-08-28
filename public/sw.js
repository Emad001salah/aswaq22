const CACHE_NAME = 'aswaq-cache-v5';
const ASSETS_TO_CACHE = [
  '/aswaq-icon.png',
  '/aswaq-icon-192.png',
  '/aswaq-icon-512.png',
  '/aswaq-icon-maskable-192.png',
  '/aswaq-icon-maskable-512.png',
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

// Activate Event - Clean up stale cache versions immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Purging stale cache version:', key);
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

  // Exclude all cross-origin requests, video/audio media, API routes, WebSockets, and non-GET requests
  if (
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api') || 
    url.pathname.startsWith('/socket') || 
    request.method !== 'GET' || 
    !url.protocol.startsWith('http') ||
    request.destination === 'video' ||
    request.destination === 'audio' ||
    request.headers.has('range') ||
    url.pathname.match(/\.(mp4|webm|ogg|mp3|wav|m4v)$/i) ||
    url.hostname.includes('vimeo.com') ||
    url.hostname.includes('youtube.com') ||
    url.hostname.includes('cloudflareinsights.com') ||
    url.hostname.includes('unsplash.com') ||
    url.hostname.includes('gstatic.com') ||
    url.hostname.includes('googleapis.com')
  ) {
    return;
  }

  // Network ONLY for HTML & JS bundle files to ensure zero stale JS bundle errors
  if (url.pathname === '/' || url.pathname === '/index.html' || url.pathname.endsWith('.js') || url.pathname.includes('/assets/')) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
    return;
  }

  // Caching Strategy: Network-First for same-origin static assets
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone).catch(() => {}));
        }
        return response;
      })
      .catch(async () => {
        const matched = await caches.match(request);
        return matched || fetch(request);
      })
  );
});

// Push Notification Event - Trigger phone alert sound and vibration even when app is in background/pocket
self.addEventListener('push', (event) => {
  let data = {
    title: 'منصة أسواق 22',
    body: 'لديك تنبيه جديد في المنصة',
    icon: '/aswaq-icon-192.png',
    badge: '/aswaq-icon-192.png',
    url: '/'
  };

  if (event.data) {
    try {
      data = Object.assign(data, event.data.json());
    } catch {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/aswaq-icon-192.png',
    badge: data.badge || '/aswaq-icon-192.png',
    vibrate: [300, 100, 300, 100, 300], // Phone vibration pattern
    tag: 'aswaq-notification',
    renotify: true,
    data: {
      url: data.url || '/'
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification Click Event - Open app window when user taps notification
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

