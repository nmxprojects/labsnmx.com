#!/usr/bin/env python3
"""
NMX Labs v11, called by scripts/build.py on every run (nightly, and whenever content changes).

1. New posts are announced and listed as the latest, whatever their date
   - Every published post gets "live_at" in content/posts.json: the moment this build first saw it live (UTC).
     A back-dated post, a post uploaded after 9 PM, or one that lands a day after its date still gets a fresh live_at.
   - Posts with the same date are listed newest-uploaded first (blog, home page, "Latest in" bar, feed, news/latest.json).
   - blog/posts.json carries live_at and notify, and also lists back-dated posts that went live in the last 3 days, so
     the Apps Script backend (Code-Blog.gs v11) emails and notifies them.
   - The new slugs go to the GitHub Actions output "new_posts", so the workflow can ping the backend straight away.
   - First run (migration): posts already on the site get live_at = their date at 09:00 India time, so nothing old is
     re-announced.
   - "notify": false on a post in content/posts.json (Content Blog Creator: untick "Email and notify subscribers")
     keeps it out of the emails and notifications. It is still published and listed as usual.

2. Search Console clean-up
   - Links to /clients (no slash) in AMP copies and scheduled posts now point at /clients/ (no redirect for Google).
   - Category pages with fewer than MIN_CATEGORY_POSTS posts are "noindex, follow" and left out of the sitemaps; they
     switch back to "index" by themselves once they have enough posts. The HTML sitemap /sitemap/ is "noindex, follow"
     (people and crawlers can still follow every link on it; it just isn't offered as a search result).

3. Flat icons (scripts/icons_v11.py) in the footer "Get in touch" column (v11.1: an icon-only row whose names show on
   hover or keyboard focus; official brand marks from assets/icons/brands/ when you add them), the homepage socials, the contact page and
   the blog's Instagram card, with /assets/icons.css. Safe to run on any page, any number of times.
"""
import datetime as dt, json, os, re

import icons_v11 as IC

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = 'https://labsnmx.com'
IST = dt.timezone(dt.timedelta(hours=5, minutes=30))
MIN_CATEGORY_POSTS = 3
FRESH_DAYS = 3           # back-dated posts that went live this recently are added to blog/posts.json
WRITTEN, NOTES = [], []


def rd(p):
    f = os.path.join(ROOT, p)
    return open(f, encoding='utf-8').read() if os.path.exists(f) else ''


def wr(p, s):
    full = os.path.join(ROOT, p)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    old = open(full, encoding='utf-8').read() if os.path.exists(full) else None
    if old != s:
        open(full, 'w', encoding='utf-8').write(s); WRITTEN.append(p)


def now_utc():
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).strftime('%Y-%m-%dT%H:%M:%SZ')


def at_nine_ist(date):
    x = dt.datetime.fromisoformat(date + 'T09:00:00').replace(tzinfo=IST).astimezone(dt.timezone.utc)
    return x.strftime('%Y-%m-%dT%H:%M:%SZ')


# ------------------------------------------------------------------ 1. live_at
def stamp_live(posts, published, manifest, today):
    """Gives every live post a live_at. Returns the slugs that went live for the first time in this run."""
    old = {}
    try: old = {p['slug']: p for p in json.load(open(os.path.join(ROOT, 'blog', 'posts.json'), encoding='utf-8')).get('posts', [])}
    except Exception: pass
    migrating = not any(p.get('live_at') for p in posts)
    yday = (dt.date.fromisoformat(today) - dt.timedelta(days=1)).isoformat()
    live = {p['slug'] for p in published}
    new, changed = [], False
    for p in posts:
        if p['slug'] not in live or p.get('live_at'): continue
        if migrating and (p['slug'] in old or p['date'] < yday):
            p['live_at'] = at_nine_ist(p['date'])                       # already on the site before v11
        else:
            p['live_at'] = now_utc(); new.append(p['slug'])
        changed = True
    if changed:
        json.dump(posts, open(manifest, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        WRITTEN.append('content/posts.json')
    out = os.environ.get('GITHUB_OUTPUT')
    if out:
        with open(out, 'a', encoding='utf-8') as f: f.write('new_posts=' + ','.join(new) + '\n')
    if new: NOTES.append('went live in this run (subscribers get the email and notification): ' + ', '.join(new))
    return new


def sort_published(published, order):
    """Newest date first; on the same date, the one that went live last comes first."""
    published.sort(key=lambda p: order[p['slug']])
    published.sort(key=lambda p: p.get('live_at') or '', reverse=True)
    published.sort(key=lambda p: p['date'], reverse=True)


def public_extra(p):
    """Extra fields for a post in blog/posts.json."""
    e = {'live_at': p.get('live_at') or at_nine_ist(p['date'])}
    if p.get('notify') is False: e['notify'] = False
    return e


def recent_backdated(published, shown):
    """Posts beyond the first 40 that went live in the last FRESH_DAYS days (back-dated uploads)."""
    cut = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=FRESH_DAYS)).strftime('%Y-%m-%dT%H:%M:%SZ')
    return [p for p in published if p['slug'] not in shown and (p.get('live_at') or '') >= cut]


