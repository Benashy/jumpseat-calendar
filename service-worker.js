const CACHE_NAME = "jumpseat-calendar-v63";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css?v=cloud-sync-47",
  "./supabase-config.js?v=cloud-sync-47",
  "./app.js?v=cloud-sync-47",
  "./manifest.webmanifest?v=cloud-sync-47",
  "./icons/icon-192.png?v=ba-1",
  "./icons/icon-512.png?v=ba-1",
  "./icons/apple-touch-icon.png?v=ba-1"
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
