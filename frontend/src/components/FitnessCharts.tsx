import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { GenerationRecord } from "../types";
import { useCountUp } from "../useCountUp";
import { StatTile } from "./StatTile";
import { fitnessColor } from "./IndividualDetail";

// Series colors. Grid / axis / tick chrome is theme-driven by the global
// recharts CSS overrides (stroke/fill: var(--line)/var(--muted)), so the values
// passed here are only fallbacks and stay legible in both themes.
const BEST = "#3b82f6"; // electric-blue accent, echoes the UI
const AVG = "#8b5cf6";
const SUCCESS = "#30a46c";
const THRESHOLD = "#d9a441"; // the solve bar (fitness 1.0)
const GRID = "#8884";
const AXIS_LINE = "#8883";
const TICK = { fontSize: 12, fontWeight: 500 } as const;
const AXIS_LABEL = { fontSize: 11 } as const;
// Fixed 0–1 fitness scale, 0-baseline, never zoomed — so a small gain never
// looks like a big one and the chart matches the HUD figures.
const FIT_TICKS = [0, 0.25, 0.5, 0.75, 1];
const fitTick = (v: number): string => v.toFixed(2);
const pctTick = (v: number): string => `${Math.round(v * 100)}%`;

interface FitTooltipProps {
  active?: boolean;
  label?: number | string;
  payload?: Array<{
    name?: string;
    value?: number;
    color?: string;
    dataKey?: string | number;
  }>;
}

function fmtVal(dataKey: string | number | undefined, value: number): string {
  return dataKey === "success_rate"
    ? `${Math.round(value * 100)}%`
    : value.toFixed(2);
}

