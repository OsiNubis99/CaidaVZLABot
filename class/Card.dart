/// This Class have all cards methods

class Card {
  static List<int> shuffling() {
    var array = [
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
      13
    ];
    // var currentIndex = 39, temporaryValue, randomIndex;
    // while (currentIndex >= 0) {
    //   randomIndex = Random(currentIndex).nextInt(39);
    //   temporaryValue = array[currentIndex];
    //   array[currentIndex] = array[randomIndex];
    //   array[randomIndex] = temporaryValue;
    //   currentIndex -= 1;
    // }
    array.shuffle();
    return array;
  }

  /// Return the card Value
  static int value(int card) {
    var number = card ~/ 4;
    number = number == 9 ? 4 : number == 8 ? 3 : number == 7 ? 2 : 1;
    return number;
  }

  /// Return the card Position in the table
  static int position(int card) {
    return (card ~/ 4) + 1;
  }

  /// Return the card Number
  static String positionToNumber(int position) {
    position++;
    return (position == 8
        ? '10'
        : position == 9 ? '11' : position == 10 ? '12' : '$position');
  }

  /// Return the card Number
  static int number(int card) {
    var number = (card ~/ 4) + 1;
    return number == 8 ? 10 : number == 9 ? 11 : number == 10 ? 12 : number;
  }

  /// Return the card Type
  static String type(int card) {
    var type = card % 4;
    return type == 0
        ? 'Oro'
        : type == 1 ? 'Copa' : type == 2 ? 'Espada' : 'Basto';
  }
}
