const resp = require("../lang/es");
const Game = require("../class/Game");
const User = require("../class/User");
const Config = require("../class/Config");
const message = require("../templates/message");
const keyboard = require("../templates/keyboard");
const TelegramBot = require("node-telegram-bot-api");
const Factory_User = require("../class/Factory_User");
const Factory_Request = require("../class/Factory_Request");
const { GroupController, UserController } = require("../database");

/**
 * @type {Array<Game>}
 */
var games = [];
/**
 * @type {Array<String>}
 */
var users = [];

/**
 * Search all users on the game and delete their object.
 * @param {String} chatId - Id that will be cleaned.
 * @param {Array<Factory_User>} listUsers - Id that will be cleaned.
 */
function cleanUsers(listUsers, chatId) {
  listUsers.forEach((element) => {
    if (users[element.id_user] == chatId) {
      users[element.id_user] = undefined
    }
  });
}

module.exports = {
  log() {
    console.log({ users })
  },

  /**
   * Create a new game with the request data if it isn't already there.
   * @param {Factory_Request} req - Clean request data.
   * @returns Telegram message and options.
   */
  async create(req) {
    if (req.group.type == "supergroup" || req.group.type == "group") {
      let user = new User(await UserController.add(req.user));
      if (!user.is_banned) {
        /**
         * @type {Game}
         */
        var group = games[req.group.id_group];
        if (group)
          cleanUsers(group.users, req.group.id_group);
        let configs = await GroupController.getOneById(req.group.id_group);
        if (configs) {
          games[req.group.id_group] = new Game(configs.name, new Config(configs));
          return message.reply(resp.game_is_restarted, req.message_id);
        }
        else
          return message.reply(resp.group_invalid, req.message_id);
      }
      return message.reply(resp.user_is_banned, req.message_id);
    }
    return message.reply(resp.is_not_a_group, req.message_id);
  },

  /**
   * Save player data on database and try to join him to a game.
   * @param {Factory_Request} req - Clean request data.
   * @returns Telegram message and options
   */
  async join(req) {
    let user = new User(await UserController.add(req.user));
    if (!user.is_banned) {
      /**
       * @type {Game}
       */
      var group = games[req.group.id_group];
      if (!group) {
        let configs = await GroupController.getOneById(req.group.id_group);
        if (!configs)
          return message.reply(resp.group_invalid, req.message_id);
        games[req.group.id_group] = new Game(configs.name, new Config(configs));
        group = games[req.group.id_group];
      }
      if (group.decks == 0) {
        if (!users[user.id_user]) {
          if (group.users.length < 4) {
            users[user.id_user] = req.group.id_group;
            return message.reply(group.join(user), req.message_id);
          }
          return message.reply(resp.game_is_full, req.message_id);
        }
        if (users[user.id_user] == req.group.id_group)
          return message.reply(resp.user_is_already_joined, req.message_id);
        else
          return message.reply(resp.user_is_already_joined_other_group, req.message_id);
      }
      return message.reply(resp.game_is_running, req.message_id);
    }
    return message.reply(resp.user_is_banned, req.message_id);
  },

  /**
   * Return the full game status.
   * @param {Factory_Request} req - Clean request data.
   * @returns Telegram message and options
   */
  async status(req) {
    /**
     * @type {Game}
     */
    var group = games[req.group.id_group];
    if (group) {
      return message.reply(group.print(false), req.message_id);
    }
    return message.reply(resp.group_invalid, req.message_id);
  },

  /**
   * Print all configs.
   * @param {Factory_Request} req - Clean request data.
   * @returns Telegram message and options
   */
  async config(req) {
    /**
     * @type {Game}
     */
    var group = games[req.group.id_group];
    if (group) {
      let response = group.config.print();
      return message.keyboard(response, keyboard.group_settings());
    }
    return message.reply(resp.group_invalid, req.message_id);
  },

  /**
   * TODO Pretty comment
   * @param {Factory_Request} req - Clean request data.
   * @param {String} config - Specific config to be validated and updated.
   * @param {String|Number} value - Value to tested.
   * @returns Telegram message and options
   */
  async set_settings(req, config, value) {
    /**
     * @type {Game}
     */
    var group = games[req.group.id_group];
    if (group) {
      if (group.decks == 0) {
        let config_is_not_ok = group.config.is_not_ok(config, value);
        if (!config_is_not_ok) {
          await GroupController.update(req.group.id_group, group.config);
          return message.keyboard(resp.config_is_ok, keyboard.group_settings());
        }
        return message.reply(config_is_not_ok, req.message_id);
      }
      return message.reply(resp.game_is_running, req.message_id);
    }
    return message.reply(resp.group_invalid, req.message_id);
  },
  async set_inline_type(req) {
    /**
     * @type {Game}
     */
    var group = games[req.group.id_group];
    if (group && group.decks == 0) {
      group.config.type =
        group.config.type == "parejas" ? "individual" : "parejas";
      await GroupController.update(req.group.id_group, group.config);
      return group.print_before_game(req.group.id_group, req.message_id);
    }
    return false;
  },
  async set_inline_game_mode(req, game_mode) {
    /**
     * @type {Game}
     */
    var group = games[req.group.id_group];
    if (!group || group.decks > 0 || game_mode == group.config.game_mode) return false;
    group.config.set_game_mode(game_mode);
    await GroupController.update(req.group.id_group, group.config);
    return group.print_before_game(req.message_id, req.group.id_group);
  },

  /**
   * TODO Pretty comment
   * @param {Factory_Request} req - Clean request data.
   * @returns Telegram message and options
   */
  start(req) {
    /**
     * @type {Game}
     */
    var group = games[req.group.id_group];
    if (group) {
      if (group.decks == 0) {
        if (group.users.length > 1) {
          return group.print_before_game();
        }
        return message.reply(resp.game_is_empty, req.message_id);
      }
      return message.reply(resp.game_is_running, req.message_id);
    }
    return message.reply(resp.group_invalid, req.message_id);
  },

  /**
   * Start a new Game hand
   * @param {Factory_Request} req - Clean request data.
   * @param {Boolean} inLine
   * @returns Telegram message and options
   */
  shuffle(req, inLine = true) {
    /**
     * @type {Game}
     */
    var group = games[req.group.id_group];
    if (group) {
      if (group.decks == 0) {
        if (group.users.length > 1) {
          let response = group.shuffle();
          return message.keyboard(
            response,
            keyboard.make_a_choice(
              group.users[group.users.length - 1].first_name
            )
          );
        }
        return inLine ? false : message.reply(resp.game_is_empty, req.message_id);
      }
      return inLine ? false : message.reply(resp.game_is_running, req.message_id);
    }
    return inLine ? false : message.reply(resp.group_invalid, req.message_id);
  },

  /**
   * TODO Pretty comment
   * @param {Factory_User} user - Whoever plays the card
   * @param {Number} number - Index of the card to play
   * @returns
   */
  play_card(user, number) {
    let chatId = users[user.id_user]
    if (chatId) {
      /**
       * @type {Game}
       */
      let group = games[chatId];
      let response = group.play_card(user.id_user, number);
      if (response.finished) {
        games[chatId] = new Game(group.name, new Config(group.config));
        cleanUsers(group.users, chatId);
        response = response.response
      }
      return message.inLine_keyboard(
        chatId,
        response,
        keyboard.make_a_choice(group.playerName())
      );
    }
    return false;
  },

  /**
   * TODO Pretty comment
   * @param {Factory_User} user - Whoever plays the card
   * @returns
   */
  sing(user) {
    if (users[user.id_user]) {
      /**
       * @type {Game}
       */
      var group = games[users[user.id_user]];
      return message.inLine_keyboard(
        users[user.id_user],
        group.sing(user.id_user),
        keyboard.make_a_choice(group.playerName())
      );
    }
    return false;
  },

  handing_out_cards(user, number) {
    let chatId = users[user.id_user]
    if (chatId) {
      /**
       * @type {Game}
       */
      var group = games[chatId];
      if (user.id_user == group.users[group.users.length - 1].id_user) {
        let response = group.handing_out_cards(number);
        if (response.finished) {
          games[chatId] = new Game(group.name, new Config(group.config));
          cleanUsers(group.users, chatId);
          response = response.response
        }
        return message.inLine_keyboard(
          chatId,
          response,
          keyboard.make_a_choice(group.playerName())
        );
      }
    }
    return false;
  },

  /**
   * TODO Pretty comment
   * @param {Factory_User} user - Who calls the InlineQuery
   * @returns {Array<TelegramBot.InlineQueryResult>}
   */
  get_user_cards(user) {
    if (users[user.id_user]) {
      /**
       * @type {Game}
       */
      var group = games[users[user.id_user]];
      if (group.decks > 0) {
        let cards = group.get_player_cards(user.id_user);
        if (cards.length > 0) {
          if (cards[0] == "Start_By") {
            return [
              {
                id: 8,
                type: "article",
                title: resp.start_by_one_title,
                input_message_content: {
                  message_text: resp.start_by_one_message,
                },
                description: resp.start_by_one_description,
              },
              {
                id: 9,
                type: "article",
                title: resp.start_by_four_title,
                input_message_content: {
                  message_text: resp.start_by_four_message,
                },
                description: resp.start_by_four_description,
              },
            ];
          }
          let response = [];
          cards.forEach((element, index) => {
            if (index == 3) {
              response.push({
                id: 4,
                type: "article",
                title: element.name || "Error en canto",
                input_message_content: {
                  message_text: "Tengo " + element.name,
                },
                description: "Vale: " + element.value,
              });
            } else {
              response.push({
                id: index,
                type: "article",
                title: element.value || "Error en Carta",
                input_message_content: {
                  message_text:
                    "Juego el " + element.value + " de " + element.type,
                },
                description: "De " + element.type,
              });
            }
          });
          return response;
        }
        return [
          {
            id: 12,
            type: "article",
            title: resp.no_cards_title,
            input_message_content: {
              message_text: resp.no_cards_message,
            },
            description: resp.no_cards_description,
          },
        ];
      }
      return [
        {
          id: 11,
          type: "article",
          title: resp.game_no_started_title,
          input_message_content: {
            message_text: resp.game_no_started_message,
          },
          description: resp.game_no_started_description,
        },
      ];
    }
    return [
      {
        id: 10,
        type: "article",
        title: resp.no_game_title,
        input_message_content: {
          message_text: resp.no_game_message,
        },
        description: resp.no_game_description,
      },
    ];
  },
};
