const Factory_User = require("../class/Factory_User");
const database = require("../config/db");

module.exports = {
  /**
   * Add a new User to the database. If it's already then update the user first_name,last_name and username.
   * @param {Factory_User} user - User element to be pushed.
   * @returns {Factory_User} The complete user from database.
   */
  async add(user) {
    let result = await database.query(
      "INSERT INTO public.user ( id_user, first_name, last_name, username, is_banned) VALUES ($1,$2,$3,$4,false) ON CONFLICT (id_user) DO UPDATE SET first_name = $2, last_name = $3, username = $4 RETURNING * ;",
      [user.id_user, user.first_name, user.last_name, user.username]
    );
    return result.rows[0];
  },

  /**
   * @returns All Users from the database.
   */
  async list() {
    let result = await database.query("SELECT * FROM public.user;");
    return result.rows;
  },

  /**
   * @param {String} id_user - Specific User id to get the statics
   * @returns {Factory_User} The full User element from database.
   */
  async statics(id_user) {
    let result = await database.query(
      "SELECT * FROM public.user where id_user=$1;",
      [id_user]
    );
    return result.rows[0];
  },

  /**
   * Set all statics to one user and return the full User element.
   * @param {String} id_user - Specific User id to set the statics
   * @param {Number} win - Number of won games to be added. It should be 1 or 0.
   * @param {Number} sings - Number of sings of the user in the game.
   * @param {Number} caida - Number of times the user gave down another.
   * @param {Number} caido - Number of times the user was fallen by another.
   * @returns The full User element from database.
   */
  async set_statics(id_user, win, sings, caida, caido) {
    let result = await database.query(
      "UPDATE public.user SET finished = finished + 1, win = win + $2, sings = sings + $3 , caida = caida + $4, caido = caido + $5 WHERE id_user = $1;",
      [id_user, win, sings, caida, caido]
    );
    return result.rows[0];
  },

  /**
   * Add a new user with is_banned as true. If it's already then set is_baned true.
   * @param {Factory_User} user - User element to be updated or added.
   * @returns The full User element from database.
   */
  async ban(user) {
    let result = await database.query(
      "INSERT INTO public.user ( id_user, first_name, last_name, username, is_banned) VALUES ($1,$2,$3,$4,true) ON CONFLICT (id_user) DO UPDATE SET first_name = $2, last_name = $3, username = $4, is_banned = true RETURNING * ;",
      [user.id_user, user.first_name, user.last_name, user.username]
    );
    return result.rows[0];
  },

  /**
   * Add a new user with is_banned as false. If it's already then set is_baned false.
   * @param {Factory_User} user - User element to be updated or added.
   * @returns The full User element from database.
   */
  async unban(user) {
    let result = await database.query(
      "INSERT INTO public.user ( id_user, first_name, last_name, username, is_banned) VALUES ($1,$2,$3,$4,false) ON CONFLICT (id_user) DO UPDATE SET first_name = $2, last_name = $3, username = $4, is_banned = false RETURNING * ;",
      [user.id_user, user.first_name, user.last_name, user.username]
    );
    return result.rows[0];
  },
};
