const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
var Game = require("./class/Game");
var Card = require("./class/Card");
var Sing = require("./class/Sing");
var Player = require("./class/Player");
var bd = require("./configs/bd");
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const TOKEN = process.env.TELEGRAM_TOKEN;
const url = process.env.APP_URL || "https://caidavzlabot.herokuapp.com:443";
const port = process.env.PORT || 3000;
const is_dev = process.env.IS_DEV;

let options = {};
if (is_dev == "true") {
  options = {
    polling: true,
  };
}

const bot = new TelegramBot(TOKEN, options);

if (process.env.IS_DEV != "true") bot.setWebHook(`${url}/bot${TOKEN}`);

const app = express();

app.use(express.json());

app.use(express.static("./public"));

app.get("/", function (req, res) {
  res.send("Hello World");
});

app.post(`/bot${TOKEN}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

var server = app.listen(port, function () {
  console.log(
    `Express server is listening on ${server.address().address}:${port}`
  );
  bot.sendMessage(
    114083702,
    `I'm alive on ${server.address().address}:${port}`
  );
});

var groups = [-1001432406771, -358611014];
var bans = [];

let data = bd.read();

bot.on("inline_query", (query) => {
  let playerId = query.from.id;
  if (
    data.players["p" + playerId] &&
    data.players["p" + playerId].game != null
  ) {
    let chatId = data.players["p" + playerId].game;
    if (data.games["g" + chatId].player != null) {
      let team = data.games["g" + chatId].players.indexOf(playerId),
        base = [];
      if (
        data.games["g" + chatId].cards[team].length == 3 &&
        data.games["g" + chatId].sings[team].name == "Tres Cartas"
      ) {
        base = [
          {
            id: 3,
            type: "article",
            input_message_content: {
              message_text: "Esto no es un canto...",
            },
            title: "Cantos 👇",
          },
          {
            id: 5,
            type: "article",
            input_message_content: {
              message_text: "Tengo Ronda",
            },
            title: "Ronda",
            description: "Dos cartas iguales",
          },
          {
            id: 6,
            type: "article",
            input_message_content: {
              message_text: "Tengo Chiguire",
            },
            title: "Chiguire",
            description: "Escalera Par o no par",
          },
          {
            id: 7,
            type: "article",
            input_message_content: {
              message_text: "Tengo Patrulla",
            },
            title: "Patrulla",
            description: "Tres cartas seguidas",
          },
          {
            id: 8,
            type: "article",
            input_message_content: {
              message_text: "Tengo Vigía",
            },
            title: "Vigía",
            description: "Dos cartas iguales y una mayor o menor en una unidad",
          },
          {
            id: 9,
            type: "article",
            input_message_content: {
              message_text: "Tengo Registro",
            },
            title: "Registro",
            description: "1 11 12",
          },
          {
            id: 10,
            type: "article",
            input_message_content: {
              message_text: "Tengo Maguaro",
            },
            title: "Maguaro",
            description: "1 10 12",
          },
          {
            id: 11,
            type: "article",
            input_message_content: {
              message_text: "Tengo Registrico",
            },
            title: "Registrico",
            description: "1 10 11",
          },
          {
            id: 12,
            type: "article",
            input_message_content: {
              message_text: "Tengo Casa Chica",
            },
            title: "Casa Chica",
            description: "1 1 12",
          },
          {
            id: 13,
            type: "article",
            input_message_content: {
              message_text: "Tengo Casa Grande",
            },
            title: "Casa Grande",
            description: "1 12 12",
          },
          {
            id: 14,
            type: "article",
            input_message_content: {
              message_text: "Tengo Trivilin",
            },
            title: "Trivilin",
            description: "Tres cartas iguales",
          },
        ];
      }
      let i = 0;
      // if (
      //   data.games["g" + chatId].cards[
      //     data.games["g" + chatId].players.indexOf(playerId)
      //   ].length > 0
      // ) {
      for (c of data.games["g" + chatId].cards[
        data.games["g" + chatId].players.indexOf(playerId)
      ]) {
        base.unshift({
          id: i,
          type: "article",
          input_message_content: {
            message_text: "Juego el " + c.value + " de " + c.type,
          },
          title: c.value + " " + c.type,
        });
        i++;
      }
      // } else {
      //   base.unshift({
      //     id: 0,
      //     type: "article",
      //     input_message_content: {
      //       message_text: "Me quede sin cartas",
      //     },
      //     title: "No tienes cartas",
      //     description: "Espera que la partida avance y se te repartiran mas!",
      //   });
      // }
      if (data.players["p" + playerId].games.length > 1) {
        base.unshift({
          id: 4,
          type: "article",
          input_message_content: {
            message_text:
              "Para cambiar a un juego ya iniciado en otro chat envia /juego en ese chat!",
          },
          title:
            "Juego actual en: " + data.players["p" + playerId].games[0].title,
        });
      }
      bot.answerInlineQuery(query.id, base, {
        is_personal: true,
        cache_time: 1,
      });
    } else {
      let base = [
        {
          id: "3",
          type: "article",
          input_message_content: {
            message_text: "/iniciar",
          },
          title: "El juego aun no empieza",
        },
      ];
      if (data.players["p" + playerId].games.length > 1) {
        base.unshift({
          id: 4,
          type: "article",
          input_message_content: {
            message_text:
              "Para cambiar a un juego ya iniciado en otro chat envia /juego en ese chat!",
          },
          title:
            "Juego actual en: " + data.players["p" + playerId].games[0].title,
        });
      }
      bot.answerInlineQuery(query.id, base, {
        is_personal: true,
        cache_time: 1,
      });
    }
  } else {
    bot.answerInlineQuery(
      query.id,
      [
        {
          id: "3",
          type: "article",
          input_message_content: {
            message_text: "/unirse",
          },
          title:
            "No se ha unido a ningun juego \nEste juego solo esta permitido [Aqui](https://t.me/JuegosVZLA)",
        },
      ],
      {
        is_personal: true,
        cache_time: 1,
      }
    );
  }
});

