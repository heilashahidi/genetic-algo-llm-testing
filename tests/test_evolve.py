from ga.model_client import FakeModelClient
from ga.policy import TARGET_QUERIES, V1_POLICY
from ga.search import run_genetic

COMMON = dict(
    client=FakeModelClient(V1_POLICY),
    policy=V1_POLICY,
    target=TARGET_QUERIES["reveal_token"],
)


def test_run_is_reproducible_under_fixed_seed():
    a = run_genetic(run_id="a", generations=8, pop_size=12, seed=5, **COMMON)
    b = run_genetic(run_id="b", generations=8, pop_size=12, seed=5, **COMMON)
    assert [r.genome_id for r in a] == [r.genome_id for r in b]
    assert [r.fitness for r in a] == [r.fitness for r in b]


def test_offspring_are_schema_valid():
    # Every child is built through Genome(**...), so a run that completes proves
    # selection/crossover/mutation only ever produce valid next-gen genomes.
    recs = run_genetic(run_id="v", generations=8, pop_size=12, seed=5, **COMMON)
    assert all(r.genome_id == r.genome.genome_id for r in recs)


def test_best_fitness_non_decreasing_with_elitism():
    recs = run_genetic(run_id="e", generations=12, pop_size=12, seed=5, elitism=2, **COMMON)
    by_gen: dict[int, list[float]] = {}
    for r in recs:
        by_gen.setdefault(r.generation, []).append(r.fitness)
    best = [max(by_gen[g]) for g in sorted(by_gen)]
    assert all(best[i] <= best[i + 1] for i in range(len(best) - 1))
