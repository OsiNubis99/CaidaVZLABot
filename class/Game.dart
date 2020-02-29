// Functional imports
import 'package:teledart/model.dart' as telegram;
import 'Card.dart';
import 'Config.dart';
import 'Player.dart';

// All Game data and methods
class Game {
  String mode; // 2 | 3 | 2v2 | 4
  int last_card; // Card Key [0..39]
  bool last_lap; // Last Hand
  Config configs;
  String chat_id; // Chat Id
  List<int> deck;
  List<int> points; // Points of People/Teams
  List<bool> table; // Position of cards Played
  int current_player;
  List<String> admins; // User Id
  List<Player> players;
  List<Player> nex_players;

  /// Set default game and add Creator data
  Game(telegram.User creator, telegram.Chat chat) {
    chat_id = chat.id.toString();
    setDefault();
    current_player = creator.id;
    configs = Config();
    admins.add(creator.id.toString());
    deck = Card.shuffling();
    players.add(Player(creator, chat));
  }

  /// Put a card to the table and return this Card number
  /// if the card is on the table get another one.
  int putTable() {
    var value = deck.removeAt(0);
    while (table[Card.position(value)]) {
      deck.add(value);
      value = deck.removeAt(0);
    }
    table[Card.position(value)] = true;
    return Card.number(value);
  }

  /// Deal cards to all players and also put the Table
  List<int> dealCards(bool putTable) {
    var i = 0, response = [];
    if (configs.dealMode == 'allFirst' && putTable) {
      while (i < 3) {
        response.add(this.putTable());
        i++;
      }
      i = 0;
    }
    if (configs.dealMode == 'Basic' && putTable) {
      response.add(this.putTable());
    }
    while (i < 3) {
      players.forEach((element) {
        element.addCard(deck.removeAt(0));
      });
      if (configs.dealMode == 'Basic' && putTable) {
        response.add(this.putTable());
      }
    }
    if (configs.dealMode == 'allEnd' && putTable) {
      i = 0;
      while (i < 3) {
        response.add(this.putTable());
        i++;
      }
    }
    return response;
  }
  // TODO all other metthods
  // state

  String state(ligero) {
    var response;
    if (current_player != null) {
      response = 'Mesa:';
      for (var i = 0; i < table.length; i++) {
        if (table[i]) {
          response += ' ${Card.positionToNumber(i)}';
        } else {
          response += ' []';
        }
      }
      response +=
          '\nUltima carta: ${Card.value(last_card).toString()} de ${Card.type(last_card).toString()}';
      response += last_lap ? '\nUltimas!' : '';
      response += '\nSiguiente: @${players[current_player].printName(false)}';
      if (!ligero) {
        switch (players.length) {
          case 2:
            // 1v1

            break;
          case 3:
            // FFA
            break;
          default:
          // 2v2 or FFA
        }
        //   if (head == 1) {
        //     response += "\nJugadores:\n @" +
        //         data.players["p" + players[0]].username +
        //         " '" +
        //         sings[0].name +
        //         "'" +
        //         (sings[0].value == 0 &&
        //                 sings[0].name != 'Tres Cartas' &&
        //                 sings[0].name != 'Un Mal Canto'
        //             ? "😵"
        //             : " ") +
        //         " Cartas: " +
        //         cards[0].length +
        //         "\n    Puntos: " +
        //         points[0] +
        //         "  Agarrado: " +
        //         taked[0];
        //     response += "\n @" +
        //         data.players["p" + players[1]].username +
        //         " '" +
        //         sings[1].name +
        //         "'" +
        //         (sings[1].value == 0 &&
        //                 sings[1].name != 'Tres Cartas' &&
        //                 sings[1].name != 'Un Mal Canto'
        //             ? "😵"
        //             : " ") +
        //         " Cartas: " +
        //         cards[1].length +
        //         "\n    Puntos: " +
        //         points[1] +
        //         "  Agarrado: " +
        //         taked[1];
        //   } else {
        //     response +=
        //         "\nEquipo Mano  Puntos: " + points[0] + "  Agarrado: " + taked[0];
        //     response += "\n @" +
        //         data.players["p" + players[0]].username +
        //         " '" +
        //         sings[0].name +
        //         "'" +
        //         (sings[0].value == 0 &&
        //                 sings[0].name != 'Tres Cartas' &&
        //                 sings[0].name != 'Un Mal Canto'
        //             ? "😵"
        //             : " ") +
        //         " Cartas: " +
        //         cards[0].length;
        //     response += "\n @" +
        //         data.players["p" + players[2]].username +
        //         " '" +
        //         sings[2].name +
        //         "'" +
        //         (sings[2].value == 0 &&
        //                 sings[2].name != 'Tres Cartas' &&
        //                 sings[2].name != 'Un Mal Canto'
        //             ? "😵"
        //             : " ") +
        //         " Cartas: " +
        //         cards[2].length;
        //     response +=
        //         "\nEquipo Mesa  Puntos: " + points[1] + "  Agarrado: " + taked[1];
        //     response += "\n @" +
        //         data.players["p" + players[1]].username +
        //         " '" +
        //         sings[1].name +
        //         "'" +
        //         (sings[1].value == 0 &&
        //                 sings[1].name != 'Tres Cartas' &&
        //                 sings[1].name != 'Un Mal Canto'
        //             ? "😵"
        //             : " ") +
        //         " Cartas: " +
        //         cards[1].length;
        //     response += "\n @" +
        //         data.players["p" + players[3]].username +
        //         " '" +
        //         sings[3].name +
        //         "'" +
        //         (sings[3].value == 0 &&
        //                 sings[3].name != 'Tres Cartas' &&
        //                 sings[3].name != 'Un Mal Canto'
        //             ? "😵"
        //             : " ") +
        //         " Cartas: " +
        //         cards[3].length;
        //   }
      }
    } else {
      response = 'El juego aun no empieza, usa /iniciar';
    }
    return response;
  }

  /// Restore a class without delete the configs data.
  void setDefault() {
    current_player = null;
    last_card = null;
    last_lap = false;
    deck = [];
    table = [
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false
    ];
    points = [];
    admins = [];
    players = [];
  }
}
