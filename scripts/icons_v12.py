#!/usr/bin/env python3
"""
NMX Labs v13: one icon set for the website, the emails and any other file, in the style of the reference row
(plain glyphs in one dark ink, no tile or circle behind them, solid shapes with knock-out details and one outline weight).

Colours
  INK    #403d44  the reference ink, on light backgrounds
  LIGHT  #ecebe7  the same glyphs on dark backgrounds (dark theme)
  MAIL   #77737c  emails only: readable on white and in dark-mode mail apps, which can't swap images by theme

Every icon exists as
  assets/icons/<name>.svg             SVG, ink (paths use currentColor, so inline or as a CSS mask it takes any colour)
  assets/icons/light/<name>.svg       SVG, light
  assets/icons/png/<name>.png         PNG 128 x 128, ink
  assets/icons/png/light/<name>.png   PNG 128 x 128, light
  assets/icons/nmx-icons.svg          all of them as one sprite: <svg><use href="/assets/icons/nmx-icons.svg#i-mail"/></svg>
  assets/icons/nxi.css                all of them as classes: <span class="nxi nxi-mail"></span> (SVG, PNG fallback)
  assets/icons/icons.json             names, file paths and which glyph each network uses
  assets/email/icons/                 PNGs for the emails (same file names as before, so the email code is unchanged)

Social networks: the matching monochrome brand mark is used when a file exists in
assets/icons/brand/ (see brand_files below). Then that file is used everywhere instead, in the same ink.

Commands (python scripts/icons_v12.py ...)
  --files   write the SVGs, sprite, nxi.css and icons.json (no packages needed; the site build does this too)
  --png     write the PNGs (needs cairosvg and Pillow; only files whose source changed are rewritten)
  --js      print the three lines for assets/engage.js (I, GLYPH, APPS)
  --sheet   write icon-sheet.html, every icon on a light and a dark background
"""
import hashlib, io, json, os, re, sys

INK, LIGHT, MAIL, ACCENT = '#403d44', '#ecebe7', '#77737c', '#ff5a2b'
W = 2.3          # the one outline weight, like the reference row
PNG_PX = 128     # site PNGs: crisp up to 64 px on retina screens

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


def line(d, w=W):
    return f'<path {S} stroke-width="{w:g}" d="{d}"/>'


def turn(deg, body):
    return f'<g transform="rotate({deg:g} 12 12)">{body}</g>'


