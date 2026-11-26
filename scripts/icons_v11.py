#!/usr/bin/env python3
"""
NMX Labs v11: one flat icon set for the website, the share/follow tiles and the emails.

Style: flat 2D glyphs on a 24 x 24 grid, solid shapes with knock-out details and a few thick rounded outlines.
No gradients, no gloss, no shadows. Every shape uses currentColor, so an icon takes the colour of the text around
it and follows the light and dark themes by itself. The tiles (follow and share) are a flat slate square with a white
glyph in the light theme and a light square with a dark glyph in the dark theme; hover turns them orange.

Used by:
  scripts/build_v11.py   icons in the footer "Get in touch" column, the contact page and the homepage socials
  assets/engage.js       the GLYPH map (generated from this file: python scripts/icons_v11.py --js)
  assets/icons/          nmx-icons.svg (sprite) and one .svg per icon (python scripts/icons_v11.py --files)
  assets/email/icons/    the PNG tiles the emails use (python scripts/icons_v11.py --png, needs cairosvg)

The social symbols are deliberately generic (a camera, a chat bubble, a play button...) with the network's name
next to them, the same approach the site already used. Add an icon: add an entry to GLYPHS, re-run the commands above.
"""
import json, os, sys

F = 'fill="currentColor" stroke="none"'
S = 'fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"'


def circ(cx, cy, r):
    """A circle as a sub-path, so it can be a hole (fill-rule evenodd)."""
    return f'M{cx - r:g} {cy:g}a{r:g} {r:g} 0 1 0 {2 * r:g} 0a{r:g} {r:g} 0 1 0 {-2 * r:g} 0z'


def rrect(x, y, w, h, r):
    """A rounded rectangle as a sub-path."""
    return (f'M{x + r:g} {y:g}h{w - 2 * r:g}a{r:g} {r:g} 0 0 1 {r:g} {r:g}v{h - 2 * r:g}a{r:g} {r:g} 0 0 1 {-r:g} {r:g}'
            f'h{-(w - 2 * r):g}a{r:g} {r:g} 0 0 1 {-r:g} {-r:g}v{-(h - 2 * r):g}a{r:g} {r:g} 0 0 1 {r:g} {-r:g}z')


def fill(d, evenodd=False):
    rule = ' fill-rule="evenodd"' if evenodd else ''
    return '<path ' + F + rule + ' d="' + d + '"/>'


def line(d, w=2.2):
    return f'<path {S} stroke-width="{w:g}" d="{d}"/>'


