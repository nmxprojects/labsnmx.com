#!/usr/bin/env python3
"""
NMX Labs v9 layer, called by scripts/build.py. If anything here breaks, build.py carries on with the v8 behaviour.

  - Blog page: a bento grid of every post (cover images, mixed tile sizes) that the month/category/author/search filters
    still work on, plus a "Most read this month" band and a "Picked for you" strip filled in by /assets/curate.js.
  - Category and author pages use the same bento tiles.
  - Post pages: the "Related reading" sentence becomes bento cards with cover images, a YouTube tile and the month's
    most-read posts. Works on every existing post and on every new one, on every run.
  - Most read: reader counts for the last 30 days (counts only, no personal data), saved in content/popular.json.
    If the counts can't be read, the last saved file is used; with no file at all, posts marked "popular" are used.
  - Country curation: every post, news story and card gets a data-region tag (in, uk, us, me, global), worked out from
    its words. Add "regions": ["in", "uk"] to a post in content/posts.json to set it by hand.
  - YouTube: videos from content/videos.json are matched to posts by their words or their "related" link; posts with no
    match get a link to the channel (content/youtube.json) or to a YouTube search for the topic.
  - Sitemaps: sitemap.xml stays exactly as before (the Creator reads it). New: sitemap_index.xml pointing at
    sitemap-pages.xml, sitemap-posts.xml, sitemap-learn.xml, sitemap-news.xml (Google News) and sitemap-video.xml.
  - 404.html that suggests (and, for a near-exact match, opens) the right page, and redirect pages for old addresses.
  - IndexNow: tells Bing and other IndexNow engines about new and changed posts (free, no account).
No third-party packages.
"""
import collections, datetime as dt, html, json, os, re, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = 'https://labsnmx.com'
MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
WRITTEN = []
NOTES = []

def esc(s): return html.escape(str(s if s is not None else ''), quote=True)
def rd(p):
    full = os.path.join(ROOT, p)
    return open(full, encoding='utf-8').read() if os.path.exists(full) else ''
def wr(p, s):
    full = os.path.join(ROOT, p)
    os.makedirs(os.path.dirname(full) or ROOT, exist_ok=True)
    old = open(full, encoding='utf-8').read() if os.path.exists(full) else None
    if old != s:
        open(full, 'w', encoding='utf-8').write(s); WRITTEN.append(p)
def human(d): y, m, dd = d.split('-'); return f'{int(dd)} {MONTHS[int(m) - 1]} {y}'
def short_date(d): y, m, dd = d.split('-'); return f'{int(dd)} {MONTHS[int(m) - 1][:3]}'

# ------------------------------------------------------------------ category colours (the tint says which topic it is)
TINT = {'design-news': '#dcebfa', 'ai-design': '#e9e3fb', 'adobe': '#fde0ea', 'meta-ads': '#ffe4d6', 'branding': '#fff0c2',
        'brand-stories': '#e2f0df', 'growth': '#d8efe9', 'global': '#efe7da'}

def img(p, size='640'):
    """Cover image path for a post, falling back when a size is missing."""
    base = p.get('image') or p['slug']
    for suffix in ([f'-{size}.webp', '.webp', '.jpg'] if size else ['.webp', '-640.webp', '.jpg']):
        if os.path.exists(os.path.join(ROOT, 'assets', 'blog', base + suffix)): return f'/assets/blog/{base}{suffix}'
    return '/og-image.png'

# ------------------------------------------------------------------ regions
REGION_NAMES = {'in': 'India', 'uk': 'the UK', 'us': 'the US', 'me': 'the Middle East', 'global': 'everywhere'}
INDIA = re.compile(r'\b(India|Indian|Indians|Bharat|Delhi|Mumbai|Bengaluru|Bangalore|Gurugram|Gurgaon|Noida|Hyderabad|Chennai|Kolkata|Pune|'
                   r'rupees?|INR|Rs\.?\s?\d|₹|Amul|Zomato|Swiggy|Blinkit|Zepto|Instamart|Campa|Reliance|CRED|Eternal|Cadbury India|Flipkart|'
                   r'Myntra|Nykaa|Paytm|PhonePe|Jio|Tata|Mahindra|Ola|Hindi|IPL|BCCI|FSSAI|Legal Metrology|D2C|[Cc]ricket|Excitel|Asia Cup)\b')
