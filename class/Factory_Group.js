const TelegramBot = require("node-telegram-bot-api");

class Factory_Group {
  id_group = String.prototype;
  name = String.prototype;
  game_mode = Number.prototype;
  points = Number.prototype;
  type = String.prototype;
  caida_continua = String.prototype;
  mata_canto = String.prototype;
  mata_mesa = String.prototype;
  mesa = Number.prototype;
  caida = Number.prototype;
  ronda = Number.prototype;
  chiguire = Number.prototype;
  patrulla = Number.prototype;
  vigia = Number.prototype;
  registro = Number.prototype;
  maguaro = Number.prototype;
  registrico = Number.prototype;
  casa_chica = Number.prototype;
  casa_grande = Number.prototype;
  trivilin = Number.prototype;

  /**
   * @param {TelegramBot.Chat} telegramChat
   * @returns A User element
   */
  static fromTelegram(telegramChat) {
    return {
      id_user: telegramChat.id.toString(),
      name: telegramChat.title,
    };
  }
}
module.exports = Factory_Group;