GLYPHS = {
    # ---------------------------------------------------------------- social (generic symbols)
    'camera': fill('M9.1 4.3h5.8a1.3 1.3 0 0 1 1.1.6L17.3 7H6.7l1.3-2.1a1.3 1.3 0 0 1 1.1-.6z') +
              fill(rrect(2.5, 6.6, 19, 14, 4) + circ(12, 13.6, 4.5) + circ(12, 13.6, 2.6) + circ(18, 10.1, 1.05), True),
    'chat': fill('M5.4 16.3 3.7 20.9a.5.5 0 0 0 .66.63l4.9-1.85z') +
            fill(circ(12, 11.6, 9) + circ(8.1, 11.6, 1.3) + circ(12, 11.6, 1.3) + circ(15.9, 11.6, 1.3), True),
    'play': fill(circ(12, 12, 9.6) + 'M10 8.4v7.2c0 .5.5.8.9.55l5.8-3.6a.65.65 0 0 0 0-1.1l-5.8-3.6c-.4-.25-.9.05-.9.55z', True),
    'briefcase': line('M8.9 6.9V5.6a1.8 1.8 0 0 1 1.8-1.8h2.6a1.8 1.8 0 0 1 1.8 1.8v1.3', 2.1) +
                 fill(rrect(2.5, 6.8, 19, 13.6, 3.2) + 'M2.5 11.9h19v1.5h-19z', True) +
                 fill(rrect(10.2, 10.9, 3.6, 3.5, .9)),
    'pin': fill('M8.3 3.4h7.4a1.1 1.1 0 0 1 .9 1.7l-1.5 2.4v3.2l3 2.9a1.1 1.1 0 0 1-.8 1.9H6.7a1.1 1.1 0 0 1-.8-1.9l3-2.9V7.5L7.4 5.1a1.1 1.1 0 0 1 .9-1.7z') +
           line('M12 15.6v5.4', 2.3),
    'at': line(circ(12, 12, 3.7) + 'M15.7 12v1.4a2.7 2.7 0 0 0 5.4 0V12a9.1 9.1 0 1 0-3.6 7.3', 2.3),
    'people': fill(circ(9, 8, 3.6)) +
              fill('M2.6 19.6c0-3.7 2.9-6.4 6.4-6.4s6.4 2.7 6.4 6.4a.9.9 0 0 1-.9.9H3.5a.9.9 0 0 1-.9-.9z') +
              fill(circ(16.9, 8.9, 2.8)) +
              fill('M16.2 13.6c3 0 5.2 2.2 5.2 5.4a.9.9 0 0 1-.9.9h-3.3c0-2.5-.8-4.6-2.3-6.1.4-.1.8-.2 1.3-.2z'),
    'bubbles': line(rrect(9, 3.3, 12.4, 9.4, 3.2) + 'M18.6 12.7v2.6l-2.8-2.6', 2) +
               fill(rrect(2.6, 8, 12.6, 9.6, 3.3)) + fill('M5 17.2v3.6a.5.5 0 0 0 .85.36l3.9-3.96z'),
    'plane': fill('M2.9 10.9 20.3 3.7c.7-.3 1.4.4 1.1 1.1l-6.9 16.9c-.3.8-1.4.7-1.6-.1l-1.8-6.3-6.4-2.1c-.8-.3-.9-1.4-.1-1.7z'),
    'feed': fill(circ(6, 18, 2.3)) + line('M4.2 11.2a8.6 8.6 0 0 1 8.6 8.6M4.2 4.6a15.2 15.2 0 0 1 15.2 15.2', 2.5),
    'mail': fill(rrect(2.5, 4.8, 19, 14.6, 3.2) + 'M5 7.6 12 12.4l7-4.8v2.6L12 15l-7-4.8z', True),
    'phone': fill('M6.4 3.3c.8-.5 1.8-.2 2.3.6l1.6 2.8c.4.8.3 1.7-.4 2.3l-1.3 1.1c.9 2 2.6 3.8 4.6 4.7l1.1-1.3c.6-.7 1.5-.8 2.3-.4l2.8 1.6c.8.5 1.1 1.5.6 2.3l-.8 1.5c-.7 1.2-2.1 1.9-3.5 1.5C10 18.5 5.5 14 4 8.2c-.4-1.4.3-2.8 1.5-3.5z'),
    'mobile': fill(rrect(5.8, 2, 12.4, 20, 3.2) + rrect(10, 17.6, 4, 1.5, .75) + circ(12, 5, .9), True),
    'globe': line(circ(12, 12, 9) + 'M3 12h18M12 3c2.6 2.4 3.9 5.4 3.9 9s-1.3 6.6-3.9 9c-2.6-2.4-3.9-5.4-3.9-9S9.4 5.4 12 3z', 2),
    # ---------------------------------------------------------------- actions
    'link': line('M10 14a4 4 0 0 0 5.7 0l3.2-3.2a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3.2 3.2a4 4 0 0 0 5.7 5.7l1-1', 2.4),
    'copy': line(rrect(8.6, 2.8, 12.6, 12.6, 3), 2) + fill(rrect(2.8, 8.6, 12.6, 12.6, 3)),
    'share': line('M12 3.4v11M8 7.3l4-3.9 4 3.9M8.6 10.2H7.2a2.6 2.6 0 0 0-2.6 2.6v5.6a2.6 2.6 0 0 0 2.6 2.6h9.6a2.6 2.6 0 0 0 2.6-2.6v-5.6a2.6 2.6 0 0 0-2.6-2.6h-1.4', 2.3),
    'save': fill('M6.3 3h11.4A1.8 1.8 0 0 1 19.5 4.8v15.6c0 .7-.8 1.1-1.4.7L12 16.7l-6.1 4.4c-.6.4-1.4 0-1.4-.7V4.8A1.8 1.8 0 0 1 6.3 3z'),
    'saved': fill('M6.3 3h11.4A1.8 1.8 0 0 1 19.5 4.8v15.6c0 .7-.8 1.1-1.4.7L12 16.7l-6.1 4.4c-.6.4-1.4 0-1.4-.7V4.8A1.8 1.8 0 0 1 6.3 3z'
                  'M8.3 9.5l1.2-1.2 1.6 1.6 3.4-3.4 1.2 1.2-4.6 4.6z', True),
    'heart': fill('M12 20.4c-.3 0-.6-.1-.8-.3C6.3 16 3 13 3 9.2 3 6.5 5.1 4.3 7.8 4.3c1.7 0 3.2.9 4.2 2.2 1-1.3 2.5-2.2 4.2-2.2C18.9 4.3 21 6.5 21 9.2c0 3.8-3.3 6.8-8.2 10.9-.2.2-.5.3-.8.3z'),
    'comment': fill('M6.6 16.4v4.2a.5.5 0 0 0 .84.37l4.9-4.57z') +
               fill(rrect(2.6, 3.6, 18.8, 13.6, 3.6) + rrect(6.6, 7.6, 10.8, 1.7, .85) + rrect(6.6, 11.3, 6.6, 1.7, .85), True),
    'print': fill(rrect(6.6, 2.8, 10.8, 4.4, 1.2)) +
             fill('M5.3 8.2h13.4a2.8 2.8 0 0 1 2.8 2.8v4a2.8 2.8 0 0 1-2.8 2.8h-.3V13H5.6v4.8h-.3a2.8 2.8 0 0 1-2.8-2.8v-4a2.8 2.8 0 0 1 2.8-2.8z' + circ(17.6, 10.6, 1), True) +
             fill(rrect(7.2, 14.4, 9.6, 6.8, 1.2)),
    'download': line('M12 3.4v11.2M7.6 10.4l4.4 4.4 4.4-4.4M4.4 15.6v2.6a2.6 2.6 0 0 0 2.6 2.6h10a2.6 2.6 0 0 0 2.6-2.6v-2.6', 2.3),
    'more': fill(circ(5.4, 12, 2.1) + circ(12, 12, 2.1) + circ(18.6, 12, 2.1)),
    'bell': fill('M12 2.8c-3.4 0-6.1 2.7-6.1 6.2v4.2l-1.7 2.6c-.4.7.1 1.6.9 1.6h13.8c.8 0 1.3-.9.9-1.6l-1.7-2.6V9c0-3.5-2.7-6.2-6.1-6.2z') +
            fill('M9.4 18.6h5.2a2.6 2.6 0 0 1-5.2 0z'),
    'bellOff': line('M7 17.6H5.1c-.8 0-1.3-.9-.9-1.6l1.7-2.6V9c0-1.2.3-2.3.9-3.2M9.2 3.6A6 6 0 0 1 18.1 9v4.2l1.3 2', 2) +
               fill('M9.4 18.6h5.2a2.6 2.6 0 0 1-5.2 0z') + line('M3.6 3.6l16.8 16.8', 2.2),
    'send': fill('M3.4 4.2c-.2-.9.7-1.6 1.5-1.2l16 8c.8.4.8 1.6 0 2l-16 8c-.8.4-1.7-.3-1.5-1.2L5 13.1l7.6-1.1L5 10.9z'),
    'close': line('M6 6l12 12M18 6 6 18', 2.5),
    'check': line('M4.8 12.6l4.6 4.6L19.2 7.4', 2.7),
    'search': line(circ(10.6, 10.6, 6.6), 2.4) + line('M15.6 15.6 20.6 20.6', 2.8),
    'calendar': line('M8 2.8v3.6M16 2.8v3.6', 2.2) +
                fill(rrect(3, 5, 18, 16.2, 3.4) + 'M3 9.6h18V11H3z' + circ(8, 14.4, 1.2) + circ(12, 14.4, 1.2) +
                     circ(16, 14.4, 1.2) + circ(8, 17.8, 1.2) + circ(12, 17.8, 1.2), True),
    'location': fill('M12 2.4c-4.1 0-7.4 3.2-7.4 7.3 0 5.1 5.9 10.9 6.6 11.5.4.4 1.1.4 1.5 0 .7-.6 6.6-6.4 6.6-11.5 0-4.1-3.2-7.3-7.3-7.3z' + circ(12, 9.8, 2.8), True),
    'user': fill(circ(12, 7.6, 4.2)) + fill('M4.2 19.8c0-4 3.5-6.8 7.8-6.8s7.8 2.8 7.8 6.8a1 1 0 0 1-1 1H5.2a1 1 0 0 1-1-1z'),
    # ---------------------------------------------------------------- player and reading tools
    'playSm': fill('M7.4 5.2v13.6c0 .8.9 1.3 1.6.9l10.7-6.8c.6-.4.6-1.3 0-1.7L9 4.3c-.7-.4-1.6.1-1.6.9z'),
    'pause': fill(rrect(6.2, 4.8, 4, 14.4, 1.5) + rrect(13.8, 4.8, 4, 14.4, 1.5)),
    'headphones': line('M4.4 15.5V12a7.6 7.6 0 0 1 15.2 0v3.5', 2.2) + fill(rrect(2.8, 13.2, 5, 8, 2) + rrect(16.2, 13.2, 5, 8, 2)),
    'sparkle': fill('M11 2.6c.5 4.2 2.8 6.6 7 7-4.2.5-6.5 2.8-7 7-.4-4.2-2.8-6.5-7-7 4.2-.4 6.6-2.8 7-7z'
                    'M18.2 14.2c.2 1.8 1.2 2.8 3 3-1.8.2-2.8 1.2-3 3-.2-1.8-1.2-2.8-3-3 1.8-.2 2.8-1.2 3-3z'),
    'list': line('M5 6.5h14M5 12h14M5 17.5h8.6', 2.4),
    'arrow': line('M4.5 12h15M13.5 6l6 6-6 6', 2.4),
    'chevL': line('M15 5l-7 7 7 7', 2.6),
    'chevR': line('M9 5l7 7-7 7', 2.6),
    'tag': fill('M3 4.6A1.6 1.6 0 0 1 4.6 3h6.6c.4 0 .8.2 1.1.5l8.3 8.3a1.6 1.6 0 0 1 0 2.3l-6.6 6.6a1.6 1.6 0 0 1-2.3 0L3.5 12.4a1.6 1.6 0 0 1-.5-1.1z' + circ(7.8, 7.8, 1.7), True),
    'refresh': line('M4.6 11a7.5 7.5 0 0 1 13.2-4.3L20 9M20 4v5h-5M19.4 13a7.5 7.5 0 0 1-13.2 4.3L4 15M4 20v-5h5', 2.3),
    'sun': fill(circ(12, 12, 4.4)) + line('M12 2.4v2.2M12 19.4v2.2M5.2 5.2l1.6 1.6M17.2 17.2l1.6 1.6M2.4 12h2.2M19.4 12h2.2M5.2 18.8l1.6-1.6M17.2 6.8l1.6-1.6', 2.2),
    'moon': fill('M20.6 14.6A8.6 8.6 0 0 1 9.4 3.4a8.6 8.6 0 1 0 11.2 11.2z'),
}

