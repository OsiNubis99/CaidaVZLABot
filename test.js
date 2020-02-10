var Game = require('./class/Game');
var Card = require('./class/Card');
var Sing = require('./class/Sing');
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

function eliminar(msg){
	let chatId = msg.chat.id;
	if(data.games["g"+chatId]!=null){
		data.games["g"+chatId].players.forEach(id => {
			data.players["p"+id].games.splice(data.players["p"+id].games.indexOf(data.players["p"+id].games.find(value=>{return value.id == chatId})),1)
			if(data.players["p"+id].game == chatId){
				data.players["p"+id].game = null;
			}
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
		if(data.players["p"+id].game == chatId){
			data.players["p"+id].game = null;
		}
	});
	data.games["g"+chatId]= new Game(msg.from.id);
	console.log( "La partida ha sido reiniciada!\nPueden unirse con /unirse");
	bd.write(data);
}

function unirse(msg){
	let chatId = msg.chat.id;
	if(!data.players["p"+msg.from.id]){
		data.players["p"+msg.from.id] = new Player(msg.from);
	}else{
		data.players["p"+msg.from.id].first_name = msg.from.first_name;
		data.players["p"+msg.from.id].username = msg.from.username;
	}
	if(data.games["g"+chatId]!=null){
		if(!data.games["g"+chatId].players.find( player => player == msg.from.id )){
			if(!data.games["g"+chatId].player){
				if(data.games["g"+chatId].players.length < 4){
					// let chat = bot.getChat(chatId);
					data.players["p"+msg.from.id].games.unshift({title: "chat.title", id: chatId});
					data.games["g"+chatId].players.unshift(msg.from.id);
					data.games["g"+chatId].head =	data.games["g"+chatId].players.length-1;
					console.log( "Bienvenido "+msg.from.first_name+"(@"+msg.from.username+") Te has unido a la partida.");
				}else{
					console.log( "Ya la mesa esta llena, espera que la partida actual termine para poder unirte.");
				}
			}else{
				console.log( "Ya la partida inicio, espera que la partida actual termine para poder unirte.");
			}
		}else {
			console.log( "Ya estas en esta partida.");
		}
		data.players["p"+msg.from.id].game = chatId;
	}else{
		console.log( "La partida no esta creada!\nCrea una con /crear");
	}
	bd.write(data);
}

function configurar(msg,match){
	let chatId = msg.chat.id;
	if(data.games["g"+chatId]!=null){	
		if(match["input"]=="/configurar"){
			bot.sendMessage( chatId, 
				"Se empieza a repartir por el " + data.games["g"+chatId].configs.start + 
				"\n Para cambiar este valor envia:\n /configurar iniciar 4 o iniciar 1" + 
				"\nPronto agregaremos mas configuraciones")
		}else{
			if(match[1]=="iniciar 1"||match[1]=="iniciar 4"){
				data.games["g"+chatId].configs.start = (match[1]=="iniciar 1")?1:4;
				bot.sendMessage( chatId, "Iniciare por el "+data.games["g"+chatId].configs.start);
			}else{
				bot.sendMessage( chatId, "Comando desconocido.\nEnvia /configurar para leer mas...")
			}
		}
	}else{
		console.log( "La partida no esta creada!\nCrea una con /crear");
	}
	bd.write(data);
}

function iniciar(msg){
	msg.from
	let chatId = msg.chat.id;
	if(data.games["g"+chatId]!=null){
		if(data.games["g"+chatId].player==null){
			if(data.games["g"+chatId].head == 1||data.games["g"+chatId].head == 3){
				console.log( "Repartiendo...")
				data.games["g"+chatId].player = 0;
				let card,order=[];
				data.games["g"+chatId].deck = Game.barajar()
				while(data.games["g"+chatId].cards[0].length<3){
					card = new Card(data.games["g"+chatId].deck.pop());
					while(data.games["g"+chatId].table[card.position]!=null){
						data.games["g"+chatId].deck.unshift(card.number);
						card = new Card(data.games["g"+chatId].deck.pop());
					}
					data.games["g"+chatId].table[card.position] = card;
					order.push(card.value);
					Game.repartir(data.games["g"+chatId])
				}
				card = new Card(data.games["g"+chatId].deck.pop());
				while(data.games["g"+chatId].table[card.position]!=null){
					data.games["g"+chatId].deck.unshift(card);
					card = new Card(data.games["g"+chatId].deck.pop());
				}
				data.games["g"+chatId].table[card.position] = card;
				data.games["g"+chatId].card = card;
				order.push(card.value);
				let points=0;
				if(data.games["g"+chatId].configs.start==1){
					if(order[0]==1){
						points+=1;
					}
					if(order[1]==2){
						points+=2;
					}
					if(order[2]==3){
						points+=3;
					}
					if(order[3]==4){
						points+=4;
					}
				}else{
					if(order[3]==1){
						points+=1;
					}
					if(order[2]==2){
						points+=2;
					}
					if(order[1]==3){
						points+=3;
					}
					if(order[0]==4){
						points+=4;
					}
				}
				if(points>0){
					data.games["g"+chatId].points[1]+=points
				}else{
					data.games["g"+chatId].points[0]+= 1
				}
				console.log( "Primer jugador: "+data.players["p"+data.games["g"+chatId].players[0]].first_name+"(@"+data.players["p"+data.games["g"+chatId].players[0]].username+")\nMesa: "+order);
				verCartas({from:{id:data.games["g"+chatId].players[data.games["g"+chatId].player]}});
			}else{
				console.log( "Es necesario 2 o 4 jugadores.");
			}
		}else{
			console.log( "Ya la partida inicio!");
		}
	}else{
		console.log( "La partida no esta creada!\nCrea una con /crear");
	}
	bd.write(data);
}

function estado(msg){
	let chatId = msg.chat.id;
	if(data.games["g"+chatId]==null){
		console.log( "La partida no esta creada!\nCrea una con /crear");
	}else{
		console.log( Game.status(data,chatId, false));
	}
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
			console.log( resp)
		}else{
			console.log( "El juego aun no empieza")
		}
	}else{
		console.log( "No se ha unido a ningun juego")
	}
}

