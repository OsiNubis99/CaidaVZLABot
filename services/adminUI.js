/**
 * BotFather-style admin UI for managing groups and users via inline keyboards.
 *
 * Callback data scheme (capped at 64 bytes by Telegram):
 *
 *   Groups (prefix a:)
 *     a:l                  list groups (legacy alias for a:l:1:n)
 *     a:l:<pg>:<sort>      paginated list — sort ∈ {n=name,a=active,p=public}
 *     a:g:<id_group>       group detail
 *     a:tp:<id>            toggle public
 *     a:tb:<id>            toggle banned
 *     a:p:<id>:<m>         extend payment by <m> months
 *     a:rn:<id>            start rename flow
 *     a:dq:<id>            ask delete confirmation
 *     a:dc:<id>            confirm delete
 *     a:noop               no-op (used for visual separators)
 *
 *   Users (prefix au:)
 *     au:l                 list users (legacy alias for au:l:1:n)
 *     au:l:<pg>:<sort>     paginated list — sort ∈ {n=name,w=wins,b=banned}
 *     au:u:<id_user>       user detail
 *     au:tb:<id_user>      toggle banned
 *     au:noop              no-op
 *
 * Group ids look like "-1003919767008" (14 chars), user ids up to 10
 * digits; with prefix + months the longest payload is ~22 chars, well
 * under the 64-byte limit.
 */
const { GroupController, UserController } = require("../database");

const PAGE_SIZE = 10;
const SORT_LABELS = { n: "📛 Nombre", a: "🔥 Activo", p: "🌐 Público" };
const SORT_KEY_FROM_SHORT = { n: "name", a: "active", p: "public" };
const USER_SORT_LABELS = { n: "📛 Nombre", w: "🏆 Wins", b: "🚫 Baneado" };
const USER_SORT_KEY_FROM_SHORT = { n: "name", w: "wins", b: "banned" };

// userId -> { id_group } : users in the middle of a rename flow.
const pendingRenames = new Map();

function fmtDate(d) {
  if (!d) return "—";
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return String(d);
  return date.toISOString().slice(0, 10);
}

function groupRowLabel(g) {
  const flag = g.is_banned
    ? "🚫"
    : g.public
      ? "🌐"
      : g.paid_up_to
        ? "💰"
        : "🔒";
  const played = g.games_played > 0 ? ` (${g.games_played})` : "";
  return `${flag} ${g.name || g.id_group}${played}`;
}

function groupListKeyboard(groups, page, totalPages, sortShort) {
  const rows = groups.map((g) => [
    { text: groupRowLabel(g), callback_data: `a:g:${g.id_group}` },
  ]);
  // Sort selector row — current sort highlighted with a ✓.
  rows.push(
    ["n", "a", "p"].map((s) => ({
      text: (sortShort === s ? "✓ " : "") + SORT_LABELS[s],
      callback_data: `a:l:1:${s}`,
    })),
  );
  // Pagination row only if more than one page.
  if (totalPages > 1) {
    const prev = Math.max(1, page - 1);
    const next = Math.min(totalPages, page + 1);
    rows.push([
      {
        text: page > 1 ? "◀️" : "·",
        callback_data: page > 1 ? `a:l:${prev}:${sortShort}` : "a:noop",
      },
      { text: `${page} / ${totalPages}`, callback_data: "a:noop" },
      {
        text: page < totalPages ? "▶️" : "·",
        callback_data: page < totalPages ? `a:l:${next}:${sortShort}` : "a:noop",
      },
    ]);
  }
  // Jump-to-users tab.
  rows.push([{ text: "👥 Ver usuarios", callback_data: "au:l" }]);
  return { inline_keyboard: rows };
}

function groupDetailKeyboard(g) {
  const id = g.id_group;
  return {
    inline_keyboard: [
      [
        {
          text: g.public ? "🔒 Quitar público" : "🌐 Hacer público",
          callback_data: `a:tp:${id}`,
        },
        {
          text: g.is_banned ? "✅ Desbanear" : "🚫 Banear",
          callback_data: `a:tb:${id}`,
        },
      ],
      [
        { text: "➕ 1 mes", callback_data: `a:p:${id}:1` },
        { text: "➕ 3 meses", callback_data: `a:p:${id}:3` },
        { text: "➕ 6 meses", callback_data: `a:p:${id}:6` },
        { text: "➕ 12 meses", callback_data: `a:p:${id}:12` },
      ],
      [
        { text: "✏️ Renombrar", callback_data: `a:rn:${id}` },
        { text: "🗑️ Eliminar", callback_data: `a:dq:${id}` },
      ],
      [{ text: "⬅️ Volver al listado", callback_data: "a:l" }],
    ],
  };
}

