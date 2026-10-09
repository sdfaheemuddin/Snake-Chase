/* Offline-first service worker. Every asset URL is relative to this PWA's scope,
 * so GitHub Pages works at both / and /repository-name/ without edits. */
const CACHE_PREFIX = 'snake-chase-pwa-';
const CACHE_NAME = `${CACHE_PREFIX}v3`;
const FILES = [
  './',
  './index.html',
  './styles.css',
  './game-config.json',
  './manifest.webmanifest',
  './src/config.js',
  './src/game-engine.js',
  './src/renderer.js',
  './src/share.js',
  './src/app.js',
  './assets/favicon.svg',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/icon-maskable-512.png',
  './assets/apple-touch-icon.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(FILES.map(path => new URL(path, self.registration.scope).href)))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(names.filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME).map(name => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin) return;
  if (!requestUrl.href.startsWith(self.registration.scope)) return;

  // Public game settings must update online; keep the last good version for offline PWA play.
  if (requestUrl.pathname.endsWith('/game-config.json')) {
    event.respondWith(fetch(new Request(request, { cache: 'no-store' }))
      .then(response => {
        if (response.ok) {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(request, copy)));
        }
        return response;
      })
      .catch(async () => (await caches.match(request)) || (await caches.match(new URL('./game-config.json', self.registration.scope).href))));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(request, copy)));
          }
          return response;
        })
        .catch(async () => (await caches.match(request)) || (await caches.match(new URL('./index.html', self.registration.scope).href))),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request).then(response => {
      if (response.ok) {
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(request, copy)));
      }
      return response;
    })),
  );
});
