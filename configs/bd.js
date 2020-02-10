const fs = require('fs');
class database {
	constructor(){
		this.path = "./data.json";
	}

	read(){
		return require("."+this.path);
	}

	write(data){
		fs.writeFileSync(this.path, JSON.stringify(data, null, 2));
	}
}

let bd = new database();

module.exports = bd;