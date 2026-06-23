"""Unit tests for the resolve_seed_counts policy function."""

import pytest

from ga.population import resolve_seed_counts


N_SEEDS = 121


@pytest.mark.parametrize(
    "population, expected",
    [
        (1, (1, 0, 0)),
        (6, (4, 2, 0)),
        (50, (35, 15, 0)),
        (121, (85, 36, 0)),
        (300, (121, 179, 0)),
    ],
)
def test_default_policy_examples(population, expected):
    assert resolve_seed_counts(population, N_SEEDS) == expected


@pytest.mark.parametrize("population", [1, 6, 12, 40, 50, 100, 121, 300, 500])
def test_counts_sum_to_population_and_are_valid(population):
    stratified, recombinant, random_count = resolve_seed_counts(population, N_SEEDS)
    assert stratified + recombinant + random_count == population
    assert stratified >= 0 and recombinant >= 0 and random_count >= 0
    assert stratified <= N_SEEDS
    # Default policy never produces random genomes.
    assert random_count == 0


def test_stratified_overflow_spills_into_recombinant():
    # With only 5 real seeds, stratified is capped and the rest become combos.
    stratified, recombinant, random_count = resolve_seed_counts(100, 5)
    assert stratified == 5
    assert random_count == 0
    assert stratified + recombinant + random_count == 100


def test_random_fraction_knob():
    stratified, recombinant, random_count = resolve_seed_counts(
        100, N_SEEDS, random_fraction=0.1
    )
    assert random_count == 10
    assert stratified + recombinant + random_count == 100


def test_recombinant_fraction_knob():
    stratified, recombinant, random_count = resolve_seed_counts(
        100, N_SEEDS, recombinant_fraction=0.5
    )
    assert recombinant == 50
    assert stratified == 50
    assert random_count == 0
