#!/usr/bin/env python3
"""
NMX Labs v10 build layer, called by scripts/build.py on every run (daily at 00:05 IST and on every upload that changes
content or scripts). If this file is missing or fails, everything else still builds exactly as in v9.

What it does
- Follow links: LinkedIn (https://www.linkedin.com/company/nmxlabs) and Pinterest (https://in.pinterest.com/nmxlabs/)
  next to Instagram in every page's footer, in the home page's footer and mobile menu, and in the "sameAs" list that
  tells Google which profiles belong to NMX Labs.
- Play page: the arcade visuals (assets/play/) above the games. Big screens get the two square images, tablets the 4:5
  and the square, phones the two tall 9:16 versions as swipeable cards. "Game brain" starts the Daily five, "Play,
  create, challenge" opens a random game. The page's sharing image becomes the Game brain square.
- Pinterest on the site, with no API and no key: on GitHub the build reads the profile's public RSS feed
  (pinterest.com/nmxlabs/feed.rss) into content/pinterest.json, then shows the newest pins on the blog page (next to
  Instagram in "Latest from NMX Labs") and on the home page (below the blog section). If the feed can't be read and
  there's no earlier copy, those spots show Pinterest's own profile widget instead, loaded only when scrolled to.
- blog/pinterest.xml: an RSS 2.0 feed made for Pinterest's "Auto-publish" (Settings > Bulk create Pins), with an image
  in <enclosure> and <media:content> for every post, a description with the summary and a few hashtags, and links tagged
  utm_source=pinterest so those visits show as Pinterest on the dashboard. Also two Pins for the Play page.

Run by hand:  python scripts/build.py --fetch      (reads Pinterest's feed too; GitHub does this by itself)
"""
import datetime as dt, html, json, os, re, urllib.request, xml.etree.ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = 'https://labsnmx.com'
LINKEDIN = 'https://www.linkedin.com/company/nmxlabs'
PINTEREST = 'https://in.pinterest.com/nmxlabs/'
PIN_FEEDS = ['https://www.pinterest.com/nmxlabs/feed.rss', 'https://in.pinterest.com/nmxlabs/feed.rss']
PIN_JSON = os.path.join(ROOT, 'content', 'pinterest.json')
WRITTEN, NOTES = [], []
PINS = {'pins': [], 'updated': ''}


def rd(p): return open(os.path.join(ROOT, p), encoding='utf-8').read()
def wr(p, s):
    full = os.path.join(ROOT, p)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    old = open(full, encoding='utf-8').read() if os.path.exists(full) else None
    if old != s:
        open(full, 'w', encoding='utf-8').write(s); WRITTEN.append(p)
def esc(s): return html.escape(str(s or ''), quote=True)
def between(s, start, end, inner):
    a = s.index(start) + len(start); b = s.index(end, a)
    return s[:a] + inner + s[b:]


# ------------------------------------------------------------------ Pinterest: read the public profile feed
def _text(x): return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', x or ''))).strip()

def parse_pins(xml_text):
    """Pins from a Pinterest profile RSS feed: [{title, link, img, date}]. Bigger images than the feed's 236px ones."""
    root = ET.fromstring(xml_text.encode('utf-8') if isinstance(xml_text, str) else xml_text)
    out = []
    for it in root.iter('item'):
        get = lambda tag: (it.findtext(tag) or '').strip()
        desc = get('description')
        m = re.search(r'<img[^>]+src="([^"]+)"', html.unescape(desc)) or re.search(r'src="([^"]+)"', desc)
        if not m: continue
        img = re.sub(r'/(236x|170x|136x136|75x75_RS|60x60)/', '/564x/', m.group(1).replace('http://', 'https://'))
        link = get('link') or get('guid')
        if not link.startswith('http'): link = 'https://www.pinterest.com' + link
        title = _text(get('title')) or _text(desc)[:90] or 'A pin from NMX Labs'
        date = ''
        try: date = dt.datetime.strptime(get('pubDate')[:25].strip(), '%a, %d %b %Y %H:%M:%S').date().isoformat()
        except Exception: pass
        out.append({'title': title[:140], 'link': link, 'img': img, 'date': date})
    return out[:24]

