const User = require("./User");
const Card = require("./Card");
const Sings = require("./Sings");
const resp = require("../lang/es");
const { getLang } = require("../lang");
const Config = require("./Config");
const UserDatabase = require("../database/user");
const message = require("../templates/message");
const keyboard = require("../templates/keyboard");

// Color markers for individual-mode renders live on the User itself
// (set by Game.join from User.INDIVIDUAL_COLORS) so they stay glued to
// the player across the per-deck users[] rotation.

/**
 * In-memory Game state. Persisted via services/gameSerialize.js — the
 * fields enumerated there (config, deck, decks, last_card_played,
 * last_hand, last_player_on_take, name, users, player, points, table,
 * table_order, took) are the durable shape; this constructor sets the
 * initial values.
 */
class Game {
  /**
   * Create a Game Object
   * @param {String} name - Group Name where the game is running.
   * @param {Config} config - Configs of the group.
   */
  constructor(name, config) {
    this.config = config;
    this.name = name;
    this.deck = new Array();
    this.decks = 0;
    this.last_card_played = null;
    this.last_hand = false;
    this.last_player_on_take = 0;
    this.users = new Array();
    this.player = 0;
    this.points = new Array();
    this.table = [null, null, null, null, null, null, null, null, null, null];
    this.table_order = "";
    this.took = [0, 0, 0, 0];
    this._dealerSyncCandidate = null;
    // Scoring slot of a dealer whose pegar-en-mesa points crossed the
    // winning threshold but whose win is deferred because mata_mesa can
    // still reverse it. Resolved on the first play of the deck (see
    // play_card). null = no pending mesa win.
    this._pendingMesaWinSlot = null;
    // Epoch ms when the first deck was dealt. Used by the game-reaper
    // cron to auto-cancel games that exceed config.max_game_duration_minutes.
    // Stays null until shuffle() runs for the first time (i.e., the
    // group has > 1 user and someone hit /inicia_ya).
    this.started_at = null;
    // Cards played since the start of the current deck. Used by the
    // pro CPU to count cards (knowing what's been seen narrows down
    // what opponents still hold). Reset on every shuffle().
    this.played_cards = [];
  }

  /**
   * Resolve the in-game language table from the group's locale. Lazy
   * so locale changes apply without rebuilding the Game.
   */
  _lang() {
    return getLang(this.config && this.config.locale);
  }

  /**
   * @returns The number of the last player on play.
   */
  last_player() {
    let last = this.player - 1;
    return last < 0 ? this.users.length - 1 : last;
  }

  /**
   * Display name for a single user, mention-style.
   *
   * Prefers @username so Telegram parses it as a mention and pings the
   * user even when they have the group muted (notification override on
   * direct mention is the standard Telegram behaviour). Falls back to
   * first_name for users without a public Telegram username — those
   * users won't get a notification, which is a known limitation.
   *
   * Future: lift this into a {text, entity} pair so we can emit a
   * `text_mention` MessageEntity for users without username — that's
   * the only way to notify them too.
   *
   * @param {Object} user
   * @returns {String|null}
   */
  mentionName(user) {
    if (!user) return null;
    if (user.username) return "@" + user.username;
    return user.first_name || null;
  }

  /**
   * @returns {String} the current player display name (mention-style).
   */
  playerName() {
    return this.mentionName(this.users[this.player]);
  }

