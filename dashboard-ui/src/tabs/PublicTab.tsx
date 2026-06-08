import { useQuery } from "@tanstack/react-query";
import * as api from "../api";
import { openTelegramLink } from "../lib/telegram";
import { t } from "../lib/i18n";
import { useToast } from "../components/Toast";

export function PublicTab() {
  const toast = useToast();
  const q = useQuery({ queryKey: ["public-groups"], queryFn: api.publicGroups });

  if (q.isError) toast("Error: " + (q.error as Error).message, "err");

  return (
    <section className="tab-panel">
      {q.isLoading && <p className="muted">{t("public.loading")}</p>}
      {q.data && q.data.rows.length === 0 && (
        <p className="muted" style={{ textAlign: "center", padding: 32 }}>
          {t("public.empty")}
        </p>
      )}
      {q.data?.rows.map((g) => (
        <div className="card public-card" key={g.id_group}>
          <div className="public-card-head">
            <strong>{g.name}</strong>
            <small className="muted">{t("public.games", { count: g.games_played })}</small>
          </div>
          {g.invite ? (
            <button className="btn" onClick={() => openTelegramLink(g.invite!)}>
              {t("public.join")}
            </button>
          ) : (
            <span className="muted">{t("public.noLink")}</span>
          )}
        </div>
      ))}
    </section>
  );
}