def prepare(fetch=False):
    """Loads content/pinterest.json and, on GitHub (or with --fetch), refreshes it from the profile feed."""
    global PINS
    if os.path.exists(PIN_JSON):
        try: PINS = json.load(open(PIN_JSON, encoding='utf-8'))
        except Exception: PINS = {'pins': [], 'updated': ''}
    if not fetch: return
    for url in PIN_FEEDS:
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (compatible; labsnmx-site-build/10; +https://labsnmx.com/)',
                                                       'Accept': 'application/rss+xml, application/xml;q=0.9, */*;q=0.5'})
            raw = urllib.request.urlopen(req, timeout=20).read().decode('utf-8', 'replace')
            pins = parse_pins(raw)
            PINS = {'_how': 'Written by scripts/build_v10.py from the public Pinterest feed of ' + PINTEREST + '. Edit nothing here; it refreshes daily.',
                    'updated': dt.date.today().isoformat(), 'profile': PINTEREST, 'pins': pins}
            text = json.dumps(PINS, ensure_ascii=False, indent=1) + '\n'
            old = open(PIN_JSON, encoding='utf-8').read() if os.path.exists(PIN_JSON) else ''
            if json.loads(old or '{}').get('pins') != pins: wr('content/pinterest.json', text)
            NOTES.append(f'Pinterest: {len(pins)} pins read from {url}')
            return
        except Exception as e:
            NOTES.append(f'Pinterest feed not read from {url}: {e}')
    NOTES.append('Pinterest: kept the last saved pins' if PINS.get('pins') else 'Pinterest: no pins saved yet, so the site shows Pinterest\'s profile widget')


# ------------------------------------------------------------------ follow links on every page
ICON_LI = ('<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 8h13a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z" fill="none" stroke="currentColor" stroke-width="1.9"/>'
           '<path d="M9 8V6.5A1.5 1.5 0 0 1 10.5 5h3A1.5 1.5 0 0 1 15 6.5V8M3.5 13h17" fill="none" stroke="currentColor" stroke-width="1.9"/></svg>')
ICON_PIN = ('<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.8 3.8h6.4l-1.1 5.3 3.1 3.6H6.8l3.1-3.6z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/>'
            '<path d="M12 12.7v7.8" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>')

def socials(s):
    """Adds LinkedIn and Pinterest wherever a page lists Instagram. Safe to run on any page, any number of times."""
    if 'linkedin.com/company/nmxlabs' in s and 'pinterest.com/nmxlabs' in s: return s
    ig = '<li><a href="https://www.instagram.com/_nmxlabs/" target="_blank" rel="noopener">Instagram</a></li>'
    if ig in s:
        s = s.replace(ig, ig + f'<li><a href="{LINKEDIN}" target="_blank" rel="noopener" title="Follow NMX Labs on LinkedIn">LinkedIn</a></li>'
                              f'<li><a href="{PINTEREST}" target="_blank" rel="noopener" title="Follow NMX Labs on Pinterest">Pinterest</a></li>')
    m = re.search(r'<li><a href="https://www\.instagram\.com/_nmxlabs/" data-pixel-event="instagram" data-pixel-source="footer"[^>]*>.*?</li>', s, re.S)
    if m:
        add = (f'\n            <li><a href="{LINKEDIN}" data-pixel-event="linkedin" data-pixel-source="footer" target="_blank" rel="noopener" title="Follow NMX Labs on LinkedIn">{ICON_LI}LinkedIn</a></li>'
               f'\n            <li><a href="{PINTEREST}" data-pixel-event="pinterest" data-pixel-source="footer" target="_blank" rel="noopener" title="Follow NMX Labs on Pinterest">{ICON_PIN}Pinterest</a></li>')
        s = s[:m.end()] + add + s[m.end():]
    mm = '<a href="https://www.instagram.com/_nmxlabs/" data-pixel-event="instagram" data-pixel-source="mobile_menu" target="_blank" rel="noopener">Instagram</a>'
    if mm in s:
        s = s.replace(mm, mm + f'\n      <a href="{LINKEDIN}" data-pixel-event="linkedin" data-pixel-source="mobile_menu" target="_blank" rel="noopener">LinkedIn</a>'
                               f'\n      <a href="{PINTEREST}" data-pixel-event="pinterest" data-pixel-source="mobile_menu" target="_blank" rel="noopener">Pinterest</a>')
    def same_as(m):
        body = m.group(1)
        if 'instagram.com/_nmxlabs' not in body or 'linkedin.com/company/nmxlabs' in body: return m.group(0)
        ind = re.search(r'\n(\s*)"https://www\.instagram', body)
        sep = (',\n' + ind.group(1)) if ind else ', '
        return '"sameAs": [' + body.rstrip() + sep + f'"{LINKEDIN}"' + sep + f'"{PINTEREST}"' + ('\n' + ind.group(1)[:-2] if ind else '') + ']'
    s = re.sub(r'"sameAs": \[(.*?)\]', same_as, s, flags=re.S)
    return s


