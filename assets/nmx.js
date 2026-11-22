/* NMX Labs: analytics events, light/dark theme, blog subscribe, in-page Google AI summary, blog filters.
   Loaded with `defer` on every page. Events go to the Meta Pixel (both pixel IDs on the page) and to GA4. */
(function () {
  'use strict';

  /* ===== config ===== */
  var CFG = {
    // OPTIONAL. Apps Script web-app URL (ends in /exec) from Code-Blog.gs. When set, subscribers go to your
    // Google Sheet and get a welcome email. When empty or unreachable, the form falls back to FALLBACK_INBOX.
    BACKEND_URL: 'PASTE_YOUR_APPS_SCRIPT_EXEC_URL_HERE',
    BACKEND_VERSION: 'v2',
    // Works with no setup beyond one activation click: FormSubmit emails each sign-up to this inbox.
    // After activation, FormSubmit gives you a random alias; you can paste it here instead of the address.
    FALLBACK_INBOX: 'nmxprojects@gmail.com'
  };
  window.NMX_CFG = CFG;
  // Checks the URL's shape (personal or Workspace Apps Script URLs), not a placeholder string.
  function backendReady() { return /^https:\/\/script\.google\.com\/(a\/macros\/[^\/]+|macros)\/s\/[A-Za-z0-9_-]+\/exec$/.test(String(CFG.BACKEND_URL).trim()); }
  window.NMX_backendReady = backendReady;

  var doc = document, root = doc.documentElement, path = location.pathname;
  function $(s, c) { return (c || doc).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); }
  function store(k, v) { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} }
  function read(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function slugify(s) { return String(s).toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

  /* ===== analytics ===== */
  function snake(s) { return String(s).replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase(); }
  function track(name, params, standard) {
    params = params || {};
    try { if (typeof fbq === 'function') { standard ? fbq('track', name, params) : fbq('trackCustom', name, params); } } catch (e) {}
    try { if (typeof gtag === 'function') gtag('event', snake(name), params); } catch (e) {}
  }
  window.nmxTrack = track;

  // What kind of page is this?
  var article = $('#article');
  var page = { type: 'page', path: path };
  if (article && $('.article-head h1', article)) {
    var crumbs = $$('.article-head .crumbs a', article);
    var by = $('.byline [data-author]', article) || $('.byline span', article);
    page = {
      type: 'post',
      path: path,
      slug: path.replace(/^\/blog\/|\/(amp\/)?$/g, ''),
      title: $('.article-head h1', article).textContent.trim(),
      category: crumbs.length > 1 ? crumbs[crumbs.length - 1].textContent.trim() : 'Blog',
      author: by ? (by.getAttribute('data-author') || by.textContent.replace(/^By\s+/, '').replace(/,.*$/, '').trim()) : ''
    };
  } else if (path === '/blog/' || path === '/blog/index.html') page.type = 'blog_index';
  else if (/^\/blog\/category\//.test(path)) page.type = 'blog_category';
  else if (/^\/blog\/author\//.test(path)) page.type = 'blog_author';
  else if (path === '/' || path === '/index.html') page.type = 'home';

  if (page.type === 'post') {
    // Individual blog post view: Meta standard ViewContent (content_ids = slug) + a custom event with the details.
    track('ViewContent', { content_ids: [page.slug], content_name: page.title, content_category: page.category, content_type: 'blog_post' }, true);
    track('BlogPostView', { slug: page.slug, category: page.category, author: page.author, referrer: doc.referrer ? (function () { try { return new URL(doc.referrer).hostname; } catch (e) { return 'unknown'; } })() : 'direct' });
  } else if (/^blog_/.test(page.type)) {
    track('BlogListView', { list: page.type, page_path: path });
  }

  // Click tracking: every link and button, classified as internal / outbound / anchor / contact.
  doc.addEventListener('click', function (e) {
    var el = e.target.closest && e.target.closest('a,button');
    if (!el || el.hasAttribute('data-no-track')) return;
    var zoneEl = el.closest('nav,header,footer,aside,.rail,.cats,.filters,.subscribe,.tools,.prose,.post-list,.feature,.author-box');
    var p = {
      page_path: path,
      page_type: page.type,
      zone: zoneEl ? (zoneEl.className && typeof zoneEl.className === 'string' ? zoneEl.className.split(' ')[0] : zoneEl.tagName.toLowerCase()) : 'body',
      link_text: (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 90)
    };
    if (page.slug) p.slug = page.slug;
    if (el.tagName === 'A') {
      var u; try { u = new URL(el.href, location.href); } catch (_) { return; }
      p.link_url = u.href;
      var host = u.hostname.replace(/^www\./, ''), here = location.hostname.replace(/^www\./, '');
      if (u.protocol === 'mailto:' || u.protocol === 'tel:' || host === 'wa.me') p.link_type = 'contact';
      else if (host === here || host === 'labsnmx.com') p.link_type = (u.pathname === path && u.hash) ? 'anchor' : 'internal';
      else p.link_type = 'outbound';
      track(p.link_type === 'outbound' ? 'OutboundClick' : (p.link_type === 'contact' ? 'ContactClick' : 'LinkClick'), p);
    } else {
      p.button = el.getAttribute('data-track') || el.id || 'button';
      track('ButtonClick', p);
    }
  }, true);

  // Scroll depth (every page) and read-complete (posts).
  var marks = {}, t0 = Date.now(), readDone = false, ticking = false;
  function onScroll() {
    ticking = false;
    var target = page.type === 'post' ? ($('.prose', article) || article) : doc.body;
    var r = target.getBoundingClientRect();
    var total = target.offsetHeight - innerHeight * 0.6;
    var pct = Math.max(0, Math.min(1, -r.top / (total > 0 ? total : 1)));
    if (page.type !== 'post') {
      var h = doc.documentElement.scrollHeight - innerHeight;
      pct = h > 0 ? Math.min(1, scrollY / h) : 1;
    }
    [25, 50, 75, 100].forEach(function (m) {
      if (!marks[m] && pct * 100 >= m - 0.5) { marks[m] = 1; track('ScrollDepth', { page_path: path, page_type: page.type, percent: m, slug: page.slug || '' }); }
    });
    var secs = Math.round((Date.now() - t0) / 1000);
    if (page.type === 'post' && !readDone && pct > 0.9 && secs >= 30) {
      readDone = true;
      track('ReadComplete', { slug: page.slug, content_name: page.title, content_category: page.category, seconds: secs });
    }
  }
  addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });

  // Time on page, sent once when the tab is hidden or closed.
  var timeSent = false;
  function sendTime() {
    if (timeSent) return; timeSent = true;
    track('TimeOnPage', { page_path: path, page_type: page.type, seconds: Math.round((Date.now() - t0) / 1000), slug: page.slug || '' });
  }
  doc.addEventListener('visibilitychange', function () { if (doc.visibilityState === 'hidden') sendTime(); });
  addEventListener('pagehide', sendTime);

  // Article tools
  var lb = $('#listenBtn'); if (lb) lb.addEventListener('click', function () { if (lb.getAttribute('aria-pressed') !== 'true') track('ListenStart', { slug: page.slug }); });
  var sb = $('#summaryBtn'); if (sb) sb.addEventListener('click', function () { if (sb.getAttribute('aria-expanded') !== 'true') track('QuickSummaryOpen', { slug: page.slug }); });

  /* ===== light / dark theme ===== */
  var mq = matchMedia('(prefers-color-scheme: dark)');
  function effective() { return root.getAttribute('data-theme') || (mq.matches ? 'dark' : 'light'); }
  function syncTheme() {
    var t = effective(), btn = $('#themeToggle');
    if (btn) { btn.setAttribute('aria-label', t === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'); btn.setAttribute('aria-pressed', t === 'dark'); }
    $$('meta[name="theme-color"]').forEach(function (m) { m.setAttribute('content', t === 'dark' ? '#121211' : '#faf9f6'); });
  }
  $$('#themeToggle').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var next = effective() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next); store('nmx-theme', next); syncTheme();
      track('ThemeChange', { theme: next, page_path: path });
    });
  });
  if (mq.addEventListener) mq.addEventListener('change', syncTheme);
  syncTheme();

  /* ===== subscribe ===== */
  // Two routes: (1) your Apps Script backend (Sheet + welcome email), (2) FormSubmit to your inbox.
  // Route 2 needs one activation click the first time: FormSubmit emails FALLBACK_INBOX an "Activate Form" link.
  function markSubscribed(already) {
    $$('.subscribe').forEach(function (b) {
      b.classList.add('done');
      var n = $('.sub-note', b);
      if (n) n.textContent = already ? 'You’re already on the list. New posts will keep landing in your inbox.' : 'You’re subscribed. Thanks for reading.';
    });
  }
  if (read('nmx-subscribed') === '1') markSubscribed(true);
  if (/[?&]subscribed=1/.test(location.search)) { store('nmx-subscribed', '1'); markSubscribed(false); }
  function viaBackend(email) {
    return fetch(CFG.BACKEND_URL, { method: 'POST', body: new URLSearchParams({ action: 'subscribe', email: email, source: path, v: CFG.BACKEND_VERSION }) })
      .then(function (r) { return r.json(); })
      .then(function (d) { if (!d || !d.ok) throw new Error((d && d.error) || 'backend'); return d; });
  }
  function viaInbox(email) {
    return fetch('https://formsubmit.co/ajax/' + encodeURIComponent(CFG.FALLBACK_INBOX), {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ email: email, page: location.href, _subject: 'New NMX Labs blog subscriber', _template: 'table' })
    }).then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d || String(d.success) !== 'true') {
          if (d && /activat/i.test(d.message || '')) console.warn('[NMX] FormSubmit needs a one-time activation: check ' + CFG.FALLBACK_INBOX + ' for the "Activate Form" email.');
          throw new Error('inbox');
        }
        return { ok: true, already: false };
      });
  }
  $$('form.sub-form').forEach(function (f) {
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var note = $('.sub-note', f.parentNode), btn = $('button', f), email = (f.email.value || '').trim();
      if (f._honey && f._honey.value) return; // bot trap
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { note.textContent = 'Enter a valid email address, like name@example.com.'; f.email.focus(); return; }
      btn.disabled = true; note.textContent = 'Subscribing…';
      var run = backendReady() ? viaBackend(email).catch(function () { return viaInbox(email); }) : viaInbox(email);
      run.then(function (d) {
          store('nmx-subscribed', '1'); markSubscribed(d.already);
          track('Lead', { content_name: 'Blog newsletter', content_category: 'subscribe' }, true);
          track('BlogSubscribe', { source: path, page_type: page.type, returning: !!d.already, route: backendReady() ? 'sheet' : 'inbox' });
        })
        .catch(function () { note.textContent = 'That didn’t go through. Try again in a minute, or follow the RSS feed meanwhile.'; track('SubscribeError', { source: path }); })
        .then(function () { btn.disabled = false; });
    });
  });

  /* ===== Google AI summary: opens Google AI Mode in a new tab ===== */
  // The links are plain <a target="_blank"> built into each page (works without JS and on AMP).
  // The prompt only asks Google to summarise the article; it never asks Google to "remember" or rank this site.
  $$('[data-ai-summary]').forEach(function (a) {
    a.addEventListener('click', function () { track('AISummaryOpen', { slug: page.slug || '', destination: 'google_ai_mode' }); });
  });

  /* ===== reading aids on posts: progress bar, table of contents ===== */
  if (page.type === 'post') {
    var prose = $('.prose', article);
    var bar = doc.createElement('div'); bar.className = 'read-progress'; bar.setAttribute('aria-hidden', 'true'); bar.innerHTML = '<span></span>';
    doc.body.appendChild(bar);
    var fill = bar.firstChild, pt = false;
    function prog() {
      pt = false; if (!prose) return;
      var r = prose.getBoundingClientRect(), total = prose.offsetHeight - innerHeight * 0.5;
      fill.style.transform = 'scaleX(' + Math.max(0, Math.min(1, -r.top / (total > 0 ? total : 1))) + ')';
    }
    addEventListener('scroll', function () { if (!pt) { pt = true; requestAnimationFrame(prog); } }, { passive: true });
    prog();
    // Older posts get a table of contents built from their headings; new posts ship one in the HTML.
    if (prose && !$('.toc', article)) {
      var hs = $$('h2', prose).filter(function (h) { return !/^(sources|notes)/.test(h.id || ''); });
      if (hs.length >= 3) {
        var items = hs.map(function (h) { if (!h.id) h.id = slugify(h.textContent).slice(0, 60); return '<li><a href="#' + h.id + '">' + esc(h.textContent) + '</a></li>'; }).join('');
        var nav = doc.createElement('nav'); nav.className = 'toc'; nav.setAttribute('aria-label', 'In this article');
        nav.innerHTML = '<details open><summary>In this article</summary><ol>' + items + '</ol></details>';
        prose.parentNode.insertBefore(nav, prose);
      }
    }
    $$('.toc a').forEach(function (a) { a.addEventListener('click', function () { track('TocClick', { slug: page.slug, target: a.getAttribute('href') }); }); });
  }

  /* ===== web images with a local fallback (brand logos) =====
     Each <img data-fallback> loads from its web source first. If it errors (handled inline) or hasn't
     loaded after 5 seconds, the local copy is used and its credit line in "Image credits" is updated. */
  $$('img[data-fallback]').forEach(function (img) {
    setTimeout(function () { if ((!img.complete || !img.naturalWidth) && typeof img.onerror === 'function') img.onerror(); }, 5000);
  });

  /* ===== blog filters: month, category, author, search ===== */
  var list = $('#postList');
  if (list) {
    var items = $$('[data-post]');
    var fMonth = $('#fMonth'), fAuthor = $('#fAuthor'), fQ = $('#fQ'), count = $('#fCount'), empty = $('#fEmpty'), clearBtn = $('#fClear');
    var cats = $$('.cats a[data-cat]');
    var state = { month: '', category: '', author: '', q: '' };
    var months = {};
    items.forEach(function (it) { var m = it.getAttribute('data-month'); months[m] = (months[m] || 0) + 1; });
    Object.keys(months).sort().reverse().forEach(function (m) {
      var p = m.split('-'), label = new Date(+p[0], +p[1] - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      fMonth.insertAdjacentHTML('beforeend', '<option value="' + m + '">' + label + ' (' + months[m] + ')</option>');
    });
    var qs = new URLSearchParams(location.search);
    Object.keys(state).forEach(function (k) { if (qs.get(k)) state[k] = qs.get(k); });

    function apply(source) {
      fMonth.value = state.month; fAuthor.value = state.author; fQ.value = state.q;
      cats.forEach(function (a) { a.setAttribute('aria-current', a.getAttribute('data-cat') === state.category ? 'page' : 'false'); });
      var words = state.q.toLowerCase().split(/\s+/).filter(Boolean), shown = 0;
      items.forEach(function (it) {
        var ok = (!state.month || it.getAttribute('data-month') === state.month) &&
                 (!state.category || it.getAttribute('data-cat') === state.category) &&
                 (!state.author || it.getAttribute('data-author') === state.author) &&
                 words.every(function (w) { return it.textContent.toLowerCase().indexOf(w) > -1; });
        it.hidden = !ok; if (ok) shown++;
      });
      var active = !!(state.month || state.category || state.author || state.q);
      clearBtn.hidden = !active; empty.hidden = shown > 0;
      count.textContent = shown + (shown === 1 ? ' post' : ' posts') + (active ? ' match' : '');
      var u = new URLSearchParams();
      Object.keys(state).forEach(function (k) { if (state[k]) u.set(k, state[k]); });
      history.replaceState(null, '', location.pathname + (u.toString() ? '?' + u : ''));
      if (source) {
        clearTimeout(apply.t);
        apply.t = setTimeout(function () {
          track('BlogFilter', { changed: source, month: state.month || 'all', category: state.category || 'all', author: state.author || 'all', results: shown });
          if (source === 'search' && state.q.length > 2) track('Search', { search_string: state.q, content_category: 'blog' }, true);
        }, 700);
      }
    }
    fMonth.addEventListener('change', function () { state.month = fMonth.value; apply('month'); });
    fAuthor.addEventListener('change', function () { state.author = fAuthor.value; apply('author'); });
    fQ.addEventListener('input', function () { state.q = fQ.value.trim(); apply('search'); });
    cats.forEach(function (a) {
      a.addEventListener('click', function (e) { e.preventDefault(); state.category = a.getAttribute('data-cat'); apply('category'); });
    });
    function clearAll() { state = { month: '', category: '', author: '', q: '' }; apply('clear'); fQ.focus(); }
    clearBtn.addEventListener('click', clearAll);
    $('#fEmptyClear').addEventListener('click', clearAll);
    apply();
  }
})();
