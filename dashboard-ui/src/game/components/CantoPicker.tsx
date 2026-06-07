import type { Canto } from "../types";

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
        <span className="canto-picker-label">Puedes cantar</span>
        <span className="canto-picker-name">
          {canSing.name} · {canSing.value} pts
        </span>
      </div>
      <button type="button" className="btn btn-primary" onClick={onSing}>
        🎵 Cantar
      </button>
    </div>
  );
}
