// DailyOS service worker. Deliberately small:
//
// - Hashed build assets (/_next/static) are immutable, so they are served
//   cache-first once seen. That makes repeat loads fast and lets the offline
//   page render with the app's fonts and styles.
// - Page navigations always go to the network. Only when the network fails
//   does the user get /offline.html. Pages are never cached: they carry
//   private data, and a stale signed-in page is worse than an offline notice.
// - Everything else (API routes, Server Action POSTs, auth) is not touched.
//
// Bump VERSION to drop old caches on the next activation.
const VERSION = "v1";
const STATIC_CACHE = `dailyos-static-${VERSION}`;
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL, "/icon.svg"]))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k.startsWith("dailyos-") && k !== STATIC_CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          })
      )
    );
  }
});