# ------------------------------------------------------------------ 2. Search Console clean-up
def fix_hidden_links(fix_links):
    """Runs the site's link fixer on AMP copies and scheduled posts too (build_footers skips them)."""
    n = 0
    for base in ('blog', '_scheduled'):
        for dirpath, _, files in os.walk(os.path.join(ROOT, base)):
            rel = os.path.relpath(dirpath, ROOT).replace('\\', '/')
            if base == 'blog' and not rel.endswith('/amp'): continue
            for f in files:
                if not f.endswith('.html'): continue
                p = rel + '/' + f
                s = rd(p); t = fix_links(s)
                if t != s: wr(p, t); n += 1
    if n: NOTES.append(f'/clients links fixed in {n} AMP or scheduled pages')


def set_robots(p, index):
    s = rd(p)
    if not s: return
    want = '<meta name="robots" content="index, follow, max-image-preview:large">' if index else '<meta name="robots" content="noindex, follow">'
    t = re.sub(r'<meta name="robots" content="[^"]*">', want, s, count=1)
    if t == s and 'name="robots"' not in s: t = s.replace('</head>', want + '\n</head>', 1)
    if t != s: wr(p, t)


def thin_pages(published, categories):
    counts = {}
    for p in published: counts[p['category']] = counts.get(p['category'], 0) + 1
    hidden = []
    for c in categories:
        path = f'blog/category/{c}/index.html'
        if not os.path.exists(os.path.join(ROOT, path)): continue
        ok = counts.get(c, 0) >= MIN_CATEGORY_POSTS
        set_robots(path, ok)
        if not ok: hidden.append(f'{c} ({counts.get(c, 0)})')
    set_robots('sitemap/index.html', False)
    if hidden: NOTES.append('category pages kept out of Google until they have %d posts: %s' % (MIN_CATEGORY_POSTS, ', '.join(hidden)))


# ------------------------------------------------------------------ 3. flat icons on pages
def icon_for(href):
    h = href.lower()
    if h.startswith('mailto:'): return 'mail'
    if h.startswith('tel:'): return 'phone'
    if 'wa.me/' in h and 'text=' in h: return 'calendar'          # "Book a 1:1 session" opens WhatsApp with a message
    if 'wa.me/' in h or 'whatsapp' in h: return 'chat'
    if 'instagram.com' in h: return 'camera'
    if 'linkedin.com' in h: return 'briefcase'
    if 'pinterest.' in h: return 'pin'
    if 'youtube.com' in h or 'youtu.be' in h: return 'play'
    if 'threads.net' in h: return 'bubbles'
    if 't.me/' in h: return 'plane'
    if 'facebook.com' in h: return 'people'
    if 'x.com/' in h or 'twitter.com' in h: return 'at'
    if h.endswith('feed.xml'): return 'feed'
    return ''


A_RE = re.compile(r'(<a\b[^>]*\bhref="([^"]*)"[^>]*>)(.*?)(</a>)', re.S)
LEAD_RE = re.compile(r'\s*(<svg\b.*?</svg>|<span class="nx-i nx-bm"[^>]*></span>)', re.S)


def iconise_links(block, labels=False):
    """Puts the flat icon at the start of each contact/social link (replacing any older icon). With labels=True the
    text becomes a label that only shows on hover or keyboard focus (screen readers still read it)."""
    def one(m):
        open_, href, inner, close = m.groups()
        name = icon_for(href)
        if not name: return m.group(0)
        lead = LEAD_RE.match(inner)
        rest = inner[lead.end():] if lead else inner
        if labels:
            txt = rest.strip()
            mm = re.fullmatch(r'<span class="nx-lbl">(.*)</span>', txt, re.S)
            rest = '<span class="nx-lbl">' + (mm.group(1) if mm else txt) + '</span>'
        return open_ + IC.mark(name, ROOT) + rest + close
    return A_RE.sub(one, block)


def iconrow(m):
    """The footer "Get in touch" list as a row of icon buttons."""
    head, attrs, body, end = m.group(1), m.group(2), m.group(3), m.group(4)
    if 'nx-iconrow' not in attrs:
        attrs = re.sub(r'class="([^"]*)"', lambda c: 'class="' + c.group(1) + ' nx-iconrow"', attrs) if 'class="' in attrs else attrs + ' class="nx-iconrow"'
    return head + attrs + '>' + iconise_links(body, True) + end


