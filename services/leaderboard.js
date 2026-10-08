/**
 * /top — render the global leaderboard. Official order: win rate among people
 * with at least MIN_RANKED_GAMES (services/ranking.js); the rest are listed
 * after a divider, without a rank number.
 */
const { UserController } = require("../database");
const ranking = require("./ranking");

function formatRow(label, u) {
  const name = u.first_name || "(sin nombre)";
  const handle = u.username ? "@" + u.username : "";
  const wins = u.win || 0;
  const finished = u.finished || 0;
  const rate = finished > 0 ? Math.round((wins / finished) * 100) : 0;
  const pro = u.beat_pro ? ` · 🏆×${u.beat_pro}` : "";
  return `${label} ${name}${handle ? " " + handle : ""} — ${rate}% · ${wins} ganados · ${finished} partidas${pro}`;
}

/** Rows already come in the official order (UserController.top). */
function renderTop(rows) {
  if (!rows || rows.length === 0) {
    return "Aún no hay jugadores con partidas terminadas.";
  }
  const min = ranking.MIN_RANKED_GAMES;
  const lines = [
    "🏆 *Top jugadores*",
    `_Por % de victorias · mínimo ${min} partidas para el ranking_`,
    "",
  ];
  let rank = 0;
  let divided = false;
  for (const u of rows) {
    if (ranking.qualifies(u.finished)) {
      rank += 1;
      lines.push(formatRow(`${rank}.`, u));
    } else {
      if (!divided) {
        if (rank > 0) lines.push("");
        lines.push(`— Con menos de ${min} partidas —`);
        divided = true;
      }
      lines.push(formatRow("·", u));
    }
  }
  return lines.join("\n");
}

async function topMessage(limit = 10) {
  return renderTop(await UserController.top(limit));
}

module.exports = { topMessage, renderTop };
