const CACHE_NAME = "jumpseat-calendar-v125";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css?v=cloud-sync-109",
  "./vendor/supabase-2.112.3.min.js?v=cloud-sync-109",
  "./supabase-config.js?v=cloud-sync-109",
  "./ltot-core.js?v=cloud-sync-109",
  "./radio-altimeter-core.js?v=cloud-sync-109",
  "./radio-altimeter-ui.js?v=cloud-sync-109",
  "./notoc-policy.js?v=cloud-sync-109",
  "./notoc-policy-store.js?v=cloud-sync-109",
  "./notoc-core.js?v=cloud-sync-109",
  "./notoc-ui.js?v=cloud-sync-109",
  "./data-portability.js?v=cloud-sync-109",
  "./request-retention.js?v=cloud-sync-109",
  "./app.js?v=cloud-sync-109",
  "./manifest.webmanifest?v=cloud-sync-109",
  "./icons/opsdeck-logo.svg?v=opsdeck-wings-2",
  "./icons/opsdeck-wordmark.svg?v=cloud-sync-109",
  "./icons/icon-192.png?v=opsdeck-wings-2",
  "./icons/icon-512.png?v=opsdeck-wings-2",
  "./icons/apple-touch-icon.png?v=opsdeck-wings-2"
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
