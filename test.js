var Game = require("./class/Game");
var Card = require("./class/Card");
var Sing = require("./class/Sing");
var Player = require("./class/Player");
var bd = require("./configs/bd");
var groups = ["-1001432406771", "-358611014"];

let data = bd.read();

function crear(msg) {
  let chatId = msg.chat.id;
  let fake = false;
  groups.forEach((value) => {
    if (value == chatId) fake = true;
  });
  if (fake) {
    if (data.games[chatId.toString()] == undefined) {
      data.games[chatId.toString()] = new Game(msg.from.id);
      console.log(
        "Partida creada!\nPueden unirse con /unirse y empezar el juego con /iniciar"
      );
    } else
      console.log(
        "La partida ya esta creada!\nPueden unirse con /unirse y empezar el juego con /iniciar"
      );
  } else {
    console.log(
      "Este bot esta en desarrollo, por favor juega en @JuegaCaidaVZLA\nO solicita a @OsiNubis99 que permita este grupo."
    );
  }
  bd.write(data);
}

function eliminar(msg) {
  let chatId = msg.chat.id;
  if (data.games[chatId.toString()] != null) {
    data.games[chatId.toString()].players.forEach((id) => {
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
    data.games[chatId.toString()] = undefined;
    console.log("Partida eliminada!\nCrea una nueva con /crear");
  } else {
    console.log("La partida no esta creada!\nCrea una con /crear");
  }
  bd.write(data);
}

function reiniciar(msg) {
  let chatId = msg.chat.id;
  if (data.games[chatId.toString()]) {
    data.games[chatId.toString()].players.forEach((id) => {
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
  data.games[chatId.toString()] = new Game(msg.from.id);
  console.log("La partida ha sido reiniciada!\nPueden unirse con /unirse");
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
  if (data.games[chatId.toString()] != null) {
    if (
      !data.games[chatId.toString()].players.find(
        (player) => player == msg.from.id
      )
    ) {
      if (data.games[chatId.toString()].player == null) {
        if (data.games[chatId.toString()].players.length < 4) {
          bd.write(data);
          data.games[chatId.toString()].players.unshift(msg.from.id);
          data.games[chatId.toString()].head =
            data.games[chatId.toString()].players.length - 1;
          console.log(
            "Bienvenido " +
              msg.from.first_name +
              "(@" +
              msg.from.username +
              "). Te has unido a la partida."
          );
        } else {
          console.log(
            "Ya la mesa esta llena, espera que la partida actual termine para poder unirte."
          );
        }
      } else {
        console.log(
          "Ya la partida inicio, espera que la partida actual termine para poder unirte."
        );
      }
    } else {
      console.log("Ya estas en esta partida.");
    }
    data.players["p" + msg.from.id].game = chatId;
  } else {
    console.log("La partida no esta creada!\nCrea una con /crear");
  }
  bd.write(data);
}

function configurar(msg, match) {
  let chatId = msg.chat.id;
  if (data.games[chatId.toString()] != null) {
    if (
      match["input"] == "/configurar" ||
      match["input"] == "/configurar@CaidaVZLABot"
    ) {
      console.log(
        "Se empieza a repartir por el " +
          data.games[chatId.toString()].configs.start +
          "\n Para cambiar este valor envia:\n /configurar iniciar 4 o iniciar 1" +
          "\nPronto agregaremos mas configuraciones"
      );
    } else {
      if (match[1] == "iniciar 1" || match[1] == "iniciar 4") {
        data.games[chatId.toString()].configs.start =
          match[1] == "iniciar 1" ? 1 : 4;
        console.log(
          "Iniciare por el " + data.games[chatId.toString()].configs.start
        );
      } else {
        console.log("Comando desconocido.\nEnvia /configurar para leer mas...");
      }
    }
  } else {
    console.log("La partida no esta creada!\nCrea una con /crear");
  }
  bd.write(data);
}

function BarajarYRepartir(chatId) {
  let resp = "Barajando y Repartiendo.\n";
  let card,
    order = [];
  data.games[chatId.toString()].deck = Game.barajar();
  while (data.games[chatId.toString()].cards[0].length < 3) {
    card = new Card(data.games[chatId.toString()].deck.pop());
    while (data.games[chatId.toString()].table[card.position] != null) {
      data.games[chatId.toString()].deck.unshift(card.number);
      card = new Card(data.games[chatId.toString()].deck.pop());
    }
    data.games[chatId.toString()].table[card.position] = card;
    order.push(card.value);
    Game.repartir(data.games[chatId.toString()]);
  }
  card = new Card(data.games[chatId.toString()].deck.pop());
  while (data.games[chatId.toString()].table[card.position] != null) {
    data.games[chatId.toString()].deck.unshift(card.number);
    card = new Card(data.games[chatId.toString()].deck.pop());
  }
  data.games[chatId.toString()].table[card.position] = card;
  data.games[chatId.toString()].card = card;
  order.push(card.value);
  let points = 0,
    i = data.games[chatId.toString()].configs.start == 4 ? 0 : 3,
    j = data.games[chatId.toString()].configs.start == 4 ? 1 : -2;
  while (i >= 0 && i <= 3) {
    points += order[i] == i + j ? i + j : 0;
    if (data.games[chatId.toString()].configs.start == 4) {
      i++;
    } else {
      i--;
      j += 2;
    }
  }
  if (points > 0) {
    data.games[chatId.toString()].points[1] += points;
    resp += "Pegaron " + points + " en mesa\n";
  } else {
    data.games[chatId.toString()].points[0] += 1;
    resp += "+1 por Mal Echada\n";
  }
  resp +=
    order[0] + " -> " + order[1] + " -> " + order[2] + " -> " + order[3] + "\n";
  return resp;
}

function iniciar(msg) {
  msg.from;
  let chatId = msg.chat.id;
  if (data.games[chatId.toString()] != null) {
    if (data.games[chatId.toString()].player == null) {
      if (
        data.games[chatId.toString()].head == 1 ||
        data.games[chatId.toString()].head == 3
      ) {
        data.games[chatId.toString()].player = 0;
        console.log(
          BarajarYRepartir(chatId) +
            "Primer jugador: " +
            data.players["p" + data.games[chatId.toString()].players[0]]
              .first_name +
            "(@" +
            data.players["p" + data.games[chatId.toString()].players[0]]
              .username +
            ")",
          {
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text:
                      "Escoge una carta " +
                      data.players[
                        "p" + Game.getPlayer(data.games[chatId.toString()])
                      ].first_name,
                    switch_inline_query_current_chat: "",
                  },
                ],
              ],
            },
          }
        );
      } else {
        console.log("Es necesario 2 o 4 jugadores.");
      }
    } else {
      console.log("Ya la partida inicio!");
    }
  } else {
    console.log("La partida no esta creada!\nCrea una con /crear");
  }
  bd.write(data);
}

function estado(msg) {
  let chatId = msg.chat.id;
  if (data.games[chatId.toString()] == undefined) {
    console.log("La partida no esta creada!\nCrea una con /crear");
  } else {
    console.log(Game.status(data, chatId, false));
  }
}

function verCartas(msg) {
  playerId = msg.from.id;
  chatId = playerId;
  if (data.players["p" + playerId].game != null) {
    if (
      data.games[data.players["p" + playerId].game.toString()].player != null
    ) {
      let resp = "Tus cartas son:",
        i = 0;
      for (c of data.games[data.players["p" + playerId].game.toString()].cards[
        data.games[
          data.players["p" + playerId].game.toString()
        ].players.indexOf(playerId)
      ]) {
        resp += "\n" + i + ": " + c.value;
        i++;
      }
      console.log(resp);
    } else {
      console.log("El juego aun no empieza");
    }
  } else {
    console.log("No se ha unido a ningun juego");
  }
}

function cantar(msg, match) {
  let playerId = msg.from.id;
  if (data.players["p" + playerId].game != null) {
    let chatId = data.players["p" + playerId].game;
    if (data.games[chatId.toString()].player != null) {
      let team = data.games[chatId.toString()].players.indexOf(playerId);
      if (data.games[chatId.toString()].cards[team].length == 3) {
        if (data.games[chatId.toString()].sings[team].name == "Tres Cartas") {
          data.games[chatId.toString()].sings[team] = new Sing(
            match[1],
            data.games[chatId.toString()].cards[team]
          );
          console.log(
            "@" +
              data.players["p" + playerId].username +
              " cantó " +
              data.games[chatId.toString()].sings[team].name
          );
        } else {
          console.log(
            "Ya Cantaste " + data.games[chatId.toString()].sings[team].name
          );
        }
      } else {
        console.log("Solo puedes cantar cuando tienes 3 cartas");
      }
    } else {
      console.log("El juego aun no empieza");
    }
  } else {
    console.log("No se ha unido a ningun juego");
  }
  bd.write(data);
}

function jugarCarta(msg, match) {
  let playerId = msg.from.id;
  let respuesta = "";
  if (data.players["p" + playerId] && data.players["p" + playerId].game) {
    let chatId = data.players["p" + playerId].game;
    if (data.games[chatId.toString()].player != null) {
      if (Game.getPlayer(data.games[chatId.toString()]) == playerId) {
        card = data.games[chatId.toString()].cards[
          data.games[chatId.toString()].player
        ].splice(match[1], 1)[0];
        if (
          data.games[chatId.toString()].cards[
            data.games[chatId.toString()].player
          ].length == 2 &&
          !(
            data.games[chatId.toString()].sings[
              data.games[chatId.toString()].player
            ].name == "Tres Cartas" ||
            data.games[chatId.toString()].sings[
              data.games[chatId.toString()].player
            ].name == "Un Mal Canto"
          )
        ) {
          data.games[chatId.toString()].sings[
            data.games[chatId.toString()].player
          ].name += " al " + card.value;
        }
        if (data.games[chatId.toString()].table[card.position] == null) {
          data.games[chatId.toString()].table[card.position] = card;
        } else {
          data.games[chatId.toString()].lastTaked =
            data.games[chatId.toString()].player;
          if (
            data.games[chatId.toString()].card.value == card.value &&
            data.games[chatId.toString()].table[card.position] != null
          ) {
            let anterior = data.games[chatId.toString()].player - 1;
            anterior =
              anterior < 0 ? data.games[chatId.toString()].head : anterior;
            data.games[chatId.toString()].sings[anterior].value = 0;
            data.games[chatId.toString()].points[
              data.games[chatId.toString()].player % 2
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
          data.games[chatId.toString()].taked[
            data.games[chatId.toString()].player % 2
          ]++;
          while (i < 10 && data.games[chatId.toString()].table[i] != null) {
            data.games[chatId.toString()].taked[
              data.games[chatId.toString()].player % 2
            ]++;
            data.games[chatId.toString()].table[i] = null;
            i++;
          }
          i = 0;
          while (i < 10 && data.games[chatId.toString()].table[i] == null) {
            i++;
          }
          if (i == 10 && !data.games[chatId.toString()].lastOne) {
            data.games[chatId.toString()].points[
              data.games[chatId.toString()].player % 2
            ] += 4;
            respuesta += "Mesa Limpia!! +4 puntos!\n";
          }
        }
        data.games[chatId.toString()].card = card;
        if (
          data.games[chatId.toString()].player ==
            data.games[chatId.toString()].head &&
          !data.games[chatId.toString()].cards[0].length
        ) {
          let teamA1 = data.games[chatId.toString()].sings[0].value,
            teamB1 = data.games[chatId.toString()].sings[1].value,
            teamA2 = data.games[chatId.toString()].sings[2].value,
            teamB2 = data.games[chatId.toString()].sings[3].value;
          if (
            (teamA1 > teamB1 && teamA1 > teamB2) ||
            (teamA2 > teamB1 && teamA2 > teamB2)
          ) {
            data.games[chatId.toString()].points[0] +=
              teamA1 > teamA2 ? teamA1 : teamA2;
          } else {
            data.games[chatId.toString()].points[1] +=
              teamB1 > teamB2 ? teamB1 : teamB2;
          }
          data.games[chatId.toString()].sings = [
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
              Game.repartir(data.games[chatId.toString()]);
              i++;
            }
            if (!data.games[chatId.toString()].deck.length) {
              respuesta += "Ultimas!!!\n";
              data.games[chatId.toString()].lastOne = true;
            }
          } else {
            respuesta += mazoV;
          }
        }
        if (puedeSeguir(chatId)) {
          data.games[chatId.toString()].player =
            (data.games[chatId.toString()].player + 1) %
            data.games[chatId.toString()].players.length;
          respuesta += Game.status(data, chatId, true);
          console.log(respuesta, {
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text:
                      "Escoge una carta " +
                      data.players[
                        "p" + Game.getPlayer(data.games[chatId.toString()])
                      ].first_name,
                    switch_inline_query_current_chat: "",
                  },
                ],
              ],
            },
          });
        }
      } else {
        console.log("Carta Vista!\nNo es tu turno!");
        console.log(Game.status(data, chatId, true), {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text:
                    "Escoge una carta " +
                    data.players[
                      "p" + Game.getPlayer(data.games[chatId.toString()])
                    ].first_name,
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
  if (!data.games[chatId.toString()].deck.length) {
    let j = 0,
      i = 0;
    while (i < 10) {
      if (data.games[chatId.toString()].table[i] != null) {
        data.games[chatId.toString()].table[i] = null;
        j++;
      }
      i++;
    }
    if (data.games[chatId.toString()].lastTaked != null) {
      data.games[chatId.toString()].taked[
        data.games[chatId.toString()].lastTaked % 2
      ] += j;
    } else {
      data.games[chatId.toString()].taked[
        data.games[chatId.toString()].head
      ] += j;
    }
    let teamA = data.games[chatId.toString()].taked[0],
      teamB = data.games[chatId.toString()].taked[1];
    if (teamA > teamB) {
      data.games[chatId.toString()].points[0] += teamA - 20;
    } else {
      data.games[chatId.toString()].points[1] += teamB - 20;
    }
    data.games[chatId.toString()].players.push(
      data.games[chatId.toString()].players.shift()
    );
    data.games[chatId.toString()].points.push(
      data.games[chatId.toString()].points.shift()
    );
    data.games[chatId.toString()].taked = [0, 0];
    data.games[chatId.toString()].lastTaked = null;
    data.games[chatId.toString()].lastOne = false;
    data.games[chatId.toString()].card = null;
    return BarajarYRepartir(chatId);
  }
  return false;
}

function puedeSeguir(chatId) {
  if (
    data.games[chatId.toString()].points[0] > 24 ||
    data.games[chatId.toString()].points[1] > 24
  ) {
    if (
      data.games[chatId.toString()].points[0] >
      data.games[chatId.toString()].points[1]
    ) {
      console.log(
        "Partida finalizada!\nGano: " +
          data.players["p" + data.games[chatId.toString()].players[0]]
            .first_name +
          " (@" +
          data.players["p" + data.games[chatId.toString()].players[0]]
            .username +
          ")" +
          (data.games[chatId.toString()].head == 3
            ? "\n y " +
              data.players["p" + data.games[chatId.toString()].players[2]]
                .first_name +
              " (@" +
              data.players["p" + data.games[chatId.toString()].players[2]]
                .username +
              ")"
            : "")
      );
    } else {
      console.log(
        "Partida finalizada!\nGano: " +
          data.players["p" + data.games[chatId.toString()].players[1]]
            .first_name +
          " (@" +
          data.players["p" + data.games[chatId.toString()].players[1]]
            .username +
          ")" +
          (data.games[chatId.toString()].head == 3
            ? "\n y " +
              data.players["p" + data.games[chatId.toString()].players[3]]
                .first_name +
              " (@" +
              data.players["p" + data.games[chatId.toString()].players[3]]
                .username +
              ")"
            : "")
      );
    }
    console.log(Game.status(data, chatId, false));
    data.games[chatId.toString()].players.forEach((id) => {
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
    data.games[chatId.toString()] = undefined;
    return false;
  }
  return true;
}

function pasar(msg) {
  let chatId = msg.chat.id;
  if (data.games[chatId.toString()] != null) {
    if (data.games[chatId.toString()].owner == msg.from.id) {
      jugarCarta(
        {
          from: {
            id:
              data.games[chatId.toString()].players[
                data.games[chatId.toString()].player
              ],
          },
        },
        [0, 0]
      );
    } else {
      console.log("Solo el creador puede hacer esto.");
    }
  } else {
    console.log("La partida no esta creada!\nCrea una con /crear");
  }
  bd.write(data);
}

function juego(msg) {
  let playerId = msg.from.id,
    chatId = msg.chat.id;
  if (data.players["p" + playerId].game != null) {
    if (data.players["p" + playerId].games.length > 1) {
      let position = data.players["p" + playerId].games.indexOf(
        data.players["p" + playerId].games.find((value) => {
          return value.id == chatId;
        })
      );
      if (position >= 0) {
        data.players["p" + playerId].games.unshift(
          data.players["p" + playerId].games.splice(position, 1)
        );
        data.players["p" + playerId].game =
          data.players["p" + playerId].games[0].id;
        console.log("Ahora estas jugando en este chat");
      } else {
        console.log("No estas jugando en este chat");
      }
    } else {
      console.log("Solo estas jugando en un juego");
    }
  } else {
    console.log("No se ha unido a ningun juego");
  }
  bd.write(data);
}

eliminar({
  chat: {
    id: -358611014,
  },
});
crear({
  chat: {
    id: -358611014,
  },
  from: {
    id: 1528475655,
  },
});
unirse({
  chat: {
    id: -358611014,
  },
  from: {
    id: 1528475655,
    first_name: "Andresito",
    username: "OsiNubis99",
  },
});
unirse({
  chat: {
    id: -358611014,
  },
  from: {
    id: 2865565235,
    first_name: "Mafercita",
    username: "MafeerLourenco",
  },
});
iniciar({
  chat: {
    id: -358611014,
  },
});
verCartas(
  {
    chat: {
      id: -358611014,
    },
    from: {
      id: 1528475655,
    },
  },
  [0, "ronda"]
);
verCartas(
  {
    chat: {
      id: -358611014,
    },
    from: {
      id: 2865565235,
    },
  },
  [0, "ronda"]
);
// jugarCarta({from:{id:2865565235}},[0,0])
// jugarCarta({from:{id:1528475655}},[0,0])
// jugarCarta({from:{id:2865565235}},[0,0])
// jugarCarta({from:{id:1528475655}},[0,0])
// jugarCarta({from:{id:2865565235}},[0,0])
// jugarCarta({from:{id:1528475655}},[0,0])
// jugarCarta({from:{id:2865565235}},[0,0])
// jugarCarta({from:{id:1528475655}},[0,0])
// jugarCarta({from:{id:2865565235}},[0,0])
// jugarCarta({from:{id:1528475655}},[0,0])
// jugarCarta({from:{id:2865565235}},[0,0])
// jugarCarta({from:{id:1528475655}},[0,0])
// estado({chat:{id:-358611014}})
