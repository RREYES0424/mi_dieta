// Modo sin conexión: guarda los archivos de la app y los sirve si no hay internet.
// Primero intenta la red (para recibir actualizaciones) y si falla usa la copia guardada.
const CACHE = 'mi-dieta-v4';
const FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './js/app.js',
  './js/nav.js',
  './js/store.js',
  './js/sync.js',
  './js/units.js',
  './js/calc.js',
  './js/ui.js',
  './js/views/hoy.js',
  './js/views/dieta.js',
  './js/views/platillos.js',
  './js/views/ingredientes.js',
  './js/views/compras.js',
  './js/views/progreso.js',
  './js/tracking.js',
  './js/prices.js',
  './js/reminders.js',
  './js/tutorial.js',
  './js/views/buscar.js',
  './js/views/papelera.js',
  './js/views/versiones.js',
  './js/views/gastos.js',
  './js/views/ajustes.js',
  './js/views/mas.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // La API de GitHub nunca se guarda.
  event.respondWith(
    fetch(req)
      .then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('./index.html'))),
  );
});

// Al tocar un recordatorio, abre la app en "Hoy".
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || './#/hoy';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if ('focus' in c) {
          c.navigate && c.navigate(url).catch(() => {});
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
