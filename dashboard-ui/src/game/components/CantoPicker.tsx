import type { Canto } from "../types";
import { t } from "../../lib/i18n";

interface Props {
  canSing: Canto | null;
  onSing: () => void;
}

/** When the viewer holds a declarable canto, prompt them to sing it. Declaring
 *  is optional, so this is a dismissible call-to-action, not a blocker. */
export function CantoPicker({ canSing, onSing }: Props) {
  if (!canSing) return null;
  return (
    <div className="canto-picker">
      <div className="canto-picker-info">
        <span className="canto-picker-label">{t("canto.canSing")}</span>
        <span className="canto-picker-name">
          {t("canto.namePts", { name: canSing.name, value: canSing.value })}
        </span>
      </div>
      <button type="button" className="btn btn-primary" onClick={onSing}>
        {t("canto.sing")}
      </button>
    </div>
  );
}
