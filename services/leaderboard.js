/**
 * /top — render the global leaderboard.
 */
const { UserController } = require("../database");

function formatRow(idx, u) {
  const name = u.first_name || "(sin nombre)";
  const handle = u.username ? "@" + u.username : "";
  const wins = u.win || 0;
  const rate = u.finished > 0 ? Math.round((wins / u.finished) * 100) : 0;
  const pro = u.beat_pro ? ` · 🏆×${u.beat_pro}` : "";
  return `${idx + 1}. ${name}${handle ? " " + handle : ""} — ${wins} ganados · ${u.finished} partidas · ${rate}%${pro}`;
}

async function topMessage(limit = 10) {
  const rows = await UserController.top(limit);
  if (rows.length === 0) {
    return "Aún no hay jugadores con partidas terminadas.";
  }
  const lines = ["🏆 *Top jugadores*", ""];
  rows.forEach((u, i) => lines.push(formatRow(i, u)));
  return lines.join("\n");
}

module.exports = { topMessage };
