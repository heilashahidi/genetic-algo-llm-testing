import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { GeneSchema, GenomeSchema, IndividualRecord } from "../types";
import {
  alleleFrequencyByGeneration,
  allelesOf,
  categoryLabel,
  coCarrierStats,
  computePopulationStats,
  metricValue,
  rankSynergyPairs,
} from "../alleleStats";
import type {
  AlleleStat,
  GenerationFilter,
  MetricMode,
  PairStat,
} from "../alleleStats";
import { fitnessColor } from "./IndividualDetail";
import { StatTile } from "./StatTile";
import { useCountUp } from "../useCountUp";

interface Props {
  individuals: IndividualRecord[];
  schema: GenomeSchema;
}

const SERIES_COLORS = [
  "#3b6ef6", // blue
  "#30a46c", // green
  "#e0901a", // amber
  "#e5484d", // red
  "#8b5cf6", // violet
  "#0d9488", // teal
  "#f43f5e", // rose
  "#4f5a78", // accent
  "#0891b2", // cyan
  "#65a30d", // lime
];

function fmt(value: number, digits = 2): string {
  return value.toFixed(digits);
}

function signed(value: number, digits = 2): string {
  const s = value.toFixed(digits);
  return value >= 0 ? `+${s}` : s;
}

/** Color for a lift value: diverging red (negative) → gray (0) → green. */
function liftColor(lift: number): string {
  const t = Math.max(-0.5, Math.min(0.5, lift)) / 0.5; // -1..1
  // gray muted-2 #9a9da5 → green #30a46c (positive) / red #e5484d (negative)
  if (t >= 0) {
    const mix = (a: number, b: number) => Math.round(a + (b - a) * t);
    return `rgb(${mix(0x9a, 0x30)}, ${mix(0x9d, 0xa4)}, ${mix(0xa5, 0x6c)})`;
  }
  const u = -t;
  const mix = (a: number, b: number) => Math.round(a + (b - a) * u);
  return `rgb(${mix(0x9a, 0xe5)}, ${mix(0x9d, 0x48)}, ${mix(0xa5, 0x4d)})`;
}

function geneByName(schema: GenomeSchema): Map<string, GeneSchema> {
  const map = new Map<string, GeneSchema>();
  for (const gene of schema.genes) map.set(gene.name, gene);
  return map;
}

type Tier = "S" | "A" | "B" | "C";

/** Tier from a value's share of the gene's best (positive) value. Non-positive
 *  or no-max → no tier, so weak/empty alleles stay unbadged. */
function tierOf(value: number, max: number): Tier | null {
  if (max <= 0 || value <= 0) return null;
  const share = value / max;
  if (share >= 0.8) return "S";
  if (share >= 0.5) return "A";
  if (share >= 0.25) return "B";
  return "C";
}

export function AlleleExplorer({ individuals, schema }: Props) {
  const [metric, setMetric] = useState<MetricMode>("mean");
  const [minCount, setMinCount] = useState(5);
  const [generation, setGeneration] = useState<GenerationFilter>("all");

  const genes = schema.genes;
  const geneMap = useMemo(() => geneByName(schema), [schema]);

  const availableGenerations = useMemo(() => {
    const set = new Set<number>();
    for (const ind of individuals) {
      if (ind.fitness != null && !Number.isNaN(ind.fitness)) {
        set.add(ind.generation);
      }
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [individuals]);

  const pop = useMemo(
    () => computePopulationStats(individuals, genes, generation),
    [individuals, genes, generation],
  );

  // Best positive metric value per gene — drives tiers and the S-tier count.
  const geneMaxMetric = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of pop.alleleStats) {
      if (s.n < minCount) continue;
      const v = metricValue(s, metric);
      if (v > (map.get(s.gene) ?? -Infinity)) map.set(s.gene, v);
    }
    return map;
  }, [pop.alleleStats, minCount, metric]);

  // Gamified headline stats: the standout allele, how many beat the average,
  // and how many are top-tier — all respecting the min-count filter.
  const { mvp, winningCount, sTierCount } = useMemo(() => {
    let mvp: AlleleStat | null = null;
    let winningCount = 0;
    let sTierCount = 0;
    for (const s of pop.alleleStats) {
      if (s.n < minCount) continue;
      const v = metricValue(s, metric);
      if (v <= 0) continue;
      winningCount += 1;
      if (!mvp || v > metricValue(mvp, metric)) mvp = s;
      if (tierOf(v, geneMaxMetric.get(s.gene) ?? 0) === "S") sTierCount += 1;
    }
    return { mvp, winningCount, sTierCount };
  }, [pop.alleleStats, minCount, metric, geneMaxMetric]);

  if (pop.counted.length === 0) {
    return (
      <div className="card">
        <p className="muted">
          No scored individuals in this selection yet. Waiting for fitness
          data{generation !== "all" ? ` in generation ${generation}` : ""}.
        </p>
      </div>
    );
  }

  return (
    <div className="alleles">
      <div className="alleles__hero">
        <div className="alleles__hero-title">
          <span className="alleles__hero-icon" aria-hidden>
            🧬
          </span>
          <div>
            <h2>Allele Lab</h2>
            <p className="alleles__hero-sub">
              Which alleles break models — ranked by{" "}
              {metric === "mean"
                ? "lift over the population mean"
                : "success rate"}
              {generation === "all"
                ? " across all generations"
                : ` in generation ${generation}`}
              .
            </p>
          </div>
        </div>
        <div className="alleles__hero-kpis">
          {mvp ? (
            <div className="alleles__mvp">
              <span className="alleles__mvp-label">
                <span aria-hidden>👑</span> MVP allele
              </span>
              <span className="alleles__mvp-name">
                <code>{mvp.gene}</code> = {mvp.allele}
              </span>
              <span className="alleles__mvp-metric">
                {metric === "mean"
                  ? `lift ${signed(mvp.lift)}`
                  : `${fmt(mvp.successRate)} success`}
              </span>
            </div>
          ) : (
            <div className="alleles__mvp alleles__mvp--empty">
              <span className="alleles__mvp-label">
                <span aria-hidden>👑</span> MVP allele
              </span>
              <span className="muted">no standout yet</span>
            </div>
          )}
          <StatTile value={winningCount} label="winning alleles" />
          <StatTile value={sTierCount} label="S-tier alleles" />
        </div>
      </div>

      <Toolbar
        metric={metric}
        setMetric={setMetric}
        minCount={minCount}
        setMinCount={setMinCount}
        generation={generation}
        setGeneration={setGeneration}
        availableGenerations={availableGenerations}
        populationMean={pop.populationMean}
        counted={pop.counted.length}
      />

      <Leaderboard
        genes={genes}
        alleleStats={pop.alleleStats}
        metric={metric}
        minCount={minCount}
        geneMaxMetric={geneMaxMetric}
      />

      <FrequencyView individuals={individuals} genes={genes} />

      <CombinationView
        geneMap={geneMap}
        pop={pop}
        genes={genes}
        minCount={minCount}
      />

      <ParcatsView geneMap={geneMap} genes={genes} pop={pop} />
    </div>
  );
}

