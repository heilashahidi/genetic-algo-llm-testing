"""Generation 0 population initialization."""

from __future__ import annotations

import csv
import json
import random
from collections import Counter
from typing import Any

from ga.codec import (
    ATTACK_LIBRARY_ROOT,
    gene_blocks,
    load_schema,
    sync_individual_genome,
)
from ga.config import ExperimentConfig
from ga.individual import Individual
from ga.operators import gene_block_crossover, repair_soft_constraints


GENOMES_JSONL = ATTACK_LIBRARY_ROOT / "data" / "genomes.jsonl"
GENE_FREQUENCY_CSV = ATTACK_LIBRARY_ROOT / "data" / "gene_frequency.csv"


def load_seed_records() -> list[dict[str, Any]]:
    return [json.loads(line) for line in GENOMES_JSONL.read_text(encoding="utf-8").splitlines() if line.strip()]


def load_allele_weights() -> dict[tuple[str, str], float]:
    weights: dict[tuple[str, str], float] = {}
    with GENE_FREQUENCY_CSV.open(encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            count = int(row["count"])
            weights[(row["gene"], row["allele"])] = 1.0 / (count + 1.0)
    return weights


def seed_rarity_score(record: dict[str, Any], allele_weights: dict[tuple[str, str], float]) -> float:
    score = 0.0
    genome = record["genome"]
    for gene_name, value in genome.items():
        if isinstance(value, list):
            if not value:
                score += allele_weights.get((gene_name, "none"), 1.0)
            for allele in value:
                score += allele_weights.get((gene_name, allele), 1.0)
        elif isinstance(value, bool):
            score += allele_weights.get((gene_name, str(value)), 1.0)
        else:
            score += allele_weights.get((gene_name, str(value)), 1.0)
    return score


def weighted_sample_without_replacement(
    records: list[dict[str, Any]],
    count: int,
    rng: random.Random,
    allele_weights: dict[tuple[str, str], float],
) -> list[dict[str, Any]]:
    pool = list(records)
    selected: list[dict[str, Any]] = []
    for _ in range(min(count, len(pool))):
        weights = [seed_rarity_score(record, allele_weights) for record in pool]
        total = sum(weights)
        pick = rng.random() * total
        cumulative = 0.0
        chosen_index = 0
        for index, weight in enumerate(weights):
            cumulative += weight
            if pick <= cumulative:
                chosen_index = index
                break
        selected.append(pool.pop(chosen_index))
    return selected


def random_valid_vector(schema: dict, rng: random.Random) -> list[int]:
    vector: list[int] = []
    for gene in schema["genes"]:
        if gene["type"] == "boolean":
            vector.append(rng.randint(0, 1))
        elif gene["type"] == "categorical":
            vector.append(rng.randrange(len(gene["alleles"])))
        elif gene["type"] == "multi_categorical":
            active_count = rng.randint(0, min(3, len(gene["alleles"])))
            active = set(rng.sample(gene["alleles"], active_count)) if active_count else set()
            vector.extend(1 if allele in active else 0 for allele in gene["alleles"])
        else:
            raise ValueError(f"unsupported gene type {gene['type']!r}")
    return repair_soft_constraints(vector, schema)


def make_individual(
    *,
    individual_id: str,
    generation: int,
    vector: list[int],
    schema: dict,
    origin: str,
    parent_a_id: str | None = None,
    parent_b_id: str | None = None,
    mutated_genes: list[str] | None = None,
) -> Individual:
    genome = sync_individual_genome(vector, schema)
    return Individual(
        id=individual_id,
        generation=generation,
        vector_indices=list(vector),
        genome=genome,
        origin=origin,
        parent_a_id=parent_a_id,
        parent_b_id=parent_b_id,
        mutated_genes=mutated_genes or [],
    )


def init_population(config: ExperimentConfig, schema: dict | None = None) -> list[Individual]:
    schema = schema or load_schema()
    rng = random.Random(config.random_seed)
    ga = config.ga
    seeds = load_seed_records()
    allele_weights = load_allele_weights()
    blocks = gene_blocks(schema)

    stratified = weighted_sample_without_replacement(
        seeds, ga.seed_stratified_count, rng, allele_weights
    )
    population: list[Individual] = []
    for index, record in enumerate(stratified, start=1):
        population.append(
            make_individual(
                individual_id=f"gen0_{index:03d}",
                generation=0,
                vector=list(record["vector_indices"]),
                schema=schema,
                origin="seed",
            )
        )

    start = len(population) + 1
    for offset in range(ga.seed_recombinant_count):
        parent_a = rng.choice(seeds)
        parent_b = rng.choice(seeds)
        child_vector, _ = gene_block_crossover(
            parent_a["vector_indices"],
            parent_b["vector_indices"],
            blocks,
            rng,
        )
        child_vector = repair_soft_constraints(child_vector, schema)
        population.append(
            make_individual(
                individual_id=f"gen0_{start + offset:03d}",
                generation=0,
                vector=child_vector,
                schema=schema,
                origin="recombinant",
                parent_a_id=parent_a["id"],
                parent_b_id=parent_b["id"],
            )
        )

    start = len(population) + 1
    for offset in range(ga.seed_random_count):
        vector = random_valid_vector(schema, rng)
        population.append(
            make_individual(
                individual_id=f"gen0_{start + offset:03d}",
                generation=0,
                vector=vector,
                schema=schema,
                origin="random",
            )
        )

    if len(population) != ga.population_size:
        raise RuntimeError(
            f"expected population size {ga.population_size}, got {len(population)}"
        )
    return population


def init_random_population(
    config: ExperimentConfig,
    generation: int,
    schema: dict | None = None,
    id_prefix: str | None = None,
) -> list[Individual]:
    schema = schema or load_schema()
    rng = random.Random(config.random_seed + generation)
    prefix = id_prefix or f"gen{generation}_"
    population: list[Individual] = []
    for index in range(1, config.ga.population_size + 1):
        vector = random_valid_vector(schema, rng)
        population.append(
            make_individual(
                individual_id=f"{prefix}{index:03d}",
                generation=generation,
                vector=vector,
                schema=schema,
                origin="random",
            )
        )
    return population


def init_seed_only_population(
    config: ExperimentConfig,
    generation: int,
    schema: dict | None = None,
) -> list[Individual]:
    schema = schema or load_schema()
    rng = random.Random(config.random_seed + generation)
    seeds = load_seed_records()
    allele_weights = load_allele_weights()
    selected = weighted_sample_without_replacement(
        seeds, config.ga.population_size, rng, allele_weights
    )
    population: list[Individual] = []
    for index, record in enumerate(selected, start=1):
        population.append(
            make_individual(
                individual_id=f"gen{generation}_{index:03d}",
                generation=generation,
                vector=list(record["vector_indices"]),
                schema=schema,
                origin="seed",
            )
        )
    return population
