// Shared types for the dashboard. Mirror the shape Express endpoints
// emit. Keep loose where columns are nullable (most numeric cols on
// public.user default to 0 but old rows or rare bot rows may surface
// as null/undefined depending on join path).

export type Role = "admin" | "user";

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface UserRow {
  id_user: string;
  first_name: string;
  last_name?: string;
  username?: string | null;
  is_banned?: boolean;
  finished?: number;
  win?: number;
  win_custom?: number; // legacy, no longer written
  beat_pro?: number; // "le ganó al PRO" achievement count
  caida?: number;
  caido?: number;
  notify_on_turn?: boolean;
  // sing counters (cantadas)
  ronda?: number;
  chiguire?: number;
  patrulla?: number;
  vigia?: number;
  registro?: number;
  maguaro?: number;
  registrico?: number;
  casa_chica?: number;
  casa_grande?: number;
  trivilin?: number;
  // alive_* are the vivas (won the canto) counters
  alive_ronda?: number;
  alive_chiguire?: number;
  alive_patrulla?: number;
  alive_vigia?: number;
  alive_registro?: number;
  alive_maguaro?: number;
  alive_registrico?: number;
  alive_casa_chica?: number;
  alive_casa_grande?: number;
  alive_trivilin?: number;
}

export interface GroupRow {
  id_group: string;
  name: string;
  public?: boolean;
  is_banned?: boolean;
  paid_up_to?: string | null;
  paid_times?: number;
  games_played?: number;
  created_at?: string;
}

export interface PublicGroup {
  id_group: string;
  name: string;
  games_played: number;
  invite: string | null;
}

export interface Paged<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  sort: string;
}

export interface MeResponse {
  role: Role;
  telegram: TelegramUser;
  user: UserRow | null;
}

// ─── Stats (admin) ──────────────────────────────────────────────────────
/** Global totals per canto type, summed across human players. */
export type CantoTotals = Record<string, number>;

export interface TrivilinEntry {
  name: string;
  trivilin: number;
}

export interface CpuStat {
  id_user: string;
  label: string;
  finished: number;
  wins: number;
  winRate: number; // 0..1
}

export interface BeatProEntry {
  name: string;
  beatPro: number;
}

export interface StatsResponse {
  cantos: CantoTotals;
  trivilin: TrivilinEntry[];
  cpu: CpuStat[];
  beatPro: BeatProEntry[];
}
