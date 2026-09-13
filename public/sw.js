// v2: v1 cached cross-origin images cache-first with no health check, so an
// opaque CDN error (e.g. a rate-limit during a burst) was stored once and
// replayed as a broken image on every later visit. Bumping the name purges
// every visitor's poisoned cache on activate.
const CACHE_NAME = "booking-v2";
const PRE_CACHE = ["/", "/book", "/my-bookings", "/success", "/waiver"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRE_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;

  if (request.mode === "navigate") {
    e.respondWith(
      fetch(request).catch(() => caches.match(request).then((r) => r || caches.match("/")))
    );
    return;
  }

  if (request.destination === "script" || request.destination === "style" || request.destination === "image") {
    // Same-origin only. Cross-origin assets (operator photos on Supabase
    // storage, tenant logos) go straight to the network and the browser's own
    // HTTP cache — a cross-origin fetch here yields an opaque response whose
    // status is unreadable, so caching it can permanently enshrine an error.
    if (new URL(request.url).origin !== self.location.origin) return;
    e.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            // Only replayable successes go in the cache.
            if (res.ok) {
              const clone = res.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return res;
          })
      )
    );
    return;
  }
});
