const http = require("http");
const bot = require("./bot");
const db = require("./db");
const env = require("./env");
const logger = require("./logger");
const express = require("express");
const dashboardAuth = require("../services/dashboardAuth");
const dashboardApi = require("../services/dashboardApi");
const wsServer = require("../services/realtime/wsServer");

const app = express();

app.use(express.json());

// Admin/user Telegram Web App. Mounted at DASHBOARD_PATH; nginx
// proxies the same prefix straight through (no rewrite).
if (dashboardAuth.isEnabled()) {
  app.use(env.dashboard_path, dashboardApi.build(bot));
  logger.info({ path: env.dashboard_path }, "dashboard mounted");
} else {
  logger.info("dashboard disabled (set DASHBOARD_BASE_URL to enable)");
}

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

// Share one http.Server between Express and socket.io so the realtime WS
// layer rides the same port (3000 → loopback :3010 → nginx). The WS server
// is gated on the dashboard being enabled (same DASHBOARD_BASE_URL switch).
const server = http.createServer(app);

if (dashboardAuth.isEnabled()) {
  wsServer.attach(server);
} else {
  logger.info("realtime ws disabled (set DASHBOARD_BASE_URL to enable)");
}

server.listen(env.port, () => {
  logger.info({ port: env.port }, "express server listening");
});

module.exports = bot;
