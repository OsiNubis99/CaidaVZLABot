/**
 * BotFather-style interactive /configurar menu.
 *
 * Callback data scheme (max 64 bytes):
 *   c:m                        main menu
 *   c:s:<section>              show a section (mode|points|cantos|visuales|system)
 *   c:e:<key>                  show numeric editor for <key>
 *   c:adj:<key>:<delta>        adjust numeric by delta
 *   c:set:<key>:<val>          set enum/single value (gm=game_mode, tp=type, lc=locale)
 *   c:tog:<key>                toggle a boolean (vc, vt, mc)
 *   c:close                    delete the menu message
 */
const Config = require("../class/Config");
const game_modes = require("../lang/game_modes_es");
const { GroupController } = require("../database");
const game = require("./game");
const persistence = require("./persistence");
const logger = require("../config/logger");

// short -> canonical config key (kept short so callback data fits)
const KEY_ALIAS = {
  pts: "points",
  mesa: "mesa",
  caida: "caida",
  ronda: "ronda",
  chig: "chiguire",
  patr: "patrulla",
  vigi: "vigia",
  regi: "registro",
  magu: "maguaro",
  rgto: "registrico",
  ccha: "casa_chica",
  cgra: "casa_grande",
  triv: "trivilin",
  tt: "turn_timeout_seconds",
  vc: "visual_cards",
  vt: "visual_table",
  mc: "mata_canto",
  gm: "game_mode",
  tp: "type",
  lc: "locale",
};

function alias(key) {
  return KEY_ALIAS[key] || key;
}

// numeric ranges + step buttons per field
const NUMERIC_FIELDS = {
  points: { min: 1, max: 100, steps: [-10, -1, 1, 10] },
  mesa: { min: 0, max: 100, steps: [-10, -1, 1, 10] },
  caida: { min: 0, max: 10, steps: [-1, 1] },
  ronda: { min: 0, max: 10, steps: [-1, 1] },
  chiguire: { min: 0, max: 100, steps: [-5, -1, 1, 5] },
  patrulla: { min: 0, max: 100, steps: [-5, -1, 1, 5] },
  vigia: { min: 0, max: 100, steps: [-5, -1, 1, 5] },
  registro: { min: 0, max: 100, steps: [-5, -1, 1, 5] },
  maguaro: { min: 0, max: 100, steps: [-5, -1, 1, 5] },
  registrico: { min: 0, max: 100, steps: [-5, -1, 1, 5] },
  casa_chica: { min: 0, max: 100, steps: [-5, -1, 1, 5] },
  casa_grande: { min: 0, max: 100, steps: [-5, -1, 1, 5] },
  trivilin: { min: 0, max: 100, steps: [-10, -5, -1, 1, 5, 10] },
  turn_timeout_seconds: { min: 0, max: 600, steps: [-30, -10, 10, 30] },
};

const FIELD_LABELS = {
  points: "Puntos hasta",
  mesa: "Mesa limpia",
  caida: "Caída ×",
  ronda: "Ronda ×",
  chiguire: "Chigüire",
  patrulla: "Patrulla",
  vigia: "Vigía",
  registro: "Registro",
  maguaro: "Maguaro",
  registrico: "Registrico",
  casa_chica: "Casa Chica",
  casa_grande: "Casa Grande",
  trivilin: "Trivilín",
  turn_timeout_seconds: "Timeout (s)",
};

const KEY_TO_SHORT = Object.fromEntries(Object.entries(KEY_ALIAS).map(([k, v]) => [v, k]));

function shortFor(key) {
  return KEY_TO_SHORT[key] || key;
}

/**
 * Resolve the current Config for a chat. Uses the in-memory game if
 * present (so edits made before /unirse are still reflected after the
 * first join); otherwise reads the group row from DB and constructs a
 * Config from it.
 */
async function loadConfig(chatId) {
  const g = game.peek(chatId);
  if (g) return { config: g.config, hasGame: true, decksRunning: g.decks > 0 };
  const row = await GroupController.getOneById(chatId);
  if (!row) return null;
  return { config: new Config(row), hasGame: false, decksRunning: false };
}

/**
 * Apply an in-memory mutation to the chat's config and persist.
 * Returns { ok, msg }.
 *
 * @param {Object} opts
 * @param {Boolean} [opts.allowMidGame=false] - When true, the change
 *   is allowed even if a deck is currently in play. Used for rendering
 *   preferences (visual_cards, visual_table, locale) that don't affect
 *   game rules.
 */
