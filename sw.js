// ==========================================================================
// 🚀 NH POS — TURBO SERVICE WORKER (v4.5.0)
// ✅ Ultra-lean App Shell pre-caching (No network choke on install)
// ✅ Dynamic Subpath & Scope resolution (GitHub Pages /nhsm/ & Netlify root)
// ✅ Instant Stale-While-Revalidate caching for lightning-fast loads
// ✅ Zero lag navigation with fast fallback & Anti-Corruption Guard
// ==========================================================================

const CACHE_NAME = 'nhpos-pwa-v5.0.0-turbo';

// Core essential App Shell only (pre-cache in < 0.5s without bandwidth flood)
const RELATIVE_SHELL_ASSETS = [
  '',
  'manifest.json',
  'nh-pos-splash.jpg',
  'icon-192.png',
  'icon-512.png',
  'icon-1024.png',
  'icon-maskable-512.png',
  'apple-touch-icon.png',
  'auth.html',
  'dashboard.html',
  'auth.css',
  'panels.css',
  'dark-theme.css',
  'theme-sync.js',
  'saas-modules.js',
  'sidebar.js',
  'image-optimizer.js'
];

// 1️⃣ Install: Quickly cache only core shell assets resolved against active scope
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      const scopeUrl = self.registration.scope;
      const targetAssets = RELATIVE_SHELL_ASSETS.map((asset) => {
        try {
          return new URL(asset, scopeUrl).toString();
        } catch (_) {
          return asset;
        }
      });

      const promises = targetAssets.map((assetUrl) => {
        return cache.add(assetUrl).catch((err) => {
          console.warn(`[PWA SW v4.5.0] Pre-cache skipped for ${assetUrl}:`, err.message);
        });
      });
      return Promise.all(promises);
    })
  );
  self.skipWaiting();
});

// 2️⃣ Activate: Purge all obsolete cache versions immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => {
          console.log('[PWA SW v4.5.0] Purged outdated cache:', key);
          return caches.delete(key);
        })
      );
    })
  );
  self.clients.claim();
});

// 3️⃣ Fetch: High-speed Network & Cache Routing
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Bypass internal dev bundling paths & external auth APIs
  if (
    url.pathname.startsWith('/@') ||
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/node_modules/') ||
    url.origin.includes('firestore.googleapis.com') ||
    url.origin.includes('identitytoolkit.googleapis.com') ||
    url.origin.includes('securetoken.googleapis.com') ||
    url.pathname.includes('/__/auth') ||
    url.pathname.startsWith('/api/') ||
    url.pathname.includes('/.netlify/functions')
  ) {
    return;
  }

  // A. Navigation (HTML Pages): Fast Network with quick Cache fallback
  if (event.request.mode === 'navigate' || event.request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      (async () => {
        try {
          // Fast network fetch with 2s timeout
          const networkPromise = fetch(event.request);
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Network timeout')), 2000)
          );

          const response = await Promise.race([networkPromise, timeoutPromise]);
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        } catch (_) {
          // Network slow or offline: Serve cached HTML immediately
          const cached = await caches.match(event.request);
          if (cached) return cached;
          const scopeUrl = self.registration.scope;
          const fallbackDash = new URL('dashboard.html', scopeUrl).toString();
          const fallbackAuth = new URL('auth.html', scopeUrl).toString();
          return (await caches.match(fallbackDash)) || 
                 (await caches.match(fallbackAuth)) ||
                 (await caches.match('/dashboard.html')) ||
                 (await caches.match('/auth.html'));
        }
      })()
    );
    return;
  }

  // B. Static Assets (JS, CSS, Images, Fonts): Anti-Corruption Guard
  event.respondWith(
    (async () => {
      const cachedResponse = await caches.match(event.request);
      if (cachedResponse) {
        const ct = cachedResponse.headers.get('content-type') || '';
        // If an HTML fallback was incorrectly stored for a script/stylesheet, delete it immediately
        if (ct.includes('text/html')) {
          const cache = await caches.open(CACHE_NAME);
          await cache.delete(event.request);
        } else {
          // Valid asset: background update (Stale-While-Revalidate)
          fetch(event.request)
            .then(async (networkResponse) => {
              if (
                networkResponse &&
                networkResponse.status === 200 &&
                !(networkResponse.headers.get('content-type') || '').includes('text/html')
              ) {
                const cache = await caches.open(CACHE_NAME);
                await cache.put(event.request, networkResponse.clone());
              }
            })
            .catch(() => {});
          return cachedResponse;
        }
      }

      // Fetch fresh from network
      try {
        const networkResponse = await fetch(event.request);
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          !(networkResponse.headers.get('content-type') || '').includes('text/html')
        ) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(event.request, networkResponse.clone());
        }
        return networkResponse;
      } catch (err) {
        return cachedResponse || new Response('', { status: 408 });
      }
    })()
  );
});

// 4️⃣ Background Sync / Push Skip Waiting
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
