import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { ColumnDef, Row } from "@tanstack/react-table";
import * as api from "../api";
import { DataTable } from "../components/DataTable";
import { CpuBadge } from "../components/Badge";
import { useToast } from "../components/Toast";
import { ViewSwitch, useStatsView, type StatsView } from "../components/ViewSwitch";
import { t } from "../lib/i18n";
import {
  caidaRatio,
  displayName,
  fmtPct,
  fmtRate,
  isCpu,
  winRate,
} from "../lib/format";
import type { CompanionLeaderRow, PairLeaderRow, UserRow } from "../types";

/** The official ranking: win rate, among people with at least `minGames`
 *  (the server sorts the rest after them, also by rate). */
const OFFICIAL = "win_rate";
const MIN_GAMES_FALLBACK = 10;
// Column ids = the server's sort keys (services/ranking.js). Tapping a header
// refetches the Top N in that order, so it's the real top by that column,
// not just the visible rows reordered.
const APP_SORTS = ["win_rate", "win", "finished", "beat_pro", "caida", "caido", "caida_ratio"];
const REAL_SORTS = ["win_rate", "won", "played", "caidas", "mesas", "points"];
const PAIR_SORTS = ["win_rate", "won", "played"];

/** Tap a column: sort by it; tap the active one again: back to the official order. */
function useSort() {
  const [sort, setSort] = useState(OFFICIAL);
  const toggle = (id: string) => setSort((s) => (s === id && id !== OFFICIAL ? OFFICIAL : id));
  const reset = () => setSort(OFFICIAL);
  return [sort, toggle, reset] as const;
}

/** What the table is ordered by — on a phone the sorted column is often
 *  scrolled out of view, so say it, with a way back to the official ranking. */
function SortNote<T>({
  sort,
  columns,
  min,
  onReset,
  prefix,
  official,
  labels,
}: {
  sort: string;
  columns: ColumnDef<T>[];
  min: number;
  onReset: () => void;
  prefix?: string;
  /** Text for the official order (default: the players' one). */
  official?: string;
  /** Full column names when the headers are abbreviated (PJ → Partidas). */
  labels?: Record<string, string>;
}) {
  const header = columns.find((c) => c.id === sort)?.header;
  const name = labels?.[sort] ?? (typeof header === "string" ? header : sort);
  return (
    <p className="muted top-note">
      {prefix ? `${prefix} ` : ""}
      {sort === OFFICIAL ? (
        (official ?? t("top.officialNote", { n: min }))
      ) : (
        <>
          {t("top.sortedBy", { col: name })}{" "}
          <button type="button" className="top-reset" onClick={onReset}>
            {t("top.backToOfficial")}
          </button>
        </>
      )}
    </p>
  );
}

interface Placed {
  /** Position shown in "#"; null = below the minimum (official order only). */
  rank: number | null;
  /** First row under the minimum: draws the divider. */
  firstUnranked: boolean;
}

/** Ranks for the official order (only who has enough games gets a number) or
 *  plain positions for any other column. */
function place<T>(rows: T[], official: boolean, games: (r: T) => number, min: number) {
  let rank = 0;
  let divided = false;
  return rows.map((r) => {
    if (!official) return { ...r, rank: ++rank, firstUnranked: false };
    if (games(r) >= min) return { ...r, rank: ++rank, firstUnranked: false };
    const firstUnranked = !divided;
    divided = true;
    return { ...r, rank: null, firstUnranked };
  });
}

const rowClass = <T extends Placed>(row: Row<T>) =>
  row.original.rank == null
    ? `is-unranked${row.original.firstUnranked ? " is-first-unranked" : ""}`
    : "";

const rankCell = (rank: number | null) => (
  <span className="cell-mono">{rank ?? "—"}</span>
);

function Legend({ show, text }: { show: boolean; text: string }) {
  return show ? <p className="muted top-note top-legend">— {text}</p> : null;
}

type Who = "players" | "pairs";