bot.on("chosen_inline_result", (query) => {
  if (query.result_id > 4) {
    cantar(
      {
        from: {
          id: query.from.id,
        },
      },
      [0, query.result_id]
    );
  }
  if (query.result_id < 3) {
    jugarCarta(
      {
        from: {
          id: query.from.id,
        },
      },
      [0, query.result_id]
    );
  }
});

bot.onText(/\/saluda(.*)/, (msg, match) => {
  let chatId = msg.chat.id;
  let resp = "Hola " + msg.from.first_name + "\nTu mensaje fue: " + match[1];
  bot.sendMessage(chatId, resp);
  bd.write(data);
});

bot.onText(/\/active/, (msg, match) => {
  let chatId = msg.chat.id;
  let resp = "Hay un total de " + data.games.lenght + " juegos activos " + msg.from.first_name;
  bot.sendMessage(chatId, resp);
});

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    `Sigue estos pasos: 
	1. Agrega este bot a un grupo (El bot aun no esta listo, solo se puede probar [aqui](https://t.me/JuegosVZLA))
	2. En el grupo, iniciar la partida con /crear, el jugador que haya creado la partida ya estará unido al juego y será el dealer de esa partida
	3. Una vez creado la partida, los jugadores podrán unir usando /unirse, se podrán unir un máximo de tres jugadores
	Usando /configuracion se configura el modo de juego, los cantos y los puntos de la partida
	4. Luego de que estén todos los integrantes que jugarán y luego de haber escogido la configuración del juego, se procede a empezar la partida con /iniciar
	5. En el cuadro del chat, escribir @CaidaVZLABot y aparecerán sus cartas (serán completamente anónimas) y una carta de cantos (la cual estará iluminada con el canto que se tenga en las tres cartas, de no tener canto estará gris
	
	/eliminar - Eliminar la partida en curso
	/estado - Resumen del juego (jugadores, turno, puntos) y lo último jugado
	/saltar - Está acción hará pasar a un jugador y se jugará una carta al azar. Solo la puede ejecutar el creador de la partida
	/configuracion
		*Cambiar idioma
		*Cambiar el modo de juego, si hay 4 jugadores, seleccionar si se juega individual o en parejas.
		*Configurar los cantos a utilizar en la partida
		*Definir el límites de puntos en una partida (12 / 24)`
  );
});

