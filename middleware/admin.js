const bot = require("../configs/bot");
const database = require("../configs/db");
const resp = require("../lang/es");

var admins = [114083702, 1088289802, 854224796, 355968156];

function is_admin(id) {
  if (admins.indexOf(id) >= 0) return true;
  return false;
}

module.exports = {
  create(msg) {
    if (msg.chat.type == "supergroup" || msg.chat.type == "group") {
      database.add_group(msg.chat);
      return resp.group_added;
    } else {
      return resp.is_not_a_group;
    }
  },
  join(msg) {
    database.add_user(msg.from);
    return resp.user_added;
  },
  ban_user(msg) {
    if (is_admin(msg.from.id)) {
      if (msg.reply_to_message) {
        database.ban_user(msg.reply_to_message.from);
        return resp.user_banned;
      } else {
        return resp.remember_reply;
      }
    } else {
      return resp.no_admin_person;
    }
  },
  unban_user(msg) {
    if (is_admin(msg.from.id)) {
      if (msg.reply_to_message) {
        database.unban_user(msg.reply_to_message.from);
        return resp.user_unbanned;
      } else {
        return resp.remember_reply;
      }
    } else {
      return resp.no_admin_person;
    }
  },
};