/* -- Toolbar ------------------------------------------------------------- */

function Toolbar({
  metric,
  setMetric,
  minCount,
  setMinCount,
  generation,
  setGeneration,
  availableGenerations,
  populationMean,
  counted,
}: {
  metric: MetricMode;
  setMetric: (m: MetricMode) => void;
  minCount: number;
  setMinCount: (n: number) => void;
  generation: GenerationFilter;
  setGeneration: (g: GenerationFilter) => void;
  availableGenerations: number[];
  populationMean: number;
  counted: number;
}) {
  return (
    <div className="card alleles__toolbar">
      <div className="alleles__toolbar-controls">
        <div className="alleles__metric-toggle" role="group" aria-label="Metric">
          <button
            type="button"
            className={`tab${metric === "mean" ? " tab--active" : ""}`}
            onClick={() => setMetric("mean")}
          >
            Mean fitness + lift
          </button>
          <button
            type="button"
            className={`tab${metric === "success" ? " tab--active" : ""}`}
            onClick={() => setMetric("success")}
          >
            Success rate
          </button>
        </div>

        <label className="field field--inline">
          <span>Min count</span>
          <input
            type="number"
            min={1}
            value={minCount}
            onChange={(e) =>
              setMinCount(Math.max(1, Number(e.target.value) || 1))
            }
            style={{ width: 70 }}
          />
        </label>

        <label className="field field--inline">
          <span>Generation</span>
          <select
            value={generation === "all" ? "all" : String(generation)}
            onChange={(e) =>
              setGeneration(
                e.target.value === "all" ? "all" : Number(e.target.value),
              )
            }
          >
            <option value="all">All</option>
            {availableGenerations.map((g) => (
              <option key={g} value={g}>
                Generation {g}
              </option>
            ))}
          </select>
        </label>

        <span className="muted alleles__pop">
          {counted} scored · pop. mean {fmt(populationMean)}
        </span>
      </div>

      <p className="alleles__note">
        Min-count hides low-sample alleles/pairs. Later generations inherit from
        winners; use <strong>Generation 0</strong> for the least biased estimate
        of an allele&rsquo;s intrinsic effect. Counts (<code>n</code>) are shown
        next to every mean/rate.
      </p>
    </div>
  );
}

/* -- View 1: Leaderboard -------------------------------------------------- */