bot.onText(/\/help/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    `Sigue estos pasos: 
	1. Agrega este bot a un grupo 
	2. En el grupo, iniciar la partida con /crear, el jugador que haya creado la partida ya estará unido al juego y será el dealer de esa partida
	3. Una vez creado la partida, los jugadores podrán unir usando /unirse, se podrán unir un máximo de tres jugadores
	Usando /configuracion se configura el modo de juego, los cantos y los puntos de la partida
	4. Luego de que estén todos los integrantes que jugarán y luego de haber escogido la configuración del juego, se procede a empezar la partida con /iniciar
	5. En el cuadro del chat, escribir @CaidaVZLABot y aparecerán sus cartas (serán completamente anónimas) y una carta de cantos (la cual estará iluminada con el canto que se tenga en las tres cartas, de no tener canto estará gris
	
	/eliminar - Eliminar la partida en curso
	/estado - Resumen del juego (jugadores, turno, puntos) y lo último jugado
	/saltar - Está acción hará pasar a un jugador y se jugará una carta al azar. Solo la puede ejecutar el creador de la partida
	/configuracion
		*Cambiar idioma
		*Cambiar el modo de juego, si hay 4 jugadores, seleccionar si se juega individual o en parejas.
		*Configurar los cantos a utilizar en la partida
		*Definir el límites de puntos en una partida (12 / 24)`
  );
});

function crear(msg) {
  let chatId = msg.chat.id;
    if (data.games["g" + chatId] == null) {
      data.games["g" + chatId] = new Game(msg.from.id);
      bot.sendMessage(
        chatId,
        "Partida creada!\nPueden unirse con /unirse y empezar el juego con /iniciar"
      );
    } else
      bot.sendMessage(
        chatId,
        "La partida ya esta creada!\nPueden unirse con /unirse y empezar el juego con /iniciar"
      );
  if (groups.indexOf(chatId) < 0) {
    bot.sendMessage(
      chatId,
      "Este bot esta en desarrollo, por favor notifica a @OsiNubis99 de cualquier error.❤️"
    );
    bot.sendMessage(114083702, "Juego creado: \n" + JSON.stringify(msg));
  }
  bd.write(data);
}

function eliminar(msg) {
  let chatId = msg.chat.id;
  if (data.games["g" + chatId] != null) {
    data.games["g" + chatId].players.forEach((id) => {
      data.players["p" + id].games.splice(
        data.players["p" + id].games.indexOf(
          data.players["p" + id].games.find((value) => {
            return value.id == chatId;
          })
        ),
        1
      );
      if (data.players["p" + id].game == chatId) {
        data.players["p" + id].game =
          data.players["p" + id].games.length != 0
            ? data.players["p" + id].games[0].id
            : null;
      }
    });
    data.games["g" + chatId] = undefined;
    bot.sendMessage(114083702, "Juego eliminado:\n" + JSON.stringify(msg));  
    if (groups.indexOf(chatId) < 0) {
      bot.sendMessage(
        chatId,
        "Este bot esta en desarrollo, por favor notifica a @OsiNubis99 de cualquier error.❤️"
      );
      bot.sendMessage(114083702, "Juego eliminado: \n" + JSON.stringify(msg));
    }
  } else {
    bot.sendMessage(chatId, "La partida no esta creada!\nCrea una con /crear");
  }
  bd.write(data);
}

function reiniciar(msg) {
  let chatId = msg.chat.id;
  if (data.games["g" + chatId]) {
    data.games["g" + chatId].players.forEach((id) => {
      data.players["p" + id].games.splice(
        data.players["p" + id].games.indexOf(
          data.players["p" + id].games.find((value) => {
            return value.id == chatId;
          })
        ),
        1
      );
      if (data.players["p" + id].game == chatId) {
        data.players["p" + id].game =
          data.players["p" + id].games.length != 0
            ? data.players["p" + id].games[0].id
            : null;
      }
    });
  }
  data.games["g" + chatId] = new Game(msg.from.id);
  if (groups.indexOf(chatId) < 0) {
    bot.sendMessage(
      chatId,
      "Este bot esta en desarrollo, por favor notifica a @OsiNubis99 de cualquier error.❤️"
    );
    bot.sendMessage(114083702, "Juego reiniciado: \n" + JSON.stringify(msg));
  }
  bot.sendMessage(
    chatId,
    "La partida ha sido reiniciada!\nPueden unirse con /unirse"
  );
  bd.write(data);
}