function cantar(msg,match){
	playerId = msg.from.id;
	if(data.players["p"+playerId].game!=null){
		let chatId = data.players["p"+playerId].game;
		if(data.games["g"+chatId].player!=null){
			let team = data.games["g"+chatId].players.indexOf(playerId);
			if(data.games["g"+chatId].cards[team].length==3){
				if(data.games["g"+chatId].sings[team].name=="Tres Cartas"){
					data.games["g"+chatId].sings[team] = new Sing(match[1],data.games["g"+chatId].cards[team])
					console.log( "@"+data.players["p"+playerId].username+" canto "+data.games["g"+chatId].sings[team].name)
					verCartas({from:{id:playerId}});
				}else{
					console.log( "Ya Cantaste "+data.games["g"+chatId].sings[team].name)
				}
			}else{
				console.log( "Solo puedes cantar cuando tienes 3 cartas")
			}
		}else{
			console.log( "El juego aun no empieza")
		}
	}else{
		console.log( "No se ha unido a ningun juego")
	}
	bd.write(data);	
}

function jugarCarta(msg,match){
	playerId = msg.from.id;
	//Juego encontrado
	if(data.players["p"+playerId] && data.players["p"+playerId].game){
		let chatId = data.players["p"+playerId].game;
		//Si empezada
		if(data.games["g"+chatId].player != null){
			//Si es el turno
			if(Game.getPlayer(data.games["g"+chatId])==playerId){
				card = data.games["g"+chatId].cards[data.games["g"+chatId].player].splice(match[1],1)[0];
				//Primera Carta  y canto algo
				if(data.games["g"+chatId].cards[data.games["g"+chatId].player].length==2 && !(data.games["g"+chatId].sings[data.games["g"+chatId].player].name=="Tres Cartas" || data.games["g"+chatId].sings[data.games["g"+chatId].player].name=="Un Mal Canto")){
					data.games["g"+chatId].sings[data.games["g"+chatId].player].name+=" al "+card.value;
				}
				//No esta card en la mesa
				if(data.games["g"+chatId].table[card.position]==null){
					data.games["g"+chatId].table[card.position] = card;
				}
				//Si esta en la mesa
				else{
					data.games["g"+chatId].lastTaked = data.games["g"+chatId].player;
					//Caida
					if(data.games["g"+chatId].card.value==card.value&&data.games["g"+chatId].table[card.position]!=null){
						let anterior = data.games["g"+chatId].player - 1;
						anterior = anterior<0?data.games["g"+chatId].head:anterior;
						data.games["g"+chatId].sings[anterior].value = 0;
						data.games["g"+chatId].points[data.games["g"+chatId].player%2]+=card.value==10?2:card.value==11?3:card.value==12?4:1;
						console.log( "Caído")
					}
					let i = card.position;
					//Agarrando la carta y sus siguientes disponibles
					data.games["g"+chatId].taked[data.games["g"+chatId].player%2]++;
					while(i<10 && data.games["g"+chatId].table[i]!=null){
						data.games["g"+chatId].taked[data.games["g"+chatId].player%2]++;
						data.games["g"+chatId].table[i] = null;
						i++;
					}
					i=0;
					//Verificando cartas en mesa
					while(i<10 && data.games["g"+chatId].table[i]==null){
						i++;
					}
					//Mesa limpia
					if(i==10 && !data.games["g"+chatId].lastOne){
						data.games["g"+chatId].points[data.games["g"+chatId].player%2]+=4;
						console.log( "Mesa Limpia!!! +4ptos")
					}
				}
				data.games["g"+chatId].card = card;
				//El jugador es cabeza y no hay cartas en mano
				if(data.games["g"+chatId].player==data.games["g"+chatId].head && !data.games["g"+chatId].cards[0].length){
					let teamA1 = data.games["g"+chatId].sings[0].value,
							teamB1 = data.games["g"+chatId].sings[1].value,
							teamA2 = data.games["g"+chatId].sings[2].value,
							teamB2 = data.games["g"+chatId].sings[3].value;
					if((teamA1>teamB1&&teamA1>teamB2)||(teamA2>teamB1&&teamA2>teamB2)){
						data.games["g"+chatId].points[0]+=teamA1>teamA2?teamA1:teamA2;
					}else{
						data.games["g"+chatId].points[1]+=teamB1>teamB2?teamB1:teamB2;
					}
					data.games["g"+chatId].sings = [new Sing(null),new Sing(null),new Sing(null),new Sing(null)];
					//Mazo vacio
					if(mazoVacio(chatId)){
						let i = 0
						console.log( "Repartiendo...")
						while(i < 3){
							Game.repartir(data.games["g"+chatId]);
							i++;
						}
						if(!data.games["g"+chatId].deck.length){
							console.log( "Ultimas!!!")
							data.games["g"+chatId].lastOne = true;
						}

					}
				}
				//Valida si aun no termia el juego
				if(puedeSeguir(chatId)){
					data.games["g"+chatId].player =  (data.games["g"+chatId].player+1)%data.games["g"+chatId].players.length;
					verCartas({from:{id:data.games["g"+chatId].players[data.games["g"+chatId].player]}});
					console.log( Game.status(data,chatId, true));
				}
			} 
			// no es el turno
			else{	
				console.log( Game.status(data,chatId, true));
			}
		}
		//No empezada
		else{
			estado({chat:{id:chatId}});
		}
	}
	bd.write(data);
}

