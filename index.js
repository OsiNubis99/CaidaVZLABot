var game = require('./class/game');
var bot = require('./configs/bot');
var bd = require('./configs/bd');

let data = bd.read();

bot.on("inline_query", query => {
	bot.answerInlineQuery(query.id,[{id: "0", type: "document", title: "Hola", document_url: "./hola.pdf", mime_type: "application/pdf"}]);
	console.log(query)
})

bot.on("chosen_inline_result", query => {
	console.log(query.result_id)
})

bot.onText(/\/crear/, msg => {
	let chatId = msg.chat.id;
	let resp="";
	if(data["g"+chatId]==null){
		data["g"+chatId]= new game({name:msg.from.first_name,username:msg.from.username},chatId);
		resp = "Partida creada!\nPueden unirse con /unirse y empezar el juego con /iniciar"; 
	}else
		resp = "La partida ya esta creada!\nPueden unirse con /unirse y empezar el juego con /iniciar"
	bot.sendMessage(chatId, resp);
	bd.write(data);
});

bot.onText(/\/unirse/, msg => {
	let chatId = msg.chat.id;
	if(data["g"+chatId]!=null){
		game.join(data["g"+chatId],{name:msg.from.first_name,username:msg.from.username})
	}else{
		let resp = "La partida no esta creada!\nCrea una con /crear"
		bot.sendMessage(chatId, resp);
	}
	bd.write(data);
});

bot.onText(/\/reiniciar/, msg => {
	let chatId = msg.chat.id;
	data["g"+chatId]= new game({name:msg.from.first_name,username:msg.from.username},chatId);
	let resp = "La partida reiniciada!\nPueden unirse con /unirse"
	bot.sendMessage(chatId, resp);
	bd.write(data);
});

bot.onText(/\/eliminar/, msg => {
	let chatId = msg.chat.id;
	let resp = "";
	if(data["g"+chatId]!=null){
		data["g"+chatId]= null;
		resp = "Partida eliminada!\nCrea una nueva con /crear";
	}else{
		resp = "La partida no esta creada!\nCrea una con /crear"
	}
	bot.sendMessage(chatId, resp);
	bd.write(data);
});

bot.onText(/\/iniciar/, msg => {
	let chatId = msg.chat.id;
	if(data["g"+chatId]!=null){
		game.start(data["g"+chatId]);
	}else{
		let resp = "La partida no esta creada!\nCrea una con /crear"
		bot.sendMessage(chatId, resp);
	}
	bd.write(data);
});

bot.onText(/\/saluda (.+)/, (msg, match) => {
  let chatId = msg.chat.id;
	let resp = "Hola @"+ msg.from.username+'\nTu mensaje fue: '+ match[1];
  bot.sendMessage(chatId, resp);
	bd.write(data);
});

bot.onText(/\/prueba1 (.+)/, (msg, match) => {
  let chatId = msg.chat.id;
	let resp = "Hola @"+ msg.from.username+'\nTu mensaje fue: '+ match[1];
	bot.sendSticker(chatId, "./images/webp/b_1.webp",{},{contentType:"image/webp"});
  bot.sendMessage(chatId, resp);
});

bot.onText(/\p (.+)/, (msg, match) => {
	let chatId = msg.chat.id;
	let chatGame = data["g"+chatId];
	if(chatGame.started){
		if(game.getPlayer(chatGame).username!=msg.from.username)
			game.status(chatGame)
		else{
			let resp = match[1]+", Hola @"+ msg.from.username;
			bot.sendMessage(chatId, resp);
		}
	}else{
		bot.sendMessage(chatId, "El juego aun no empieza, usa /iniciar");
	}
	bd.write(data);
});


bot.on("inline_query", err => console.log(err));