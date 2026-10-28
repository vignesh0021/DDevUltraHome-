/**
 * DDevUltraHome Production Offline Service Worker (PWA)
 * - Network-First for Navigation to prevent stale HTML/JS lock-in
 * - Stale-While-Revalidate for CSS, JS, and Static Assets for instant loading + background updates
 * - Full offline caching for all 19 civil engineering engines and rate intelligence
 * - Safe Cache API usage (zero POST caching attempts)
 */

const CACHE_NAME = 'ddevultrahome-v4';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/js/app.js',
  '/js/apiClient.js',
  '/js/i18n.js',
  '/js/ai/civilExpertEngine.js',
  '/js/ai/provider.js',
  '/js/engine/antitermite.js',
  '/js/engine/bbs.js',
  '/js/engine/boq.js',
  '/js/engine/cmdafee.js',
  '/js/engine/concrete.js',
  '/js/engine/durability.js',
  '/js/engine/earthwork.js',
  '/js/engine/finishing.js',
  '/js/engine/formwork.js',
  '/js/engine/geotech.js',
  '/js/engine/labour.js',
  '/js/engine/masonry.js',
  '/js/engine/math.js',
  '/js/engine/mbook.js',
  '/js/engine/milestones.js',
  '/js/engine/pile.js',
  '/js/engine/plinth.js',
  '/js/engine/qc.js',
  '/js/engine/rcc.js',
  '/js/engine/rwh.js',
  '/js/engine/septictank.js',
  '/js/engine/tncdbr.js',
  '/js/engine/wastage.js',
  '/js/engine/watertank.js',
  '/js/intelligence/materialRates.js',
  '/js/intelligence/scrapRates.js',
  '/js/intelligence/scrapValuation.js'
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
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Non-GET requests (e.g. POST calculations or updates): Never cache in Cache API
  if (request.method !== 'GET') {
    return;
  }

  // 1. Navigation requests (HTML pages): Network-First with Cache Fallback
  // Prevents users from being locked onto old versions when app is updated online
  if (request.mode === 'navigate' || (request.headers.get('accept') && request.headers.get('accept').includes('text/html'))) {
    event.respondWith(
      (async () => {
        try {
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Navigation network timeout')), 2500)
          );
          const networkResponse = await Promise.race([fetch(request), timeoutPromise]);
          if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(CACHE_NAME);
            cache.put('/index.html', networkResponse.clone());
            return networkResponse;
          }
        } catch (err) {
          // Network failed or timed out -> Fall back to cached HTML
        }
        const cached = await caches.match('/index.html');
        return cached || new Response('Offline: DDevUltraHome is available once cached.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain' }
        });
      })()
    );
    return;
  }

  // 2. Read-Only API Endpoints (e.g. /api/rates, /api/districts, /api/scrap/rates):
  // Network-First with Cache Fallback so online gets live rates, while offline remains functional
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
            return networkResponse;
          }
        } catch (err) {
          // Server offline
        }
        const cached = await caches.match(request);
        if (cached) {
          // Add header indicating cached/offline provenance
          const headers = new Headers(cached.headers);
          headers.set('X-Data-Source', 'ServiceWorker-OfflineCache');
          return new Response(cached.body, {
            status: cached.status,
            statusText: cached.statusText,
            headers
          });
        }
        return new Response(JSON.stringify({ error: 'Offline and not cached', offline: true }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      })()
    );
    return;
  }

  // 3. Static Assets (CSS, JS, Fonts, Images): Stale-While-Revalidate
  // Instant response from cache for maximum speed + background update for freshness
  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      const fetchPromise = fetch(request).then(async (networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const cache = await caches.open(CACHE_NAME);
          cache.put(request, networkResponse.clone());
        }
        return networkResponse;
      }).catch(() => null);

      return cached || (await fetchPromise) || new Response('', { status: 404 });
    })()
  );
});
