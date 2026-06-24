import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
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
}: {
  genes: GeneSchema[];
  alleleStats: AlleleStat[];
  metric: MetricMode;
  minCount: number;
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
}: {
  gene: GeneSchema;
  stats: AlleleStat[];
  metric: MetricMode;
  minCount: number;
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
          const widthPct =
            metric === "success"
              ? Math.max(0, Math.min(1, value)) * 100
              : (Math.abs(value) / maxMag) * 100;
          const barColor =
            metric === "success"
              ? fitnessColor(value)
              : liftColor(value);
          return (
            <div
              key={stat.allele}
              className={`allele-bar${below ? " allele-bar--dim" : ""}`}
              title={
                below
                  ? `Below min count (n=${stat.n} < ${minCount})`
                  : `n=${stat.n}, mean ${fmt(stat.meanFitness)}, lift ${signed(
                      stat.lift,
                    )}, success ${fmt(stat.successRate)}`
              }
            >
              <span className="allele-bar__label">{stat.allele}</span>
              <span className="allele-bar__track">
                <span
                  className="allele-bar__fill"
                  style={{ width: `${widthPct}%`, background: barColor }}
                />
              </span>
              <span className="allele-bar__value">
                {metric === "success" ? fmt(stat.successRate) : signed(stat.lift)}
              </span>
              <span className="allele-bar__n muted">n={stat.n}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* -- View 2: Frequency over generations ----------------------------------- */

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

  if (!gene) return null;
  const isMulti = gene.type === "multi_categorical";

  return (
    <div className="card">
      <div className="alleles__view-head">
        <h2 className="alleles__title">Allele frequency over generations</h2>
        <label className="field field--inline">
          <span>Gene</span>
          <select
            value={geneName}
            onChange={(e) => setGeneName(e.target.value)}
          >
            {genes.map((g) => (
              <option key={g.name} value={g.name}>
                {g.name} ({g.channel})
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="muted alleles__subtitle">
        {isMulti
          ? "Carrier fraction per generation for each allele (overlapping; need not sum to 1)."
          : "Allele proportions per generation (sums to 1) — shows selection pressure."}
      </p>

      {points.length === 0 ? (
        <p className="muted">No scored individuals to chart.</p>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          {isMulti ? (
            <LineChart
              data={points}
              margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e7e8ea" />
              <XAxis dataKey="generation" type="number" allowDecimals={false} />
              <YAxis domain={[0, 1]} />
              <Tooltip />
              <Legend />
              {alleles.map((allele, i) => (
                <Line
                  key={allele}
                  type="monotone"
                  dataKey={allele}
                  name={allele}
                  stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                  dot={false}
                  connectNulls
                />
              ))}
            </LineChart>
          ) : (
            <AreaChart
              data={points}
              margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e7e8ea" />
              <XAxis dataKey="generation" type="number" allowDecimals={false} />
              <YAxis domain={[0, 1]} />
              <Tooltip />
              <Legend />
              {alleles.map((allele, i) => (
                <Area
                  key={allele}
                  type="monotone"
                  dataKey={allele}
                  name={allele}
                  stackId="1"
                  stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                  fill={SERIES_COLORS[i % SERIES_COLORS.length]}
                  fillOpacity={0.6}
                />
              ))}
            </AreaChart>
          )}
        </ResponsiveContainer>
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
              {pairs.slice(0, 25).map((pair) => (
                <li key={`${pair.geneA}:${pair.alleleA}|${pair.geneB}:${pair.alleleB}`}>
                  <button
                    type="button"
                    className="synergy-row"
                    onClick={() => selectPair(pair)}
                    title="Show this pair in the heatmap"
                  >
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

/* -- View 4: Parallel categories (SVG) ------------------------------------ */

const PARCATS_WIDTH_PER_AXIS = 170;
const PARCATS_HEIGHT = 460;
const PARCATS_TOP = 30;
const PARCATS_BOTTOM = 24;
const SEGMENT_GAP = 6;
const SEGMENT_W = 18;

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

interface AxisLayout {
  gene: GeneSchema;
  x: number;
  segments: Map<string, { y: number; height: number; count: number }>;
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

  const axisGenes = selected
    .map((name) => geneMap.get(name))
    .filter((g): g is GeneSchema => g != null);

  const layout = useMemo(() => {
    const counted = pop.counted;
    const plotHeight = PARCATS_HEIGHT - PARCATS_TOP - PARCATS_BOTTOM;
    const axes: AxisLayout[] = axisGenes.map((gene, axisIdx) => {
      const labelCounts = new Map<string, number>();
      for (const ind of counted) {
        const label = categoryLabel(ind, gene);
        labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1);
      }
      const labels = Array.from(labelCounts.keys()).sort();
      const total = counted.length || 1;
      const totalGap = SEGMENT_GAP * Math.max(0, labels.length - 1);
      const usable = Math.max(10, plotHeight - totalGap);
      const segments = new Map<
        string,
        { y: number; height: number; count: number }
      >();
      let cursor = PARCATS_TOP;
      for (const label of labels) {
        const count = labelCounts.get(label) ?? 0;
        const height = Math.max(2, (count / total) * usable);
        segments.set(label, { y: cursor, height, count });
        cursor += height + SEGMENT_GAP;
      }
      return {
        gene,
        x: 60 + axisIdx * PARCATS_WIDTH_PER_AXIS,
        segments,
      };
    });

    // Build a polyline per individual through each axis segment center.
    const paths = counted.map((ind) => {
      const pts = axes.map((axis) => {
        const label = categoryLabel(ind, axis.gene);
        const seg = axis.segments.get(label);
        const y = seg ? seg.y + seg.height / 2 : PARCATS_TOP;
        return { x: axis.x, y, label, gene: axis.gene.name };
      });
      return {
        id: String(ind.individual_id),
        fitness: ind.fitness as number,
        pts,
      };
    });

    return { axes, paths };
  }, [axisGenes, pop.counted]);

  const svgWidth =
    60 + Math.max(1, axisGenes.length) * PARCATS_WIDTH_PER_AXIS + 20;

  const toggleGene = (name: string) => {
    setSelected((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
    );
  };

  return (
    <div className="card">
      <h2 className="alleles__title">Parallel categories</h2>
      <p className="muted alleles__subtitle">
        Each line is one individual, colored by fitness. Where high-fitness
        lines bundle through the same categories, that combination is a winning
        path.
      </p>

      <div className="parcats__axis-picker">
        {genes.map((gene) => (
          <label key={gene.name} className="parcats__check">
            <input
              type="checkbox"
              checked={selected.includes(gene.name)}
              onChange={() => toggleGene(gene.name)}
            />
            <code>{gene.name}</code>
          </label>
        ))}
      </div>

      {axisGenes.length < 2 ? (
        <p className="muted">Select at least two genes as axes.</p>
      ) : (
        <div className="parcats__scroll">
          <svg
            width={svgWidth}
            height={PARCATS_HEIGHT}
            className="parcats__svg"
            role="img"
            aria-label="Parallel categories of genome alleles by fitness"
          >
            {/* Polylines (individuals) */}
            <g>
              {layout.paths.map((path) => {
                const isHot =
                  hovered != null &&
                  path.pts.some((p) => `${p.gene}:${p.label}` === hovered);
                const d = path.pts
                  .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
                  .join(" ");
                return (
                  <path
                    key={path.id}
                    d={d}
                    fill="none"
                    stroke={fitnessColor(path.fitness)}
                    strokeWidth={isHot ? 2.4 : 1.2}
                    strokeOpacity={
                      hovered == null ? 0.28 : isHot ? 0.95 : 0.06
                    }
                  />
                );
              })}
            </g>

            {/* Axis segments + labels */}
            {layout.axes.map((axis) => (
              <g key={axis.gene.name}>
                <text
                  x={axis.x}
                  y={16}
                  textAnchor="middle"
                  className="parcats__axis-label"
                >
                  {axis.gene.name}
                </text>
                {Array.from(axis.segments.entries()).map(([label, seg]) => {
                  const key = `${axis.gene.name}:${label}`;
                  return (
                    <g
                      key={key}
                      onMouseEnter={() => setHovered(key)}
                      onMouseLeave={() => setHovered(null)}
                    >
                      <rect
                        x={axis.x - SEGMENT_W / 2}
                        y={seg.y}
                        width={SEGMENT_W}
                        height={seg.height}
                        className="parcats__segment"
                      />
                      <text
                        x={axis.x + SEGMENT_W / 2 + 4}
                        y={seg.y + seg.height / 2}
                        dominantBaseline="central"
                        className="parcats__segment-label"
                      >
                        {label} ({seg.count})
                      </text>
                    </g>
                  );
                })}
              </g>
            ))}
          </svg>
        </div>
      )}
    </div>
  );
}