function unirse(msg) {
  let chatId = msg.chat.id;
  if (!data.players["p" + msg.from.id]) {
    data.players["p" + msg.from.id] = new Player(msg.from);
  } else {
    data.players["p" + msg.from.id].first_name = msg.from.first_name;
    data.players["p" + msg.from.id].username = msg.from.username;
  }
  if (bans.indexOf(msg.from.id) < 0) {
    if (data.games["g" + chatId] != null) {
      if (
        !data.games["g" + chatId].players.find(
          (player) => player == msg.from.id
        )
      ) {
        if (data.games["g" + chatId].player == null) {
          if (data.games["g" + chatId].players.length < 4) {
            bot.getChat(chatId).then((chat) => {
              data.players["p" + msg.from.id].games.unshift({
                title: chat.title,
                id: chatId,
              });
              bd.write(data);
            });
            data.games["g" + chatId].players.unshift(msg.from.id);
            data.games["g" + chatId].head =
              data.games["g" + chatId].players.length - 1;
            bot.sendMessage(
              chatId,
              "Bienvenido " +
                msg.from.first_name +
                "(@" +
                msg.from.username +
                "). Te has unido a la partida." +
                "\nJugadores actuales: " +
                data.games["g" + chatId].players.length,
              {
                reply_to_message_id: msg.message_id,
              }
            );
          } else {
            bot.sendMessage(
              chatId,
              "Ya la mesa esta llena, espera que la partida actual termine para poder unirte."
            );
          }
        } else {
          bot.sendMessage(
            chatId,
            "Ya la partida inicio, espera que la partida actual termine para poder unirte."
          );
        }
      } else {
        bot.sendMessage(chatId, "Ya estas en esta partida.");
      }
      data.players["p" + msg.from.id].game = chatId;
    } else {
      bot.sendMessage(
        chatId,
        "La partida no esta creada!\nCrea una con /crear"
      );
    }
  } else {
    bot.sendMessage(
      chatId,
      "Usted esta baneado del uso de este bot,\nSolicita a @OsiNubis99 que permita el uso para esta persona si crees que es un error."
    );
  }
  bd.write(data);
}

function configurar(msg, match) {
  let chatId = msg.chat.id;
  if (data.games["g" + chatId] != null) {
    if (
      match["input"] == "/configurar" ||
      match["input"] == "/configurar@CaidaVZLABot"
    ) {
      bot.sendMessage(
        chatId,
        "Se empieza a repartir por el " +
          data.games["g" + chatId].configs.start +
          "\n Para cambiar este valor envia:\n /configurar iniciar 4 o iniciar 1" +
          "\nPronto agregaremos mas configuraciones"
      );
    } else {
      if (match[1] == "iniciar 1" || match[1] == "iniciar 4") {
        data.games["g" + chatId].configs.start =
          match[1] == "iniciar 1" ? 1 : 4;
        bot.sendMessage(
          chatId,
          "Iniciare por el " + data.games["g" + chatId].configs.start
        );
      } else {
        bot.sendMessage(
          chatId,
          "Comando desconocido.\nEnvia /configurar para leer mas..."
        );
      }
    }
  } else {
    bot.sendMessage(chatId, "La partida no esta creada!\nCrea una con /crear");
  }
  bd.write(data);
}

function BarajarYRepartir(chatId) {
  let resp = "Barajando y Repartiendo.\n";
  let card,
    order = [];
  data.games["g" + chatId].deck = Game.barajar();
  while (data.games["g" + chatId].cards[0].length < 3) {
    card = new Card(data.games["g" + chatId].deck.pop());
    while (data.games["g" + chatId].table[card.position] != null) {
      data.games["g" + chatId].deck.unshift(card.number);
      card = new Card(data.games["g" + chatId].deck.pop());
    }
    data.games["g" + chatId].table[card.position] = card;
    order.push(card.value);
    Game.repartir(data.games["g" + chatId]);
  }
  card = new Card(data.games["g" + chatId].deck.pop());
  while (data.games["g" + chatId].table[card.position] != null) {
    data.games["g" + chatId].deck.unshift(card.number);
    card = new Card(data.games["g" + chatId].deck.pop());
  }
  data.games["g" + chatId].table[card.position] = card;
  data.games["g" + chatId].card = card;
  order.push(card.value);
  let points = 0,
    i = data.games["g" + chatId].configs.start == 4 ? 0 : 3,
    j = data.games["g" + chatId].configs.start == 4 ? 1 : -2;
  while (i >= 0 && i <= 3) {
    points += order[i] == i + j ? i + j : 0;
    if (data.games["g" + chatId].configs.start == 4) {
      i++;
    } else {
      i--;
      j += 2;
    }
  }
  if (points > 0) {
    data.games["g" + chatId].points[1] += points;
    resp += "Pegaron " + points + " en mesa\n";
  } else {
    data.games["g" + chatId].points[0] += 1;
    resp += "Mal Echada\n";
  }
  resp +=
    order[0] + " -> " + order[1] + " -> " + order[2] + " -> " + order[3] + "\n";
  return resp;
}

