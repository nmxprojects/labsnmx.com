#!/usr/bin/env python3
"""
NMX Labs v13, called by scripts/build.py on every run. Everything else in v11 (build_v11.py) still runs as before;
v13 takes over the icons only.

1. Icon files (assets())
   - Writes every icon as SVG (ink and light), the sprite, assets/icons/nxi.css and assets/icons/icons.json from
     scripts/icons_v12.py. Pure Python, so this always works.
   - Writes the PNGs (site: ink and light, emails) whose source changed, if cairosvg and Pillow are installed (the
     workflow installs them). Without them the PNGs already in the repository stay as they are.
   - Official logo files you add to assets/icons/brand/ (see icons_v12.brand_files) are picked up here: engage.js is told
     which ones exist, the PNGs are made from them, and the pages below use them.

2. Icons on pages (icons(s, rel), from build_footers)
   - The footer "Get in touch" column, the homepage socials and Instagram button, the blog's social card and the contact
     page get one icon per link, in the v13 style (no tile).
   - Icons that v11, v12 or v13 already put on a page are replaced by the current version, so changing a glyph in
     icons_v12.py (or adding a logo file) reaches every page on the next run. v11 skipped links that had an icon.
   - The older line icons (theme switch, Listen, Summarise, audio player, rails, search) become flat glyphs.
   - /assets/icons.css?v=13 is linked on every page that has an icon.
   Safe to run on any page, any number of times.
"""
import json, os, re

import icons_v12 as IC
try:
    import icons_v11 as IC11
except Exception:
    IC11 = None

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WRITTEN, NOTES = [], []
CSS_LINK = '<link rel="stylesheet" href="/assets/icons.css?v=14">'
_BRANDS = None


def rd(p):
    f = os.path.join(ROOT, p)
    return open(f, encoding='utf-8').read() if os.path.exists(f) else ''


def wr(p, s):
    full = os.path.join(ROOT, p)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    old = open(full, encoding='utf-8').read() if os.path.exists(full) else None
    if old != s:
        open(full, 'w', encoding='utf-8').write(s); WRITTEN.append(p)


def brands():
    global _BRANDS
    if _BRANDS is None: _BRANDS = IC.brand_files(ROOT)
    return _BRANDS


# ------------------------------------------------------------------ 1. icon files
BRAND_JS = re.compile(r'var LOGO_FILES = \{[^\n]*?\};')


def assets():
    b = brands()
    for rel, s in IC.text_files(ROOT): wr(rel, s)
    js = rd('assets/engage.js')
    if js and BRAND_JS.search(js):
        wr('assets/engage.js', BRAND_JS.sub(lambda m: 'var LOGO_FILES = ' + json.dumps(b, sort_keys=True) + ';', js, count=1))
    elif js:
        NOTES.append('assets/engage.js has no "var LOGO_FILES = {...};" line, so the share and follow icons there use the generic symbols')
    written, note = IC.render_pngs(ROOT)
    WRITTEN.extend(written)
    if note: NOTES.append(note)
    pngs = [w for w in written if w.endswith('.png')]
    if pngs: NOTES.append('%d PNG icons updated' % len(pngs))
    if b: NOTES.append('official logo files in use: ' + ', '.join(f'{k} ({v})' for k, v in sorted(b.items())))


# ------------------------------------------------------------------ 2. icons on pages
def icon_for(href):
    """The network (or action) a link goes to, or ''."""
    h = href.lower()
    if h.startswith('mailto:'): return 'email'
    if h.startswith('tel:'): return 'phone'
    if 'wa.me/' in h and 'text=' in h: return 'calendar'          # "Book a 1:1 session" opens WhatsApp with a message
    if 'wa.me/' in h or 'whatsapp' in h: return 'whatsapp'
    if 'instagram.com' in h: return 'instagram'
    if 'linkedin.com' in h: return 'linkedin'
    if 'pinterest.' in h: return 'pinterest'
    if 'youtube.com' in h or 'youtu.be' in h: return 'youtube'
    if 'threads.net' in h or 'threads.com' in h: return 'threads'
    if 't.me/' in h: return 'telegram'
    if 'facebook.com' in h or 'fb.com/' in h: return 'facebook'
    if 'twitter.com' in h: return 'twitter'
    if 'x.com/' in h: return 'x'
    if 'google.com/maps' in h or 'maps.app.goo.gl' in h or 'goo.gl/maps' in h: return 'location'
    if 'g.page/' in h or 'business.google.' in h or 'search.google.com/local' in h: return 'google'
    if h.endswith('feed.xml'): return 'rss'
    return ''


# an icon this build (v11, v12 or v13) put at the start of a link or heading
OURS = (r'(?:<svg\b[^>]*\bclass="[^"]*\bnx-i\b[^"]*"[^>]*>.*?</svg>'
        r'|<span\b[^>]*\bclass="[^"]*\bnx-logo\b[^"]*"[^>]*></span>'
        r'|<img\b[^>]*\bclass="[^"]*\bnx-logo-img\b[^"]*"[^>]*>)')
LEAD = re.compile(r'\s*' + OURS, re.S)
A_RE = re.compile(r'(<a\b[^>]*\bhref="([^"]*)"[^>]*>)(.*?)(</a>)', re.S)


def iconise_links(block):
    def one(m):
        open_, href, inner, close = m.groups()
        net = icon_for(href)
        if not net: return m.group(0)
        lead = LEAD.match(inner) or re.match(r'\s*<svg\b.*?</svg>', inner, re.S)   # ours, or an older plain icon
        rest = inner[lead.end():] if lead else inner
        return open_ + IC.icon(net, brands()) + rest.lstrip() + close
    return A_RE.sub(one, block)


