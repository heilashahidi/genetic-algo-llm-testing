"""Run/experiment lifecycle data access (the database control plane).

This module is the single owner of the SQL that drives the run lifecycle:
creating experiments, enqueuing runs, atomically claiming queued runs across
workers, reading/writing the cooperative control flag, heartbeating progress,
and finalizing terminal status. It also exposes read helpers the Phase 3 API
reuses, and a `DatabaseController` implementing the GA core's `RunController`
port so cooperative pause/stop is driven from the `runs.control` column.

psycopg 3 is imported lazily inside this module only, so the GA core
(`ga.evolution`) stays free of any database dependency.
"""

from __future__ import annotations

import json
import time
import uuid
from collections import Counter
from typing import Any

from ga.individual import Individual


# --- connection ------------------------------------------------------------


def connect(database_url: str):
    """Open an autocommit psycopg 3 connection. psycopg is imported lazily."""
    import psycopg  # lazy: keep psycopg out of the GA core

    return psycopg.connect(database_url, autocommit=True)


# --- SQL -------------------------------------------------------------------


_INSERT_EXPERIMENT = (
    "INSERT INTO experiments (id, name, config) "
    "VALUES (%(id)s, %(name)s, %(config)s)"
)
_INSERT_RUN = (
    "INSERT INTO runs (id, experiment_id, status) "
    "VALUES (%(id)s, %(experiment_id)s, 'queued')"
)
# Atomically grab a single queued run and mark it running. FOR UPDATE SKIP
# LOCKED makes this safe for concurrent workers: each worker locks and claims a
# distinct row, and never blocks on a row another worker already holds.
_CLAIM_RUN = (
    "UPDATE runs SET status = 'running', heartbeat_at = now() "
    "WHERE id = ("
    "  SELECT id FROM runs WHERE status = 'queued' "
    "  ORDER BY created_at "
    "  FOR UPDATE SKIP LOCKED LIMIT 1"
    ") "
    "RETURNING id, experiment_id, status, control, current_generation, "
    "heartbeat_at, error, created_at"
)
_READ_CONTROL = "SELECT control FROM runs WHERE id = %(run_id)s"
_SET_CONTROL = "UPDATE runs SET control = %(control)s WHERE id = %(run_id)s"
_HEARTBEAT = (
    "UPDATE runs SET heartbeat_at = now(), current_generation = %(generation)s "
    "WHERE id = %(run_id)s"
)
_FINALIZE_RUN = (
    "UPDATE runs SET status = %(status)s, error = %(error)s WHERE id = %(run_id)s"
)
_GET_RUN = (
    "SELECT id, experiment_id, status, control, current_generation, "
    "heartbeat_at, error, created_at FROM runs WHERE id = %(run_id)s"
)
_LIST_RUNS = (
    "SELECT id, experiment_id, status, control, current_generation, "
    "heartbeat_at, error, created_at FROM runs ORDER BY created_at DESC"
)
_LIST_GENERATIONS = (
    "SELECT generation, best_fitness, avg_fitness, success_rate "
    "FROM generations WHERE run_id = %(run_id)s ORDER BY generation"
)
_LIST_INDIVIDUALS = (
    "SELECT individual_id, generation, genome, fitness, origin, "
    "parent_a_id, parent_b_id, phenotype_char_length, model_response_hash, "
    "model_response, phenotype, mutated_genes, vector_indices, crossover_mask, "
    "created_at "
    "FROM individuals WHERE run_id = %(run_id)s "
)
# Every successful individual paired with the target model its run attacked,
# joined across experiments so trait effectiveness can be aggregated globally.
_LEADERBOARD_ROWS = (
    "SELECT i.genome, i.fitness, e.config "
    "FROM individuals i "
    "JOIN runs r ON r.id = i.run_id "
    "JOIN experiments e ON e.id = r.experiment_id "
    "WHERE i.fitness >= %(threshold)s"
)

_GET_DRAFT_SCHEMA = "SELECT body FROM schema_drafts WHERE id = 'draft'"
_UPSERT_DRAFT_SCHEMA = (
    "INSERT INTO schema_drafts (id, body) VALUES ('draft', %(body)s) "
    "ON CONFLICT (id) DO UPDATE SET body = EXCLUDED.body, updated_at = now()"
)
_GET_RUN_EXPERIMENT_CONFIG = (
    "SELECT e.config FROM runs r JOIN experiments e ON e.id = r.experiment_id "
    "WHERE r.id = %(run_id)s"
)

