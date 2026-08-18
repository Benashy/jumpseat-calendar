const CACHE_NAME = "jumpseat-calendar-v101";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css?v=cloud-sync-85",
  "./supabase-config.js?v=cloud-sync-85",
  "./ltot-core.js?v=cloud-sync-85",
  "./data-portability.js?v=cloud-sync-85",
  "./request-retention.js?v=cloud-sync-85",
  "./app.js?v=cloud-sync-85",
  "./manifest.webmanifest?v=cloud-sync-85",
  "./icons/opsdeck-logo.svg?v=opsdeck-wings-1",
  "./icons/opsdeck-wordmark.svg?v=cloud-sync-85",
  "./icons/icon-192.png?v=opsdeck-wings-1",
  "./icons/icon-512.png?v=opsdeck-wings-1",
  "./icons/apple-touch-icon.png?v=opsdeck-wings-1"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const request = event.request;
  const acceptsHtml = request.headers.get("accept")?.includes("text/html");

  if (request.mode === "navigate" || acceptsHtml) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match("./index.html")))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request))
  );
});