GLYPHS = {
    # ---------------------------------------------------------------- social (generic symbols, name shown beside them)
    'camera': fill('M9.1 4.3h5.8a1.3 1.3 0 0 1 1.1.6L17.3 7H6.7l1.3-2.1a1.3 1.3 0 0 1 1.1-.6z') +
              fill(rrect(2.5, 6.6, 19, 14, 4) + circ(12, 13.6, 4.5) + circ(12, 13.6, 2.6) + circ(18, 10.1, 1.05), True),
    'chat': fill('M5.4 16.3 3.7 20.9a.5.5 0 0 0 .66.63l4.9-1.85z') +
            fill(circ(12, 11.6, 9) + circ(8.1, 11.6, 1.3) + circ(12, 11.6, 1.3) + circ(15.9, 11.6, 1.3), True),
    'play': fill(circ(12, 12, 9.6) + 'M10 8.4v7.2c0 .5.5.8.9.55l5.8-3.6a.65.65 0 0 0 0-1.1l-5.8-3.6c-.4-.25-.9.05-.9.55z', True),
    'briefcase': line('M8.9 6.9V5.6a1.8 1.8 0 0 1 1.8-1.8h2.6a1.8 1.8 0 0 1 1.8 1.8v1.3') +
                 fill(rrect(2.5, 6.8, 19, 13.6, 3.2) + 'M2.5 11.9h19v1.5h-19z', True) +
                 fill(rrect(10.2, 10.9, 3.6, 3.5, .9)),
    'pin': fill('M8.3 3.4h7.4a1.1 1.1 0 0 1 .9 1.7l-1.5 2.4v3.2l3 2.9a1.1 1.1 0 0 1-.8 1.9H6.7a1.1 1.1 0 0 1-.8-1.9l3-2.9V7.5L7.4 5.1a1.1 1.1 0 0 1 .9-1.7z') +
           line('M12 15.6v5.4'),
    'at': line(circ(12, 12, 3.7) + 'M15.7 12v1.4a2.7 2.7 0 0 0 5.4 0V12a9.1 9.1 0 1 0-3.6 7.3'),
    'people': fill(circ(9, 8, 3.6)) +
              fill('M2.6 19.6c0-3.7 2.9-6.4 6.4-6.4s6.4 2.7 6.4 6.4a.9.9 0 0 1-.9.9H3.5a.9.9 0 0 1-.9-.9z') +
              fill(circ(16.9, 8.9, 2.8)) +
              fill('M16.2 13.6c3 0 5.2 2.2 5.2 5.4a.9.9 0 0 1-.9.9h-3.3c0-2.5-.8-4.6-2.3-6.1.4-.1.8-.2 1.3-.2z'),
    'bubbles': line(rrect(9, 3.3, 12.4, 9.4, 3.2) + 'M18.6 12.7v2.6l-2.8-2.6') +
               fill(rrect(2.6, 8, 12.6, 9.6, 3.3)) + fill('M5 17.2v3.6a.5.5 0 0 0 .85.36l3.9-3.96z'),
    'plane': fill('M2.9 10.9 20.3 3.7c.7-.3 1.4.4 1.1 1.1l-6.9 16.9c-.3.8-1.4.7-1.6-.1l-1.8-6.3-6.4-2.1c-.8-.3-.9-1.4-.1-1.7z'),
    'feed': fill(circ(6, 18, 2.3)) + line('M4.2 11.2a8.6 8.6 0 0 1 8.6 8.6M4.2 4.6a15.2 15.2 0 0 1 15.2 15.2', 2.5),
    'mail': fill(rrect(2.5, 4.8, 19, 14.6, 3.2) + 'M5 7.6 12 12.4l7-4.8v2.6L12 15l-7-4.8z', True),
    'phone': fill('M6.4 3.3c.8-.5 1.8-.2 2.3.6l1.6 2.8c.4.8.3 1.7-.4 2.3l-1.3 1.1c.9 2 2.6 3.8 4.6 4.7l1.1-1.3c.6-.7 1.5-.8 2.3-.4l2.8 1.6c.8.5 1.1 1.5.6 2.3l-.8 1.5c-.7 1.2-2.1 1.9-3.5 1.5C10 18.5 5.5 14 4 8.2c-.4-1.4.3-2.8 1.5-3.5z'),
    'mobile': fill(rrect(5.8, 2, 12.4, 20, 3.2) + rrect(10, 17.6, 4, 1.5, .75) + circ(12, 5, .9), True),
    'globe': line(circ(12, 12, 9) + 'M3 12h18M12 3c2.6 2.4 3.9 5.4 3.9 9s-1.3 6.6-3.9 9c-2.6-2.4-3.9-5.4-3.9-9S9.4 5.4 12 3z'),
    # ---------------------------------------------------------------- actions
    'link': line('M10 14a4 4 0 0 0 5.7 0l3.2-3.2a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3.2 3.2a4 4 0 0 0 5.7 5.7l1-1'),
    'copy': line(rrect(8.6, 2.8, 12.6, 12.6, 3)) + fill(rrect(2.8, 8.6, 12.6, 12.6, 3)),
    'share': line('M12 3.4v11M8 7.3l4-3.9 4 3.9M8.6 10.2H7.2a2.6 2.6 0 0 0-2.6 2.6v5.6a2.6 2.6 0 0 0 2.6 2.6h9.6a2.6 2.6 0 0 0 2.6-2.6v-5.6a2.6 2.6 0 0 0-2.6-2.6h-1.4'),
    'save': fill('M6.3 3h11.4A1.8 1.8 0 0 1 19.5 4.8v15.6c0 .7-.8 1.1-1.4.7L12 16.7l-6.1 4.4c-.6.4-1.4 0-1.4-.7V4.8A1.8 1.8 0 0 1 6.3 3z'),
    'saved': fill('M6.3 3h11.4A1.8 1.8 0 0 1 19.5 4.8v15.6c0 .7-.8 1.1-1.4.7L12 16.7l-6.1 4.4c-.6.4-1.4 0-1.4-.7V4.8A1.8 1.8 0 0 1 6.3 3z'
                  'M8.3 9.5l1.2-1.2 1.6 1.6 3.4-3.4 1.2 1.2-4.6 4.6z', True),
    'heart': fill('M12 20.4c-.3 0-.6-.1-.8-.3C6.3 16 3 13 3 9.2 3 6.5 5.1 4.3 7.8 4.3c1.7 0 3.2.9 4.2 2.2 1-1.3 2.5-2.2 4.2-2.2C18.9 4.3 21 6.5 21 9.2c0 3.8-3.3 6.8-8.2 10.9-.2.2-.5.3-.8.3z'),
    'comment': fill('M6.6 16.4v4.2a.5.5 0 0 0 .84.37l4.9-4.57z') +
               fill(rrect(2.6, 3.6, 18.8, 13.6, 3.6) + rrect(6.6, 7.6, 10.8, 1.7, .85) + rrect(6.6, 11.3, 6.6, 1.7, .85), True),
    'print': fill(rrect(6.6, 2.8, 10.8, 4.4, 1.2)) +
             fill('M5.3 8.2h13.4a2.8 2.8 0 0 1 2.8 2.8v4a2.8 2.8 0 0 1-2.8 2.8h-.3V13H5.6v4.8h-.3a2.8 2.8 0 0 1-2.8-2.8v-4a2.8 2.8 0 0 1 2.8-2.8z' + circ(17.6, 10.6, 1), True) +
             fill(rrect(7.2, 14.4, 9.6, 6.8, 1.2)),
    'download': line('M12 3.4v11.2M7.6 10.4l4.4 4.4 4.4-4.4M4.4 15.6v2.6a2.6 2.6 0 0 0 2.6 2.6h10a2.6 2.6 0 0 0 2.6-2.6v-2.6'),
    'more': fill(circ(5.4, 12, 2.1) + circ(12, 12, 2.1) + circ(18.6, 12, 2.1)),
    'bell': fill('M12 2.8c-3.4 0-6.1 2.7-6.1 6.2v4.2l-1.7 2.6c-.4.7.1 1.6.9 1.6h13.8c.8 0 1.3-.9.9-1.6l-1.7-2.6V9c0-3.5-2.7-6.2-6.1-6.2z') +
            fill('M9.4 18.6h5.2a2.6 2.6 0 0 1-5.2 0z'),
    'bellOff': line('M7 17.6H5.1c-.8 0-1.3-.9-.9-1.6l1.7-2.6V9c0-1.2.3-2.3.9-3.2M9.2 3.6A6 6 0 0 1 18.1 9v4.2l1.3 2') +
               fill('M9.4 18.6h5.2a2.6 2.6 0 0 1-5.2 0z') + line('M3.6 3.6l16.8 16.8'),
    'send': fill('M3.4 4.2c-.2-.9.7-1.6 1.5-1.2l16 8c.8.4.8 1.6 0 2l-16 8c-.8.4-1.7-.3-1.5-1.2L5 13.1l7.6-1.1L5 10.9z'),
    'close': line('M6 6l12 12M18 6 6 18', 2.5),
    'check': line('M4.8 12.6l4.6 4.6L19.2 7.4', 2.5),
    'search': line(circ(10.6, 10.6, 6.6)) + line('M15.6 15.6 20.6 20.6', 2.6),
    'calendar': line('M8 2.8v3.6M16 2.8v3.6') +
                fill(rrect(3, 5, 18, 16.2, 3.4) + 'M3 9.6h18V11H3z' + circ(8, 14.4, 1.2) + circ(12, 14.4, 1.2) +
                     circ(16, 14.4, 1.2) + circ(8, 17.8, 1.2) + circ(12, 17.8, 1.2), True),
    'location': fill('M12 2.4c-4.1 0-7.4 3.2-7.4 7.3 0 5.1 5.9 10.9 6.6 11.5.4.4 1.1.4 1.5 0 .7-.6 6.6-6.4 6.6-11.5 0-4.1-3.2-7.3-7.3-7.3z' + circ(12, 9.8, 2.8), True),
    'user': fill(circ(12, 7.6, 4.2)) + fill('M4.2 19.8c0-4 3.5-6.8 7.8-6.8s7.8 2.8 7.8 6.8a1 1 0 0 1-1 1H5.2a1 1 0 0 1-1-1z'),
    # ---------------------------------------------------------------- player and reading tools
    'playSm': fill('M7.4 5.2v13.6c0 .8.9 1.3 1.6.9l10.7-6.8c.6-.4.6-1.3 0-1.7L9 4.3c-.7-.4-1.6.1-1.6.9z'),
    'pause': fill(rrect(6.2, 4.8, 4, 14.4, 1.5) + rrect(13.8, 4.8, 4, 14.4, 1.5)),
    'headphones': line('M4.4 15.5V12a7.6 7.6 0 0 1 15.2 0v3.5') + fill(rrect(2.8, 13.2, 5, 8, 2) + rrect(16.2, 13.2, 5, 8, 2)),
    'sparkle': fill('M11 2.6c.5 4.2 2.8 6.6 7 7-4.2.5-6.5 2.8-7 7-.4-4.2-2.8-6.5-7-7 4.2-.4 6.6-2.8 7-7z'
                    'M18.2 14.2c.2 1.8 1.2 2.8 3 3-1.8.2-2.8 1.2-3 3-.2-1.8-1.2-2.8-3-3 1.8-.2 2.8-1.2 3-3z'),
    'list': line('M5 6.5h14M5 12h14M5 17.5h8.6'),
    'arrow': line('M4.5 12h15M13.5 6l6 6-6 6'),
    'chevL': line('M15 5l-7 7 7 7', 2.5),
    'chevR': line('M9 5l7 7-7 7', 2.5),
    'sun': fill(circ(12, 12, 4.4)) + line('M12 2.4v2.2M12 19.4v2.2M5.2 5.2l1.6 1.6M17.2 17.2l1.6 1.6M2.4 12h2.2M19.4 12h2.2M5.2 18.8l1.6-1.6M17.2 6.8l1.6-1.6'),
    'moon': fill('M20.6 14.6A8.6 8.6 0 0 1 9.4 3.4a8.6 8.6 0 1 0 11.2 11.2z'),
    # ---------------------------------------------------------------- v12: editing and file icons (Content Blog Creator, and free to use on the site)
    'plus': line('M12 4.6v14.8M4.6 12h14.8', 2.5),
    'pencil': turn(45, fill(rrect(9.4, 1.9, 5.2, 3.6, 1.3)) + fill('M10.4 6.9h3.2a1 1 0 0 1 1 1v8.6l-2.6 5.4-2.6-5.4V7.9a1 1 0 0 1 1-1z')),
    'newspaper': fill(rrect(2.6, 3.6, 18.8, 16.8, 3.4) + rrect(6.2, 7.2, 11.6, 3.6, 1) + rrect(6.2, 12.6, 11.6, 1.7, .85) +
                      rrect(6.2, 16, 7.4, 1.7, .85), True),
    'video': fill(rrect(2.4, 6.2, 13.6, 11.6, 3)) + fill('M17.1 10.4l3.8-2.5c.5-.3 1.1 0 1.1.6v7c0 .6-.6.9-1.1.6l-3.8-2.5z'),
    'layout': fill(rrect(2.6, 4.4, 8, 15.2, 2.4)) + fill(rrect(12.6, 4.4, 8.8, 6.6, 2.4)) + fill(rrect(12.6, 13, 8.8, 6.6, 2.4)),
    'folder': fill('M4.8 4.2h4.3c.6 0 1.2.2 1.6.7l1.5 1.7h6.9a2.8 2.8 0 0 1 2.8 2.8v8.6a2.8 2.8 0 0 1-2.8 2.8H4.8A2.8 2.8 0 0 1 2 18V7a2.8 2.8 0 0 1 2.8-2.8z'),
    'arrowUp': line('M12 19.5v-15M6 10.5l6-6 6 6'),
    'arrowDown': line('M12 4.5v15M6 13.5l6 6 6-6'),
    'trash': fill(rrect(3.6, 4.8, 16.8, 2.6, 1.3)) + fill('M9.6 2.4h4.8a1.2 1.2 0 0 1 1.2 1.2v.6H8.4v-.6a1.2 1.2 0 0 1 1.2-1.2z') +
             fill('M5.4 8.8h13.2l-1 10.7a2.2 2.2 0 0 1-2.2 2H8.6a2.2 2.2 0 0 1-2.2-2z' + rrect(9.2, 11.4, 1.7, 7, .85) + rrect(13.1, 11.4, 1.7, 7, .85), True),
    'chevDown': line('M5 9l7 7 7-7', 2.5),
}

