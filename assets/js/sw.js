const CACHE_NAME = "hub-runtime-v1";
const OFFLINE_URL = "/";
// Specifically target the API worker, NOT the frontend worker
const API_HOST = "hub-community-apis.dekumar-ca.workers.dev";

self.addEventListener("install", (e) => {
  self.skipWaiting();
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

  // Ignore non-GET requests
  if (e.request.method !== "GET") return;

  // BYPASS CACHE FOR API CALLS (worker.js)
  // If the request goes to the API worker, or has /api/ in the path, let it hit the network.
  if (url.hostname === API_HOST || url.pathname.startsWith("/api/")) {
    return;
  }

  // STRATEGY A: Network-First for HTML (Pages)
  // Ensures PR merges show up immediately when the user navigates.
  if (
    e.request.mode === "navigate" ||
    e.request.headers.get("accept")?.includes("text/html")
  ) {
    e.respondWith(
      fetch(e.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, copy));
          return response;
        })
        .catch(() => {
          // If offline, serve the cached page
          return caches.match(e.request).then((cached) => {
            return cached || caches.match(OFFLINE_URL);
          });
        }),
    );
    return;
  }

  // STRATEGY B: Stale-While-Revalidate for CSS, JS, Images
  // Serves instantly from cache, updates in background for the next visit.
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
        .catch(() => {});

      return cached || fetchPromise;
    }),
  );
});
