import json
import threading

from ga.codec import load_schema, sync_individual_genome
from ga.config import ExperimentConfig
from ga.evolution import evaluate_population, evolve_generation, run_experiment, should_stop
from ga.fitness.synthetic import build_fitness_evaluator
from ga.individual import Individual
from ga.population import init_population


class CountingHarness:
    """Mock harness that records how many times complete() is called.

    ``evaluate_population`` may invoke ``complete`` from several threads at once
    (``max_parallel_requests`` > 1), so the call counter is guarded by a lock to
    keep the count exact rather than racy.
    """

    def __init__(self) -> None:
        self.calls = 0
        self._lock = threading.Lock()

    def complete(self, system_prompt: str, user_prompt: str) -> str:
        with self._lock:
            self.calls += 1
        return "I can help with safe synthetic benchmark tasks."


def _small_config(**overrides):
    config = ExperimentConfig(random_seed=7, dry_run=True)
    config.ga.population_size = 12
    config.ga.elite_count = 2
    config.ga.seed_stratified_count = 8
    config.ga.seed_recombinant_count = 3
    config.ga.seed_random_count = 1
    config.ga.max_generations = 2
    for key, value in overrides.items():
        setattr(config, key, value)
    return config


def test_evaluate_population_skips_prescored_individuals():
    config = _small_config()
    schema = load_schema()
    population = init_population(config, schema=schema)

    # Pre-score exactly one individual: both fitness AND phenotype set.
    population[0].fitness = 0.5
    population[0].phenotype = "already evaluated"
    population[0].model_response = "prior response"

    harness = CountingHarness()
    evaluator = build_fitness_evaluator(config.fitness)
    evaluate_population(population, config, schema, harness, evaluator)

    # Only the un-scored individuals should trigger a model call.
    assert harness.calls == len(population) - 1
    # The pre-scored one is left untouched.
    assert population[0].fitness == 0.5
    assert population[0].phenotype == "already evaluated"
    assert population[0].model_response == "prior response"


def test_evaluate_population_partial_prescore_not_skipped():
    """An individual missing phenotype (even if fitness set) IS re-evaluated."""
    config = _small_config()
    schema = load_schema()
    population = init_population(config, schema=schema)

    population[0].fitness = 0.5  # fitness set but phenotype is None -> not skipped
    harness = CountingHarness()
    evaluator = build_fitness_evaluator(config.fitness)
    evaluate_population(population, config, schema, harness, evaluator)

    assert harness.calls == len(population)


def test_evaluate_population_sets_phenotype_response_and_fitness():
    config = _small_config()
    schema = load_schema()
    population = init_population(config, schema=schema)

    harness = CountingHarness()
    evaluator = build_fitness_evaluator(config.fitness)
    evaluate_population(population, config, schema, harness, evaluator)

    for individual in population:
        assert individual.phenotype is not None
        assert isinstance(individual.phenotype, str)
        assert individual.model_response is not None
        assert individual.fitness is not None
        assert isinstance(individual.fitness, float)


def test_evaluate_population_parallel_matches_serial():
    """Evaluating with many workers yields the same per-individual results as
    a single worker, and overlaps the calls concurrently."""
    schema = load_schema()

    class ConcurrencyProbeHarness:
        """Records the peak number of overlapping ``complete`` calls."""

        def __init__(self) -> None:
            self._lock = threading.Lock()
            self.active = 0
            self.peak = 0
            self._barrier = threading.Barrier(6, timeout=5)

        def complete(self, system_prompt: str, user_prompt: str) -> str:
            with self._lock:
                self.active += 1
                self.peak = max(self.peak, self.active)
            # Hold here until enough callers arrive so overlap is observable.
            try:
                self._barrier.wait()
            except threading.BrokenBarrierError:
                pass
            with self._lock:
                self.active -= 1
            return "refusal: I cannot help with that."

    serial_config = _small_config()
    serial_config.harness.max_parallel_requests = 1
    serial_pop = init_population(serial_config, schema=schema)
    evaluate_population(
        serial_pop, serial_config, schema, CountingHarness(), build_fitness_evaluator()
    )

    parallel_config = _small_config()
    parallel_config.harness.max_parallel_requests = 6
    parallel_pop = init_population(parallel_config, schema=schema)
    probe = ConcurrencyProbeHarness()
    evaluate_population(
        parallel_pop, parallel_config, schema, probe, build_fitness_evaluator()
    )

    # Same deterministic seeding -> identical phenotypes/fitness, order-for-order.
    assert [ind.phenotype for ind in parallel_pop] == [ind.phenotype for ind in serial_pop]
    # And the calls genuinely overlapped (the barrier requires 6 in flight).
    assert probe.peak >= 6