function iniciar(msg) {
  let chatId = msg.chat.id;
  if (data.games["g" + chatId] != null) {
    if (data.games["g" + chatId].player == null) {
      if (
        data.games["g" + chatId].head == 1 ||
        data.games["g" + chatId].head == 3
      ) {
        data.games["g" + chatId].player = 0;
        bot.sendMessage(
          chatId,
          BarajarYRepartir(chatId) +
            "Primer jugador: " +
            data.players["p" + data.games["g" + chatId].players[0]].first_name +
            "(@" +
            data.players["p" + data.games["g" + chatId].players[0]].username +
            ")",
          {
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text:
                      "Escoge una carta " +
                      data.players[
                        "p" + Game.getPlayer(data.games["g" + chatId])
                      ].first_name,
                    switch_inline_query_current_chat: "",
                  },
                ],
              ],
            },
          }
        );
      } else {
        bot.sendMessage(chatId, "Es necesario 2 o 4 jugadores.");
      }
    } else {
      bot.sendMessage(chatId, "Ya la partida inicio!");
    }
  } else {
    bot.sendMessage(chatId, "La partida no esta creada!\nCrea una con /crear");
  }
  bd.write(data);
}

function estado(msg) {
  let chatId = msg.chat.id;
  if (data.games["g" + chatId] == null) {
    bot.sendMessage(chatId, "La partida no esta creada!\nCrea una con /crear");
  } else {
    bot.sendMessage(chatId, Game.status(data, chatId, false));
  }
}

function verCartas(msg) {
  playerId = msg.from.id;
  chatId = playerId;
  if (
    data.players["p" + playerId] &&
    data.players["p" + playerId].game != null
  ) {
    if (data.games["g" + data.players["p" + playerId].game].player != null) {
      let resp = "Tus cartas son:",
        i = 0;
      for (c of data.games["g" + data.players["p" + playerId].game].cards[
        data.games["g" + data.players["p" + playerId].game].players.indexOf(
          playerId
        )
      ]) {
        resp += "\n" + i + ": " + c.value;
        i++;
      }
      bot.sendMessage(chatId, resp);
    } else {
      bot.sendMessage(chatId, "El juego aun no empieza");
    }
  } else {
    bot.sendMessage(chatId, "No se ha unido a ningun juego");
  }
}

/**
 * Mostrar basado en las configuraciones
 * Require DataBase
 */
function cantos(msg) {
  let chatId = msg.chat.id;
  let response =
    'Cantos 👇\n\n#Ronda\n"Dos cartas iguales"\n\n#Chiguire\n"Escalera Par o no par (1~3~5 o 2~4~6)"\n\n#Patrulla\n"Tres cartas seguidas"\n\n#Vigía\n"Dos cartas iguales y una mayor o menor en una unidad"\n\n#Registro\n"1 11 12"\n\n#Maguaro\n"1 10 12"\n\n#Registrico\n"1 10 11"\n\n#Casa_Chica\n"1 1 12"\n\n#Casa_Grande\n"1 12 12"\n\n#Trivilin\n"Tres cartas iguales"';
  bot.sendMessage(chatId, response);
}

