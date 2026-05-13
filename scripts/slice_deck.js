/**
 * Slice the Wikimedia Spanish deck (public/cards/_source_baraja_espanola_completa.png)
 * into 40 individual card PNGs + 1 reverse card.
 *
 * Source image layout (inspected manually):
 *   2496 x 1595, 4 rows of cards + a 5th-row strip with the reverse card.
 *   11 columns: col 0 is the title/cover card, cols 1..10 are values
 *   [1, 2, 3, 4, 5, 6, 7, 10, 11, 12].
 *   Rows top->bottom: Oro, Copa, Espada, Basto.
 *   Reverse card is at row 4 col 0 (partial bottom strip).
 *
 * Output: public/cards/<value>-<type>.png  (e.g. 7-Espada.png)
 *         public/cards/back.png
 */
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "..", "public", "cards", "_source_baraja_espanola_completa.png");
const OUT_DIR = path.join(__dirname, "..", "public", "cards");

// Deck is a 48-card Spanish baraja (values 1-12 per palo). Caída uses
// only 40: drops 8 and 9. Source image has 12 columns × 4 rows of
// cards plus a 5th row with the back card on the left.
const COLS = 12;
const ROWS_OF_CARDS = 4;
const ROW_SLOTS = 5;

// Map source col index -> Caída value. Cols 7 and 8 (values 8 and 9)
// are intentionally skipped.
const COL_TO_VALUE = { 0: 1, 1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 7, 9: 10, 10: 11, 11: 12 };
const TYPES = ["Oro", "Copa", "Espada", "Basto"];

async function main() {
  const meta = await sharp(SRC).metadata();
  console.log(`Source: ${meta.width} x ${meta.height}`);

  // Use exact float math to avoid drift; sharp accepts integer left/top/width/height.
  const cellWf = meta.width / COLS;
  const cellHf = meta.height / ROW_SLOTS;
  const cellW = Math.floor(cellWf);
  const cellH = Math.floor(cellHf);
  console.log(`Cell size: ${cellW} x ${cellH} (float ${cellWf} x ${cellHf})`);

  let written = 0;
  for (let row = 0; row < ROWS_OF_CARDS; row++) {
    for (let col = 0; col < COLS; col++) {
      const value = COL_TO_VALUE[col];
      if (!value) continue; // skip cols 7,8 (Spanish 8 and 9, unused in Caída)
      const type = TYPES[row];
      const left = Math.floor(col * cellWf);
      const top = Math.floor(row * cellHf);
      const out = path.join(OUT_DIR, `${value}-${type}.png`);
      await sharp(SRC)
        .extract({ left, top, width: cellW, height: cellH })
        .png()
        .toFile(out);
      written++;
    }
  }
  console.log(`  wrote ${written} card PNGs`);

  // Back card at row 4, col 0
  const backOut = path.join(OUT_DIR, "back.png");
  await sharp(SRC)
    .extract({ left: 0, top: Math.floor(4 * cellHf), width: cellW, height: cellH })
    .png()
    .toFile(backOut);
  console.log(`  wrote back.png`);

  const files = fs.readdirSync(OUT_DIR).filter((f) => /\.png$/.test(f));
  console.log(`\nTotal PNGs in ${OUT_DIR}: ${files.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
