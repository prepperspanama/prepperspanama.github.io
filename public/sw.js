const CACHE_NAME = 'preppers-panama-v2';
const STATIC_ASSETS = [
  '/',
  '/blog/',
  '/mapa/',
  '/blog/kit-de-emergencia-sismica/',
  '/blog/importancia-del-botiquin/',
  '/blog/el-nino-y-su-impacto-en-panama/',
  '/blog/microclimas-y-riesgos-en-panama/',
  '/blog/que-es-ser-prepper/',
  '/blog/estado-de-emergencia-terremoto-panama/',
  '/blog/que-hacer-antes-durante-despues-de-un-sismo/',
  '/blog/terremoto-panama-9-octubre-2026/',
  '/blog/ansiedad-y-salud-mental-despues-de-un-sismo/',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET' || !url.origin.startsWith(self.location.origin)) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/')))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request).then((response) => {
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      });
      return cached || fetchPromise;
    })
  );
});
