// Footnote offline worker: the app shell is cached on install, the page itself is fetched
// fresh when online (so updates arrive) and served from cache offline; fonts are cached on first use.
const SHELL = "footnote-shell-v2", FONTS = "footnote-fonts-v1";
const FILES = ["./", "index.html", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(SHELL).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== FONTS).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(caches.open(FONTS).then((c) => c.match(e.request).then((hit) => hit || fetch(e.request).then((r) => { c.put(e.request, r.clone()); return r; }))));
    return;
  }
  if (url.origin !== location.origin) return;
  if (e.request.mode === "navigate") {
    e.respondWith(fetch(e.request).then((r) => { caches.open(SHELL).then((c) => c.put("index.html", r.clone())); return r; }).catch(() => caches.match("index.html")));
    return;
  }
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request)));
});
