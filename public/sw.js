/* Antessala — cache simples para o app abrir offline */
const CACHE = "antessala-v1";
const ARQUIVOS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
  "./apple-touch-icon.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;                       // chamadas da IA nunca entram no cache
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;             // fontes e API passam direto pela rede

  e.respondWith(
    caches.match(req).then((hit) => {
      const rede = fetch(req).then((res) => {
        const copia = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copia)).catch(() => {});
        return res;
      }).catch(() => hit);
      return hit || rede;
    })
  );
});