# ------------------------------------------------------------------ Play page arcade
GAME_IDS = ['wheel', 'hex', 'brief', 'quiz-youtube', 'quiz-geo', 'quiz-branding', 'quiz-metaads', 'odd', 'memory', 'pattern', 'scramble']
ARCADE_CSS = """<style>
.arcade{margin:28px 0 4px}
.arcade-row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:clamp(12px,2vw,22px);align-items:start}
.arcade-cab{appearance:none;border:0;margin:0;padding:0;width:100%;display:block;position:relative;cursor:pointer;border-radius:26px;overflow:hidden;background:#12082e;color:inherit;
  box-shadow:0 0 0 1px rgba(255,255,255,.06) inset,0 22px 44px -24px var(--glow);transition:transform .28s cubic-bezier(.2,.9,.25,1.12),box-shadow .28s ease}
.arcade-cab--brain{--glow:rgba(118,56,240,.85)}
.arcade-cab--create{--glow:rgba(122,255,24,.6);background:#000}
.arcade-cab img{display:block;width:100%;height:auto;border-radius:0;margin:0}
.arcade-cab::after{content:'';position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity .3s;background:repeating-linear-gradient(0deg,rgba(0,0,0,.12) 0 1px,transparent 1px 3px)}
.arcade-cab:hover{transform:translateY(-4px);box-shadow:0 0 0 1px rgba(255,255,255,.08) inset,0 30px 60px -22px var(--glow)}
.arcade-cab:hover::after{opacity:1}
.arcade-cab:active{transform:scale(.985)}
.arcade-cab:focus-visible{outline:3px solid var(--orange,#ff5a2b);outline-offset:4px}
.arcade-hint{margin:12px 0 0;font-size:13.5px;color:var(--muted)}
@media (max-width:1099px){.arcade-row{grid-template-columns:minmax(0,4fr) minmax(0,5fr)}}
@media (max-width:699px){
  .arcade-row{display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;margin:0 calc(-1 * clamp(20px,5vw,64px));padding:6px clamp(20px,5vw,64px) 18px;scrollbar-width:none}
  .arcade-row::-webkit-scrollbar{display:none}
  .arcade-cab{flex:0 0 min(74vw,330px);scroll-snap-align:center;border-radius:22px}
}
@media (prefers-reduced-motion:reduce){.arcade-cab,.arcade-cab::after{transition:none}.arcade-cab:hover{transform:none}}
</style>"""

def _pic(name, alt, small_ratio_4x5):
    p = f'/assets/play/{name}'
    mid = (f'<source media="(max-width: 1099px)" type="image/webp" srcset="{p}-4x5-640.webp 640w, {p}-4x5-1080.webp 1080w" sizes="44vw" width="1080" height="1350">'
           if small_ratio_4x5 else
           f'<source media="(max-width: 1099px)" type="image/webp" srcset="{p}-1x1-640.webp 640w, {p}-1x1-1080.webp 1080w" sizes="55vw" width="1080" height="1080">')
    return ('<picture>'
            f'<source media="(max-width: 699px)" type="image/webp" srcset="{p}-9x16-540.webp 540w, {p}-9x16-941.webp 941w" sizes="74vw" width="941" height="1672">'
            + mid +
            f'<source type="image/webp" srcset="{p}-1x1-640.webp 640w, {p}-1x1-1080.webp 1080w" sizes="(min-width: 1180px) 540px, 46vw" width="1080" height="1080">'
            f'<img src="{p}-1x1.jpg" width="1080" height="1080" alt="{esc(alt)}" loading="lazy" decoding="async"></picture>')

