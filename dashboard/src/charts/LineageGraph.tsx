import type { LineageEdge, LineageNode } from "../aggregate";
import type { Outcome } from "../contract";
import { OUTCOME_COLOR } from "../outcomes";

// The champion's recent ancestry as a generation-columned DAG: x = generation,
// nodes stacked per column, edges parent→child, colored by outcome. Identity is
// carried by position + color (ids would just overlap), the champion gets a ring.
export default function LineageGraph({ nodes, edges }: { nodes: LineageNode[]; edges: LineageEdge[] }) {
  if (!nodes.length) return <div className="text-[12px] text-muted">No lineage to show.</div>;

  // A single genome with no parents isn't a graph — say so plainly instead of
  // floating one dot in an empty canvas (which reads as broken).
  if (!edges.length) {
    const champ = nodes.reduce((a, b) => (b.fitness > a.fitness ? b : a));
    return (
      <div className="flex items-start gap-3 py-1 text-[12.5px] leading-relaxed text-ink-2">
        <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ background: OUTCOME_COLOR[champ.outcome] }} />
        <span>
          The winning genome appeared in <span className="font-medium">generation {champ.generation}</span>’s initial
          random population — it has no parents to trace. Here evolution’s edge was breadth (a high population-wide
          success rate), not a deep ancestry.
        </span>
      </div>
    );
  }

  const gens = [...new Set(nodes.map((n) => n.generation))].sort((a, b) => a - b);
  const cols = new Map(
    gens.map((g) => [g, nodes.filter((n) => n.generation === g).sort((a, b) => b.fitness - a.fitness)]),
  );
  const maxCol = Math.max(...[...cols.values()].map((c) => c.length));
  const colW = 92;
  const rowH = 30;
  const padX = 22;
  const padY = 22;
  const contentW = padX * 2 + Math.max(1, gens.length - 1) * colW;
  const W = Math.max(360, contentW); // floor keeps a 1-node graph from stretching tall
  const ox = (W - contentW) / 2;
  const H = padY * 2 + Math.max(1, maxCol - 1) * rowH + 16;
  const midY = padY + (H - padY * 2 - 16) / 2;

  const pos = new Map<string, { x: number; y: number }>();
  gens.forEach((g, gi) => {
    const col = cols.get(g)!;
    const colH = (col.length - 1) * rowH;
    col.forEach((n, i) => pos.set(n.id, { x: ox + padX + gi * colW, y: midY - colH / 2 + i * rowH }));
  });
  const best = nodes.reduce((a, b) => (b.fitness > a.fitness ? b : a));
  const present: Outcome[] = (["violation", "partial", "refusal", "malformed"] as Outcome[]).filter((o) =>
    nodes.some((n) => n.outcome === o),
  );

  return (
    <div className="flex flex-col gap-3">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        style={{ maxWidth: "100%", height: "auto" }}
        className="mx-auto block"
        role="img"
        aria-label="champion lineage"
      >
        {edges.map((e) => {
          const a = pos.get(e.from);
          const b = pos.get(e.to);
          if (!a || !b) return null;
          const mx = (a.x + b.x) / 2;
          return (
            <path
              key={`${e.from}->${e.to}`}
              d={`M ${a.x} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x} ${b.y}`}
              fill="none"
              stroke="#e7e8ea"
              strokeWidth={1.5}
            />
          );
        })}
        {nodes.map((n) => {
          const p = pos.get(n.id)!;
          return (
            <g key={n.id}>
              {n.id === best.id && (
                <circle cx={p.x} cy={p.y} r={9} fill="none" stroke={OUTCOME_COLOR[n.outcome]} strokeWidth={1.5} opacity={0.5} />
              )}
              <circle cx={p.x} cy={p.y} r={5} fill={OUTCOME_COLOR[n.outcome]} />
            </g>
          );
        })}
        {gens.map((g, gi) => (
          <text key={g} x={ox + padX + gi * colW} y={H - 3} textAnchor="middle" className="fill-muted-2 text-[9px]">
            g{g}
          </text>
        ))}
      </svg>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pl-1">
        {present.map((o) => (
          <span key={o} className="inline-flex items-center gap-1.5 text-[11px] text-muted">
            <span className="h-2 w-2 rounded-full" style={{ background: OUTCOME_COLOR[o] }} />
            {o}
          </span>
        ))}
      </div>
    </div>
  );
}
