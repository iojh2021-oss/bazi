/* سرویس‌ورکر: کش کردن فایل‌های خود برنامه برای کار آفلاین (هیچ درخواست بیرونی انجام نمی‌شود) */
const V = 'bazi-lab-v1-s2';
const FILES = ['./', 'index.html', 'manifest.json', 'icon.svg', 'icon-192.png', 'icon-512.png', 'css/style.css',
  'js/util.js', 'js/ui.js', 'js/world.js', 'js/audio.js', 'js/speech.js', 'js/engine.js', 'js/server.js', 'js/netd.js', 'js/net.js', 'js/puppet.js', 'js/video.js', 'js/scene.js', 'js/director.js', 'js/radio.js', 'js/tv.js', 'js/vcr.js', 'js/hifi.js', 'js/lab.js', 'js/studio.js', 'js/app.js'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(V).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request).then((res) => { const cp = res.clone(); caches.open(V).then((c) => c.put(e.request, cp)); return res; }).catch(() => caches.match('index.html'))));
});
