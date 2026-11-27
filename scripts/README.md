# How publishing works

`content/posts.json` is the single list of posts. Each entry:

```json
{
 "slug": "youtube-partner-programme-2027",
 "status": "scheduled",            // "published" | "scheduled" | "draft"
 "date": "2026-11-30",             // publish date (India time). Max 2 posts per date: the build refuses more.
 "modified": "2026-11-30",
 "track": "growth",                // "studio" (regular posts) or "growth" (YouTube / Instagram / SEO / policy changes)
 "category": "growth",             // design-news, ai-design, adobe, meta-ads, branding, brand-stories, growth
 "category_label": "Growth playbook",
 "author": "neeraj", "author_name": "Neeraj",
 "read_min": 5,
 "title": "...", "dek": "...",     // dek = one-paragraph summary used in listings, the feed and emails
 "image": "youtube-partner-programme-2027",   // needs assets/blog/<image>.jpg, .webp and -640.webp
 "image_alt": "...",
 "has_amp": false, "popular": false,
 "takeaways": ["...", "...", "..."], // shown as "The 60-second read" in the new-post email
 "time": "18:30"                   // v15, optional: goes live at this India time on its date (24-hour)
}
```

Commands (Python 3, no packages needed):

- `python scripts/build.py --check` shows what's scheduled and whether each file is in place.
- `python scripts/build.py` publishes anything due today and rebuilds listings, rails, feed, sitemaps and blog/posts.json.
- `python scripts/build.py --today 2026-12-01` previews the site as it will look on that date (don't commit the result).

The GitHub Action in `.github/workflows/publish-scheduled.yml` checks every 30 minutes (v15) with
`python scripts/build.py --due` and runs the full build when a post or story is due, plus once a night (00:00–01:00 IST).
If you upload by hand instead, run `python scripts/build.py` before each upload.

## Publish times and instant notifications (v15)

- A post or news story with `"time": "HH:MM"` (India time) goes live at the first check after that time on its date.
- A news story in `content/news.json` can carry `"push": "instant"`, `"push_audience": "blog"` or `"all"`, and optional
  `"push_title"` / `"push_text"`. The build gives each story `live_at` the first time it shows it; a story marked instant
  is then announced by `scripts/push_news.py`, which waits until it is on labsnmx.com and starts `send-push.yml`.
  `pushed_at` records the send. Each story gets its own notification. The original `"notify": true` still works.
- `"image_caption"` shows under a story's picture on /news/, with `"image_credit"` (linked to `"image_credit_url"`).
- `python scripts/build.py --due` prints what is due right now, without building.
- Content Blog Creator v10 writes all of these fields for you.

## Learn (Creator school) and Play (v5)

`content/lessons.json` lists the lessons; each lesson's text lives in `content/learn/<slug>.html` (plain `<p>`, `<h2>`,
`<h3>`, `<ul>`, `<ol>`). Each entry: `slug`, `status`, `date`, `author` (neeraj or anisha), `title`, `short` (a short
title for cards), `dek`, `read_min`, `takeaways` (the Quick summary), `quiz` (3 questions: `q`, `o` = four options,
`a` = index of the right one, `why`). Picture: `assets/learn/learn-<slug>.jpg`, `.webp` and `-640.webp` (1200 x 675),
like blog images. A lesson dated in the future stays hidden until its date; max 2 lessons per date.

`content/quiz-extra.json` holds the Branding and Meta ads questions for /play/.

- `python scripts/build_learn.py` rebuilds /learn/, every lesson page, /play/ and `assets/quiz-bank.js`.
- `python scripts/build.py` now runs that too, adds Learn and Play to the sitemaps, and adds the Learn / Play links to
  every page's menu and footer. The nightly GitHub Action does all of this; changing the lesson files also triggers it.
