if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

module.exports = {
  url: process.env.HEROKU_SERVER_URL, //Required Server_uri
  bd_url: process.env.HEROKU_POSTGRESQL_URL, //Required DB_uri
  version: process.env.npm_package_version,
  name: process.env.npm_package_name,
  TOKEN: process.env.TELEGRAM_TOKEN, //Required Token
  NODE_ENV: process.env.NODE_ENV || "develop", //Required "production"
  port: process.env.PORT || 3000,
};
