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
};