  /**
   * MessageEntity that mentions the current player by user_id so a player
   * WITHOUT a public @username still gets pinged on their turn — a plain
   * first_name in the text doesn't notify them, but a `text_mention` does.
   *
   * Returns null when the mention is unneeded or impossible: the player has a
   * username (the @mention already pings), is a CPU, has no numeric Telegram
   * id, or the turn line isn't present in `text`.
   *
   * Telegram entity offsets are UTF-16 code units — the same unit as JS string
   * indices — so the position is read straight off the rendered text via
   * lastIndexOf (the turn line is always `ig_next_label + name`); no manual
   * offset threading through the concatenations is needed.
   *
   * @param {String} text - The rendered status message about to be sent.
   * @returns {Object|null} a Telegram MessageEntity, or null.
   */
  turnMentionEntity(text) {
    const u = this.users[this.player];
    if (!u || u.username || u.cpu_difficulty) return null;
    const id = Number(u.id_user);
    if (!Number.isInteger(id) || id <= 0) return null;
    const name = u.first_name;
    if (!name) return null;
    const label = this._lang().ig_next_label;
    const idx = String(text || "").lastIndexOf(label + name);
    if (idx < 0) return null;
    return {
      type: "text_mention",
      offset: idx + label.length,
      length: name.length,
      user: { id, first_name: name },
    };
  }

  /**
   * Whether the current game is actually being played as parejas. A
   * group may have config.type === "parejas" saved, but parejas only
   * makes sense with exactly 4 users — with 2 or 3 the game must fall
   * through to individual scoring/rendering so the saved flag becomes
   * inert until 4 players actually join.
   * @returns {Boolean}
   */
  isParejasMode() {
    return this.config.type === "parejas" && this.users.length === 4;
  }

  /**
   * Map a user index to the slot in this.points / this.took. Parejas-4
   * collapses partners into 2 slots ([0,2] -> 0, [1,3] -> 1); every
   * other shape (2p, 3p, 4p-individual) is a 1:1 mapping. Centralised
   * here so future scoring tweaks touch one place instead of every
   * callsite that used the `type === "parejas" ? i % 2 : i` pattern.
   * @param {Number} playerIdx - Index into this.users.
   * @returns {Number}
   */
  scoringSlot(playerIdx) {
    return this.isParejasMode() ? playerIdx % 2 : playerIdx;
  }

  /**
   * The dealer is always the last user — they receive the Start_By
   * sentinel and earn the table-pegar sync points. Per-deck rotation
   * inside handing_out_cards (this.users.push(this.users.shift()))
   * shifts the dealer every deck so this resolves at call time.
   * @returns {Number}
   */
  dealerIdx() {
    return this.users.length - 1;
  }

  /**
   * Add a new user and return the status of the game.
   * @param {User} user - User to be Added
   * @returns
   */
  join(user) {
    // Stamp the individual-mode color marker onto the User at join
    // time so it travels with them through per-deck rotations
    // (see this.users.push(this.users.shift()) in handing_out_cards).
    // Parejas mode leaves user.color empty — team colors are computed
    // per render from decks % 2.
    if (!user.color && this.config && !this.isParejasMode()) {
      user.color = User.INDIVIDUAL_COLORS[this.users.length] || "";
    }
    this.users.push(user);
    return this.print(false);
  }

  /**
   * @param {String} id_user
   * @returns {Array<Card|Sings>}
   */
  get_player_cards(id_user) {
    for (let i in this.users) {
      if (this.users[i].id_user == id_user) {
        if (this.users[i].cards.length == 3 && !this.users[i].sing.active && this.users[i].sing.value > 0)
          return this.users[i].cards.concat(this.users[i].sing);
        return this.users[i].cards;
      }
    };
    return [];
  }

  /**
   * @param {String} id_user - the id of the request player
   * @returns {Number} - User index
   */
  get_user_index(id_user, index = 0) {
    if (this.users.length > index) {
      if (this.users[index].id_user == id_user) return index;
      return this.get_user_index(id_user, index + 1);
    }
    return -1;
  }

  /**
   * @param {String} id_user - the id of the player that is sing
   * @returns
   */
  sing(id_user) {
    var user_index = this.get_user_index(id_user);
    if (user_index >= 0) {
      if (this.users[user_index].sing.value > 0) {
        UserDatabase.set_sing(this.users[user_index].statsId(), this.users[user_index].sing.dbName).catch(() => {})
      }
      return this.users[user_index].set_sing();
    }
    return resp.no_game_description;
  }

