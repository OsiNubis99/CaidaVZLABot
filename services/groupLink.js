/**
 * Resolve a shareable link for a group, preferring the one that needs the
 * fewest rights:
 *   1. public @username link (t.me/<username>) — no admin rights required, and
 *      the right thing for public groups;
 *   2. the chat's primary invite_link if Telegram already exposes one to the
 *      bot (private group where the bot is an admin);
 *   3. a freshly exported invite link (needs the bot to be admin with
 *      can_invite_users);
 *   4. null when none of the above work (e.g. private group, bot not admin).
 *
 * @param {import("node-telegram-bot-api")} bot
 * @param {string|number} id_group
 * @returns {Promise<string|null>}
 */
async function resolveGroupLink(bot, id_group) {
  try {
    const chat = await bot.getChat(id_group);
    if (chat && chat.username) return "https://t.me/" + chat.username;
    if (chat && chat.invite_link) return chat.invite_link;
  } catch (_) {
    // getChat can fail if the bot was removed; fall through to the export path.
  }
  try {
    return await bot.exportChatInviteLink(id_group);
  } catch (_) {
    return null;
  }
}

module.exports = { resolveGroupLink };
