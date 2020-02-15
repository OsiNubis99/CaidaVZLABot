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

/** Functional imports */
import 'Card.dart';
import 'Chants.dart';
import 'package:teledart/model.dart';

/** Singing Object and validations methods */
class Singing extends Card {
  int value;
  String name;
  bool alive;

  Singing(value, name) {
    this.value = value;
    this.name = name;
    this.alive = true;
  }

  void getChant(List<int> cards, Chants configs) {
    /** Returns the name and value of the Chant */
    if (this.isTrivilin(cards) && configs.trivilin > 0) {
      this.value = configs.trivilin;
      this.name = "Trivilin";
    } else if (this.isGrande(cards) && configs.grande > 0) {
      this.value = configs.grande;
      this.name = "Casa Grande";
    } else if (this.isChica(cards) && configs.chica > 0) {
      this.value = configs.chica;
      this.name = "Casa Chica";
    } else if (this.isRegistrico(cards) && configs.registrico > 0) {
      this.value = configs.registrico;
      this.name = "Registrico";
    } else if (this.isMaguaro(cards) && configs.maguaro > 0) {
      this.value = configs.maguaro;
      this.name = "Maguaro";
    } else if (this.isRegistro(cards) && configs.registro > 0) {
      this.value = configs.registro;
      this.name = "Registro";
    } else if (this.isVigia(cards) && configs.vigia > 0) {
      this.value = configs.vigia;
      this.name = "Vigía";
    } else if (this.isPatrulla(cards) && configs.patrulla > 0) {
      this.value = configs.patrulla;
      this.name = "Patrulla";
    } else if (this.isChiguire(cards) && configs.chiguire > 0) {
      this.value = configs.chiguire;
      this.name = "Chiguire";
    } else if (this.isRonda(cards) && configs.ronda > 0) {
      this.value = this.cardValue(cards[1]) * configs.ronda;
      this.name = "Ronda";
    } else {
      this.value = 0;
      this.name = "Tres Cartas";
    }
  }

  /** Validations for the Ronda Chant */
  bool isRonda(List<int> cards) {
    return (this.cardNumber(cards[0]) == this.cardNumber(cards[1]) ||
        this.cardNumber(cards[1]) == this.cardNumber(cards[2]));
  }

  /** Validations for the Chiguire Chant */
  bool isChiguire(List<int> cards) {
    return (this.cardPosition(cards[2]) == (this.cardPosition(cards[1]) + 2) &&
        this.cardPosition(cards[1]) == (this.cardPosition(cards[0]) + 2));
  }

  /** Validations for the Patrulla Chant */
  bool isPatrulla(List<int> cards) {
    return (this.cardPosition(cards[2]) == (this.cardPosition(cards[1]) + 1) &&
        this.cardPosition(cards[1]) == (this.cardPosition(cards[0]) + 1));
  }

  /** Validations for the Vigia Chant */
  bool isVigia(List<int> cards) {
    return ((this.cardPosition(cards[2]) == (this.cardPosition(cards[1]) + 1) &&
            this.cardPosition(cards[1]) == this.cardPosition(cards[0])) ||
        (this.cardPosition(cards[1]) == (this.cardPosition(cards[0]) + 1) &&
            this.cardPosition(cards[1]) == this.cardPosition(cards[2])));
  }

  /** Validations for the Registro Chant */
  bool isRegistro(List<int> cards) {
    return (this.cardNumber(cards[0]) == 1 &&
        this.cardNumber(cards[1]) == 11 &&
        this.cardNumber(cards[2]) == 12);
  }

  /** Validations for the Maguaro Chant */
  bool isMaguaro(List<int> cards) {
    return (this.cardNumber(cards[0]) == 1 &&
        this.cardNumber(cards[1]) == 10 &&
        this.cardNumber(cards[2]) == 12);
  }

  /** Validations for the Registrico Chant */
  bool isRegistrico(List<int> cards) {
    return (this.cardNumber(cards[0]) == 1 &&
        this.cardNumber(cards[1]) == 10 &&
        this.cardNumber(cards[2]) == 11);
  }

