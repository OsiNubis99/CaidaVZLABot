// Lightweight i18n for the player-facing dashboard. Locale comes from the
// Telegram user's language_code (es/en/pt); anything else falls back to es.
// No library — a flat per-locale dictionary + a tiny t() with {param} interp.
import { getWebApp } from "./telegram";
import { DICT, type Dict } from "./i18n.dict";

export type Locale = "es" | "en" | "pt";

function detectLocale(): Locale {
  const lc = getWebApp()?.initDataUnsafe?.user?.language_code || "";
  const base = lc.slice(0, 2).toLowerCase();
  if (base === "en") return "en";
  if (base === "pt") return "pt";
  return "es";
}

// Resolved once per session — language_code doesn't change mid-session.
const locale: Locale = detectLocale();

export function getLocale(): Locale {
  return locale;
}

/**
 * Translate a key for the current locale. Falls back to es, then to the key
 * itself. `{name}`-style placeholders are replaced from `params`.
 */
export function t(key: keyof Dict, params?: Record<string, string | number>): string {
  let s = DICT[locale][key] ?? DICT.es[key] ?? String(key);
  if (params) {
    for (const k of Object.keys(params)) {
      s = s.replace(new RegExp(`\\{${k}\\}`, "g"), String(params[k]));
    }
  }
  return s;
}
