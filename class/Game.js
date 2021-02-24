let configs = require("../configs/gameDefaults");
var Card = require("./Card");
var Sing = require("./Sing");

class Game {
  constructor(jugador) {
    this.owner = jugador;
    this.deck = [];
    this.sings = [
      new Sing(null),
      new Sing(null),
      new Sing(null),
      new Sing(null),
    ];
    this.points = [0, 0];
    this.cards = [[], [], [], []];
    this.table = [null, null, null, null, null, null, null, null, null, null];
    this.taked = [0, 0];
    this.configs = configs;
    this.card = null;
    this.lastTaked = null;
    this.head = 0;
    this.lastOne = false;
    this.player = null;
    this.players = [];
  }

  static getPlayer(chatGame) {
    return chatGame.players[chatGame.player];
  }

  static barajar() {
    let array = [
      11,
      10,
      38,
      19,
      25,
      18,
      14,
      2,
      5,
      39,
      8,
      15,
      29,
      24,
      30,
      1,
      12,
      16,
      9,
      35,
      22,
      32,
      6,
      4,
      0,
      27,
      37,
      17,
      28,
      33,
      21,
      3,
      23,
      34,
      20,
      7,
      31,
      36,
      26,
      13,
    ];
    var currentIndex = array.length,
      temporaryValue,
      randomIndex;
    while (0 !== currentIndex) {
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex -= 1;
      temporaryValue = array[currentIndex];
      array[currentIndex] = array[randomIndex];
      array[randomIndex] = temporaryValue;
    }
    return array;
  }

