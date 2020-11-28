const { Client } = require("pg");
const client = new Client({
  connectionString: process.env.HEROKU_POSTGRESQL_URL,
  ssl: { rejectUnauthorized: false },
});

client.connect().then(() => {
  console.log("DB connected");
});

module.exports = client;
