import type { ReactNode } from "react";
import { useEffect } from "react";

interface Props {
  title: string;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmKind?: "primary" | "danger";
  children: ReactNode;
}

export function Modal({
  title,
  onCancel,
  onConfirm,
  confirmLabel = "Aplicar",
  cancelLabel = "Cancelar",
  confirmKind = "primary",
  children,
}: Props) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onCancel]);

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="modal">
        <h3>{title}</h3>
        {children}
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            className={`btn ${confirmKind === "danger" ? "btn-danger" : "btn-primary"}`}
            onClick={() => void onConfirm()}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
