const CACHE = 'apps-v24';
const SHELL = ['./index.html', './hiit.html', './shopping-list.html', './greek-vocab.html', './greek-vocab-manifest.json', './icon-greek-vocab.svg', './icon-greek-vocab-180.png', './icon-greek-vocab-512.png', './greek-daily.html', './greek-street.html', './greek-quest.html', './greek-abc.html', './greek-verbs.html', './deal.html', './manifest.json', './hiit-manifest.json', './greek-daily-manifest.json', './greek-street-manifest.json', './greek-quest-manifest.json', './greek-abc-manifest.json', './greek-verbs-manifest.json', './deal-manifest.json', './icon.svg', './icon-hiit.svg', './icon-shopping.svg', './icon-greek.svg', './icon-greek-daily-v3.svg', './icon-greek-street.svg', './icon-greek-quest.svg', './icon-fitness.svg', './icon-hiit-512.png', './icon-shopping-180.png', './icon-greek-180.png', './icon-greek-daily-180-v3.png', './icon-greek-daily-512-v3.png', './icon-greek-street-180.png', './icon-greek-quest-180.png', './icon-fitness-180.png'];

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