  static status(data, chatId, ligero) {
    let resp;
    if (data.games[chatId.toString()].player != null) {
      resp = "Mesa:";
      let c;
      for (c of data.games[chatId.toString()].table) {
        if (c != null) resp += " " + c.value;
        else resp += " []";
      }
      resp +=
        "\nUltima carta: " +
        data.games[chatId.toString()].card.value +
        " de " +
        data.games[chatId.toString()].card.type;
      resp += data.games[chatId.toString()].lastOne ? "\nUltimas!" : "";
      resp +=
        "\nSiguiente: @" +
        data.players[
          "p" +
            data.games[chatId.toString()].players[
              data.games[chatId.toString()].player
            ]
        ].username;
      if (!ligero) {
        if (data.games[chatId.toString()].head == 1) {
          resp +=
            "\nJugadores:\n @" +
            data.players["p" + data.games[chatId.toString()].players[0]]
              .username +
            " '" +
            data.games[chatId.toString()].sings[0].name +
            "'" +
            (data.games[chatId.toString()].sings[0].value == 0 &&
            data.games[chatId.toString()].sings[0].name != "Tres Cartas" &&
            data.games[chatId.toString()].sings[0].name != "Un Mal Canto"
              ? "😵"
              : " ") +
            " Cartas: " +
            data.games[chatId.toString()].cards[0].length +
            "\n    Puntos: " +
            data.games[chatId.toString()].points[0] +
            "  Agarrado: " +
            data.games[chatId.toString()].taked[0];
          resp +=
            "\n @" +
            data.players["p" + data.games[chatId.toString()].players[1]]
              .username +
            " '" +
            data.games[chatId.toString()].sings[1].name +
            "'" +
            (data.games[chatId.toString()].sings[1].value == 0 &&
            data.games[chatId.toString()].sings[1].name != "Tres Cartas" &&
            data.games[chatId.toString()].sings[1].name != "Un Mal Canto"
              ? "😵"
              : " ") +
            " Cartas: " +
            data.games[chatId.toString()].cards[1].length +
            "\n    Puntos: " +
            data.games[chatId.toString()].points[1] +
            "  Agarrado: " +
            data.games[chatId.toString()].taked[1];
        } else {
          resp +=
            "\nEquipo Mano  Puntos: " +
            data.games[chatId.toString()].points[0] +
            "  Agarrado: " +
            data.games[chatId.toString()].taked[0];
          resp +=
            "\n @" +
            data.players["p" + data.games[chatId.toString()].players[0]]
              .username +
            " '" +
            data.games[chatId.toString()].sings[0].name +
            "'" +
            (data.games[chatId.toString()].sings[0].value == 0 &&
            data.games[chatId.toString()].sings[0].name != "Tres Cartas" &&
            data.games[chatId.toString()].sings[0].name != "Un Mal Canto"
              ? "😵"
              : " ") +
            " Cartas: " +
            data.games[chatId.toString()].cards[0].length;
          resp +=
            "\n @" +
            data.players["p" + data.games[chatId.toString()].players[2]]
              .username +
            " '" +
            data.games[chatId.toString()].sings[2].name +
            "'" +
            (data.games[chatId.toString()].sings[2].value == 0 &&
            data.games[chatId.toString()].sings[2].name != "Tres Cartas" &&
            data.games[chatId.toString()].sings[2].name != "Un Mal Canto"
              ? "😵"
              : " ") +
            " Cartas: " +
            data.games[chatId.toString()].cards[2].length;
          resp +=
            "\nEquipo Mesa  Puntos: " +
            data.games[chatId.toString()].points[1] +
            "  Agarrado: " +
            data.games[chatId.toString()].taked[1];
          resp +=
            "\n @" +
            data.players["p" + data.games[chatId.toString()].players[1]]
              .username +
            " '" +
            data.games[chatId.toString()].sings[1].name +
            "'" +
            (data.games[chatId.toString()].sings[1].value == 0 &&
            data.games[chatId.toString()].sings[1].name != "Tres Cartas" &&
            data.games[chatId.toString()].sings[1].name != "Un Mal Canto"
              ? "😵"
              : " ") +
            " Cartas: " +
            data.games[chatId.toString()].cards[1].length;
          resp +=
            "\n @" +
            data.players["p" + data.games[chatId.toString()].players[3]]
              .username +
            " '" +
            data.games[chatId.toString()].sings[3].name +
            "'" +
            (data.games[chatId.toString()].sings[3].value == 0 &&
            data.games[chatId.toString()].sings[3].name != "Tres Cartas" &&
            data.games[chatId.toString()].sings[3].name != "Un Mal Canto"
              ? "😵"
              : " ") +
            " Cartas: " +
            data.games[chatId.toString()].cards[3].length;
        }
      }
    } else {
      resp =
        "El juego aun no empieza, usa /iniciar" +
        "\nEquipo Mano  Puntos: " +
        data.games[chatId.toString()].points[0] +
        "  Agarrado: " +
        data.games[chatId.toString()].taked[0] +
        (data.games[chatId.toString()].players[0]
          ? "\n @" +
            data.players["p" + data.games[chatId.toString()].players[0]]
              .username +
            " '" +
            data.games[chatId.toString()].sings[0].name +
            "'" +
            (data.games[chatId.toString()].sings[0].value == 0 &&
            data.games[chatId.toString()].sings[0].name != "Tres Cartas" &&
            data.games[chatId.toString()].sings[0].name != "Un Mal Canto"
              ? "😵"
              : " ") +
            " Cartas: " +
            data.games[chatId.toString()].cards[0].length
          : "") +
        (data.games[chatId.toString()].players[2]
          ? "\n @" +
            data.players["p" + data.games[chatId.toString()].players[2]]
              .username +
            " '" +
            data.games[chatId.toString()].sings[2].name +
            "'" +
            (data.games[chatId.toString()].sings[2].value == 0 &&
            data.games[chatId.toString()].sings[2].name != "Tres Cartas" &&
            data.games[chatId.toString()].sings[2].name != "Un Mal Canto"
              ? "😵"
              : " ") +
            " Cartas: " +
            data.games[chatId.toString()].cards[2].length
          : "") +
        "\nEquipo Mesa  Puntos: " +
        data.games[chatId.toString()].points[1] +
        "  Agarrado: " +
        data.games[chatId.toString()].taked[1] +
        (data.games[chatId.toString()].players[1]
          ? "\n @" +
            data.players["p" + data.games[chatId.toString()].players[1]]
              .username +
            " '" +
            data.games[chatId.toString()].sings[1].name +
            "'" +
            (data.games[chatId.toString()].sings[1].value == 0 &&
            data.games[chatId.toString()].sings[1].name != "Tres Cartas" &&
            data.games[chatId.toString()].sings[1].name != "Un Mal Canto"
              ? "😵"
              : " ") +
            " Cartas: " +
            data.games[chatId.toString()].cards[1].length
          : "") +
        (data.games[chatId.toString()].players[3]
          ? "\n @" +
            data.players["p" + data.games[chatId.toString()].players[3]]
              .username +
            " '" +
            data.games[chatId.toString()].sings[3].name +
            "'" +
            (data.games[chatId.toString()].sings[3].value == 0 &&
            data.games[chatId.toString()].sings[3].name != "Tres Cartas" &&
            data.games[chatId.toString()].sings[3].name != "Un Mal Canto"
              ? "😵"
              : " ") +
            " Cartas: " +
            data.games[chatId.toString()].cards[3].length
          : "");
    }
    return resp;
  }

  static repartir(chatGame) {
    if (!chatGame.deck.length) chatGame.deck = Game.barajar();
    let i = 0,
      card;
    while (i < chatGame.players.length) {
      card = new Card(chatGame.deck.pop());
      chatGame.cards[i].push(card);
      chatGame.cards[i].sort((a, b) => {
        return a.position <= b.position ? 1 : -1;
      });
      i++;
    }
  }
}
module.exports = Game;
