# Scheduled posts

Put a finished post here as `_scheduled/<slug>/index.html` (and `amp/index.html` if it has one), then add it to
`content/posts.json` with `"status": "scheduled"` and its publish date. Pages in this folder must carry
`<meta name="robots" content="noindex, nofollow">`; the builder switches that to `index` when it publishes the post.

On that date (v15: at its `"time"` if it has one, India time, at the next 30-minute check) the GitHub Action moves the
folder to `blog/<slug>/`, adds the post to every listing, the feed and both sitemaps, and commits. The Apps Script backend
then emails and notifies subscribers (between 9 AM and 9 PM IST).

Nothing in this folder is linked from the site, and robots.txt disallows `/_scheduled/`.
GitHub Pages (Jekyll) does not publish folders that start with an underscore.