  /**
   * Extract the first card to the game deck
   * and validate if it's already on the table and if it's sync to the user prediction.
   * @param {Number} next_card - User prediction next card value.
   * @returns {Number} - The value of next_card if is sync with the card extracted
   */
  push_cards(next_card, save = false) {
    let card = new Card(this.deck.shift());
    if (this.table[card.position] != null) {
      this.deck.push(card.number);
      return this.push_cards(next_card, save);
    } else {
      this.table[card.position] = card;
      this.table_order += card.value + (save ? "\n" : " -> ");
      if (save) this.last_card_played = card; // TODO disable if config caida_en_mesa is down
      if (card.value == next_card) return next_card;
      return 0;
    }
  }

  /**
   * TODO Pretty comment
   * @param {Number} number - Number of cards to be added.
   * @param {Number} next_card - Number of the next card in the table
   * @param {Boolean} desc - true : 4 to 1, false 1 to 4
   */
  new_cards(number, next_card, desc) {
    if (number > 0) {
      let points = next_card != 0 ? this.push_cards(next_card) : 0;
      this.users.forEach(user => user.add_card(new Card(this.deck.shift()), this.config));
      if (next_card != 0) next_card = desc ? next_card - 1 : next_card + 1;
      return points + this.new_cards(number - 1, next_card, desc);
    } else {
      return next_card != 0 ? this.push_cards(next_card, true) : 0;
    }
  }

  increase_points(player, points) {
    var position = this.scoringSlot(player);
    if (!this.points[position])
      this.points[position] = points;
    else
      this.points[position] += points;
    return this.points[position] >= this.config.points;
  }

  /**
   * Shuffle and save all cards generators on the Deck and increment decks played.
   */
  shuffle() {
    const wasInitialShuffle = this.decks === 0;
    this.decks++;
    if (wasInitialShuffle && !this.started_at) this.started_at = Date.now();
    // Card-counting memory belongs to the current deck only.
    this.played_cards = [];
    this.deck = [
      11, 10, 38, 19, 25, 18, 14, 2, 5, 39, 8, 15, 29, 24, 30, 1, 12, 16, 9, 35,
      22, 32, 6, 4, 0, 27, 37, 17, 28, 33, 21, 3, 23, 34, 20, 7, 31, 36, 26, 13,
    ];
    // Fisher-Yates shuffle (unbiased)
    for (let i = this.deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
    }
    const L = this._lang();
    // Initial shuffle (from /inicia_ya) has no previous-deck state to
    // summarize — just mark the dealer and emit the combined banner.
    if (wasInitialShuffle) {
      this.markStartByPlayer();
      return L.start_by;
    }
    // Between-deck shuffle: full /estado-style snapshot of the deck we
    // just finished (points, took, etc.) sandwiched between the
    // "Barajando..." banner and the "pick 1/4" prompt. Snapshot BEFORE
    // markStartByPlayer mutates the dealer's cards with the "Start_By"
    // sentinel (which would render as "1 cartas").
    const status = this.print(false);
    this.markStartByPlayer();
    return L.shuffling + "\n\n" + status + "\n\n" + L.start_by_prompt;
  }

  /**
   * Tag the dealer/guesser slot with the "Start_By" sentinel so the
   * inline picker offers them the "Iniciar por 1/4" buttons.
   */
  markStartByPlayer() {
    this.users[this.users.length - 1].cards = ["Start_By"];
  }

  /**
   * Choose which {player, threshold} pairs apply for the took-bonus
   * step at the end of a deck. Iteration order is fixed so that if two
   * players cross threshold simultaneously the lower-index one wins
   * (kill short-circuits the loop).
   */
  _selectTookBonusRules() {
    if (this.users.length == 4 && !this.isParejasMode()) {
      return [
        { player: 0, threshold: 10 },
        { player: 1, threshold: 10 },
        { player: 2, threshold: 10 },
        { player: 3, threshold: 10 },
      ];
    }
    if (this.users.length == 3) {
      return [
        { player: 0, threshold: 13 },
        { player: 1, threshold: 13 },
        { player: 2, threshold: 14 }, // dealer (users[length-1]) reaches 14
      ];
    }
    // 2 players, or 4 players in parejas mode — only two scoring slots (0 and 1).
    return [
      { player: 0, threshold: 20 },
      { player: 1, threshold: 20 },
    ];
  }

