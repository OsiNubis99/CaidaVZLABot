import type { UserRow } from "../types";

export function isCpu(u: { id_user?: string } | null | undefined): boolean {
  return !!u?.id_user && u.id_user.startsWith("cpu_");
}

export function displayName(u: {
  first_name?: string;
  last_name?: string;
  username?: string | null;
  id_user?: string;
  id?: number;
}): string {
  const full = [u.first_name, u.last_name].filter(Boolean).join(" ").trim();
  if (full) return full;
  if (u.username) return "@" + u.username;
  return String(u.id_user ?? u.id ?? "");
}

export function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toISOString().slice(0, 10);
}

/**
 * Win rate = (win + win_custom) / finished, as %. Returns null when
 * the user hasn't finished any game yet — let the renderer decide what
 * to show in the no-data state.
 */
export function winRate(u: UserRow): number | null {
  const f = Number(u.finished) || 0;
  if (f <= 0) return null;
  const wins = (Number(u.win) || 0) + (Number(u.win_custom) || 0);
  return Math.round((wins / f) * 100);
}

/**
 * Caída ratio = caídas dadas / caídas recibidas. 1.0 = par. >1 = más
 * dadas que recibidas (skill marker). When the denominator is 0 but
 * the numerator isn't, returns Infinity — the renderer should treat
 * that as "todo dadas".
 */
export function caidaRatio(u: UserRow): number | null {
  const dadas = Number(u.caida) || 0;
  const recibidas = Number(u.caido) || 0;
  if (dadas === 0 && recibidas === 0) return null;
  if (recibidas === 0) return Infinity;
  return dadas / recibidas;
}

export function fmtRate(r: number | null): string {
  if (r === null) return "—";
  if (!Number.isFinite(r)) return "∞";
  return r.toFixed(2);
}

export function fmtPct(p: number | null): string {
  return p === null ? "—" : p + "%";
}
