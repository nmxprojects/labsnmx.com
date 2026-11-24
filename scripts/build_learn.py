#!/usr/bin/env python3
"""
NMX Labs: builds Learn (Creator school) and Play. Called by scripts/build.py on every run, or by hand:

    python scripts/build_learn.py                  # build for today (India time)
    python scripts/build_learn.py --today 2026-12-01

Sources (edit these, never the generated pages):
  content/lessons.json        one entry per lesson: slug, status, date, author, title, short, dek, read_min, takeaways, quiz
  content/learn/<slug>.html   the lesson body (plain HTML: <p>, <h2>, <h3>, <ul>, <ol>)
  content/quiz-extra.json     extra question banks for /play/ (branding, metaads)
  assets/learn/learn-<slug>.jpg, .webp and -640.webp   the lesson picture (1200 x 675), like blog images

Writes: learn/index.html, learn/<slug>/index.html, play/index.html, assets/quiz-bank.js.
A lesson dated in the future is not built or linked until its date, like scheduled blog posts. Max 2 lessons per date.
The menu, footer and tracking code are copied from about/index.html, so they always match the rest of the site.
"""
import argparse, datetime as dt, html, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = 'https://labsnmx.com'
IST = dt.timezone(dt.timedelta(hours=5, minutes=30))
MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
AUTHORS = {'neeraj': ('Neeraj', 'AI Design Expert'), 'anisha': ('Anisha', 'NMX Labs')}
WRITTEN = []

def rd(p): return open(os.path.join(ROOT, p), encoding='utf-8').read()
def wr(p, s):
    full = os.path.join(ROOT, p); os.makedirs(os.path.dirname(full), exist_ok=True)
    old = open(full, encoding='utf-8').read() if os.path.exists(full) else None
    if old != s: open(full, 'w', encoding='utf-8').write(s); WRITTEN.append(p)
def esc(s): return html.escape(str(s), quote=True)
def human(d): y, m, dd = d.split('-'); return f'{int(dd)} {MONTHS[int(m) - 1]} {y}'

# ------------------------------------------------------------------ menu and footer links (also used by build.py)
SCHOOL = [('/learn/', 'Learn'), ('/play/', 'Play')]
def add_school_links(s, current=None):
    """Adds Learn and Play to the top menu, the mobile menu and the footer's Studio column, once. Idempotent."""
    def links(cls=''):
        return ''.join(f'<a href="{h}"' + (f' class="{cls}"' if cls else '') + (' aria-current="page"' if current == h else '') + f'>{t}</a>' for h, t in SCHOOL)
    def patch_block(s, start_pat, end_tag):
        m = re.search(start_pat, s)
        if not m: return s
        a = m.end(); b = s.find(end_tag, a)
        if b < 0: return s
        block = s[a:b]
        if 'href="/learn/"' in block: return s
        v = re.search(r'<a href="/videos/"[^>]*>Videos</a>', block)
        if v: block = block[:v.end()] + links() + block[v.end():]
        else: block = block + links()
        return s[:a] + block + s[b:]
    s = patch_block(s, r'<div class="nav-links">', '</div>')
    s = patch_block(s, r'<div class="mobile-menu-links">', '</div>') if '<div class="mobile-menu-links">' in s else patch_block(s, r'<div class="mobile-menu" id="mobileMenu">', '</div>')
    if '<li><a href="/saved/">Saved posts</a></li>' in s and '<li><a href="/learn/">' not in s:
        s = s.replace('<li><a href="/saved/">Saved posts</a></li>', '<li><a href="/saved/">Saved posts</a></li><li><a href="/learn/">Creator school</a></li><li><a href="/play/">Games and quizzes</a></li>', 1)
    return s

def shell_parts():
    a = rd('about/index.html')
    head_tracking = a[a.index('<script async src="https://www.googletagmanager'):a.index('<script defer src="/assets/nmx.js"></script>')]
    noscript = re.search(r'<noscript>.*?</noscript>', a, re.S).group(0)
    nav = re.search(r'<nav class="site-nav".*?</nav>\n<div class="mobile-menu" id="mobileMenu">.*?</div>', a, re.S).group(0)
    nav = nav.replace(' aria-current="page"', '')
    footer = a[a.index('<footer class="site-footer">'):a.rindex('</body>')]
    return head_tracking, noscript, nav, footer

