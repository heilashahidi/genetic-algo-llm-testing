"""Evolution loop: evaluate, store, evolve."""

from __future__ import annotations

import random
from pathlib import Path

from ga.codec import gene_blocks, load_schema, sync_individual_genome
from ga.config import ExperimentConfig
from ga.fitness.synthetic import build_fitness_evaluator
from ga.harness.openai_compat import build_harness
from ga.individual import Individual
from ga.operators import (
    clone_individual,
    gene_block_crossover,
    mutate,
    repair_soft_constraints,
    tournament_select,
)
from ga.phenotype import build_phenotype
from ga.population import init_population, init_random_population, init_seed_only_population
from ga.storage import create_experiment_dir, store_generation


def evaluate_population(
    population: list[Individual],
    config: ExperimentConfig,
    schema: dict,
    harness,
    evaluator,
) -> None:
    for individual in population:
        if individual.fitness is not None and individual.phenotype is not None:
            continue
        phenotype = build_phenotype(individual.genome, config.target_query, schema)
        response = harness.complete(config.harness.system_prompt, phenotype)
        fitness = evaluator.score(phenotype, response, config.target_query)
        individual.phenotype = phenotype
        individual.model_response = response
        individual.fitness = fitness


def evolve_generation(
    population: list[Individual],
    config: ExperimentConfig,
    schema: dict,
    generation: int,
) -> list[Individual]:
    rng = random.Random(config.random_seed + generation)
    blocks = gene_blocks(schema)
    ranked = sorted(population, key=lambda individual: individual.fitness or 0.0, reverse=True)
    elite = [
        clone_individual(
            parent,
            individual_id=f"gen{generation}_{index:03d}",
            generation=generation,
            origin="elite",
        )
        for index, parent in enumerate(ranked[: config.ga.elite_count], start=1)
    ]
    offspring: list[Individual] = []
    next_index = len(elite) + 1
    while len(offspring) < config.ga.population_size - config.ga.elite_count:
        if rng.random() >= config.ga.crossover_rate:
            parent = tournament_select(population, config.ga.tournament_size, rng)
            child_vector = list(parent.vector_indices)
            origin = "crossover"
            parent_a_id = parent.id
            parent_b_id = None
        else:
            parent_a = tournament_select(population, config.ga.tournament_size, rng)
            parent_b = tournament_select(population, config.ga.tournament_size, rng)
            channel_aware = rng.random() < config.ga.channel_aware_crossover_rate
            child_vector, _ = gene_block_crossover(
                parent_a.vector_indices,
                parent_b.vector_indices,
                blocks,
                rng,
                channel_aware=channel_aware,
            )
            origin = "crossover"
            parent_a_id = parent_a.id
            parent_b_id = parent_b.id

        mutated_genes: list[str] = []
        if rng.random() < config.ga.mutation_rate:
            child_vector, mutated_genes = mutate(child_vector, blocks, schema, rng)
            origin = "mutation"

        child_vector = repair_soft_constraints(child_vector, schema)
        genome = sync_individual_genome(child_vector, schema)
        offspring.append(
            Individual(
                id=f"gen{generation}_{next_index:03d}",
                generation=generation,
                vector_indices=child_vector,
                genome=genome,
                origin=origin,
                parent_a_id=parent_a_id,
                parent_b_id=parent_b_id,
                mutated_genes=mutated_genes,
            )
        )
        next_index += 1

    return elite + offspring


def should_stop(population: list[Individual], generation: int, config: ExperimentConfig) -> bool:
    if generation + 1 >= config.ga.max_generations:
        return True
    if not population:
        return True
    best = max(individual.fitness or 0.0 for individual in population)
    return best >= 1.0


def run_experiment(config: ExperimentConfig, repo_root: Path | None = None) -> Path:
    repo_root = repo_root or Path(__file__).resolve().parents[2]
    schema = load_schema()
    harness = build_harness(config.harness, dry_run=config.dry_run)
    evaluator = build_fitness_evaluator(config.fitness)
    experiment_dir = create_experiment_dir(config, repo_root)

    if config.run_mode == "random":
        population = init_random_population(config, generation=0, schema=schema)
    elif config.run_mode == "seed-only":
        population = init_seed_only_population(config, generation=0, schema=schema)
    else:
        population = init_population(config, schema=schema)

    generation = 0
    while True:
        evaluate_population(population, config, schema, harness, evaluator)
        store_generation(experiment_dir, generation, population)
        if should_stop(population, generation, config):
            break

        generation += 1
        if config.run_mode == "random":
            population = init_random_population(config, generation=generation, schema=schema)
        elif config.run_mode == "seed-only":
            population = init_seed_only_population(config, generation=generation, schema=schema)
        else:
            population = evolve_generation(population, config, schema, generation)

    return experiment_dir
