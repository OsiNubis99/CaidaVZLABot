// TODO all admin module
const resp = require("../lang/es");
const Factory_User = require("../class/Factory_User");
const Factory_Request = require("../class/Factory_Request");
const { GroupController, UserController } = require("../database");

var admins = ['114083702'];

function is_admin(id) {
	return admins.indexOf(id) >= 0;
}

module.exports = {
	/**
	 * Ban or unban a user
	 * @param {Factory_Request} req - Clean request data.
	 * @param {Boolean} is_banned - Value of is_banned.
	 * @returns {Promise<Factory_User>} The full User element from database.
	 */
	async ban_unban_user(req, is_banned) {
		if (is_admin(req.user.id_user)) {
			if (req.reply_to) {
				await UserController.ban_unban(req.reply_to.user, is_banned);
				if (is_banned)
					return resp.user_banned;
				else
					return resp.user_unbanned;
			} else {
				return resp.remember_reply;
			}
		} else {
			return resp.no_admin_person;
		}
	},


	/**
	 * Return the list of all groups in a JSON.
	 * @param {Factory_Request} req - Clean request data.
	 */
	async all_groups(req) {
		if (is_admin(req.user.id_user)) {
			var list = await GroupController.list();
			return list;
		} else {
			return [req.group];
		}
	},
	// TODO
	async list_user(msg) {
		if (is_admin(msg.from.id.toString())) {
			var list = await UserController.list();
			var reply = `La lista de usuarios registrados es: (${list.length})`;
			list.forEach((user) => {
				reply +=
					"\n- " +
					user.first_name +
					" " +
					(user.last_name ? user.last_name : "" + ":");
				reply += "\n\tid: " + user.id_user;
				reply +=
					"\n\tusername: " +
					(user.username ? "@" + user.username : "Undefined");
				reply += "\n\t" + (user.is_banned ? "No " : "") + "Puede Jugar";
				reply += "\n";
			});
			return reply;
		} else {
			return resp.no_admin_person;
		}
	},
	// TODO
	async list_group(msg) {
		if (is_admin(msg.from.id.toString())) {
			var list = await GroupController.list();
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
	// TODO
	add_group(msg) {
		if (is_admin(msg.from.id.toString())) {
			if (msg.chat.type == "supergroup" || msg.chat.type == "group") {
				GroupController.add(msg.chat);
				return resp.group_added;
			} else {
				return resp.is_not_a_group;
			}
		} else {
			return resp.no_admin_person;
		}
	},
	// TODO
	remove_group(msg, match) {
		if (is_admin(msg.from.id)) {
			let groups = match[1].split(" ");
			groups.shift();
			groups.forEach((id_group) => {
				GroupController.remove(id_group);
			});
			return resp.group_removed;
		} else {
			return resp.no_admin_person;
		}
	},
};
