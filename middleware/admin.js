const TelegramBot = require("node-telegram-bot-api");

const resp = require("../lang/es");
const bot = require("../configs/bot");
const {
  group,
  user,
  game,
  game_user,
  user_sing,
  user_user,
} = require("../controller/controller");

var admins = [114083702, 1088289802, 854224796, 355968156];

function is_admin(id) {
  if (admins.indexOf(id) >= 0) return true;
  return false;
}

module.exports = {
  ban_user(msg) {
    if (is_admin(msg.from.id)) {
      if (msg.reply_to_message) {
        if (!msg.reply_to_message.from.is_bot) {
          user.ban(msg.reply_to_message.from);
          return resp.user_banned;
        } else {
          return resp.no_ban_groups;
        }
      } else {
        return resp.remember_reply;
      }
    } else {
      return resp.no_admin_person;
    }
  },
  create(msg) {
    if (msg.chat.type == "supergroup" || msg.chat.type == "group") {
      group.add(msg.chat);
      return resp.group_added;
    } else {
      return resp.is_not_a_group;
    }
  },
  join(msg) {
    user.add(msg.from);
    return resp.user_added;
  },
  async list_user(msg) {
    if (is_admin(msg.from.id)) {
      var list = await user.list();
      var reply = "La lista de usuarios registrados es:";
      list.forEach((user) => {
        reply +=
          "\n" +
          user.first_name +
          " " +
          (user.last_name ? user.last_name : "" + ":");
        reply += "\nid: " + user.id_user;
        reply +=
          "\nusername: " + (user.username ? "@" + user.username : "Undefined");
        reply += user.is_banned ? "\nNo Puede Jugar" : "\nPuede Jugar";
        reply += "\n";
      });
      return reply;
    } else {
      return resp.no_admin_person;
    }
  },
  unban_user(msg) {
    if (is_admin(msg.from.id)) {
      if (msg.reply_to_message) {
        if (!msg.reply_to_message.from.is_bot) {
          user.unban(msg.reply_to_message.from);
          return resp.user_unbanned;
        } else {
          return resp.no_unban_groups;
        }
      } else {
        return resp.remember_reply;
      }
    } else {
      return resp.no_admin_person;
    }
  },
};