function deleteConfirmKeyboard(id) {
  return {
    inline_keyboard: [
      [{ text: "⚠️ Confirmar eliminar", callback_data: `a:dc:${id}` }],
      [{ text: "Cancelar", callback_data: `a:g:${id}` }],
    ],
  };
}

function formatGroupDetail(g) {
  return (
    `${g.name || "(sin nombre)"}\n` +
    `${g.id_group}\n` +
    `\n` +
    `Público: ${g.public ? "✅ Sí" : "❌ No"}\n` +
    `Baneado: ${g.is_banned ? "🚫 Sí" : "❌ No"}\n` +
    `Pagado hasta: ${fmtDate(g.paid_up_to)}\n` +
    `Pagos: ${g.paid_times || 0}\n` +
    `Partidas jugadas: ${g.games_played || 0}\n` +
    `Creado: ${fmtDate(g.created_at)}`
  );
}

async function listView({ page = 1, sortShort = "n" } = {}) {
  const sort = SORT_KEY_FROM_SHORT[sortShort] || "name";
  const result = await GroupController.listPaged({ page, pageSize: PAGE_SIZE, sort });
  if (result.total === 0) {
    return {
      message: "No hay grupos registrados.",
      options: { reply_markup: { inline_keyboard: [] } },
    };
  }
  const sortLabel = SORT_LABELS[sortShort] || SORT_LABELS.n;
  return {
    message:
      `${result.total} grupo${result.total === 1 ? "" : "s"}` +
      ` · orden: ${sortLabel}` +
      ` · página ${result.page}/${result.totalPages}`,
    options: {
      reply_markup: groupListKeyboard(result.rows, result.page, result.totalPages, sortShort),
    },
  };
}

async function groupDetailView(id_group) {
  const g = await GroupController.getOneByIdRaw(id_group);
  if (!g) {
    return {
      message: "Grupo no encontrado.",
      options: {
        reply_markup: { inline_keyboard: [[{ text: "⬅️ Volver", callback_data: "a:l" }]] },
      },
    };
  }
  return {
    message: formatGroupDetail(g),
    options: { reply_markup: groupDetailKeyboard(g) },
  };
}

async function togglePublic(id_group) {
  const current = await GroupController.getOneByIdRaw(id_group);
  if (!current) return groupDetailView(id_group);
  await GroupController.setPublic(id_group, !current.public);
  return groupDetailView(id_group);
}

async function toggleBanned(id_group) {
  const current = await GroupController.getOneByIdRaw(id_group);
  if (!current) return groupDetailView(id_group);
  await GroupController.setBanned(id_group, !current.is_banned);
  return groupDetailView(id_group);
}

async function extendPayment(id_group, months) {
  const m = parseInt(months, 10);
  if (!Number.isInteger(m) || m <= 0 || m > 120) return groupDetailView(id_group);
  await GroupController.paid(id_group, m);
  return groupDetailView(id_group);
}

function renamePromptView(id_group) {
  return {
    message:
      `Envía el nuevo nombre para el grupo ${id_group}.\n` +
      `O /cancelar para abortar.`,
    options: {
      reply_markup: {
        inline_keyboard: [[{ text: "Cancelar", callback_data: `a:g:${id_group}` }]],
      },
    },
  };
}

function deletePromptView(id_group) {
  return {
    message: `¿Eliminar grupo ${id_group}?\nEsto solo borra la fila del grupo, no las stats de usuarios.`,
    options: {
      reply_markup: deleteConfirmKeyboard(id_group),
    },
  };
}

async function deleteConfirm(id_group) {
  await GroupController.remove(id_group);
  const list = await listView();
  return {
    ...list,
    message: `Grupo ${id_group} eliminado.\n\n` + list.message,
  };
}

async function applyRename(id_group, newName) {
  await GroupController.rename(id_group, newName);
  return groupDetailView(id_group);
}

function startRename(userId, id_group) {
  pendingRenames.set(String(userId), { id_group });
}

function cancelRename(userId) {
  pendingRenames.delete(String(userId));
}

function getPendingRename(userId) {
  return pendingRenames.get(String(userId));
}

// ─── Users ────────────────────────────────────────────────────────────────

function userDisplayName(u) {
  const parts = [u.first_name, u.last_name].filter(Boolean).join(" ").trim();
  if (parts) return parts;
  if (u.username) return "@" + u.username;
  return String(u.id_user);
}

