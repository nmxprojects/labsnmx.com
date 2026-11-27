#!/usr/bin/env python3
"""
NMX Labs site builder.  Runs daily from .github/workflows/publish-scheduled.yml, or by hand:

    python scripts/build.py                  # publish anything due today (IST) and rebuild listings
    python scripts/build.py --today 2026-12-01   # preview what the site looks like on a given day
    python scripts/build.py --check          # validate content/posts.json only (no files written)

One source of truth: content/posts.json. Each post has a date and a status:
  "published"  -> lives in blog/<slug>/
  "scheduled"  -> lives in _scheduled/<slug>/ until its date, then this script moves it into blog/<slug>/

Rules enforced: never more than 2 posts on one date (MAX_PER_DAY). A scheduled post's page is never linked
from anywhere on the site, the feed or the sitemap until it is published.

Regenerated on every run: blog index (feature, list, JSON-LD), category pages (a category page is created the
first time it has a post), author pages, every post's date + "Keep reading" rail, the home page blog section,
footer "Popular reads", blog/feed.xml, sitemap.xml, the HTML sitemap at /sitemap/ and blog/posts.json
(the Apps Script email automation reads blog/posts.json to send new-post emails).
v5: also builds Learn (Creator school) and Play through scripts/build_learn.py (content/lessons.json), adds them to
both sitemaps, and makes sure every page's menu and footer link to /learn/ and /play/.
v6: the news layer (scripts/build_news.py, content/news.json): the news front page, the homepage "wire" bento carousel,
the "Latest in" bar under the menu on blog, news and learn pages, and news/latest.json. The homepage blog section is a
pastel bento. Also writes llms.txt and llms-full.txt for AI search, and adds the Global category.
v7: a published post whose page file is missing is no longer dropped silently: --check and every build print a
warning (and a GitHub Actions annotation + job summary) naming the missing file. A post whose folder is still in
_scheduled/ when it should be live is moved into blog/ automatically. The homepage carousel can show graphic slides
from content/home-carousel.json and images on news cards (see scripts/build_news.py).
v8: Services has its own page (/services/): every #services and /clients link on every page is rewritten to the real
address. sitemap.xml never loses a page: it lists every indexable page actually in the repo (what GitHub Pages serves),
keeps each page's previous lastmod, and reports anything it leaves out, and why, in the Actions run summary. The Videos page
is built from content/videos.json (YouTube links, Google Drive links or uploaded files), made with Content Blog Creator.
v9: the blog page is a bento grid with cover images (filters still work) and a "Most read this month" band; category and
author pages use the same tiles; every post's "Related reading" becomes bento cards with covers, a YouTube tile and the
month's most-read posts; posts and news carry a region tag so /assets/curate.js can pick posts for each reader's country;
sitemap_index.xml with section sitemaps (pages, posts, learn, Google News, video); 404.html and redirect pages; IndexNow.
All of it lives in scripts/build_v9.py: if that file is missing or fails, the v8 behaviour runs.
v10: LinkedIn and Pinterest next to Instagram on every page, the arcade visuals on /play/, the newest Pinterest pins on the
blog and home pages (read from the profile's public RSS feed, no API), and blog/pinterest.xml for Pinterest's Auto-publish.
All of it lives in scripts/build_v10.py: if that file is missing or fails, the v9 behaviour runs.
v11: new posts are announced and listed as the latest whatever their date (live_at in content/posts.json, blog/posts.json
and the "new_posts" Actions output), category pages with fewer than 3 posts and /sitemap/ are noindex (and out of the
sitemaps), /clients links in AMP and scheduled pages are fixed, and the flat icon set (scripts/icons_v11.py) is added
to the footer, homepage and contact page. All of it lives in scripts/build_v11.py: if it's missing or fails, v10 runs.
v13: brand-specific social marks in the reference-row style (plain glyphs in one ink, no tiles) from scripts/icons_v12.py, every icon as
SVG and PNG (assets/icons/), icons already on pages are refreshed on every run, and official logo files added to
assets/icons/brand/ are used everywhere. All of it lives in scripts/build_v12.py: if it's missing or fails, v11 icons run.
v15: a post can carry "time" (India time, HH:MM, from Content Blog Creator's Schedule). A scheduled post goes live at the
first run after its date and time; without a time it goes live at 00:00 on its date, as before. The workflow runs every
30 minutes and first asks `python scripts/build.py --due` whether anything is due (or it's the nightly run), so most runs
stop after a few seconds and nothing is committed. News stories can carry a time too (scripts/build_news.py).
No third-party packages needed.
"""
import argparse, collections, datetime as dt, html, json, os, re, shutil, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
try:
    import build_learn  # v5: Learn and Play. If it's missing or broken, blog publishing still runs.
except Exception as _e:
    build_learn = None
    print('Learn/Play skipped: ' + str(_e))
try:
    import build_v9    # v9: bento, most read, regions, YouTube tiles, sitemap index, 404. If it breaks, v8 behaviour runs.
except Exception as _e:
    build_v9 = None
    print('v9 layer skipped: ' + str(_e))
try:
    import build_v10   # v10: follow links, Play arcade, Pinterest feed and pins. If it breaks, v9 behaviour runs.
except Exception as _e:
    build_v10 = None
    print('v10 layer skipped: ' + str(_e))
try:
    import build_v11   # v11: live_at, newest-first on the same date, thin-page noindex, link fixes, flat icons.
except Exception as _e:
    build_v11 = None
    print('v11 layer skipped: ' + str(_e))
try:
    import build_v12   # v13: icon files and the icons on every page. If it breaks, the v11 icons run.
except Exception as _e:
    build_v12 = None
    print('v13 layer skipped: ' + str(_e))
try:
    import build_news  # v6: news front page, homepage wire, "Latest in" bar. If it breaks, blog publishing still runs.
except Exception as _e:
    build_news = None
    print('News skipped: ' + str(_e))

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = 'https://labsnmx.com'
MANIFEST = os.path.join(ROOT, 'content', 'posts.json')
SCHEDULED_DIR = os.path.join(ROOT, '_scheduled')
MAX_PER_DAY = 2
IST = dt.timezone(dt.timedelta(hours=5, minutes=30))
NOW_HM = '23:59'      # v15: India time of this run (HH:MM); '23:59' when previewing a day with --today
TIME_RE = re.compile(r'^([01]\d|2[0-3]):[0-5]\d$')

def is_due(p, today, now_hm=None):
    """v15: dated before today, or today and its time (if any) has come."""
    now_hm = now_hm or NOW_HM
    return p['date'] < today or (p['date'] == today and (p.get('time') or '00:00') <= now_hm)
MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