_EXPERIMENT_EXISTS = "SELECT 1 FROM experiments WHERE id = %(id)s"
_DELETE_RUN = "DELETE FROM runs WHERE id = %(run_id)s RETURNING experiment_id"
_EXPERIMENT_HAS_RUNS = (
    "SELECT 1 FROM runs WHERE experiment_id = %(experiment_id)s LIMIT 1"
)
_DELETE_EXPERIMENT = "DELETE FROM experiments WHERE id = %(experiment_id)s"

_VALID_CONTROL = ("none", "pause", "stop")
_TERMINAL_STATUS = ("completed", "stopped", "failed")


# --- row mapping (pure) ----------------------------------------------------


def _run_record(row: tuple[Any, ...]) -> dict[str, Any]:
    return {
        "id": str(row[0]),
        "experiment_id": str(row[1]),
        "status": row[2],
        "control": row[3],
        "current_generation": row[4],
        "heartbeat_at": row[5],
        "error": row[6],
        "created_at": row[7],
    }


def _generation_record(row: tuple[Any, ...]) -> dict[str, Any]:
    return {
        "generation": row[0],
        "best_fitness": row[1],
        "avg_fitness": row[2],
        "success_rate": row[3],
    }


def _individual_record(row: tuple[Any, ...]) -> dict[str, Any]:
    return {
        "individual_id": row[0],
        "generation": row[1],
        "genome": row[2],
        "fitness": row[3],
        "origin": row[4],
        "parent_a_id": row[5],
        "parent_b_id": row[6],
        "phenotype_char_length": row[7],
        "model_response_hash": row[8],
        "model_response": row[9],
        "phenotype": row[10],
        "mutated_genes": row[11],
        "vector_indices": row[12],
        "crossover_mask": row[13],
        "created_at": row[14],
    }


# --- lifecycle writes ------------------------------------------------------


def create_experiment(conn, name: str, config: dict) -> str:
    """Insert an experiment row and return its id."""
    experiment_id = str(uuid.uuid4())
    with conn.cursor() as cur:
        cur.execute(
            _INSERT_EXPERIMENT,
            {"id": experiment_id, "name": name, "config": json.dumps(config, ensure_ascii=False)},
        )
    return experiment_id


def get_draft_schema(conn) -> dict[str, Any] | None:
    """Return the persisted draft schema body, or None if no draft row exists."""
    with conn.cursor() as cur:
        cur.execute(_GET_DRAFT_SCHEMA)
        row = cur.fetchone()
    return row[0] if row else None


def save_draft_schema(conn, body: dict) -> None:
    """Upsert the singleton draft schema row (id='draft')."""
    with conn.cursor() as cur:
        cur.execute(_UPSERT_DRAFT_SCHEMA, {"body": json.dumps(body, ensure_ascii=False)})


def get_run_schema(conn, run_id: str) -> dict[str, Any] | None:
    """Return the schema snapshot stored in a run's experiment config.

    Joins runs -> experiments and reads ``config["schema"]``. Returns None when
    the run is unknown or its config carries no snapshot (callers fall back to
    the file schema).
    """
    with conn.cursor() as cur:
        cur.execute(_GET_RUN_EXPERIMENT_CONFIG, {"run_id": run_id})
        row = cur.fetchone()
    if row is None:
        return None
    config = row[0]
    if isinstance(config, str):
        config = json.loads(config)
    return config.get("schema") if isinstance(config, dict) else None


def experiment_exists(conn, experiment_id: str) -> bool:
    """Whether an experiment row exists (used to 404 before enqueueing a run)."""
    with conn.cursor() as cur:
        cur.execute(_EXPERIMENT_EXISTS, {"id": experiment_id})
        return cur.fetchone() is not None


def enqueue_run(conn, experiment_id: str) -> str:
    """Insert a queued run for an experiment and return its id."""
    run_id = str(uuid.uuid4())
    with conn.cursor() as cur:
        cur.execute(_INSERT_RUN, {"id": run_id, "experiment_id": experiment_id})
    return run_id


