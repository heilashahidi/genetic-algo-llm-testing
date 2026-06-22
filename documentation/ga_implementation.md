# GA Implementation

Modular genetic algorithm engine at `src/ga/`. It reuses the attack-library schema v2 codec and renderer, implements offspring production from [ga_offspring_production.md](ga_offspring_production.md), and exposes pluggable fitness and LLM harness interfaces.

## Module map

| Module | Purpose |
|--------|---------|
| `codec.py` | `vector_indices` ↔ `genome` decode/encode, gene-block slicing |
| `individual.py` | Individual dataclass with lineage fields |
| `config.py` | `ExperimentConfig`, `GAConfig`, `HarnessConfig`, `FitnessConfig` |
| `population.py` | Generation 0 init (80/15/5) and baseline population builders |
| `operators.py` | Tournament selection, gene-block crossover, mutation, repair |
| `phenotype.py` | Render genome + inject target query |
| `evolution.py` | Evaluate → store → evolve loop |
| `storage.py` | Persist config, generations, summary, lineage |
| `fitness/` | `FitnessEvaluator` protocol + synthetic placeholder scorer |
| `harness/` | `LLMHarness` protocol + OpenAI-compat adapter + mock harness |

## Quick start

```bash
pip install -r requirements.txt
pytest tests/ga/
python scripts/run_ga.py --dry-run --generations 3 --population 20
```

Live local model (Ollama):

```bash
python scripts/run_ga.py \
  --config experiments/configs/default.json \
  --provider ollama \
  --model llama3.2 \
  --generations 1 \
  --population 10
```

LM Studio uses the same adapter with `--provider lmstudio` (default base URL `http://localhost:1234/v1`).

## Docker

Build and run without a local Python install:

```bash
docker compose build
docker compose run --rm ga-dry-run
docker compose run --rm test
```

Run against Ollama or LM Studio on the host (requires the model server listening on the host):

```bash
docker compose run --rm ga-ollama
docker compose run --rm ga-lmstudio
```

Custom CLI args:

```bash
docker compose run --rm ga --dry-run --generations 5 --population 30 --experiment-id my_run
```

Experiment output is written to `./experiments/` on the host via a volume mount. Docker configs use `host.docker.internal` for the LLM base URL (`experiments/configs/docker-ollama.json`, `docker-lmstudio.json`).

## Config

Load JSON or YAML via `--config`. Defaults live in `experiments/configs/default.json`.

Key fields:

- `run_mode`: `ga` (default), `random`, or `seed-only`
- `target_query`: synthetic policy probe appended or injected into rendered phenotype
- `ga.population_size`, `elite_count`, `crossover_rate`, `mutation_rate`, `max_generations`
- `harness.provider`, `harness.base_url`, `harness.model`, `harness.system_prompt`
- `fitness.forbidden_outputs`, `fitness.required_compliance_signals`

CLI flags override config values (`--dry-run`, `--provider`, `--model`, `--generations`, `--population`, `--mode`, `--seed`).

## Experiment output

Runs write to `experiments/{experiment_id}/`:

```text
config.json
generations/gen_000.jsonl
summary.csv
lineage.jsonl
```

Each JSONL row includes genotype, phenotype, fitness, lineage metadata, and `model_response_hash`.

## Plug-in boundaries

| Owner | Replace |
|-------|---------|
| James | `src/ga/fitness/production.py` implementing `FitnessEvaluator` |
| Heila | Custom harness implementing `LLMHarness`, or extend `harness/openai_compat.py` |
| Austin | Consume `lineage.jsonl` + `generations/*.jsonl` for visualization |

Swap implementations in `scripts/run_ga.py` or a future factory without changing operators or evolution logic.

## Related docs

- [ga_offspring_production.md](ga_offspring_production.md) — operator defaults and lineage schema
- [prompt_attack_genome.md](prompt_attack_genome.md) — genome reference and codec decode path
- [attack_library/data/vector_layout.json](attack_library/data/vector_layout.json) — flat chromosome layout
