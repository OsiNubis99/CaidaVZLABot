/**
 * Auth para la Telegram Web App.
 *
 * Telegram inyecta `initData` en `window.Telegram.WebApp.initData` cuando
 * el usuario abre la app desde el botón del menú del bot. El cliente la
 * pasa al backend en el header `X-Telegram-Init-Data` en cada request.
 *
 * Verificación (algoritmo oficial de Telegram):
 *   1. Parsear initData como query-string (URL-encoded)
 *   2. Tomar todos los pares excepto "hash", ordenarlos por key
 *   3. data_check_string = "<k1>=<v1>\n<k2>=<v2>\n..."
 *   4. secret_key  = HMAC_SHA256(key="WebAppData", message=BOT_TOKEN)
 *   5. computed    = HMAC_SHA256(key=secret_key,   message=data_check_string)
 *   6. computed === initData.hash  → válido
 *
 * Aceptamos solo initData con `auth_date` reciente (<= INIT_DATA_TTL).
 *
 * Tres tiers de middleware:
 *   requireAuth  — cualquier user de Telegram con initData válido
 *   requireAdmin — además, su id tiene que estar en ADMIN_USER_IDS
 *   (público sin auth) — no hay endpoints así por ahora
 *
 * No hay sesión persistente: cada request lleva el initData. La WebApp
 * de Telegram refresca el initData internamente, no nos preocupamos.
 */
const crypto = require("crypto");
const env = require("../config/env");

// Telegram sugiere 24h de TTL, pero somos más agresivos — la app le va a
// pegar al server seguido, y si pasa un día sin tocar, mejor pedimos
// reabrir.
const INIT_DATA_TTL_SECONDS = 24 * 60 * 60;
const HEADER_NAME = "x-telegram-init-data";

function isEnabled() {
  return Boolean(env.token && env.dashboard_base_url);
}

function isAdminId(id) {
  return env.admin_ids.includes(String(id));
}

/**
 * Validate initData. Returns the parsed Telegram user object on success
 * (with id/first_name/last_name/username) or null on any failure.
 */
function verifyInitData(initData) {
  if (!initData || typeof initData !== "string") return null;
  if (!env.token) return null;

  let params;
  try {
    params = new URLSearchParams(initData);
  } catch {
    return null;
  }

  const receivedHash = params.get("hash");
  if (!receivedHash) return null;
  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(env.token)
    .digest();
  const computedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  // timingSafeEqual to dodge timing attacks on the comparison.
  const a = Buffer.from(computedHash, "hex");
  const b = Buffer.from(receivedHash, "hex");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  // Freshness check: stale initData (laptop left open for days, etc.)
  // is treated as expired.
  const authDate = parseInt(params.get("auth_date"), 10);
  if (!Number.isFinite(authDate)) return null;
  if (Date.now() / 1000 - authDate > INIT_DATA_TTL_SECONDS) return null;

  let user;
  try {
    user = JSON.parse(params.get("user") || "null");
  } catch {
    return null;
  }
  if (!user || !user.id) return null;
  return user;
}

/**
 * Middleware: any Telegram user with valid initData passes through.
 * Attaches `req.tgUser` and `req.role` ("admin" | "user").
 */
function requireAuth(req, res, next) {
  if (!isEnabled()) {
    return res.status(503).json({ error: "dashboard_disabled" });
  }
  const initData = req.get(HEADER_NAME);
  const user = verifyInitData(initData);
  if (!user) {
    return res.status(401).json({ error: "unauthorized" });
  }
  req.tgUser = user;
  req.role = isAdminId(user.id) ? "admin" : "user";
  next();
}

/**
 * Middleware: admin tier. Use AFTER requireAuth in the chain.
 * (Or standalone — it calls requireAuth internally if req.tgUser missing.)
 */
function requireAdmin(req, res, next) {
  const proceed = () => {
    if (req.role !== "admin") {
      return res.status(403).json({ error: "forbidden" });
    }
    next();
  };
  if (req.tgUser) return proceed();
  requireAuth(req, res, (err) => {
    if (err) return next(err);
    proceed();
  });
}

module.exports = {
  isEnabled,
  isAdminId,
  verifyInitData,
  requireAuth,
  requireAdmin,
  INIT_DATA_TTL_SECONDS,
  HEADER_NAME,
};
