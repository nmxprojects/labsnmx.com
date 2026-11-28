// Phone alerts for the site owner. Run by .github/workflows/owner-alerts.yml every 30 minutes.
// 1. Reads the last two days of events from your Apps Script backend with the same admin request the dashboard uses
//    (action=admin, op=raw), protected by the ADMIN_KEY secret.
// 2. Picks what's new since the last run: enquiries, new email subscribers, new notification subscribers. After 9 PM
//    India time it also sends one short summary of the day.
// 3. Sends standard Web Push (your existing VAPID keys) to the phones listed in the OWNER_PUSH secret: the codes shown
//    on labsnmx.com/dashboard/ under "Phone alerts", one per line. Readers never get these; they go only to those codes.
// The only thing kept between runs is a time stamp (.owner-alerts/state.json, in the Actions cache), so nothing repeats.
import webpush from 'web-push';
import { readFileSync, writeFileSync, mkdirSync, appendFileSync } from 'node:fs';

const env = process.env;
const SITE = 'https://labsnmx.com';
const STATE = '.owner-alerts/state.json';
const DIGEST_HOUR_IST = 21;          // the day's summary goes out at the first run after this hour (India time)
const MAX_LEADS = 3;                 // one alert per enquiry, up to this many per run (then "and N more")
const IST = 19800;

const fail = (m) => { console.error(`::error::${m}`); process.exit(1); };
const need = ['PUSH_API_URL', 'ADMIN_KEY', 'OWNER_PUSH', 'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY'];
const missing = need.filter((k) => !String(env[k] || '').trim());
if (missing.length) fail(`Missing repository secret(s): ${missing.join(', ')}. See labsnmx.com/dashboard/ > Phone alerts.`);
try { webpush.setVapidDetails((env.VAPID_SUBJECT || 'mailto:nmxprojects@gmail.com').trim(), env.VAPID_PUBLIC_KEY.trim(), env.VAPID_PRIVATE_KEY.trim()); }
catch (e) { fail(`VAPID keys rejected: ${e.message}`); }

