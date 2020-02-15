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
import 'Chants.dart';

/** Game configs object */
class Config {
  Chants chants;
  int start;
  int end;
  bool killTable;

  /** Create a Default Config object */
  Config() {
    this.resetChants();
    this.start = 4;
    this.end = 24;
    this.killTable = true;
  }

  /** returns the modification value */
  int increaseValue(int value, bool fast, int limit) {
    value += (fast ? 10 : 1);
    if (value > limit) {
      this.end = limit;
    }
    return value;
  }

  /** returns the modification value */
  int decreaseValue(int value, bool fast, int limit) {
    value -= (fast ? 10 : 1);
    if (value < limit) {
      this.end = limit;
    }
    return value;
  }

  /** Increase to Singing value */
  void increaseSinging(String singing, bool fast) {
    switch (singing) {
      case "Ronda":
        this.chants.ronda = increaseValue(this.chants.ronda, fast, 100);
        break;
      case "Chiguire":
        this.chants.chiguire = increaseValue(this.chants.chiguire, fast, 100);
        break;
      case "Patrulla":
        this.chants.patrulla = increaseValue(this.chants.patrulla, fast, 100);
        break;
      case "Vigía":
        this.chants.vigia = increaseValue(this.chants.vigia, fast, 100);
        break;
      case "Registro":
        this.chants.registro = increaseValue(this.chants.registro, fast, 100);
        break;
      case "Maguaro":
        this.chants.maguaro = increaseValue(this.chants.maguaro, fast, 100);
        break;
      case "Registrico":
        this.chants.registrico =
            increaseValue(this.chants.registrico, fast, 100);
        break;
      case "Casa Chica":
        this.chants.chica = increaseValue(this.chants.chica, fast, 100);
        break;
      case "Casa Grande":
        this.chants.grande = increaseValue(this.chants.grande, fast, 100);
        break;
      case "Trivilin":
        this.chants.trivilin = increaseValue(this.chants.trivilin, fast, 100);
        break;
    }
  }

  /** Decrease to Singing value */
  void decreaseSinging(String singing, bool fast) {
    switch (singing) {
      case "Ronda":
        this.chants.ronda = decreaseValue(this.chants.ronda, fast, 0);
        break;
      case "Chiguire":
        this.chants.chiguire = decreaseValue(this.chants.chiguire, fast, 0);
        break;
      case "Patrulla":
        this.chants.patrulla = decreaseValue(this.chants.patrulla, fast, 0);
        break;
      case "Vigía":
        this.chants.vigia = decreaseValue(this.chants.vigia, fast, 0);
        break;
      case "Registro":
        this.chants.registro = decreaseValue(this.chants.registro, fast, 0);
        break;
      case "Maguaro":
        this.chants.maguaro = decreaseValue(this.chants.maguaro, fast, 0);
        break;
      case "Registrico":
        this.chants.registrico = decreaseValue(this.chants.registrico, fast, 0);
        break;
      case "Casa Chica":
        this.chants.chica = decreaseValue(this.chants.chica, fast, 0);
        break;
      case "Casa Grande":
        this.chants.grande = decreaseValue(this.chants.grande, fast, 0);
        break;
      case "Trivilin":
        this.chants.trivilin = decreaseValue(this.chants.trivilin, fast, 0);
        break;
    }
  }

  /** Increase and return the End value */
  int increaseEnd(bool fast) {
    this.end = increaseValue(this.end, fast, 100);
    return this.end;
  }

  /** Decrease and return the End value */
  int decreaseEnd(bool fast) {
    this.end = decreaseValue(this.end, fast, 24);
    return this.end;
  }

  /** Exchange the available values to Start and return the new one */
  int changeStart() {
    if (this.start == 4) {
      this.start = 1;
    } else {
      this.start = 4;
    }
    return this.start;
  }

  /** Exchange the available values to KilTable and return the new one */
  bool changeKillTable() {
    this.killTable = !this.killTable;
    return this.killTable;
  }

  /** Set the Chants Default value */
  void resetChants() {
    this.chants = new Chants(1, 5, 6, 7, 8, 9, 10, 11, 12, 24);
  }
}
