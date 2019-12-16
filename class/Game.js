let configs = require('../configs/gameDefaults')
var Card = require('./Card');

class Game {
	constructor(jugador){
		this.owner = jugador;
		this.deck = [];
		this.sings = [];
		this.points = [0,0,0,0];
		this.cards = [[],[],[],[]];
		this.table = [null,null,null,null,null,null,null,null,null,null];
		this.taked = [0,0,0,0];
		this.configs = configs;
		this.card = null;
		this.lastTaked = null;
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

	static status(data,chatId){
		let msg
		if(data.games["g"+chatId].player != null){
			msg = "Mesa:"
			let c;
			for(c of data.games["g"+chatId].table){
				if(c!=null)
					msg+=" "+c.value;
				else
					msg+=" #";
			}
			msg += "\nJugador actual: "+data.players["p"+Game.getPlayer(data.games["g"+chatId])].first_name+" (@"+data.players["p"+Game.getPlayer(data.games["g"+chatId])].username+")";
			msg += "\nLa ultima carta jugada fue: " + data.games["g"+chatId].card.value+" de "+data.games["g"+chatId].card.type+"\nJugadores:";
			let i = 0;
			while( i < data.games["g"+chatId].players.length){
				msg += "\n--"+(data.games["g"+chatId].player==i?"> ":"  ")+data.players["p"+data.games["g"+chatId].players[i]].first_name+"(@"+data.players["p"+data.games["g"+chatId].players[i]].username+" ["+data.games["g"+chatId].cards[i].length+"] <"+data.games["g"+chatId].points[i]+">";
				i++;
			}
		}
		else
			msg = "El juego aun no empieza, usa /iniciar";
		return msg;
	}

	static repartir(chatGame){
		if(!chatGame.deck.length)
			chatGame.deck = Game.barajar()
		let i = 0,card;
		while(i<chatGame.players.length){
			card = new Card(chatGame.deck.pop());
			chatGame.cards[i].push(card)
			i++;
		}
		return chatGame
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

}
module.exports = Game;