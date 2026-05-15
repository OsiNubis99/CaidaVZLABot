/**
 * Display icons for the 10 cantos. These are emoji-only so they render
 * identically in inline-query titles, inline buttons and chat messages
 * without any extra upload step.
 */
const ICONS = {
  Ronda: "🃏",
  Chiguire: "🦫",
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

// Public Twemoji raster for inline-result thumbnails. Telegram fetches
// these by URL and displays them in the picker. Hosted on jsDelivr
// from the maintained jdecked/twemoji repo.
const THUMBS = {
  Ronda:        "https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/72x72/1f0cf.png",
  Chiguire:     "https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/72x72/1f9ab.png",
  Patrulla:     "https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/72x72/1f693.png",
  "Vigía":      "https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/72x72/1f441.png",
  Vigia:        "https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/72x72/1f441.png",
  Registro:     "https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/72x72/1f4cb.png",
  Maguaro:      "https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/72x72/1f985.png",
  Registrico:   "https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/72x72/1f5d2.png",
  "Casa Chica": "https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/72x72/1f3e0.png",
  "Casa Grande":"https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/72x72/1f3db.png",
  Trivilin:     "https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/72x72/1f3ba.png",
};

function thumb(name) {
  return THUMBS[name] || null;
}

module.exports = { icon, withIcon, thumb, ICONS, THUMBS };
