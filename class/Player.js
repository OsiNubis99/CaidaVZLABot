class Player {
	constructor(telegramUser){
		this.id = telegramUser.id;
		this.first_name = telegramUser.first_name;
		this.last_name = telegramUser.last_name;
		this.username = telegramUser.username;
		this.games = [];
	}
}
module.exports = Player;