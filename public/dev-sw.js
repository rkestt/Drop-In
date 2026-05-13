// DEV SERVICE WORKER - network-first for JS/CSS, cache-first for pages only
const DEV_SW_VERSION = 'dev-v4';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((names) =>
        Promise.all(names.map((n) => caches.delete(n)))
      )
    ])
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API calls: network only
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // JavaScript and CSS: NEVER cache in dev (always fresh)
  if (url.pathname.match(/\.(js|css)$/)) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Static assets (images, fonts): network with cache
  if (url.pathname.match(/\.(png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot)$/)) {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match(event.request)
      )
    );
    return;
  }

  // Pages (HTML): cache first for offline testing
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match('/')
      )
    );
    return;
  }

  // Everything else: network first
  event.respondWith(fetch(event.request));
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
    self.clients.claim();
  }
});