from ga.codec import build_vector_layout, decode_vector_indices, load_schema
from ga.config import ExperimentConfig
from ga.population import init_population, load_seed_records, resolve_seed_counts


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


def test_inconsistent_counts_auto_derive_real_attack_heavy_policy():
    # Default counts (70/30/0) do NOT sum to population_size=6, so init_population
    # must self-correct via resolve_seed_counts(6, 121) = (4 seed, 2 recombinant).
    config = _config(population_size=6)
    seeds = load_seed_records()
    expected = resolve_seed_counts(6, len(seeds))
    assert expected == (4, 2, 0)

    population = init_population(config, schema=load_schema())

    assert len(population) == 6
    origins = [i.origin for i in population]
    assert set(origins) == {"seed", "recombinant"}
    assert origins.count("seed") == 4
    assert origins.count("recombinant") == 2
    assert origins.count("random") == 0

    # "seed" individuals must come from real downloaded attack records.
    seed_vectors = {tuple(record["vector_indices"]) for record in seeds}
    seed_ids = {record["id"] for record in seeds}
    for individual in population:
        if individual.origin == "seed":
            assert tuple(individual.vector_indices) in seed_vectors
        else:
            assert individual.parent_a_id in seed_ids
            assert individual.parent_b_id in seed_ids


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
