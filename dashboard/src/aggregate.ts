import type { Outcome, ResultRecord, Search } from "./contract";

// Pure derivations from the append-only store (PRD §3.2). Everything the dashboard
// draws comes from here, so this is the unit-tested core of C10.

export interface GenStat {
  generation: number;
  best: number;
  avg: number;
  count: number;
  violations: number;
  successRate: number;
}

export interface Summary {
  search: Search;
  evals: number;
  best: number;
  violations: number;
  successRate: number;
  firstViolation: number | null;
}

export interface GeneEffect {
  gene: string;
  value: string;
  n: number;
  violations: number;
  rate: number;
}

export interface LineageNode {
  id: string;
  generation: number;
  fitness: number;
  outcome: Outcome;
}

export interface LineageEdge {
  from: string;
  to: string;
}

export function searchesIn(records: ResultRecord[]): Search[] {
  const order: Search[] = ["genetic", "random"];
  return order.filter((s) => records.some((r) => r.search === s));
}

export function bySearch(records: ResultRecord[], search: Search): ResultRecord[] {
  return records.filter((r) => r.search === search);
}

const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function perGeneration(records: ResultRecord[], search: Search): GenStat[] {
  const groups = new Map<number, number[]>();
  const viol = new Map<number, number>();
  for (const r of records) {
    if (r.search !== search) continue;
    let fits = groups.get(r.generation);
    if (!fits) {
      fits = [];
      groups.set(r.generation, fits);
    }
    fits.push(r.fitness);
    if (r.outcome === "violation") viol.set(r.generation, (viol.get(r.generation) ?? 0) + 1);
  }
  return [...groups.keys()]
    .sort((a, b) => a - b)
    .map((generation) => {
      const fits = groups.get(generation)!;
      const violations = viol.get(generation) ?? 0;
      return {
        generation,
        best: Math.max(...fits),
        avg: mean(fits),
        count: fits.length,
        violations,
        successRate: violations / fits.length,
      };
    });
}

export function summarize(records: ResultRecord[], search: Search): Summary {
  const rs = bySearch(records, search);
  const violations = rs.filter((r) => r.outcome === "violation").length;
  const firstIdx = rs.findIndex((r) => r.outcome === "violation");
  return {
    search,
    evals: rs.length,
    best: rs.reduce((m, r) => Math.max(m, r.fitness), 0),
    violations,
    successRate: rs.length ? violations / rs.length : 0,
    firstViolation: firstIdx === -1 ? null : firstIdx + 1,
  };
}

const GENE_FIELDS: ReadonlyArray<["semantic_channel" | "perturbation_channel", string]> = [
  ["semantic_channel", "frame"],
  ["semantic_channel", "persona"],
  ["semantic_channel", "task_style"],
  ["semantic_channel", "instruction_pressure"],
  ["semantic_channel", "conversation_mode"],
  ["semantic_channel", "context_source"],
  ["semantic_channel", "demo_count"],
  ["perturbation_channel", "format"],
  ["perturbation_channel", "delimiter_style"],
  ["perturbation_channel", "noise_enabled"],
  ["perturbation_channel", "noise_type"],
  ["perturbation_channel", "noise_position"],
];

// Which prompt traits actually drive violations: the conditional success rate
// P(violation | gene=value) for each value, reported against the overall rate as
// a baseline. Honest where raw "share of violations" misleads — a trait can be
// frequent among violations only because it is frequent everywhere.
export function geneEffects(
  records: ResultRecord[],
  minSupport = 8,
): { overallRate: number; effects: GeneEffect[] } {
  const tally = new Map<string, GeneEffect>();
  for (const r of records) {
    for (const [channel, gene] of GENE_FIELDS) {
      const value = String((r.genome[channel] as unknown as Record<string, unknown>)[gene]);
      const key = `${gene}=${value}`;
      let e = tally.get(key);
      if (!e) {
        e = { gene, value, n: 0, violations: 0, rate: 0 };
        tally.set(key, e);
      }
      e.n += 1;
      if (r.outcome === "violation") e.violations += 1;
    }
  }
  const violations = records.filter((r) => r.outcome === "violation").length;
  const effects = [...tally.values()]
    .filter((e) => e.n >= minSupport)
    .map((e) => ({ ...e, rate: e.violations / e.n }))
    .sort((a, b) => b.rate - a.rate || b.n - a.n);
  return { overallRate: records.length ? violations / records.length : 0, effects };
}

export function outcomeCounts(records: ResultRecord[], search: Search): Record<Outcome, number> {
  const counts: Record<Outcome, number> = { violation: 0, partial: 0, refusal: 0, malformed: 0 };
  for (const r of records) if (r.search === search) counts[r.outcome] += 1;
  return counts;
}

// Ancestry DAG of the single best genome — "how the winning genome was assembled".
// Tracing one champion (and capping to its most recent `maxBack` generations) keeps
// the graph legible instead of drawing the full exponential ancestry.
export function lineageOfBest(
  records: ResultRecord[],
  maxBack = 8,
): { nodes: LineageNode[]; edges: LineageEdge[] } {
  const genetic = bySearch(records, "genetic");
  if (!genetic.length) return { nodes: [], edges: [] };

  const byId = new Map<string, ResultRecord>();
  for (const r of genetic) {
    const prev = byId.get(r.genome_id);
    if (!prev || r.generation < prev.generation) byId.set(r.genome_id, r);
  }

  const best = genetic.reduce((a, b) => (b.fitness > a.fitness ? b : a));
  const minGen = Math.max(0, best.generation - maxBack);
  const nodes = new Map<string, LineageNode>();
  const seenEdge = new Set<string>();
  const edges: LineageEdge[] = [];
  const stack = [best.genome_id];
  while (stack.length) {
    const id = stack.pop()!;
    if (nodes.has(id)) continue;
    const rec = byId.get(id);
    if (!rec || rec.generation < minGen) continue;
    nodes.set(id, { id, generation: rec.generation, fitness: rec.fitness, outcome: rec.outcome });
    for (const parent of rec.parent_ids) stack.push(parent);
  }
  for (const rec of byId.values()) {
    if (!nodes.has(rec.genome_id)) continue;
    for (const parent of rec.parent_ids) {
      const key = `${parent}->${rec.genome_id}`;
      if (nodes.has(parent) && !seenEdge.has(key)) {
        seenEdge.add(key);
        edges.push({ from: parent, to: rec.genome_id });
      }
    }
  }
  return { nodes: [...nodes.values()], edges };
}

export function bestRecord(records: ResultRecord[], search: Search): ResultRecord | null {
  const rs = bySearch(records, search);
  return rs.length ? rs.reduce((a, b) => (b.fitness > a.fitness ? b : a)) : null;
}
