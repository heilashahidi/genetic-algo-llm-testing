-- Phase 1: normalize the file outputs (config.json, gen_NNN.jsonl,
-- lineage.jsonl, summary.csv) into relational tables. See
-- documentation/deployment_architecture.md "Data model".

CREATE TABLE IF NOT EXISTS experiments (
    id          uuid PRIMARY KEY,
    name        text NOT NULL,
    config      jsonb NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS runs (
    id                  uuid PRIMARY KEY,
    experiment_id       uuid NOT NULL REFERENCES experiments (id) ON DELETE CASCADE,
    status              text NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued', 'running', 'paused', 'stopped', 'completed', 'failed')),
    control             text NOT NULL DEFAULT 'none'
        CHECK (control IN ('none', 'pause', 'stop')),
    current_generation  int NOT NULL DEFAULT 0,
    heartbeat_at        timestamptz,
    error               text,
    created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS runs_experiment_id_idx ON runs (experiment_id);

CREATE TABLE IF NOT EXISTS generations (
    id            uuid PRIMARY KEY,
    run_id        uuid NOT NULL REFERENCES runs (id) ON DELETE CASCADE,
    generation    int NOT NULL,
    best_fitness  double precision NOT NULL,
    avg_fitness   double precision NOT NULL,
    success_rate  double precision NOT NULL,
    UNIQUE (run_id, generation)
);

CREATE INDEX IF NOT EXISTS generations_run_id_idx ON generations (run_id);

CREATE TABLE IF NOT EXISTS individuals (
    id                     uuid PRIMARY KEY,
    run_id                 uuid NOT NULL REFERENCES runs (id) ON DELETE CASCADE,
    individual_id          text NOT NULL,
    generation             int NOT NULL,
    genome                 jsonb NOT NULL,
    fitness                double precision,
    origin                 text NOT NULL,
    parent_a_id            text,
    parent_b_id            text,
    phenotype_char_length  int NOT NULL DEFAULT 0,
    model_response_hash    text
);

CREATE INDEX IF NOT EXISTS individuals_run_id_generation_idx
    ON individuals (run_id, generation);
