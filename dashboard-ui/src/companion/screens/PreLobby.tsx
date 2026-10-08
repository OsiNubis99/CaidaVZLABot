import { useState } from "react";
import { useCompanion } from "../store";
import { t } from "../../lib/i18n";
import { CreateConfig } from "../../game/components/CreateConfig";

/** No table yet: open one (2v2 by default) or join a friend's by code. The
 *  creator either plays too or only referees (keeps score, no seat). */
export function PreLobby() {
  const c = useCompanion();
  const [code, setCode] = useState("");
  const [configuring, setConfiguring] = useState(false);
  const [referee, setReferee] = useState(false);

  if (configuring) {
    return (
      <div className="lobby lobby-pre">
        <CreateConfig
          variant="companion"
          initial={{ type: "parejas" }}
          title={t("real.configTitle")}
          submitLabel={t("cfg.create")}
          onCancel={() => setConfiguring(false)}
          onSubmit={(config) => {
            setConfiguring(false);
            c.create(config, referee);
          }}
        />
      </div>
    );
  }

  return (
    <div className="lobby lobby-pre">
      <div className="prelobby-card">
        <h3>{t("real.preTitle")}</h3>
        <p className="muted">{t("real.preBody")}</p>
        <ul className="real-pre-points">
          <li>{t("real.prePoint1")}</li>
          <li>{t("real.prePoint2")}</li>
          <li>{t("real.prePoint3")}</li>
        </ul>

        <div className="real-role" role="radiogroup">
          <button
            type="button"
            role="radio"
            aria-checked={!referee}
            className={referee ? "" : "is-on"}
            onClick={() => setReferee(false)}
          >
            🃏 {t("real.rolePlay")}
            <small>{t("real.rolePlaySub")}</small>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={referee}
            className={referee ? "is-on" : ""}
            onClick={() => setReferee(true)}
          >
            🧑‍⚖️ {t("real.roleReferee")}
            <small>{t("real.roleRefereeSub")}</small>
          </button>
        </div>

        <button
          type="button"
          className="btn btn-primary prelobby-create"
          onClick={() => c.create(undefined, referee)}
        >
          {t("real.createQuick")}
        </button>
        <button
          type="button"
          className="btn prelobby-configure"
          onClick={() => setConfiguring(true)}
        >
          {t("prelobby.createConfig")}
        </button>

        <div className="prelobby-sep">
          <span>{t("prelobby.or")}</span>
        </div>

        <form
          className="prelobby-join"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.trim()) c.join(code);
          }}
        >
          <input
            className="input"
            type="text"
            autoCapitalize="characters"
            placeholder="MESA-XXXX"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <button type="submit" className="btn" disabled={!code.trim()}>
            {t("prelobby.join")}
          </button>
        </form>
      </div>
    </div>
  );
}