  /** Validations for the Casa Chica Chant */
  bool isChica(List<int> cards) {
    return (this.cardNumber(cards[0]) == 1 &&
        this.cardNumber(cards[1]) == 1 &&
        this.cardNumber(cards[2]) == 12);
  }

  /** Validations for the Casa Grande Chant */
  bool isGrande(List<int> cards) {
    return (this.cardNumber(cards[0]) == 1 &&
        this.cardNumber(cards[1]) == 12 &&
        this.cardNumber(cards[2]) == 12);
  }

  /** Validations for the Trivilin Chant */
  bool isTrivilin(List<int> cards) {
    return (this.cardNumber(cards[0]) == this.cardNumber(cards[1]) &&
        this.cardNumber(cards[1]) == this.cardNumber(cards[2]));
  }

  /** Returns all InlineQueryResultArticle objects */
  List<InlineQueryResultArticle> allChants(Chants configs) {
    var response = List();
    if (configs.ronda > 0) {
      response.add(InlineQueryResultArticle(
          id: "Ronda",
          title: "Ronda",
          type: "article",
          description: "Dos cartas iguales \nValor:${configs.ronda}",
          input_message_content:
              InputTextMessageContent(message_text: "Tengo Ronda")));
    } else if (configs.chiguire > 0) {
      response.add(InlineQueryResultArticle(
          id: "Chiguire",
          type: "article",
          title: "Chiguire",
          description: "Escalera Par o no par \nValor:${configs.chiguire}",
          input_message_content:
              InputTextMessageContent(message_text: "Tengo Chiguire")));
    } else if (configs.patrulla > 0) {
      response.add(InlineQueryResultArticle(
          id: "Patrulla",
          type: "article",
          title: "Patrulla",
          description: "Escalera \nValor:${configs.patrulla}",
          input_message_content:
              InputTextMessageContent(message_text: "Tengo Patrulla")));
    } else if (configs.vigia > 0) {
      response.add(InlineQueryResultArticle(
          id: "Vigía",
          title: "Vigía",
          type: "article",
          input_message_content:
              InputTextMessageContent(message_text: "Tengo Vigía"),
          description:
              "Dos cartas iguales y una mayor o menor en una unidad \nValor:${configs.vigia}"));
    } else if (configs.registro > 0) {
      response.add(InlineQueryResultArticle(
          id: "Registro",
          type: "article",
          title: "Registro",
          description: "1 11 12 \nValor:${configs.registro}",
          input_message_content:
              InputTextMessageContent(message_text: "Tengo Registro")));
    } else if (configs.maguaro > 0) {
      response.add(InlineQueryResultArticle(
          id: "Maguaro",
          type: "article",
          title: "Maguaro",
          description: "1 10 12 \nValor:${configs.maguaro}",
          input_message_content:
              InputTextMessageContent(message_text: "Tengo Maguaro")));
    } else if (configs.registrico > 0) {
      response.add(InlineQueryResultArticle(
          id: "Registrico",
          type: "article",
          title: "Registrico",
          description: "1 10 11 \nValor:${configs.registrico}",
          input_message_content:
              InputTextMessageContent(message_text: "Tengo Registrico")));
    } else if (configs.chica > 0) {
      response.add(InlineQueryResultArticle(
          id: "Casa Chica",
          type: "article",
          title: "Casa Chica",
          description: "1 1 12 \nValor:${configs.chica}",
          input_message_content:
              InputTextMessageContent(message_text: "Tengo Casa Chica")));
    } else if (configs.grande > 0) {
      response.add(InlineQueryResultArticle(
          id: "Casa Grande",
          type: "article",
          title: "Casa Grande",
          description: "1 12 12 \nValor:${configs.grande}",
          input_message_content:
              InputTextMessageContent(message_text: "Tengo Casa Grande")));
    } else if (configs.trivilin > 0) {
      response.add(InlineQueryResultArticle(
          id: "Trivilin",
          type: "article",
          title: "Trivilin",
          description: "Tres cartas iguales \nValor:${configs.trivilin}",
          input_message_content:
              InputTextMessageContent(message_text: "Tengo Trivilin")));
    }
    return response;
  }
}
