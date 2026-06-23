from ga.config import ExperimentConfig
from ga.population import init_population, init_random_population, init_seed_only_population


def test_init_population_size_and_origins():
    config = ExperimentConfig(random_seed=11)
    population = init_population(config)
    assert len(population) == 100
    # Default split (70/30/0) sums to population_size, so it is respected as-is.
    origins = {individual.origin for individual in population}
    assert origins == {"seed", "recombinant"}
    assert sum(1 for individual in population if individual.origin == "seed") == 70
    assert sum(1 for individual in population if individual.origin == "recombinant") == 30
    assert sum(1 for individual in population if individual.origin == "random") == 0


def test_random_mode_population_size():
    config = ExperimentConfig(random_seed=3)
    config.ga.population_size = 20
    population = init_random_population(config, generation=1)
    assert len(population) == 20
    assert all(individual.origin == "random" for individual in population)


def test_seed_only_population_size():
    config = ExperimentConfig(random_seed=5)
    config.ga.population_size = 25
    population = init_seed_only_population(config, generation=2)
    assert len(population) == 25
    assert all(individual.origin == "seed" for individual in population)
