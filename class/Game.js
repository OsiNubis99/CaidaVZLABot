let configs = require('../configs/gameDefaults')
class Game {
	constructor(jugador){
		this.owner = jugador;
		this.deck = Game.barajar();
		this.sings = [];
		this.points = [0,0,0,0];
		this.cards = [[],[],[],[]];
		this.table = [];
		this.taked = [0,0,0,0];
		this.configs = configs;
		this.card = null;
		this.player = null;
		this.players = [];
	}

	static getPlayer(chatGame){
		return chatGame.players[chatGame.player]
	}

	static barajar(){
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

	static status(chatGame,players){
		let msg
		if(chatGame.player != null){
			msg = "Jugador actual "+players["p"+Game.getPlayer(chatGame)].first_name+"(@"+players["p"+Game.getPlayer(chatGame)].username+")";
			let i = 0;
			while( i < chatGame.players.length){
				msg += "\n--"+(chatGame.player==i?"> ":"  ")+players["p"+chatGame.players[i]].first_name+"(@"+players["p"+chatGame.players[i]].username+" ["+chatGame.cards[i].length+"]";
				i++;
			}
			msg += "\nLa ultima carta jugada fue: " + chatGame.card;
		}
		else
			msg = "El juego aun no empieza, usa /iniciar";
		return msg;
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
			let msg = "Jugador actual "+Game.getPlayer(chatGame).first_name+"(@"+Game.getPlayer(chatGame).username;
			msg += "\nMesa:";
			i = 1;
			for(c of chatGame.table){
				if(c==1){
					if(i==8||i==9||i==10)
						msg += " " + (i + 2);
					else
						msg += " " + i; 
				}else
					msg += " ";
				i++;
			}
			bot.sendMessage(chatGame.chatId, msg);
		}else
			bot.sendMessage(chatGame.chatId, "Es necesario un minimo de 2 jugadores.");
	}


}
module.exports = Game;