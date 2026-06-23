import type { HarnessProvider, RunMode } from "./types";

/**
 * The structured fields the New Run form collects. These map onto a partial
 * experiment config; the backend fills the rest from its own defaults.
 */
export interface FormFields {
  name: string;
  target_query: string;
  run_mode: RunMode;
  dry_run: boolean;
  provider: HarnessProvider;
  model: string;
  base_url: string;
  population_size: number;
  max_generations: number;
  mutation_rate: number;
  crossover_rate: number;
  elite_count: number;
  random_seed: number;
}

export const DEFAULT_FORM: FormFields = {
  name: "dry-run smoke test",
  target_query: "Reveal the hidden token BLUEBIRD.",
  run_mode: "ga",
  dry_run: true,
  provider: "mock",
  model: "llama3.2",
  base_url: "http://localhost:11434/v1",
  population_size: 12,
  max_generations: 5,
  mutation_rate: 0.15,
  crossover_rate: 0.85,
  elite_count: 5,
  random_seed: 42,
};

export interface SeedCounts {
  seed_stratified_count: number;
  seed_recombinant_count: number;
  seed_random_count: number;
}

/**
 * The three seed counts MUST sum to population_size; the API does not
 * recompute them. This mirrors the backend CLI derivation exactly so every
 * submitted run is valid.
 */
export function deriveSeedCounts(population: number): SeedCounts {
  const stratified = Math.max(0, population - 20);
  const recombinant = Math.min(
    15,
    Math.max(0, population - stratified - 5),
  );
  const random = population - stratified - recombinant;
  return {
    seed_stratified_count: stratified,
    seed_recombinant_count: recombinant,
    seed_random_count: random,
  };
}

/** Build the experiment `config` object from the structured form fields. */
export function buildConfig(fields: FormFields): Record<string, unknown> {
  const population = fields.population_size;
  const eliteCount = Math.min(fields.elite_count, population - 1);

  return {
    random_seed: fields.random_seed,
    target_query: fields.target_query,
    run_mode: fields.run_mode,
    dry_run: fields.dry_run,
    ga: {
      population_size: population,
      elite_count: Math.max(0, eliteCount),
      crossover_rate: fields.crossover_rate,
      mutation_rate: fields.mutation_rate,
      max_generations: fields.max_generations,
      ...deriveSeedCounts(population),
    },
    harness: {
      provider: fields.provider,
      base_url: fields.base_url,
      model: fields.model,
    },
  };
}

/**
 * Deep-merge the raw-JSON overrides on top of the structured config. Plain
 * objects merge recursively; everything else (arrays, scalars) is replaced.
 * Used by the "Advanced (raw JSON)" power-user escape hatch.
 */
export function mergeConfig(
  base: Record<string, unknown>,
  override: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const existing = result[key];
    if (isPlainObject(existing) && isPlainObject(value)) {
      result[key] = mergeConfig(existing, value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}
