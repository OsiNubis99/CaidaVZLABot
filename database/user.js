const Factory_User = require("../class/Factory_User");
const database = require("../config/db");

module.exports = {
  /**
   * Add a new User to the database. If it's already then update the user first_name,last_name and username.
   * @param {Factory_User} user - User element to be pushed.
   * @returns {Promise<Factory_User>} The complete user from database.
   */
  async add(user) {
    let result = await database.query(
      "INSERT INTO public.user ( id_user, first_name, last_name, username, is_banned) VALUES ($1,$2,$3,$4,false) ON CONFLICT (id_user) DO UPDATE SET first_name = $2, last_name = $3, username = $4 RETURNING * ;",
      [user.id_user, user.first_name, user.last_name, user.username]
    );
    return result.rows[0];
  },

  /**
   * @returns {Promise<Array<Factory_User>>} All Users from the database.
   */
  async list() {
    let result = await database.query("SELECT * FROM public.user;");
    return result.rows;
  },

  /**
   * Set all stats to one user and return the full User element.
   * @param {String} id_user - Specific User id to set the stats
   * @param {Number} win - It should be 2, 1 or 0.
   * @param {Number} sings - Number of sings of the user in the game.
   * @param {Number} caida - Number of times the user gave down another.
   * @param {Number} caido - Number of times the user was fallen by another.
   * @returns {Promise<Factory_User>} The full User element from database.
   */
  async set_stats(id_user, win, sings, caida, caido) {
    let query = "UPDATE public.user SET finished = finished + 1"
    query += win == 1 ? ", win = win + $2" : win == 2 ? ", win_custom = win_custom + $2" : ""
    query += ", sings = sings + $3 , caida = caida + $4, caido = caido + $5 WHERE id_user = $1;"
    let result = await database.query(query, [id_user, win, sings, caida, caido]);
    return result.rows[0];
  },

  /**
   * Add a new user with is_banned as ban param. If it's already then set is_baned and update first name and last name.
   * @param {Factory_User} user - User element to be updated or added.
   * @param {Boolean} is_banned - Value of is_banned.
   * @returns {Promise<Factory_User>} The full User element from database.
   */
  async ban_unban(user, is_banned) {
    let result = await database.query(
      "INSERT INTO public.user ( id_user, first_name, last_name, username, is_banned) VALUES ($1,$2,$3,$4,?5) ON CONFLICT (id_user) DO UPDATE SET first_name = $2, last_name = $3, username = $4, is_banned = ?5 RETURNING * ;",
      [user.id_user, user.first_name, user.last_name, user.username, is_banned]
    );
    return result.rows[0];
  },
};
