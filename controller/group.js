const database = require("../configs/db");
var result;

module.exports = {
  add(group) {
    result = database.query(
      "INSERT INTO public.group ( id_group, name ) VALUES ($1,$2) ON CONFLICT (id_group) DO UPDATE SET name = $2 RETURNING * ;",
      [group.id, group.title]
    );
  },
};
