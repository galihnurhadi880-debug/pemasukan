// Buku Pemasukan - offline support. Ganti VERSION setiap kali file aplikasi diperbarui.
const VERSION = 'bp-v4-rekening';
const CORE = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (url.origin !== location.origin && !isFont) return;
  // Pakai versi tersimpan dulu (cepat & jalan tanpa internet), lalu perbarui di latar belakang.
  e.respondWith(caches.open(VERSION).then(async cache => {
    // Selalu ambil halaman aplikasi terbaru saat online. Offline tetap memakai cache.
    if (req.mode === 'navigate') {
      try {
        const fresh = await fetch(req, {cache: 'no-cache'});
        if (fresh && fresh.ok) {
          await cache.put(req, fresh.clone());
          return fresh;
        }
      } catch (err) {}
      return (await cache.match(req, {ignoreSearch: true}))
        || (await cache.match('./index.html'))
        || new Response('Aplikasi belum tersedia offline.', {status: 503});
    }
    const cached = await cache.match(req, {ignoreSearch: true});
    const network = fetch(req).then(res => {
      if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
      return res;
    }).catch(() => null);
    if (cached) { e.waitUntil(network); return cached; }
    const res = await network;
    if (res) return res;
    if (req.mode === 'navigate') return cache.match('./index.html');
    return new Response('', {status: 504});
  }));
});
