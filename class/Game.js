const User = require("./User");
const Card = require("./Card");
const resp = require("../lang/es");
const Config = require("./Config");
const message = require("../templates/message");
const keyboard = require("../templates/keyboard");
const Sings = require("./Sings");

class Game {
	config = Config.prototype;
	deck = Array(Number.prototype);
	deck = Array(Number.prototype);
	decks = Number.prototype;
	last_card_played = Card.prototype;
	last_hand = Boolean.prototype;
	last_player_on_take = Number.prototype;
	name = String.prototype;
	users = Array(User.prototype);
	player = Number.prototype;
	points = Array(Number.prototype);
	table = Array(Card.prototype);
	took = Array(Number.prototype);

	/**
	 * Create a Game Object
	 * @param {String} name - Group Name where the game is running.
	 * @param {Config} config - Configs of the group.
	 */
	constructor(name, config) {
		this.config = config;
		this.deck = new Array();
		this.decks = 0;
		this.last_card_played = null;
		this.last_hand = false;
		this.last_player_on_take = null;
		this.name = name;
		this.users = new Array();
		this.player = 0;
		this.points = new Array(4);
		this.table = new Array(10);
		this.took = new Array(4);
	}

	/**
	 * @returns The number of the last player on play.
	 */
	last_player() {
		let last = this.player - 1;
		return last < 0 ? this.users.length - 1 : last;
	}

	/**
	 * @returns {String} the current player name.
	 */
	playerName() {
		return this.users[this.player].first_name;
	}

	/**
	 * Add a new user and return the status of the game.
	 * @param {User} user - User to be Added
	 * @returns
	 */
	join(user) {
		this.users.push(user);
		return this.print(false);
	}

	/**
	 * @param {String} id_user
	 * @returns {Array<Card|Sings>}
	 */
	get_player_cards(id_user) {
		let cards = [];
		this.users.forEach((user) => {
			if (user.id_user == id_user) {
				cards = user.cards;
				if (user.cards.length == 3 && !user.sing.active && user.sing.value > 0)
					cards.push(user.sing);
			}
		});
		return cards;
	}

	/**
	 * @param {String} id_user - the id of the request player
	 * @returns {Number} - User index
	 */
	get_user_index(id_user, index = 0) {
		if (this.users.length > index) {
			if (this.users[index].id_user == id_user) return index;
			return this.get_user_index(id_user, index + 1);
		}
		return -1;
	}

	/**
	 * @param {String} id_user - the id of the player that is sing
	 * @returns
	 */
	sing(id_user) {
		var user_index = this.get_user_index(id_user);
		if (user_index >= 0) {
			return this.users[user_index].set_sing();
		}
		return resp.no_game_description;
	}

	/**
	 * Extract the first card to the game deck
	 * and validate if it's already on the table and if it's sync to the user prediction.
	 * @param {Number} next_card - User prediction next card value.
	 * @returns {Number} - The value of next card if is sync with the card extracted
	 */
	push_cards(next_card, save = false) {
		let card = new Card(this.deck.shift());
		if (this.table[card.position]) {
			this.deck.push(card.number);
			return this.push_cards(next_card);
		} else {
			this.table[card.position] = card;
			if (save) this.last_card_played = card; // TODO disable if config caida_en_mesa is down
			if (card.value == next_card) return next_card;
			return 0;
		}
	}

	/**
	 * TODO Pretty comment
	 * @param {Number} number - Number of cards to be added.
	 * @param {Number} next_card - Number of the next card in the table
	 * @param {Boolean} desc - true : 4 to 1, false 1 to 4
	 */
	new_cards(number, next_card, desc) {
		if (number > 0) {
			let points = next_card > 0 ? this.push_cards(next_card) : 0;
			this.users.forEach((user) => {
				user.add_card(new Card(this.deck.shift()), this.config);
			});
			return (
				points +
				this.new_cards(number - 1, desc ? next_card - 1 : next_card + 1, desc)
			);
		} else {
			return next_card > 0 ? this.push_cards(next_card, true) : 0;
		}
	}

	increase_points(player, points) {
		this.points[player] += points;
		return (
			this.points[player] +
				(this.config.type == "parejas" ? this.points[(player + 2) % 4] : 0) >
			this.config.points
		);
	}

	/**
	 * Shuffle and save all cards generators on the Deck and increment decks played.
	 */
	shuffle() {
		this.decks++;
		this.deck = [
			11,
			10,
			38,
			19,
			25,
			18,
			14,
			2,
			5,
			39,
			8,
			15,
			29,
			24,
			30,
			1,
			12,
			16,
			9,
			35,
			22,
			32,
			6,
			4,
			0,
			27,
			37,
			17,
			28,
			33,
			21,
			3,
			23,
			34,
			20,
			7,
			31,
			36,
			26,
			13,
		];
		var currentIndex = this.deck.length,
			temporaryValue,
			randomIndex;
		while (0 !== currentIndex) {
			currentIndex -= 1;
			randomIndex = Math.floor(Math.random() * currentIndex);
			temporaryValue = this.deck[currentIndex];
			this.deck[currentIndex] = this.deck[randomIndex];
			this.deck[randomIndex] = temporaryValue;
		}
		this.users[this.users.length - 1].cards = ["Start_By"];
		return resp.start_by;
	}