UK = re.compile(r'\b(UK|U\.K\.|British|Britain|England|London|Scotland|John Lewis|Marks (and|&) Spencer|M&S|Tesco|Sainsbury’?s|Boots|BBC|'
                r'Channel 4|ASA|Ofcom|System1|Premier League)\b')
US = re.compile(r'\b(US|U\.S\.|USA|American|America|New York|California|Silicon Valley|Super Bowl|Hollywood|FTC|Docker|Thanksgiving|'
                r'Hulu|Netflix US)\b')
ME = re.compile(r'\b(Doha|Qatar|UAE|Dubai|Abu Dhabi|Saudi|Riyadh|Gulf|GCC|Middle East|Oman|Kuwait|Bahrain)\b')
GLOBAL_TOPICS = re.compile(r'\b(Adobe|Firefly|Photoshop|Canva|Figma|Meta|Instagram|Facebook|WhatsApp|YouTube|Google|ChatGPT|OpenAI|Gemini|'
                           r'Veo|Sora|AI|Andromeda|Threads|LinkedIn|TikTok|SEO|blog|blogging)\b')
NEWS_REGION = {'India': 'in', 'UK': 'uk', 'US': 'us', 'Middle East': 'me', 'Gulf': 'me', 'Global': 'global'}

def regions_for(p):
    """Which audiences a post is most useful to: in, uk, us, me and/or global."""
    if isinstance(p.get('regions'), list) and p['regions']:
        return [r for r in p['regions'] if r in REGION_NAMES] or ['global']
    text = ' '.join([p.get('title', ''), p.get('dek', ''), ' '.join(p.get('takeaways', []) or []), p['slug'].replace('-', ' ')])
    out = []
    if INDIA.search(text) or re.search(r'\bindia\b', p['slug']): out.append('in')
    if UK.search(text): out.append('uk')
    if US.search(text): out.append('us')
    if ME.search(text): out.append('me')
    if p.get('category') in ('global', 'growth', 'ai-design', 'adobe', 'design-news') or GLOBAL_TOPICS.search(text) or not out: out.append('global')
    return out

# ------------------------------------------------------------------ most read
POPULAR = {'slugs': [], 'source': 'fallback', 'window': 30, 'youtube': ''}

def backend_url():
    m = re.search(r"BACKEND_URL:\s*'(https://script\.google\.com/[^']+/exec)'", rd('assets/nmx.js'))
    return m.group(1) if m else ''

def load_popular(published, fetch=True):
    """Ranks published posts by readers in the last 30 days. Order of preference: fresh counts, the last saved counts,
    posts marked "popular" in content/posts.json, newest first."""
    live = {p['slug'] for p in published}
    saved_path = os.path.join(ROOT, 'content', 'popular.json')
    saved = {}
    if os.path.exists(saved_path):
        try: saved = json.load(open(saved_path, encoding='utf-8'))
        except Exception: saved = {}
    url = backend_url()
    if fetch and url:
        try:
            req = urllib.request.Request(url + '?action=popular&days=30', headers={'User-Agent': 'nmx-build'})
            with urllib.request.urlopen(req, timeout=25) as r: d = json.loads(r.read().decode('utf-8'))
            if d.get('ok') and isinstance(d.get('items'), list):
                saved = {'_how': 'Readers per post over the last 30 days, refreshed by the daily build. Counts only: no personal data.',
                         'updated': dt.date.today().isoformat(), 'window_days': d.get('days', 30),
                         'items': [{'slug': x.get('slug'), 'readers': x.get('readers', 0), 'views': x.get('views', 0)} for x in d['items'] if x.get('slug')],
                         'youtube': d.get('youtube', '')}
                wr('content/popular.json', json.dumps(saved, ensure_ascii=False, indent=1) + '\n')
            else:
                NOTES.append('Most read: the reader counts aren’t available yet, so the last saved list (or the posts marked popular) is used.')
        except Exception as e:
            NOTES.append('Most read: couldn’t read the counts this run (' + str(e)[:80] + '); the last saved list is used.')
    ranked = [x['slug'] for x in sorted(saved.get('items', []), key=lambda x: (-(x.get('readers') or 0), -(x.get('views') or 0))) if x.get('slug') in live and (x.get('readers') or x.get('views'))]
    POPULAR['source'] = 'counts' if len(ranked) >= 3 else 'fallback'
    flagged = [p['slug'] for p in published if p.get('popular')]
    for s in flagged + [p['slug'] for p in published]:
        if s not in ranked: ranked.append(s)
    POPULAR['slugs'] = ranked
    POPULAR['youtube'] = saved.get('youtube', '') or ''
    return ranked

