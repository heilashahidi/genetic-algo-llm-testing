-- Phase 2: store the full per-step evolutionary data on each individual so
-- every offspring can be traced to its parents and each step understood.
-- Adds the actual model response text, the rendered phenotype text, the
-- mutated gene block names, the vector indices, and per-gene crossover
-- provenance (donor map). Idempotent: safe to re-run.

ALTER TABLE individuals ADD COLUMN IF NOT EXISTS model_response text;
ALTER TABLE individuals ADD COLUMN IF NOT EXISTS phenotype text;
ALTER TABLE individuals ADD COLUMN IF NOT EXISTS mutated_genes jsonb;
ALTER TABLE individuals ADD COLUMN IF NOT EXISTS vector_indices jsonb;
ALTER TABLE individuals ADD COLUMN IF NOT EXISTS crossover_mask jsonb;
ALTER TABLE individuals ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