function mazoVacio(chatId){
	if(!data.games["g"+chatId].deck.length){
		let j=0,i=0;
		//Recoge las cartas de la mesa
		while(i<10){
			if(data.games["g"+chatId].table[i]!=null){
				data.games["g"+chatId].table[i] = null;
				j++;
			}
			i++;
		}
		//Si hubo un ultimo jugador en agarrar le da esas cartas
		if(data.games["g"+chatId].lastTaked != null){
			data.games["g"+chatId].taked[data.games["g"+chatId].lastTaked%2] += j;
		}
		//Le da las cartas a la base 
		else{
			data.games["g"+chatId].taked[data.games["g"+chatId].head] += j;
		}
		//Contar cartas, sumarlas y agregar puntos
		let teamA = data.games["g"+chatId].taked[0],
				teamB = data.games["g"+chatId].taked[1];
		if(teamA>teamB){
			data.games["g"+chatId].points[0]+=teamA-20;
		}else{
			data.games["g"+chatId].points[1]+=teamB-20;
		}
		//Giro de la Mesa
		data.games["g"+chatId].players.push(data.games["g"+chatId].players.shift());
		data.games["g"+chatId].points.push(data.games["g"+chatId].points.shift());
		//Reiniciando Datos
		data.games["g"+chatId].taked = [0,0];
		data.games["g"+chatId].lastTaked = null;
		data.games["g"+chatId].lastOne = false;
		//Barajea
		console.log( "Barajando...")
		let card,order=[];
		data.games["g"+chatId].deck = Game.barajar()
		data.games["g"+chatId].card = null;
		//Reparte las cartas
		console.log( "Repartiendo...")
		while(data.games["g"+chatId].cards[0].length<3){
			card = new Card(data.games["g"+chatId].deck.pop());
			while(data.games["g"+chatId].table[card.position]!=null){
				data.games["g"+chatId].deck.unshift(card.number);
				card = new Card(data.games["g"+chatId].deck.pop());
			}
			data.games["g"+chatId].table[card.position] = card;
			order.push(card.value);
			Game.repartir(data.games["g"+chatId]);
		}
		card = new Card(data.games["g"+chatId].deck.pop());
		while(data.games["g"+chatId].table[card.position]!=null){
			data.games["g"+chatId].deck.unshift(card);
			card = new Card(data.games["g"+chatId].deck.pop());
		}
		data.games["g"+chatId].table[card.position] = card;
		data.games["g"+chatId].card = card;
		order.push(card.value);
		let points=0;	
		if(data.games["g"+chatId].configs.start==1){
			if(order[0]==1){
				points+=1;
			}
			if(order[1]==2){
				points+=2;
			}
			if(order[2]==3){
				points+=3;
			}
			if(order[3]==4){
				points+=4;
			}
		}else{
			if(order[3]==1){
				points+=1;
			}
			if(order[2]==2){
				points+=2;
			}
			if(order[1]==3){
				points+=3;
			}
			if(order[0]==4){
				points+=4;
			}
		}
		if(points>0){
			data.games["g"+chatId].points[1]+=points
		}else{
			data.games["g"+chatId].points[0]+= 1
		}
		console.log( "Primer jugador: "+data.players["p"+data.games["g"+chatId].players[0]].first_name+"(@"+data.players["p"+data.games["g"+chatId].players[0]].username+")\nMesa: "+order);
		return false
	}
	return true
}

