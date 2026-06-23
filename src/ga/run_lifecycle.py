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
    "parent_a_id, parent_b_id, phenotype_char_length, model_response_hash "
    "FROM individuals WHERE run_id = %(run_id)s "
)

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
