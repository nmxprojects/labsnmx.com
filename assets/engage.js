/* NMX Labs engage layer (v4, 23 Nov 2026). Loaded by /assets/nmx.js on every page.
   - Browser notifications (standard Web Push with your own VAPID key, LaraPush-style, self-hosted, free)
   - "Ask NMX Labs" assistant: instant answers from the studio facts below, Google Gemini (free tier) through your
     Apps Script backend for anything else, and a hand-off to a person (lead form or WhatsApp)
   - Saved posts (stored in the reader's browser, readable offline), installable app (PWA)
   - First-party visitor statistics sent to your Google Sheet (respects Do Not Track / Global Privacy Control)
   Needs BACKEND_URL and VAPID_PUBLIC_KEY in /assets/nmx.js. Without them the bell stays hidden and the assistant
   answers from the studio facts only, so uploading this before setup breaks nothing. */
(function () {
  'use strict';
  if (window.NMX_ENGAGE_LOADED) return; window.NMX_ENGAGE_LOADED = true;

  var CFG = window.NMX_CFG || {};
  var doc = document, path = location.pathname;
  var READY = typeof window.NMX_backendReady === 'function' && window.NMX_backendReady();
  var VAPID = String(CFG.VAPID_PUBLIC_KEY || '').trim();
  var VAPID_OK = /^[A-Za-z0-9_-]{80,100}$/.test(VAPID);
  var WHATSAPP = '918810438717', EMAIL = 'nmxprojects@gmail.com';

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
    else if (/Edg\//.test(UAS)) br = 'Edge'; else if (/OPR\/|Opera/.test(UAS)) br = 'Opera';
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

  /* =========================================================== service worker (notifications + offline) */
  var SW = 'serviceWorker' in navigator && window.isSecureContext;
  var swReady = SW ? new Promise(function (resolve) {
    function reg() {
      navigator.serviceWorker.register('/sw.js' + (READY ? '?b=' + encodeURIComponent(CFG.BACKEND_URL) : ''), { scope: '/' })
        .then(function () { return navigator.serviceWorker.ready; }).then(resolve)
        .catch(function (e) { console.warn('[NMX] Service worker not registered:', e); });
    }
    doc.readyState === 'complete' ? reg() : addEventListener('load', reg);
  }) : null;

  var STANDALONE = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  var IOS = U.os === 'iOS';
  var PUSH_API = SW && 'PushManager' in window && 'Notification' in window;
  var PUSH_ON = READY && VAPID_OK;
  // iPhone/iPad: Safari only allows web push for sites added to the Home Screen (iOS 16.4+).
  var IOS_NEEDS_INSTALL = PUSH_ON && IOS && !STANDALONE && U.br !== 'In-app browser';
  var SHOW_BELL = PUSH_ON && (PUSH_API || IOS_NEEDS_INSTALL);

  /* =========================================================== UI shell */
  if (!$('link[href^="/assets/engage.css"]')) {
    var css = doc.createElement('link'); css.rel = 'stylesheet'; css.href = '/assets/engage.css?v=4'; doc.head.appendChild(css);
  }
  var I = {
    bell: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/></svg>',
    chat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 18.5 5.6 15A7.5 7.5 0 1 1 9 18.2z"/><path d="M9 11h.01M12 11h.01M15 11h.01"/></svg>',
    x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    send: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6"/></svg>',
    mark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5h10v15l-5-3.6-5 3.6z"/></svg>'
  };
  var rootEl = doc.createElement('div');
  rootEl.className = 'nx-root'; rootEl.setAttribute('data-nx', '');
  rootEl.innerHTML =
    '<div class="nx-panel" id="nxPanel" role="dialog" aria-modal="false" aria-labelledby="nxTitle" hidden></div>' +
    '<div class="nx-toast" role="status" aria-live="polite" hidden></div>' +
    '<div class="nx-dock">' +
      (SHOW_BELL ? '<button class="nx-bell" type="button" aria-label="Notifications" aria-expanded="false" aria-controls="nxPanel" data-no-track>' + I.bell + '<span class="nx-dot" aria-hidden="true"></span></button><span class="nx-sep" aria-hidden="true"></span>' : '') +
      '<button class="nx-ask" type="button" aria-expanded="false" aria-controls="nxPanel" data-no-track>' + I.chat + '<span>Ask NMX Labs</span></button>' +
    '</div>';
  doc.body.appendChild(rootEl);
  var panel = $('#nxPanel', rootEl), toastEl = $('.nx-toast', rootEl), bellBtn = $('.nx-bell', rootEl), askBtn = $('.nx-ask', rootEl);
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
    if (bellBtn) bellBtn.setAttribute('aria-expanded', String(openKind === 'alerts'));
    askBtn.setAttribute('aria-expanded', String(openKind === 'ask'));
  }
  function closePanel(silent) {
    if (!openKind) return;
    if (openKind === 'alerts' && panel.getAttribute('data-auto') === '1' && !silent) snooze(7);
    openKind = null; panel.hidden = true; panel.innerHTML = ''; panel.removeAttribute('data-auto'); setExpanded();
  }
  function openPanel(kind, auto) {
    openKind = kind; panel.hidden = false; panel.setAttribute('data-kind', kind);
    if (auto) panel.setAttribute('data-auto', '1'); else panel.removeAttribute('data-auto');
    setExpanded();
    if (kind === 'alerts') renderAlerts(); else renderAsk();
    if (!auto) { var f = $('[data-nx-focus]', panel) || $('button, input, textarea', panel); if (f) setTimeout(function () { f.focus(); }, 30); }
  }
  if (bellBtn) bellBtn.addEventListener('click', function () { if (openKind === 'alerts') closePanel(); else { openPanel('alerts'); track('NotificationPanelOpen', { page_path: path }); } });
  askBtn.addEventListener('click', function () { if (openKind === 'ask') closePanel(); else { openPanel('ask'); track('AssistantOpen', { page_path: path }); logEvent('assistant_open'); } });
  doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && openKind) { var k = openKind; closePanel(); (k === 'alerts' ? bellBtn : askBtn).focus(); } });
  doc.addEventListener('pointerdown', function (e) { if (openKind && !rootEl.contains(e.target) && panel.getAttribute('data-auto') !== '1') closePanel(); });

  function toast(html, ms) {
    toastEl.innerHTML = html; toastEl.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(function () { toastEl.hidden = true; }, ms || 4500);
  }
  function head(title, yellow) {
    return '<div class="nx-head' + (yellow ? ' nx-head--yellow' : '') + '"><h2 id="nxTitle">' + title + '</h2>' +
      '<button class="nx-x" type="button" aria-label="Close" data-nx-close data-no-track>' + I.x + '</button></div>';
  }
  panel.addEventListener('click', function (e) { if (e.target.closest('[data-nx-close]')) { var k = openKind; closePanel(); (k === 'alerts' ? bellBtn : askBtn).focus(); } });

  /* =========================================================== notifications (web push) */
  function pushState() { return readJSON('nmx-push', null); }
  function setPushState(s) { store('nmx-push', s ? JSON.stringify(s) : null); paintBell(); }
  function snooze(days) { store('nmx-push-snooze', String(Date.now() + days * 864e5)); }
  function snoozed() { return Date.now() < Number(read('nmx-push-snooze') || 0); }
  function permission() { return 'Notification' in window ? Notification.permission : 'default'; }
  function paintBell() {
    if (!bellBtn) return;
    var on = !!pushState() && permission() === 'granted';
    bellBtn.classList.toggle('is-on', on);
    bellBtn.setAttribute('aria-label', on ? 'Notifications are on' : 'Turn on notifications');
  }
  function b64u(s) {
    var p = '='.repeat((4 - s.length % 4) % 4), raw = atob((s + p).replace(/-/g, '+').replace(/_/g, '/'));
    var out = new Uint8Array(raw.length); for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i); return out;
  }
  function saveSub(sub, topics, oldEndpoint) {
    var j = sub.toJSON(), k = j.keys || {};
    return post({ action: 'push_subscribe', endpoint: j.endpoint, p256dh: k.p256dh || '', auth: k.auth || '', topics: topics,
      old_endpoint: oldEndpoint || '', br: U.br, os: U.os, dev: U.dev, co: COUNTRY, tz: TZ, lang: navigator.language || '',
      page: path, ref: FIRST.ref || SES.ref || '', us: FIRST.us || SES.us || '', um: FIRST.um || SES.um || '', uc: FIRST.uc || SES.uc || '',
      vid: VID, email: read('nmx-sub-email') || '', standalone: STANDALONE ? '1' : '' })
      .then(function (d) { setPushState({ id: d.id, endpoint: j.endpoint, topics: d.topics || topics, seen: today() }); return d; });
  }
  function turnOn(topics) {
    var perm = Notification.requestPermission();                       // must run straight from the click
    return Promise.resolve(perm).then(function (p) {
      if (p !== 'granted') { var err = new Error(p); err.perm = p; throw err; }
      return swReady;
    }).then(function (reg) {
      return reg.pushManager.getSubscription().then(function (old) {
        return old || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64u(VAPID) });
      });
    }).then(function (sub) { return saveSub(sub, topics); });
  }
  function turnOff() {
    var st = pushState();
    return swReady.then(function (reg) { return reg.pushManager.getSubscription(); })
      .then(function (sub) { return sub ? sub.unsubscribe() : true; })
      .then(function () { if (st) return post({ action: 'push_unsubscribe', id: st.id, endpoint: st.endpoint }).catch(function () {}); })
      .then(function () { setPushState(null); });
  }
  function syncPush() {
    if (!PUSH_ON || !PUSH_API || !swReady) return;
    swReady.then(function (reg) { return reg.pushManager.getSubscription(); }).then(function (sub) {
      var st = pushState();
      if (sub && permission() === 'granted') {
        if (!st || st.endpoint !== sub.endpoint) saveSub(sub, (st && st.topics) || 'blog,youtube', st && st.endpoint).catch(function () {});
        else if (st.seen !== today()) { st.seen = today(); setPushState(st); post({ action: 'push_seen', id: st.id, endpoint: st.endpoint }).catch(function () {}); }
      } else if (st && !sub) {
        post({ action: 'push_unsubscribe', id: st.id, endpoint: st.endpoint, reason: permission() }).catch(function () {});
        setPushState(null);
      }
      paintBell();
    });
  }
  syncPush(); paintBell();

  function topicsHtml(sel) {
    var on = String(sel || 'blog,youtube').split(',');
    return '<fieldset class="nx-topics"><legend>Notify me about</legend>' +
      '<label><input type="checkbox" value="blog"' + (on.indexOf('blog') > -1 ? ' checked' : '') + '> New blog posts</label>' +
      '<label><input type="checkbox" value="youtube"' + (on.indexOf('youtube') > -1 ? ' checked' : '') + '> New YouTube videos</label></fieldset>';
  }
  function pickedTopics() { return $$('.nx-topics input:checked', panel).map(function (i) { return i.value; }).join(','); }
  function footHtml() {
    var n = savedList().length, bits = [];
    bits.push('<a href="/saved/" data-no-track>Saved posts' + (n ? ' (' + n + ')' : '') + '</a>');
    if (installEvt && !STANDALONE) bits.push('<button type="button" class="nx-link" data-nx-install>Install the app</button>');
    return '<div class="nx-foot">' + bits.join('') + '</div>';
  }

  function renderAlerts() {
    var perm = permission(), st = pushState(), html;
    if (IOS_NEEDS_INSTALL) {
      html = head('Add NMX Labs to your Home Screen', true) + '<div class="nx-body">' +
        '<p>On iPhone and iPad, notifications work once the site is on your Home Screen.</p>' +
        '<ol class="nx-steps"><li>Tap the Share button in Safari.</li><li>Choose <strong>Add to Home Screen</strong>, then Add.</li><li>Open NMX Labs from your Home Screen and tap the bell.</li></ol>' +
        '<p class="nx-fine">Needs iOS 16.4 or later. Prefer email? <a href="/blog/#subHIdx">Get new posts by email</a>.</p></div>' + footHtml();
    } else if (perm === 'denied') {
      html = head('Notifications are blocked', false) + '<div class="nx-body">' +
        '<p>Your browser is blocking notifications from labsnmx.com. Open the site settings (the icon to the left of the address), set Notifications to Allow, then reload this page.</p>' +
        '<p class="nx-fine">Prefer email? <a href="/blog/#subHIdx">Get new posts by email</a>.</p></div>' + footHtml();
    } else if (st && perm === 'granted') {
      html = head('Notifications are on', false) + '<div class="nx-body">' +
        '<p>You’ll get one notification for each new post or video you picked below.</p>' + topicsHtml(st.topics) +
        '<div class="nx-actions"><button type="button" class="nx-btn nx-btn--ghost" data-nx-off>Turn off notifications</button></div>' +
        '<p class="nx-status" role="status"></p></div>' + footHtml();
    } else {
      html = head('New posts, straight to your screen', true) + '<div class="nx-body">' +
        '<p>A short notification when we publish a blog post or a YouTube video. No email needed, and you can switch it off in one tap.</p>' +
        topicsHtml('blog,youtube') +
        '<div class="nx-actions"><button type="button" class="nx-btn" data-nx-on data-nx-focus>Turn on notifications</button>' +
        '<button type="button" class="nx-link" data-nx-later>Not now</button></div>' +
        '<p class="nx-status" role="status"></p></div>' + footHtml();
    }
    panel.innerHTML = html;
    var status = $('.nx-status', panel);
    var on = $('[data-nx-on]', panel), off = $('[data-nx-off]', panel), later = $('[data-nx-later]', panel), inst = $('[data-nx-install]', panel);
    if (on) on.addEventListener('click', function () {
      var topics = pickedTopics();
      if (!topics) { status.textContent = 'Pick at least one: blog posts or YouTube videos.'; return; }
      on.disabled = true; status.textContent = 'Waiting for your browser…';
      var auto = panel.getAttribute('data-auto') === '1';
      logEvent('prompt_yes', auto ? 'auto' : 'bell');
      turnOn(topics).then(function () {
        logEvent('push_subscribe', topics); track('PushSubscribe', { topics: topics, page_path: path, prompt: auto ? 'auto' : 'bell' });
        panel.removeAttribute('data-auto'); renderAlerts();
        $('.nx-status', panel).textContent = 'Done. You’ll hear from us when something new goes live.';
      }).catch(function (err) {
        on.disabled = false;
        if (err && err.perm === 'denied') { logEvent('push_denied'); renderAlerts(); return; }
        if (err && err.perm === 'default') { status.textContent = 'No problem. Tap the button again whenever you’re ready.'; return; }
        status.textContent = 'That didn’t work in this browser. Try again, or get new posts by email instead.';
        console.warn('[NMX] Push subscribe failed:', err);
        logEvent('push_error', String(err && err.message || err).slice(0, 120));
      });
    });
    if (off) off.addEventListener('click', function () {
      off.disabled = true; status.textContent = 'Turning off…';
      turnOff().then(function () { logEvent('push_unsubscribe'); track('PushUnsubscribe', { page_path: path }); renderAlerts(); $('.nx-status', panel).textContent = 'Notifications are off. Turn them back on any time from the bell.'; })
        .catch(function () { off.disabled = false; status.textContent = 'That didn’t work. Reload the page and try again.'; });
    });
    if (later) later.addEventListener('click', function () { snooze(7); logEvent('prompt_later'); closePanel(true); bellBtn.focus(); });
    if (st && perm === 'granted') $$('.nx-topics input', panel).forEach(function (box) {
      box.addEventListener('change', function () {
        var t = pickedTopics();
        if (!t) { box.checked = true; status.textContent = 'Keep at least one, or turn notifications off.'; return; }
        status.textContent = 'Saving…';
        post({ action: 'push_update', id: st.id, endpoint: st.endpoint, topics: t })
          .then(function () { st.topics = t; setPushState(st); status.textContent = 'Saved.'; })
          .catch(function () { status.textContent = 'Couldn’t save that. Try again in a minute.'; });
      });
    });
    if (inst) inst.addEventListener('click', install);
  }

  // The soft prompt: the bell opens by itself once a reader has shown interest, never on arrival.
  var promptedThisPage = false;
  function canAutoPrompt() {
    return PUSH_ON && PUSH_API && !IOS_NEEDS_INSTALL && permission() === 'default' && !pushState() && !snoozed() && !promptedThisPage &&
      !openKind && !ssGet('nmx-prompted') && !(doc.activeElement && /INPUT|TEXTAREA|SELECT/.test(doc.activeElement.tagName)) &&
      !$('.player:not([hidden])');
  }
  function autoPrompt(reason) {
    if (!canAutoPrompt()) return;
    promptedThisPage = true; ssSet('nmx-prompted', '1');
    openPanel('alerts', true); logEvent('prompt_shown', reason); track('PushPromptShown', { reason: reason, page_path: path });
  }
  if (PUSH_ON && PUSH_API) {
    var prose = $('#article .prose');
    if (prose) {
      var onScroll = function () {
        var r = prose.getBoundingClientRect();
        if (-r.top > prose.offsetHeight * 0.45) { removeEventListener('scroll', onScroll); autoPrompt('read_45'); }
      };
      addEventListener('scroll', onScroll, { passive: true });
      setTimeout(function () { autoPrompt('time_40s'); }, 40000);
    } else if (views >= 2) setTimeout(function () { autoPrompt('second_page'); }, 20000);
  }
  if (bellBtn && !pushState() && views <= 3 && !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) {
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
    alerts: function () { return 'Two free ways to hear about new posts: browser notifications (tap the bell next to this chat) or email (the subscribe box on the blog: https://labsnmx.com/blog/). Both are one tap to switch off.'; },
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
    var slug = path.replace(/^\/blog\/|\/(amp\/)?(index\.html)?$/g, '');
    var hero = $('.post-hero img', article), crumbs = $$('.article-head .crumbs a', article);
    var me = { slug: slug, url: '/blog/' + slug + '/', title: ($('.article-head h1', article) || {}).textContent || doc.title,
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
      var s = b.getAttribute('data-slug'), list = savedList().filter(function (x) { return x.slug !== s; });
      setSaved(list); swCache('uncache', ['/blog/' + s + '/']); drawSaved(); logEvent('unsave', s);
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

  window.NMX_ENGAGE = { open: openPanel, close: closePanel, pushState: pushState, ready: READY, pushOn: PUSH_ON };
})();