  handing_out_cards(start_by, added = "") {
    if (this.deck.length > 0) {
      this.player = 0;
      this.users[this.users.length - 1].cards = [];
      this.table_order = "";
      // caida_continua = "on" means caída can still happen on the last
      // card of the *previous* mano. With "off" (the Clásico default),
      // we reset last_card_played at the start of every new mano so the
      // first play of the new mano cannot trigger caída.
      // start_by != 0 means this is the start of a brand-new deck, in
      // which case new_cards / push_cards will set last_card_played
      // itself from the dealt mesa card, so we leave it alone.
      if (start_by === 0 && this.config.caida_continua !== "on") {
        this.last_card_played = null;
      }
      let points = this.new_cards(3, start_by, start_by > 2);
      if (start_by !== 0 && points > 0) {
        this._dealerSyncCandidate = {
          dealerIdx: this.dealerIdx(),
          syncCard: this.last_card_played, // 4th dealt card with save=true
          points: points,
        };
      } else if (start_by === 0) {
        // mid-deck deal — mata_mesa does not apply (no sync points event)
        this._dealerSyncCandidate = null;
      }
      added += this.table_order;
      if (points > 0) {
        const dealerIdx = this.users.length - 1;
        const crossed = this.increase_points(dealerIdx, points);
        added += resp.sync_cards + points + "\n";
        if (crossed) {
          // A pegar-en-mesa win is reversible only when mata_mesa is on
          // and the first player can still caída the dealt sync card.
          // In that case defer the endgame: the win is resolved on the
          // first play (see play_card). Otherwise end the game now.
          const reversible =
            this.config.mata_mesa === "on" && this._dealerSyncCandidate;
          if (reversible) {
            this._pendingMesaWinSlot = this.scoringSlot(dealerIdx);
            const L = this._lang();
            added += L.mesa_win_pending
              .replace("{dealer}", this.mentionName(this.users[dealerIdx]))
              .replace("{pts}", String(this.points[this.scoringSlot(dealerIdx)]))
              .replace("{p0}", this.mentionName(this.users[0]));
          } else {
            return this.kill(dealerIdx);
          }
        }
      } else {
        if (start_by > 0) {
          if (this.increase_points(0, 1)) return this.kill(0);
          added += resp.bad_sync_cards;
        }
      }
      if (this.deck.length == 0) {
        this.last_hand = true;
      }
      // start_by != 0: brand-new deck deal right after the user picked
      // 1/4 — show full /estado-style status. start_by == 0: mid-deck
      // mano (every player just emptied their hand and got 3 new
      // cards) — show the compact reduced status with the next turno.
      const renderFull = start_by !== 0;
      return added + (renderFull ? this.print(false) : this.renderShortStatus());
    }
    // Clean las tabble
    for (let position = 0; position < this.table.length; position++) {
      if (this.table[position] != null) this.took[this.last_player_on_take]++;
      this.table[position] = null;
    }
    // Add took points. Threshold per player depends on player count and
    // game type. Note the 3-player asymmetry: player 2 (the dealer) gets
    // threshold 14 while players 0 and 1 use 13 — preserve.
    const tookRules = this._selectTookBonusRules();
    for (const { player, threshold } of tookRules) {
      if (this.took[player] > threshold && this.increase_points(player, this.took[player] - threshold))
        return this.kill(player);
    }
    // Reset table
    this.last_player_on_take = 0;
    this.took = [0, 0, 0, 0];
    // Normalize this.points so its length matches the number of
    // distinct scoring slots BEFORE the rotation. The slot count is
    // users.length for individual modes (2/3/4) or 2 for parejas-4.
    // Without this, a sparse points array (e.g. [9, 1] in a 3-player
    // game where player 2 never earned anything) would misalign on
    // push(shift()): the player at the new tail index would read
    // `undefined` and visually swap scores with another player.
    const slotCount = this.isParejasMode() ? 2 : this.users.length;
    while (this.points.length < slotCount) this.points.push(0);
    if (this.points.length > slotCount) this.points.length = slotCount;
    this.users.push(this.users.shift());
    this.points.push(this.points.shift());
    this.last_hand = false;
    this.last_card_played = null;
    return added + this.shuffle();
  }

