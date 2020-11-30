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
  async update(group_id, config, value) {
    result = await database.query(
      "UPDATE public.group SET " +
        config +
        " = $2 WHERE id_group = $1 RETURNING *;",
      [group_id, value]
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
