// ==========================================================================
// 🚀 EASY BILL GENERATOR — ENTERPRISE OFFLINE SERVICE WORKER (v2.5)
// ✅ Pre-caches all HTML, CSS, JS and App Shell assets for 100% offline access
// ✅ Stale-While-Revalidate caching strategy for instant page loads
// ✅ Offline fallback for navigation requests when connection is lost
// ==========================================================================

const CACHE_NAME = 'easybill-pwa-v4.0.0';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-512.png',
  '/apple-touch-icon.png',

  // Core Pages
  '/auth.html',
  '/dashboard.html',
  '/bills.html',
  '/booker-orders.html',
  '/delivery-returns.html',
  '/customers.html',
  '/stock.html',
  '/expenses.html',
  '/alerts.html',
  '/multi-agency.html',
  '/owner.html',
  '/admin.html',
  '/reports.html',
  '/profit.html',
  '/backup.html',
  '/settings.html',
  '/profile.html',

  // CSS Stylesheets
  '/auth.css',
  '/bills.css',
  '/customers.css',
  '/stock.css',
  '/panels.css',
  '/reports.css',
  '/delivery-returns.css',
  '/dark-theme.css',

  // Scripts
  '/firebase-config.js',
  '/business-categories.js',
  '/saas-modules.js',
  '/auth.js',
  '/bills.js',
  '/bill-templates.js',
  '/booker-orders.js',
  '/customers.js',
  '/stock.js',
  '/expenses.js',
  '/delivery-returns.js',
  '/alerts.js',
  '/multi-agency.js',
  '/profit.js',
  '/reports.js',
  '/backup.js',
  '/settings.js',
  '/sidebar.js',
  '/theme-sync.js',
  '/sync-engine.js',
  '/print-settings.js',
  '/app-guard.js'
];

// 1️⃣ Install: Pre-cache all core static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Use map to catch individual failures gracefully
      const promises = STATIC_ASSETS.map((asset) => {
        return cache.add(asset).catch((err) => {
          console.warn(`[PWA SW] Pre-cache skipped for ${asset}:`, err.message);
        });
      });
      return Promise.all(promises);
    })
  );
  self.skipWaiting();
});

// 2️⃣ Activate: Clean up older cache versions immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => {
          console.log('[PWA SW] Deleting obsolete cache:', key);
          return caches.delete(key);
        })
      );
    })
  );
  self.clients.claim();
});

// 3️⃣ Fetch: Intelligent Cache Handling & Offline Fallback
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Exclude Firebase Firestore, Auth, and Google Identity APIs
  if (
    url.origin.includes('firestore.googleapis.com') ||
    url.origin.includes('identitytoolkit.googleapis.com') ||
    url.origin.includes('securetoken.googleapis.com') ||
    url.pathname.includes('/__/auth')
  ) {
    return;
  }

  // Handle Navigation requests (HTML pages)
  if (event.request.mode === 'navigate' || event.request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(async () => {
          // If offline, retrieve cached page or fallback to dashboard.html / auth.html
          const cached = await caches.match(event.request);
          if (cached) return cached;
          return (await caches.match('/dashboard.html')) || (await caches.match('/index.html'));
        })
    );
    return;
  }

  // Handle Static Assets (JS, CSS, Images, Fonts) - Stale While Revalidate
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(() => {
          // Network failed, silently return cached if present
        });

      // Return cached version immediately if available, otherwise wait for network
      return cachedResponse || fetchPromise;
    })
  );
});

// 4️⃣ Background Sync / Push Placeholder
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