function decodeCode(c) {
  c = c.trim(); if (!c) return null;
  if (c.startsWith('{')) { const j = JSON.parse(c); return j.endpoint ? { endpoint: j.endpoint, keys: j.keys, name: 'device' } : { endpoint: j.e, keys: { p256dh: j.p, auth: j.a }, name: j.d || 'phone' }; }
  const j = JSON.parse(Buffer.from(c.replace(/^nmx1\./, '').replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
  if (!j.e || !j.p || !j.a) throw new Error('incomplete');
  return { endpoint: j.e, keys: { p256dh: j.p, auth: j.a }, name: j.d || 'phone' };
}
const phones = String(env.OWNER_PUSH).split(/[\s,]+/).map((c) => {
  try { return decodeCode(c); } catch { console.log('::warning::One code in OWNER_PUSH couldn\'t be read. Copy it again from the dashboard.'); return null; }
}).filter(Boolean);
if (!phones.length) fail('OWNER_PUSH has no readable codes. Copy the code from labsnmx.com/dashboard/ > Phone alerts.');

let state = {};
try { state = JSON.parse(readFileSync(STATE, 'utf8')); } catch { /* first run */ }
const save = () => { mkdirSync('.owner-alerts', { recursive: true }); writeFileSync(STATE, JSON.stringify(state)); };

const now = Math.floor(Date.now() / 1000);
const istDay = (t) => new Date((t + IST) * 1000).toISOString().slice(0, 10);
const clip = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const notes = [];

if (String(env.TEST) === 'true') {
  notes.push({ title: 'Test alert from your dashboard', body: 'Phone alerts work. You\'ll get one for each new enquiry and for new subscribers, plus a summary at 9 PM.', tag: 'owner-test' });
} else {
  const res = await fetch(env.PUSH_API_URL.trim(), { method: 'POST', body: new URLSearchParams({ action: 'admin', key: env.ADMIN_KEY.trim(), op: 'raw', days: '2' }), redirect: 'follow' });
  let raw; try { raw = JSON.parse(await res.text()); } catch { fail(`The backend didn't answer with JSON (HTTP ${res.status}). Check PUSH_API_URL.`); }
  if (!raw.ok) fail(`Backend: ${raw.error || 'unknown error'} (is ADMIN_KEY the same key you use on the dashboard?)`);
  const dict = raw.dict || [], D = (i) => dict[i] || '';
  const rows = raw.visits || [];
  const since = state.last || now - 35 * 60;                     // first run: only the last half hour, so nothing old floods in
  let last = state.last || 0;
  const leadsEv = [], subsE = [], subsP = [];
  const sesSrc = {};
  for (const r of rows) {
    const t = Number(r[0]) || 0, type = D(r[1]);
    if (type === 'pageview' && !(r[3] in sesSrc)) sesSrc[r[3]] = (D(r[15]) || D(r[14]) || '').split(' · ')[0];
    if (t > last) last = t;
    if (t <= since) continue;
    if (type === 'lead') leadsEv.push({ t, page: D(r[4]), det: D(r[13]), src: sesSrc[r[3]] || '' });
    else if (type === 'email_subscribe' && !/^already/.test(D(r[13]))) subsE.push(sesSrc[r[3]] || '');
    else if (type === 'push_subscribe') subsP.push(sesSrc[r[3]] || '');
  }
  // Enquiries: the dashboard's lead list has the name and message; the visitor events are the fallback.
  const at = (v) => (typeof v === 'number' ? (v > 1e12 ? v / 1000 : v) : Date.parse(v) / 1000) || 0;
  let leads = (raw.leads || []).filter((l) => at(l.at) > since).map((l) => ({ name: l.name, msg: l.message, src: l.source, contact: l.contact }));
  if (!leads.length) leads = leadsEv.map((l) => ({ name: '', msg: l.det, src: l.src, contact: '' }));
  leads.slice(0, MAX_LEADS).forEach((l, i) => notes.push({
    title: 'New enquiry' + (l.name ? ' from ' + clip(l.name, 40) : ''),
    body: clip([l.msg, l.contact].filter(Boolean).join(' · '), 150) + (l.src ? ` (via ${clip(l.src, 30)})` : ''), tag: `owner-lead-${now}-${i}`,
  }));
  if (leads.length > MAX_LEADS) notes.push({ title: `${leads.length - MAX_LEADS} more enquiries`, body: 'Open the dashboard to see them all.', tag: `owner-lead-more-${now}` });
  const nSubs = subsE.length + subsP.length;
  if (nSubs) {
    const top = [...subsE, ...subsP].filter(Boolean).sort((a, b, c = [...subsE, ...subsP]) => c.filter((x) => x === b).length - c.filter((x) => x === a).length)[0];
    notes.push({
      title: nSubs === 1 ? 'New subscriber' : `${nSubs} new subscribers`,
      body: [subsE.length ? `${subsE.length} by email` : '', subsP.length ? `${subsP.length} to notifications` : ''].filter(Boolean).join(', ') + (top ? ` · mostly from ${top}` : ''),
      tag: `owner-subs-${now}`,
    });
  }
  // The day's summary, once, after 9 PM India time.
  const today = istDay(now), hour = new Date((now + IST) * 1000).getUTCHours();
  if (hour >= DIGEST_HOUR_IST && state.digest !== today) {
    const start = Date.parse(today + 'T00:00:00+05:30') / 1000, people = new Set(), visits = new Set(), src = {};
    let views = 0, subs = 0, enq = 0;
    for (const r of rows) {
      if (Number(r[0]) < start) continue;
      const type = D(r[1]);
      if (type === 'pageview') { views++; if (D(r[2])) people.add(r[2]); if (D(r[3]) && !visits.has(r[3])) { visits.add(r[3]); const s = sesSrc[r[3]] || 'Direct'; src[s] = (src[s] || 0) + 1; } }
      else if (type === 'push_subscribe' || (type === 'email_subscribe' && !/^already/.test(D(r[13])))) subs++;
      else if (type === 'lead') enq++;
    }
    const top = Object.entries(src).filter(([k]) => k && k !== 'Direct').sort((a, b) => b[1] - a[1])[0];
    notes.push({
      title: 'Today on labsnmx.com',
      body: `${people.size} people, ${views} page views.` + (top ? ` Most came from ${top[0]} (${top[1]}).` : '') + ` ${subs} new subscriber${subs === 1 ? '' : 's'}, ${enq} enquir${enq === 1 ? 'y' : 'ies'}.`,
      tag: `owner-digest-${today}`,
    });
    state.digest = today;
  }
  state.last = Math.max(last, since);
}

let sent = 0, gone = 0;
for (const n of notes) {
  const payload = JSON.stringify({ title: n.title, body: n.body, url: SITE + '/dashboard/', tag: n.tag, icon: '/dashboard/icons/icon-192.png' });
  for (const p of phones) {
    try { await webpush.sendNotification({ endpoint: p.endpoint, keys: p.keys }, payload, { TTL: 6 * 3600, urgency: 'high', timeout: 15000 }); sent++; }
    catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) { gone++; console.log(`::warning::The alert code for "${p.name}" has expired. Turn alerts on again in the dashboard and replace it in OWNER_PUSH.`); }
      else console.log(`::warning::Couldn't reach "${p.name}": ${e.statusCode || ''} ${String(e.body || e.message).slice(0, 120)}`);
    }
  }
}
save();
const line = notes.length ? `${notes.length} alert(s): ${notes.map((n) => n.title).join('; ')}. Delivered ${sent} to ${phones.length} phone(s).` : 'Nothing new.';
console.log(line);
if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, `### Owner alerts\n\n${line}\n`);