function Leaderboard({
  genes,
  alleleStats,
  metric,
  minCount,
  geneMaxMetric,
}: {
  genes: GeneSchema[];
  alleleStats: AlleleStat[];
  metric: MetricMode;
  minCount: number;
  geneMaxMetric: Map<string, number>;
}) {
  const byGene = useMemo(() => {
    const map = new Map<string, AlleleStat[]>();
    for (const stat of alleleStats) {
      const list = map.get(stat.gene) ?? [];
      list.push(stat);
      map.set(stat.gene, list);
    }
    return map;
  }, [alleleStats]);

  const channels: { key: GeneSchema["channel"]; label: string }[] = [
    { key: "semantic", label: "Semantic" },
    { key: "perturbation", label: "Perturbation" },
  ];

  return (
    <div className="card">
      <h2 className="alleles__title">Allele leaderboard</h2>
      <p className="muted alleles__subtitle">
        Which alleles win.{" "}
        {metric === "mean"
          ? "Bars show lift (mean fitness − population mean); color encodes mean fitness."
          : "Bars show success rate (fraction of carriers reaching fitness 1.0)."}
      </p>

      {channels.map((channel) => {
        const channelGenes = genes.filter((g) => g.channel === channel.key);
        if (channelGenes.length === 0) return null;
        return (
          <div key={channel.key} className="alleles__channel">
            <h3 className="alleles__channel-title">{channel.label}</h3>
            <div className="alleles__gene-grid">
              {channelGenes.map((gene) => (
                <GeneBars
                  key={gene.name}
                  gene={gene}
                  stats={byGene.get(gene.name) ?? []}
                  metric={metric}
                  minCount={minCount}
                  geneMax={geneMaxMetric.get(gene.name) ?? 0}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function GeneBars({
  gene,
  stats,
  metric,
  minCount,
  geneMax,
}: {
  gene: GeneSchema;
  stats: AlleleStat[];
  metric: MetricMode;
  minCount: number;
  geneMax: number;
}) {
  const sorted = useMemo(
    () =>
      [...stats].sort((a, b) => metricValue(b, metric) - metricValue(a, metric)),
    [stats, metric],
  );

  // For "mean" mode the metric (lift) can be negative; scale by max magnitude.
  const maxMag = Math.max(
    0.0001,
    ...sorted.map((s) => Math.abs(metricValue(s, metric))),
  );

  // This gene's champion: the top allele, if it qualifies and beats the average.
  const topAllele =
    sorted.length > 0 &&
    sorted[0].n >= minCount &&
    metricValue(sorted[0], metric) > 0
      ? sorted[0].allele
      : null;

  return (
    <div className="allele-gene">
      <div className="allele-gene__head">
        <code>{gene.name}</code>
        <span className="muted allele-gene__type">{gene.type}</span>
      </div>
      <div className="allele-gene__bars">
        {sorted.map((stat) => {
          const value = metricValue(stat, metric);
          const below = stat.n < minCount;
          const isTop = stat.allele === topAllele;
          const tier = below ? null : tierOf(value, geneMax);
          const widthPct =
            metric === "success"
              ? Math.max(0, Math.min(1, value)) * 100
              : (Math.abs(value) / maxMag) * 100;
          const barColor =
            metric === "success" ? fitnessColor(value) : liftColor(value);
          return (
            <div
              key={stat.allele}
              className={`allele-bar${below ? " allele-bar--dim" : ""}${
                isTop ? " allele-bar--top" : ""
              }`}
              title={
                below
                  ? `Below min count (n=${stat.n} < ${minCount})`
                  : `n=${stat.n}, mean ${fmt(stat.meanFitness)}, lift ${signed(
                      stat.lift,
                    )}, success ${fmt(stat.successRate)}`
              }
            >
              <div className="allele-bar__row">
                <span className="allele-bar__name">
                  {isTop && (
                    <span className="allele-bar__crown" aria-hidden>
                      👑
                    </span>
                  )}
                  {stat.allele}
                </span>
                {tier && (
                  <span
                    className={`lb-tier lb-tier--${tier}`}
                    title={`Tier ${tier}`}
                  >
                    {tier}
                  </span>
                )}
                <span className="allele-bar__value">
                  {metric === "success"
                    ? fmt(stat.successRate)
                    : signed(stat.lift)}
                </span>
              </div>
              <div className="allele-bar__meter">
                <span className="allele-bar__track">
                  <span
                    className="allele-bar__fill"
                    style={{ width: `${widthPct}%`, background: barColor }}
                  />
                </span>
                <span className="allele-bar__n muted">n={stat.n}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* -- View 2: Frequency over generations (gamified "allele race") ---------- */

/** Format a 0..1 share as a percent, with one decimal only for small values. */
function pctLabel(value: number): string {
  const pct = value * 100;
  return `${pct.toFixed(pct > 0 && pct < 10 ? 1 : 0)}%`;
}

interface FreqStanding {
  allele: string;
  /** Line/area color, fixed by the allele's index so swatches match the chart. */
  color: string;
  /** Share in the latest generation (0..1). */
  latest: number;
  /** latest − share in the first generation (percentage-point momentum). */
  delta: number;
}

/** Rising/falling/steady badge for an allele's first→last share change. */
function Momentum({ delta }: { delta: number }) {
  const pp = delta * 100;
  if (Math.abs(pp) < 0.5) {
    return (
      <span className="freq-mom freq-mom--flat" title="Roughly steady since gen 0">
        ±0
      </span>
    );
  }
  const rising = pp > 0;
  return (
    <span
      className={`freq-mom freq-mom--${rising ? "up" : "down"}`}
      title={`${rising ? "Rising" : "Falling"} ${Math.abs(pp).toFixed(1)}pp since gen 0`}
    >
      {rising ? "▲" : "▼"} {Math.abs(pp).toFixed(1)}
    </span>
  );
}

/** One standings row: rank/medal, color-coded share bar, count-up percent. */
function FreqRow({ standing, rank }: { standing: FreqStanding; rank: number }) {
  const shown = useCountUp(standing.latest * 100);
  const medal = rank <= 3 ? ["👑", "🥈", "🥉"][rank - 1] : null;
  const widthPct = Math.max(2, Math.min(100, standing.latest * 100));
  return (
    <li
      className={`freq-row${rank === 1 ? " freq-row--leader" : ""}`}
      style={{ animationDelay: `${Math.min(rank, 12) * 40}ms` }}
    >
      <span className={`freq-row__rank${medal ? " freq-row__rank--medal" : ""}`}>
        {medal ?? rank}
      </span>
      <div className="freq-row__body">
        <div className="freq-row__head">
          <span className="freq-row__name">
            <span
              className="freq-row__dot"
              style={{ background: standing.color }}
            />
            {standing.allele}
          </span>
          <Momentum delta={standing.delta} />
        </div>
        <div className="freq-row__meter">
          <span
            className="freq-row__fill"
            style={{ width: `${widthPct}%`, background: standing.color }}
          />
        </div>
      </div>
      <span className="freq-row__share">
        {shown.toFixed(shown > 0 && shown < 10 ? 1 : 0)}%
      </span>
    </li>
  );
}

interface FreqTooltipProps {
  active?: boolean;
  label?: number | string;
  payload?: Array<{
    name?: string;
    value?: number;
    color?: string;
    dataKey?: string | number;
  }>;
}

/** Custom chart tooltip: a per-generation board of allele shares, ranked. */
function FreqTooltip({ active, payload, label }: FreqTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const rows = payload
    .filter((p) => typeof p.value === "number")
    .sort((a, b) => (b.value as number) - (a.value as number));
  return (
    <div className="freq-tip">
      <div className="freq-tip__gen">Generation {label}</div>
      <ul className="freq-tip__list">
        {rows.map((r) => (
          <li key={String(r.dataKey)}>
            <span className="freq-tip__dot" style={{ background: r.color }} />
            <span className="freq-tip__name">{r.name}</span>
            <span className="freq-tip__val">{pctLabel(r.value as number)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const FREQ_GRID = "#edeef1";
const FREQ_AXIS_LINE = "#e7e8ea";
const FREQ_TICK = { fill: "#6b6e76", fontSize: 12, fontWeight: 500 } as const;
const FREQ_AXIS_LABEL = { fill: "#9a9da5", fontSize: 11 } as const;
// Fixed 0–100% scale, shared by both chart types and the standings bars: the
// axis is never zoomed, so a small carrier share can never look like a big one.
const PCT_TICKS = [0, 0.25, 0.5, 0.75, 1];
const pctTick = (v: number): string => `${Math.round(v * 100)}%`;

function FrequencyView({
  individuals,
  genes,
}: {
  individuals: IndividualRecord[];
  genes: GeneSchema[];
}) {
  const [geneName, setGeneName] = useState(genes[0]?.name ?? "");
  const gene = genes.find((g) => g.name === geneName) ?? genes[0];

  const { alleles, points } = useMemo(
    () =>
      gene
        ? alleleFrequencyByGeneration(individuals, gene)
        : { generations: [], alleles: [], points: [] },
    [individuals, gene],
  );

  // Current standings: each allele's latest share + first→last momentum. Color
  // is captured by the allele's index in `alleles` so it matches its chart line
  // even after we sort by latest share descending.
  const standings = useMemo<FreqStanding[]>(() => {
    if (points.length === 0) return [];
    const first = points[0];
    const last = points[points.length - 1];
    return alleles
      .map((allele, i) => {
        const latest = last[allele] ?? 0;
        const firstVal = first[allele] ?? 0;
        return {
          allele,
          color: SERIES_COLORS[i % SERIES_COLORS.length],
          latest,
          delta: latest - firstVal,
        };
      })
      .sort((a, b) => b.latest - a.latest);
  }, [points, alleles]);

  // The allele whose share shifted most across the run (>= 0.5pp to count).
  const topMover = useMemo(() => {
    let best: FreqStanding | null = null;
    for (const s of standings) {
      if (!best || Math.abs(s.delta) > Math.abs(best.delta)) best = s;
    }
    return best && Math.abs(best.delta) >= 0.005 ? best : null;
  }, [standings]);

  if (!gene) return null;
  const isMulti = gene.type === "multi_categorical";
  const lastGen = points.length ? points[points.length - 1].generation : null;
  const single = points.length <= 1; // one generation -> show dots, not lines
  const leaderShare = standings[0]?.latest ?? 0;

  return (
    <div className="freq">
      <div className="freq__head">
        <div className="freq__title">
          <span className="freq__icon" aria-hidden>
            📈
          </span>
          <div>
            <h2>Allele frequency over generations</h2>
            <p className="freq__sub">
              {isMulti
                ? "Each allele's carrier share per generation — lines overlap and need not sum to 100%."
                : "Allele proportions per generation (they sum to 100%) — watch selection pressure crown a winner."}
            </p>
          </div>
        </div>
        <label className="field field--inline">
          <span>Gene</span>
          <select value={geneName} onChange={(e) => setGeneName(e.target.value)}>
            {genes.map((g) => (
              <option key={g.name} value={g.name}>
                {g.name} ({g.channel})
              </option>
            ))}
          </select>
        </label>
      </div>

      {points.length === 0 ? (
        <div className="freq-empty">
          <span className="freq-empty__icon" aria-hidden>
            🏁
          </span>
          <p className="freq-empty__title">No race yet</p>
          <p className="muted">
            Allele shares appear here the moment individuals are scored.
          </p>
        </div>
      ) : (
        <>
          <div className="freq__kpis">
            <StatTile value={points.length} label="generations" />
            <StatTile value={alleles.length} label="alleles tracked" />
            <StatTile
              value={leaderShare * 100}
              label="leader share"
              format={(v) => `${Math.round(v)}%`}
            />
            {topMover ? (
              <div className="freq__mover">
                <span className="freq__mover-label">
                  <span aria-hidden>⚡</span> biggest mover
                </span>
                <span className="freq__mover-name">
                  <span
                    className="freq-row__dot"
                    style={{ background: topMover.color }}
                  />
                  {topMover.allele}
                </span>
                <Momentum delta={topMover.delta} />
              </div>
            ) : (
              <div className="freq__mover freq__mover--flat">
                <span className="freq__mover-label">
                  <span aria-hidden>⚡</span> biggest mover
                </span>
                <span className="muted">all steady</span>
              </div>
            )}
          </div>

          <div className="freq__grid">
            <div className="freq__chart">
              <ResponsiveContainer width="100%" height={324}>
                {isMulti ? (
                  <LineChart
                    data={points}
                    margin={{ top: 12, right: 22, bottom: 16, left: 0 }}
                  >
                    <CartesianGrid
                      vertical={false}
                      stroke={FREQ_GRID}
                      strokeDasharray="4 4"
                    />
                    <XAxis
                      dataKey="generation"
                      type="number"
                      allowDecimals={false}
                      domain={["dataMin", "dataMax"]}
                      tickLine={false}
                      axisLine={{ stroke: FREQ_AXIS_LINE }}
                      tick={FREQ_TICK}
                      tickMargin={8}
                      padding={{ left: 14, right: 14 }}
                      label={{
                        value: "generation",
                        position: "insideBottom",
                        offset: -4,
                        ...FREQ_AXIS_LABEL,
                      }}
                    />
                    <YAxis
                      domain={[0, 1]}
                      ticks={PCT_TICKS}
                      tickLine={false}
                      axisLine={false}
                      tick={FREQ_TICK}
                      tickFormatter={pctTick}
                      width={44}
                    />
                    <Tooltip
                      content={<FreqTooltip />}
                      cursor={{ stroke: "#c7c9cf", strokeDasharray: "4 4" }}
                    />
                    {alleles.map((allele, i) => (
                      <Line
                        key={allele}
                        type="monotone"
                        dataKey={allele}
                        name={allele}
                        stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                        strokeWidth={2.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        dot={single ? { r: 3, strokeWidth: 0 } : false}
                        activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }}
                        connectNulls
                        isAnimationActive
                        animationDuration={750}
                        animationEasing="ease-out"
                      />
                    ))}
                  </LineChart>
                ) : (
                  <AreaChart
                    data={points}
                    margin={{ top: 12, right: 22, bottom: 16, left: 0 }}
                  >
                    <defs>
                      {alleles.map((allele, i) => {
                        const c = SERIES_COLORS[i % SERIES_COLORS.length];
                        return (
                          <linearGradient
                            key={allele}
                            id={`freq-grad-${i}`}
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop offset="0%" stopColor={c} stopOpacity={0.85} />
                            <stop offset="100%" stopColor={c} stopOpacity={0.4} />
                          </linearGradient>
                        );
                      })}
                    </defs>
                    <CartesianGrid
                      vertical={false}
                      stroke={FREQ_GRID}
                      strokeDasharray="4 4"
                    />
                    <XAxis
                      dataKey="generation"
                      type="number"
                      allowDecimals={false}
                      domain={["dataMin", "dataMax"]}
                      tickLine={false}
                      axisLine={{ stroke: FREQ_AXIS_LINE }}
                      tick={FREQ_TICK}
                      tickMargin={8}
                      padding={{ left: 14, right: 14 }}
                      label={{
                        value: "generation",
                        position: "insideBottom",
                        offset: -4,
                        ...FREQ_AXIS_LABEL,
                      }}
                    />
                    <YAxis
                      domain={[0, 1]}
                      ticks={PCT_TICKS}
                      tickLine={false}
                      axisLine={false}
                      tick={FREQ_TICK}
                      tickFormatter={pctTick}
                      width={44}
                    />
                    <Tooltip
                      content={<FreqTooltip />}
                      cursor={{ stroke: "#c7c9cf", strokeDasharray: "4 4" }}
                    />
                    {alleles.map((allele, i) => (
                      <Area
                        key={allele}
                        type="monotone"
                        dataKey={allele}
                        name={allele}
                        stackId="1"
                        stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                        strokeWidth={2}
                        strokeLinejoin="round"
                        fill={`url(#freq-grad-${i})`}
                        dot={single ? { r: 3, strokeWidth: 0 } : false}
                        activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }}
                        isAnimationActive
                        animationDuration={750}
                        animationEasing="ease-out"
                      />
                    ))}
                  </AreaChart>
                )}
              </ResponsiveContainer>
            </div>

            <div className="freq__standings">
              <div className="freq__standings-head">
                <h3>Standings</h3>
                {lastGen !== null && (
                  <span className="freq__standings-gen">generation {lastGen}</span>
                )}
              </div>
              <ol className="freq-list">
                {standings.map((s, i) => (
                  <FreqRow key={s.allele} standing={s} rank={i + 1} />
                ))}
              </ol>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* -- View 3: Combination heatmap + synergy ranking ------------------------ */

function CombinationView({
  geneMap,
  genes,
  pop,
  minCount,
}: {
  geneMap: Map<string, GeneSchema>;
  genes: GeneSchema[];
  pop: ReturnType<typeof computePopulationStats>;
  minCount: number;
}) {
  const [geneAName, setGeneAName] = useState(genes[0]?.name ?? "");
  const [geneBName, setGeneBName] = useState(
    genes[1]?.name ?? genes[0]?.name ?? "",
  );

  const geneA = geneMap.get(geneAName);
  const geneB = geneMap.get(geneBName);

  const pairs = useMemo(
    () => rankSynergyPairs(pop, genes, minCount),
    [pop, genes, minCount],
  );

  const selectPair = (pair: PairStat) => {
    setGeneAName(pair.geneA);
    setGeneBName(pair.geneB);
  };

  return (
    <div className="card">
      <h2 className="alleles__title">Combinations &amp; synergy</h2>
      <p className="muted alleles__subtitle">
        Which alleles work together. Cells show mean fitness of individuals
        carrying both; cells below min count are greyed.
      </p>

      <div className="alleles__combo">
        <div className="alleles__heatmap-wrap">
          <div className="alleles__view-head">
            <label className="field field--inline">
              <span>Gene A (rows)</span>
              <select
                value={geneAName}
                onChange={(e) => setGeneAName(e.target.value)}
              >
                {genes.map((g) => (
                  <option key={g.name} value={g.name}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field field--inline">
              <span>Gene B (cols)</span>
              <select
                value={geneBName}
                onChange={(e) => setGeneBName(e.target.value)}
              >
                {genes.map((g) => (
                  <option key={g.name} value={g.name}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {geneA && geneB && geneA.name === geneB.name ? (
            <p className="muted">
              Pick two different genes to see their combinations.
            </p>
          ) : geneA && geneB ? (
            <Heatmap
              geneA={geneA}
              geneB={geneB}
              counted={pop.counted}
              minCount={minCount}
            />
          ) : null}
        </div>

        <div className="alleles__synergy">
          <h3 className="alleles__channel-title">Top synergistic allele pairs</h3>
          {pairs.length === 0 ? (
            <p className="muted">
              No pairs with at least {minCount} co-carriers yet.
            </p>
          ) : (
            <ol className="synergy-list">
              {pairs.slice(0, 25).map((pair, i) => (
                <li key={`${pair.geneA}:${pair.alleleA}|${pair.geneB}:${pair.alleleB}`}>
                  <button
                    type="button"
                    className="synergy-row"
                    onClick={() => selectPair(pair)}
                    title="Show this pair in the heatmap"
                  >
                    <span className="synergy-row__rank" aria-hidden>
                      {i < 3 ? ["🥇", "🥈", "🥉"][i] : i + 1}
                    </span>
                    <span className="synergy-row__pair">
                      <code>
                        {pair.geneA}={pair.alleleA}
                      </code>{" "}
                      +{" "}
                      <code>
                        {pair.geneB}={pair.alleleB}
                      </code>
                    </span>
                    <span
                      className="synergy-row__value"
                      style={{
                        color: pair.synergy >= 0 ? "#16a34a" : "#d1495b",
                      }}
                    >
                      synergy {signed(pair.synergy)}
                    </span>
                    <span className="muted synergy-row__n">(n={pair.n})</span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}

function Heatmap({
  geneA,
  geneB,
  counted,
  minCount,
}: {
  geneA: GeneSchema;
  geneB: GeneSchema;
  counted: IndividualRecord[];
  minCount: number;
}) {
  const rows = allelesOf(geneA);
  const cols = allelesOf(geneB);

  return (
    <div className="heatmap-scroll">
      <table className="heatmap">
        <thead>
          <tr>
            <th className="heatmap__corner">
              <span className="muted">{geneA.name}</span>
              <span className="muted">\ {geneB.name}</span>
            </th>
            {cols.map((col) => (
              <th key={col} className="heatmap__colhead">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row}>
              <th className="heatmap__rowhead">{row}</th>
              {cols.map((col) => {
                const { n, coMean } = coCarrierStats(
                  counted,
                  geneA,
                  row,
                  geneB,
                  col,
                );
                const below = n < minCount;
                return (
                  <td
                    key={col}
                    className={`heatmap__cell${below ? " heatmap__cell--dim" : ""}`}
                    style={
                      below
                        ? undefined
                        : { background: fitnessColor(coMean), color: "#fff" }
                    }
                    title={
                      n === 0
                        ? "No co-carriers"
                        : `mean ${fmt(coMean)} · n=${n}${
                            below ? ` (below min ${minCount})` : ""
                          }`
                    }
                  >
                    {n === 0 ? (
                      <span className="muted">—</span>
                    ) : (
                      <>
                        <span className="heatmap__cell-mean">{fmt(coMean)}</span>
                        <span className="heatmap__cell-n">n={n}</span>
                      </>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* -- View 4: Parallel categories — gamified "run flow" -------------------- */

const PARCATS_WIDTH_PER_AXIS = 196;
const PARCATS_HEIGHT = 480;
const PARCATS_TOP = 46;
const PARCATS_BOTTOM = 30;
const PARCATS_LEFT = 64;
const SEGMENT_GAP = 8;
const SEGMENT_W = 16;

function defaultParcatsGenes(genes: GeneSchema[]): string[] {
  const categorical = genes
    .filter((g) => g.type === "categorical")
    .slice(0, 4)
    .map((g) => g.name);
  const booleans = genes
    .filter((g) => g.type === "boolean")
    .slice(0, 2)
    .map((g) => g.name);
  const chosen = [...categorical, ...booleans];
  return chosen.length > 0 ? chosen : genes.slice(0, 4).map((g) => g.name);
}

interface ParcatsSegment {
  label: string;
  y: number;
  height: number;
  centerY: number;
  count: number;
  /** Mean fitness of individuals in this category on this axis (the tint). */
  avg: number;
}
interface ParcatsAxis {
  gene: GeneSchema;
  x: number;
  segments: Map<string, ParcatsSegment>;
}
interface ParcatsPoint {
  x: number;
  y: number;
  gene: string;
  label: string;
}
interface ParcatsPath {
  id: string;
  fitness: number;
  pts: ParcatsPoint[];
  /** Pre-built smooth cubic path so hover re-renders don't recompute it. */
  d: string;
}

/** Smooth horizontal cubic spline through the station centers (Sankey-like). */
function ribbonPath(pts: ParcatsPoint[]): string {
  if (pts.length === 0) return "";
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i += 1) {
    const a = pts[i - 1];
    const b = pts[i];
    const cx = (a.x + b.x) / 2;
    d += ` C ${cx} ${a.y} ${cx} ${b.y} ${b.x} ${b.y}`;
  }
  return d;
}

function pathPassesKey(p: ParcatsPath, key: string): boolean {
  return p.pts.some((pt) => `${pt.gene}:${pt.label}` === key);
}

function truncateLabel(label: string, max = 18): string {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

function ParcatsLegend({ hasChampion }: { hasChampion: boolean }) {
  const gradient = `linear-gradient(90deg, ${fitnessColor(0)}, ${fitnessColor(
    0.25,
  )}, ${fitnessColor(0.5)}, ${fitnessColor(0.75)}, ${fitnessColor(1)})`;
  return (
    <div className="parcats__legend">
      <div className="parcats__legend-item">
        <span className="parcats__legend-title">
          Fitness — ribbon &amp; station color
        </span>
        <div className="parcats__legend-fit">
          <span className="parcats__legend-bar" style={{ background: gradient }} />
          <span className="parcats__legend-ticks">
            <span>0.0</span>
            <span>0.5</span>
            <span>1.0</span>
          </span>
        </div>
      </div>
      {hasChampion && (
        <div className="parcats__legend-item">
          <span className="parcats__legend-champ" />
          <span className="muted">champion run 👑 (highest fitness)</span>
        </div>
      )}
      <div className="parcats__legend-item">
        <span className="parcats__legend-seg" />
        <span className="muted">station height = share of runs</span>
      </div>
    </div>
  );
}

function ParcatsView({
  geneMap,
  genes,
  pop,
}: {
  geneMap: Map<string, GeneSchema>;
  genes: GeneSchema[];
  pop: ReturnType<typeof computePopulationStats>;
}) {
  const [selected, setSelected] = useState<string[]>(() =>
    defaultParcatsGenes(genes),
  );
  const [hovered, setHovered] = useState<string | null>(null);

  // Memoize so the heavy layout only recomputes when the axes or data change.
  const axisGenes = useMemo(
    () =>
      selected
        .map((name) => geneMap.get(name))
        .filter((g): g is GeneSchema => g != null),
    [selected, geneMap],
  );

  const layout = useMemo(() => {
    const counted = pop.counted;
    const total = counted.length || 1;
    const plotHeight = PARCATS_HEIGHT - PARCATS_TOP - PARCATS_BOTTOM;

    const axes: ParcatsAxis[] = axisGenes.map((gene, axisIdx) => {
      // Per category: how many runs pass through, and their mean fitness.
      const agg = new Map<string, { count: number; sum: number }>();
      for (const ind of counted) {
        const label = categoryLabel(ind, gene);
        const a = agg.get(label) ?? { count: 0, sum: 0 };
        a.count += 1;
        a.sum += ind.fitness as number;
        agg.set(label, a);
      }
      const labels = Array.from(agg.keys()).sort();
      const totalGap = SEGMENT_GAP * Math.max(0, labels.length - 1);
      const usable = Math.max(10, plotHeight - totalGap);
      const segments = new Map<string, ParcatsSegment>();
      let cursor = PARCATS_TOP;
      for (const label of labels) {
        const { count, sum } = agg.get(label)!;
        const height = Math.max(3, (count / total) * usable);
        segments.set(label, {
          label,
          y: cursor,
          height,
          centerY: cursor + height / 2,
          count,
          avg: count ? sum / count : 0,
        });
        cursor += height + SEGMENT_GAP;
      }
      return {
        gene,
        x: PARCATS_LEFT + axisIdx * PARCATS_WIDTH_PER_AXIS,
        segments,
      };
    });

    const segByKey = new Map<string, { x: number; seg: ParcatsSegment }>();
    for (const axis of axes) {
      for (const seg of axis.segments.values()) {
        segByKey.set(`${axis.gene.name}:${seg.label}`, { x: axis.x, seg });
      }
    }

    const paths: ParcatsPath[] = counted.map((ind) => {
      const pts: ParcatsPoint[] = axes.map((axis) => {
        const label = categoryLabel(ind, axis.gene);
        const seg = axis.segments.get(label);
        return {
          x: axis.x,
          y: seg ? seg.centerY : PARCATS_TOP,
          gene: axis.gene.name,
          label,
        };
      });
      return {
        id: String(ind.individual_id),
        fitness: ind.fitness as number,
        pts,
        d: ribbonPath(pts),
      };
    });

    // Champion = the single highest-fitness run (must score > 0 to highlight).
    let champion: ParcatsPath | null = null;
    for (const p of paths) {
      if (p.fitness > 0 && (!champion || p.fitness > champion.fitness)) {
        champion = p;
      }
    }

    // Hottest station = highest mean fitness among well-populated categories.
    // A minimum count keeps a lone lucky run from crowning a category.
    const minSeg = Math.max(2, Math.ceil(total * 0.03));
    let hottest: { gene: string; seg: ParcatsSegment } | null = null;
    for (const axis of axes) {
      for (const seg of axis.segments.values()) {
        if (seg.count < minSeg) continue;
        if (!hottest || seg.avg > hottest.seg.avg) {
          hottest = { gene: axis.gene.name, seg };
        }
      }
    }

    return { axes, paths, segByKey, champion, hottest, total };
  }, [axisGenes, pop.counted]);

  const toggleGene = (name: string) =>
    setSelected((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
    );

  const { champion, hottest, total } = layout;
  const svgWidth =
    PARCATS_LEFT + Math.max(1, axisGenes.length) * PARCATS_WIDTH_PER_AXIS + 24;
  const hoveredSeg = hovered ? layout.segByKey.get(hovered) : undefined;
  const bestFitness = champion?.fitness ?? 0;
  // The champion run stays emphasized unless a hovered station excludes it.
  const showChamp =
    champion != null && (hovered == null || pathPassesKey(champion, hovered));

  return (
    <div className="parcats">
      <div className="parcats__head">
        <div className="parcats__title">
          <span className="parcats__icon" aria-hidden>
            🧭
          </span>
          <div>
            <h2>Parallel categories</h2>
            <p className="parcats__sub">
              Every individual is a <strong>run</strong> flowing left→right
              through its genes; ribbon color is its fitness and each station is
              tinted by the average fitness of the runs through it. Hover a
              station to trace its runs.
            </p>
          </div>
        </div>
      </div>

      <div className="parcats__kpis">
        <StatTile value={total} label="runs" />
        <StatTile value={axisGenes.length} label="checkpoints" />
        {hottest ? (
          <div className="parcats__call">
            <span className="parcats__call-label">
              <span aria-hidden>🔥</span> hottest station
            </span>
            <span className="parcats__call-name">
              <code>{hottest.gene}</code> = {hottest.seg.label}
            </span>
            <span
              className="fitness-chip fitness-chip--sm"
              style={{ background: fitnessColor(hottest.seg.avg) }}
            >
              {hottest.seg.avg.toFixed(2)}
            </span>
          </div>
        ) : (
          <div className="parcats__call parcats__call--flat">
            <span className="parcats__call-label">
              <span aria-hidden>🔥</span> hottest station
            </span>
            <span className="muted">not enough data</span>
          </div>
        )}
        {champion && (
          <div className="parcats__call parcats__call--champ">
            <span className="parcats__call-label">
              <span aria-hidden>👑</span> champion run
            </span>
            <span className="parcats__call-name">
              <code>{champion.id}</code>
            </span>
            <span
              className="fitness-chip fitness-chip--sm"
              style={{ background: fitnessColor(bestFitness) }}
            >
              {bestFitness.toFixed(2)}
            </span>
          </div>
        )}
      </div>

      <div className="parcats__picker">
        <span className="parcats__picker-label">Axes</span>
        {genes.map((gene) => {
          const active = selected.includes(gene.name);
          return (
            <button
              key={gene.name}
              type="button"
              className={`parcats__chip${active ? " parcats__chip--on" : ""}`}
              aria-pressed={active}
              onClick={() => toggleGene(gene.name)}
            >
              {gene.name}
            </button>
          );
        })}
      </div>

      {champion && axisGenes.length >= 2 && (
        <div className="parcats__loadout">
          <span className="parcats__loadout-label">
            <span aria-hidden>👑</span> winning build
          </span>
          <div className="parcats__loadout-chips">
            {champion.pts.map((pt) => (
              <span
                key={pt.gene}
                className="parcats__loadout-chip"
                title={`${pt.gene} = ${pt.label}`}
              >
                <span className="parcats__loadout-gene">{pt.gene}</span>
                <span className="parcats__loadout-val">{pt.label}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {axisGenes.length < 2 ? (
        <div className="parcats__empty">
          <span className="parcats__empty-icon" aria-hidden>
            🧭
          </span>
          <p className="parcats__empty-title">Pick at least two axes</p>
          <p className="muted">
            Toggle genes above to chart how runs flow between their categories.
          </p>
        </div>
      ) : (
        <div className="parcats__scroll">
          <div
            className="parcats__canvas"
            style={{ width: svgWidth, height: PARCATS_HEIGHT }}
          >
            <svg
              className="parcats__svg"
              width={svgWidth}
              height={PARCATS_HEIGHT}
              viewBox={`0 0 ${svgWidth} ${PARCATS_HEIGHT}`}
              role="img"
              aria-label="Parallel categories of genome alleles by fitness"
            >
              <defs>
                <filter
                  id="parcats-glow"
                  x="-50%"
                  y="-50%"
                  width="200%"
                  height="200%"
                >
                  <feGaussianBlur stdDeviation="3.2" result="b" />
                  <feMerge>
                    <feMergeNode in="b" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* axis guide rails */}
              <g className="parcats__rails">
                {layout.axes.map((axis) => (
                  <line
                    key={axis.gene.name}
                    className="parcats__rail"
                    x1={axis.x}
                    x2={axis.x}
                    y1={PARCATS_TOP - 6}
                    y2={PARCATS_HEIGHT - PARCATS_BOTTOM + 6}
                  />
                ))}
              </g>

              {/* ribbons (one per run) */}
              <g className="parcats__ribbons">
                {layout.paths.map((p) => {
                  const isHot = hovered != null && pathPassesKey(p, hovered);
                  return (
                    <path
                      key={p.id}
                      d={p.d}
                      fill="none"
                      stroke={fitnessColor(p.fitness)}
                      strokeWidth={isHot ? 2.4 : 1.1}
                      strokeOpacity={hovered == null ? 0.24 : isHot ? 0.9 : 0.05}
                      strokeLinecap="round"
                    />
                  );
                })}
              </g>

              {/* champion run overlay */}
              {showChamp && champion && (
                <g
                  className="parcats__champ"
                  style={{ color: fitnessColor(bestFitness) }}
                >
                  <path
                    d={champion.d}
                    fill="none"
                    className="parcats__champ-glow"
                    filter="url(#parcats-glow)"
                  />
                  <path
                    d={champion.d}
                    fill="none"
                    className="parcats__champ-line"
                  />
                  {hovered == null && (
                    <path
                      d={champion.d}
                      fill="none"
                      className="parcats__champ-flow"
                    />
                  )}
                </g>
              )}

              {/* stations + checkpoint headers */}
              {layout.axes.map((axis, axisIdx) => {
                const pillW = Math.min(
                  PARCATS_WIDTH_PER_AXIS - 18,
                  axis.gene.name.length * 7.2 + 22,
                );
                return (
                  <g key={axis.gene.name}>
                    <g transform={`translate(${axis.x}, 0)`}>
                      <rect
                        className="parcats__pill"
                        x={-pillW / 2}
                        y={6}
                        width={pillW}
                        height={20}
                        rx={10}
                      />
                      <text
                        className="parcats__pill-text"
                        x={0}
                        y={16}
                        textAnchor="middle"
                        dominantBaseline="central"
                      >
                        {axis.gene.name}
                      </text>
                      <text
                        className="parcats__pill-sub"
                        x={0}
                        y={37}
                        textAnchor="middle"
                      >
                        {axis.segments.size} categories
                      </text>
                    </g>
                    {Array.from(axis.segments.values()).map((seg) => {
                      const key = `${axis.gene.name}:${seg.label}`;
                      const active = hovered === key;
                      const hitH = Math.max(seg.height, 16);
                      return (
                        <g
                          key={key}
                          className={`parcats__seg${active ? " parcats__seg--active" : ""}`}
                          style={{ animationDelay: `${Math.min(axisIdx, 8) * 55}ms` }}
                          onMouseEnter={() => setHovered(key)}
                          onMouseLeave={() =>
                            setHovered((h) => (h === key ? null : h))
                          }
                        >
                          <rect
                            className="parcats__seg-hit"
                            x={axis.x - SEGMENT_W / 2 - 2}
                            y={seg.centerY - hitH / 2}
                            width={156}
                            height={hitH}
                          />
                          <rect
                            className="parcats__seg-rect"
                            x={axis.x - SEGMENT_W / 2}
                            y={seg.y}
                            width={SEGMENT_W}
                            height={seg.height}
                            rx={Math.min(SEGMENT_W / 2, seg.height / 2)}
                            fill={fitnessColor(seg.avg)}
                          />
                          <text
                            className="parcats__seg-label"
                            x={axis.x + SEGMENT_W / 2 + 8}
                            y={seg.centerY}
                            dominantBaseline="central"
                          >
                            {truncateLabel(seg.label)}
                          </text>
                        </g>
                      );
                    })}
                  </g>
                );
              })}
            </svg>

            {hoveredSeg && (
              <div
                className="parcats__tip"
                style={{ left: hoveredSeg.x, top: hoveredSeg.seg.centerY }}
              >
                <div className="parcats__tip-label">{hoveredSeg.seg.label}</div>
                <div className="parcats__tip-row">
                  <span
                    className="fitness-chip fitness-chip--sm"
                    style={{ background: fitnessColor(hoveredSeg.seg.avg) }}
                  >
                    {hoveredSeg.seg.avg.toFixed(2)}
                  </span>
                  <span className="muted">avg fitness</span>
                </div>
                <div className="parcats__tip-meta">
                  {hoveredSeg.seg.count} runs ·{" "}
                  {Math.round((hoveredSeg.seg.count / total) * 100)}% of axis
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <ParcatsLegend hasChampion={champion != null} />
    </div>
  );
}
