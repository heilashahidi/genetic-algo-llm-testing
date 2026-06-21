import random
from pathlib import Path

from .contract import ResultRecord
from .evolve import crossover, mutate, random_genome, tournament
from .harness import evaluate
from .model_client import ModelClient
from .policy import Policy, TargetQuery
from .store import append_record


def _persist(store_path: str | Path | None, record: ResultRecord) -> None:
    if store_path is not None:
        append_record(store_path, record)


def run_genetic(
    *,
    client: ModelClient,
    policy: Policy,
    target: TargetQuery,
    run_id: str,
    generations: int,
    pop_size: int,
    seed: int,
    store_path: str | Path | None = None,
    elitism: int = 2,
    mutation_rate: float = 0.2,
    tournament_k: int = 3,
) -> list[ResultRecord]:
    rng = random.Random(seed)
    population = [random_genome(rng) for _ in range(pop_size)]
    parents: dict[str, list[str]] = {}
    records: list[ResultRecord] = []

    for gen in range(generations):
        scored: list[tuple] = []
        for g in population:
            rec = evaluate(
                g,
                client=client,
                policy=policy,
                target=target,
                run_id=run_id,
                search="genetic",
                generation=gen,
                parent_ids=parents.get(g.genome_id, []),
                seed=seed,
            )
            _persist(store_path, rec)
            records.append(rec)
            scored.append((g, rec.fitness))

        scored.sort(key=lambda gf: gf[1], reverse=True)
        next_pop = [g for g, _ in scored[:elitism]]
        while len(next_pop) < pop_size:
            pa = tournament(scored, rng, tournament_k)
            pb = tournament(scored, rng, tournament_k)
            child = mutate(crossover(pa, pb, rng), rng, mutation_rate)
            parents[child.genome_id] = list(dict.fromkeys([pa.genome_id, pb.genome_id]))
            next_pop.append(child)
        population = next_pop

    return records


def run_random(
    *,
    client: ModelClient,
    policy: Policy,
    target: TargetQuery,
    run_id: str,
    generations: int,
    pop_size: int,
    seed: int,
    store_path: str | Path | None = None,
) -> list[ResultRecord]:
    # Same evaluation budget as the GA (generations × pop_size), bucketed into the
    # same generation axis so the dashboard can overlay the two curves fairly.
    rng = random.Random(seed)
    records: list[ResultRecord] = []
    for i in range(generations * pop_size):
        g = random_genome(rng)
        rec = evaluate(
            g,
            client=client,
            policy=policy,
            target=target,
            run_id=run_id,
            search="random",
            generation=i // pop_size,
            parent_ids=[],
            seed=seed,
        )
        _persist(store_path, rec)
        records.append(rec)
    return records


def evals_to_first_violation(records: list[ResultRecord]) -> int | None:
    for i, rec in enumerate(records, start=1):
        if rec.outcome == "violation":
            return i
    return None