async function applyChange(chatId, mutator, opts = {}) {
  const state = await loadConfig(chatId);
  if (!state) return { ok: false, msg: "Grupo no registrado o no público." };
  if (state.decksRunning && !opts.allowMidGame) {
    return { ok: false, msg: "Partida en curso, esa config no se puede cambiar mid-game." };
  }
  const before = { ...state.config };
  const err = mutator(state.config);
  if (err) return { ok: false, msg: err };
  try {
    await GroupController.update(chatId, state.config);
    if (state.hasGame) {
      const fields = {};
      for (const k of Object.keys(state.config)) fields[k] = state.config[k];
      game.refreshConfig(chatId, fields);
      await persistence.save(chatId, game.peek(chatId));
    }
    return { ok: true };
  } catch (err) {
    logger.error({ err: err.message, chatId, before }, "configUI applyChange persist failed");
    return { ok: false, msg: "Error al guardar." };
  }
}

// ---- View builders ----

function fmtBool(v) {
  return v ? "✅ on" : "❌ off";
}

async function mainView(chatId) {
  const state = await loadConfig(chatId);
  if (!state) return notRegisteredView();
  const c = state.config;
  const running = state.decksRunning;
  const lines = [
    "⚙️ *Configuración*",
    "",
    `Modo: *${game_modes[c.game_mode] ? game_modes[c.game_mode].name : "?"}*`,
    `Hasta *${c.points}* pts · Mesa *${c.mesa}* pts · Tipo: *${c.type}*`,
    `Caída ×${c.caida} · Ronda ×${c.ronda} · Mata canto: ${fmtBool(c.mata_canto === "on")}`,
    `Visuales: cartas ${c.visual_cards ? "✅" : "❌"} · mesa ${c.visual_table ? "✅" : "❌"}`,
    `Turno: ${c.turn_timeout_seconds > 0 ? c.turn_timeout_seconds + "s" : "off"} · Idioma: ${c.locale}`,
  ];
  if (running) {
    lines.push("\n_⚠️ Partida en curso — solo se pueden cambiar render + idioma_");
  }
  // Mid-game we hide the game-rule sections (Modo, Puntos & ×, Cantos)
  // because their values can't change while a deck is being played.
  const buttons = [];
  if (!running) {
    buttons.push([
      { text: "🎯 Modo", callback_data: "c:s:mode" },
      { text: "🔢 Puntos & ×", callback_data: "c:s:points" },
    ]);
    buttons.push([
      { text: "🎵 Cantos", callback_data: "c:s:cantos" },
      { text: "🎴 Visuales", callback_data: "c:s:visuales" },
    ]);
  } else {
    buttons.push([{ text: "🎴 Visuales", callback_data: "c:s:visuales" }]);
  }
  buttons.push([
    { text: "⚙️ Sistema", callback_data: "c:s:system" },
    { text: "Cerrar", callback_data: "c:close" },
  ]);
  return {
    message: lines.join("\n"),
    options: {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: buttons },
    },
  };
}

function notRegisteredView() {
  return {
    message:
      "Este grupo no está registrado o pagado. Hablá con un admin del bot " +
      "(/admin) para registrarlo o hacerlo público.",
    options: {},
  };
}

async function modeView(chatId) {
  const state = await loadConfig(chatId);
  if (!state) return notRegisteredView();
  const c = state.config;
  const modes = game_modes.filter((m) => m.game_mode > 0);
  const buttons = modes.map((m) => [
    {
      text: `${c.game_mode === m.game_mode ? "✓ " : ""}${m.name}`,
      callback_data: `c:set:gm:${m.game_mode}`,
    },
  ]);
  buttons.push([
    { text: `Tipo: ${c.type === "individual" ? "✓ individual" : "individual"}`, callback_data: "c:set:tp:i" },
    { text: `${c.type === "parejas" ? "✓ parejas" : "parejas"}`, callback_data: "c:set:tp:p" },
  ]);
  buttons.push([{ text: "⬅️ Volver", callback_data: "c:m" }]);
  return {
    message:
      "🎯 *Modo de juego*\n\n" +
      modes.map((m) => `• *${m.name}*: ${m.description || ""}`).join("\n") +
      `\n\nActual: *${game_modes[c.game_mode] && game_modes[c.game_mode].name}* / *${c.type}*`,
    options: { parse_mode: "Markdown", reply_markup: { inline_keyboard: buttons } },
  };
}