function cantar(msg, match) {
  let playerId = msg.from.id;
  if (data.players["p" + playerId]&&data.players["p" + playerId].game) {
    let chatId = data.players["p" + playerId].game;
    if (data.games["g" + chatId].player != null) {
      let team = data.games["g" + chatId].players.indexOf(playerId);
      if (data.games["g" + chatId].cards[team].length == 3) {
        if (data.games["g" + chatId].sings[team].name == "Tres Cartas") {
          data.games["g" + chatId].sings[team] = new Sing(
            match[1],
            data.games["g" + chatId].cards[team]
          );
          bot.sendMessage(
            chatId,
            "@" +
              data.players["p" + playerId].username +
              " cantó " +
              data.games["g" + chatId].sings[team].name
          );
        } else {
          bot.sendMessage(
            chatId,
            "Ya Cantaste " + data.games["g" + chatId].sings[team].name
          );
        }
      } else {
        bot.sendMessage(chatId, "Solo puedes cantar cuando tienes 3 cartas");
      }
    } else {
      bot.sendMessage(chatId, "El juego aun no empieza");
    }
  }
  bd.write(data);
}

function jugarCarta(msg, match) {
  let playerId = msg.from.id;
  let respuesta = "";
  let barajarRepartir = false;
  if (data.players["p" + playerId] && data.players["p" + playerId].game) {
    let chatId = data.players["p" + playerId].game;
    if (data.games["g" + chatId].player != null) {
      if (Game.getPlayer(data.games["g" + chatId]) == playerId) {
        card = data.games["g" + chatId].cards[
          data.games["g" + chatId].player
        ].splice(match[1], 1)[0];
        if (
          data.games["g" + chatId].cards[data.games["g" + chatId].player]
            .length == 2 &&
          !(
            data.games["g" + chatId].sings[data.games["g" + chatId].player]
              .name == "Tres Cartas" ||
            data.games["g" + chatId].sings[data.games["g" + chatId].player]
              .name == "Un Mal Canto"
          )
        ) {
          data.games["g" + chatId].sings[
            data.games["g" + chatId].player
          ].name += " al " + card.value;
        }
        if (data.games["g" + chatId].table[card.position] == null) {
          data.games["g" + chatId].table[card.position] = card;
        } else {
          data.games["g" + chatId].lastTaked = data.games["g" + chatId].player;
          if (
            data.games["g" + chatId].card.value == card.value &&
            data.games["g" + chatId].table[card.position] != null
          ) {
            let anterior = data.games["g" + chatId].player - 1;
            anterior = anterior < 0 ? data.games["g" + chatId].head : anterior;
            data.games["g" + chatId].sings[anterior].value = 0;
            data.games["g" + chatId].points[
              data.games["g" + chatId].player % 2
            ] +=
              card.value == 10
                ? 2
                : card.value == 11
                ? 3
                : card.value == 12
                ? 4
                : 1;
            respuesta +=
              "Caído!!! +" +
              (card.value == 10
                ? 2
                : card.value == 11
                ? 3
                : card.value == 12
                ? 4
                : 1) +
              " puntos\n";
          }
          let i = card.position;
          data.games["g" + chatId].taked[data.games["g" + chatId].player % 2]++;
          while (i < 10 && data.games["g" + chatId].table[i] != null) {
            data.games["g" + chatId].taked[
              data.games["g" + chatId].player % 2
            ]++;
            data.games["g" + chatId].table[i] = null;
            i++;
          }
          i = 0;
          while (i < 10 && data.games["g" + chatId].table[i] == null) {
            i++;
          }
          if (i == 10 && !data.games["g" + chatId].lastOne) {
            data.games["g" + chatId].points[
              data.games["g" + chatId].player % 2
            ] += 4;
            respuesta += "Mesa Limpia!! +4 puntos!\n";
          }
        }
        data.games["g" + chatId].card = card;
        if (
          data.games["g" + chatId].player == data.games["g" + chatId].head &&
          !data.games["g" + chatId].cards[0].length
        ) {
          barajarRepartir = true;
          let teamA1 = data.games["g" + chatId].sings[1].value,
            teamB1 = data.games["g" + chatId].sings[0].value,
            teamA2 = data.games["g" + chatId].sings[3].value,
            teamB2 = data.games["g" + chatId].sings[2].value;
          if (
            (teamA1 > teamB1 && teamA1 > teamB2) ||
            (teamA2 > teamB1 && teamA2 > teamB2)
          ) {
            data.games["g" + chatId].points[1] +=
              teamA1 > teamA2 ? teamA1 : teamA2;
          } else {
            data.games["g" + chatId].points[0] +=
              teamB1 > teamB2 ? teamB1 : teamB2;
          }
          data.games["g" + chatId].sings = [
            new Sing(null),
            new Sing(null),
            new Sing(null),
            new Sing(null),
          ];
          let mazoV = mazoVacio(chatId);
          if (!mazoV) {
            let i = 0;
            respuesta += "Repartiendo...\n";
            while (i < 3) {
              Game.repartir(data.games["g" + chatId]);
              i++;
            }
            if (!data.games["g" + chatId].deck.length) {
              respuesta += "#ULTIMAS!!!\n";
              data.games["g" + chatId].lastOne = true;
            }
          } else {
            respuesta += mazoV;
          }
        }
        if (puedeSeguir(chatId)) {
          data.games["g" + chatId].player =
            (data.games["g" + chatId].player + 1) %
            data.games["g" + chatId].players.length;
          respuesta += Game.status(data, chatId, !barajarRepartir);
          bot.sendMessage(chatId, respuesta, {
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text:
                      "Escoge una carta " +
                      data.players[
                        "p" + Game.getPlayer(data.games["g" + chatId])
                      ].first_name,
                    switch_inline_query_current_chat: "",
                  },
                ],
              ],
            },
          });
        }
      } else {
        bot.sendMessage(chatId, "Carta Vista!\nNo es tu turno!");
        bot.sendMessage(chatId, Game.status(data, chatId, true), {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text:
                    "Escoge una carta " +
                    data.players["p" + Game.getPlayer(data.games["g" + chatId])]
                      .first_name,
                  switch_inline_query_current_chat: "",
                },
              ],
            ],
          },
        });
      }
    } else {
      estado({
        chat: {
          id: chatId,
        },
      });
    }
  }
  bd.write(data);
}

