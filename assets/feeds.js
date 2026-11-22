/* NMX Labs: news wire + Instagram + X feeds.
   Optional: paste the same Apps Script /exec URL you put in /assets/nmx.js into BACKEND_URL.
   Without it, the news wire still works through the browser fallback below.
   X_HANDLE: your X username without @ (leave empty to hide the X panel). */
(function () {
  'use strict';
  var CFG = {
    BACKEND_URL: 'PASTE_YOUR_APPS_SCRIPT_EXEC_URL_HERE',
    INSTAGRAM_HANDLE: '_nmxlabs',
    X_HANDLE: ''
  };
  var ready = /^https:\/\/script\.google\.com\/(a\/macros\/[^\/]+|macros)\/s\/[A-Za-z0-9_-]+\/exec$/.test(String(CFG.BACKEND_URL).trim());
  function get(action) {
    return fetch(CFG.BACKEND_URL + '?action=' + action).then(function (r) { return r.json(); });
  }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function link(href, text, cls) { var a = el('a', cls, text); a.href = href; a.target = '_blank'; a.rel = 'noopener'; return a; }
  function ago(iso) {
    var t = new Date(iso).getTime(); if (!t) return '';
    var m = Math.round((Date.now() - t) / 60000);
    if (m < 60) return m + ' min ago'; if (m < 1440) return Math.round(m / 60) + ' h ago';
    return new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }
  function track(name, data) { try { if (window.fbq) fbq('trackCustom', name, data || {}); if (window.gtag) gtag('event', name, data || {}); } catch (e) {} }

  /* ---- live news wire ----
     Route 1: your Apps Script backend (?action=news), cached on Google's side for 30 minutes.
     Route 2 (no setup): Google News RSS searches + publisher feeds, converted to JSON by rss2json.com
     and cached in the visitor's browser for 30 minutes. Every headline links to the original story and
     names its publisher; the page's "Sources and credits" notes explain where headlines come from. */
  var TOPICS = [
    ['Brands', 'India brand campaign OR rebrand'],
    ['Advertising', 'India ad campaign agency'],
    ['Quick commerce', 'Blinkit OR Zepto OR Instamart OR "Flipkart Minutes"'],
    ['AI design', 'Adobe Firefly OR Canva AI OR Figma AI'],
    ['Meta ads', 'Meta ads India advertisers'],
    ['D2C', 'D2C brand India launch'],
    ['Platforms', 'YouTube OR Instagram creators policy update']
  ];
  var EXTRA_FEEDS = [
    // [topic label, RSS URL, publisher name]. Add or remove freely; feeds that fail are skipped.
    ['Advertising', 'https://brandequity.economictimes.indiatimes.com/rss/topstories', 'ET BrandEquity']
  ];
  function gnews(q) { return 'https://news.google.com/rss/search?q=' + encodeURIComponent(q + ' when:7d') + '&hl=en-IN&gl=IN&ceid=IN:en'; }
  function viaRss2Json(url) { return fetch('https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(url)).then(function (r) { return r.json(); }); }
  function clientWire() {
    var KEY = 'nmx-wire-v2', hit = null;
    try { hit = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
    if (hit && Date.now() - hit.t < 30 * 60 * 1000 && hit.d && hit.d.items && hit.d.items.length) return Promise.resolve(hit.d);
    var jobs = TOPICS.map(function (t) { return { topic: t[0], url: gnews(t[1]), via: 'Google News' }; })
      .concat(EXTRA_FEEDS.map(function (f) { return { topic: f[0], url: f[1], via: f[2], publisher: f[2] }; }));
    return Promise.all(jobs.map(function (j) {
      return viaRss2Json(j.url).then(function (d) {
        if (!d || d.status !== 'ok') return [];
        return (d.items || []).slice(0, 8).map(function (it) {
          var title = String(it.title || ''), src = j.publisher || '';
          if (!src) { var k = title.lastIndexOf(' - '); if (k > 20) { src = title.slice(k + 3); title = title.slice(0, k); } }
          var iso = ''; try { iso = it.pubDate ? new Date(String(it.pubDate).replace(' ', 'T') + 'Z').toISOString() : ''; } catch (e) {}
          return { title: title, link: it.link, source: src || 'Unknown publisher', date: iso, topic: j.topic, via: j.via };
        });
      }).catch(function () { return []; });
    })).then(function (lists) {
      var seen = {}, items = [];
      lists.forEach(function (l) { l.forEach(function (it) { var key = it.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 80); if (it.title && !seen[key]) { seen[key] = 1; items.push(it); } }); });
      items.sort(function (a, b) { return b.date < a.date ? -1 : 1; });
      var d = { ok: items.length > 0, updated: new Date().toISOString(), items: items.slice(0, 30), route: 'client' };
      try { if (d.ok) localStorage.setItem(KEY, JSON.stringify({ t: Date.now(), d: d })); } catch (e) {}
      return d;
    });
  }
  Array.prototype.forEach.call(document.querySelectorAll('[data-news-wire]'), function (box) {
    var stamp = document.querySelector('[data-wire-updated]');
    var load = ready ? get('news').then(function (d) { return d && d.ok && d.items && d.items.length ? d : clientWire(); }).catch(clientWire) : clientWire();
    load.then(function (d) {
      box.innerHTML = '';
      if (!d.ok || !d.items || !d.items.length) { box.appendChild(el('li', 'wire-empty', 'Headlines couldn’t load right now. The curated stories above are updated by the studio every week.')); return; }
      d.items.slice(0, 24).forEach(function (it) {
        var li = el('li', 'wire-item');
        var a = link(it.link, it.title, 'wire-title'); a.rel = 'noopener nofollow';
        a.addEventListener('click', function () { track('NewsWireClick', { source: it.source, topic: it.topic }); });
        li.appendChild(a);
        var meta = el('span', 'wire-meta'), g = (it.via === 'Google News' || !it.via);
        meta.appendChild(document.createTextNode([it.source, ago(it.date), it.topic].filter(Boolean).join(' · ') + ' '));
        var mark = el('a', 'wire-mark', g ? '*' : '†');
        mark.href = g ? '#credit-wire' : '#credit-feeds';
        mark.setAttribute('aria-label', 'How this headline is sourced');
        meta.appendChild(mark);
        li.appendChild(meta);
        box.appendChild(li);
      });
      if (stamp) stamp.textContent = 'Updated ' + new Date(d.updated || Date.now()).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) + '.';
    }).catch(function () { box.innerHTML = ''; box.appendChild(el('li', 'wire-empty', 'Headlines couldn’t load right now.')); });
  });

  /* ---- Instagram ---- */
  Array.prototype.forEach.call(document.querySelectorAll('[data-instagram]'), function (card) {
    var grid = card.querySelector('[data-ig-grid]');
    function fallback() { grid.innerHTML = ''; grid.appendChild(el('p', 'social-note', 'See our latest work, reels and behind-the-scenes on Instagram.')); }
    if (!ready) return fallback();
    get('instagram').then(function (d) {
      if (!d.ok || !d.items || !d.items.length) return fallback();
      grid.innerHTML = '';
      d.items.slice(0, 6).forEach(function (p, i) {
        var a = link(p.permalink, null, 'ig-item' + (i === 0 ? ' ig-item--latest' : ''));
        var img = el('img'); img.src = p.image; img.alt = (p.caption || 'Instagram post by NMX Labs').slice(0, 120); img.loading = 'lazy'; img.width = 320; img.height = 320;
        a.appendChild(img);
        if (i === 0) a.appendChild(el('span', 'ig-badge', 'Latest'));
        if (p.type === 'VIDEO') a.appendChild(el('span', 'ig-play', '▶'));
        a.addEventListener('click', function () { track('InstagramPostClick', { position: i + 1 }); });
        grid.appendChild(a);
      });
      if (d.items[0].caption) grid.appendChild(el('p', 'ig-caption', d.items[0].caption.slice(0, 160) + (d.items[0].caption.length > 160 ? '…' : '')));
    }).catch(fallback);
  });

  /* ---- X ---- */
  if (CFG.X_HANDLE) Array.prototype.forEach.call(document.querySelectorAll('[data-x]'), function (card) {
    var h = CFG.X_HANDLE.replace(/^@/, ''), url = 'https://x.com/' + h, list = card.querySelector('[data-x-list]');
    card.hidden = false;
    card.querySelector('[data-x-link]').href = url; card.querySelector('[data-x-link]').textContent = '@' + h;
    card.querySelector('[data-x-follow]').href = url;
    function embed() {
      list.innerHTML = '';
      var a = el('a', 'twitter-timeline', 'Posts by @' + h);
      a.href = 'https://twitter.com/' + h; a.setAttribute('data-tweet-limit', '3'); a.setAttribute('data-dnt', 'true'); a.setAttribute('data-chrome', 'noheader nofooter noborders transparent');
      list.appendChild(a);
      var s = document.createElement('script'); s.async = true; s.src = 'https://platform.twitter.com/widgets.js'; document.body.appendChild(s);
      setTimeout(function () { if (!list.querySelector('iframe')) { list.innerHTML = ''; list.appendChild(el('p', 'social-note', 'Read our latest posts on X.')); } }, 8000);
    }
    if (!ready) return embed();
    get('x').then(function (d) {
      if (!d.ok || !d.items || !d.items.length) return embed();
      list.innerHTML = '';
      d.items.slice(0, 3).forEach(function (p, i) {
        var a = link(p.url, null, 'x-item');
        if (i === 0) a.appendChild(el('span', 'ig-badge', 'Latest'));
        a.appendChild(el('p', null, p.text));
        a.appendChild(el('span', 'wire-meta', ago(p.created_at)));
        list.appendChild(a);
      });
    }).catch(embed);
  });
})();
