const Factory_User = require("../class/Factory_User");
const database = require("../config/db");

const SING_COLUMNS = new Set([
  "caida",
  "caido",
  "ronda",
  "chiguire",
  "patrulla",
  "vigia",
  "registro",
  "maguaro",
  "registrico",
  "casa_chica",
  "casa_grande",
  "trivilin",
  "alive_ronda",
  "alive_chiguire",
  "alive_patrulla",
  "alive_vigia",
  "alive_registro",
  "alive_maguaro",
  "alive_registrico",
  "alive_casa_chica",
  "alive_casa_grande",
  "alive_trivilin",
]);

module.exports = {
  /**
   * Add a new user. If exists, update names + username.
   * @param {Factory_User} user
   * @returns {Promise<Factory_User>}
   */
  async add(user) {
    const result = await database.query(
      "INSERT INTO public.user ( id_user, first_name, last_name, username, is_banned) VALUES ($1,$2,$3,$4,false) ON CONFLICT (id_user) DO UPDATE SET first_name = $2, last_name = $3, username = $4 RETURNING * ;",
      [user.id_user, user.first_name, user.last_name, user.username],
    );
    return result.rows[0];
  },

  /**
   * @returns {Promise<Array<Factory_User>>}
   */
  async list() {
    const result = await database.query("SELECT * FROM public.user;");
    return result.rows;
  },

  /**
   * Update game-end stats for a user.
   * @param {String} id_user
   * @param {Number} win - 0 = lost, 1 = win, 2 = win_custom.
   * @param {Number} caida
   * @param {Number} caido
   */
  async set_stats(id_user, win, caida, caido) {
    let query = "UPDATE public.user SET finished = finished + 1";
    if (win === 1) query += ", win = win + 1";
    else if (win === 2) query += ", win_custom = win_custom + 1";
    query += ", caida = caida + $2, caido = caido + $3 WHERE id_user = $1;";
    const result = await database.query(query, [id_user, caida, caido]);
    return result.rows[0];
  },

  /**
   * Increment a counter column for one user. Column is whitelisted to prevent SQL injection.
   * @param {String} id_user
   * @param {String} sing - Column name (must be in SING_COLUMNS).
   */
  async set_sing(id_user, sing) {
    if (!SING_COLUMNS.has(sing)) {
      throw new Error(`Invalid sing column: ${sing}`);
    }
    const result = await database.query(
      `UPDATE public.user SET ${sing} = ${sing} + 1 WHERE id_user = $1;`,
      [id_user],
    );
    return result.rows[0];
  },

  /**
   * Ban or unban a user.
   */
  async ban_unban(user, is_banned) {
    const result = await database.query(
      "INSERT INTO public.user ( id_user, first_name, last_name, username, is_banned) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id_user) DO UPDATE SET first_name = $2, last_name = $3, username = $4, is_banned = $5 RETURNING * ;",
      [user.id_user, user.first_name, user.last_name, user.username, is_banned],
    );
    return result.rows[0].is_banned;
  },
};
