const CACHE_NAME = 'indicativos-runtime-v2';
const DATA_URL = '/data/indicativos.pb.gz';
const VERSION_URL = '/version.json';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.add(new Request('/', { cache: 'reload' }));
      const response = await fetch(DATA_URL, { cache: 'no-store' });
      if (response.ok) await cache.put(DATA_URL, response);
    }),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== 'GET') return;
  if (url.pathname === VERSION_URL) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          if (
            response.ok &&
            (url.pathname.startsWith('/_next/static/') ||
              url.pathname === '/' ||
              url.pathname === DATA_URL)
          ) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => cached || new Response('Offline', { status: 503 }));
    }),
  );
});