# slug -> (label, description). Order = order of the category chips.
CATEGORIES = collections.OrderedDict([
    ('design-news',   ('Design news',     'Design and creative-industry news, explained for Indian brand and marketing teams.')),
    ('ai-design',     ('AI design',       'AI design tools, Adobe, Canva and Figma, tested on real brand work.')),
    ('adobe',         ('Adobe',           'Adobe Firefly, Photoshop, Express and MAX announcements, and what they change for brand teams.')),
    ('meta-ads',      ('Meta ads',        'Meta ads budgets, creative systems and policy changes, with the numbers behind them.')),
    ('branding',      ('Branding',        'Brand identity, guidelines and launch essentials for startups and D2C brands.')),
    ('brand-stories', ('Brand stories',   'How Indian brands win and lose: rebrands, rivalries, campaigns and the strategy behind them.')),
    ('growth',        ('Growth playbook', 'YouTube, Instagram and Google Search: algorithm and policy changes, SEO and growth tactics, explained for Indian brands and creators.')),
    ('global',        ('Global',          'Design, advertising and marketing stories from the UK, the US and the rest of the world, and what they mean for your brand.')),
])
AUTHORS = {'neeraj': 'Neeraj', 'anisha': 'Anisha'}
PILLARS = [  # (category slug, title, line) shown in "Notes from the studio" on /blog/
    ('ai-design', 'AI and creative technology', 'AI design tools, Adobe, Canva and Figma, tested on real brand work.'),
    ('meta-ads', 'Advertising and marketing', 'Meta ads, campaigns and channels, with the numbers behind them.'),
    ('brand-stories', 'Branding and design strategy', 'Brand stories, rebrands, identity and packaging for Indian brands.'),
    ('growth', 'Platform growth', 'YouTube, Instagram and SEO: what changed this week and what to do about it.'),
    ('global', 'Around the world', 'UK, US and global design and marketing stories, told with opinions.'),
]
STATIC_PAGES = [  # (path, changefreq, priority)
    ('/', 'weekly', '1.0'), ('/services/', 'monthly', '0.9'), ('/blog/', 'daily', '0.9'), ('/news/', 'daily', '0.7'), ('/videos/', 'monthly', '0.6'),
    ('/about/', 'yearly', '0.6'), ('/clients/', 'monthly', '0.6'), ('/contact/', 'yearly', '0.5'), ('/editorial-standards/', 'yearly', '0.5'),
    ('/sitemap/', 'weekly', '0.4'), ('/privacy-policy.html', 'yearly', '0.3'), ('/terms/', 'yearly', '0.3'),
]

def rd(p): return open(os.path.join(ROOT, p), encoding='utf-8').read()
def wr(p, s):
    full = os.path.join(ROOT, p)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    old = open(full, encoding='utf-8').read() if os.path.exists(full) else None
    if old != s:
        open(full, 'w', encoding='utf-8').write(s); CHANGED.append(p)
CHANGED = []
def esc(s): return html.escape(s, quote=True)
def human(d): y, m, dd = d.split('-'); return f"{int(dd)} {MONTHS[int(m)-1]} {y}"
def rfc822(d, t=None):
    x = dt.datetime.strptime(d, '%Y-%m-%d')
    return x.strftime('%a, %d %b %Y') + f' {t or "09:00"}:00 +0530'          # v15: the post's own time when it has one
def sub_once(pattern, repl, s, flags=re.S):
    new, n = re.subn(pattern, lambda m: repl, s, count=1, flags=flags)
    return new, n
def between(s, start, end, inner):
    """Replace text between two markers (markers kept). Adds the end marker if only the start exists."""
    if start not in s: return s
    if end not in s: return s.replace(start, start + inner + end, 1)
    a = s.index(start) + len(start); b = s.index(end, a)
    return s[:a] + inner + s[b:]

# ------------------------------------------------------------------ manifest
def load(check_only=False):
    posts = json.load(open(MANIFEST, encoding='utf-8'))
    errors = []
    per_day = collections.Counter(p['date'] for p in posts)
    for d, n in per_day.items():
        if n > MAX_PER_DAY: errors.append(f'{d} has {n} posts; the limit is {MAX_PER_DAY} a day')
    seen = set()
    for p in posts:
        for k in ('slug', 'status', 'date', 'title', 'dek', 'category', 'author', 'read_min'):
            if not p.get(k): errors.append(f"{p.get('slug', '?')}: missing {k}")
        if p['slug'] in seen: errors.append(f"duplicate slug {p['slug']}")
        seen.add(p['slug'])
        if p.get('category') not in CATEGORIES: errors.append(f"{p['slug']}: unknown category {p.get('category')}")
        if p.get('author') not in AUTHORS: errors.append(f"{p['slug']}: unknown author {p.get('author')}")
        if p.get('status') not in ('published', 'scheduled', 'draft'): errors.append(f"{p['slug']}: bad status")
        try: dt.date.fromisoformat(p['date'])
        except Exception: errors.append(f"{p['slug']}: bad date {p.get('date')}")
        if p.get('time') and not TIME_RE.match(str(p['time'])): errors.append(f"{p['slug']}: bad time {p.get('time')} (use HH:MM, India time)")
        p.setdefault('modified', p['date']); p.setdefault('image', p['slug']); p.setdefault('takeaways', [])
        p.setdefault('track', 'growth' if p['category'] == 'growth' else 'studio')
        p.setdefault('author_name', AUTHORS.get(p['author'], p['author']))
        p.setdefault('category_label', CATEGORIES.get(p['category'], (p['category'],))[0])
        p.setdefault('has_amp', os.path.exists(os.path.join(ROOT, 'blog', p['slug'], 'amp', 'index.html')))
    if errors:
        print('content/posts.json problems:\n  ' + '\n  '.join(errors)); sys.exit(1)
    return posts

def missing_pages(posts, today):
    """v7: published posts (dated today or earlier) whose page isn't in blog/<slug>/index.html."""
    return [p for p in posts if p['status'] == 'published' and p['date'] <= today
            and not os.path.exists(os.path.join(ROOT, 'blog', p['slug'], 'index.html'))]

def warn_missing(posts, today):
    gone = missing_pages(posts, today)
    if not gone: return
    lines = [f"blog/{p['slug']}/index.html is missing, so \"{p['title']}\" ({p['date']}) is left out of the blog, feed and sitemap and its address answers 404. Upload that file (and its images in assets/blog/)." for p in gone]
    for l in lines: print('::warning title=Missing post page::' + l)
    summary = os.environ.get('GITHUB_STEP_SUMMARY')
    if summary:
        with open(summary, 'a', encoding='utf-8') as f:
            f.write('### Missing post pages\n\n' + ''.join('- ' + l + '\n' for l in lines) + '\nCheck the live site any time at https://labsnmx.com/tools/site-check/\n')