def page(path, title, desc, body, jsonld, current, image=None, extra_css='', extra_js='', og_type='website', robots='index, follow, max-image-preview:large', preload=None):
    tracking, noscript, nav, footer = shell_parts()
    nav = add_school_links(nav, current); footer = add_school_links(footer)
    img = image or f'{SITE}/favicon-512.png'
    ld = ''.join('<script type="application/ld+json">\n' + json.dumps(x, ensure_ascii=False, indent=1) + '\n</script>\n' for x in jsonld)
    return f'''<!DOCTYPE html>
<html lang="en-IN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{esc(title)}</title>
<meta name="description" content="{esc(desc)}">
<meta name="robots" content="{robots}">
<link rel="canonical" href="{SITE}{path}">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
<link rel="apple-touch-icon" sizes="180x180" href="/favicon-180.png">
<meta name="theme-color" content="#faf9f6">
<link rel="manifest" href="/manifest.webmanifest">
<meta name="apple-mobile-web-app-title" content="NMX Labs">
<meta name="mobile-web-app-capable" content="yes">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
{f'<link rel="preload" as="image" href="{preload}" fetchpriority="high">' + chr(10) if preload else ''}<link rel="stylesheet" href="/assets/site.css">
<link rel="stylesheet" href="/assets/school.css">
{extra_css}<link rel="alternate" type="application/rss+xml" title="NMX Labs Blog" href="{SITE}/blog/feed.xml">
<meta property="og:type" content="{og_type}">
<meta property="og:site_name" content="NMX Labs">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(desc)}">
<meta property="og:url" content="{SITE}{path}">
<meta property="og:image" content="{img}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="{img}">
{ld}{tracking}<script>(function(){{try{{var t=localStorage.getItem('nmx-theme');if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t);}}catch(e){{}}}})();</script>
{extra_js}<script defer src="/assets/nmx.js"></script>
</head>
<body>
{noscript}
{nav}
{body}
{footer}</body>
</html>
'''

# ------------------------------------------------------------------ data
def load(today):
    lessons = json.load(open(os.path.join(ROOT, 'content', 'lessons.json'), encoding='utf-8'))
    errors, per_day = [], {}
    for x in lessons:
        for k in ('slug', 'status', 'date', 'title', 'dek', 'author', 'read_min'):
            if not x.get(k): errors.append(f"{x.get('slug', '?')}: missing {k}")
        if x.get('author') not in AUTHORS: errors.append(f"{x['slug']}: unknown author {x.get('author')}")
        if not os.path.exists(os.path.join(ROOT, 'content', 'learn', x['slug'] + '.html')): errors.append(f"{x['slug']}: content/learn/{x['slug']}.html is missing")
        per_day[x['date']] = per_day.get(x['date'], 0) + 1
    errors += [f'{d} has {n} lessons; the limit is 2 a day' for d, n in per_day.items() if n > 2]
    if errors: print('content/lessons.json problems:\n  ' + '\n  '.join(errors)); sys.exit(1)
    live = [x for x in lessons if x['status'] != 'draft' and x['date'] <= today]
    live.sort(key=lambda x: x['date'])
    for i, x in enumerate(live):
        x['n'] = i + 1; x.setdefault('image', 'learn-' + x['slug']); x.setdefault('modified', x['date']); x.setdefault('short', x['title'])
        x['has_img'] = os.path.exists(os.path.join(ROOT, 'assets', 'learn', x['image'] + '.webp'))
    return live

PLAYER = '''<div class="player" id="player" hidden role="region" aria-label="Audio player">
  <button class="player-btn" id="playerToggle" type="button" aria-label="Pause"><svg viewBox="0 0 24 24" aria-hidden="true" class="i-pause"><path d="M8 5v14M16 5v14"/></svg><svg viewBox="0 0 24 24" aria-hidden="true" class="i-play"><path d="M7 4.5v15l12-7.5z"/></svg></button>
  <div class="player-info"><span class="player-title">Listening</span><span class="player-bar"><span id="playerProgress"></span></span></div>
  <button class="player-speed" id="playerSpeed" type="button" aria-label="Playback speed">1×</button>
  <button class="player-btn" id="playerStop" type="button" aria-label="Stop listening"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
</div>
'''