def pop_rank(slug):
    s = POPULAR['slugs'][:5]
    return s.index(slug) + 1 if slug in s else 0

# ------------------------------------------------------------------ YouTube
YT = {'videos': [], 'channel': '', 'search': True, 'queries': {}}

def load_youtube():
    vp = os.path.join(ROOT, 'content', 'videos.json')
    try: vids = json.load(open(vp, encoding='utf-8')).get('videos', [])
    except Exception: vids = []
    YT['videos'] = [v for v in vids if v.get('kind') == 'youtube' and v.get('id') and v.get('active', True) is not False]
    cfg = {}
    try: cfg = json.load(open(os.path.join(ROOT, 'content', 'youtube.json'), encoding='utf-8'))
    except Exception: pass
    YT['channel'] = (cfg.get('channel') or POPULAR.get('youtube') or '').strip()
    YT['search'] = cfg.get('search_links', True) is not False
    YT['queries'] = cfg.get('queries') or {}

STOP = set('the a an and or of to in on for with is are was it its your you our we this that what how why when which who from by at as be '
           'vs not just new now more most all can will than into out about after before their there here them they 2025 2026 every one'.split())
def words(s): return {w for w in re.findall(r'[a-z0-9]+', s.lower()) if len(w) > 2 and w not in STOP}

def video_for(p):
    """The best-matching YouTube video for a post, or None."""
    pw = words(p['title'] + ' ' + p.get('dek', '') + ' ' + p.get('category_label', ''))
    best, score = None, 0
    for v in YT['videos']:
        rel = str(v.get('related') or '')
        s = 100 if rel and p['slug'] in rel else 0
        s += 3 * len(pw & words(v.get('title', ''))) + len(pw & words(v.get('description', '')))
        if s > score: best, score = v, s
    return best if score >= 6 else None

LEAD_WORDS = re.compile(r'^(why|how|what|when|the|a|an|our|your|everyone|latest)\s+', re.I)
def yt_query(p):
    q = YT['queries'].get(p['slug'])
    if q: return q
    q = re.split(r'[:?(.]', p['title'])[0].strip()
    for _ in range(3): q = LEAD_WORDS.sub('', q)
    return q[:70]

def yt_search_url(q): return 'https://www.youtube.com/results?search_query=' + urllib.parse.quote_plus(q)

PLAY = '<svg class="yt-play" viewBox="0 0 68 48" aria-hidden="true"><path d="M66.5 7.7a8.5 8.5 0 0 0-6-6C55.2.3 34 .3 34 .3s-21.2 0-26.5 1.4a8.5 8.5 0 0 0-6 6C0 13 0 24 0 24s0 11 1.5 16.3a8.5 8.5 0 0 0 6 6C12.8 47.7 34 47.7 34 47.7s21.2 0 26.5-1.4a8.5 8.5 0 0 0 6-6C68 35 68 24 68 24s0-11-1.5-16.3z" fill="#ff0000"/><path d="M45 24 27 14v20z" fill="#fff"/></svg>'

