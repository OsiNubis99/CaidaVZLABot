if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const admin_ids = (process.env.ADMIN_USER_IDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

module.exports = {
  bd_url: process.env.POSTGRESQL_URL,
  pgssl: process.env.PGSSL === "true",
  token: process.env.TELEGRAM_TOKEN,
  version: process.env.npm_package_version,
  name: process.env.npm_package_name,
  port: process.env.PORT || 3000,
  log_level: process.env.LOG_LEVEL || "info",
  admin_ids,
  stats_token: process.env.STATS_TOKEN || "",
  // Admin dashboard (Telegram Web App). Auth uses HMAC of initData
  // against the bot's TELEGRAM_TOKEN — no separate JWT secret needed.
  // _BASE_URL is the public URL passed to setChatMenuButton; _PATH is
  // where the Express app mounts internally. They must agree (nginx
  // proxies the same prefix straight through, no rewrites).
  dashboard_base_url: (process.env.DASHBOARD_BASE_URL || "").replace(/\/+$/, ""),
  dashboard_path: (() => {
    let p = process.env.DASHBOARD_PATH || "/dashboard";
    if (!p.startsWith("/")) p = "/" + p;
    return p.replace(/\/+$/, "") || "/dashboard";
  })(),
};