# network / action key -> (glyph, label). Keys match the ones engage.js, the emails and the build already use.
NETWORKS = {
    'instagram': ('camera', 'Instagram'), 'whatsapp': ('chat', 'WhatsApp'), 'youtube': ('play', 'YouTube'),
    'linkedin': ('briefcase', 'LinkedIn'), 'pinterest': ('pin', 'Pinterest'), 'x': ('at', 'X'),
    'facebook': ('people', 'Facebook'), 'threads': ('bubbles', 'Threads'), 'telegram': ('plane', 'Telegram'),
    'twitter': ('at', 'Twitter'),
    'google': ('search', 'Google'),
    'email': ('mail', 'Email'), 'phone': ('phone', 'Phone'), 'rss': ('feed', 'RSS feed'), 'website': ('globe', 'Website'),
    'copy': ('link', 'Copy link'), 'more': ('more', 'More'), 'share': ('share', 'Share'), 'save': ('save', 'Save'),
    'like': ('heart', 'Like'), 'comment': ('comment', 'Comment'), 'print': ('print', 'Print'), 'download': ('download', 'Download'),
    'send': ('send', 'Send'), 'link': ('link', 'Link'), 'calendar': ('calendar', 'Book'),
}
APPS = NETWORKS                     # the v11 name, kept for anything that imports it
SOCIAL = ('instagram', 'whatsapp', 'youtube', 'linkedin', 'pinterest', 'x', 'twitter', 'facebook', 'threads', 'telegram', 'google')

