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
