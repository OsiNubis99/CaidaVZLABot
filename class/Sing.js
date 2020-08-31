class Sing {
  constructor(word, cards) {
    if (word == null) {
      this.value = 0;
      this.name = "Tres Cartas";
    } else {
      this.word = word.toLowerCase();
      this.value = 0;
      this.name = "Un Mal Canto";
      if (this.word == 5 || this.word == "ronda") {
        if (
          cards[0].value == cards[1].value ||
          cards[1].value == cards[2].value
        ) {
          if (cards[1].value == 10) {
            this.value = 2;
            this.name = "Ronda";
          } else if (cards[1].value == 11) {
            this.value = 3;
            this.name = "Ronda";
          } else if (cards[1].value == 12) {
            this.value = 4;
            this.name = "Ronda";
          } else {
            this.value = 1;
            this.name = "Ronda";
          }
        }
      } else if (this.word == 6 || this.word == "chiguire") {
        if (
          cards[0].position == cards[1].position + 2 &&
          cards[1].position == cards[2].position + 2
        ) {
          this.value = 5;
          this.name = "Chiguire";
        }
      } else if (this.word == 7 || this.word == "patrulla") {
        if (
          cards[0].position == cards[1].position + 1 &&
          cards[1].position == cards[2].position + 1
        ) {
          this.value = 6;
          this.name = "Patrulla";
        }
      } else if (this.word == 8 || this.word == "Vigía") {
        if (
          (cards[0].position == cards[1].position + 1 &&
            cards[1].position == cards[2].position) ||
          (cards[1].position == cards[2].position + 1 &&
            cards[1].position == cards[0].position)
        ) {
          this.value = 7;
          this.name = "Vigía";
        }
      } else if (this.word == 9 || this.word == "registro") {
        if (
          cards[0].value == 12 &&
          cards[1].value == 11 &&
          cards[2].value == 1
        ) {
          this.value = 8;
          this.name = "Registro";
        }
      } else if (this.word == 10 || this.word == "maguaro") {
        if (
          cards[0].value == 12 &&
          cards[1].value == 10 &&
          cards[2].value == 1
        ) {
          this.value = 9;
          this.name = "Maguaro";
        }
      } else if (this.word == 11 || this.word == "registrico") {
        if (
          cards[0].value == 12 &&
          cards[1].value == 10 &&
          cards[2].value == 1
        ) {
          this.value = 10;
          this.name = "Registrico";
        }
      } else if (this.word == 12 || this.word == "cchica") {
        if (
          cards[0].value == 12 &&
          cards[1].value == 1 &&
          cards[2].value == 1
        ) {
          this.value = 11;
          this.name = "Casa Chica";
        }
      } else if (this.word == 13 || this.word == "cgrande") {
        if (
          cards[0].value == 12 &&
          cards[1].value == 12 &&
          cards[2].value == 1
        ) {
          this.value = 12;
          this.name = "Casa Grande";
        }
      } else if (this.word == 14 || this.word == "trivilin") {
        if (
          cards[0].value == cards[1].value &&
          cards[1].value == cards[2].value
        ) {
          this.value = 24;
          this.name = "Trivilin";
        }
      }
    }
  }
}
module.exports = Sing;