# the small icons engage.js keeps under its own names
ENGAGE_I = {'bell': 'bell', 'bellOff': 'bellOff', 'chat': 'comment', 'x': 'close', 'send': 'send', 'mark': 'save',
            'marked': 'saved', 'check': 'check', 'phone': 'mobile'}

EMAIL_LINE = ('mail', 'chat', 'phone', 'globe', 'location')   # assets/email/icons/line-<name>.png, shown at 14 x 14


# ------------------------------------------------------------------ markup
def svg(name, cls='nx-i', size='1em', title=None):
    """Inline SVG for a page. The width/height attributes are only a fallback; CSS sizes it."""
    sz = f' width="{size}" height="{size}"' if size else ''
    a11y = f' role="img" aria-label="{title}"' if title else ' aria-hidden="true" focusable="false"'
    return f'<svg class="{cls}" data-i="{name}" viewBox="0 0 24 24"{sz}{a11y}>{GLYPHS[name]}</svg>'


def standalone(name, color=INK, px=24):
    """One icon as an SVG file. Paths use currentColor and the root sets the colour, so the file shows in `color`
    in an <img>, and takes the page's colour when used inline or as a CSS mask."""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="{px}" height="{px}" color="{color}">'
            f'{GLYPHS[name]}</svg>\n')


