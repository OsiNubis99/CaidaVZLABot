const UserDTO = require("../class/UserDTO");
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
   * @param {UserDTO} user
   * @returns {Promise<UserDTO>}
   */
  async add(user) {
    const result = await database.query(
      "INSERT INTO public.user ( id_user, first_name, last_name, username, is_banned) VALUES ($1,$2,$3,$4,false) ON CONFLICT (id_user) DO UPDATE SET first_name = $2, last_name = $3, username = $4 RETURNING * ;",
      [user.id_user, user.first_name, user.last_name, user.username],
    );
    return result.rows[0];
  },

  /**
   * @returns {Promise<Array<UserDTO>>}
   */
  async list() {
    const result = await database.query("SELECT * FROM public.user;");
    return result.rows;
  },

  /**
   * Record one finished game for a user. `won` is the already-decided ranked
   * outcome (see services/gameStats): increments finished always, win only when
   * `won`. The legacy win/win_custom split is gone — `win` is the single
   * "ganados" counter now.
   * @param {String} id_user
   * @param {{won:boolean, caida:number, caido:number}} delta
   */
  async recordGameStats(id_user, { won, caida, caido }) {
    await database.query(
      `UPDATE public.user
       SET finished = finished + 1,
           win = win + $2,
           caida = caida + $3,
           caido = caido + $4
       WHERE id_user = $1`,
      [id_user, won ? 1 : 0, caida || 0, caido || 0],
    );
  },

  /** Increment the "le ganó al PRO" achievement counter. */
  async incrementBeatPro(id_user) {
    await database.query(
      "UPDATE public.user SET beat_pro = COALESCE(beat_pro, 0) + 1 WHERE id_user = $1",
      [id_user],
    );
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
   * Top players sorted by wins (ganados) then finished games.
   * Only users that have finished at least one game are included.
   * @param {Number} limit
   */
  async top(limit = 10) {
    // caido is required by the dashboard so it can render Caídas
    // recibidas and Caída ratio. Cheap to add — same row, same index.
    const r = await database.query(
      `SELECT id_user, first_name, last_name, username, finished, win, caida, caido, beat_pro
       FROM public.user
       WHERE finished > 0 AND COALESCE(is_banned, false) = false
       ORDER BY win DESC, finished DESC
       LIMIT $1`,
      [limit],
    );
    return r.rows;
  },

  /**
   * Aggregations for the admin "Stats" dashboard tab. One round-trip per
   * dataset; all coerced to plain numbers (pg returns SUM/bigint as strings).
   * Human stats exclude the synthetic CPU rows (id_user LIKE 'cpu%'); real
   * Telegram ids are numeric so they never collide with that prefix.
   * @returns {Promise<{cantos: Object, trivilin: Array, cpu: Array, beatPro: Array}>}
   */
  async stats() {
    const CANTOS = [
      "ronda", "chiguire", "patrulla", "vigia", "registro",
      "maguaro", "registrico", "casa_chica", "casa_grande", "trivilin",
    ];

    const sumSelect = CANTOS.map((c) => `COALESCE(SUM(${c}),0) AS ${c}`).join(", ");
    const cantosR = await database.query(
      `SELECT ${sumSelect} FROM public.user WHERE id_user NOT LIKE 'cpu%'`,
    );
    const row = cantosR.rows[0] || {};
    const cantos = {};
    for (const c of CANTOS) cantos[c] = Number(row[c]) || 0;

    const trivR = await database.query(
      `SELECT id_user, first_name, last_name, username, trivilin
       FROM public.user
       WHERE trivilin > 0 AND id_user NOT LIKE 'cpu%' AND COALESCE(is_banned, false) = false
       ORDER BY trivilin DESC
       LIMIT 10`,
    );
    const trivilin = trivR.rows.map((r) => ({
      name:
        (r.username && "@" + r.username) ||
        [r.first_name, r.last_name].filter(Boolean).join(" ") ||
        String(r.id_user),
      trivilin: Number(r.trivilin) || 0,
    }));

    const cpuR = await database.query(
      `SELECT id_user, first_name, finished, win
       FROM public.user
       WHERE id_user IN ('cpu_easy', 'cpu_medium', 'cpu_pro')
       ORDER BY id_user`,
    );
    const cpu = cpuR.rows.map((r) => {
      const finished = Number(r.finished) || 0;
      const wins = Number(r.win) || 0;
      return {
        id_user: r.id_user,
        label: r.first_name || r.id_user,
        finished,
        wins,
        winRate: finished > 0 ? wins / finished : 0,
      };
    });

    // "Le ganaron al PRO" — humans with the 1v1-vs-cpu_pro achievement.
    const beatR = await database.query(
      `SELECT id_user, first_name, last_name, username, beat_pro
       FROM public.user
       WHERE COALESCE(beat_pro, 0) > 0 AND id_user NOT LIKE 'cpu%'
             AND COALESCE(is_banned, false) = false
       ORDER BY beat_pro DESC
       LIMIT 10`,
    );
    const beatPro = beatR.rows.map((r) => ({
      name:
        (r.username && "@" + r.username) ||
        [r.first_name, r.last_name].filter(Boolean).join(" ") ||
        String(r.id_user),
      beatPro: Number(r.beat_pro) || 0,
    }));

    return { cantos, trivilin, cpu, beatPro };
  },

  /**
   * Set notify_on_turn preference.
   */
  async setNotifyOnTurn(id_user, enabled) {
    await database.query(
      "UPDATE public.user SET notify_on_turn = $2 WHERE id_user = $1",
      [id_user, !!enabled],
    );
  },

  /**
   * Read notify_on_turn for a single user.
   */
  async getNotifyOnTurn(id_user) {
    const r = await database.query(
      "SELECT notify_on_turn FROM public.user WHERE id_user = $1",
      [id_user],
    );
    return r.rows[0] ? !!r.rows[0].notify_on_turn : false;
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

  /**
   * Toggle banned by id only (used by the admin UI).
   */
  async setBanned(id_user, banned) {
    const result = await database.query(
      "UPDATE public.user SET is_banned = $2 WHERE id_user = $1 RETURNING * ;",
      [id_user, !!banned],
    );
    return result.rows[0];
  },

  /**
   * Return one user by id (no filtering — admin views need banned users too).
   */
  async getOneById(id) {
    const result = await database.query(
      "SELECT * FROM public.user WHERE id_user = $1;",
      [id],
    );
    return result.rows[0];
  },

  /**
   * Paginated + sortable + searchable user list for the admin UI.
   *
   * @param {Object} opts
   * @param {number} opts.page       1-indexed
   * @param {number} opts.pageSize   default 10
   * @param {"name"|"wins"|"banned"} opts.sort
   * @param {string} [opts.q]        ILIKE filter on first/last name, username, or id_user
   * @returns {Promise<{rows:Array, total:number, page:number, pageSize:number, totalPages:number, sort:string}>}
   */
  async listPaged({ page = 1, pageSize = 10, sort = "name", q = "" } = {}) {
    let orderBy;
    switch (sort) {
      case "wins":
        orderBy =
          "COALESCE(win, 0) DESC, COALESCE(finished, 0) DESC, first_name ASC";
        break;
      case "banned":
        orderBy = "COALESCE(is_banned, false) DESC, first_name ASC";
        break;
      case "name":
      default:
        orderBy = "first_name ASC, last_name ASC";
        break;
    }
    const offset = Math.max(0, (page - 1) * pageSize);
    const where = [];
    const params = [];
    if (q && q.trim()) {
      params.push(`%${q.trim()}%`);
      const p = `$${params.length}`;
      where.push(
        `(first_name ILIKE ${p} OR last_name ILIKE ${p} OR username ILIKE ${p} OR id_user ILIKE ${p})`,
      );
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const countResult = await database.query(
      `SELECT COUNT(*)::int AS c FROM public.user ${whereSql}`,
      params,
    );
    const total = countResult.rows[0].c;
    params.push(pageSize, offset);
    const rowsResult = await database.query(
      `SELECT * FROM public.user ${whereSql} ORDER BY ${orderBy} LIMIT $${params.length - 1} OFFSET $${params.length}`,
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
};
