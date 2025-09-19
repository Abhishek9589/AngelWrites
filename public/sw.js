const CACHE_NAME = 'angelwrites-cache-v2';
const APP_SHELL = ['/', '/index.html'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => (k === CACHE_NAME ? undefined : caches.delete(k))))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only same-origin GET requests
  if (req.method !== 'GET' || url.origin !== location.origin) return;

  const dest = req.destination;
  // Cache-first for static assets (do NOT cache JS to avoid version mismatches during dev)
  if (['style', 'image', 'font'].includes(dest)) {
    event.respondWith(
      caches.match(req).then((cached) => cached || fetch(req).then((res) => {
        const resClone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
        return res;
      }))
    );
    return;
  }

  // Always network for JS modules to avoid stale React copies
  if (dest === 'script') {
    event.respondWith(fetch(req).catch(() => caches.match(req)));
    return;
  }

  // Network-first for documents (fallback to cache)
  if (dest === 'document') {
    event.respondWith(
      fetch(req).then((res) => {
        const resClone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
        return res;
      }).catch(() => caches.match(req).then((c) => c || caches.match('/index.html')))
    );
    return;
  }
});
