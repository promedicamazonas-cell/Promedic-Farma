// Service Worker - ProMedic Amazonas
const CACHE = 'promedic-v2';

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // IMPORTANTE: nunca interceptar ni cachear datos externos (Google Sheets, imágenes de Imgur, etc.).
  // Siempre van directo a la red para que el catálogo y las promos estén frescos.
  if (url.hostname !== self.location.hostname) return;

  // Solo el "cascarón" de la app (index.html, manifest) usa estrategia network-first.
  e.respondWith(
    fetch(e.request)
      .then((resp) => {
        const copy = resp.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return resp;
      })
      .catch(() => caches.match(e.request))
  );
});