function mazoVacio(chatId) {
  if (!data.games["g" + chatId].deck.length) {
    let j = 0,
      i = 0;
    while (i < 10) {
      if (data.games["g" + chatId].table[i] != null) {
        data.games["g" + chatId].table[i] = null;
        j++;
      }
      i++;
    }
    if (data.games["g" + chatId].lastTaked != null) {
      data.games["g" + chatId].taked[
        data.games["g" + chatId].lastTaked % 2
      ] += j;
    } else {
      data.games["g" + chatId].taked[data.games["g" + chatId].head] += j;
    }
    let teamA = data.games["g" + chatId].taked[0],
      teamB = data.games["g" + chatId].taked[1];
    if (teamA > teamB) {
      data.games["g" + chatId].points[0] += teamA - 20;
    } else {
      data.games["g" + chatId].points[1] += teamB - 20;
    }
    data.games["g" + chatId].players.push(
      data.games["g" + chatId].players.shift()
    );
    data.games["g" + chatId].points.push(
      data.games["g" + chatId].points.shift()
    );
    data.games["g" + chatId].taked = [0, 0];
    data.games["g" + chatId].lastTaked = null;
    data.games["g" + chatId].lastOne = false;
    data.games["g" + chatId].card = null;
    return BarajarYRepartir(chatId);
  }
  return false;
}

function puedeSeguir(chatId) {
  if (
    data.games["g" + chatId].points[0] >= 24 ||
    data.games["g" + chatId].points[1] >= 24
  ) {
    if (
      data.games["g" + chatId].points[0] > data.games["g" + chatId].points[1]
    ) {
      bot.sendMessage(
        chatId,
        "Partida finalizada!\nGano: " +
          data.players["p" + data.games["g" + chatId].players[0]].first_name +
          " (@" +
          data.players["p" + data.games["g" + chatId].players[0]].username +
          ")" +
          (data.games["g" + chatId].head == 3
            ? "\n y " +
              data.players["p" + data.games["g" + chatId].players[2]]
                .first_name +
              " (@" +
              data.players["p" + data.games["g" + chatId].players[2]].username +
              ")"
            : "")
      );
    } else {
      bot.sendMessage(
        chatId,
        "Partida finalizada!\nGano: " +
          data.players["p" + data.games["g" + chatId].players[1]].first_name +
          " (@" +
          data.players["p" + data.games["g" + chatId].players[1]].username +
          ")" +
          (data.games["g" + chatId].head == 3
            ? "\n y " +
              data.players["p" + data.games["g" + chatId].players[3]]
                .first_name +
              " (@" +
              data.players["p" + data.games["g" + chatId].players[3]].username +
              ")"
            : "")
      );
    }
    // bot.sendMessage(114083702, "Juego finalizado:\n" + JSON.stringify(msg));
    bot.sendMessage(chatId, Game.status(data, chatId, false));
    data.games["g" + chatId].players.forEach((id) => {
      data.players["p" + id].games.splice(
        data.players["p" + id].games.indexOf(
          data.players["p" + id].games.find((value) => {
            return value.id == chatId;
          })
        ),
        1
      );
      if (data.players["p" + id].game == chatId) {
        data.players["p" + id].game =
          data.players["p" + id].games.length != 0
            ? data.players["p" + id].games[0].id
            : null;
      }
    });
    data.games["g" + chatId] = undefined;
    return false;
  }
  return true;
}

