/*
 * Runner service worker — makes the installed app start and work offline.
 *
 * A plain script served as-is from /sw.js (no bundler step), registered in
 * production only by src/app/offline/serviceWorker.ts. Bump VERSION whenever
 * the caching strategy changes; hashed build assets need no bumping.
 *
 *   /_next/static/*          cache-first (content-hashed, immutable)
 *   page navigations         network-first → cached page → /offline.html
 *   RSC payloads (RSC: 1)    network-first → cached payload → network error
 *                            (Next.js then falls back to a full navigation,
 *                            which the rule above serves)
 *   GET /api reads + session network-first → cached response
 *   everything else          untouched (writes go through the app's own
 *                            offline queue, not through here)
 *
 * "Network-first" gives up on the network after NETWORK_TIMEOUT_MS when a
 * cached copy exists — gym Wi-Fi that's connected but not really online is
 * the common case — and still refreshes the cache in the background.
 */

const VERSION = 'v1';
// Anything user-specific lives under this prefix so the app can wipe it on
// sign-out / account switch. Must match src/app/offline/serviceWorker.ts.
const USER_CACHE_PREFIX = 'runner-user-';
const STATIC_CACHE = `runner-static-${VERSION}`;
const SHELL_CACHE = `runner-shell-${VERSION}`;
const PAGES_CACHE = `${USER_CACHE_PREFIX}pages-${VERSION}`;
const RSC_CACHE = `${USER_CACHE_PREFIX}rsc-${VERSION}`;
const API_CACHE = `${USER_CACHE_PREFIX}api-${VERSION}`;
const CURRENT_CACHES = [STATIC_CACHE, SHELL_CACHE, PAGES_CACHE, RSC_CACHE, API_CACHE];

const OFFLINE_URL = '/offline.html';
const SHELL_URLS = [
  OFFLINE_URL,
  '/manifest.webmanifest',
  '/favicon.ico',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];
const WARM_ASSETS_KEY = '/__runner/warm-assets';

const NETWORK_TIMEOUT_MS = 4000;
const RSC_CACHE_MAX_ENTRIES = 120;

/** Pages that must never be served from cache (they'd show a stale auth state). */
const UNCACHEABLE_PAGES = /^\/(login|register)(\/|$)/;
const CACHEABLE_API = /^\/api\/(auth\/session|programs(\/[^/]+)?|user-settings|runs(\/[^/]+)?)$/;
const STATIC_ASSET_REF = /\/_next\/static\/[^"'\s\\)<>]+/g;

// ─── Lifecycle ────────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith('runner-') && !CURRENT_CACHES.includes(name))
          .map((name) => caches.delete(name))
      );
      if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
      await self.clients.claim();
    })()
  );
});

// ─── Routing ──────────────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }
  if (url.pathname.startsWith('/_next/')) return;

  if (url.pathname.startsWith('/api/')) {
    if (CACHEABLE_API.test(url.pathname)) {
      event.respondWith(networkFirst(event, API_CACHE, url.href, isOkResponse));
    }
    return;
  }

  if (request.headers.get('RSC') === '1') {
    event.respondWith(networkFirst(event, RSC_CACHE, url.href, isRscResponse, RSC_CACHE_MAX_ENTRIES));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(event, url));
    return;
  }

  if (SHELL_URLS.includes(url.pathname)) {
    event.respondWith(staleWhileRevalidate(event, SHELL_CACHE));
  }
});

// ─── Strategies ───────────────────────────────────────────────────────────────

function isOkResponse(response) {
  return response.ok && response.type === 'basic' && !response.redirected;
}

function isRscResponse(response) {
  return isOkResponse(response) && (response.headers.get('Content-Type') || '').startsWith('text/x-component');
}

function isCacheablePage(pathname, response) {
  return (
    !UNCACHEABLE_PAGES.test(pathname) &&
    isOkResponse(response) &&
    (response.headers.get('Content-Type') || '').startsWith('text/html')
  );
}

/**
 * Tells open pages whether real requests are reaching the server. Once this
 * worker answers from cache, the page itself can't tell it's offline — and
 * navigator.onLine stays true on Wi-Fi without a working uplink.
 */
function reportNetwork(online) {
  self.clients
    .matchAll({ type: 'window', includeUncontrolled: true })
    .then((clients) => clients.forEach((client) => client.postMessage({ type: 'NETWORK', online })))
    .catch(() => {});
}

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
}

async function put(cacheName, key, response, maxEntries) {
  try {
    const cache = await caches.open(cacheName);
    await cache.put(key, response);
    if (maxEntries) {
      const keys = await cache.keys();
      await Promise.all(keys.slice(0, Math.max(0, keys.length - maxEntries)).map((k) => cache.delete(k)));
    }
  } catch {
    // Quota exceeded or an uncacheable response — serving it is what matters.
  }
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request, { cacheName, ignoreVary: true });
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok && response.type === 'basic') await put(cacheName, request, response.clone());
  return response;
}

