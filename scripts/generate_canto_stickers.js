/**
 * Generate one 512×512 PNG per canto, to be uploaded as a sticker by
 * services/cards.js bootstrap. Each sticker is:
 *   - Green felt background with a darker rounded border
 *   - Large Twemoji emoji in the upper half
 *   - The canto's display name in the lower half (white text, black
 *     outline so it stays legible on the gradient)
 *
 * Run at docker build time after the Twemoji SVGs are fetched into
 * public/twemoji/. Outputs to public/cards/canto-<slug>.png.
 */
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const TWEMOJI_DIR = path.join(__dirname, "..", "public", "twemoji");
const OUT_DIR = path.join(__dirname, "..", "public", "cards");

const SIZE = 512;
const EMOJI_SIZE = 300;
const EMOJI_TOP = 70;
const TEXT_Y = 430;

const CANTOS = [
  { name: "Ronda", emoji: "1f0cf", display: "Ronda" },
  { name: "Chiguire", emoji: "1f417", display: "Chigüire" },
  { name: "Patrulla", emoji: "1f693", display: "Patrulla" },
  { name: "Vigía", emoji: "1f441", display: "Vigía" },
  { name: "Registro", emoji: "1f4cb", display: "Registro" },
  { name: "Maguaro", emoji: "1f985", display: "Maguaro" },
  { name: "Registrico", emoji: "1f5d2", display: "Registrico" },
  { name: "Casa Chica", emoji: "1f3e0", display: "Casa Chica" },
  { name: "Casa Grande", emoji: "1f3db", display: "Casa Grande" },
  { name: "Trivilin", emoji: "1f3ba", display: "Trivilín" },
];

function slug(name) {
  return name.replace(/\s+/g, "_");
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const BG_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <defs>
    <radialGradient id="g" cx="50%" cy="40%" r="70%">
      <stop offset="0%" stop-color="#1f9b66"/>
      <stop offset="100%" stop-color="#073c25"/>
    </radialGradient>
  </defs>
  <rect width="${SIZE}" height="${SIZE}" rx="40" ry="40" fill="url(#g)"/>
  <rect x="14" y="14" width="${SIZE - 28}" height="${SIZE - 28}" rx="32" ry="32"
        fill="none" stroke="#f5a623" stroke-width="6" stroke-opacity="0.85"/>
</svg>`;

function textSvg(text) {
  const safe = escapeXml(text);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="120" viewBox="0 0 ${SIZE} 120">
  <text x="50%" y="72" text-anchor="middle"
        font-family="Helvetica, Arial, sans-serif" font-weight="900" font-size="68"
        fill="#ffffff" stroke="#000000" stroke-width="4" paint-order="stroke">${safe}</text>
</svg>`;
}

async function main() {
  let written = 0;
  for (const c of CANTOS) {
    const svgPath = path.join(TWEMOJI_DIR, `${c.emoji}.svg`);
    if (!fs.existsSync(svgPath)) {
      console.warn(`[skip] missing twemoji svg: ${svgPath}`);
      continue;
    }
    // Render the SVG emoji to a high-res PNG buffer.
    const emojiBuf = await sharp(svgPath, { density: 800 })
      .resize(EMOJI_SIZE, EMOJI_SIZE, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();

    const outPath = path.join(OUT_DIR, `canto-${slug(c.name)}.png`);
    await sharp(Buffer.from(BG_SVG))
      .composite([
        { input: emojiBuf, top: EMOJI_TOP, left: Math.floor((SIZE - EMOJI_SIZE) / 2) },
        { input: Buffer.from(textSvg(c.display)), top: TEXT_Y, left: 0 },
      ])
      .png()
      .toFile(outPath);
    written++;
  }
  console.log(`generated ${written} canto stickers in ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