def build_lesson(x, lessons):
    total = len(lessons); prev = lessons[x['n'] - 2] if x['n'] > 1 else None; nxt = lessons[x['n']] if x['n'] < total else None
    name, role = AUTHORS[x['author']]
    url = f"/learn/{x['slug']}/"
    img = f"{SITE}/assets/learn/{x['image']}.jpg" if x['has_img'] else None
    hero = (f'<figure class="post-hero"><img src="/assets/learn/{x["image"]}.webp" alt="Lesson {x["n"]}: {esc(x["short"])}" width="1200" height="675" fetchpriority="high" decoding="async"></figure>\n') if x['has_img'] else ''
    summary = ''.join(f'<li>{esc(t)}</li>' for t in x.get('takeaways', []))
    quiz = x.get('quiz') or []
    quiz_html = ('<section class="lesson-check" aria-labelledby="checkH">\n<h2 id="checkH">Check yourself</h2>\n<p>' + str(len(quiz)) + ' quick questions on this lesson. Your answers stay in this browser.</p>\n'
                 '<div data-quiz><noscript>The quiz needs JavaScript.</noscript></div>\n<script type="application/json" id="lessonQuiz">' + json.dumps(quiz, ensure_ascii=False).replace('</', '<\\/') + '</script>\n</section>\n') if quiz else ''
    navl = '<nav class="lesson-nav" aria-label="Lessons">' + \
        (f'<a class="prev" href="/learn/{prev["slug"]}/"><small>Lesson {prev["n"]}</small><b>{esc(prev["short"])}</b></a>' if prev else '<span></span>') + \
        (f'<a class="next" href="/learn/{nxt["slug"]}/"><small>Next: lesson {nxt["n"]}</small><b>{esc(nxt["short"])}</b></a>' if nxt else '<a class="next" href="/play/"><small>You’ve reached the latest lesson</small><b>Test yourself on Play</b></a>') + '</nav>\n'
    body = f'''<main class="wrap">
<article id="article" data-lesson="{x['slug']}">
<header class="article-head">
  <p class="crumbs"><a href="/learn/">Learn</a> / <a href="/learn/">Creator school</a></p>
  <p class="lesson-step"><span>Lesson {x['n']} of {total}</span><span class="bar" aria-hidden="true"><i></i></span></p>
  <h1>{esc(x['title'])}</h1>
  <p class="dek">{esc(x['dek'])}</p>
  <div class="byline"><span>By <a href="/blog/author/{x['author']}/" rel="author" data-author="{name}">{name}</a>, NMX Labs</span><time datetime="{x['date']}">{human(x['date'])}</time><span>{x['read_min']} min read</span></div>
  <div class="tools" role="group" aria-label="Article tools">
    <button class="tool" id="listenBtn" type="button" aria-pressed="false" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="14" width="4" height="7" rx="1.5"/><rect x="17" y="14" width="4" height="7" rx="1.5"/></svg><span>Listen</span></button>
    <button class="tool" id="summaryBtn" type="button" aria-expanded="false" aria-controls="quickSummary"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 6h14M5 12h14M5 18h9"/></svg><span>Quick summary</span></button>
  </div>
  <div class="quick-summary" id="quickSummary" hidden>
    <h2>Quick summary</h2>
    <ul>{summary}</ul>
  </div>
</header>
{hero}<div class="prose">
{rd(os.path.join('content', 'learn', x['slug'] + '.html'))}
{quiz_html}<p class="notes-meta">Spotted an error, or want a lesson on something else? Email <a href="mailto:nmxprojects@gmail.com">nmxprojects@gmail.com</a>. How we research and correct: <a href="/editorial-standards/">editorial standards</a>.</p>
</div>
{navl}</article>
</main>
{PLAYER}'''
    ld = [{'@context': 'https://schema.org', '@type': ['Article', 'LearningResource'], 'headline': x['title'], 'description': x['dek'],
           'datePublished': x['date'], 'dateModified': x['modified'], 'url': SITE + url, 'mainEntityOfPage': SITE + url,
           'image': img or f'{SITE}/favicon-512.png', 'learningResourceType': 'Lesson', 'educationalLevel': 'Beginner', 'inLanguage': 'en-IN',
           'isPartOf': {'@type': 'Course', 'name': 'NMX Labs Creator school', 'url': SITE + '/learn/', 'description': 'Free lessons on making YouTube and short videos.', 'provider': {'@type': 'Organization', 'name': 'NMX Labs', 'url': SITE + '/'}},
           'author': {'@type': 'Person', 'name': name, 'url': f"{SITE}/blog/author/{x['author']}/"},
           'publisher': {'@type': 'Organization', 'name': 'NMX Labs', 'logo': {'@type': 'ImageObject', 'url': f'{SITE}/favicon-512.png'}}},
          {'@context': 'https://schema.org', '@type': 'BreadcrumbList', 'itemListElement': [
              {'@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': SITE + '/'},
              {'@type': 'ListItem', 'position': 2, 'name': 'Learn', 'item': SITE + '/learn/'},
              {'@type': 'ListItem', 'position': 3, 'name': x['short'], 'item': SITE + url}]}]
    wr(f"learn/{x['slug']}/index.html", page(url, f"{x['title']} | NMX Labs Creator school", x['dek'], body, ld, '/learn/', img,
       extra_js='<script defer src="/assets/blog.js"></script>\n<script defer src="/assets/school.js"></script>\n', og_type='article',
       preload=f"/assets/learn/{x['image']}.webp" if x['has_img'] else None))