# network / action key -> (glyph, label). Keys match the ones engage.js and Code-Blog.gs already use.
APPS = {
    'instagram': ('camera', 'Instagram'), 'whatsapp': ('chat', 'WhatsApp'), 'youtube': ('play', 'YouTube'),
    'linkedin': ('briefcase', 'LinkedIn'), 'pinterest': ('pin', 'Pinterest'), 'x': ('at', 'X'),
    'facebook': ('people', 'Facebook'), 'threads': ('bubbles', 'Threads'), 'telegram': ('plane', 'Telegram'),
    'email': ('mail', 'Email'), 'phone': ('phone', 'Phone'), 'rss': ('feed', 'RSS feed'), 'website': ('globe', 'Website'),
    'copy': ('link', 'Copy link'), 'more': ('more', 'More'), 'share': ('share', 'Share'), 'save': ('save', 'Save'),
    'like': ('heart', 'Like'), 'comment': ('comment', 'Comment'), 'print': ('print', 'Print'), 'download': ('download', 'Download'),
    'send': ('send', 'Send'), 'link': ('link', 'Link'), 'calendar': ('calendar', 'Book'),
}

# v11.1: official brand marks, if you add them. Save each network's own single-colour (black) logo file from its brand
# resources page as assets/icons/brands/<key>.svg. The site then shows it flat in the theme colour (CSS mask, so the
# file's own colours are ignored), the dashboard and share tiles use it, and the GitHub Action makes the email PNG from it.
# Until a file is there, the generic symbol below is used.
BRAND_OF = {'camera': 'instagram', 'chat': 'whatsapp', 'briefcase': 'linkedin', 'pin': 'pinterest', 'play': 'youtube',
            'people': 'facebook', 'at': 'x', 'bubbles': 'threads', 'plane': 'telegram'}
