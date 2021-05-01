const resp = require("../lang/es");
const Game = require("../class/Game");
const User = require("../class/User");
const Config = require("../class/Config");
const message = require("../templates/message");
const keyboard = require("../templates/keyboard");
const Factory_User = require("../class/Factory_User");
const Factory_Group = require("../class/Factory_Group");
const Factory_Request = require("../class/Factory_Request");
const { GroupController, UserController } = require("../controller");

var games = new Array(Game.prototype);
var users = new Array(String.prototype);

/**
 * Add all chat data to memory and save it on database.
 * @param {Factory_Group} group - Element to be saved.
 */
async function get_group_configs(group) {
  let configs = await GroupController.add(group);
  games[group.id_group] = new Game(configs.name, new Config(configs));
}

/**
 * Search all users on the game and delete their object.
 * @param {String} chatId - Id that will be cleaned.
 */
function cleanUsers(chatId) {
  users.forEach((element, index, array) => {
    if (element == chatId) {
      array[index] = null;
    }
  });
}

module.exports = {
  /**
   * Create a new game with the request data if it isn't already there.
   * @param {Factory_Request} req - Clean request data.
   * @param {Boolean} force - Create a new game even it's one already created.
   * @returns Telegram message and options.
   */
  async create(req, force) {
    if (req.group.type == "supergroup" || req.group.type == "group") {
      let new_user = new User(await UserController.add(req.user));
      if (!new_user.is_banned) {
        /**
         * @type   {Game}
         */
        var group = games[req.group.id_group];
        if (force || !group) {
          await get_group_configs(req.group);
          cleanUsers(req.group.id_group);
          return message.reply(resp.game_created, req.message_id);
        }
        return message.reply(resp.game_already_created, req.message_id);
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
    if (req.group.type == "supergroup" || req.group.type == "group") {
      let new_user = new User(await UserController.add(req.user));
      if (!new_user.is_banned) {
        await get_group_configs(req.group);
        /**
         * @type   {Game}
         */
        var group = games[req.group.id_group];
        if (group.decks == 0) {
          if (users[new_user.id_user] == null) {
            if (group.users.length < 4) {
              users[new_user.id_user] = req.group.id_group;
              return message.reply(group.join(new_user), req.message_id);
            }
            return message.reply(resp.game_is_full, req.message_id);
          }
          return message.reply(resp.user_is_already_joined, req.message_id);
        }
        return message.reply(resp.game_is_running, req.message_id);
      }
      return message.reply(resp.user_is_banned, req.message_id);
    }
    return message.reply(resp.is_not_a_group, req.message_id);
  },

  /**
   * Start a new Game hand
   * @param {Factory_Request} req - Clean request data.
   * @param {Boolean} inLine
   * @returns Telegram message and options
   */
  async shuffle(req, inLine = true) {
    if (req.group.type == "supergroup" || req.group.type == "group") {
      await get_group_configs(req.group);
      /**
       * @type   {Game}
       */
      var group = games[req.group.id_group];
      if (group.users.length > 1) {
        group.shuffle();
        return inLine
          ? message.edit_keyboard(
              resp.start_by,
              req.message_id,
              req.group.id_group,
              keyboard.start_by(group.playerName())
            )
          : message.keyboard(
              resp.start_by,
              keyboard.start_by(group.playerName())
            );
      }
      return inLine ? false : message.reply(resp.game_is_empty, req.message_id);
    }
    return inLine ? false : message.reply(resp.is_not_a_group, req.message_id);
  },

  /**
   * Return the full game status.
   * @param {Factory_Request} req - Clean request data.
   * @returns Telegram message and options
   */
  async status(req) {
    if (req.group.type == "supergroup" || req.group.type == "group") {
      await get_group_configs(req.group);

      /**
       * @type   {Game}
       */
      var group = games[req.group.id_group];
      return message.reply(group.print(), req.message_id);
    }
    return message.reply(resp.is_not_a_group, req.message_id);
  },

  /**
   * Print all configs.
   * @param {Factory_Request} req - Clean request data.
   * @returns Telegram message and options
   */
  async config(req) {
    if (req.group.type == "supergroup" || req.group.type == "group") {
      await get_group_configs(req.group);

      /**
       * @type   {Game}
       */
      var group = games[req.group.id_group];
      let response = group.config.print();
      return message.keyboard(response, keyboard.group_settings());
    }
    return message.reply(resp.is_not_a_group, req.message_id);
  },

  /**
   *
   * @param {Factory_Request} req - Clean request data.
   * @param {String} config - Specific config to be validated and updated.
   * @param {String|Number} value - Value to tested.
   * @returns Telegram message and options
   */
  async set_settings(req, config, value) {
    if (req.group.type == "supergroup" || req.group.type == "group") {
      await get_group_configs(req.group);

      /**
       * @type   {Game}
       */
      var group = games[req.group.id_group];
      let config_is_not_ok = group.config.is_not_ok(config, value);
      if (!config_is_not_ok) {
        await GroupController.update(req.group.id_group, group.config);
        return message.keyboard(resp.config_is_ok, keyboard.group_settings());
      }
      return message.reply(config_is_not_ok, req.message_id);
    }
    return message.reply(resp.is_not_a_group, req.message_id);
  },
  async set_inline_type(req) {
    await get_group_configs(req.group);

    /**
     * @type   {Game}
     */
    var group = games[req.group.id_group];
    group.config.type =
      group.config.type == "parejas" ? "individual" : "parejas";
    await GroupController.update(req.group.id_group, group.config);
    return group.print_before_game(req.group.id_group, req.message_id);
  },
  async set_inline_game_mode(req, game_mode) {
    await get_group_configs(req.group);

    /**
     * @type   {Game}
     */
    var group = games[req.group.id_group];
    if (game_mode == group.config.game_mode) return false;
    group.config.set_game_mode(game_mode);
    await GroupController.update(req.group.id_group, group.config);
    return group.print_before_game(req.group.id_group, req.message_id);
  },

  /**
   *
   * @param {Factory_Request} req - Clean request data.
   * @returns Telegram message and options
   */
  async start(req) {
    await get_group_configs(req.group);

    /**
     * @type   {Game}
     */
    var group = games[req.group.id_group];
    if (group.decks == 0) {
      if (group.users.length > 1) {
        return group.print_before_game();
      }
      return message.reply(resp.game_is_empty, req.message_id);
    }
    return message.reply(resp.game_is_running, req.message_id);
  },

  /**
   *
   * @param {Factory_User} user - Who call the InlineQuery
   * @returns {Array<TelegramBot.InlineQueryResult>}
   */
  get_user_cards(user) {
    if (users[user.id_user]) {
      /**
       * @type {Game}
       */
      var group = games[users[user.id_user]];
      if (group.decks > 0) {
        let cards = [];
        cards = group.get_player_cards(user.id_user);
        if (cards.length > 0) {
          if (cards == [1, 4]) {
            //TODO InlineResult and run middleware
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
                title: element.name,
                input_message_content: {
                  message_text: "Tengo " + element.name,
                },
                description: "Vale: " + element.value,
              });
            } else {
              response.push({
                id: index,
                type: "article",
                title: element.value,
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
            id: 3,
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