  play_card(id_user, number) {
    // Transient per-call flags read by services/game.js to emit
    // structural events without parsing the response string. Reset on
    // every entry — these are derived from this call only.
    this._lastCaida = false;
    this._lastCleanTable = false;
    /**
     * @type {User}
     */
    if (this.users[this.player].id_user == id_user) {
      let card = this.users[this.player].play(number);
      if (card) {
        var card_position = card.position;
        var took = 1;
        var response = "";
        if (this.table[card_position] != null) {
          while (this.table[card_position] != null) {
            this.table[card_position] = null;
            card_position++;
            took++;
          }
        } else {
          this.table[card_position] = card;
        }
        if (took > 1) {
          // Took something
          this.took[this.scoringSlot(this.player)] += took;
          this.last_player_on_take = this.player;
          if (
            this.last_card_played &&
            this.last_card_played.position == card.position
          ) {
            // is fall down
            if (this.config.caida > 0) {
              this.users[this.last_player()].caido += 1;
              this.users[this.player].caida += 1;
              this._lastCaida = true;
              // Do NOT short-circuit on a winning caída — we want the
              // chat to see the caída announcement + final state, then
              // the victory message. The win check runs at the end of
              // play_card and passes `response` as `pre` to kill().
              this.increase_points(this.player, card.points * this.config.caida);
              response = resp.user_get_fall;
              if (
                this._dealerSyncCandidate &&
                this._dealerSyncCandidate.syncCard === this.last_card_played
              ) {
                if (this.config.mata_mesa === "on") {
                  const slot = this.scoringSlot(this._dealerSyncCandidate.dealerIdx);
                  const lost = Math.min(this.points[slot] || 0, this._dealerSyncCandidate.points);
                  this.points[slot] = (this.points[slot] || 0) - lost;
                  response += resp.mata_mesa_msg.replace("{n}", lost);
                }
                this._dealerSyncCandidate = null; // consumed even if flag off
              }
              if (this.config.mata_canto == "on") {
                if (this.users[this.last_player()].sing.active) {
                  response += resp.sing_killed;
                  this.users[this.last_player()].sing.killed = true;
                }
                this.users[this.last_player()].sing.active = false;
              }
            }
          }
          if (!this.last_hand) {
            var clean = true;
            this.table.forEach((card) => {
              if (card != null) clean = false;
            });
            if (clean) {
              this._lastCleanTable = true;
              // Same idea — don't early-kill on mesa-limpia. End-of-fn
              // win check handles it.
              this.increase_points(this.player, 1 * this.config.mesa);
              response += resp.clean_table;
            }
          }
        }
        this.last_card_played = card;
        // Bookkeeping for the pro CPU's card-counting heuristic. Append
        // by number so the cost is tiny and stable across persistence.
        if (card && typeof card.number === "number") {
          this.played_cards.push(card.number);
        }
        // Only the first play of a deck can trigger mata_mesa.
        this._dealerSyncCandidate = null;
        // Resolve a deferred pegar-en-mesa win (set in handing_out_cards).
        // mata_mesa already ran above this line, so if the dealer's mesa
        // points survived (>= threshold) the first player did NOT kill
        // them — the dealer's win, which happened first at deal time,
        // takes priority over any win the first player just scored on
        // this same turn. If mata_mesa reduced them below the threshold,
        // fall through to the normal win check (the first player may win
        // with their own caída points).
        if (this._pendingMesaWinSlot != null) {
          const slot = this._pendingMesaWinSlot;
          this._pendingMesaWinSlot = null;
          if (this.points[slot] >= this.config.points) {
            return this.kill(slot, response + this.renderShortStatus());
          }
        }
        // Single win-check point for the play_card path. We pass the
        // current response + the short-status snapshot to kill() so the
        // victory message is preceded by what just happened.
        for (let i = 0; i < this.points.length; i++) {
          if (this.points[i] >= this.config.points) {
            return this.kill(i, response + this.renderShortStatus());
          }
        }
        if (this.users[this.users.length - 1].cards.length > 0) {
          this.player = (this.player + 1) % this.users.length;
          return response + this.renderShortStatus();
        }
        let sings = [0, 0, 0, 0];
        let biggest = 0;
        this.users.forEach((user, index) => {
          if (user.sing && user.sing.active) {
            sings[index] = user.sing.value;
            if (user.sing.value > sings[biggest]) biggest = index;
          }
        });
        if (sings[biggest] > 0) {
          UserDatabase.set_sing(this.users[biggest].statsId(), "alive_" + this.users[biggest].sing.dbName).catch(() => {})
          if (this.increase_points(biggest, sings[biggest])) {
            return this.kill(biggest, response + this.renderShortStatus());
          }
        }
        return this.handing_out_cards(0, response);
      }
      return resp.invalid_value;
    }
    return resp.bad_turn;
  }