function userRowLabel(u) {
  const flag = u.is_banned ? "🚫" : "👤";
  const wins = Number(u.win) || 0;
  const customWins = Number(u.win_custom) || 0;
  const totalWins = wins + customWins;
  const winsSuffix = totalWins > 0 ? ` 🏆${totalWins}` : "";
  return `${flag} ${userDisplayName(u)}${winsSuffix}`;
}

function userListKeyboard(users, page, totalPages, sortShort) {
  const rows = users.map((u) => [
    { text: userRowLabel(u), callback_data: `au:u:${u.id_user}` },
  ]);
  // Sort selector row.
  rows.push(
    ["n", "w", "b"].map((s) => ({
      text: (sortShort === s ? "✓ " : "") + USER_SORT_LABELS[s],
      callback_data: `au:l:1:${s}`,
    })),
  );
  // Pagination row only if more than one page.
  if (totalPages > 1) {
    const prev = Math.max(1, page - 1);
    const next = Math.min(totalPages, page + 1);
    rows.push([
      {
        text: page > 1 ? "◀️" : "·",
        callback_data: page > 1 ? `au:l:${prev}:${sortShort}` : "au:noop",
      },
      { text: `${page} / ${totalPages}`, callback_data: "au:noop" },
      {
        text: page < totalPages ? "▶️" : "·",
        callback_data: page < totalPages ? `au:l:${next}:${sortShort}` : "au:noop",
      },
    ]);
  }
  // Jump-to-groups tab.
  rows.push([{ text: "📦 Ver grupos", callback_data: "a:l" }]);
  return { inline_keyboard: rows };
}

function userDetailKeyboard(u) {
  return {
    inline_keyboard: [
      [
        {
          text: u.is_banned ? "✅ Desbanear" : "🚫 Banear",
          callback_data: `au:tb:${u.id_user}`,
        },
      ],
      [{ text: "⬅️ Volver al listado", callback_data: "au:l" }],
    ],
  };
}

function formatUserDetail(u) {
  const handle = u.username ? "@" + u.username : "(sin username)";
  const finished = Number(u.finished) || 0;
  const win = Number(u.win) || 0;
  const winCustom = Number(u.win_custom) || 0;
  const caida = Number(u.caida) || 0;
  const caido = Number(u.caido) || 0;
  return (
    `${userDisplayName(u)}\n` +
    `${handle} · ${u.id_user}\n` +
    `\n` +
    `Baneado: ${u.is_banned ? "🚫 Sí" : "❌ No"}\n` +
    `Partidas: ${finished}\n` +
    `Wins: ${win} · Wins custom: ${winCustom}\n` +
    `Caídas dadas: ${caida} · Caídas recibidas: ${caido}\n` +
    `Notify on turn: ${u.notify_on_turn ? "✅" : "❌"}`
  );
}

async function userListView({ page = 1, sortShort = "n" } = {}) {
  const sort = USER_SORT_KEY_FROM_SHORT[sortShort] || "name";
  const result = await UserController.listPaged({ page, pageSize: PAGE_SIZE, sort });
  if (result.total === 0) {
    return {
      message: "No hay usuarios registrados.",
      options: {
        reply_markup: {
          inline_keyboard: [[{ text: "📦 Ver grupos", callback_data: "a:l" }]],
        },
      },
    };
  }
  const sortLabel = USER_SORT_LABELS[sortShort] || USER_SORT_LABELS.n;
  return {
    message:
      `${result.total} usuario${result.total === 1 ? "" : "s"}` +
      ` · orden: ${sortLabel}` +
      ` · página ${result.page}/${result.totalPages}`,
    options: {
      reply_markup: userListKeyboard(result.rows, result.page, result.totalPages, sortShort),
    },
  };
}

async function userDetailView(id_user) {
  const u = await UserController.getOneById(id_user);
  if (!u) {
    return {
      message: "Usuario no encontrado.",
      options: {
        reply_markup: { inline_keyboard: [[{ text: "⬅️ Volver", callback_data: "au:l" }]] },
      },
    };
  }
  return {
    message: formatUserDetail(u),
    options: { reply_markup: userDetailKeyboard(u) },
  };
}

async function toggleUserBanned(id_user) {
  const current = await UserController.getOneById(id_user);
  if (!current) return userDetailView(id_user);
  await UserController.setBanned(id_user, !current.is_banned);
  return userDetailView(id_user);
}

module.exports = {
  listView,
  groupDetailView,
  togglePublic,
  toggleBanned,
  extendPayment,
  renamePromptView,
  deletePromptView,
  deleteConfirm,
  applyRename,
  startRename,
  cancelRename,
  getPendingRename,
  userListView,
  userDetailView,
  toggleUserBanned,
};
