const CACHE = 'apps-v46';
const SHELL = ['./index.html', './timer.html', './timer-manifest.json', './icon-timer.svg', './shopping-list.html', './greek-vocab.html', './greek-vocab-manifest.json', './icon-greek-vocab-v3.svg', './icon-greek-vocab-180-v3.png', './icon-greek-vocab-512-v3.png', './greek-daily.html', './greek-street.html', './greek-quest.html', './greek-verbs.html', './deal.html', './manifest.json', './greek-daily-manifest.json', './greek-street-manifest.json', './greek-quest-manifest.json', './greek-verbs-manifest.json', './deal-manifest.json', './icon.svg', './icon-shopping.svg', './icon-greek.svg', './icon-greek-daily-v3.svg', './icon-greek-street.svg', './icon-greek-quest.svg', './icon-fitness.svg', './icon-shopping-180.png', './icon-greek-180.png', './icon-greek-daily-180-v3.png', './icon-greek-daily-512-v3.png', './icon-greek-street-180.png', './icon-greek-quest-180.png', './icon-fitness-180.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.allSettled(SHELL.map(u => c.add(u)))));
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

async function unredirect(resp) {
  if (!resp || !resp.redirected) return resp;
  const body = await resp.clone().blob();
  const headers = new Headers();
  const ct = resp.headers.get('content-type');
  if (ct) headers.set('content-type', ct);
  return new Response(body, { status: 200, statusText: 'OK', headers });
}

self.addEventListener('fetch', e => {
  const url = e.request.url;
  if (!url.startsWith(self.location.origin)) return;
  const isHTML = url.endsWith('.html') || e.request.mode === 'navigate';
  e.respondWith((async () => {
    try {
      const req = isHTML ? new Request(url, { cache: 'no-cache' }) : e.request;
      const resp = await unredirect(await fetch(req));
      const copy = resp.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
      return resp;
    } catch (err) {
      const cached = await caches.match(e.request);
      if (cached) return cached;
      if (isHTML) {
        const shell = await caches.match(url) || await caches.match(new Request(url, { cache: 'no-cache' }));
        if (shell) return shell;
      }
      throw err;
    }
  })());
});