def publish_due(posts, today):
    moved = []
    for p in posts:
        due = is_due(p, today) and p['status'] in ('scheduled', 'published')       # v15: date and time
        src, dst = os.path.join(SCHEDULED_DIR, p['slug']), os.path.join(ROOT, 'blog', p['slug'])
        if not due: continue
        has_src, has_dst = os.path.exists(os.path.join(src, 'index.html')), os.path.exists(os.path.join(dst, 'index.html'))
        if p['status'] == 'published' and (has_dst or not has_src): continue      # normal case (or nothing to move)
        if p['status'] == 'scheduled' and not has_src:
            if has_dst:                                                           # v7: already moved by hand: just mark it published
                p['status'] = 'published'; moved.append(p['slug']); continue
            print(f"! {p['slug']} is due but _scheduled/{p['slug']}/index.html is missing; skipped"); continue
        if os.path.exists(dst): shutil.rmtree(dst)
        shutil.move(src, dst)
        for f in ('index.html', os.path.join('amp', 'index.html')):
            fp = os.path.join(dst, f)
            if os.path.exists(fp):
                s = open(fp, encoding='utf-8').read()
                s = re.sub(r'<meta name="robots" content="noindex[^"]*">', '<meta name="robots" content="index, follow, max-image-preview:large">', s)
                open(fp, 'w', encoding='utf-8').write(s)
        p['status'] = 'published'; moved.append(p['slug'])
    if moved:
        json.dump(posts, open(MANIFEST, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        CHANGED.append('content/posts.json')
        print('Published today: ' + ', '.join(moved))
    return moved

# ------------------------------------------------------------------ card templates (match the existing markup)
def row(p):
    return (f'<li class="post-row" data-post data-month="{p["date"][:7]}" data-cat="{p["category"]}" data-author="{p["author"]}"><a href="/blog/{p["slug"]}/">\n'
            f'  <span class="row-thumb" aria-hidden="true"><img src="/assets/blog/{p["image"]}-640.webp" alt="" width="640" height="360" loading="lazy" decoding="async"></span>\n'
            f'  <div><span class="cat">{esc(p["category_label"])}</span><h3>{esc(p["title"])}</h3><p>{esc(p["dek"])}</p></div>\n'
            f'  <span class="meta">{esc(p["author_name"])} · <time datetime="{p["date"]}">{human(p["date"])}</time> · {p["read_min"]} min read</span>\n'
            f'</a></li>\n')

def feature(p):
    return (f'<a class="feature" href="/blog/{p["slug"]}/" data-post data-month="{p["date"][:7]}" data-cat="{p["category"]}" data-author="{p["author"]}">\n'
            f'  <div class="feature-art feature-art--img" style="background:#111110" aria-hidden="true"><img src="/assets/blog/{p["image"]}.webp" alt="" width="1200" height="675" fetchpriority="high" decoding="async"></div>\n'
            f'  <div class="feature-body">\n'
            f'    <div><p class="feature-meta">Latest · {esc(p["category_label"])} · <time datetime="{p["date"]}">{human(p["date"])}</time> · {p["read_min"]} min read · by {esc(p["author_name"])}</p><h2>{esc(p["title"])}</h2></div>\n'
            f'    <p>{esc(p["dek"])}</p>\n'
            f'  </div>\n'
            f'</a>\n')

def tile(p):
    return (f'<li class="tile"><a href="/blog/{p["slug"]}/">\n'
            f'  <span class="tile-art tile-art--img" aria-hidden="true"><img src="/assets/blog/{p["image"]}-640.webp" alt="" width="640" height="360" loading="lazy" decoding="async"></span>\n'
            f'  <span class="tile-body"><span class="tile-cat">{esc(p["category_label"])}</span><span class="tile-title">{esc(p["title"])}</span><span class="tile-meta">{esc(p["author_name"])} · <time datetime="{p["date"]}">{human(p["date"])}</time> · {p["read_min"]} min read</span></span>\n'
            f'</a></li>\n')

def home_tile(p):
    return (f'        <li class="bh-tile"><a href="/blog/{p["slug"]}/"><span class="bh-art bh-art--img" aria-hidden="true"><img src="/assets/blog/{p["image"]}-640.webp" alt="" width="640" height="360" loading="lazy" decoding="async"></span>'
            f'<span class="bh-tbody"><span class="bh-cat">{esc(p["category_label"])}</span><span class="bh-ttl">{esc(p["title"])}</span><span class="bh-meta">{human(p["date"])} · {p["read_min"]} min</span></span></a></li>\n')

def home_feature(p, today):
    fresh = (dt.date.fromisoformat(today) - dt.date.fromisoformat(p['date'])).days <= 7
    label = 'New this week' if fresh else 'Latest'
    return (f'<a class="bh-feature" href="/blog/{p["slug"]}/">\n'
            f'          <span class="bh-feature-art bh-feature-art--img" style="background:#111110" aria-hidden="true"><img src="/assets/blog/{p["image"]}.webp" alt="" width="1200" height="675" loading="lazy" decoding="async"></span>\n'
            f'          <span class="bh-feature-body">\n'
            f'            <span class="bh-new">{label} · {esc(p["category_label"])}</span>\n'
            f'            <span class="bh-feature-title">{esc(p["title"])}</span>\n'
            f'            <span class="bh-feature-dek">{esc(p["dek"])}</span>\n'
            f'            <span class="bh-feature-meta">{human(p["date"])} · {p["read_min"]} min read · by {esc(p["author_name"])}</span>\n'
            f'          </span>\n'
            f'        </a>')

def cats_nav(live_cats, current=None, with_data=False):
    out = ['<nav class="cats" aria-label="Blog categories">']
    out.append('<a href="/blog/"' + (' data-cat=""' if with_data else '') + (' aria-current="page"' if current is None else '') + '>All</a>')
    for slug, (label, _) in CATEGORIES.items():
        if slug not in live_cats: continue
        out.append(f'<a href="/blog/category/{slug}/"' + (f' data-cat="{slug}"' if with_data else '') + (' aria-current="page"' if current == slug else '') + f'>{label}</a>')
    return ''.join(out) + '</nav>'

def replace_list(s, items_html, ul_open_re=r'<ul class="post-list"[^>]*>'):
    m = re.search(ul_open_re, s)
    if not m: return s
    end = s.index('</ul>', m.end())
    return s[:m.end()] + '\n' + items_html + s[end:]

def popular_html(published):
    if build_v9 and build_v9.POPULAR['slugs']:                       # v9: real reader counts when we have them
        by = {p['slug']: p for p in published}
        pops = [by[x] for x in build_v9.POPULAR['slugs'] if x in by][:5]
    else:
        pops = [p for p in published if p.get('popular')][:5] or published[:5]
    return ''.join(f'<li><a href="/blog/{p["slug"]}/">{esc(p.get("short") or short_title(p["title"]))}</a></li>' for p in pops)

def short_title(t):
    t = re.split(r'[:?]', t)[0].strip()
    return t if len(t) <= 48 else t[:46].rsplit(' ', 1)[0] + '…'

# ------------------------------------------------------------------ pages
def build_blog_index(published, live_cats):
    s = rd('blog/index.html')
    s = re.sub(r'<nav class="cats" aria-label="Blog categories">.*?</nav>', lambda m: cats_nav(live_cats, None, True), s, count=1, flags=re.S)
    if V9_OK:                                                         # v9: most-read band + bento grid of every post
        s = build_v9.blog_index(s, published, TODAY)
    else:
        s, _ = sub_once(r'<a class="feature" href=.*?</a>\n', feature(published[0]), s)
        s = replace_list(s, ''.join(row(p) for p in published[1:]))
    ld = ',\n'.join(json.dumps({'@type': 'BlogPosting', 'headline': p['title'], 'url': f'{SITE}/blog/{p["slug"]}/',
                                'datePublished': p['date'], 'dateModified': p['modified'],
                                'image': f'{SITE}/assets/blog/{p["image"]}.jpg',
                                'author': {'@type': 'Person', 'name': p['author_name'], 'url': f'{SITE}/blog/author/{p["author"]}/'}},
                               ensure_ascii=False, indent=1).replace('\n', '\n  ') for p in published)
    s = re.sub(r'"blogPost": \[.*?\n \]', lambda m: '"blogPost": [\n  ' + ld + '\n ]', s, count=1, flags=re.S)
    pill = [x for x in PILLARS if x[0] in live_cats]
    pill_html = (f'\n  <nav class="pillars{" pillars--4" if len(pill) == 4 else ""}" aria-label="What we cover">'
                 + ''.join(f'<a href="/blog/category/{c}/"><strong>{t}</strong><span>{l}</span></a>' for c, t, l in pill) + '</nav>\n  ')
    s = between(s, '<!--PILLARS-->', '<!--/PILLARS-->', pill_html)
    wr('blog/index.html', s)

def build_category(slug, posts_in_cat, live_cats):
    label, desc = CATEGORIES[slug]
    path = f'blog/category/{slug}/index.html'
    if not os.path.exists(os.path.join(ROOT, path)):          # first post in a new category: clone a sibling page
        tpl = rd('blog/category/branding/index.html')
        tl, td = CATEGORIES['branding']
        tpl = tpl.replace('/blog/category/branding/', f'/blog/category/{slug}/').replace(td, desc)
        tpl = tpl.replace(f'{tl} | NMX Labs Blog', f'{label} | NMX Labs Blog').replace(f'"name": "{tl}"', f'"name": "{label}"')
        tpl = tpl.replace(f'<h1>{tl}</h1>', f'<h1>{label}</h1>').replace(f'</a> / {tl}</p>', f'</a> / {label}</p>')
        wr(path, tpl)
    s = rd(path)
    s = re.sub(r'<nav class="cats" aria-label="Blog categories">.*?</nav>', lambda m: cats_nav(live_cats, slug), s, count=1, flags=re.S)
    s = build_v9.listing(s, posts_in_cat, TODAY) if V9_OK else replace_list(s, ''.join(row(p) for p in posts_in_cat))
    wr(path, s)

def build_author(slug, posts_by):
    path = f'blog/author/{slug}/index.html'
    if not os.path.exists(os.path.join(ROOT, path)): return
    s = rd(path)
    wr(path, build_v9.listing(s, posts_by, TODAY) if V9_OK else replace_list(s, ''.join(row(p) for p in posts_by)))

def rail_for(p, published):
    same = [q for q in published if q['slug'] != p['slug'] and q['category'] == p['category']]
    rest = [q for q in published if q['slug'] != p['slug'] and q['category'] != p['category']]
    return (same[:4] + rest)[:10]

def build_post(p, published):
    path = f'blog/{p["slug"]}/index.html'
    s = rd(path)
    s = re.sub(r'("datePublished":\s*")[^"]+', lambda m: m.group(1) + p['date'], s)
    s = re.sub(r'("dateModified":\s*")[^"]+', lambda m: m.group(1) + p['modified'], s)
    s = re.sub(r'(<meta property="article:published_time" content=")[^"]+', lambda m: m.group(1) + p['date'], s)
    s = re.sub(r'(<meta property="article:modified_time" content=")[^"]+', lambda m: m.group(1) + p['modified'], s)
    s = re.sub(r'(<div class="byline">.*?)<time datetime="[^"]+">[^<]+</time>',
               lambda m: m.group(1) + f'<time datetime="{p["date"]}">{human(p["date"])}</time>', s, count=1, flags=re.S)
    s = replace_list(s, ''.join(tile(q) for q in rail_for(p, published)), r'<ul class="rail-track">')
    if V9_OK:
        try: s = build_v9.related(s, p, published)                     # v9: related reading as bento cards
        except Exception as e: print(f'Related reading left as is on {p["slug"]}: {e}')
    if 'data-comments' not in s and os.path.exists(os.path.join(ROOT, 'scripts', 'comments-snippet.html')):
        s = s.replace('</article>\n', '</article>\n' + rd('scripts/comments-snippet.html').replace('{slug}', p['slug']), 1)
    wr(path, s)
    amp = f'blog/{p["slug"]}/amp/index.html'
    if os.path.exists(os.path.join(ROOT, amp)):
        a = rd(amp)
        a = re.sub(r'("datePublished":\s*")[^"]+', lambda m: m.group(1) + p['date'], a)
        a = re.sub(r'("dateModified":\s*")[^"]+', lambda m: m.group(1) + p['modified'], a)
        a = re.sub(r'(<div class="byline">.*?</span><span>)\d{1,2} \w+ 20\d\d(</span>)', lambda m: m.group(1) + human(p['date']) + m.group(2), a, count=1, flags=re.S)
        wr(amp, a)

TINTS = ['#ffe4d6', '#e2f0df', '#e9e3fb', '#fff0c2', '#dcebfa', '#fde0ea', '#e8efe1']
def home_blog(published, today):
    """v6: the homepage blog section as a pastel bento (one lead tile, six tiles, a browse tile)."""
    lead, rest = published[0], published[1:7]
    fresh = (dt.date.fromisoformat(today) - dt.date.fromisoformat(lead['date'])).days <= 7
    def tile(p, i, cls=''):
        return (f'      <li class="hb-tile{cls}" style="--tint:{TINTS[i % len(TINTS)]}"><a href="/blog/{p["slug"]}/">'
                f'<span class="hb-img"><img src="/assets/blog/{p["image"]}-640.webp" alt="" width="640" height="360" loading="lazy" decoding="async"></span>'
                f'<span class="hb-body"><span class="hb-cat">{esc(p["category_label"])}</span><span class="hb-ttl">{esc(p["title"])}</span>'
                f'<span class="hb-meta"><time datetime="{p["date"]}">{human(p["date"])}</time> · {p["read_min"]} min</span></span></a></li>\n')
    tiles = ''.join(tile(p, i + 1, ' hb-tile--wide' if i == 4 else '') for i, p in enumerate(rest))
    cats = ''.join(f'<span>{CATEGORIES[c][0]}</span>' for c in CATEGORIES if any(p['category'] == c for p in published))
    return (f'\n<section class="hb" id="blog" aria-labelledby="hb-h">\n  <div class="hb-top">\n'
            f'    <div><p class="hb-kick">From the blog · 3–4 new articles every week</p><h2 id="hb-h">Fresh from the studio</h2>'
            f'<p class="hb-sub">Design, AI and marketing, written by the people who do the work. Real tests, named sources and opinions we’ll happily defend.</p></div>\n'
            f'    <a class="hb-all" href="/blog/">Read all {len(published)} posts</a>\n  </div>\n  <ul class="hb-grid">\n'
            f'      <li class="hb-tile hb-tile--lead" style="--tint:{TINTS[0]}"><a href="/blog/{lead["slug"]}/">'
            f'<span class="hb-img"><img src="/assets/blog/{lead["image"]}.webp" alt="" width="1200" height="675" loading="lazy" decoding="async"></span>'
            f'<span class="hb-body"><span class="hb-cat">{"New this week" if fresh else "Latest"} · {esc(lead["category_label"])}</span>'
            f'<span class="hb-ttl">{esc(lead["title"])}</span><span class="hb-dek">{esc(lead["dek"])}</span>'
            f'<span class="hb-meta"><time datetime="{lead["date"]}">{human(lead["date"])}</time> · {lead["read_min"]} min read · by {esc(lead["author_name"])}</span></span></a></li>\n'
            f'{tiles}      <li class="hb-tile hb-tile--cta"><a href="/blog/"><span class="hb-n">{len(published)}</span><span class="hb-ttl">posts and counting. Browse them all</span>'
            f'<span class="hb-cats">{cats}</span></a></li>\n  </ul>\n</section>\n')

def build_home(published, today, news_home=''):
    s = rd('index.html')
    if '<!--HOME-BLOG-->' in s:                                       # v6 layout
        s = between(s, '<!--HOME-BLOG-->', '<!--/HOME-BLOG-->', home_blog(published, today))
        if news_home: s = between(s, '<!--HOME-NEWS-->', '<!--/HOME-NEWS-->', news_home)
        wr('index.html', s); return
    s = re.sub(r'<a class="bh-feature" href=.*?</a>', lambda m: home_feature(published[0], today), s, count=1, flags=re.S)
    s = replace_list(s, ''.join(home_tile(p) for p in published[1:12]) + '        ', r'<ul class="bh-rail" id="bhRail">')
    s = re.sub(r'Read all \d+ posts', f'Read all {len(published)} posts', s)
    wr('index.html', s)

SUB_OLD = ('An email when a new post goes live, with a quick read of the key points. Usually two or three a week. No spam, one-click unsubscribe.',
           'New posts every week.')
SUB_NEW = ('An email when a new post goes live (we publish 3–4 a week), with a quick read of the key points, plus the occasional newsletter or studio offer. No spam, one-click unsubscribe.',
           '3–4 new articles every week.')
def v6_copy(s):
    for a, b in zip(SUB_OLD, SUB_NEW): s = s.replace(a, b)
    return s

def build_footers(published):
    inner = popular_html(published)
    for dirpath, _, files in os.walk(ROOT):
        rel = os.path.relpath(dirpath, ROOT)
        if rel.startswith(('_scheduled', '.git', 'scripts', 'content')) or '/amp' in rel.replace('\\', '/'): continue
        for f in files:
            if not f.endswith('.html'): continue
            p = os.path.normpath(os.path.join(rel, f))
            s = rd(p)
            if '<!--POPULAR-->' in s: s = between(s, '<!--POPULAR-->', '<!--/POPULAR-->', inner)
            if build_learn and not rel.replace('\\', '/').startswith('tools'): s = build_learn.add_school_links(s)   # v5: Learn and Play in menus and footer
            if WIRE_BAR and build_news: s = build_news.add_bar(s, WIRE_BAR, rel)                                  # v6: "Latest in" bar
            s = v6_copy(s)
            s = fix_links(s)                                                                      # v8: /services/ and /clients/
            if build_v10:                                                                         # v10: LinkedIn and Pinterest
                try: s = build_v10.socials(s)
                except Exception as e: print(f'Follow links not added to {p}: {e}')
            done = False
            if build_v12:                                                                         # v12: icons (after the
                try: s = build_v12.icons(s, rel); done = True                                     # follow links, so new
                except Exception as e: print(f'v12 icons not added to {p}: {e}')                 # links get one too)
            if build_v11 and not done:                                                            # v11: flat icons
                try: s = build_v11.icons(s, rel)
                except Exception as e: print(f'Icons not added to {p}: {e}')
            wr(p, s)

def build_feed(published):
    items = []
    for p in published[:30]:
        jpg = os.path.join(ROOT, 'assets', 'blog', p['image'] + '.jpg')
        length = os.path.getsize(jpg) if os.path.exists(jpg) else 0
        items.append(f'''  <item>
    <title>{esc(p["title"])}</title>
    <link>{SITE}/blog/{p["slug"]}/</link>
    <enclosure url="{SITE}/assets/blog/{p["image"]}.jpg" length="{length}" type="image/jpeg"/>
    <author>nmxprojects@gmail.com ({esc(p["author_name"])})</author>
    <guid isPermaLink="true">{SITE}/blog/{p["slug"]}/</guid>
    <category>{esc(p["category_label"])}</category>
    <pubDate>{rfc822(p["date"], p.get("time"))}</pubDate>
    <description>{esc(p["dek"])}</description>
  </item>''')
    wr('blog/feed.xml', f'''<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>NMX Labs Blog</title>
  <link>{SITE}/blog/</link>
  <atom:link href="{SITE}/blog/feed.xml" rel="self" type="application/rss+xml"/>
  <description>AI and creative tools, advertising, branding and platform growth for Indian brands, from NMX Labs, Gurugram.</description>
  <language>en-IN</language>
  <lastBuildDate>{rfc822(published[0]["date"])}</lastBuildDate>
{chr(10).join(items)}
</channel>
</rss>
''')

def build_sitemap(published, live_cats):
    """v8: never loses a page. Lists the blog, Learn and every other indexable page actually in the repo (found by
    scanning it), keeps each page's previous lastmod, and reports anything that left the sitemap and why."""
    latest = published[0]['date']
    urls, done = [], set()
    before, live = old_sitemap(), discover_pages()
    def url(loc, lastmod, freq, prio, images=()):
        if loc in done: return
        done.add(loc)
        img = ''.join(f'\n    <image:image><image:loc>{esc(i)}</image:loc></image:image>' for i in images)
        urls.append(f'  <url>\n    <loc>{SITE}{loc}</loc>\n    <lastmod>{lastmod}</lastmod>\n    <changefreq>{freq}</changefreq>\n    <priority>{prio}</priority>{img}\n  </url>')
    for loc, freq, prio in STATIC_PAGES:
        if loc not in live: continue                                   # a page that isn't there would show up as a 404
        if loc in ('/', '/blog/', '/news/', '/sitemap/'): lm = latest
        elif loc == '/videos/' and VIDEOS_CHANGED: lm = TODAY
        else: lm = before.get(loc) or live.get(loc) or TODAY
        url(loc, lm, freq, prio)
    for c in CATEGORIES:
        if c in live_cats and page_state(f'/blog/category/{c}/') == 'ok':                  # v11: thin (noindex) categories stay out
            url(f'/blog/category/{c}/', max(p['date'] for p in published if p['category'] == c), 'weekly', '0.6')
    for a in AUTHORS:
        mine = [p['date'] for p in published if p['author'] == a]
        if mine: url(f'/blog/author/{a}/', max(mine), 'weekly', '0.5')
    for p in published:
        url(f'/blog/{p["slug"]}/', p['modified'], 'monthly', '0.8', [f'{SITE}/assets/blog/{p["image"]}.jpg'])
    for loc, lastmod in (build_learn.urls(TODAY) if build_learn else []):                       # v5: Learn hub, lessons and Play
        url(loc, lastmod, 'weekly' if loc in ('/learn/', '/play/') else 'monthly', '0.8' if loc == '/learn/' else '0.7')
    extra = [loc for loc in sorted(live) if loc not in done]           # v8: any other real page (new sections, hand-made pages)
    for loc in extra: url(loc, live[loc] or before.get(loc) or TODAY, 'monthly', '0.5')
    wr('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n'
       + '\n'.join(urls) + '\n</urlset>\n')
    gone = [loc for loc in before if loc not in done]
    report('Left out of sitemap.xml', [f'{SITE}{loc}: {page_state(loc) if page_state(loc) != "ok" else "not published yet"}' for loc in gone])
    print(f'sitemap.xml: {len(urls)} addresses' + (f', {len(extra)} found by scanning the site' if extra else '') + (f', {len(gone)} left out (see warnings)' if gone else ''))

def build_html_sitemap(published, live_cats):
    tpl = rd('blog/category/branding/index.html')
    tl, td = CATEGORIES['branding']
    desc = 'Every page and post on labsnmx.com: services, the blog by topic and author, news, videos and policies.'
    s = tpl.replace('/blog/category/branding/', '/sitemap/').replace(td, desc).replace(f'{tl} | NMX Labs Blog', 'Sitemap | NMX Labs')
    s = re.sub(r'<script type="application/ld\+json">.*?</script>\n<script type="application/ld\+json">.*?</script>',
               lambda m: '<script type="application/ld+json">\n' + json.dumps({'@context': 'https://schema.org', '@type': 'WebPage', 'name': 'Sitemap | NMX Labs', 'url': f'{SITE}/sitemap/', 'description': desc}, indent=1) + '\n</script>', s, count=1, flags=re.S)
    cols = []
    cols.append('<div><h2>Studio</h2><ul>' + ''.join(f'<li><a href="{h}">{l}</a></li>' for h, l in [
        ('/', 'Home'), ('/services/', 'Services and pricing'), ('/clients/', 'Clients'), ('/about/', 'About NMX Labs'),
        ('/contact/', 'Contact'), ('/#faq', 'FAQ'), ('/videos/', 'Videos'), ('/news/', 'News feed')]) + '</ul>'
        '<h2>Blog</h2><ul><li><a href="/blog/">All posts</a></li>'
        + ''.join(f'<li><a href="/blog/category/{c}/">{CATEGORIES[c][0]}</a></li>' for c in CATEGORIES if c in live_cats)
        + ''.join(f'<li><a href="/blog/author/{a}/">Posts by {n}</a></li>' for a, n in AUTHORS.items())
        + '<li><a href="/blog/feed.xml">RSS feed</a></li></ul>'
        + '<h2>Creator school</h2><ul><li><a href="/learn/">All lessons</a></li>'
        + ''.join(f'<li><a href="{u}">{esc(t)}</a></li>' for u, t in LESSON_LINKS) + '<li><a href="/play/">Play: quizzes and games</a></li></ul>'
        '<h2>Policies</h2><ul><li><a href="/editorial-standards/">Editorial standards</a></li><li><a href="/privacy-policy.html">Privacy policy</a></li><li><a href="/terms/">Terms</a></li></ul></div>')
    by_cat = collections.OrderedDict((c, [p for p in published if p['category'] == c]) for c in CATEGORIES if c in live_cats)
    groups = list(by_cat.items()); half = (len(groups) + 1) // 2
    for chunk in (groups[:half], groups[half:]):
        cols.append('<div>' + ''.join(f'<h2>{CATEGORIES[c][0]}</h2><ul>' + ''.join(f'<li><a href="/blog/{p["slug"]}/">{esc(p["title"])}</a></li>' for p in ps) + '</ul>' for c, ps in chunk) + '</div>')
    main = ('<main class="wrap">\n<header class="page-head page-head--compact">\n  <p class="crumbs"><a href="/">Home</a> / Sitemap</p>\n  <h1>Sitemap</h1>\n'
            f'  <p>{desc}</p>\n</header>\n<div class="sitemap-cols">' + ''.join(cols) + '</div>\n</main>')
    s = re.sub(r'<main class="wrap">.*?</main>', lambda m: main, s, count=1, flags=re.S)
    s = re.sub(r'<a href="/blog/"\s*class="nav-pop" aria-current="page">', '<a href="/blog/" class="nav-pop">', s)
    wr('sitemap/index.html', s)

def build_llms(published, lessons, news):
    """v6: llms.txt (a map for AI search engines) and llms-full.txt (every post's summary and key points)."""
    head = ('# NMX Labs\n\n> NMX Labs is a design, AI and marketing studio and publication based in Gurugram, India, writing for brand teams in the '
            'UK, the US, India and everywhere else. We publish 3–4 new articles every week on branding, AI design tools, advertising and '
            'platform growth, run a curated news page, and teach free short courses. Every article lists its sources, and posts where we '
            'tested something include a "How we checked this" box.\n\n')
    pub = ('## The publication\n'
           f'- [Blog]({SITE}/blog/): 3–4 new articles every week. Each has key takeaways at the top, numbered sources and a fact-check date.\n'
           f'- [News]({SITE}/news/): design, AI and marketing news from around the world, each story with a short NMX take and a link to the original source.\n'
           f'- [Learn]({SITE}/learn/): free short courses (YouTube, brand identity, Meta ads, getting found in AI answers).\n'
           f'- [Play]({SITE}/play/): quizzes and games for marketers and designers.\n'
           f'- [Editorial standards]({SITE}/editorial-standards/): how we research, test, credit and correct.\n'
           f'- [RSS feed]({SITE}/blog/feed.xml) · [Every post, summarised]({SITE}/llms-full.txt) · [Latest headlines as JSON]({SITE}/news/latest.json)\n\n')
    latest = '## Latest articles\n' + ''.join(f'- [{p["title"]}]({SITE}/blog/{p["slug"]}/): {p["dek"]} ({human(p["date"])}, {p["author_name"]})\n' for p in published[:25]) + '\n'
    cats = '## Topics\n' + ''.join(f'- [{CATEGORIES[c][0]}]({SITE}/blog/category/{c}/): {CATEGORIES[c][1]}\n' for c in CATEGORIES if any(p['category'] == c for p in published)) + '\n'
    authors = (f'## Authors\n- [Neeraj]({SITE}/blog/author/neeraj/): AI design, Meta ads and platform growth.\n'
               f'- [Anisha]({SITE}/blog/author/anisha/): market research, branding and brand stories.\n\n')
    studio = ('## The studio\n'
              f'- Every service, what it includes and its price: {SITE}/services/\n'
              '- Branding & Identity: starter brand system from Rs 25,000 (discovery, logo, colour and type system, social assets, mini guidelines).\n'
              '- Social Media Creative: Rs 8,000 a month for 8 custom static or carousel creatives (design only).\n'
              '- Campaign Creative: Rs 10,000 per campaign (concept, key visual, 3 to 5 adaptations).\n'
              '- Meta Ads Management: Rs 8,000 a month (setup, audience research, weekly optimisation, reporting; ad spend billed separately).\n'
              '- Creative + Meta Ads bundle: Rs 15,000 a month plus ad spend.\n'
              '- Brand & Marketing Design: from Rs 7,500 (decks, brochures, collateral).\n'
              '- Who we work with: D2C brands, EV and energy, SaaS, hospitality and creator-led businesses, from pre-launch to post-Series A, in India, the UK, the US and elsewhere.\n'
              '- Pricing is fixed upfront; small senior team, no account layer. Prices are in Indian rupees (INR).\n\n'
              f'## Contact\n- Website: {SITE}/\n- Instagram: https://www.instagram.com/_nmxlabs/\n- LinkedIn: https://www.linkedin.com/company/nmxlabs\n'
              '- Pinterest: https://in.pinterest.com/nmxlabs/\n- WhatsApp: https://wa.me/918810438717\n- Email: nmxprojects@gmail.com\n')
    wr('llms.txt', head + pub + latest + cats + authors + studio.rstrip('\n') + '\n')
    full = [head.replace('# NMX Labs', '# NMX Labs: every article, summarised'),
            'Each entry: title, link, date, author, topic, the summary we wrote for it and its key takeaways. Quote freely with a link.\n\n']
    for p in published:
        full.append(f'## {p["title"]}\n{SITE}/blog/{p["slug"]}/\nPublished {human(p["date"])} · {p["author_name"]} · {p["category_label"]} · {p["read_min"]} min read\n\n{p["dek"]}\n'
                    + ''.join(f'- {t}\n' for t in p.get('takeaways', [])) + '\n')
    if lessons:
        full.append('# Free courses\n\n' + ''.join(f'- {x["title"]}: {SITE}/learn/{x["slug"]}/ ({x["dek"]})\n' for x in lessons) + '\n')
    if news:
        full.append('# Recent news, with our take\n\n' + ''.join(f'- {human(x["date"])}, {x["title"]}: {x["summary"]} NMX take: {x["take"]} Source: {x["source"]} ({x["url"]})\n' for x in news[:20]))
    wr('llms-full.txt', ''.join(full))

def build_public_json(published):
    out = {'updated': published[0]['date'], 'site': SITE, 'posts': []}
    rows = published[:40]
    if build_v11:                                                       # v11: back-dated posts that just went live, too
        try: rows = rows + build_v11.recent_backdated(published, {p['slug'] for p in rows})
        except Exception as e: print('v11 recent posts skipped: ' + str(e))
    for p in rows:
        out['posts'].append({'slug': p['slug'], 'title': p['title'], 'url': f'{SITE}/blog/{p["slug"]}/', 'date': p['date'],
                             'dek': p['dek'], 'takeaways': p['takeaways'][:4], 'category': p['category_label'], 'track': p['track'],
                             'author': p['author_name'], 'read_min': p['read_min'],
                             'image': f'{SITE}/assets/blog/{p["image"]}.jpg', 'thumb': f'{SITE}/assets/blog/{p["image"]}.jpg',
                             'thumb_small': f'{SITE}/assets/blog/{p["image"]}-640.webp', 'regions': p.get('regions', ['global']),
                             'most_read': (build_v9.pop_rank(p['slug']) if V9_OK else 0)})
        if build_v11: out['posts'][-1].update(build_v11.public_extra(p))  # v11: live_at (and notify: false)
    wr('blog/posts.json', json.dumps(out, ensure_ascii=False, indent=1) + '\n')

# ------------------------------------------------------------------ v8: links, page discovery, sitemap that never loses pages, videos
SERVICE_ANCHORS = {'Branding & Identity': 'branding', 'Social Media Creative': 'social', 'Campaign Creative': 'campaign',
                   'Meta Ads Management': 'metaads', 'Creative + Meta Ads Bundle': 'bundle', 'Creative + Meta Ads': 'bundle',
                   'Brand & Marketing Design': 'branddesign'}
def fix_links(s):
    """v8: Services has its own page (/services/) instead of a #services anchor that Google doesn't index, and every
    /clients link points straight at /clients/ instead of a redirect."""
    def svc(m):
        a = SERVICE_ANCHORS.get(html.unescape(m.group(3)).strip())
        return '<a' + (m.group(1) or ' ') + 'href="/services/' + ('#' + a if a else '') + '"' + m.group(2) + '>' + m.group(3) + '</a>'
    s = re.sub(r'<a(\s[^>]*?)?href="(?:https://labsnmx\.com)?/?#m?services"([^>]*)>([^<]*)</a>', svc, s)
    for old in ('href="https://labsnmx.com/#services"', 'href="/#services"', 'href="#services"', 'href="#mservices"', 'href="/#mservices"'):
        s = s.replace(old, 'href="/services/"')
    s = s.replace('"https://labsnmx.com/#services"', '"https://labsnmx.com/services/"')
    s = re.sub(r'(<a\s[^>]*?href=")(?:https://labsnmx\.com)?/clients(")', r'\1/clients/\2', s)
    s = s.replace('"https://labsnmx.com/clients"', '"https://labsnmx.com/clients/"')
    return s

SKIP_TOP = ('_scheduled', 'scripts', 'content', 'tools', 'dashboard', 'assets', 'email-previews', 'node_modules', 'offline', 'saved', 'unsubscribe')
def page_state(loc):
    """'ok', or why a sitemap address can't be listed (missing file, noindex, canonical points elsewhere)."""
    p = loc.lstrip('/')
    p = 'index.html' if p == '' else (p + 'index.html' if p.endswith('/') else p)
    full = os.path.join(ROOT, p)
    if not os.path.exists(full): return 'its file ' + p + ' is missing'
    s = open(full, encoding='utf-8', errors='replace').read(80000)
    if re.search(r'<meta name="robots" content="[^"]*noindex', s, re.I): return 'the page is set to noindex'
    m = re.search(r'<link rel="canonical" href="([^"]+)"', s)
    if not m: return 'the page has no canonical address'
    if m.group(1) != SITE + loc: return 'its canonical address is ' + m.group(1)
    return 'ok'

def discover_pages():
    """v8: every indexable page that is really in the repo, which is exactly what GitHub Pages serves: {address: lastmod}."""
    found = {}
    for dirpath, dirs, files in os.walk(ROOT):
        rel = os.path.relpath(dirpath, ROOT).replace('\\', '/')
        top = rel.split('/')[0]
        if rel != '.' and (top in SKIP_TOP or top.startswith('.') or '/amp' in '/' + rel):
            dirs[:] = []; continue
        for f in files:
            if not f.endswith('.html'): continue
            p = f if rel == '.' else rel + '/' + f
            loc = '/' + (p[:-10] if p.endswith('index.html') else p)
            if page_state(loc) != 'ok': continue
            s = open(os.path.join(ROOT, p), encoding='utf-8', errors='replace').read(80000)
            mod = re.search(r'<meta property="article:modified_time" content="(\d{4}-\d{2}-\d{2})', s) or re.search(r'"dateModified":\s*"(\d{4}-\d{2}-\d{2})', s)
            found[loc] = mod.group(1) if mod else ''
    return found

def old_sitemap():
    p = os.path.join(ROOT, 'sitemap.xml')
    if not os.path.exists(p): return {}
    s = open(p, encoding='utf-8').read()
    return {m.group(1)[len(SITE):]: m.group(2) for m in re.finditer(r'<loc>([^<]+)</loc>\s*<lastmod>([^<]*)</lastmod>', s) if m.group(1).startswith(SITE)}

def report(title, lines):
    if not lines: return
    for l in lines: print('::warning title=' + title + '::' + l)
    summary = os.environ.get('GITHUB_STEP_SUMMARY')
    if summary:
        with open(summary, 'a', encoding='utf-8') as f: f.write('### ' + title + '\n\n' + ''.join('- ' + l + '\n' for l in lines) + '\n')

VIDEOS_CHANGED = False
def video_frame(v):
    vert = ' style="aspect-ratio:9/16;max-width:360px;margin:0 auto"' if v.get('vertical') else ''
    t = esc(v.get('title') or 'Video'); k = v.get('kind')
    if k == 'youtube':
        inner = (f'<iframe src="https://www.youtube-nocookie.com/embed/{esc(v["id"])}" title="{t}" loading="lazy" allow="accelerometer; clipboard-write; '
                 'encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>')
    elif k == 'drive':
        inner = f'<iframe src="https://drive.google.com/file/d/{esc(v["id"])}/preview" title="{t}" loading="lazy" allow="autoplay; fullscreen" allowfullscreen></iframe>'
    else:
        poster = f' poster="{esc(v["thumb"])}"' if v.get('thumb') else ''
        inner = (f'<video controls preload="metadata" playsinline title="{t}"{poster} style="position:absolute;inset:0;width:100%;height:100%;background:#000" '
                 f'src="{esc(v.get("src", ""))}"></video>')
    return f'<div class="video-frame"{vert}>{inner}</div>'

def build_videos():
    """v8: the Videos page from content/videos.json (YouTube links, Google Drive links, uploaded files). Made with Content Blog Creator."""
    global VIDEOS_CHANGED
    vp = os.path.join(ROOT, 'content', 'videos.json')
    if not os.path.exists(vp) or not os.path.exists(os.path.join(ROOT, 'videos', 'index.html')): return
    try: data = json.load(open(vp, encoding='utf-8'))
    except Exception as e: print('Videos page not rebuilt: content/videos.json is not valid JSON (' + str(e) + ')'); return
    vids = [v for v in data.get('videos', []) if v.get('active', True) is not False and (v.get('id') or v.get('src'))
            and (not v.get('show_from') or v['show_from'] <= TODAY)]
    if not vids: return
    cards = []
    for v in vids:
        cap = ''
        if v.get('credit'):
            cap = '<figcaption>' + esc(v['credit']) + (f' <a href="{esc(v["credit_url"])}" target="_blank" rel="noopener">(source)</a>' if v.get('credit_url') else '') + '</figcaption>'
        more = f' <a href="{esc(v["related"])}" style="text-decoration:underline">{esc(v.get("related_label") or "Read our breakdown")}</a>' if v.get('related') else ''
        if v.get('kind') == 'youtube':                                 # v9: a direct YouTube link under every YouTube video
            more += f' <a href="https://www.youtube.com/watch?v={esc(v["id"])}" target="_blank" rel="noopener" style="text-decoration:underline">Watch on YouTube</a>'
        idattr = f' id="{esc(v["slug"])}"' if v.get('slug') else ''
        cards.append(f'<div{idattr}><figure class="video">\n  {video_frame(v)}\n  {cap}\n</figure><h2>{esc(v.get("title", ""))}</h2><p>{esc(v.get("description", ""))}{more}</p></div>')
    grid = '<section class="video-grid" aria-label="' + esc(data.get('label') or 'Videos') + '">\n' + ''.join(cards) + '\n</section>'
    s = rd('videos/index.html')
    s2 = re.sub(r'<section class="video-grid"[^>]*>.*?</section>', lambda m: grid, s, count=1, flags=re.S)
    s2 = re.sub(r'<script type="application/ld\+json">\s*\{\s*"@context": "https://schema.org",\s*"@type": "VideoObject".*?</script>\n?', '', s2, flags=re.S)
    objs = []
    for v in vids:
        o = {'@context': 'https://schema.org', '@type': 'VideoObject', 'name': v.get('title', ''), 'description': v.get('description') or v.get('title', '')}
        if v.get('kind') == 'youtube':
            o.update(thumbnailUrl=f'https://i.ytimg.com/vi/{v["id"]}/hqdefault.jpg', embedUrl=f'https://www.youtube.com/embed/{v["id"]}', url=f'https://www.youtube.com/watch?v={v["id"]}')
        elif v.get('kind') == 'drive':
            o.update(embedUrl=f'https://drive.google.com/file/d/{v["id"]}/preview', thumbnailUrl=SITE + (v.get('thumb') or '/og-image.png'))
        else:
            src = v.get('src', ''); o.update(contentUrl=SITE + src if src.startswith('/') else src, thumbnailUrl=(SITE + v['thumb']) if str(v.get('thumb', '')).startswith('/') else (v.get('thumb') or SITE + '/og-image.png'))
        if v.get('uploaded'): o['uploadDate'] = v['uploaded']
        objs.append('<script type="application/ld+json">\n' + json.dumps(o, ensure_ascii=False, indent=1) + '\n</script>\n')
    s2 = s2.replace('</head>', ''.join(objs) + '</head>', 1)
    if s2 != s: VIDEOS_CHANGED = True
    wr('videos/index.html', s2)

# ------------------------------------------------------------------ main
TODAY = None
NEW_LIVE = []
V9_OK = False
LESSON_LINKS = []
WIRE_BAR = ''

def main():
    global TODAY, LESSON_LINKS
    ap = argparse.ArgumentParser()
    ap.add_argument('--today', help='YYYY-MM-DD (default: today in India)')
    ap.add_argument('--check', action='store_true')
    ap.add_argument('--fetch', action='store_true', help='v9: read reader counts for "Most read" (automatic on GitHub)')
    ap.add_argument('--due', action='store_true', help='v15: only say whether a full build is needed now (for the workflow)')
    a = ap.parse_args()
    global NOW_HM
    now = dt.datetime.now(IST)
    today = a.today or now.date().isoformat()
    NOW_HM = '23:59' if a.today else now.strftime('%H:%M')
    posts = load()
    if a.due:                                                          # v15: the 30-minute check
        reasons = []
        if not a.today and now.strftime('%H:%M') < '01:00': reasons.append('nightly rebuild (lessons, most read, Pinterest)')
        reasons += [f"post {p['slug']} ({p['date']} {p.get('time') or '00:00'})" for p in posts
                    if p['status'] == 'scheduled' and is_due(p, today)]
        if build_news:
            try: reasons += [f'news: {t}' for t in build_news.pending(today, NOW_HM)]
            except Exception as e: reasons.append('news check failed (' + str(e) + '), building to be safe')
        due = bool(reasons)
        print(('Due: ' + '; '.join(reasons)) if due else f'Nothing due at {NOW_HM} India time.')
        out = os.environ.get('GITHUB_OUTPUT')
        if out:
            with open(out, 'a', encoding='utf-8') as f: f.write(f'due={"true" if due else "false"}\n')
        return
    if a.check:
        up = sorted((p for p in posts if p['status'] == 'scheduled'), key=lambda p: p['date'])
        print(f'OK. {sum(p["status"] == "published" for p in posts)} published, {len(up)} scheduled.')
        for p in up:
            ok = os.path.exists(os.path.join(SCHEDULED_DIR, p['slug'], 'index.html')) or os.path.exists(os.path.join(ROOT, 'blog', p['slug'], 'index.html'))
            print(f'  {p["date"]} {p.get("time") or "00:00"}  {p["slug"]}  {"ready" if ok else "MISSING _scheduled/" + p["slug"] + "/index.html"}')
        warn_missing(posts, today)
        return
    TODAY = today
    publish_due(posts, today)
    warn_missing(posts, today)
    order = {p['slug']: i for i, p in enumerate(posts)}
    published = [p for p in posts if p['status'] == 'published' and is_due(p, today)
                 and os.path.exists(os.path.join(ROOT, 'blog', p['slug'], 'index.html'))]
    published.sort(key=lambda p: order[p['slug']]); published.sort(key=lambda p: p['date'], reverse=True)
    NEW_LIVE[:] = []
    if build_v11:                                                      # v11: live_at, and newest upload first on the same date
        try: NEW_LIVE[:] = build_v11.stamp_live(posts, published, MANIFEST, today); build_v11.sort_published(published, order)
        except Exception as e: print('v11 live_at skipped: ' + str(e))
    live_cats = {p['category'] for p in published}
    global V9_OK
    if build_v9:                                                       # v9: regions, reader counts, YouTube matches
        try: build_v9.prepare(published, fetch=a.fetch or bool(os.environ.get('GITHUB_ACTIONS'))); V9_OK = True
        except Exception as e: print('v9 layer skipped: ' + str(e))
    if build_v10:                                                      # v10: Pinterest pins (read on GitHub, cached in content/)
        try: build_v10.prepare(fetch=a.fetch or bool(os.environ.get('GITHUB_ACTIONS')))
        except Exception as e: print('Pinterest pins not refreshed: ' + str(e))
    build_blog_index(published, live_cats)
    for c in CATEGORIES:
        if c in live_cats: build_category(c, [p for p in published if p['category'] == c], live_cats)
    for a_ in AUTHORS: build_author(a_, [p for p in published if p['author'] == a_])
    if build_v11:                                                      # v11: thin category pages and /sitemap/ are noindex
        try: build_v11.thin_pages(published, CATEGORIES)
        except Exception as e: print('v11 noindex step skipped: ' + str(e))
    for p in published: build_post(p, published)
    global WIRE_BAR
    news, news_home = [], ''
    if build_news:                                                     # v6: news page, homepage wire and the "Latest in" bar
        try: news, WIRE_BAR, news_home = build_news.build(today, published, NOW_HM, live_run=bool(os.environ.get('GITHUB_ACTIONS')) and not a.today); CHANGED.extend(build_news.WRITTEN)   # v15: live_at and instant push only on GitHub
        except Exception as e: print('News not rebuilt: ' + str(e))
    build_home(published, today, news_home)
    lessons = []
    if build_learn:                                                    # v5: before the footer pass, so new pages get it too
        try: lessons = build_learn.build(today); CHANGED.extend(build_learn.WRITTEN)
        except SystemExit: print('Learn/Play not rebuilt: fix content/lessons.json (see the message above).')
    LESSON_LINKS = [(f"/learn/{x['slug']}/", x['title']) for x in lessons]
    build_videos()                                                     # v8: Videos page from content/videos.json
    if V9_OK:                                                          # v9: 404 page and redirect pages, before the footer pass
        try: build_v9.redirects(); build_v9.page_404()
        except Exception as e: print('404/redirects not rebuilt: ' + str(e))
    if build_v10:                                                      # v10: Play arcade, Pinterest on the blog and home pages
        try: build_v10.pages()
        except Exception as e: print('v10 pages not rebuilt: ' + str(e))
    build_footers(published)
    if build_v12:                                                      # v12: icon files (SVG, PNG, sprite, classes), logo files
        try: build_v12.assets()
        except Exception as e: print('v12 icon files not rebuilt: ' + str(e))
    if build_v11:                                                      # v11: /clients links in AMP and scheduled pages
        try: build_v11.fix_hidden_links(fix_links)
        except Exception as e: print('v11 link fix skipped: ' + str(e))
    build_feed(published)
    if build_v10:                                                      # v10: blog/pinterest.xml for Pinterest's Auto-publish
        try: print('blog/pinterest.xml: %d Pins' % build_v10.pinterest_feed(published))
        except Exception as e: print('Pinterest feed not rebuilt: ' + str(e))
    build_sitemap(published, live_cats)
    if V9_OK:                                                          # v9: sitemap_index.xml + section sitemaps
        try: print('v9 sitemaps: %d posts, %d pages, %d learn, %d news, %d videos' % build_v9.sitemaps(published, today))
        except Exception as e: print('Section sitemaps not rebuilt: ' + str(e))
    build_html_sitemap(published, live_cats)
    build_public_json(published)
    build_llms(published, lessons, news)
    if V9_OK:
        CHANGED.extend(build_v9.WRITTEN)
        fresh = [f'{SITE}/blog/{p["slug"]}/' for p in published if p['modified'] >= today or p['date'] >= today or p['slug'] in NEW_LIVE]
        if fresh:
            n = build_v9.indexnow(fresh + [f'{SITE}/blog/', f'{SITE}/', f'{SITE}/sitemap.xml'])
            if n: print(f'IndexNow: told Bing and others about {n} addresses')
        else: build_v9.indexnow([])                                     # keeps the key file in place
        for note in build_v9.NOTES: print('v9: ' + note)
    if build_v10:
        CHANGED.extend(build_v10.WRITTEN)
        for note in build_v10.NOTES: print('v10: ' + note)
    if build_v11:
        CHANGED.extend(build_v11.WRITTEN)
        for note in build_v11.NOTES: print('v11: ' + note)
    if build_v12:
        CHANGED.extend(build_v12.WRITTEN)
        for note in build_v12.NOTES: print('v12: ' + note)
    print(f'{today}: {len(published)} posts live, {len(CHANGED)} files updated.')

if __name__ == '__main__':
    main()
