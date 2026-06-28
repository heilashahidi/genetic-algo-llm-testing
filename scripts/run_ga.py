#!/usr/bin/env python3
"""CLI entry point for GA experiments."""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import traceback
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "src"))

from ga.config import ExperimentConfig, HarnessConfig, load_config
from ga.evolution import run_experiment
from ga.population import load_seed_records, resolve_seed_counts


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run adversarial prompt GA experiments")
    parser.add_argument("--config", type=Path, help="Path to JSON or YAML experiment config")
    parser.add_argument("--provider", choices=["ollama", "lmstudio", "mock"])
    parser.add_argument("--model", help="Target model name")
    parser.add_argument("--generations", type=int, help="Maximum generations")
    parser.add_argument("--population", type=int, help="Population size")
    parser.add_argument("--mode", choices=["ga", "random", "seed-only"], dest="run_mode")
    parser.add_argument("--target-query", help="Synthetic target query")
    parser.add_argument(
        "--max-parallel",
        type=int,
        dest="max_parallel_requests",
        help="Max individuals evaluated concurrently per generation (LLM requests)",
    )
    parser.add_argument("--seed", type=int, dest="random_seed")
    parser.add_argument("--dry-run", action="store_true", help="Use mock harness and synthetic fitness")
    parser.add_argument("--experiment-id", help="Optional experiment directory name")
    parser.add_argument(
        "--worker",
        action="store_true",
        help="Run as a long-lived worker: claim queued runs from the database and execute them",
    )
    parser.add_argument(
        "--poll-interval",
        type=float,
        default=2.0,
        help="Seconds to sleep when no run is queued (worker mode)",
    )
    return parser


def apply_overrides(config: ExperimentConfig, args: argparse.Namespace) -> ExperimentConfig:
    if args.provider:
        previous = config.harness
        config.harness = HarnessConfig.for_provider(
            args.provider,
            args.model or previous.model,
            previous.system_prompt,
        )
        # for_provider only sets provider/base_url/model/system_prompt; carry the
        # remaining tuning fields from the loaded config so --provider doesn't
        # silently reset them to dataclass defaults.
        config.harness.timeout_seconds = previous.timeout_seconds
        config.harness.max_parallel_requests = previous.max_parallel_requests
        config.harness.api_key = previous.api_key
    if args.model:
        config.harness.model = args.model
    if args.generations is not None:
        config.ga.max_generations = args.generations
    if args.population is not None:
        config.ga.population_size = args.population
        n_seeds = len(load_seed_records())
        (
            config.ga.seed_stratified_count,
            config.ga.seed_recombinant_count,
            config.ga.seed_random_count,
        ) = resolve_seed_counts(args.population, n_seeds)
    if args.run_mode:
        config.run_mode = args.run_mode
    if args.target_query:
        config.target_query = args.target_query
    if args.max_parallel_requests is not None:
        config.harness.max_parallel_requests = args.max_parallel_requests
    if args.random_seed is not None:
        config.random_seed = args.random_seed
    if args.dry_run:
        config.dry_run = True
        config.harness.provider = "mock"
    if args.experiment_id:
        config.experiment_id = args.experiment_id
    return config


def _process_one_run(conn, run: dict) -> None:
    """Run a single claimed run to completion; finalize its terminal status.

    Loads `ExperimentConfig` from the run's experiment.config, runs the loop
    with the Postgres storage bound to the claimed run and a DB-backed
    controller, then finalizes. Exceptions are caught by the caller.
    """
    from ga.run_lifecycle import DatabaseController, finalize_run
    from ga.storage_postgres import PostgresHandle, PostgresStorage

    database_url = os.environ["DATABASE_URL"]
    run_id = run["id"]
    experiment_id = run["experiment_id"]

    with conn.cursor() as cur:
        cur.execute("SELECT config FROM experiments WHERE id = %s", (experiment_id,))
        row = cur.fetchone()
    if row is None:
        raise LookupError(f"experiment {experiment_id} not found for run {run_id}")
    config_payload = row[0] if isinstance(row[0], dict) else json.loads(row[0])
    config = ExperimentConfig.from_dict(config_payload)

    handle = PostgresHandle(experiment_id=experiment_id, run_id=run_id)
    storage = PostgresStorage(database_url, handle=handle)
    controller = DatabaseController(conn, run_id)
    try:
        run_experiment(config, repo_root=REPO_ROOT, controller=controller, storage=storage)
        finalize_run(conn, run_id, controller.terminal_status)
        print(f"Run {run_id} finalized: {controller.terminal_status}")
    finally:
        storage.close()


def run_worker(poll_interval: float) -> None:
    """Long-lived worker: claim queued runs and execute them, forever."""
    from ga.run_lifecycle import claim_run, connect, finalize_run

    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise SystemExit("--worker requires DATABASE_URL to be set")
    os.environ.setdefault("STORAGE", "postgres")

    conn = connect(database_url)
    print("Worker started; polling for queued runs...")
    while True:
        try:
            run = claim_run(conn)
        except Exception:  # noqa: BLE001 - a transient DB error must not kill the worker
            print(f"claim_run failed:\n{traceback.format_exc()}", file=sys.stderr)
            time.sleep(poll_interval)
            continue
        if run is None:
            time.sleep(poll_interval)
            continue
        print(f"Claimed run {run['id']}")
        try:
            _process_one_run(conn, run)
        except Exception:  # noqa: BLE001 - a failed run must not kill the worker
            error = traceback.format_exc()
            print(f"Run {run['id']} failed:\n{error}", file=sys.stderr)
            try:
                finalize_run(conn, run["id"], "failed", error=error)
            except Exception:  # noqa: BLE001 - best-effort finalization
                print("Failed to finalize run as failed", file=sys.stderr)


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    if args.worker:
        run_worker(args.poll_interval)
        return
    if args.config:
        config = load_config(args.config)
    else:
        config = ExperimentConfig()
    config = apply_overrides(config, args)
    experiment_dir = run_experiment(config, repo_root=REPO_ROOT)
    print(f"Experiment complete: {experiment_dir}")


if __name__ == "__main__":
    main()
