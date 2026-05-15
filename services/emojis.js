/**
 * Custom emoji pack management. Replaces the old sticker flow with
 * Telegram custom emojis that render inline at ~24 px (or jumbo when
 * a message is a single emoji).
 *
 * Flow:
 *   - bootstrap(): admin runs /bootstrap_emojis. We create a custom-
 *     emoji sticker set owned by the admin user_id, populated with 50
 *     stickers (40 cards + 10 cantos). Telegram assigns each one a
 *     custom_emoji_id. We cache them in public.card_emojis keyed by a
 *     stable logical name.
 *   - lookup(): when a play happens, services/game.js looks up the
 *     custom_emoji_id by name and constructs a message with a
 *     MessageEntity of type "custom_emoji" pointing to that id.
 *   - Fallback: if no custom_emoji_id is cached for the logical name,
 *     callers send plain text ("4 de Oro") with no emoji prefix.
 *
 * Telegram quirk: node-telegram-bot-api 0.66 doesn't expose a typed
 * helper for sticker_type="custom_emoji" sets, so we drive the API
 * directly via bot._request. The InputSticker JSON references the
 * file via "attach://<key>" and the key is sent as multipart form.
 */
const fs = require("fs");
const path = require("path");
const db = require("../config/db");
const logger = require("../config/logger");

const EMOJIS_DIR = path.join(__dirname, "..", "public", "emojis");
const SET_NAME = "CaidaVZLA_by_CaidaVZLABot";
const SET_TITLE = "Caída Venezolana — Cartas";

const TYPES = ["Oro", "Copa", "Espada", "Basto"];
const VALUES = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];

// Logical canto names (must match services/cards.js CANTO_NAMES).
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

// Fallback unicode emoji per logical name. Telegram shows this when
// the user's client can't render the custom emoji (very rare — only
// ancient clients or transient load failures). We use 🃏 across the
// pack to keep it simple; cantos pick thematic emojis so a fallback
// still hints at which canto it was.
const CANTO_FALLBACK = {
  Ronda: "🃏",
  Chiguire: "🐗",
  Patrulla: "🚓",
  "Vigía": "👁",
  Registro: "📋",
  Maguaro: "🦅",
  Registrico: "🗒",
  "Casa Chica": "🏠",
  "Casa Grande": "🏛",
  Trivilin: "🎺",
};

function cardName(value, type) {
  return `card-${value}-${type}`;
}

function cantoName(displayName) {
  return `canto-${displayName.replace(/\s+/g, "_")}`;
}

function cardLocalPath(value, type) {
  return path.join(EMOJIS_DIR, `${cardName(value, type)}.webp`);
}

function cantoLocalPath(displayName) {
  return path.join(EMOJIS_DIR, `${cantoName(displayName)}.webp`);
}

/**
 * Build the full list of {name, file, fallback} entries for the pack.
 * Order is fixed: cards first (Oro 1-12, Copa 1-12, etc.), then cantos.
 * The bootstrap uploads in this order so a partial failure can be
 * resumed deterministically.
 */
function packManifest() {
  const items = [];
  for (const type of TYPES) {
    for (const value of VALUES) {
      items.push({
        name: cardName(value, type),
        file: cardLocalPath(value, type),
        fallback: "🃏",
      });
    }
  }
  for (const display of CANTO_NAMES) {
    items.push({
      name: cantoName(display),
      file: cantoLocalPath(display),
      fallback: CANTO_FALLBACK[display] || "🃏",
    });
  }
  return items;
}

async function getCustomEmojiId(name) {
  const r = await db.query(
    "SELECT custom_emoji_id FROM public.card_emojis WHERE name = $1",
    [name],
  );
  return r.rows[0] ? r.rows[0].custom_emoji_id : null;
}

async function setCustomEmojiId(name, customEmojiId, setName) {
  await db.query(
    `INSERT INTO public.card_emojis (name, custom_emoji_id, set_name)
     VALUES ($1, $2, $3)
     ON CONFLICT (name) DO UPDATE
       SET custom_emoji_id = EXCLUDED.custom_emoji_id,
           set_name = EXCLUDED.set_name,
           uploaded_at = CURRENT_TIMESTAMP`,
    [name, customEmojiId, setName],
  );
}

async function clearAll() {
  await db.query("DELETE FROM public.card_emojis");
}

/**
 * Card-emoji custom_emoji_id lookup with a one-call cache populated
 * lazily. Callers ask for an arbitrary number of names; we fire one
 * SELECT instead of N. Result is a Map<name, id>.
 */
async function lookupMany(names) {
  if (names.length === 0) return new Map();
  const r = await db.query(
    "SELECT name, custom_emoji_id FROM public.card_emojis WHERE name = ANY($1)",
    [names],
  );
  const map = new Map();
  for (const row of r.rows) map.set(row.name, row.custom_emoji_id);
  return map;
}

