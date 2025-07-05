// Basic service worker for offline support
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open('vault-cache').then(cache => cache.addAll([
      '',
      'index.html',
      'app.js',
      'manifest.json',
      // add other assets as needed
    ]))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});