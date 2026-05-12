// DEV SERVICE WORKER - always fresh, no caching
const DEV_SW_VERSION = 'dev-' + Date.now();

// Install: skip waiting immediately
self.addEventListener('install', () => {
  self.skipWaiting();
});

// Activate: claim all clients, delete all caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then(names => Promise.all(names.map(n => caches.delete(n))))
    ])
  );
});

// Fetch: ALWAYS go to network, never use cache in dev
self.addEventListener('fetch', (event) => {
  // Network-first strategy - never cache anything
  event.respondWith(
    fetch(event.request).catch(() => {
      // If network fails, try cache as fallback
      return caches.match(event.request).then(response => {
        if (response) return response;
        // If nothing found, return empty response
        return new Response('', { status: 200 });
      });
    })
  );
});

// Message: force update on demand
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    self.clients.claim();
  }
  if (event.data && event.data.type === 'FORCE_UPDATE') {
    self.skipWaiting();
    self.clients.claim();
    caches.keys().then(names => names.forEach(n => caches.delete(n)));
  }
});