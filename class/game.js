var bot = require('../configs/bot');
var card = require('../class/card');
let configs = require('../configs/gameDefaults')
class game {
	constructor(jugador,chatId){
		this.cantos = [0,0,0,0];
		this.cards = [[],[],[],[]];
		this.cardsNum = [0,0,0,0];
		this.chatId = chatId;
		this.configs = configs;
		this.deck = game.Shuffle();
		this.LastCard = null;
		this.player = 0;
		this.players = [];
		this.players.push(jugador);
		this.ponits = [0,0,0,0];
		this.started = false;
		this.table = [null,null,null,null,null,null,null,null,null,null];
	}

	static Shuffle(){
		let array = [11,10,38,19,25,18,14,2,5,39,8,15,29,24,30,1,12,16,9,35,22,32,6,4,0,27,37,17,28,33,21,3,23,34,20,7,31,36,26,13];
		var currentIndex = array.length, temporaryValue, randomIndex;
		while (0 !== currentIndex) {
			randomIndex = Math.floor(Math.random() * currentIndex);
			currentIndex -= 1;
			temporaryValue = array[currentIndex];
			array[currentIndex] = array[randomIndex];
			array[randomIndex] = temporaryValue;
		}
		return array;
	}

	static status(chatGame){
		let msj = "Jugador actual "+game.getPlayer(chatGame).name+"(@"+game.getPlayer(chatGame).username;
		let i = 0;
		while( i < chatGame.players.length){
			msj += "\n--"+(chatGame.player==i?"> ":"  ")+chatGame.players[i].name+"(@"+chatGame.players[i].username+" ["+chatGame.cards[i].length+"]";
			i++;
		}
		msj += "\nLa ultima carta jugada fue: " + chatGame.LastCard
		bot.sendMessage(chatGame.chatId, msj);
	}

	static getPlayer(chatGame){
		return chatGame.players[chatGame.player]
	}

	static getKeyboard(array){
		return {
			selective: true,
			reply_markup: {
				resize_keyboard: true,
				one_time_keyboard: true,
				keyboard: array
			}
		};
	}

	static join(chatGame,jugador){
		if(!chatGame.players.find( player => player.username == jugador.username )){
			if(chatGame.players.length < 4){
				chatGame.players.push(jugador);
				bot.sendMessage(chatGame.chatId,"Bienvenido "+jugador.name+"("+jugador.username+") Te has unido a la partida.");
			}else
				bot.sendMessage(chatGame.chatId, "Ya la mesa esta llena, espera que la partida actual termine para poder unirte.");
		}else 
			bot.sendMessage(chatGame.chatId, "Ya estas en esta partida.");
	}

	static start(chatGame){
		if(chatGame.players.length != 1){
			chatGame.started = true
			let i = 0,temp;
			while(chatGame.cards[0].length<3){
				temp = chatGame.deck.pop();
				while(chatGame.table[temp%4+1]){
					chatGame.deck.unshift(temp);
					temp = chatGame.deck.pop();
				}
				chatGame.table[temp%4+1] = new card(temp);
				while(i<chatGame.players.length){
					temp = chatGame.deck.pop();
					chatGame.cards[i].push(temp)
					i++;
				}
				i = 0;
			}
			temp = chatGame.deck.pop();
			while(chatGame.table[temp%4+1]){
				chatGame.deck.unshift(temp);
				temp = chatGame.deck.pop();
			}
			chatGame.table[temp%4+1] = 1;
			let msj = "Jugador actual "+game.getPlayer(chatGame).name+"(@"+game.getPlayer(chatGame).username;
			msj += "\nMesa:";
			i = 1;
			for(c of chatGame.table){
				if(c==1){
					if(i==8||i==9||i==10)
						msj += " " + (i + 2);
					else
						msj += " " + i; 
				}else
					msj += " ";
				i++;
			}
			bot.sendMessage(chatGame.chatId, msj);
		}else
			bot.sendMessage(chatGame.chatId, "Es necesario un minimo de 2 jugadores.");
	}


}
module.exports = game;