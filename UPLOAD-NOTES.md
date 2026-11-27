# v15 publish times and instant push, 27 Nov 2026

Goes with Content Blog Creator v10. Lets posts and news stories go live at a set time (India), and sends a news story's
browser notification the moment it is live.

**Upload:** the files in this package to the repository root, replacing the old copies (10 files):
`.github/workflows/publish-scheduled.yml`, `.github/workflows/send-push.yml`, `scripts/build.py`, `scripts/build_news.py`,
`scripts/push_news.py` (new), `scripts/send-push.mjs`, `assets/news.css`, `UPLOAD-NOTES.md`, `scripts/README.md`,
`_scheduled/README.md`. No secrets or settings change: send-push uses the same five secrets as before.

**What changed:**

| Request | Done |
|---|---|
| Publish at a set time | `"time": "18:30"` (India) on a post in content/posts.json or a story in content/news.json. "Publish scheduled posts" now runs every 30 minutes (at :07 and :37). Its first step, `python scripts/build.py --due`, stops the run within seconds unless something is due or it's the nightly rebuild (00:00–01:00 India time), so most runs commit nothing. Without a time, a post or story goes live on its date as before |
| Instant push for news | A story with `"push": "instant"` gets one browser notification the first time a build shows it. The workflow waits until the story is on labsnmx.com (news/latest.json), then starts send-push.yml with the title, text, link and picture. Stories going live in the same run share one notification per audience. `pushed_at` stops repeats. News never sends emails |
| Picture on the news page | A story's picture now shows on /news/ with its caption (`image_caption`) and linked credit |
| send-push | New optional `image` input (the picture reaches the notification). Concurrency is per campaign, so two notifications started close together no longer cancel each other |
| Feed | A post with a time gets that time in blog/feed.xml |

**First run after the upload:** every story already live gets `live_at` (its date at 09:00 India time), so nothing old is
announced. Expect one commit that touches content/news.json.

**Private repository?** Every 30-minute check uses about a minute of GitHub's free Actions allowance (about 1,450 minutes
a month). Public repositories don't count. To halve it, change the cron in publish-scheduled.yml to `'7 * * * *'`:
set times then go live within the hour.

**Check it:** Actions tab › "Publish scheduled posts": scheduled runs mostly say "Nothing due at HH:MM India time."
A run that publishes something shows "Instant notifications" in its summary when it sent one.

---

# v14 icon rendering fix, 27 Nov 2026

This update fixes the actual rendering paths for the monochrome social brand marks.

**Upload:** upload the contents of `labsnmx.com-main/` to the repository root, replacing the matching files. The key files are `dashboard/dashboard.js`, `dashboard/index.html`, `scripts/build_v12.py`, `assets/icons.css`, `assets/icons/brand/`, and the regenerated HTML pages.

**What changed:** the dashboard channel cards now load the existing brand SVGs from the correct singular `/assets/icons/brand/` directory. The dashboard previously looked in `/assets/icons/brands/` (plural) and had an empty brand list, so it always fell back to camera/people/pin/briefcase glyphs. The website build script also previously skipped `dashboard/` and `tools/`, and its footer matcher did not match `<ul class="nx-iconrow">`; both issues are corrected. Footer social links now use the brand SVGs while Google Search keeps its search glyph. The dashboard JS and icon CSS cache versions are bumped.

---

# labsnmx.com update v3, 22 Nov 2026

Navigation and Blog/News colour pop, compact blog header, dates redistributed (max 2 a day), automatic scheduled publishing,
comments, unsubscribe, designed welcome and new-post emails that send themselves, SEO additions.

**Upload:** everything inside `site/` goes to your site root / GitHub repo root, replacing existing files
(12 new files, 70 changed). `Code-Blog.gs` is the Apps Script backend, not a website file.

---

## 1. Turn on the backend (required for emails, unsubscribe and comments, ~10 min)

Right now `BACKEND_URL` is still a placeholder, so nobody gets a welcome email and there is no working unsubscribe.

