"""Crossover-mask provenance attached by `evolve_generation`.

Two-parent offspring carry a donor map (gene block name -> "a"/"b"); the
single-parent copy branch carries `None`. Forcing crossover_rate to 0 and 1
exercises both paths deterministically.
"""

from ga.codec import gene_blocks, load_schema
from ga.config import ExperimentConfig
from ga.evolution import evolve_generation
from ga.population import init_population


def _config(**overrides):
    config = ExperimentConfig(random_seed=7, dry_run=True)
    config.ga.population_size = 12
    config.ga.elite_count = 2
    config.ga.seed_stratified_count = 8
    config.ga.seed_recombinant_count = 3
    config.ga.seed_random_count = 1
    config.ga.max_generations = 2
    for key, value in overrides.items():
        setattr(config.ga, key, value)
    return config


def _scored_population(config, schema):
    population = init_population(config, schema=schema)
    for index, individual in enumerate(population):
        individual.fitness = index / 100.0
        individual.phenotype = f"p{index}"
        individual.model_response = f"r{index}"
    return population


def test_two_parent_offspring_carry_crossover_mask():
    schema = load_schema()
    # crossover_rate=1 (always two-parent), mutation_rate=0 (keep origin crossover)
    config = _config(crossover_rate=1.0, mutation_rate=0.0)
    population = _scored_population(config, schema)

    next_gen = evolve_generation(population, config, schema, generation=1)
    block_names = {block.name for block in gene_blocks(schema)}

    offspring = [ind for ind in next_gen if ind.origin != "elite"]
    assert offspring
    for child in offspring:
        assert child.crossover_mask is not None
        assert set(child.crossover_mask.keys()) == block_names
        assert set(child.crossover_mask.values()) <= {"a", "b"}


def test_single_parent_copy_has_no_crossover_mask():
    schema = load_schema()
    # crossover_rate=0 -> single-parent copy branch for every offspring
    config = _config(crossover_rate=0.0, mutation_rate=0.0)
    population = _scored_population(config, schema)

    next_gen = evolve_generation(population, config, schema, generation=1)
    offspring = [ind for ind in next_gen if ind.origin != "elite"]
    assert offspring
    for child in offspring:
        assert child.crossover_mask is None
