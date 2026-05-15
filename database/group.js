const database = require("../config/db");
const Config = require("../class/Config");
const GroupDTO = require("../class/GroupDTO");

module.exports = {
  /**
   * Add a new Group to the database. If it's already there, update the group name.
   * @param {String} id_group - Group id to be pushed.
   * @param {String} name - Group name to be pushed.
   * @returns {Promise<GroupDTO>} The full group element from database.
   */
  async add(id_group, name) {
    const result = await database.query(
      "INSERT INTO public.group ( id_group, name ) VALUES ($1,$2) ON CONFLICT (id_group) DO UPDATE SET name = $2 RETURNING * ;",
      [id_group, name],
    );
    return result.rows[0];
  },

  /**
   * Extend a group's paid_up_to by N months.
   * @param {String} id_group
   * @param {Number} times - Months to add. Must be a positive integer.
   * @returns {Promise<GroupDTO>}
   */
  async paid(id_group, times) {
    const result = await database.query(
      "UPDATE public.group SET paid_up_to = CURRENT_DATE + ($2::int || ' months')::interval, paid_times = paid_times + $2 WHERE id_group = $1 RETURNING * ;",
      [id_group, times],
    );
    return result.rows[0];
  },

  /**
   * Set a group's public flag.
   * @param {String} id_group
   * @param {Boolean} isPublic
   */
  async setPublic(id_group, isPublic) {
    const result = await database.query(
      "UPDATE public.group SET public = $2 WHERE id_group = $1 RETURNING * ;",
      [id_group, isPublic],
    );
    return result.rows[0];
  },

  /**
   * Rename a group.
   */
  async rename(id_group, name) {
    const result = await database.query(
      "UPDATE public.group SET name = $2 WHERE id_group = $1 RETURNING * ;",
      [id_group, name],
    );
    return result.rows[0];
  },

  /**
   * Return one group if it's eligible to play. The bot is open to all
   * groups now (auto-registered on first /unirse), so the only filter
   * is the explicit ban switch the admin can flip.
   */
  async getOneById(id) {
    const result = await database.query(
      "SELECT * FROM public.group WHERE COALESCE(is_banned, false) = false AND id_group = $1;",
      [id],
    );
    return result.rows[0];
  },

  async setBanned(id_group, banned) {
    const result = await database.query(
      "UPDATE public.group SET is_banned = $2 WHERE id_group = $1 RETURNING * ;",
      [id_group, !!banned],
    );
    return result.rows[0];
  },

  async incrementGamesPlayed(id_group) {
    await database.query(
      "UPDATE public.group SET games_played = COALESCE(games_played, 0) + 1 WHERE id_group = $1",
      [id_group],
    );
  },

  /**
   * Return one group regardless of validity (for admin views).
   */
  async getOneByIdRaw(id) {
    const result = await database.query("SELECT * FROM public.group WHERE id_group = $1;", [id]);
    return result.rows[0];
  },

  /**
   * Set all configs from new_config to one group.
   * @param {String} group_id - The Id of the group to be updated.
   * @param {Config} new_config - New config to be saved.
   * @returns {Promise<GroupDTO>} The full group element from database.
   */
  async update(group_id, new_config) {
    const result = await database.query(
      `UPDATE public.group SET game_mode = $2, points = $3, type = $4,
          caida_continua = $5, mata_canto = $6, mata_mesa = $7, mesa = $8,
          caida = $9, ronda = $10, chiguire = $11, patrulla = $12, vigia = $13,
          registro = $14, maguaro = $15, registrico = $16, casa_chica = $17,
          casa_grande = $18, trivilin = $19, visual_cards = $20,
          visual_table = $21, turn_timeout_seconds = $22, locale = $23,
          audio_effects = $24, max_game_duration_minutes = $25
       WHERE id_group = $1 RETURNING *;`,
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
        new_config.visual_cards !== false,
        new_config.visual_table !== false,
        Number(new_config.turn_timeout_seconds) || 0,
        new_config.locale || "es",
        new_config.audio_effects !== false,
        Number(new_config.max_game_duration_minutes) || 120,
      ],
    );
    return result.rows;
  },

  /**
   * @returns {Promise<Array<GroupDTO>>} All groups in the database.
   */
  async list() {
    const result = await database.query("SELECT * FROM public.group ORDER BY name;");
    return result.rows;
  },

  /**
   * Paginated + sortable + searchable group list for the admin UI.
   *
   * @param {Object} opts
   * @param {number} opts.page       1-indexed
   * @param {number} opts.pageSize   default 10
   * @param {"name"|"active"|"public"} opts.sort
   * @param {string} [opts.q]        ILIKE filter on name or id_group
   * @returns {Promise<{rows:Array, total:number, page:number, pageSize:number, totalPages:number, sort:string}>}
   */
  async listPaged({ page = 1, pageSize = 10, sort = "name", q = "" } = {}) {
    let orderBy;
    switch (sort) {
      case "active":
        orderBy = "COALESCE(games_played, 0) DESC, name ASC";
        break;
      case "public":
        orderBy = "public DESC, name ASC";
        break;
      case "name":
      default:
        orderBy = "name ASC";
        break;
    }
    const offset = Math.max(0, (page - 1) * pageSize);
    const where = [];
    const params = [];
    if (q && q.trim()) {
      params.push(`%${q.trim()}%`);
      where.push(`(name ILIKE $${params.length} OR id_group ILIKE $${params.length})`);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const countResult = await database.query(
      `SELECT COUNT(*)::int AS c FROM public.group ${whereSql}`,
      params,
    );
    const total = countResult.rows[0].c;
    params.push(pageSize, offset);
    const rowsResult = await database.query(
      `SELECT * FROM public.group ${whereSql} ORDER BY ${orderBy} LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return {
      rows: rowsResult.rows,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      sort,
    };
  },

  async listPublic() {
    const result = await database.query(
      "SELECT * FROM public.group WHERE public = true ORDER BY name;",
    );
    return result.rows;
  },

  /**
   * @param {String} id_group
   * @returns {Promise<GroupDTO>}
   */
  async remove(id_group) {
    const result = await database.query("DELETE FROM public.group WHERE id_group = $1;", [
      id_group,
    ]);
    return result.rows;
  },
};