1. script.google.com: open your existing project (or New project), paste **all** of `Code-Blog.gs`, Save.
2. Run `setupEverything()` and allow permissions. It adds the Comments tab, a moderation key and an hourly email trigger.
   Posts dated before today are never emailed.
3. Deploy > New deployment > Web app > Execute as **Me**, access **Anyone**. Copy the `/exec` URL.
   (Already deployed? Deploy > Manage deployments > pencil > New version, same URL.)
4. Paste the URL into `BACKEND_URL` in **both** `assets/nmx.js` and `assets/feeds.js`, upload those two files.
5. Run `sendTestEmails()`: the welcome and new-post emails arrive in nmxprojects@gmail.com.
6. Check labsnmx.com/tools/backend-check/ shows version v3.

Free Gmail sends to about 100 recipients a day; past that, the hourly job finishes the next day.

## 2. Turn on scheduled publishing (GitHub, 2 min)

1. Repo Settings > Actions > General > Workflow permissions > **Read and write permissions** > Save.
2. If the site is served from this repo (GitHub Pages, Netlify, Vercel, Cloudflare Pages), you're done.
   If you upload by FTP (Hostinger/cPanel), add repo secrets `FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD`
   and optionally `FTP_DIR` (e.g. `public_html/`). The workflow then uploads changed files itself.
3. Actions tab > "Publish scheduled posts" > Run workflow, to test. It should say "Nothing due today."

How to schedule a post: `scripts/README.md` and `_scheduled/README.md`. Short version: folder in `_scheduled/<slug>/`,
entry in `content/posts.json` with `"status": "scheduled"` and a date. Live at 00:05 IST, emailed from 9 AM.
GitHub pauses scheduled workflows in repos with no activity for 60 days; the publish commits count as activity.

## 3. What changed

| Request | Done |
|---|---|
| Nav order | Blog, News, Videos, Services, Clients, About, Contact on every page, mobile menus, AMP pages and the home page's nav schema. Home mobile tab bar: About replaced by Blog |
| Blog + News colour pop | Orange pop every 3 s, News 1.5 s after Blog; pauses on hover; still for reduced-motion users. To play once, set `--pop-repeat:1` in site.css (and in the `nav-pop` style block in index.html) |
| "Notes from the studio" | Replaced at the top by a one-line header; the full intro, the two post types and the pillars now sit below the posts |
| Dates, max 2 a day | 12 posts redistributed 16–22 Nov (table in EDITORIAL-CALENDAR.md). No post is dated before something it references. "Updated" dates left truthful |
| Second post type | "Growth playbook" track (Mon + Fri) with eight researched topics in the calendar. Category page, filter chip and pillar appear automatically with the first growth post |
| Comments | On all 26 posts. Held for approval: you get an email with Approve / Delete. Reply publicly via the Reply column in the Sheet. Policy added to Editorial standards and the privacy policy |
| Unsubscribe | Link in every email (confirm page, one tap). New page /unsubscribe/. Subscribed visitors see "Unsubscribe or use a different email" in every subscribe box |
| Emails | Welcome + new-post emails in the Image 3 layout: yellow header, logo, headline, image with cloud edge, "60-second read", pill button, quick reads with images, contact line, social links, footer links, unsubscribe. Previews in `email-previews/` |
| SEO | All 26 posts in the blog's structured data (with authors); sitemap.xml regenerated with image entries, /clients removed from it; new HTML sitemap at /sitemap/ linked in every footer; "Popular reads" footer column on every page; robots.txt keeps drafts and tools out of search |

**Your Editorial standards page** used to say "We don't backdate posts." That's no longer true, so it now says:
"Each post shows a date, and an updated date when we make a meaningful change… We publish no more than two posts a day."

## 4. Please check

- `/clients` is linked from the nav and footer but there's no clients page in these files. If it 404s, tell me and I'll point it at `/#clients`.
- `favicon-32.png`, `favicon-180.png`, `favicon-512.png` and `og-image.png` are referenced on every page but aren't in the files. Make sure they exist on the server.
- Search Console: resubmit `sitemap.xml`, submit `/sitemap/`, request indexing for /blog/ and your five strongest posts. The site still has no Google results, which blocks AdSense more than anything else.
