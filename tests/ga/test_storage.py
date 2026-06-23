import csv
import json

import pytest

from ga.config import ExperimentConfig
from ga.individual import Individual
from ga.storage import (
    append_lineage,
    create_experiment_dir,
    store_generation,
    update_summary,
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
    mutated_genes=None,
    vector_indices=None,
):
    return Individual(
        id=individual_id,
        generation=generation,
        vector_indices=vector_indices if vector_indices is not None else [0, 1, 2],
        genome={"gene_a": "value_a", "gene_b": "value_b"},
        origin=origin,
        parent_a_id=parent_a_id,
        parent_b_id=parent_b_id,
        mutated_genes=mutated_genes if mutated_genes is not None else ["gene_a"],
        fitness=fitness,
        phenotype=phenotype,
        model_response=model_response,
    )


def read_jsonl(path):
    return [
        json.loads(line)
        for line in path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]


# --- create_experiment_dir -------------------------------------------------


def test_create_experiment_dir_with_explicit_id(tmp_path):
    config = ExperimentConfig(experiment_id="exp_explicit", output_dir="experiments")
    experiment_dir = create_experiment_dir(config, repo_root=tmp_path)

    assert experiment_dir == tmp_path / "experiments" / "exp_explicit"
    assert experiment_dir.is_dir()
    assert (experiment_dir / "generations").is_dir()

    config_path = experiment_dir / "config.json"
    assert config_path.exists()
    payload = json.loads(config_path.read_text(encoding="utf-8"))
    assert payload["experiment_id"] == "exp_explicit"


def test_create_experiment_dir_respects_custom_output_dir(tmp_path):
    config = ExperimentConfig(experiment_id="exp_custom", output_dir="runs")
    experiment_dir = create_experiment_dir(config, repo_root=tmp_path)

    assert experiment_dir == tmp_path / "runs" / "exp_custom"
    assert (experiment_dir / "generations").is_dir()


def test_create_experiment_dir_generates_timestamped_id(tmp_path):
    config = ExperimentConfig(experiment_id=None, output_dir="experiments")
    experiment_dir = create_experiment_dir(config, repo_root=tmp_path)

    assert experiment_dir.name.startswith("exp_")
    # exp_YYYYMMDD_HHMMSS -> three underscore-separated parts
    parts = experiment_dir.name.split("_")
    assert len(parts) == 3
    assert len(parts[1]) == 8  # YYYYMMDD
    assert len(parts[2]) == 6  # HHMMSS

    payload = json.loads((experiment_dir / "config.json").read_text(encoding="utf-8"))
    assert payload["experiment_id"] == experiment_dir.name


# --- store_generation ------------------------------------------------------


def test_store_generation_writes_one_line_per_individual(tmp_path):
    config = ExperimentConfig(experiment_id="exp_store", output_dir="experiments")
    experiment_dir = create_experiment_dir(config, repo_root=tmp_path)

    population = [make_individual(f"ind-{i}", generation=0) for i in range(4)]
    store_generation(experiment_dir, 0, population)

    gen_path = experiment_dir / "generations" / "gen_000.jsonl"
    assert gen_path.exists()

    records = read_jsonl(gen_path)
    assert len(records) == len(population)

    expected_keys = {
        "id",
        "genome",
        "fitness",
        "phenotype_char_length",
        "model_response_hash",
    }
    for record, individual in zip(records, population):
        assert expected_keys <= set(record.keys())
        assert record["id"] == individual.id
        assert record["genome"] == individual.genome
        assert record["fitness"] == individual.fitness
        assert record["phenotype_char_length"] == len(individual.phenotype)
        assert record["model_response_hash"] == individual.model_response_hash()


def test_store_generation_filename_is_zero_padded(tmp_path):
    config = ExperimentConfig(experiment_id="exp_pad", output_dir="experiments")
    experiment_dir = create_experiment_dir(config, repo_root=tmp_path)

    store_generation(experiment_dir, 7, [make_individual("ind-a", generation=7)])
    assert (experiment_dir / "generations" / "gen_007.jsonl").exists()


def test_store_generation_overwrites_same_generation_file(tmp_path):
    config = ExperimentConfig(experiment_id="exp_overwrite", output_dir="experiments")
    experiment_dir = create_experiment_dir(config, repo_root=tmp_path)

    store_generation(experiment_dir, 0, [make_individual(f"a-{i}") for i in range(5)])
    store_generation(experiment_dir, 0, [make_individual("b-0")])

    records = read_jsonl(experiment_dir / "generations" / "gen_000.jsonl")
    assert len(records) == 1
    assert records[0]["id"] == "b-0"


# --- append_lineage --------------------------------------------------------


def test_append_lineage_appends_across_generations(tmp_path):
    config = ExperimentConfig(experiment_id="exp_lineage", output_dir="experiments")
    experiment_dir = create_experiment_dir(config, repo_root=tmp_path)

    gen0 = [make_individual(f"g0-{i}", generation=0) for i in range(3)]
    gen1 = [make_individual(f"g1-{i}", generation=1) for i in range(4)]

    store_generation(experiment_dir, 0, gen0)
    store_generation(experiment_dir, 1, gen1)

    lineage_path = experiment_dir / "lineage.jsonl"
    records = read_jsonl(lineage_path)
    assert len(records) == len(gen0) + len(gen1)

    ids = [record["individual_id"] for record in records]
    assert ids == [ind.id for ind in gen0] + [ind.id for ind in gen1]