	handing_out_cards(start_by, added = "") {
		//TODO All before handing out
		if (this.deck.length > 0) {
			this.users[this.users.length - 1].cards = [];
			let points = this.new_cards(3, start_by, start_by > 2);
			if (points > 0) {
				this.increase_points(0, points * this.config.mesa);
			} else {
				this.increase_points(1, points * this.config.mesa);
			}
			if (this.deck.length == 0) {
				this.last_hand = true;
			}
			return added + this.print();
		}
		// TODO All before shuffle
		this.users.push(this.users.shift());
		this.points.push(this.points.shift());
		this.last_hand = false;
		return added + this.shuffle();
	}

	play_card(id_user, number) {
		/**
		 * @type {User}
		 */
		let player = this.users[this.player];
		if (player.id_user == id_user) {
			let card = player.play(number);
			if (card) {
				var card_position = card.position;
				var took = 0;
				var response = "";
				while (this.table[card_position]) {
					this.table[card_position] = null;
					took++;
				}
				if (took > 0) {
					// Took something
					this.took[this.player] += took;
					if (
						this.last_card_played &&
						this.last_card_played.position == card.position
					) {
						this.last_card_played = null;
						// is fall down
						if (this.config.caida > 0) {
							this.increase_points(
								this.player,
								card.points * this.config.caida
							);
							response = resp.user_get_fall;
						}
						if ((this.config.mata_canto = "on")) {
							this.users[this.last_player].sing.active = false;
							response += resp.sing_killed;
						}
					}
				}
				this.player = (this.player + 1) % this.users.length;
				if (this.users[this.users.length - 1].cards.length > 0)
					return response + this.print();
				return this.handing_out_cards(0, response);
			}
			return resp.invalid_value;
		}
		return resp.bad_turn;
	}

	/**
	 * @param {Boolean} short_status - Only send the game status without teams information
	 * @returns Printable message with the game and teams information
	 */
	print(short_status = true) {
		let response = "";
		let is_running = this.decks != 0;
		if (is_running) {
			response += this.last_hand ? "Ultimas!" : "";
			response += "\nMesa:";
			this.table.forEach((item) => {
				if (item != null) response += " " + item.value;
				else response += " []";
			});
			if (this.last_card_played) {
				response +=
					"\nUltima carta: " +
					this.last_card_played.value +
					" de " +
					this.last_card_played.type;
			}
			response += "\nSiguiente: " + this.playerName();
		} else {
			response += resp.game_no_started;
		}
		if (short_status) {
			return response;
		}
		if (this.config.type == "parejas") {
			response += "\nEquipo " + (this.decks % 2 == 0 ? "Rojo" : "Azul");
			if (is_running)
				response +=
					"\n\t\tPuntos: " + this.points[0] + " Tomado: " + this.took[0];
			response += this.users[0]
				? "\n\t" + this.users[0].print(is_running)
				: "\n\tVacío";
			response += this.users[2]
				? "\n\t" + this.users[2].print(is_running)
				: "\n\tVacío";
			response += "\nEquipo " + (this.decks % 2 == 1 ? "Rojo" : "Azul");
			if (is_running)
				response +=
					"\n\t\tPuntos: " + this.points[1] + " Tomado: " + this.took[1];
			response += this.users[1]
				? "\n\t" + this.users[1].print(is_running)
				: "\n\tVacío";
			response += this.users[3]
				? "\n\t" + this.users[3].print(is_running)
				: "\n\tVacío";
		} else {
			response += this.users[0]
				? "\nJugador 1: " +
				  this.users[0].print(is_running) +
				  (is_running
						? +"\n\tPuntos: " + this.points[0] + " Tomado: " + this.took[0]
						: "")
				: "";
			response += this.users[1]
				? "\nJugador 2: " +
				  this.users[1].print(is_running) +
				  (is_running
						? +"\n\tPuntos: " + this.points[1] + " Tomado: " + this.took[1]
						: "")
				: "";
			response += this.users[2]
				? "\nJugador 3: " +
				  this.users[2].print(is_running) +
				  (is_running
						? +"\n\tPuntos: " + this.points[2] + " Tomado: " + this.took[2]
						: "")
				: "";
			response += this.users[3]
				? "\nJugador 4: " +
				  this.users[3].print(is_running) +
				  (is_running
						? +"\n\tPuntos: " + this.points[3] + " Tomado: " + this.took[3]
						: "")
				: "";
		}
		return response;
	}

	/**
	 * Return the full message and options to setup and start the game.
	 * @param {Number|Boolean} message_id - The id of a message to be edited.
	 * @param {Number} chat_id - The id of a chat of the message.
	 * @returns Telegram Message and Options
	 */
	print_before_game(message_id, chat_id = null) {
		let players = this.users.length;
		let type =
			players == 4
				? this.config.type == "parejas"
					? "individual"
					: "en parejas"
				: false;
		let response = this.config.print_before_game(players);
		let kboard = keyboard.list_game_modes_and_run(
			type,
			this.config.get_game_modes()
		);
		return message_id
			? message.edit_keyboard(response, message_id, chat_id, kboard)
			: message.keyboard(response, kboard);
	}
}

module.exports = Game;
