/**
 * Admin/user dashboard HTTP surface — Telegram Web App.
 *
 * Auth: cada request lleva `X-Telegram-Init-Data` (lo agrega la SPA
 * desde `window.Telegram.WebApp.initData`). El middleware verifica el
 * HMAC contra el bot token y emite el rol.
 *
 *   USER-tier (cualquier user de Telegram con initData válido):
 *     GET  /api/me                       perfil + stats personales + role
 *     POST /api/me/notify                { value: bool }  notify_on_turn
 *     GET  /api/leaderboard?limit        top global
 *     GET  /api/groups/public            grupos públicos con link
 *
 *   ADMIN-tier (además, id en ADMIN_USER_IDS):
 *     GET  /api/groups                   lista paginada (todos)
 *     GET  /api/groups/:id               detalle (raw)
 *     POST /api/groups/:id/public        { value: bool }
 *     POST /api/groups/:id/banned        { value: bool }
 *     POST /api/groups/:id/paid          { months: int }
 *     POST /api/groups/:id/rename        { name: string }
 *     DEL  /api/groups/:id
 *     GET  /api/users                    lista paginada
 *     GET  /api/users/:id                detalle (raw)
 *     POST /api/users/:id/banned         { value: bool }
 *
 * Static SPA: pasa por `requireAuth` para no exponerla a curl anónimo;
 * Telegram Web Apps siempre llevan initData en el primer render.
 */
const path = require("path");
const express = require("express");
const env = require("../config/env");
const logger = require("../config/logger");
const { GroupController, UserController } = require("../database");
const auth = require("./dashboardAuth");

const PUBLIC_DIR = path.join(__dirname, "..", "public", "dashboard");
const CARDS_DIR = path.join(__dirname, "..", "public", "cards");

function clampPage(v) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function clampPageSize(v, def = 25, max = 100) {
  const n = parseInt(v, 10);
  if (!Number.isFinite(n) || n <= 0) return def;
  return Math.min(n, max);
}

function asBool(v) {
  return v === true || v === "true" || v === 1 || v === "1";
}

/**
 * Project a public-facing copy of a user row.
 * Strips nothing right now but keeps a single funnel so we can scrub
 * fields if we ever add anything private.
 */
function projectUser(u) {
  if (!u) return null;
  return u;
}

