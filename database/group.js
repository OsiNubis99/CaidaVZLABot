const database = require("../config/db");
const Config = require("../class/Config");
const Factory_Group = require("../class/Factory_Group");

module.exports = {
  /**
   * Add a new Group to the database. If it's already then update the group name.
   * @param {String} id_group - Group id to be pushed.
   * @param {String} name - Group name to be pushed.
   * @returns {Promise<Factory_Group>} The full group element from database.
   */
  async add(id_group, name) {
    let result = await database.query(
      "INSERT INTO public.group ( id_group, name ) VALUES ($1,$2) ON CONFLICT (id_group) DO UPDATE SET name = $2 RETURNING * ;",
      [id_group, name]
    );
    return result.rows[0];
  },

  /**
   * Add a new Group to the database. If it's already then update the group name.
   * @param {String} id_group - Group id to be pushed.
   * @param {Number} times - Group name to be pushed.
   * @returns {Promise<Factory_Group>} The full group element from database.
   */
  async paid(id_group, times) {
    let result = await database.query(
      "UPDATE public.group SET paid_at = CURRENT_DATE + INTERVAL '$2' MONTH, paid_times = 1 + $2 WHERE id_group = $1 RETURNING *;",
      [id_group, times - 1]
    );
    return result.rows[0];
  },

  /**
   * Return all data of one group
   */
  async getOneById(id) {
    let result = await database.query(
      "SELECT * FROM public.group WHERE (paid_at >= CURRENT_DATE - INTERVAL '1' MONTH OR public = true) AND id_group = $1;",
      [id]
    );
    return result.rows[0];
  },

  /**
   * Set all configs from new_config to one group.
   * @param {String} group_id - The Id of the group to be updated.
   * @param {Config} new_config - New config to be saved.
   * @returns {Promise<Factory_Group>} The full group element from database.
   */
  async update(group_id, new_config) {
    let result = await database.query(
      "UPDATE public.group SET game_mode = $2, points = $3, type = $4, caida_continua = $5, mata_canto = $6, mata_mesa = $7, mesa = $8, caida = $9, ronda = $10, chiguire = $11, patrulla = $12, vigia = $13, registro = $14, maguaro = $15, registrico = $16, casa_chica = $17, casa_grande = $18, trivilin = $19 WHERE id_group = $1 RETURNING *;",
      [
        group_id,
        new_config.game_mode,
        new_config.points,
        new_config.type,
        new_config.caida_continua,
        new_config.mata_canto,
        new_config.mata_mesa,
        new_config.mesa,
        new_config.caida,
        new_config.ronda,
        new_config.chiguire,
        new_config.patrulla,
        new_config.vigia,
        new_config.registro,
        new_config.maguaro,
        new_config.registrico,
        new_config.casa_chica,
        new_config.casa_grande,
        new_config.trivilin,
      ]
    );
    return result.rows;
  },

  /**
   * @returns {Promise<Array<Factory_Group>>} All Groups from the database.
   */
  async list() {
    let result = await database.query("SELECT * FROM public.group;");
    return result.rows;
  },
  async listPublic() {
    let result = await database.query("SELECT * FROM public.group where public = true;");
    return result.rows;
  },

  /**
   * @param {String} id_group - The Id of the group to be deleted
   * @returns {Promise<Factory_Group>} The deleted group.
   */
  async remove(id_group) {
    let result = await database.query(
      "DELETE FROM public.group WHERE id_group = $1;",
      [id_group]
    );
    return result.rows;
  },
};
