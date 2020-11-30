const database = require("../config/db");
var result;

module.exports = {
  async add(user) {
    result = await database.query(
      "INSERT INTO public.user ( id_user, first_name, last_name, username, is_banned) VALUES ($1,$2,$3,$4,false) ON CONFLICT (id_user) DO UPDATE SET first_name = $2, last_name = $3, username = $4 RETURNING * ;",
      [user.id, user.first_name, user.last_name, user.username]
    );
    return result.rows[0];
  },
  async list() {
    result = await database.query("SELECT * FROM public.user;");
    return result.rows;
  },
  async ban(user) {
    result = await database.query(
      "INSERT INTO public.user ( id_user, first_name, last_name, username, is_banned) VALUES ($1,$2,$3,$4,true) ON CONFLICT (id_user) DO UPDATE SET first_name = $2, last_name = $3, username = $4, is_banned = true RETURNING * ;",
      [user.id, user.first_name, user.last_name, user.username]
    );
    return result.rows[0];
  },
  async unban(user) {
    result = await database.query(
      "INSERT INTO public.user ( id_user, first_name, last_name, username, is_banned) VALUES ($1,$2,$3,$4,false) ON CONFLICT (id_user) DO UPDATE SET first_name = $2, last_name = $3, username = $4, is_banned = false RETURNING * ;",
      [user.id, user.first_name, user.last_name, user.username]
    );
    return result.rows[0];
  },
};
