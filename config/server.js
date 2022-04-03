const bot = require("./bot");
const env = require("./env");
const express = require("express");

const app = express();

app.use(express.json());

app.get("/", function (req, res) {
  res.send("Telegram Bot '" + env.name + "' with love by @OsiNubis99");
});

app.post(`/bot${env.token}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

app.listen(env.port, function () {
  console.log(`Express server is listening on port ${env.port}`);
  bot.sendMessage(114083702, `I'm alive on ${env.url}:${env.port}`);
});

module.exports = bot;
