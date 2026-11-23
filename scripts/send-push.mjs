// Sends one push campaign. Run by .github/workflows/send-push.yml; reads everything from environment variables.
// 1. Asks your Apps Script backend for the campaign and its subscribers (action=push_job, protected by PUSH_API_KEY)
// 2. Encrypts and sends one notification per subscriber with web-push (VAPID), 20 at a time
// 3. Reports delivered / expired / failed back (action=push_report); expired subscribers are never tried again
import webpush from 'web-push';
import { appendFileSync } from 'node:fs';

const env = process.env;
const need = ['PUSH_API_URL', 'PUSH_API_KEY', 'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY'];
const missing = need.filter((k) => !String(env[k] || '').trim());
if (missing.length) fail(`Missing repository secret(s): ${missing.join(', ')}. Add them in Settings > Secrets and variables > Actions.`);

const API = env.PUSH_API_URL.trim();
const KEY = env.PUSH_API_KEY.trim();
const SUBJECT = (env.VAPID_SUBJECT || 'mailto:nmxprojects@gmail.com').trim();
if (!/^https:\/\/script\.google\.com\/.+\/exec$/.test(API)) fail('PUSH_API_URL must be your Apps Script web-app URL ending in /exec.');
try {
  webpush.setVapidDetails(SUBJECT, env.VAPID_PUBLIC_KEY.trim(), env.VAPID_PRIVATE_KEY.trim());
} catch (e) {
  fail(`VAPID keys rejected: ${e.message}. Copy both keys again from labsnmx.com/tools/push-keys/ (no spaces or quotes).`);
}

function fail(msg) { console.error(`::error::${msg}`); process.exit(1); }

async function api(params, method = 'GET') {
  const all = { ...params, key: KEY };
  let res;
  if (method === 'POST') res = await fetch(API, { method: 'POST', body: new URLSearchParams(all), redirect: 'follow' });
  else { const u = new URL(API); for (const [k, v] of Object.entries(all)) u.searchParams.set(k, v); res = await fetch(u, { redirect: 'follow' }); }
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch {
    fail(`The backend didn't answer with JSON (HTTP ${res.status}). Check PUSH_API_URL, that the deployment is "Anyone", and that you deployed a new version after pasting Code-Blog.gs v4.`);
  }
  if (!data.ok) fail(`Backend: ${data.error || 'unknown error'}`);
  return data;
}

const clip = (s, n) => String(s || '').trim().slice(0, n);

let campaignId = clip(env.CAMPAIGN_ID, 40);
if (!campaignId) {
  if (clip(env.TITLE, 90).length < 3) fail('Nothing to send: run the workflow with a campaign_id, or with a Title for a manual message.');
  const reg = await api({ action: 'push_register', title: clip(env.TITLE, 90), message: clip(env.MESSAGE, 200), url: clip(env.LINK, 500) || 'https://labsnmx.com/blog/', audience: env.AUDIENCE || 'all' }, 'POST');
  campaignId = reg.id;
  console.log(`Registered manual campaign ${campaignId}`);
}

const job = await api({ action: 'push_job', campaign: campaignId });
const c = job.campaign;
const subs = job.subscribers || [];
console.log(`Campaign ${c.id} (${c.type}): "${c.title}" → ${subs.length} subscriber(s)`);

const base = {
  title: clip(c.title, 90),
  body: clip(c.body, 200),
  url: c.url || 'https://labsnmx.com/',
  image: /^https:\/\//.test(c.image) ? c.image : undefined,
  tag: `${c.type}-${c.id}`,
  campaign: c.id,
};
const ttl = c.type === 'test' ? 3600 : 2 * 24 * 3600;            // undelivered notifications expire after 2 days
const delivered = [], expired = [], failed = [];
const queue = subs.slice();

async function worker() {
  while (queue.length) {
    const s = queue.shift();
    const payload = JSON.stringify({ ...base, sid: s.id });
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, payload, { TTL: ttl, urgency: 'normal', timeout: 15000 });
      delivered.push(s.id);
    } catch (e) {
      const code = e.statusCode || 0;
      if (code === 404 || code === 410) expired.push(s.id);            // the reader unsubscribed or the browser dropped it
      else failed.push({ id: s.id, status: code, msg: String(e.body || e.message || '').slice(0, 120) });
    }
  }
}
await Promise.all(Array.from({ length: Math.min(20, subs.length || 1) }, worker));

await api({ action: 'push_report', data: JSON.stringify({ campaign: c.id, delivered, expired, failed }) }, 'POST');

const summary = `Delivered ${delivered.length}, expired and removed ${expired.length}, failed ${failed.length}.`;
console.log(summary);
if (failed.length) console.log('First failures:', failed.slice(0, 5));
if (failed.some((f) => f.status === 403 || f.status === 401)) {
  console.log('::warning::403/401 from push services usually means the VAPID keys in GitHub secrets differ from VAPID_PUBLIC_KEY in assets/nmx.js.');
}
if (env.GITHUB_STEP_SUMMARY) {
  appendFileSync(env.GITHUB_STEP_SUMMARY, `### ${base.title}\n\nCampaign \`${c.id}\` (${c.type}) to ${subs.length} subscriber(s). ${summary}\n`);
}