def watch_tile(p, cls):
    """A YouTube tile for a post: a matched video, else the channel, else a search for the topic."""
    v = video_for(p)
    if v:
        return (f'<li class="{cls} {cls}--video"><a href="https://www.youtube.com/watch?v={esc(v["id"])}" target="_blank" rel="noopener" data-yt="{esc(v["id"])}">'
                f'<span class="{cls}-img"><img src="https://i.ytimg.com/vi/{esc(v["id"])}/hqdefault.jpg" alt="" width="480" height="360" loading="lazy" decoding="async">{PLAY}</span>'
                f'<span class="{cls}-body"><span class="{cls}-cat">Watch on YouTube</span><span class="{cls}-title">{esc(v.get("title", "Video"))}</span></span></a></li>')
    sub = (f' Or <a href="{esc(YT["channel"])}" target="_blank" rel="noopener">subscribe to NMX Labs</a>.' if YT['channel'] else '')
    if YT['search']:
        q = yt_query(p)
        return (f'<li class="{cls} {cls}--video {cls}--plain"><div class="{cls}-body">{PLAY}<span class="{cls}-cat">Watch on YouTube</span>'
                f'<a class="{cls}-title" href="{esc(yt_search_url(q))}" target="_blank" rel="noopener nofollow">Video explainers: {esc(q)}</a>'
                f'<span class="{cls}-meta">Opens YouTube in a new tab.{sub}</span></div></li>')
    if YT['channel']:
        return (f'<li class="{cls} {cls}--video {cls}--plain"><div class="{cls}-body">{PLAY}<span class="{cls}-cat">YouTube</span>'
                f'<a class="{cls}-title" href="{esc(YT["channel"])}" target="_blank" rel="noopener">Watch NMX Labs on YouTube</a>'
                f'<span class="{cls}-meta">Short explainers on design, AI and marketing.</span></div></li>')
    return ''

# ------------------------------------------------------------------ tiles
def badge(p, today):
    r = pop_rank(p['slug'])
    if r: return f'<span class="bt-badge bt-badge--pop">{"No. 1 this month" if r == 1 and POPULAR["source"] == "counts" else "Most read"}</span>'
    if today and (dt.date.fromisoformat(today) - dt.date.fromisoformat(p['date'])).days <= 2: return '<span class="bt-badge bt-badge--new">New</span>'
    return ''

def tile(p, size, today, with_data=True):
    """One bento tile. size: lead, side, m (one third) or w (half, picture beside the words)."""
    data = (f' data-post data-month="{p["date"][:7]}" data-cat="{p["category"]}" data-author="{p["author"]}"' if with_data else '')
    big = size == 'lead'
    dek = f'<span class="bt-dek">{esc(p["dek"])}</span>' if size in ('lead', 'w') else ''
    src = img(p, '' if big else '640')
    return (f'<li class="bt bt--{size}"{data} data-region="{" ".join(p["regions"])}" data-slug="{p["slug"]}" style="--tint:{TINT.get(p["category"], "#efe7da")}">'
            f'<a href="/blog/{p["slug"]}/">'
            f'<span class="bt-img"><img src="{src}" alt="" width="{1200 if big else 640}" height="{675 if big else 360}" loading="{"eager" if big else "lazy"}" decoding="async"{" fetchpriority=\"high\"" if big else ""}></span>'
            f'<span class="bt-body"><span class="bt-top"><span class="bt-cat">{esc(p["category_label"])}</span>{badge(p, today)}</span>'
            f'<span class="bt-title">{esc(p["title"])}</span>{dek}'
            f'<span class="bt-meta">{esc(p["author_name"])} · <time datetime="{p["date"]}">{human(p["date"])}</time> · {p["read_min"]} min read</span></span>'
            f'</a></li>\n')

PATTERN = ['m', 'm', 'm', 'w', 'w']
def grid_items(posts, today, lead=True):
    out = []
    for i, p in enumerate(posts):
        if lead and i == 0: size = 'lead'
        elif lead and i in (1, 2): size = 'side'
        else: size = PATTERN[(i - (3 if lead else 0)) % len(PATTERN)]
        out.append(tile(p, size, today))
    return ''.join(out)

def set_ul(s, inner):
    """Makes <ul class="post-list" ...> a bento grid and fills it."""
    m = re.search(r'<ul class="post-list[^"]*"([^>]*)>', s)
    if not m: return s
    end = s.index('</ul>', m.end())
    return s[:m.start()] + f'<ul class="post-list bento"{m.group(1)}>' + '\n' + inner + s[end:]

def between(s, start, end, inner):
    if start not in s: return s
    if end not in s: return s.replace(start, start + inner + end, 1)
    a = s.index(start) + len(start); b = s.index(end, a)
    return s[:a] + inner + s[b:]

