const resp = require("../lang/es");
const Game = require("../class/game");
const User = require("../class/user");
const Config = require("../class/config");
const keyboard = require("../config/keyboard");
const {
  group,
  user,
  game,
  game_user,
  user_sing,
  user_user,
} = require("../controller");

var games = new Array();

function message_reply(message, message_id) {
  return {
    message: message,
    options: {
      reply_to_message_id: message_id,
    },
  };
}
function message_keyboard(message, reply_keyboard) {
  return {
    message: message,
    options: {
      reply_markup: reply_keyboard,
    },
  };
}

module.exports = {
  async get_group_configs(msg, force = false) {
    let chatid = String.toString(msg.chat.id);
    if (force || !games[chatid]) {
      let configs = await group.add(msg.chat);
      games[chatid] = new Game(new Config(configs));
    }
    return games[chatid].config.print();
  },
  async set_settings(msg, config, value) {
    if (msg.chat.type == "supergroup" || msg.chat.type == "group") {
      let chatid = String.toString(msg.chat.id);
      await this.get_group_configs(msg);
      if (games[chatid].config.is_ok(config, value)) {
        let rows = await group.update(msg.chat.id, config, value);
        if (rows.length == 1) {
          games[chatid].config = new Config(rows[0]);
          return message_keyboard(
            games[chatid].config.print(),
            keyboard.group_settings
          );
        }
      }
      return message_reply(resp.invalid_value, msg.message_id);
    }
    return message_reply(resp.is_not_a_group, msg.message_id);
  },
  async create(msg, force) {
    if (msg.chat.type == "supergroup" || msg.chat.type == "group") {
      let chatid = String.toString(msg.chat.id);
      if (force || !games[chatid] || !games[chatid].player) {
        return message_keyboard(
          await this.get_group_configs(msg, force),
          keyboard.group_settings
        );
      }
      return message_reply(resp.game_is_running, msg.message_id);
    }
    return message_reply(resp.is_not_a_group, msg.message_id);
  },
  async join(msg) {
    let player = new User(await user.add(msg.from));
    if (!player.is_banned) {
      let chatid = String.toString(msg.chat.id);
      if (games[chatid]) {
      } else {
        return resp.game_no_started;
      }
    } else {
      return resp.user_is_banned;
    }
  },
  async get_user_cards() {
    return [
      {
        id: 1,
        type: "article",
        title: "holi 1",
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
