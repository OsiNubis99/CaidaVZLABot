/**
 * Generate one 512×512 PNG per canto, to be uploaded as a sticker by
 * services/cards.js bootstrap.
 *
 * Each sticker has:
 *   - Green felt background with a darker rounded border (gold trim).
 *   - Visual element in the upper portion:
 *       * Card-fixed cantos (C.Chica/Grande, Registro, Registrico,
 *         Maguaro): fan of the 3 cards that compose the canto.
 *       * Pair/triple-value cantos (Ronda, Trivilín): fan of 2 or 3
 *         Twemoji jokers (no fixed cards in the deck).
 *       * Positional cantos (Chigüire, Patrulla, Vigía): the canto's
 *         Twemoji icon, large.
 *   - Display name in the lower half (white text, black outline so it
 *     stays legible against the gradient).
 *
 * Runs at docker build time after slice_deck.js (cards) and the
 * Twemoji fetch (emojis) have populated public/cards and
 * public/twemoji. Outputs to public/cards/canto-<slug>.png.
 *
 * Alpine docker images need `fontconfig ttf-dejavu` installed for the
 * SVG text to actually render — without them sharp silently emits the
 * stroke/fill but no glyphs, producing stickers without a name.
 */
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const TWEMOJI_DIR = path.join(__dirname, "..", "public", "twemoji");
const CARDS_DIR = path.join(__dirname, "..", "public", "cards");
const OUT_DIR = path.join(__dirname, "..", "public", "cards");

const SIZE = 512;
const NAME_BAND_HEIGHT = 120;       // bottom band reserved for the name
const NAME_TOP = SIZE - 110;        // top-Y where the text SVG is composited

// Card-art rendering knobs (fan layout)
const CARD_WIDTH = 200;             // base card width before rotation
const FAN_SPREAD = 80;              // horizontal distance from center for the outer cards
const FAN_ANGLE = 15;               // outer-card rotation in degrees
const FAN_TOP_NUDGE = 10;           // outer cards sit slightly higher

const CANTOS = [
  // Card-fixed
  {
    name: "Registro",
    display: "Registro",
    type: "cards",
    cards: [[12, "Oro"], [11, "Oro"], [1, "Oro"]],
  },
  {
    name: "Registrico",
    display: "Registrico",
    type: "cards",
    cards: [[11, "Oro"], [10, "Oro"], [1, "Oro"]],
  },
  {
    name: "Maguaro",
    display: "Maguaro",
    type: "cards",
    cards: [[12, "Oro"], [10, "Oro"], [1, "Oro"]],
  },
  {
    name: "Casa Chica",
    display: "C.Chica",
    type: "cards",
    cards: [[11, "Oro"], [11, "Copa"], [1, "Oro"]],
  },
  {
    name: "Casa Grande",
    display: "C.Grande",
    type: "cards",
    cards: [[12, "Oro"], [12, "Copa"], [1, "Oro"]],
  },
  // Joker-based (no fixed cards in deck — render Twemoji on white card
  // shapes so they slot into the same fan layout as the card-based cantos).
  { name: "Ronda", display: "Ronda", type: "emoji_cards", hex: "1f0cf", count: 2 },
  { name: "Trivilin", display: "Trivilín", type: "emoji_cards", hex: "1f0cf", count: 3 },
  // Positional cantos — no fixed cards either; use a fan of 3 white
  // cards each stamped with the canto's Twemoji icon. Keeps the whole
  // pack visually uniform (card-fan + name) so single-emoji stickers
  // don't break the aesthetic next to the cards-based cantos.
  { name: "Patrulla", display: "Patrulla", type: "emoji_cards", hex: "1f693", count: 3 },
  { name: "Vigía", display: "Vigía", type: "emoji_cards", hex: "1f441", count: 3 },
  // Twemoji beaver (1f9ab) is the closest standing emoji to a capybara
  // (no native capybara codepoint exists in Unicode yet). The chigüire
  // IS a capybara in Venezuelan Spanish.
  { name: "Chiguire", display: "Chigüire", type: "emoji_cards", hex: "1f9ab", count: 3 },
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
<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${NAME_BAND_HEIGHT}" viewBox="0 0 ${SIZE} ${NAME_BAND_HEIGHT}">
  <text x="50%" y="72" text-anchor="middle"
        font-family="Helvetica, Arial, sans-serif" font-weight="900" font-size="68"
        fill="#ffffff" stroke="#000000" stroke-width="4" paint-order="stroke">${safe}</text>
</svg>`;
}

async function emojiToCardBuffer(hex, width) {
  // Render Twemoji on top of a white rounded-rect "card" so it slots
  // into the fan layout next to real card art without looking out of
  // place. Aspect ratio matches the deck (≈208×319).
  const cardH = Math.round(width * 1.534);
  const padding = Math.round(width * 0.1);
  const emojiSize = width - padding * 2;
  const svgPath = path.join(TWEMOJI_DIR, `${hex}.svg`);
  const emojiPng = await sharp(svgPath, { density: 800 })
    .resize(emojiSize, emojiSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const cardBg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${cardH}" viewBox="0 0 ${width} ${cardH}">
  <rect x="2" y="2" width="${width - 4}" height="${cardH - 4}" rx="14" ry="14"
        fill="#ffffff" stroke="#222222" stroke-width="3"/>
</svg>`;
  return await sharp(Buffer.from(cardBg))
    .composite([{ input: emojiPng, top: Math.floor((cardH - emojiSize) / 2), left: padding }])
    .png()
    .toBuffer();
}

