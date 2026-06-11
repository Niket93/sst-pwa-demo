/* Dictée service worker
 * - Precaches the app shell
 * - Runtime cache-first for CDN script + fonts
 * - Model weights are cached separately by Transformers.js via the Cache API,
 *   so they survive offline automatically after the first download.
 */
const SHELL_CACHE = "dictee-shell-v1";
const RUNTIME_CACHE = "dictee-runtime-v1";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => ![SHELL_CACHE, RUNTIME_CACHE].includes(k)).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

const RUNTIME_HOSTS = ["cdn.jsdelivr.net", "fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;

  // Never intercept Hugging Face model downloads — Transformers.js manages its own cache.
  if (url.hostname.endsWith("huggingface.co")) return;

  // App shell: cache-first
  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
        const copy = res.clone();
        caches.open(SHELL_CACHE).then((c) => c.put(e.request, copy));
        return res;
      }))
    );
    return;
  }

  // CDN script + fonts: cache-first
  if (RUNTIME_HOSTS.includes(url.hostname)) {
    e.respondWith(
      caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
        const copy = res.clone();
        caches.open(RUNTIME_CACHE).then((c) => c.put(e.request, copy));
        return res;
      }))
    );
  }
});
