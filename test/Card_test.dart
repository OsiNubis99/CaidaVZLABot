import 'package:test/test.dart';
import '../class/Card.dart';
import 'dart:math';

void main() {
  test('Type', () {
    var number = Random();
    expect(
        Card.type(number.nextInt(20)), anyOf('Oro', 'Copa', 'Espada', 'Basto'));
  });
  test('Value', () {
    var number = Random();
    expect(Card.value(number.nextInt(20)), anyOf(1, 2, 3, 4));
  });
  test('Number', () {
    var number = Random();
    expect(Card.number(number.nextInt(20)), isA<int>());
  });
  test('Position', () {
    var number = Random();
    expect(Card.position(number.nextInt(20)), isA<int>());
  });
  test('Shuffling', () {
    expect(Card.shuffling(), isA<List<int>>());
  });
}
