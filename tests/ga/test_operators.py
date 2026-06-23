import random

import pytest

from ga.codec import gene_blocks, load_schema
from ga.individual import Individual
from ga.operators import gene_block_crossover, mutate, repair_soft_constraints, tournament_select


@pytest.fixture
def schema():
    return load_schema()


@pytest.fixture
def rng():
    return random.Random(7)


def make_individual(individual_id: str, vector: list[int], fitness: float) -> Individual:
    return Individual(
        id=individual_id,
        generation=0,
        vector_indices=vector,
        genome={},
        origin="seed",
        fitness=fitness,
    )


def test_tournament_select_prefers_higher_fitness(rng):
    population = [
        make_individual("a", [0] * 39, 0.1),
        make_individual("b", [1] * 39, 0.9),
        make_individual("c", [0] * 39, 0.2),
    ]
    winner = tournament_select(population, k=3, rng=rng)
    assert winner.id == "b"


def test_crossover_respects_block_boundaries(schema, rng):
    blocks = gene_blocks(schema)
    parent_a = [0] * 39
    parent_b = [1] * 39
    child, _ = gene_block_crossover(parent_a, parent_b, blocks, rng)
    for block in blocks:
        segment = child[block.start : block.end]
        assert segment == parent_a[block.start : block.end] or segment == parent_b[block.start : block.end]


def test_crossover_returns_donor_map_over_all_blocks(schema, rng):
    blocks = gene_blocks(schema)
    parent_a = [0] * 39
    parent_b = [1] * 39
    child, donor_map = gene_block_crossover(parent_a, parent_b, blocks, rng)

    assert set(donor_map.keys()) == {block.name for block in blocks}
    assert set(donor_map.values()) <= {"a", "b"}
    # the donor label must match which parent actually donated each block
    for block in blocks:
        segment = child[block.start : block.end]
        if donor_map[block.name] == "a":
            assert segment == parent_a[block.start : block.end]
        else:
            assert segment == parent_b[block.start : block.end]


def test_channel_aware_crossover_donor_uniform_per_channel(schema, rng):
    blocks = gene_blocks(schema)
    parent_a = [0] * 39
    parent_b = [1] * 39
    child, donor_map = gene_block_crossover(
        parent_a, parent_b, blocks, rng, channel_aware=True
    )

    assert set(donor_map.keys()) == {block.name for block in blocks}
    assert set(donor_map.values()) <= {"a", "b"}
    # every block in a channel shares that channel's chosen donor
    by_channel: dict[str, set[str]] = {}
    for block in blocks:
        by_channel.setdefault(block.channel, set()).add(donor_map[block.name])
    for labels in by_channel.values():
        assert len(labels) == 1
    for block in blocks:
        segment = child[block.start : block.end]
        expected = parent_a if donor_map[block.name] == "a" else parent_b
        assert segment == expected[block.start : block.end]


def test_repair_clears_persona_for_optimization(schema):
    blocks = gene_blocks(schema)
    optimization_index = next(
        index for index, gene in enumerate(schema["genes"]) if gene["name"] == "primary_strategy"
    )
    optimization_allele = schema["genes"][optimization_index]["alleles"].index("optimization")
    vector = [0] * 39
    vector[optimization_index] = optimization_allele
    persona_block = next(block for block in blocks if block.name == "persona_archetype")
    vector[persona_block.start] = 1
    repaired = repair_soft_constraints(vector, schema)
    assert sum(repaired[persona_block.start : persona_block.end]) == 0


def test_repair_trims_multi_gene_excess(schema, rng):
    blocks = gene_blocks(schema)
    persona_block = next(block for block in blocks if block.name == "persona_archetype")
    vector = [0] * 39
    for index in range(persona_block.start, persona_block.end):
        vector[index] = 1
    repaired = repair_soft_constraints(vector, schema)
    assert sum(repaired[persona_block.start : persona_block.end]) <= 3


def test_mutate_changes_at_least_one_block(schema, rng):
    blocks = gene_blocks(schema)
    vector = [0] * 39
    mutated, changed = mutate(vector, blocks, schema, rng, block_count=2)
    assert changed
    assert mutated != vector
