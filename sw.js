/* NMX Labs service worker (v6)
   v6: never caches the owner dashboard (/dashboard/).
   v5: tapping the welcome notification (the delivery test sent right after someone subscribes) tells the open page
   that notifications really arrive. Everything else is as in v4.
   - Shows browser notifications sent by .github/workflows/send-push.yml (standard Web Push + VAPID, no third party)
   - Opens the right page when a notification is clicked and reports the click to your Apps Script backend
   - Keeps recently read pages and saved posts readable offline; shows /offline/ when there's no connection
   Registered by /assets/engage.js as /sw.js?b=<your Apps Script /exec URL>. Must stay at the site root. */
'use strict';
var VERSION = 'nmx-v6.0';
var CORE = 'nmx-core-' + VERSION, PAGES = 'nmx-pages', ASSETS = 'nmx-assets', SAVED = 'nmx-saved';
var BACKEND = new URL(self.location.href).searchParams.get('b') || '';
var CORE_FILES = ['/offline/', '/assets/site.css', '/assets/logo.png', '/assets/pwa/icon-192.png', '/assets/pwa/badge-96.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CORE).then(function (c) { return c.addAll(CORE_FILES); }).catch(function () {}).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('nmx-core-') === 0 && k !== CORE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

/* ---------------- offline reading ---------------- */
function clean(u) { var x = new URL(u, self.location.origin); x.search = ''; x.hash = ''; return x.href; }
function trim(name, max) {
  return caches.open(name).then(function (c) {
    return c.keys().then(function (keys) { return keys.length > max ? c.delete(keys[0]).then(function () { return trim(name, max); }) : null; });
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || req.headers.has('range')) return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;                       // ads, analytics, YouTube, fonts: untouched
  if (/^\/(tools|dashboard|_scheduled)\//.test(url.pathname) || url.searchParams.has('action')) return;

  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(function (res) {
      if (res.ok && res.type === 'basic') {
        var copy = res.clone();
        caches.open(PAGES).then(function (c) { return c.put(clean(req.url), copy); }).then(function () { return trim(PAGES, 40); });
      }
      return res;
    }).catch(function () {
      return caches.match(clean(req.url), { ignoreSearch: true }).then(function (hit) { return hit || caches.match('/offline/'); });
    }));
    return;
  }

  if (/^\/assets\/.*\.(js|css)$/.test(url.pathname) || url.pathname === '/manifest.webmanifest') {
    // Code and styles: always try the network first so an upload shows up on the next page view.
    e.respondWith(fetch(req).then(function (res) {
      if (res.ok && res.type === 'basic') { var copy = res.clone(); e.waitUntil(caches.open(ASSETS).then(function (c) { return c.put(req, copy); })); }
      return res;
    }).catch(function () { return caches.match(req); }));
    return;
  }
  if (/^\/assets\//.test(url.pathname)) {
    // Images and fonts: stale-while-revalidate, answer from cache at once and refresh the copy in the background.
    var net = fetch(req).then(function (res) {
      if (!res.ok || res.type !== 'basic') return res;
      var copy = res.clone();
      return caches.open(ASSETS).then(function (c) { return c.put(req, copy); }).then(function () { return trim(ASSETS, 150); }).then(function () { return res; });
    });
    e.respondWith(caches.match(req).then(function (hit) { return hit || net; }));
    e.waitUntil(net.then(function () {}, function () {}));
  }
});

/* Saved posts: the page asks us to keep a copy so it opens without a connection. */
self.addEventListener('message', function (e) {
  var d = e.data || {};
  if (d.type === 'cache' && Array.isArray(d.urls)) {
    e.waitUntil(caches.open(SAVED).then(function (c) {
      return Promise.all(d.urls.map(function (u) {
        return fetch(u, { credentials: 'same-origin' }).then(function (res) { if (res.ok) return c.put(clean(u), res); }).catch(function () {});
      }));
    }));
  } else if (d.type === 'uncache' && Array.isArray(d.urls)) {
    e.waitUntil(caches.open(SAVED).then(function (c) { return Promise.all(d.urls.map(function (u) { return c.delete(clean(u)); })); }));
  }
});

/* ---------------- push notifications ---------------- */
self.addEventListener('push', function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data ? e.data.text() : '' }; }
  var title = String(d.title || 'New from NMX Labs').slice(0, 120);
  var opts = {
    body: String(d.body || '').slice(0, 240),
    icon: d.icon || '/assets/pwa/icon-192.png',
    badge: '/assets/pwa/badge-96.png',
    tag: d.tag || undefined,
    timestamp: Date.now(),
    data: { url: d.url || '/', campaign: d.campaign || '', sid: d.sid || '' }
  };
  if (d.image && /^https:\/\//.test(d.image)) opts.image = d.image;      // large picture on Chrome, Edge and Android
  e.waitUntil(self.registration.showNotification(title, opts));
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var data = e.notification.data || {};
  if (data.check) {                                                    // the welcome / delivery-test notification
    e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      list.forEach(function (c) { c.postMessage({ type: 'nmx-push-verified' }); });
    }));
  }
  var target = new URL(data.url || '/', self.location.origin);
  if (target.origin === self.location.origin) {
    target.searchParams.set('utm_source', 'push');
    target.searchParams.set('utm_medium', 'web_push');
    if (data.campaign) target.searchParams.set('utm_campaign', data.campaign);
  }
  var report = (BACKEND && data.campaign)
    ? fetch(BACKEND + '?action=click&c=' + encodeURIComponent(data.campaign) + '&s=' + encodeURIComponent(data.sid || ''), { mode: 'no-cors' }).catch(function () {})
    : Promise.resolve();
  var open = self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) {
      if (clean(list[i].url) === clean(target.href) && 'focus' in list[i]) return list[i].focus();
    }
    return self.clients.openWindow ? self.clients.openWindow(target.href) : null;
  });
  e.waitUntil(Promise.all([open, report]));
});

/* The browser replaced the subscription (keys rotated or expired): subscribe again and tell the backend,
   which moves the subscriber's row (topics and history kept) to the new address. */
self.addEventListener('pushsubscriptionchange', function (e) {
  var old = e.oldSubscription;
  var key = old && old.options ? old.options.applicationServerKey : null;
  if (!key || !BACKEND) return;
  e.waitUntil(self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }).then(function (sub) {
    var j = sub.toJSON();
    var body = new URLSearchParams({ action: 'push_subscribe', endpoint: j.endpoint, p256dh: (j.keys || {}).p256dh || '', auth: (j.keys || {}).auth || '', old_endpoint: old.endpoint, via: 'sw' });
    return fetch(BACKEND, { method: 'POST', body: body, mode: 'no-cors' });
  }).catch(function () {}));
});
