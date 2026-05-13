const TelegramBot = require("node-telegram-bot-api");
const env = require("./env");
const logger = require("./logger");

const bot = new TelegramBot(env.token, { polling: true });

bot.onText(/\/version(.*)/, (msg) => {
  bot.sendMessage(msg.chat.id, env.name + "@" + env.version);
});

bot.onText(/\/id/, (msg) => {
  bot.sendMessage(msg.chat.id, `El id del chat es: ${msg.chat.id}`);
});

bot.onText(/\/saluda(.*)/, (msg, match) => {
  const chatId = msg.chat.id;
  const resp =
    "Hola " +
    (msg.from.username ? "@" + msg.from.username : msg.from.first_name) +
    (match[1] ? "\nTu mensaje fue: " + match[1] : "");
  bot.sendMessage(chatId, resp);
});

function sayHi(msg) {
  bot.sendMessage(
    msg.chat.id,
    `🎴 *Caída Venezolana Bot*

*Cómo jugar:*
1. Únanse al grupo (público o privado registrado). Para listar grupos públicos: /list\\_groups.
2. Cada jugador escribe /unirse (mínimo 2, máximo 4 jugadores).
3. Un admin del grupo escribe /iniciar (con configuración) o /inicia\\_ya (con la config por defecto).
4. *En tu turno*, escribe \`@CaidaVZLABot\` en el cuadro del chat: aparecerán tus cartas y, si toca, los cantos. Tocá la carta o el canto que querés jugar.

*Comandos principales*
/unirse — sumarse a la partida actual
/iniciar — iniciar con menú de configuración (admin)
/inicia\\_ya — iniciar con la config actual del grupo (admin)
/estado — ver mesa, puntos, próximo turno
/reiniciar — reiniciar la partida actual (admin del grupo)
/configurar — ver/editar reglas, puntos, multiplicadores, cantos
/stats — tus estadísticas
/list\\_groups — lista de grupos públicos

¿Querés que tu grupo aparezca como público? Hablá con @OsiNubis99.`,
    { parse_mode: "Markdown" },
  );
}

bot.onText(/\/start/, sayHi);
bot.onText(/\/help/, sayHi);

bot.on("error", (err) => {
  logger.error({ err }, "telegram bot error");
});

bot.on("polling_error", (err) => {
  logger.error({ err }, "telegram polling error");
});

module.exports = bot;
