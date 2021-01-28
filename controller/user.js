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
  async statics(id_user) {
    result = await database.query(
      "SELECT * FROM public.user where id_user=$1;",
      [id_user]
    );
    return result.rows[0];
  },
  async set_statics(id_user, win, sings, caida, caido) {
    result = await database.query(
      "UPDATE public.user SET finished = finished + 1, win = win + $2, sings = sings + $3 , caida = caida + $4, caido = caido + $5 WHERE id_user = $1;",
      [id_user, win, sings, caida, caido]
    );
    return result.rows[0];
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
