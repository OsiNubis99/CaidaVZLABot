var Game = require('./class/Game');
var Player = require('./class/Player');
var bd = require('./configs/bd');

let data = bd.read();

function crear(msg){
	let chatId = msg.chat.id;
	if(data.games["g"+chatId]==null){
		data.games["g"+chatId] = new Game(msg.from.id);
		console.log("Partida creada!\nPueden unirse con /unirse y empezar el juego con /iniciar");
	}else
		console.log("La partida ya esta creada!\nPueden unirse con /unirse y empezar el juego con /iniciar");
	bd.write(data);
}

function unirse(msg){
	let chatId = msg.chat.id;
	if(data.games["g"+chatId]!=null){
		if(!data.players["p"+msg.from.id]){
			data.players["p"+msg.from.id] = new Player(msg.from);
		}
		if(!data.games["g"+chatId].players.find( player => player == msg.from.id )){
			data.players["p"+msg.from.id].games.push({title: "bot.getChat(chatId).title", id: chatId});
			if(data.games["g"+chatId].players.length < 4){
				data.games["g"+chatId].players.push(msg.from.id);
				console.log("Bienvenido "+msg.from.first_name+"(@"+msg.from.username+") Te has unido a la partida.");
			}else
				console.log("Ya la mesa esta llena, espera que la partida actual termine para poder unirte.");
		}else 
			console.log("Ya estas en esta partida.");
	}else{
		console.log("La partida no esta creada!\nCrea una con /crear");
	}
	bd.write(data);
}

function estado(msg){
	let chatId = msg.chat.id;
	if(data.games["g"+chatId]==null){
		console.log("La partida no esta creada!\nCrea una con /crear");
	}else
		console.log(Game.status(data.games["g"+chatId],data.players));
}

crear({chat:{id:223},from:{id:99}})
unirse({chat:{id:223},from:{id:99,first_name:"Andresito",username:"OsiNubis99"}})
estado({chat:{id:223}})