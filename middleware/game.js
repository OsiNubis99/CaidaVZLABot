const resp = require("../lang/es");
const Game = require("../class/Game");
const User = require("../class/User");
const Config = require("../class/Config");
const message = require("../templates/message");
const keyboard = require("../templates/keyboard");
const { group, user } = require("../controller");

var games = new Array(Game.prototype);
var users = new Array(String.prototype);

async function get_group_configs(chat) {
  let configs = await group.add(chat);
  games[String.toString(chat.id)] = new Game(configs.name, new Config(configs));
}

module.exports = {
  async create(msg, force) {
    if (msg.chat.type == "supergroup" || msg.chat.type == "group") {
      let chatid = String.toString(msg.chat.id);
      if (force || !games[chatid]) {
        await get_group_configs(msg.chat);
        return message.reply(resp.game_created, msg.message_id);
      }
      return message.reply(resp.game_already_created, msg.message_id);
    }
    return message.reply(resp.is_not_a_group, msg.message_id);
  },
  async join(msg) {
    let new_user = new User(await user.add(msg.from));
    if (!new_user.is_banned) {
      let chatid = String.toString(msg.chat.id);
      if (games[chatid]) {
        users[String.toString(new_user.id_user)] = chatid;
        return message.reply(games[chatid].join(new_user), msg.message_id);
      } else {
        return message.reply(resp.game_no_created, msg.message_id);
      }
    } else {
      return message.reply(resp.user_is_banned, msg.message_id);
    }
  },
  async status(msg) {
    let chatid = String.toString(msg.chat.id);
    await get_group_configs(msg.chat);
    let response = games[chatid].config.get_game_mode();
    response += "\n" + games[chatid].print();
    return message.reply(response, msg.message_id);
  },
  async config(msg) {
    if (msg.chat.type == "supergroup" || msg.chat.type == "group") {
      await get_group_configs(msg.chat);
      let response = games[chatid].config.print();
      return message.keyboard(response, keyboard.group_settings);
    }
    return message.reply(resp.is_not_a_group, msg.message_id);
  },
  async set_settings(msg, config, value) {
    if (msg.chat.type == "supergroup" || msg.chat.type == "group") {
      let chatid = String.toString(msg.chat.id);
      await get_group_configs(msg.chat);
      let config_is_not_ok = games[chatid].config.is_not_ok(config, value);
      if (!config_is_not_ok) {
        await group.update(msg.chat.id, games[chatid].config);
        return message.keyboard(resp.config_is_ok, keyboard.group_settings);
      }
      return message.reply(config_is_not_ok, msg.message_id);
    }
    return message.reply(resp.is_not_a_group, msg.message_id);
  },
  async set_inline_type(msg) {
    let chatid = String.toString(msg.chat.id);
    await get_group_configs(msg.chat);
    games[chatid].config.type =
      games[chatid].config.type == "parejas" ? "individual" : "parejas";
    await group.update(msg.chat.id, games[chatid].config);
    return message.edit_keyboard(
      games[chatid].print_before_game(msg.chat.id, msg.message_id)
    );
  },
  async get_user_cards() {
    return [
      {
        id: 1,
        type: "article",
        title: "hola 1",
        input_message_content: {
          message_text: "string",
        },
        description: "string",
        thumb_url: "https://ofimaniaweb.com/img/miniLogo.webp",
        thumb_width: 100,
        thumb_height: 100,
      },
    ];
  },
};