def test_append_lineage_record_contents(tmp_path):
    config = ExperimentConfig(experiment_id="exp_lineage2", output_dir="experiments")
    experiment_dir = create_experiment_dir(config, repo_root=tmp_path)

    individual = make_individual(
        "ind-lineage",
        generation=2,
        origin="crossover",
        parent_a_id="pa",
        parent_b_id="pb",
        mutated_genes=["gene_b"],
        vector_indices=[3, 4, 5],
    )
    append_lineage(experiment_dir, [individual])

    record = read_jsonl(experiment_dir / "lineage.jsonl")[0]
    for key in (
        "parent_a_id",
        "operator",
        "vector_indices",
        "model_response_hash",
    ):
        assert key in record

    assert record["parent_a_id"] == "pa"
    assert record["parent_b_id"] == "pb"
    assert record["operator"] == "crossover"
    assert record["vector_indices"] == [3, 4, 5]
    assert record["mutated_genes"] == ["gene_b"]
    assert record["model_response_hash"] == individual.model_response_hash()
    assert record["phenotype_char_length"] == len(individual.phenotype)


def test_append_lineage_direct_calls_accumulate(tmp_path):
    config = ExperimentConfig(experiment_id="exp_lineage3", output_dir="experiments")
    experiment_dir = create_experiment_dir(config, repo_root=tmp_path)

    append_lineage(experiment_dir, [make_individual("a")])
    append_lineage(experiment_dir, [make_individual("b"), make_individual("c")])

    records = read_jsonl(experiment_dir / "lineage.jsonl")
    assert [r["individual_id"] for r in records] == ["a", "b", "c"]


# --- update_summary --------------------------------------------------------


def read_summary(path):
    with path.open(encoding="utf-8", newline="") as handle:
        return list(csv.reader(handle))


def test_update_summary_header_and_math(tmp_path):
    config = ExperimentConfig(experiment_id="exp_summary", output_dir="experiments")
    experiment_dir = create_experiment_dir(config, repo_root=tmp_path)

    fitness_values = [0.0, 0.5, 1.0, 1.0]
    population = [
        make_individual(f"ind-{i}", fitness=f) for i, f in enumerate(fitness_values)
    ]
    update_summary(experiment_dir, 0, population)

    rows = read_summary(experiment_dir / "summary.csv")
    assert rows[0] == ["generation", "best_fitness", "avg_fitness", "success_rate"]
    assert len(rows) == 2  # header + one data row

    data = rows[1]
    assert int(data[0]) == 0
    assert float(data[1]) == pytest.approx(max(fitness_values))
    assert float(data[2]) == pytest.approx(sum(fitness_values) / len(fitness_values))
    # success_rate = fraction with fitness >= 1.0 -> 2 of 4
    assert float(data[3]) == pytest.approx(2 / 4)


def test_update_summary_appends_without_repeating_header(tmp_path):
    config = ExperimentConfig(experiment_id="exp_summary2", output_dir="experiments")
    experiment_dir = create_experiment_dir(config, repo_root=tmp_path)

    update_summary(experiment_dir, 0, [make_individual("a", fitness=0.2)])
    update_summary(experiment_dir, 1, [make_individual("b", fitness=0.8)])

    rows = read_summary(experiment_dir / "summary.csv")
    assert rows[0] == ["generation", "best_fitness", "avg_fitness", "success_rate"]
    assert len(rows) == 3  # header + two data rows
    assert int(rows[1][0]) == 0
    assert int(rows[2][0]) == 1
    # header only appears once
    header_count = sum(1 for row in rows if row and row[0] == "generation")
    assert header_count == 1


def test_update_summary_treats_none_fitness_as_zero(tmp_path):
    config = ExperimentConfig(experiment_id="exp_summary3", output_dir="experiments")
    experiment_dir = create_experiment_dir(config, repo_root=tmp_path)

    population = [
        make_individual("a", fitness=None),
        make_individual("b", fitness=1.0),
    ]
    update_summary(experiment_dir, 0, population)

    rows = read_summary(experiment_dir / "summary.csv")
    data = rows[1]
    assert float(data[1]) == pytest.approx(1.0)  # best
    assert float(data[2]) == pytest.approx(0.5)  # avg of (0.0, 1.0)
    assert float(data[3]) == pytest.approx(0.5)  # 1 of 2 >= 1.0


def test_store_generation_updates_summary_and_lineage_together(tmp_path):
    config = ExperimentConfig(experiment_id="exp_combined", output_dir="experiments")
    experiment_dir = create_experiment_dir(config, repo_root=tmp_path)

    population = [make_individual(f"ind-{i}", fitness=1.0) for i in range(3)]
    store_generation(experiment_dir, 0, population)

    assert (experiment_dir / "generations" / "gen_000.jsonl").exists()
    assert (experiment_dir / "lineage.jsonl").exists()
    assert (experiment_dir / "summary.csv").exists()

    summary_rows = read_summary(experiment_dir / "summary.csv")
    assert float(summary_rows[1][3]) == pytest.approx(1.0)  # all succeed
