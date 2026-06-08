import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
  type ChartOptions,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import * as api from "../api";
import type { StatsResponse } from "../types";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const CANTO_LABELS: Record<string, string> = {
  ronda: "Ronda",
  chiguire: "Chiguire",
  patrulla: "Patrulla",
  vigia: "Vigía",
  registro: "Registro",
  maguaro: "Maguaro",
  registrico: "Registrico",
  casa_chica: "Casa chica",
  casa_grande: "Casa grande",
  trivilin: "Trivilín",
};

/** Read the live Telegram theme colors so the charts follow light/dark. */
function themeColors() {
  const s = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) =>
    s.getPropertyValue(name).trim() || fallback;
  return {
    text: v("--text", "#e6edf3"),
    muted: v("--text-muted", "#8b949e"),
    grid: "rgba(255,255,255,0.08)",
    accent: v("--accent", "#2f81f7"),
    ok: v("--ok", "#3fb950"),
    danger: v("--danger", "#f85149"),
  };
}

export function StatsTab() {
  const q = useQuery({ queryKey: ["stats"], queryFn: api.stats });

  const c = useMemo(themeColors, []);

  if (q.isLoading) return <p className="muted" style={{ padding: 16 }}>Cargando estadísticas…</p>;
  if (q.isError) {
    const err = q.error as Error;
    return <p className="muted" style={{ padding: 16 }}>Error: {err.message}</p>;
  }
  const data = q.data as StatsResponse;

  const baseOpts: ChartOptions<"bar"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { color: c.muted }, grid: { color: c.grid } },
      y: { ticks: { color: c.muted }, grid: { color: c.grid }, beginAtZero: true },
    },
  };

  // ── Cantos distribution ──────────────────────────────────────────────
  const cantoKeys = Object.keys(CANTO_LABELS).filter((k) => (data.cantos[k] ?? 0) > 0);
  const cantosTotal = cantoKeys.reduce((s, k) => s + (data.cantos[k] ?? 0), 0);
  const cantosChart = {
    labels: cantoKeys.map((k) => CANTO_LABELS[k]),
    datasets: [
      {
        label: "Cantadas",
        data: cantoKeys.map((k) => data.cantos[k] ?? 0),
        backgroundColor: c.accent,
        borderRadius: 4,
      },
    ],
  };

  // ── Trivilín leaderboard (horizontal) ────────────────────────────────
  const trivChart = {
    labels: data.trivilin.map((t) => t.name),
    datasets: [
      {
        label: "Trivilín",
        data: data.trivilin.map((t) => t.trivilin),
        backgroundColor: c.ok,
        borderRadius: 4,
      },
    ],
  };
  const trivOpts: ChartOptions<"bar"> = {
    ...baseOpts,
    indexAxis: "y" as const,
    scales: {
      x: { ticks: { color: c.muted, precision: 0 }, grid: { color: c.grid }, beginAtZero: true },
      y: { ticks: { color: c.text }, grid: { display: false } },
    },
  };

  // ── CPU win rate by difficulty ────────────────────────────────────────
  const cpuChart = {
    labels: data.cpu.map((d) => d.label),
    datasets: [
      {
        label: "Win rate",
        data: data.cpu.map((d) => Math.round(d.winRate * 1000) / 10), // %
        backgroundColor: [c.ok, c.accent, c.danger],
        borderRadius: 4,
      },
    ],
  };
  const cpuOpts: ChartOptions<"bar"> = {
    ...baseOpts,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          afterLabel: (item) => {
            const d = data.cpu[item.dataIndex];
            return `${d.wins} de ${d.finished} partidas`;
          },
        },
      },
    },
    scales: {
      x: { ticks: { color: c.muted }, grid: { color: c.grid } },
      y: {
        ticks: { color: c.muted, callback: (v) => `${v}%` },
        grid: { color: c.grid },
        beginAtZero: true,
        max: 100,
      },
    },
  };

  // ── "Le ganaron al PRO" achievement (horizontal) ──────────────────────
  const beatPro = data.beatPro ?? [];
  const beatProChart = {
    labels: beatPro.map((d) => d.name),
    datasets: [
      {
        label: "Le ganó al PRO",
        data: beatPro.map((d) => d.beatPro),
        backgroundColor: c.accent,
        borderRadius: 4,
      },
    ],
  };

  return (
    <section className="tab-panel">
      <div className="card stats-card">
        <div className="card-title">Distribución de cantos {cantosTotal > 0 && <span className="muted">· {cantosTotal} total</span>}</div>
        {cantoKeys.length === 0 ? (
          <p className="muted">Todavía no se ha cantado nada.</p>
        ) : (
          <div className="stats-chart">
            <Bar data={cantosChart} options={baseOpts} />
          </div>
        )}
      </div>

      <div className="card stats-card">
        <div className="card-title">Trivilín por jugador</div>
        {data.trivilin.length === 0 ? (
          <p className="muted">Nadie ha cantado trivilín todavía.</p>
        ) : (
          <div
            className="stats-chart"
            style={{ height: Math.max(160, data.trivilin.length * 34 + 40) }}
          >
            <Bar data={trivChart} options={trivOpts} />
          </div>
        )}
      </div>

      <div className="card stats-card">
        <div className="card-title">Win rate de CPU por dificultad</div>
        {data.cpu.length === 0 || data.cpu.every((d) => d.finished === 0) ? (
          <p className="muted">Los CPU aún no han terminado partidas.</p>
        ) : (
          <div className="stats-chart">
            <Bar data={cpuChart} options={cpuOpts} />
          </div>
        )}
      </div>

      <div className="card stats-card">
        <div className="card-title">🏆 Le ganaron al PRO <span className="muted">· 1v1 vs CPU Pro</span></div>
        {beatPro.length === 0 ? (
          <p className="muted">Nadie le ha ganado al PRO en 1v1 todavía.</p>
        ) : (
          <div
            className="stats-chart"
            style={{ height: Math.max(140, beatPro.length * 34 + 40) }}
          >
            <Bar data={beatProChart} options={trivOpts} />
          </div>
        )}
      </div>
    </section>
  );
}
