const { Client } = require("pg");
const env = require("./env");
const logger = require("./logger");

const client = new Client({
  connectionString: env.bd_url,
  ssl: env.pgssl ? { rejectUnauthorized: false } : false,
});

let connected = false;

client
  .connect()
  .then(() => {
    connected = true;
    logger.info("DB connected");
  })
  .catch((err) => {
    logger.error({ err }, "DB connection failed");
    process.exit(1);
  });

module.exports = client;
module.exports.isConnected = () => connected;
