/* NMX Labs v11.1: email tiles from the official brand files.
   For every assets/icons/brands/<name>.svg (the network's own single-colour logo, saved by you), makes
   assets/email/icons/<name>.png: the same flat slate tile as the other email icons, with the logo knocked out in white
   (the file's own colours are ignored, only its shape is used), plus the thin light edge for dark-mode mail apps.
   Run by .github/workflows/publish-scheduled.yml when the brands folder has files. By hand:
     npm install --prefix /tmp/sharp sharp@0.33.5 && SHARP_DIR=/tmp/sharp node scripts/brand-icons.cjs */
'use strict';
const fs = require('fs'), path = require('path');
const sharp = require(path.join(process.env.SHARP_DIR || '.', 'node_modules', 'sharp'));
const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'assets', 'icons', 'brands'), OUT = path.join(ROOT, 'assets', 'email', 'icons');
const SIZE = 132, GLYPH = 70, INK = '#383b47';
const KEYS = ['instagram', 'whatsapp', 'linkedin', 'pinterest', 'facebook', 'youtube', 'x', 'threads', 'telegram', 'google'];

// Same proportions as scripts/icons_v11.py tile_svg(ring_w=1.1): 24-unit grid, white ring, slate square.
const ring = 1.1, inner = 24 - 2 * ring, r = inner * 0.27;
const tileSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${SIZE}" height="${SIZE}">` +
  `<rect width="24" height="24" rx="${r + ring}" fill="#ffffff"/><rect x="${ring}" y="${ring}" width="${inner}" height="${inner}" rx="${r}" fill="${INK}"/></svg>`;

async function one(key) {
  const file = path.join(SRC, key + '.svg');
  const alpha = await sharp(fs.readFileSync(file), { density: 600 })
    .resize(GLYPH, GLYPH, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha().extractChannel(3).raw().toBuffer();
  const white = await sharp({ create: { width: GLYPH, height: GLYPH, channels: 3, background: '#ffffff' } })
    .joinChannel(alpha, { raw: { width: GLYPH, height: GLYPH, channels: 1 } }).png().toBuffer();
  const off = Math.round((SIZE - GLYPH) / 2);
  await sharp(Buffer.from(tileSvg)).composite([{ input: white, left: off, top: off }]).png().toFile(path.join(OUT, key + '.png'));
  return key;
}

(async () => {
  if (!fs.existsSync(SRC)) { console.log('No assets/icons/brands/ folder: nothing to do.'); return; }
  const keys = KEYS.filter((k) => fs.existsSync(path.join(SRC, k + '.svg')));
  const other = fs.readdirSync(SRC).filter((f) => f.endsWith('.svg') && KEYS.indexOf(f.slice(0, -4)) < 0);
  if (other.length) console.log('::warning title=Brand icons::Not used (rename to one of ' + KEYS.join(', ') + '): ' + other.join(', '));
  for (const k of keys) { try { console.log('assets/email/icons/' + (await one(k)) + '.png'); } catch (e) { console.log('::warning title=Brand icons::' + k + '.svg could not be read: ' + e.message); } }
  if (!keys.length) console.log('No brand files yet.');
})();