def solid(name, color, px, scale=1.0):
    """For rasterising: currentColor replaced by the colour, glyph scaled about the centre (scale < 1 adds padding)."""
    body = GLYPHS[name].replace('currentColor', color)
    if scale != 1.0:
        off = 12 * (1 - scale)
        body = f'<g transform="translate({off:g} {off:g}) scale({scale:g})">{body}</g>'
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="{px}" height="{px}">{body}</svg>'


def sprite():
    out = ['<svg xmlns="http://www.w3.org/2000/svg" style="display:none">']
    out += [f'<symbol id="i-{k}" viewBox="0 0 24 24">{GLYPHS[k]}</symbol>' for k in GLYPHS]
    return '\n'.join(out + ['</svg>']) + '\n'


def js_lines():
    """The I, GLYPH and APPS lines for assets/engage.js."""
    I = {k: '<svg class="nx-f" data-i="' + g + '" viewBox="0 0 24 24" aria-hidden="true">' + GLYPHS[g] + '</svg>' for k, g in ENGAGE_I.items()}
    apps = {k: [g, '', '', '', lab] for k, (g, lab) in NETWORKS.items()}
    j = lambda o: json.dumps(o, ensure_ascii=False, separators=(', ', ': '))
    return '  var I = ' + j(I) + ';', '  var GLYPH = ' + j(GLYPHS) + ';', '  var APPS = ' + j(apps) + ';'


# ------------------------------------------------------------------ brand files (optional)
BRAND_DIR = os.path.join('assets', 'icons', 'brand')


