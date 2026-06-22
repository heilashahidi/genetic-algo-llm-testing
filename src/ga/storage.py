"""Experiment persistence."""

from __future__ import annotations

import csv
import json
from datetime import datetime, timezone
from pathlib import Path

from ga.config import ExperimentConfig
from ga.individual import Individual


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
            record = {
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
            }
            handle.write(json.dumps(record, ensure_ascii=False) + "\n")


def update_summary(experiment_dir: Path, generation: int, population: list[Individual]) -> None:
    summary_path = experiment_dir / "summary.csv"
    fitness_values = [individual.fitness or 0.0 for individual in population]
    best = max(fitness_values) if fitness_values else 0.0
    average = sum(fitness_values) / len(fitness_values) if fitness_values else 0.0
    success_rate = (
        sum(1 for value in fitness_values if value >= 1.0) / len(fitness_values)
        if fitness_values
        else 0.0
    )
    write_header = not summary_path.exists()
    with summary_path.open("a", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        if write_header:
            writer.writerow(["generation", "best_fitness", "avg_fitness", "success_rate"])
        writer.writerow([generation, best, average, success_rate])