# ------------------------------------------------------------------ blog page
def band(published, today):
    by = {p['slug']: p for p in published}
    top = [by[s] for s in POPULAR['slugs'] if s in by][:5]
    if not top: return ''
    first, rest = top[0], top[1:5]
    counted = POPULAR['source'] == 'counts'
    head = ('<h2 id="mrH">Most read this month</h2><p>The posts the most readers opened in the last 30 days.</p>' if counted
            else '<h2 id="mrH">Reader favourites</h2><p>The posts readers come back to most.</p>')
    lis = ''.join(f'<li><a href="/blog/{q["slug"]}/"><span class="mr-n">{i + 2}</span><img src="{img(q)}" alt="" width="640" height="360" loading="lazy" decoding="async">'
                  f'<span><b>{esc(q["title"])}</b><small>{esc(q["category_label"])} · {q["read_min"]} min read</small></span></a></li>' for i, q in enumerate(rest))
    vids = YT['videos'][:1]
    watch = ''
    if vids:
        v = vids[0]
        yt = f'https://www.youtube.com/watch?v={esc(v["id"])}'
        watch = (f'<div class="mr-watch"><a class="mr-watch-img" href="{yt}" target="_blank" rel="noopener" data-yt="{esc(v["id"])}" aria-label="Play on YouTube: {esc(v.get("title", ""))}">'
                 f'<img src="https://i.ytimg.com/vi/{esc(v["id"])}/hqdefault.jpg" alt="" width="480" height="360" loading="lazy" decoding="async">{PLAY}</a>'
                 f'<span class="mr-watch-body"><small>Watch on YouTube</small><a class="mr-watch-title" href="{yt}" target="_blank" rel="noopener">{esc(v.get("title", ""))}</a>'
                 '<span class="mr-watch-more">More on our <a href="/videos/">Videos page</a>'
                 + (f' and <a href="{esc(YT["channel"])}" target="_blank" rel="noopener">YouTube channel</a>' if YT['channel'] else '') + '.</span>'
                 + '</span></div>')
    return (f'\n<section class="mr" aria-labelledby="mrH" data-band>\n  <div class="mr-head">{head}</div>\n  <div class="mr-grid">\n'
            f'    <a class="mr-top" href="/blog/{first["slug"]}/"><span class="mr-top-img"><img src="{img(first, "")}" alt="" width="1200" height="675" loading="lazy" decoding="async"></span>'
            f'<span class="mr-top-body"><span class="mr-rank">{"No. 1" if counted else "Favourite"}</span><span class="mr-top-title">{esc(first["title"])}</span>'
            f'<span class="mr-top-dek">{esc(first["dek"])}</span><span class="mr-top-meta">{esc(first["author_name"])} · {first["read_min"]} min read</span></span></a>\n'
            f'    <ol class="mr-list" start="2">{lis}</ol>\n    {watch}\n  </div>\n</section>\n'
            '<section class="pick" data-pick data-band hidden aria-labelledby="pickH"><div class="pick-head"><div><h2 id="pickH">Picked for you</h2><p data-pick-line></p></div>'
            '<button class="pick-change" type="button" data-personalise>Personalise</button></div><ul class="pick-list" data-pick-list></ul></section>\n'
            f'<h2 class="bento-h" data-band id="allH">Every post, newest first</h2>\n')

def blog_index(s, published, today):
    if '<!--BLOG-BAND-->' not in s:                                   # first v9 run: the old lead story becomes the band
        s, n = re.subn(r'<a class="feature" href=.*?</a>\n', '<!--BLOG-BAND--><!--/BLOG-BAND-->\n', s, count=1, flags=re.S)
        if not n: s = s.replace('<ul class="post-list"', '<!--BLOG-BAND--><!--/BLOG-BAND-->\n<ul class="post-list"', 1)
    s = between(s, '<!--BLOG-BAND-->', '<!--/BLOG-BAND-->', band(published, today))
    return set_ul(s, grid_items(published, today))

def listing(s, posts, today):
    return set_ul(s, grid_items(posts, today, lead=len(posts) >= 4))

# ------------------------------------------------------------------ post pages: related reading as bento
A_RE = re.compile(r'<a\s[^>]*href="([^"]+)"[^>]*>(.*?)</a>', re.S)

