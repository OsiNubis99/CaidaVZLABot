// Display helpers for the Acompañante (names, op descriptions, positions).
import { t } from "../lib/i18n";
import { DICT, type Dict } from "../lib/i18n.dict";
import type { CantoKey, CompanionErrorPayload, CompanionOp, CompanionState } from "./types";

/** Canto names are proper nouns of the game — identical in every locale. */
export const CANTO_LABEL: Record<CantoKey | "ronda", string> = {
  ronda: "Ronda",
  chiguire: "Chigüire",
  patrulla: "Patrulla",
  vigia: "Vigía",
  registro: "Registro",
  maguaro: "Maguaro",
  registrico: "Registrico",
  casa_chica: "Casa chica",
  casa_grande: "Casa grande",
  trivilin: "Trivilín",
};

/** Grid area per position: 0 bottom, 1 right, 2 top, 3 left. */
export const POS_CLASS = ["bottom", "right", "top", "left"] as const;

/** Card value as the players say it: 1 = any 1–7, 2 Sota, 3 Caballo, 4 Rey. */
export function cardLabel(value: number): string {
  switch (value) {
    case 2:
      return t("real.card.2");
    case 3:
      return t("real.card.3");
    case 4:
      return t("real.card.4");
    default:
      return t("real.card.1");
  }
}

export function opLabel(op: CompanionOp): string {
  const pts = op.points;
  switch (op.kind) {
    case "caida":
      return t("real.op.caida", { card: cardLabel(op.value ?? 1), pts });
    case "canto":
      return op.canto === "ronda"
        ? t("real.op.ronda", { card: cardLabel(op.value ?? 1), pts })
        : t("real.op.canto", { canto: op.canto ? CANTO_LABEL[op.canto] : "?", pts });
    case "mesa":
      return t("real.op.mesa", { pts });
    case "puntos":
      return t("real.op.puntos", { pts });
  }
}

export function seatName(state: CompanionState, position: number): string {
  return state.seats[position]?.name ?? "—";
}

/** "Andrés y Mafeer" for a team, the name for a player. */
export function slotName(state: CompanionState, slot: number): string {
  const s = state.slots.find((x) => x.slot === slot);
  if (!s) return "—";
  const names = s.positions.map((p) => seatName(state, p));
  return names.length === 2 ? t("real.pair", { a: names[0], b: names[1] }) : names.join(", ");
}

export function slotTotal(state: CompanionState, slot: number): number {
  return state.slots.find((x) => x.slot === slot)?.total ?? 0;
}

/** "¡Ganó Andrés!" / "¡Ganaron Andrés y Mafeer!" */
export function wonTitle(state: CompanionState, slot: number): string {
  const pair = (state.slots.find((x) => x.slot === slot)?.positions.length ?? 1) > 1;
  return t(pair ? "real.wonTitlePair" : "real.wonTitle", { name: slotName(state, slot) });
}

/** Server error → localized text when we have one, else the server message. */
export function errorText(err: CompanionErrorPayload): string {
  const key = `real.err.${err.code}` as keyof Dict;
  return key in DICT.es ? t(key) : err.message || err.code;
}
