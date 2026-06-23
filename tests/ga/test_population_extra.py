from ga.codec import build_vector_layout, decode_vector_indices, load_schema
from ga.config import ExperimentConfig
from ga.population import init_population


def _config(**ga_overrides):
    config = ExperimentConfig(random_seed=21)
    for key, value in ga_overrides.items():
        setattr(config.ga, key, value)
    return config


def test_seed_counts_add_up_to_population_size():
    config = _config(
        population_size=12,
        seed_stratified_count=7,
        seed_recombinant_count=3,
        seed_random_count=2,
    )
    schema = load_schema()
    population = init_population(config, schema=schema)

    assert len(population) == config.ga.population_size
    assert (
        config.ga.seed_stratified_count
        + config.ga.seed_recombinant_count
        + config.ga.seed_random_count
        == config.ga.population_size
    )
    assert sum(1 for i in population if i.origin == "seed") == config.ga.seed_stratified_count
    assert (
        sum(1 for i in population if i.origin == "recombinant")
        == config.ga.seed_recombinant_count
    )
    assert sum(1 for i in population if i.origin == "random") == config.ga.seed_random_count


def test_init_population_is_deterministic():
    schema = load_schema()
    config_a = _config(
        population_size=12,
        seed_stratified_count=7,
        seed_recombinant_count=3,
        seed_random_count=2,
    )
    config_b = _config(
        population_size=12,
        seed_stratified_count=7,
        seed_recombinant_count=3,
        seed_random_count=2,
    )

    pop_a = init_population(config_a, schema=schema)
    pop_b = init_population(config_b, schema=schema)

    vectors_a = [tuple(i.vector_indices) for i in pop_a]
    vectors_b = [tuple(i.vector_indices) for i in pop_b]
    assert vectors_a == vectors_b


def test_every_individual_has_schema_valid_genome():
    config = _config(
        population_size=12,
        seed_stratified_count=7,
        seed_recombinant_count=3,
        seed_random_count=2,
    )
    schema = load_schema()
    expected_length = len(build_vector_layout(schema))
    population = init_population(config, schema=schema)

    for individual in population:
        assert len(individual.vector_indices) == expected_length
        # decode must not raise; genome must match stored genome
        decoded = decode_vector_indices(individual.vector_indices, schema)
        assert decoded == individual.genome
