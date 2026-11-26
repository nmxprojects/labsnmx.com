/* NMX Labs engage layer (v10, 26 Nov 2026). Loaded by /assets/nmx.js on every page.
   v10: the reading prompt is a centred card with a coffee cup (notifications, or follow links where notifications can't
   work), a Share button on every post and lesson (the phone's own share menu, or a share sheet on computers), follow links
   for LinkedIn and Pinterest, and reading time per page (event page_end: active seconds and how far down the page they got)
   plus email sign-ups (event email_subscribe) for the dashboard's reader journeys.
   - Browser notifications (standard Web Push, self-hosted, free): a "Follow" button, a small prompt once a reader is a
     few lines into a post, an end-of-post card, a test notification and step-by-step fixes when notifications are blocked.
   - "Ask NMX Labs" assistant: instant answers from the studio facts below, an AI answer for anything else, and a hand-off
     to a person (lead form or WhatsApp).
   - Saved posts (kept in the reader's browser, readable offline) and the installable app.
   - First-party visit statistics (respects Do Not Track and Global Privacy Control; no cookies, no IP address).
   - v9: traffic sources in plain English ("Instagram · Meta ads · Instagram Stories"), ad placement from utm_term or
     utm_content, the in-app browser by name, and /assets/curate.js (picks by country, the personalise sheet).
   Reads its settings from /assets/nmx.js (window.NMX_CFG). This file holds no keys, so it can be replaced on its own. */
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
    if (/Instagram/.test(UAS)) br = 'Instagram in-app browser';
    else if (/FBAN|FBAV|FB_IAB/.test(UAS)) br = 'Facebook in-app browser';
    else if (/LinkedInApp/.test(UAS)) br = 'LinkedIn in-app browser';
    else if (/GSA\//.test(UAS)) br = 'Google app in-app browser';
    else if (/Line\//.test(UAS)) br = 'LINE in-app browser';
    else if (/Snapchat/.test(UAS)) br = 'Snapchat in-app browser';
    else if (/; wv\)/.test(UAS)) br = 'Android app in-app browser';
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

  /* =========================================================== traffic sources */
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
  var CLICK = { g: qs.get('gclid') || qs.get('gbraid') || qs.get('wbraid') || qs.get('gad_source') || qs.get('dclid') ? 1 : 0, m: qs.get('msclkid') ? 1 : 0, f: qs.get('fbclid') ? 1 : 0,
    s: qs.get('ttclid') ? 'tiktok' : qs.get('twclid') ? 'x' : qs.get('li_fat_id') ? 'linkedin' : (qs.get('igshid') || qs.get('igsh')) ? 'instagram' : '' };
  var APP = /Instagram/.test(UAS) ? 'Instagram' : /FBAN|FBAV|FB_IAB/.test(UAS) ? 'Facebook' : /LinkedInApp/.test(UAS) ? 'LinkedIn' : /Snapchat/.test(UAS) ? 'Snapchat'
    : /Pinterest/.test(UAS) ? 'Pinterest' : /musical_ly|TikTok|BytedanceWebview/.test(UAS) ? 'TikTok' : /Twitter/.test(UAS) ? 'X' : /GSA\//.test(UAS) ? 'Google app' : '';
  var INTERNAL = false; try { INTERNAL = !!doc.referrer && new URL(doc.referrer).hostname.replace(/^www\./, '') === location.hostname.replace(/^www\./, ''); } catch (e) {}
  var TOUCH = !!(refHost || qs.get('utm_source') || qs.get('utm_medium') || CLICK.g || CLICK.m || CLICK.f || CLICK.s);

  var SES = (function () {
    var s = readJSON('nmx-ses', null), now = Date.now(), fresh = !s || now - s.t > 30 * 60 * 1000, t;
    if (fresh) s = { id: rid(), t: now, ref: refHost, us: '', um: '', uc: '', ct: '', ut: '' };
    if (qs.get('utm_source')) { s.us = qs.get('utm_source'); s.um = qs.get('utm_medium') || ''; s.uc = qs.get('utm_campaign') || ''; s.ct = qs.get('utm_content') || ''; s.ut = qs.get('utm_term') || ''; }
    // A new campaign or outside link re-attributes the visit; clicking around the site keeps the source it arrived with.
    if (TOUCH) t = classifyTraffic({ ref: refHost, us: qs.get('utm_source') || '', um: qs.get('utm_medium') || '', ct: qs.get('utm_content') || '', ut: qs.get('utm_term') || '', click: CLICK, app: APP });
    else if (fresh) t = classifyTraffic({ app: APP, internal: INTERNAL });
    else if (!s.tc) t = classifyTraffic({ ref: s.ref, us: s.us, um: s.um, ct: s.ct, ut: s.ut });
    else if (s.v9 !== 1) { s.td = relabelTraffic(s.tc, s.td); s.v9 = 1; }
    if (t) { s.tc = t.c; s.td = t.d; s.sn = t.sn; s.pl = t.pl; s.v9 = 1; }
    s.t = now; store('nmx-ses', JSON.stringify(s));
    if (!read('nmx-first')) store('nmx-first', JSON.stringify({ ref: refHost, us: s.us, um: s.um, uc: s.uc, page: path, at: today(), tc: s.tc, td: s.td }));
    return s;
  })();
  var FIRST = readJSON('nmx-first', {});
  if (!FIRST.tc) { var tf = classifyTraffic({ ref: FIRST.ref, us: FIRST.us, um: FIRST.um }); FIRST.tc = tf.c; FIRST.td = tf.d; if (read('nmx-first')) store('nmx-first', JSON.stringify(FIRST)); }
  else if (FIRST.td && FIRST.v9 !== 1) { FIRST.td = relabelTraffic(FIRST.tc, FIRST.td); FIRST.v9 = 1; store('nmx-first', JSON.stringify(FIRST)); }
  window.NMX_TRAFFIC = { now: SES.tc, detail: SES.td || '', first: FIRST.tc, firstDetail: FIRST.td || '', source: SES.sn || '', placement: SES.pl || '' };
  window.NMX_VISITOR = { vid: VID, country: COUNTRY, tz: TZ, dev: U.dev, os: U.os, br: U.br, app: APP };

  // Email sign-ups are sent by /assets/nmx.js (which holds your keys and is left untouched). This adds the traffic
  // source to that one request on its way out, and to nothing else.
  (function () {
    var of = window.fetch; if (!of || of.nmxTraffic) return;
    var wrapped = function (input, init) {
      var isSub = false;
      try {
        var b = init && init.body;
        if (b && typeof URLSearchParams !== 'undefined' && b instanceof URLSearchParams && b.get('action') === 'subscribe' &&
            CFG.BACKEND_URL && String(input && input.url || input).indexOf(String(CFG.BACKEND_URL)) === 0) {
          isSub = true;
          if (!b.has('tc')) { b.append('tc', SES.tc || ''); b.append('td', SES.td || ''); b.append('vid', VID); }
        }
      } catch (e) {}
      var res = of.apply(this, arguments);
      // v10: a visitor event for each email sign-up, so the dashboard can show what led to it.
      if (isSub && res && res.then) res.then(function (r) { return r.clone().json(); })
        .then(function (d) { if (d && d.ok) logEvent('email_subscribe', (d.already ? 'already' : 'new') + '|' + path); }).catch(function () {});
      return res;
    };
    wrapped.nmxTraffic = true; window.fetch = wrapped;
  })();

  /* =========================================================== first-party statistics */
  function logEvent(type, detail) {
    if (!READY || BOT || (NO_TRACK && (type === 'pageview' || type === 'page_end'))) return;
    var body = new URLSearchParams({ action: 'event', t: type, vid: VID, sid: SES.id, path: path.slice(0, 200), title: doc.title.slice(0, 150),
      ref: type === 'pageview' ? refHost : '', us: SES.us || '', um: SES.um || '', uc: SES.uc || '', dev: U.dev, br: U.br, os: U.os, co: COUNTRY,
      lang: navigator.language || '', d: String(detail || '').slice(0, 200), tc: SES.tc || '', td: SES.td || '',
      sn: SES.sn || '', pl: SES.pl || '', ap: APP || '', ct: SES.ct || '', ut: SES.ut || '' });
    try { if (navigator.sendBeacon && navigator.sendBeacon(CFG.BACKEND_URL, body)) return; } catch (e) {}
    fetch(CFG.BACKEND_URL, { method: 'POST', body: body, mode: 'no-cors', keepalive: true }).catch(function () {});
  }
  window.nmxEvent = logEvent;
  // v9: picks by country, the personalise sheet and reading interests.
  if (!window.NMX_NO_CURATE && !/\/amp\/?$/.test(path)) { var cj = doc.createElement('script'); cj.src = '/assets/curate.js?v=9'; cj.defer = true; doc.head.appendChild(cj); }
  if (doc.readyState === 'complete') setTimeout(function () { logEvent('pageview'); }, 600);
  else addEventListener('load', function () { setTimeout(function () { logEvent('pageview'); }, 600); });

  // v10: time actually spent on the page. Counts only while the tab is visible and the reader has scrolled, tapped or
  // typed in the last 90 seconds. Sent when the page is hidden or closed as "page_end" with "seconds|deepest scroll %";
  // coming back and leaving again sends the extra seconds only.
  (function readingTime() {
    if (!READY || BOT || NO_TRACK) return;
    var active = 0, lastAct = Date.now(), deepest = 0;
    function depth() { var h = doc.documentElement, room = Math.max(1, h.scrollHeight - innerHeight); return Math.max(0, Math.min(100, Math.round(scrollY / room * 100))); }
    function poke() { lastAct = Date.now(); }
    ['pointerdown', 'keydown', 'touchstart', 'wheel'].forEach(function (t) { addEventListener(t, poke, { passive: true }); });
    addEventListener('scroll', function () { poke(); var d = depth(); if (d > deepest) deepest = d; }, { passive: true });
    setInterval(function () { if (doc.visibilityState === 'visible' && Date.now() - lastAct < 90000) active++; }, 1000);
    function flush() { var sec = Math.min(3600, active); if (sec < 1) return; active = 0; logEvent('page_end', sec + '|' + Math.max(deepest, depth())); }
    doc.addEventListener('visibilitychange', function () { if (doc.visibilityState === 'hidden') flush(); else poke(); });
    addEventListener('pagehide', flush);
  })();

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
  var IOS_NEEDS_INSTALL = PUSH_ON && IOS && !STANDALONE && !/in-app browser$/.test(U.br);
  var INAPP = /in-app browser$/.test(U.br);
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
    var css = doc.createElement('link'); css.rel = 'stylesheet'; css.href = '/assets/engage.css?v=13'; doc.head.appendChild(css);
  }
  // v11: flat icons (scripts/icons_v11.py). Same keys as before, so nothing else changes.
  var I = {
    bell: "<svg class=\"nx-f\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path fill=\"currentColor\" stroke=\"none\" d=\"M12 2.8c-3.4 0-6.1 2.7-6.1 6.2v4.2l-1.7 2.6c-.4.7.1 1.6.9 1.6h13.8c.8 0 1.3-.9.9-1.6l-1.7-2.6V9c0-3.5-2.7-6.2-6.1-6.2z\"/><path fill=\"currentColor\" stroke=\"none\" d=\"M9.4 18.6h5.2a2.6 2.6 0 0 1-5.2 0z\"/></svg>",
    bellOff: "<svg class=\"nx-f\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M7 17.6H5.1c-.8 0-1.3-.9-.9-1.6l1.7-2.6V9c0-1.2.3-2.3.9-3.2M9.2 3.6A6 6 0 0 1 18.1 9v4.2l1.3 2\"/><path fill=\"currentColor\" stroke=\"none\" d=\"M9.4 18.6h5.2a2.6 2.6 0 0 1-5.2 0z\"/><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2.2\" d=\"M3.6 3.6l16.8 16.8\"/></svg>",
    chat: "<svg class=\"nx-f\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path fill=\"currentColor\" stroke=\"none\" d=\"M6.6 16.4v4.2a.5.5 0 0 0 .84.37l4.9-4.57z\"/><path fill=\"currentColor\" stroke=\"none\" fill-rule=\"evenodd\" d=\"M6.2 3.6h11.6a3.6 3.6 0 0 1 3.6 3.6v6.4a3.6 3.6 0 0 1 -3.6 3.6h-11.6a3.6 3.6 0 0 1 -3.6 -3.6v-6.4a3.6 3.6 0 0 1 3.6 -3.6zM7.45 7.6h9.1a0.85 0.85 0 0 1 0.85 0.85v0a0.85 0.85 0 0 1 -0.85 0.85h-9.1a0.85 0.85 0 0 1 -0.85 -0.85v-0a0.85 0.85 0 0 1 0.85 -0.85zM7.45 11.3h4.9a0.85 0.85 0 0 1 0.85 0.85v0a0.85 0.85 0 0 1 -0.85 0.85h-4.9a0.85 0.85 0 0 1 -0.85 -0.85v-0a0.85 0.85 0 0 1 0.85 -0.85z\"/></svg>",
    x: "<svg class=\"nx-f\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2.5\" d=\"M6 6l12 12M18 6 6 18\"/></svg>",
    send: "<svg class=\"nx-f\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path fill=\"currentColor\" stroke=\"none\" d=\"M3.4 4.2c-.2-.9.7-1.6 1.5-1.2l16 8c.8.4.8 1.6 0 2l-16 8c-.8.4-1.7-.3-1.5-1.2L5 13.1l7.6-1.1L5 10.9z\"/></svg>",
    mark: "<svg class=\"nx-f\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path fill=\"currentColor\" stroke=\"none\" d=\"M6.3 3h11.4A1.8 1.8 0 0 1 19.5 4.8v15.6c0 .7-.8 1.1-1.4.7L12 16.7l-6.1 4.4c-.6.4-1.4 0-1.4-.7V4.8A1.8 1.8 0 0 1 6.3 3z\"/></svg>",
    marked: "<svg class=\"nx-f\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path fill=\"currentColor\" stroke=\"none\" fill-rule=\"evenodd\" d=\"M6.3 3h11.4A1.8 1.8 0 0 1 19.5 4.8v15.6c0 .7-.8 1.1-1.4.7L12 16.7l-6.1 4.4c-.6.4-1.4 0-1.4-.7V4.8A1.8 1.8 0 0 1 6.3 3zM8.3 9.5l1.2-1.2 1.6 1.6 3.4-3.4 1.2 1.2-4.6 4.6z\"/></svg>",
    check: "<svg class=\"nx-f\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2.7\" d=\"M4.8 12.6l4.6 4.6L19.2 7.4\"/></svg>",
    phone: "<svg class=\"nx-f\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path fill=\"currentColor\" stroke=\"none\" fill-rule=\"evenodd\" d=\"M9 2h6a3.2 3.2 0 0 1 3.2 3.2v13.6a3.2 3.2 0 0 1 -3.2 3.2h-6a3.2 3.2 0 0 1 -3.2 -3.2v-13.6a3.2 3.2 0 0 1 3.2 -3.2zM10.75 17.6h2.5a0.75 0.75 0 0 1 0.75 0.75v0a0.75 0.75 0 0 1 -0.75 0.75h-2.5a0.75 0.75 0 0 1 -0.75 -0.75v-0a0.75 0.75 0 0 1 0.75 -0.75zM11.1 5a0.9 0.9 0 1 0 1.8 0a0.9 0.9 0 1 0 -1.8 0z\"/></svg>"
  };
  // v10: app-style tiles (rounded squares, simple line symbols) for follow and share links.
  // v11: flat glyphs (scripts/icons_v11.py --js)
  var GLYPH = {"camera": "<path fill=\"currentColor\" stroke=\"none\" d=\"M9.1 4.3h5.8a1.3 1.3 0 0 1 1.1.6L17.3 7H6.7l1.3-2.1a1.3 1.3 0 0 1 1.1-.6z\"/><path fill=\"currentColor\" stroke=\"none\" fill-rule=\"evenodd\" d=\"M6.5 6.6h11a4 4 0 0 1 4 4v6a4 4 0 0 1 -4 4h-11a4 4 0 0 1 -4 -4v-6a4 4 0 0 1 4 -4zM7.5 13.6a4.5 4.5 0 1 0 9 0a4.5 4.5 0 1 0 -9 0zM9.4 13.6a2.6 2.6 0 1 0 5.2 0a2.6 2.6 0 1 0 -5.2 0zM16.95 10.1a1.05 1.05 0 1 0 2.1 0a1.05 1.05 0 1 0 -2.1 0z\"/>", "chat": "<path fill=\"currentColor\" stroke=\"none\" d=\"M5.4 16.3 3.7 20.9a.5.5 0 0 0 .66.63l4.9-1.85z\"/><path fill=\"currentColor\" stroke=\"none\" fill-rule=\"evenodd\" d=\"M3 11.6a9 9 0 1 0 18 0a9 9 0 1 0 -18 0zM6.8 11.6a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0 -2.6 0zM10.7 11.6a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0 -2.6 0zM14.6 11.6a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0 -2.6 0z\"/>", "play": "<path fill=\"currentColor\" stroke=\"none\" fill-rule=\"evenodd\" d=\"M2.4 12a9.6 9.6 0 1 0 19.2 0a9.6 9.6 0 1 0 -19.2 0zM10 8.4v7.2c0 .5.5.8.9.55l5.8-3.6a.65.65 0 0 0 0-1.1l-5.8-3.6c-.4-.25-.9.05-.9.55z\"/>", "briefcase": "<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2.1\" d=\"M8.9 6.9V5.6a1.8 1.8 0 0 1 1.8-1.8h2.6a1.8 1.8 0 0 1 1.8 1.8v1.3\"/><path fill=\"currentColor\" stroke=\"none\" fill-rule=\"evenodd\" d=\"M5.7 6.8h12.6a3.2 3.2 0 0 1 3.2 3.2v7.2a3.2 3.2 0 0 1 -3.2 3.2h-12.6a3.2 3.2 0 0 1 -3.2 -3.2v-7.2a3.2 3.2 0 0 1 3.2 -3.2zM2.5 11.9h19v1.5h-19z\"/><path fill=\"currentColor\" stroke=\"none\" d=\"M11.1 10.9h1.8a0.9 0.9 0 0 1 0.9 0.9v1.7a0.9 0.9 0 0 1 -0.9 0.9h-1.8a0.9 0.9 0 0 1 -0.9 -0.9v-1.7a0.9 0.9 0 0 1 0.9 -0.9z\"/>", "pin": "<path fill=\"currentColor\" stroke=\"none\" d=\"M8.3 3.4h7.4a1.1 1.1 0 0 1 .9 1.7l-1.5 2.4v3.2l3 2.9a1.1 1.1 0 0 1-.8 1.9H6.7a1.1 1.1 0 0 1-.8-1.9l3-2.9V7.5L7.4 5.1a1.1 1.1 0 0 1 .9-1.7z\"/><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2.3\" d=\"M12 15.6v5.4\"/>", "at": "<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2.3\" d=\"M8.3 12a3.7 3.7 0 1 0 7.4 0a3.7 3.7 0 1 0 -7.4 0zM15.7 12v1.4a2.7 2.7 0 0 0 5.4 0V12a9.1 9.1 0 1 0-3.6 7.3\"/>", "people": "<path fill=\"currentColor\" stroke=\"none\" d=\"M5.4 8a3.6 3.6 0 1 0 7.2 0a3.6 3.6 0 1 0 -7.2 0z\"/><path fill=\"currentColor\" stroke=\"none\" d=\"M2.6 19.6c0-3.7 2.9-6.4 6.4-6.4s6.4 2.7 6.4 6.4a.9.9 0 0 1-.9.9H3.5a.9.9 0 0 1-.9-.9z\"/><path fill=\"currentColor\" stroke=\"none\" d=\"M14.1 8.9a2.8 2.8 0 1 0 5.6 0a2.8 2.8 0 1 0 -5.6 0z\"/><path fill=\"currentColor\" stroke=\"none\" d=\"M16.2 13.6c3 0 5.2 2.2 5.2 5.4a.9.9 0 0 1-.9.9h-3.3c0-2.5-.8-4.6-2.3-6.1.4-.1.8-.2 1.3-.2z\"/>", "bubbles": "<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M12.2 3.3h6a3.2 3.2 0 0 1 3.2 3.2v3a3.2 3.2 0 0 1 -3.2 3.2h-6a3.2 3.2 0 0 1 -3.2 -3.2v-3a3.2 3.2 0 0 1 3.2 -3.2zM18.6 12.7v2.6l-2.8-2.6\"/><path fill=\"currentColor\" stroke=\"none\" d=\"M5.9 8h6a3.3 3.3 0 0 1 3.3 3.3v3a3.3 3.3 0 0 1 -3.3 3.3h-6a3.3 3.3 0 0 1 -3.3 -3.3v-3a3.3 3.3 0 0 1 3.3 -3.3z\"/><path fill=\"currentColor\" stroke=\"none\" d=\"M5 17.2v3.6a.5.5 0 0 0 .85.36l3.9-3.96z\"/>", "plane": "<path fill=\"currentColor\" stroke=\"none\" d=\"M2.9 10.9 20.3 3.7c.7-.3 1.4.4 1.1 1.1l-6.9 16.9c-.3.8-1.4.7-1.6-.1l-1.8-6.3-6.4-2.1c-.8-.3-.9-1.4-.1-1.7z\"/>", "feed": "<path fill=\"currentColor\" stroke=\"none\" d=\"M3.7 18a2.3 2.3 0 1 0 4.6 0a2.3 2.3 0 1 0 -4.6 0z\"/><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2.5\" d=\"M4.2 11.2a8.6 8.6 0 0 1 8.6 8.6M4.2 4.6a15.2 15.2 0 0 1 15.2 15.2\"/>", "mail": "<path fill=\"currentColor\" stroke=\"none\" fill-rule=\"evenodd\" d=\"M5.7 4.8h12.6a3.2 3.2 0 0 1 3.2 3.2v8.2a3.2 3.2 0 0 1 -3.2 3.2h-12.6a3.2 3.2 0 0 1 -3.2 -3.2v-8.2a3.2 3.2 0 0 1 3.2 -3.2zM5 7.6 12 12.4l7-4.8v2.6L12 15l-7-4.8z\"/>", "phone": "<path fill=\"currentColor\" stroke=\"none\" d=\"M6.4 3.3c.8-.5 1.8-.2 2.3.6l1.6 2.8c.4.8.3 1.7-.4 2.3l-1.3 1.1c.9 2 2.6 3.8 4.6 4.7l1.1-1.3c.6-.7 1.5-.8 2.3-.4l2.8 1.6c.8.5 1.1 1.5.6 2.3l-.8 1.5c-.7 1.2-2.1 1.9-3.5 1.5C10 18.5 5.5 14 4 8.2c-.4-1.4.3-2.8 1.5-3.5z\"/>", "mobile": "<path fill=\"currentColor\" stroke=\"none\" fill-rule=\"evenodd\" d=\"M9 2h6a3.2 3.2 0 0 1 3.2 3.2v13.6a3.2 3.2 0 0 1 -3.2 3.2h-6a3.2 3.2 0 0 1 -3.2 -3.2v-13.6a3.2 3.2 0 0 1 3.2 -3.2zM10.75 17.6h2.5a0.75 0.75 0 0 1 0.75 0.75v0a0.75 0.75 0 0 1 -0.75 0.75h-2.5a0.75 0.75 0 0 1 -0.75 -0.75v-0a0.75 0.75 0 0 1 0.75 -0.75zM11.1 5a0.9 0.9 0 1 0 1.8 0a0.9 0.9 0 1 0 -1.8 0z\"/>", "globe": "<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0zM3 12h18M12 3c2.6 2.4 3.9 5.4 3.9 9s-1.3 6.6-3.9 9c-2.6-2.4-3.9-5.4-3.9-9S9.4 5.4 12 3z\"/>", "link": "<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2.4\" d=\"M10 14a4 4 0 0 0 5.7 0l3.2-3.2a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3.2 3.2a4 4 0 0 0 5.7 5.7l1-1\"/>", "copy": "<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M11.6 2.8h6.6a3 3 0 0 1 3 3v6.6a3 3 0 0 1 -3 3h-6.6a3 3 0 0 1 -3 -3v-6.6a3 3 0 0 1 3 -3z\"/><path fill=\"currentColor\" stroke=\"none\" d=\"M5.8 8.6h6.6a3 3 0 0 1 3 3v6.6a3 3 0 0 1 -3 3h-6.6a3 3 0 0 1 -3 -3v-6.6a3 3 0 0 1 3 -3z\"/>", "share": "<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2.3\" d=\"M12 3.4v11M8 7.3l4-3.9 4 3.9M8.6 10.2H7.2a2.6 2.6 0 0 0-2.6 2.6v5.6a2.6 2.6 0 0 0 2.6 2.6h9.6a2.6 2.6 0 0 0 2.6-2.6v-5.6a2.6 2.6 0 0 0-2.6-2.6h-1.4\"/>", "save": "<path fill=\"currentColor\" stroke=\"none\" d=\"M6.3 3h11.4A1.8 1.8 0 0 1 19.5 4.8v15.6c0 .7-.8 1.1-1.4.7L12 16.7l-6.1 4.4c-.6.4-1.4 0-1.4-.7V4.8A1.8 1.8 0 0 1 6.3 3z\"/>", "saved": "<path fill=\"currentColor\" stroke=\"none\" fill-rule=\"evenodd\" d=\"M6.3 3h11.4A1.8 1.8 0 0 1 19.5 4.8v15.6c0 .7-.8 1.1-1.4.7L12 16.7l-6.1 4.4c-.6.4-1.4 0-1.4-.7V4.8A1.8 1.8 0 0 1 6.3 3zM8.3 9.5l1.2-1.2 1.6 1.6 3.4-3.4 1.2 1.2-4.6 4.6z\"/>", "heart": "<path fill=\"currentColor\" stroke=\"none\" d=\"M12 20.4c-.3 0-.6-.1-.8-.3C6.3 16 3 13 3 9.2 3 6.5 5.1 4.3 7.8 4.3c1.7 0 3.2.9 4.2 2.2 1-1.3 2.5-2.2 4.2-2.2C18.9 4.3 21 6.5 21 9.2c0 3.8-3.3 6.8-8.2 10.9-.2.2-.5.3-.8.3z\"/>", "comment": "<path fill=\"currentColor\" stroke=\"none\" d=\"M6.6 16.4v4.2a.5.5 0 0 0 .84.37l4.9-4.57z\"/><path fill=\"currentColor\" stroke=\"none\" fill-rule=\"evenodd\" d=\"M6.2 3.6h11.6a3.6 3.6 0 0 1 3.6 3.6v6.4a3.6 3.6 0 0 1 -3.6 3.6h-11.6a3.6 3.6 0 0 1 -3.6 -3.6v-6.4a3.6 3.6 0 0 1 3.6 -3.6zM7.45 7.6h9.1a0.85 0.85 0 0 1 0.85 0.85v0a0.85 0.85 0 0 1 -0.85 0.85h-9.1a0.85 0.85 0 0 1 -0.85 -0.85v-0a0.85 0.85 0 0 1 0.85 -0.85zM7.45 11.3h4.9a0.85 0.85 0 0 1 0.85 0.85v0a0.85 0.85 0 0 1 -0.85 0.85h-4.9a0.85 0.85 0 0 1 -0.85 -0.85v-0a0.85 0.85 0 0 1 0.85 -0.85z\"/>", "print": "<path fill=\"currentColor\" stroke=\"none\" d=\"M7.8 2.8h8.4a1.2 1.2 0 0 1 1.2 1.2v2a1.2 1.2 0 0 1 -1.2 1.2h-8.4a1.2 1.2 0 0 1 -1.2 -1.2v-2a1.2 1.2 0 0 1 1.2 -1.2z\"/><path fill=\"currentColor\" stroke=\"none\" fill-rule=\"evenodd\" d=\"M5.3 8.2h13.4a2.8 2.8 0 0 1 2.8 2.8v4a2.8 2.8 0 0 1-2.8 2.8h-.3V13H5.6v4.8h-.3a2.8 2.8 0 0 1-2.8-2.8v-4a2.8 2.8 0 0 1 2.8-2.8zM16.6 10.6a1 1 0 1 0 2 0a1 1 0 1 0 -2 0z\"/><path fill=\"currentColor\" stroke=\"none\" d=\"M8.4 14.4h7.2a1.2 1.2 0 0 1 1.2 1.2v4.4a1.2 1.2 0 0 1 -1.2 1.2h-7.2a1.2 1.2 0 0 1 -1.2 -1.2v-4.4a1.2 1.2 0 0 1 1.2 -1.2z\"/>", "download": "<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2.3\" d=\"M12 3.4v11.2M7.6 10.4l4.4 4.4 4.4-4.4M4.4 15.6v2.6a2.6 2.6 0 0 0 2.6 2.6h10a2.6 2.6 0 0 0 2.6-2.6v-2.6\"/>", "more": "<path fill=\"currentColor\" stroke=\"none\" d=\"M3.3 12a2.1 2.1 0 1 0 4.2 0a2.1 2.1 0 1 0 -4.2 0zM9.9 12a2.1 2.1 0 1 0 4.2 0a2.1 2.1 0 1 0 -4.2 0zM16.5 12a2.1 2.1 0 1 0 4.2 0a2.1 2.1 0 1 0 -4.2 0z\"/>", "bell": "<path fill=\"currentColor\" stroke=\"none\" d=\"M12 2.8c-3.4 0-6.1 2.7-6.1 6.2v4.2l-1.7 2.6c-.4.7.1 1.6.9 1.6h13.8c.8 0 1.3-.9.9-1.6l-1.7-2.6V9c0-3.5-2.7-6.2-6.1-6.2z\"/><path fill=\"currentColor\" stroke=\"none\" d=\"M9.4 18.6h5.2a2.6 2.6 0 0 1-5.2 0z\"/>", "bellOff": "<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M7 17.6H5.1c-.8 0-1.3-.9-.9-1.6l1.7-2.6V9c0-1.2.3-2.3.9-3.2M9.2 3.6A6 6 0 0 1 18.1 9v4.2l1.3 2\"/><path fill=\"currentColor\" stroke=\"none\" d=\"M9.4 18.6h5.2a2.6 2.6 0 0 1-5.2 0z\"/><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2.2\" d=\"M3.6 3.6l16.8 16.8\"/>", "send": "<path fill=\"currentColor\" stroke=\"none\" d=\"M3.4 4.2c-.2-.9.7-1.6 1.5-1.2l16 8c.8.4.8 1.6 0 2l-16 8c-.8.4-1.7-.3-1.5-1.2L5 13.1l7.6-1.1L5 10.9z\"/>", "close": "<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2.5\" d=\"M6 6l12 12M18 6 6 18\"/>", "check": "<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2.7\" d=\"M4.8 12.6l4.6 4.6L19.2 7.4\"/>", "search": "<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2.4\" d=\"M4 10.6a6.6 6.6 0 1 0 13.2 0a6.6 6.6 0 1 0 -13.2 0z\"/><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2.8\" d=\"M15.6 15.6 20.6 20.6\"/>", "calendar": "<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2.2\" d=\"M8 2.8v3.6M16 2.8v3.6\"/><path fill=\"currentColor\" stroke=\"none\" fill-rule=\"evenodd\" d=\"M6.4 5h11.2a3.4 3.4 0 0 1 3.4 3.4v9.4a3.4 3.4 0 0 1 -3.4 3.4h-11.2a3.4 3.4 0 0 1 -3.4 -3.4v-9.4a3.4 3.4 0 0 1 3.4 -3.4zM3 9.6h18V11H3zM6.8 14.4a1.2 1.2 0 1 0 2.4 0a1.2 1.2 0 1 0 -2.4 0zM10.8 14.4a1.2 1.2 0 1 0 2.4 0a1.2 1.2 0 1 0 -2.4 0zM14.8 14.4a1.2 1.2 0 1 0 2.4 0a1.2 1.2 0 1 0 -2.4 0zM6.8 17.8a1.2 1.2 0 1 0 2.4 0a1.2 1.2 0 1 0 -2.4 0zM10.8 17.8a1.2 1.2 0 1 0 2.4 0a1.2 1.2 0 1 0 -2.4 0z\"/>", "location": "<path fill=\"currentColor\" stroke=\"none\" fill-rule=\"evenodd\" d=\"M12 2.4c-4.1 0-7.4 3.2-7.4 7.3 0 5.1 5.9 10.9 6.6 11.5.4.4 1.1.4 1.5 0 .7-.6 6.6-6.4 6.6-11.5 0-4.1-3.2-7.3-7.3-7.3zM9.2 9.8a2.8 2.8 0 1 0 5.6 0a2.8 2.8 0 1 0 -5.6 0z\"/>", "user": "<path fill=\"currentColor\" stroke=\"none\" d=\"M7.8 7.6a4.2 4.2 0 1 0 8.4 0a4.2 4.2 0 1 0 -8.4 0z\"/><path fill=\"currentColor\" stroke=\"none\" d=\"M4.2 19.8c0-4 3.5-6.8 7.8-6.8s7.8 2.8 7.8 6.8a1 1 0 0 1-1 1H5.2a1 1 0 0 1-1-1z\"/>", "playSm": "<path fill=\"currentColor\" stroke=\"none\" d=\"M7.4 5.2v13.6c0 .8.9 1.3 1.6.9l10.7-6.8c.6-.4.6-1.3 0-1.7L9 4.3c-.7-.4-1.6.1-1.6.9z\"/>", "pause": "<path fill=\"currentColor\" stroke=\"none\" d=\"M7.7 4.8h1a1.5 1.5 0 0 1 1.5 1.5v11.4a1.5 1.5 0 0 1 -1.5 1.5h-1a1.5 1.5 0 0 1 -1.5 -1.5v-11.4a1.5 1.5 0 0 1 1.5 -1.5zM15.3 4.8h1a1.5 1.5 0 0 1 1.5 1.5v11.4a1.5 1.5 0 0 1 -1.5 1.5h-1a1.5 1.5 0 0 1 -1.5 -1.5v-11.4a1.5 1.5 0 0 1 1.5 -1.5z\"/>", "headphones": "<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2.2\" d=\"M4.4 15.5V12a7.6 7.6 0 0 1 15.2 0v3.5\"/><path fill=\"currentColor\" stroke=\"none\" d=\"M4.8 13.2h1a2 2 0 0 1 2 2v4a2 2 0 0 1 -2 2h-1a2 2 0 0 1 -2 -2v-4a2 2 0 0 1 2 -2zM18.2 13.2h1a2 2 0 0 1 2 2v4a2 2 0 0 1 -2 2h-1a2 2 0 0 1 -2 -2v-4a2 2 0 0 1 2 -2z\"/>", "sparkle": "<path fill=\"currentColor\" stroke=\"none\" d=\"M11 2.6c.5 4.2 2.8 6.6 7 7-4.2.5-6.5 2.8-7 7-.4-4.2-2.8-6.5-7-7 4.2-.4 6.6-2.8 7-7zM18.2 14.2c.2 1.8 1.2 2.8 3 3-1.8.2-2.8 1.2-3 3-.2-1.8-1.2-2.8-3-3 1.8-.2 2.8-1.2 3-3z\"/>", "list": "<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2.4\" d=\"M5 6.5h14M5 12h14M5 17.5h8.6\"/>", "arrow": "<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2.4\" d=\"M4.5 12h15M13.5 6l6 6-6 6\"/>", "chevL": "<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2.6\" d=\"M15 5l-7 7 7 7\"/>", "chevR": "<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2.6\" d=\"M9 5l7 7-7 7\"/>", "tag": "<path fill=\"currentColor\" stroke=\"none\" fill-rule=\"evenodd\" d=\"M3 4.6A1.6 1.6 0 0 1 4.6 3h6.6c.4 0 .8.2 1.1.5l8.3 8.3a1.6 1.6 0 0 1 0 2.3l-6.6 6.6a1.6 1.6 0 0 1-2.3 0L3.5 12.4a1.6 1.6 0 0 1-.5-1.1zM6.1 7.8a1.7 1.7 0 1 0 3.4 0a1.7 1.7 0 1 0 -3.4 0z\"/>", "refresh": "<path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2.3\" d=\"M4.6 11a7.5 7.5 0 0 1 13.2-4.3L20 9M20 4v5h-5M19.4 13a7.5 7.5 0 0 1-13.2 4.3L4 15M4 20v-5h5\"/>", "sun": "<path fill=\"currentColor\" stroke=\"none\" d=\"M7.6 12a4.4 4.4 0 1 0 8.8 0a4.4 4.4 0 1 0 -8.8 0z\"/><path fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2.2\" d=\"M12 2.4v2.2M12 19.4v2.2M5.2 5.2l1.6 1.6M17.2 17.2l1.6 1.6M2.4 12h2.2M19.4 12h2.2M5.2 18.8l1.6-1.6M17.2 6.8l1.6-1.6\"/>", "moon": "<path fill=\"currentColor\" stroke=\"none\" d=\"M20.6 14.6A8.6 8.6 0 0 1 9.4 3.4a8.6 8.6 0 1 0 11.2 11.2z\"/>"};
  var APPS = {"instagram": ["camera", "", "", "", "Instagram"], "whatsapp": ["chat", "", "", "", "WhatsApp"], "youtube": ["play", "", "", "", "YouTube"], "linkedin": ["briefcase", "", "", "", "LinkedIn"], "pinterest": ["pin", "", "", "", "Pinterest"], "x": ["at", "", "", "", "X"], "facebook": ["people", "", "", "", "Facebook"], "threads": ["bubbles", "", "", "", "Threads"], "telegram": ["plane", "", "", "", "Telegram"], "email": ["mail", "", "", "", "Email"], "phone": ["phone", "", "", "", "Phone"], "rss": ["feed", "", "", "", "RSS feed"], "website": ["globe", "", "", "", "Website"], "copy": ["link", "", "", "", "Copy link"], "more": ["more", "", "", "", "More"], "share": ["share", "", "", "", "Share"], "save": ["save", "", "", "", "Save"], "like": ["heart", "", "", "", "Like"], "comment": ["comment", "", "", "", "Comment"], "print": ["print", "", "", "", "Print"], "download": ["download", "", "", "", "Download"], "send": ["send", "", "", "", "Send"], "link": ["link", "", "", "", "Link"], "calendar": ["calendar", "", "", "", "Book"]};   // v11: [glyph, -, -, -, label]; flat tiles, colours come from engage.css
  var BRANDS = [];   // v11.1: set by scripts/build_v11.py from assets/icons/brands/
  function tile(k, size) {
    var a = APPS[k] || APPS.more, soft = k === 'copy' || k === 'more';
    var face = BRANDS.indexOf(k) > -1 ? '<i class="nx-bm" style="--bm:url(/assets/icons/brands/' + k + '.svg)"></i>'
      : '<svg class="nx-f" viewBox="0 0 24 24">' + GLYPH[a[0]] + '</svg>';
    return '<span class="nx-app nx-app--' + (APPS[k] ? k : 'more') + (soft ? ' nx-app--soft' : '') + '"' + (size ? ' style="--s:' + size + 'px"' : '') + ' aria-hidden="true">' + face + '</span>';
  }
  var FOLLOW = [['instagram', 'Instagram', 'https://www.instagram.com/_nmxlabs/'], ['linkedin', 'LinkedIn', 'https://www.linkedin.com/company/nmxlabs'],
    ['pinterest', 'Pinterest', 'https://in.pinterest.com/nmxlabs/'], ['youtube', 'YouTube', 'https://www.youtube.com/channel/UC-Y-8OmJ7tm285GW8VNRBwQ']];
  window.NMX_FOLLOW = FOLLOW;
  function followRow(where) {
    return '<div class="nx-follow" role="list">' + FOLLOW.map(function (f) {
      return '<a role="listitem" href="' + f[2] + '" target="_blank" rel="noopener" data-nx-followlink="' + f[0] + '" data-where="' + where + '" title="Follow NMX Labs on ' + f[1] + '">' +
        tile(f[0]) + '<span>' + f[1] + '</span></a>';
    }).join('') + '</div>';
  }
  doc.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('[data-nx-followlink]'); if (!a) return;
    var net = a.getAttribute('data-nx-followlink'), where = a.getAttribute('data-where') || '';
    logEvent('follow_click', net + '|' + where); track('FollowClick', { network: net, placement: where, page_path: path });
    var f = readJSON('nmx-followed', []); if (f.indexOf(net) < 0) { f.push(net); store('nmx-followed', JSON.stringify(f)); }
    if (where === 'cafe') setTimeout(hideSheet, 150);
  });

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
    if (kind === 'alerts') renderAlerts(); else if (kind === 'guide') renderGuide(arg); else if (kind === 'share') renderShare(); else renderAsk();
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
  doc.addEventListener('pointerdown', function (e) { if (openKind && !rootEl.contains(e.target) && !(e.target.closest && e.target.closest('.nx-endcard,[data-nx-share]'))) closePanel(); });

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
      vid: VID, email: read('nmx-sub-email') || '', standalone: STANDALONE ? '1' : '', tc: FIRST.tc || SES.tc || '', td: FIRST.td || SES.td || '',
      sn: SES.sn || '', pl: SES.pl || '', ct: SES.ct || '', ut: SES.ut || '' };
  }
  // Saving can take a few seconds, so it runs in the background with retries.
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
        try { doc.dispatchEvent(new CustomEvent('nmx:push-saved', { detail: { id: st.id } })); } catch (e) {}   // v9: curate.js offers topics
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
  /* =========================================================== v10: the coffee card (asking at the right moment) */
  // A centred card with a steaming coffee cup, once a reader is a few lines into a post or lesson and scrolling on. It
  // never opens on arrival, never twice in a visit, and "Maybe later" keeps it away for 3, then 10, then 30 days.
  // Where notifications can work it offers them (plus follow links); where they can't (in-app browsers, blocked or
  // unsupported browsers) it offers the follow links on their own. Headlines rotate so regulars don't see a joke twice.
  function quietNow() {
    return !snoozed() && !ssGet('nmx-prompted') && !openKind && sheet.hidden && !(doc.activeElement && /INPUT|TEXTAREA|SELECT/.test(doc.activeElement.tagName)) &&
      !$('.player:not([hidden])') && !doc.querySelector('[data-game-active]');
  }
  function cafeMode() {
    if (!quietNow() || isOn()) return '';
    if (PUSH_ON && (PUSH_API || IOS_NEEDS_INSTALL) && !INAPP && permission() === 'default' && !pushState()) return IOS_NEEDS_INSTALL ? 'ios' : 'push';
    return readJSON('nmx-followed', []).length >= 2 ? '' : 'follow';
  }
  function canPrompt() { var m = cafeMode(); return m === 'push' || m === 'ios'; }
  function lesson() { return /^\/learn\/[^/]+\//.test(path); }
  var QUIPS = [
    ['Four lines in. That’s basically a coffee date.', 'Let’s make it a regular thing: one quiet ping when a new {noun} is out of the pot. We brew 3–4 a week.'],
    ['Don’t let the next {noun} go cold.', 'Get a ping the moment it’s served. No inbox, no account, off in one tap.'],
    ['Fresh posts, freshly brewed.', 'Design, AI and marketing, 3–4 times a week. Want a ping when the next one’s poured?'],
    ['We roast brands, not readers.', 'One ping per new {noun}. Zero spam, zero guilt trips, gone whenever you like.'],
    ['This {noun} pairs well with coffee.', 'The next one pairs well with a notification. Allow it and we’ll ring when it’s ready.'],
    ['Running low on brain fuel?', 'Free refills every week: one ping when a new {noun} lands. Decaf on spam, promise.']
  ];
  var FOLLOW_QUIPS = [
    ['Want seconds?', 'Follow NMX Labs and the next {noun} turns up in your feed, still warm.'],
    ['Same beans, different cup.', 'Catch every new {noun} on LinkedIn, Pinterest, Instagram or YouTube. We brew 3–4 a week.'],
    ['Don’t let the next {noun} go cold.', 'Follow NMX Labs where you already scroll. One tap, no sign-up.']
  ];
  function bean(cls, x, y, r) {
    return '<g transform="translate(' + x + ' ' + y + ') rotate(' + r + ')"><g class="nx-bean ' + cls + '"><ellipse class="nx-bean-b" rx="6.6" ry="9.2"/><path class="nx-bean-c" d="M.6-8.2c-3.6 4.4 3 11-.6 16.4"/></g></g>';
  }
  var CUP = '<svg class="nx-cup" viewBox="0 0 200 160" aria-hidden="true">' +
    '<defs><clipPath id="nxMug"><path d="M54 70h92v26c0 25-19 42-46 42s-46-17-46-42z"/></clipPath>' +
    '<linearGradient id="nxMugG" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fffdf8"/><stop offset=".7" stop-color="#fff"/><stop offset="1" stop-color="#e9e2d4"/></linearGradient></defs>' +
    '<g class="nx-steam"><path class="s1" d="M84 56c-7-7 7-12 0-21s7-14 0-22"/><path class="s2" d="M100 52c-7-7 7-12 0-21s7-14 0-23"/><path class="s3" d="M116 56c-7-7 7-12 0-21s7-14 0-22"/></g>' +
    '<ellipse class="nx-saucer-sh" cx="100" cy="149" rx="66" ry="7"/><ellipse class="nx-saucer" cx="100" cy="142" rx="74" ry="13"/><ellipse class="nx-saucer-in" cx="100" cy="139" rx="48" ry="7.5"/>' +
    '<path class="nx-handle" d="M143 86c17-3 26 5 24 18s-13 20-28 19"/>' +
    '<path class="nx-mug" d="M54 70h92v26c0 25-19 42-46 42s-46-17-46-42z"/>' +
    '<g clip-path="url(#nxMug)"><path class="nx-band" d="M50 92h100v13H50z"/><path class="nx-band-dot" d="M96 98.5h8"/></g>' +
    '<ellipse class="nx-rim" cx="100" cy="70" rx="46" ry="9.5"/><ellipse class="nx-coffee" cx="100" cy="71" rx="40" ry="7"/>' +
    '<ellipse class="nx-ripple" cx="100" cy="71" rx="10" ry="2"/>' +
    '<path class="nx-crema" d="M92 70.6c2.4-3.4 7.2-3.4 8 0 .8-3.4 5.6-3.4 8 0-2.4 2.6-5.4 4.2-8 5-2.6-.8-5.6-2.4-8-5z"/>' +
    bean('b1', 38, 134, -24) + bean('b2', 160, 131, 28) + bean('b3', 146, 148, 82) + bean('b4', 100, 12, 0) +
    '</svg>';
  var lastFocus = null;
  function showSheet(reason) {
    var mode = cafeMode(); if (!mode) return;
    ssSet('nmx-prompted', '1');
    var noun = lesson() ? 'lesson' : 'post', list = mode === 'follow' ? FOLLOW_QUIPS : QUIPS, key = mode === 'follow' ? 'nmx-quip-f' : 'nmx-quip';
    var n = (Number(read(key) || -1) + 1) % list.length; store(key, String(n));
    var q = list[n], h = q[0].replace(/\{noun\}/g, noun), body = q[1].replace(/\{noun\}/g, noun);
    if (mode === 'ios') { h = 'Get new ' + noun + 's on your iPhone'; body = 'Add NMX Labs to your Home Screen, then tap Follow. Apple only allows website notifications that way. Ten seconds, tops.'; }
    var sub = $('.subscribe'), primary = mode === 'push' ? '<button type="button" class="nx-cafe-go" data-sheet="yes">' + I.bell + '<span>Ping me when it’s fresh</span></button>'
      : mode === 'ios' ? '<button type="button" class="nx-cafe-go" data-sheet="ios">' + I.phone + '<span>Show me how</span></button>' : '';
    lastFocus = doc.activeElement;
    sheet.className = 'nx-sheet nx-sheet--cafe'; sheet.setAttribute('aria-modal', 'true');
    sheet.innerHTML = '<div class="nx-cafe" data-mode="' + mode + '" tabindex="-1">' +
      '<button class="nx-x" type="button" aria-label="Close" data-sheet="no" data-no-track>' + I.x + '</button>' +
      '<div class="nx-cafe-art">' + CUP + '</div>' +
      '<p class="nx-cafe-kick">' + (mode === 'ios' ? 'iPhone readers, one quick step' : 'Enjoying this ' + noun + '?') + '</p>' +
      '<h2 id="nxSheetT">' + esc(h) + '</h2><p class="nx-cafe-body">' + esc(body) + '</p>' + primary +
      (primary ? '<p class="nx-cafe-or"><span>or follow NMX Labs</span></p>' : '') + followRow('cafe') +
      (mode === 'follow' && sub ? '<button type="button" class="nx-cafe-alt" data-sheet="email">Get new posts by email instead</button>' : '') +
      '<button type="button" class="nx-cafe-later" data-sheet="no">Maybe later</button>' +
      '</div>';
    sheet.hidden = false; sheet.setAttribute('data-reason', mode === 'follow' ? 'social_card' : mode === 'ios' ? reason + '_ios' : reason);
    doc.documentElement.classList.add('nx-lock');
    var card = $('.nx-cafe', sheet); setTimeout(function () { try { card.focus({ preventScroll: true }); } catch (e) { card.focus(); } }, 60);   // Tab moves on to the buttons
    logEvent('prompt_shown', sheet.getAttribute('data-reason') + ':q' + n);
    track(mode === 'follow' ? 'FollowPromptShown' : 'PushPromptShown', { reason: reason, mode: mode, page_path: path, quip: n });
  }
  function hideSheet() {
    if (sheet.hidden || sheet.classList.contains('nx-sheet--out')) return;
    doc.documentElement.classList.remove('nx-lock');
    var done = function () { sheet.hidden = true; sheet.innerHTML = ''; sheet.className = 'nx-sheet'; sheet.setAttribute('aria-modal', 'false'); };
    if (REDUCED) done(); else { sheet.classList.add('nx-sheet--out'); setTimeout(done, 230); }
    if (lastFocus && lastFocus.focus && doc.contains(lastFocus)) { try { lastFocus.focus({ preventScroll: true }); } catch (e) {} }
    lastFocus = null;
  }
  function dismissSheet() {
    if (sheet.hidden || sheet.classList.contains('nx-sheet--out')) return;
    snooze(); logEvent('prompt_later', sheet.getAttribute('data-reason') || ''); hideSheet();
  }
  sheet.addEventListener('click', function (e) {
    if (e.target === sheet) { dismissSheet(); return; }                          // tapped the dimmed background
    var b = e.target.closest('[data-sheet]'); if (!b) return;
    var a = b.getAttribute('data-sheet');
    if (a === 'yes') { hideSheet(); enable('blog,youtube', 'read_prompt'); }
    else if (a === 'ios') { hideSheet(); openPanel('alerts'); }
    else if (a === 'email') {
      logEvent('prompt_yes', 'social_card:email'); hideSheet();
      var box = $('.subscribe'); if (box) { box.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'center' }); var inp = $('input[type="email"]', box); if (inp) setTimeout(function () { inp.focus({ preventScroll: true }); }, 500); }
    }
    else dismissSheet();
  });
  sheet.addEventListener('keydown', function (e) {                                // keep Tab inside the card while it's open
    if (e.key !== 'Tab' || sheet.hidden) return;
    var f = $$('button, a[href]', sheet); if (!f.length) return;
    if (e.shiftKey && doc.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && doc.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  });
  (function watchReading() {
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
      var send = READY ? post({ action: 'lead', name: name, contact: contact, message: msg, path: path, vid: VID, website: '', tc: SES.tc || '', td: SES.td || '' })
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
      saveBtn.setAttribute('aria-pressed', String(on)); saveBtn.innerHTML = (on ? I.marked : I.mark) + '<span>' + (on ? 'Saved' : 'Save for later') + '</span>';
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

  /* =========================================================== v10: share */
  // A Share button in the article tools and at the end of every post and lesson. Phones and tablets get their own share
  // menu; computers get a share sheet with the usual apps, Copy link and (where the browser has one) More options.
  // Shared links carry utm tags, so visits from them show under the right source on the dashboard.
  var SHARE_NETS = [['whatsapp', 'WhatsApp'], ['linkedin', 'LinkedIn'], ['x', 'X'], ['facebook', 'Facebook'], ['pinterest', 'Pinterest'], ['email', 'Email']];
  var SHARE_IC = '<svg class="nx-f" viewBox="0 0 24 24" aria-hidden="true">' + GLYPH.share + '</svg>';
  function shareInfo() {
    var canon = $('link[rel="canonical"]'), meta = function (sel) { var m = $(sel); return m ? m.getAttribute('content') || '' : ''; };
    var h1 = $('#article .article-head h1') || $('main h1');
    return { url: canon ? canon.href : location.origin + path, title: ((h1 && h1.textContent) || meta('meta[property="og:title"]') || doc.title).trim(),
      dek: meta('meta[name="description"]'), img: meta('meta[property="og:image"]') };
  }
  function tagged(u, net) { return u + (u.indexOf('?') > -1 ? '&' : '?') + 'utm_source=' + net + '&utm_medium=' + (net === 'email' ? 'email' : 'social') + '&utm_campaign=share'; }
  function shareHref(net, s) {
    var u = encodeURIComponent(tagged(s.url, net)), t = encodeURIComponent(s.title);
    if (net === 'whatsapp') return 'https://wa.me/?text=' + encodeURIComponent(s.title + ' ' + tagged(s.url, net));
    if (net === 'linkedin') return 'https://www.linkedin.com/sharing/share-offsite/?url=' + u;
    if (net === 'x') return 'https://x.com/intent/tweet?text=' + t + '&url=' + u;
    if (net === 'facebook') return 'https://www.facebook.com/sharer/sharer.php?u=' + u;
    if (net === 'pinterest') return 'https://www.pinterest.com/pin/create/button/?url=' + u + (s.img ? '&media=' + encodeURIComponent(s.img) : '') + '&description=' + t;
    return 'mailto:?subject=' + t + '&body=' + encodeURIComponent((s.dek ? s.dek + '\n\n' : '') + tagged(s.url, net));
  }
  function shareLog(how) { logEvent('share', how + '|' + path); track('Share', { method: how, content_type: lesson() ? 'lesson' : 'post', item_id: path }); }
  function shareNow(from) {
    var s = shareInfo();
    if (navigator.share && (U.dev !== 'Desktop' || from === 'more')) {
      navigator.share({ title: s.title, url: s.url }).then(function () { shareLog('device'); })
        .catch(function (e) { if (e && e.name !== 'AbortError' && from !== 'more') openPanel('share'); });
      return;
    }
    openPanel('share');
  }
  function renderShare() {
    var s = shareInfo();
    panel.innerHTML = head('Share') + '<div class="nx-body nx-share">' +
      '<div class="nx-share-card">' + (s.img ? '<img src="' + esc(s.img) + '" alt="" width="64" height="64">' : '') + '<div><b>' + esc(s.title) + '</b><span>' + esc(s.url.replace(/^https?:\/\//, '').replace(/\/$/, '')) + '</span></div></div>' +
      '<div class="nx-share-apps">' + SHARE_NETS.map(function (n) {
        return '<a href="' + esc(shareHref(n[0], s)) + '"' + (n[0] === 'email' ? '' : ' target="_blank" rel="noopener"') + ' data-share-net="' + n[0] + '">' + tile(n[0]) + '<span>' + n[1] + '</span></a>';
      }).join('') + '</div>' +
      '<div class="nx-share-list"><button type="button" data-share-copy data-nx-focus>' + tile('copy', 30) + '<span>Copy link</span></button>' +
      (navigator.share ? '<button type="button" data-share-more>' + tile('more', 30) + '<span>More options</span></button>' : '') + '</div>' +
      '<p class="nx-share-follow">Follow NMX Labs on <a href="' + FOLLOW[1][2] + '" target="_blank" rel="noopener" data-nx-followlink="linkedin" data-where="share">LinkedIn</a> and ' +
      '<a href="' + FOLLOW[2][2] + '" target="_blank" rel="noopener" data-nx-followlink="pinterest" data-where="share">Pinterest</a>.</p></div>';
    panel.querySelector('.nx-share-apps').addEventListener('click', function (e) {
      var a = e.target.closest('[data-share-net]'); if (!a) return; shareLog(a.getAttribute('data-share-net')); setTimeout(closePanel, 200);
    });
    var cp = $('[data-share-copy]', panel);
    cp.addEventListener('click', function () {
      var done = function () { $('span', cp).textContent = 'Copied'; cp.classList.add('is-done'); shareLog('copy'); setTimeout(closePanel, 900); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(s.url).then(done, function () { $('span', cp).textContent = s.url; });
      else { $('span', cp).textContent = s.url; }
    });
    var more = $('[data-share-more]', panel);
    if (more) more.addEventListener('click', function () { closePanel(); shareNow('more'); });
  }
  (function shareButtons() {
    var art = $('#article'), prose = art && $('.prose', art); if (!prose) return;
    var noun = lesson() ? 'lesson' : 'post';
    var tl = $('.tools[aria-label="Article tools"]', art);
    if (tl && !$('[data-nx-share]', tl)) {
      var b = doc.createElement('button'); b.type = 'button'; b.className = 'tool'; b.setAttribute('data-nx-share', ''); b.setAttribute('data-no-track', '');
      b.innerHTML = SHARE_IC + '<span>Share</span>'; tl.appendChild(b);
    }
    var row = doc.createElement('aside'); row.className = 'nx-sharerow'; row.setAttribute('aria-label', 'Share and follow');
    row.innerHTML = '<div><h2>Know someone who’d like this?</h2><p>Send it their way. And follow NMX Labs on <a href="' + FOLLOW[1][2] + '" target="_blank" rel="noopener" data-nx-followlink="linkedin" data-where="post_end">LinkedIn</a> and ' +
      '<a href="' + FOLLOW[2][2] + '" target="_blank" rel="noopener" data-nx-followlink="pinterest" data-where="post_end">Pinterest</a> for the next one.</p></div>' +
      '<button type="button" class="nx-btn nx-btn--ink" data-nx-share data-no-track>' + SHARE_IC + '<span>Share this ' + noun + '</span></button>';
    prose.parentNode.insertBefore(row, prose.nextSibling);
  })();
  doc.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-nx-share]'); if (!b) return;
    e.preventDefault(); if (openKind === 'share') { closePanel(); return; } shareNow('button');
  });

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

  window.NMX_ENGAGE = { open: openPanel, close: closePanel, pushState: pushState, ready: READY, pushOn: PUSH_ON, follow: enable, fix: function (r) { openPanel('guide', r || 'system'); }, share: function () { shareNow('api'); }, version: 'v10' };
})();