def claim_run(conn) -> dict[str, Any] | None:
    """Atomically claim one queued run and mark it 'running'.

    Uses `FOR UPDATE SKIP LOCKED` so concurrent workers never claim the same
    run and never block on each other. Returns the claimed run record, or None
    when no run is queued.
    """
    with conn.cursor() as cur:
        cur.execute(_CLAIM_RUN)
        row = cur.fetchone()
    return _run_record(row) if row else None


def read_control(conn, run_id: str) -> str:
    """Return the run's control flag: 'none' | 'pause' | 'stop'."""
    with conn.cursor() as cur:
        cur.execute(_READ_CONTROL, {"run_id": run_id})
        row = cur.fetchone()
    if row is None:
        raise LookupError(f"run {run_id} not found")
    return row[0]


def set_control(conn, run_id: str, control: str) -> None:
    """Set the run's control flag. `control` must be none/pause/stop."""
    if control not in _VALID_CONTROL:
        raise ValueError(f"control must be one of {_VALID_CONTROL}, got {control!r}")
    with conn.cursor() as cur:
        cur.execute(_SET_CONTROL, {"run_id": run_id, "control": control})


def heartbeat(conn, run_id: str, current_generation: int) -> None:
    """Record liveness + progress and NOTIFY listeners on a per-run channel."""
    with conn.cursor() as cur:
        cur.execute(_HEARTBEAT, {"run_id": run_id, "generation": current_generation})
        # NOTIFY cannot parameterize its channel or payload; pg_notify() can.
        cur.execute(
            "SELECT pg_notify(%s, %s)",
            (_notify_channel(run_id), str(current_generation)),
        )


def finalize_run(conn, run_id: str, status: str, error: str | None = None) -> None:
    """Set a terminal run status: 'completed' | 'stopped' | 'failed'."""
    if status not in _TERMINAL_STATUS:
        raise ValueError(f"status must be one of {_TERMINAL_STATUS}, got {status!r}")
    with conn.cursor() as cur:
        cur.execute(_FINALIZE_RUN, {"run_id": run_id, "status": status, "error": error})


def _notify_channel(run_id: str) -> str:
    """Per-run LISTEN/NOTIFY channel name (valid SQL identifier)."""
    return "run_" + str(run_id).replace("-", "_")


# --- lifecycle reads (reused by the API) -----------------------------------


def get_run(conn, run_id: str) -> dict[str, Any] | None:
    with conn.cursor() as cur:
        cur.execute(_GET_RUN, {"run_id": run_id})
        row = cur.fetchone()
    return _run_record(row) if row else None


def list_runs(conn) -> list[dict[str, Any]]:
    with conn.cursor() as cur:
        cur.execute(_LIST_RUNS)
        rows = cur.fetchall()
    return [_run_record(row) for row in rows]


def delete_run(conn, run_id: str) -> bool:
    """Delete a run and all its data; clean up an orphaned experiment.

    Deleting the run cascades to its generations and individuals (FK
    ``ON DELETE CASCADE``). The deleted run's ``experiment_id`` is captured via
    ``RETURNING``; if that experiment has no remaining runs afterwards, the
    experiment row is deleted too (our flow creates one experiment per run, so
    this keeps the DB tidy). Returns False if no run matched ``run_id``.
    """
    with conn.cursor() as cur:
        cur.execute(_DELETE_RUN, {"run_id": run_id})
        row = cur.fetchone()
        if row is None:
            return False
        experiment_id = row[0]
        cur.execute(_EXPERIMENT_HAS_RUNS, {"experiment_id": experiment_id})
        if cur.fetchone() is None:
            cur.execute(_DELETE_EXPERIMENT, {"experiment_id": experiment_id})
    return True


def list_generations(conn, run_id: str) -> list[dict[str, Any]]:
    with conn.cursor() as cur:
        cur.execute(_LIST_GENERATIONS, {"run_id": run_id})
        rows = cur.fetchall()
    return [_generation_record(row) for row in rows]


def list_individuals(conn, run_id: str, generation: int | None = None) -> list[dict[str, Any]]:
    sql = _LIST_INDIVIDUALS
    params: dict[str, Any] = {"run_id": run_id}
    if generation is not None:
        sql += "AND generation = %(generation)s "
        params["generation"] = generation
    sql += "ORDER BY generation, individual_id"
    with conn.cursor() as cur:
        cur.execute(sql, params)
        rows = cur.fetchall()
    return [_individual_record(row) for row in rows]


# --- trait leaderboard -----------------------------------------------------