export function TopTab() {
  const [limit, setLimit] = useState(25);
  // "app" = games played in the bot/WebApp; "real" = Acompañante (Mesa real).
  // Two separate rankings — never mixed. Shared with Mi cuenta (remembered).
  const [view, setView] = useStatsView();
  const [who, setWho] = useState<Who>("players");

  return (
    <section className="tab-panel">
      <div className="toolbar">
        <ViewSwitch value={view} onChange={setView} />
        <div className="cfg-seg top-switch" role="tablist">
          {(["players", "pairs"] as const).map((w) => (
            <button
              key={w}
              type="button"
              role="tab"
              aria-selected={who === w}
              className={`cfg-seg-btn ${who === w ? "is-on" : ""}`}
              onClick={() => setWho(w)}
            >
              {w === "players" ? t("top.whoPlayers") : t("top.whoPairs")}
            </button>
          ))}
        </div>
        <select
          className="input"
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
        >
          <option value={10}>{t("top.top10")}</option>
          <option value={25}>{t("top.top25")}</option>
          <option value={50}>{t("top.top50")}</option>
          <option value={100}>{t("top.top100")}</option>
        </select>
      </div>
      {who === "pairs" ? (
        <PairsTop key={view} view={view} limit={limit} />
      ) : view === "app" ? (
        <AppTop limit={limit} />
      ) : (
        <CompanionTop limit={limit} />
      )}
    </section>
  );
}

type Ranked = UserRow & Placed;

/** App leaderboard: games in Telegram groups + WebApp tables. */
function AppTop({ limit }: { limit: number }) {
  const [sort, toggleSort, resetSort] = useSort();
  const toast = useToast();
  const q = useQuery({
    queryKey: ["leaderboard", limit, sort],
    queryFn: () => api.leaderboard(limit, sort),
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    if (q.isError) toast("Error: " + (q.error as Error).message, "err");
  }, [q.isError, q.error, toast]);

  const min = q.data?.minGames ?? MIN_GAMES_FALLBACK;
  const official = (q.data?.sort ?? sort) === OFFICIAL;
  const ranked = useMemo<Ranked[]>(
    () => place(q.data?.rows ?? [], official, (u) => Number(u.finished) || 0, min),
    [q.data, official, min],
  );

  const columns = useMemo<ColumnDef<Ranked>[]>(
    () => [
      {
        id: "rank",
        header: t("top.rank"),
        cell: (c) => rankCell(c.row.original.rank),
      },
      {
        id: "name",
        header: t("top.player"),
        accessorFn: (u) => displayName(u),
        cell: (c) => (
          <>
            {displayName(c.row.original)}
            {isCpu(c.row.original) && <CpuBadge />}
            {c.row.original.username && (
              <small className="muted"> @{c.row.original.username}</small>
            )}
          </>
        ),
      },
      {
        id: "finished",
        header: t("top.games"),
        accessorFn: (u) => Number(u.finished) || 0,
      },
      {
        id: "win",
        header: t("top.won"),
        accessorFn: (u) => Number(u.win) || 0,
      },
      {
        id: "beat_pro",
        header: t("top.pro"),
        accessorFn: (u) => Number(u.beat_pro) || 0,
      },
      {
        id: "win_rate",
        header: t("top.winRate"),
        accessorFn: (u) => winRate(u) ?? -1,
        cell: (c) => fmtPct(winRate(c.row.original)),
      },
      {
        id: "caida",
        header: t("top.caidasGiven"),
        accessorFn: (u) => Number(u.caida) || 0,
      },
      {
        id: "caido",
        header: t("top.caidasReceived"),
        accessorFn: (u) => Number(u.caido) || 0,
      },
      {
        id: "caida_ratio",
        header: t("top.caidaRatio"),
        accessorFn: (u) => caidaRatio(u) ?? -1,
        cell: (c) => fmtRate(caidaRatio(c.row.original)),
      },
    ],
    [],
  );

  return (
    <>
      <SortNote sort={sort} columns={columns} min={min} onReset={resetSort} />
      <DataTable
        data={ranked}
        columns={columns}
        emptyMessage={q.isLoading ? t("top.loading") : t("top.empty")}
        rowClassName={rowClass}
        serverSort={{ active: sort, keys: APP_SORTS, onChange: toggleSort }}
      />
      <Legend show={ranked.some((r) => r.rank == null)} text={t("top.unranked", { n: min })} />
    </>
  );
}

type RealRanked = CompanionLeaderRow & Placed;

const realRate = (r: CompanionLeaderRow) =>
  r.played ? Math.round((r.won / r.played) * 100) : null;