/**
 * Races the network against NETWORK_TIMEOUT_MS; on failure or timeout serves
 * the cached copy if there is one, otherwise keeps waiting for (or rejects
 * with) the network. Successful responses always refresh the cache.
 */
async function networkFirst(event, cacheName, key, cacheable, maxEntries, networkRequest) {
  const network = (async () => {
    let response;
    try {
      response = await (networkRequest ? networkRequest() : fetch(event.request));
    } catch (error) {
      reportNetwork(false);
      throw error;
    }
    reportNetwork(true);
    if (cacheable(response)) await put(cacheName, key, response.clone(), maxEntries);
    return response;
  })();
  event.waitUntil(network.catch(() => {}));

  try {
    return await Promise.race([network, timeout(NETWORK_TIMEOUT_MS)]);
  } catch {
    const cached = await caches.match(key, { cacheName, ignoreVary: true });
    return cached || network;
  }
}

async function handleNavigation(event, url) {
  const key = url.origin + url.pathname;
  const fromNetwork = async () => (await event.preloadResponse) || fetch(event.request);
  try {
    return await networkFirst(
      event,
      PAGES_CACHE,
      key,
      (response) => isCacheablePage(url.pathname, response),
      undefined,
      fromNetwork
    );
  } catch {
    return (await caches.match(OFFLINE_URL, { cacheName: SHELL_CACHE })) || Response.error();
  }
}

async function staleWhileRevalidate(event, cacheName) {
  const cached = await caches.match(event.request, { cacheName, ignoreVary: true });
  const network = fetch(event.request).then(async (response) => {
    if (isOkResponse(response)) await put(cacheName, event.request, response.clone());
    return response;
  });
  event.waitUntil(network.catch(() => {}));
  return cached || network;
}

// ─── Pre-caching ("warm") ─────────────────────────────────────────────────────
//
// Once signed in and online, the app posts { type: 'WARM', urls } with its
// main routes and API reads. Each page is fetched and cached along with every
// build asset its HTML references (scripts, CSS, and the fonts that CSS
// references), so the whole app opens offline — not just pages visited before.

self.addEventListener('message', (event) => {
  const data = event.data;
  if (data && data.type === 'WARM' && Array.isArray(data.urls)) {
    event.waitUntil(warm(data.urls));
  }
});

async function warm(rawUrls) {
  const assets = new Set();
  const warmedPages = new Set();
  let complete = true;

  for (const raw of rawUrls) {
    let url;
    try {
      url = new URL(raw, self.location.origin);
    } catch {
      continue;
    }
    if (url.origin !== self.location.origin) continue;

    try {
      const response = await fetch(url.href, { credentials: 'same-origin' });
      if (url.pathname.startsWith('/api/')) {
        if (CACHEABLE_API.test(url.pathname) && isOkResponse(response)) {
          await put(API_CACHE, url.href, response);
        }
        continue;
      }
      if (!isCacheablePage(url.pathname, response)) {
        complete = false;
        continue;
      }
      const html = await response.clone().text();
      await put(PAGES_CACHE, url.origin + url.pathname, response);
      warmedPages.add(url.origin + url.pathname);
      collectAssets(html, assets);
    } catch {
      complete = false;
    }
  }

  for (const asset of [...assets]) {
    if (!asset.includes('.css')) continue;
    try {
      const css = await (await cacheFirst(new Request(asset), STATIC_CACHE)).clone().text();
      collectAssets(css, assets);
    } catch {
      complete = false;
    }
  }

  await Promise.all(
    [...assets].map((asset) =>
      cacheFirst(new Request(asset), STATIC_CACHE).catch(() => {
        complete = false;
      })
    )
  );

  if (complete && assets.size > 0) await pruneAfterDeploy(assets, warmedPages);
}

function collectAssets(text, into) {
  for (const match of text.match(STATIC_ASSET_REF) || []) {
    into.add(new URL(match, self.location.origin).href);
  }
}

/**
 * When a warm sees a different asset set than the previous one (i.e. a new
 * deploy), drop build assets referenced by neither — keeping the previous set
 * for tabs still running the old build — plus cached pages/RSC payloads that
 * weren't just refreshed, since those point at the old build.
 */
async function pruneAfterDeploy(currentAssets, warmedPages) {
  const shell = await caches.open(SHELL_CACHE);
  const previousResponse = await shell.match(WARM_ASSETS_KEY);
  const previous = previousResponse ? await previousResponse.json() : [];
  const current = [...currentAssets].sort();
  await shell.put(WARM_ASSETS_KEY, new Response(JSON.stringify(current)));

  if (previous.length === 0 || JSON.stringify(previous) === JSON.stringify(current)) return;

  const keep = new Set([...previous, ...current]);
  const staticCache = await caches.open(STATIC_CACHE);
  for (const request of await staticCache.keys()) {
    if (!keep.has(request.url)) await staticCache.delete(request);
  }
  const pages = await caches.open(PAGES_CACHE);
  for (const request of await pages.keys()) {
    if (!warmedPages.has(request.url)) await pages.delete(request);
  }
  await caches.delete(RSC_CACHE);
}