def brand_files(root):
    """Official logo files you added yourself, from each network's own brand or press page.
         assets/icons/brand/linkedin.svg          shown in the site's ink, like every other icon (use the single-colour file)
         assets/icons/brand/google-colour.svg     shown in its own colours (for logos whose rules don't allow recolouring)
       Names are the network keys: instagram, whatsapp, youtube, linkedin, pinterest, x, facebook, threads, telegram, google.
       Returns {network: 'mono' | 'colour'}."""
    d = os.path.join(root, BRAND_DIR)
    found = {}
    if not os.path.isdir(d): return found
    for f in sorted(os.listdir(d)):
        m = re.fullmatch(r'([a-z]+)(-colou?r)?\.svg', f)
        if not m or m.group(1) not in SOCIAL: continue
        if m.group(2): found.setdefault(m.group(1), 'colour')
        else: found[m.group(1)] = 'mono'            # the single-colour file wins if both are there
    return found


def brand_url(net, mode):
    return '/assets/icons/brand/' + net + ('-colour' if mode == 'colour' else '') + '.svg'


def brand_markup(net, mode, cls='nx-i'):
    """A brand file on a page: masked with the text colour ('mono'), or as it is ('colour')."""
    if mode == 'colour':
        return f'<img class="{cls} nx-logo-img" data-i="brand:{net}" src="{brand_url(net, mode)}" alt="" width="16" height="16">'
    return f'<span class="{cls} nx-logo" data-i="brand:{net}" style="--logo:url({brand_url(net, mode)});--logo-png:url(/assets/icons/png/brand/{net}.png);--logo-png-light:url(/assets/icons/png/brand/light/{net}.png)" aria-hidden="true"></span>'


def icon(net_or_glyph, brands=None, cls='nx-i'):
    """Markup for a network key (brand file if there is one, else its glyph) or a glyph name."""
    brands = brands or {}
    if net_or_glyph in brands: return brand_markup(net_or_glyph, brands[net_or_glyph], cls)
    g = NETWORKS[net_or_glyph][0] if net_or_glyph in NETWORKS and net_or_glyph not in GLYPHS else net_or_glyph
    return svg(g, cls)


# ------------------------------------------------------------------ CSS classes and manifest
def nxi_css(brands=None):
    brands = brands or {}
    out = ['/* NMX Labs icons as classes: <span class="nxi nxi-mail" aria-hidden="true"></span>, or nxi-<network> (nxi-linkedin).',
           '   Modern browsers draw the SVG as a mask in the text colour, so it follows the light and dark themes;',
           '   browsers without CSS masks show the PNG (ink, or light in the dark theme). Size it with font-size or width/height. */',
           '.nxi{display:inline-block;width:1em;height:1em;flex:none;vertical-align:-.15em;background:var(--nxp) center/contain no-repeat}',
           ':root[data-theme="dark"] .nxi{--nxp:var(--nxpl)}',
           '@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) .nxi{--nxp:var(--nxpl)}}',
           '@supports ((-webkit-mask-image:none) or (mask-image:none)){.nxi{background:currentColor;'
           '-webkit-mask:var(--nxi) center/contain no-repeat;mask:var(--nxi) center/contain no-repeat}}',
           '.nxi.nxi--colour{background:var(--nxp) center/contain no-repeat;-webkit-mask:none;mask:none}']
    for k in GLYPHS:
        out.append(f'.nxi-{k}{{--nxi:url(/assets/icons/{k}.svg);--nxp:url(/assets/icons/png/{k}.png);--nxpl:url(/assets/icons/png/light/{k}.png)}}')
    for net, (g, _) in NETWORKS.items():
        if net in GLYPHS: continue
        if net in brands:
            u = brand_url(net, brands[net])
            if brands[net] == 'colour':
                out.append(f'.nxi-{net}{{--nxi:url({u});--nxp:url({u});--nxpl:url({u});background:var(--nxp) center/contain no-repeat;-webkit-mask:none;mask:none}}')
            else:
                out.append(f'.nxi-{net}{{--nxi:url({u});--nxp:url(/assets/icons/png/brand/{net}.png);--nxpl:url(/assets/icons/png/brand/light/{net}.png)}}')
        else:
            out.append(f'.nxi-{net}{{--nxi:url(/assets/icons/{g}.svg);--nxp:url(/assets/icons/png/{g}.png);--nxpl:url(/assets/icons/png/light/{g}.png)}}')
    return '\n'.join(out) + '\n'


