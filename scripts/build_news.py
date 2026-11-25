#!/usr/bin/env python3
"""
NMX Labs v6: the news layer. Called by scripts/build.py on every run (nightly and whenever content changes).

Source (edit this, never the generated parts):  content/news.json
  {"items": [{"date": "2026-11-19", "topic": "Design|AI|Marketing", "tag": "Rebrand", "region": "UK|US|India|Global",
              "title": "...", "summary": "...", "take": "...", "source": "Publisher", "url": "https://...",
              "deep": "/blog/<slug>/ (optional)", "trending": true (optional)}]}

v7, optional:
  - "image": "/assets/home/<file>.webp" (+ "image_alt") on a news item shows a picture at the top of its homepage card.
  - content/home-carousel.json adds graphic slides to the homepage carousel (made with Content Blog Creator.html):
    {"slides": [{"id": "diwali-offer", "image": "/assets/home/diwali-offer.webp", "width": 600, "height": 900,
                 "alt": "...", "kicker": "Offer", "title": "...", "link": "/services/", "position": 2,
                 "size": "tall|wide|xl|", "start": "2026-11-24", "end": "2026-12-31", "active": true}]}
    A slide shows from its start date to its end date (India time), at its position (1 = first card).

Builds:
  - news/index.html     the front page (lead story + bento), "Latest in Design / AI / Marketing" sections, JSON-LD
  - the homepage "The wire" bento carousel (between <!--HOME-NEWS--> markers in index.html)
  - the "Latest in" bar under the menu on blog, news and learn pages (between <!--WIRE-BAR--> markers)
  - news/latest.json    the same headlines as JSON, for anything else that wants them
A "deep" link to one of our posts only appears once that post is published, so scheduled posts never leak.
"""
import datetime as dt, html, json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = 'https://labsnmx.com'
MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
TOPICS = [('Design', 'Latest in design', 'Rebrands, identities and the craft, from London to Mumbai.'),
          ('AI', 'Latest in AI', 'The AI design and creative tools that changed this month, and what they’re actually good for.'),
          ('Marketing', 'Latest in marketing', 'Advertising, search and platform changes, with what to do about each.')]
# blog category -> ticker topic
CAT_TOPIC = {'branding': 'Design', 'design-news': 'Design', 'global': 'Marketing', 'ai-design': 'AI', 'adobe': 'AI',
             'meta-ads': 'Marketing', 'brand-stories': 'Marketing', 'growth': 'Marketing'}
TONE = {'Design': 'y', 'AI': 'p', 'Marketing': 'o'}
WRITTEN = []

def esc(s): return html.escape(str(s), quote=True)
def rd(p): return open(os.path.join(ROOT, p), encoding='utf-8').read()
def wr(p, s):
    full = os.path.join(ROOT, p); os.makedirs(os.path.dirname(full), exist_ok=True)
    old = open(full, encoding='utf-8').read() if os.path.exists(full) else None
    if old != s: open(full, 'w', encoding='utf-8').write(s); WRITTEN.append(p)
def short(d): return f'{int(d[8:10])} {MONTHS[int(d[5:7]) - 1][:3]}'
def human(d): return f'{int(d[8:10])} {MONTHS[int(d[5:7]) - 1]} {d[:4]}'
def label(x): return x.get('date_label') or human(x['date'])
def between(s, start, end, inner):
    if start not in s: return s
    if end not in s: return s.replace(start, start + inner + end, 1)
    a = s.index(start) + len(start); b = s.index(end, a)
    return s[:a] + inner + s[b:]

def load(today, live_slugs):
    p = os.path.join(ROOT, 'content', 'news.json')
    if not os.path.exists(p): return []
    items = [x for x in json.load(open(p, encoding='utf-8')).get('items', []) if x.get('date', '9999') <= today and x.get('title')]
    for x in items:
        x.setdefault('id', re.sub(r'[^a-z0-9]+', '-', x['title'].lower()).strip('-')[:60])
        if x.get('topic') not in TONE: x['topic'] = 'Marketing'
        m = re.match(r'^/blog/([a-z0-9-]+)/$', x.get('deep') or '')
        if m and m.group(1) not in live_slugs: x['deep'] = ''          # don't link a post that isn't live yet
    items.sort(key=lambda x: x['date'], reverse=True)
    return items

