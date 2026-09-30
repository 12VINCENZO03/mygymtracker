// public/sw.js
const CACHE_NAME = 'mygym-cache-v5';
const ASSETS = [
  '/',
  '/index.html',
  '/timer-end.mp3',
  '/beep.mp3',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Installazione tollerante: se fallisce un file (es. un'icona manca), salva gli altri
      return Promise.allSettled(
        ASSETS.map(url => cache.add(url).catch(err => console.warn(`Cache fallita per ${url}:`, err)))
      );
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Strategia Stale-While-Revalidate
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkResponse.clone());
          });
        }
        return networkResponse;
      }).catch(() => {
        // Ignora l'errore di rete se siamo offline
      });
      return cachedResponse || fetchPromise;
    })
  );
});
