// Nome delle cache
const STATIC_CACHE = 'static-cache-v2';
const AUDIO_CACHE  = 'audio-cache-v1';

// Asset statici da pre-cache
const STATIC_ASSETS = [
  './',
  '/index.html',
  '/library.html',
  '/app.js',
  '/library.js',
  '/app.css',
  '/manifest.json',
  // Aggiungi qui eventuali icone o font
];

// Install: pre-cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate: pulisci vecchie cache
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== STATIC_CACHE && key !== AUDIO_CACHE)
            .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch handler
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // 1) Navigazioni HTML → network-first fallback cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(res => {
          // salva una copia in cache statico
          const copy = res.clone();
          caches.open(STATIC_CACHE).then(cache => cache.put(request, copy));
          return res;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // 2) MP3 o file audio → cache-first
  if (url.pathname.includes('/storage/v1/object/mp3s/') || request.destination === 'audio') {
    event.respondWith(
      caches.open(AUDIO_CACHE).then(cache =>
        cache.match(request).then(cached => {
          if (cached) return cached;
          return fetch(request).then(networkRes => {
            cache.put(request, networkRes.clone());
            return networkRes;
          });
        })
      )
    );
    return;
  }

  // 3) Tutti gli altri asset statici → cache-first
  if (STATIC_ASSETS.includes(url.pathname) || STATIC_ASSETS.includes(url.pathname + '/')) {
    event.respondWith(
      caches.match(request).then(cached => cached || fetch(request))
    );
    return;
  }

  // 4) Fallback generico → network
  event.respondWith(fetch(request));
});
