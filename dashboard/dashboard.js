/* NMX Labs dashboard (v10: a custom date range, channel cards for Instagram, Google Search (organic), Facebook, Pinterest
   and LinkedIn, returning readers with how often they come back, and each reader's journey: every visit, its source, the
   pages read, time on each page and what led them to subscribe. Long tables scroll inside their own box.
   v9: plain-English traffic sources and notifications by topic or region. v7: traffic source classification on every chart and filter, and a "Latest blog post" card that
   sends a post by email and/or notification without doubling up on the automatic hourly sender).
   v6: lives at /dashboard/; sends newsletters, offers and updates by email and/or notification). Was v5: Signs in with ADMIN_KEY, loads row-level data from Code-Blog.gs v5 (admin op "raw") and
   counts everything in the browser, so filters and period changes are instant. With a v4 backend it falls back to the
   30-day summary (no filters). Holds no keys: BACKEND_URL and VAPID_PUBLIC_KEY come from /assets/nmx.js. */
(function () {
  'use strict';
  /* ---- v9 traffic source classification: the same code runs on the site, in the backend and on the dashboard ----
     Six classes (Organic Search, Paid Search, Social, Direct, Referral, Unknown) and a plain-English detail, for example
     "Instagram · Meta ads · Instagram Stories", "Audience Network (Meta partner apps) · Meta ads", "Google app (Search or Discover)".
     o = { ref, us: utm_source, um: utm_medium, ct: utm_content, ut: utm_term, click: { g, m, f, s }, app, internal } */
  var NMX_SRC = { fb: 'Facebook', facebook: 'Facebook', ig: 'Instagram', instagram: 'Instagram', insta: 'Instagram', an: 'Audience Network (Meta partner apps)',
    msg: 'Messenger', messenger: 'Messenger', wa: 'WhatsApp', whatsapp: 'WhatsApp', th: 'Threads', threads: 'Threads', meta: 'Meta', google: 'Google', bing: 'Bing',
    yahoo: 'Yahoo', duckduckgo: 'DuckDuckGo', ddg: 'DuckDuckGo', youtube: 'YouTube', yt: 'YouTube', linkedin: 'LinkedIn', li: 'LinkedIn', lnkd: 'LinkedIn',
    x: 'X (Twitter)', twitter: 'X (Twitter)', pinterest: 'Pinterest', reddit: 'Reddit', quora: 'Quora', telegram: 'Telegram', tg: 'Telegram', tiktok: 'TikTok',
    snapchat: 'Snapchat', newsletter: 'Email newsletter', email: 'Email', push: 'Browser notification', pwa: 'Installed app', chatgpt: 'ChatGPT', openai: 'ChatGPT',
    perplexity: 'Perplexity', claude: 'Claude', gemini: 'Gemini', copilot: 'Copilot', deepseek: 'DeepSeek', grok: 'Grok', sharechat: 'ShareChat', discord: 'Discord' };
  var NMX_HOSTS = [[/^(com\.google\.android\.googlequicksearchbox|googlequicksearchbox)$/, 'Google app (Search or Discover)'], [/^(mail\.google\.com|com\.google\.android\.gm|inbox\.google\.com)$/, 'Gmail'],
    [/^((m|www)\.)?google\.[a-z.]+$/, 'Google Search'], [/(^|\.)bing\.com$/, 'Bing'], [/duckduckgo\.com$/, 'DuckDuckGo'], [/(^|\.)yahoo\.(com|co\.jp)$/, 'Yahoo'],
    [/^(l\.|lm\.|m\.|web\.)?facebook\.com$|^fb\.(com|me)$|^com\.facebook\.(katana|lite)$/, 'Facebook'], [/^(l\.)?instagram\.com$|^com\.instagram\.android$/, 'Instagram'],
    [/^messenger\.com$|^com\.facebook\.orca$/, 'Messenger'], [/whatsapp\.com$|^wa\.me$|^com\.whatsapp$/, 'WhatsApp'], [/^threads\.(net|com)$/, 'Threads'],
    [/linkedin\.com$|^lnkd\.in$|^com\.linkedin\.android$/, 'LinkedIn'], [/^(t\.co|twitter\.com|x\.com|com\.twitter\.android)$/, 'X (Twitter)'],
    [/youtube\.com$|^youtu\.be$|^com\.google\.android\.youtube$/, 'YouTube'], [/^(chatgpt\.com|chat\.openai\.com|openai\.com)$/, 'ChatGPT'], [/perplexity\.ai$/, 'Perplexity'],
    [/^claude\.ai$/, 'Claude'], [/^gemini\.google\.com$/, 'Gemini'], [/copilot\.(microsoft\.)?com$/, 'Copilot'], [/deepseek\.com$/, 'DeepSeek'], [/^grok\.com$/, 'Grok'],
    [/outlook\.(live|office|office365)\.com$/, 'Outlook'], [/pinterest\.|^pin\.it$/, 'Pinterest'], [/reddit\.com$|^redd\.it$/, 'Reddit'], [/^(t\.me|telegram\.org|org\.telegram\.messenger)$/, 'Telegram'],
    [/quora\.com$/, 'Quora'], [/medium\.com$/, 'Medium'], [/behance\.net$/, 'Behance'], [/dribbble\.com$/, 'Dribbble']];
  function nmxHostName(h) { h = String(h || '').toLowerCase().replace(/^www\./, ''); for (var i = 0; i < NMX_HOSTS.length; i++) if (NMX_HOSTS[i][0].test(h)) return NMX_HOSTS[i][1]; return h; }
  function nmxPlacement(s) {
    s = String(s || '').trim(); if (!s || /^\{\{.*\}\}$/.test(s)) return '';
    var k = s.toLowerCase().replace(/[\s-]+/g, '_');
    var fixed = { facebook_mobile_feed: 'Facebook feed', facebook_desktop_feed: 'Facebook feed (desktop)', instagram_feed: 'Instagram feed', instagram_stories: 'Instagram Stories',
      instagram_reels: 'Instagram Reels', instagram_explore: 'Instagram Explore', instagram_explore_grid_home: 'Instagram Explore', instagram_profile_feed: 'Instagram profile',
      facebook_stories: 'Facebook Stories', facebook_mobile_reels: 'Facebook Reels', facebook_reels: 'Facebook Reels', facebook_marketplace: 'Facebook Marketplace',
      facebook_right_column: 'Facebook right column', facebook_instream_video: 'Facebook in-stream video', facebook_search: 'Facebook search results',
      messenger_inbox: 'Messenger inbox', messenger_stories: 'Messenger Stories', threads_feed: 'Threads feed', others: 'other placements', an_classic: 'Audience Network apps' };
    if (fixed[k]) return fixed[k];
    if (/^(facebook|instagram|messenger|threads|whatsapp|audience_network|an)_/.test(k)) {
      var w = k.replace(/^an_/, 'audience_network_').split('_').filter(function (x) { return x && x !== 'mobile'; });
      var brand = { facebook: 'Facebook', instagram: 'Instagram', messenger: 'Messenger', threads: 'Threads', whatsapp: 'WhatsApp', audience: 'Audience Network' }[w[0]] || w[0];
      return (brand + ' ' + w.slice(w[0] === 'audience' ? 2 : 1).join(' ')).trim().slice(0, 40);
    }
    return '';
  }
  function classifyTraffic(o) {
    o = o || {};
    var ref = String(o.ref || '').toLowerCase().trim().replace(/^www\./, ''), usRaw = String(o.us || '').trim(), us = usRaw.toLowerCase(), um = String(o.um || '').toLowerCase().trim(), k = o.click || {};
    var AI = /^(chatgpt\.com|chat\.openai\.com|openai\.com|perplexity\.ai|claude\.ai|gemini\.google\.com|bard\.google\.com|copilot\.microsoft\.com|copilot\.com|you\.com|meta\.ai|poe\.com|chat\.deepseek\.com|deepseek\.com|grok\.com|phind\.com|chat\.mistral\.ai)$/;
    var AI_SRC = /^(chatgpt|openai|perplexity|claude|gemini|copilot|deepseek|grok|meta\.ai)/;
    var MAIL = /^(mail\.google\.com|com\.google\.android\.gm|inbox\.google\.com|outlook\.(live|office|office365)\.com|mail\.yahoo\.com|mail\.proton\.me|mail\.zoho\.(com|in)|mail\.aol\.com|mail\.rediff\.com|webmail\..+)$/;
    var SEARCH = /^((m|www)\.)?google\.[a-z]{2,3}(\.[a-z]{2})?$|^(com\.google\.android\.googlequicksearchbox|googlequicksearchbox)$|^(cn\.)?bing\.com$|^([a-z]{2}\.)?search\.yahoo\.com$|^yahoo\.co\.jp$|^((html|lite)\.)?duckduckgo\.com$|^yandex\.[a-z.]+$|^baidu\.com$|^ecosia\.org$|^search\.brave\.com$|^startpage\.com$|^qwant\.com$|^(search\.)?naver\.com$|^seznam\.cz$|^sogou\.com$|^so\.com$|^ask\.com$|^search\.aol\.com$|^kagi\.com$/;
    var SOCIAL = /(^|\.)(facebook\.com|fb\.com|fb\.me|messenger\.com|instagram\.com|linkedin\.com|lnkd\.in|t\.co|twitter\.com|x\.com|youtube\.com|youtu\.be|pinterest\.[a-z.]+|pin\.it|reddit\.com|redd\.it|quora\.com|threads\.net|threads\.com|whatsapp\.com|wa\.me|telegram\.org|t\.me|snapchat\.com|tiktok\.com|tumblr\.com|discord\.com|discord\.gg|sharechat\.com|bsky\.app|mastodon\.social|vk\.com|weibo\.com|medium\.com|behance\.net|dribbble\.com)$|^(com\.(linkedin\.android|instagram\.android|facebook\.(katana|orca|lite)|twitter\.android|google\.android\.youtube|whatsapp|reddit\.frontpage|pinterest|snapchat\.android|zhiliaoapp\.musically)|org\.telegram\.messenger)$/;
    var SOC_SRC = /^(facebook|fb|instagram|ig|insta|an|msg|messenger|th|linkedin|lnkd|li|twitter|x|youtube|yt|pinterest|reddit|quora|threads|whatsapp|wa|telegram|tg|snapchat|tiktok|meta|discord|bluesky|tumblr|sharechat)([-_. ].*)?$/;
    var META_SRC = /^(facebook|fb|instagram|ig|insta|an|msg|messenger|wa|whatsapp|th|threads|meta)$/;
    var SEARCH_SRC = /^(google|bing|yahoo|duckduckgo|ddg|yandex|baidu|ecosia|brave|naver|msn|microsoft|adwords|googleads|google[-_ ]?ads|bing[-_ ]?ads|microsoft[-_ ]?ads)$/;
    var PAID = /^(cpc|ppc|paid|paidsearch|paid[-_ ]?search|sem|cpm|cpv|cpa|retargeting|remarketing|display|paid[-_ ].*)$|cp[cmva]/;
    var SOC_MED = /^(social|social[-_ ]?media|social[-_ ]?network|sm|soc|organic[-_ ]?social|paid[-_ ]?social|social[-_ ]?paid|social[-_ ]?ads?)$/;
    var MAIL_MED = /^(e[-_ ]?mail|newsletter|mail|edm|mailer)$/;
    var PUSH_MED = /^(push|web[-_ ]?push|notification|notifications|browser[-_ ]?push)$/;
    var REF_MED = /^(referral|affiliate|affiliates|partner|partners|link|links|backlink)$/;
    var macro = /^\{\{.*\}\}$/.test(usRaw);
    var sn = macro ? 'Meta (platform not passed)' : (NMX_SRC[us] || (us ? nmxHostName(us) : ''));
    var pl = nmxPlacement(o.ut) || nmxPlacement(o.ct);
    function out(c, parts) { return { c: c, d: parts.filter(function (x) { return !!x; }).join(' · ').slice(0, 80), sn: (parts[0] || '').slice(0, 60), pl: pl }; }
    var paidSoc = /paid|ads?$|cp[cmva]/.test(um);
    if (k.g || k.m) return out('Paid Search', [us ? sn : (k.m ? 'Bing' : 'Google'), k.m && !us ? 'Microsoft Ads' : (us && !SEARCH_SRC.test(us) ? 'paid' : 'Google Ads')]);
    if (us || um) {
      if (AI_SRC.test(us) || AI.test(us.replace(/^www\./, ''))) return out('Referral', ['AI answer', NMX_SRC[us.split('.')[0]] || nmxHostName(us)]);
      if (us === 'pwa') return out('Direct', ['Installed app (home-screen icon)']);
      var social = macro || SOC_SRC.test(us) || SOCIAL.test(us), search = SEARCH_SRC.test(us) || SEARCH.test(us), paid = PAID.test(um);
      if (paid && (search || /search/.test(um))) return out('Paid Search', [sn, /^(google|googleads|adwords)/.test(us) ? 'Google Ads' : /^(bing|microsoft)/.test(us) ? 'Microsoft Ads' : 'paid search']);
      if (SOC_MED.test(um) || social) {
        if (macro) return out('Social', ['Meta ads', 'platform not passed', pl]);
        return out('Social', [sn, paidSoc ? (META_SRC.test(us) ? 'Meta ads' : 'paid ad') : (um ? 'organic post' : ''), pl]);
      }
      if (um === 'organic' || (search && !paid)) return out('Organic Search', [sn || 'Search', 'organic']);
      if (MAIL_MED.test(um) || us === 'newsletter') return out('Referral', [us === 'newsletter' || !us ? 'Email newsletter' : sn, us === 'newsletter' ? '' : 'email']);
      if (PUSH_MED.test(um)) return out('Referral', ['Browser notification', us && us !== 'push' ? sn : '']);
      if (REF_MED.test(um)) return out('Referral', [sn, 'link']);
      return out('Unknown', [sn || 'Tagged link', um]);
    }
    if (k.f) return out('Social', [ref ? nmxHostName(ref) : 'Facebook or Instagram', 'link with a Meta click ID']);
    if (k.s) return out('Social', [ref ? nmxHostName(ref) : (NMX_SRC[String(k.s)] || String(k.s)), 'link with a click ID']);
    if (ref) {
      if (AI.test(ref)) return out('Referral', ['AI answer', nmxHostName(ref)]);
      if (MAIL.test(ref)) return out('Referral', ['Email', nmxHostName(ref)]);
      if (SEARCH.test(ref)) return out('Organic Search', [nmxHostName(ref)]);
      if (SOCIAL.test(ref)) return out('Social', [nmxHostName(ref), 'organic post or profile link']);
      return out('Referral', [nmxHostName(ref)]);
    }
    if (o.app) {
      var A = { instagram: 'Instagram app (bio link, story or DM)', facebook: 'Facebook app (post, story or Messenger)', linkedin: 'LinkedIn app', snapchat: 'Snapchat app',
        pinterest: 'Pinterest app', tiktok: 'TikTok app', x: 'X (Twitter) app', gmail: 'Gmail app', 'google app': 'Google app (Search or Discover)' }[String(o.app).toLowerCase()];
      return out('Social', [A || String(o.app) + ' app']);
    }
    if (o.internal) return out('Unknown', ['Inside the site (an earlier visit timed out)']);
    return out('Direct', ['']);
  }
  // Older rows were saved with short codes ("an / paid_social", "google.com", "instagram app"). This turns them into the new names.
  function relabelTraffic(c, d) {
    d = String(d || ''); c = String(c || '');
    if (!d || /^(Inside the site|Installed app|Email newsletter|Browser notification|Meta ads · )/.test(d)) return d;
    var m = /^(.+?) \/ (.+)$/.exec(d);
    if (m) return classifyTraffic({ us: m[1], um: m[2] }).d || d;
    var a = /^(AI answer|email) · (.+)$/.exec(d);
    if (a) return (a[1] === 'email' ? 'Email' : 'AI answer') + ' · ' + nmxHostName(a[2]);
    if (d === 'came from another page of the site') return 'Inside the site (an earlier visit timed out)';
    if (d === 'facebook / instagram') return 'Facebook or Instagram · link with a Meta click ID';
    var app = /^(\w[\w ]*) app$/.exec(d);
    if (app) return classifyTraffic({ app: app[1] }).d;
    if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(d)) { var n = nmxHostName(d); return n === d ? d : n + (c === 'Social' ? ' · organic post or profile link' : ''); }
    return d;
  }
  var CFG, KEY = '', RAW = null, STATS = null, MODEL = null, liveTimer = null;
  var F = { period: '30', dev: '', br: '', co: '', src: '', sec: '', topic: '', ts: '', ch: '', from: '', to: '' };
  var TS = ['Organic Search', 'Paid Search', 'Social', 'Direct', 'Referral', 'Unknown'];
  var TS_COLOR = { 'Organic Search': '#7f9471', 'Paid Search': '#ffc530', 'Social': '#ff5a2b', 'Direct': '#111110', 'Referral': '#8aa7d6', 'Unknown': '#c9c4b8' };
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
    var RG = range(now), len = RG.len, start = RG.start, end = RG.end, prevStart = start - len * DAY;   // v10: custom ranges
    var days = []; for (var t = start; t <= end; t += DAY) days.push(dk(t));
    var zero = function () { var o = {}; days.forEach(function (x) { o[x] = 0; }); return o; };
    var bump = function (o, k) { k = String(k == null ? '' : k).trim() || 'Unknown'; o[k] = (o[k] || 0) + 1; };
    var top = function (o, n) { return Object.keys(o).map(function (k) { return [k, o[k]]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, n || 8); };

    // A session's source = its first page view's UTM source, or else its referrer.
    var sesSrc = {};
    RAW.visits.forEach(function (r) { if (D(r[1]) === 'pageview' && !(r[3] in sesSrc)) sesSrc[r[3]] = D(r[6]) || D(r[5]) || 'Direct / none'; });
    function srcOf(r) { return sesSrc[r[3]] || D(r[6]) || 'Direct / none'; }
    // v7: a visit's traffic source is the class of its first page view (backends before v7 send none: "Unknown").
    var sesTs = {};
    RAW.visits.forEach(function (r) { if (D(r[1]) === 'pageview' && !(r[3] in sesTs)) sesTs[r[3]] = [D(r[14]) || 'Unknown', D(r[15])]; });
    function tsOf(r) { return (sesTs[r[3]] || [D(r[14]) || 'Unknown'])[0]; }
    function tsDetOf(r) { return relabelTraffic(tsOf(r), (sesTs[r[3]] || [0, D(r[15])])[1]); }   // v9: plain-English source names, old rows too
    indexRaw(); var SX = RAW._s;                                                                  // v10: channels and readers
    function chOf(r) { var x = SX[r[3]]; return x ? x.ch || '' : ''; }
    var CHS = {}; CH.forEach(function (c) { CHS[c[0]] = { ses: {}, prev: {}, people: {}, days: zero() }; });
    var RD_P = {};
    function visitOk(r, skipCh) {
      return !(F.dev && D(r[9]) !== F.dev) && !(F.br && D(r[10]) !== F.br) && !(F.co && D(r[12]) !== F.co) &&
        !(F.src && srcOf(r) !== F.src) && !(F.sec && section(D(r[4])) !== F.sec) && !(F.ts && tsOf(r) !== F.ts) && (skipCh || !(F.ch && chOf(r) !== F.ch));
    }
    function subOk(r) {
      return !(F.dev && D(r[6]) !== F.dev) && !(F.br && D(r[4]) !== F.br) && !(F.co && D(r[7]) !== F.co) &&
        !(F.src && (D(r[9]) || 'Direct / none') !== F.src) && !(F.sec && section(D(r[8])) !== F.sec) && !(F.topic && D(r[3]).split(',').indexOf(F.topic) < 0) &&
        !(F.ts && (D(r[14]) || 'Unknown') !== F.ts);
    }

    var V = { views: zero(), people: zero(), uniq: {}, ses: {}, pv: 0, prevPv: 0, prevUniq: {}, pages: {}, refs: {}, utm: {}, dev: {}, co: {}, heat: [], firstSeen: {}, ts: {}, tsDet: {} };
    for (var h = 0; h < 7; h++) V.heat.push([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    var dayPeople = {}, ev = {}, evDetail = [], clicks = {}, taps = 0, prevTaps = 0;
    var school = { learnViews: 0, playViews: 0, lessons: {}, quiz: 0, quizScore: 0, quizMax: 0, games: {}, done: 0 };
    RAW.visits.forEach(function (r) {
      var ms = r[0] * 1000, type = D(r[1]), vid = D(r[2]);
      if (vid && !(vid in V.firstSeen)) V.firstSeen[vid] = ms;
      if (type === 'push_click') { var c = D(r[13]); clicks[c] = (clicks[c] || 0) + 1; if (ms >= start && ms <= end) taps++; else if (ms >= prevStart && ms < start) prevTaps++; return; }
      if (type === 'pageview' && ms >= prevStart && ms <= end && visitOk(r, true)) {                // v10: channel cards ignore their own filter
        var cc = chOf(r); if (cc) { var cs = CHS[cc]; if (ms < start) cs.prev[r[3]] = 1; else { if (!cs.ses[r[3]]) { cs.ses[r[3]] = 1; var cd = dk(ms); if (cd in cs.days) cs.days[cd]++; } cs.people[r[2]] = 1; } }
      }
      if (!visitOk(r)) return;
      if (ms < start) { if (ms >= prevStart && type === 'pageview') { V.prevPv++; if (vid) V.prevUniq[vid] = 1; } return; }
      if (ms > end) return;
      if (type === 'pageview') {
        var day = dk(ms), p = D(r[4]); V.pv++; if (day in V.views) V.views[day]++;
        if (vid && D(r[3])) { var rp = RD_P[r[2]] || (RD_P[r[2]] = { ses: {}, days: {}, pv: 0, last: 0, r: r }); rp.ses[r[3]] = 1; rp.days[day] = 1; rp.pv++; if (r[0] >= rp.last) { rp.last = r[0]; rp.r = r; } }
        if (vid) { if (!(vid in V.uniq)) { V.uniq[vid] = 1; bump(V.dev, D(r[9])); bump(V.co, D(r[12])); } dayPeople[day + '|' + vid] = day; }
        if (D(r[3]) && !V.ses[D(r[3])]) { var tc = tsOf(r); V.ts[tc] = (V.ts[tc] || 0) + 1; if (!F.ts || F.ts === tc) bump(V.tsDet, (F.ts ? '' : tc + ' · ') + (tsDetOf(r) || (tc === 'Direct' ? 'typed, bookmarked or shared in an app' : 'not recorded'))); }
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
    var P = { active: 0, gained: zero(), lost: zero(), newIn: 0, prevNew: 0, lostIn: 0, br: {}, dev: {}, co: {}, blog: 0, yt: 0, withEmail: 0, installed: 0, ts: {} };
    var subs = RAW.push.filter(subOk);
    subs.forEach(function (r) {
      var st = D(r[2]), sub = r[0] * 1000, upd = r[1] * 1000;
      if (st === 'Active') {
        P.active++; bump(P.br, D(r[4])); bump(P.dev, D(r[6]) + ' · ' + D(r[5])); bump(P.co, D(r[7])); bump(P.ts, D(r[14]) || 'Unknown');
        D(r[3]).split(',').forEach(function (x) { if (x === 'blog') P.blog++; if (x === 'youtube') P.yt++; });
        if (D(r[10])) P.withEmail++; if (r[11]) P.installed++;
      }
      if (sub >= start && sub <= end) { P.newIn++; var g = dk(sub); if (g in P.gained) P.gained[g]++; } else if (sub >= prevStart && sub < start) P.prevNew++;
      if (st !== 'Active' && upd >= start && upd <= end) { P.lostIn++; var l = dk(upd); if (l in P.lost) P.lost[l]++; }
    });
    var recent = subs.slice().sort(function (a, b) { return b[0] - a[0]; }).slice(0, 15).map(function (r) {
      return { at: r[0], status: D(r[2]), topics: D(r[3]), browser: D(r[4]), os: D(r[5]), device: D(r[6]), country: D(r[7]), page: D(r[8]),
        source: (D(r[14]) ? D(r[14]) + (D(r[15]) ? ' · ' + relabelTraffic(D(r[14]), D(r[15])) : '') : D(r[9])), email: D(r[10]), received: r[12] };
    });

    var camps = RAW.campaigns.filter(function (c) { var ct = Date.parse(c.at); return ct >= start && ct <= end; }), delivered = 0;
    camps.forEach(function (c) { if (c.type !== 'test') delivered += Number(c.delivered || 0); });
    var emailActive = RAW.email.filter(function (r) { return r[1]; }).length, emailNew = RAW.email.filter(function (r) { return r[1] && r[0] * 1000 >= start && r[0] * 1000 <= end; }).length;
    var uniq = Object.keys(V.uniq).length, sesN = Object.keys(V.ses).length;
    var emTs = {}; RAW.email.forEach(function (r) { if (r[1] && (!F.ts || D(r[3]) === F.ts)) bump(emTs, D(r[3]) || 'Unknown'); });
    var chOut = {};                                                                               // v10: channels and readers
    CH.forEach(function (c) {
      var cs = CHS[c[0]], sids = Object.keys(cs.ses), secs = 0, paid = 0, subs = 0;
      sids.forEach(function (x) { var q = SX[x]; secs += sesTime(q); if (q && q.paid) paid++; if (q && q.sub) subs++; });
      chOut[c[0]] = { ses: sids.length, prev: Object.keys(cs.prev).length, people: Object.keys(cs.people).length, secs: secs, paid: paid, subs: subs, days: days.map(function (x) { return cs.days[x]; }) };
    });
    var readers = Object.keys(RD_P).map(function (k) {
      var p = RD_P[k], j = RAW._j[k] || { ses: [], subs: [] }, sids = Object.keys(p.ses), secs = 0, types = {};
      sids.forEach(function (x) { secs += sesTime(SX[x]); });
      (j.subs || []).forEach(function (i) { types[D(RAW.visits[i][1])] = 1; });
      var f = SX[j.ses[0]] || {};
      return { vid: Number(k), id: D(k), visits: sids.length, days: Object.keys(p.days).length, pv: p.pv, secs: secs, last: p.last, co: D(p.r[12]), dev: D(p.r[9]), br: D(p.r[10]),
        src: f.td || f.tc || 'Direct', every: every(j),
        sub: types.push_subscribe && types.email_subscribe ? 'Notifications + email' : types.push_subscribe ? 'Notifications' : types.email_subscribe ? 'Email' : '' };
    }).sort(function (a, b) { return b.visits - a.visits || b.last - a.last; });
    var tsRows = function (o) { var tot = 0; TS.forEach(function (k) { tot += o[k] || 0; }); return TS.map(function (k) { return [k + (tot ? ' · ' + Math.round((o[k] || 0) / tot * 100) + '%' : ''), o[k] || 0]; }); };
    return {
      compat: false, days: days, ch: chOut, readers: readers, prevLabel: len === 1 ? 'day' : len + ' days',
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
        vPages: top(V.pages, 10), vRefs: top(V.refs), vUtm: top(V.utm), vDevice: top(V.dev, 5), vCountry: top(V.co),
        tsVisits: tsRows(V.ts), tsDetail: top(V.tsDet, 10), tsSubs: tsRows(P.ts), tsEmail: tsRows(emTs) },
      ts: V.ts, tsTotal: sesN,
      recent: recent, recentSub: num(P.withEmail) + ' of ' + num(P.active) + ' active subscribers are also on the email list; ' + num(P.installed) + ' installed the app.',
      asks: ev.ask || 0, active: P.active
    };
  }

  // v4 backend: the same view from its 30-day summary (no filters; 7 or 30 days).
  function modelFromStats(s) {
    var len = F.period === '7' ? 7 : 30, cut = 30 - len, sl = function (a) { return (a || []).slice(cut); };
    var p = s.push, v = s.visitors, f = v.funnel;
    return {
      compat: true, days: s.days.slice(cut), ch: null, readers: null,
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
        vPages: v.pages, vRefs: v.refs, vUtm: v.utm, vDevice: v.device, vCountry: v.country, tsVisits: [], tsDetail: [], tsSubs: [], tsEmail: [] }, ts: {}, tsTotal: 0,
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
        if (b) { var ch = Math.round((a - b) / b * 100); d = '<em class="' + (ch >= 0 ? 'up' : 'down') + '" title="vs the previous ' + (m.prevLabel || 'period') + '">' + (ch >= 0 ? '▲' : '▼') + Math.abs(ch) + '%</em>'; }
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
  var FILTER_OF = { pBrowser: 'br', pCountry: 'co', vDevice: 'dev', vCountry: 'co', vRefs: 'src', pTopics: 'topic', vPages: 'sec', tsVisits: 'ts', tsSubs: 'ts', tsEmail: 'ts' };
  function bars(id, rows, total) {
    var el = $(id);
    if (!rows || !rows.some(function (r) { return r[1]; })) { el.innerHTML = '<li class="ad-empty">Nothing in this view yet.</li>'; return; }
    var max = total || Math.max.apply(null, rows.map(function (r) { return r[1]; })), fk = MODEL.compat ? '' : FILTER_OF[id] || '';
    el.innerHTML = rows.map(function (r) {
      var val = fk === 'topic' ? (/YouTube/.test(r[0]) ? 'youtube' : 'blog') : fk === 'sec' ? section(r[0]) : fk === 'ts' ? r[0].split(' · ')[0] : r[0], sel = fk && F[fk] === val;
      return '<li class="' + (fk ? 'click' : '') + (sel ? ' sel' : '') + '"' + (fk ? ' data-fk="' + fk + '" data-fv="' + esc(val) + '" title="' + (sel ? 'Clear this filter' : 'Show only ' + esc(fk === 'sec' ? val + ' pages' : val)) + '"' : '') +
        '><span title="' + esc(r[0]) + '">' + (fk === 'ts' ? '<i class="ad-tsdot" style="background:' + (TS_COLOR[val] || '#c9c4b8') + '"></i>' : '') + esc(r[0]) + '</span><em>' + num(r[1]) + '</em><i><b data-w="' + Math.max(2, Math.round(r[1] / max * 100)) + '"></b></i></li>';
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
    var compat = !RAW, opts = { dev: ['All devices'], br: ['All browsers'], co: ['All countries'], src: ['All referrers'], sec: ['All sections'], topic: ['All topics', 'blog', 'youtube'], ts: ['All traffic sources'].concat(TS) };
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
    $('reset').hidden = !['dev', 'br', 'co', 'src', 'sec', 'topic', 'ts', 'ch'].some(function (k) { return F[k]; });
    var today = dk(Date.now()), oldest = dk(Date.now() - ((RAW ? RAW.days : 30) - 1) * DAY);
    $('range').hidden = F.period !== 'custom';
    ['rFrom', 'rTo'].forEach(function (id) { var el = $(id); el.min = oldest; el.max = today; el.value = id === 'rFrom' ? F.from : F.to; });
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
    trafficHead(MODEL); drawChannels(MODEL); drawReaders(MODEL);
    $('recentSub').textContent = MODEL.recentSub;
    $('recent').innerHTML = MODEL.recent.length ? MODEL.recent.map(function (r) {
      return '<tr><td>' + when(r.at) + '</td><td>' + esc(r.status) + '</td><td>' + esc(r.topics) + '</td><td>' + esc(r.browser) + '</td><td>' + esc(r.device) + ' · ' + esc(r.os) + '</td><td>' + esc(r.country) + '</td><td>' + esc(r.page) + '</td><td>' + esc(r.source) + '</td><td>' + esc(r.email) + '</td><td class="n">' + num(r.received) + '</td></tr>';
    }).join('') : '<tr><td colspan="10" class="ad-empty">No subscribers match this view.</td></tr>';
    $('askSub').textContent = num(MODEL.asks) + ' questions in this view; the AI-answered ones are listed here, the rest are in the Visitors tab.';
  }
  function trafficHead(m) {
    var tot = 0; TS.forEach(function (k) { tot += m.ts[k] || 0; });
    $('tsStack').innerHTML = TS.map(function (k) { return '<span title="' + esc(k) + ': ' + num(m.ts[k] || 0) + '" style="flex-grow:' + (m.ts[k] || 0) + ';background:' + TS_COLOR[k] + '"></span>'; }).join('');
    $('tsSub').textContent = m.compat ? 'Shows up once Code-Blog.gs v7 is deployed.' : num(tot) + ' visits in this view, each counted once under the source it arrived from.';
    $('tsDetailH').textContent = F.ts ? 'Inside ' + F.ts : 'Top sources';
    $('tsDetailSub').textContent = F.ts ? 'Sites, campaigns and apps behind ' + F.ts + ' in this view. Tap it again on the left to see everything.' : 'The busiest sources across all classes. Tap a class on the left to look inside it.';
  }
  function renderStatic(d) {
    $('updated').textContent = 'Updated ' + when(d.updated) + ' · backend ' + d.version + (RAW ? ' · ' + num(RAW.visits.length) + ' visitor events from the last ' + RAW.days + ' days' : '');
    $('sheet').href = d.setup.sheet;
    var vapid = /^[A-Za-z0-9_-]{80,100}$/.test(String(CFG.VAPID_PUBLIC_KEY || ''));
    var checks = [
      [Number(String(d.version).slice(1)) >= 7, 'Apps Script backend is <code>v7</code> (paste Code-Blog.gs v7, then Deploy > Manage deployments > pencil > Version: New version > Deploy)'],
      [vapid, 'Public VAPID key pasted into <code>VAPID_PUBLIC_KEY</code> in /assets/nmx.js'],
      [d.setup.github, 'GitHub connected: <code>GITHUB_REPO</code> and <code>GITHUB_TOKEN</code> in Script properties' + (d.setup.repo ? ' (' + esc(d.setup.repo) + ')' : '')],
      [!!d.setup.youtube, 'YouTube channel for new-video notifications: <code>YOUTUBE_CHANNEL_ID</code> (optional)'],
      [d.setup.gemini, 'Gemini key for open questions in the assistant: <code>GEMINI_API_KEY</code> (optional)']
    ];
    $('setup').hidden = checks.every(function (c) { return c[0]; });
    $('checks').innerHTML = checks.map(function (c) { return '<li class="' + (c[0] ? 'ok' : '') + '">' + c[1] + '</li>'; }).join('');
    var leads = d.leads || [], asks = d.asks || [];
    $('leads').innerHTML = leads.length ? leads.map(function (l) { return '<tr><td>' + when(l.at) + '</td><td>' + esc(l.name) + '</td><td>' + esc(l.contact) + '</td><td>' + esc(l.message) + '</td><td>' + esc(l.source || 'Unknown') + (l.sourceDetail ? '<br><small style="color:var(--muted)">' + esc(l.sourceDetail) + '</small>' : '') + '</td></tr>'; }).join('') : '<tr><td colspan="5" class="ad-empty">No leads yet.</td></tr>';
    $('asks').innerHTML = asks.length ? asks.map(function (a) { return '<tr><td>' + when(a.at) + '</td><td>' + esc(a.q) + '</td><td>' + esc(a.page) + '</td></tr>'; }).join('') : '<tr><td colspan="3" class="ad-empty">No questions yet.</td></tr>';
  }


  /* ---------------- v10: date range, channels and reader journeys ---------------- */
  // The period: Today / 7 / 30 / 90 days / All, or a custom From–To range (India dates, within the 120 days the Sheet keeps).
  function range(now) {
    if (F.period === 'custom' && F.from && F.to) {
      var a = Date.parse(F.from + 'T00:00:00+05:30'), z = Date.parse(F.to + 'T00:00:00+05:30');
      if (z < a) { var x = a; a = z; z = x; }
      return { start: a, end: Math.min(now, z + DAY - 1), len: Math.round((z - a) / DAY) + 1 };
    }
    var len = F.period === 'today' ? 1 : F.period === 'all' ? RAW.days : (Number(F.period) || 30);
    return { start: istMidnight(now) - (len - 1) * DAY, end: now, len: len };
  }
  // The five channels shown as cards. Instagram and Facebook include Meta ads (counted separately as "from ads").
  var CH = [['instagram', 'Instagram', 'camera', '#a689f5', '#6b46d6'], ['google', 'Google Search', 'search', '#93a986', '#62785a'],
    ['facebook', 'Facebook', 'people', '#5fc6ba', '#2a8a80'], ['pinterest', 'Pinterest', 'pin', '#ffdb6e', '#ffb21a'], ['linkedin', 'LinkedIn', 'briefcase', '#78a3ea', '#3d68c2']];
  // v14: use the actual monochrome brand marks from /assets/icons/brand/ for social channel cards.
  var GLYPH = {"camera": "<path fill=\"currentColor\" stroke=\"none\" d=\"M9.1 4.3h5.8a1.3 1.3 0 0 1 1.1.6L17.3 7H6.7l1.3-2.1a1.3 1.3 0 0 1 1.1-.6z\"/><path fill=\"currentColor\" stroke=\"none\" fill-rule=\"evenodd\" d=\"M6.5 6.6h11a4 4 0 0 1 4 4v6a4 4 0 0 1 -4 4h-11a4 4 0 0 1 -4 -4v-6a4 4 0 0 1 4 -4zM7.5 13.6a4.5 4.5 0 1 0 9 0a4.5 4.5 0 1 0 -9 0zM9.4 13.6a2.6 2.6 0 1 0 5.2 0a2.6 2.6 0 1 0 -5.2 0zM16.95 10.1a1.05 1.05 0 1 0 2.1 0a1.05 1.05 0 1 0 -2.1 0z\"/>", "search": "<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2.4\" d=\"M4 10.6a6.6 6.6 0 1 0 13.2 0a6.6 6.6 0 1 0 -13.2 0z\"/><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2.8\" d=\"M15.6 15.6 20.6 20.6\"/>", "people": "<path fill=\"currentColor\" stroke=\"none\" d=\"M5.4 8a3.6 3.6 0 1 0 7.2 0a3.6 3.6 0 1 0 -7.2 0z\"/><path fill=\"currentColor\" stroke=\"none\" d=\"M2.6 19.6c0-3.7 2.9-6.4 6.4-6.4s6.4 2.7 6.4 6.4a.9.9 0 0 1-.9.9H3.5a.9.9 0 0 1-.9-.9z\"/><path fill=\"currentColor\" stroke=\"none\" d=\"M14.1 8.9a2.8 2.8 0 1 0 5.6 0a2.8 2.8 0 1 0 -5.6 0z\"/><path fill=\"currentColor\" stroke=\"none\" d=\"M16.2 13.6c3 0 5.2 2.2 5.2 5.4a.9.9 0 0 1-.9.9h-3.3c0-2.5-.8-4.6-2.3-6.1.4-.1.8-.2 1.3-.2z\"/>", "pin": "<path fill=\"currentColor\" stroke=\"none\" d=\"M8.3 3.4h7.4a1.1 1.1 0 0 1 .9 1.7l-1.5 2.4v3.2l3 2.9a1.1 1.1 0 0 1-.8 1.9H6.7a1.1 1.1 0 0 1-.8-1.9l3-2.9V7.5L7.4 5.1a1.1 1.1 0 0 1 .9-1.7z\"/><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2.3\" d=\"M12 15.6v5.4\"/>", "briefcase": "<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2.1\" d=\"M8.9 6.9V5.6a1.8 1.8 0 0 1 1.8-1.8h2.6a1.8 1.8 0 0 1 1.8 1.8v1.3\"/><path fill=\"currentColor\" stroke=\"none\" fill-rule=\"evenodd\" d=\"M5.7 6.8h12.6a3.2 3.2 0 0 1 3.2 3.2v7.2a3.2 3.2 0 0 1 -3.2 3.2h-12.6a3.2 3.2 0 0 1 -3.2 -3.2v-7.2a3.2 3.2 0 0 1 3.2 -3.2zM2.5 11.9h19v1.5h-19z\"/><path fill=\"currentColor\" stroke=\"none\" d=\"M11.1 10.9h1.8a0.9 0.9 0 0 1 0.9 0.9v1.7a0.9 0.9 0 0 1 -0.9 0.9h-1.8a0.9 0.9 0 0 1 -0.9 -0.9v-1.7a0.9 0.9 0 0 1 0.9 -0.9z\"/>"};
  var BRANDS = ['instagram', 'facebook', 'pinterest', 'linkedin']; // Google Search intentionally remains a search glyph.
  function chTile(c) {
    var face = BRANDS.indexOf(c[0]) > -1 ? '<i class="ad-bm" style="--bm:url(/assets/icons/brand/' + c[0] + '.svg)"></i>' : '<svg class="nx-f" viewBox="0 0 24 24">' + GLYPH[c[2]] + '</svg>';
    return '<span class="ad-app ad-app--' + c[0] + '" aria-hidden="true">' + face + '</span>';   // v11.1: flat tile, colours in index.html
  }
  function channelOf(tc, td, br) {
    td = String(td || ''); br = String(br || '');
    var meta = /^Facebook or Instagram/.test(td);
    if (/^Instagram/.test(td) || (meta && /^Instagram/.test(br))) return 'instagram';
    if ((/^Facebook/.test(td) && !meta) || (meta && /^Facebook/.test(br))) return 'facebook';
    if (/^Pinterest/.test(td)) return 'pinterest';
    if (/^LinkedIn/.test(td)) return 'linkedin';
    if (tc === 'Organic Search' && /^Google/.test(td)) return 'google';
    return '';
  }
  // One pass over every row, once per load: visits (sessions) and readers (visitor IDs), across all the data.
  function indexRaw() {
    if (RAW._s) return;
    var d = RAW.dict, D = function (i) { return d[i] || ''; }, S = {}, J = {};
    RAW.visits.forEach(function (r, i) {
      var t = D(r[1]), sid = r[3], vid = r[2];
      if (D(sid)) {
        var s = S[sid] || (S[sid] = { a: r[0], b: r[0], secs: 0, sub: 0, pv: 0 });
        if (r[0] < s.a) s.a = r[0]; if (r[0] > s.b) s.b = r[0];
        if (t === 'pageview') {
          s.pv++;
          if (!s.page) { s.page = D(r[4]); s.tc = D(r[14]) || 'Unknown'; s.td = relabelTraffic(s.tc, D(r[15])); s.br = D(r[10]); s.ch = channelOf(s.tc, s.td, s.br); s.paid = /Meta ads|paid|Google Ads|Microsoft Ads/.test(s.td); }
        } else if (t === 'page_end') s.secs += parseInt(D(r[13]), 10) || 0;
        else if (t === 'push_subscribe' || (t === 'email_subscribe' && !/^already/.test(D(r[13])))) s.sub = 1;
      }
      if (D(vid)) {
        var j = J[vid] || (J[vid] = { rows: [], ses: [], seen: {}, sub: null, subs: [] });
        j.rows.push(i);
        if (D(sid) && !j.seen[sid]) { j.seen[sid] = 1; j.ses.push(sid); }
        if (t === 'push_subscribe' || (t === 'email_subscribe' && !/^already/.test(D(r[13])))) { j.subs.push(i); if (!j.sub) j.sub = i; }
      }
    });
    RAW._s = S; RAW._j = J;
  }
  function sesTime(s) { return s ? (s.secs || (s.b - s.a)) : 0; }
  function dur(sec) {
    sec = Math.round(sec || 0); if (sec < 60) return sec + 's';
    if (sec < 3600) return Math.floor(sec / 60) + 'm' + (sec % 60 >= 10 ? ' ' + (sec % 60) + 's' : '');
    return Math.floor(sec / 3600) + 'h ' + Math.round(sec % 3600 / 60) + 'm';
  }
  function shortId(v) { return String(v || '').slice(0, 8) || 'unknown'; }
  function every(j) {
    var S = RAW._s, t = j.ses.map(function (s) { return S[s] ? S[s].a : 0; }).filter(Boolean);
    if (t.length < 2) return '';
    var g = (t[t.length - 1] - t[0]) / 86400 / (t.length - 1);
    return g < 1 ? 'more than once a day' : g < 1.5 ? 'about daily' : 'about every ' + Math.round(g) + ' days';
  }

  function drawChannels(m) {
    var box = $('chs'); if (!box) return;
    if (!m.ch) { box.innerHTML = '<p class="ad-empty">Shows up with Code-Blog.gs v5 or later.</p>'; return; }
    var tot = m.tsTotal || 0;
    box.innerHTML = CH.map(function (c) {
      var x = m.ch[c[0]], sel = F.ch === c[0], n = x.ses, prev = x.prev, delta = '';
      if (F.period !== 'all' && prev) { var p = Math.round((n - prev) / prev * 100); delta = '<em class="' + (p >= 0 ? 'up' : 'down') + '">' + (p >= 0 ? '▲' : '▼') + Math.abs(p) + '%</em>'; }
      else if (F.period !== 'all' && n) delta = '<em class="up">new</em>';
      var max = Math.max(1, Math.max.apply(null, x.days)), w = 120, h = 26, k = x.days.length;
      var pts = x.days.map(function (v, i) { return (k > 1 ? i * w / (k - 1) : w / 2).toFixed(1) + ',' + (h - 2 - v / max * (h - 4)).toFixed(1); }).join(' ');
      return '<button type="button" class="ad-chc' + (sel ? ' sel' : '') + '" data-ch="' + c[0] + '" aria-pressed="' + sel + '" title="' + (sel ? 'Clear this filter' : 'Show only visits from ' + c[1]) + '">' +
        '<span class="ad-chc-top">' + chTile(c) + '<span class="ad-chc-name">' + c[1] + (c[0] === 'google' ? ' <small>organic</small>' : '') + '</span></span>' +
        '<b>' + num(n) + '</b><span class="ad-chc-sub">visits' + delta + '</span>' +
        '<svg class="ad-spark" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" aria-hidden="true"><polyline points="' + pts + '"/></svg>' +
        '<span class="ad-chc-meta">' + num(x.people) + ' people · ' + (tot ? Math.round(n / tot * 100) : 0) + '% of visits<br>' +
        (n ? dur(x.secs / n) + ' a visit' : 'no visits yet') + (x.paid ? ' · ' + num(x.paid) + ' from ads' : '') + (x.subs ? ' · ' + num(x.subs) + ' subscribed' : '') + '</span></button>';
    }).join('');
    $('chSub').textContent = F.ch ? 'Showing only visits from ' + CH.filter(function (c) { return c[0] === F.ch; })[0][1] + '. Tap it again to see everything.'
      : 'Visits that arrived from each channel in this view, against the same length of time before it. Tap one to filter the whole dashboard.';
  }

  var RD = { mode: 'returning', q: '' };
  function drawReaders(m) {
    var body = $('readers'); if (!body) return;
    if (!m.readers) { body.innerHTML = '<tr><td colspan="8" class="ad-empty">Shows up with Code-Blog.gs v5 or later.</td></tr>'; return; }
    var q = RD.q.toLowerCase(), list = m.readers.filter(function (r) {
      if (RD.mode === 'returning' && r.visits < 2) return false;
      if (RD.mode === 'subs' && !r.sub) return false;
      return !q || (r.id + ' ' + r.co + ' ' + r.dev + ' ' + r.br + ' ' + r.src).toLowerCase().indexOf(q) > -1;
    });
    var ret = m.readers.filter(function (r) { return r.visits >= 2; }), subRet = ret.filter(function (r) { return r.sub; }).length, avgV = 0, avgT = 0;
    ret.forEach(function (r) { avgV += r.visits; avgT += r.secs / r.visits; });
    $('rdChips').innerHTML = [[num(ret.length), 'returning readers (2+ visits)'], [m.readers.length ? Math.round(ret.length / m.readers.length * 100) + '%' : '–', 'of readers came back'],
      [ret.length ? (Math.round(avgV / ret.length * 10) / 10) : '–', 'visits each, on average'], [ret.length ? dur(avgT / ret.length) : '–', 'per visit, returning readers'],
      [num(subRet), 'of them subscribed']].map(function (x) { return '<span class="ad-chip"><b>' + x[0] + '</b>' + x[1] + '</span>'; }).join('');
    $('rdSub').textContent = num(list.length) + ' readers in this view' + (list.length > 300 ? ', the 300 most frequent shown' : '') + '. Tap a reader to see their whole journey.';
    body.innerHTML = list.length ? list.slice(0, 300).map(function (r) {
      return '<tr class="ad-rd" data-vid="' + r.vid + '" tabindex="0"><td><b class="ad-rid">' + esc(shortId(r.id)) + '</b><br><small>' + esc([r.dev, r.br, r.co].filter(Boolean).join(' · ')) + '</small></td>' +
        '<td class="n"><b>' + num(r.visits) + '</b>' + (r.every ? '<br><small>' + esc(r.every) + '</small>' : '') + '</td><td class="n">' + num(r.days) + '</td><td class="n">' + dur(r.secs) + '</td><td class="n">' + num(r.pv) + '</td>' +
        '<td>' + esc(r.src) + '</td><td>' + when(r.last) + '</td><td>' + (r.sub ? '<span class="ad-pill ok">' + esc(r.sub) + '</span>' : '<span class="ad-pill">Not yet</span>') + '</td></tr>';
    }).join('') : '<tr><td colspan="8" class="ad-empty">' + (RD.mode === 'returning' ? 'Nobody has come back more than once in this view yet.' : 'No readers match this view.') + '</td></tr>';
  }

  // The journey of one reader, across everything the Sheet still holds (up to 120 days), whatever the period.
  var JLABEL = { prompt_shown: 'Saw the reading pop-up', prompt_yes: 'Tapped to turn on notifications', prompt_later: 'Said “Maybe later”', prompt_dismissed: 'Closed the browser’s permission prompt',
    push_subscribe: 'Turned on notifications', email_subscribe: 'Subscribed by email', push_denied: 'Blocked notifications', push_unsubscribe: 'Turned notifications off',
    follow_open: 'Opened Follow', follow_click: 'Tapped a follow link', share: 'Shared the page', save: 'Saved the post', unsave: 'Removed a saved post', quiz_complete: 'Finished a quiz',
    game_end: 'Finished a game', lesson_done: 'Finished the lesson', ask: 'Asked the assistant', assistant_open: 'Opened the assistant', lead: 'Sent an enquiry',
    endcard_seen: 'Reached the end of the post', push_click: 'Tapped a notification', app_installed: 'Installed the app', app_open: 'Opened the installed app',
    push_check_yes: 'Confirmed notifications arrive', push_check_no: 'Said a test notification didn’t show', push_guide: 'Opened the fix-it steps' };
  var VIA = { read_prompt: 'the coffee pop-up while reading', end_card: 'the “Get the next post” card at the end of a post', follow: 'the Follow button', bell: 'the Follow button',
    custom: 'a Follow link on the page', api: 'a Follow link on the page', social_card: 'the follow pop-up' };
  function evText(t, det) {
    var p = String(det || '').split('|'), name = { whatsapp: 'WhatsApp', linkedin: 'LinkedIn', x: 'X', facebook: 'Facebook', pinterest: 'Pinterest', email: 'email', copy: 'Copy link', device: 'the phone’s share menu', instagram: 'Instagram', youtube: 'YouTube' };
    if (t === 'follow_click') return 'Tapped Follow on ' + (name[p[0]] || p[0]);
    if (t === 'share') return 'Shared it via ' + (name[p[0]] || p[0]);
    if (t === 'prompt_shown') return /social_card/.test(p[0]) ? 'Saw the follow pop-up' : 'Saw the reading pop-up';
    if (t === 'push_subscribe') return 'Turned on notifications' + (p[1] ? ' from ' + (VIA[p[1]] || p[1]) : '');
    if (t === 'email_subscribe') return /^already/.test(p[0]) ? 'Entered an email that was already subscribed' : 'Subscribed by email';
    if (t === 'quiz_complete' || t === 'game_end') return (JLABEL[t]) + (p[0] ? ': ' + p[0] : '');
    return JLABEL[t] || t.replace(/_/g, ' ');
  }
  function openJourney(v) {
    indexRaw();
    var d = RAW.dict, D = function (i) { return d[i] || ''; }, j = RAW._j[v], S = RAW._s; if (!j) return;
    var visits = j.ses.map(function (sid, n) { return { n: n + 1, sid: sid, s: S[sid] || {}, items: [] }; }), by = {}, lastPv = {}, latest = null;
    visits.forEach(function (x) { by[x.sid] = x; });
    j.rows.forEach(function (i) {
      var r = RAW.visits[i], t = D(r[1]), x = by[r[3]]; if (!x) return;
      if (t === 'pageview') { var it = { page: D(r[4]), t: r[0], secs: 0, depth: 0 }; x.items.push(it); lastPv[r[3] + '|' + r[4]] = it; latest = r; }
      else if (t === 'page_end') { var pv = lastPv[r[3] + '|' + r[4]], q = D(r[13]).split('|'); if (pv) { pv.secs += parseInt(q[0], 10) || 0; pv.depth = Math.max(pv.depth, parseInt(q[1], 10) || 0); } }
      else x.items.push({ ev: t, det: D(r[13]), t: r[0], i: i });
    });
    var first = RAW.visits[j.rows[0]], who = latest || first;
    var pages = 0, secs = 0; visits.forEach(function (x) { secs += sesTime(x.s); x.items.forEach(function (it) { if (it.page) pages++; }); });
    var span = visits.length ? Math.max(1, Math.round((visits[visits.length - 1].s.a - visits[0].s.a) / 86400) + 1) : 1;
    var h = '<div class="ad-jhead"><span class="ad-avatar" aria-hidden="true">' + esc(shortId(D(v)).slice(0, 2).toUpperCase()) + '</span><div><h2 id="drH">Reader ' + esc(shortId(D(v))) + '</h2>' +
      '<p>' + esc([D(who[9]), D(who[10]), D(who[11]), D(who[12])].filter(Boolean).join(' · ')) + '</p></div></div>';
    h += '<div class="ad-chips">' + [[num(visits.length), visits.length === 1 ? 'visit' : 'visits'], [num(span), span === 1 ? 'day' : 'days, first to last'], [dur(secs), 'on the site'],
      [num(pages), 'pages read'], [visits.length ? dur(secs / visits.length) : '–', 'a visit']].map(function (x) { return '<span class="ad-chip"><b>' + x[0] + '</b>' + x[1] + '</span>'; }).join('') +
      (every(j) ? '<span class="ad-chip"><b>↻</b>comes back ' + esc(every(j)) + '</span>' : '') + '</div>';
    if (j.sub != null) {
      var sr = RAW.visits[j.sub], st = sr[0], sx = by[sr[3]], k = sx ? sx.n : visits.length, how = D(sr[1]) === 'push_subscribe' ? 'browser notifications' : 'email';
      var pb = 0, tb = 0, seen = 0, later = 0, srcs = {};
      visits.forEach(function (x) {
        if (x.n > k) return; if (x.s.td || x.s.tc) srcs[(x.s.td || x.s.tc)] = 1;
        x.items.forEach(function (it) { if (it.t > st) return; if (it.page) { pb++; tb += it.secs; } if (it.ev === 'prompt_shown') seen++; if (it.ev === 'prompt_later') later++; });
      });
      var det = D(sr[13]).split('|'), via = how === 'email' ? 'the email form' : (VIA[det[1]] || det[1] || 'the Follow button');
      h += '<div class="ad-why"><h3>What led to subscribing</h3><ul>' +
        '<li>Subscribed to <b>' + how + '</b> on ' + when(st) + ', from ' + esc(via) + ', on <u>' + esc(D(sr[4])) + '</u>.</li>' +
        '<li>It was visit <b>' + k + '</b>' + (visits.length > k ? ' of ' + visits.length : '') + '. Before that they read <b>' + num(pb) + '</b> page' + (pb === 1 ? '' : 's') + (tb ? ' for <b>' + dur(tb) + '</b>' : '') + '.</li>' +
        '<li>First came from <b>' + esc(visits[0].s.td || visits[0].s.tc || 'Direct') + '</b>' + (visits[0].s.page ? ', landing on <u>' + esc(visits[0].s.page) + '</u>' : '') + '.</li>' +
        (Object.keys(srcs).length > 1 ? '<li>Visits up to then came from: ' + esc(Object.keys(srcs).join(', ')) + '.</li>' : '') +
        (seen ? '<li>Saw the pop-up ' + seen + ' time' + (seen === 1 ? '' : 's') + (later ? ', said “Maybe later” ' + later + ' time' + (later === 1 ? '' : 's') : '') + ' before saying yes.</li>' : '') +
        (j.subs.length > 1 ? '<li>Also subscribed to ' + (how === 'email' ? 'browser notifications' : 'email') + ' later.</li>' : '') + '</ul></div>';
    }
    h += '<ol class="ad-visits">' + visits.map(function (x) {
      var s = x.s, rows = x.items.map(function (it) {
        if (it.page) return '<li><time>' + new Date(it.t * 1000).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) + '</time><a href="' + esc(it.page) + '" target="_blank" rel="noopener">' + esc(it.page) + '</a>' +
          '<em>' + (it.secs ? dur(it.secs) : '–') + (it.depth ? ' · ' + it.depth + '%' : '') + '</em></li>';
        var strong = /subscribe$/.test(it.ev) && it.ev !== 'push_unsubscribe';
        return '<li class="ev' + (strong ? ' sub' : '') + '"><time>' + new Date(it.t * 1000).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) + '</time><span>' + esc(evText(it.ev, it.det)) + '</span></li>';
      }).join('');
      return '<li class="ad-visit"><div class="ad-vh"><b>Visit ' + x.n + '</b><span>' + when(s.a) + '</span><span><i class="ad-tsdot" style="background:' + (TS_COLOR[s.tc] || '#c9c4b8') + '"></i>' +
        esc(s.td || s.tc || 'Direct') + '</span><span>' + dur(sesTime(s)) + '</span></div><ul class="ad-steps">' + (rows || '<li class="ev"><span>No page views recorded in this visit.</span></li>') + '</ul></li>';
    }).join('') + '</ol><p class="ad-note">Times are India time. Time on a page counts only while the tab was open and the reader was active; visits before this update show the time between their first and last action instead.</p>';
    $('drBody').innerHTML = h; $('drawer').hidden = false; document.documentElement.classList.add('ad-noscroll');
    $('drBody').scrollTop = 0; setTimeout(function () { $('drClose').focus(); }, 30);
  }
  function closeJourney() { $('drawer').hidden = true; document.documentElement.classList.remove('ad-noscroll'); }
  document.addEventListener('click', function (e) {
    var c = e.target.closest && e.target.closest('.ad-chc[data-ch]');
    if (c) { var v = c.getAttribute('data-ch'); F.ch = F.ch === v ? '' : v; render(); return; }
    var tr = e.target.closest && e.target.closest('tr.ad-rd[data-vid]');
    if (tr) { openJourney(Number(tr.getAttribute('data-vid'))); return; }
    if (e.target.closest && (e.target.id === 'drawer' || e.target.closest('#drClose'))) closeJourney();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !$('drawer').hidden) closeJourney();
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('tr.ad-rd')) { e.preventDefault(); openJourney(Number(e.target.getAttribute('data-vid'))); }
  });

  /* ---------------- live view ---------------- */
  var LABEL = { pageview: 'read', push_subscribe: 'turned on notifications', push_click: 'tapped a notification', prompt_shown: 'saw the notification offer', prompt_yes: 'tapped Allow',
    endcard_seen: 'finished reading a post', quiz_complete: 'finished a quiz', game_end: 'finished a game', lesson_done: 'finished a lesson', save: 'saved a post', ask: 'asked the assistant',
    lead: 'sent an enquiry', app_installed: 'installed the app', push_check_yes: 'confirmed notifications arrive', push_check_no: 'said a notification didn’t show',
    push_guide: 'opened the fix-it steps', push_denied: 'blocked notifications', follow_open: 'opened Follow',
    email_subscribe: 'subscribed by email', share: 'shared a page', follow_click: 'tapped a follow link' };
  var seen = {};
  function drawLive(L) {
    var ev = L.events || [], nowS = Date.now() / 1000, active = {};
    ev.forEach(function (e) { if (nowS - e.t < 300 && e.v) active[e.v] = 1; });
    $('liveTxt').innerHTML = '<b>' + Object.keys(active).length + '</b> on the site now';
    var shown = ev.filter(function (e) { return LABEL[e.e]; }).slice(0, 30), next = {};
    $('feedSub').textContent = num(ev.filter(function (e) { return e.e === 'pageview'; }).length) + ' page views in the last 30 minutes. Updates every 30 seconds.';
    $('feed').innerHTML = shown.length ? shown.map(function (e) {
      var key = e.t + e.v + e.e, cls = /subscribe|check_yes/.test(e.e) ? 'sub' : e.e === 'push_click' ? 'tap' : /quiz|game|lesson/.test(e.e) ? 'play' : '';
      var what = e.e === 'pageview' ? 'read <u>' + esc(e.p) + '</u>' + (e.tc && e.tc !== 'Unknown' ? ' <small>(' + esc(e.tc) + ')</small>' : '') : esc(LABEL[e.e]) + (/quiz_complete|game_end/.test(e.e) ? ' <u>' + esc(e.d) + '</u>' : '');
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
      if (d && d.ok) { RAW = d; STATS = null; renderStatic(d); render(); pollLive(); loadMail(); loadPost(); return; }
      if (d && /Unknown request/.test(d.error || '')) {               // v4 backend: fall back to its 30-day summary
        return api({ op: 'stats', fresh: fresh ? '1' : '' }).then(function (s) {
          if (!s || !s.ok) throw s;
          RAW = null; STATS = s; if (F.period !== '7') F.period = '30';
          renderStatic(s); render(); $('liveTxt').textContent = 'Live needs v5'; $('live').classList.add('off'); loadMail(); loadPost();
        });
      }
      throw d;
    }).catch(function (d) {
      if (d && d.error) { clearKey(); show('login'); $('loginStatus').textContent = d.error; return; }
      console.error(d); show('login'); $('loginStatus').textContent = 'The backend didn’t answer. Check BACKEND_URL in /assets/nmx.js and that the deployment allows Anyone.';
    }).then(function () { $('dash').classList.remove('ad-loading'); });
  }

  $('period').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b || b.disabled) return; F.period = b.getAttribute('data-p');
    if (F.period === 'custom' && !(F.from && F.to)) { F.to = dk(Date.now()); F.from = dk(Date.now() - 13 * DAY); }
    render(); if (F.period === 'custom') $('rFrom').focus();
  });
  ['rFrom', 'rTo'].forEach(function (id) { $(id).addEventListener('change', function () {                     // v10: custom range
    var v = $(id).value; if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return;
    if (id === 'rFrom') F.from = v; else F.to = v; F.period = 'custom'; render();
  }); });
  $('rdMode').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return; RD.mode = b.getAttribute('data-m');
    this.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); if (MODEL) drawReaders(MODEL);
  });
  $('rdQ').addEventListener('input', function () { RD.q = this.value.trim(); if (MODEL) drawReaders(MODEL); });
  document.querySelectorAll('#filters select').forEach(function (s) { s.addEventListener('change', function () { F[s.getAttribute('data-f')] = s.value; render(); }); });
  $('reset').addEventListener('click', function () { ['dev', 'br', 'co', 'src', 'sec', 'topic', 'ts', 'ch'].forEach(function (k) { F[k] = ''; }); render(); });
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
    if (/^(topic|region|role):/.test(a)) return 'the readers who picked this';   // v9: worked out by the backend at send time
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
    if (confirm('Send “' + form.title.value.trim() + '” to ' + n + (typeof n === 'number' ? ' subscriber' + (n === 1 ? '' : 's') : '') + '?')) send(a);
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
      var label = { newsletter: 'Newsletter', offer: 'Offer', update: 'Update', post: 'Blog post' };
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
  /* ---------------- v7: send a blog post ---------------- */
  var POST = null;
  function postAt(sel) { return POST && POST.posts.filter(function (p) { return p.slug === sel; })[0]; }
  function dateLong(s) { return s ? new Date(s + 'T12:00:00+05:30').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : ''; }
  function drawPost() {
    var p = postAt($('postPick').value) || (POST && POST.posts[0]);
    if (!p) { $('postSub').textContent = 'No published posts in blog/posts.json yet.'; $('postBody').hidden = true; return; }
    $('postBody').hidden = false; $('postImg').src = p.image || ''; $('postLink').href = p.url;
    $('postMeta').textContent = [p.category, dateLong(p.date), p.author].filter(Boolean).join(' · ');
    $('postTitle').textContent = p.title;
    $('postMailN').textContent = num(POST.active); $('postPushN').textContent = num(POST.followers);
    var m = $('postMail'), u = $('postPush'), ms = $('postMailSt'), us = $('postPushSt'), left = Math.max(0, POST.active - p.emailed);
    // Email
    m.disabled = false; ms.className = '';
    if (p.queued && p.queued.status === 'Sending') { m.checked = false; m.disabled = true; ms.textContent = 'Sending now: ' + num(p.queued.sent) + ' sent so far. The hourly job finishes the rest (9:00–21:00 IST).'; }
    else if (POST.active && !left) { m.checked = false; m.disabled = true; ms.className = 'ok'; ms.textContent = 'Already sent to all ' + num(POST.active) + ' subscribers.'; }
    else if (p.mailAuto === 'later' || p.mailAuto === 'now') { m.checked = false; ms.textContent = (p.mailAuto === 'later' ? 'Goes out automatically from 9:00 India time today.' : 'The automatic sender picks this up within the hour.') + ' Tick to send it now instead; nobody gets it twice.'; }
    else { m.checked = left > 0; ms.className = left ? 'warn' : ''; ms.textContent = !POST.active ? 'No email subscribers yet.' : (p.emailed ? num(p.emailed) + ' already have it; ' + num(left) + ' haven’t. ' : '') + (p.mailAuto === 'missed' ? 'The automatic sender stopped for today (it sends 9:00–21:00 IST) and only handles posts dated today, so send it here.' : p.emailed ? 'Sending reaches only the ones who haven’t.' : 'Not sent automatically: the hourly sender only emails posts dated today.'); }
    if (POST.quota < left && m.checked) ms.textContent += ' About ' + num(POST.quota) + ' emails fit in today’s Gmail limit; the rest continue tomorrow by themselves.';
    // Notification
    u.disabled = false; us.className = '';
    if (!POST.pushReady) { u.checked = false; u.disabled = true; us.textContent = 'Connect GitHub first (GITHUB_REPO and GITHUB_TOKEN in Script properties).'; }
    else if (p.pushed) { u.checked = false; us.className = 'ok'; us.innerHTML = 'Followers already got a notification for this post. <button class="ad-link" type="button" id="postPushAgain">Send it again</button>'; }
    else if (p.pushAuto === 'later' || p.pushAuto === 'now') { u.checked = false; us.textContent = (p.pushAuto === 'later' ? 'Goes out automatically from 9:00 India time today.' : 'The automatic sender picks this up within the hour.') + ' Tick to send it now instead.'; }
    else { u.checked = POST.followers > 0; us.className = 'warn'; us.textContent = POST.followers ? 'Not sent yet, and the automatic sender won’t: it only announces posts dated today.' : 'No blog followers yet.'; }
    $('postGo').disabled = !m.checked && !u.checked;
    var auto = (p.mailAuto === 'later' || p.mailAuto === 'now') && (p.pushed || p.pushAuto === 'later' || p.pushAuto === 'now' || !POST.pushReady);
    $('postSub').textContent = auto ? 'This post is dated today, so the automatic sender handles it. Nothing to do unless you want it out sooner.' :
      'New posts dated today go out by themselves from 9:00 India time. Use this for anything the automatic sender missed or doesn’t cover.';
  }
  function loadPost() {
    return api({ op: 'post_status' }).then(function (r) {
      if (!r || !r.ok) { $('postSub').textContent = r && /Unknown request/.test(r.error || '') ? 'Paste Code-Blog.gs v7 into Apps Script and deploy a new version to send posts from here.' : (r && r.error) || 'Couldn’t check the latest post.'; $('postBody').hidden = true; return; }
      var keep = $('postPick').value; POST = r;
      $('postPick').innerHTML = r.posts.map(function (p, i) { return '<option value="' + esc(p.slug) + '">' + (i ? '' : 'Latest: ') + esc(p.title.length > 70 ? p.title.slice(0, 68) + '…' : p.title) + ' (' + esc(p.date) + ')</option>'; }).join('');
      $('postPick').hidden = r.posts.length < 2; if (keep && postAt(keep)) $('postPick').value = keep;
      drawPost();
    }).catch(function () { $('postSub').textContent = 'The backend didn’t answer.'; });
  }
  $('postPick').addEventListener('change', drawPost);
  ['postMail', 'postPush'].forEach(function (id) { $(id).addEventListener('change', function () { $('postGo').disabled = !$('postMail').checked && !$('postPush').checked; }); });
  var forcePush = false;
  $('postPushSt').addEventListener('click', function (e) { if (e.target.id === 'postPushAgain') { forcePush = true; $('postPush').checked = true; $('postGo').disabled = false; e.target.outerHTML = '<b>Will send again.</b>'; } });
  $('postTest').addEventListener('click', function () {
    var st = $('postStatus'), p = postAt($('postPick').value) || POST.posts[0]; st.textContent = 'Sending a test…';
    api({ op: 'post_test', slug: p.slug }).then(function (r) { st.textContent = r.ok ? 'Test sent to ' + r.to + '. Check your inbox (and Promotions).' : r.error || 'That didn’t work.'; })
      .catch(function () { st.textContent = 'The backend didn’t answer. Try again.'; });
  });
  $('postGo').addEventListener('click', function () {
    var p = postAt($('postPick').value) || POST.posts[0], st = $('postStatus'), em = $('postMail').checked, pu = $('postPush').checked;
    var who = [em ? 'email subscribers who haven’t had it' : '', pu ? num(POST.followers) + ' blog followers (notification)' : ''].filter(Boolean).join(' and ');
    if (!confirm('Send “' + p.title + '” to ' + who + '?')) return;
    $('postGo').disabled = true; st.textContent = 'Sending…';
    api({ op: 'post_send', slug: p.slug, ch_email: em ? '1' : '0', ch_push: pu ? '1' : '0', force: forcePush ? '1' : '' }).then(function (r) {
      if (!r.ok) { st.textContent = r.error || 'That didn’t work.'; return; }
      var bits = [];
      if (em) bits.push(r.id ? (r.waiting ? 'Sent ' + num(r.sent) + ' emails; ' + num(r.waiting) + ' more go out automatically.' : 'Sent ' + num(r.sent || 0) + ' emails.') : (r.mailNote || ''));
      if (pu) bits.push(r.pushError ? 'Notification: ' + r.pushError : r.pushNote || 'Notification queued on GitHub.');
      st.textContent = bits.filter(Boolean).join(' '); forcePush = false;
      loadPost(); loadMail(); if (pu) setTimeout(function () { load(true); }, 1500);
    }).catch(function () { st.textContent = 'The backend didn’t answer. Check the Email campaigns table before trying again.'; })
      .then(function () { $('postGo').disabled = false; });
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
