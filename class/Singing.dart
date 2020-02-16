/// Functional imports
import 'Card.dart';
import 'Chants.dart';
import 'package:teledart/model.dart';

/// Singing Object and validations methods
class Singing {
  int value;
  bool alive;
  String name;

  Singing(value, name) {
    this.value = value;
    this.name = name;
    alive = true;
  }

  ///  Returns the name and value of the Chant
  void getChant(List<int> cards, Chants configs) {
    if (configs.trivilin > 0 && isTrivilin(cards)) {
      value = configs.trivilin;
      name = 'Trivilin';
    } else if (configs.grande > 0 && isGrande(cards)) {
      value = configs.grande;
      name = 'Casa Grande';
    } else if (configs.chica > 0 && isChica(cards)) {
      value = configs.chica;
      name = 'Casa Chica';
    } else if (configs.registrico > 0 && isRegistrico(cards)) {
      value = configs.registrico;
      name = 'Registrico';
    } else if (configs.maguaro > 0 && isMaguaro(cards)) {
      value = configs.maguaro;
      name = 'Maguaro';
    } else if (configs.registro > 0 && isRegistro(cards)) {
      value = configs.registro;
      name = 'Registro';
    } else if (configs.vigia > 0 && isVigia(cards)) {
      value = configs.vigia;
      name = 'Vigía';
    } else if (configs.patrulla > 0 && isPatrulla(cards)) {
      value = configs.patrulla;
      name = 'Patrulla';
    } else if (configs.chiguire > 0 && isChiguire(cards)) {
      value = configs.chiguire;
      name = 'Chiguire';
    } else if (configs.ronda > 0 && isRonda(cards)) {
      value = Card.value(cards[1]) * configs.ronda;
      name = 'Ronda';
    } else {
      value = 0;
      name = 'Tres Cartas';
    }
  }

  ///  Validations for the Ronda Chant
  bool isRonda(List<int> cards) {
    return (Card.number(cards[0]) == Card.number(cards[1]) ||
        Card.number(cards[1]) == Card.number(cards[2]));
  }

  ///  Validations for the Chiguire Chant
  bool isChiguire(List<int> cards) {
    return (Card.position(cards[2]) == (Card.position(cards[1]) + 2) &&
        Card.position(cards[1]) == (Card.position(cards[0]) + 2));
  }

  ///  Validations for the Patrulla Chant
  bool isPatrulla(List<int> cards) {
    return (Card.position(cards[2]) == (Card.position(cards[1]) + 1) &&
        Card.position(cards[1]) == (Card.position(cards[0]) + 1));
  }

  ///  Validations for the Vigia Chant
  bool isVigia(List<int> cards) {
    return ((Card.position(cards[2]) == (Card.position(cards[1]) + 1) &&
            Card.position(cards[1]) == Card.position(cards[0])) ||
        (Card.position(cards[1]) == (Card.position(cards[0]) + 1) &&
            Card.position(cards[1]) == Card.position(cards[2])));
  }

  ///  Validations for the Registro Chant
  bool isRegistro(List<int> cards) {
    return (Card.number(cards[0]) == 1 &&
        Card.number(cards[1]) == 11 &&
        Card.number(cards[2]) == 12);
  }

  ///  Validations for the Maguaro Chant
  bool isMaguaro(List<int> cards) {
    return (Card.number(cards[0]) == 1 &&
        Card.number(cards[1]) == 10 &&
        Card.number(cards[2]) == 12);
  }

  ///  Validations for the Registrico Chant
  bool isRegistrico(List<int> cards) {
    return (Card.number(cards[0]) == 1 &&
        Card.number(cards[1]) == 10 &&
        Card.number(cards[2]) == 11);
  }

  ///  Validations for the Casa Chica Chant
  bool isChica(List<int> cards) {
    return (Card.number(cards[0]) == 1 &&
        Card.number(cards[1]) == 1 &&
        Card.number(cards[2]) == 12);
  }

