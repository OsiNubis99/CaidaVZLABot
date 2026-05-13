const pino = require("pino");
const env = require("./env");

const logger = pino({
  level: env.log_level,
  base: { app: "caidavzlabot" },
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

module.exports = logger;
