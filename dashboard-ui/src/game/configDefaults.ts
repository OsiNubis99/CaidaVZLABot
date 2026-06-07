import type { GameConfig } from "./types";

/** Clásico preset — mirrors lang/game_modes_es[1]. The create form starts here;
 *  the backend re-applies these defaults for any field the client omits, so this
 *  only needs to seed the form UI. */
export const CLASICO: Required<
  Pick<
    GameConfig,
    | "points"
    | "mesa"
    | "type"
    | "caida_continua"
    | "mata_canto"
    | "mata_mesa"
    | "caida"
    | "ronda"
    | "chiguire"
    | "patrulla"
    | "vigia"
    | "registro"
    | "maguaro"
    | "registrico"
    | "casa_chica"
    | "casa_grande"
    | "trivilin"
  >
> = {
  points: 24,
  mesa: 4,
  type: "individual",
  caida_continua: "off",
  mata_canto: "off",
  mata_mesa: "off",
  caida: 1,
  ronda: 1,
  chiguire: 0,
  patrulla: 6,
  vigia: 7,
  registro: 8,
  maguaro: 9,
  registrico: 10,
  casa_chica: 11,
  casa_grande: 12,
  trivilin: 24,
};

/** A numeric field shown in the "Valores de canto" advanced section. */
export interface CantoField {
  key: keyof typeof CLASICO;
  label: string;
}

export const CANTO_FIELDS: CantoField[] = [
  { key: "chiguire", label: "Chiguire" },
  { key: "patrulla", label: "Patrulla" },
  { key: "vigia", label: "Vigía" },
  { key: "registro", label: "Registro" },
  { key: "maguaro", label: "Maguaro" },
  { key: "registrico", label: "Registrico" },
  { key: "casa_chica", label: "Casa chica" },
  { key: "casa_grande", label: "Casa grande" },
  { key: "trivilin", label: "Trivilín" },
];

/** Build a partial config to send: only the fields that differ from Clásico,
 *  so the payload stays small and the backend keeps its defaults otherwise. */
export function diffFromClasico(cfg: GameConfig): GameConfig {
  const out: GameConfig = {};
  for (const k of Object.keys(CLASICO) as (keyof typeof CLASICO)[]) {
    if (cfg[k] !== undefined && cfg[k] !== CLASICO[k]) out[k] = cfg[k] as never;
  }
  return out;
}

/** One-line human summary of the active rules, for the lobby roster. */
export function configSummary(cfg: GameConfig): string {
  const parts: string[] = [];
  parts.push(`${cfg.points ?? CLASICO.points} pts`);
  parts.push(cfg.type === "parejas" ? "Parejas" : "Individual");
  if (cfg.mata_canto === "on") parts.push("mata-canto");
  if (cfg.mata_mesa === "on") parts.push("mata-mesa");
  if (cfg.caida_continua === "on") parts.push("caída continua");
  if ((cfg.caida ?? 1) !== 1) parts.push(`caída x${cfg.caida}`);
  if ((cfg.ronda ?? 1) !== 1) parts.push(`ronda x${cfg.ronda}`);
  return parts.join(" · ");
}
