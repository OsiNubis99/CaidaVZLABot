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

const COLS = 10; // 10 values per row: 1, 2, 3, 4, 5, 6, 7, 10, 11, 12
const ROWS_OF_CARDS = 4;
const ROW_SLOTS = 5; // 4 rows of cards + 1 row with back card on left

const VALUES = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];
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

  for (let row = 0; row < ROWS_OF_CARDS; row++) {
    for (let col = 0; col < COLS; col++) {
      const value = VALUES[col];
      const type = TYPES[row];
      const left = Math.floor(col * cellWf);
      const top = Math.floor(row * cellHf);
      const out = path.join(OUT_DIR, `${value}-${type}.png`);
      await sharp(SRC)
        .extract({ left, top, width: cellW, height: cellH })
        .png()
        .toFile(out);
    }
  }
  console.log(`  wrote 40 card PNGs`);

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
