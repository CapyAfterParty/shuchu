// Lets the phone app open with no connection. Serves the app from the
// cache at once and refreshes the cache in the background.
// Tasks themselves are never cached here; the outbox handles those.

const CACHE = "shuchu-v1";
const SHELL = [
  "/phone",
  "/manifest.webmanifest",
  "/public/mist.css",
  "/public/icon.svg",
  "/public/fonts/urbanist-latin.woff2",
  "/public/fonts/urbanist-latin-italic.woff2",
  "/js/clients/phone/look.js",
  "/js/clients/phone/phone.js",
  "/js/clients/phone/outbox.js",
  "/js/clients/glass.js",
  "/js/clients/sync.js",
  "/js/shared/task.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== location.origin) return;
  if (url.pathname === "/events" || url.pathname === "/tasks") return;

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(event.request, { ignoreSearch: true });
      const fresh = fetch(event.request)
        .then((response) => {
          if (response.ok) cache.put(event.request, response.clone());
          return response;
        })
        .catch(() => cached);
      return cached ?? fresh;
    }),
  );
});