BRAND_KEYS = ['instagram', 'whatsapp', 'linkedin', 'pinterest', 'facebook', 'youtube', 'x', 'threads', 'telegram', 'google']


def brands(root):
    d = os.path.join(root, 'assets', 'icons', 'brands')
    return [k for k in BRAND_KEYS if os.path.exists(os.path.join(d, k + '.svg'))]


def mark(name, root, cls='nx-i'):
    """The icon for a page: the official brand file (as a flat mask) when present, otherwise the generic glyph."""
    b = BRAND_OF.get(name)
    if b and b in brands(root):
        return f'<span class="{cls} nx-bm" style="--bm:url(/assets/icons/brands/{b}.svg)" aria-hidden="true"></span>'
    return svg(name, cls)


INK = '#383b47'        # slate, the colour of the glyphs in the reference set
ACCENT = '#ff5a2b'     # NMX orange, one accent only


def svg(name, cls='nx-i', size=None, title=None):
    """Inline SVG for a page. aria-hidden unless a title is given."""
    sz = f' width="{size}" height="{size}"' if size else ''
    a11y = f' role="img" aria-label="{title}"' if title else ' aria-hidden="true" focusable="false"'
    return f'<svg class="{cls}" viewBox="0 0 24 24"{sz}{a11y}>{GLYPHS[name]}</svg>'


