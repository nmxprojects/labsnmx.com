/* NMX Labs engage layer (v6, 24 Nov 2026). Loaded by /assets/nmx.js on every page.
   v6: the reading prompt is a half-screen sheet with a ringing bell and a rotating, slightly cheeky line.
   - Browser notifications (standard Web Push with your own VAPID key, LaraPush-style, self-hosted, free)
     v5/v6: "Follow" button instead of a bare bell, a small prompt once a reader is a few lines into a post, an
     end-of-post card, instant confirmation (the slow parts finish in the background), a test notification to
     confirm delivery, and step-by-step fixes when the phone or browser is blocking notifications.
   - "Ask NMX Labs" assistant: instant answers from the studio facts below, Google Gemini (free tier) through your
     Apps Script backend for anything else, and a hand-off to a person (lead form or WhatsApp)
   - Saved posts (stored in the reader's browser, readable offline), installable app (PWA)
   - First-party visitor statistics sent to your Google Sheet (respects Do Not Track / Global Privacy Control)
   - v5: "Learn" and "Play" links in the menu (until scripts/build.py writes them into every page)
   Reads BACKEND_URL and VAPID_PUBLIC_KEY from /assets/nmx.js (window.NMX_CFG). This file holds no keys, so it can be
   replaced without touching your settings. Without them the Follow button stays hidden and the assistant answers from
   the studio facts only. */
