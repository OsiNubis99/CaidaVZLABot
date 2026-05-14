const TelegramBot = require("node-telegram-bot-api");

/**
 * DTO wrapping the subset of Telegram chat data we care about for a
 * Caída group. Game-specific config fields (points, cantos, etc.) are
 * loaded separately by GroupController and live on the Config class.
 */
class GroupDTO {
  constructor(id_group, name, type) {
    this.id_group = id_group;
    this.name = name;
    this.type = type;
  }

  /**
   * @param {TelegramBot.Chat} telegramChat
   * @returns {GroupDTO|false} A Group element, false when input is missing.
   */
  static fromTelegram(telegramChat) {
    if (telegramChat) {
      const id_group = telegramChat.id.toString();
      const name = telegramChat.title || "";
      const type = telegramChat.type;
      return new GroupDTO(id_group, name, type);
    }
    return false;
  }
}
module.exports = GroupDTO;
