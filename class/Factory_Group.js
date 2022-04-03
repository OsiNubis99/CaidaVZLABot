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

  constructor(id_group, name, type) {
    this.id_group = id_group;
    this.name = name;
    this.type = type;
  }

  /**
   * @param {TelegramBot.Chat} telegramChat
   * @returns {Factory_Group|false} A User element
   */
  static fromTelegram(telegramChat) {
    if (telegramChat) {
      let id_group = telegramChat.id.toString();
      let name = telegramChat.title || "";
      let type = telegramChat.type;
      return new Factory_Group(id_group, name, type);
    }
    return false;
  }
}
module.exports = Factory_Group;
