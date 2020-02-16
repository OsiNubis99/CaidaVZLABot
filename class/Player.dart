/// Functional imports
import 'package:teledart/model.dart' as telegram;
import 'Card.dart';
import 'Game.dart';
import 'Chants.dart';
import 'Singing.dart';

/// Game Player object and basic methods
class Player {
  int taken;
  String id;
  String name;
  String username;
  List<int> cards;

  Game game;
  Singing singing;

  /// Set player personal data and initialize player game data
  Player(telegram.User user, Game game) {
    id = user.id.toString();
    this.game = game;
    updateData(user);
    deleteGame();
  }

  /// Returns a printable name
  ///
  /// if game is true show the player game data.
  String printName(bool game) {
    var response = '$name';
    if (username.isNotEmpty) {
      response += '(@${username})';
    }
    if (game) {
      response +=
          "'${singing.name}'${singing.alive ? '' : '😵'} cartas: ${cards.length}";
    }
    response += '\n';
    return response;
  }

  /// Search and set the Singing
  void autoSinging(Chants config) {
    if (cards.length == 3 && singing.name == 'Tres Cartas') {
      singing.getChant(cards, config);
    }
  }

  void setSinging(String chant, Chants configs) {
    singing.value = 0;
    singing.name = 'Tres Cartas';
    switch (chant) {
      case 'Trivilin':
        if (singing.isTrivilin(cards) && configs.trivilin > 0) {
          singing.value = configs.trivilin;
          singing.name = 'Trivilin';
        }
        break;
      case 'Casa Grande':
        if (singing.isGrande(cards) && configs.grande > 0) {
          singing.value = configs.grande;
          singing.name = 'Casa Grande';
        }
        break;
      case 'Casa Chica':
        if (singing.isChica(cards) && configs.chica > 0) {
          singing.value = configs.chica;
          singing.name = 'Casa Chica';
        }
        break;
      case 'Registrico':
        if (singing.isRegistrico(cards) && configs.registrico > 0) {
          singing.value = configs.registrico;
          singing.name = 'Registrico';
        }
        break;
      case 'Maguaro':
        if (singing.isMaguaro(cards) && configs.maguaro > 0) {
          singing.value = configs.maguaro;
          singing.name = 'Maguaro';
        }
        break;
      case 'Registro':
        if (singing.isRegistro(cards) && configs.registro > 0) {
          singing.value = configs.registro;
          singing.name = 'Registro';
        }
        break;
      case 'Vigía':
        if (singing.isVigia(cards) && configs.vigia > 0) {
          singing.value = configs.vigia;
          singing.name = 'Vigía';
        }
        break;
      case 'Patrulla':
        if (singing.isPatrulla(cards) && configs.patrulla > 0) {
          singing.value = configs.patrulla;
          singing.name = 'Patrulla';
        }
        break;
      case 'Chiguire':
        if (singing.isChiguire(cards) && configs.chiguire > 0) {
          singing.value = configs.chiguire;
          singing.name = 'Chiguire';
        }
        break;
      case 'Ronda':
        if (singing.isRonda(cards) && configs.ronda > 0) {
          singing.value = Card.value(cards[1]) * configs.ronda;
          singing.name = 'Ronda';
        }
        break;
    }
  }

  /// Update the player personal data by a Telegram one
  void updateData(telegram.User user) {
    name = user.first_name;
    username = user.username;
  }

  /// Add sorted card to the player hand
  void addCard(int number) {
    cards.add(number);
    cards.sort((a, b) {
      return a < b ? 1 : -1;
    });
  }

  /// Remove and return a specified card
  int removeCard(int index) {
    return cards.removeAt(index);
  }

  /// Increase the Cards Taken
  void increaseTaken(int number) {
    taken += number;
  }

  /// Set Cards Taken to 0
  void resetTaken() {
    taken = 0;
  }

  /// Set Singing to Default
  void resetSinging() {
    singing = Singing(0, 'Tres Cartas');
  }

  /// Delete the player game data
  void deleteGame() {
    cards.clear();
    resetSinging();
    resetTaken();
  }
}
