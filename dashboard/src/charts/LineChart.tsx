export interface Series {
  label: string;
  color: string;
  dashed?: boolean;
  points: { x: number; y: number }[];
}

// Minimal hand-rolled line chart so the whole surface stays in house-style (no
// chart-lib styling to fight). Y is fixed to [0, yMax]; X spans the generations.
export default function LineChart({
  series,
  yMax = 1,
  height = 230,
  yTicks = [0, 0.25, 0.5, 0.75, 1],
  formatY = (v: number) => v.toFixed(2),
}: {
  series: Series[];
  yMax?: number;
  height?: number;
  yTicks?: number[];
  formatY?: (v: number) => string;
}) {
  const W = 760;
  const H = height;
  const pad = { l: 40, r: 14, t: 12, b: 30 };
  const xs = series.flatMap((s) => s.points.map((p) => p.x));
  const xMax = Math.max(1, ...xs);
  const sx = (x: number) => pad.l + (x / xMax) * (W - pad.l - pad.r);
  const sy = (y: number) => pad.t + (1 - y / yMax) * (H - pad.t - pad.b);

  return (
    <div className="flex flex-col gap-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="line chart">
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={pad.l} y1={sy(t * yMax)} x2={W - pad.r} y2={sy(t * yMax)} stroke="#f0f1f3" strokeWidth={1} />
            <text x={pad.l - 8} y={sy(t * yMax) + 3} textAnchor="end" className="fill-muted-2 text-[9px]">
              {formatY(t * yMax)}
            </text>
          </g>
        ))}
        <line x1={pad.l} y1={pad.t} x2={pad.l} y2={H - pad.b} stroke="#e7e8ea" strokeWidth={1} />
        {[...new Set([0, Math.round(xMax / 2), xMax])].map((g) => (
          <text key={g} x={sx(g)} y={H - pad.b + 16} textAnchor="middle" className="fill-muted-2 text-[9px]">
            {g}
          </text>
        ))}
        <text x={(pad.l + W - pad.r) / 2} y={H - 2} textAnchor="middle" className="fill-muted-2 text-[9px]">
          generation
        </text>
        {series.map((s) => (
          <polyline
            key={s.label}
            fill="none"
            stroke={s.color}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            strokeDasharray={s.dashed ? "4 4" : undefined}
            points={s.points.map((p) => `${sx(p.x)},${sy(p.y)}`).join(" ")}
          />
        ))}
      </svg>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pl-10">
        {series.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1.5 text-[11px] text-muted">
            <svg width="18" height="6" aria-hidden>
              <line
                x1="0"
                y1="3"
                x2="18"
                y2="3"
                stroke={s.color}
                strokeWidth={2}
                strokeDasharray={s.dashed ? "4 4" : undefined}
              />
            </svg>
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