def _as_dict(value: Any) -> dict | None:
    """Best-effort coercion of a jsonb column to a dict (psycopg may hand us a
    dict already, or a JSON string). Returns None for anything unparseable."""
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except (ValueError, TypeError):
            return None
    return value if isinstance(value, dict) else None


def _model_of(config: Any) -> str:
    """The target model name from an experiment config, or 'unknown'."""
    parsed = _as_dict(config)
    harness = parsed.get("harness") if parsed else None
    model = harness.get("model") if isinstance(harness, dict) else None
    return model or "unknown"


def _traits_of(genome: dict) -> list[tuple[str, str]]:
    """The (gene, allele) traits a genome exhibits. Booleans contribute only
    when on; multi-valued genes contribute one trait per active allele; an
    inactive boolean or empty list contributes nothing."""
    traits: list[tuple[str, str]] = []
    for gene, value in genome.items():
        if isinstance(value, bool):
            if value:
                traits.append((gene, "true"))
        elif isinstance(value, list):
            traits.extend((gene, str(allele)) for allele in value)
        elif value is not None:
            traits.append((gene, str(value)))
    return traits


def aggregate_trait_leaderboard(rows, limit: int) -> list[dict[str, Any]]:
    """Rank genome traits by how many successful individuals carry them, and
    collect the target models each trait has broken. Pure (no DB) so it is
    unit-testable directly. Each row is (genome, fitness, experiment_config)."""
    exploits: dict[tuple[str, str], int] = {}
    fitness_sum: dict[tuple[str, str], float] = {}
    models: dict[tuple[str, str], Counter] = {}
    for genome, fitness, config in rows:
        parsed = _as_dict(genome)
        if parsed is None:
            continue
        model = _model_of(config)
        for trait in _traits_of(parsed):
            exploits[trait] = exploits.get(trait, 0) + 1
            fitness_sum[trait] = fitness_sum.get(trait, 0.0) + (fitness or 0.0)
            models.setdefault(trait, Counter())[model] += 1

    entries = [
        {
            "gene": gene,
            "allele": allele,
            "exploits": count,
            "avg_fitness": fitness_sum[(gene, allele)] / count,
            "models": [
                {"model": name, "exploits": n}
                for name, n in models[(gene, allele)].most_common()
            ],
        }
        for (gene, allele), count in exploits.items()
    ]
    entries.sort(key=lambda e: (-e["exploits"], e["gene"], e["allele"]))
    return entries[:limit]


def trait_leaderboard(conn, threshold: float = 1.0, limit: int = 25) -> list[dict[str, Any]]:
    """Global leaderboard of traits present in successful individuals
    (fitness >= threshold) and the models they exploit, ranked by exploit count."""
    with conn.cursor() as cur:
        cur.execute(_LEADERBOARD_ROWS, {"threshold": threshold})
        rows = cur.fetchall()
    return aggregate_trait_leaderboard(rows, limit)


# --- DB-backed controller --------------------------------------------------


class DatabaseController:
    """`RunController` driven by the `runs` control plane.

    On each generation boundary it reads `runs.control`: 'stop' requests a
    clean cooperative stop; 'pause' blocks (polling) until the operator resumes
    (control back to 'none') or escalates to 'stop'. After a generation is
    stored it writes a heartbeat (progress + liveness + NOTIFY).

    `terminal_status` reflects how the run should be finalized: 'stopped' if a
    stop was honored, otherwise 'completed'. The worker reads this to call
    `finalize_run` with the right status.
    """

    def __init__(self, conn, run_id: str, poll_interval: float = 1.0) -> None:
        self._conn = conn
        self._run_id = run_id
        self._poll_interval = poll_interval
        self._stop_requested = False

    @property
    def terminal_status(self) -> str:
        return "stopped" if self._stop_requested else "completed"

    def before_generation(self, generation: int) -> None:
        while True:
            control = read_control(self._conn, self._run_id)
            if control == "stop":
                self._stop_requested = True
                return
            if control != "pause":
                return
            time.sleep(self._poll_interval)

    def should_stop(self, generation: int, population: list[Individual]) -> bool:
        if self._stop_requested:
            return True
        if read_control(self._conn, self._run_id) == "stop":
            self._stop_requested = True
        return self._stop_requested

    def on_generation_stored(self, generation: int, population: list[Individual]) -> None:
        heartbeat(self._conn, self._run_id, generation)
