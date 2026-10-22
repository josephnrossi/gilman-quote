/* Gilman Quote service worker: offline shell, fresh catalog/deals, and Web Push display (used only when push is configured). */
const CACHE = 'gilman-quote-v1';
const SHELL = ['./', 'index.html', 'styles.css', 'app.js', 'push.js', 'push-config.js', 'vendor/qrcode.js', 'catalog.json', 'deals.json', 'manifest.json', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/favicon.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('gilman-quote-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || !u.pathname.startsWith(new URL('./', location.href).pathname)) return;
  const fresh = /\/(deals|catalog)\.json$/.test(u.pathname) || /admin\.html$/.test(u.pathname);
  if (fresh || e.request.mode === 'navigate') {
    // network first so new deals / catalog edits show up right away; cache as fallback offline
    e.respondWith(fetch(e.request).then(r => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then(cc => cc.put(u.pathname.endsWith('/') ? './' : e.request, c)); } return r; }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(h => h || caches.match('index.html'))));
    return;
  }
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request).then(r => { if (r.ok && r.type === 'basic') { const c = r.clone(); caches.open(CACHE).then(cc => cc.put(e.request, c)); } return r; })));
});
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (_) { d = { title: 'Gilman Quote', body: e.data ? e.data.text() : '' }; }
  if (d.custom && d.custom.i) return; // OneSignal payload: its own worker code displays it
  const title = d.title || '🔥 New Gilman opportunity';
  e.waitUntil(Promise.all([
    self.registration.showNotification(title, { body: d.body || 'Tap to see the latest hot deal.', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: d.id || 'gq-deal', data: { url: d.url || './#tab=deals' } }),
    self.navigator && self.navigator.setAppBadge ? self.navigator.setAppBadge().catch(() => {}) : null
  ]));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || './#tab=deals', self.registration.scope).href;
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(ws => { for (const w of ws) if (w.url.startsWith(self.registration.scope)) { w.navigate(url); return w.focus(); } return clients.openWindow(url); }));
});
