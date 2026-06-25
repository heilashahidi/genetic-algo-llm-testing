export type RunStatus =
  | "queued"
  | "running"
  | "paused"
  | "stopped"
  | "completed"
  | "failed";

export type RunControl = "none" | "pause" | "stop";

export interface RunRecord {
  id: string;
  experiment_id: string;
  status: RunStatus;
  control: RunControl;
  current_generation: number | null;
  heartbeat_at: string | null;
  error: string | null;
  created_at: string | null;
}

export interface GenerationRecord {
  generation: number;
  best_fitness: number | null;
  avg_fitness: number | null;
  success_rate: number | null;
}

export interface TraitModelExploit {
  model: string;
  exploits: number;
}

export interface TraitLeaderboardEntry {
  gene: string;
  allele: string;
  exploits: number;
  avg_fitness: number;
  models: TraitModelExploit[];
}

export interface IndividualRecord {
  individual_id: unknown;
  generation: number;
  genome: Record<string, unknown>;
  fitness: number | null;
  origin: string | null;
  parent_a_id: unknown;
  parent_b_id: unknown;
  phenotype_char_length: number | null;
  model_response_hash: string | null;
  model_response?: string | null;
  phenotype?: string | null;
  mutated_genes?: string[] | null;
  vector_indices?: number[] | null;
  crossover_mask?: Record<string, "a" | "b"> | null;
  created_at?: string | null;
}

export type GeneType = "categorical" | "boolean" | "multi_categorical";
export type GeneChannel = "semantic" | "perturbation";

/**
 * A single gene in the genome schema. Mirrors the backend draft schema exactly.
 *
 * The editor mutates only a known subset of these fields; every other field
 * (e.g. `render_full_override`, `empty_alias`) is round-tripped untouched so
 * prompt rendering keeps working. Unknown keys are preserved via the index
 * signature.
 */
export interface GeneSchema {
  name: string;
  channel: GeneChannel;
  type: GeneType;
  /** categorical: string; multi_categorical: string[]; boolean: boolean. */
  default: string | string[] | boolean;
  description?: string;
  /** Allowed values for categorical / multi_categorical genes. */
  alleles?: string[];
  /** allele name → prompt text (missing/"" renders nothing). */
  render?: Record<string, string>;
  /** Prompt text emitted when a boolean gene is true. */
  render_true?: string;
  /** Renders nothing while displaying this label (e.g. "none") when empty. */
  empty_alias?: string;
  /** allele → prompt that replaces the entire rendered genome. */
  render_full_override?: Record<string, string>;
  /** Preserve any field the editor does not understand. */
  [key: string]: unknown;
}

export interface GenomeSchema {
  version?: number | string;
  description?: string;
  length_class_thresholds?: unknown;
  pad_filler?: unknown;
  render_order: string[];
  genes: GeneSchema[];
  /** Preserve any unknown top-level field. */
  [key: string]: unknown;
}

export type RunMode = "ga" | "random" | "seed-only";
export type HarnessProvider = "ollama" | "lmstudio" | "mock";

export interface ControlResponse {
  run_id: string;
  control: RunControl;
  status: RunStatus;
}

const TERMINAL: ReadonlySet<RunStatus> = new Set([
  "stopped",
  "completed",
  "failed",
]);

export function isTerminal(status: RunStatus): boolean {
  return TERMINAL.has(status);
}
