/* NMX Labs dashboard (v6: lives at /dashboard/; sends newsletters, offers and updates by email and/or notification). Was v5: Signs in with ADMIN_KEY, loads row-level data from Code-Blog.gs v5 (admin op "raw") and
   counts everything in the browser, so filters and period changes are instant. With a v4 backend it falls back to the
   30-day summary (no filters). Holds no keys: BACKEND_URL and VAPID_PUBLIC_KEY come from /assets/nmx.js. */
(function () {
  'use strict';
  var CFG, KEY = '', RAW = null, STATS = null, MODEL = null, liveTimer = null;
  var F = { period: '30', dev: '', br: '', co: '', src: '', sec: '', topic: '' };
  var DAY = 864e5, IST = 19800000, REDUCED = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function num(n) { return Number(n || 0).toLocaleString('en-IN'); }
  function pct(a, b) { return b ? (Math.round(a / b * 1000) / 10) + '%' : '–'; }
  function when(v) { var d = new Date(typeof v === 'number' ? v * 1000 : v); return isNaN(d) ? '' : d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }); }
  function ago(sec) { var s = Math.max(0, Math.round(Date.now() / 1000 - sec)); return s < 60 ? 'just now' : s < 3600 ? Math.round(s / 60) + ' min ago' : Math.round(s / 3600) + ' h ago'; }
  function dk(ms) { return new Date(ms + IST).toISOString().slice(0, 10); }               // India date of a moment
  function istMidnight(ms) { var x = ms + IST; return x - x % DAY - IST; }
  function getKey() { try { return sessionStorage.getItem('nmx-admin') || localStorage.getItem('nmx-admin') || ''; } catch (e) { return ''; } }
  function setKey(k, remember) { try { sessionStorage.setItem('nmx-admin', k); if (remember) localStorage.setItem('nmx-admin', k); } catch (e) {} }
  function clearKey() { try { sessionStorage.removeItem('nmx-admin'); localStorage.removeItem('nmx-admin'); } catch (e) {} }
  function api(params) {
    params.action = 'admin'; params.key = KEY;
    return fetch(CFG.BACKEND_URL, { method: 'POST', body: new URLSearchParams(params) }).then(function (r) { return r.json(); });
  }
  function show(id) { ['login', 'noBackend', 'dash'].forEach(function (x) { $(x).hidden = x !== id; }); }
  function section(p) { p = String(p || ''); return /^\/blog\//.test(p) ? 'Blog' : /^\/learn\//.test(p) ? 'Learn' : /^\/play\//.test(p) ? 'Play' : (p === '/' || p === '/index.html') ? 'Home' : /^\/(tools|dashboard)\//.test(p) ? 'Tools' : p ? 'Other pages' : 'Unknown'; }
  function nextFrame(fn) { requestAnimationFrame(function () { requestAnimationFrame(fn); }); }
  function countUp(el, to, fmt) {
    to = Number(to) || 0;
    var from = Number(el.getAttribute('data-v') || 0); el.setAttribute('data-v', to);
    if (REDUCED || from === to) { el.textContent = fmt(to); return; }
    var t0 = performance.now(), dur = 750;
    (function step(t) { var k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(from + (to - from) * e); if (k < 1) requestAnimationFrame(step); })(t0);
  }

  /* ---------------- the model: everything the page shows, from raw rows + filters ---------------- */
  function buildModel() {
    var now = Date.now(), d = RAW.dict, D = function (i) { return d[i] || ''; };
    var len = F.period === 'today' ? 1 : F.period === 'all' ? RAW.days : Number(F.period);
    var start = istMidnight(now) - (len - 1) * DAY, prevStart = start - len * DAY;
    var days = []; for (var t = start; t <= now; t += DAY) days.push(dk(t));
    var zero = function () { var o = {}; days.forEach(function (x) { o[x] = 0; }); return o; };
    var bump = function (o, k) { k = String(k == null ? '' : k).trim() || 'Unknown'; o[k] = (o[k] || 0) + 1; };
    var top = function (o, n) { return Object.keys(o).map(function (k) { return [k, o[k]]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, n || 8); };

    // A session's source = its first page view's UTM source, or else its referrer.
    var sesSrc = {};
    RAW.visits.forEach(function (r) { if (D(r[1]) === 'pageview' && !(r[3] in sesSrc)) sesSrc[r[3]] = D(r[6]) || D(r[5]) || 'Direct / none'; });
    function srcOf(r) { return sesSrc[r[3]] || D(r[6]) || 'Direct / none'; }
    function visitOk(r) {
      return !(F.dev && D(r[9]) !== F.dev) && !(F.br && D(r[10]) !== F.br) && !(F.co && D(r[12]) !== F.co) &&
        !(F.src && srcOf(r) !== F.src) && !(F.sec && section(D(r[4])) !== F.sec);
    }
    function subOk(r) {
      return !(F.dev && D(r[6]) !== F.dev) && !(F.br && D(r[4]) !== F.br) && !(F.co && D(r[7]) !== F.co) &&
        !(F.src && (D(r[9]) || 'Direct / none') !== F.src) && !(F.sec && section(D(r[8])) !== F.sec) && !(F.topic && D(r[3]).split(',').indexOf(F.topic) < 0);
    }

    var V = { views: zero(), people: zero(), uniq: {}, ses: {}, pv: 0, prevPv: 0, prevUniq: {}, pages: {}, refs: {}, utm: {}, dev: {}, co: {}, heat: [], firstSeen: {} };
    for (var h = 0; h < 7; h++) V.heat.push([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    var dayPeople = {}, ev = {}, evDetail = [], clicks = {}, taps = 0, prevTaps = 0;
    var school = { learnViews: 0, playViews: 0, lessons: {}, quiz: 0, quizScore: 0, quizMax: 0, games: {}, done: 0 };
    RAW.visits.forEach(function (r) {
      var ms = r[0] * 1000, type = D(r[1]), vid = D(r[2]);
      if (vid && !(vid in V.firstSeen)) V.firstSeen[vid] = ms;
      if (type === 'push_click') { var c = D(r[13]); clicks[c] = (clicks[c] || 0) + 1; if (ms >= start) taps++; else if (ms >= prevStart) prevTaps++; return; }
      if (!visitOk(r)) return;
      if (ms < start) { if (ms >= prevStart && type === 'pageview') { V.prevPv++; if (vid) V.prevUniq[vid] = 1; } return; }
      if (type === 'pageview') {
        var day = dk(ms), p = D(r[4]); V.pv++; if (day in V.views) V.views[day]++;
        if (vid) { if (!(vid in V.uniq)) { V.uniq[vid] = 1; bump(V.dev, D(r[9])); bump(V.co, D(r[12])); } dayPeople[day + '|' + vid] = day; }
        if (D(r[3])) V.ses[D(r[3])] = 1;
        bump(V.pages, p); bump(V.refs, D(r[5]) || 'Direct / none'); if (D(r[6])) bump(V.utm, [D(r[6]), D(r[7]), D(r[8])].filter(String).join(' / '));
        var w = new Date(ms + IST); V.heat[(w.getUTCDay() + 6) % 7][w.getUTCHours()]++;
        if (section(p) === 'Learn') { school.learnViews++; if (/^\/learn\/[^/]+\//.test(p)) bump(school.lessons, p); }
        if (section(p) === 'Play') school.playViews++;
      } else {
        ev[type] = (ev[type] || 0) + 1; evDetail.push([type, D(r[13])]);
        if (type === 'quiz_complete') { school.quiz++; var m = /\|(\d+)\/(\d+)/.exec(D(r[13])); if (m) { school.quizScore += +m[1]; school.quizMax += +m[2]; } bump(school.games, 'Quiz: ' + D(r[13]).split('|')[0]); }
        if (type === 'game_end') bump(school.games, D(r[13]).split('|')[0]);
        if (type === 'lesson_done') school.done++;
      }
    });
    Object.keys(dayPeople).forEach(function (k) { V.people[dayPeople[k]]++; });

    // How people subscribe, by where they met the offer (v4 events are counted too)
    var SRC = [['read', 'Reading prompt'], ['end', 'End-of-post card'], ['follow', 'Follow button'], ['other', 'Other']], fz = {};
    SRC.forEach(function (s) { fz[s[0]] = [0, 0, 0]; });
    function srcKey(x) { x = String(x || ''); return /read|auto|time_|second_page/.test(x) ? 'read' : /end/.test(x) ? 'end' : /follow|bell/.test(x) ? 'follow' : 'other'; }
    var checks = { yes: 0, no: 0, fail: 0, guide: 0, denied: 0, dismissed: 0, later: 0 }, secs = [];
    evDetail.forEach(function (e) {
      var t = e[0], x = e[1];
      if (t === 'prompt_shown') fz[srcKey(x || 'read')][0]++;
      else if (t === 'endcard_seen') fz.end[0]++;
      else if (t === 'follow_open') fz.follow[0]++;
      else if (t === 'prompt_yes') fz[srcKey(x || 'follow')][1]++;
      else if (t === 'push_subscribe') { var parts = x.split('|'); fz[parts.length > 1 ? srcKey(parts[1]) : 'other'][2]++; if (parts[2]) secs.push(parseFloat(parts[2])); }
      else if (t === 'push_check_yes') checks.yes++; else if (t === 'push_check_no') checks.no++; else if (t === 'push_check_fail') checks.fail++;
      else if (t === 'push_guide') checks.guide++; else if (t === 'push_denied') checks.denied++; else if (t === 'prompt_dismissed') checks.dismissed++; else if (t === 'prompt_later') checks.later++;
    });
    secs.sort(function (a, b) { return a - b; });
    var seenAll = fz.read[0] + fz.end[0] + fz.follow[0], subAll = fz.read[2] + fz.end[2] + fz.follow[2] + fz.other[2];

    // Notification subscribers
    var P = { active: 0, gained: zero(), lost: zero(), newIn: 0, prevNew: 0, lostIn: 0, br: {}, dev: {}, co: {}, blog: 0, yt: 0, withEmail: 0, installed: 0 };
    var subs = RAW.push.filter(subOk);
    subs.forEach(function (r) {
      var st = D(r[2]), sub = r[0] * 1000, upd = r[1] * 1000;
      if (st === 'Active') {
        P.active++; bump(P.br, D(r[4])); bump(P.dev, D(r[6]) + ' · ' + D(r[5])); bump(P.co, D(r[7]));
        D(r[3]).split(',').forEach(function (x) { if (x === 'blog') P.blog++; if (x === 'youtube') P.yt++; });
        if (D(r[10])) P.withEmail++; if (r[11]) P.installed++;
      }
      if (sub >= start) { P.newIn++; var g = dk(sub); if (g in P.gained) P.gained[g]++; } else if (sub >= prevStart) P.prevNew++;
      if (st !== 'Active' && upd >= start) { P.lostIn++; var l = dk(upd); if (l in P.lost) P.lost[l]++; }
    });
    var recent = subs.slice().sort(function (a, b) { return b[0] - a[0]; }).slice(0, 15).map(function (r) {
      return { at: r[0], status: D(r[2]), topics: D(r[3]), browser: D(r[4]), os: D(r[5]), device: D(r[6]), country: D(r[7]), page: D(r[8]), source: D(r[9]), email: D(r[10]), received: r[12] };
    });

    var camps = RAW.campaigns.filter(function (c) { return Date.parse(c.at) >= start; }), delivered = 0;
    camps.forEach(function (c) { if (c.type !== 'test') delivered += Number(c.delivered || 0); });
    var emailActive = RAW.email.filter(function (r) { return r[1]; }).length, emailNew = RAW.email.filter(function (r) { return r[1] && r[0] * 1000 >= start; }).length;
    var uniq = Object.keys(V.uniq).length, sesN = Object.keys(V.ses).length;
    return {
      compat: false, days: days,
      kpi: [
        { v: P.active, label: 'Notification subscribers', sub: '+' + num(P.newIn) + ' new, −' + num(P.lostIn) + ' lost', d: [P.newIn, P.prevNew] },
        { v: uniq, label: 'Visitors', sub: num(Object.keys(V.uniq).filter(function (x) { return V.firstSeen[x] >= start; }).length) + ' new', d: [uniq, Object.keys(V.prevUniq).length] },
        { v: V.pv, label: 'Page views', sub: num(sesN) + ' visits', d: [V.pv, V.prevPv] },
        { v: taps, label: 'Notification taps', sub: pct(taps, delivered) + ' of ' + num(delivered) + ' delivered', d: [taps, prevTaps] },
        { v: seenAll ? Math.round(subAll / seenAll * 1000) / 10 : 0, pct: true, label: 'Opt-in rate', sub: num(subAll) + ' of ' + num(seenAll) + ' who saw an offer' + (secs.length ? ', ' + secs[Math.floor(secs.length / 2)] + 's median' : '') },
        { v: emailActive, label: 'Email subscribers', sub: '+' + num(emailNew) + ' in this period' }
      ],
      series: { people: days.map(function (x) { return V.people[x]; }), views: days.map(function (x) { return V.views[x]; }), gained: days.map(function (x) { return P.gained[x]; }), lost: days.map(function (x) { return P.lost[x]; }) },
      visitSub: num(uniq) + ' people, ' + num(sesN) + ' visits, ' + num(V.pv) + ' page views.',
      growthSub: '+' + num(P.newIn) + ' new, −' + num(P.lostIn) + ' lost in this period. ' + num(P.active) + ' active now.',
      funnel: SRC.map(function (s) { return [s[1]].concat(fz[s[0]]); }), checks: checks, heat: V.heat, school: school, camps: camps, clicks: clicks,
      bars: { pBrowser: top(P.br), pDevice: top(P.dev), pCountry: top(P.co), pTopics: [['New posts and lessons', P.blog], ['YouTube videos', P.yt]],
        vPages: top(V.pages, 10), vRefs: top(V.refs), vUtm: top(V.utm), vDevice: top(V.dev, 5), vCountry: top(V.co) },
      recent: recent, recentSub: num(P.withEmail) + ' of ' + num(P.active) + ' active subscribers are also on the email list; ' + num(P.installed) + ' installed the app.',
      asks: ev.ask || 0, active: P.active
    };
  }

  // v4 backend: the same view from its 30-day summary (no filters; 7 or 30 days).
  function modelFromStats(s) {
    var len = F.period === '7' ? 7 : 30, cut = 30 - len, sl = function (a) { return (a || []).slice(cut); };
    var p = s.push, v = s.visitors, f = v.funnel;
    return {
      compat: true, days: s.days.slice(cut),
      kpi: [
        { v: p.active, label: 'Notification subscribers', sub: '+' + num(p.new7) + ' this week' },
        { v: v.visitors, label: 'Visitors, 30 days', sub: num(v.newVisitors) + ' new' },
        { v: v.pageviews, label: 'Page views, 30 days', sub: num(v.sessions) + ' visits' },
        { v: s.totals.clicks30, label: 'Notification taps', sub: pct(s.totals.clicks30, s.totals.delivered30) + ' of ' + num(s.totals.delivered30) + ' delivered' },
        { v: f.prompt_shown ? Math.round(f.push_subscribe / f.prompt_shown * 1000) / 10 : 0, pct: true, label: 'Opt-in rate', sub: num(f.push_subscribe) + ' of ' + num(f.prompt_shown) + ' prompts' },
        { v: s.email.active, label: 'Email subscribers', sub: '+' + num(s.email.new30) + ' in 30 days' }
      ],
      series: { people: sl(v.people), views: sl(v.views), gained: sl(p.gained), lost: sl(p.lost) },
      visitSub: num(v.visitors) + ' people, ' + num(v.sessions) + ' visits, ' + num(v.pageviews) + ' page views in 30 days.',
      growthSub: num(p.active) + ' active. ' + p.unsubscribed + ' unsubscribed, ' + p.blocked + ' blocked, ' + p.expired + ' expired in total.',
      funnel: [['All prompts', f.prompt_shown, f.prompt_yes, f.push_subscribe]], checks: { denied: f.push_denied, later: f.prompt_later },
      heat: null, school: null, camps: s.campaigns, clicks: s.campaigns.reduce(function (o, c) { o[c.id] = c.clicks; return o; }, {}),
      bars: { pBrowser: p.browser, pDevice: p.device.concat(p.os), pCountry: p.country, pTopics: [['New posts and lessons', p.topics.blog], ['YouTube videos', p.topics.youtube]],
        vPages: v.pages, vRefs: v.refs, vUtm: v.utm, vDevice: v.device, vCountry: v.country },
      recent: p.recent, recentSub: num(p.withEmail) + ' of ' + num(p.active) + ' active subscribers are also on the email list; ' + num(p.installed) + ' installed the app.',
      asks: v.other.ask, active: p.active
    };
  }

  /* ---------------- drawing ---------------- */
  function kpis(m) {
    var box = $('kpis');
    if (box.children.length !== m.kpi.length) box.innerHTML = m.kpi.map(function () { return '<div class="ad-kpi"><b data-v="0">0</b><span></span><small></small></div>'; }).join('');
    m.kpi.forEach(function (k, i) {
      var c = box.children[i], d = '';
      if (k.d && !m.compat && F.period !== 'all') {
        var a = k.d[0], b = k.d[1];
        if (b) { var ch = Math.round((a - b) / b * 100); d = '<em class="' + (ch >= 0 ? 'up' : 'down') + '" title="vs the previous ' + (F.period === 'today' ? 'day' : F.period + ' days') + '">' + (ch >= 0 ? '▲' : '▼') + Math.abs(ch) + '%</em>'; }
        else if (a) d = '<em class="up">new</em>';
      }
      c.querySelector('span').textContent = k.label;
      c.querySelector('small').innerHTML = esc(k.sub) + d;
      countUp(c.querySelector('b'), k.v, k.pct ? function (x) { return (Math.round(x * 10) / 10) + '%'; } : function (x) { return num(Math.round(x)); });
    });
  }
  function dayLabel(s) { return new Date(s + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }); }
  function tipper(wrap) {
    var tip = document.createElement('div'); tip.className = 'ad-tip'; wrap.appendChild(tip);
    wrap.onmousemove = function (e) {
      var t = e.target.closest && e.target.closest('[data-tip]'); if (!t) { tip.style.opacity = 0; return; }
      var r = wrap.getBoundingClientRect(); tip.textContent = t.getAttribute('data-tip');
      tip.style.left = Math.min(r.width - 60, Math.max(60, e.clientX - r.left)) + 'px'; tip.style.top = (e.clientY - r.top) + 'px'; tip.style.opacity = 1;
    };
    wrap.onmouseleave = function () { tip.style.opacity = 0; };
  }
  function axis(days, x, H) {
    var n = days.length, every = Math.max(1, Math.ceil(n / 6)), out = '';
    for (var i = 0; i < n; i++) if (i % every === 0 || i === n - 1) out += '<text x="' + x(i) + '" y="' + (H - 6) + '" text-anchor="middle" font-size="11" fill="var(--muted)">' + dayLabel(days[i]) + '</text>';
    return out;
  }
  function grid(L, W, ys) { return ys.map(function (g) { return '<line x1="' + L + '" x2="' + W + '" y1="' + g[0] + '" y2="' + g[0] + '" stroke="var(--line)"/><text x="' + (L - 6) + '" y="' + (g[0] + 4) + '" text-anchor="end" font-size="11" fill="var(--muted)">' + g[1] + '</text>'; }).join(''); }
  // People: an orange line drawn left to right over a soft area. Page views: grey bars that grow up behind it.
  function visitChart(id, days, people, views) {
    var W = 640, H = 220, L = 34, B = 26, T = 12, n = days.length, bw = (W - L - 8) / n, max = Math.max(1, Math.max.apply(null, views.concat(people)));
    var y = function (v) { return T + (H - B - T) * (1 - v / max); }, x = function (i) { return L + i * bw + bw / 2; }, step = Math.max(1, Math.ceil(max / 4)), gl = [];
    for (var v = 0; v <= max; v += step) gl.push([y(v), v]);
    var bars = '', hits = '';
    for (var i = 0; i < n; i++) {
      var h = (H - B - T) * views[i] / max;
      if (views[i]) bars += '<rect class="grow" x="' + (x(i) - bw * .32) + '" y="' + (H - B - h) + '" width="' + (bw * .64) + '" height="' + h + '" rx="2" fill="var(--ink)" opacity=".13" style="transform:scaleY(0)"/>';
      hits += '<rect class="hit" x="' + (x(i) - bw / 2) + '" y="' + T + '" width="' + bw + '" height="' + (H - B - T) + '" data-tip="' + dayLabel(days[i]) + ': ' + people[i] + ' people, ' + views[i] + ' views"/>';
    }
    var pts = people.map(function (p, i) { return x(i).toFixed(1) + ',' + y(p).toFixed(1); });
    var line = n > 1 ? 'M' + pts.join(' L') : 'M' + (x(0) - 12) + ',' + y(people[0]) + ' L' + (x(0) + 12) + ',' + y(people[0]);
    var area = line + ' L' + (n > 1 ? x(n - 1) : x(0) + 12).toFixed(1) + ',' + (H - B) + ' L' + (n > 1 ? x(0) : x(0) - 12).toFixed(1) + ',' + (H - B) + ' Z';
    var dots = n <= 31 ? people.map(function (p, i) { return '<circle cx="' + x(i) + '" cy="' + y(p) + '" r="2.6" fill="var(--orange)" class="fade" style="opacity:0"/>'; }).join('') : '';
    var wrap = $(id);
    wrap.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="People and page views per day">' + grid(L, W, gl) + bars +
      '<path class="fade" data-o=".12" d="' + area + '" fill="var(--orange)" style="opacity:0"/>' +
      '<path class="draw" d="' + line + '" fill="none" stroke="var(--orange)" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round" pathLength="1" style="stroke-dasharray:1;stroke-dashoffset:1"/>' + dots +
      '<line x1="' + L + '" x2="' + W + '" y1="' + (H - B) + '" y2="' + (H - B) + '" stroke="var(--muted)"/>' + axis(days, x, H) + hits + '</svg>';
    tipper(wrap);
    nextFrame(function () {
      wrap.querySelectorAll('.grow').forEach(function (r) { r.style.transform = 'scaleY(1)'; });
      wrap.querySelectorAll('.draw').forEach(function (p) { p.style.strokeDashoffset = 0; });
      wrap.querySelectorAll('.fade').forEach(function (c) { c.style.opacity = c.getAttribute('data-o') || 1; });
    });
  }
  function growthChart(id, days, up, down) {
    var W = 640, H = 210, L = 34, B = 26, T = 12, n = days.length, bw = (W - L - 8) / n;
    var mu = Math.max(1, Math.max.apply(null, up)), md = Math.max(0, Math.max.apply(null, down)), span = mu + md, plot = H - B - T, zero = T + plot * (mu / span);
    var x = function (i) { return L + i * bw + bw / 2; }, step = Math.max(1, Math.ceil(mu / 4)), gl = [], b = '';
    for (var v = 0; v <= mu; v += step) gl.push([zero - plot * v / span, v]);
    for (var i = 0; i < n; i++) {
      var w = Math.max(2, bw * .64), xx = x(i) - w / 2, hu = plot * up[i] / span, hd = plot * down[i] / span;
      if (up[i]) b += '<rect class="grow" x="' + xx + '" y="' + (zero - hu) + '" width="' + w + '" height="' + hu + '" rx="2" fill="var(--ink)" style="transform:scaleY(0)"/>';
      if (down[i]) b += '<rect class="grow-down" x="' + xx + '" y="' + zero + '" width="' + w + '" height="' + hd + '" rx="2" fill="var(--orange)" style="transform:scaleY(0)"/>';
      b += '<rect class="hit" x="' + (x(i) - bw / 2) + '" y="' + T + '" width="' + bw + '" height="' + plot + '" data-tip="' + dayLabel(days[i]) + ': +' + up[i] + ' new, −' + down[i] + ' lost"/>';
    }
    var wrap = $(id);
    wrap.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Subscribers gained and lost per day">' + grid(L, W, gl) + '<line x1="' + L + '" x2="' + W + '" y1="' + zero + '" y2="' + zero + '" stroke="var(--muted)"/>' + b + axis(days, x, H) + '</svg>';
    tipper(wrap);
    nextFrame(function () { wrap.querySelectorAll('.grow,.grow-down').forEach(function (r) { r.style.transform = 'scaleY(1)'; }); });
  }
  // Tapping a bar filters the whole dashboard by that value.
  var FILTER_OF = { pBrowser: 'br', pCountry: 'co', vDevice: 'dev', vCountry: 'co', vRefs: 'src', pTopics: 'topic', vPages: 'sec' };
  function bars(id, rows, total) {
    var el = $(id);
    if (!rows || !rows.some(function (r) { return r[1]; })) { el.innerHTML = '<li class="ad-empty">Nothing in this view yet.</li>'; return; }
    var max = total || Math.max.apply(null, rows.map(function (r) { return r[1]; })), fk = MODEL.compat ? '' : FILTER_OF[id] || '';
    el.innerHTML = rows.map(function (r) {
      var val = fk === 'topic' ? (/YouTube/.test(r[0]) ? 'youtube' : 'blog') : fk === 'sec' ? section(r[0]) : r[0], sel = fk && F[fk] === val;
      return '<li class="' + (fk ? 'click' : '') + (sel ? ' sel' : '') + '"' + (fk ? ' data-fk="' + fk + '" data-fv="' + esc(val) + '" title="' + (sel ? 'Clear this filter' : 'Show only ' + esc(fk === 'sec' ? val + ' pages' : val)) + '"' : '') +
        '><span title="' + esc(r[0]) + '">' + esc(r[0]) + '</span><em>' + num(r[1]) + '</em><i><b data-w="' + Math.max(2, Math.round(r[1] / max * 100)) + '"></b></i></li>';
    }).join('');
    nextFrame(function () { el.querySelectorAll('b[data-w]').forEach(function (b) { b.style.width = b.getAttribute('data-w') + '%'; }); });
  }
  function funnel(m) {
    var max = Math.max(1, Math.max.apply(null, m.funnel.map(function (f) { return Math.max(f[1], f[2], f[3]); })));
    $('funnel').innerHTML = m.funnel.map(function (f) {
      return '<div class="ad-frow"><b>' + esc(f[0]) + '</b><div class="ad-ftrack"><span class="s1" data-w="' + (f[1] / max * 100) + '"></span><span class="s2" data-w="' + (f[2] / max * 100) + '"></span><span class="s3" data-w="' + (f[3] / max * 100) + '"></span></div>' +
        '<small title="saw · tapped · subscribed">' + num(f[1]) + ' · ' + num(f[2]) + ' · <strong>' + num(f[3]) + '</strong></small></div>';
    }).join('');
    nextFrame(function () { $('funnel').querySelectorAll('span[data-w]').forEach(function (s) { s.style.width = s.getAttribute('data-w') + '%'; }); });
    var c = m.checks, chips = m.compat ? [['Blocked in the browser', c.denied], ['Said “Not now”', c.later]] :
      [['Confirmed the test arrived', c.yes], ['Said it didn’t show', c.no], ['Device blocked the test', c.fail], ['Opened the fix-it steps', c.guide], ['Blocked in the browser', c.denied], ['Closed the browser prompt', c.dismissed], ['Said “Not now”', c.later]];
    $('checksOut').innerHTML = chips.map(function (x) { return '<span class="ad-chip"><b>' + num(x[1]) + '</b>' + esc(x[0]) + '</span>'; }).join('');
  }
  function heat(m) {
    var el = $('heat');
    if (!m.heat) { el.innerHTML = '<p class="ad-empty" style="grid-column:1/-1">Shows up with Code-Blog.gs v5.</p>'; return; }
    var max = 1; m.heat.forEach(function (r) { r.forEach(function (v) { if (v > max) max = v; }); });
    var names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], h = '';
    m.heat.forEach(function (row, d) {
      h += '<span>' + names[d] + '</span>' + row.map(function (v, hr) { return '<div data-o="' + (v ? (.15 + .85 * v / max).toFixed(2) : .05) + '" title="' + names[d] + ' ' + hr + ':00 to ' + (hr + 1) + ':00 · ' + v + ' views"></div>'; }).join('');
    });
    h += '<span></span>'; for (var i = 0; i < 24; i++) h += '<span class="hx">' + (i % 6 === 0 ? (i === 0 ? '12a' : i === 12 ? '12p' : i < 12 ? i + 'a' : (i - 12) + 'p') : '') + '</span>';
    el.innerHTML = h;
    nextFrame(function () { el.querySelectorAll('div[data-o]').forEach(function (c, i) { c.style.transitionDelay = (i % 24) * 12 + 'ms'; c.style.opacity = c.getAttribute('data-o'); }); });
  }
  function school(m) {
    var s = m.school;
    if (!s) { $('schoolSub').textContent = 'Shows up with Code-Blog.gs v5.'; $('schoolChips').innerHTML = ''; bars('lessons', []); bars('games', []); return; }
    $('schoolSub').textContent = num(s.learnViews) + ' lesson page views and ' + num(s.playViews) + ' Play page views in this view.';
    $('schoolChips').innerHTML = [[num(s.done), 'lessons finished'], [num(s.quiz), 'quizzes completed'], [s.quizMax ? Math.round(s.quizScore / s.quizMax * 100) + '%' : '–', 'average quiz score']]
      .map(function (x) { return '<span class="ad-chip"><b>' + x[0] + '</b>' + x[1] + '</span>'; }).join('');
    bars('lessons', Object.keys(s.lessons).map(function (k) { return [k.replace(/^\/learn\/|\/$/g, '').replace(/-/g, ' '), s.lessons[k]]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 6));
    bars('games', Object.keys(s.games).map(function (k) { return [k, s.games[k]]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 6));
  }
  function camps(m) {
    $('camps').innerHTML = m.camps.length ? m.camps.slice(0, 40).map(function (c) {
      var ok = c.status === 'Sent', bad = /fail|Waiting/.test(c.status), retry = /Dispatch failed|Waiting/.test(c.status), cl = m.clicks[c.id] || 0, dl = Number(c.delivered || 0);
      return '<tr><td>' + when(c.at) + '<br><small style="color:var(--muted)">' + esc(c.type) + ' · ' + esc(String(c.audience).replace(/^id:.*/, 'test')) + '</small></td><td><a href="' + esc(c.url) + '" target="_blank" rel="noopener">' + esc(c.title) + '</a>' + (c.note ? '<br><small style="color:var(--muted)">' + esc(c.note) + '</small>' : '') + '</td>' +
        '<td><span class="ad-pill ' + (ok ? 'ok' : bad ? 'bad' : '') + '">' + esc(c.status) + '</span></td>' +
        '<td class="n">' + (c.delivered === '' ? '–' : num(c.delivered)) + (c.expired ? '<br><small style="color:var(--muted)">' + num(c.expired) + ' expired</small>' : '') + '</td>' +
        '<td class="n">' + num(cl) + ' · ' + pct(cl, dl) + '<span class="ad-ctr"><b style="width:' + (dl ? Math.min(100, cl / dl * 300) : 0) + '%"></b></span></td>' +
        '<td>' + (retry ? '<button class="ad-btn" data-retry="' + esc(c.id) + '">Retry</button>' : '') + '</td></tr>';
    }).join('') : '<tr><td colspan="6" class="ad-empty">No campaigns in this period. The next one goes out with your next blog post, or send one here.</td></tr>';
  }
  function fillFilters() {
    var compat = !RAW, opts = { dev: ['All devices'], br: ['All browsers'], co: ['All countries'], src: ['All sources'], sec: ['All sections'], topic: ['All topics', 'blog', 'youtube'] };
    $('compat').hidden = !compat;
    if (RAW) {
      var d = RAW.dict, c = { dev: {}, br: {}, co: {}, src: {}, sec: {} }, add = function (o, k) { if (k) o[k] = (o[k] || 0) + 1; };
      RAW.visits.forEach(function (r) { if (d[r[1]] !== 'pageview') return; add(c.dev, d[r[9]]); add(c.br, d[r[10]]); add(c.co, d[r[12]]); add(c.src, d[r[6]] || d[r[5]] || 'Direct / none'); add(c.sec, section(d[r[4]])); });
      Object.keys(c).forEach(function (k) { opts[k] = opts[k].concat(Object.keys(c[k]).sort(function (a, b) { return c[k][b] - c[k][a]; }).slice(0, 25)); });
    }
    document.querySelectorAll('#filters select').forEach(function (s) {
      var k = s.getAttribute('data-f'), list = opts[k].slice();
      if (F[k] && list.indexOf(F[k]) < 0) list.push(F[k]);
      s.innerHTML = list.map(function (v, i) { return '<option value="' + (i ? esc(v) : '') + '">' + esc(i && k === 'topic' ? (v === 'blog' ? 'Posts and lessons' : 'YouTube videos') : v) + '</option>'; }).join('');
      s.value = F[k]; s.disabled = compat; s.classList.toggle('on', !!F[k]);
    });
    $('reset').hidden = !['dev', 'br', 'co', 'src', 'sec', 'topic'].some(function (k) { return F[k]; });
    document.querySelectorAll('#period button').forEach(function (b) { var p = b.getAttribute('data-p'); b.setAttribute('aria-pressed', String(p === F.period)); b.disabled = compat && p !== '7' && p !== '30'; });
  }
  function render() {
    MODEL = RAW ? buildModel() : modelFromStats(STATS);
    fillFilters(); kpis(MODEL);
    $('visitSub').textContent = MODEL.visitSub; $('growthSub').textContent = MODEL.growthSub;
    visitChart('visits', MODEL.days, MODEL.series.people, MODEL.series.views);
    growthChart('growth', MODEL.days, MODEL.series.gained, MODEL.series.lost);
    funnel(MODEL); heat(MODEL); school(MODEL); camps(MODEL);
    Object.keys(MODEL.bars).forEach(function (k) { bars(k, MODEL.bars[k], k === 'pTopics' ? Math.max(1, MODEL.active) : 0); });
    $('recentSub').textContent = MODEL.recentSub;
    $('recent').innerHTML = MODEL.recent.length ? MODEL.recent.map(function (r) {
      return '<tr><td>' + when(r.at) + '</td><td>' + esc(r.status) + '</td><td>' + esc(r.topics) + '</td><td>' + esc(r.browser) + '</td><td>' + esc(r.device) + ' · ' + esc(r.os) + '</td><td>' + esc(r.country) + '</td><td>' + esc(r.page) + '</td><td>' + esc(r.source) + '</td><td>' + esc(r.email) + '</td><td class="n">' + num(r.received) + '</td></tr>';
    }).join('') : '<tr><td colspan="10" class="ad-empty">No subscribers match this view.</td></tr>';
    $('askSub').textContent = num(MODEL.asks) + ' questions in this view; the AI-answered ones are listed here, the rest are in the Visitors tab.';
  }
  function renderStatic(d) {
    $('updated').textContent = 'Updated ' + when(d.updated) + ' · backend ' + d.version + (RAW ? ' · ' + num(RAW.visits.length) + ' visitor events from the last ' + RAW.days + ' days' : '');
    $('sheet').href = d.setup.sheet;
    var vapid = /^[A-Za-z0-9_-]{80,100}$/.test(String(CFG.VAPID_PUBLIC_KEY || ''));
    var checks = [
      [d.version === 'v5', 'Apps Script backend is <code>v5</code> (paste Code-Blog.gs v5, then Deploy > Manage deployments > pencil > Version: New version > Deploy)'],
      [vapid, 'Public VAPID key pasted into <code>VAPID_PUBLIC_KEY</code> in /assets/nmx.js'],
      [d.setup.github, 'GitHub connected: <code>GITHUB_REPO</code> and <code>GITHUB_TOKEN</code> in Script properties' + (d.setup.repo ? ' (' + esc(d.setup.repo) + ')' : '')],
      [!!d.setup.youtube, 'YouTube channel for new-video notifications: <code>YOUTUBE_CHANNEL_ID</code> (optional)'],
      [d.setup.gemini, 'Gemini key for open questions in the assistant: <code>GEMINI_API_KEY</code> (optional)']
    ];
    $('setup').hidden = checks.every(function (c) { return c[0]; });
    $('checks').innerHTML = checks.map(function (c) { return '<li class="' + (c[0] ? 'ok' : '') + '">' + c[1] + '</li>'; }).join('');
    var leads = d.leads || [], asks = d.asks || [];
    $('leads').innerHTML = leads.length ? leads.map(function (l) { return '<tr><td>' + when(l.at) + '</td><td>' + esc(l.name) + '</td><td>' + esc(l.contact) + '</td><td>' + esc(l.message) + '</td></tr>'; }).join('') : '<tr><td colspan="4" class="ad-empty">No leads yet.</td></tr>';
    $('asks').innerHTML = asks.length ? asks.map(function (a) { return '<tr><td>' + when(a.at) + '</td><td>' + esc(a.q) + '</td><td>' + esc(a.page) + '</td></tr>'; }).join('') : '<tr><td colspan="3" class="ad-empty">No questions yet.</td></tr>';
  }

  /* ---------------- live view ---------------- */
  var LABEL = { pageview: 'read', push_subscribe: 'turned on notifications', push_click: 'tapped a notification', prompt_shown: 'saw the notification offer', prompt_yes: 'tapped Allow',
    endcard_seen: 'finished reading a post', quiz_complete: 'finished a quiz', game_end: 'finished a game', lesson_done: 'finished a lesson', save: 'saved a post', ask: 'asked the assistant',
    lead: 'sent an enquiry', app_installed: 'installed the app', push_check_yes: 'confirmed notifications arrive', push_check_no: 'said a notification didn’t show',
    push_guide: 'opened the fix-it steps', push_denied: 'blocked notifications', follow_open: 'opened Follow' };
  var seen = {};
  function drawLive(L) {
    var ev = L.events || [], nowS = Date.now() / 1000, active = {};
    ev.forEach(function (e) { if (nowS - e.t < 300 && e.v) active[e.v] = 1; });
    $('liveTxt').innerHTML = '<b>' + Object.keys(active).length + '</b> on the site now';
    var shown = ev.filter(function (e) { return LABEL[e.e]; }).slice(0, 30), next = {};
    $('feedSub').textContent = num(ev.filter(function (e) { return e.e === 'pageview'; }).length) + ' page views in the last 30 minutes. Updates every 30 seconds.';
    $('feed').innerHTML = shown.length ? shown.map(function (e) {
      var key = e.t + e.v + e.e, cls = /subscribe|check_yes/.test(e.e) ? 'sub' : e.e === 'push_click' ? 'tap' : /quiz|game|lesson/.test(e.e) ? 'play' : '';
      var what = e.e === 'pageview' ? 'read <u>' + esc(e.p) + '</u>' : esc(LABEL[e.e]) + (/quiz_complete|game_end/.test(e.e) ? ' <u>' + esc(e.d) + '</u>' : '');
      next[key] = 1;
      return '<li' + (seen[key] ? ' style="animation:none"' : '') + '><span class="dot ' + cls + '"></span><span>' + esc(e.dev || 'Someone') + (e.br ? ' · ' + esc(e.br) : '') + (e.co ? ' in ' + esc(e.co) : '') + ' ' + what + '</span><small>' + ago(e.t) + '</small></li>';
    }).join('') : '<li class="ad-empty" style="display:block;border:0">Nobody in the last 30 minutes.</li>';
    seen = next;
  }
  function pollLive() {
    clearTimeout(liveTimer);
    if (!RAW || $('live').getAttribute('aria-pressed') !== 'true') return;
    if (document.visibilityState === 'visible') api({ op: 'live' }).then(function (L) { if (L && L.ok) drawLive(L); }).catch(function () {});
    liveTimer = setTimeout(pollLive, 30000);
  }
  $('live').addEventListener('click', function () {
    var on = this.getAttribute('aria-pressed') !== 'true'; this.setAttribute('aria-pressed', String(on)); this.classList.toggle('off', !on);
    if (on) pollLive(); else { clearTimeout(liveTimer); $('liveTxt').textContent = 'Paused'; }
  });
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') pollLive(); });

  /* ---------------- loading ---------------- */
  function load(fresh) {
    $('updated').textContent = 'Loading…'; $('dash').classList.add('ad-loading');
    return api({ op: 'raw', days: '120' }).then(function (d) {
      if (d && d.ok) { RAW = d; STATS = null; renderStatic(d); render(); pollLive(); loadMail(); return; }
      if (d && /Unknown request/.test(d.error || '')) {               // v4 backend: fall back to its 30-day summary
        return api({ op: 'stats', fresh: fresh ? '1' : '' }).then(function (s) {
          if (!s || !s.ok) throw s;
          RAW = null; STATS = s; if (F.period !== '7') F.period = '30';
          renderStatic(s); render(); $('liveTxt').textContent = 'Live needs v5'; $('live').classList.add('off'); loadMail();
        });
      }
      throw d;
    }).catch(function (d) {
      if (d && d.error) { clearKey(); show('login'); $('loginStatus').textContent = d.error; return; }
      console.error(d); show('login'); $('loginStatus').textContent = 'The backend didn’t answer. Check BACKEND_URL in /assets/nmx.js and that the deployment allows Anyone.';
    }).then(function () { $('dash').classList.remove('ad-loading'); });
  }

  $('period').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b || b.disabled) return; F.period = b.getAttribute('data-p'); render(); });
  document.querySelectorAll('#filters select').forEach(function (s) { s.addEventListener('change', function () { F[s.getAttribute('data-f')] = s.value; render(); }); });
  $('reset').addEventListener('click', function () { ['dev', 'br', 'co', 'src', 'sec', 'topic'].forEach(function (k) { F[k] = ''; }); render(); });
  document.addEventListener('click', function (e) {
    var li = e.target.closest && e.target.closest('.ad-bars li[data-fk]'); if (!li) return;
    var k = li.getAttribute('data-fk'), v = li.getAttribute('data-fv'); F[k] = F[k] === v ? '' : v; render();
  });

  // composer
  var form = $('send');
  function preview() {
    $('pvT').textContent = form.title.value || 'Title'; $('pvM').textContent = form.message.value;
    $('tc').textContent = form.title.value.length; $('mc').textContent = form.message.value.length;
    var img = form.image.value.trim(); $('pvI').hidden = !/^https:\/\//.test(img); if (/^https:\/\//.test(img)) $('pvI').src = img;
  }
  ['input', 'change'].forEach(function (ev) { form.addEventListener(ev, preview); });
  function activeFor(a) {
    if (!RAW) return a === 'all' ? STATS.push.active : STATS.push.topics[a];
    return RAW.push.filter(function (r) { return RAW.dict[r[2]] === 'Active' && (a === 'all' || RAW.dict[r[3]].split(',').indexOf(a) > -1); }).length;
  }
  function send(audience) {
    var st = $('sendStatus');
    if (form.title.value.trim().length < 3) { st.textContent = 'Add a title first.'; form.title.focus(); return; }
    var btns = [$('go'), $('test')]; btns.forEach(function (b) { b.disabled = true; }); st.textContent = 'Starting the send on GitHub…';
    api({ op: 'send', title: form.title.value.trim(), message: form.message.value.trim(), url: form.url.value.trim(), image: form.image.value.trim(), audience: audience })
      .then(function (r) {
        st.textContent = r.ok ? (/^id:/.test(audience) ? 'Test queued. It should pop up within a minute or two.' : 'Queued. Delivery numbers show up here in a minute or two; press Refresh.') : (r.error || 'That didn’t work.');
        if (r.ok) setTimeout(function () { load(true); }, 1500);
      }).catch(function () { st.textContent = 'The backend didn’t answer. Try again.'; })
      .then(function () { btns.forEach(function (b) { b.disabled = false; }); });
  }
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var a = form.audience.value, n = activeFor(a);
    if (confirm('Send “' + form.title.value.trim() + '” to ' + n + ' subscriber' + (n === 1 ? '' : 's') + '?')) send(a);
  });
  $('test').addEventListener('click', function () {
    var me = null; try { me = JSON.parse(localStorage.getItem('nmx-push') || 'null'); } catch (e) {}
    if (!me || !me.id) { $('sendStatus').textContent = 'This browser isn’t subscribed. Open labsnmx.com in this browser, tap Follow and turn on notifications, then come back.'; return; }
    send('id:' + me.id);
  });
  $('camps').addEventListener('click', function (e) {
    var b = e.target.closest('[data-retry]'); if (!b) return;
    b.disabled = true; b.textContent = 'Retrying…';
    api({ op: 'retry', id: b.getAttribute('data-retry') }).then(function (r) { if (!r.ok) alert(r.error || 'Retry failed'); load(true); });
  });

  /* ---------------- v6: newsletters, offers and updates ---------------- */
  var mform = $('mail'), MODE = 'push', MAILV6 = null;
  var STARTERS = {
    newsletter: [['This week at the studio', { subject: 'This week at NMX Labs: what we tested, what we binned', headline: 'Three things worth your five minutes', body: 'Hi,\n\nShort one this week. Here is what we tried, what worked and what we quietly put back in the drawer.\n\n1. \n2. \n3. \n\nReply and tell us what you want us to test next. A real person reads every reply.', cta: 'Read the latest posts', link: 'https://labsnmx.com/blog/' }],
                 ['Monthly round-up', { subject: 'The month in design, AI and ads, minus the noise', headline: 'The month, in one coffee break', body: 'Hi,\n\nThe stories that actually mattered this month, and what we would do about each one.\n\n', cta: 'See the news page', link: 'https://labsnmx.com/news/' }]],
    offer: [['Festive offer', { subject: 'A small thank-you: 20% off a brand identity this month', headline: '20% off a starter brand identity', body: 'Hi,\n\nYou have been reading along for a while, so here is a proper thank-you.\n\nBook a starter brand identity this month and take 20% off. Same senior team, same fixed price upfront, just less of it.', code: 'NMX20', cta: 'Claim the offer', link: 'https://labsnmx.com/#services' }],
            ['Free audit', { subject: 'Free 20-minute ad account check, five slots this week', headline: 'We will look at your Meta ads for free', body: 'Hi,\n\nWe are opening five free 20-minute calls this week. Send us your ad account screenshots and we will tell you, honestly, what we would change first.', cta: 'Book a slot on WhatsApp', link: 'https://wa.me/918810438717' }]],
    update: [['New on the site', { subject: 'New on labsnmx.com: courses, games and a faster blog', headline: 'We have been busy (the good kind)', body: 'Hi,\n\nQuick update from the studio.\n\nNew short courses are live in Learn, there is a spin-the-wheel game in Play, and the blog now publishes 3 to 4 articles a week.', cta: 'Have a look', link: 'https://labsnmx.com/' }]]
  };
  function setMode(m) {
    MODE = m;
    document.querySelectorAll('#composer [data-mode]').forEach(function (b) { b.setAttribute('aria-selected', String(b.getAttribute('data-mode') === m)); });
    form.hidden = m !== 'push'; mform.hidden = m === 'push';
    mform.querySelector('[data-offer]').hidden = m !== 'offer';
    if (m !== 'push') {
      var cta = mform.cta;
      if (!cta.dataset.touched) cta.value = m === 'offer' ? 'Claim the offer' : 'Read more';
      $('starters').innerHTML = '<span class="ad-hint" style="align-self:center;margin:0 4px 0 0">Start from:</span>' + (STARTERS[m] || []).map(function (x, i) { return '<button type="button" data-starter="' + i + '">' + esc(x[0]) + '</button>'; }).join('');
      $('mailPrevBox').hidden = true; mailCounts();
    }
  }
  document.querySelectorAll('#composer [data-mode]').forEach(function (b) { b.addEventListener('click', function () { setMode(b.getAttribute('data-mode')); }); });
  $('starters').addEventListener('click', function (e) {
    var b = e.target.closest('[data-starter]'); if (!b) return;
    var t = STARTERS[MODE][Number(b.getAttribute('data-starter'))][1];
    if (mform.body.value.trim() && !confirm('Replace what you have written with this starter?')) return;
    ['subject', 'headline', 'preheader', 'body', 'code', 'cta', 'link'].forEach(function (k) { if (mform[k]) mform[k].value = t[k] || (k === 'cta' ? mform.cta.value : k === 'link' ? mform.link.value : ''); });
    $('sc').textContent = mform.subject.value.length;
  });
  mform.cta.addEventListener('input', function () { mform.cta.dataset.touched = '1'; });
  mform.subject.addEventListener('input', function () { $('sc').textContent = mform.subject.value.length; });
  function mailCounts() {
    var em = RAW ? RAW.email.filter(function (r) { return r[1]; }).length : (STATS && STATS.email ? STATS.email.active : null);
    if (MAILV6 && typeof MAILV6.active === 'number') em = MAILV6.active;
    $('mailCount').textContent = em == null ? 'your' : num(em);
    var pu = null; try { pu = activeFor('all'); } catch (e) {}
    $('pushCount').textContent = pu == null ? 'your' : num(pu);
    $('quotaHint').innerHTML = MAILV6 ? 'Gmail lets this account send about <b>' + num(MAILV6.quota) + '</b> more emails today. Anything over that goes out automatically in the next days, between 9:00 and 21:00 India time.' : '';
  }
  function mailParams(op) {
    var f = mform;
    return { op: op, type: MODE, subject: f.subject.value.trim(), preheader: f.preheader.value.trim(), headline: f.headline.value.trim(), body: f.body.value,
      code: MODE === 'offer' ? f.code.value.trim() : '', expires: MODE === 'offer' ? f.expires.value : '', cta: f.cta.value.trim(), link: f.link.value.trim(),
      image: f.image.value.trim(), quick: f.quick.checked ? '1' : '0', ch_email: f.ch_email.checked ? '1' : '0', ch_push: f.ch_push.checked ? '1' : '0' };
  }
  function mailCheck() {
    var st = $('mailStatus');
    if (mform.subject.value.trim().length < 3) { st.textContent = 'Add a subject line first.'; mform.subject.focus(); return false; }
    if (mform.body.value.trim().length < 2 && !mform.headline.value.trim()) { st.textContent = 'Write a message first.'; mform.body.focus(); return false; }
    if (!/^https:\/\/\S+$/.test(mform.link.value.trim())) { st.textContent = 'The button link has to start with https://'; mform.link.focus(); return false; }
    return true;
  }
  function needV6(r) { return r && /Unknown request/.test(r.error || '') ? 'Paste Code-Blog.gs v6 into Apps Script and deploy a new version to send emails from here.' : (r && r.error) || 'That didn’t work.'; }
  function mailBusy(on) { ['mailPreview', 'mailTest', 'mailGo'].forEach(function (id) { $(id).disabled = on; }); }
  $('mailPreview').addEventListener('click', function () {
    if (!mailCheck()) return; var st = $('mailStatus'); st.textContent = 'Building the preview…'; mailBusy(true);
    api(mailParams('mail_preview')).then(function (r) {
      if (!r.ok) { st.textContent = needV6(r); return; }
      st.textContent = ''; $('mailPrevSubj').textContent = 'Subject: ' + r.subject; $('mailFrame').srcdoc = r.html; $('mailPrevBox').hidden = false;
    }).catch(function () { st.textContent = 'The backend didn’t answer. Try again.'; }).then(function () { mailBusy(false); });
  });
  $('mailTest').addEventListener('click', function () {
    if (!mailCheck()) return; var st = $('mailStatus'); st.textContent = 'Sending a test…'; mailBusy(true);
    api(mailParams('mail_test')).then(function (r) { st.textContent = r.ok ? 'Test sent to ' + r.to + '. Check your inbox (and Promotions).' : needV6(r); })
      .catch(function () { st.textContent = 'The backend didn’t answer. Try again.'; }).then(function () { mailBusy(false); });
  });
  mform.addEventListener('submit', function (e) {
    e.preventDefault(); if (!mailCheck()) return;
    var p = mailParams('mail_send'), st = $('mailStatus');
    if (p.ch_email !== '1' && p.ch_push !== '1') { st.textContent = 'Tick email, notification or both.'; return; }
    var who = [p.ch_email === '1' ? $('mailCount').textContent + ' email subscribers' : '', p.ch_push === '1' ? $('pushCount').textContent + ' notification followers' : ''].filter(Boolean).join(' and ');
    if (!confirm('Send “' + p.subject + '” to ' + who + '? This can’t be undone.')) return;
    st.textContent = 'Sending…'; mailBusy(true);
    api(p).then(function (r) {
      if (!r.ok) { st.textContent = needV6(r); return; }
      var bits = [];
      if (r.id) bits.push(r.waiting ? 'Sent ' + num(r.sent) + ' emails so far; ' + num(r.waiting) + ' more go out automatically.' : 'Sent ' + num(r.sent || 0) + ' emails.');
      if (p.ch_push === '1') bits.push(r.pushError ? 'Notification: ' + r.pushError : 'Notification queued on GitHub.');
      st.textContent = bits.join(' ');
      loadMail(); if (p.ch_push === '1') setTimeout(function () { load(true); }, 1500);
    }).catch(function () { st.textContent = 'The backend didn’t answer. Check the Email campaigns tab before trying again, so nobody gets it twice.'; })
      .then(function () { mailBusy(false); });
  });
  function loadMail() {
    return api({ op: 'mail_list' }).then(function (r) {
      if (!r || !r.ok) { MAILV6 = null; $('mails').innerHTML = '<tr><td colspan="6" class="ad-empty">' + esc(needV6(r)) + '</td></tr>'; mailCounts(); return; }
      MAILV6 = r; mailCounts();
      var label = { newsletter: 'Newsletter', offer: 'Offer', update: 'Update' };
      $('mailSub').textContent = num(r.active) + ' active email subscribers · about ' + num(r.quota) + ' emails left in today’s Gmail limit.';
      $('mails').innerHTML = r.campaigns.length ? r.campaigns.map(function (c) {
        var cls = c.status === 'Sent' ? 'ok' : c.status === 'Stopped' ? 'bad' : '';
        return '<tr><td>' + when(c.at) + '</td><td>' + esc(c.subject) + (c.note ? '<br><small style="color:var(--muted)">' + esc(c.note) + '</small>' : '') + '</td><td>' + esc(label[c.type] || c.type) +
          '</td><td><span class="ad-pill ' + cls + '">' + esc(c.status) + '</span></td><td class="n">' + num(c.sent) + '</td><td>' +
          (c.status === 'Sending' ? '<button class="ad-btn" type="button" data-stop="' + esc(c.id) + '">Stop</button>' : '') + '</td></tr>';
      }).join('') : '<tr><td colspan="6" class="ad-empty">Nothing sent yet. Your first newsletter will show up here.</td></tr>';
    }).catch(function () {});
  }
  $('mails').addEventListener('click', function (e) {
    var b = e.target.closest('[data-stop]'); if (!b || !confirm('Stop this campaign? People who already got it keep it.')) return;
    b.disabled = true; api({ op: 'mail_cancel', id: b.getAttribute('data-stop') }).then(function (r) { if (!r.ok) alert(r.error || 'Couldn’t stop it'); loadMail(); });
  });
  $('refresh').addEventListener('click', function () { load(true); });
  $('signout').addEventListener('click', function () { clearKey(); KEY = ''; clearTimeout(liveTimer); show('login'); });
  $('loginForm').addEventListener('submit', function (e) {
    e.preventDefault(); KEY = $('key').value.trim(); $('loginStatus').textContent = 'Checking…';
    api({ op: 'stats' }).then(function (d) {
      if (!d || !d.ok) { $('loginStatus').textContent = (d && d.error) || 'That key didn’t work.'; return; }
      setKey(KEY, $('remember').checked); show('dash'); load(false);
    }).catch(function () { $('loginStatus').textContent = 'The backend didn’t answer. Check BACKEND_URL and the deployment.'; });
  });

  window.addEventListener('load', function () {
    CFG = window.NMX_CFG || {};
    if (!window.NMX_backendReady || !window.NMX_backendReady()) { show('noBackend'); return; }
    KEY = getKey(); preview();
    if (KEY) { show('dash'); load(false); } else show('login');
  });
})();
