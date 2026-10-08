import { useEffect, type ReactNode } from "react";

interface Props {
  title: ReactNode;
  sub?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}

/** Bottom sheet: tap outside (or Escape) closes it. */
export function Sheet({ title, sub, onClose, children }: Props) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div className="real-sheet-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="real-sheet" role="dialog" aria-modal="true">
        <div className="real-sheet-grab" />
        <div className="real-sheet-title">
          {title}
          {sub != null && <span className="muted">{sub}</span>}
        </div>
        {children}
      </div>
    </div>
  );
}