  ///  Validations for the Casa Grande Chant
  bool isGrande(List<int> cards) {
    return (Card.number(cards[0]) == 1 &&
        Card.number(cards[1]) == 12 &&
        Card.number(cards[2]) == 12);
  }

  ///  Validations for the Trivilin Chant
  bool isTrivilin(List<int> cards) {
    return (Card.number(cards[0]) == Card.number(cards[1]) &&
        Card.number(cards[1]) == Card.number(cards[2]));
  }

  ///  Returns all InlineQueryResultArticle objects
  List<InlineQueryResultArticle> allChants(Chants configs) {
    var response = [];
    if (configs.ronda > 0) {
      response.add(InlineQueryResultArticle(
          id: 'Ronda',
          title: 'Ronda',
          type: 'article',
          description: 'Dos cartas iguales \nValor:${configs.ronda}',
          input_message_content:
              InputTextMessageContent(message_text: 'Tengo Ronda')));
    } else if (configs.chiguire > 0) {
      response.add(InlineQueryResultArticle(
          id: 'Chiguire',
          type: 'article',
          title: 'Chiguire',
          description: 'Escalera Par o no par \nValor:${configs.chiguire}',
          input_message_content:
              InputTextMessageContent(message_text: 'Tengo Chiguire')));
    } else if (configs.patrulla > 0) {
      response.add(InlineQueryResultArticle(
          id: 'Patrulla',
          type: 'article',
          title: 'Patrulla',
          description: 'Escalera \nValor:${configs.patrulla}',
          input_message_content:
              InputTextMessageContent(message_text: 'Tengo Patrulla')));
    } else if (configs.vigia > 0) {
      response.add(InlineQueryResultArticle(
          id: 'Vigía',
          title: 'Vigía',
          type: 'article',
          input_message_content:
              InputTextMessageContent(message_text: 'Tengo Vigía'),
          description:
              'Dos cartas iguales y una mayor o menor en una unidad \nValor:${configs.vigia}'));
    } else if (configs.registro > 0) {
      response.add(InlineQueryResultArticle(
          id: 'Registro',
          type: 'article',
          title: 'Registro',
          description: '1 11 12 \nValor:${configs.registro}',
          input_message_content:
              InputTextMessageContent(message_text: 'Tengo Registro')));
    } else if (configs.maguaro > 0) {
      response.add(InlineQueryResultArticle(
          id: 'Maguaro',
          type: 'article',
          title: 'Maguaro',
          description: '1 10 12 \nValor:${configs.maguaro}',
          input_message_content:
              InputTextMessageContent(message_text: 'Tengo Maguaro')));
    } else if (configs.registrico > 0) {
      response.add(InlineQueryResultArticle(
          id: 'Registrico',
          type: 'article',
          title: 'Registrico',
          description: '1 10 11 \nValor:${configs.registrico}',
          input_message_content:
              InputTextMessageContent(message_text: 'Tengo Registrico')));
    } else if (configs.chica > 0) {
      response.add(InlineQueryResultArticle(
          id: 'Casa Chica',
          type: 'article',
          title: 'Casa Chica',
          description: '1 1 12 \nValor:${configs.chica}',
          input_message_content:
              InputTextMessageContent(message_text: 'Tengo Casa Chica')));
    } else if (configs.grande > 0) {
      response.add(InlineQueryResultArticle(
          id: 'Casa Grande',
          type: 'article',
          title: 'Casa Grande',
          description: '1 12 12 \nValor:${configs.grande}',
          input_message_content:
              InputTextMessageContent(message_text: 'Tengo Casa Grande')));
    } else if (configs.trivilin > 0) {
      response.add(InlineQueryResultArticle(
          id: 'Trivilin',
          type: 'article',
          title: 'Trivilin',
          description: 'Tres cartas iguales \nValor:${configs.trivilin}',
          input_message_content:
              InputTextMessageContent(message_text: 'Tengo Trivilin')));
    }
    return response;
  }
}