CONTACT_H = {'WhatsApp': 'whatsapp', 'Email': 'email', 'Phone': 'phone', 'Instagram': 'instagram', 'LinkedIn': 'linkedin',
             'Pinterest': 'pinterest', 'YouTube': 'youtube', 'Facebook': 'facebook', 'X': 'x', 'Twitter': 'twitter', 'Threads': 'threads',
             'Telegram': 'telegram', 'Google': 'google', 'Studio': 'location'}
CONTACT_NAMES = '|'.join(CONTACT_H)
SOCIAL_CARD = re.compile(r'(<div class="social-head"><strong>)((?:\s*' + OURS + r')?)\s*'
                         r'(Instagram|LinkedIn|Pinterest|YouTube|WhatsApp|Facebook|X|Twitter|Threads)(</strong>)', re.S)

# the site's older line icons -> flat glyphs (same table as v11, plus the Content Blog Creator's own)
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
    '<path d="M12 5v14M5 12h14"/>': 'plus',
    '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>': 'pencil',
    '<path d="M4 5h13v14H6a2 2 0 0 1-2-2z"/><path d="M17 9h3v8a2 2 0 0 1-2 2"/><path d="M8 9h5M8 13h5M8 16h3"/>': 'newspaper',
    '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10 9.5v5l4.5-2.5z"/>': 'video',
    '<rect x="3" y="6" width="7" height="12" rx="2"/><rect x="12" y="6" width="9" height="5" rx="2"/><rect x="12" y="13" width="9" height="5" rx="2"/>': 'layout',
    '<path d="M4 6a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/>': 'folder',
    '<path d="M12 19V5M6 11l6-6 6 6"/>': 'arrowUp',
    '<path d="M12 5v14M6 13l6 6 6-6"/>': 'arrowDown',
    '<path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/>': 'trash',
    '<path d="M6 9l6 6 6-6"/>': 'chevDown',
}
V11 = {v: k for k, v in IC11.GLYPHS.items()} if IC11 else {}     # a v11 glyph -> its name
SVG_RE = re.compile(r'<svg([^>]*)>(.*?)</svg>', re.S)
DATA_I = re.compile(r'\sdata-i="([A-Za-z]+)"')


def refresh_svgs(s):
    """Every 24 x 24 icon this site's builds know (older line icon, v11 glyph or v12 glyph) -> the current v13 glyph."""
    def one(m):
        attrs, inner = m.groups()
        if 'viewBox="0 0 24 24"' not in attrs: return m.group(0)
        d = DATA_I.search(attrs)
        name = d.group(1) if d and d.group(1) in IC.GLYPHS else (SWAP.get(inner) or V11.get(inner))
        if not name or name not in IC.GLYPHS: return m.group(0)
        if not re.search(r'class="[^"]*\bnx-(?:i|f)\b', attrs):
            if 'class="' in attrs: attrs = re.sub(r'class="([^"]*)"', lambda c: 'class="' + c.group(1) + ' nx-f"', attrs, count=1)
            else: attrs = ' class="nx-f"' + attrs
        if d: attrs = DATA_I.sub(' data-i="' + name + '"', attrs, count=1)
        else: attrs += ' data-i="' + name + '"'
        return '<svg' + attrs + '>' + IC.GLYPHS[name] + '</svg>'
    return SVG_RE.sub(one, s)


def link_css(t):
    has_icon = re.search(r'class="[^"]*\bnx-(?:i|f|logo|logo-img)\b', t) is not None
    if '/assets/icons.css' in t:
        return re.sub(r'<link rel="stylesheet" href="/assets/icons\.css(?:\?v=\d+)?">', CSS_LINK, t)
    if has_icon and '</head>' in t:
        return t.replace('</head>', CSS_LINK + '\n</head>', 1)
    return t


def icons(s, rel=''):
    rel = rel.replace('\\', '/')
    if '/amp' in '/' + rel: return s
    b = brands()
    t = re.sub(r'(<h4>Get in touch</h4>\s*<ul\b[^>]*>)(.*?)(</ul>)', lambda m: m.group(1) + iconise_links(m.group(2)) + m.group(3), s, flags=re.S)
    t = re.sub(r'(<div class="mobile-menu-social">)(.*?)(</div>)', lambda m: m.group(1) + iconise_links(m.group(2)) + m.group(3), t, flags=re.S)
    t = re.sub(r'<a\b[^>]*data-pixel-source="hero"[^>]*>.*?</a>', lambda m: iconise_links(m.group(0)), t, flags=re.S)
    t = SOCIAL_CARD.sub(lambda m: m.group(1) + IC.icon(m.group(3).lower() if m.group(3) != 'X' else 'x', b) + m.group(3) + m.group(4), t)
    if rel.startswith('contact'):
        t = re.sub(r'<h2 class="nx-h"><span class="nx-ti">.*?</span>\s*(' + CONTACT_NAMES + r')</h2>|<h2>(' + CONTACT_NAMES + r')</h2>',
                   lambda m: '<h2 class="nx-h"><span class="nx-ti">' + IC.icon(CONTACT_H[m.group(1) or m.group(2)], b) + '</span>' +
                             (m.group(1) or m.group(2)) + '</h2>', t, flags=re.S)
    t = refresh_svgs(t)
    return link_css(t)
