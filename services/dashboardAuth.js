/**
 * Admin dashboard auth — Telegram magic-link → JWT cookie.
 *
 * Two token types, both HS256-signed with DASHBOARD_JWT_SECRET:
 *   - "magic" : one-shot, 5 min TTL, embedded in the URL the bot DMs.
 *   - "sess"  : session, 12 h TTL, stored in HttpOnly cookie after the
 *               magic link is exchanged.
 *
 * The session token is *not* a refresh token. When it expires the admin
 * has to run /dashboard_login again. That's fine for a 1-admin tool.
 */
const jwt = require("jsonwebtoken");
const env = require("../config/env");

// Inlined to avoid a circular require: services/admin.js pulls in
// config/server.js which mounts this module.
function isAdminId(id) {
  return env.admin_ids.includes(String(id));
}

const MAGIC_TTL_SECONDS = 5 * 60;
const SESSION_TTL_SECONDS = 12 * 60 * 60;
const COOKIE_NAME = "dash_session";

function isEnabled() {
  return Boolean(env.dashboard_jwt_secret && env.dashboard_base_url);
}

function signMagic(adminId) {
  return jwt.sign(
    { type: "magic", admin_id: String(adminId) },
    env.dashboard_jwt_secret,
    { expiresIn: MAGIC_TTL_SECONDS },
  );
}

function signSession(adminId) {
  return jwt.sign(
    { type: "sess", admin_id: String(adminId) },
    env.dashboard_jwt_secret,
    { expiresIn: SESSION_TTL_SECONDS },
  );
}

/**
 * Verify and consume a magic token. Returns admin_id on success, null on
 * any failure (expired, wrong type, bad signature, not in admin list).
 */
function verifyMagic(token) {
  try {
    const payload = jwt.verify(token, env.dashboard_jwt_secret);
    if (payload.type !== "magic") return null;
    if (!isAdminId(payload.admin_id)) return null;
    return payload.admin_id;
  } catch {
    return null;
  }
}

function verifySession(token) {
  try {
    const payload = jwt.verify(token, env.dashboard_jwt_secret);
    if (payload.type !== "sess") return null;
    if (!isAdminId(payload.admin_id)) return null;
    return payload.admin_id;
  } catch {
    return null;
  }
}

/**
 * Resolve the admin from the session cookie (or null).
 */
function resolveSession(req) {
  if (!isEnabled()) return null;
  const token = req.cookies && req.cookies[COOKIE_NAME];
  if (!token) return null;
  return verifySession(token);
}

/**
 * Express middleware factory. `mode` controls failure behavior:
 *   - "api"  → 401 JSON
 *   - "page" → 302 redirect to login.html
 *
 * Two flavors instead of inspecting req.path because the router mounts
 * each at a different sub-path; `req.path` is relative to that mount,
 * so a single middleware can't tell them apart from req alone.
 */
function requireSession(mode = "page") {
  return function requireSessionMw(req, res, next) {
    if (!isEnabled()) {
      return res.status(503).json({ error: "dashboard_disabled" });
    }
    const adminId = resolveSession(req);
    if (!adminId) {
      if (mode === "api") {
        return res.status(401).json({ error: "unauthorized" });
      }
      return res.redirect(`${env.dashboard_path}/login.html`);
    }
    req.adminId = adminId;
    next();
  };
}

function buildMagicUrl(adminId) {
  const token = signMagic(adminId);
  return `${env.dashboard_base_url}/auth?token=${encodeURIComponent(token)}`;
}

function setSessionCookie(res, adminId) {
  const token = signSession(adminId);
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    maxAge: SESSION_TTL_SECONDS * 1000,
    // Scope to the public path prefix so the cookie is sent on every
    // /dashboard/* (or /caidavzlabot/*) request but not the rest of
    // the site that may share the domain.
    path: env.dashboard_path,
  });
}

function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, { path: env.dashboard_path });
}

module.exports = {
  isEnabled,
  signMagic,
  signSession,
  verifyMagic,
  verifySession,
  requireSession,
  buildMagicUrl,
  setSessionCookie,
  clearSessionCookie,
  COOKIE_NAME,
  MAGIC_TTL_SECONDS,
  SESSION_TTL_SECONDS,
};