def arcade_html():
    return ('<section class="arcade" aria-label="Start playing">' + ARCADE_CSS +
            '<div class="arcade-row">'
            '<button type="button" class="arcade-cab arcade-cab--brain" data-game="daily" aria-label="How sharp is your game brain? Play today’s Daily five">'
            + _pic('game-brain', 'How sharp is your game brain? Quick quizzes and games for creative minds: two minutes, multiple games, keep a streak.', True) +
            '</button>'
            '<button type="button" class="arcade-cab arcade-cab--create" data-game="wheel" data-arcade-shuffle aria-label="Play, create, challenge: open a random game">'
            + _pic('play-create', 'Play, create, challenge. Quick quizzes and games for creative minds.', False) +
            '</button></div>'
            '<script>(function(){var b=document.querySelector("[data-arcade-shuffle]");if(!b)return;b.addEventListener("click",function(){'
            'var g=[].slice.call(document.querySelectorAll(".game-card[data-game]")).map(function(x){return x.getAttribute("data-game")});'
            'if(g.length)b.setAttribute("data-game",g[Math.floor(Math.random()*g.length)]);});})();</script>'
            '</section>')

def play_page():
    path = 'play/index.html'
    if not os.path.exists(os.path.join(ROOT, path)): return
    s = rd(path)
    block = '<!--ARCADE-->' + arcade_html() + '<!--/ARCADE-->'
    if '<!--ARCADE-->' in s and '<!--/ARCADE-->' in s:
        s = s[:s.index('<!--ARCADE-->')] + block + s[s.index('<!--/ARCADE-->') + len('<!--/ARCADE-->'):]
    elif '<section class="play-sec"' in s:
        s = s.replace('<section class="play-sec"', block + '\n<section class="play-sec"', 1)
    else:
        NOTES.append('Play page: no place found for the arcade visuals'); return
    img = SITE + '/assets/play/game-brain-1x1.jpg'
    s = re.sub(r'(<meta property="og:image" content=")[^"]*(">)', lambda m: m.group(1) + img + m.group(2), s, count=1)
    s = re.sub(r'(<meta name="twitter:image" content=")[^"]*(">)', lambda m: m.group(1) + img + m.group(2), s, count=1)
    if 'og:image:width' not in s:
        s = s.replace('<meta property="og:image" content="' + img + '">', '<meta property="og:image" content="' + img + '">\n<meta property="og:image:width" content="1080">\n<meta property="og:image:height" content="1080">', 1)
    wr(path, s)


# ------------------------------------------------------------------ Pinterest on the blog page and the home page
WIDGET_T = ('<div class="pin-embed" data-pin-embed><a data-pin-do="embedUser" data-pin-board-width="{w}" data-pin-scale-height="{h}" data-pin-scale-width="{sw}" href="' + PINTEREST + '"></a>'
          '<p class="pin-note">Loading our boards from Pinterest…</p></div>'
          '<script>(function(){var box=document.currentScript.previousElementSibling;if(!box||window.NMX_PIN_LOADER)return;window.NMX_PIN_LOADER=1;'
          'function go(){var s=document.createElement("script");s.async=true;s.src="https://assets.pinterest.com/js/pinit.js";document.body.appendChild(s);'
          'setTimeout(function(){document.querySelectorAll("[data-pin-embed]").forEach(function(b){var n=b.querySelector(".pin-note");if(!n)return;'
          'if(b.querySelector("span[class],iframe"))n.remove();else n.innerHTML="Our boards live on Pinterest. <a href=\\"' + PINTEREST + '\\" target=\\"_blank\\" rel=\\"noopener\\">Open them</a>.";});},8000);}'
          'if(!("IntersectionObserver" in window)){setTimeout(go,3000);return;}var io=new IntersectionObserver(function(e){if(e.some(function(x){return x.isIntersecting})){io.disconnect();go();}},{rootMargin:"300px"});'
          'document.querySelectorAll("[data-pin-embed]").forEach(function(b){io.observe(b);});})();</script>')

def widget(w, h, sw): return WIDGET_T.replace('{w}', str(w)).replace('{h}', str(h)).replace('{sw}', str(sw))

def _pin_items(n, cls):
    return ''.join(f'<li><a href="{esc(p["link"])}" target="_blank" rel="noopener" title="{esc(p["title"])}"><img src="{esc(p["img"])}" alt="{esc(p["title"])}" loading="lazy" decoding="async" referrerpolicy="no-referrer"></a></li>'
                   for p in PINS.get('pins', [])[:n])

BLOG_CSS = ('<style>.social-card--pin .pin-grid{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(3,1fr);gap:6px}'
            '.social-card--pin .pin-grid a{display:block;border-radius:12px;overflow:hidden;aspect-ratio:2/3;background:var(--cream)}'
            '.social-card--pin .pin-grid img{width:100%;height:100%;object-fit:cover;display:block;margin:0;transition:transform .4s var(--ease)}'
            '.social-card--pin .pin-grid a:hover img{transform:scale(1.04)}.pin-note{color:var(--muted);font-size:14px;margin:0}.pin-embed{min-height:120px}</style>')