function build(bot) {
  const router = express.Router();

  // Static SPA — login.html is the only fully public file; everything
  // else inside the SPA is functionally useless without a valid
  // initData header anyway, but we still gate at the HTML level so
  // browsers visiting the URL outside Telegram get a 401 + the
  // "open me in Telegram" page.
  router.get("/login.html", (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, "login.html"));
  });

  // Real Spanish-deck card images (sliced from the deck at build time).
  // Served PUBLIC and unauthenticated on purpose: <img> tags can't send
  // the X-Telegram-Init-Data header, and these are just game art, not data.
  // Long cache — the files are immutable per deploy.
  router.use(
    "/cards",
    express.static(CARDS_DIR, {
      maxAge: "7d",
      immutable: true,
      index: false,
    }),
  );

  router.use("/api", auth.requireAuth);

  // ─── USER tier ──────────────────────────────────────────────────────
  router.get("/api/me", async (req, res) => {
    try {
      const u = await UserController.getOneById(req.tgUser.id);
      res.json({
        role: req.role,
        telegram: req.tgUser,
        user: projectUser(u), // null if the user has never registered (never /unirse'd)
      });
    } catch (err) {
      logger.error({ err: err.message }, "dashboard /api/me failed");
      res.status(500).json({ error: "internal" });
    }
  });

  router.post("/api/me/notify", async (req, res) => {
    try {
      await UserController.setNotifyOnTurn(req.tgUser.id, asBool(req.body.value));
      const flag = await UserController.getNotifyOnTurn(req.tgUser.id);
      res.json({ notify_on_turn: flag });
    } catch (err) {
      logger.error({ err: err.message }, "dashboard /api/me/notify failed");
      res.status(500).json({ error: "internal" });
    }
  });

  router.get("/api/leaderboard", async (req, res) => {
    try {
      const limit = clampPageSize(req.query.limit, 25, 100);
      const rows = await UserController.top(limit);
      res.json({ rows, limit });
    } catch (err) {
      logger.error({ err: err.message }, "dashboard /api/leaderboard failed");
      res.status(500).json({ error: "internal" });
    }
  });

  router.get("/api/groups/public", async (req, res) => {
    try {
      const groups = await GroupController.listPublic();
      // Try to attach invite link, best-effort. Failure here is
      // common (bot not admin, group private, etc.) — we just omit.
      const rows = await Promise.all(
        groups.map(async (g) => {
          let invite = null;
          try {
            invite = await bot.exportChatInviteLink(g.id_group);
          } catch {
            /* swallow — surface as null */
          }
          return {
            id_group: g.id_group,
            name: g.name,
            games_played: g.games_played || 0,
            invite,
          };
        }),
      );
      res.json({ rows });
    } catch (err) {
      logger.error({ err: err.message }, "dashboard /api/groups/public failed");
      res.status(500).json({ error: "internal" });
    }
  });

  // ─── ADMIN tier ─────────────────────────────────────────────────────
  // Note: requireAdmin runs AFTER requireAuth (router.use above), so
  // req.tgUser + req.role are already populated.
  router.use("/api/groups", auth.requireAdmin);
  // /api/groups/public was already handled above, so the requireAdmin
  // gate applies to everything else.

  router.get("/api/groups", async (req, res) => {
    try {
      const result = await GroupController.listPaged({
        page: clampPage(req.query.page),
        pageSize: clampPageSize(req.query.pageSize),
        sort: req.query.sort || "name",
        q: req.query.q || "",
      });
      res.json(result);
    } catch (err) {
      logger.error({ err: err.message }, "dashboard /api/groups failed");
      res.status(500).json({ error: "internal" });
    }
  });

  router.get("/api/groups/:id", async (req, res) => {
    try {
      const g = await GroupController.getOneByIdRaw(req.params.id);
      if (!g) return res.status(404).json({ error: "not_found" });
      res.json(g);
    } catch (err) {
      logger.error({ err: err.message }, "dashboard /api/groups/:id failed");
      res.status(500).json({ error: "internal" });
    }
  });

  router.post("/api/groups/:id/public", async (req, res) => {
    try {
      const g = await GroupController.setPublic(req.params.id, asBool(req.body.value));
      if (!g) return res.status(404).json({ error: "not_found" });
      res.json(g);
    } catch (err) {
      logger.error({ err: err.message }, "dashboard groups/public failed");
      res.status(500).json({ error: "internal" });
    }
  });

  router.post("/api/groups/:id/banned", async (req, res) => {
    try {
      const g = await GroupController.setBanned(req.params.id, asBool(req.body.value));
      if (!g) return res.status(404).json({ error: "not_found" });
      res.json(g);
    } catch (err) {
      logger.error({ err: err.message }, "dashboard groups/banned failed");
      res.status(500).json({ error: "internal" });
    }
  });

  router.post("/api/groups/:id/paid", async (req, res) => {
    const months = parseInt(req.body.months, 10);
    if (!Number.isInteger(months) || months <= 0 || months > 120) {
      return res.status(400).json({ error: "invalid_months" });
    }
    try {
      const g = await GroupController.paid(req.params.id, months);
      if (!g) return res.status(404).json({ error: "not_found" });
      res.json(g);
    } catch (err) {
      logger.error({ err: err.message }, "dashboard groups/paid failed");
      res.status(500).json({ error: "internal" });
    }
  });

  router.post("/api/groups/:id/rename", async (req, res) => {
    const name = String(req.body.name || "").trim();
    if (!name || name.length > 200) {
      return res.status(400).json({ error: "invalid_name" });
    }
    try {
      const g = await GroupController.rename(req.params.id, name);
      if (!g) return res.status(404).json({ error: "not_found" });
      res.json(g);
    } catch (err) {
      logger.error({ err: err.message }, "dashboard groups/rename failed");
      res.status(500).json({ error: "internal" });
    }
  });

  router.delete("/api/groups/:id", async (req, res) => {
    try {
      await GroupController.remove(req.params.id);
      res.json({ ok: true });
    } catch (err) {
      logger.error({ err: err.message }, "dashboard groups DELETE failed");
      res.status(500).json({ error: "internal" });
    }
  });

  router.use("/api/users", auth.requireAdmin);

  router.get("/api/users", async (req, res) => {
    try {
      const result = await UserController.listPaged({
        page: clampPage(req.query.page),
        pageSize: clampPageSize(req.query.pageSize),
        sort: req.query.sort || "name",
        q: req.query.q || "",
      });
      res.json(result);
    } catch (err) {
      logger.error({ err: err.message }, "dashboard /api/users failed");
      res.status(500).json({ error: "internal" });
    }
  });

  router.get("/api/users/:id", async (req, res) => {
    try {
      const u = await UserController.getOneById(req.params.id);
      if (!u) return res.status(404).json({ error: "not_found" });
      res.json(u);
    } catch (err) {
      logger.error({ err: err.message }, "dashboard /api/users/:id failed");
      res.status(500).json({ error: "internal" });
    }
  });

  router.post("/api/users/:id/banned", async (req, res) => {
    // Bots are virtual users — banning them has no effect (the in-memory
    // join check uses cpu_<chatId>_<slot>, not cpu_<difficulty>) and is
    // confusing to expose in the UI. Reject explicitly so a stale frontend
    // can't accidentally toggle them.
    if (String(req.params.id).startsWith("cpu_")) {
      return res.status(400).json({ error: "cannot_ban_cpu" });
    }
    try {
      const u = await UserController.setBanned(req.params.id, asBool(req.body.value));
      if (!u) return res.status(404).json({ error: "not_found" });
      res.json(u);
    } catch (err) {
      logger.error({ err: err.message }, "dashboard users/banned failed");
      res.status(500).json({ error: "internal" });
    }
  });

  // Static SPA. Anyone landing here without initData will get 401 from
  // the API on first fetch, and the SPA shows a "open me in Telegram"
  // banner. We don't gate the static files themselves so the SPA can
  // render and surface the proper error UX.
  router.use(express.static(PUBLIC_DIR, { index: "index.html" }));

  return router;
}

module.exports = { build };
