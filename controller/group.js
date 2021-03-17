const database = require("../config/db");
var result;

module.exports = {
  /**
   * Add a new Group to the database. If it's already then update the group name.
   * @param {*} group - Group element to be pushed.
   * @returns The complete group from database.
   */
  async add(group) {
    result = await database.query(
      "INSERT INTO public.group ( id_group, name ) VALUES ($1,$2) ON CONFLICT (id_group) DO UPDATE SET name = $2 RETURNING * ;",
      [group.id, group.title]
    );
    return result.rows[0];
  },

  /**
   * Set all configs from new_configs to one group.
   * @param {*} group_id - The Id of the group to be updated.
   * @param {*} new_configs - Game_mode element with all configs.
   * @returns The complete group from database.
   */
  async update(group_id, new_configs) {
    result = await database.query(
      "UPDATE public.group SET game_mode = $2, points = $3, type = $4, caida_continua = $5, mata_canto = $6, mata_mesa = $7, mesa = $8, caida = $9, ronda = $10, chiguire = $11, patrulla = $12, vigia = $13, registro = $14, maguaro = $15, registrico = $16, casa_chica = $17, casa_grande = $18, trivilin = $19 WHERE id_group = $1 RETURNING *;",
      [
        group_id,
        new_configs.game_mode,
        new_configs.points,
        new_configs.type,
        new_configs.caida_continua,
        new_configs.mata_canto,
        new_configs.mata_mesa,
        new_configs.mesa,
        new_configs.caida,
        new_configs.ronda,
        new_configs.chiguire,
        new_configs.patrulla,
        new_configs.vigia,
        new_configs.registro,
        new_configs.maguaro,
        new_configs.registrico,
        new_configs.casa_chica,
        new_configs.casa_grande,
        new_configs.trivilin,
      ]
    );
    return result.rows;
  },

  /**
   * @returns All Group from the database.
   */
  async list() {
    result = await database.query("SELECT * FROM public.group;");
    return result.rows;
  },

  /**
   * @param {*} id_group - The Id of the group to be deleted
   * @returns The deleted group.
   */
  async remove(id_group) {
    result = await database.query(
      "DELETE FROM public.group WHERE id_group = $1;",
      [id_group]
    );
    return result.rows;
  },
};
