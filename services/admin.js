const resp = require("../lang/es");
const bot = require("../config/server");
const env = require("../config/env");
const logger = require("../config/logger");
const message = require("../templates/message");
const { GroupController, UserController } = require("../database");

function is_admin(id) {
	return env.admin_ids.includes(String(id));
}

module.exports = {
	is_admin,

	/**
	 * Ban or unban a user
	 * @param {Factory_Request} req - Clean request data.
	 * @param {Boolean} is_banned - Value of is_banned.
	 * @returns {Promise<Factory_User>} The full User element from database.
	 */
	async ban_unban_user(req, is_banned) {
		if (!is_admin(req.user.id_user)) return resp.no_admin_person;
		if (!req.reply_to) return resp.remember_reply;
		if (await UserController.ban_unban(req.reply_to.user, is_banned))
			return resp.user_banned;
		return resp.user_unbanned;
	},

	/**
	 * Return the list of all groups in a JSON.
	 * @param {Factory_Request} req - Clean request data.
	 */
	async all_groups(req) {
		if (is_admin(req.user.id_user)) {
			return await GroupController.list();
		}
		return [req.group];
	},

	/**
	 * Add a permited group to database. Admin-only.
	 */
	add_group(req, chatId, name) {
		if (!is_admin(req.user.id_user)) return resp.no_admin_person;
		GroupController.add("-" + chatId, name);
		return resp.group_added;
	},

	/**
	 * Extend a group's paid_up_to by N months. Admin-only.
	 */
	async paid(req, chatId, times) {
		if (!is_admin(req.user.id_user)) return resp.no_admin_person;
		const months = parseInt(times, 10);
		if (!Number.isInteger(months) || months <= 0 || months > 120) {
			return resp.invalid_value;
		}
		const group = await GroupController.paid("-" + chatId, months);
		if (!group) return resp.group_invalid;
		return `El grupo ${group.name} sera valido hasta ${group.paid_up_to}`;
	},

	async list_user(msg) {
		if (!is_admin(String(msg.from.id))) return resp.no_admin_person;
		const list = await UserController.list();
		return `La lista de usuarios registrados es: (${list.length})`;
	},

	async list_group(msg) {
		const list = await GroupController.listPublic();
		let reply = "La lista de grupos publicos es:";
		for (const group of list) {
			reply += "\n";
			reply += "\n\t" + group.name;
			try {
				reply += "\nlink: " + (await bot.exportChatInviteLink(group.id_group));
			} catch (err) {
				logger.warn({ err: err.message, group_id: group.id_group }, "exportChatInviteLink failed");
				reply += "\n(link no disponible: " + err.message + ")";
			}
		}
		return reply;
	},

	/**
	 * Remove a group from database. Admin-only — only callable from authenticated paths.
	 * @param {String} requesterId - The Telegram user id requesting removal.
	 * @param {String} id_group - The group id to remove.
	 */
	async force_remove_group(requesterId, id_group) {
		if (!is_admin(String(requesterId))) {
			logger.warn({ requesterId, id_group }, "force_remove_group denied: not admin");
			return null;
		}
		logger.info({ requesterId, id_group }, "force_remove_group");
		return await GroupController.remove(id_group);
	},

	/**
	 * Return nice user stats message.
	 * @param {Factory_Request} req - User request.
	 */
	async get_user_stats(req) {
		const user = await UserController.add(req.user);
		const text =
			`User: ${user.first_name} ${user.last_name}${user.username ? "(@" + user.username + ")" : ""}` +
			`\nJuegos terminados: ${user.finished} \nGanados: ${user.win} \nGanados Custom:${user.win_custom}` +
			`\nCaidas a otros jugadores: ${user.caida}` +
			`\nCaido por otros jugadores: ${user.caido}` +
			`\nRonda: ${user.alive_ronda} vivas / ${user.ronda} cantadas ` +
			`\nChiquire: ${user.alive_chiguire} vivas / ${user.chiguire} cantadas ` +
			`\nPatrulla: ${user.alive_patrulla} vivas / ${user.patrulla} cantadas ` +
			`\nVigia: ${user.alive_vigia} vivas / ${user.vigia} cantadas ` +
			`\nRegistro: ${user.alive_registro} vivas / ${user.registro} cantadas ` +
			`\nMaguaro: ${user.alive_maguaro} vivas / ${user.maguaro} cantadas ` +
			`\nRegistrico: ${user.alive_registrico} vivas / ${user.registrico} cantadas ` +
			`\nCasa chica: ${user.alive_casa_chica} vivas / ${user.casa_chica} cantadas ` +
			`\nCasa grande: ${user.alive_casa_grande} vivas / ${user.casa_grande} cantadas ` +
			`\nTrivilin: ${user.alive_trivilin} vivas / ${user.trivilin} cantadas ` +
			"\n" + (user.is_banned ? "Esta" : "No esta") + " baneado";
		return message.reply(text, req.message_id);
	},
};
