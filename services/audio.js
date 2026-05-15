/**
 * Audio clip cache. Same pattern as services/cards.js for card stickers:
 * the first send uploads the OGG and stores Telegram's file_id; every
 * subsequent send reuses the file_id so we don't re-upload the bytes.
 *
 * Telegram caches file_ids per bot, so once a clip is uploaded it's
 * good forever. Cache key is the canonical clip name (e.g. "caida").
 */
const fs = require("fs");
const path = require("path");
const db = require("../config/db");
const logger = require("../config/logger");

const AUDIO_DIR = path.join(__dirname, "..", "public", "audio");

function localPath(name) {
  return path.join(AUDIO_DIR, `${name}.ogg`);
}

async function getFileId(name) {
  const r = await db.query(
    "SELECT file_id FROM public.audio_clips WHERE name = $1",
    [name],
  );
  return r.rows[0] ? r.rows[0].file_id : null;
}

async function setFileId(name, fileId) {
  await db.query(
    `INSERT INTO public.audio_clips (name, file_id)
     VALUES ($1, $2)
     ON CONFLICT (name) DO UPDATE SET file_id = EXCLUDED.file_id, uploaded_at = CURRENT_TIMESTAMP`,
    [name, fileId],
  );
}

/**
 * Send the named audio clip to a chat. Uses cached file_id when
 * available; otherwise reads the OGG from disk, uploads it, and
 * caches the resulting file_id. Errors are swallowed and logged —
 * audio is a nice-to-have effect, not a blocking concern.
 *
 * Uses sendVoice (not sendAudio) so it renders as a voice bubble
 * rather than as an attached media file with a music-player UI.
 */
async function play(bot, chatId, name) {
  try {
    const cached = await getFileId(name);
    if (cached) {
      await bot.sendVoice(chatId, cached);
      return;
    }
    const filePath = localPath(name);
    if (!fs.existsSync(filePath)) {
      logger.warn({ name, filePath }, "audio clip missing on disk");
      return;
    }
    const sent = await bot.sendVoice(chatId, filePath);
    const fileId = sent && sent.voice && sent.voice.file_id;
    if (fileId) {
      await setFileId(name, fileId);
      logger.info({ name, file_id: fileId }, "audio clip cached");
    }
  } catch (err) {
    logger.error({ err: err.message, name, chatId }, "audio play failed");
  }
}

module.exports = { play, getFileId, setFileId, localPath };