  /**
   * Finalize the game. The optional `pre` is text built before the
   * win condition crossed (caída announcement, mesa-limpia, mata-mesa
   * note, etc. + the regular state line). It gets prepended so the
   * chat sees the play that won AND then the victory header in a
   * single coherent message instead of jumping straight to "🏆 Won X"
   * with no context.
   *
   * @param {Number} player - The winning player's scoring slot.
   * @param {String} pre - Optional state text that led to this kill.
   */
  kill(player, pre = "") {
    let win = this.config.game_mode > 0 ? 1 : 2
    for (var i = 0; i < this.users.length; ++i) {
      let user = this.users[i]
      let comparate = this.scoringSlot(i)
      let user_win = player == comparate ? win : 0
      // Fire-and-forget: DB failures shouldn't block kill response, but
      // catch the rejection so it doesn't become an unhandledRejection.
      UserDatabase.set_stats(user.statsId(), user_win, user.caida, user.caido).catch(() => {})
    }
    const L = this._lang();
    let response = pre ? pre + "\n\n" : "";
    response += L.ig_won_prefix;
    response += this.users[player].print(false, L);
    // For parejas the compact "24-22" tail is useful at a glance. For
    // individual the per-player breakdown duplicates _renderFinalStandings
    // below, so we skip it.
    if (this.isParejasMode()) response += this._renderFinalScore(player);
    response += "\n" + this._renderFinalStandings();
    this.decks = 0;
    return { finished: true, response };
  }