async function loadCardBuffer(value, type, width) {
  return await sharp(path.join(CARDS_DIR, `${value}-${type}.png`))
    .resize({ width })
    .png()
    .toBuffer();
}

async function compositeFan(cardBuffers) {
  // Center card upright, outer cards rotated outward and nudged up so
  // the trio reads as a hand. Works for arrays of 2 or 3 cards.
  const transparent = { r: 0, g: 0, b: 0, alpha: 0 };
  const meta = await sharp(cardBuffers[0]).metadata();
  const cardH = meta.height;
  const cardW = meta.width;
  const top = Math.floor((SIZE - NAME_BAND_HEIGHT - cardH) / 2);

  if (cardBuffers.length === 2) {
    // Pair: lean both cards inward.
    const left = await sharp(cardBuffers[0]).rotate(-FAN_ANGLE, { background: transparent }).toBuffer();
    const right = await sharp(cardBuffers[1]).rotate(FAN_ANGLE, { background: transparent }).toBuffer();
    const lm = await sharp(left).metadata();
    const rm = await sharp(right).metadata();
    const gap = Math.round(cardW * 0.45);
    const centerX = Math.floor(SIZE / 2);
    return [
      { input: left, top, left: centerX - gap - Math.floor(lm.width / 2) },
      { input: right, top, left: centerX + gap - Math.floor(rm.width / 2) },
    ];
  }

  // 3 cards.
  const left = await sharp(cardBuffers[0]).rotate(-FAN_ANGLE, { background: transparent }).toBuffer();
  const right = await sharp(cardBuffers[2]).rotate(FAN_ANGLE, { background: transparent }).toBuffer();
  const lm = await sharp(left).metadata();
  const rm = await sharp(right).metadata();
  const centerX = Math.floor((SIZE - cardW) / 2);
  return [
    { input: left, top: top - FAN_TOP_NUDGE, left: centerX - FAN_SPREAD - Math.floor((lm.width - cardW) / 2) },
    { input: right, top: top - FAN_TOP_NUDGE, left: centerX + FAN_SPREAD - Math.floor((rm.width - cardW) / 2) },
    { input: cardBuffers[1], top, left: centerX },
  ];
}

async function buildCardsCanto(c) {
  const cards = await Promise.all(c.cards.map(([v, t]) => loadCardBuffer(v, t, CARD_WIDTH)));
  return await compositeFan(cards);
}

async function buildEmojiCardsCanto(c) {
  const cards = await Promise.all(
    Array.from({ length: c.count }, () => emojiToCardBuffer(c.hex, CARD_WIDTH)),
  );
  return await compositeFan(cards);
}

async function main() {
  let written = 0;
  for (const c of CANTOS) {
    let visual;
    if (c.type === "cards") {
      visual = await buildCardsCanto(c);
    } else {
      // emoji_cards — Twemoji SVG must exist (fetched by the Dockerfile
      // for every canto in the pack). Skip with a clear warning rather
      // than failing the whole build if it's missing.
      const svgPath = path.join(TWEMOJI_DIR, `${c.hex}.svg`);
      if (!fs.existsSync(svgPath)) {
        console.warn(`[skip] missing twemoji svg: ${svgPath}`);
        continue;
      }
      visual = await buildEmojiCardsCanto(c);
    }

    const outPath = path.join(OUT_DIR, `canto-${slug(c.name)}.png`);
    await sharp(Buffer.from(BG_SVG))
      .composite([...visual, { input: Buffer.from(textSvg(c.display)), top: NAME_TOP, left: 0 }])
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
