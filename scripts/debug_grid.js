// Render the source PNG with vertical lines every CELL_W pixels to
// visually verify column boundaries.
const sharp = require("sharp");
const path = require("path");

const SRC = path.join(__dirname, "..", "public", "cards", "_source_baraja_espanola_completa.png");

async function gridFor(cols) {
  const meta = await sharp(SRC).metadata();
  const cellW = meta.width / cols;
  const composites = [];
  for (let i = 0; i <= cols; i++) {
    const x = Math.round(i * cellW);
    composites.push({
      input: {
        create: {
          width: 3,
          height: meta.height,
          channels: 4,
          background: { r: 255, g: 0, b: 0, alpha: 0.9 },
        },
      },
      left: Math.min(x, meta.width - 3),
      top: 0,
    });
  }
  return await sharp(SRC).composite(composites).png().toBuffer();
}

async function main() {
  const fs = require("fs");
  for (const cols of [10, 11, 12]) {
    const buf = await gridFor(cols);
    fs.writeFileSync(`/tmp/grid-${cols}.png`, buf);
    console.log(`wrote /tmp/grid-${cols}.png`);
  }
}

main().catch(console.error);
