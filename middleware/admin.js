const resp = require("../lang/es");
const bot = require("../config/bot");
const {
  group,
  user,
  game,
  game_user,
  user_sing,
  user_user,
} = require("../controller");

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
  add_group(msg) {
    if (is_admin(msg.from.id)) {
      if (msg.chat.type == "supergroup" || msg.chat.type == "group") {
        group.add(msg.chat);
        return resp.group_added;
      } else {
        return resp.is_not_a_group;
      }
    } else {
      return resp.no_admin_person;
    }
  },
  async list_user(msg) {
    if (is_admin(msg.from.id)) {
      var list = await user.list();
      var reply = "La lista de usuarios registrados es:";
      list.forEach((user) => {
        reply +=
          "\n\t" +
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
  async list_group(msg) {
    if (is_admin(msg.from.id)) {
      var list = await group.list();
      var reply = "La lista de grupos registrados es:";
      list.forEach((group) => {
        reply += "\n\t" + group.name;
        reply += "\nid: " + group.id_group;
        reply += "\n";
      });
      return reply;
    } else {
      return resp.no_admin_person;
    }
  },
  remove_group(msg, match) {
    if (is_admin(msg.from.id)) {
      let groups = match[1].split(" ");
      groups.shift();
      groups.forEach((id_group) => {
        group.remove(id_group);
      });
      return resp.group_removed;
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
