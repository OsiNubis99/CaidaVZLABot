var bot = require('./configs/bot');

var Game = require('./class/Game');
var Card = require('./class/Card');
var Player = require('./class/Player');
var bd = require('./configs/bd');

let data = bd.read();

function crear(msg){
	let chatId = msg.chat.id;
	if(data.games["g"+chatId]==null){
		data.games["g"+chatId] = new Game(msg.from.id);
		bot.sendMessage(chatId, "Partida creada!\nPueden unirse con /unirse y empezar el juego con /iniciar");
	}else
		bot.sendMessage(chatId, "La partida ya esta creada!\nPueden unirse con /unirse y empezar el juego con /iniciar");
	bd.write(data);
}

function unirse(msg){
	let chatId = msg.chat.id;
	if(data.games["g"+chatId]!=null){
		if(!data.players["p"+msg.from.id]){
			data.players["p"+msg.from.id] = new Player(msg.from);
		}
		if(!data.games["g"+chatId].players.find( player => player == msg.from.id )){
			data.players["p"+msg.from.id].games.push({title: bot.getChat(chatId).title, id: chatId});
			if(data.games["g"+chatId].players.length < 4){
				data.games["g"+chatId].players.push(msg.from.id);
				bot.sendMessage(chatId, "Bienvenido "+msg.from.first_name+"(@"+msg.from.username+") Te has unido a la partida.");
			}else
				bot.sendMessage(chatId, "Ya la mesa esta llena, espera que la partida actual termine para poder unirte.");
		}else 
			bot.sendMessage(chatId, "Ya estas en esta partida.");
		data.players["p"+msg.from.id].game = chatId;
	}else{
		bot.sendMessage(chatId, "La partida no esta creada!\nCrea una con /crear");
	}
	bd.write(data);
}

function estado(msg){
	let chatId = msg.chat.id;
	if(data.games["g"+chatId]==null){
		bot.sendMessage(chatId, "La partida no esta creada!\nCrea una con /crear");
	}else
		bot.sendMessage(chatId, Game.status(data,chatId));
}

function eliminar(msg){
	let chatId = msg.chat.id;
	if(data.games["g"+chatId]!=null){
		data.games["g"+chatId].players.forEach(id => {
			data.players["p"+id].games.splice(data.players["p"+id].games.indexOf(data.players["p"+id].games.find(value=>{return value.id == chatId})),1)
			if(data.players["p"+id].game == id)
				data.players["p"+id].game = null
		});
		data.games["g"+chatId]= undefined;
		bot.sendMessage(chatId, "Partida eliminada!\nCrea una nueva con /crear");
	}else{
		bot.sendMessage(chatId, "La partida no esta creada!\nCrea una con /crear");
	}
	bd.write(data);
}

function reiniciar(msg){
	let chatId = msg.chat.id;
	data.games["g"+chatId].players.forEach(id => {
		data.players["p"+id].games.splice(data.players["p"+id].games.indexOf(data.players["p"+id].games.find(value=>{return value.id == chatId})),1)
		if(data.players["p"+id].game == id)
			data.players["p"+id].game = null
	});
	data.games["g"+chatId]= new Game(msg.from.id);
	bot.sendMessage(chatId, "La partida ha sido reiniciada!\nPueden unirse con /unirse");
	bd.write(data);
}

function iniciar(msg){
	msg.from
	let chatId = msg.chat.id;
	if(data.games["g"+chatId]!=null){
		if(data.games["g"+chatId].players.length > 1){
			bot.sendMessage(chatId, "Repartiendo...")
			data.games["g"+chatId].player = 0;
			let i,card,order="";
			while(data.games["g"+chatId].cards[0].length<3){
				card = new Card(data.games["g"+chatId].deck.pop());
				while(data.games["g"+chatId].table[card.position]!=null){
					data.games["g"+chatId].deck.unshift(card.number);
					card = new Card(data.games["g"+chatId].deck.pop());
				}
				data.games["g"+chatId].table[card.position] = card;
				order+=card.value+" ";
				i = 0;
				while(i<data.games["g"+chatId].players.length){
					card = new Card(data.games["g"+chatId].deck.pop());
					data.games["g"+chatId].cards[i].push(card)
					i++;
				}
			}
			card = new Card(data.games["g"+chatId].deck.pop());
			while(data.games["g"+chatId].table[card.position]!=null){
				data.games["g"+chatId].deck.unshift(card);
				card = new Card(data.games["g"+chatId].deck.pop());
			}
			data.games["g"+chatId].table[card.position] = card;
			data.games["g"+chatId].card = card;
			order+=card.value+" ";
			bot.sendMessage(chatId, "Jugador actual "+data.players["p"+Game.getPlayer(data.games["g"+chatId])].first_name+"(@"+data.players["p"+Game.getPlayer(data.games["g"+chatId])].username+")\nMesa: "+order);
			}else
				bot.sendMessage(chatId, "Es necesario un minimo de 2 jugadores.");
	}else{
		bot.sendMessage(chatId, "La partida no esta creada!\nCrea una con /crear");
	}
	bd.write(data);
}

bot.onText(/\/crear/, crear);

bot.onText(/\/unirse/, unirse);

bot.onText(/\/estado/, estado);

bot.onText(/\/eliminar/, eliminar);

bot.onText(/\/reiniciar/, reiniciar);

bot.onText(/\/iniciar/, iniciar);

bot.on("inline_query", query => {
	bot.answerInlineQuery(query.id,[{id: "0", type: "document", title: "Hola", document_url: "./hola.pdf", mime_type: "application/pdf"}]);
	console.log(query)
})

bot.on("chosen_inline_result", query => {
	console.log(query.result_id)
})

bot.onText(/\/saluda (.+)/, (msg, match) => {
  let chatId = msg.chat.id;
	let resp = "Hola @"+ msg.from.username+'\nTu mensaje fue: '+ match[1];
	bot.sendMessage(chatId, resp);
	console.log( resp);
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
	let chatGame = data.games["g"+chatId];
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


bot.on("error", err => console.log(err));