def sync_brands():
    """Tells assets/engage.js and the dashboard which official brand files exist (one generated line in each)."""
    line = '  var BRANDS = ' + json.dumps(IC.brands(ROOT)) + ';   // v11.1: set by scripts/build_v11.py from assets/icons/brands/'
    for p in ('assets/engage.js', 'dashboard/dashboard.js'):
        s = rd(p)
        if not s: continue
        t = re.sub(r'^  var BRANDS = .*$', lambda m: line, s, count=1, flags=re.M)
        if t != s: wr(p, t)
    if IC.brands(ROOT): NOTES.append('official brand marks in use: ' + ', '.join(IC.brands(ROOT)))


CONTACT_H = {'WhatsApp': 'chat', 'Email': 'mail', 'Phone': 'phone', 'Instagram': 'camera', 'LinkedIn': 'briefcase',
             'Pinterest': 'pin', 'YouTube': 'play', 'Studio': 'location'}


# the site's older line icons (reading tools, audio player, theme switch, rails, search) -> the flat set
SWAP = {
    '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"/>': 'sun',
    '<path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z"/>': 'moon',
    '<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="14" width="4" height="7" rx="1.5"/><rect x="17" y="14" width="4" height="7" rx="1.5"/>': 'headphones',
    '<path d="M8 5v14M16 5v14"/>': 'pause',
    '<path d="M7 4.5v15l12-7.5z"/>': 'playSm',
    '<path d="M6 6l12 12M18 6L6 18"/>': 'close',
    '<path d="M5 6h14M5 12h14M5 18h9"/>': 'list',
    '<path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z"/><path d="M18.5 15.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>': 'sparkle',
    '<path d="M15 5l-7 7 7 7"/>': 'chevL',
    '<path d="M9 5l7 7-7 7"/>': 'chevR',
    '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>': 'search',
}
SVG_RE = re.compile(r'<svg([^>]*)>(.*?)</svg>', re.S)


def swap_icons(s):
    def one(m):
        attrs, inner = m.groups()
        name = SWAP.get(inner)
        if not name or 'viewBox="0 0 24 24"' not in attrs: return m.group(0)
        if 'class="' in attrs: attrs = re.sub(r'class="([^"]*)"', lambda c: 'class="' + c.group(1) + ' nx-f"', attrs, count=1)
        else: attrs = ' class="nx-f"' + attrs
        return '<svg' + attrs + '>' + IC.GLYPHS[name] + '</svg>'
    return SVG_RE.sub(one, s)


def icons(s, rel=''):
    rel = rel.replace('\\', '/')
    if '/amp' in '/' + rel or rel.startswith(('tools', 'dashboard')): return s
    t = swap_icons(s)
    # footer: "Get in touch" column (one-line markup on most pages, multi-line on the homepage)
    t = re.sub(r'(<h4>Get in touch</h4>\s*<ul)([^>]*)>(.*?)(</ul>)', iconrow, t, flags=re.S)
    # homepage: mobile menu socials and the hero Instagram button
    t = re.sub(r'(<div class="mobile-menu-social">)(.*?)(</div>)', lambda m: m.group(1) + iconise_links(m.group(2)) + m.group(3), t, flags=re.S)
    t = re.sub(r'<a\b[^>]*data-pixel-source="hero"[^>]*>.*?</a>', lambda m: iconise_links(m.group(0)), t, flags=re.S)
    # blog page: Instagram card
    t = re.sub(r'<div class="social-head"><strong>(?:<svg\b.*?</svg>|<span class="nx-i nx-bm"[^>]*></span>)Instagram</strong>', '<div class="social-head"><strong>Instagram</strong>', t, flags=re.S)
    t = t.replace('<div class="social-head"><strong>Instagram</strong>', '<div class="social-head"><strong>' + IC.mark('camera', ROOT) + 'Instagram</strong>')
    # contact page: one icon per channel heading
    if rel.startswith('contact'):
        t = re.sub(r'<h2 class="nx-h"><span class="nx-ti">.*?</span>(\w+)</h2>', lambda m: '<h2>' + m.group(1) + '</h2>', t, flags=re.S)
        t = re.sub(r'<h2>(WhatsApp|Email|Phone|Instagram|LinkedIn|Pinterest|YouTube|Studio)</h2>',
                   lambda m: '<h2 class="nx-h"><span class="nx-ti">' + IC.mark(CONTACT_H[m.group(1)], ROOT) + '</span>' + m.group(1) + '</h2>', t)
    if t != s and '/assets/icons.css' not in t:
        t = t.replace('</head>', '<link rel="stylesheet" href="/assets/icons.css">\n</head>', 1)
    return t
