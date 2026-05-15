const ERROR =
  "\nIf you are running into an error, please let me know by writing to @OsiNubis99.";
module.exports = {
  bad_turn: "Already seen",
  bad_sync_cards: "Wrong guess!\n",
  clean_table: "Clean table!\n",
  config_bool_invalid: "Invalid value. Options: 'on' or 'off'" + ERROR,
  config_type_invalid:
    "Invalid value. Options: 'individual' or 'parejas'" + ERROR,
  config_number_invalid:
    "Numeric value out of range, min 0 and max 100" + ERROR,
  config_undefined: "Invalid config, please check /configurar" + ERROR,
  config_not_implemented: "That setting is not implemented yet and will be ignored.",
  config_locale_invalid: "Invalid language. Options: es, en, pt." + ERROR,
  config_is_ok: "Setting applied. Use /configurar to see current values.",
  did_sing: "sang",
  game_is_empty:
    "Minimum is 2 players. Wait for more players to /unirse!",
  game_is_full: "Maximum is 4 players. Try the next game!",
  game_is_running:
    "Game already started. Wait for it to end or use /reiniciar",
  game_no_started: "Game has not started yet.",
  game_is_restarted: "Game was restarted, /unirse to join",
  game_no_started_description: "Wait until the game starts.",
  game_no_started_message: "Game has not started yet.",
  game_no_started_title: "Game has not started yet.",
  group_added: "Group added.",
  group_invalid: "Group is not valid. Use /list_groups to list public groups.",
  no_active_game: "There is no active game in this group. Use /unirse to create one.",
  group_removed: "Group removed from allowed list",
  how_config:
    "\nMany things are configurable. Use /configurar to see current settings.\n\nSee Spanish version for full reference.",
  invalid_value: "Invalid value, try another." + ERROR,
  is_not_a_group: "This command is only available in groups." + ERROR,
  no_admin_person: "You don't look like a Bot administrator." + ERROR,
  no_cards_description: "You don't have any cards yet.",
  no_cards_message: "Waiting to play...",
  no_cards_title: "🤷🏼‍♂️ No Cards",
  no_game_description: "You are not in a game.",
  no_game_message: "You are not playing",
  no_game_title: "You are not playing",
  no_unban_groups: "Cannot unblock a Bot.",
  no_username: "NoUsername",
  remember_reply: "Remember to reply to the other player's message.",
  start_by:
    "Shuffling...\nTap a button to choose whether to start with 1 or 4.",
  shuffling: "🔀 Shuffling...",
  start_by_prompt:
    "Tap a button to choose whether to start the table with 1 or 4.",
  start_by_four_description: "Try to set the table as 4 -> 3 -> 2 -> 1",
  start_by_four_message: "Start by 4",
  start_by_four_title: "Start by 4",
  start_by_one_description: "Try to set the table as 1 -> 2 -> 3 -> 4",
  start_by_one_message: "Start by 1",
  start_by_one_title: "Start by 1",
  set_group_modes: "Choose a new Game Mode",
  mata_mesa_msg: "🔄 Mata mesa: dealer loses {n} pts\n",
  sing_killed: "The caída killed the previous player's sing!\n",
  sync_cards: "Stuck on table ",
  user_added: "User added.",
  user_banned: "User blocked.",
  user_get_fall: "Caída!\n",
  user_is_banned:
    "You were temporarily or permanently blocked from using this bot." + ERROR,
  user_is_already_joined: "You're already in this game",
  user_is_already_joined_other_group: "You're already in another game",
  salir_not_in_game: "You're not in any game.",
  salir_in_progress:
    "The game already started, you can't leave. Ask an admin to use /reiniciar.",
  salir_left: "You left the game. You can /unirse to another group now.",
  game_expired:
    "⏰ This game was automatically cancelled for exceeding the configured maximum duration. Players can /unirse to a new one.",
  unir_bot_prompt:
    "🤖 *Add bot to the game*\n\n" +
    "Pick difficulty:\n" +
    "• *Easy*: random plays (always cantos).\n" +
    "• *Medium*: prioritizes caídas, clean mesa and max card take. Sees the table.\n" +
    "• *Pro*: sees everyone's cards + counts cards + avoids gifting caídas.",
  unir_bot_full: "Game is full (4/4). Can't add another bot.",
  unir_bot_running: "Game already started. Can't add bots now.",
  salir_bot_empty: "No bots in this game.",
  salir_bot_running_not_admin:
    "Game already started. Only an admin can remove bots now.",
  salir_bot_prompt: "Tap the bot you want to remove:",
  user_is_not_admin: "This command must be used by a #admin.",
  user_unbanned: "User unblocked.",

  // ─── In-game render strings ───
  ig_last_hand: "✨ Last hand\n",
  ig_mesa_label: "Table:",
  ig_empty_slot: " []",
  ig_last_card_label: "🎴 Last card: ",
  ig_card_of: " of ",
  ig_next_label: "👉 Turn: ",
  ig_team_label: "Team ",
  ig_team_red: "Red",
  ig_team_blue: "Blue",
  ig_team_red_emoji: "🔴 ",
  ig_team_blue_emoji: "🔵 ",
  ig_pts_suffix: " pts",
  ig_took_suffix: " taken",
  ig_cards_suffix: " cards",
  ig_sang_prefix: "sang ",
  ig_no_sang: "no sing",
  ig_player_bullet: "   • ",
  ig_dot_sep: " · ",
  ig_players_header: "Players:",
  ig_won_prefix: "🏆 Won ",
};
