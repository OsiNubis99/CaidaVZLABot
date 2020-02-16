// Functional imports
import 'package:teledart/model.dart' as telegram;
import 'Card.dart';
import 'Config.dart';
import 'Player.dart';

// All Game data and methods
class Game {
  String chat_id; // Chat Id
  int current_player;
  String mode; // 2 | 3 | 2v2 | 4
  int last_card; // Card Key [0..39]
  bool last_lap; // Last Hand
  Config configs;
  List<int> deck;
  List<bool> table; // Position of cards Played
  List<String> admins; // User Id
  List<int> points; // Points of People/Teams
  List<Player> players;
  List<Player> nex_players;

  /// Set default game and add Creator data
  Game(telegram.User creator, telegram.Chat chat) {
    chat_id = chat.id.toString();
    setDefault();
    current_player = creator.id;
    configs = Config();
    admins.add(creator.id.toString());
    deck = Card.shuffling();
    players.add(Player(creator, chat));
  }

  // TODO all other metthods
  // deal cards: set mode,
  // state

  /// Restore a class without delete the configs data.
  void setDefault() {
    current_player = null;
    last_card = null;
    last_lap = false;
    deck = [];
    table = [
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false
    ];
    points = [];
    admins = [];
    players = [];
  }
}