function pointsKeyboard(c) {
  return {
    inline_keyboard: [
      [
        { text: `Puntos: ${c.points}`, callback_data: "c:e:pts" },
        { text: `Mesa: ${c.mesa}`, callback_data: "c:e:mesa" },
      ],
      [
        { text: `Caída ×${c.caida}`, callback_data: "c:e:caida" },
        { text: `Ronda ×${c.ronda}`, callback_data: "c:e:ronda" },
      ],
      [{ text: "⬅️ Volver", callback_data: "c:m" }],
    ],
  };
}

async function pointsView(chatId) {
  const state = await loadConfig(chatId);
  if (!state) return notRegisteredView();
  return {
    message:
      "🔢 *Puntos & multiplicadores*\n\n" +
      `Tocá cada valor para ajustar con −/+ steppers.`,
    options: { parse_mode: "Markdown", reply_markup: pointsKeyboard(state.config) },
  };
}

const CANTOS = ["chiguire", "patrulla", "vigia", "registro", "maguaro", "registrico", "casa_chica", "casa_grande", "trivilin"];

async function cantosView(chatId) {
  const state = await loadConfig(chatId);
  if (!state) return notRegisteredView();
  const c = state.config;
  const rows = [];
  for (let i = 0; i < CANTOS.length; i += 2) {
    const r = [];
    r.push({
      text: `${FIELD_LABELS[CANTOS[i]]}: ${c[CANTOS[i]]}`,
      callback_data: `c:e:${shortFor(CANTOS[i])}`,
    });
    if (CANTOS[i + 1]) {
      r.push({
        text: `${FIELD_LABELS[CANTOS[i + 1]]}: ${c[CANTOS[i + 1]]}`,
        callback_data: `c:e:${shortFor(CANTOS[i + 1])}`,
      });
    }
    rows.push(r);
  }
  rows.push([{ text: "⬅️ Volver", callback_data: "c:m" }]);
  return {
    message:
      "🎵 *Cantos*\n\nValor 0 = canto inhabilitado.\n\nTocá un canto para ajustar.",
    options: { parse_mode: "Markdown", reply_markup: { inline_keyboard: rows } },
  };
}

async function visualesView(chatId) {
  const state = await loadConfig(chatId);
  if (!state) return notRegisteredView();
  const c = state.config;
  const running = state.decksRunning;
  const lines = [
    "🎴 *Visuales*",
    "",
    `Cartas con imagen: ${fmtBool(c.visual_cards)}`,
    `Mesa con imagen: ${fmtBool(c.visual_table)}`,
  ];
  if (!running) {
    lines.push(`Mata canto: ${fmtBool(c.mata_canto === "on")}`);
  }
  const rows = [
    [{ text: `Cartas: ${fmtBool(c.visual_cards)} (toggle)`, callback_data: "c:tog:vc" }],
    [{ text: `Mesa: ${fmtBool(c.visual_table)} (toggle)`, callback_data: "c:tog:vt" }],
  ];
  // mata_canto is a game rule (affects scoring), so it can only be
  // toggled when no deck is in play. Hide the row mid-game.
  if (!running) {
    rows.push([
      {
        text: `Mata canto: ${fmtBool(c.mata_canto === "on")} (toggle)`,
        callback_data: "c:tog:mc",
      },
    ]);
  }
  rows.push([{ text: "⬅️ Volver", callback_data: "c:m" }]);
  return {
    message: lines.join("\n"),
    options: { parse_mode: "Markdown", reply_markup: { inline_keyboard: rows } },
  };
}

async function systemView(chatId) {
  const state = await loadConfig(chatId);
  if (!state) return notRegisteredView();
  const c = state.config;
  return {
    message:
      "⚙️ *Sistema*\n\n" +
      `Timeout por turno: *${c.turn_timeout_seconds > 0 ? c.turn_timeout_seconds + "s" : "off"}*\n` +
      `Idioma: *${c.locale}*\n\n` +
      `_Idioma cambia el bot. Solo es está completamente traducido; en/pt parcial._`,
    options: {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: `Timeout: ${c.turn_timeout_seconds}s`, callback_data: "c:e:tt" }],
          [
            { text: `${c.locale === "es" ? "✓ es" : "es"}`, callback_data: "c:set:lc:es" },
            { text: `${c.locale === "en" ? "✓ en" : "en"}`, callback_data: "c:set:lc:en" },
            { text: `${c.locale === "pt" ? "✓ pt" : "pt"}`, callback_data: "c:set:lc:pt" },
          ],
          [{ text: "⬅️ Volver", callback_data: "c:m" }],
        ],
      },
    },
  };
}

