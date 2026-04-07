const CACHE_NAME = "booking-v1";
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
    e.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            return res;
          })
      )
    );
    return;
  }
});
