export interface Bar {
  label: string;
  value: number;
  caption: string;
}

// Horizontal bars in plain DOM. Optional `max` fixes the scale (e.g. 1 for a
// rate) and `baseline` draws a dashed reference line across every track.
export default function BarChart({
  bars,
  max,
  baseline,
  baselineLabel,
}: {
  bars: Bar[];
  max?: number;
  baseline?: number;
  baselineLabel?: string;
}) {
  const hi = max ?? Math.max(1, ...bars.map((b) => b.value));
  if (!bars.length) return <div className="text-[12px] text-muted">No data yet.</div>;
  return (
    <div className="flex flex-col gap-2">
      {baselineLabel !== undefined && baseline !== undefined && (
        <div className="flex items-center gap-1.5 self-end text-[10.5px] text-muted-2">
          <span className="inline-block h-3 border-l border-dashed border-ink/40" />
          {baselineLabel}
        </div>
      )}
      {bars.map((b) => (
        <div key={b.label} className="flex items-center gap-3">
          <div className="w-48 shrink-0 truncate text-right font-mono text-[11px] text-ink-2" title={b.label}>
            {b.label}
          </div>
          <div className="relative h-5 flex-1 overflow-hidden rounded bg-surface">
            <div
              className="absolute inset-y-0 left-0 rounded bg-accent/85 transition-all"
              style={{ width: `${(b.value / hi) * 100}%` }}
            />
            {baseline !== undefined && (
              <div
                className="absolute inset-y-0 border-l border-dashed border-ink/45"
                style={{ left: `${(baseline / hi) * 100}%` }}
              />
            )}
          </div>
          <div className="w-20 shrink-0 text-right text-[11px] tabular-nums text-muted">{b.caption}</div>
        </div>
      ))}
    </div>
  );
}
