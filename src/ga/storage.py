"""Experiment persistence.

Defines the `Storage` port the evolution loop depends on, the file-based
`FileStorage` adapter, and a `build_storage` factory that selects an adapter
from the environment. The GA core imports this port only; database-specific
code lives in `ga.storage_postgres` and is imported lazily by the factory.
"""

from __future__ import annotations

import csv
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Protocol, runtime_checkable

from ga.config import ExperimentConfig
from ga.individual import Individual


@runtime_checkable
class Storage(Protocol):
    """Persistence port used by the evolution loop.

    An experiment handle (a path, a run id, ...) is created by
    `create_experiment` and passed back into `store_generation`. The concrete
    handle type is opaque to the GA core.
    """

    def create_experiment(self, config: ExperimentConfig) -> object:
        ...

    def store_generation(
        self,
        handle: object,
        generation: int,
        population: list[Individual],
    ) -> None:
        ...


# --- summary math (pure, shared) -------------------------------------------


def summary_stats(population: list[Individual]) -> dict[str, float]:
    """Best / average fitness and success rate for a population.

    Pure function shared by every adapter so the summary math is identical
    regardless of where it is persisted. `None` fitness is treated as 0.0.
    """
    fitness_values = [individual.fitness or 0.0 for individual in population]
    if not fitness_values:
        return {"best_fitness": 0.0, "avg_fitness": 0.0, "success_rate": 0.0}
    best = max(fitness_values)
    average = sum(fitness_values) / len(fitness_values)
    success_rate = sum(1 for value in fitness_values if value >= 1.0) / len(fitness_values)
    return {"best_fitness": best, "avg_fitness": average, "success_rate": success_rate}


def lineage_record(individual: Individual) -> dict[str, object]:
    """The lineage row for one individual (shared by file + DB adapters)."""
    return {
        "generation": individual.generation,
        "individual_id": individual.id,
        "vector_indices": individual.vector_indices,
        "genome": individual.genome,
        "parent_a_id": individual.parent_a_id,
        "parent_b_id": individual.parent_b_id,
        "operator": individual.origin,
        "mutated_genes": individual.mutated_genes,
        "fitness": individual.fitness,
        "phenotype_char_length": len(individual.phenotype) if individual.phenotype else 0,
        "model_response_hash": individual.model_response_hash(),
        "phenotype": individual.phenotype,
        "model_response": individual.model_response,
        "crossover_mask": individual.crossover_mask,
    }


# --- file adapter ----------------------------------------------------------


class FileStorage:
    """File-based persistence: config.json, gen_NNN.jsonl, lineage.jsonl, summary.csv."""

    def __init__(self, repo_root: Path) -> None:
        self.repo_root = repo_root

    def create_experiment(self, config: ExperimentConfig) -> Path:
        return create_experiment_dir(config, self.repo_root)

    def store_generation(
        self,
        handle: Path,
        generation: int,
        population: list[Individual],
    ) -> None:
        store_generation(handle, generation, population)


# --- module-level functions (kept for backwards compatibility) -------------


def create_experiment_dir(config: ExperimentConfig, repo_root: Path) -> Path:
    experiment_id = config.experiment_id or datetime.now(timezone.utc).strftime("exp_%Y%m%d_%H%M%S")
    experiment_dir = repo_root / config.output_dir / experiment_id
    (experiment_dir / "generations").mkdir(parents=True, exist_ok=True)
    config_payload = config.to_dict()
    config_payload["experiment_id"] = experiment_id
    (experiment_dir / "config.json").write_text(
        json.dumps(config_payload, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    return experiment_dir


def store_generation(
    experiment_dir: Path,
    generation: int,
    population: list[Individual],
) -> None:
    generation_path = experiment_dir / "generations" / f"gen_{generation:03d}.jsonl"
    with generation_path.open("w", encoding="utf-8") as handle:
        for individual in population:
            handle.write(json.dumps(individual.to_record(), ensure_ascii=False) + "\n")

    append_lineage(experiment_dir, population)
    update_summary(experiment_dir, generation, population)


def append_lineage(experiment_dir: Path, population: list[Individual]) -> None:
    lineage_path = experiment_dir / "lineage.jsonl"
    with lineage_path.open("a", encoding="utf-8") as handle:
        for individual in population:
            handle.write(json.dumps(lineage_record(individual), ensure_ascii=False) + "\n")


def update_summary(experiment_dir: Path, generation: int, population: list[Individual]) -> None:
    summary_path = experiment_dir / "summary.csv"
    stats = summary_stats(population)
    write_header = not summary_path.exists()
    with summary_path.open("a", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        if write_header:
            writer.writerow(["generation", "best_fitness", "avg_fitness", "success_rate"])
        writer.writerow(
            [generation, stats["best_fitness"], stats["avg_fitness"], stats["success_rate"]]
        )


# --- factory ---------------------------------------------------------------


def build_storage(config: ExperimentConfig, repo_root: Path) -> Storage:
    """Select a storage adapter from the environment.

    Returns `FileStorage` by default; `PostgresStorage` when `STORAGE=postgres`
    (reading `DATABASE_URL`). The psycopg-backed adapter is imported lazily so
    the GA core loads without psycopg installed.
    """
    backend = os.environ.get("STORAGE", "file").lower()
    if backend == "postgres":
        from ga.storage_postgres import PostgresStorage

        database_url = os.environ.get("DATABASE_URL")
        if not database_url:
            raise ValueError("STORAGE=postgres requires DATABASE_URL to be set")
        return PostgresStorage(database_url)
    return FileStorage(repo_root)
