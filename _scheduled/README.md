# Scheduled posts

Put a finished post here as `_scheduled/<slug>/index.html` (and `amp/index.html` if it has one), then add it to
`content/posts.json` with `"status": "scheduled"` and its publish date. Pages in this folder must carry
`<meta name="robots" content="noindex, nofollow">`; the builder switches that to `index` when it publishes the post.

At 00:05 IST on that date the GitHub Action moves the folder to `blog/<slug>/`, adds the post to every listing,
the feed and both sitemaps, and commits. The Apps Script backend then emails subscribers from 9 AM IST.

Nothing in this folder is linked from the site, and robots.txt disallows `/_scheduled/`.
GitHub Pages (Jekyll) does not publish folders that start with an underscore.