def standalone(name, color='currentColor'):
    body = GLYPHS[name].replace('currentColor', color)
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">{body}</svg>\n'


def tile_svg(name, px=132, bg=INK, fg='#ffffff', ring='#ffffff', ring_w=0.0, radius=0.27):
    """A square app-style tile as a standalone SVG (for the email PNGs). Optional outer ring keeps a dark tile
    visible when a mail app shows the email on a dark background."""
    pad = ring_w
    inner = 24 - 2 * pad
    r = inner * radius
    glyph = GLYPHS[name].replace('currentColor', fg)
    scale = inner * 0.56 / 24
    off = pad + inner * 0.22
    ring_el = (f'<rect x="0" y="0" width="24" height="24" rx="{r + pad:g}" fill="{ring}"/>' if ring_w else '')
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="{px}" height="{px}">{ring_el}'
            f'<rect x="{pad:g}" y="{pad:g}" width="{inner:g}" height="{inner:g}" rx="{r:g}" fill="{bg}"/>'
            f'<g transform="translate({off:g} {off:g}) scale({scale:g})">{glyph}</g></svg>')


def js_map():
    """The GLYPH object for assets/engage.js (one line of JSON)."""
    return json.dumps(GLYPHS, ensure_ascii=False, separators=(', ', ': '))


def write_files(root):
    d = os.path.join(root, 'assets', 'icons'); os.makedirs(d, exist_ok=True)
    sprite = ['<svg xmlns="http://www.w3.org/2000/svg" style="display:none">']
    for k in GLYPHS:
        open(os.path.join(d, k + '.svg'), 'w', encoding='utf-8').write(standalone(k))
        sprite.append(f'<symbol id="i-{k}" viewBox="0 0 24 24">{GLYPHS[k]}</symbol>')
    sprite.append('</svg>\n')
    open(os.path.join(d, 'nmx-icons.svg'), 'w', encoding='utf-8').write('\n'.join(sprite))
    return len(GLYPHS)


def write_pngs(root):
    import cairosvg
    d = os.path.join(root, 'assets', 'email', 'icons'); os.makedirs(d, exist_ok=True)
    n = 0
    for k, (g, _) in APPS.items():          # 132 x 132 tiles, shown at 44 x 44 in the emails
        cairosvg.svg2png(bytestring=tile_svg(g, ring_w=1.1).encode(), write_to=os.path.join(d, k + '.png'), output_width=132, output_height=132); n += 1
    for k in ('mail', 'chat', 'phone', 'globe', 'location'):   # small orange glyphs for the contact line (shown at 16 x 16)
        cairosvg.svg2png(bytestring=standalone(k, ACCENT).encode(), write_to=os.path.join(d, 'line-' + k + '.png'), output_width=48, output_height=48); n += 1
    return n


if __name__ == '__main__':
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if '--js' in sys.argv: print(js_map())
    if '--files' in sys.argv: print('assets/icons: %d icons' % write_files(root))
    if '--png' in sys.argv: print('assets/email/icons: %d PNGs' % write_pngs(root))
