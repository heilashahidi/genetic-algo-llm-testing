"""Evolution loop: evaluate, store, evolve."""

from __future__ import annotations

import random
from pathlib import Path
from typing import Protocol, runtime_checkable

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
from ga.storage import build_storage


@runtime_checkable
class RunController(Protocol):
    """Control port the evolution loop consults at generation boundaries.

    The GA core depends only on this protocol; concrete controllers (e.g. a
    database-backed one) live in outer layers. Hooks are called by
    `run_experiment` so cooperative pause/stop and progress reporting can be
    layered on without coupling the core to any database or framework.

    Implementations must keep these hooks side-effect-light and must never
    forcibly terminate the loop: stopping is cooperative, signalled by
    `should_stop` returning True at a generation boundary.
    """

    def before_generation(self, generation: int) -> None:
        """Called before a generation is evaluated/stored.

        A controller may block here (e.g. while paused) but must return so the
        loop can proceed or observe a subsequent stop request.
        """
        ...

    def should_stop(self, generation: int, population: list[Individual]) -> bool:
        """Return True to request a cooperative stop at this boundary."""
        ...

    def on_generation_stored(self, generation: int, population: list[Individual]) -> None:
        """Called after a generation has been persisted by storage."""
        ...


class NullController:
    """Default no-op controller; preserves the standalone/file behavior exactly."""

    def before_generation(self, generation: int) -> None:
        return None

    def should_stop(self, generation: int, population: list[Individual]) -> bool:
        return False

    def on_generation_stored(self, generation: int, population: list[Individual]) -> None:
        return None


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
            crossover_mask = None
        else:
            parent_a = tournament_select(population, config.ga.tournament_size, rng)
            parent_b = tournament_select(population, config.ga.tournament_size, rng)
            channel_aware = rng.random() < config.ga.channel_aware_crossover_rate
            child_vector, crossover_mask = gene_block_crossover(
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
                crossover_mask=crossover_mask,
            )
        )
        next_index += 1

    return elite + offspring


def should_stop(population: list[Individual], generation: int, config: ExperimentConfig) -> bool:
    if generation + 1 >= config.ga.max_generations:
        return True
    if not population:
        return True
    if not config.ga.stop_on_success:
        return False
    best = max(individual.fitness or 0.0 for individual in population)
    return best >= 1.0


def _init_population(config: ExperimentConfig, generation: int, schema: dict) -> list[Individual]:
    if config.run_mode == "random":
        return init_random_population(config, generation=generation, schema=schema)
    if config.run_mode == "seed-only":
        return init_seed_only_population(config, generation=generation, schema=schema)
    return init_population(config, schema=schema)


def run_experiment(
    config: ExperimentConfig,
    repo_root: Path | None = None,
    controller: RunController | None = None,
    storage=None,
) -> object:
    """Run the evolution loop, consulting `controller` at generation boundaries.

    With the default `NullController` the behavior is identical to the
    standalone/file path: evaluate, store, and stop only when the GA's own
    `should_stop` fires. A non-null controller can additionally request a
    cooperative stop (checked between generations) and observe progress.

    `storage` may be supplied to bind a pre-selected adapter (e.g. the worker
    binding the already-claimed run); when omitted it is selected from the
    environment via `build_storage`, preserving today's behavior.
    """
    repo_root = repo_root or Path(__file__).resolve().parents[2]
    controller = controller or NullController()
    schema = load_schema()
    harness = build_harness(config.harness, dry_run=config.dry_run)
    evaluator = build_fitness_evaluator(config.fitness)
    storage = storage or build_storage(config, repo_root)
    handle = storage.create_experiment(config)

    population = _init_population(config, generation=0, schema=schema)

    generation = 0
    while True:
        controller.before_generation(generation)
        evaluate_population(population, config, schema, harness, evaluator)
        storage.store_generation(handle, generation, population)
        controller.on_generation_stored(generation, population)
        if controller.should_stop(generation, population):
            break
        if should_stop(population, generation, config):
            break

        generation += 1
        if config.run_mode in ("random", "seed-only"):
            population = _init_population(config, generation=generation, schema=schema)
        else:
            population = evolve_generation(population, config, schema, generation)

    return handle
