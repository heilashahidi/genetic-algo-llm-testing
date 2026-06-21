export interface Bar {
  label: string;
  value: number;
  caption: string;
}

// Horizontal bars in plain DOM — lighter than SVG for a ranked list and it inherits
// house-style surfaces directly.
export default function BarChart({ bars }: { bars: Bar[] }) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  if (!bars.length) return <div className="text-[12px] text-muted">No violations yet.</div>;
  return (
    <div className="flex flex-col gap-2">
      {bars.map((b) => (
        <div key={b.label} className="flex items-center gap-3">
          <div className="w-44 shrink-0 truncate text-right font-mono text-[11px] text-ink-2" title={b.label}>
            {b.label}
          </div>
          <div className="relative h-5 flex-1 overflow-hidden rounded bg-surface">
            <div
              className="absolute inset-y-0 left-0 rounded bg-accent/85 transition-all"
              style={{ width: `${(b.value / max) * 100}%` }}
            />
          </div>
          <div className="w-14 shrink-0 text-right text-[11px] tabular-nums text-muted">{b.caption}</div>
        </div>
      ))}
    </div>
  );
}
