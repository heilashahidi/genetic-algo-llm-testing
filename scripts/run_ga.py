#!/usr/bin/env python3
"""CLI entry point for GA experiments."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "src"))

from ga.config import ExperimentConfig, HarnessConfig, load_config
from ga.evolution import run_experiment


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run adversarial prompt GA experiments")
    parser.add_argument("--config", type=Path, help="Path to JSON or YAML experiment config")
    parser.add_argument("--provider", choices=["ollama", "lmstudio", "mock"])
    parser.add_argument("--model", help="Target model name")
    parser.add_argument("--generations", type=int, help="Maximum generations")
    parser.add_argument("--population", type=int, help="Population size")
    parser.add_argument("--mode", choices=["ga", "random", "seed-only"], dest="run_mode")
    parser.add_argument("--target-query", help="Synthetic target query")
    parser.add_argument("--seed", type=int, dest="random_seed")
    parser.add_argument("--dry-run", action="store_true", help="Use mock harness and synthetic fitness")
    parser.add_argument("--experiment-id", help="Optional experiment directory name")
    return parser


def apply_overrides(config: ExperimentConfig, args: argparse.Namespace) -> ExperimentConfig:
    if args.provider:
        config.harness = HarnessConfig.for_provider(
            args.provider,
            args.model or config.harness.model,
            config.harness.system_prompt,
        )
    if args.model:
        config.harness.model = args.model
    if args.generations is not None:
        config.ga.max_generations = args.generations
    if args.population is not None:
        config.ga.population_size = args.population
        config.ga.seed_stratified_count = max(0, args.population - 20)
        config.ga.seed_recombinant_count = min(15, max(0, args.population - config.ga.seed_stratified_count - 5))
        config.ga.seed_random_count = args.population - config.ga.seed_stratified_count - config.ga.seed_recombinant_count
    if args.run_mode:
        config.run_mode = args.run_mode
    if args.target_query:
        config.target_query = args.target_query
    if args.random_seed is not None:
        config.random_seed = args.random_seed
    if args.dry_run:
        config.dry_run = True
        config.harness.provider = "mock"
    if args.experiment_id:
        config.experiment_id = args.experiment_id
    return config


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    if args.config:
        config = load_config(args.config)
    else:
        config = ExperimentConfig()
    config = apply_overrides(config, args)
    experiment_dir = run_experiment(config, repo_root=REPO_ROOT)
    print(f"Experiment complete: {experiment_dir}")


if __name__ == "__main__":
    main()