def manifest(brands=None):
    brands = brands or {}
    icons = {k: {'svg': f'/assets/icons/{k}.svg', 'svg_light': f'/assets/icons/light/{k}.svg',
                 'png': f'/assets/icons/png/{k}.png', 'png_light': f'/assets/icons/png/light/{k}.png'} for k in GLYPHS}
    nets = {}
    for net, (g, label) in NETWORKS.items():
        e = {'label': label, 'glyph': g}
        if net in brands:
            e['brand'] = {'mode': brands[net], 'svg': brand_url(net, brands[net]),
                          'png': f'/assets/icons/png/brand/{net}.png'}
            if brands[net] == 'mono': e['brand']['png_light'] = f'/assets/icons/png/brand/light/{net}.png'
        nets[net] = e
    return json.dumps({'version': 13, 'ink': INK, 'light': LIGHT, 'email': MAIL, 'png_size': PNG_PX,
                       'icons': icons, 'networks': nets}, indent=1, ensure_ascii=False) + '\n'


def text_files(root):
    """Every text file of the set: [(relative path, content)]. Pure Python, the site build writes these on each run."""
    brands = brand_files(root)
    out = []
    for k in GLYPHS:
        out.append((f'assets/icons/{k}.svg', standalone(k, INK)))
        out.append((f'assets/icons/light/{k}.svg', standalone(k, LIGHT)))
    out += [('assets/icons/nmx-icons.svg', sprite()), ('assets/icons/nxi.css', nxi_css(brands)),
            ('assets/icons/icons.json', manifest(brands))]
    return out


# ------------------------------------------------------------------ PNGs
LEDGER = os.path.join('scripts', 'icon-renders.json')    # what each PNG was made from, so unchanged ones aren't rewritten


def png_jobs(root):
    """[(relative path, kind, source, size)]: kind 'svg' renders the source, 'brand' recolours an official file."""
    jobs = []
    for k in GLYPHS:
        jobs.append((f'assets/icons/png/{k}.png', 'svg', solid(k, INK, PNG_PX), PNG_PX))
        jobs.append((f'assets/icons/png/light/{k}.png', 'svg', solid(k, LIGHT, PNG_PX), PNG_PX))
    brands = brand_files(root)
    for net, mode in brands.items():
        path = os.path.join(root, BRAND_DIR, net + ('-colour' if mode == 'colour' else '') + '.svg')
        src = open(path, encoding='utf-8', errors='replace').read()
        if mode == 'colour':
            jobs.append((f'assets/icons/png/brand/{net}.png', 'brand:colour:0.84', src, PNG_PX))
        else:
            jobs.append((f'assets/icons/png/brand/{net}.png', 'brand:' + INK + ':0.84', src, PNG_PX))
            jobs.append((f'assets/icons/png/brand/light/{net}.png', 'brand:' + LIGHT + ':0.84', src, PNG_PX))
    # emails: 132 x 132, shown at 44 x 44; the glyph fills 60%, no tile
    for net, (g, _) in NETWORKS.items():
        if net in brands:
            path = os.path.join(root, BRAND_DIR, net + ('-colour' if brands[net] == 'colour' else '') + '.svg')
            src = open(path, encoding='utf-8', errors='replace').read()
            jobs.append((f'assets/email/icons/{net}.png', 'brand:' + ('colour' if brands[net] == 'colour' else MAIL) + ':0.58', src, 132))
        else:
            jobs.append((f'assets/email/icons/{net}.png', 'svg', solid(g, MAIL, 132, 0.6), 132))
    for g in EMAIL_LINE:                      # contact line in the emails
        jobs.append((f'assets/email/icons/line-{g}.png', 'svg', solid(g, MAIL, 48), 48))
    return jobs


def _key(kind, src, px):
    return hashlib.sha1(f'v13|{kind}|{px}|{src}'.encode('utf-8')).hexdigest()