def blog_card():
    pins = PINS.get('pins') or []
    body = f'<ul class="pin-grid">{_pin_items(6, "")}</ul>' if pins else widget(400, 220, 80)
    return ('<div class="social-card social-card--pin" data-pinterest>' + BLOG_CSS +
            f'<div class="social-head"><strong>Pinterest</strong><a href="{PINTEREST}" target="_blank" rel="noopener">@nmxlabs</a></div>' + body +
            f'<a class="btn btn--ghost" href="{PINTEREST}" target="_blank" rel="noopener" data-nx-followlink="pinterest" data-where="blog_feed">Follow on Pinterest</a></div>')

HOME_CSS = ('<style>.pinx{position:relative;z-index:2;padding:8px 0 24px}.pinx-panel{background:#fff;border:1px solid rgba(17,17,16,.1);border-radius:26px;padding:clamp(22px,4vw,44px)}'
            '.pinx-top{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:16px 40px;margin-bottom:24px}'
            '.pinx-top h2{font-family:var(--font-display);font-size:clamp(36px,5.4vw,68px);line-height:.95;letter-spacing:-.035em}'
            '.pinx-top p{color:var(--muted,#6f6d67);font-size:15px;line-height:1.6;max-width:46ch;margin-top:12px}'
            '.pinx-grid{list-style:none;margin:0;padding:0;columns:5 160px;column-gap:12px}'
            '.pinx-grid li{break-inside:avoid;margin:0 0 12px}.pinx-grid a{display:block;border-radius:16px;overflow:hidden;background:#efe9dd}'
            '.pinx-grid img{display:block;width:100%;height:auto;transition:transform .5s cubic-bezier(.16,1,.3,1)}.pinx-grid a:hover img{transform:scale(1.03)}'
            '.pinx .pin-note{color:#6f6d67;font-size:14px;margin:0}.pinx .pin-embed{min-height:140px}'
            '@media (max-width:640px){.pinx-grid{columns:2;column-gap:10px}.pinx-grid li:nth-child(n+7){display:none}}</style>')

def home_section():
    pins = PINS.get('pins') or []
    body = f'<ul class="pinx-grid">{_pin_items(10, "")}</ul>' if pins else widget(1000, 260, 110)
    return ('<section class="pinx" aria-labelledby="pinxH">' + HOME_CSS + '<div class="pinx-panel"><div class="pinx-top"><div>'
            '<h2 id="pinxH">Pinned at the studio</h2><p>Ideas, references and our own work, saved to our Pinterest boards. Follow along for the visual side of what we write about.</p></div>'
            f'<a class="bh-all" href="{PINTEREST}" target="_blank" rel="noopener" data-pixel-event="pinterest" data-pixel-source="home_pins">Follow on Pinterest</a></div>'
            + body + '</div></section>')

def pinterest_on_site():
    p = 'blog/index.html'
    if os.path.exists(os.path.join(ROOT, p)):
        s = rd(p); blk = '<!--PINTEREST-->' + blog_card() + '<!--/PINTEREST-->'
        if '<!--PINTEREST-->' in s: s = s[:s.index('<!--PINTEREST-->')] + blk + s[s.index('<!--/PINTEREST-->') + len('<!--/PINTEREST-->'):]
        elif '<div class="social-card" data-x' in s: s = s.replace('<div class="social-card" data-x', blk + '\n    <div class="social-card" data-x', 1)
        else: NOTES.append('Blog page: no place found for the Pinterest card')
        s = s.replace('Our newest posts on Instagram and X.', 'Our newest posts and pins on Instagram and Pinterest.')
        wr(p, s)
    p = 'index.html'
    if os.path.exists(os.path.join(ROOT, p)):
        s = rd(p); blk = '<!--PINTEREST-HOME-->' + home_section() + '<!--/PINTEREST-HOME-->'
        if '<!--PINTEREST-HOME-->' in s: s = s[:s.index('<!--PINTEREST-HOME-->')] + blk + s[s.index('<!--/PINTEREST-HOME-->') + len('<!--/PINTEREST-HOME-->'):]
        elif '<section class="about-section"' in s: s = s.replace('<section class="about-section"', blk + '\n\n    <section class="about-section"', 1)
        else: NOTES.append('Home page: no place found for the Pinterest section')
        wr(p, s)


