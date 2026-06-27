const CACHE = 'apps-v7';
const SHELL = ['./index.html', './shopping-list.html', './greek.html', './greek-abc.html', './deal.html', './manifest.json', './greek-manifest.json', './greek-abc-manifest.json', './deal-manifest.json', './icon.svg', './icon-shopping.svg', './icon-greek.svg', './icon-fitness.svg', './icon-shopping-180.png', './icon-greek-180.png', './icon-fitness-180.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (!e.request.url.startsWith(self.location.origin)) return;
  const isHTML = e.request.url.endsWith('.html') || e.request.mode === 'navigate';
  const req = isHTML ? new Request(e.request.url, { cache: 'no-cache' }) : e.request;
  e.respondWith(
    fetch(req)
      .then(r => { const c = r.clone(); caches.open(CACHE).then(cache => cache.put(e.request, c)); return r; })
      .catch(() => caches.match(e.request))
  );
});
