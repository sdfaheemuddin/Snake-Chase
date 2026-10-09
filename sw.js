/* Offline-first service worker. Every asset URL is relative to this PWA's scope,
 * so GitHub Pages works at both / and /repository-name/ without edits. */
const CACHE_PREFIX = 'snake-chase-pwa-';
const CACHE_NAME = `${CACHE_PREFIX}v12`;
const FILES = [
  './',
  './index.html',
  './styles.css?v=12',
  './game-config.json',
  './manifest.webmanifest',
  './src/config.js?v=10',
  './src/game-engine.js?v=10',
  './src/renderer.js?v=11',
  './src/share.js?v=12',
  './src/score-stats.js?v=12',
  './src/app.js?v=12',
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

// Network-first for ALL app assets. Previously, JS/CSS were cache-first, causing
// a newly deployed HTML shell to run older game logic (wrong speed/life rules).
// Offline play is preserved by falling back to the last complete asset cache.
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;

  event.respondWith((async () => {
    try {
      const fresh = await fetch(new Request(request, { cache: 'no-cache' }));
      if (fresh.ok) {
        const copy = fresh.clone();
        event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(request, copy)));
      }
      return fresh;
    } catch (error) {
      // For navigation, an offline page uses the complete pre-cached application.
      const cached = await caches.match(request, { ignoreSearch: true });
      if (cached) return cached;
      if (request.mode === 'navigate') {
        const fallback = await caches.match(new URL('./index.html', self.registration.scope).href);
        if (fallback) return fallback;
      }
      return Response.error();
    }
  })());
});