TICK = '<span class="tick" aria-hidden="true"></span>'
def build_hub(lessons):
    rows = ''.join(f'''<li data-slug="{x['slug']}" data-n="{x['n']}"><a href="/learn/{x['slug']}/">
  <span class="n" aria-hidden="true">{x['n']:02d}</span>{f'<img src="/assets/learn/{x["image"]}-640.webp" alt="" width="640" height="360" loading="lazy" decoding="async">' if x['has_img'] else '<span></span>'}
  <div><h3>{esc(x['title'])}</h3><p>{esc(x['dek'])}</p><span class="m">Lesson {x['n']} · {AUTHORS[x['author']][0]} · <time datetime="{x['date']}">{human(x['date'])}</time> · {x['read_min']} min read</span></div>{TICK}
</a></li>
''' for x in lessons)
    desc = 'Free lessons on making videos people finish: shooting on the phone you already have, light and sound, editing, the rules to follow, titles and thumbnails, and getting paid on YouTube.'
    body = f'''<main class="wrap">
<div class="learn-head">
<header class="page-head">
  <p class="crumbs"><a href="/">Home</a> / Learn</p>
  <h1>Creator school</h1>
  <p>{esc(desc)} Written for India, tested on real channels, no expensive gear needed.</p>
</header>
<div class="progress-card" aria-live="polite">
  <p>Your progress</p>
  <p class="big"><span class="num">0</span><span> of {len(lessons)} lessons done</span></p>
  <div class="bar" aria-hidden="true"><i></i></div>
  <a class="btn" href="/learn/{lessons[0]['slug'] if lessons else ''}/">Start with lesson 1</a>
  <p class="meta">{esc(lessons[0]['title']) if lessons else ''}</p>
</div>
</div>
<section class="course" id="course" aria-labelledby="courseH">
  <div>
    <h2 id="courseH" class="sr-only">All lessons, in order</h2>
    <ol class="lesson-list">
{rows}    </ol>
  </div>
  <aside class="course-side">
    <div class="side-card side-card--ink"><h2>Test yourself</h2><p>Quizzes on every lesson, a Daily five, and quick mind games.</p><a class="btn" href="/play/">Go to Play</a></div>
    <div class="side-card"><h2>New lessons most weeks</h2><p>Get a notification when the next one is out. One tap to turn off.</p><button class="btn" type="button" data-follow="learn_hub">Notify me</button></div>
    <div class="side-card"><h2>Need it done for your brand?</h2><p>We script, shoot and edit for brands, and run the ads around them.</p><a class="btn btn--ghost" href="/#services">See our services</a></div>
  </aside>
</section>
</main>
'''
    ld = [{'@context': 'https://schema.org', '@type': 'ItemList', 'name': 'NMX Labs Creator school', 'description': desc, 'url': SITE + '/learn/',
           'itemListElement': [{'@type': 'ListItem', 'position': x['n'], 'url': f"{SITE}/learn/{x['slug']}/", 'name': x['title']} for x in lessons]}]
    first_img = f"{SITE}/assets/learn/{lessons[0]['image']}.jpg" if lessons and lessons[0]['has_img'] else None
    wr('learn/index.html', page('/learn/', 'Creator school: free lessons on making YouTube videos | NMX Labs', desc, body, ld, '/learn/', first_img,
       extra_js='<script defer src="/assets/school.js"></script>\n'))

GAME_CARDS = [('quiz-youtube', 'g-y', 'brain', 'YouTube basics', 'Eight questions from the Creator school lessons.'),
              ('quiz-branding', 'g-p', 'frame', 'Branding', 'Logos, colours, trademarks and tone of voice.'),
              ('quiz-metaads', 'g-o', 'phone', 'Meta ads', 'Sizes, safe zones, testing and the learning phase.'),
              ('odd', 'g-i', 'odd', 'Odd one out', 'Three belong together. Spot the one that doesn’t.'),
              ('memory', 'g-s', 'camera', 'Memory match', 'Flip cards and pair up the creator kit.'),
              ('pattern', 'g-y', 'pads', 'Pattern recall', 'Repeat the lights. It grows every round.'),
              ('scramble', 'g-p', 'letters', 'Word scramble', 'Unscramble creator words against the clock.')]