async function numericEditView(chatId, shortKey) {
  const key = alias(shortKey);
  const cfg = NUMERIC_FIELDS[key];
  if (!cfg) return mainView(chatId);
  const state = await loadConfig(chatId);
  if (!state) return notRegisteredView();
  const value = state.config[key];
  const label = FIELD_LABELS[key] || key;
  const stepRow = cfg.steps.map((s) => ({
    text: (s > 0 ? "+" : "") + s,
    callback_data: `c:adj:${shortKey}:${s}`,
  }));
  const parentSection = parentForKey(key);
  return {
    message: `*${label}*\nValor actual: *${value}* (rango ${cfg.min}–${cfg.max})`,
    options: {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          stepRow,
          [{ text: "⬅️ Volver", callback_data: `c:s:${parentSection}` }],
        ],
      },
    },
  };
}

function parentForKey(key) {
  if (["points", "mesa", "caida", "ronda"].includes(key)) return "points";
  if (CANTOS.includes(key)) return "cantos";
  if (["turn_timeout_seconds"].includes(key)) return "system";
  return "m";
}

// ---- Dispatcher ----

async function dispatch(chatId, data) {
  const parts = data.split(":");
  // parts[0] === "c"
  const action = parts[1];
  if (action === "m") return mainView(chatId);
  if (action === "close") return { close: true };
  if (action === "s") {
    switch (parts[2]) {
      case "mode": return modeView(chatId);
      case "points": return pointsView(chatId);
      case "cantos": return cantosView(chatId);
      case "visuales": return visualesView(chatId);
      case "system": return systemView(chatId);
    }
    return mainView(chatId);
  }
  if (action === "e") return numericEditView(chatId, parts[2]);
  if (action === "adj") {
    const key = alias(parts[2]);
    const delta = parseInt(parts[3], 10);
    const cfg = NUMERIC_FIELDS[key];
    if (!cfg) return mainView(chatId);
    // turn_timeout is render-only; everything else is a game rule.
    const allowMidGame = key === "turn_timeout_seconds";
    const result = await applyChange(
      chatId,
      (config) => {
        const newVal = Math.max(cfg.min, Math.min(cfg.max, (config[key] || 0) + delta));
        config[key] = newVal;
        const validateKey = key === "turn_timeout_seconds" ? "turn_timeout" : key;
        const e = config.is_not_ok(validateKey, newVal);
        if (e) return e;
        return null;
      },
      { allowMidGame },
    );
    const view = await numericEditView(chatId, parts[2]);
    if (!result.ok) view.alert = result.msg;
    return view;
  }
  if (action === "set") {
    const shortKey = parts[2];
    const value = parts[3];
    const key = alias(shortKey);
    let returnView;
    let result;
    if (key === "game_mode") {
      returnView = modeView;
      result = await applyChange(chatId, (config) => {
        config.set_game_mode(parseInt(value, 10));
        return null;
      });
    } else if (key === "type") {
      returnView = modeView;
      const expanded = value === "p" ? "parejas" : "individual";
      result = await applyChange(chatId, (config) => config.is_not_ok("type", expanded));
    } else if (key === "locale") {
      returnView = systemView;
      // Locale is a rendering preference; safe to change mid-game.
      result = await applyChange(chatId, (config) => config.is_not_ok("locale", value), {
        allowMidGame: true,
      });
    } else {
      return mainView(chatId);
    }
    const view = await returnView(chatId);
    if (result && !result.ok) view.alert = result.msg;
    return view;
  }
  if (action === "tog") {
    const shortKey = parts[2];
    const key = alias(shortKey);
    // visual_cards/visual_table are render-only and safe mid-game.
    // mata_canto changes scoring so it requires decks==0.
    const allowMidGame = key === "visual_cards" || key === "visual_table";
    const result = await applyChange(chatId, (config) => {
      if (key === "visual_cards") config.visual_cards = !config.visual_cards;
      else if (key === "visual_table") config.visual_table = !config.visual_table;
      else if (key === "mata_canto") config.mata_canto = config.mata_canto === "on" ? "off" : "on";
      else return "Toggle no soportado";
      return null;
    }, { allowMidGame });
    const view = await visualesView(chatId);
    if (!result.ok) view.alert = result.msg;
    return view;
  }
  return mainView(chatId);
}

module.exports = { mainView, dispatch, loadConfig };