/** Per-generation tooltip listing each series with its color + formatted value. */
function FitTooltip({ active, payload, label }: FitTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="fitchart-tip">
      <div className="fitchart-tip__gen">Generation {label}</div>
      <ul className="fitchart-tip__list">
        {payload.map((p) => (
          <li key={String(p.dataKey)}>
            <span className="fitchart-tip__dot" style={{ background: p.color }} />
            <span className="fitchart-tip__name">{p.name}</span>
            <span className="fitchart-tip__val">
              {typeof p.value === "number" ? fmtVal(p.dataKey, p.value) : "—"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Count-up peak-fitness figure, colored by the fitness scale. */
function PeakNum({ value }: { value: number }) {
  const shown = useCountUp(value);
  return (
    <span className="fitchart__hero-num" style={{ color: fitnessColor(value) }}>
      {shown.toFixed(2)}
    </span>
  );
}

export function FitnessCharts({ data }: { data: GenerationRecord[] }) {
  // Headline run stats derived from the per-generation records.
  const stats = useMemo(() => {
    let peak = 0;
    let peakGen: number | null = null;
    let firstSolveGen: number | null = null;
    for (const g of data) {
      const best = g.best_fitness ?? 0;
      if (best > peak) {
        peak = best;
        peakGen = g.generation;
      }
      if (firstSolveGen == null && best >= 1) firstSolveGen = g.generation;
    }
    const latest = data[data.length - 1];
    return {
      peak,
      peakGen,
      firstSolveGen,
      latestAvg: latest?.avg_fitness ?? 0,
      latestSuccess: latest?.success_rate ?? 0,
    };
  }, [data]);

  const hasData = data.length > 0;

  return (
    <div className="fitchart">
      <div className="fitchart__head">
        <div className="fitchart__title">
          <h2>Evolution progress</h2>
          <p className="fitchart__sub">
            How the population's fitness and solve-rate climb each generation.
            The dashed line marks the solve bar (fitness 1.0).
          </p>
        </div>
      </div>

      {!hasData ? (
        <div className="fitchart-empty">
          <p className="fitchart-empty__title">No generations yet</p>
          <p className="muted">
            Fitness and success-rate curves appear here as the run evolves.
          </p>
        </div>
      ) : (
        <>
          <div className="fitchart__kpis">
            <div className="fitchart__hero">
              <span className="fitchart__hero-label">peak fitness</span>
              <PeakNum value={stats.peak} />
              <span className="fitchart__hero-sub">
                {stats.peakGen != null && stats.peak > 0
                  ? `reached gen ${stats.peakGen}`
                  : "—"}
              </span>
            </div>
            <StatTile
              value={stats.latestAvg}
              label="latest avg"
              format={(v) => v.toFixed(2)}
            />
            <StatTile
              value={stats.latestSuccess * 100}
              label="success rate"
              format={(v) => `${Math.round(v)}%`}
            />
            <StatTile value={data.length} label="generations" />
            <div className="fitchart__call">
              <span className="fitchart__call-label">first solve</span>
              <span className="fitchart__call-val">
                {stats.firstSolveGen != null ? (
                  `generation ${stats.firstSolveGen}`
                ) : (
                  <span className="muted">no solve yet</span>
                )}
              </span>
            </div>
          </div>

          <div className="fitchart__grid">
            <div className="fitchart__chart">
              <div className="fitchart__chart-head">
                <h3>Fitness</h3>
                <div className="fitchart__legend">
                  <span className="fitchart__legend-item">
                    <i style={{ background: BEST }} />
                    best
                  </span>
                  <span className="fitchart__legend-item">
                    <i style={{ background: AVG }} />
                    avg
                  </span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={252}>
                <ComposedChart
                  data={data}
                  margin={{ top: 12, right: 20, bottom: 16, left: 0 }}
                >
                  <defs>
                    <linearGradient id="fit-best-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={BEST} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={BEST} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    vertical={false}
                    stroke={GRID}
                    strokeDasharray="4 4"
                  />
                  <XAxis
                    dataKey="generation"
                    type="number"
                    allowDecimals={false}
                    domain={["dataMin", "dataMax"]}
                    tickLine={false}
                    axisLine={{ stroke: AXIS_LINE }}
                    tick={TICK}
                    tickMargin={8}
                    padding={{ left: 12, right: 12 }}
                    label={{
                      value: "generation",
                      position: "insideBottom",
                      offset: -4,
                      ...AXIS_LABEL,
                    }}
                  />
                  <YAxis
                    domain={[0, 1]}
                    ticks={FIT_TICKS}
                    tickLine={false}
                    axisLine={false}
                    tick={TICK}
                    tickFormatter={fitTick}
                    width={42}
                  />
                  <Tooltip
                    content={<FitTooltip />}
                    cursor={{ stroke: "#8886", strokeDasharray: "4 4" }}
                  />
                  <ReferenceLine
                    y={1}
                    stroke={THRESHOLD}
                    strokeDasharray="5 5"
                    strokeWidth={1.5}
                    label={{
                      value: "solve",
                      position: "insideTopRight",
                      fill: THRESHOLD,
                      fontSize: 10,
                      fontWeight: 700,
                    }}
                  />
                  <Area
                    dataKey="best_fitness"
                    name="best"
                    stroke={BEST}
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    fill="url(#fit-best-grad)"
                    connectNulls
                    dot={false}
                    activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }}
                    isAnimationActive
                    animationDuration={750}
                    animationEasing="ease-out"
                  />
                  <Line
                    dataKey="avg_fitness"
                    name="avg"
                    stroke={AVG}
                    strokeWidth={2}
                    strokeLinecap="round"
                    dot={false}
                    connectNulls
                    activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }}
                    isAnimationActive
                    animationDuration={750}
                    animationEasing="ease-out"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div className="fitchart__chart">
              <div className="fitchart__chart-head">
                <h3>Success rate</h3>
                <div className="fitchart__legend">
                  <span className="fitchart__legend-item">
                    <i style={{ background: SUCCESS }} />
                    solved
                  </span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={252}>
                <AreaChart
                  data={data}
                  margin={{ top: 12, right: 20, bottom: 16, left: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="fit-success-grad"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor={SUCCESS} stopOpacity={0.4} />
                      <stop offset="100%" stopColor={SUCCESS} stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    vertical={false}
                    stroke={GRID}
                    strokeDasharray="4 4"
                  />
                  <XAxis
                    dataKey="generation"
                    type="number"
                    allowDecimals={false}
                    domain={["dataMin", "dataMax"]}
                    tickLine={false}
                    axisLine={{ stroke: AXIS_LINE }}
                    tick={TICK}
                    tickMargin={8}
                    padding={{ left: 12, right: 12 }}
                    label={{
                      value: "generation",
                      position: "insideBottom",
                      offset: -4,
                      ...AXIS_LABEL,
                    }}
                  />
                  <YAxis
                    domain={[0, 1]}
                    ticks={FIT_TICKS}
                    tickLine={false}
                    axisLine={false}
                    tick={TICK}
                    tickFormatter={pctTick}
                    width={44}
                  />
                  <Tooltip
                    content={<FitTooltip />}
                    cursor={{ stroke: "#8886", strokeDasharray: "4 4" }}
                  />
                  <Area
                    dataKey="success_rate"
                    name="solved"
                    stroke={SUCCESS}
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    fill="url(#fit-success-grad)"
                    connectNulls
                    dot={false}
                    activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }}
                    isAnimationActive
                    animationDuration={750}
                    animationEasing="ease-out"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
