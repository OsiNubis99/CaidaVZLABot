/// Functional imports
import 'Chants.dart';

/// Game configs object
class Config {
  int end;
  int start;
  bool show;
  bool killTable;

  Chants chants;

  /// Create a Default Config object
  Config() {
    end = 24;
    start = 4;
    show = true;
    killTable = true;
    resetChants();
  }

  /// returns the modification value
  int increaseValue(int value, bool fast, int limit) {
    value += (fast ? 10 : 1);
    if (value > limit) {
      end = limit;
    }
    return value;
  }

  /// returns the modification value
  int decreaseValue(int value, bool fast, int limit) {
    value -= (fast ? 10 : 1);
    if (value < limit) {
      end = limit;
    }
    return value;
  }

  /// Increase to Singing value
  void increaseSinging(String singing, bool fast) {
    switch (singing) {
      case 'Ronda':
        chants.ronda = increaseValue(chants.ronda, fast, 100);
        break;
      case 'Chiguire':
        chants.chiguire = increaseValue(chants.chiguire, fast, 100);
        break;
      case 'Patrulla':
        chants.patrulla = increaseValue(chants.patrulla, fast, 100);
        break;
      case 'Vigía':
        chants.vigia = increaseValue(chants.vigia, fast, 100);
        break;
      case 'Registro':
        chants.registro = increaseValue(chants.registro, fast, 100);
        break;
      case 'Maguaro':
        chants.maguaro = increaseValue(chants.maguaro, fast, 100);
        break;
      case 'Registrico':
        chants.registrico = increaseValue(chants.registrico, fast, 100);
        break;
      case 'Casa Chica':
        chants.chica = increaseValue(chants.chica, fast, 100);
        break;
      case 'Casa Grande':
        chants.grande = increaseValue(chants.grande, fast, 100);
        break;
      case 'Trivilin':
        chants.trivilin = increaseValue(chants.trivilin, fast, 100);
        break;
    }
  }

  /// Decrease to Singing value
  void decreaseSinging(String singing, bool fast) {
    switch (singing) {
      case 'Ronda':
        chants.ronda = decreaseValue(chants.ronda, fast, 0);
        break;
      case 'Chiguire':
        chants.chiguire = decreaseValue(chants.chiguire, fast, 0);
        break;
      case 'Patrulla':
        chants.patrulla = decreaseValue(chants.patrulla, fast, 0);
        break;
      case 'Vigía':
        chants.vigia = decreaseValue(chants.vigia, fast, 0);
        break;
      case 'Registro':
        chants.registro = decreaseValue(chants.registro, fast, 0);
        break;
      case 'Maguaro':
        chants.maguaro = decreaseValue(chants.maguaro, fast, 0);
        break;
      case 'Registrico':
        chants.registrico = decreaseValue(chants.registrico, fast, 0);
        break;
      case 'Casa Chica':
        chants.chica = decreaseValue(chants.chica, fast, 0);
        break;
      case 'Casa Grande':
        chants.grande = decreaseValue(chants.grande, fast, 0);
        break;
      case 'Trivilin':
        chants.trivilin = decreaseValue(chants.trivilin, fast, 0);
        break;
    }
  }

  /// Increase and return the End value
  int increaseEnd(bool fast) {
    end = increaseValue(end, fast, 100);
    return end;
  }

  /// Decrease and return the End value
  int decreaseEnd(bool fast) {
    end = decreaseValue(end, fast, 24);
    return end;
  }

  /// Exchange the available values to Start and return the new one
  int changeStart() {
    if (start == 4) {
      start = 1;
    } else {
      start = 4;
    }
    return start;
  }

  /// Exchange the available values to Show and return the new one
  bool changeShow() {
    show = !show;
    return show;
  }

  /// Exchange the available values to KilTable and return the new one
  bool changeKillTable() {
    killTable = !killTable;
    return killTable;
  }

  /// Set the Chants Default value
  void resetChants() {
    chants = Chants(1, 5, 6, 7, 8, 9, 10, 11, 12, 24);
  }
}