# ------------------------------------------------------------------ blog/pinterest.xml for Pinterest's Auto-publish
TAGS = {'design-news': '#designnews #graphicdesign', 'ai-design': '#aidesign #designtools', 'adobe': '#adobe #adobefirefly',
        'meta-ads': '#metaads #digitalmarketing', 'branding': '#branding #brandidentity', 'brand-stories': '#brandstrategy #marketing',
        'growth': '#socialmediamarketing #seo', 'global': '#advertising #marketing'}
PLAY_PINS = [  # (guid, image, w, h, title, description, date)
    ('play-game-brain', '/assets/play/game-brain-4x5.jpg', 1080, 1350, 'How sharp is your game brain? Free 2-minute games for creatives',
     'Quick quizzes and games for creative minds: a Daily five, hex hunch, brief roulette and more. Two minutes, no sign-up, keep a streak. #designgames #creativity #nmxlabs', '2026-11-26'),
    ('play-create-challenge', '/assets/play/play-create-9x16.jpg', 941, 1672, 'Play. Create. Challenge. Quizzes and games for designers and marketers',
     'Spin the wheel, guess the hex code, roll a client brief: two-minute games about design, branding, ads and AI search. Free on labsnmx.com. #graphicdesign #marketing #nmxlabs', '2026-11-26')]

def _rfc(d):
    x = dt.datetime.strptime(d, '%Y-%m-%d'); return x.strftime('%a, %d %b %Y') + ' 09:00:00 +0530'

def pinterest_feed(published):
    def utm(u, c): return u + '?utm_source=pinterest&amp;utm_medium=social&amp;utm_campaign=autopublish' + (f'&amp;utm_content={c}' if c else '')
    items = []
    for p in published[:50]:
        jpg = os.path.join(ROOT, 'assets', 'blog', p['image'] + '.jpg')
        if not os.path.exists(jpg): continue
        desc = p['dek']
        tk = (p.get('takeaways') or [''])[0]
        tags = (TAGS.get(p['category'], '#marketing') + ' #nmxlabs')
        if tk and len(desc) + len(tk) + len(tags) < 480: desc += ' ' + tk
        desc = (desc[:480 - len(tags)].rsplit(' ', 1)[0] + '…' if len(desc) > 480 - len(tags) else desc) + ' ' + tags
        url = f'{SITE}/assets/blog/{p["image"]}.jpg'
        items.append(f'''  <item>
    <title>{esc(p["title"][:100])}</title>
    <link>{utm(f"{SITE}/blog/{p['slug']}/", '')}</link>
    <guid isPermaLink="false">labsnmx-pin-{esc(p["slug"])}</guid>
    <description>{esc(desc)}</description>
    <category>{esc(p["category_label"])}</category>
    <pubDate>{_rfc(p["date"])}</pubDate>
    <enclosure url="{url}" length="{os.path.getsize(jpg)}" type="image/jpeg"/>
    <media:content url="{url}" medium="image" type="image/jpeg" width="1200" height="675"/>
  </item>''')
    for guid, img, w, h, title, desc, d in PLAY_PINS:
        f = os.path.join(ROOT, img.lstrip('/'))
        if not os.path.exists(f): continue
        items.append(f'''  <item>
    <title>{esc(title)}</title>
    <link>{utm(SITE + "/play/", guid)}</link>
    <guid isPermaLink="false">labsnmx-pin-{guid}</guid>
    <description>{esc(desc)}</description>
    <category>Play</category>
    <pubDate>{_rfc(d)}</pubDate>
    <enclosure url="{SITE}{img}" length="{os.path.getsize(f)}" type="image/jpeg"/>
    <media:content url="{SITE}{img}" medium="image" type="image/jpeg" width="{w}" height="{h}"/>
  </item>''')
    wr('blog/pinterest.xml', f'''<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
<channel>
  <title>NMX Labs: design, AI and marketing</title>
  <link>{SITE}/blog/</link>
  <atom:link href="{SITE}/blog/pinterest.xml" rel="self" type="application/rss+xml"/>
  <description>New articles from NMX Labs, Gurugram, on branding, AI design tools, advertising and platform growth, plus free games for creatives.</description>
  <language>en-IN</language>
  <lastBuildDate>{_rfc(published[0]["date"])}</lastBuildDate>
{chr(10).join(items)}
</channel>
</rss>
''')
    return len(items)


def pages():
    """Page passes that run after Learn/Play and the news layer, before the footer pass."""
    play_page()
    pinterest_on_site()
