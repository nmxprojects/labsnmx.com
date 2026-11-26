/* NMX Labs curate layer (v9, 26 Nov 2026). Loaded by /assets/engage.js on every page. Holds no keys.
   - Picks by country: works out the reader's country from their time zone (never their IP address) and shows
     "Picked for you" posts on the blog, stories on the news page and reading on the services page. Readers can change it.
   - Personalise: a short sheet where readers choose topics, how often, how to hear from us, and optionally their
     name, email and WhatsApp number. Saved on the device; sent to us only when they tick the consent box.
   - Reading interests: which topics a reader opens, kept on the device and summarised once a day with their other
     visit details (no IP address, no fingerprinting; nothing is sent when the browser asks not to be tracked).
   - Approximate prices in the reader's currency on the services page, and one-click unsubscribe links from emails. */
(function () {
  'use strict';
  if (window.NMX_CURATE) return; window.NMX_CURATE = true;
  var doc = document, path = location.pathname, CFG = window.NMX_CFG || {};
  var READY = typeof window.NMX_backendReady === 'function' && window.NMX_backendReady();
  var NO_TRACK = navigator.doNotTrack === '1' || window.doNotTrack === '1' || navigator.globalPrivacyControl === true;
  var BOT = navigator.webdriver || /bot|crawl|spider|slurp|lighthouse|headless|preview/i.test(navigator.userAgent || '');
  function $(s, c) { return (c || doc).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); }
  function read(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function store(k, v) { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} }
  function readJSON(k, d) { try { var v = JSON.parse(read(k)); return v == null ? d : v; } catch (e) { return d; } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function today() { return new Date().toISOString().slice(0, 10); }
  function track(n, p) { try { if (window.nmxTrack) window.nmxTrack(n, p || {}); } catch (e) {} }
  function post(params) {
    return fetch(CFG.BACKEND_URL, { method: 'POST', body: new URLSearchParams(params) })
      .then(function (r) { return r.json(); })
      .then(function (d) { if (!d || !d.ok) throw new Error((d && d.error) || 'backend'); return d; });
  }
  function beacon(params) {
    var body = new URLSearchParams(params);
    try { if (navigator.sendBeacon && navigator.sendBeacon(CFG.BACKEND_URL, body)) return; } catch (e) {}
    fetch(CFG.BACKEND_URL, { method: 'POST', body: body, mode: 'no-cors', keepalive: true }).catch(function () {});
  }

  /* =========================================================== where the reader is (time zone, never IP) */
  var TZMAP = 'AD:Andorra;AE:Dubai;AF:Kabul;AG:Antigua;AI:Anguilla;AL:Tirane;AM:Yerevan;AO:Luanda;AQ:Casey,Davis,DumontDUrville,Mawson,McMurdo,Palmer,Rothera,Syowa,Troll,Vostok;AR:Buenos_Aires,Catamarca,Cordoba,Jujuy,La_Rioja,Mendoza,Rio_Gallegos,Salta,San_Juan,San_Luis,Tucuman,Ushuaia;AS:Pago_Pago;AT:Vienna;AU:Adelaide,Brisbane,Broken_Hill,Darwin,Eucla,Hobart,Lindeman,Lord_Howe,Macquarie,Melbourne,Perth,Sydney;AW:Aruba;AX:Mariehamn;AZ:Baku;BA:Sarajevo;BB:Barbados;BD:Dhaka,Dacca;BE:Brussels;BF:Ouagadougou;BG:Sofia;BH:Bahrain;BI:Bujumbura;BJ:Porto-Novo;BL:St_Barthelemy;BM:Bermuda;BN:Brunei;BO:La_Paz;BQ:Kralendijk;BR:Araguaina,Bahia,Belem,Boa_Vista,Campo_Grande,Cuiaba,Eirunepe,Fortaleza,Maceio,Manaus,Noronha,Porto_Velho,Recife,Rio_Branco,Santarem,Sao_Paulo;BS:Nassau;BT:Thimphu,Thimbu;BW:Gaborone;BY:Minsk;BZ:Belize;CA:Atikokan,Blanc-Sablon,Cambridge_Bay,Creston,Dawson,Dawson_Creek,Edmonton,Fort_Nelson,Glace_Bay,Goose_Bay,Halifax,Inuvik,Iqaluit,Moncton,Rankin_Inlet,Regina,Resolute,St_Johns,Swift_Current,Toronto,Vancouver,Whitehorse,Winnipeg;CC:Cocos;CD:Kinshasa,Lubumbashi;CF:Bangui;CG:Brazzaville;CH:Zurich;CI:Abidjan;CK:Rarotonga;CL:Coyhaique,Easter,Punta_Arenas,Santiago;CM:Douala;CN:Shanghai,Urumqi,Chungking,Chongqing,Harbin;CO:Bogota;CR:Costa_Rica;CU:Havana;CV:Cape_Verde;CW:Curacao;CX:Christmas;CY:Famagusta,Nicosia;CZ:Prague;DE:Berlin,Busingen;DJ:Djibouti;DK:Copenhagen;DM:Dominica;DO:Santo_Domingo;DZ:Algiers;EC:Galapagos,Guayaquil;EE:Tallinn;EG:Cairo;EH:El_Aaiun;ER:Asmara;ES:Canary,Ceuta,Madrid;ET:Addis_Ababa;FI:Helsinki;FJ:Fiji;FK:Stanley;FM:Chuuk,Kosrae,Pohnpei;FO:Faroe;FR:Paris;GA:Libreville;GB:London;GD:Grenada;GE:Tbilisi;GF:Cayenne;GG:Guernsey;GH:Accra;GI:Gibraltar;GL:Danmarkshavn,Nuuk,Scoresbysund,Thule,Godthab;GM:Banjul;GN:Conakry;GP:Guadeloupe;GQ:Malabo;GR:Athens;GS:South_Georgia;GT:Guatemala;GU:Guam;GW:Bissau;GY:Guyana;HK:Hong_Kong;HN:Tegucigalpa;HR:Zagreb;HT:Port-au-Prince;HU:Budapest;ID:Jakarta,Jayapura,Makassar,Pontianak;IE:Dublin;IL:Jerusalem;IM:Isle_of_Man;IN:Kolkata,Calcutta;IO:Chagos;IQ:Baghdad;IR:Tehran;IS:Reykjavik;IT:Rome;JE:Jersey;JM:Jamaica;JO:Amman;JP:Tokyo;KE:Nairobi;KG:Bishkek;KH:Phnom_Penh;KI:Kanton,Kiritimati,Tarawa;KM:Comoro;KN:St_Kitts;KP:Pyongyang;KR:Seoul;KW:Kuwait;KY:Cayman;KZ:Almaty,Aqtau,Aqtobe,Atyrau,Oral,Qostanay,Qyzylorda;LA:Vientiane;LB:Beirut;LC:St_Lucia;LI:Vaduz;LK:Colombo;LR:Monrovia;LS:Maseru;LT:Vilnius;LU:Luxembourg;LV:Riga;LY:Tripoli;MA:Casablanca;MC:Monaco;MD:Chisinau;ME:Podgorica;MF:Marigot;MG:Antananarivo;MH:Kwajalein,Majuro;MK:Skopje;ML:Bamako;MM:Yangon,Rangoon;MN:Hovd,Ulaanbaatar,Ulan_Bator;MO:Macau,Macao;MP:Saipan;MQ:Martinique;MR:Nouakchott;MS:Montserrat;MT:Malta;MU:Mauritius;MV:Maldives;MW:Blantyre;MX:Bahia_Banderas,Cancun,Chihuahua,Ciudad_Juarez,Hermosillo,Matamoros,Mazatlan,Merida,Mexico_City,Monterrey,Ojinaga,Tijuana;MY:Kuala_Lumpur,Kuching;MZ:Maputo;NA:Windhoek;NC:Noumea;NE:Niamey;NF:Norfolk;NG:Lagos;NI:Managua;NL:Amsterdam;NO:Oslo;NP:Kathmandu,Katmandu;NR:Nauru;NU:Niue;NZ:Auckland,Chatham;OM:Muscat;PA:Panama;PE:Lima;PF:Gambier,Marquesas,Tahiti;PG:Bougainville,Port_Moresby;PH:Manila;PK:Karachi;PL:Warsaw;PM:Miquelon;PN:Pitcairn;PR:Puerto_Rico;PS:Gaza,Hebron;PT:Azores,Lisbon,Madeira;PW:Palau;PY:Asuncion;QA:Qatar;RE:Reunion;RO:Bucharest;RS:Belgrade;RU:Anadyr,Astrakhan,Barnaul,Chita,Irkutsk,Kaliningrad,Kamchatka,Khandyga,Kirov,Krasnoyarsk,Magadan,Moscow,Novokuznetsk,Novosibirsk,Omsk,Sakhalin,Samara,Saratov,Srednekolymsk,Tomsk,Ulyanovsk,Ust-Nera,Vladivostok,Volgograd,Yakutsk,Yekaterinburg;RW:Kigali;SA:Riyadh;SB:Guadalcanal;SC:Mahe;SD:Khartoum;SE:Stockholm;SG:Singapore;SH:St_Helena;SI:Ljubljana;SJ:Longyearbyen;SK:Bratislava;SL:Freetown;SM:San_Marino;SN:Dakar;SO:Mogadishu;SR:Paramaribo;SS:Juba;ST:Sao_Tome;SV:El_Salvador;SX:Lower_Princes;SY:Damascus;SZ:Mbabane;TC:Grand_Turk;TD:Ndjamena;TF:Kerguelen;TG:Lome;TH:Bangkok;TJ:Dushanbe;TK:Fakaofo;TL:Dili;TM:Ashgabat;TN:Tunis;TO:Tongatapu;TR:Istanbul;TT:Port_of_Spain;TV:Funafuti;TW:Taipei;TZ:Dar_es_Salaam;UA:Kyiv,Simferopol,Kiev;UG:Kampala;UM:Midway,Wake;US:Adak,Anchorage,Beulah,Boise,Center,Chicago,Denver,Detroit,Honolulu,Indianapolis,Juneau,Knox,Los_Angeles,Louisville,Marengo,Menominee,Metlakatla,Monticello,New_Salem,New_York,Nome,Petersburg,Phoenix,Sitka,Tell_City,Vevay,Vincennes,Winamac,Yakutat;UY:Montevideo;UZ:Samarkand,Tashkent;VA:Vatican;VC:St_Vincent;VE:Caracas;VG:Tortola;VI:St_Thomas;VN:Ho_Chi_Minh,Saigon;VU:Efate;WF:Wallis;WS:Apia;YE:Aden;YT:Mayotte;ZA:Johannesburg;ZM:Lusaka;ZW:Harare';
  var ZONES = {}; TZMAP.split(';').forEach(function (g) { var p = g.split(':'); p[1].split(',').forEach(function (c) { ZONES[c] = p[0]; }); });
  var TZ = ''; try { TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}
  var REGION_OF = { IN: 'in', PK: 'in', BD: 'in', NP: 'in', LK: 'in', BT: 'in', MV: 'in', GB: 'uk', IE: 'uk', IM: 'uk', JE: 'uk', GG: 'uk',
    US: 'us', CA: 'us', PR: 'us', AE: 'me', SA: 'me', QA: 'me', KW: 'me', BH: 'me', OM: 'me' };
  var REGION_LABEL = { in: 'India', uk: 'the UK', us: 'the US', me: 'the Middle East', global: 'everywhere' };
  var NEWS_REGION_NAME = { in: 'India', uk: 'UK', us: 'US', me: 'Middle East' };
  function countryName(cc) {
    try { if (window.Intl && Intl.DisplayNames) return new Intl.DisplayNames(['en'], { type: 'region' }).of(cc); } catch (e) {}
    return { IN: 'India', GB: 'the United Kingdom', US: 'the United States', AE: 'the UAE' }[cc] || cc;
  }
  var PREFS = readJSON('nmx-prefs', {});
  var GEO = (function () {
    var cc = ZONES[TZ.split('/').pop()] || '';
    if (!cc) { var r = (String((navigator.languages || [navigator.language || ''])[0] || '').split('-')[1] || '').toUpperCase(); if (/^[A-Z]{2}$/.test(r)) cc = r; }
    var auto = REGION_OF[cc] || 'global';
    var region = PREFS.region && PREFS.region !== 'auto' ? PREFS.region : auto;
    var name = cc ? countryName(cc) : 'your country';
    if (name === 'United States' || name === 'United Kingdom' || name === 'United Arab Emirates' || name === 'Netherlands' || name === 'Philippines') name = 'the ' + name;
    return { cc: cc, country: name, region: region, auto: auto, tz: TZ, chosen: !!(PREFS.region && PREFS.region !== 'auto') };
  })();
  window.NMX_GEO = GEO;
  function placeName() { return GEO.chosen ? REGION_LABEL[GEO.region] : GEO.country; }

  /* =========================================================== reading interests, kept on this device */
  var PROFILE = readJSON('nmx-profile', null) || { v: 1, first: today(), visits: 0, cats: {}, read: [], reads: 0, finished: 0, hours: [] };
  if (!PROFILE.hours || PROFILE.hours.length !== 24) PROFILE.hours = Array(24).fill(0);
  try { if (!sessionStorage.getItem('nmx-cur')) { sessionStorage.setItem('nmx-cur', '1'); PROFILE.visits++; PROFILE.hours[new Date().getHours()]++; } } catch (e) {}
  PROFILE.last = today();
  var crumb = $('#article .article-head .crumbs a[href^="/blog/category/"]');
  var THIS_CAT = crumb ? crumb.getAttribute('href').split('/')[3] : '';
  var THIS_SLUG = $('#article') ? path.replace(/^\/blog\/|\/(amp\/)?$/g, '') : '';
  if (THIS_SLUG && THIS_CAT) {
    PROFILE.cats[THIS_CAT] = (PROFILE.cats[THIS_CAT] || 0) + 1;
    PROFILE.read = [THIS_SLUG].concat((PROFILE.read || []).filter(function (s) { return s !== THIS_SLUG; })).slice(0, 60);
    PROFILE.reads++;
    var t0 = Date.now(), done = false;
    addEventListener('scroll', function () {
      if (done) return;
      var h = doc.documentElement.scrollHeight - innerHeight;
      if (h > 0 && scrollY / h > 0.7 && Date.now() - t0 > 45000) { done = true; PROFILE.finished++; saveProfile(); }
    }, { passive: true });
  }
  function saveProfile() { store('nmx-profile', JSON.stringify(PROFILE)); }
  saveProfile();
  function topCats(n) { return Object.keys(PROFILE.cats).sort(function (a, b) { return PROFILE.cats[b] - PROFILE.cats[a]; }).slice(0, n || 3); }
  function activeHours() {
    var h = PROFILE.hours.map(function (n, i) { return [i, n]; }).filter(function (x) { return x[1]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 3);
    return h.map(function (x) { return ('0' + x[0]).slice(-2) + ':00'; }).join(', ');
  }
  function signals() {
    var V = window.NMX_VISITOR || {}, T = window.NMX_TRAFFIC || {}, push = readJSON('nmx-push', null) || {}, c = navigator.connection || {};
    var sw = Math.min(screen.width || 0, screen.height || 0);
    return { vid: read('nmx-vid') || '', push_id: push.id || '', co: GEO.country.replace(/^the /, ''), cc: GEO.cc, region: GEO.region, tz: TZ,
      langs: (navigator.languages || [navigator.language || '']).slice(0, 4).join(','), dev: V.dev || '', os: V.os || '', br: V.br || '',
      screen: sw ? (sw < 480 ? 'Phone' : sw < 900 ? 'Tablet' : 'Large') + ' ' + screen.width + 'x' + screen.height : '',
      theme: matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'Dark' : 'Light', save_data: c.saveData ? 'Yes' : '',
      net: c.effectiveType || '', standalone: (matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone ? 'Yes' : '',
      notif: 'Notification' in window ? Notification.permission : 'unsupported', visits: PROFILE.visits, first_seen: PROFILE.first,
      reads: PROFILE.reads, finished: PROFILE.finished, read_topics: topCats(3).join(','), hours: activeHours(),
      first_tc: T.first || '', first_td: T.firstDetail || '', now_tc: T.now || '', now_td: T.detail || '', page: path };
  }
  // Once a day, a summary of the visit (no IP, no fingerprint). Skipped for bots and when the browser asks not to be tracked.
  if (READY && !NO_TRACK && !BOT && PROFILE.sent !== today() && PROFILE.visits > 0) {
    setTimeout(function () {
      var s = signals(); s.action = 'profile'; s.kind = 'auto';
      beacon(s); PROFILE.sent = today(); saveProfile();
    }, 4000);
  }

  /* =========================================================== what a reader picked (topics, region) */
  var TOPICS = [['ai-design', 'AI design'], ['adobe', 'Adobe'], ['meta-ads', 'Meta ads'], ['branding', 'Branding'], ['brand-stories', 'Brand stories'],
    ['growth', 'YouTube, Instagram and SEO'], ['global', 'Global stories'], ['design-news', 'Design news'], ['news', 'Daily news'], ['videos', 'Videos']];
  var ROLES = [['founder', 'Founder'], ['marketer', 'Marketer'], ['designer', 'Designer'], ['creator', 'Creator'], ['agency', 'Agency'], ['student', 'Student'], ['other', 'Something else']];
  function wants(cat) { return (PREFS.topics || []).indexOf(cat) > -1; }
  function score(regions, cat, date) {
    var s = 0, r = (regions || 'global').split(/\s+/);
    if (GEO.region !== 'global' && r.indexOf(GEO.region) > -1) s += 4;
    else if (r.indexOf('global') > -1) s += 1;
    if (wants(cat)) s += 3;
    if (PROFILE.cats[cat]) s += Math.min(2, PROFILE.cats[cat] / 2);
    return s + (date ? Number(String(date).replace(/-/g, '')) / 1e9 : 0);   // newest first when scores tie
  }
  function pickLine() {
    var where = { in: 'Indian brands and the platforms your team uses first', uk: 'UK campaigns first, then the tools every team uses', us: 'US brands first, then the tools every team uses',
      me: 'Gulf stories first, then the tools every team uses', global: 'Stories that work wherever you are' }[GEO.region];
    var t = (PREFS.topics || []).map(function (k) { for (var i = 0; i < TOPICS.length; i++) if (TOPICS[i][0] === k) return TOPICS[i][1]; return ''; }).filter(Boolean);
    return where + (t.length ? ', matched to your topics: ' + t.slice(0, 3).join(', ') + '.' : '. Pick your topics to sharpen this.');
  }
  function pickCard(o) {
    return '<li><a href="' + esc(o.href) + '" data-track="PickClick"><img src="' + esc(o.img) + '" alt="" width="640" height="360" loading="lazy" decoding="async">' +
      '<span><small>' + esc(o.label) + '</small><b>' + esc(o.title) + '</b></span></a></li>';
  }

  /* ---------- blog page: "Picked for you" from the grid already on the page ---------- */
  function blogPicks() {
    var box = $('[data-pick]'), list = $('[data-pick-list]'); if (!box || !list) return;
    var band = $$('.mr-top, .mr-list a').map(function (a) { return a.getAttribute('href'); });
    var read = PROFILE.read || [];
    var items = $$('#postList .bt[data-post]').map(function (li) {
      var a = $('a', li), im = $('img', li);
      return { href: a.getAttribute('href'), slug: li.getAttribute('data-slug'), img: (im.getAttribute('src') || '').replace(/\.webp$/, '').replace(/-640$/, '') + '-640.webp',
        title: $('.bt-title', li).textContent, label: $('.bt-cat', li).textContent, s: score(li.getAttribute('data-region'), li.getAttribute('data-cat'), $('time', li) ? $('time', li).getAttribute('datetime') : '') };
    }).filter(function (o) { return band.indexOf(o.href) < 0 && read.indexOf(o.slug) < 0; });
    items.sort(function (a, b) { return b.s - a.s; });
    var top = items.slice(0, 4); if (top.length < 4) return;
    $('#pickH').textContent = 'Picked for you in ' + placeName();
    $('[data-pick-line]').textContent = pickLine();
    list.innerHTML = top.map(pickCard).join('');
    box.hidden = false;
    // Hide the band while the filters are in use, so the matches come straight after the filters.
    var count = $('#fCount');
    function sync() { var on = /[?&](month|category|author|q)=/.test(location.search); $$('[data-band]').forEach(function (b) { b.style.display = on ? 'none' : ''; }); }
    if (count && window.MutationObserver) new MutationObserver(sync).observe(count, { childList: true, characterData: true, subtree: true });
    sync();
  }

  /* ---------- news page: stories for the reader's region ---------- */
  function newsPicks() {
    var front = $('.nw-front'); if (!front || GEO.region === 'global') return;
    var seen = {}, items = $$('.nw-item[id][data-region]').filter(function (a) { if (seen[a.id]) return false; seen[a.id] = 1; return a.getAttribute('data-region') === GEO.region; });
    if (items.length < 2) return;
    var sec = doc.createElement('section'); sec.className = 'pick pick--news'; sec.setAttribute('aria-labelledby', 'pickNH');
    sec.innerHTML = '<div class="pick-head"><div><h2 id="pickNH">News for readers in ' + esc(placeName()) + '</h2><p>' + items.length + ' ' + esc(NEWS_REGION_NAME[GEO.region]) +
      ' stories in this edition. Everything else is below.</p></div><button class="pick-change" type="button" data-personalise>Change region</button></div>' +
      '<ul class="pick-list pick-list--text">' + items.slice(0, 4).map(function (a) {
        var tag = $('.nw-tag', a); return '<li><a href="#' + esc(a.id) + '"><span><small>' + esc(tag ? tag.textContent : 'News') + '</small><b>' + esc(a.getAttribute('data-title') || ($('h3', a) || {}).textContent || '') + '</b></span></a></li>';
      }).join('') + '</ul>';
    front.parentNode.insertBefore(sec, front);
  }

  /* ---------- services page: region note, prices in the reader's currency, reading picks ---------- */
  var CURRENCY = { US: 'USD', GB: 'GBP', IE: 'EUR', DE: 'EUR', FR: 'EUR', NL: 'EUR', ES: 'EUR', IT: 'EUR', BE: 'EUR', AT: 'EUR', PT: 'EUR', FI: 'EUR', GR: 'EUR',
    AE: 'AED', SA: 'SAR', QA: 'QAR', KW: 'KWD', BH: 'BHD', OM: 'OMR', SG: 'SGD', AU: 'AUD', NZ: 'NZD', CA: 'CAD', CH: 'CHF', SE: 'SEK', NO: 'NOK', DK: 'DKK',
    JP: 'JPY', MY: 'MYR', HK: 'HKD', ZA: 'ZAR', NP: 'NPR', LK: 'LKR', BD: 'BDT', PK: 'PKR' };
  function rates(cur) {
    var c = readJSON('nmx-fx', null);
    if (c && c.r && c.r[cur] && Date.now() - c.t < 12 * 36e5) return Promise.resolve(c.r[cur]);
    return fetch('https://open.er-api.com/v6/latest/INR').then(function (r) { return r.json(); }).then(function (d) {
      if (!d || !d.rates || !d.rates[cur]) throw new Error('fx'); store('nmx-fx', JSON.stringify({ t: Date.now(), r: d.rates })); return d.rates[cur];
    });
  }
  function servicesPage() {
    var note = $('[data-sv-region]');
    var cur = CURRENCY[GEO.cc];
    if (note && GEO.auto !== 'in' && GEO.cc && GEO.cc !== 'IN') {
      note.innerHTML = 'Visiting from ' + esc(GEO.country) + '? We work with brands outside India too, remotely and on the same fixed prices. Prices are in Indian rupees.';
      note.hidden = false;
    }
    if (cur) rates(cur).then(function (rate) {
      var fmt; try { fmt = new Intl.NumberFormat(undefined, { style: 'currency', currency: cur, maximumFractionDigits: 0 }); } catch (e) { return; }
      $$('[data-inr]').forEach(function (el) {
        var v = Number(el.getAttribute('data-inr')) * rate, step = v > 1000 ? 50 : v > 100 ? 5 : 1, out = el.parentNode.querySelector('.sv-fx') || el.nextElementSibling;
        if (!out || !out.classList.contains('sv-fx')) return;
        out.textContent = 'about ' + fmt.format(Math.round(v / step) * step) + ' at today’s rate'; out.hidden = false;
      });
      if (note && !note.hidden && !/your currency/.test(note.textContent)) note.textContent += ' The approximate amount in your currency is shown under each one.';
    }).catch(function () {});
    var box = $('[data-svc-picks]'); if (!box) return;
    fetch('/blog/posts.json').then(function (r) { return r.json(); }).then(function (d) {
      var CAT = {}; TOPICS.forEach(function (t) { CAT[t[1]] = t[0]; });
      var items = (d.posts || []).map(function (p) {
        return { href: '/blog/' + p.slug + '/', img: p.thumb_small || p.thumb, title: p.title, label: p.category,
          s: score((p.regions || ['global']).join(' '), CAT[p.category] || '', p.date) + (/Meta ads|Branding|AI design/.test(p.category) ? 0.5 : 0) };
      }).sort(function (a, b) { return b.s - a.s; }).slice(0, 4);
      if (items.length < 4) return;
      $('[data-svc-picks-h]').textContent = 'Reading picked for brands in ' + placeName();
      $('[data-svc-picks-list]').innerHTML = items.map(pickCard).join('');
      box.hidden = false;
    }).catch(function () {});
  }

  /* =========================================================== personalise sheet */
  var sheet, lastFocus;
  function chip(name, type, val, label, on) {
    return '<label><input type="' + type + '" name="' + name + '" value="' + esc(val) + '"' + (on ? ' checked' : '') + '><span>' + esc(label) + '</span></label>';
  }
  function buildSheet() {
    var P = PREFS, ch = P.channels || [], push = readJSON('nmx-push', null);
    var back = doc.createElement('div'); back.className = 'pf-back'; back.hidden = true;
    back.innerHTML = '<form class="pf" role="dialog" aria-modal="true" aria-labelledby="pfH" novalidate>' +
      '<div class="pf-top"><div><h2 id="pfH">Make NMX Labs yours</h2><p class="pf-lede">Pick what you want to read and how you want to hear about it. Every field is optional. It takes about 20 seconds.</p></div>' +
      '<button class="pf-x" type="button" data-pf-close aria-label="Close">×</button></div>' +
      '<fieldset><legend>Topics you care about</legend><div class="pf-chips">' + TOPICS.map(function (t) { return chip('topics', 'checkbox', t[0], t[1], (P.topics || []).indexOf(t[0]) > -1); }).join('') + '</div></fieldset>' +
      '<fieldset><legend>You are a…</legend><div class="pf-chips">' + ROLES.map(function (r) { return chip('role', 'radio', r[0], r[1], P.role === r[0]); }).join('') + '</div></fieldset>' +
      '<fieldset><legend>Show me stories for <span class="pf-hint">(we guessed ' + esc(GEO.auto === 'global' ? 'everywhere' : REGION_LABEL[GEO.auto]) + ' from your time zone)</span></legend>' +
      '<select name="region" aria-label="Region"><option value="auto">Work it out for me</option><option value="in">India</option><option value="uk">The UK</option><option value="us">The US</option>' +
      '<option value="me">The Middle East</option><option value="global">Everywhere</option></select></fieldset>' +
      '<fieldset><legend>How often</legend><div class="pf-chips">' + [['every', 'Every new post'], ['weekly', 'A weekly round-up'], ['big', 'Only the big stuff']].map(function (f) { return chip('freq', 'radio', f[0], f[1], P.freq === f[0]); }).join('') + '</div></fieldset>' +
      '<fieldset><legend>Tell me by</legend><div class="pf-chips">' + chip('channels', 'checkbox', 'push', 'Browser notifications', ch.indexOf('push') > -1 || !!push) + chip('channels', 'checkbox', 'email', 'Email', ch.indexOf('email') > -1) +
      chip('channels', 'checkbox', 'whatsapp', 'WhatsApp', ch.indexOf('whatsapp') > -1) + '</div></fieldset>' +
      '<fieldset><legend>About you <span class="pf-hint">(optional)</span></legend><div class="pf-fields">' +
      '<label>First name<input name="name" autocomplete="given-name" maxlength="60" value="' + esc(P.name || '') + '"></label>' +
      '<label>Brand or company<input name="brand" autocomplete="organization" maxlength="80" value="' + esc(P.brand || '') + '"></label>' +
      '<label class="pf-wide">Email<input name="email" type="email" autocomplete="email" maxlength="120" value="' + esc(P.email || read('nmx-sub-email') || '') + '" placeholder="you@company.com"></label>' +
      '<label class="pf-wide">WhatsApp number, with country code<input name="wa" type="tel" autocomplete="tel" maxlength="20" value="' + esc(P.wa || '') + '" placeholder="+91 98765 43210"></label>' +
      '</div></fieldset>' +
      '<label class="pf-check"><input type="checkbox" name="consent"' + (P.consent ? ' checked' : '') + '><span>Save my choices with NMX Labs so you can personalise the site and send me only what I picked, on the channels I ticked. I can change or delete them here any time. See the <a href="/privacy-policy.html#personalise">privacy policy</a>.</span></label>' +
      '<div class="pf-actions"><button class="btn" type="submit" data-track="PersonaliseSave">Save my choices</button><button class="btn btn--ghost" type="button" data-pf-close>Not now</button>' +
      '<span class="pf-status" role="status" aria-live="polite"></span><button class="pf-clear" type="button" data-pf-clear>Clear my choices</button></div></form>';
    doc.body.appendChild(back);
    var f = $('form', back);
    f.region.value = P.region || 'auto';
    back.addEventListener('click', function (e) { if (e.target === back || e.target.closest('[data-pf-close]')) closeSheet(); });
    back.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeSheet();
      if (e.key === 'Tab') {
        var els = $$('input,select,button,a[href]', f).filter(function (x) { return !x.disabled && x.offsetParent !== null; });
        if (!els.length) return;
        if (e.shiftKey && doc.activeElement === els[0]) { e.preventDefault(); els[els.length - 1].focus(); }
        else if (!e.shiftKey && doc.activeElement === els[els.length - 1]) { e.preventDefault(); els[0].focus(); }
      }
    });
    $('[data-pf-clear]', back).addEventListener('click', function () {
      var had = PREFS.consent; store('nmx-prefs', null); PREFS = {};
      if (had && READY) post({ action: 'profile', kind: 'delete', vid: read('nmx-vid') || '' }).catch(function () {});
      $('.pf-status', back).textContent = 'Cleared. Nothing about your choices is kept any more.'; f.reset(); f.region.value = 'auto';
      track('PersonaliseClear', {});
    });
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var st = $('.pf-status', f), all = function (n) { return $$('input[name="' + n + '"]:checked', f).map(function (x) { return x.value; }); };
      var one = function (n) { var x = $('input[name="' + n + '"]:checked', f); return x ? x.value : ''; };
      var email = f.email.value.trim(), wa = f.wa.value.replace(/[^\d+]/g, ''), channels = all('channels');
      st.classList.remove('is-err');
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { st.textContent = 'That email address doesn’t look right.'; st.classList.add('is-err'); f.email.focus(); return; }
      if (channels.indexOf('email') > -1 && !email) { st.textContent = 'Add your email to get posts by email, or untick Email.'; st.classList.add('is-err'); f.email.focus(); return; }
      if (channels.indexOf('whatsapp') > -1 && wa.replace(/\D/g, '').length < 10) { st.textContent = 'Add your WhatsApp number with its country code, or untick WhatsApp.'; st.classList.add('is-err'); f.wa.focus(); return; }
      var P = { topics: all('topics'), role: one('role'), region: f.region.value, freq: one('freq'), channels: channels, name: f.name.value.trim().slice(0, 60),
        brand: f.brand.value.trim().slice(0, 80), email: email, wa: wa, consent: f.consent.checked, at: today() };
      PREFS = P; store('nmx-prefs', JSON.stringify(P));
      GEO.region = P.region !== 'auto' ? P.region : GEO.auto; GEO.chosen = P.region !== 'auto';
      track('PersonaliseSave', { topics: P.topics.join(','), role: P.role, region: GEO.region, freq: P.freq, channels: channels.join(','), consent: P.consent });
      if (channels.indexOf('push') > -1 && !readJSON('nmx-push', null) && typeof window.nmxFollow === 'function') { try { window.nmxFollow('personalise'); } catch (x) {} }
      repaint();
      if (!P.consent || !READY) { st.textContent = P.consent ? 'Saved on this device.' : 'Saved on this device only. Tick the box above to let us send you what you picked.'; if (P.consent) setTimeout(closeSheet, 1400); return; }
      st.textContent = 'Saving…';
      var s = signals(); s.action = 'profile'; s.kind = 'prefs';
      s.topics = P.topics.join(','); s.role = P.role; s.freq = P.freq; s.channels = channels.join(','); s.name = P.name; s.brand = P.brand; s.email = email;
      s.wa = wa; s.wa_ok = channels.indexOf('whatsapp') > -1 ? '1' : ''; s.consent = '1'; s.region_choice = P.region;
      post(s).then(function (d) {
        st.textContent = d.subscribed ? 'Saved. Check your inbox for a welcome email.' : 'Saved. Your picks are updated.';
        if (d.subscribed || (email && channels.indexOf('email') > -1)) { store('nmx-subscribed', '1'); store('nmx-sub-email', email); }
        setTimeout(closeSheet, 1600);
      }).catch(function () { st.textContent = 'Saved on this device. We couldn’t reach the studio just now; we’ll try again on your next visit.'; PREFS.unsent = true; store('nmx-prefs', JSON.stringify(PREFS)); });
    });
    return back;
  }
  function openSheet(source) {
    lastFocus = doc.activeElement;
    sheet = sheet || buildSheet(); sheet.hidden = false; doc.documentElement.style.overflow = 'hidden';
    var first = $('input', sheet); if (first) first.focus();
    track('PersonaliseOpen', { source: source || 'button' });
  }
  function closeSheet() {
    if (!sheet) return; sheet.hidden = true; doc.documentElement.style.overflow = '';
    if (location.hash === '#personalise') history.replaceState(null, '', location.pathname + location.search);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  window.nmxPersonalise = openSheet;
  doc.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('[data-personalise]'); if (b) { e.preventDefault(); openSheet(b.getAttribute('data-personalise') || 'button'); } });
  // The blog's filters tidy the address bar as the page loads, so read the address the reader actually opened.
  var NAV = ''; try { NAV = (performance.getEntriesByType('navigation')[0] || {}).name || ''; } catch (e) {}
  if (location.hash === '#personalise' || /#personalise$|[?&]personalise=1\b/.test(NAV)) setTimeout(function () { openSheet('link'); }, 400);
  addEventListener('hashchange', function () { if (location.hash === '#personalise') openSheet('link'); });
  // Unsent choices from an earlier visit (the studio couldn't be reached then).
  if (PREFS.unsent && PREFS.consent && READY) {
    var s0 = signals(); s0.action = 'profile'; s0.kind = 'prefs'; s0.consent = '1';
    ['topics', 'channels'].forEach(function (k) { s0[k] = (PREFS[k] || []).join(','); });
    ['role', 'freq', 'name', 'brand', 'email', 'wa'].forEach(function (k) { s0[k] = PREFS[k] || ''; });
    s0.region_choice = PREFS.region || 'auto'; s0.wa_ok = (PREFS.channels || []).indexOf('whatsapp') > -1 ? '1' : '';
    post(s0).then(function () { delete PREFS.unsent; store('nmx-prefs', JSON.stringify(PREFS)); }).catch(function () {});
  }

  // A small offer after someone follows or subscribes: once, and never again after "No thanks".
  function offer(text) {
    if (PREFS.at || read('nmx-pf-offer') || $('.pf-offer')) return;
    store('nmx-pf-offer', today());
    var o = doc.createElement('div'); o.className = 'pf-offer'; o.setAttribute('role', 'status');
    o.innerHTML = '<span>' + esc(text) + '</span><button type="button" data-personalise="offer">Pick topics</button><button type="button" class="pf-offer-x" aria-label="No thanks">×</button>';
    doc.body.appendChild(o);
    $('.pf-offer-x', o).addEventListener('click', function () { o.remove(); });
    o.addEventListener('click', function (e) { if (e.target.closest('[data-personalise]')) o.remove(); });
    setTimeout(function () { if (o.parentNode) o.remove(); }, 20000);
  }
  doc.addEventListener('nmx:push-saved', function () { offer('Notifications are on. Want only the topics you care about?'); });
  $$('.subscribe').forEach(function (b) {
    if (!window.MutationObserver) return;
    new MutationObserver(function () { if (b.classList.contains('done') && read('nmx-sub-email')) offer('You’re subscribed. Want emails only on your topics?'); })
      .observe(b, { attributes: true, attributeFilter: ['class'] });
  });
  // A "Personalise" link in every footer.
  $$('.site-footer .footer-col').forEach(function (col) {
    var h = $('h4', col); if (!h || !/Studio/.test(h.textContent)) return;
    var ul = $('ul', col); if (!ul || $('[data-personalise]', ul)) return;
    var li = doc.createElement('li'); li.innerHTML = '<a class="foot-pf" href="#personalise" data-personalise="footer">Personalise what you see</a>';   // v11.1: styled like the other footer links ul.appendChild(li);
  });

  /* =========================================================== one-click unsubscribe links from emails */
  (function () {
    if (!/^\/unsubscribe\/?$/.test(path)) return;
    var q = new URLSearchParams(location.search || (NAV.split('#')[0].split('?')[1] || '')), email = q.get('e'), token = q.get('t'), card = $('.unsub-card');
    if (!email || !token || !card) return;
    var box = doc.createElement('div'); box.className = 'unsub-confirm';
    box.innerHTML = '<p>Unsubscribe <strong>' + esc(email) + '</strong> from new-post emails?</p><p><button class="btn" type="button">Yes, unsubscribe me</button></p><p class="u-status" role="status" aria-live="polite"></p>';
    card.insertBefore(box, card.firstChild);
    $('button', box).addEventListener('click', function () {
      var b = this, st = $('.u-status', box); b.disabled = true; st.textContent = 'Working…';
      post({ action: 'unsubscribe_confirm', email: email, token: token }).then(function () {
        st.textContent = 'Done. You won’t get new-post emails any more. Changed your mind? Subscribe again from the blog.'; store('nmx-subscribed', null); track('Unsubscribe', { route: 'site' });
      }).catch(function () { st.textContent = 'That link didn’t work. Use the form below and we’ll email you a fresh one.'; b.disabled = false; });
    });
  })();

  /* =========================================================== run */
  function repaint() {
    var old = $('.pick--news'); if (old) old.remove();
    if ($('[data-pick]')) blogPicks();
    newsPicks();
  }
  function start() { repaint(); if ($('[data-sv-region]') || $('[data-svc-picks]')) servicesPage(); }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start); else start();
})();
