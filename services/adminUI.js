/**
 * BotFather-style admin UI for managing groups via inline keyboards.
 *
 * Callback data scheme (capped at 64 bytes by Telegram):
 *   a:l                  list groups
 *   a:g:<id_group>       group detail
 *   a:tp:<id>            toggle public
 *   a:p:<id>:<m>         extend payment by <m> months
 *   a:rn:<id>            start rename flow
 *   a:dq:<id>            ask delete confirmation
 *   a:dc:<id>            confirm delete
 *   a:noop               no-op (used for visual separators)
 *
 * Group ids look like "-1003919767008" (14 chars). With prefix + months
 * the longest payload is ~22 chars, well under the 64-byte limit.
 */
const { GroupController } = require("../database");

// userId -> { id_group } : users in the middle of a rename flow.
const pendingRenames = new Map();

function fmtDate(d) {
  if (!d) return "—";
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return String(d);
  return date.toISOString().slice(0, 10);
}

function groupListKeyboard(groups) {
  const rows = groups.map((g) => [
    {
      text: `${g.public ? "🌐" : g.paid_up_to ? "💰" : "🔒"} ${g.name || g.id_group}`,
      callback_data: `a:g:${g.id_group}`,
    },
  ]);
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
    `*${escapeMd(g.name || "(sin nombre)")}*\n` +
    `\`${g.id_group}\`\n` +
    `\n` +
    `Público: ${g.public ? "✅ Sí" : "❌ No"}\n` +
    `Pagado hasta: ${fmtDate(g.paid_up_to)}\n` +
    `Pagos: ${g.paid_times || 0}\n` +
    `Creado: ${fmtDate(g.created_at)}`
  );
}

function escapeMd(text) {
  return String(text).replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
}

async function listView() {
  const groups = await GroupController.list();
  if (groups.length === 0) {
    return {
      message: "No hay grupos registrados.",
      options: { reply_markup: { inline_keyboard: [] } },
    };
  }
  return {
    message: `Selecciona un grupo *(${groups.length})*:`,
    options: {
      parse_mode: "MarkdownV2",
      reply_markup: groupListKeyboard(groups),
    },
  };
}

async function groupDetailView(id_group) {
  const g = await GroupController.getOneByIdRaw(id_group);
  if (!g) {
    return {
      message: "Grupo no encontrado\\.",
      options: {
        parse_mode: "MarkdownV2",
        reply_markup: { inline_keyboard: [[{ text: "⬅️ Volver", callback_data: "a:l" }]] },
      },
    };
  }
  return {
    message: formatGroupDetail(g),
    options: { parse_mode: "MarkdownV2", reply_markup: groupDetailKeyboard(g) },
  };
}

async function togglePublic(id_group) {
  const current = await GroupController.getOneByIdRaw(id_group);
  if (!current) return groupDetailView(id_group);
  await GroupController.setPublic(id_group, !current.public);
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
      `Envía el nuevo nombre para el grupo \`${escapeMd(id_group)}\`\\.\n` +
      `O /cancelar para abortar\\.`,
    options: {
      parse_mode: "MarkdownV2",
      reply_markup: {
        inline_keyboard: [[{ text: "Cancelar", callback_data: `a:g:${id_group}` }]],
      },
    },
  };
}

function deletePromptView(id_group) {
  return {
    message: `¿Eliminar grupo \`${escapeMd(id_group)}\`?\nEsto solo borra la fila del grupo, no las stats de usuarios\\.`,
    options: {
      parse_mode: "MarkdownV2",
      reply_markup: deleteConfirmKeyboard(id_group),
    },
  };
}

async function deleteConfirm(id_group) {
  await GroupController.remove(id_group);
  const list = await listView();
  return {
    ...list,
    message: `Grupo \`${escapeMd(id_group)}\` eliminado\\.\n\n` + list.message,
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

module.exports = {
  listView,
  groupDetailView,
  togglePublic,
  extendPayment,
  renamePromptView,
  deletePromptView,
  deleteConfirm,
  applyRename,
  startRename,
  cancelRename,
  getPendingRename,
};