# ------------------------------------------------------------------ the "Latest in" bar
def bar_html(items, posts):
    """CSS-only tabs (radio inputs), so it works without JavaScript and costs nothing to load."""
    def post_item(p): return {'href': f'/blog/{p["slug"]}/', 'k': p['category_label'], 't': p['title'], 'd': p['date'], 'own': True}
    def news_item(x): return {'href': f'/news/#{x["id"]}', 'k': x.get('region') if x.get('region') not in (None, 'Global') else x['topic'], 't': x['title'], 'd': x['date'], 'own': False}
    trending = [news_item(x) for x in items if x.get('trending')][:4] + [post_item(p) for p in posts[:4]]
    trending.sort(key=lambda r: r['d'], reverse=True)
    tabs = [('trending', 'Trending', trending[:8]), ('news', 'News', [news_item(x) for x in items[:8]])]
    for topic, _, _ in TOPICS:
        rows = [news_item(x) for x in items if x['topic'] == topic][:5] + [post_item(p) for p in posts if CAT_TOPIC.get(p['category']) == topic][:4]
        rows.sort(key=lambda r: r['d'], reverse=True)
        tabs.append((topic.lower(), topic, rows[:8]))
    def lis(rows, dup):
        t = ' tabindex="-1"' if dup else ''
        return ''.join(f'<li><a href="{esc(r["href"])}"{t}><b>{esc(r["k"])}</b>{esc(r["t"])}<time datetime="{r["d"]}">{short(r["d"])}</time></a></li>' for r in rows)
    inputs = ''.join(f'<input type="radio" name="wireTab" id="wt-{k}" class="wire-r"{" checked" if i == 0 else ""}>' for i, (k, _, _) in enumerate(tabs))
    labels = ''.join(f'<label for="wt-{k}">{esc(n)}</label>' for k, n, _ in tabs)
    panels = ''.join(f'<div class="wire-p wire-p--{k}"><div class="wire-track" style="--n:{max(len(r), 1)}"><ul>{lis(r, False)}</ul><ul aria-hidden="true">{lis(r, True)}</ul></div></div>' for k, _, r in tabs)
    return (f'<div class="wire-bar" role="region" aria-label="Latest headlines"><div class="wire-in">{inputs}'
            f'<span class="wire-live" aria-hidden="true"><i></i>Latest in</span><div class="wire-tabs">{labels}</div>'
            f'<div class="wire-panels">{panels}</div><a class="wire-all" href="/news/">All news</a></div></div>')

def add_bar(s, bar, rel):
    """Puts the bar right under the menu of blog, news and learn pages (not posts' AMP copies, not tools)."""
    rel = rel.replace('\\', '/')
    if not re.match(r'^(blog|news|learn)(/|$)', rel) or '/amp' in rel: return s
    if '<!--WIRE-BAR-->' in s: return between(s, '<!--WIRE-BAR-->', '<!--/WIRE-BAR-->', bar)
    m = re.search(r'<div class="mobile-menu" id="mobileMenu">.*?</div>\n?', s, re.S)
    if not m: return s
    return s[:m.end()] + '<!--WIRE-BAR-->' + bar + '<!--/WIRE-BAR-->\n' + s[m.end():]

# ------------------------------------------------------------------ homepage: "The wire" bento carousel
def load_slides(today):
    """v7: graphic slides for the homepage carousel (content/home-carousel.json), live between their start and end dates."""
    p = os.path.join(ROOT, 'content', 'home-carousel.json')
    if not os.path.exists(p): return []
    try: slides = json.load(open(p, encoding='utf-8')).get('slides', [])
    except Exception as e: print('home-carousel.json not read: ' + str(e)); return []
    ok = []
    for x in slides:
        if not x.get('image') or x.get('active') is False: continue
        if x.get('start') and x['start'] > today: continue
        if x.get('end') and x['end'] < today: continue
        ok.append(x)
    return sorted(ok, key=lambda x: int(x.get('position') or 99))

def slide_html(x):
    size = x.get('size') if x.get('size') in ('tall', 'wide', 'xl') else ''
    link = x.get('link') or '/'
    ext = re.match(r'^https?://', link) and not re.match(r'^https?://(www\.)?labsnmx\.com', link)
    cap = ''
    if x.get('title') or x.get('kicker'):
        cap = f'<span class="hn-gcap">{"<b>" + esc(x["kicker"]) + "</b>" if x.get("kicker") else ""}{esc(x.get("title") or "")}</span>'
    return (f'<a class="hn-card hn-card--graphic{" hn-card--" + size if size else ""}" href="{esc(link)}"{" target=\"_blank\" rel=\"noopener\"" if ext else ""}>'
            f'<img src="{esc(x["image"])}" alt="{esc(x.get("alt") or x.get("title") or "")}" width="{int(x.get("width") or 600)}" height="{int(x.get("height") or 430)}" loading="lazy" decoding="async">{cap}</a>')

