class card {
	constructor(number){
		this.number = number;
		this.value = (number%4) + 1;
		this.value = this.value==8?10:this.value==9?11:this.value==10?12:this.value;
		this.type = number/4;
		this.type = this.type==0?"A":this.type==1?"B":this.type==2?"C":"D";
	}

	static getType(number){
		var type = number/4;
		return type==0?"A":type==1?"B":type==2?"C":"D";
	}

	static getValue(number){
		var value = (number%4) + 1;
		return value==8?10:value==9?11:value==10?12:value;
	}
}
module.exports = card;