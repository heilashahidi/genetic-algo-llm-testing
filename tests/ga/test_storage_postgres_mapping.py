"""No-DB tests for the PostgresStorage record->row mapping and the factory.

These exercise the pure mapping functions and the env-driven factory without
ever opening a database connection.
"""

import json

import pytest

from ga.config import ExperimentConfig
from ga.individual import Individual
from ga.storage import FileStorage, build_storage, summary_stats
from ga.storage_postgres import (
    PostgresStorage,
    experiment_row,
    generation_row,
    individual_rows,
    run_row,
)


def make_individual(
    individual_id,
    generation=0,
    fitness=0.5,
    phenotype="hello world",
    model_response="model says hi",
    origin="seed",
    parent_a_id="parent-a",
    parent_b_id=None,
):
    return Individual(
        id=individual_id,
        generation=generation,
        vector_indices=[0, 1, 2],
        genome={"gene_a": "value_a", "gene_b": "value_b"},
        origin=origin,
        parent_a_id=parent_a_id,
        parent_b_id=parent_b_id,
        mutated_genes=["gene_a"],
        fitness=fitness,
        phenotype=phenotype,
        model_response=model_response,
    )


# --- experiment_row / run_row ----------------------------------------------


def test_experiment_row_serializes_config_to_json():
    config = ExperimentConfig(experiment_id="exp_map")
    row = experiment_row(config, experiment_id="fixed-id")

    assert row["id"] == "fixed-id"
    assert row["name"] == "exp_map"
    # config column is JSON text round-tripping the full config dict
    parsed = json.loads(row["config"])
    assert parsed["experiment_id"] == "exp_map"
    assert parsed["ga"]["population_size"] == config.ga.population_size


def test_run_row_starts_running_with_no_control():
    row = run_row("exp-1", run_id="run-1")
    assert row == {
        "id": "run-1",
        "experiment_id": "exp-1",
        "status": "running",
        "control": "none",
        "current_generation": 0,
    }


# --- generation_row (summary math) -----------------------------------------


def test_generation_row_matches_summary_stats():
    population = [
        make_individual("a", fitness=0.0),
        make_individual("b", fitness=0.5),
        make_individual("c", fitness=1.0),
        make_individual("d", fitness=1.0),
    ]
    row = generation_row("run-1", 3, population)
    stats = summary_stats(population)

    assert row["run_id"] == "run-1"
    assert row["generation"] == 3
    assert row["best_fitness"] == pytest.approx(stats["best_fitness"]) == pytest.approx(1.0)
    assert row["avg_fitness"] == pytest.approx(stats["avg_fitness"]) == pytest.approx(0.625)
    assert row["success_rate"] == pytest.approx(stats["success_rate"]) == pytest.approx(0.5)


def test_generation_row_treats_none_fitness_as_zero():
    population = [make_individual("a", fitness=None), make_individual("b", fitness=1.0)]
    row = generation_row("run-1", 0, population)
    assert row["best_fitness"] == pytest.approx(1.0)
    assert row["avg_fitness"] == pytest.approx(0.5)
    assert row["success_rate"] == pytest.approx(0.5)


# --- individual_rows -------------------------------------------------------


def test_individual_rows_one_per_individual_with_expected_columns():
    population = [make_individual(f"ind-{i}") for i in range(3)]
    rows = individual_rows("run-1", population)

    assert len(rows) == 3
    expected_keys = {
        "id",
        "run_id",
        "individual_id",
        "generation",
        "genome",
        "fitness",
        "origin",
        "parent_a_id",
        "parent_b_id",
        "phenotype_char_length",
        "model_response_hash",
    }
    for row, individual in zip(rows, population):
        assert set(row.keys()) == expected_keys
        assert row["run_id"] == "run-1"
        assert row["individual_id"] == individual.id
        assert row["fitness"] == individual.fitness
        assert row["origin"] == individual.origin
        # genome is serialized to JSON text for the jsonb column
        assert json.loads(row["genome"]) == individual.genome
        assert row["phenotype_char_length"] == len(individual.phenotype)
        assert row["model_response_hash"] == individual.model_response_hash()


def test_individual_rows_carry_lineage_parent_ids():
    individual = make_individual(
        "child", origin="crossover", parent_a_id="pa", parent_b_id="pb"
    )
    row = individual_rows("run-1", [individual])[0]
    assert row["parent_a_id"] == "pa"
    assert row["parent_b_id"] == "pb"
    assert row["origin"] == "crossover"


def test_individual_rows_have_unique_ids():
    rows = individual_rows("run-1", [make_individual(f"ind-{i}") for i in range(5)])
    ids = [row["id"] for row in rows]
    assert len(set(ids)) == len(ids)


# --- factory ---------------------------------------------------------------


def test_build_storage_defaults_to_file_storage(tmp_path, monkeypatch):
    monkeypatch.delenv("STORAGE", raising=False)
    storage = build_storage(ExperimentConfig(), repo_root=tmp_path)
    assert isinstance(storage, FileStorage)


def test_build_storage_postgres_when_env_set(tmp_path, monkeypatch):
    monkeypatch.setenv("STORAGE", "postgres")
    monkeypatch.setenv("DATABASE_URL", "postgresql://localhost/does-not-connect")
    storage = build_storage(ExperimentConfig(), repo_root=tmp_path)
    # construction is lazy: no connection opened, so this needs no DB
    assert isinstance(storage, PostgresStorage)
    assert storage.database_url == "postgresql://localhost/does-not-connect"
    assert storage._conn is None


def test_build_storage_postgres_requires_database_url(tmp_path, monkeypatch):
    monkeypatch.setenv("STORAGE", "postgres")
    monkeypatch.delenv("DATABASE_URL", raising=False)
    with pytest.raises(ValueError):
        build_storage(ExperimentConfig(), repo_root=tmp_path)
