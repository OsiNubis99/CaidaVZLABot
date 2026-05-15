const { Pool } = require("pg");
const env = require("./env");
const logger = require("./logger");

// Pool instead of Client: a single Client serializes queries internally
// and emits a deprecation warning when overlapping calls happen ("client.query()
// while the client is already executing a query is deprecated... pg@9.0").
// On every play we fire events.record + persistence.save + UserDatabase
// stats — easily overlapping. Pool transparently grabs a free connection
// per query (up to `max`), so concurrent calls never collide.
const pool = new Pool({
  connectionString: env.bd_url,
  ssl: env.pgssl ? { rejectUnauthorized: false } : false,
  // 10 connections is plenty for this bot's traffic; postgres-side
  // default max_connections is 100 so we're well under.
  max: 10,
});

let connected = false;

// Pool has no explicit connect step — connections are lazy. Probe with
// a SELECT 1 to verify connectivity and trigger migrations once.
const ready = pool
  .query("SELECT 1")
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

module.exports = pool;
module.exports.isConnected = () => connected;
module.exports.ready = ready;
// Bound to graceful shutdown in index.js so deploys close pool members
// cleanly instead of leaving sockets in TIME_WAIT.
module.exports.shutdown = () => pool.end();
