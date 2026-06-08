/**
 * Render the /stats dashboard as a single HTML page.
 * No build step. Inline CSS only.
 */

function escapeHtml(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function kpi(label, value) {
  return `<div class="kpi"><div class="v">${escapeHtml(value)}</div><div class="l">${escapeHtml(label)}</div></div>`;
}

function topPlayersTable(rows) {
  if (!rows || rows.length === 0) {
    return `<p class="empty">Aún no hay jugadores con partidas terminadas.</p>`;
  }
  const trs = rows
    .map((u, i) => {
      const total = u.win || 0;
      const rate = u.finished > 0 ? Math.round((total / u.finished) * 100) : 0;
      return `<tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(u.first_name || "")}${u.username ? " <span class='handle'>@" + escapeHtml(u.username) + "</span>" : ""}</td>
        <td class="num">${total}</td>
        <td class="num">${u.finished || 0}</td>
        <td class="num">${rate}%</td>
        <td class="num">${u.caida || 0}</td>
      </tr>`;
    })
    .join("");
  return `<table class="t">
    <thead><tr><th>#</th><th>Jugador</th><th class="num">Wins</th><th class="num">Partidas</th><th class="num">Rate</th><th class="num">Caídas</th></tr></thead>
    <tbody>${trs}</tbody>
  </table>`;
}

function eventsTable(rows) {
  if (!rows || rows.length === 0) {
    return `<p class="empty">Sin eventos en las últimas 24h.</p>`;
  }
  const trs = rows
    .map((r) => `<tr><td>${escapeHtml(r.event_type)}</td><td class="num">${r.c}</td></tr>`)
    .join("");
  return `<table class="t">
    <thead><tr><th>Evento</th><th class="num">Cuenta</th></tr></thead>
    <tbody>${trs}</tbody>
  </table>`;
}

function cardsBar(boot, total) {
  const pct = total > 0 ? Math.min(100, Math.round((boot / total) * 100)) : 0;
  return `<div class="bar"><div class="fill" style="width:${pct}%"></div></div>
    <div class="bar-label">${boot} / ${total} cartas en caché Telegram (${pct}%)</div>`;
}

function render(data, opts = {}) {
  const botName = opts.botName || "CaidaVZLABot";
  const version = opts.version || "";
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="referrer" content="no-referrer">
<meta http-equiv="refresh" content="60">
<title>${escapeHtml(botName)} — stats</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
         background: #0f1115; color: #e8eaed; padding: 24px; }
  h1 { margin: 0 0 4px; font-size: 22px; color: #f5a623; }
  .sub { color: #9aa0a6; font-size: 12px; margin-bottom: 24px; }
  .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 12px; margin-bottom: 24px; }
  .kpi { background: #1a1d23; padding: 16px; border-radius: 8px; border: 1px solid #25282f; }
  .kpi .v { font-size: 28px; font-weight: 600; color: #f5a623; }
  .kpi .l { font-size: 11px; color: #9aa0a6; text-transform: uppercase; letter-spacing: .04em; margin-top: 4px; }
  h2 { font-size: 16px; margin: 24px 0 12px; color: #e8eaed; border-bottom: 1px solid #25282f; padding-bottom: 6px; }
  table.t { width: 100%; border-collapse: collapse; background: #1a1d23; border-radius: 8px; overflow: hidden; }
  table.t th, table.t td { padding: 10px 12px; border-bottom: 1px solid #25282f; text-align: left; }
  table.t th { background: #20242c; font-weight: 600; font-size: 12px; color: #9aa0a6; text-transform: uppercase; letter-spacing: .04em; }
  table.t td.num, table.t th.num { text-align: right; font-variant-numeric: tabular-nums; }
  .handle { color: #9aa0a6; font-size: 12px; }
  .empty { color: #9aa0a6; font-style: italic; }
  .bar { width: 100%; height: 14px; background: #1a1d23; border-radius: 7px; overflow: hidden; border: 1px solid #25282f; }
  .bar .fill { height: 100%; background: linear-gradient(90deg, #f5a623, #ffce5a); }
  .bar-label { font-size: 12px; color: #9aa0a6; margin-top: 6px; }
</style>
</head>
<body>
  <h1>${escapeHtml(botName)}${version ? " <span class='handle'>v" + escapeHtml(version) + "</span>" : ""}</h1>
  <div class="sub">Actualizado ${escapeHtml(data.now)} · refresca cada 60s</div>

  <div class="kpis">
    ${kpi("Grupos totales", data.groups.total)}
    ${kpi("Públicos", data.groups.public_count)}
    ${kpi("Pagados activos", data.groups.paid_active)}
    ${kpi("Usuarios", data.users.total)}
    ${kpi("Partidas en curso", data.gamesInFlight)}
    ${kpi("Eventos 24h", data.eventsTotal24h)}
  </div>

  <h2>Top 10 jugadores</h2>
  ${topPlayersTable(data.top)}

  <h2>Eventos por tipo (últimas 24h)</h2>
  ${eventsTable(data.eventsByType)}

  <h2>Cache de cartas (bootstrap)</h2>
  ${cardsBar(data.cardsBootstrapped, data.cardsTotal)}
</body>
</html>`;
}

module.exports = { render, escapeHtml };
