# labsnmx.com

Three pages, one shared design system.

```
/
├── index.html              homepage (your original + a parallax layer)
├── clients/
│   └── index.html          Selected Work — the 3D scroll flight
├── privacy-policy.html     your privacy policy
├── assets/
│   ├── nmx-logo.png
│   └── projects/           imagery, 40-frame sequence, film
├── sitemap.xml   robots.txt   CNAME   .nojekyll
```

| URL | File |
|---|---|
| `labsnmx.com/` | `index.html` |
| `labsnmx.com/clients` | `clients/index.html` |
| `labsnmx.com/privacy-policy.html` | `privacy-policy.html` |

## Deploy on GitHub Pages

1. Push this folder to your repo.
2. Settings → Pages → deploy from `main`, folder `/ (root)`.
3. Point `labsnmx.com` DNS at GitHub Pages. `CNAME` is already in place.

`.nojekyll` stops GitHub stripping anything. No build step, no npm, no framework.

### Links rewired for you

- Homepage: 3 × `#clients` → `/clients`
- Privacy policy: `index.html#clients` → `/clients`, and `index.html#section` → `/#section` so they resolve from the policy URL
- Clients page footer: added a Privacy link, so all three pages reach each other

Canonicals are `/`, `/clients` and `/privacy-policy.html`. All three are in `sitemap.xml`.

---

## Homepage parallax

Your original file, untouched, with two blocks appended: `<style id="px-redesign">` before `</head>` and `<script id="px-engine">` before `</body>`. Delete those two and you're back to the original exactly.

**It uses only the visuals already on your page.** No portfolio imagery is placed on the homepage.

| Element | Motion |
|---|---|
| Brand mark | Drifts slowly, the deepest type plane |
| Headline | Its two lines move at different rates — the depth cue |
| Headline block | Sinks back in Z and fades as you leave the hero |
| Existing glow | Scales and falls away behind everything |
| Clients strip | Drifts against the scroll |
| Services stack | Arrives from depth, tilting flat as it settles |
| About | An oversized `NMX` drifts behind the text, slowest of all |
| Headings, cells, FAQ, form | Staggered rise with a hairline that draws itself in |

### Why it can't break your existing code

Several elements already own their `transform`: `.sub`, `.ctas` and `.logo-img` through `forwards` CSS animations, `h1 .word` through the `rise` animation, every `.card` through your dock-magnify script, and `.marquee-track` through the marquee. **The engine never writes to any of them** — it moves their parents instead, so both effects compose. This is verified by an automated guard test, not by eye.

Desktop-only above 860px; your mobile carousel is untouched. Reduced motion removes the drifting mark and reveals everything instantly.

---

## Clients page — device modes

The flight is not one layout scaled down. Each breakpoint gets its own card count, geometry, depth and pacing, set in the `MODES` table.

| | Phone (<768) | Tablet (768–1023) | Desktop (1024+) |
|---|---|---|---|
| Cards per chapter | 4 | 6 | up to 9 |
| Hero card size | 74vmin | 46vmin | 33vmin |
| Depth between chapters | 1150 | 1350 | 1500 |
| Scroll per chapter | 112vh | 124vh | 135vh |
| Perspective | 760px | 900px | 1000px |
| Distance blur | off | on | on |
| Progress shown as | dots | dots | depth rail |

**Phone specifics:** the composition sits in the upper half with a scrim beneath so type never competes with imagery; blur is off (most expensive effect on mobile GPUs); the sequence loads 20 frames instead of 40; the film plays in view rather than scrubbing; captions are always visible; `env(safe-area-inset-bottom)` is respected.

Cards 2 and 4 are the frame sequence and the film, so every mode's `order` includes both. Rotating re-lays the field automatically.

### Adding a project

Edit the `CHAPTERS` array — the only block you touch.

```js
{
  id:'newclient',
  brand:'New Client',
  eyebrow:'08 / Brand identity · Packaging',
  hook:'Their line.<br><em>Our system.</em>',   // <em> turns orange
  sub:'Two sentences on the problem, not the deliverables.',
  facts:[['Client','New Client Ltd'],['Scope','Identity'],['Year','2026']],
  images:['newclient_01','newclient_02'],       // 1 image or 6, both fine
  density:8                                     // cards on desktop, max 9
}
```

Drop the files in `assets/projects/newclient/`, then register them in `ASSETS` at the top:

```js
newclient_01:'../assets/projects/newclient/01.webp',
```

The `../` matters — the page lives in `/clients/`. Images cycle across the slots, so one image still fills the screen. Chapter list, index and progress dots all update themselves.

**Image prep:** square-ish, 1200 px long edge, WebP quality 80 — about 40 KB each.

## Type and colour

Both pages share one system, taken from your original CSS:

| Token | Value | Use |
|---|---|---|
| `--bg` | `#faf9f6` | paper |
| `--ink` | `#111110` | body and headlines |
| `--navy` | `#000F52` | the logo mark |
| `--muted` | `#8c8a84` | metadata |
| `--orange` | `#ff5a2b` | accent, one job only |

**Liliana** is embedded as base64 in both pages, so headlines match with no extra file to upload.

## Before you launch

- Replace the placeholder Behance and LinkedIn URLs in the clients footer.
- Make `og-clients.png` (1200×630) for the social preview.
