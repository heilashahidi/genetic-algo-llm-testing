import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { IndividualRecord } from "../types";
import { fitnessColor, formatFitness, originClass } from "./IndividualDetail";

interface Props {
  individuals: IndividualRecord[];
  /** id of the currently selected individual (single source of truth). */
  selectedId: string | null;
  onSelect: (id: string) => void;
}

// Layout constants.
const COL_WIDTH = 156;
const ROW_HEIGHT = 58;
const NODE_R = 15;
const TOP_PAD = 56; // room for the "Generation N" header row
const SIDE_PAD = 44;

const ZOOM_MIN = 0.4;
const ZOOM_MAX = 2.2;
const ZOOM_STEP = 0.2;

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

interface Node {
  ind: IndividualRecord;
  id: string;
  x: number;
  y: number;
}

interface Edge {
  key: string;
  d: string;
  parentId: string;
  childId: string;
  origin: string | null;
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

export function LineageTree({ individuals, selectedId, onSelect }: Props) {
  const [zoom, setZoom] = useState(1);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  // Focal point preserved across a zoom so the graph zooms toward the cursor /
  // viewport centre instead of jumping to the origin.
  const pendingFocal = useRef<
    { contentX: number; contentY: number; lx: number; ly: number } | null
  >(null);
  // Pan-drag bookkeeping (refs so a drag never triggers re-renders).
  const pan = useRef({ active: false, x: 0, y: 0, sl: 0, st: 0 });
  const draggedRef = useRef(false);

  const { byId, childrenOf, columns, nodes, edges, width, height } = useMemo(() => {
    const byId = new Map<string, IndividualRecord>();
    for (const ind of individuals) {
      byId.set(String(ind.individual_id), ind);
    }

    // children index: parent id -> child ids
    const childrenOf = new Map<string, string[]>();
    for (const ind of individuals) {
      const cid = String(ind.individual_id);
      for (const p of [ind.parent_a_id, ind.parent_b_id]) {
        if (p == null) continue;
        const pid = String(p);
        if (!byId.has(pid)) continue; // skip seed-library refs not in this run
        const list = childrenOf.get(pid) ?? [];
        if (!list.includes(cid)) list.push(cid);
        childrenOf.set(pid, list);
      }
    }

    // Group by generation -> columns sorted ascending.
    const genMap = new Map<number, IndividualRecord[]>();
    for (const ind of individuals) {
      const list = genMap.get(ind.generation) ?? [];
      list.push(ind);
      genMap.set(ind.generation, list);
    }
    const gens = Array.from(genMap.keys()).sort((a, b) => a - b);

    // Within a column sort by fitness desc (nulls last), then id for stability.
    const sortCol = (list: IndividualRecord[]) =>
      [...list].sort((a, b) => {
        const fa = a.fitness ?? -1;
        const fb = b.fitness ?? -1;
        if (fb !== fa) return fb - fa;
        return String(a.individual_id).localeCompare(String(b.individual_id));
      });

    const columns = gens.map((g) => ({ gen: g, items: sortCol(genMap.get(g)!) }));

    const nodes = new Map<string, Node>();
    columns.forEach((col, colIdx) => {
      col.items.forEach((ind, rowIdx) => {
        const id = String(ind.individual_id);
        nodes.set(id, {
          ind,
          id,
          x: SIDE_PAD + colIdx * COL_WIDTH + NODE_R,
          y: TOP_PAD + rowIdx * ROW_HEIGHT + NODE_R,
        });
      });
    });

    // Edges (child -> parent geometry), only when the parent is a known node.
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

    const maxRows = columns.reduce((m, c) => Math.max(m, c.items.length), 0);
    const width = SIDE_PAD * 2 + columns.length * COL_WIDTH;
    const height = TOP_PAD + maxRows * ROW_HEIGHT + ROW_HEIGHT;

    return { byId, childrenOf, columns, nodes, edges, width, height };
  }, [individuals]);

  const highlighted = useMemo(() => {
    if (!selectedId || !byId.has(selectedId)) return null;
    return lineageOf(selectedId, byId, childrenOf);
  }, [selectedId, byId, childrenOf]);

  // Zoom toward a focal client point (defaults to the viewport centre).
  const zoomTo = useCallback(
    (next: number, fx?: number, fy?: number) => {
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

  // After a zoom commits, restore the focal point's screen position.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    const pf = pendingFocal.current;
    if (el && pf) {
      el.scrollLeft = pf.contentX * zoom - pf.lx;
      el.scrollTop = pf.contentY * zoom - pf.ly;
      pendingFocal.current = null;
    }
  }, [zoom]);

  // ⌘/Ctrl + wheel zooms toward the cursor (native listener so we can preventDefault).
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

  // Drag-to-pan on the canvas background. A real (non-dragged) click still selects.
  const onPanMove = useCallback((e: MouseEvent) => {
    const el = scrollRef.current;
    if (!el || !pan.current.active) return;
    const dx = e.clientX - pan.current.x;
    const dy = e.clientY - pan.current.y;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) draggedRef.current = true;
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
      el.classList.add("is-panning");
      window.addEventListener("mousemove", onPanMove);
      window.addEventListener("mouseup", onPanUp);
    },
    [onPanMove, onPanUp],
  );

