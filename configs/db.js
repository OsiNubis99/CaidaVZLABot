const { Client } = require("pg");
const client = new Client({
  connectionString: process.env.HEROKU_POSTGRESQL_URL,
  ssl: { rejectUnauthorized: false },
});

client.connect().then(() => {
  console.log("DB connected");
});

module.exports = {
  add_group(group) {
    response = client.query(
      "INSERT INTO public.group ( id_group, name ) VALUES ($1,$2) ON CONFLICT (id_group) DO UPDATE SET name = $2 RETURNING * ;",
      [group.id, group.title]
    );
  },
  add_user(user) {
    response = client.query(
      "INSERT INTO public.user ( id_user, first_name, last_name, username, is_banned) VALUES ($1,$2,$3,$4,false) ON CONFLICT (id_user) DO UPDATE SET first_name = $2, last_name = $3, username = $4 RETURNING * ;",
      [user.id, user.first_name, user.last_name, user.username]
    );
  },
  ban_user(user) {
    response = client.query(
      "UPDATE public.user SET is_banned = true WHERE id_user = $1;",
      [user.id]
    );
  },
  unban_user(user) {
    response = client.query(
      "UPDATE public.user SET is_banned = false WHERE id_user = $1;",
      [user.id]
    );
  },
};
