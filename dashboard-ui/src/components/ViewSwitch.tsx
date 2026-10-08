import { useState } from "react";
import { t } from "../lib/i18n";

/** "app" = games in the bot / WebApp; "real" = 🃏 Mesa real (Acompañante).
 *  Two separate stats systems — never summed. */
export type StatsView = "app" | "real";

const KEY = "caida.statsView";

function stored(): StatsView {
  try {
    return localStorage.getItem(KEY) === "real" ? "real" : "app";
  } catch {
    return "app";
  }
}

/** The App / Mesa real choice, shared by Top and Mi cuenta and remembered:
 *  whoever plays with real cards picks it once. */
export function useStatsView() {
  const [view, setView] = useState<StatsView>(stored);
  const choose = (v: StatsView) => {
    setView(v);
    try {
      localStorage.setItem(KEY, v);
    } catch {
      // storage unavailable (private mode): the choice just isn't remembered
    }
  };
  return [view, choose] as const;
}

export function ViewSwitch({
  value,
  onChange,
}: {
  value: StatsView;
  onChange: (v: StatsView) => void;
}) {
  return (
    <div className="cfg-seg top-switch" role="tablist">
      {(["app", "real"] as const).map((v) => (
        <button
          key={v}
          type="button"
          role="tab"
          aria-selected={value === v}
          className={`cfg-seg-btn ${value === v ? "is-on" : ""}`}
          onClick={() => onChange(v)}
        >
          {v === "app" ? t("top.viewApp") : t("top.viewReal")}
        </button>
      ))}
    </div>
  );
}
