/* NMX Labs: analytics events, light/dark theme, blog subscribe, in-page Google AI summary, blog filters.
   Loaded with `defer` on every page. Events go to the Meta Pixel (both pixel IDs on the page) and to GA4. */
(function () {
  'use strict';

  /* ===== config ===== */
  var CFG = {
    // Apps Script web-app URL (ends in /exec) from Code-Blog.gs. Powers Subscribe + Google AI summary.
    BACKEND_URL: 'PASTE_YOUR_APPS_SCRIPT_EXEC_URL_HERE',
    BACKEND_VERSION: 'v1'
  };
  // Checks the URL's shape, not a placeholder string, so a find-and-replace can't break it.
  function backendReady() { return /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(String(CFG.BACKEND_URL).trim()); }

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
    var zoneEl = el.closest('nav,header,footer,aside,.rail,.cats,.filters,.subscribe,.tools,.prose,.post-list,.feature,.author-box,.ai-dialog');
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
  function markSubscribed(already) {
    $$('.subscribe').forEach(function (b) {
      b.classList.add('done');
      var n = $('.sub-note', b);
      if (n) n.textContent = already ? 'You’re already subscribed. The Thursday post will keep landing in your inbox.' : 'You’re subscribed. Check your inbox for a welcome email.';
    });
  }
  if (read('nmx-subscribed') === '1') markSubscribed(true);
  $$('form.sub-form').forEach(function (f) {
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var note = $('.sub-note', f.parentNode), btn = $('button', f), email = (f.email.value || '').trim();
      if (f.website && f.website.value) return; // bot trap
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { note.textContent = 'Enter a valid email address, like name@example.com.'; f.email.focus(); return; }
      if (!backendReady()) { note.textContent = 'Subscriptions open soon. Meanwhile, follow the RSS feed.'; console.warn('[NMX] Set BACKEND_URL in /assets/nmx.js'); return; }
      btn.disabled = true; note.textContent = 'Subscribing…';
      fetch(CFG.BACKEND_URL, { method: 'POST', body: new URLSearchParams({ action: 'subscribe', email: email, source: path, v: CFG.BACKEND_VERSION }) })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (!d || !d.ok) throw new Error((d && d.error) || 'Subscription failed');
          store('nmx-subscribed', '1'); markSubscribed(d.already);
          track('Lead', { content_name: 'Blog newsletter', content_category: 'subscribe' }, true);
          track('BlogSubscribe', { source: path, page_type: page.type, returning: !!d.already });
        })
        .catch(function (err) { note.textContent = 'That didn’t go through (' + err.message + '). Try again in a minute.'; })
        .then(function () { btn.disabled = false; });
    });
  });

  /* ===== Google AI summary, shown on the page ===== */
  var aiBtns = $$('[data-ai-summary]');
  if (page.type === 'post' && aiBtns.length) {
    var dlg = doc.createElement('dialog');
    dlg.className = 'ai-dialog';
    dlg.setAttribute('aria-labelledby', 'aiTitle');
    dlg.innerHTML =
      '<div class="ai-in">' +
        '<div class="ai-top"><svg viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="aiG" x1="0" x2="1"><stop offset="0" stop-color="#4285F4"/><stop offset=".55" stop-color="#9B72CB"/><stop offset="1" stop-color="#D96570"/></linearGradient></defs><path fill="url(#aiG)" d="M12 2c.4 4.6 2.9 7.3 8 8-5.1.7-7.6 3.4-8 8-.4-4.6-2.9-7.3-8-8 5.1-.7 7.6-3.4 8-8z"/></svg>' +
        '<h2 id="aiTitle">AI summary</h2><button type="button" class="ai-close" aria-label="Close summary" data-track="AISummaryClose">✕</button></div>' +
        '<p class="ai-src"></p><div class="ai-body" aria-live="polite"></div>' +
        '<div class="ai-ask" hidden><form><label class="sr-only" for="aiQ">Ask a question about this article</label>' +
        '<input id="aiQ" maxlength="300" autocomplete="off" placeholder="Ask about this article"><button type="submit" class="btn" data-track="AIAsk">Ask</button></form>' +
        '<div class="ai-answer" aria-live="polite"></div></div>' +
      '</div>';
    doc.body.appendChild(dlg);
    var src = $('.ai-src', dlg), body = $('.ai-body', dlg), askBox = $('.ai-ask', dlg);
    var cacheKey = 'nmx-ai-' + page.slug;

    function articleText() {
      var c = $('.prose', article).cloneNode(true);
      $$('.video,.source-quote footer', c).forEach(function (n) { n.remove(); });
      return (page.title + '\n\n' + c.textContent).replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, 15000);
    }
    function showEditor(note) {
      src.textContent = note || 'Editor’s summary';
      var ul = $('#quickSummary ul');
      body.innerHTML = ul ? '<ul>' + ul.innerHTML + '</ul>' : '<p>Summary unavailable.</p>';
    }
    function showAI(d) {
      src.textContent = 'Generated by Google Gemini from this article. AI can make mistakes; the article is the source of truth.';
      body.innerHTML = (d.tldr ? '<p class="ai-tldr">' + esc(d.tldr) + '</p>' : '') +
        '<ul>' + (d.bullets || []).map(function (b) { return '<li>' + esc(b) + '</li>'; }).join('') + '</ul>';
      askBox.hidden = false;
    }
    function openSummary() {
      if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
      track('AISummaryOpen', { slug: page.slug });
      var cached = null; try { cached = JSON.parse(sessionStorage.getItem(cacheKey)); } catch (e) {}
      if (cached) { showAI(cached); return; }
      if (!backendReady()) { showEditor(); return; }
      src.textContent = 'Asking Google Gemini…';
      body.innerHTML = '<div class="skel"></div><div class="skel" style="width:84%"></div><div class="skel" style="width:90%"></div><div class="skel" style="width:62%"></div>';
      fetch(CFG.BACKEND_URL, { method: 'POST', body: new URLSearchParams({ action: 'summary', slug: page.slug, title: page.title, text: articleText(), v: CFG.BACKEND_VERSION }) })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (!d || !d.ok || !(d.bullets && d.bullets.length)) throw new Error(d && d.error);
          try { sessionStorage.setItem(cacheKey, JSON.stringify(d)); } catch (e) {}
          showAI(d); track('AISummaryShown', { slug: page.slug, source: d.cached ? 'cache' : 'gemini' });
        })
        .catch(function () { showEditor('Editor’s summary (Google AI is busy right now)'); });
    }
    aiBtns.forEach(function (b) { b.addEventListener('click', function (e) { e.preventDefault(); openSummary(); }); });
    $('.ai-close', dlg).addEventListener('click', function () { dlg.close(); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
    $('form', askBox).addEventListener('submit', function (e) {
      e.preventDefault();
      var q = $('#aiQ').value.trim(), out = $('.ai-answer', askBox);
      if (q.length < 3) return;
      out.textContent = 'Thinking…';
      track('AIQuestion', { slug: page.slug });
      fetch(CFG.BACKEND_URL, { method: 'POST', body: new URLSearchParams({ action: 'ask', slug: page.slug, question: q, text: articleText(), v: CFG.BACKEND_VERSION }) })
        .then(function (r) { return r.json(); })
        .then(function (d) { if (!d || !d.ok) throw new Error(); out.textContent = d.answer; })
        .catch(function () { out.textContent = 'Google AI couldn’t answer right now. Try again in a minute.'; });
    });
    // AMP pages link here with #ai-summary so readers stay on the site.
    if (location.hash === '#ai-summary') setTimeout(openSummary, 300);
  }

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
