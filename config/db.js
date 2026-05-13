const { Client } = require("pg");
const env = require("./env");
const logger = require("./logger");

const client = new Client({
  connectionString: env.bd_url,
  ssl: env.pgssl ? { rejectUnauthorized: false } : false,
});

let connected = false;

const ready = client
  .connect()
  .then(async () => {
    connected = true;
    logger.info("DB connected");
    const migrations = require("../database/migrations");
    await migrations.run();
  })
  .catch((err) => {
    logger.error({ err }, "DB startup failed");
    // Tests load modules transitively without a real DB; don't kill the
    // process in that case.
    if (process.env.NODE_ENV !== "test" && !process.env.VITEST) {
      process.exit(1);
    }
  });

module.exports = client;
module.exports.isConnected = () => connected;
module.exports.ready = ready;
