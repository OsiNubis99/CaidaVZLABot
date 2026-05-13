const bot = require("./bot");
const db = require("./db");
const env = require("./env");
const logger = require("./logger");
const express = require("express");

const app = express();

app.use(express.json());

app.get("/", (req, res) => {
  res.send("Telegram Bot '" + env.name + "'");
});

app.get("/health", (req, res) => {
  const dbOk = db.isConnected();
  if (dbOk) {
    res.status(200).json({ status: "ok", db: "connected" });
  } else {
    res.status(503).json({ status: "degraded", db: "disconnected" });
  }
});

app.post(`/bot${env.token}`, (req, res) => {
  res.sendStatus(200);
  bot.processUpdate(req.body);
});

app.listen(env.port, () => {
  logger.info({ port: env.port }, "express server listening");
});

module.exports = bot;
