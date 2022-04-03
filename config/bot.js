const TelegramBot = require("node-telegram-bot-api");
const env = require("./env");

let options = {};
if (env.node_env == "develop") {
  options = {
    polling: true,
  };
}

const bot = new TelegramBot(env.token, options);

if (env.node_env == "production") bot.setWebHook(`${env.url}/bot${env.token}`);

bot.onText(/\/version(.*)/, (msg) => {
  bot.sendMessage(msg.chat.id, env.name + "@" + env.version);
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
  1. Agrega este bot a un grupo.
  2. En el grupo, iniciar la partida con /crear.
  3. Una vez creado la partida, los jugadores podrán unir usando /unirse, se podrán unir un máximo de cuatro jugadores.
  4. Luego de que estén todos los integrantes que jugarán utilizar /iniciar para configurar la partida e iniciar.
  5. En el cuadro del chat, escribir @CaidaVZLABot y aparecerán sus cartas (serán completamente anónimas) y una carta de cantos.

  /saltar - Está acción hará pasar a un jugador y se jugará una carta al azar. Solo la puede ejecutar un administrador del grupo.
  /configuracion
    *Cambiar el idioma (Desarrollo)
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
