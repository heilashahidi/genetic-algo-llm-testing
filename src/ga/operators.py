"""GA operators: selection, crossover, mutation, repair."""

from __future__ import annotations

import random
from copy import deepcopy

from ga.codec import GeneBlock, decode_vector_indices, extract_block, gene_blocks, write_block
from ga.individual import Individual


def tournament_select(
    population: list[Individual],
    k: int,
    rng: random.Random,
) -> Individual:
    contestants = rng.sample(population, k=min(k, len(population)))
    return max(contestants, key=lambda individual: individual.fitness or 0.0)


def gene_block_crossover(
    parent_a: list[int],
    parent_b: list[int],
    blocks: list[GeneBlock],
    rng: random.Random,
    *,
    channel_aware: bool = False,
) -> tuple[list[int], dict[str, str]]:
    child = list(parent_a)
    donor_map: dict[str, str] = {}
    if channel_aware:
        for channel in ("semantic", "perturbation"):
            pick_a = rng.random() < 0.5
            donor = parent_a if pick_a else parent_b
            donor_label = "a" if pick_a else "b"
            for block in blocks:
                if block.channel == channel:
                    write_block(child, block, extract_block(donor, block))
                    donor_map[block.name] = donor_label
        return child, donor_map

    for block in blocks:
        pick_a = rng.random() < 0.5
        donor = parent_a if pick_a else parent_b
        write_block(child, block, extract_block(donor, block))
        donor_map[block.name] = "a" if pick_a else "b"
    return child, donor_map


def _resample_categorical(block: GeneBlock, current: list[int], rng: random.Random) -> list[int]:
    choices = list(range(len(block.alleles)))
    current_index = current[0]
    choices = [choice for choice in choices if choice != current_index] or choices
    return [rng.choice(choices)]


def _mutate_block(
    block: GeneBlock,
    vector: list[int],
    schema: dict,
    rng: random.Random,
) -> None:
    current = extract_block(vector, block)
    if block.gene_type == "boolean":
        write_block(vector, block, [1 - current[0]])
        return
    if block.gene_type == "categorical":
        write_block(vector, block, _resample_categorical(block, current, rng))
        return

    flips = rng.randint(1, min(2, len(block.alleles))) if block.alleles else 0
    updated = list(current)
    indices = list(range(len(block.alleles)))
    rng.shuffle(indices)
    for index in indices[:flips]:
        if updated[index] == 0:
            updated[index] = 1
        elif rng.random() < 0.35:
            updated[index] = 0
    write_block(vector, block, updated)


def mutate(
    vector: list[int],
    blocks: list[GeneBlock],
    schema: dict,
    rng: random.Random,
    *,
    block_count: int | None = None,
) -> tuple[list[int], list[str]]:
    child = list(vector)
    count = block_count or rng.randint(1, min(3, len(blocks)))
    chosen = rng.sample(blocks, k=min(count, len(blocks)))
    for block in chosen:
        _mutate_block(block, child, schema, rng)
    return child, [block.name for block in chosen]


def repair_soft_constraints(vector: list[int], schema: dict) -> list[int]:
    repaired = list(vector)
    blocks = gene_blocks(schema)
    genome = decode_vector_indices(repaired, schema)
    # GCG optimization is a standalone suffix attack; clear any persona/framing/
    # override stacked onto it. Guard against custom schemas that drop these
    # genes (validate_schema accepts such schemas) by using .get() and only
    # touching blocks that exist.
    if genome.get("primary_strategy") == "optimization":
        for block in blocks:
            if block.name in {"persona_archetype", "framing_type", "override_mechanism"}:
                write_block(repaired, block, [0] * (block.end - block.start))

    for block in blocks:
        if block.gene_type != "multi_categorical":
            continue
        values = extract_block(repaired, block)
        active_indices = [index for index, bit in enumerate(values) if bit]
        if len(active_indices) <= 3:
            continue
        for index in active_indices[3:]:
            values[index] = 0
        write_block(repaired, block, values)
    return repaired


def gene_blocks_from_schema(schema: dict) -> list[GeneBlock]:
    return gene_blocks(schema)


def clone_individual(
    parent: Individual,
    *,
    individual_id: str,
    generation: int,
    origin: str,
) -> Individual:
    return Individual(
        id=individual_id,
        generation=generation,
        vector_indices=list(parent.vector_indices),
        genome=deepcopy(parent.genome),
        origin=origin,
        parent_a_id=parent.id,
        parent_b_id=None,
        mutated_genes=[],
        fitness=parent.fitness,
        phenotype=parent.phenotype,
        model_response=parent.model_response,
    )