def _recolour_fit(png_bytes, px, colour, frac):
    """Centre an official logo in a px square at `frac` of its size, recoloured to one colour unless colour == 'colour'."""
    from PIL import Image
    im = Image.open(io.BytesIO(png_bytes)).convert('RGBA')
    bbox = im.getchannel('A').getbbox()
    if bbox: im = im.crop(bbox)
    box = max(1, round(px * frac))
    r = min(box / im.width, box / im.height)
    im = im.resize((max(1, round(im.width * r)), max(1, round(im.height * r))), Image.LANCZOS)
    if colour != 'colour':
        rgb = tuple(int(colour[i:i + 2], 16) for i in (1, 3, 5))
        solid_im = Image.new('RGBA', im.size, rgb + (0,))
        solid_im.putalpha(im.getchannel('A'))
        im = solid_im
    canvas = Image.new('RGBA', (px, px), (0, 0, 0, 0))
    canvas.paste(im, ((px - im.width) // 2, (px - im.height) // 2), im)
    buf = io.BytesIO(); canvas.save(buf, 'PNG', optimize=True)
    return buf.getvalue()


def render_pngs(root, force=False):
    """Writes the PNGs whose source changed. Returns (written paths, note). Needs cairosvg and Pillow."""
    try:
        import cairosvg
        from PIL import Image  # noqa: F401
    except Exception as e:
        return [], 'PNG step skipped (cairosvg/Pillow not available: %s); the PNGs already on the site stay as they are' % str(e).split('\n')[0]
    lp = os.path.join(root, LEDGER)
    try: ledger = json.load(open(lp, encoding='utf-8'))
    except Exception: ledger = {}
    jobs = png_jobs(root)
    wanted = {p for p, *_ in jobs}
    written = []
    for rel, kind, src, px in jobs:
        key = _key(kind, src, px)
        full = os.path.join(root, rel)
        if not force and ledger.get(rel) == key and os.path.exists(full): continue
        if kind == 'svg':
            data = cairosvg.svg2png(bytestring=src.encode('utf-8'), output_width=px, output_height=px)
        else:
            _, colour, frac = kind.split(':')
            raw = cairosvg.svg2png(bytestring=src.encode('utf-8'), output_width=px * 4)
            data = _recolour_fit(raw, px, colour, float(frac))
        os.makedirs(os.path.dirname(full), exist_ok=True)
        if not os.path.exists(full) or open(full, 'rb').read() != data:
            open(full, 'wb').write(data); written.append(rel)
        ledger[rel] = key
    # a brand file that was removed: drop its PNGs (the email PNG is re-rendered from the glyph above)
    bdir = os.path.join(root, 'assets', 'icons', 'png', 'brand')
    for dirpath, _, files in os.walk(bdir):
        for f in files:
            rel = os.path.relpath(os.path.join(dirpath, f), root).replace('\\', '/')
            if f.endswith('.png') and rel not in wanted:
                os.remove(os.path.join(dirpath, f)); ledger.pop(rel, None); written.append(rel)
    new_ledger = json.dumps(dict(sorted(ledger.items())), indent=0) + '\n'
    if not os.path.exists(lp) or open(lp, encoding='utf-8').read() != new_ledger:
        os.makedirs(os.path.dirname(lp), exist_ok=True)
        open(lp, 'w', encoding='utf-8').write(new_ledger); written.append(LEDGER.replace('\\', '/'))
    return written, ''


# ------------------------------------------------------------------ preview sheet
def sheet_html():
    cells = ''.join(f'<figure>{svg(k, "s", None)}<figcaption>{k}</figcaption></figure>' for k in GLYPHS)
    css = ('body{margin:0;font:12px/1.3 Inter,system-ui,sans-serif}section{display:grid;grid-template-columns:repeat(11,1fr);'
           'gap:18px 8px;padding:26px 20px}figure{margin:0;display:grid;justify-items:center;gap:8px}svg.s{width:30px;height:30px}'
           '.l{background:#f6f5f2;color:' + INK + '}.d{background:#1b1b1d;color:' + LIGHT + '}figcaption{opacity:.6}')
    return f'<!doctype html><meta charset="utf-8"><style>{css}</style><section class="l">{cells}</section><section class="d">{cells}</section>'


if __name__ == '__main__':
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if '--js' in sys.argv: print('\n'.join(js_lines()))
    if '--files' in sys.argv:
        n = 0
        for rel, s in text_files(root):
            full = os.path.join(root, rel); os.makedirs(os.path.dirname(full), exist_ok=True)
            if not os.path.exists(full) or open(full, encoding='utf-8').read() != s:
                open(full, 'w', encoding='utf-8').write(s); n += 1
        print('icon text files: %d written, %d glyphs' % (n, len(GLYPHS)))
    if '--png' in sys.argv:
        w, note = render_pngs(root, force='--force' in sys.argv)
        print(note or 'PNGs: %d written' % len(w))
    if '--sheet' in sys.argv:
        open(os.path.join(root, 'icon-sheet.html'), 'w', encoding='utf-8').write(sheet_html()); print('icon-sheet.html')