/** Acompañante leaderboard: games scored at real tables. */
function CompanionTop({ limit }: { limit: number }) {
  const [sort, toggleSort, resetSort] = useSort();
  const q = useQuery({
    queryKey: ["companionLeaderboard", limit, sort],
    queryFn: () => api.companionLeaderboard(limit, sort),
    placeholderData: keepPreviousData,
  });
  const min = q.data?.minGames ?? MIN_GAMES_FALLBACK;
  const official = (q.data?.sort ?? sort) === OFFICIAL;
  const rows = useMemo<RealRanked[]>(
    () => place(q.data?.rows ?? [], official, (r) => Number(r.played) || 0, min),
    [q.data, official, min],
  );
  const columns = useMemo<ColumnDef<RealRanked>[]>(
    () => [
      {
        id: "rank",
        header: t("top.rank"),
        cell: (c) => rankCell(c.row.original.rank),
      },
      { id: "name", accessorKey: "name", header: t("top.player") },
      { id: "played", accessorKey: "played", header: t("top.games") },
      { id: "won", accessorKey: "won", header: t("top.realWon") },
      {
        id: "win_rate",
        header: t("top.winRate"),
        accessorFn: (r) => realRate(r) ?? -1,
        cell: (c) => fmtPct(realRate(c.row.original)),
      },
      { id: "caidas", accessorKey: "caidas", header: t("top.realCaidas") },
      { id: "mesas", accessorKey: "mesas", header: t("top.realMesas") },
      { id: "points", accessorKey: "points", header: t("top.realPoints") },
    ],
    [],
  );
  return (
    <>
      <SortNote
        sort={sort}
        columns={columns}
        min={min}
        onReset={resetSort}
        prefix={t("top.realNote")}
      />
      {q.isError ? (
        <p className="muted">{t("me.recentError")}</p>
      ) : (
        <>
          <DataTable
            data={rows}
            columns={columns}
            emptyMessage={q.isLoading ? t("top.loading") : t("top.realEmpty")}
            rowClassName={rowClass}
            serverSort={{ active: sort, keys: REAL_SORTS, onChange: toggleSort }}
          />
          <Legend show={rows.some((r) => r.rank == null)} text={t("top.unranked", { n: min })} />
        </>
      )}
    </>
  );
}

type PairRanked = PairLeaderRow & Placed;

const pairRate = (r: PairLeaderRow) => (r.played ? Math.round((r.won / r.played) * 100) : null);

/** 🤝 Top pairs — app (ranked 2v2) or Mesa real (2v2, both with an account),
 *  ranked like players: win rate with a minimum of games together. */
function PairsTop({ view, limit }: { view: StatsView; limit: number }) {
  const [sort, toggleSort, resetSort] = useSort();
  const q = useQuery({
    queryKey: ["pairLeaderboard", view, limit, sort],
    queryFn: () =>
      view === "app" ? api.pairLeaderboard(limit, sort) : api.companionPairLeaderboard(limit, sort),
    placeholderData: keepPreviousData,
  });
  const min = q.data?.minGames ?? MIN_GAMES_FALLBACK;
  const official = (q.data?.sort ?? sort) === OFFICIAL;
  const rows = useMemo<PairRanked[]>(
    () => place(q.data?.rows ?? [], official, (r) => Number(r.played) || 0, min),
    [q.data, official, min],
  );
  const columns = useMemo<ColumnDef<PairRanked>[]>(
    () => [
      {
        id: "rank",
        header: t("top.rank"),
        cell: (c) => rankCell(c.row.original.rank),
      },
      {
        id: "pair",
        header: t("top.pair"),
        accessorFn: (r) => `${r.a.name} & ${r.b.name}`,
        cell: (c) => (
          <>
            {c.row.original.a.name} <span className="muted">&</span> {c.row.original.b.name}
          </>
        ),
      },
      // Short headers so the official column (%) fits on a phone with the
      // pair's names; SortNote spells them out.
      { id: "played", accessorFn: (r) => r.played, header: t("top.pairPlayedShort") },
      { id: "won", accessorFn: (r) => r.won, header: t("top.pairWonShort") },
      {
        id: "win_rate",
        header: "%",
        accessorFn: (r) => pairRate(r) ?? -1,
        cell: (c) => fmtPct(pairRate(c.row.original)),
      },
    ],
    [],
  );
  return (
    <>
      <SortNote
        sort={sort}
        columns={columns}
        min={min}
        onReset={resetSort}
        prefix={view === "app" ? t("top.pairsAppNote") : t("top.pairsRealNote")}
        official={t("top.pairsOfficialNote", { n: min })}
        labels={{ played: t("top.games"), won: t("top.realWon") }}
      />
      {q.isError ? (
        <p className="muted">{t("me.recentError")}</p>
      ) : (
        <>
          <DataTable
            data={rows}
            columns={columns}
            emptyMessage={q.isLoading ? t("top.loading") : t("top.pairsEmpty")}
            rowClassName={rowClass}
            serverSort={{ active: sort, keys: PAIR_SORTS, onChange: toggleSort }}
          />
          <Legend
            show={rows.some((r) => r.rank == null)}
            text={t("top.pairsUnranked", { n: min })}
          />
        </>
      )}
    </>
  );
}
