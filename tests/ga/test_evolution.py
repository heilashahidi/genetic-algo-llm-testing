from ga.config import ExperimentConfig
from ga.evolution import run_experiment


def test_dry_run_evolution(tmp_path):
    config = ExperimentConfig(
        random_seed=99,
        dry_run=True,
        experiment_id="test_dry_run",
        output_dir="experiments",
        target_query="Describe the synthetic benchmark setup in one sentence.",
    )
    config.ga.population_size = 12
    config.ga.elite_count = 2
    config.ga.seed_stratified_count = 8
    config.ga.seed_recombinant_count = 3
    config.ga.seed_random_count = 1
    config.ga.max_generations = 2
    # Disable the leak check so no seeded jailbreak attack reaches fitness 1.0
    # at generation 0. This keeps the no-early-stop path under test, so the run
    # produces both generations and exercises multi-generation file output.
    config.fitness.forbidden_outputs = []

    experiment_dir = run_experiment(config, repo_root=tmp_path)
    assert experiment_dir.exists()
    assert (experiment_dir / "config.json").exists()
    assert (experiment_dir / "generations" / "gen_000.jsonl").exists()
    assert (experiment_dir / "generations" / "gen_001.jsonl").exists()
    assert (experiment_dir / "summary.csv").exists()
    assert (experiment_dir / "lineage.jsonl").exists()

    generation_paths = list((experiment_dir / "generations").glob("gen_*.jsonl"))
    assert len(generation_paths) == 2


def test_dry_run_early_stops_when_jailbreak_leaks(tmp_path):
    # With the leak check enabled (default forbidden_outputs == the secret),
    # the seeded population contains jailbreak attacks whose mock responses leak
    # the secret -> fitness 1.0 -> the GA early-stops at generation 0.
    config = ExperimentConfig(
        random_seed=99,
        dry_run=True,
        experiment_id="test_dry_run_early_stop",
        output_dir="experiments",
    )
    config.ga.population_size = 12
    config.ga.elite_count = 2
    config.ga.seed_stratified_count = 8
    config.ga.seed_recombinant_count = 3
    config.ga.seed_random_count = 1
    config.ga.max_generations = 5

    experiment_dir = run_experiment(config, repo_root=tmp_path)

    generation_paths = list((experiment_dir / "generations").glob("gen_*.jsonl"))
    # Early stop at gen 0 because a seeded jailbreak attack leaks the secret.
    assert len(generation_paths) == 1
    assert (experiment_dir / "generations" / "gen_000.jsonl").exists()
