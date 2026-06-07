/**
 * Whitelist + clamp a config object coming from an untrusted client (the
 * WebApp "Crear mesa" form). Mirrors the bounds the chat `/configurar`
 * command enforces. Unknown keys are dropped; out-of-range numbers are
 * clamped; bad enum values fall back to the Clásico preset by being omitted
 * (GameSession.toConfig merges the result over the preset, so an omitted key
 * keeps its default).
 *
 * @param {Object} raw - Arbitrary client object (may be null/garbage).
 * @returns {Object} A clean partial config with only valid, in-range fields.
 */
function sanitizeConfig(raw) {
  if (!raw || typeof raw !== "object") return {};
  const out = {};

  const num = (key, min, max) => {
    const v = Number(raw[key]);
    if (Number.isFinite(v)) out[key] = Math.min(max, Math.max(min, Math.round(v)));
  };
  const onoff = (key) => {
    if (raw[key] === "on" || raw[key] === "off") out[key] = raw[key];
  };

  num("points", 1, 100);
  num("mesa", 0, 100);

  if (raw.type === "individual" || raw.type === "parejas") out.type = raw.type;

  onoff("caida_continua");
  onoff("mata_canto");
  onoff("mata_mesa");

  // Score multipliers for caída / ronda.
  num("caida", 0, 10);
  num("ronda", 0, 10);

  // Canto values.
  for (const k of [
    "chiguire",
    "patrulla",
    "vigia",
    "registro",
    "maguaro",
    "registrico",
    "casa_chica",
    "casa_grande",
    "trivilin",
  ]) {
    num(k, 0, 100);
  }

  return out;
}

module.exports = { sanitizeConfig };
