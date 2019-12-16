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
			if(data.players["p"+id].game == chatId)
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
			let card,order="";
			while(data.games["g"+chatId].cards[0].length<3){
				data.games["g"+chatId].deck = Game.barajar()
				card = new Card(data.games["g"+chatId].deck.pop());
				while(data.games["g"+chatId].table[card.position]!=null){
					data.games["g"+chatId].deck.unshift(card.number);
					card = new Card(data.games["g"+chatId].deck.pop());
				}
				data.games["g"+chatId].table[card.position] = card;
				order+=card.value+" ";
				Game.repartir(data.games["g"+chatId])
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

function jugarCarta(msg,match){
	playerId = msg.from.id;
	if(data.players["p"+playerId].game){
		chatId = data.players["p"+playerId].game;
		if(data.games["g"+chatId].player != null){
			if(Game.getPlayer(data.games["g"+chatId])==playerId){// si es el turno
				card = data.games["g"+chatId].cards[data.games["g"+chatId].player].splice(match[1],1)[0]
				if(data.games["g"+chatId].table[card.position]==null){
					data.games["g"+chatId].table[card.position] = card;
				}else{
					data.games["g"+chatId].lastTaked = data.games["g"+chatId].player;
					if(data.games["g"+chatId].card.value==card.value&&data.games["g"+chatId].table[card.position]!=null){
						data.games["g"+chatId].points[data.games["g"+chatId].player]+=card.value==10?2:card.value==11?3:card.value==12?4:1;
						bot.sendMessage(chatId, "Caidoooo")
					}
					let i = card.position;
					while(i<10 && data.games["g"+chatId].table[i]!=null){
						data.games["g"+chatId].taked[data.games["g"+chatId].player]++;
						data.games["g"+chatId].table[i] = null;
						i++;
					}
					i=0;
					while(i<10 && data.games["g"+chatId].table[i]==null){
						i++;
					}
					if(i==10){
						bot.sendMessage(chatId, "mesa limpia")
						data.games["g"+chatId].points[data.games["g"+chatId].player]+=4;
					}
				}
				data.games["g"+chatId].card = card;
				if(!((data.games["g"+chatId].player+1)%data.games["g"+chatId].players.length) && !data.games["g"+chatId].cards[0].length){
					if(!data.games["g"+chatId].deck.length){
						let j=0,i=0;
						while(i<10){
							if(data.games["g"+chatId].table[i]!=null){
								data.games["g"+chatId].table[i] = null;
								j++;
							}
							i++;
						}
						if(data.games["g"+chatId].lastTaked != null){
							data.games["g"+chatId].taked[data.games["g"+chatId].lastTaked] += j;
						}else{
							data.games["g"+chatId].taked[data.games["g"+chatId].players.length-1] += j;
						}
						bot.sendMessage(chatId, "Repartiendo...")
						let card,order="";
						data.games["g"+chatId].card = null;
						while(data.games["g"+chatId].cards[0].length<3){
							card = new Card(data.games["g"+chatId].deck.pop());
							while(data.games["g"+chatId].table[card.position]!=null){
								data.games["g"+chatId].deck.unshift(card.number);
								card = new Card(data.games["g"+chatId].deck.pop());
							}
							data.games["g"+chatId].table[card.position] = card;
							order+=card.value+" ";
							Game.repartir(data.games["g"+chatId],true)
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
					}else{
						let i = 0
						while(i < 3){
							Game.repartir(data.games["g"+chatId]);
							i++;
						}
					}
				}
				if(data.games["g"+chatId].points[data.games["g"+chatId].player]>23){
					bot.sendMessage(chatId, "Gano: "+data.players["p"+playerId].first_name+" (@"+data.players["p"+playerId].username+")")
					data.games["g"+chatId].players.forEach(id => {
						data.players["p"+id].games.splice(data.players["p"+id].games.indexOf(data.players["p"+id].games.find(value=>{return value.id == chatId})),1)
						if(data.players["p"+id].game == chatId)
							data.players["p"+id].game = null
					});
					data.games["g"+chatId]= undefined;
					bot.sendMessage(chatId, "Partida finalizada!\nCrea una nueva con /crear");
				}else{
					data.games["g"+chatId].player =  (data.games["g"+chatId].player+1)%data.games["g"+chatId].players.length;
					estado({chat:{id:chatId}});
					verCartas({from:{id:data.games["g"+chatId].players[data.games["g"+chatId].player]}});
				}
			} 
			else{// no es el turno
				estado({chat:{id:chatId}});
			}
		}else{// aun no empieza la partida
		}
	}else{// no se ha unido a algun juego
	}
	bd.write(data);
}

function verCartas(msg){
	playerId = msg.from.id;
	chatId = playerId;
	if(data.players["p"+playerId].game!=null){
		if(data.games["g"+data.players["p"+playerId].game].player!=null){
			let resp = "Tus cartas son:",i=0;
			for(c of data.games["g"+data.players["p"+playerId].game].cards[data.games["g"+data.players["p"+playerId].game].players.indexOf(playerId)]){
				resp+="\n"+i+": "+c.value;
				i++;
			}
			bot.sendMessage(chatId, resp)
		}else{
			bot.sendMessage(chatId, "El juego aun no empieza")
		}
	}else{
		bot.sendMessage(chatId, "No se ha unido a algun juego")
	}
}

bot.onText(/\/crear/, crear);

bot.onText(/\/unirse/, unirse);

bot.onText(/\/estado/, estado);

bot.onText(/\/eliminar/, eliminar);

bot.onText(/\/reiniciar/, reiniciar);

bot.onText(/\/jugar (.+)/, jugarCarta);

bot.onText(/\/verCartas/, verCartas);

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