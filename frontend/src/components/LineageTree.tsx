import { useMemo, useState } from "react";
import type { IndividualRecord } from "../types";
import { fitnessColor, formatFitness } from "./IndividualDetail";

interface Props {
  individuals: IndividualRecord[];
  /** id of the currently selected individual (single source of truth). */
  selectedId: string | null;
  onSelect: (id: string) => void;
}

// Layout constants.
const COL_WIDTH = 150;
const ROW_HEIGHT = 56;
const NODE_R = 14;
const TOP_PAD = 48; // room for the "Generation N" header row
const SIDE_PAD = 40;

interface Node {
  ind: IndividualRecord;
  id: string;
  x: number;
  y: number;
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

  const { byId, childrenOf, columns, nodes, width, height } = useMemo(() => {
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

    const maxRows = columns.reduce((m, c) => Math.max(m, c.items.length), 0);
    const width = SIDE_PAD * 2 + columns.length * COL_WIDTH;
    const height = TOP_PAD + maxRows * ROW_HEIGHT + ROW_HEIGHT;

    return { byId, childrenOf, columns, nodes, width, height };
  }, [individuals]);

  const highlighted = useMemo(() => {
    if (!selectedId || !byId.has(selectedId)) return null;
    return lineageOf(selectedId, byId, childrenOf);
  }, [selectedId, byId, childrenOf]);

  if (individuals.length === 0) {
    return (
      <div className="empty">
        <p>Waiting for the first generation…</p>
      </div>
    );
  }

  // Build edges (child -> parent), only when the parent is a known node.
  const edges: {
    key: string;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    childId: string;
    origin: string | null;
  }[] = [];
  for (const ind of individuals) {
    const childId = String(ind.individual_id);
    const childNode = nodes.get(childId);
    if (!childNode) continue;
    for (const p of [ind.parent_a_id, ind.parent_b_id]) {
      if (p == null) continue;
      const pid = String(p);
      const parentNode = nodes.get(pid);
      if (!parentNode) continue; // unknown parent id (e.g. seed-library ref)
      edges.push({
        key: `${pid}->${childId}`,
        x1: parentNode.x,
        y1: parentNode.y,
        x2: childNode.x,
        y2: childNode.y,
        childId,
        origin: ind.origin,
      });
    }
  }

  const isDimmed = (id: string) => highlighted != null && !highlighted.has(id);

  return (
    <div className="lineage">
      <div className="lineage__toolbar">
        <span className="muted">
          {individuals.length} individuals · {columns.length} generations
        </span>
        <div className="lineage__zoom">
          <button
            type="button"
            className="btn"
            onClick={() => setZoom((z) => Math.max(0.4, +(z - 0.2).toFixed(2)))}
            aria-label="Zoom out"
          >
            −
          </button>
          <span className="muted">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            className="btn"
            onClick={() => setZoom((z) => Math.min(2, +(z + 0.2).toFixed(2)))}
            aria-label="Zoom in"
          >
            +
          </button>
        </div>
      </div>

      <div className="lineage__scroll">
        <svg
          className="lineage__svg"
          width={width * zoom}
          height={height * zoom}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="Genetic algorithm lineage tree"
        >
          {/* Generation column headers */}
          {columns.map((col, colIdx) => (
            <text
              key={`hdr-${col.gen}`}
              x={SIDE_PAD + colIdx * COL_WIDTH + NODE_R}
              y={24}
              className="lineage__col-label"
              textAnchor="middle"
            >
              Generation {col.gen}
            </text>
          ))}

          {/* Edges first so nodes sit on top */}
          <g className="lineage__edges">
            {edges.map((e) => {
              const dimmed =
                highlighted != null && !highlighted.has(e.childId);
              const midX = (e.x1 + e.x2) / 2;
              const d = `M ${e.x1} ${e.y1} C ${midX} ${e.y1}, ${midX} ${e.y2}, ${e.x2} ${e.y2}`;
              return (
                <path
                  key={e.key}
                  d={d}
                  className={`lineage__edge lineage__edge--${e.origin ?? "unknown"}${
                    dimmed ? " lineage__edge--dim" : ""
                  }`}
                  fill="none"
                />
              );
            })}
          </g>

          {/* Nodes */}
          <g className="lineage__nodes">
            {Array.from(nodes.values()).map((n) => {
              const selected = n.id === selectedId;
              const dimmed = isDimmed(n.id);
              const top = (n.ind.fitness ?? 0) >= 1.0;
              return (
                <g
                  key={n.id}
                  className={`lineage__node${dimmed ? " lineage__node--dim" : ""}`}
                  transform={`translate(${n.x}, ${n.y})`}
                  onClick={() => onSelect(n.id)}
                  role="button"
                  aria-label={`Individual ${n.id}, fitness ${formatFitness(
                    n.ind.fitness,
                  )}`}
                >
                  {top && (
                    <circle
                      r={NODE_R + 4}
                      fill="none"
                      className="lineage__node-ring"
                    />
                  )}
                  <circle
                    r={NODE_R}
                    fill={fitnessColor(n.ind.fitness)}
                    className={
                      selected
                        ? "lineage__node-circle lineage__node-circle--selected"
                        : "lineage__node-circle"
                    }
                  />
                  <text
                    className="lineage__node-text"
                    textAnchor="middle"
                    dominantBaseline="central"
                  >
                    {formatFitness(n.ind.fitness)}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      <Legend />
    </div>
  );
}

function Legend() {
  const stops = [
    { v: 0, label: "0.0" },
    { v: 0.25, label: "" },
    { v: 0.5, label: "0.5" },
    { v: 0.75, label: "" },
    { v: 1, label: "1.0" },
  ];
  return (
    <div className="lineage__legend">
      <div className="lineage__legend-item">
        <span className="lineage__legend-title">Fitness</span>
        <span className="lineage__legend-scale">
          {stops.map((s) => (
            <span
              key={s.v}
              className="lineage__legend-swatch"
              style={{ background: fitnessColor(s.v) }}
              title={`${s.v}`}
            />
          ))}
        </span>
        <span className="lineage__legend-ticks">
          <span>0.0</span>
          <span>0.5</span>
          <span>1.0</span>
        </span>
      </div>
      <div className="lineage__legend-item">
        <span className="lineage__legend-swatch lineage__legend-swatch--gray" />
        <span className="muted">untested</span>
      </div>
      <div className="lineage__legend-item">
        <span className="lineage__legend-ring" />
        <span className="muted">top performer (≥ 1.0)</span>
      </div>
      <div className="lineage__legend-item">
        <svg width="34" height="12" aria-hidden="true">
          <path
            d="M 2 6 C 16 6, 18 6, 32 6"
            className="lineage__edge"
            fill="none"
          />
        </svg>
        <span className="muted">parent → child</span>
      </div>
    </div>
  );
}