  /**
   * Standings shown after the "🏆 Ganó X 24-22" line. Names + final
   * points only — no mesa header, no took, no card counts, no "sin
   * canto" placeholders. Team colours follow the current decks % 2 so
   * they match the in-game render the user just saw.
   */
  _renderFinalStandings() {
    const L = this._lang();
    const parts = [];
    const renderName = (u) => u.first_name + (u.username ? " (@" + u.username + ")" : "");
    if (this.isParejasMode()) {
      for (let team = 0; team < 2; team++) {
        const isRed = team === 0 ? this.decks % 2 === 0 : this.decks % 2 === 1;
        const emoji = isRed ? L.ig_team_red_emoji : L.ig_team_blue_emoji;
        const name = isRed ? L.ig_team_red : L.ig_team_blue;
        parts.push(
          "\n" + emoji + L.ig_team_label + name + L.ig_dot_sep + (this.points[team] || 0) + L.ig_pts_suffix,
        );
        for (const idx of [team, team + 2]) {
          if (!this.users[idx]) continue;
          parts.push("\n" + L.ig_player_bullet + renderName(this.users[idx]));
        }
        parts.push("\n");
      }
      return parts.join("").trim();
    }
    // Individual — one line per player, sorted by points desc.
    const ranked = this.users
      .map((u, i) => ({ u, i }))
      .filter((x) => x.u)
      .sort((a, b) => (this.points[b.i] || 0) - (this.points[a.i] || 0));
    for (const { u, i } of ranked) {
      const color = u.color || User.INDIVIDUAL_COLORS[i] || "•";
      parts.push(
        "\n" + color + " " + renderName(u) + L.ig_dot_sep + (this.points[i] || 0) + L.ig_pts_suffix,
      );
    }
    return parts.join("").trim();
  }

  /**
   * @param {Boolean} short_status - Only send the game status without teams information
   * @returns Printable message with the game and teams information
   */
  print(short_status = true, no_started = true) {
    const is_running = this.decks > 0;
    let response = this._renderHeader(is_running, no_started);
    if (short_status) return response;
    return (
      response +
      (this.isParejasMode()
        ? this._renderTeamsParejas(is_running)
        : this._renderTeamsIndividual(is_running))
    );
  }

  _renderHeader(is_running, no_started) {
    const L = this._lang();
    if (!is_running) return no_started ? L.game_no_started : "";
    let response = "";
    if (this.last_hand) response += L.ig_last_hand;
    response += L.ig_mesa_label;
    this.table.forEach((item) => {
      if (item != null) response += " " + item.value;
      else response += L.ig_empty_slot;
    });
    if (this.last_card_played) {
      response +=
        "\n" +
        L.ig_last_card_label +
        this.last_card_played.value +
        L.ig_card_of +
        this.last_card_played.type;
    }
    response += "\n" + L.ig_next_label + this.playerName();
    return response;
  }

  _renderTeamsParejas(is_running) {
    const L = this._lang();
    const out = [];
    // Each pass renders one team. The first listed team is "Rojo" when
    // decks % 2 == 0 and "Azul" otherwise, alternating each deck — same
    // rule as the legacy renderer.
    for (let team = 0; team < 2; team++) {
      const isRed = team === 0 ? this.decks % 2 === 0 : this.decks % 2 === 1;
      const emoji = isRed ? L.ig_team_red_emoji : L.ig_team_blue_emoji;
      const name = isRed ? L.ig_team_red : L.ig_team_blue;
      let header = "\n\n" + emoji + L.ig_team_label + name;
      if (is_running) {
        header +=
          L.ig_dot_sep + (this.points[team] || 0) + L.ig_pts_suffix +
          L.ig_dot_sep + this.took[team] + L.ig_took_suffix;
      }
      out.push(header);
      // Players on this team are at indices [team, team + 2] (0,2 or 1,3).
      for (const idx of [team, team + 2]) {
        const u = this.users[idx];
        if (!u) continue;
        out.push("\n" + L.ig_player_bullet + u.print(is_running, L));
      }
    }
    return out.join("");
  }

  _renderTeamsIndividual(is_running) {
    const L = this._lang();
    const lines = [];
    for (let i = 0; i < this.users.length; i++) {
      const u = this.users[i];
      if (!u) continue;
      const color = u.color || User.INDIVIDUAL_COLORS[i] || "•";
      let line = "\n" + color + " " + u.print(is_running, L);
      if (is_running) {
        line +=
          L.ig_dot_sep + (this.points[i] || 0) + L.ig_pts_suffix +
          L.ig_dot_sep + this.took[i] + L.ig_took_suffix;
      }
      lines.push(line);
    }
    if (lines.length === 0) return "";
    return "\n" + lines.join("");
  }

