class Card {
	/**
	 * Create a Card Object
	 * @param {number} number - The generator number of the card [0,39]
	 */
	constructor(number) {
		this.number = number;
		this.position = Math.floor(number / 4);
		this.value = Math.floor(number / 4) + 1;
		this.value =
			this.value == 8
				? 10
				: this.value == 9
				? 11
				: this.value == 10
				? 12
				: this.value;
		this.type = number % 4;
		this.type =
			this.type == 0
				? "Oro"
				: this.type == 1
				? "Espada"
				: this.type == 2
				? "Copa"
				: "Basto";
		this.points =
			this.value == 12 ? 4 : this.value == 11 ? 3 : this.value == 10 ? 2 : 1;
		this.picture =
			process.env.HEROKU_SERVER_URL +
			"/Cards/" +
			this.value +
			"-" +
			this.type +
			".png";
	}
}
module.exports = Card;
