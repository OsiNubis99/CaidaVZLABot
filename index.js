const resp = require("./lang/es");
const bot = require("./config/server");
const game = require("./middleware/game");
const admin = require("./middleware/admin");
const keyboard = require("./templates/keyboard");
const Factory_Request = require("./class/Factory_Request");
const Factory_User = require("./class/Factory_User");

//**                    InLine Query                    */

bot.on("inline_query", (query) => {
	bot.answerInlineQuery(
		query.id,
		game.get_user_cards(Factory_User.fromTelegram(query.from))
	);
});

bot.on("chosen_inline_result", (result) => {
	let response = false;
	if (0 <= result.result_id && result.result_id < 3) {
		response = game.play_card(
			Factory_User.fromTelegram(result.from),
			result.result_id
		);
	} else if (result.result_id == 4) {
		response = game.sing(Factory_User.fromTelegram(result.from));
	} else if (result.result_id == 8) {
		response = game.handing_out_cards(
			Factory_User.fromTelegram(result.from),
			1
		);
	} else if (result.result_id == 9) {
		response = game.handing_out_cards(
			Factory_User.fromTelegram(result.from),
			4
		);
	}
	if (response)
		bot.sendMessage(response.chat_id, response.message, response.options);
});

//**                      CallBacks                      */

bot.on("callback_query", async (query) => {
	let response = "";
	bot.answerCallbackQuery(query.id);
	if (query.data.match(/set_(.*)/)) {
		let game_mode = parseInt(query.data.match(/set_(.*)/)[1]);
		response = await game.set_inline_game_mode(
			Factory_Request.fromTelegram(query.message),
			game_mode
		);
		if (response) bot.editMessageText(response.message, response.options);
	} else {
		switch (query.data) {
			case "how_config":
				bot.editMessageText(resp.how_config, {
					reply_markup: keyboard.back,
					chat_id: query.message.chat.id,
					message_id: query.message.message_id,
				});
				break;
			case "back":
				response = await game.config(
					Factory_Request.fromTelegram(query.message),
					true
				);
				bot.editMessageText(response.message, response.options);
				break;
			case "type":
				response = await game.set_inline_type(
					Factory_Request.fromTelegram(query.message)
				);
				bot.editMessageText(response.message, response.options);
				break;
			case "start":
				response = await game.shuffle(
					Factory_Request.fromTelegram(query.message)
				);
				if (response) {
					bot.editMessageText(response.message, response.options);
					break;
				}
			default:
				bot.deleteMessage(query.message.chat.id, query.message.message_id);
				break;
		}
	}
});

//**                   Admins Commands                   */
//TODO all Admin module

// bot.onText(/\/addGroup/, (msg, match) => {
//   bot.sendMessage(msg.chat.id, admin.add_group(msg), {
//     reply_to_message_id: msg.message_id,
//   });
// });

// bot.onText(/\/lock/, (msg, match) => {
//   bot.sendMessage(msg.chat.id, admin.ban_user(msg), {
//     reply_to_message_id: msg.message_id,
//   });
// });

// bot.onText(/\/unlock/, (msg, match) => {
//   bot.sendMessage(msg.chat.id, admin.unban_user(msg), {
//     reply_to_message_id: msg.message_id,
//   });
// });

// bot.onText(/\/listGroups/, async (msg, match) => {
//   bot.sendMessage(msg.chat.id, await admin.list_group(msg), {
//     reply_to_message_id: msg.message_id,
//   });
// });

// bot.onText(/\/listUsers/, async (msg, match) => {
//   bot.sendMessage(msg.chat.id, await admin.list_user(msg), {
//     reply_to_message_id: msg.message_id,
//   });
// });

// bot.onText(/\/removeGroup/, (msg, match) => {
//   bot.sendMessage(msg.chat.id, admin.remove_group(msg, match), {
//     reply_to_message_id: msg.message_id,
//   });
// });

// bot.onText(/\/admin/, async (msg) => {
//   // await user.add(msg.from);
//   // await user.set_statics(msg.from.id, 1, 3, 5, 0);
//   // console.log( JSON.stringify(await user.statics(msg.from.id)));
//   bot.sendMessage(
//     msg.chat.id,
//     "/addGroup\n/removeGroup\n/lock\n/unlock\n/listGroups\n/listUsers"
//   );
// });

//**                    Game Commands                    */

bot.onText(/\/crear/, async (msg) => {
	let response = await game.create(Factory_Request.fromTelegram(msg), false);
	bot.sendMessage(msg.chat.id, response.message, response.options);
});

bot.onText(/\/reiniciar/, async (msg) => {
	let response = await game.create(Factory_Request.fromTelegram(msg), true);
	bot.sendMessage(msg.chat.id, response.message, response.options);
});

bot.onText(/\/unirse/, async (msg) => {
	let response = await game.join(Factory_Request.fromTelegram(msg));
	bot.sendMessage(msg.chat.id, response.message, response.options);
});

bot.onText(/\/iniciar/, async (msg) => {
	let response = await game.start(Factory_Request.fromTelegram(msg));
	bot.sendMessage(msg.chat.id, response.message, response.options);
});

bot.onText(/\/inicia_ya/, async (msg) => {
	let response = await game.shuffle(Factory_Request.fromTelegram(msg), false);
	bot.sendMessage(msg.chat.id, response.message, response.options);
});

bot.onText(/\/estado/, async (msg) => {
	let response = await game.status(Factory_Request.fromTelegram(msg));
	bot.sendMessage(msg.chat.id, response.message, response.options);
});

bot.onText(/\/configurar/, async (msg) => {
	let response = await game.config(Factory_Request.fromTelegram(msg));
	bot.sendMessage(msg.chat.id, response.message, response.options);
});

bot.onText(/\/set_(.*) (.*)/, async (msg, match) => {
	let response = await game.set_settings(
		Factory_Request.fromTelegram(msg),
		match[1],
		match[2]
	);
	bot.sendMessage(msg.chat.id, response.message, response.options);
});

bot.onText(/\/set_(.*)/, (msg, match) => {
	bot.sendMessage(msg.chat.id, resp.set_invalid);
});

bot.onText(/\/log/, (msg) => {
	console.log(game.log());
	bot.sendMessage(msg.chat.id, "log");
});

//**                     Set Commands                    */

bot.setMyCommands([
	{
		command: "crear",
		description: "Crea una nueva partida.",
	},
	{
		command: "unirse",
		description: "Te agrega a la partida.",
	},
	{
		command: "iniciar",
		description: "Inicia la partida.",
	},
	{
		command: "inicia_ya",
		description: "Inicia la partida, pero se salta las configuraciones",
	},
	{
		command: "estado",
		description: "Muestra información sobre la partida.",
	},
	{
		command: "reiniciar",
		description: "Elimina la partida actual y crea una nueva.",
	},
	{
		command: "configurar",
		description: "Muestra el pane de configuración.",
	},
]);