def related(s, p, published):
    by = {q['slug']: q for q in published}
    slugs, more = [], ''
    m = re.search(r'<p class="related-reading">(.*?)</p>', s, re.S)
    sec = re.search(r'<section class="rb"[^>]*data-rb="([^"]*)"[^>]*>.*?</section><!--/rb-->', s, re.S)
    if sec:
        slugs = [x for x in sec.group(1).split(',') if x]
        mm = re.search(r'<p class="rb-more">(.*?)</p>', sec.group(0), re.S)
        more = mm.group(1) if mm else ''
    elif m:
        others = []
        for href, text in A_RE.findall(m.group(1)):
            path = re.sub(r'^https?://labsnmx\.com', '', href)
            k = re.match(r'^/blog/([a-z0-9-]+)/$', path)
            if k and k.group(1) not in ('category', 'author'): slugs.append(k.group(1))
            else: others.append((path, text))
        authors = [(h, t) for h, t in others if '/blog/author/' in h]
        cats = [(h, t) for h, t in others if '/blog/category/' in h]
        rest = [(h, t) for h, t in others if (h, t) not in authors + cats]
        bits = []
        if authors: bits.append('More from ' + ', '.join(f'<a href="{esc(h)}">{t}</a>' for h, t in authors))
        if cats: bits.append(('or browse every ' if bits else 'Browse every ') + ', '.join(f'<a href="{esc(h)}">{t}</a>' for h, t in cats))
        if rest: bits.append('see also ' + ', '.join(f'<a href="{esc(h)}">{t}</a>' for h, t in rest))
        more = ', '.join(bits) + ('.' if bits else '')
    else:
        return s
    picks = [by[x] for x in slugs if x in by and x != p['slug']]
    for q in [q for q in published if q['category'] == p['category'] and q['slug'] != p['slug']] + published:
        if len(picks) >= 3: break
        if q['slug'] != p['slug'] and q not in picks: picks.append(q)
    picks = picks[:3]
    if not picks: return s

    def card(q, lead=False):
        return (f'<li class="rb-card{" rb-card--lead" if lead else ""}" style="--tint:{TINT.get(q["category"], "#efe7da")}"><a href="/blog/{q["slug"]}/">'
                f'<span class="rb-card-img"><img src="{img(q, "" if lead else "640")}" alt="" width="{1200 if lead else 640}" height="{675 if lead else 360}" loading="lazy" decoding="async"></span>'
                f'<span class="rb-card-body"><span class="rb-card-cat">{esc(q["category_label"])}{" · Most read" if pop_rank(q["slug"]) else ""}</span>'
                f'<span class="rb-card-title">{esc(q["title"])}</span><span class="rb-card-meta">{q["read_min"]} min read</span></span></a></li>')
    taken = {p['slug']} | {q['slug'] for q in picks}
    pops = [by[x] for x in POPULAR['slugs'] if x in by and x not in taken][:3]
    pop = ''
    if pops:
        pop = ('<li class="rb-card rb-card--pop"><div class="rb-card-body"><span class="rb-card-cat">' + ('Most read this month' if POPULAR['source'] == 'counts' else 'Reader favourites')
               + '</span><ol>' + ''.join(f'<li><a href="/blog/{q["slug"]}/">{esc(q["title"])}</a></li>' for q in pops) + '</ol></div></li>')
    cards = card(picks[0], True) + ''.join(card(q) for q in picks[1:]) + watch_tile(p, 'rb-card') + pop
    block = (f'<section class="rb" aria-labelledby="rbH" data-rb="{",".join(q["slug"] for q in picks)}">'
             f'<h2 class="rb-h" id="rbH">Related reading</h2><ul class="rb-grid">{cards}</ul>'
             + (f'<p class="rb-more">{more}</p>' if more else '') + '</section><!--/rb-->')
    if sec: return s[:sec.start()] + block + s[sec.end():]
    return s[:m.start()] + block + s[m.end():]

# ------------------------------------------------------------------ sitemaps
def _url(loc, lastmod, extra=''):
    return f'  <url>\n    <loc>{SITE}{loc}</loc>\n' + (f'    <lastmod>{lastmod}</lastmod>\n' if lastmod else '') + extra + '  </url>'

