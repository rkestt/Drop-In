// DEV SERVICE WORKER - cache pages for offline testing
const DEV_SW_VERSION = 'dev-v3';

const CACHE_NAME = 'dev-dropin-' + DEV_SW_VERSION;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((names) =>
        Promise.all(
          names
            .filter((n) => n.startsWith('dev-dropin-') && n !== CACHE_NAME)
            .map((n) => caches.delete(n))
        )
      )
    ])
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API calls: network only
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(JSON.stringify({ error: 'offline' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }

  // Pages and static: cache first, then network
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(event.request).then((networkResponse) => {
        if (networkResponse.ok) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Network failed, try to serve something
        if (event.request.mode === 'navigate') {
          // Return cached root or offline message
          return caches.match('/').then((root) => {
            return root || new Response(
              '<html><body style="font-family:sans-serif;padding:20px"><h1>Offline Mode</h1><p>You are offline. Refresh when connected.</p></body></html>',
              { headers: { 'Content-Type': 'text/html' } }
            );
          });
        }
        return new Response('', { status: 503 });
      });
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
    self.clients.claim();
  }
  if (event.data?.type === 'FORCE_UPDATE') {
    self.skipWaiting();
    self.clients.claim();
  }
});