/**
 * Generate the 50 custom-emoji WEBPs for the CaidaVZLA emoji pack:
 *   - 40 cards (every value × every palo)
 *   - 10 canto art frames (reused from the canto sticker pack)
 *
 * Telegram custom emojis must be ≤ 100×100 px static WEBP, ≤ 64 KB.
 * We resize each PNG to fit inside 100×100 preserving aspect ratio
 * (cards become ~65×100, cantos become 100×100). The output WEBPs
 * are uploaded by services/emojis.js → bootstrap.
 *
 * Outputs:
 *   public/emojis/card-<value>-<type>.webp
 *   public/emojis/canto-<name>.webp
 *
 * The fallback unicode emoji each card/canto is assigned to is wired
 * separately in services/emojis.js (it's metadata for the sticker
 * set creation API, not the file content).
 */
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const CARDS_DIR = path.join(__dirname, "..", "public", "cards");
const OUT_DIR = path.join(__dirname, "..", "public", "emojis");
const SIZE = 100;

const TYPES = ["Oro", "Copa", "Espada", "Basto"];
const VALUES = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];

// Canto display names (must match services/cards.js CANTO_NAMES).
const CANTO_NAMES = [
  "Ronda",
  "Chiguire",
  "Patrulla",
  "Vigía",
  "Registro",
  "Maguaro",
  "Registrico",
  "Casa Chica",
  "Casa Grande",
  "Trivilin",
];

function cardSlug(value, type) {
  return `card-${value}-${type}`;
}

function cantoSlug(name) {
  return `canto-${name.replace(/\s+/g, "_")}`;
}

async function convert(srcPath, outPath) {
  await sharp(srcPath)
    .resize({
      width: SIZE,
      height: SIZE,
      fit: "inside",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .webp({ quality: 90 })
    .toFile(outPath);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  let written = 0;
  for (const type of TYPES) {
    for (const value of VALUES) {
      const src = path.join(CARDS_DIR, `${value}-${type}.png`);
      if (!fs.existsSync(src)) {
        console.warn(`[skip] missing card png: ${src}`);
        continue;
      }
      await convert(src, path.join(OUT_DIR, `${cardSlug(value, type)}.webp`));
      written++;
    }
  }
  for (const name of CANTO_NAMES) {
    const src = path.join(CARDS_DIR, `canto-${name.replace(/\s+/g, "_")}.png`);
    if (!fs.existsSync(src)) {
      console.warn(`[skip] missing canto png: ${src}`);
      continue;
    }
    await convert(src, path.join(OUT_DIR, `${cantoSlug(name)}.webp`));
    written++;
  }
  console.log(`generated ${written} emoji webps in ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