def sitemaps(published, today):
    """Section sitemaps and an index, built from the finished sitemap.xml (so they list exactly the same pages)."""
    s = rd('sitemap.xml')
    entries = re.findall(r'<url>\s*<loc>([^<]+)</loc>\s*<lastmod>([^<]*)</lastmod>(.*?)</url>', s, re.S)
    posts, learn, pages = [], [], []
    for loc, lm, rest in entries:
        path = loc[len(SITE):] if loc.startswith(SITE) else loc
        images = ''.join(f'    <image:image><image:loc>{i}</image:loc></image:image>\n' for i in re.findall(r'<image:loc>([^<]+)</image:loc>', rest))
        row = _url(path, lm, images)
        if re.match(r'^/blog/[a-z0-9-]+/$', path) and not path.startswith(('/blog/category/', '/blog/author/')): posts.append(row)
        elif path.startswith(('/learn/', '/play/')): learn.append(row)
        else: pages.append(row)
    head = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"'
    img_ns = ' xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"'
    files = {}
    files['sitemap-pages.xml'] = head + '>\n' + '\n'.join(pages) + '\n</urlset>\n'
    files['sitemap-posts.xml'] = head + img_ns + '>\n' + '\n'.join(posts) + '\n</urlset>\n'
    if learn: files['sitemap-learn.xml'] = head + '>\n' + '\n'.join(learn) + '\n</urlset>\n'
    # Google News: articles from the last two days only (an empty list is valid).
    cut = (dt.date.fromisoformat(today) - dt.timedelta(days=2)).isoformat()
    news = []
    for p in published:
        if p['date'] < cut: continue
        news.append(f'  <url>\n    <loc>{SITE}/blog/{p["slug"]}/</loc>\n    <news:news>\n      <news:publication><news:name>NMX Labs</news:name><news:language>en</news:language></news:publication>\n'
                    f'      <news:publication_date>{p["date"]}T09:00:00+05:30</news:publication_date>\n      <news:title>{esc(p["title"])}</news:title>\n    </news:news>\n  </url>')
    files['sitemap-news.xml'] = head + ' xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n' + '\n'.join(news) + ('\n' if news else '') + '</urlset>\n'
    # Videos page: one <video:video> per YouTube video.
    vids = []
    for v in YT['videos']:
        if v.get('show_from') and v['show_from'] > today: continue
        vids.append(f'    <video:video>\n      <video:thumbnail_loc>https://i.ytimg.com/vi/{esc(v["id"])}/hqdefault.jpg</video:thumbnail_loc>\n'
                    f'      <video:title>{esc(v.get("title", ""))}</video:title>\n      <video:description>{esc(v.get("description") or v.get("title", ""))}</video:description>\n'
                    f'      <video:player_loc>https://www.youtube.com/embed/{esc(v["id"])}</video:player_loc>\n'
                    + (f'      <video:publication_date>{esc(v["uploaded"])}</video:publication_date>\n' if v.get('uploaded') else '') + '    </video:video>\n')
    if vids and os.path.exists(os.path.join(ROOT, 'videos', 'index.html')):
        files['sitemap-video.xml'] = (head + ' xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">\n  <url>\n    <loc>' + SITE + '/videos/</loc>\n'
                                      + ''.join(vids) + '  </url>\n</urlset>\n')
    for name, body in files.items(): wr(name, body)
    for old in ('sitemap-learn.xml', 'sitemap-video.xml'):
        if old not in files and os.path.exists(os.path.join(ROOT, old)): os.remove(os.path.join(ROOT, old))
    newest = max([p['modified'] for p in published] + [today])
    idx = ('<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
           + ''.join(f'  <sitemap>\n    <loc>{SITE}/{n}</loc>\n    <lastmod>{newest if n != "sitemap-pages.xml" else today}</lastmod>\n  </sitemap>\n' for n in sorted(files))
           + '</sitemapindex>\n')
    wr('sitemap_index.xml', idx)
    robots = rd('robots.txt')
    if robots and 'sitemap_index.xml' not in robots:
        wr('robots.txt', robots.rstrip('\n') + '\nSitemap: https://labsnmx.com/sitemap_index.xml\n')
    return len(posts), len(pages), len(learn), len(news), len(vids)

