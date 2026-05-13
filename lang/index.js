/**
 * i18n helper. Pick a translation table by locale, falling back to es.
 *
 * Most existing call sites still `require("../lang/es")` directly —
 * migrating them to `getLang(group)` is incremental. New code should
 * prefer `getLang(group)` from the start.
 */
const es = require("./es");
const en = require("./en");
const pt = require("./pt");

const TABLES = { es, en, pt };

/**
 * @param {String|Object|null} groupOrLocale - either a locale string,
 *   a Config object with a .locale field, or a row object with .locale.
 */
function getLang(groupOrLocale) {
  let locale = "es";
  if (typeof groupOrLocale === "string") {
    locale = groupOrLocale;
  } else if (groupOrLocale && typeof groupOrLocale === "object") {
    locale = groupOrLocale.locale || (groupOrLocale.config && groupOrLocale.config.locale) || "es";
  }
  return TABLES[locale] || es;
}

module.exports = { getLang, TABLES };
