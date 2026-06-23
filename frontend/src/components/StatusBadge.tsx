import type { RunStatus } from "../types";

export function StatusBadge({ status }: { status: RunStatus }) {
  return (
    <span className={`badge badge--${status}`}>{status}</span>
  );
}
