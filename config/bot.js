const TelegramBot = require("node-telegram-bot-api");
const env = require("./env");

let options = {
  polling: true,
};

const bot = new TelegramBot(env.token, options);

bot.onText(/\/version(.*)/, (msg) => {
  bot.sendMessage(msg.chat.id, env.name + "@" + env.version);
});

bot.onText(/\/id/, (msg, match) => {
  bot.sendMessage(msg.chat.id, `El id del chat es: ${msg.chat.id}`);
});

bot.onText(/\/saluda(.*)/, (msg, match) => {
  let chatId = msg.chat.id;
  let resp =
    "Hola " +
    (msg.from.username ? "@" + msg.from.username : msg.from.first_name) +
    (match[1] ? "\nTu mensaje fue: " + match[1] : "");
  bot.sendMessage(chatId, resp);
});

function sayHi(msg) {
  bot.sendMessage(
    msg.chat.id,
    `Sigue estos pasos:
  1. Unete a algun grupo publico. Escribele a @OsiNubis99 para jugar en tu grupo privado.
  2. Los jugadores se podrán unir usando /unirse, se podrán unir un máximo de cuatro jugadores.
  3. Luego de que estén todos los integrantes que jugarán utilizar /iniciar para configurar la partida e iniciar o /inicia_ya para no configurar.
  4. En el cuadro del chat, escribe @CaidaVZLABot y aparecerán sus cartas (serán completamente anónimas) y una carta de cantos.

  /reinicial - Reinicia la partida, solo puede ser usada por los #admin del grupo.
  /list_groups - Lista los grupos publicos.
  /configuracion
    *Cambiar el modo de juego, si hay 4 jugadores, seleccionar si se juega individual o en parejas.
    *Configurar los cantos a utilizar en la partida
    *Definir el límites de puntos en una partida (1 ~ 100)`
  );
}

bot.onText(/\/start/, sayHi);

bot.onText(/\/help/, sayHi);

bot.on("error", (error) => {
  console.error(error + "\n Error");
});

bot.on("polling_error", (error) => {
  console.error(error + "\n Polling Error");
});

module.exports = bot;
