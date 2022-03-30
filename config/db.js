const { Client } = require("pg");
const env = require("./env");

const client = new Client({
	connectionString: env.bd_url,
	ssl: { rejectUnauthorized: false },
});

client.connect().then(() => {
	console.log("DB connected");
});

// client.query(``);

module.exports = client;