def home_news_html(items, posts, bar, today=None):
    shapes = ['xl', 'tall', '', '', 'wide', '', '', 'tall', '', 'wide', '', '']
    cards = []
    for i, x in enumerate(items[:12]):
        sh = shapes[i] if i < len(shapes) else ''
        big = sh in ('xl', 'tall', 'wide')
        img = (f'<span class="hn-img"><img src="{esc(x["image"])}" alt="{esc(x.get("image_alt") or "")}" width="640" height="400" loading="lazy" decoding="async"></span>'
               if x.get('image') else '')
        cards.append(
            f'<a class="hn-card hn-card--{TONE[x["topic"]]}{" hn-card--" + sh if sh else ""}{" hn-card--pic" if img else ""}" href="/news/#{esc(x["id"])}">{img}'
            f'<span class="hn-meta"><b>{esc(x["topic"])}</b>{esc(x.get("region") or "")} · <time datetime="{x["date"]}">{short(x["date"])}</time></span>'
            f'<span class="hn-title">{esc(x["title"])}</span>'
            + (f'<span class="hn-sum">{esc(x["summary"])}</span>' if sh == 'xl' else '')
            + (f'<span class="hn-take"><em>NMX take</em>{esc(x["take"])}</span>' if big else '')
            + f'<span class="hn-src">via {esc(x["source"])}{(" · Image: " + esc(x["image_credit"])) if x.get("image") and x.get("image_credit") else ""}</span></a>')
    for x in load_slides(today or (items[0]['date'] if items else '9999-12-31')):    # v7: graphic slides at their positions
        cards.insert(max(0, min(len(cards), int(x.get('position') or 99) - 1)), slide_html(x))
    upd = human(items[0]['date']) if items else ''
    return (f'\n<section class="hn" id="latest" aria-labelledby="hn-h">\n  <div class="hn-in">\n'
            f'    <div class="hn-top"><div><p class="hn-kick"><i aria-hidden="true"></i>The wire · updated {upd}</p>'
            f'<h2 id="hn-h">Latest in design, AI and marketing</h2>'
            f'<p class="hn-sub">The stories worth your coffee break, each with a short, opinionated take from the studio. From London, New York, Gurugram and everywhere a logo just changed.</p></div>'
            f'<div class="hn-acts"><a class="hn-all" href="/news/">All news</a><div class="hn-arrows"><button type="button" class="hn-arrow" data-hn="-1" aria-label="Scroll back">&#8249;</button><button type="button" class="hn-arrow" data-hn="1" aria-label="Scroll forward">&#8250;</button></div></div></div>\n'
            f'    {bar}\n'
            f'    <div class="hn-track" id="hnTrack" tabindex="0" aria-label="Latest stories, scroll sideways">{"".join(cards)}</div>\n'
            f'  </div>\n</section>\n')

# ------------------------------------------------------------------ the news page
def item_card(x, with_id=True, lead=False):
    links = [f'<a href="{esc(x["url"])}" target="_blank" rel="noopener">Source: {esc(x["source"])}</a>']
    if x.get('deep'): links.append(f'<a href="{esc(x["deep"])}">Our deep dive</a>')
    idattr = ' id="' + esc(x['id']) + '"' if with_id else ''
    return (f'<article class="nw-item nw-item--{TONE[x["topic"]]}{" nw-item--lead" if lead else ""}"{idattr}>'
            f'<p class="nw-meta"><span class="nw-tag">{esc(x["topic"])}</span><span>{esc(x.get("tag") or "")}{" · " + esc(x["region"]) if x.get("region") else ""}</span><time datetime="{x["date"]}">{esc(label(x))}</time></p>'
            f'<h3>{esc(x["title"])}</h3><p>{esc(x["summary"])}</p>'
            f'<p class="nw-take"><strong>NMX take:</strong> {esc(x["take"])}</p>'
            f'<p class="nw-links">{" · ".join(links)}</p></article>')