  /**
   * Compact one-line summary "🔵 1⭐ 12🃏 | 🔴 0⭐ 15🃏" used inside the
   * short status. Shows BOTH points (⭐) and cards taken (🃏) per
   * player/team — taken count matters mid-deck because it feeds the
   * end-of-deck threshold bonus, and players want to see it without
   * jumping to /estado.
   */
  _renderReducedPointsLine() {
    const L = this._lang();
    const fmt = (color, pts, took) =>
      color + " " + (pts || 0) + "pts  " + (took || 0) + "🃏";
    if (this.isParejasMode()) {
      const team0Red = this.decks % 2 === 0;
      const colors = [
        team0Red ? L.ig_team_red_emoji.trim() : L.ig_team_blue_emoji.trim(),
        team0Red ? L.ig_team_blue_emoji.trim() : L.ig_team_red_emoji.trim(),
      ];
      return (
        fmt(colors[0], this.points[0], this.took[0]) +
        "  |  " +
        fmt(colors[1], this.points[1], this.took[1])
      );
    }
    const parts = [];
    for (let i = 0; i < this.users.length; i++) {
      const u = this.users[i];
      if (!u) continue;
      const color = u.color || User.INDIVIDUAL_COLORS[i] || "•";
      parts.push(fmt(color, this.points[i], this.took[i]));
    }
    return parts.join("  |  ");
  }

  /**
   * "Short" status: header + compact points + turno. This is what gets
   * sent after every card play and between mid-deck manos. Carries the
   * same surface info as the full status (mesa, última carta, who's
   * next) plus the running scoreline, but skips the per-player block
   * (cards/canto/took) which only matters on /estado, deck-end, and
   * "Iniciar por 1/4".
   */
  renderShortStatus() {
    const L = this._lang();
    if (this.decks === 0) return L.game_no_started;
    let out = "";
    if (this.last_hand) out += L.ig_last_hand;
    out += L.ig_mesa_label;
    this.table.forEach((item) => {
      if (item != null) out += " " + item.value;
      else out += L.ig_empty_slot;
    });
    if (this.last_card_played) {
      out +=
        "\n" +
        L.ig_last_card_label +
        this.last_card_played.value +
        L.ig_card_of +
        this.last_card_played.type;
    }
    out += "\n" + this._renderReducedPointsLine();
    out += "\n" + L.ig_next_label + this.playerName();
    return out;
  }

  /**
   * Final-score breakdown shown right after "🏆 Ganó X".
   * Parejas: "24-22". Individual: "(Andrés 24, Mafeer 22, P3 18, P4 15)".
   */
  _renderFinalScore(winnerPlayerIdx) {
    if (this.isParejasMode()) {
      const w = winnerPlayerIdx % 2;
      const l = w === 0 ? 1 : 0;
      return " " + (this.points[w] || 0) + "-" + (this.points[l] || 0);
    }
    const sorted = this.users
      .map((u, i) => ({ name: u && u.first_name, pts: this.points[i] || 0 }))
      .filter((x) => x.name)
      .sort((a, b) => b.pts - a.pts);
    if (sorted.length === 0) return "";
    const breakdown = sorted.map((s) => s.name + " " + s.pts).join(", ");
    return " (" + breakdown + ")";
  }

  /**
   * Return the full message and options to setup and start the game.
   * @param {Number|Boolean} message_id - The id of a message to be edited.
   * @param {Number} chat_id - The id of a chat of the message.
   * @returns Telegram Message and Options
   */
  print_before_game(message_id, chat_id = null) {
    let players = this.users.length;
    let type =
      players == 4
        ? this.config.type == "parejas"
          ? "individual"
          : "en parejas"
        : false;
    let response = this.config.print_before_game(players);
    let kboard = keyboard.list_game_modes_and_run(
      type,
      this.config.get_game_modes()
    );
    return message_id
      ? message.edit_keyboard(response, message_id, chat_id, kboard)
      : message.keyboard(response, kboard);
  }
}

module.exports = Game;
