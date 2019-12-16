var Game = require('./class/Game');
var Card = require('./class/Card');
var Player = require('./class/Player');
var bd = require('./configs/bd');

let data = bd.read();

function crear(msg){
	let chatId = msg.chat.id;
	if(data.games["g"+chatId]==null){
		data.games["g"+chatId] = new Game(msg.from.id);
		console.log( "Partida creada!\nPueden unirse con /unirse y empezar el juego con /iniciar");
	}else
		console.log( "La partida ya esta creada!\nPueden unirse con /unirse y empezar el juego con /iniciar");
	bd.write(data);
}

function unirse(msg){
	let chatId = msg.chat.id;
	if(data.games["g"+chatId]!=null){
		if(!data.players["p"+msg.from.id]){
			data.players["p"+msg.from.id] = new Player(msg.from);
		}
		if(!data.games["g"+chatId].players.find( player => player == msg.from.id )){
			data.players["p"+msg.from.id].games.push({title: "Offline", id: chatId});
			if(data.games["g"+chatId].players.length < 4){
				data.games["g"+chatId].players.push(msg.from.id);
				console.log( "Bienvenido "+msg.from.first_name+"(@"+msg.from.username+") Te has unido a la partida.");
			}else
				console.log( "Ya la mesa esta llena, espera que la partida actual termine para poder unirte.");
		}else 
			console.log( "Ya estas en esta partida.");
		data.players["p"+msg.from.id].game = chatId;
	}else{
		console.log( "La partida no esta creada!\nCrea una con /crear");
	}
	bd.write(data);
}

function estado(msg){
	let chatId = msg.chat.id;
	if(data.games["g"+chatId]==null){
		console.log( "La partida no esta creada!\nCrea una con /crear");
	}else
		console.log( Game.status(data,chatId));
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
		console.log( "Partida eliminada!\nCrea una nueva con /crear");
	}else{
		console.log( "La partida no esta creada!\nCrea una con /crear");
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
	console.log( "La partida ha sido reiniciada!\nPueden unirse con /unirse");
	bd.write(data);
}

function iniciar(msg){
	msg.from
	let chatId = msg.chat.id;
	if(data.games["g"+chatId]!=null){
		if(data.games["g"+chatId].players.length > 1){
			console.log( "Repartiendo...")
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
			console.log( "Jugador actual "+data.players["p"+Game.getPlayer(data.games["g"+chatId])].first_name+"(@"+data.players["p"+Game.getPlayer(data.games["g"+chatId])].username+")\nMesa: "+order);
			}else
				console.log( "Es necesario un minimo de 2 jugadores.");
	}else{
		console.log( "La partida no esta creada!\nCrea una con /crear");
	}
	bd.write(data);
}

// eliminar({chat:{id:12532561}})
// eliminar({chat:{id:12532562}})
eliminar({chat:{id:12532563}})
crear({chat:{id:12532563},from:{id:1528475655}})
// crear({chat:{id:12532562},from:{id:1528475655}})
// eliminar({chat:{id:12532562}})
// crear({chat:{id:12532561},from:{id:1528475655}})
unirse({chat:{id:12532563},from:{id:1528475655,first_name:"Andresito",username:"OsiNubis99"}})
// unirse({chat:{id:12532561},from:{id:1528475655,first_name:"Andresito",username:"OsiNubis99"}})
unirse({chat:{id:12532563},from:{id:2865565235,first_name:"Mafercita",username:"MafeerLourenco"}})
// unirse({chat:{id:12532561},from:{id:2865565235,first_name:"Mafercita",username:"MafeerLourenco"}})
// reiniciar({chat:{id:12532561},from:{id:1528475655}})
iniciar({chat:{id:12532563}})
estado({chat:{id:12532563}})