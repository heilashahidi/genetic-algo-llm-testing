import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { IndividualRecord } from "../types";
import { useCountUp } from "../useCountUp";
import { fitnessColor, formatFitness, originClass } from "./IndividualDetail";

interface Props {
  individuals: IndividualRecord[];
  /** id of the currently selected individual (single source of truth). */
  selectedId: string | null;
  onSelect: (id: string) => void;
}

// Layout constants.
const COL_WIDTH = 164;
const ROW_HEIGHT = 60;
const NODE_SLOT = 18; // half-gutter used to centre nodes in their grid cell
const R_MIN = 7;
const R_MAX = 17;
const TOP_PAD = 60; // room for the "GEN n" header row
const SIDE_PAD = 48;
const LANE_W = COL_WIDTH - 26;

const ZOOM_MIN = 0.4;
const ZOOM_MAX = 2.2;
const ZOOM_STEP = 0.2;

type EdgeMode = "focus" | "all";

// Edge color per child origin — the same semantic palette used everywhere else.
const ORIGIN_VAR: Record<string, string> = {
  crossover: "--blue",
  mutation: "--amber",
  elite: "--green",
  recombinant: "--teal",
  seed: "--accent",
  random: "--violet",
};
function edgeColor(origin: string | null): string {
  const v = origin ? ORIGIN_VAR[origin] : undefined;
  return v ? `var(${v})` : "var(--line)";
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Node radius encodes fitness: bigger = fitter. Untested → the minimum dot. */
function nodeRadius(f: number | null | undefined): number {
  if (f == null || Number.isNaN(f)) return R_MIN;
  return R_MIN + (R_MAX - R_MIN) * clamp(f, 0, 1);
}

interface Node {
  ind: IndividualRecord;
  id: string;
  x: number;
  y: number;
  r: number;
  col: number;
  leader: boolean; // best of its generation
}

interface Edge {
  key: string;
  d: string;
  parentId: string;
  childId: string;
  origin: string | null;
}

interface Lane {
  gen: number;
  col: number;
  x: number;
  avg: number;
  count: number;
}

/**
 * Collect the ancestry (parents, recursively) and descendants (children,
 * recursively) of a node id, so the selection can emphasise its lineage.
 */
function lineageOf(
  rootId: string,
  byId: Map<string, IndividualRecord>,
  childrenOf: Map<string, string[]>,
): Set<string> {
  const related = new Set<string>([rootId]);
  const walkUp = (id: string) => {
    const ind = byId.get(id);
    if (!ind) return;
    for (const p of [ind.parent_a_id, ind.parent_b_id]) {
      if (p == null) continue;
      const pid = String(p);
      if (byId.has(pid) && !related.has(pid)) {
        related.add(pid);
        walkUp(pid);
      }
    }
  };
  const walkDown = (id: string) => {
    for (const cid of childrenOf.get(id) ?? []) {
      if (!related.has(cid)) {
        related.add(cid);
        walkDown(cid);
      }
    }
  };
  walkUp(rootId);
  walkDown(rootId);
  return related;
}

/** Edge keys along a node's ancestry (parent links, recursively upward). */
function ancestryEdges(rootId: string, byId: Map<string, IndividualRecord>): Set<string> {
  const edges = new Set<string>();
  const seen = new Set<string>([rootId]);
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop()!;
    const ind = byId.get(id);
    if (!ind) continue;
    for (const p of [ind.parent_a_id, ind.parent_b_id]) {
      if (p == null) continue;
      const pid = String(p);
      if (!byId.has(pid)) continue;
      edges.add(`${pid}->${id}`);
      if (!seen.has(pid)) {
        seen.add(pid);
        stack.push(pid);
      }
    }
  }
  return edges;
}

/** A game-HUD stat tile with an icon and a count-up value. */
function StatPill({
  icon,
  value,
  label,
  tone,
  format,
  color,
}: {
  icon: string;
  value: number;
  label: string;
  tone?: "solved";
  format?: (v: number) => string;
  color?: string;
}) {
  const shown = useCountUp(value);
  const text = format ? format(shown) : Math.round(shown).toLocaleString();
  return (
    <div
      className={`lineage__hud-stat${tone ? ` lineage__hud-stat--${tone}` : ""}`}
    >
      <span className="lineage__hud-icon" aria-hidden>
        {icon}
      </span>
      <span className="lineage__hud-val" style={color ? { color } : undefined}>
        {text}
      </span>
      <span className="lineage__hud-label">{label}</span>
    </div>
  );
}

