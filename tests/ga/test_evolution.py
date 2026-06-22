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

    experiment_dir = run_experiment(config, repo_root=tmp_path)
    assert experiment_dir.exists()
    assert (experiment_dir / "config.json").exists()
    assert (experiment_dir / "generations" / "gen_000.jsonl").exists()
    assert (experiment_dir / "generations" / "gen_001.jsonl").exists()
    assert (experiment_dir / "summary.csv").exists()
    assert (experiment_dir / "lineage.jsonl").exists()

    generation_paths = list((experiment_dir / "generations").glob("gen_*.jsonl"))
    assert len(generation_paths) == 2
