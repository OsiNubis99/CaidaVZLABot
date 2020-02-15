/**
 * MIT License
 * 
 * Copyright (c) 2019 Andres David Hurtado Fernandez
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

// Functional imports
import 'package:teledart/model.dart';
import 'Chants.dart';
import 'Singing.dart';

/** Game Player object and basic methods */
class Player {
  String id;
  String name;
  String username;
  List<int> cards;
  Singing singing;
  int taken;

  /** Set player personal data and initialize player game data */
  Player(User user) {
    this.id = user.id.toString();
    this.updateData(user);
    this.deleteGame();
  }

  /**
   * Returns a printable name 
   * 
   * if game is true show the player game data.
   */
  String printName(bool game) {
    var response = "$name";
    if (this.username.isNotEmpty) {
      response += "(@${this.username})";
    }
    if (game) {
      response +=
          "'${this.singing.name}'${this.singing.alive ? '' : '😵'} cartas: ${this.cards.length}";
    }
    response += "\n";
    return response;
  }

  /** Search and set the Singing */
  void autoSinging(Chants config) {
    if (this.cards.length == 3 && this.singing.name == "Tres Cartas")
      this.singing.getChant(this.cards, config);
  }

  void setSinging(String chant, Chants configs) {
    this.singing.value = 0;
    this.singing.name = "Tres Cartas";
    switch (chant) {
      case "Trivilin":
        if (this.singing.isTrivilin(cards) && configs.trivilin > 0) {
          this.singing.value = configs.trivilin;
          this.singing.name = "Trivilin";
        }
        break;
      case "Casa Grande":
        if (this.singing.isGrande(cards) && configs.grande > 0) {
          this.singing.value = configs.grande;
          this.singing.name = "Casa Grande";
        }
        break;
      case "Casa Chica":
        if (this.singing.isChica(cards) && configs.chica > 0) {
          this.singing.value = configs.chica;
          this.singing.name = "Casa Chica";
        }
        break;
      case "Registrico":
        if (this.singing.isRegistrico(cards) && configs.registrico > 0) {
          this.singing.value = configs.registrico;
          this.singing.name = "Registrico";
        }
        break;
      case "Maguaro":
        if (this.singing.isMaguaro(cards) && configs.maguaro > 0) {
          this.singing.value = configs.maguaro;
          this.singing.name = "Maguaro";
        }
        break;
      case "Registro":
        if (this.singing.isRegistro(cards) && configs.registro > 0) {
          this.singing.value = configs.registro;
          this.singing.name = "Registro";
        }
        break;
      case "Vigía":
        if (this.singing.isVigia(cards) && configs.vigia > 0) {
          this.singing.value = configs.vigia;
          this.singing.name = "Vigía";
        }
        break;
      case "Patrulla":
        if (this.singing.isPatrulla(cards) && configs.patrulla > 0) {
          this.singing.value = configs.patrulla;
          this.singing.name = "Patrulla";
        }
        break;
      case "Chiguire":
        if (this.singing.isChiguire(cards) && configs.chiguire > 0) {
          this.singing.value = configs.chiguire;
          this.singing.name = "Chiguire";
        }
        break;
      case "Ronda":
        if (this.singing.isRonda(cards) && configs.ronda > 0) {
          this.singing.value = this.singing.cardValue(cards[1]) * configs.ronda;
          this.singing.name = "Ronda";
        }
        break;
    }
  }

  /** Update the player personal data by a Telegram one */
  void updateData(User user) {
    this.name = user.first_name;
    this.username = user.username;
  }

  /** Add sortly card to the player hand */
  void addCard(int number) {
    this.cards.add(number);
    this.cards.sort((a, b) {
      return a < b ? 1 : -1;
    });
  }

  /** Remove and return a specified card */
  int removeCard(int index) {
    return this.cards.removeAt(index);
  }

  /** Increase the Cards Taken */
  void increaseTaken(int number) {
    this.taken += number;
  }

  /** Set Cards Taken to 0 */
  void resetTaken() {
    this.taken = 0;
  }

  /** Set Singing to Default */
  void resetSinging() {
    this.singing = new Singing(0, "Tres Cartas");
  }

  /** Delete the player game data */
  void deleteGame() {
    this.cards.clear();
    this.resetSinging();
    this.resetTaken();
  }
}
