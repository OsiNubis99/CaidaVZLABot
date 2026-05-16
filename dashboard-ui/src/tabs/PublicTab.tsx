import { useQuery } from "@tanstack/react-query";
import * as api from "../api";
import { openTelegramLink } from "../lib/telegram";
import { useToast } from "../components/Toast";

export function PublicTab() {
  const toast = useToast();
  const q = useQuery({ queryKey: ["public-groups"], queryFn: api.publicGroups });

  if (q.isError) toast("Error: " + (q.error as Error).message, "err");

  return (
    <section className="tab-panel">
      {q.isLoading && <p className="muted">Cargando…</p>}
      {q.data && q.data.rows.length === 0 && (
        <p className="muted" style={{ textAlign: "center", padding: 32 }}>
          No hay grupos públicos.
        </p>
      )}
      {q.data?.rows.map((g) => (
        <div className="card public-card" key={g.id_group}>
          <div className="public-card-head">
            <strong>{g.name}</strong>
            <small className="muted">{g.games_played} partidas</small>
          </div>
          {g.invite ? (
            <button className="btn" onClick={() => openTelegramLink(g.invite!)}>
              Unirme al grupo
            </button>
          ) : (
            <span className="muted">Link no disponible</span>
          )}
        </div>
      ))}
    </section>
  );
}