def build_play(lessons, extra):
    bank = {'youtube': [q for x in lessons for q in (x.get('quiz') or [])], 'branding': extra.get('branding', []), 'metaads': extra.get('metaads', [])}
    wr('assets/quiz-bank.js', '/* Generated by scripts/build_learn.py from content/lessons.json and content/quiz-extra.json. Edit those, not this file. */\n'
       'window.NMX_QUIZ_BANK = ' + json.dumps(bank, ensure_ascii=False) + ';\n')
    cards = ''.join(f'<button type="button" class="game-card" data-game="{g}"><span class="gi {c}" data-icon="{i}"></span><h3>{t}</h3><p>{d}</p><span class="best">Not played yet</span></button>' for g, c, i, t, d in GAME_CARDS)
    desc = 'Quick quizzes and mind games about making videos, branding and ads: a Daily five, topic quizzes, memory match, pattern recall, word scramble and odd one out. Free, no sign-up.'
    body = f'''<main class="wrap">
<section class="play-head">
  <div><p class="crumbs"><a href="/">Home</a> / Play</p><h1>Play</h1><p>Two-minute games for people who make things. Sharpen your memory, test what you know, keep a streak going.</p></div>
  <div class="daily">
    <div class="cal" aria-hidden="true"><div><small>Today</small><b class="num"></b></div></div>
    <h2>Daily five</h2>
    <p data-daily-status>Five questions, about two minutes. Same five for everyone today.</p>
    <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap"><button type="button" class="btn" data-game="daily" data-daily-go>Play today’s five</button><span class="streak"></span></div>
  </div>
</section>
<section class="play-sec" aria-labelledby="gamesH">
  <h2 id="gamesH">Quizzes and games</h2>
  <p>Every quiz explains its answers. Your best scores stay in this browser.</p>
  <div class="games">{cards}</div>
</section>
<section class="play-about" aria-label="About these games">
  <div><h3>Why games on a studio site?</h3><p>Because remembering beats reading. A quiz after a lesson is one of the most reliable ways to make what you learned stick, and the mind games are a short break that still keeps your head in the craft.</p></div>
  <div><h3>Where the questions come from</h3><p>From our <a href="/learn/">Creator school</a> lessons and our <a href="/blog/">blog</a>. Platform rules change, so each answer reflects what was true when we wrote it; tell us if something is out of date.</p></div>
  <div><h3>Your data</h3><p>Scores, streaks and progress are stored only in your browser. We count plays and finished quizzes, without names, to see which games people enjoy. Details in our <a href="/privacy-policy.html">privacy policy</a>.</p></div>
</section>
</main>
<div class="stage" id="stage" role="dialog" aria-modal="true" aria-labelledby="stageTitle" hidden>
  <div class="stage-bar"><h2 id="stageTitle">Play</h2><div class="hud" id="stageHud"></div><button type="button" class="stage-x" id="stageClose">Close</button></div>
  <div class="stage-body" id="stageBody"></div>
</div>
'''
    ld = [{'@context': 'https://schema.org', '@type': 'WebPage', 'name': 'Play: quizzes and mind games | NMX Labs', 'url': SITE + '/play/', 'description': desc}]
    wr('play/index.html', page('/play/', 'Play: quizzes and mind games for creators | NMX Labs', desc, body, ld, '/play/', None,
       extra_js='<script defer src="/assets/school.js"></script>\n<script defer src="/assets/quiz-bank.js"></script>\n<script defer src="/assets/play.js"></script>\n'))

def build(today=None):
    today = today or dt.datetime.now(IST).date().isoformat()
    lessons = load(today)
    extra = json.load(open(os.path.join(ROOT, 'content', 'quiz-extra.json'), encoding='utf-8')) if os.path.exists(os.path.join(ROOT, 'content', 'quiz-extra.json')) else {}
    for x in lessons: build_lesson(x, lessons)
    if lessons: build_hub(lessons)
    build_play(lessons, extra)
    return lessons

def urls(today=None):
    """(path, lastmod) for the sitemap, used by build.py."""
    today = today or dt.datetime.now(IST).date().isoformat()
    try: lessons = load(today)
    except SystemExit: return []
    out = [('/learn/', max([x['modified'] for x in lessons] or [today])), ('/play/', today)]
    return out + [(f"/learn/{x['slug']}/", x['modified']) for x in lessons]

if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('--today'); a = ap.parse_args()
    ls = build(a.today)
    print(f"Learn: {len(ls)} lessons live. Files updated: {len(WRITTEN)}")
