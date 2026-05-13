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

app.get("/stats", async (req, res) => {
  if (!env.stats_token) {
    return res.status(503).send("stats disabled (set STATS_TOKEN env to enable)");
  }
  if (req.query.token !== env.stats_token) {
    return res.status(401).send("unauthorized");
  }
  try {
    const stats = require("../services/stats");
    const view = require("../services/statsView");
    const data = await stats.getStats();
    res.set("Content-Type", "text/html; charset=utf-8");
    res.send(view.render(data, { botName: env.name || "CaidaVZLABot", version: env.version }));
  } catch (err) {
    logger.error({ err: err.message }, "/stats render failed");
    res.status(500).send("stats unavailable");
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
