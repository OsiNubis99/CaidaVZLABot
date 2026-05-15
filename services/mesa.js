/**
 * Render the mesa (table) as a PNG using sharp.
 *
 * Layout: 2 rows x 5 cols, each slot a card-sized box on a green felt
 * background. Slots are indexed by card.position (0..9). Empty slots
 * show the felt; occupied slots show the card image.
 */
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");
const logger = require("../config/logger");

const CARDS_DIR = path.join(__dirname, "..", "public", "cards");

const SLOT_W = 150;
const SLOT_H = 210;
const GAP = 10;
const PAD = 20;
const COLS = 5;
const ROWS = 2;

const CANVAS_W = COLS * SLOT_W + (COLS - 1) * GAP + 2 * PAD;
const CANVAS_H = ROWS * SLOT_H + (ROWS - 1) * GAP + 2 * PAD;

// felt green
const FELT = { r: 16, g: 100, b: 50, alpha: 1 };
const SLOT_BG = { r: 12, g: 80, b: 40, alpha: 1 };

let resizedCardCache = null;

async function buildResizedCardCache() {
  const cache = {};
  const types = ["Oro", "Copa", "Espada", "Basto"];
  const values = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];
  for (const t of types) {
    for (const v of values) {
      const file = path.join(CARDS_DIR, `${v}-${t}.png`);
      if (!fs.existsSync(file)) {
        logger.warn({ file }, "card image missing while building mesa cache");
        continue;
      }
      cache[`${v}-${t}`] = await sharp(file)
        .resize(SLOT_W, SLOT_H, { fit: "fill" })
        .png()
        .toBuffer();
    }
  }
  return cache;
}

async function getResizedCard(value, type) {
  if (!resizedCardCache) resizedCardCache = await buildResizedCardCache();
  return resizedCardCache[`${value}-${type}`];
}

function slotXY(position) {
  const row = Math.floor(position / COLS);
  const col = position % COLS;
  const x = PAD + col * (SLOT_W + GAP);
  const y = PAD + row * (SLOT_H + GAP);
  return { x, y };
}

// Static asset — the empty slot PNG never changes. Build it once lazily
// instead of re-encoding via sharp on every render call.
let _emptySlotCache = null;
async function emptySlotBuffer() {
  if (_emptySlotCache) return _emptySlotCache;
  _emptySlotCache = await sharp({
    create: { width: SLOT_W, height: SLOT_H, channels: 4, background: SLOT_BG },
  })
    .png()
    .toBuffer();
  return _emptySlotCache;
}

/**
 * Render the table.
 * @param {Array<{value:Number,type:String}|null>} tableSlots - array of length 10
 * @returns {Promise<Buffer>} PNG
 */
async function render(tableSlots) {
  const empty = await emptySlotBuffer();
  const composites = [];

  for (let pos = 0; pos < 10; pos++) {
    const { x, y } = slotXY(pos);
    const card = tableSlots[pos];
    if (card && card.value && card.type) {
      const buf = await getResizedCard(card.value, card.type);
      if (buf) {
        composites.push({ input: buf, top: y, left: x });
        continue;
      }
    }
    composites.push({ input: empty, top: y, left: x });
  }

  return await sharp({
    create: { width: CANVAS_W, height: CANVAS_H, channels: 4, background: FELT },
  })
    .composite(composites)
    .png()
    .toBuffer();
}

module.exports = { render, CANVAS_W, CANVAS_H };
