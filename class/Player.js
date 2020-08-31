class Player {
	constructor(telegramUser){
		this.id = telegramUser.id;
		this.username = telegramUser.username;
		this.first_name = telegramUser.first_name;
		this.games = [];
		this.game = null;
	}
}
module.exports = Player;