def news_page(items, posts):
    s = rd('news/index.html')
    if '<!--NEWS-FRONT-->' not in s:
        s = re.sub(r'<section class="news-curated".*?</section>', '<!--NEWS-FRONT--><!--/NEWS-FRONT-->', s, count=1, flags=re.S)
        s = s.replace('<link rel="stylesheet" href="/assets/site.css">', '<link rel="stylesheet" href="/assets/site.css">\n<link rel="stylesheet" href="/assets/news.css">', 1)
    if not items: return s
    lead, side = items[0], items[1:5]
    by = {t: [x for x in items if x['topic'] == t] for t, _, _ in TOPICS}
    blog_by = {t: [p for p in posts if CAT_TOPIC.get(p['category']) == t][:3] for t, _, _ in TOPICS}
    secs = []
    for t, title, line in TOPICS:
        rel = ''.join(f'<li><a href="/blog/{p["slug"]}/"><span>{esc(p["category_label"])}</span>{esc(p["title"])}</a></li>' for p in blog_by[t])
        secs.append(f'<section class="nw-sec" id="{t.lower()}" aria-labelledby="h-{t.lower()}"><div class="nw-sec-head"><h2 id="h-{t.lower()}">{title}</h2><p>{line}</p></div>'
                    f'<div class="nw-grid">{"".join(item_card(x) for x in by[t])}</div>'
                    + (f'<aside class="nw-blog"><h3>From our blog</h3><ul>{rel}</ul></aside>' if rel else '') + '</section>')
    jump = ''.join(f'<a href="#{t.lower()}">{title}</a>' for t, title, _ in TOPICS)
    front = (f'\n<p class="nw-updated">Updated {human(items[0]["date"])} · {len(items)} stories · new articles on the blog 3–4 times a week</p>\n'
             f'<nav class="nw-jump" aria-label="News sections">{jump}<a href="#wireH">Live wire</a></nav>\n'
             f'<section class="nw-front" aria-label="Top stories">{item_card(lead, False, True)}<div class="nw-side">'
             + ''.join(f'<a class="nw-mini nw-item--{TONE[x["topic"]]}" href="#{esc(x["id"])}"><span class="nw-tag">{esc(x["topic"])}</span><b>{esc(x["title"])}</b><time datetime="{x["date"]}">{esc(label(x))}</time></a>' for x in side)
             + '</div></section>\n' + '\n'.join(secs) + '\n')
    s = between(s, '<!--NEWS-FRONT-->', '<!--/NEWS-FRONT-->', front)
    s = re.sub(r'<h1>News feed</h1>', '<h1>News</h1>', s)
    s = re.sub(r'(<header class="page-head">\s*<p class="crumbs">.*?</p>\s*<h1>News</h1>\s*<p>).*?(</p>)',
               lambda m: m.group(1) + 'Design, AI and marketing news from around the world, picked by the studio and explained in two minutes, with an honest take on what it means for your brand. Every story links to its original source. Below it, a live wire of headlines refreshes itself through the day.' + m.group(2), s, count=1, flags=re.S)
    ld = {'@context': 'https://schema.org', '@type': 'CollectionPage', 'name': 'News | NMX Labs', 'url': f'{SITE}/news/',
          'dateModified': items[0]['date'], 'description': 'Design, AI and marketing news, curated and explained by NMX Labs.',
          'mainEntity': {'@type': 'ItemList', 'itemListElement': [
              {'@type': 'ListItem', 'position': i + 1, 'url': f'{SITE}/news/#{x["id"]}', 'name': x['title']} for i, x in enumerate(items[:20])]}}
    block = '<script type="application/ld+json" id="news-ld">\n' + json.dumps(ld, ensure_ascii=False, indent=1) + '\n</script>'
    if 'id="news-ld"' in s: s = re.sub(r'<script type="application/ld\+json" id="news-ld">.*?</script>', lambda m: block, s, count=1, flags=re.S)
    else: s = s.replace('</head>', block + '\n</head>', 1)
    return s

def latest_json(items, posts):
    return json.dumps({'updated': items[0]['date'] if items else '', 'news': [{k: x.get(k, '') for k in ('id', 'date', 'topic', 'region', 'title', 'summary', 'take', 'source', 'url')} | {'link': f'{SITE}/news/#{x["id"]}'} for x in items[:30]],
                       'posts': [{'title': p['title'], 'url': f'{SITE}/blog/{p["slug"]}/', 'date': p['date'], 'category': p['category_label']} for p in posts[:12]]},
                      ensure_ascii=False, indent=1) + '\n'

def build(today, posts):
    """Returns (items, bar_html, home_news_html). Writes news/index.html and news/latest.json."""
    items = load(today, {p['slug'] for p in posts})
    bar = bar_html(items, posts) if items else ''
    if os.path.exists(os.path.join(ROOT, 'news', 'index.html')): wr('news/index.html', news_page(items, posts))
    wr('news/latest.json', latest_json(items, posts))
    return items, bar, home_news_html(items, posts, bar, today) if items else ''
