import importlib.util
import json
from pathlib import Path

import pytest

from ga.config import ExperimentConfig, HarnessConfig, load_config


REPO_ROOT = Path(__file__).resolve().parents[2]


def load_run_ga():
    """Load scripts/run_ga.py as a module via importlib (it inserts src on path)."""
    script_path = REPO_ROOT / "scripts" / "run_ga.py"
    spec = importlib.util.spec_from_file_location("run_ga", script_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_to_dict_round_trips_through_from_dict():
    config = ExperimentConfig()
    payload = config.to_dict()
    assert isinstance(payload, dict)
    restored = ExperimentConfig.from_dict(payload)
    assert restored == config


def test_from_dict_ignores_unknown_keys():
    payload = {
        "experiment_id": "exp-1",
        "ga": {"population_size": 50, "bogus_ga_key": 999},
        "harness": {"model": "phi3", "bogus_harness_key": "nope"},
        "fitness": {"success_threshold": 0.5, "bogus_fitness_key": [1, 2, 3]},
    }
    config = ExperimentConfig.from_dict(payload)
    assert config.experiment_id == "exp-1"
    assert config.ga.population_size == 50
    assert config.harness.model == "phi3"
    assert config.fitness.success_threshold == 0.5
    assert not hasattr(config.ga, "bogus_ga_key")
    assert not hasattr(config.harness, "bogus_harness_key")
    assert not hasattr(config.fitness, "bogus_fitness_key")


def test_for_provider_ollama():
    harness = HarnessConfig.for_provider("ollama", "llama3.2", "be safe")
    assert harness.provider == "ollama"
    assert harness.base_url == "http://localhost:11434/v1"
    assert harness.model == "llama3.2"
    assert harness.system_prompt == "be safe"


def test_for_provider_lmstudio():
    harness = HarnessConfig.for_provider("lmstudio", "qwen", "be safe")
    assert harness.provider == "lmstudio"
    assert harness.base_url == "http://localhost:1234/v1"
    assert harness.model == "qwen"
    assert harness.system_prompt == "be safe"


def test_for_provider_mock_and_default_system_prompt():
    harness = HarnessConfig.for_provider("mock", "stub")
    assert harness.provider == "mock"
    assert harness.base_url == "http://localhost:0/v1"
    assert harness.model == "stub"
    # system_prompt defaults to the class default when not provided.
    assert harness.system_prompt == HarnessConfig.system_prompt


def test_load_config_reads_json(tmp_path):
    payload = {
        "experiment_id": "json-exp",
        "random_seed": 7,
        "ga": {"population_size": 42},
        "harness": {"provider": "mock", "model": "stub"},
    }
    config_path = tmp_path / "config.json"
    config_path.write_text(json.dumps(payload), encoding="utf-8")
    config = load_config(config_path)
    assert isinstance(config, ExperimentConfig)
    assert config.experiment_id == "json-exp"
    assert config.random_seed == 7
    assert config.ga.population_size == 42
    assert config.harness.provider == "mock"
    assert config.harness.model == "stub"


def test_load_config_reads_yaml_parity_with_json(tmp_path):
    yaml = pytest.importorskip("yaml")
    payload = {
        "experiment_id": "yaml-exp",
        "random_seed": 7,
        "ga": {"population_size": 42},
        "harness": {"provider": "mock", "model": "stub"},
    }

    json_path = tmp_path / "config.json"
    json_path.write_text(json.dumps(payload), encoding="utf-8")

    yaml_path = tmp_path / "config.yaml"
    yaml_path.write_text(yaml.safe_dump(payload), encoding="utf-8")

    json_config = load_config(json_path)
    yaml_config = load_config(yaml_path)

    assert isinstance(yaml_config, ExperimentConfig)
    assert yaml_config == json_config


def test_apply_overrides_dry_run():
    run_ga = load_run_ga()
    parser = run_ga.build_parser()
    args = parser.parse_args(["--dry-run"])
    config = run_ga.apply_overrides(ExperimentConfig(), args)
    assert config.dry_run is True
    assert config.harness.provider == "mock"


def test_apply_overrides_population_recomputes_seed_counts():
    run_ga = load_run_ga()
    parser = run_ga.build_parser()
    args = parser.parse_args(["--population", "40"])
    config = run_ga.apply_overrides(ExperimentConfig(), args)
    assert config.ga.population_size == 40
    # Seed counts recomputed and consistent with the population.
    total = (
        config.ga.seed_stratified_count
        + config.ga.seed_recombinant_count
        + config.ga.seed_random_count
    )
    assert total == 40
    assert config.ga.seed_stratified_count == 20
    assert config.ga.seed_recombinant_count == 15
    assert config.ga.seed_random_count == 5


def test_apply_overrides_generations():
    run_ga = load_run_ga()
    parser = run_ga.build_parser()
    args = parser.parse_args(["--generations", "12"])
    config = run_ga.apply_overrides(ExperimentConfig(), args)
    assert config.ga.max_generations == 12
