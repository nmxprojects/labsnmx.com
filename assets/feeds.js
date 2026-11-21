/* NMX Labs: news wire + Instagram + X feeds.
   Paste the same Apps Script /exec URL you put in /assets/nmx.js into BACKEND_URL.
   X_HANDLE: your X username without @ (leave empty to hide the X panel). */
(function () {
  'use strict';
  var CFG = {
    BACKEND_URL: 'PASTE_YOUR_APPS_SCRIPT_EXEC_URL_HERE',
    INSTAGRAM_HANDLE: '_nmxlabs',
    X_HANDLE: ''
  };
  var ready = /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(String(CFG.BACKEND_URL).trim());
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

  /* ---- live news wire ---- */
  Array.prototype.forEach.call(document.querySelectorAll('[data-news-wire]'), function (box) {
    var sec = box.closest('section');
    if (!ready) { if (sec) sec.hidden = true; return; }
    get('news').then(function (d) {
      box.innerHTML = '';
      if (!d.ok || !d.items || !d.items.length) { if (sec) sec.hidden = true; return; }
      d.items.slice(0, 20).forEach(function (it) {
        var li = el('li', 'wire-item');
        var a = link(it.link, it.title, 'wire-title'); a.addEventListener('click', function () { track('NewsWireClick', { source: it.source }); });
        li.appendChild(a);
        li.appendChild(el('span', 'wire-meta', [it.source, ago(it.date), it.topic].filter(Boolean).join(' · ')));
        box.appendChild(li);
      });
    }).catch(function () { if (sec) sec.hidden = true; });
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
