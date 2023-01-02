const resp = require("../lang/es");
const bot = require("../config/server");
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
				if (await UserController.ban_unban(req.reply_to.user, is_banned))
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
			return await GroupController.list();
		} else {
			return [req.group];
		}
	},

	/**
	 * Add a permited group to database
	 */
	add_group(req, chatId, name) {
		if (is_admin(req.user.id_user) || chatId) {
			GroupController.add("-" + chatId, name);
			return resp.group_added;
		}
		return resp.no_admin_person;
	},

	/**
	 * Add a permited group to database
	 */
	async paid(req, chatId, times) {
		if (is_admin(req.user.id_user) || chatId) {
			let group = await GroupController.paid("-" + chatId, times);
			return `El grupo ${group.name} sera valido hasta ${group.paid_up_to}`;
		}
		return resp.no_admin_person;
	},
	// TODO
	async list_user(msg) {
		if (is_admin(msg.from.id.toString())) {
			var list = await UserController.list();
			var reply = `La lista de usuarios registrados es: (${list.length})`;
			return reply;
		} else {
			return resp.no_admin_person;
		}
	},
	// TODO
	async list_group(msg) {
		var list = await GroupController.listPublic();
		var reply = "La lista de grupos publicos es:";
		for (var i = 0; i < list.length; ++i) {
			let group = list[i]
			reply += "\n";
			reply += "\n\t" + group.name;
			reply += "\nlink: " + await bot.exportChatInviteLink(group.id_group)
		}
		return reply;
	},
	// TODO
	/**
	 * Return the list of all groups in a JSON.
	 * @param {String} id_group - Clean request data.
	 */
	async force_remove_group(id_group) {
		return await GroupController.remove(id_group);
	},
};
