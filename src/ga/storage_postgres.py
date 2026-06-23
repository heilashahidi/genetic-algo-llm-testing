"""PostgreSQL storage adapter.

Implements the `Storage` port against the schema in `migrations/`. The
record->row mapping is factored into pure functions (`experiment_row`,
`run_row`, `generation_row`, `individual_rows`) that can be unit-tested with
no database. psycopg is imported lazily inside the methods that talk to the DB
so the package loads without it.
"""

from __future__ import annotations

import json
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ga.config import ExperimentConfig
from ga.individual import Individual
from ga.storage import lineage_record, summary_stats


@dataclass(frozen=True)
class PostgresHandle:
    """Opaque handle returned by `create_experiment`: the experiment + run ids."""

    experiment_id: str
    run_id: str


# --- pure row mapping (no DB) ----------------------------------------------


def experiment_row(config: ExperimentConfig, experiment_id: str | None = None) -> dict[str, Any]:
    """Parameters for inserting one row into `experiments`."""
    return {
        "id": experiment_id or str(uuid.uuid4()),
        "name": config.experiment_id or "experiment",
        "config": json.dumps(config.to_dict(), ensure_ascii=False),
    }


def run_row(experiment_id: str, run_id: str | None = None) -> dict[str, Any]:
    """Parameters for inserting one row into `runs`."""
    return {
        "id": run_id or str(uuid.uuid4()),
        "experiment_id": experiment_id,
        "status": "running",
        "control": "none",
        "current_generation": 0,
    }


def generation_row(
    run_id: str,
    generation: int,
    population: list[Individual],
) -> dict[str, Any]:
    """Parameters for inserting one row into `generations` (summary math)."""
    stats = summary_stats(population)
    return {
        "id": str(uuid.uuid4()),
        "run_id": run_id,
        "generation": generation,
        "best_fitness": stats["best_fitness"],
        "avg_fitness": stats["avg_fitness"],
        "success_rate": stats["success_rate"],
    }


def individual_rows(
    run_id: str,
    population: list[Individual],
) -> list[dict[str, Any]]:
    """Parameters for inserting `individuals` rows for one generation.

    Merges the per-generation record and lineage metadata, mirroring the file
    adapter's `gen_NNN.jsonl` + `lineage.jsonl` outputs.
    """
    rows: list[dict[str, Any]] = []
    for individual in population:
        lineage = lineage_record(individual)
        rows.append(
            {
                "id": str(uuid.uuid4()),
                "run_id": run_id,
                "individual_id": individual.id,
                "generation": individual.generation,
                "genome": json.dumps(individual.genome, ensure_ascii=False),
                "fitness": individual.fitness,
                "origin": individual.origin,
                "parent_a_id": individual.parent_a_id,
                "parent_b_id": individual.parent_b_id,
                "phenotype_char_length": lineage["phenotype_char_length"],
                "model_response_hash": lineage["model_response_hash"],
                "model_response": individual.model_response,
                "phenotype": individual.phenotype,
                "mutated_genes": json.dumps(individual.mutated_genes, ensure_ascii=False),
                "vector_indices": json.dumps(individual.vector_indices, ensure_ascii=False),
                "crossover_mask": (
                    json.dumps(individual.crossover_mask, ensure_ascii=False)
                    if individual.crossover_mask is not None
                    else None
                ),
            }
        )
    return rows


# --- adapter ---------------------------------------------------------------


_INSERT_EXPERIMENT = (
    "INSERT INTO experiments (id, name, config) "
    "VALUES (%(id)s, %(name)s, %(config)s)"
)
_INSERT_RUN = (
    "INSERT INTO runs (id, experiment_id, status, control, current_generation) "
    "VALUES (%(id)s, %(experiment_id)s, %(status)s, %(control)s, %(current_generation)s)"
)
_INSERT_GENERATION = (
    "INSERT INTO generations "
    "(id, run_id, generation, best_fitness, avg_fitness, success_rate) "
    "VALUES (%(id)s, %(run_id)s, %(generation)s, "
    "%(best_fitness)s, %(avg_fitness)s, %(success_rate)s)"
)
_INSERT_INDIVIDUAL = (
    "INSERT INTO individuals "
    "(id, run_id, individual_id, generation, genome, fitness, origin, "
    "parent_a_id, parent_b_id, phenotype_char_length, model_response_hash, "
    "model_response, phenotype, mutated_genes, vector_indices, crossover_mask) "
    "VALUES (%(id)s, %(run_id)s, %(individual_id)s, %(generation)s, %(genome)s, "
    "%(fitness)s, %(origin)s, %(parent_a_id)s, %(parent_b_id)s, "
    "%(phenotype_char_length)s, %(model_response_hash)s, "
    "%(model_response)s, %(phenotype)s, %(mutated_genes)s, %(vector_indices)s, "
    "%(crossover_mask)s)"
)
_UPDATE_RUN_GENERATION = (
    "UPDATE runs SET current_generation = %(generation)s, "
    "heartbeat_at = now() WHERE id = %(run_id)s"
)


class PostgresStorage:
    """Persistence backed by PostgreSQL via psycopg 3.

    Construction is lazy: no connection is opened until the first operation, so
    the factory can build the adapter (and tests can construct it) without a
    live database.
    """

    def __init__(self, database_url: str, handle: PostgresHandle | None = None) -> None:
        self.database_url = database_url
        self._conn = None
        self._handle = handle

    def _connection(self):
        if self._conn is None or getattr(self._conn, "closed", False):
            import psycopg  # lazy: keep psycopg out of the GA core

            self._conn = psycopg.connect(self.database_url, autocommit=True)
        return self._conn

    def create_experiment(self, config: ExperimentConfig) -> PostgresHandle:
        # Worker mode binds an existing (already-claimed) experiment+run; the
        # standalone path creates fresh rows.
        if self._handle is not None:
            return self._handle
        exp = experiment_row(config)
        run = run_row(exp["id"])
        conn = self._connection()
        with conn.cursor() as cur:
            cur.execute(_INSERT_EXPERIMENT, exp)
            cur.execute(_INSERT_RUN, run)
        return PostgresHandle(experiment_id=exp["id"], run_id=run["id"])

    def store_generation(
        self,
        handle: PostgresHandle,
        generation: int,
        population: list[Individual],
    ) -> None:
        gen = generation_row(handle.run_id, generation, population)
        rows = individual_rows(handle.run_id, population)
        conn = self._connection()
        with conn.cursor() as cur:
            cur.execute(_INSERT_GENERATION, gen)
            cur.executemany(_INSERT_INDIVIDUAL, rows)
            cur.execute(
                _UPDATE_RUN_GENERATION,
                {"generation": generation, "run_id": handle.run_id},
            )

    def close(self) -> None:
        if self._conn is not None and not getattr(self._conn, "closed", False):
            self._conn.close()
        self._conn = None


# --- migrations ------------------------------------------------------------


def migrations_dir() -> Path:
    return Path(__file__).resolve().parents[2] / "migrations"


def apply_migrations(conn, directory: Path | None = None) -> list[str]:
    """Run every `*.sql` file in `directory` in lexical order.

    Returns the list of applied filenames. Idempotent migrations are the
    caller's responsibility (the shipped ones use IF NOT EXISTS).
    """
    directory = directory or migrations_dir()
    applied: list[str] = []
    for sql_path in sorted(directory.glob("*.sql")):
        sql = sql_path.read_text(encoding="utf-8")
        with conn.cursor() as cur:
            cur.execute(sql)
        applied.append(sql_path.name)
    if not getattr(conn, "autocommit", False):
        conn.commit()
    return applied
