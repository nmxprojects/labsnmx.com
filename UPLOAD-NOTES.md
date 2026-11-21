# labsnmx.com: Meta Pixel, tracking, subscribe, AI summary, filters, dark mode, authors (21 Nov 2026)

Upload everything in this zip to your site root, replacing existing files.
Code-Blog.gs is NOT for the website: it goes into Google Apps Script (step 2).

New: assets/nmx.js, blog/latest-adobe-ai-updates-november-2026/ (+ /amp/),
blog/author/neeraj/, blog/author/anisha/, Code-Blog.gs.
Changed: every HTML page, assets/site.css, blog/feed.xml, sitemap.xml, privacy-policy.html.

## 1. Meta Pixel (730249939578083)
- In the <head> of every page; AMP pages use <amp-analytics type="facebookpixel">.
- Homepage keeps its existing pixel (2009429739772101) and also fires the new one.
- Events: PageView, ViewContent (content_ids = post slug), BlogPostView, BlogListView,
  LinkClick / OutboundClick / ContactClick / ButtonClick, ScrollDepth (25/50/75/100),
  ReadComplete, TimeOnPage, BlogFilter, Search, ThemeChange, ListenStart,
  QuickSummaryOpen, AISummaryOpen, AIQuestion, Lead + BlogSubscribe. All mirrored to GA4.
- Per-post views: Events Manager > ViewContent > break down by content_ids.

## 2. Subscribe + Google AI summary backend (10 minutes)
1. Create a Google Sheet; copy its ID into SHEET_ID in Code-Blog.gs.
2. script.google.com > New project > paste Code-Blog.gs.
3. Project Settings > Script properties > GEMINI_API_KEY = key from aistudio.google.com/apikey
4. Run setupEverything() once and allow permissions.
5. Deploy > New deployment > Web app > Execute as: Me, Who has access: Anyone. Copy the /exec URL.
6. Paste it into BACKEND_URL at the top of assets/nmx.js and re-upload that one file.
Until then: Subscribe shows "opens soon" and the AI button shows the editor's quick summary.
Weekly email: edit NEW_POST in Code-Blog.gs, then run notifySubscribers().
Later edits: Manage deployments > pencil > New version (keeps the same URL).

## 3. After uploading
- Open a post, click "Summarise with Google AI", toggle dark mode, try the filters on /blog/.
- Events Manager > Test events: open a post and check ViewContent arrives.
- Submit sitemap.xml again in Search Console (new post + author pages).
- Read the two author bios before they go live.