# ------------------------------------------------------------------ 404 + redirects
# Old or mistyped addresses that should open a real page. Add more as "old path": "new path".
REDIRECTS = {
    '/blog/ten-minute-food-zepto-cafe-vs-swiggy-bolt-vs-blinkit-bistro/': '/blog/ten-minute-food-zepto-cafe-swiggy-bolt-blinkit-bistro/',
}

def redirects():
    for old, new in REDIRECTS.items():
        target = SITE + new
        page = ('<!DOCTYPE html>\n<html lang="en-IN">\n<head>\n<meta charset="UTF-8">\n<title>Moved | NMX Labs</title>\n'
                f'<meta name="robots" content="noindex, follow">\n<link rel="canonical" href="{target}">\n'
                f'<meta http-equiv="refresh" content="0; url={new}">\n<script>location.replace({json.dumps(new)} + location.search + location.hash);</script>\n'
                '<meta name="viewport" content="width=device-width, initial-scale=1">\n</head>\n<body style="font-family:Inter,system-ui,sans-serif;padding:40px">\n'
                f'<p>This page has moved to <a href="{new}">{target}</a>.</p>\n</body>\n</html>\n')
        wr(old.strip('/') + '/index.html', page)

def page_404():
    tpl = rd('sitemap/index.html') or rd('about/index.html')
    if not tpl: return
    s = re.sub(r'<title>.*?</title>', '<title>Page not found | NMX Labs</title>', tpl, count=1, flags=re.S)
    s = re.sub(r'<meta name="robots" content="[^"]*">', '<meta name="robots" content="noindex, follow">', s, count=1)
    s = re.sub(r'<meta name="description" content="[^"]*">', '<meta name="description" content="That address isn’t on labsnmx.com. Here are the closest pages.">', s, count=1)
    s = re.sub(r'<link rel="canonical" href="[^"]*">\n?', '', s, count=1)
    s = re.sub(r'<script type="application/ld\+json">.*?</script>\n?', '', s, flags=re.S)
    s = re.sub(r'<meta property="og:[^>]*>\n?', '', s)
    main = ('<main class="wrap">\n<header class="page-head page-head--compact">\n  <p class="crumbs"><a href="/">Home</a> / Not found</p>\n  <h1>That page isn’t here</h1>\n'
            '  <p data-nf-line>The address may be mistyped, or the page has moved. The closest matches are below.</p>\n</header>\n'
            '<section class="nf" aria-label="Closest pages"><ul class="post-list bento" data-nf-list></ul>\n'
            '<p class="nf-links"><a class="btn" href="/blog/">Browse the blog</a> <a class="btn btn--ghost" href="/sitemap/">See every page</a> <a class="btn btn--ghost" href="/services/">Services</a></p></section>\n'
            '<script src="/assets/notfound.js" defer></script>\n</main>')
    s = re.sub(r'<main class="wrap">.*?</main>', lambda m: main, s, count=1, flags=re.S)
    s = s.replace(' aria-current="page"', '')
    wr('404.html', s)

# ------------------------------------------------------------------ IndexNow (Bing, Yandex, Seznam, Naver and others)
INDEXNOW_KEY = '95012eba15aad00ed7e1a8c9f2220146'

def indexnow(urls):
    keyfile = f'{INDEXNOW_KEY}.txt'
    if rd(keyfile).strip() != INDEXNOW_KEY: wr(keyfile, INDEXNOW_KEY + '\n')
    urls = sorted({u for u in urls if u.startswith(SITE)})
    if not urls or not os.environ.get('GITHUB_ACTIONS'): return 0
    body = json.dumps({'host': 'labsnmx.com', 'key': INDEXNOW_KEY, 'keyLocation': f'{SITE}/{keyfile}', 'urlList': urls[:500]}).encode('utf-8')
    try:
        req = urllib.request.Request('https://api.indexnow.org/indexnow', data=body, headers={'Content-Type': 'application/json; charset=utf-8'})
        urllib.request.urlopen(req, timeout=20).read()
        return len(urls)
    except Exception as e:
        NOTES.append('IndexNow: ' + str(e)[:100])
        return 0

# ------------------------------------------------------------------ entry points used by build.py
def prepare(published, fetch=True):
    for p in published: p['regions'] = regions_for(p)
    load_popular(published, fetch)
    load_youtube()
