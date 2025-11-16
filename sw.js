/* sw.js - Service Worker (basic PWA background features)
   - caching (app shell)
   - fetch fallback
   - periodic background tasks: uses periodicSync if supported (experimental)
   - push event handler (requires server to actually send pushes)
*/

const CACHE_NAME = 'jarvis-v1';
const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './jarvis.js',
  './manifest.json',
  './icon-192x192.png',
  './icon-512x512.png'
];

self.addEventListener('install', evt => {
  evt.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(APP_SHELL);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', evt => {
  evt.waitUntil(self.clients.claim());
});

// fetch: respond with cache-first for app shell, network-first for API
self.addEventListener('fetch', evt => {
  const url = new URL(evt.request.url);
  // API calls: try network then fallback to cache
  if (url.pathname.includes('/data') || url.hostname.includes('api.')) {
    evt.respondWith(fetch(evt.request).catch(() => caches.match(evt.request)));
    return;
  }
  // default: cache-first
  evt.respondWith(
    caches.match(evt.request).then(cached => cached || fetch(evt.request).then(resp => {
      // optionally cache dynamic assets
      return resp;
    })).catch(() => caches.match('./'))
  );
});

// push: show notification when server sends push (requires server)
self.addEventListener('push', event => {
  let data = {};
  if (event.data) data = event.data.json();
  const title = data.title || 'Jarvis Notification';
  const options = {
    body: data.body || 'You have a message from Jarvis',
    icon: './icons/icon-192x192.png',
    badge: './icons/icon-192x192.png',
    data: data
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// notificationclick
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(clients.matchAll({ type: 'window' }).then( clientList => {
    if (clientList.length > 0) return clientList[0].focus();
    return clients.openWindow('/');
  }));
});

// periodic sync (experimental) — used if registered from page
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'jarvis-periodic') {
    event.waitUntil(doPeriodicWork());
  }
});

async function doPeriodicWork() {
  // Example: fetch a small endpoint to get latest headlines
  try {
    // Note: you need a server proxy to safely call news/weather APIs with keys
    const resp = await fetch('/api/jarvis/poll'); // <-- your server endpoint
    if (!resp.ok) return;
    const data = await resp.json();
    if (data.notify) {
      await self.registration.showNotification(data.title || 'Jarvis', { body: data.body });
    }
  } catch (e) {
    // silent
  }
}