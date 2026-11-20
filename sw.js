/* Post & Web Story Maker service worker.
   App files come from the cache first (instant, works with no or very slow internet) and are refreshed in the background. */
const CACHE = 'postmaker-v11';
const CORE = ['./', 'index.html', 'style.css', 'app.js', 'manifest.json', 'icon-180.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'];

/* a response that came through a redirect cannot be used to open a page, so store a clean copy */
const clean = async r => r.redirected ? new Response(await r.blob(), { status: r.status, statusText: r.statusText, headers: r.headers }) : r;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(CORE.map(async u => {
    const r = await fetch(new Request(u, { cache: 'reload' }));
    if (!r.ok) throw new Error('Could not cache ' + u);
    await c.put(u, await clean(r));
  }))));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.indexOf('postmaker-') === 0 && k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin === location.origin) e.respondWith(appFile(e, r));
  else if (/(^|\.)(googleapis|gstatic)\.com$/.test(u.hostname)) e.respondWith(font(r));
});

/* app files: cache first, refresh in the background; any page address opens the app */
async function appFile(e, r) {
  const c = await caches.open(CACHE);
  let hit = await c.match(r, { ignoreSearch: true });
  if (!hit && r.mode === 'navigate') hit = await c.match('index.html');
  const refresh = fetch(r).then(async res => { if (res.ok) await c.put(r, await clean(res)); return res; });
  if (hit) { e.waitUntil(refresh.catch(() => {})); return hit; }
  return refresh.catch(() => Response.error());
}

/* Google Fonts: cached after the first load; never wait more than 4 seconds for the internet */
async function font(r) {
  const c = await caches.open(CACHE), hit = await c.match(r);
  if (hit) return hit;
  try {
    const res = await Promise.race([fetch(r), new Promise((_, no) => setTimeout(no, 4000))]);
    if (res.ok || res.type === 'opaque') c.put(r, res.clone());
    return res;
  } catch (err) { return Response.error(); }
}