export function LineageTree({ individuals, selectedId, onSelect }: Props) {
  const [zoom, setZoom] = useState(1);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [hoveredCol, setHoveredCol] = useState<number | null>(null);
  const [edgeMode, setEdgeMode] = useState<EdgeMode>("all");

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const pendingFocal = useRef<
    { contentX: number; contentY: number; lx: number; ly: number } | null
  >(null);
  const pan = useRef({ active: false, x: 0, y: 0, sl: 0, st: 0 });
  const draggedRef = useRef(false);
  // True once the user manually zooms/pans; suspends auto fit-to-view so we
  // never yank their chosen view out from under them.
  const userControlledRef = useRef(false);

  const {
    byId,
    childrenOf,
    columns,
    lanes,
    nodes,
    edges,
    championId,
    championEdges,
    recordIds,
    width,
    height,
  } = useMemo(() => {
    const byId = new Map<string, IndividualRecord>();
    for (const ind of individuals) byId.set(String(ind.individual_id), ind);

    const childrenOf = new Map<string, string[]>();
    for (const ind of individuals) {
      const cid = String(ind.individual_id);
      for (const p of [ind.parent_a_id, ind.parent_b_id]) {
        if (p == null) continue;
        const pid = String(p);
        if (!byId.has(pid)) continue;
        const list = childrenOf.get(pid) ?? [];
        if (!list.includes(cid)) list.push(cid);
        childrenOf.set(pid, list);
      }
    }

    const genMap = new Map<number, IndividualRecord[]>();
    for (const ind of individuals) {
      const list = genMap.get(ind.generation) ?? [];
      list.push(ind);
      genMap.set(ind.generation, list);
    }
    const gens = Array.from(genMap.keys()).sort((a, b) => a - b);

    const sortCol = (list: IndividualRecord[]) =>
      [...list].sort((a, b) => {
        const fa = a.fitness ?? -1;
        const fb = b.fitness ?? -1;
        if (fb !== fa) return fb - fa;
        return String(a.individual_id).localeCompare(String(b.individual_id));
      });

    const columns = gens.map((g) => ({ gen: g, items: sortCol(genMap.get(g)!) }));

    const nodes = new Map<string, Node>();
    const lanes: Lane[] = [];
    columns.forEach((col, colIdx) => {
      const cx = SIDE_PAD + colIdx * COL_WIDTH + NODE_SLOT;
      const avg =
        col.items.reduce((s, i) => s + (i.fitness ?? 0), 0) /
        Math.max(1, col.items.length);
      lanes.push({ gen: col.gen, col: colIdx, x: cx, avg, count: col.items.length });
      col.items.forEach((ind, rowIdx) => {
        const id = String(ind.individual_id);
        nodes.set(id, {
          ind,
          id,
          x: cx,
          y: TOP_PAD + rowIdx * ROW_HEIGHT + NODE_SLOT,
          r: nodeRadius(ind.fitness),
          col: colIdx,
          leader: rowIdx === 0 && (ind.fitness ?? 0) > 0,
        });
      });
    });

    const edges: Edge[] = [];
    for (const ind of individuals) {
      const childId = String(ind.individual_id);
      const childNode = nodes.get(childId);
      if (!childNode) continue;
      for (const p of [ind.parent_a_id, ind.parent_b_id]) {
        if (p == null) continue;
        const pid = String(p);
        const parentNode = nodes.get(pid);
        if (!parentNode) continue;
        const midX = (parentNode.x + childNode.x) / 2;
        edges.push({
          key: `${pid}->${childId}`,
          d: `M ${parentNode.x} ${parentNode.y} C ${midX} ${parentNode.y}, ${midX} ${childNode.y}, ${childNode.x} ${childNode.y}`,
          parentId: pid,
          childId,
          origin: ind.origin,
        });
      }
    }

    let championId: string | null = null;
    let bestFit = 0;
    for (const ind of individuals) {
      const f = ind.fitness ?? 0;
      if (f > bestFit) {
        bestFit = f;
        championId = String(ind.individual_id);
      }
    }
    const championEdges =
      championId && bestFit > 0 ? ancestryEdges(championId, byId) : new Set<string>();

    // Milestone nodes: the individual that set a new run-best fitness in its
    // generation. Monotonic improvements — the story of the search's progress.
    const recordIds = new Set<string>();
    let runningBest = 0;
    for (const col of columns) {
      const leader = col.items[0]; // sorted fitness-desc, so [0] is the gen best
      const f = leader?.fitness ?? 0;
      if (f > runningBest && f > 0) {
        recordIds.add(String(leader.individual_id));
        runningBest = f;
      }
    }

    const maxRows = columns.reduce((m, c) => Math.max(m, c.items.length), 0);
    const width = SIDE_PAD * 2 + columns.length * COL_WIDTH;
    const height = TOP_PAD + maxRows * ROW_HEIGHT + ROW_HEIGHT;

    return {
      byId,
      childrenOf,
      columns,
      lanes,
      nodes,
      edges,
      championId: bestFit > 0 ? championId : null,
      championEdges,
      recordIds,
      width,
      height,
    };
  }, [individuals]);

  const highlighted = useMemo(() => {
    if (!selectedId || !byId.has(selectedId)) return null;
    return lineageOf(selectedId, byId, childrenOf);
  }, [selectedId, byId, childrenOf]);

  const zoomTo = useCallback(
    (next: number, fx?: number, fy?: number) => {
      userControlledRef.current = true;
      const clamped = +clamp(next, ZOOM_MIN, ZOOM_MAX).toFixed(2);
      const el = scrollRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        const lx = (fx ?? rect.left + rect.width / 2) - rect.left;
        const ly = (fy ?? rect.top + rect.height / 2) - rect.top;
        pendingFocal.current = {
          contentX: (el.scrollLeft + lx) / zoom,
          contentY: (el.scrollTop + ly) / zoom,
          lx,
          ly,
        };
      }
      setZoom(clamped);
    },
    [zoom],
  );

  useLayoutEffect(() => {
    const el = scrollRef.current;
    const pf = pendingFocal.current;
    if (el && pf) {
      el.scrollLeft = pf.contentX * zoom - pf.lx;
      el.scrollTop = pf.contentY * zoom - pf.ly;
      pendingFocal.current = null;
    }
  }, [zoom]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const dir = e.deltaY > 0 ? -1 : 1;
      zoomTo(zoom + dir * 0.18, e.clientX, e.clientY);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoom, zoomTo]);

  // Scale the whole tree to fit the viewport (never zooming past 100%).
  const fitToView = useCallback(() => {
    const el = scrollRef.current;
    if (!el || width <= 0 || height <= 0) return;
    const pad = 24; // breathing room around the content
    const scaleX = (el.clientWidth - pad) / width;
    const scaleY = (el.clientHeight - pad) / height;
    const fit = clamp(Math.min(1, scaleX, scaleY), ZOOM_MIN, ZOOM_MAX);
    pendingFocal.current = null;
    setZoom(+fit.toFixed(3));
    el.scrollLeft = 0;
    el.scrollTop = 0;
  }, [width, height]);

  // Auto-fit on first load and as the tree (or its viewport) changes size,
  // until the user takes manual control of zoom/pan.
  useLayoutEffect(() => {
    if (!userControlledRef.current) fitToView();
  }, [fitToView]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (!userControlledRef.current) fitToView();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [fitToView]);

  const onPanMove = useCallback((e: MouseEvent) => {
    const el = scrollRef.current;
    if (!el || !pan.current.active) return;
    const dx = e.clientX - pan.current.x;
    const dy = e.clientY - pan.current.y;
    // Promote to a real drag only past a small threshold. Until then this stays
    // a click, so the node underneath stays hit-testable and selection works
    // (panning sets is-panning, which disables node pointer-events).
    if (!draggedRef.current && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
      draggedRef.current = true;
      userControlledRef.current = true;
      el.classList.add("is-panning");
    }
    el.scrollLeft = pan.current.sl - dx;
    el.scrollTop = pan.current.st - dy;
  }, []);
  const onPanUp = useCallback(() => {
    pan.current.active = false;
    scrollRef.current?.classList.remove("is-panning");
    window.removeEventListener("mousemove", onPanMove);
    window.removeEventListener("mouseup", onPanUp);
  }, [onPanMove]);
  const onPanDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      const el = scrollRef.current;
      if (!el) return;
      pan.current = {
        active: true,
        x: e.clientX,
        y: e.clientY,
        sl: el.scrollLeft,
        st: el.scrollTop,
      };
      draggedRef.current = false;
      window.addEventListener("mousemove", onPanMove);
      window.addEventListener("mouseup", onPanUp);
    },
    [onPanMove, onPanUp],
  );

  const resetView = useCallback(() => {
    userControlledRef.current = false;
    fitToView();
  }, [fitToView]);

  if (individuals.length === 0) {
    return (
      <div className="empty">
        <span className="lineage__empty-icon" aria-hidden>
          🧬
        </span>
        <p>Spawning the first generation…</p>
      </div>
    );
  }

  const hasSelection = highlighted != null;
  const solved = individuals.filter((i) => (i.fitness ?? 0) >= 1).length;
  const best = individuals.reduce((m, i) => Math.max(m, i.fitness ?? 0), 0);

  const hoveredNode = hoveredId ? nodes.get(hoveredId) : undefined;
  const tipBelow = hoveredNode ? hoveredNode.y * zoom < 116 : false;

  // Per-edge render decision. Default ("focus") keeps the canvas calm: only the
  // champion bloodline is always drawn; hovering or selecting reveals the rest.
  type EdgeStyle = "flow" | "calm" | "reveal" | "dim" | "hidden";
  const edgeStyleFor = (e: Edge): EdgeStyle => {
    const inSelection =
      hasSelection && highlighted!.has(e.childId) && highlighted!.has(e.parentId);
    if (edgeMode === "all") {
      if (hasSelection) return inSelection ? "flow" : "dim";
      return championEdges.has(e.key) ? "flow" : "calm";
    }
    // focus mode
    if (hasSelection) return inSelection ? "flow" : "hidden";
    if (championEdges.has(e.key)) return "flow";
    if (hoveredId && (e.parentId === hoveredId || e.childId === hoveredId)) {
      return "reveal";
    }
    return "hidden";
  };

  return (
    <div className="lineage">
      <div className="lineage__toolbar">
        <div className="lineage__hud">
          <StatPill icon="🧬" value={individuals.length} label="individuals" />
          <StatPill icon="🌱" value={columns.length} label="generations" />
          <StatPill icon="🔓" value={solved} label="solved" tone="solved" />
          <StatPill
            icon="⭐"
            value={best}
            label="best fitness"
            format={(v) => v.toFixed(2)}
            color={fitnessColor(best)}
          />
        </div>
        <div className="lineage__toolbar-right">
          <div className="lineage__seg" role="group" aria-label="Connections">
            <span className="lineage__seg-label">links</span>
            <button
              type="button"
              className={"lineage__seg-btn" + (edgeMode === "focus" ? " is-active" : "")}
              onClick={() => setEdgeMode("focus")}
            >
              Focus
            </button>
            <button
              type="button"
              className={"lineage__seg-btn" + (edgeMode === "all" ? " is-active" : "")}
              onClick={() => setEdgeMode("all")}
            >
              All
            </button>
          </div>
          <span className="lineage__hint">drag · ⌘-scroll · hover to trace</span>
        </div>
      </div>

      <div className="lineage__scroll" ref={scrollRef} onMouseDown={onPanDown}>
        <div
          className="lineage__canvas"
          style={{ width: width * zoom, height: height * zoom }}
        >
          <svg
            className="lineage__svg"
            width={width * zoom}
            height={height * zoom}
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label="Genetic algorithm lineage tree"
          >
            <defs>
              <filter id="ln-shadow" x="-60%" y="-60%" width="220%" height="220%">
                <feDropShadow
                  dx="0"
                  dy="1.5"
                  stdDeviation="2.2"
                  floodColor="#0b0b18"
                  floodOpacity="0.22"
                />
              </filter>
              <radialGradient id="ln-sheen" cx="36%" cy="28%" r="78%">
                <stop offset="0%" stopColor="#fff" stopOpacity="0.62" />
                <stop offset="42%" stopColor="#fff" stopOpacity="0.14" />
                <stop offset="100%" stopColor="#fff" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Generation lanes — soft backdrop heatmap tinted by avg fitness */}
            <g className="lineage__lanes">
              {lanes.map((lane) => (
                <rect
                  key={`lane-${lane.gen}`}
                  className="lineage__lane"
                  x={lane.x - LANE_W / 2}
                  y={TOP_PAD - 8}
                  width={LANE_W}
                  height={height - TOP_PAD - 4}
                  rx={16}
                  fill={fitnessColor(lane.avg)}
                  style={{ opacity: hoveredCol === lane.col ? 0.16 : 0.06 }}
                />
              ))}
            </g>

            {/* Generation headers */}
            {lanes.map((lane) => (
              <g
                key={`hdr-${lane.gen}`}
                onMouseEnter={() => setHoveredCol(lane.col)}
                onMouseLeave={() =>
                  setHoveredCol((c) => (c === lane.col ? null : c))
                }
              >
                <text x={lane.x} y={26} className="lineage__col-label" textAnchor="middle">
                  GEN {lane.gen}
                </text>
                <text x={lane.x} y={41} className="lineage__col-count" textAnchor="middle">
                  {lane.count}
                </text>
              </g>
            ))}

            {/* Edges (progressive disclosure) */}
            <g className="lineage__edges">
              {edges.map((e) => {
                const style = edgeStyleFor(e);
                if (style === "hidden") return null;
                const color = edgeColor(e.origin);
                if (style === "calm") {
                  return (
                    <path
                      key={e.key}
                      d={e.d}
                      className="lineage__edge"
                      style={{ stroke: color, opacity: 0.26 }}
                    />
                  );
                }
                if (style === "dim") {
                  return (
                    <path
                      key={e.key}
                      d={e.d}
                      className="lineage__edge"
                      style={{ stroke: color, opacity: 0.06 }}
                    />
                  );
                }
                if (style === "reveal") {
                  return (
                    <path
                      key={e.key}
                      d={e.d}
                      className="lineage__edge lineage__edge--reveal"
                      style={{ stroke: color, opacity: 0.9, strokeWidth: 1.8 }}
                    />
                  );
                }
                // flow
                return (
                  <g key={e.key}>
                    <path
                      d={e.d}
                      className="lineage__edge"
                      style={{ stroke: color, opacity: 0.34, strokeWidth: 2 }}
                    />
                    <path d={e.d} className="lineage__flow" style={{ stroke: color }} />
                  </g>
                );
              })}
            </g>

            {/* Nodes */}
            <g className="lineage__nodes">
              {Array.from(nodes.values()).map((n) => {
                const selected = n.id === selectedId;
                const dimmed = hasSelection && !highlighted!.has(n.id);
                const champ = n.id === championId;
                const isRecord = recordIds.has(n.id) && !champ;
                const cls =
                  "lineage__node" +
                  (dimmed ? " lineage__node--dim" : "") +
                  (selected ? " lineage__node--selected" : "");
                return (
                  <g
                    key={n.id}
                    className={cls}
                    transform={`translate(${n.x}, ${n.y})`}
                    onClick={() => {
                      if (draggedRef.current) return;
                      onSelect(n.id);
                    }}
                    onMouseEnter={() => setHoveredId(n.id)}
                    onMouseLeave={() => setHoveredId((h) => (h === n.id ? null : h))}
                    role="button"
                    aria-label={`Individual ${n.id}, fitness ${formatFitness(
                      n.ind.fitness,
                    )}`}
                  >
                    <g
                      className="lineage__node-enter"
                      style={{ animationDelay: `${n.col * 45}ms` }}
                    >
                      <g className="lineage__node-inner">
                        {champ && <circle className="lineage__node-halo" r={n.r + 8} />}
                        {selected ? (
                          <circle className="lineage__node-ring--selected" r={n.r + 5} />
                        ) : champ ? (
                          <circle className="lineage__node-ring--champ" r={n.r + 4} />
                        ) : n.leader ? (
                          <circle className="lineage__node-ring--leader" r={n.r + 3.5} />
                        ) : null}
                        <g filter="url(#ln-shadow)">
                          <circle
                            className="lineage__node-circle"
                            r={n.r}
                            fill={fitnessColor(n.ind.fitness)}
                          />
                          <circle
                            className="lineage__node-sheen"
                            r={n.r}
                            fill="url(#ln-sheen)"
                          />
                        </g>
                        {champ && (
                          <g className="lineage__crown" aria-hidden="true">
                            <text
                              className="lineage__crown-text"
                              y={-(n.r + 9)}
                              textAnchor="middle"
                            >
                              👑
                            </text>
                          </g>
                        )}
                        {isRecord && (
                          <text
                            className="lineage__spark"
                            aria-hidden="true"
                            x={n.r * 0.62}
                            y={-(n.r * 0.62)}
                            textAnchor="middle"
                          >
                            ✦
                          </text>
                        )}
                        {selected && n.ind.fitness != null && (
                          <text
                            className="lineage__node-text"
                            textAnchor="middle"
                            dominantBaseline="central"
                          >
                            {formatFitness(n.ind.fitness)}
                          </text>
                        )}
                      </g>
                    </g>
                  </g>
                );
              })}
            </g>
          </svg>

          {hoveredNode && (
            <div
              className={"lineage__tip" + (tipBelow ? " lineage__tip--below" : "")}
              style={{ left: hoveredNode.x * zoom, top: hoveredNode.y * zoom }}
            >
              <div className="lineage__tip-id">{hoveredNode.id}</div>
              <div className="lineage__tip-row">
                <span className="lineage__tip-gen">gen {hoveredNode.ind.generation}</span>
                {hoveredNode.ind.origin && (
                  <span className={originClass(hoveredNode.ind.origin)}>
                    {hoveredNode.ind.origin}
                  </span>
                )}
                <span
                  className="fitness-chip fitness-chip--sm"
                  style={{ background: fitnessColor(hoveredNode.ind.fitness) }}
                >
                  {formatFitness(hoveredNode.ind.fitness)}
                </span>
                {hoveredNode.id === championId && (
                  <span className="lineage__tip-champ">★ champion</span>
                )}
              </div>
              {(hoveredNode.ind.parent_a_id != null ||
                hoveredNode.ind.parent_b_id != null) && (
                <div className="lineage__tip-parents">
                  parents:{" "}
                  <code>
                    {hoveredNode.ind.parent_a_id == null
                      ? "—"
                      : String(hoveredNode.ind.parent_a_id)}
                  </code>
                  {hoveredNode.ind.parent_b_id != null && (
                    <>
                      {" · "}
                      <code>{String(hoveredNode.ind.parent_b_id)}</code>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="lineage__controls">
          <button
            type="button"
            className="lineage__zoom-btn"
            onClick={() => zoomTo(zoom - ZOOM_STEP)}
            disabled={zoom <= ZOOM_MIN}
            aria-label="Zoom out"
          >
            −
          </button>
          <span className="lineage__zoom-val">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            className="lineage__zoom-btn"
            onClick={() => zoomTo(zoom + ZOOM_STEP)}
            disabled={zoom >= ZOOM_MAX}
            aria-label="Zoom in"
          >
            +
          </button>
          <button type="button" className="lineage__reset" onClick={resetView}>
            Fit
          </button>
        </div>
      </div>

      <Legend />
    </div>
  );
}

const EDGE_KEYS: [string, string][] = [
  ["crossover", "--blue"],
  ["mutation", "--amber"],
  ["elite", "--green"],
  ["recombinant", "--teal"],
];

function Legend() {
  const gradient = `linear-gradient(90deg, ${fitnessColor(0)}, ${fitnessColor(
    0.25,
  )}, ${fitnessColor(0.5)}, ${fitnessColor(0.75)}, ${fitnessColor(1)})`;
  return (
    <div className="lineage__legend">
      <div className="lineage__legend-item">
        <span className="lineage__legend-title">Fitness — color + size</span>
        <div className="lineage__legend-fit">
          <span className="lineage__legend-bar" style={{ background: gradient }} />
          <span className="lineage__legend-ticks">
            <span>0.0</span>
            <span>0.5</span>
            <span>1.0</span>
          </span>
        </div>
      </div>
      <div className="lineage__legend-item">
        <span className="lineage__legend-champ" />
        <span className="muted">champion 👑 + bloodline</span>
      </div>
      <div className="lineage__legend-item">
        <span className="lineage__legend-spark" aria-hidden>
          ✦
        </span>
        <span className="muted">new best (milestone)</span>
      </div>
      <div className="lineage__legend-item">
        <span className="lineage__legend-leader" />
        <span className="muted">generation leader</span>
      </div>
      <div className="lineage__legend-item lineage__legend-edges">
        {EDGE_KEYS.map(([label, v]) => (
          <span key={label} className="lineage__legend-edge">
            <span className="lineage__legend-line" style={{ background: `var(${v})` }} />
            <span className="muted">{label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
