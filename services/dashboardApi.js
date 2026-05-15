/**
 * Admin dashboard HTTP surface.
 *
 *   GET  /dashboard/auth?token=<magic>      exchange magic for session cookie
 *   POST /dashboard/api/logout              clear session cookie
 *   GET  /dashboard/api/me                  who am I (admin id)
 *   GET  /dashboard/api/groups              list paged groups
 *   GET  /dashboard/api/groups/:id          group detail (raw row)
 *   POST /dashboard/api/groups/:id/public   { value: bool }
 *   POST /dashboard/api/groups/:id/banned   { value: bool }
 *   POST /dashboard/api/groups/:id/paid     { months: int }
 *   POST /dashboard/api/groups/:id/rename   { name: string }
 *   DELETE /dashboard/api/groups/:id        remove group row
 *   GET  /dashboard/api/users               list paged users
 *   GET  /dashboard/api/users/:id           user detail (raw row)
 *   POST /dashboard/api/users/:id/banned    { value: bool }
 *
 * Auth: every /api/* and the index HTML go through dashboardAuth.requireSession.
 * /auth is the only public endpoint.
 */
const path = require("path");
const express = require("express");
const env = require("../config/env");
const logger = require("../config/logger");
const { GroupController, UserController } = require("../database");
const auth = require("./dashboardAuth");

const PUBLIC_DIR = path.join(__dirname, "..", "public", "dashboard");

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

function build(bot) {
  const router = express.Router();

  // ─── public: magic-link exchange ────────────────────────────────────
  router.get("/auth", (req, res) => {
    if (!auth.isEnabled()) {
      return res.status(503).send("Dashboard disabled.");
    }
    const adminId = auth.verifyMagic(req.query.token);
    if (!adminId) {
      return res.status(401).send(
        "Magic link is invalid or expired. Run /dashboard_login in the bot to get a new one.",
      );
    }
    auth.setSessionCookie(res, adminId);
    res.redirect(`${env.dashboard_path}/`);
  });

  // ─── static files ──────────────────────────────────────────────────
  // login.html is public so unauth users see a friendly message instead
  // of a redirect loop. Everything else under /dashboard/ requires auth.
  router.get("/login.html", (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, "login.html"));
  });

  router.use("/api", auth.requireSession("api"));
  router.use(auth.requireSession("page"), express.static(PUBLIC_DIR, { index: "index.html" }));

  // ─── API ────────────────────────────────────────────────────────────
  router.get("/api/me", (req, res) => {
    res.json({ admin_id: req.adminId });
  });

  router.post("/api/logout", (req, res) => {
    auth.clearSessionCookie(res);
    res.json({ ok: true });
  });

  // Groups
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

  // Users
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
    try {
      const u = await UserController.setBanned(req.params.id, asBool(req.body.value));
      if (!u) return res.status(404).json({ error: "not_found" });
      res.json(u);
    } catch (err) {
      logger.error({ err: err.message }, "dashboard users/banned failed");
      res.status(500).json({ error: "internal" });
    }
  });

  return router;
}

module.exports = { build };
