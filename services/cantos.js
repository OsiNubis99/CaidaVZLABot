/**
 * Display icons for the 10 cantos. These are emoji-only so they render
 * identically in inline-query titles, inline buttons and chat messages
 * without any extra upload step.
 */
const ICONS = {
  Ronda: "🃏",
  Chiguire: "🐗",
  Patrulla: "🚓",
  "Vigía": "👁",
  Vigia: "👁",
  Registro: "📋",
  Maguaro: "🦅",
  Registrico: "🗒",
  "Casa Chica": "🏠",
  "Casa Grande": "🏛",
  Trivilin: "🎺",
  "No cantó": "🤐",
};

function icon(name) {
  return ICONS[name] || "🎵";
}

function withIcon(name) {
  return `${icon(name)} ${name}`;
}

module.exports = { icon, withIcon, ICONS };
