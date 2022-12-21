if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

module.exports = {
  bd_url: process.env.POSTGRESQL_URL, //Required DB_uri
  token: process.env.TELEGRAM_TOKEN, //Required Token
  version: process.env.npm_package_version,
  name: process.env.npm_package_name,
  port: process.env.PORT || 3000,
};
