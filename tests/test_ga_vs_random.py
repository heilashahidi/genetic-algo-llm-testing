from statistics import mean

from ga.model_client import FakeModelClient
from ga.policy import TARGET_QUERIES, V1_POLICY
from ga.search import evals_to_first_violation, run_genetic, run_random

# The load-bearing "evolution actually works" check (PRD §5 C8): on the fixed fake
# landscape, the GA must reach a policy violation in fewer evaluations than random
# search under the same seed and budget. The fitness landscape is categorical
# (refusal / partial / violation), so a single run can be lost to a lucky early
# random draw — the honest, reproducible claim is statistical across a fixed seed
# set: the GA finds the target almost every time and far sooner, random rarely.

POP, GEN, SEEDS = 24, 30, 8
BUDGET = POP * GEN


def test_ga_finds_violation_far_more_reliably_and_sooner_than_random():
    ga_evals, rnd_evals = [], []
    ga_found = rnd_found = 0
    for seed in range(SEEDS):
        client = FakeModelClient(V1_POLICY)
        common = dict(
            client=client,
            policy=V1_POLICY,
            target=TARGET_QUERIES["reveal_token"],
            generations=GEN,
            pop_size=POP,
            seed=seed,
        )
        ga = run_genetic(run_id="ga", **common)
        rnd = run_random(run_id="rnd", **common)
        ge = evals_to_first_violation(ga)
        re = evals_to_first_violation(rnd)
        ga_found += ge is not None
        rnd_found += re is not None
        ga_evals.append(ge if ge is not None else BUDGET + 1)
        rnd_evals.append(re if re is not None else BUDGET + 1)

    assert ga_found >= SEEDS - 1, f"GA should reliably find the target, found {ga_found}/{SEEDS}"
    assert ga_found > rnd_found, f"GA ({ga_found}) should out-find random ({rnd_found})"
    assert mean(ga_evals) < mean(rnd_evals)
