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
No third-party packages needed.
"""
import argparse, collections, datetime as dt, html, json, os, re, shutil, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
try:
    import build_learn  # v5: Learn and Play. If it's missing or broken, blog publishing still runs.
except Exception as _e:
    build_learn = None
    print('Learn/Play skipped: ' + str(_e))

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = 'https://labsnmx.com'
MANIFEST = os.path.join(ROOT, 'content', 'posts.json')
SCHEDULED_DIR = os.path.join(ROOT, '_scheduled')
MAX_PER_DAY = 2
IST = dt.timezone(dt.timedelta(hours=5, minutes=30))
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
])
AUTHORS = {'neeraj': 'Neeraj', 'anisha': 'Anisha'}
PILLARS = [  # (category slug, title, line) shown in "Notes from the studio" on /blog/
    ('ai-design', 'AI and creative technology', 'AI design tools, Adobe, Canva and Figma, tested on real brand work.'),
    ('meta-ads', 'Advertising and marketing', 'Meta ads, campaigns and channels, with the numbers behind them.'),
    ('brand-stories', 'Branding and design strategy', 'Brand stories, rebrands, identity and packaging for Indian brands.'),
    ('growth', 'Platform growth', 'YouTube, Instagram and SEO: what changed this week and what to do about it.'),
]
STATIC_PAGES = [  # (path, changefreq, priority)
    ('/', 'weekly', '1.0'), ('/blog/', 'daily', '0.9'), ('/news/', 'daily', '0.7'), ('/videos/', 'monthly', '0.6'),
    ('/about/', 'yearly', '0.6'), ('/contact/', 'yearly', '0.5'), ('/editorial-standards/', 'yearly', '0.5'),
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
def rfc822(d):
    x = dt.datetime.strptime(d, '%Y-%m-%d')
    return x.strftime('%a, %d %b %Y') + ' 09:00:00 +0530'
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
        p.setdefault('modified', p['date']); p.setdefault('image', p['slug']); p.setdefault('takeaways', [])
        p.setdefault('track', 'growth' if p['category'] == 'growth' else 'studio')
        p.setdefault('author_name', AUTHORS.get(p['author'], p['author']))
        p.setdefault('category_label', CATEGORIES.get(p['category'], (p['category'],))[0])
        p.setdefault('has_amp', os.path.exists(os.path.join(ROOT, 'blog', p['slug'], 'amp', 'index.html')))
    if errors:
        print('content/posts.json problems:\n  ' + '\n  '.join(errors)); sys.exit(1)
    return posts

def publish_due(posts, today):
    moved = []
    for p in posts:
        if p['status'] != 'scheduled' or p['date'] > today: continue
        src, dst = os.path.join(SCHEDULED_DIR, p['slug']), os.path.join(ROOT, 'blog', p['slug'])
        if not os.path.exists(os.path.join(src, 'index.html')):
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
    pops = [p for p in published if p.get('popular')][:5] or published[:5]
    return ''.join(f'<li><a href="/blog/{p["slug"]}/">{esc(p.get("short") or short_title(p["title"]))}</a></li>' for p in pops)

def short_title(t):
    t = re.split(r'[:?]', t)[0].strip()
    return t if len(t) <= 48 else t[:46].rsplit(' ', 1)[0] + '…'

# ------------------------------------------------------------------ pages
def build_blog_index(published, live_cats):
    s = rd('blog/index.html')
    s = re.sub(r'<nav class="cats" aria-label="Blog categories">.*?</nav>', lambda m: cats_nav(live_cats, None, True), s, count=1, flags=re.S)
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
    s = replace_list(s, ''.join(row(p) for p in posts_in_cat))
    wr(path, s)

def build_author(slug, posts_by):
    path = f'blog/author/{slug}/index.html'
    if not os.path.exists(os.path.join(ROOT, path)): return
    wr(path, replace_list(rd(path), ''.join(row(p) for p in posts_by)))

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

def build_home(published, today):
    s = rd('index.html')
    s = re.sub(r'<a class="bh-feature" href=.*?</a>', lambda m: home_feature(published[0], today), s, count=1, flags=re.S)
    s = replace_list(s, ''.join(home_tile(p) for p in published[1:12]) + '        ', r'<ul class="bh-rail" id="bhRail">')
    s = re.sub(r'Read all \d+ posts', f'Read all {len(published)} posts', s)
    wr('index.html', s)

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
    <pubDate>{rfc822(p["date"])}</pubDate>
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
    latest = published[0]['date']
    urls = []
    def url(loc, lastmod, freq, prio, images=()):
        img = ''.join(f'\n    <image:image><image:loc>{esc(i)}</image:loc></image:image>' for i in images)
        urls.append(f'  <url>\n    <loc>{SITE}{loc}</loc>\n    <lastmod>{lastmod}</lastmod>\n    <changefreq>{freq}</changefreq>\n    <priority>{prio}</priority>{img}\n  </url>')
    for loc, freq, prio in STATIC_PAGES:
        url(loc, latest if loc in ('/', '/blog/', '/news/', '/sitemap/') else '2026-11-22', freq, prio)
    for c in CATEGORIES:
        if c in live_cats: url(f'/blog/category/{c}/', max(p['date'] for p in published if p['category'] == c), 'weekly', '0.6')
    for a in AUTHORS:
        mine = [p['date'] for p in published if p['author'] == a]
        if mine: url(f'/blog/author/{a}/', max(mine), 'weekly', '0.5')
    for p in published:
        url(f'/blog/{p["slug"]}/', p['modified'], 'monthly', '0.8', [f'{SITE}/assets/blog/{p["image"]}.jpg'])
    for loc, lastmod in (build_learn.urls(TODAY) if build_learn else []):                       # v5: Learn hub, lessons and Play
        url(loc, lastmod, 'weekly' if loc in ('/learn/', '/play/') else 'monthly', '0.8' if loc == '/learn/' else '0.7')
    wr('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n'
       + '\n'.join(urls) + '\n</urlset>\n')

def build_html_sitemap(published, live_cats):
    tpl = rd('blog/category/branding/index.html')
    tl, td = CATEGORIES['branding']
    desc = 'Every page and post on labsnmx.com: services, the blog by topic and author, news, videos and policies.'
    s = tpl.replace('/blog/category/branding/', '/sitemap/').replace(td, desc).replace(f'{tl} | NMX Labs Blog', 'Sitemap | NMX Labs')
    s = re.sub(r'<script type="application/ld\+json">.*?</script>\n<script type="application/ld\+json">.*?</script>',
               lambda m: '<script type="application/ld+json">\n' + json.dumps({'@context': 'https://schema.org', '@type': 'WebPage', 'name': 'Sitemap | NMX Labs', 'url': f'{SITE}/sitemap/', 'description': desc}, indent=1) + '\n</script>', s, count=1, flags=re.S)
    cols = []
    cols.append('<div><h2>Studio</h2><ul>' + ''.join(f'<li><a href="{h}">{l}</a></li>' for h, l in [
        ('/', 'Home'), ('/#services', 'Services and pricing'), ('/#clients', 'Clients'), ('/about/', 'About NMX Labs'),
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

def build_public_json(published):
    out = {'updated': published[0]['date'], 'site': SITE, 'posts': []}
    for p in published[:40]:
        out['posts'].append({'slug': p['slug'], 'title': p['title'], 'url': f'{SITE}/blog/{p["slug"]}/', 'date': p['date'],
                             'dek': p['dek'], 'takeaways': p['takeaways'][:4], 'category': p['category_label'], 'track': p['track'],
                             'author': p['author_name'], 'read_min': p['read_min'],
                             'image': f'{SITE}/assets/blog/{p["image"]}.jpg', 'thumb': f'{SITE}/assets/blog/{p["image"]}.jpg'})
    wr('blog/posts.json', json.dumps(out, ensure_ascii=False, indent=1) + '\n')

# ------------------------------------------------------------------ main
TODAY = None
LESSON_LINKS = []

def main():
    global TODAY, LESSON_LINKS
    ap = argparse.ArgumentParser()
    ap.add_argument('--today', help='YYYY-MM-DD (default: today in India)')
    ap.add_argument('--check', action='store_true')
    a = ap.parse_args()
    today = a.today or dt.datetime.now(IST).date().isoformat()
    posts = load()
    if a.check:
        up = sorted((p for p in posts if p['status'] == 'scheduled'), key=lambda p: p['date'])
        print(f'OK. {sum(p["status"] == "published" for p in posts)} published, {len(up)} scheduled.')
        for p in up:
            ok = os.path.exists(os.path.join(SCHEDULED_DIR, p['slug'], 'index.html'))
            print(f'  {p["date"]}  {p["slug"]}  {"ready" if ok else "MISSING _scheduled/" + p["slug"] + "/index.html"}')
        return
    TODAY = today
    publish_due(posts, today)
    order = {p['slug']: i for i, p in enumerate(posts)}
    published = [p for p in posts if p['status'] == 'published' and p['date'] <= today
                 and os.path.exists(os.path.join(ROOT, 'blog', p['slug'], 'index.html'))]
    published.sort(key=lambda p: order[p['slug']]); published.sort(key=lambda p: p['date'], reverse=True)
    live_cats = {p['category'] for p in published}
    build_blog_index(published, live_cats)
    for c in CATEGORIES:
        if c in live_cats: build_category(c, [p for p in published if p['category'] == c], live_cats)
    for a_ in AUTHORS: build_author(a_, [p for p in published if p['author'] == a_])
    for p in published: build_post(p, published)
    build_home(published, today)
    lessons = []
    if build_learn:                                                    # v5: before the footer pass, so new pages get it too
        try: lessons = build_learn.build(today); CHANGED.extend(build_learn.WRITTEN)
        except SystemExit: print('Learn/Play not rebuilt: fix content/lessons.json (see the message above).')
    LESSON_LINKS = [(f"/learn/{x['slug']}/", x['title']) for x in lessons]
    build_footers(published)
    build_feed(published)
    build_sitemap(published, live_cats)
    build_html_sitemap(published, live_cats)
    build_public_json(published)
    print(f'{today}: {len(published)} posts live, {len(CHANGED)} files updated.')

if __name__ == '__main__':
    main()