  const resetView = useCallback(() => {
    pendingFocal.current = null;
    setZoom(1);
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) {
        el.scrollLeft = 0;
        el.scrollTop = 0;
      }
    });
  }, []);

  if (individuals.length === 0) {
    return (
      <div className="empty">
        <p>Waiting for the first generation…</p>
      </div>
    );
  }

  const hasSelection = highlighted != null;
  const solved = individuals.filter((i) => (i.fitness ?? 0) >= 1).length;
  const best = individuals.reduce(
    (m, i) => Math.max(m, i.fitness ?? 0),
    0,
  );

  const hoveredNode = hoveredId ? nodes.get(hoveredId) : undefined;
  const tipBelow = hoveredNode ? hoveredNode.y * zoom < 104 : false;

  return (
    <div className="lineage">
      <div className="lineage__toolbar">
        <div className="lineage__stats">
          <span className="lineage__stat">
            <b>{individuals.length}</b> individuals
          </span>
          <span className="lineage__stat">
            <b>{columns.length}</b> generations
          </span>
          <span className="lineage__stat lineage__stat--solved">
            <b>{solved}</b> solved
          </span>
          <span className="lineage__stat">
            best <b>{best.toFixed(2)}</b>
          </span>
        </div>
        <span className="lineage__hint">drag to pan · ⌘-scroll to zoom</span>
      </div>

      <div
        className="lineage__scroll"
        ref={scrollRef}
        onMouseDown={onPanDown}
      >
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
              <filter
                id="ln-shadow"
                x="-60%"
                y="-60%"
                width="220%"
                height="220%"
              >
                <feDropShadow
                  dx="0"
                  dy="1.5"
                  stdDeviation="2.2"
                  floodColor="#0b0b18"
                  floodOpacity="0.22"
                />
              </filter>
              <radialGradient id="ln-sheen" cx="36%" cy="28%" r="78%">
                <stop offset="0%" stopColor="#fff" stopOpacity="0.6" />
                <stop offset="42%" stopColor="#fff" stopOpacity="0.14" />
                <stop offset="100%" stopColor="#fff" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Generation column headers + faint lane rules */}
            {columns.map((col, colIdx) => {
              const cx = SIDE_PAD + colIdx * COL_WIDTH + NODE_R;
              return (
                <g key={`hdr-${col.gen}`}>
                  <line
                    className="lineage__col-rule"
                    x1={cx}
                    y1={TOP_PAD - 10}
                    x2={cx}
                    y2={height - 16}
                  />
                  <text
                    x={cx}
                    y={24}
                    className="lineage__col-label"
                    textAnchor="middle"
                  >
                    GEN {col.gen}
                  </text>
                  <text
                    x={cx}
                    y={38}
                    className="lineage__col-count"
                    textAnchor="middle"
                  >
                    {col.items.length}
                  </text>
                </g>
              );
            })}

            {/* Edges first so nodes sit on top */}
            <g className="lineage__edges">
              {edges.map((e) => {
                const color = edgeColor(e.origin);
                if (!hasSelection) {
                  return (
                    <path
                      key={e.key}
                      d={e.d}
                      className="lineage__edge"
                      style={{ stroke: color, opacity: 0.5 }}
                    />
                  );
                }
                const active =
                  highlighted!.has(e.childId) && highlighted!.has(e.parentId);
                if (!active) {
                  return (
                    <path
                      key={e.key}
                      d={e.d}
                      className="lineage__edge"
                      style={{ stroke: color, opacity: 0.07 }}
                    />
                  );
                }
                return (
                  <g key={e.key}>
                    <path
                      d={e.d}
                      className="lineage__edge"
                      style={{ stroke: color, opacity: 0.32, strokeWidth: 2 }}
                    />
                    <path
                      d={e.d}
                      className="lineage__flow"
                      style={{ stroke: color }}
                    />
                  </g>
                );
              })}
            </g>

            {/* Nodes */}
            <g className="lineage__nodes">
              {Array.from(nodes.values()).map((n) => {
                const selected = n.id === selectedId;
                const dimmed = hasSelection && !highlighted!.has(n.id);
                const top = (n.ind.fitness ?? 0) >= 1.0;
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
                    onMouseLeave={() =>
                      setHoveredId((h) => (h === n.id ? null : h))
                    }
                    role="button"
                    aria-label={`Individual ${n.id}, fitness ${formatFitness(
                      n.ind.fitness,
                    )}`}
                  >
                    <g className="lineage__node-inner">
                      {top && (
                        <circle className="lineage__node-halo" r={NODE_R + 7} />
                      )}
                      {top && !selected && (
                        <circle className="lineage__node-ring" r={NODE_R + 4} />
                      )}
                      {selected && (
                        <circle
                          className="lineage__node-ring--selected"
                          r={NODE_R + 5}
                        />
                      )}
                      <g filter="url(#ln-shadow)">
                        <circle
                          className="lineage__node-circle"
                          r={NODE_R}
                          fill={fitnessColor(n.ind.fitness)}
                        />
                        <circle
                          className="lineage__node-sheen"
                          r={NODE_R}
                          fill="url(#ln-sheen)"
                        />
                      </g>
                      <text
                        className="lineage__node-text"
                        textAnchor="middle"
                        dominantBaseline="central"
                      >
                        {formatFitness(n.ind.fitness)}
                      </text>
                    </g>
                  </g>
                );
              })}
            </g>
          </svg>

          {hoveredNode && (
            <div
              className={
                "lineage__tip" + (tipBelow ? " lineage__tip--below" : "")
              }
              style={{
                left: hoveredNode.x * zoom,
                top: hoveredNode.y * zoom,
              }}
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
          {zoom !== 1 && (
            <button type="button" className="lineage__reset" onClick={resetView}>
              Reset
            </button>
          )}
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
        <span className="lineage__legend-title">Fitness</span>
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
        <span className="lineage__legend-swatch lineage__legend-swatch--gray" />
        <span className="muted">untested</span>
      </div>
      <div className="lineage__legend-item">
        <span className="lineage__legend-ring" />
        <span className="muted">top performer (≥ 1.0)</span>
      </div>
      <div className="lineage__legend-item lineage__legend-edges">
        {EDGE_KEYS.map(([label, v]) => (
          <span key={label} className="lineage__legend-edge">
            <span
              className="lineage__legend-line"
              style={{ background: `var(${v})` }}
            />
            <span className="muted">{label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
