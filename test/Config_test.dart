import 'package:test/test.dart';
import '../class/Config.dart';

void main() {
  test('resetChants', () {
    var config = Config();
    expect(config.chants.ronda, equals(1));
    expect(config.chants.trivilin, equals(24));
  });
  test('End increase and decrease', () {
    var config = Config(), base = config.end;
    expect(config.increaseEnd(false), equals(base + 1));
    expect(config.decreaseEnd(false), equals(base));
    expect(config.increaseEnd(true), equals(base + 10));
    expect(config.decreaseEnd(true), equals(base));
  });
  test('Singing increase and decrease', () {
    var number, config = Config(), base = config.chants.ronda;
    config.increaseSinging('Ronda', false);
    number = config.chants.ronda;
    expect(number, equals(base + 1));
    config.decreaseSinging('Ronda', false);
    number = config.chants.ronda;
    expect(number, equals(base));
    config.increaseSinging('Ronda', true);
    number = config.chants.ronda;
    expect(number, equals(base + 10));
    config.decreaseSinging('Ronda', true);
    number = config.chants.ronda;
    expect(number, equals(base));
  });

  //TODO all other tests
}
