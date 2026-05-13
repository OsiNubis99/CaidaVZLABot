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

const COLS = 11;
const ROWS_OF_CARDS = 4;

const VALUES = [null, 1, 2, 3, 4, 5, 6, 7, 10, 11, 12]; // col 0 is cover; cols 1..10 are these values
const TYPES = ["Oro", "Copa", "Espada", "Basto"];

async function main() {
  const meta = await sharp(SRC).metadata();
  console.log(`Source: ${meta.width} x ${meta.height}`);

  const cellW = Math.floor(meta.width / COLS);
  // The image has 4 rows of cards then a partial 5th row (reverse + black).
  // Card row height is image_height / 5 (5 row-positions), so:
  const cellH = Math.floor(meta.height / 5);
  console.log(`Cell size: ${cellW} x ${cellH}`);

  for (let row = 0; row < ROWS_OF_CARDS; row++) {
    for (let col = 1; col < COLS; col++) {
      const value = VALUES[col];
      const type = TYPES[row];
      const left = col * cellW;
      const top = row * cellH;
      const out = path.join(OUT_DIR, `${value}-${type}.png`);
      await sharp(SRC)
        .extract({ left, top, width: cellW, height: cellH })
        .png()
        .toFile(out);
      console.log(`  wrote ${path.basename(out)}`);
    }
  }

  // Reverse card at row 4, col 0
  const backOut = path.join(OUT_DIR, "back.png");
  await sharp(SRC)
    .extract({ left: 0, top: 4 * cellH, width: cellW, height: cellH })
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