/**
 * Helper to call Telegram Bot API directly. node-telegram-bot-api's
 * typed helpers don't cover sticker_type="custom_emoji", so for the
 * pack creation we drive the raw HTTP API. Reuses the bot's token
 * via the library's internal _request method.
 */
function rawApi(bot, method, opts) {
  return bot._request(method, opts);
}

/**
 * Create the set with the first sticker, then add the rest via
 * addStickerToSet. Telegram's createNewStickerSet does accept up to
 * 50 stickers in one call, but the multipart form for 50 files in a
 * single request is fragile in node-telegram-bot-api 0.66; uploading
 * one-by-one is slower but more robust. Each addStickerToSet call
 * returns the updated set; we re-getStickerSet at the end to pull all
 * custom_emoji_ids back in order.
 *
 * @param {TelegramBot} bot
 * @param {Number|String} adminUserId - user_id that "owns" the set
 * @param {Object} options - { force: boolean }
 * @returns {Promise<{uploaded:number, skipped:number, failed:number}>}
 */
async function bootstrap(bot, adminUserId, { force = false } = {}) {
  if (force) await clearAll();
  let uploaded = 0;
  let skipped = 0;
  let failed = 0;
  const manifest = packManifest();

  // If not forcing and all entries are already cached, fast-exit.
  if (!force) {
    const have = await lookupMany(manifest.map((m) => m.name));
    if (have.size === manifest.length) {
      return { uploaded: 0, skipped: manifest.length, failed: 0 };
    }
  }

  // Does the set already exist on Telegram? We try getStickerSet —
  // if it succeeds, we treat it as "set exists, add missing only";
  // if it 404s, we create from scratch with the first sticker.
  let setExists = false;
  try {
    await rawApi(bot, "getStickerSet", { qs: { name: SET_NAME } });
    setExists = true;
  } catch (err) {
    setExists = false;
  }

  for (let i = 0; i < manifest.length; i++) {
    const entry = manifest[i];
    if (!fs.existsSync(entry.file)) {
      logger.warn({ name: entry.name, file: entry.file }, "emoji file missing");
      failed++;
      continue;
    }
    const cached = await getCustomEmojiId(entry.name);
    if (!force && cached) {
      skipped++;
      continue;
    }
    try {
      const isFirst = !setExists && uploaded === 0;
      const stickerSpec = {
        sticker: "attach://emoji_file",
        format: "static",
        emoji_list: [entry.fallback],
      };
      if (isFirst) {
        await rawApi(bot, "createNewStickerSet", {
          qs: {
            user_id: adminUserId,
            name: SET_NAME,
            title: SET_TITLE,
            sticker_type: "custom_emoji",
            stickers: JSON.stringify([stickerSpec]),
          },
          formData: {
            emoji_file: {
              value: fs.createReadStream(entry.file),
              options: { filename: `${entry.name}.webp`, contentType: "image/webp" },
            },
          },
        });
        setExists = true;
      } else {
        await rawApi(bot, "addStickerToSet", {
          qs: {
            user_id: adminUserId,
            name: SET_NAME,
            sticker: JSON.stringify(stickerSpec),
          },
          formData: {
            emoji_file: {
              value: fs.createReadStream(entry.file),
              options: { filename: `${entry.name}.webp`, contentType: "image/webp" },
            },
          },
        });
      }
      uploaded++;
    } catch (err) {
      failed++;
      logger.error({ err: err.message, name: entry.name }, "emoji upload failed");
    }
  }

  // After uploading all, pull the set back and map positions → names.
  // The pack manifest's order is the order Telegram returned stickers
  // in (because we added them sequentially), so we can zip them.
  try {
    const set = await rawApi(bot, "getStickerSet", { qs: { name: SET_NAME } });
    const stickers = set && set.stickers ? set.stickers : [];
    // We may be filling holes (skipped means already cached). Iterate
    // by position assuming the set order matches the manifest order
    // for the entries we just uploaded. For each manifest entry that
    // does NOT have a cached id yet, claim the next stickers[i] that
    // we haven't claimed.
    const claimed = new Set();
    for (let i = 0; i < manifest.length && i < stickers.length; i++) {
      const entry = manifest[i];
      const cached = await getCustomEmojiId(entry.name);
      if (cached) {
        claimed.add(i);
        continue;
      }
      const s = stickers[i];
      if (s && s.custom_emoji_id) {
        await setCustomEmojiId(entry.name, s.custom_emoji_id, SET_NAME);
        claimed.add(i);
        logger.info(
          { name: entry.name, custom_emoji_id: s.custom_emoji_id },
          "emoji cached",
        );
      }
    }
  } catch (err) {
    logger.error({ err: err.message }, "post-bootstrap getStickerSet failed");
  }

  return { uploaded, skipped, failed };
}

module.exports = {
  SET_NAME,
  SET_TITLE,
  bootstrap,
  getCustomEmojiId,
  setCustomEmojiId,
  lookupMany,
  clearAll,
  cardName,
  cantoName,
  cardLocalPath,
  cantoLocalPath,
  packManifest,
};
