/**
 * Card visual support: maintains a cache of Telegram file_ids for the
 * 40 sliced card images. The first run uploads each card as a sticker
 * (compact display in chat + clean grid in the inline picker) and
 * stores the returned sticker file_id in the cards table. After that
 * the bot sends cards by file_id (zero upload latency).
 *
 * Stickers were chosen over photos because Telegram always scales photos
 * to chat-bubble width — a regular 226×319 card ended up filling most
 * of a phone screen and was awkward to scan. Stickers display at a
 * fixed compact size (~150px) on all clients.
 */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const db = require("../config/db");
const logger = require("../config/logger");

const CARDS_DIR = path.join(__dirname, "..", "public", "cards");

const TYPES = ["Oro", "Copa", "Espada", "Basto"];
const VALUES = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];

// Canto stickers — one per logical canto name. Display variants
// (e.g. "Vigia" vs "Vigía") share the same sticker because the
// Sings class uses the diacritic-bearing spelling.
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

function cantoLocalPath(name) {
  return path.join(CARDS_DIR, `canto-${name.replace(/\s+/g, "_")}.png`);
}

function localPath(value, type) {
  return path.join(CARDS_DIR, `${value}-${type}.png`);
}

function backLocalPath() {
  return path.join(CARDS_DIR, "back.png");
}

// In-memory cache for the 40 card + 10 canto file_ids. Telegram fires
// inline_query on every keystroke while the picker is open; hitting
// the DB per card per keystroke was unbounded write-amplification for
// static data (file_ids never change after bootstrap).
// Lazy-loaded on first read, refreshed on writes.
const _cardFileIds = new Map(); // key: "value-type" → file_id
const _cantoFileIds = new Map(); // key: name → file_id
let _cardCacheLoaded = false;
let _cantoCacheLoaded = false;

function _cardKey(value, type) {
  return value + "-" + type;
}

async function _loadCardCache() {
  const r = await db.query("SELECT value, type, file_id FROM public.cards");
  _cardFileIds.clear();
  for (const row of r.rows) _cardFileIds.set(_cardKey(row.value, row.type), row.file_id);
  _cardCacheLoaded = true;
}

async function _loadCantoCache() {
  const r = await db.query("SELECT name, file_id FROM public.canto_stickers");
  _cantoFileIds.clear();
  for (const row of r.rows) _cantoFileIds.set(row.name, row.file_id);
  _cantoCacheLoaded = true;
}

async function getFileId(value, type) {
  if (!_cardCacheLoaded) await _loadCardCache();
  return _cardFileIds.get(_cardKey(value, type)) || null;
}

async function setFileId(value, type, fileId) {
  await db.query(
    `INSERT INTO public.cards (value, type, file_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (value, type) DO UPDATE SET file_id = EXCLUDED.file_id, uploaded_at = CURRENT_TIMESTAMP`,
    [value, type, fileId],
  );
  _cardFileIds.set(_cardKey(value, type), fileId);
}

async function isBootstrapped() {
  const r = await db.query("SELECT COUNT(*)::int AS c FROM public.cards");
  return r.rows[0].c >= 40;
}

async function getCantoFileId(name) {
  if (!_cantoCacheLoaded) await _loadCantoCache();
  return _cantoFileIds.get(name) || null;
}

async function setCantoFileId(name, fileId) {
  await db.query(
    `INSERT INTO public.canto_stickers (name, file_id)
     VALUES ($1, $2)
     ON CONFLICT (name) DO UPDATE SET file_id = EXCLUDED.file_id, uploaded_at = CURRENT_TIMESTAMP`,
    [name, fileId],
  );
  _cantoFileIds.set(name, fileId);
}

async function clearAllCantos() {
  await db.query("DELETE FROM public.canto_stickers");
  _cantoFileIds.clear();
}

async function clearAll() {
  await db.query("DELETE FROM public.cards");
  _cardFileIds.clear();
}

/**
 * Convert a PNG to a WEBP buffer sized for Telegram's sticker rules:
 * longest side exactly 512 px, transparent padding preserved.
 */
async function pngToStickerWebp(pngPath) {
  return await sharp(pngPath)
    .resize({
      width: 512,
      height: 512,
      fit: "inside",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .webp()
    .toBuffer();
}

/**
 * Upload all 40 cards to the given chat as stickers and cache the
 * sticker file_ids. Returns { uploaded, skipped, failed }.
 *
 * `force: true` wipes the cards table first so a migration from an
 * older photo-based cache rebuilds cleanly.
 */
async function bootstrap(bot, chatId, { force = false } = {}) {
  if (force) {
    await clearAll();
    await clearAllCantos();
  }
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
        const webp = await pngToStickerWebp(localPath(value, type));
        const sent = await bot.sendSticker(chatId, webp);
        const fileId = sent && sent.sticker && sent.sticker.file_id;
        if (!fileId) throw new Error("no sticker file_id in response");
        await setFileId(value, type, fileId);
        uploaded++;
        logger.info({ value, type, file_id: fileId }, "card cached as sticker");
      } catch (err) {
        failed++;
        logger.error({ err: err.message, value, type }, "card sticker upload failed");
      }
    }
  }

  // Cantos use the same WEBP-from-PNG transformation as the cards.
  for (const name of CANTO_NAMES) {
    const localPng = cantoLocalPath(name);
    if (!fs.existsSync(localPng)) {
      logger.warn({ name, localPng }, "canto png missing; was generate_canto_stickers.js run?");
      failed++;
      continue;
    }
    if (!force) {
      const existing = await getCantoFileId(name);
      if (existing) {
        skipped++;
        continue;
      }
    }
    try {
      const webp = await pngToStickerWebp(localPng);
      const sent = await bot.sendSticker(chatId, webp);
      const fileId = sent && sent.sticker && sent.sticker.file_id;
      if (!fileId) throw new Error("no sticker file_id in response");
      await setCantoFileId(name, fileId);
      uploaded++;
      logger.info({ name, file_id: fileId }, "canto cached as sticker");
    } catch (err) {
      failed++;
      logger.error({ err: err.message, name }, "canto sticker upload failed");
    }
  }

  return { uploaded, skipped, failed };
}

module.exports = {
  TYPES,
  VALUES,
  CANTO_NAMES,
  localPath,
  backLocalPath,
  cantoLocalPath,
  getFileId,
  setFileId,
  getCantoFileId,
  setCantoFileId,
  isBootstrapped,
  bootstrap,
  clearAll,
  clearAllCantos,
};
