const database = require("../config/db");
var result;

module.exports = {
  async add(group) {
    result = await database.query(
      "INSERT INTO public.group ( id_group, name ) VALUES ($1,$2) ON CONFLICT (id_group) DO UPDATE SET name = $2 RETURNING * ;",
      [group.id, group.title]
    );
    return result.rows[0];
  },
  async update(group_id, configs) {
    result = await database.query(
      "UPDATE public.group SET game_mode = $2, points = $3, mode = $4, caida_continua = $5, mata_canto = $6, mata_mesa = $7, mesa = $8, caida = $9, ronda = $10, chiguire = $11, patrulla = $12, vigia = $13, registro = $14, maguaro = $15, registrico = $16, casa_chica = $17, casa_grande = $18, trivilin = $19 WHERE id_group = $1 RETURNING *;",
      [
        group_id,
        configs.game_mode,
        configs.points,
        configs.type,
        configs.caida_continua,
        configs.mata_canto,
        configs.mata_mesa,
        configs.mesa,
        configs.caida,
        configs.ronda,
        configs.chiguire,
        configs.patrulla,
        configs.vigia,
        configs.registro,
        configs.maguaro,
        configs.registrico,
        configs.casa_chica,
        configs.casa_grande,
        configs.trivilin,
      ]
    );
    return result.rows;
  },
  async list() {
    result = await database.query("SELECT * FROM public.group;");
    return result.rows;
  },
  async remove(id_group) {
    result = await database.query(
      "DELETE FROM public.group WHERE id_group = $1;",
      [id_group]
    );
    return result.rows;
  },
};
