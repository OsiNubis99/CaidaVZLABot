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
  Chiguire: "🦫",
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
  let uploaded = 0;
  let skipped = 0;
  let failed = 0;
  const manifest = packManifest();

  if (force) {
    // Wipe the local cache. We deliberately DO NOT call
    // deleteStickerSet — Telegram tombstones the name for several
    // minutes after delete, so an immediate createNewStickerSet
    // returns ok but every subsequent addStickerToSet fails with
    // STICKERSET_INVALID. Instead we re-claim from the existing set
    // when possible: if Telegram already holds N stickers in the
    // expected order, just re-cache their custom_emoji_ids under the
    // manifest names. Falls through to incremental upload when the
    // set is missing or shorter than the manifest.
    await clearAll();
    try {
      const set = await rawApi(bot, "getStickerSet", { qs: { name: SET_NAME } });
      const stickers = (set && set.stickers) || [];
      if (stickers.length === manifest.length) {
        for (let i = 0; i < manifest.length; i++) {
          if (stickers[i] && stickers[i].custom_emoji_id) {
            await setCustomEmojiId(manifest[i].name, stickers[i].custom_emoji_id, SET_NAME);
          }
        }
        logger.info(
          { count: stickers.length },
          "force: re-claimed existing emoji set positions",
        );
        return { uploaded: 0, skipped: manifest.length, failed: 0 };
      }
      logger.info(
        { existing: stickers.length, expected: manifest.length },
        "force: existing set length mismatch, falling through to incremental upload",
      );
    } catch (err) {
      // Set doesn't exist or another error — fall through to normal
      // creation path. STICKERSET_INVALID is the common case.
      logger.info(
        { err: err.message },
        "force: no existing set, will create from scratch",
      );
    }
  }

  // If not forcing and every entry is already cached locally, fast-exit.
  if (!force) {
    const have = await lookupMany(manifest.map((m) => m.name));
    if (have.size === manifest.length) {
      return { uploaded: 0, skipped: manifest.length, failed: 0 };
    }
  }

  // Snapshot the set's current sticker count. We use this to figure out
  // which set-position corresponds to the sticker we just uploaded —
  // each successful add appends at position (prevCount). We re-fetch
  // after each upload to grab the newly assigned custom_emoji_id.
  let setExists = false;
  let setStickerCount = 0;
  try {
    const set = await rawApi(bot, "getStickerSet", { qs: { name: SET_NAME } });
    setExists = true;
    setStickerCount = (set && set.stickers && set.stickers.length) || 0;
  } catch (err) {
    setExists = false;
  }

  for (const entry of manifest) {
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
      const stickerSpec = {
        sticker: "attach://emoji_file",
        format: "static",
        emoji_list: [entry.fallback],
      };
      // Put all params in formData (not qs) so Telegram parses them
      // out of the multipart body alongside the file. user_id is
      // stringified — some Telegram endpoints reject numeric
      // multipart fields in subtle ways (manifests as STICKERSET_INVALID
      // even when the set exists).
      const fileField = {
        value: fs.createReadStream(entry.file),
        options: { filename: `${entry.name}.webp`, contentType: "image/webp" },
      };
      if (!setExists) {
        await rawApi(bot, "createNewStickerSet", {
          formData: {
            user_id: String(adminUserId),
            name: SET_NAME,
            title: SET_TITLE,
            sticker_type: "custom_emoji",
            stickers: JSON.stringify([stickerSpec]),
            emoji_file: fileField,
          },
        });
        setExists = true;
        // Telegram has a brief propagation delay between set creation
        // and the set being findable by addStickerToSet. Sleep before
        // the next add to avoid a STICKERSET_INVALID barrage.
        await new Promise((resolve) => setTimeout(resolve, 3000));
      } else {
        await rawApi(bot, "addStickerToSet", {
          formData: {
            user_id: String(adminUserId),
            name: SET_NAME,
            sticker: JSON.stringify(stickerSpec),
            emoji_file: fileField,
          },
        });
      }
      // Pull the set back and claim the sticker at the new tail
      // position — that's the one we just added. This robustly handles
      // gaps (skipped cached entries) and partial failures because we
      // associate THIS entry's name with the sticker we actually got
      // back from Telegram, not its position in the local manifest.
      const refreshed = await rawApi(bot, "getStickerSet", { qs: { name: SET_NAME } });
      const stickers = (refreshed && refreshed.stickers) || [];
      if (stickers.length > setStickerCount) {
        const added = stickers[setStickerCount];
        if (added && added.custom_emoji_id) {
          await setCustomEmojiId(entry.name, added.custom_emoji_id, SET_NAME);
          logger.info(
            { name: entry.name, custom_emoji_id: added.custom_emoji_id },
            "emoji cached",
          );
        }
        setStickerCount = stickers.length;
      }
      uploaded++;
    } catch (err) {
      failed++;
      logger.error({ err: err.message, name: entry.name }, "emoji upload failed");
    }
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
