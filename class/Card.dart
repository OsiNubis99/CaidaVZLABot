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

/** This Class have all cards methods */
class Card {
  /** Return the card Value */
  int cardValue(int card) {
    var number = card ~/ 4;
    number = number == 9 ? 4 : number == 8 ? 3 : number == 7 ? 2 : 1;
    return number;
  }

  /** Return the card Position in the table */
  int cardPosition(int card) {
    return (card ~/ 4) + 1;
  }

  /** Return the card Number */
  int cardNumber(int card) {
    var number = (card ~/ 4) + 1;
    return number == 8 ? 10 : number == 9 ? 11 : number == 10 ? 12 : number;
  }

  /** Return the card Type */
  String cardType(int card) {
    var type = card % 4;
    return type == 0
        ? "Oro"
        : type == 1 ? "Copa" : type == 2 ? "Espada" : "Basto";
  }
}
