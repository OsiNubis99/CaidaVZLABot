/**
 * Card visual support: maintains a cache of Telegram file_ids for the
 * 40 sliced card images. The first run uploads each card via sendPhoto
 * to a cache chat and stores the returned file_id in the cards table.
 * After that, the bot sends cards by file_id (zero upload latency).
 */
const fs = require("fs");
const path = require("path");
const db = require("../config/db");
const logger = require("../config/logger");

const CARDS_DIR = path.join(__dirname, "..", "public", "cards");

const TYPES = ["Oro", "Copa", "Espada", "Basto"];
const VALUES = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];

function localPath(value, type) {
  return path.join(CARDS_DIR, `${value}-${type}.png`);
}

function backLocalPath() {
  return path.join(CARDS_DIR, "back.png");
}

async function getFileId(value, type) {
  const r = await db.query(
    "SELECT file_id FROM public.cards WHERE value = $1 AND type = $2",
    [value, type],
  );
  return r.rows[0] ? r.rows[0].file_id : null;
}

async function setFileId(value, type, fileId) {
  await db.query(
    `INSERT INTO public.cards (value, type, file_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (value, type) DO UPDATE SET file_id = EXCLUDED.file_id, uploaded_at = CURRENT_TIMESTAMP`,
    [value, type, fileId],
  );
}

async function isBootstrapped() {
  const r = await db.query("SELECT COUNT(*)::int AS c FROM public.cards");
  return r.rows[0].c >= 40;
}

/**
 * Upload all 40 cards to the given chat and cache the file_ids.
 * Returns { uploaded, skipped, failed }.
 */
async function bootstrap(bot, chatId, { force = false } = {}) {
  let uploaded = 0,
    skipped = 0,
    failed = 0;
  for (const type of TYPES) {
    for (const value of VALUES) {
      if (!force) {
        const existing = await getFileId(value, type);
        if (existing) {
          skipped++;
          continue;
        }
      }
      try {
        const sent = await bot.sendPhoto(chatId, fs.createReadStream(localPath(value, type)), {
          caption: `${value} de ${type}`,
        });
        const photos = sent.photo || [];
        const best = photos[photos.length - 1];
        if (!best) throw new Error("no photo array in response");
        await setFileId(value, type, best.file_id);
        uploaded++;
        logger.info({ value, type, file_id: best.file_id }, "card cached");
      } catch (err) {
        failed++;
        logger.error({ err: err.message, value, type }, "card upload failed");
      }
    }
  }
  return { uploaded, skipped, failed };
}

module.exports = {
  TYPES,
  VALUES,
  localPath,
  backLocalPath,
  getFileId,
  setFileId,
  isBootstrapped,
  bootstrap,
};