(function () {
  'use strict';
  if (window.NMX_ENGAGE_LOADED) return; window.NMX_ENGAGE_LOADED = true;

  var CFG = window.NMX_CFG || {};
  var doc = document, path = location.pathname;
  var READY = typeof window.NMX_backendReady === 'function' && window.NMX_backendReady();
  var VAPID = String(CFG.VAPID_PUBLIC_KEY || '').trim();
  var VAPID_OK = /^[A-Za-z0-9_-]{80,100}$/.test(VAPID);
  var WHATSAPP = '918810438717', EMAIL = 'nmxprojects@gmail.com';
  var REDUCED = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  function $(s, c) { return (c || doc).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); }
  function store(k, v) { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} }
  function read(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function readJSON(k, d) { try { var v = JSON.parse(read(k)); return v == null ? d : v; } catch (e) { return d; } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function rid() { var a = new Uint8Array(9); (window.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : a.forEach(function (_, i) { a[i] = Math.random() * 256; }); return Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('').slice(0, 16); }
  function ssGet(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function ssSet(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} }
  function today() { return new Date().toISOString().slice(0, 10); }
  function track(name, params) { try { if (window.nmxTrack) window.nmxTrack(name, params || {}); } catch (e) {} }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function withTimeout(p, ms, label) { return Promise.race([p, wait(ms).then(function () { throw new Error(label || 'timeout'); })]); }
  function post(params) {
    return fetch(CFG.BACKEND_URL, { method: 'POST', body: new URLSearchParams(params) })
      .then(function (r) { return r.json(); })
      .then(function (d) { if (!d || !d.ok) throw new Error((d && d.error) || 'backend'); return d; });
  }

  /* =========================================================== who is visiting (no cookies, no IP) */
  var UAS = navigator.userAgent || '';
  var IPADOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  var U = (function () {
    var br = 'Other', os = 'Other', dev = 'Desktop';
    if (/FBAN|FBAV|Instagram|Line\/|; wv\)/.test(UAS)) br = 'In-app browser';
    else if (/Edg\/|EdgA\//.test(UAS)) br = 'Edge'; else if (/OPR\/|Opera/.test(UAS)) br = 'Opera';
    else if (/SamsungBrowser/.test(UAS)) br = 'Samsung Internet'; else if (/Firefox\/|FxiOS/.test(UAS)) br = 'Firefox';
    else if (/CriOS|Chrome\//.test(UAS)) br = 'Chrome'; else if (/Safari\//.test(UAS)) br = 'Safari';
    if (/Android/.test(UAS)) os = 'Android'; else if (/iPhone|iPad|iPod/.test(UAS) || IPADOS) os = 'iOS';
    else if (/Windows/.test(UAS)) os = 'Windows'; else if (/CrOS/.test(UAS)) os = 'ChromeOS';
    else if (/Mac OS X|Macintosh/.test(UAS)) os = 'macOS'; else if (/Linux/.test(UAS)) os = 'Linux';
    if (/iPad|Tablet/.test(UAS) || IPADOS || (os === 'Android' && !/Mobile/.test(UAS))) dev = 'Tablet';
    else if (/Mobi|iPhone|Android/.test(UAS)) dev = 'Mobile';
    return { br: br, os: os, dev: dev };
  })();
  var BOT = navigator.webdriver || /bot|crawl|spider|slurp|lighthouse|headless|preview|facebookexternalhit|mediapartners/i.test(UAS);
  var NO_TRACK = navigator.doNotTrack === '1' || window.doNotTrack === '1' || navigator.globalPrivacyControl === true;
  var TZ = ''; try { TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}
  var COUNTRY = (function () {
    var map = { Kolkata: 'India', Calcutta: 'India', Dubai: 'UAE', Muscat: 'Oman', Qatar: 'Qatar', Riyadh: 'Saudi Arabia', Kuwait: 'Kuwait', Bahrain: 'Bahrain',
      Singapore: 'Singapore', Kuala_Lumpur: 'Malaysia', Jakarta: 'Indonesia', Bangkok: 'Thailand', Manila: 'Philippines', Hong_Kong: 'Hong Kong', Tokyo: 'Japan',
      Seoul: 'South Korea', Shanghai: 'China', Karachi: 'Pakistan', Dhaka: 'Bangladesh', Kathmandu: 'Nepal', Katmandu: 'Nepal', Colombo: 'Sri Lanka', Thimphu: 'Bhutan',
      Maldives: 'Maldives', London: 'United Kingdom', Dublin: 'Ireland', Paris: 'France', Berlin: 'Germany', Amsterdam: 'Netherlands', Madrid: 'Spain', Rome: 'Italy',
      Zurich: 'Switzerland', Stockholm: 'Sweden', Lagos: 'Nigeria', Nairobi: 'Kenya', Johannesburg: 'South Africa', Sydney: 'Australia', Melbourne: 'Australia',
      Perth: 'Australia', Brisbane: 'Australia', Auckland: 'New Zealand', Toronto: 'Canada', Vancouver: 'Canada', Honolulu: 'United States' };
    var city = TZ.split('/').pop();
    if (map[city]) return map[city];
    if (/^America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Detroit|Boise|Indiana|Kentucky)/.test(TZ)) return 'United States';
    var region = (String(navigator.language || '').split('-')[1] || '').toUpperCase();
    try { if (region && window.Intl && Intl.DisplayNames) return new Intl.DisplayNames(['en'], { type: 'region' }).of(region); } catch (e) {}
    return TZ ? TZ.split('/')[0] : 'Unknown';
  })();

  var VID = read('nmx-vid'); if (!VID) { VID = rid(); store('nmx-vid', VID); }
  var views = Number(read('nmx-views') || 0) + 1; store('nmx-views', String(views));
  var qs = new URLSearchParams(location.search);
  var refHost = ''; try { var rh = doc.referrer ? new URL(doc.referrer).hostname.replace(/^www\./, '') : ''; if (rh && rh !== location.hostname.replace(/^www\./, '')) refHost = rh; } catch (e) {}
  var SES = (function () {
    var s = readJSON('nmx-ses', null), now = Date.now();
    if (!s || now - s.t > 30 * 60 * 1000) s = { id: rid(), t: now, ref: refHost, us: '', um: '', uc: '' };
    if (qs.get('utm_source')) { s.us = qs.get('utm_source'); s.um = qs.get('utm_medium') || ''; s.uc = qs.get('utm_campaign') || ''; }
    s.t = now; store('nmx-ses', JSON.stringify(s));
    if (!read('nmx-first')) store('nmx-first', JSON.stringify({ ref: refHost, us: s.us, um: s.um, uc: s.uc, page: path, at: today() }));
    return s;
  })();
  var FIRST = readJSON('nmx-first', {});

  /* =========================================================== first-party statistics -> Google Sheet */
  function logEvent(type, detail) {
    if (!READY || BOT || (NO_TRACK && type === 'pageview')) return;
    var body = new URLSearchParams({ action: 'event', t: type, vid: VID, sid: SES.id, path: path.slice(0, 200), title: doc.title.slice(0, 150),
      ref: type === 'pageview' ? refHost : '', us: SES.us || '', um: SES.um || '', uc: SES.uc || '', dev: U.dev, br: U.br, os: U.os, co: COUNTRY,
      lang: navigator.language || '', d: String(detail || '').slice(0, 200) });
    try { if (navigator.sendBeacon && navigator.sendBeacon(CFG.BACKEND_URL, body)) return; } catch (e) {}
    fetch(CFG.BACKEND_URL, { method: 'POST', body: body, mode: 'no-cors', keepalive: true }).catch(function () {});
  }
  window.nmxEvent = logEvent;
  if (doc.readyState === 'complete') setTimeout(function () { logEvent('pageview'); }, 600);
  else addEventListener('load', function () { setTimeout(function () { logEvent('pageview'); }, 600); });

  /* =========================================================== "Learn" and "Play" in the menu */
  // scripts/build.py writes these links into every page on its next run; until then (and on any page it skips) add them here.
  (function addSchoolLinks() {
    function inject(box, cls) {
      if (!box || box.querySelector('a[href="/learn/"]')) return;
      var after = box.querySelector('a[href="/videos/"]');
      var frag = doc.createDocumentFragment();
      [['/learn/', 'Learn'], ['/play/', 'Play']].forEach(function (l) {
        var a = doc.createElement('a'); a.href = l[0]; a.textContent = l[1]; if (cls) a.className = cls;
        if (path.indexOf(l[0]) === 0) a.setAttribute('aria-current', 'page');
        frag.appendChild(a);
      });
      if (after && after.parentNode === box) box.insertBefore(frag, after.nextSibling); else box.appendChild(frag);
    }
    inject($('.site-nav .nav-links'));
    inject($('#mobileMenu .mobile-menu-links') || $('#mobileMenu'));
    var nl = $('.site-nav .nav-links'); if (nl) nl.classList.add('nx-nav-plus');
  })();

  /* =========================================================== service worker (notifications + offline) */
  var SW = 'serviceWorker' in navigator && window.isSecureContext;
  // v5: registered as soon as the browser is idle (v4 waited for every image and ad to finish loading, which is
  // what made "Turn on" feel slow on phones). Same URL and scope as v4, so existing subscribers are untouched.
  var swReady = SW ? new Promise(function (resolve, reject) {
    function reg() {
      navigator.serviceWorker.register('/sw.js' + (READY ? '?b=' + encodeURIComponent(CFG.BACKEND_URL) : ''), { scope: '/' })
        .then(function () { return navigator.serviceWorker.ready; }).then(resolve)
        .catch(function (e) { console.warn('[NMX] Service worker not registered:', e); reject(e); });
    }
    if (window.requestIdleCallback) requestIdleCallback(reg, { timeout: 1200 }); else setTimeout(reg, 300);
  }) : null;
  if (swReady) swReady.catch(function () {});

  var STANDALONE = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  var IOS = U.os === 'iOS';
  var PUSH_API = SW && 'PushManager' in window && 'Notification' in window;
  var PUSH_ON = READY && VAPID_OK;
  // iPhone/iPad: Safari only allows web push for sites added to the Home Screen (iOS 16.4+).
  var IOS_NEEDS_INSTALL = PUSH_ON && IOS && !STANDALONE && U.br !== 'In-app browser';
  var INAPP = U.br === 'In-app browser';
  var SHOW_FOLLOW = PUSH_ON && (PUSH_API || IOS_NEEDS_INSTALL || INAPP);

  // Phone brand, for brand-specific fixes (Chrome on Android tells pages the model when asked).
  var BRAND = '';
  (function () {
    function brandOf(m) {
      m = String(m || '');
      if (/^SM-|Galaxy|Samsung/i.test(m) || /SamsungBrowser/.test(UAS)) return 'samsung';
      if (/Redmi|POCO|Xiaomi|^M\d{4}[A-Z]|^2\d{3}[0-9A-Z]{3,}|^2[0-9]\d{6}/i.test(m)) return 'xiaomi';
      if (/vivo|iQOO|^V\d{4}|^I\d{4}/i.test(m)) return 'vivo';
      if (/OPPO|^CPH\d{4}|realme|^RMX\d{4}|OnePlus|^NE2\d{3}|^LE2\d{3}|^KB2\d{3}|^IN20\d{2}/i.test(m)) return 'oppo';
      if (/moto/i.test(m)) return 'motorola';
      if (/Pixel/i.test(m)) return 'pixel';
      return '';
    }
    BRAND = brandOf((UAS.match(/Android [\d.]+; ([^;)]+)/) || [])[1]);
    try {
      if (U.os === 'Android' && navigator.userAgentData && navigator.userAgentData.getHighEntropyValues)
        navigator.userAgentData.getHighEntropyValues(['model']).then(function (h) { BRAND = brandOf(h.model) || BRAND; }).catch(function () {});
    } catch (e) {}
  })();

  /* =========================================================== UI shell */
  if (!$('link[href^="/assets/engage.css"]')) {
    var css = doc.createElement('link'); css.rel = 'stylesheet'; css.href = '/assets/engage.css?v=5'; doc.head.appendChild(css);
  }
  var I = {
    bell: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/></svg>',
    bellOff: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 16.5V11a6 6 0 0 1 9.2-5.1M18 10.5v6l1.5 2H8"/><path d="M10 20.5a2 2 0 0 0 4 0M4 4l16 16"/></svg>',
    chat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 18.5 5.6 15A7.5 7.5 0 1 1 9 18.2z"/><path d="M9 11h.01M12 11h.01M15 11h.01"/></svg>',
    x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    send: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6"/></svg>',
    mark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5h10v15l-5-3.6-5 3.6z"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    phone: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M10.5 18.5h3"/></svg>'
  };
  var rootEl = doc.createElement('div');
  rootEl.className = 'nx-root'; rootEl.setAttribute('data-nx', '');
  rootEl.innerHTML =
    '<div class="nx-panel" id="nxPanel" role="dialog" aria-modal="false" aria-labelledby="nxTitle" hidden></div>' +
    '<div class="nx-sheet" id="nxSheet" role="dialog" aria-modal="false" aria-labelledby="nxSheetT" hidden></div>' +
    '<div class="nx-pill" role="status" aria-live="polite" hidden></div>' +
    '<div class="nx-toast" role="status" aria-live="polite" hidden></div>' +
    '<div class="nx-dock">' +
      (SHOW_FOLLOW ? '<button class="nx-bell" type="button" aria-expanded="false" aria-controls="nxPanel" data-no-track>' + I.bell + '<span class="nx-bell-label">Follow</span><span class="nx-dot" aria-hidden="true"></span></button><span class="nx-sep" aria-hidden="true"></span>' : '') +
      '<button class="nx-ask" type="button" aria-expanded="false" aria-controls="nxPanel" data-no-track>' + I.chat + '<span>Ask NMX Labs</span></button>' +
    '</div>';
  doc.body.appendChild(rootEl);
  var panel = $('#nxPanel', rootEl), sheet = $('#nxSheet', rootEl), pill = $('.nx-pill', rootEl), toastEl = $('.nx-toast', rootEl),
    bellBtn = $('.nx-bell', rootEl), askBtn = $('.nx-ask', rootEl);
  var openKind = null;

  // Match the page's light/dark look (the home page is light-only, blog pages follow the theme toggle).
  function syncTheme() {
    var m = getComputedStyle(doc.body).backgroundColor.match(/\d+/g) || [255, 255, 255];
    rootEl.classList.toggle('nx-dark', (0.299 * m[0] + 0.587 * m[1] + 0.114 * m[2]) < 110);
  }
  syncTheme();
  doc.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('#themeToggle')) setTimeout(syncTheme, 50); });
  if (window.matchMedia) { var mq = matchMedia('(prefers-color-scheme: dark)'); mq.addEventListener && mq.addEventListener('change', function () { setTimeout(syncTheme, 50); }); }

  // Stay clear of the home page's mobile tab bar and of Google AdSense anchor ads.
  function lift() {
    var px = 0, bar = $('.m-tabbar');
    if (bar && getComputedStyle(bar).display !== 'none') px = Math.max(px, bar.offsetHeight + 4);
    $$('ins.adsbygoogle[data-anchor-status="displayed"], ins.adsbygoogle[data-anchor-shown="true"]').forEach(function (ad) {
      var r = ad.getBoundingClientRect(); if (r.height && r.bottom >= innerHeight - 4) px = Math.max(px, r.height + 4);
    });
    rootEl.style.setProperty('--nx-lift', px + 'px');
  }
  lift(); addEventListener('resize', lift);
  if (window.MutationObserver) new MutationObserver(function () { clearTimeout(lift.t); lift.t = setTimeout(lift, 200); })
    .observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-anchor-status', 'data-anchor-shown', 'style'] });

  function setExpanded() {
    if (bellBtn) bellBtn.setAttribute('aria-expanded', String(openKind === 'alerts' || openKind === 'guide'));
    askBtn.setAttribute('aria-expanded', String(openKind === 'ask'));
  }
  function closePanel() {
    if (!openKind) return;
    openKind = null; panel.hidden = true; panel.innerHTML = ''; setExpanded();
  }
  function openPanel(kind, arg) {
    hideSheet();
    openKind = kind; panel.hidden = false; panel.setAttribute('data-kind', kind);
    setExpanded();
    if (kind === 'alerts') renderAlerts(); else if (kind === 'guide') renderGuide(arg); else renderAsk();
    var f = $('[data-nx-focus]', panel) || $('button, input, textarea', panel); if (f) setTimeout(function () { f.focus(); }, 30);
  }
  if (bellBtn) bellBtn.addEventListener('click', function () {
    if (openKind === 'alerts' || openKind === 'guide') { closePanel(); return; }
    var blocked = PUSH_API && permission() === 'denied';
    openPanel(blocked || INAPP ? 'guide' : 'alerts', blocked ? 'denied' : INAPP ? 'inapp' : '');
    track('NotificationPanelOpen', { page_path: path }); logEvent('follow_open', blocked ? 'blocked' : '');
  });
  askBtn.addEventListener('click', function () { if (openKind === 'ask') closePanel(); else { openPanel('ask'); track('AssistantOpen', { page_path: path }); logEvent('assistant_open'); } });
  doc.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (openKind) { var k = openKind; closePanel(); (k === 'ask' ? askBtn : bellBtn || askBtn).focus(); }
    else if (!sheet.hidden) dismissSheet();
  });
  doc.addEventListener('pointerdown', function (e) { if (openKind && !rootEl.contains(e.target) && !(e.target.closest && e.target.closest('.nx-endcard'))) closePanel(); });

  function toast(html, ms) {
    toastEl.innerHTML = html; toastEl.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(function () { toastEl.hidden = true; }, ms || 4500);
  }
  function head(title, yellow) {
    return '<div class="nx-head' + (yellow ? ' nx-head--yellow' : '') + '"><h2 id="nxTitle">' + title + '</h2>' +
      '<button class="nx-x" type="button" aria-label="Close" data-nx-close data-no-track>' + I.x + '</button></div>';
  }
  panel.addEventListener('click', function (e) { if (e.target.closest('[data-nx-close]')) { var k = openKind; closePanel(); (k === 'ask' ? askBtn : bellBtn || askBtn).focus(); } });

  /* =========================================================== notifications: state */
  function pushState() { return readJSON('nmx-push', null); }
  function setPushState(s) { store('nmx-push', s ? JSON.stringify(s) : null); paintBell(); }
  function permission() { return 'Notification' in window ? Notification.permission : 'default'; }
  function isOn() { return !!pushState() && permission() === 'granted'; }
  // "Not now" waits longer each time: 3 days, then 10, then 30.
  function snooze() {
    var n = Number(read('nmx-push-nope') || 0) + 1; store('nmx-push-nope', String(n));
    store('nmx-push-snooze', String(Date.now() + [3, 10, 30][Math.min(n, 3) - 1] * 864e5));
  }
  function snoozed() { return Date.now() < Number(read('nmx-push-snooze') || 0); }
  function paintBell() {
    if (!bellBtn) return;
    var on = isOn(), blocked = PUSH_API && permission() === 'denied';
    bellBtn.classList.toggle('is-on', on);
    bellBtn.classList.toggle('is-blocked', blocked);
    bellBtn.classList.toggle('has-label', !on && !blocked);
    bellBtn.innerHTML = (blocked ? I.bellOff : I.bell) + '<span class="nx-bell-label">Follow</span><span class="nx-dot" aria-hidden="true"></span>';
    bellBtn.setAttribute('aria-label', on ? 'Notifications are on' : blocked ? 'Notifications are blocked: see how to fix it' : 'Follow: get new posts as notifications');
    $$('.nx-endcard').forEach(function (c) { if (on) c.remove(); });
  }
  function b64u(s) {
    var p = '='.repeat((4 - s.length % 4) % 4), raw = atob((s + p).replace(/-/g, '+').replace(/_/g, '/'));
    var out = new Uint8Array(raw.length); for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i); return out;
  }
  // The backend's subscriber ID is the first 16 hex characters of SHA-256(endpoint), so the page can know it at once.
  function idFor(endpoint) {
    try {
      return crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint)).then(function (buf) {
        return 'p' + Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('').slice(0, 16);
      }).catch(function () { return ''; });
    } catch (e) { return Promise.resolve(''); }
  }
  function subParams(sub, topics, oldEndpoint) {
    var j = sub.toJSON(), k = j.keys || {};
    return { action: 'push_subscribe', endpoint: j.endpoint, p256dh: k.p256dh || '', auth: k.auth || '', topics: topics,
      old_endpoint: oldEndpoint || '', br: U.br, os: U.os, dev: U.dev, co: COUNTRY, tz: TZ, lang: navigator.language || '',
      page: path, ref: FIRST.ref || SES.ref || '', us: FIRST.us || SES.us || '', um: FIRST.um || SES.um || '', uc: FIRST.uc || SES.uc || '',
      vid: VID, email: read('nmx-sub-email') || '', standalone: STANDALONE ? '1' : '' };
  }
  // Saving to the Google Sheet can take a few seconds (Apps Script), so it runs in the background with retries.
  // If the reader leaves first, the browser still delivers it (sendBeacon), and the next page view retries anyway.
  function queueSave(params) {
    store('nmx-push-pending', JSON.stringify(params));
    var tries = 0;
    (function attempt() {
      tries++;
      post(params).then(function (d) {
        var st = pushState() || {};
        st.id = d.id || st.id; st.topics = d.topics || params.topics; st.endpoint = params.endpoint; st.seen = today(); delete st.pending;
        setPushState(st); store('nmx-push-pending', null);
      }).catch(function () { if (tries < 3) setTimeout(attempt, tries === 1 ? 4000 : 15000); });
    })();
  }
  addEventListener('pagehide', function () {
    var p = read('nmx-push-pending');
    if (p && READY && navigator.sendBeacon) { try { navigator.sendBeacon(CFG.BACKEND_URL, new URLSearchParams(JSON.parse(p))); } catch (e) {} }
  });

  function syncPush() {
    if (!PUSH_ON || !PUSH_API || !swReady) return;
    swReady.then(function (reg) { return reg.pushManager.getSubscription(); }).then(function (sub) {
      var st = pushState(), pending = readJSON('nmx-push-pending', null);
      if (sub && permission() === 'granted') {
        if (pending && pending.endpoint === sub.endpoint) queueSave(pending);
        else if (!st || st.endpoint !== sub.endpoint) {
          idFor(sub.endpoint).then(function (id) {
            setPushState({ id: id || (st && st.id) || '', endpoint: sub.endpoint, topics: (st && st.topics) || 'blog,youtube', seen: today(), pending: true, verified: st && st.verified });
            queueSave(subParams(sub, (st && st.topics) || 'blog,youtube', st && st.endpoint));
          });
        } else if (st.seen !== today()) { st.seen = today(); setPushState(st); post({ action: 'push_seen', id: st.id, endpoint: st.endpoint }).catch(function () {}); }
      } else if (st && st.endpoint && !sub) {
        post({ action: 'push_unsubscribe', id: st.id, endpoint: st.endpoint, reason: permission() }).catch(function () {});
        setPushState(null); store('nmx-push-pending', null);
      } else if (st && permission() !== 'granted') setPushState(null);
      paintBell();
    }).catch(function () {});
  }
  syncPush(); paintBell();

  /* =========================================================== notifications: the small status pill */
  // Everything after "Allow" is shown here, small and next to the Follow button, instead of in a panel.
  var Pill = {
    show: function (kind, html, ms) {
      clearTimeout(Pill.t); pill.className = 'nx-pill nx-pill--' + kind; pill.innerHTML = html; pill.hidden = false;
      if (ms) Pill.t = setTimeout(Pill.hide, ms);
    },
    hide: function () {
      clearTimeout(Pill.t);
      if (pill.hidden) return;
      if (REDUCED) { pill.hidden = true; return; }
      pill.classList.add('nx-pill--out'); setTimeout(function () { pill.hidden = true; pill.classList.remove('nx-pill--out'); }, 260);
    },
    // "Done" shrinks into the Follow button, which then shows as on.
    done: function (text) {
      Pill.show('done', I.check + '<span>' + esc(text) + '</span>');
      Pill.t = setTimeout(function () {
        if (REDUCED) { pill.hidden = true; return; }
        pill.classList.add('nx-pill--mini');
        setTimeout(function () { pill.hidden = true; pill.classList.remove('nx-pill--mini'); if (bellBtn) { bellBtn.classList.add('nx-pop'); setTimeout(function () { bellBtn.classList.remove('nx-pop'); }, 600); } }, 420);
      }, 1400);
    }
  };
  pill.addEventListener('click', function (e) {
    var b = e.target.closest('[data-pill]'); if (!b) return;
    var a = b.getAttribute('data-pill');
    if (a === 'yes') { markVerified('answer'); Pill.show('done', I.check + '<span>Great, you’re all set.</span>', 2200); }
    else if (a === 'no') { logEvent('push_check_no', BRAND || U.os); Pill.hide(); openPanel('guide', 'system'); }
    else if (a === 'fix') { Pill.hide(); openPanel('guide', b.getAttribute('data-reason') || 'system'); }
    else if (a === 'close') Pill.hide();
  });
  function markVerified(how) {
    var st = pushState(); if (!st) return;
    if (!st.verified) logEvent('push_check_yes', how);
    st.verified = true; setPushState(st);
  }
  if (SW) navigator.serviceWorker.addEventListener('message', function (e) {
    if (e.data && e.data.type === 'nmx-push-verified') { markVerified('tap'); if (!pill.hidden && pill.classList.contains('nx-pill--ask')) Pill.hide(); }
  });

  /* =========================================================== notifications: turning them on */
  var busy = false;
  // Called straight from a tap (the Follow panel, the reading prompt or the end-of-post card): browsers only show
  // their permission prompt in response to a tap, and no website can grant itself permission.
  function enable(topics, source) {
    if (busy) return;
    topics = topics || 'blog,youtube'; source = source || 'follow';
    if (!PUSH_ON) { location.href = '/blog/#subHIdx'; return; }     // keys not set up: offer email instead
    if (INAPP) { openPanel('guide', 'inapp'); return; }
    if (IOS_NEEDS_INSTALL) { openPanel('alerts'); return; }
    if (!PUSH_API) { openPanel('guide', 'unsupported'); return; }
    logEvent('prompt_yes', source);
    if (permission() === 'granted') { afterGranted(topics, source, Date.now()); return; }
    if (permission() === 'denied') { openPanel('guide', 'denied'); return; }
    busy = true; hideSheet(); closePanel();
    var t0 = Date.now();
    Pill.show('wait', '<span class="nx-spin" aria-hidden="true"></span><span>Tap <strong>Allow</strong> in your browser’s pop-up</span>');
    var ask = new Promise(function (res) { var r = Notification.requestPermission(res); if (r && r.then) r.then(res); });
    ask.then(function (perm) {
      busy = false;
      if (perm === 'granted') { afterGranted(topics, source, t0); return; }
      if (perm === 'denied') { Pill.hide(); logEvent('push_denied', source); paintBell(); openPanel('guide', 'denied'); return; }
      // "default": the reader closed the prompt, or the browser showed a small icon in the address bar instead of a pop-up.
      var quiet = Date.now() - t0 < 900;
      logEvent('prompt_dismissed', source + (quiet ? ':quiet' : ''));
      Pill.show('info', quiet
        ? '<span>Your browser put the request in the address bar. Tap the bell or ⓘ icon there and choose <strong>Allow</strong>.</span><button type="button" class="nx-pill-x" data-pill="close" aria-label="Close">' + I.x + '</button>'
        : '<span>No problem. Tap <strong>Follow</strong> whenever you’re ready.</span>', quiet ? 12000 : 3500);
    });
  }
  // The reader said yes: show it as done straight away and finish the subscription in the background.
  function afterGranted(topics, source, t0) {
    var st = pushState() || {};
    st.topics = topics; st.pending = true; setPushState(st);
    hideSheet(); if (openKind === 'alerts') closePanel();
    Pill.done('Notifications on');
    finishSubscribe(topics).then(function (reg) {
      logEvent('push_subscribe', topics + '|' + source + '|' + Math.round((Date.now() - t0) / 100) / 10 + 's');
      track('PushSubscribe', { topics: topics, page_path: path, prompt: source });
      setTimeout(function () { deliveryCheck(reg); }, 1900);
    }).catch(function (err) {
      var s2 = pushState(); if (s2 && !s2.endpoint) setPushState(null);
      console.warn('[NMX] Push subscribe failed:', err);
      logEvent('push_error', String(err && (err.name + ': ' + err.message) || err).slice(0, 150));
      Pill.show('error', '<span>Your browser couldn’t finish turning on notifications.</span><button type="button" class="nx-pill-btn" data-pill="fix" data-reason="error">Fix it</button>', 15000);
    });
  }
  function finishSubscribe(topics) {
    if (!swReady) return Promise.reject(new Error('No service worker'));
    return withTimeout(swReady, 20000, 'Service worker took too long').then(function (reg) {
      return reg.pushManager.getSubscription().then(function (old) {
        return old || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64u(VAPID) });
      }).then(function (sub) {
        return idFor(sub.endpoint).then(function (id) {
          var st = pushState() || {};
          st.endpoint = sub.endpoint; st.id = id || st.id || ''; st.topics = topics; st.seen = today(); st.pending = true;
          setPushState(st);
          queueSave(subParams(sub, topics));
          return reg;
        });
      });
    });
  }
  // A welcome notification doubles as a delivery test: if the phone hides it, the reader gets the fix right away.
  function deliveryCheck(reg) {
    var st = pushState(); if (!st || st.verified || !reg || !reg.showNotification) return;
    reg.showNotification('You’re subscribed to NMX Labs', {
      body: 'This is how new posts will look. Tap to see what’s new.', icon: '/assets/pwa/icon-192.png', badge: '/assets/pwa/badge-96.png',
      tag: 'nmx-welcome', data: { url: '/blog/', check: 1, campaign: '', sid: st.id || '' }
    }).then(function () {
      Pill.show('ask', '<span>We just sent you a test notification. Did it show up?</span><span class="nx-pill-acts"><button type="button" class="nx-pill-btn" data-pill="yes">Yes</button><button type="button" class="nx-pill-btn nx-pill-btn--ghost" data-pill="no">No</button></span>', 20000);
    }).catch(function (err) {
      logEvent('push_check_fail', String(err && err.name || err).slice(0, 60) + '|' + (BRAND || U.os));
      Pill.show('error', '<span>Notifications are on in your browser, but your device is blocking them.</span><button type="button" class="nx-pill-btn" data-pill="fix" data-reason="system">Fix it</button>', 20000);
    });
  }

  function turnOff() {
    var st = pushState();
    return (swReady || Promise.reject()).then(function (reg) { return reg.pushManager.getSubscription(); })
      .then(function (sub) { return sub ? sub.unsubscribe() : true; })
      .then(function () { if (st && st.endpoint) return post({ action: 'push_unsubscribe', id: st.id, endpoint: st.endpoint }).catch(function () {}); })
      .then(function () { setPushState(null); store('nmx-push-pending', null); });
  }

  /* =========================================================== notifications: the Follow panel */
  function topicsHtml(sel) {
    var on = String(sel || 'blog,youtube').split(',');
    return '<fieldset class="nx-topics"><legend>Notify me about</legend>' +
      '<label><input type="checkbox" value="blog"' + (on.indexOf('blog') > -1 ? ' checked' : '') + '> New posts and lessons</label>' +
      '<label><input type="checkbox" value="youtube"' + (on.indexOf('youtube') > -1 ? ' checked' : '') + '> New YouTube videos</label></fieldset>';
  }
  function pickedTopics() { return $$('.nx-topics input:checked', panel).map(function (i) { return i.value; }).join(','); }
  function footHtml() {
    var n = savedList().length, bits = [];
    bits.push('<a href="/saved/" data-no-track>Saved posts' + (n ? ' (' + n + ')' : '') + '</a>');
    if (installEvt && !STANDALONE) bits.push('<button type="button" class="nx-link" data-nx-install>Install the app</button>');
    return '<div class="nx-foot">' + bits.join('') + '</div>';
  }
  function iosSteps() {
    return '<ol class="nx-steps"><li>Tap the Share button in Safari.</li><li>Choose <strong>Add to Home Screen</strong>, then Add.</li><li>Open NMX Labs from your Home Screen and tap <strong>Follow</strong>.</li></ol>';
  }
  function renderAlerts() {
    var perm = permission(), st = pushState(), html;
    if (IOS_NEEDS_INSTALL) {
      html = head('Add NMX Labs to your Home Screen', true) + '<div class="nx-body">' +
        '<p>On iPhone and iPad, notifications work once the site is on your Home Screen.</p>' + iosSteps() +
        '<p class="nx-fine">Needs iOS 16.4 or later. Prefer email? <a href="/blog/#subHIdx">Get new posts by email</a>.</p></div>' + footHtml();
    } else if (st && perm === 'granted') {
      html = head('Notifications are on', false) + '<div class="nx-body">' +
        '<p>You’ll get one notification for each new post or video you picked below.</p>' + topicsHtml(st.topics) +
        '<div class="nx-actions"><button type="button" class="nx-btn nx-btn--ghost" data-nx-off>Turn off notifications</button>' +
        '<button type="button" class="nx-link" data-nx-guide>Not seeing them?</button></div>' +
        '<p class="nx-status" role="status"></p></div>' + footHtml();
    } else {
      html = head('Follow NMX Labs', true) + '<div class="nx-body">' +
        '<p>A short notification when we publish a post, a lesson or a YouTube video. No email needed, and you can switch it off in one tap.</p>' +
        topicsHtml('blog,youtube') +
        '<div class="nx-actions"><button type="button" class="nx-btn" data-nx-on data-nx-focus>' + I.bell + 'Turn on notifications</button></div>' +
        '<p class="nx-status" role="status"></p></div>' + footHtml();
    }
    panel.innerHTML = html;
    var status = $('.nx-status', panel);
    var on = $('[data-nx-on]', panel), off = $('[data-nx-off]', panel), inst = $('[data-nx-install]', panel), gd = $('[data-nx-guide]', panel);
    if (on) on.addEventListener('click', function () {
      var topics = pickedTopics();
      if (!topics) { status.textContent = 'Pick at least one: posts or YouTube videos.'; return; }
      enable(topics, 'follow');
    });
    if (gd) gd.addEventListener('click', function () { openPanel('guide', 'system'); });
    if (off) off.addEventListener('click', function () {
      off.disabled = true; status.textContent = 'Turning off…';
      turnOff().then(function () { logEvent('push_unsubscribe'); track('PushUnsubscribe', { page_path: path }); renderAlerts(); $('.nx-status', panel).textContent = 'Notifications are off. Turn them back on any time from Follow.'; })
        .catch(function () { off.disabled = false; status.textContent = 'That didn’t work. Reload the page and try again.'; });
    });
    if (st && perm === 'granted') $$('.nx-topics input', panel).forEach(function (box) {
      box.addEventListener('change', function () {
        var t = pickedTopics();
        if (!t) { box.checked = true; status.textContent = 'Keep at least one, or turn notifications off.'; return; }
        st.topics = t; setPushState(st); status.textContent = 'Saved.';
        if (st.endpoint && st.id) post({ action: 'push_update', id: st.id, endpoint: st.endpoint, topics: t }).catch(function () { status.textContent = 'Couldn’t save that. Try again in a minute.'; });
      });
    });
    if (inst) inst.addEventListener('click', install);
  }

  /* =========================================================== notifications: fixing a block */
  // No website can switch notifications on by itself: the browser and the phone both have to allow them, and only the
  // reader can change those settings. This panel shows the exact steps for the reader's device.
  function guideSteps(reason) {
    var os = U.os, br = U.br, appName = br === 'Other' ? 'your browser' : br, steps = [], tips = [];
    var siteStep = 'In ' + appName + ', tap the icon to the left of the address (ⓘ, the lock or the sliders) → <strong>Permissions</strong> or <strong>Site settings</strong> → <strong>Notifications</strong> → <strong>Allow</strong>.';
    if (reason === 'inapp') return { title: 'Open this page in your browser', intro: 'Instagram, Facebook and other in-app browsers can’t show notifications. Open labsnmx.com in Chrome or Safari, then tap Follow there.',
      steps: ['Tap the ⋯ or ⋮ menu at the top of this screen.', 'Choose <strong>Open in browser</strong> (or Open in Chrome / Safari).', 'Tap <strong>Follow</strong> on labsnmx.com.'], tips: [], copy: true };
    if (reason === 'unsupported') return { title: 'This browser can’t do notifications', intro: 'Use Chrome, Edge, Firefox, Samsung Internet or Safari (on iPhone, from the Home Screen app), or get new posts by email instead.', steps: [], tips: [] };
    if (os === 'iOS') {
      if (!STANDALONE) return { title: 'Add NMX Labs to your Home Screen', intro: 'Apple only allows website notifications for sites added to the Home Screen (iOS 16.4 or later).',
        steps: ['Tap the Share button in Safari.', 'Choose <strong>Add to Home Screen</strong>, then Add.', 'Open NMX Labs from your Home Screen and tap <strong>Follow</strong>.'], tips: [] };
      steps = ['Open your iPhone’s <strong>Settings</strong> → <strong>Notifications</strong> → <strong>NMX Labs</strong>.', 'Turn on <strong>Allow Notifications</strong> and pick Banners.', 'Close NMX Labs completely, open it again from the Home Screen and tap <strong>Check again</strong>.'];
      tips = ['A Focus mode (Do Not Disturb, Sleep, Work) hides notifications until it ends. Check Control Centre.'];
    } else if (os === 'Android') {
      var app = br === 'Samsung Internet' ? 'Samsung Internet' : br === 'Firefox' ? 'Firefox' : br === 'Edge' ? 'Edge' : br === 'Opera' ? 'Opera' : 'Chrome';
      steps = ['Open your phone’s <strong>Settings</strong> → <strong>Apps</strong> → <strong>' + app + '</strong> → <strong>Notifications</strong>, and turn on <strong>Allow notifications</strong> (some phones say Show notifications).',
        'On the same screen, open <strong>Sites</strong> (or find <strong>labsnmx.com</strong> in the list) and make sure it’s on.',
        br === 'Samsung Internet' ? 'In Samsung Internet, tap ≡ → <strong>Settings</strong> → <strong>Sites and downloads</strong> → <strong>Notifications</strong>, and allow labsnmx.com.' : siteStep];
      if (BRAND === 'xiaomi') tips.push('Xiaomi, Redmi and POCO: in Settings → Apps → Manage apps → ' + app + ', set <strong>Battery saver</strong> to <strong>No restrictions</strong> and turn on <strong>Autostart</strong>, or notifications arrive late or not at all.');
      else if (BRAND === 'samsung') tips.push('Samsung: in Settings → Battery → <strong>Background usage limits</strong>, make sure ' + app + ' isn’t in Sleeping apps or Deep sleeping apps.');
      else if (BRAND === 'vivo') tips.push('vivo and iQOO: in Settings → Battery → <strong>Background power consumption management</strong>, set ' + app + ' to Allow.');
      else if (BRAND === 'oppo') tips.push('OPPO, realme and OnePlus: in Settings → Apps → ' + app + ' → <strong>Battery usage</strong>, turn on <strong>Allow background activity</strong>.');
      else tips.push('If your phone has a battery saver for apps, set ' + app + ' to unrestricted, or notifications can arrive late.');
      tips.push('Do Not Disturb hides notifications until you turn it off.');
    } else if (os === 'Windows') {
      steps = ['Open Windows <strong>Settings</strong> → <strong>System</strong> → <strong>Notifications</strong>. Turn on Notifications and the switch for ' + appName + '.', siteStep];
      tips = ['Turn off <strong>Do not disturb</strong> (or Focus assist) in the same place.'];
    } else if (os === 'macOS') {
      steps = ['Open <strong>System Settings</strong> → <strong>Notifications</strong> → <strong>' + (br === 'Chrome' ? 'Google Chrome' : br === 'Edge' ? 'Microsoft Edge' : appName) + '</strong>, and turn on <strong>Allow notifications</strong> (Banners or Alerts).', siteStep];
      tips = ['A Focus mode hides notifications until it ends. Check the Control Centre.'];
    } else {
      steps = [siteStep, 'Make sure your system allows notifications from ' + appName + ' and Do Not Disturb is off.'];
    }
    var intro = reason === 'denied' ? 'Notifications for labsnmx.com are blocked on this device. A website can’t switch them back on by itself; only you can, in about 20 seconds:'
      : reason === 'error' ? 'Your browser couldn’t register for notifications. These settings are the usual cause:'
      : 'Your browser has allowed notifications, but your device is hiding them. Here’s how to let them through:';
    return { title: reason === 'denied' ? 'Notifications are blocked' : 'Let notifications through', intro: intro, steps: steps, tips: tips };
  }
  function renderGuide(reason) {
    var g = guideSteps(reason || 'system');
    logEvent('push_guide', (reason || 'system') + '|' + (BRAND || U.os) + '|' + U.br);
    panel.innerHTML = head(g.title, false) + '<div class="nx-body nx-guide">' +
      '<p>' + g.intro + '</p>' +
      (g.steps.length ? '<ol class="nx-steps">' + g.steps.map(function (s) { return '<li>' + s + '</li>'; }).join('') + '</ol>' : '') +
      (g.tips.length ? '<ul class="nx-tips">' + g.tips.map(function (s) { return '<li>' + s + '</li>'; }).join('') + '</ul>' : '') +
      '<div class="nx-actions">' +
        (g.copy ? '<button type="button" class="nx-btn" data-nx-copy data-nx-focus>Copy the link</button>' : '') +
        (!g.copy && PUSH_API && !(IOS && !STANDALONE) ? '<button type="button" class="nx-btn" data-nx-recheck data-nx-focus>Check again</button>' : '') +
        '<a class="nx-link" href="/blog/#subHIdx" data-no-track>Get posts by email instead</a></div>' +
      '<p class="nx-status" role="status"></p></div>';
    var st = $('.nx-status', panel), re = $('[data-nx-recheck]', panel), cp = $('[data-nx-copy]', panel);
    if (cp) cp.addEventListener('click', function () {
      var url = location.href.split('#')[0];
      (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(function () { st.textContent = 'Copied. Paste it into Chrome or Safari.'; })
        .catch(function () { st.textContent = url; });
    });
    if (re) re.addEventListener('click', function () {
      var perm = permission();
      if (perm === 'denied') { st.innerHTML = 'Still blocked. After changing the setting, <a href="' + esc(location.pathname) + '">reload this page</a> and tap Follow.'; return; }
      re.disabled = true; st.textContent = 'Checking…';
      var go = perm === 'granted' ? Promise.resolve() : new Promise(function (res) { var r = Notification.requestPermission(res); if (r && r.then) r.then(res); }).then(function (p) { if (p !== 'granted') throw new Error(p); });
      go.then(function () { var s = pushState() || {}; s.verified = false; s.topics = s.topics || 'blog,youtube'; s.pending = true; setPushState(s); return finishSubscribe(s.topics); })
        .then(function (reg) { closePanel(); deliveryCheck(reg); })
        .catch(function (e) { re.disabled = false; st.textContent = /denied/.test(String(e && e.message)) ? 'Still blocked. Follow the steps above, then try again.' : 'Not yet. Follow the steps above, then tap Check again.'; });
    });
  }

  /* =========================================================== notifications: asking at the right moment */
  // The reading prompt: a small card once a reader is a few lines into a post or lesson and scrolling on. It never opens
  // on arrival, never twice in a visit, and "Not now" keeps it away for 3, then 10, then 30 days.
  function canPrompt() {
    return PUSH_ON && (PUSH_API || IOS_NEEDS_INSTALL) && !INAPP && permission() === 'default' && !pushState() && !snoozed() &&
      !ssGet('nmx-prompted') && !openKind && sheet.hidden && !(doc.activeElement && /INPUT|TEXTAREA|SELECT/.test(doc.activeElement.tagName)) &&
      !$('.player:not([hidden])') && !doc.querySelector('[data-game-active]');
  }
  function lesson() { return /^\/learn\/[^/]+\//.test(path); }
  // v6: a half-screen sheet (50% of the screen) with an animated bell. The headline rotates, so regulars don't see the
  // same joke twice in a row. It still only opens after ~4 lines of reading and a scroll, and only once per visit.
  var QUIPS = [
    ['You read four whole lines. In 2026 that’s basically a commitment.', 'So let’s make it official. We publish 3–4 new articles a week, and your browser can give you one quiet ping when each goes live.'],
    ['Liking this? Imagine not having to remember us.', 'One ping when a new {noun} drops. No inbox, no “URGENT”, no guilt trips. We post 3–4 times a week.'],
    ['Psst. There’s more where this came from.', 'Three or four new articles a week on design, AI and marketing, written by actual humans. Want a tap on the shoulder when the next one lands?'],
    ['Good taste detected. Want the next one first?', 'Notifications beat refreshing our homepage like it owes you money. One ping per new {noun}, off in one tap.'],
    ['We’d rather ring a bell than chase you on LinkedIn.', 'Allow notifications and the next {noun} finds you. We post 3–4 times a week and never send anything else.']
  ];
  var BELL = '<svg class="nx-hb-svg" viewBox="0 0 120 120" aria-hidden="true">' +
    '<g class="nx-hb-waves" fill="none" stroke-linecap="round"><path d="M24 44a40 40 0 0 0 0 32"/><path d="M14 38a52 52 0 0 0 0 44"/><path d="M96 44a40 40 0 0 1 0 32"/><path d="M106 38a52 52 0 0 1 0 44"/></g>' +
    '<g class="nx-hb-bell"><path class="nx-hb-body" d="M60 22c-14 0-24 11-24 26v16l-7 11h62l-7-11V48c0-15-10-26-24-26z"/><path class="nx-hb-lip" d="M27 75h66a3 3 0 0 1 0 6H27a3 3 0 0 1 0-6z"/>' +
    '<circle class="nx-hb-knob" cx="60" cy="19" r="5"/><path class="nx-hb-shine" d="M46 50c0-8 4-14 10-16" fill="none" stroke-linecap="round"/></g>' +
    '<circle class="nx-hb-clap" cx="60" cy="88" r="7"/>' +
    '<g class="nx-hb-spark"><path d="M98 18l2.5 6 6 2.5-6 2.5-2.5 6-2.5-6-6-2.5 6-2.5z"/><path d="M20 96l1.6 4 4 1.6-4 1.6-1.6 4-1.6-4-4-1.6 4-1.6z"/></g></svg>';
  function showSheet(reason) {
    if (!canPrompt()) return;
    ssSet('nmx-prompted', '1');
    var ios = IOS_NEEDS_INSTALL, noun = lesson() ? 'lesson' : 'post';
    var n = (Number(read('nmx-quip') || -1) + 1) % QUIPS.length; store('nmx-quip', String(n));
    var q = QUIPS[n], body = q[1].replace(/\{noun\}/g, noun);
    sheet.classList.add('nx-sheet--half');
    sheet.innerHTML = '<button class="nx-x" type="button" aria-label="Close" data-sheet="no" data-no-track>' + I.x + '</button>' +
      '<div class="nx-hs-in">' +
        '<div class="nx-hs-art" aria-hidden="true">' + (ios ? '<span class="nx-hs-phone">' + I.phone + '</span>' : BELL) + '<span class="nx-hs-badge">3–4 new a week</span></div>' +
        '<div class="nx-hs-txt"><p class="nx-hs-kick">' + (ios ? 'iPhone readers, one quick step' : 'Enjoying this ' + noun + '?') + '</p>' +
          '<h2 id="nxSheetT">' + (ios ? 'Get new ' + noun + 's on your iPhone' : esc(q[0])) + '</h2>' +
          '<p>' + (ios ? 'Add NMX Labs to your Home Screen, then tap Follow. Apple only allows website notifications that way. Takes ten seconds, promise.' : esc(body)) + '</p>' +
          (ios ? '' : '<ul class="nx-hs-pts"><li>One ping per new ' + noun + '</li><li>No email, no account</li><li>Off in one tap</li></ul>') +
          '<div class="nx-sheet-acts">' + (ios ? '<button type="button" class="nx-btn" data-sheet="ios">Show me how</button>' : '<button type="button" class="nx-btn nx-btn--big" data-sheet="yes">' + I.bell + '<span>Ring me when there’s more</span></button>') +
          '<button type="button" class="nx-link" data-sheet="no">I’ll risk missing out</button></div>' +
        '</div>' +
      '</div>';
    sheet.hidden = false; sheet.setAttribute('data-reason', reason);
    if (!REDUCED) { sheet.classList.remove('nx-ringing'); void sheet.offsetWidth; sheet.classList.add('nx-ringing'); }
    logEvent('prompt_shown', reason + ':q' + n); track('PushPromptShown', { reason: reason, page_path: path, quip: n });
  }
  function hideSheet() {
    if (sheet.hidden) return;
    if (REDUCED || !sheet.classList.contains('nx-sheet--half')) { sheet.hidden = true; sheet.innerHTML = ''; return; }
    sheet.classList.add('nx-sheet--out');
    setTimeout(function () { sheet.hidden = true; sheet.innerHTML = ''; sheet.classList.remove('nx-sheet--out', 'nx-ringing'); }, 260);
  }
  function dismissSheet() { snooze(); logEvent('prompt_later', sheet.getAttribute('data-reason') || ''); hideSheet(); }
  doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !sheet.hidden) dismissSheet(); });
  sheet.addEventListener('click', function (e) {
    var b = e.target.closest('[data-sheet]'); if (!b) return;
    var a = b.getAttribute('data-sheet');
    if (a === 'yes') { hideSheet(); enable('blog,youtube', 'read_prompt'); }
    else if (a === 'ios') { hideSheet(); openPanel('alerts'); }
    else dismissSheet();
  });
  (function watchReading() {
    if (!(PUSH_ON && (PUSH_API || IOS_NEEDS_INSTALL)) || INAPP) return;
    var prose = $('#article .prose'); if (!prose) return;
    var first = $('p', prose) || prose;
    var lh = parseFloat(getComputedStyle(first).lineHeight) || 28, t0 = Date.now(), startY = scrollY, moved = 0, lastY = scrollY, timer;
    function check() {
      var y = scrollY; if (y > lastY) moved += y - lastY; lastY = y;
      var fourth = first.getBoundingClientRect().top + lh * 4;                 // where the 4th line of the post sits now
      var read = fourth < innerHeight * 0.55;                                  // ...it has reached the reading zone
      if (read && moved > 80 && y > startY && Date.now() - t0 > 4000) { removeEventListener('scroll', onScroll); clearTimeout(timer); setTimeout(function () { showSheet(lesson() ? 'read_lesson' : 'read_4_lines'); }, 600); }
    }
    function onScroll() { clearTimeout(timer); timer = setTimeout(check, 120); }
    addEventListener('scroll', onScroll, { passive: true });
  })();

  // The end-of-post card: a quiet, inline offer where a reader finishes, instead of a pop-up.
  (function endCard() {
    if (!PUSH_ON || INAPP || !(PUSH_API || IOS_NEEDS_INSTALL)) return;
    var prose = $('#article .prose'); if (!prose || isOn() || (PUSH_API && permission() === 'denied')) return;
    var noun = lesson() ? 'lesson' : 'post';
    var c = doc.createElement('aside'); c.className = 'nx-endcard'; c.setAttribute('aria-label', 'Get notifications');
    c.innerHTML = '<span class="nx-endcard-ic" aria-hidden="true">' + I.bell + '</span><div><h2>Get the next ' + noun + ' as a notification</h2>' +
      '<p>' + (IOS_NEEDS_INSTALL ? 'On iPhone, add NMX Labs to your Home Screen first, then tap Follow.' : 'One tap. No email, nothing else. Switch it off whenever you like.') + '</p></div>' +
      '<button type="button" class="nx-btn" data-nx-end>' + (IOS_NEEDS_INSTALL ? 'Show me how' : 'Turn on') + '</button>';
    prose.parentNode.insertBefore(c, prose.nextSibling);
    var seen = false;
    if ('IntersectionObserver' in window) new IntersectionObserver(function (en, ob) { if (en[0].isIntersecting && !seen) { seen = true; ob.disconnect(); logEvent('endcard_seen', noun); } }, { threshold: 0.6 }).observe(c);
    $('[data-nx-end]', c).addEventListener('click', function () { if (IOS_NEEDS_INSTALL) openPanel('alerts'); else enable('blog,youtube', 'end_card'); });
  })();
  window.nmxFollow = function (source) { enable('blog,youtube', source || 'custom'); };

  // A short ring on the Follow button for new readers, once, a little after they arrive.
  if (bellBtn && !pushState() && views <= 3 && !REDUCED && permission() !== 'denied') {
    setTimeout(function () { bellBtn.classList.add('nx-ring'); setTimeout(function () { bellBtn.classList.remove('nx-ring'); }, 1300); }, 9000);
  }

  /* =========================================================== Ask NMX Labs */
  var S = {
    branding: ['Branding & Identity', '₹25,000 (starting price)', 'brand discovery session, logo concept and refinement, primary and secondary logo, colour palette and typography system, social profile assets, and mini brand guidelines with source files'],
    social: ['Social Media Creative', '₹8,000 a month', '8 custom static or carousel creatives every month in a consistent visual system, with 2 revision rounds. It’s design only: no posting, captions or community management'],
    campaign: ['Campaign Creative', '₹10,000 per campaign', 'campaign concept and creative direction, 1 key visual, 3–5 adaptations across formats, social and ad exports, and 2 revision rounds'],
    bundle: ['Creative + Meta Ads', '₹15,000 a month plus ad spend', 'campaign strategy, ad creative, Meta campaign setup and audience targeting, and ongoing optimisation and performance monitoring, built as one system'],
    metaads: ['Meta Ads Management', '₹8,000 a month (ad spend billed separately)', 'campaign setup and audience research, up to 2 active campaigns, weekly optimisation and basic performance reporting'],
    design: ['Brand & Marketing Design', 'from ₹7,500', 'pitch decks and brochures, catalogues and collateral, and email and presentation design. The final quote depends on pages and complexity']
  };
  function svc(k) { var s = S[k]; return s[0] + ' is ' + s[1] + '. It includes ' + s[2] + '.\n\nWant a quote for your project? Message us on WhatsApp: https://wa.me/' + WHATSAPP; }
  var A = {
    hi: function () { return 'Hi! Ask me about our services, pricing or anything on the blog. If you’d rather talk to a person, tap “Talk to a person” below.'; },
    price: function () { return 'Our pricing is fixed and upfront:\n• Branding & Identity: from ₹25,000\n• Social Media Creative: ₹8,000/month\n• Campaign Creative: ₹10,000 per campaign\n• Meta Ads Management: ₹8,000/month + ad spend\n• Creative + Meta Ads bundle: ₹15,000/month + ad spend\n• Brand & Marketing Design: from ₹7,500\n\nAsk about any of these for what’s included.'; },
    branding: function () { return svc('branding'); }, social: function () { return svc('social'); }, campaign: function () { return svc('campaign'); },
    design: function () { return svc('design'); },
    meta: function () { return 'Yes, we run Meta (Facebook and Instagram) ads. Meta Ads Management is ₹8,000 a month with ad spend billed separately: setup, audience research, up to 2 active campaigns, weekly optimisation and reporting.\n\nOr take the Creative + Meta Ads bundle at ₹15,000 a month plus spend, where the ads and the creative are built together.'; },
    start: function () { return 'Book a free 1:1 session on WhatsApp (https://wa.me/' + WHATSAPP + ') or DM @_nmxlabs on Instagram. Tell us what you’re working on; we agree scope and a fixed price upfront, and a person usually replies within a day. Timelines are confirmed on that call.'; },
    contact: function () { return 'WhatsApp or call: +91 88104 38717 (https://wa.me/' + WHATSAPP + ')\nEmail: ' + EMAIL + '\nInstagram: @_nmxlabs\n\nOr tap “Talk to a person” below and leave your details.'; },
    where: function () { return 'We’re based in Gurugram, Haryana (D3B, Shyam Kunj) and work with clients worldwide, mostly over WhatsApp, Slack and video calls.'; },
    clients: function () { return 'We work with D2C brands, EV and energy, SaaS, hospitality and creator-led businesses, from pre-launch to post-Series A. Some of the brands are on the home page: https://labsnmx.com/#clients'; },
    who: function () { return 'NMX Labs is a creative and performance marketing studio in Gurugram: brand identity, social and campaign creative, and Meta Ads management, done by one small senior team with no account layer.'; },
    alerts: function () { return 'Two free ways to hear about new posts: browser notifications (tap Follow next to this chat) or email (the subscribe box on the blog: https://labsnmx.com/blog/). Both are one tap to switch off.'; },
    blog: null
  };
  var INTENTS = [
    ['hi', /^(hi+|hello|hey|namaste|good (morning|afternoon|evening))\b[\s!.]*$/i],
    ['branding', /\b(branding|brand identity|logo|identity|guidelines|rebrand)\b/i],
    ['social', /\b(social media|social|creatives?|carousels?|feed posts?)\b/i],
    ['campaign', /\bcampaign creative|\bcampaign concept|\bkey visual/i],
    ['meta', /\b(meta|facebook|fb|instagram ads?|paid ads|ads management|media buying|performance marketing|run (my |our )?ads)\b/i],
    ['design', /\b(deck|pitch deck|brochure|catalog(ue)?|collateral|presentation)\b/i],
    ['price', /\b(price|prices|pricing|cost|costs|charge|charges|rates?|fees?|how much|packages?|quote)\b/i],
    ['start', /\b(get started|start|begin|process|onboard\w*|next step|how (do|does) (it|this|we) work|timeline|how long|turnaround)\b/i],
    ['contact', /\b(contact|whats ?app|phone|call|email|reach|book|meeting|session|consult\w*)\b/i],
    ['where', /\b(where|located|location|office|gurugram|gurgaon|international|worldwide|abroad|outside india)\b/i],
    ['alerts', /\b(notif\w*|alerts?|subscribe|newsletter)\b/i],
    ['blog', /\b(blog|posts?|articles?|latest|new on|read)\b/i],
    ['clients', /\b(clients?|portfolio|case stud(y|ies)|industr(y|ies)|who do you work with)\b/i],
    ['who', /\b(who are you|about (you|nmx)|your team|the studio|what (is|does) nmx)\b/i]
  ];
  function intentOf(q) { for (var i = 0; i < INTENTS.length; i++) if (INTENTS[i][1].test(q)) return INTENTS[i][0]; return ''; }
  function blogAnswer() {
    return fetch('/blog/posts.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (d) {
      var p = (d.posts || []).slice(0, 3);
      if (!p.length) throw new Error('none');
      return 'Latest on the blog:\n' + p.map(function (x) { return '• ' + x.title + ' ' + x.url; }).join('\n') + '\n\nAll posts: https://labsnmx.com/blog/';
    }).catch(function () { return 'You’ll find every post at https://labsnmx.com/blog/'; });
  }
  function notSure(text) { return 'I can help with our services, pricing and the blog. For anything else, a person at the studio will answer on WhatsApp: https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent('Hi NMX Labs, ' + text) + ' or email ' + EMAIL + '.'; }
  function localAnswer(intent) { return intent === 'blog' ? blogAnswer() : Promise.resolve(A[intent]()); }

  var CHIPS = [['What does branding cost?', 'branding'], ['Do you run Meta ads?', 'meta'], ['How do we get started?', 'start'], ['What’s new on the blog?', 'blog']];
  function chatHistory() { try { return JSON.parse(sessionStorage.getItem('nmx-ask') || '[]'); } catch (e) { return []; } }
  function saveHistory(h) { try { sessionStorage.setItem('nmx-ask', JSON.stringify(h.slice(-14))); } catch (e) {} }
  function bubble(role, text) {
    var el = doc.createElement('div'); el.className = 'nx-msg nx-msg--' + (role === 'user' ? 'me' : 'bot');
    String(text).split(/(https?:\/\/[^\s)]+|[\w.+-]+@[\w-]+\.[\w.]+)/g).forEach(function (part, i) {
      if (i % 2) {
        var a = doc.createElement('a'), mail = part.indexOf('@') > -1 && !/^https?:/.test(part), href = part.replace(/[.,]+$/, '');
        a.href = mail ? 'mailto:' + href : href; a.textContent = href;
        if (!mail && !/^https:\/\/(www\.)?labsnmx\.com/.test(href)) { a.target = '_blank'; a.rel = 'noopener'; }
        el.appendChild(a); if (href.length < part.length) el.appendChild(doc.createTextNode(part.slice(href.length)));
      } else if (part) el.appendChild(doc.createTextNode(part));
    });
    return el;
  }
  function renderAsk() {
    panel.innerHTML = head('Ask NMX Labs', false) +
      '<div class="nx-chat"><div class="nx-msgs" aria-live="polite"></div>' +
      '<div class="nx-chips"></div>' +
      '<form class="nx-compose"><label class="nx-sr" for="nxQ">Your question</label>' +
      '<textarea id="nxQ" rows="1" maxlength="400" placeholder="Ask about services, pricing or a post" data-nx-focus></textarea>' +
      '<button class="nx-send" type="submit" aria-label="Send" data-no-track>' + I.send + '</button></form>' +
      '<div class="nx-fine"><button type="button" class="nx-link" data-nx-human>Talk to a person</button><span>Answers are automatic and can be wrong; prices are confirmed on a call.</span></div></div>';
    var msgs = $('.nx-msgs', panel), chips = $('.nx-chips', panel), form = $('.nx-compose', panel), q = $('#nxQ', panel), h = chatHistory();
    msgs.appendChild(bubble('model', 'Hi! I can answer questions about our services, pricing and the blog. For a real conversation, a person at the studio replies on WhatsApp.'));
    h.forEach(function (m) { msgs.appendChild(bubble(m.role, m.text)); });
    if (h.length < 2) CHIPS.forEach(function (c) {
      var b = doc.createElement('button'); b.type = 'button'; b.className = 'nx-chip'; b.textContent = c[0]; b.setAttribute('data-no-track', '');
      b.addEventListener('click', function () { ask(c[0], c[1]); }); chips.appendChild(b);
    });
    function scroll() { msgs.scrollTop = msgs.scrollHeight; }
    scroll();
    q.addEventListener('input', function () { q.style.height = 'auto'; q.style.height = Math.min(q.scrollHeight, 120) + 'px'; });
    q.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit', { cancelable: true })); } });
    form.addEventListener('submit', function (e) { e.preventDefault(); var t = q.value.trim(); if (t.length >= 2) { q.value = ''; q.style.height = ''; ask(t); } });
    $('[data-nx-human]', panel).addEventListener('click', function () { leadForm(msgs, scroll); });

    function ask(text, chipIntent) {
      chips.innerHTML = '';
      var hist = chatHistory(); hist.push({ role: 'user', text: text }); saveHistory(hist);
      msgs.appendChild(bubble('user', text)); scroll();
      var typing = doc.createElement('div'); typing.className = 'nx-msg nx-msg--bot nx-typing'; typing.innerHTML = '<span></span><span></span><span></span>'; typing.setAttribute('aria-label', 'Typing');
      msgs.appendChild(typing); scroll();
      var intent = chipIntent || intentOf(text), words = text.split(/\s+/).length;
      var useLocal = !READY || !!chipIntent || (!!intent && words <= 7);
      var answer = useLocal
        ? (intent ? localAnswer(intent) : Promise.resolve(notSure(text))).then(function (a) { logEvent('ask', 'faq:' + (intent || 'none') + ' | ' + text.slice(0, 150)); return { text: a, src: intent ? 'faq' : 'none' }; })
        : post({ action: 'assistant', q: text, h: JSON.stringify(hist.slice(-7, -1)), path: path, vid: VID })
            .then(function (d) { return { text: d.answer, src: 'ai' }; })
            .catch(function () {
              logEvent('ask', 'fallback:' + (intent || 'none') + ' | ' + text.slice(0, 150));
              return intent ? localAnswer(intent).then(function (a) { return { text: a, src: 'faq' }; })
                : { text: notSure(text), src: 'none' };
            });
      answer.then(function (a) {
        typing.remove();
        var hh = chatHistory(); hh.push({ role: 'model', text: a.text }); saveHistory(hh);
        msgs.appendChild(bubble('model', a.text)); scroll();
        track('AssistantQuestion', { source: a.src, page_path: path });
      });
    }
  }
  function leadForm(msgs, scroll) {
    if ($('.nx-lead', panel)) { $('.nx-lead input', panel).focus(); return; }
    var last = chatHistory().filter(function (m) { return m.role === 'user'; }).pop();
    var wa = 'https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent('Hi NMX Labs, ' + (last ? last.text : 'I’d like to talk about a project.'));
    var f = doc.createElement('form'); f.className = 'nx-lead'; f.noValidate = true;
    f.innerHTML = '<p><strong>Leave your details and a person will get back to you,</strong> usually within a day. Or <a href="' + esc(wa) + '" target="_blank" rel="noopener">message us on WhatsApp</a> now.</p>' +
      '<label>Name<input name="name" autocomplete="name" maxlength="60" required></label>' +
      '<label>Email or phone<input name="contact" autocomplete="email" maxlength="120" required></label>' +
      '<label>What do you need?<textarea name="message" rows="3" maxlength="1000">' + esc(last ? last.text : '') + '</textarea></label>' +
      '<input name="website" tabindex="-1" autocomplete="off" class="nx-hp" aria-hidden="true">' +
      '<button class="nx-btn" type="submit">Send to the studio</button><p class="nx-status" role="status"></p>';
    var F = function (n) { return f.querySelector('[name="' + n + '"]'); };
    msgs.appendChild(f); scroll(); F('name').focus();
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var st = $('.nx-status', f), name = F('name').value.trim(), contact = F('contact').value.trim(), msg = F('message').value.trim(), btn = $('button[type=submit]', f);
      if (F('website').value) return;
      if (name.length < 2) { st.textContent = 'Add your name.'; F('name').focus(); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(contact) && contact.replace(/\D/g, '').length < 8) { st.textContent = 'Add an email address or a phone number we can reach.'; F('contact').focus(); return; }
      btn.disabled = true; st.textContent = 'Sending…';
      var send = READY ? post({ action: 'lead', name: name, contact: contact, message: msg, path: path, vid: VID, website: '' })
        : fetch('https://formsubmit.co/ajax/' + encodeURIComponent(CFG.FALLBACK_INBOX || EMAIL), { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ _subject: 'New enquiry from the site assistant', name: name, contact: contact, message: msg, page: location.href, _template: 'table' }) })
            .then(function (r) { return r.json(); }).then(function (d) { if (!d || String(d.success) !== 'true') throw new Error('inbox'); });
      send.then(function () {
        st.textContent = 'Thanks, ' + name + '. We’ve got it and will reply soon.'; btn.hidden = true;
        track('Lead', { content_name: 'Site assistant', content_category: 'lead' }); logEvent('lead');
      }).catch(function () { btn.disabled = false; st.textContent = 'That didn’t go through. Message us on WhatsApp instead.'; });
    });
  }

  /* =========================================================== saved posts */
  function savedList() { return readJSON('nmx-saved', []); }
  function setSaved(list) { store('nmx-saved', JSON.stringify(list.slice(0, 100))); }
  function swCache(type, urls) { if (SW && navigator.serviceWorker.controller) navigator.serviceWorker.controller.postMessage({ type: type, urls: urls }); }
  var article = $('#article');
  var tools = article && $('.tools[aria-label="Article tools"]', article);
  if (tools) {
    // v5: works for blog posts and Learn lessons alike
    var pageUrl = path.replace(/(amp\/)?(index\.html)?$/, '');
    var slug = pageUrl.replace(/^\/blog\//, '').replace(/^\//, '').replace(/\/$/, '');
    var hero = $('.post-hero img', article), crumbs = $$('.article-head .crumbs a', article);
    var me = { slug: slug, url: pageUrl, title: ($('.article-head h1', article) || {}).textContent || doc.title,
      img: hero ? hero.getAttribute('src') : '', cat: crumbs.length > 1 ? crumbs[crumbs.length - 1].textContent.trim() : 'Blog',
      min: ((($('.byline', article) || {}).textContent || '').match(/(\d+)\s*min/) || [])[1] || '' };
    var saveBtn = doc.createElement('button');
    saveBtn.type = 'button'; saveBtn.className = 'tool'; saveBtn.id = 'saveBtn'; saveBtn.setAttribute('data-track', 'SavePost');
    tools.appendChild(saveBtn);
    var paint = function () {
      var on = savedList().some(function (x) { return x.slug === slug; });
      saveBtn.setAttribute('aria-pressed', String(on)); saveBtn.innerHTML = I.mark + '<span>' + (on ? 'Saved' : 'Save for later') + '</span>';
    };
    paint();
    saveBtn.addEventListener('click', function () {
      var list = savedList(), i = -1;
      list.forEach(function (x, n) { if (x.slug === slug) i = n; });
      if (i > -1) { list.splice(i, 1); setSaved(list); swCache('uncache', [me.url]); toast('Removed from saved posts.'); logEvent('unsave', slug); }
      else {
        list.unshift({ slug: me.slug, url: me.url, title: me.title.trim(), img: me.img, cat: me.cat, min: me.min, at: today() }); setSaved(list);
        swCache('cache', [me.url].concat(me.img ? [me.img] : []));
        toast('Saved for later, readable offline too. <a href="/saved/">See saved posts</a>'); logEvent('save', slug); track('PostSaved', { slug: slug });
      }
      paint();
    });
  }
  var savedBox = $('[data-saved-list]');
  if (savedBox) {
    var drawSaved = function () {
      var list = savedList(), empty = $('[data-saved-empty]'), count = $('[data-saved-count]');
      if (count) count.textContent = list.length ? list.length + (list.length === 1 ? ' post' : ' posts') : '';
      if (empty) empty.hidden = list.length > 0;
      savedBox.innerHTML = list.map(function (p) {
        var thumb = p.img ? p.img.replace(/\.webp$/, '-640.webp') : '';
        return '<li class="post-row nx-saved-row"><a href="' + esc(p.url) + '">' +
          '<span class="row-thumb" aria-hidden="true">' + (thumb ? '<img src="' + esc(thumb) + '" alt="" width="640" height="360" loading="lazy" decoding="async" onerror="this.onerror=null;this.src=\'' + esc(p.img) + '\'">' : '') + '</span>' +
          '<div><span class="cat">' + esc(p.cat || 'Blog') + '</span><h3>' + esc(p.title) + '</h3></div>' +
          '<span class="meta">Saved ' + esc(p.at || '') + (p.min ? ' · ' + esc(p.min) + ' min read' : '') + '</span></a>' +
          '<button type="button" class="nx-remove" data-slug="' + esc(p.slug) + '">Remove</button></li>';
      }).join('');
    };
    drawSaved();
    savedBox.addEventListener('click', function (e) {
      var b = e.target.closest('[data-slug]'); if (!b) return;
      var s = b.getAttribute('data-slug'), gone = savedList().filter(function (x) { return x.slug === s; })[0];
      var list = savedList().filter(function (x) { return x.slug !== s; });
      setSaved(list); swCache('uncache', [gone && gone.url ? gone.url : '/blog/' + s + '/']); drawSaved(); logEvent('unsave', s);
    });
  }

  /* =========================================================== install as an app */
  var installEvt = null;
  addEventListener('beforeinstallprompt', function (e) { installEvt = e; $$('[data-install-app]').forEach(function (b) { b.hidden = false; }); });
  addEventListener('appinstalled', function () { installEvt = null; logEvent('app_installed'); track('AppInstalled', {}); $$('[data-install-app]').forEach(function (b) { b.hidden = true; }); });
  function install() {
    if (!installEvt) return;
    installEvt.prompt();
    installEvt.userChoice.then(function (c) { logEvent('install_' + c.outcome); installEvt = null; if (openKind === 'alerts') renderAlerts(); });
  }
  $$('[data-install-app]').forEach(function (b) { b.addEventListener('click', install); });
  if (STANDALONE && !ssGet('nmx-app-open')) { ssSet('nmx-app-open', '1'); logEvent('app_open'); }

  window.NMX_ENGAGE = { open: openPanel, close: closePanel, pushState: pushState, ready: READY, pushOn: PUSH_ON, follow: enable, fix: function (r) { openPanel('guide', r || 'system'); }, version: 'v5' };
})();
