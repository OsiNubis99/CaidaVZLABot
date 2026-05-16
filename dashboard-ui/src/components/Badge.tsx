import type { ReactNode } from "react";

type Kind = "ok" | "no" | "banned" | "cpu";

export function Badge({ kind, children }: { kind: Kind; children: ReactNode }) {
  return <span className={`badge ${kind}`}>{children}</span>;
}

export const YesNo = ({ value }: { value: boolean | null | undefined }) =>
  value ? <Badge kind="ok">✓</Badge> : <Badge kind="no">—</Badge>;

export const BannedBadge = ({ value }: { value: boolean | null | undefined }) =>
  value ? <Badge kind="banned">🚫</Badge> : <Badge kind="ok">OK</Badge>;

export const CpuBadge = () => <Badge kind="cpu">🤖 CPU</Badge>;