def test_evolve_generation_size_and_elite_preservation():
    config = _small_config()
    schema = load_schema()
    population = init_population(config, schema=schema)

    # Assign distinct fitness so elite ranking is deterministic.
    for index, individual in enumerate(population):
        individual.fitness = index / 100.0
        individual.phenotype = f"p{index}"
        individual.model_response = f"r{index}"

    next_gen = evolve_generation(population, config, schema, generation=1)

    assert len(next_gen) == config.ga.population_size

    elites = [ind for ind in next_gen if ind.origin == "elite"]
    assert len(elites) == config.ga.elite_count

    # The top elite_count parents by fitness should be carried over.
    ranked = sorted(population, key=lambda i: i.fitness or 0.0, reverse=True)
    expected_elite_fitness = sorted(
        (parent.fitness for parent in ranked[: config.ga.elite_count]), reverse=True
    )
    actual_elite_fitness = sorted((e.fitness for e in elites), reverse=True)
    assert actual_elite_fitness == expected_elite_fitness
    # Elites preserve their parent's fitness/phenotype (clone of best).
    for elite in elites:
        assert elite.fitness is not None
        assert elite.parent_a_id is not None


def test_should_stop_at_last_generation():
    config = _small_config()
    config.ga.max_generations = 3
    schema = load_schema()
    population = init_population(config, schema=schema)
    for ind in population:
        ind.fitness = 0.1
    # generation + 1 >= max_generations -> stop at generation 2 (0-indexed) when max=3
    assert should_stop(population, generation=2, config=config) is True
    assert should_stop(population, generation=1, config=config) is False


def test_should_stop_on_empty_population():
    config = _small_config()
    config.ga.max_generations = 30
    assert should_stop([], generation=0, config=config) is True


def test_should_stop_on_fitness_reached():
    config = _small_config()
    config.ga.max_generations = 30
    schema = load_schema()
    population = init_population(config, schema=schema)
    for ind in population:
        ind.fitness = 0.2
    population[3].fitness = 1.0
    assert should_stop(population, generation=0, config=config) is True


def test_should_stop_false_otherwise():
    config = _small_config()
    config.ga.max_generations = 30
    schema = load_schema()
    population = init_population(config, schema=schema)
    for ind in population:
        ind.fitness = 0.3
    assert should_stop(population, generation=0, config=config) is False


def _read_lineage_signature(experiment_dir):
    """Per-record (genome, operator, vector_indices) sequence from lineage.jsonl."""
    lineage_path = experiment_dir / "lineage.jsonl"
    signature = []
    for line in lineage_path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        record = json.loads(line)
        signature.append(
            (
                json.dumps(record["genome"], sort_keys=True),
                record["operator"],
                tuple(record["vector_indices"]),
            )
        )
    return signature


def test_run_experiment_is_reproducible_with_same_seed(tmp_path):
    config_a = _small_config(experiment_id="repro_a")
    config_b = _small_config(experiment_id="repro_b")

    dir_a = run_experiment(config_a, repo_root=tmp_path)
    dir_b = run_experiment(config_b, repo_root=tmp_path)

    sig_a = _read_lineage_signature(dir_a)
    sig_b = _read_lineage_signature(dir_b)

    assert sig_a == sig_b
    assert len(sig_a) > 0


def test_should_stop_respects_stop_on_success():
    """With stop_on_success False, a perfect-fitness population does not halt."""
    from ga.config import ExperimentConfig
    from ga.evolution import should_stop
    from ga.individual import Individual

    config = ExperimentConfig()
    config.ga.max_generations = 10
    pop = [
        Individual(id="a", generation=0, vector_indices=[], genome={}, origin="seed", fitness=1.0)
    ]

    config.ga.stop_on_success = True
    assert should_stop(pop, 0, config) is True  # default: halt on success

    config.ga.stop_on_success = False
    assert should_stop(pop, 0, config) is False  # keep evolving
    # max_generations still terminates regardless of the flag
    assert should_stop(pop, 9, config) is True


def test_should_stop_respects_min_generations():
    """A success before min_generations does not stop the run early."""
    from ga.config import ExperimentConfig
    from ga.evolution import should_stop
    from ga.individual import Individual

    config = ExperimentConfig()
    config.ga.max_generations = 10
    config.ga.stop_on_success = True
    config.ga.min_generations = 3
    pop = [
        Individual(id="a", generation=0, vector_indices=[], genome={}, origin="seed", fitness=1.0)
    ]

    # Success at generation 0/1 (fewer than 3 completed) keeps going.
    assert should_stop(pop, 0, config) is False
    assert should_stop(pop, 1, config) is False
    # Once 3 generations are complete (index 2), success halts the run.
    assert should_stop(pop, 2, config) is True