function pasar(msg, match) {
  let chatId = msg.chat.id;
  if (data.games["g" + chatId] && data.games["g" + chatId].player) {
    if (data.games["g" + chatId].owner == msg.from.id || match[1] == "force") {
      let player = data.games["g" + chatId].player;
      let number =
        Math.round(Math.random() * 1000) %
        data.games["g" + chatId].cards[player].length;
      jugarCarta(
        {
          from: {
            id: data.games["g" + chatId].players[player],
          },
        },
        [0, number]
      );
    } else {
      bot.sendMessage(
        chatId,
        "Solo el creador de la partida puede hacer esto."
      );
    }
  } else {
    bot.sendMessage(chatId, "La partida no esta creada!\nCrea una con /crear");
  }
  bd.write(data);
}

function juego(msg) {
  let playerId = msg.from.id,
    chatId = msg.chat.id;
  if (data.players["p" + playerId] && data.players["p" + playerId].game) {
    if (data.players["p" + playerId].games.length > 1) {
      let position = data.players["p" + playerId].games.indexOf(
        data.players["p" + playerId].games.find((value) => {
          return value.id == chatId;
        })
      );
      if (position >= 0) {
        temp = data.players["p" + playerId].games[position];
        data.players["p" + playerId].games.splice(position, 1);
        data.players["p" + playerId].games.unshift(temp);
        data.players["p" + playerId].game = temp.id;
        bot.sendMessage(chatId, "Ahora estas jugando en este chat");
      } else {
        bot.sendMessage(chatId, "No estas jugando en este chat");
      }
    } else {
      bot.sendMessage(chatId, "Solo estas jugando en un juego");
    }
  } else {
    bot.sendMessage(chatId, "No se ha unido a ningun juego");
  }
  bd.write(data);
}

bot.onText(/\/crear/, crear);

bot.onText(/\/eliminar/, eliminar);

bot.onText(/\/reiniciar/, reiniciar);

bot.onText(/\/unirse/, unirse);

//bot.onText(/\/configurar(.*)/, configurar);

//bot.onText(/\/configurar/, configurar);

bot.onText(/\/iniciar/, iniciar);

bot.onText(/\/estado/, estado);

//bot.onText(/\/cartas/, verCartas);

bot.onText(/\/cantos/, cantos);

bot.onText(/\/cantar(.*)/, cantar);

//bot.onText(/\/jugar(.*)/, jugarCarta);

bot.onText(/\/pasar(.*)/, pasar);

bot.onText(/\/juego/, juego);

bot.on("error", (err) => {
  console.log(err);
  bot.sendMessage(114083702, "#Error: \n" + JSON.stringify(err));
});

bot.on("polling_error", (err) => {
  console.log(err);
  bot.sendMessage(114083702, "#Error: \n" + JSON.stringify(err));
});

// crear - Crea una nueva partida
// eliminar - Elimina el juego actual
// reiniciar - Reinicia el juego actual
// unirse - Te agrega al juego actual
// configurar - Informacion de la configuracion actual
// iniciar - Inicia el juego actual
// estado - Manda el estado de la partida
// cartas - Manda tus cartas al privado
// cantos - Lista los cantos del juego disponibles
// cantar - Canta el parámetro que se le pase
// jugar - Juega el índice de carta pasado (0, 1 o 2)
// pasar - Salta al jugador actual
// help - Explica como jugar