function puedeSeguir(chatId){
	if(data.games["g"+chatId].points[0]>23||data.games["g"+chatId].points[1]>23){
		if(data.games["g"+chatId].points[0]>data.games["g"+chatId].points[1]) 
			console.log( "Gano: "+data.players["p"+data.games["g"+chatId].players[0]].first_name+" (@"+data.players["p"+data.games["g"+chatId].players[0]].username+")"+(data.games["g"+chatId].head==3)?"\n y "+data.players["p"+data.games["g"+chatId].players[2]].first_name+" (@"+data.players["p"+data.games["g"+chatId].players[2]].username+")":"")
		else
			console.log( "Gano: "+data.players["p"+data.games["g"+chatId].players[1]].first_name+" (@"+data.players["p"+data.games["g"+chatId].players[1]].username+")"+(data.games["g"+chatId].head==3)?"\n y "+data.players["p"+data.games["g"+chatId].players[3]].first_name+" (@"+data.players["p"+data.games["g"+chatId].players[3]].username+")":"")
		data.games["g"+chatId].players.forEach(id => {
			data.players["p"+id].games.splice(data.players["p"+id].games.indexOf(data.players["p"+id].games.find(value=>{return value.id == chatId})),1)
			if(data.players["p"+id].game == chatId){
				data.players["p"+id].game = null;
			}
		});
		data.games["g"+chatId]= undefined;
		console.log( "Partida finalizada!\nCrea una nueva con /crear");
		return false;
	}
	return true
}

function pasar(msg){
	let chatId = msg.chat.id;
	if(data.games["g"+chatId]!=null){
		if(data.games["g"+chatId].owner!=msg.from.id){
			jugarCarta({from:{id:data.games["g"+chatId].players[data.games["g"+chatId].player]}},[0,0])
		}else{
			console.log( "Solo el creador puede hacer esto.");
		}
	}else{
		console.log( "La partida no esta creada!\nCrea una con /crear");
	}
	bd.write(data);
}



eliminar({chat:{id:12532563}})
 crear({chat:{id:12532563},from:{id:1528475655}})
unirse({chat:{id:12532563},from:{id:1528475655,first_name:"Andresito",username:"OsiNubis99"}})
unirse({chat:{id:12532563},from:{id:2865565235,first_name:"Mafercita",username:"MafeerLourenco"}})
// unirse({chat:{id:12532563},from:{id:1528475654,first_name:"Andresito2",username:"OsiNubis992"}})
// unirse({chat:{id:12532563},from:{id:2865565234,first_name:"Mafercita2",username:"MafeerLourenco2"}})
iniciar({chat:{id:12532563}})
cantar({chat:{id:12532563},from:{id:1528475655}},[0,"ronda"])
// jugarCarta({from:{id:2865565234}},[0,0])
// jugarCarta({from:{id:1528475654}},[0,0])
// jugarCarta({from:{id:2865565235}},[0,0])
// jugarCarta({from:{id:1528475655}},[0,0])
// jugarCarta({from:{id:2865565234}},[0,0])
// jugarCarta({from:{id:1528475654}},[0,0])
// jugarCarta({from:{id:2865565235}},[0,0])
// jugarCarta({from:{id:1528475655}},[0,0])
// jugarCarta({from:{id:2865565234}},[0,0])
// jugarCarta({from:{id:1528475654}},[0,0])
// jugarCarta({from:{id:2865565235}},[0,0])
// jugarCarta({from:{id:1528475655}},[0,0])
// jugarCarta({from:{id:2865565234}},[0,0])
// jugarCarta({from:{id:1528475654}},[0,0])
// jugarCarta({from:{id:2865565235}},[0,0])
// jugarCarta({from:{id:1528475655}},[0,0])
// jugarCarta({from:{id:2865565234}},[0,0])
// jugarCarta({from:{id:1528475654}},[0,0])
// jugarCarta({from:{id:2865565235}},[0,0])
// jugarCarta({from:{id:1528475655}},[0,0])
// jugarCarta({from:{id:2865565234}},[0,0])
// jugarCarta({from:{id:1528475654}},[0,0])
// jugarCarta({from:{id:2865565235}},[0,0])
// jugarCarta({from:{id:1528475655}},[0,0])
// estado({chat:{id:12532563}})