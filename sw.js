const CACHE_NAME = "hub-static-v3";
const MAX_CACHE_ENTRIES = 150;
const STATIC_PATH =
  /^\/(?:assets\/(?:css|js|images|vendor|fonts)\/|manifest\.webmanifest$)/;

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                key.startsWith("hub-runtime-") ||
                (key.startsWith("hub-static-") && key !== CACHE_NAME),
            )
            .map((key) => caches.delete(key)),
        ),
      ),
      self.clients.claim(),
    ]),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const shouldCache =
    STATIC_PATH.test(url.pathname) || request.mode === "navigate";
  if (
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/") ||
    !shouldCache
  ) {
    return;
  }

  const cachePromise = caches.open(CACHE_NAME);
  const cachedPromise = cachePromise.then((cache) => cache.match(request));
  const networkPromise = fetch(request).then((response) => {
    if (response.ok && response.type === "basic") {
      return cachePromise
        .then(async (cache) => {
          await cache.put(request, response.clone());
          const keys = await cache.keys();
          const excess = keys.length - MAX_CACHE_ENTRIES;
          if (excess > 0) {
            await Promise.all(
              keys.slice(0, excess).map((key) => cache.delete(key)),
            );
          }
        })
        .then(
          () => response,
          (error) => {
            console.warn("Unable to cache static asset:", error);
            return response;
          },
        );
    }
    return response;
  });

  event.respondWith(cachedPromise.then((cached) => cached || networkPromise));
  event.waitUntil(
    cachedPromise.then((cached) =>
      cached
        ? networkPromise.then(
            () => undefined,
            (error) => {
              console.warn("Unable to refresh cached static asset:", error);
            },
          )
        : Promise.resolve(),
    ),
  );
});
