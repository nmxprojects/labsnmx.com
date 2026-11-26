/* NMX Labs v11.1: email tiles from the official brand files.
   For every assets/icons/brands/<name>.svg (the network's own single-colour logo, saved by you), makes
   assets/email/icons/<name>.png: a bare flat glyph like the other email icons, the logo's shape in slate (its own colours
   are ignored) with a thin white edge for dark-mode mail apps.
   Run by .github/workflows/publish-scheduled.yml when the brands folder has files. By hand:
     npm install --prefix /tmp/sharp sharp@0.33.5 && SHARP_DIR=/tmp/sharp node scripts/brand-icons.cjs */
'use strict';
const fs = require('fs'), path = require('path');
const sharp = require(path.join(process.env.SHARP_DIR || '.', 'node_modules', 'sharp'));
const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'assets', 'icons', 'brands'), OUT = path.join(ROOT, 'assets', 'email', 'icons');
const SIZE = 84, GLYPH = 66, INK = { r: 0x38, g: 0x3b, b: 0x47 };
const KEYS = ['instagram', 'whatsapp', 'linkedin', 'pinterest', 'facebook', 'youtube', 'x', 'threads', 'telegram', 'google'];

// v11.2: a bare flat glyph like the other email icons (no tile): the logo's shape in slate, with a thin white edge so it
// stays visible in dark-mode mail apps. The file's own colours are ignored; only its shape is used.
async function one(key) {
  const file = path.join(SRC, key + '.svg');
  const off = Math.round((SIZE - GLYPH) / 2);
  const shape = await sharp(fs.readFileSync(file), { density: 600 })
    .resize(GLYPH, GLYPH, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({ top: off, bottom: SIZE - GLYPH - off, left: off, right: SIZE - GLYPH - off, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha().extractChannel(3).raw().toBuffer();
  const edge = await sharp(shape, { raw: { width: SIZE, height: SIZE, channels: 1 } }).blur(2.2).linear(6, 0).extractChannel(0).raw().toBuffer();
  const layer = (alpha, c) => sharp({ create: { width: SIZE, height: SIZE, channels: 3, background: c } })
    .joinChannel(alpha, { raw: { width: SIZE, height: SIZE, channels: 1 } }).png().toBuffer();
  const white = await layer(edge, '#ffffff'), slate = await layer(shape, INK);
  await sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: white }, { input: slate }]).png().toFile(path.join(OUT, key + '.png'));
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
