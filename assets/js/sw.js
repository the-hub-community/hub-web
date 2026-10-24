const CACHE_NAME = "hub-runtime-v2"; // Bumped version to force clear old caches
const API_HOST = "hub-community-apis.dekumar-ca.workers.dev";

self.addEventListener("install", (e) => {
  self.skipWaiting(); // Force the new SW to take over immediately
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      );
    }),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  if (e.request.method !== "GET") return;

  // NEVER cache API calls
  if (url.hostname === API_HOST || url.pathname.startsWith("/api/")) {
    return;
  }

  // STALE-WHILE-REVALIDATE for EVERYTHING (HTML, CSS, JS, Images)
  // 1. Return cached version instantly (0ms delay).
  // 2. Fetch new version in background and update cache for next time.
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const fetchPromise = fetch(e.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, copy));
          }
          return networkResponse;
        })
        .catch(() => {}); // Ignore network errors, rely on cache

      return cached || fetchPromise;
    }),
  );
});
