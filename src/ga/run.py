import argparse
import os
import time
from pathlib import Path

from .contract import ResultRecord
from .model_client import FakeModelClient, LocalModelClient, ModelClient
from .policy import TARGET_QUERIES, V1_POLICY
from .search import evals_to_first_violation, run_genetic, run_random

DASHBOARD_STORE = Path(__file__).resolve().parents[2] / "dashboard" / "public" / "records.jsonl"


def _client(kind: str) -> ModelClient:
    if kind == "fake":
        return FakeModelClient(V1_POLICY)
    return LocalModelClient(
        base_url=os.environ.get("GA_BASE_URL", "http://localhost:11434/v1"),
        model=os.environ.get("GA_MODEL", "llama3.2:3b"),
        api_key=os.environ.get("GA_API_KEY", "not-needed"),
    )


def _summary(label: str, records: list[ResultRecord]) -> None:
    n = len(records)
    violations = sum(r.outcome == "violation" for r in records)
    best = max((r.fitness for r in records), default=0.0)
    first = evals_to_first_violation(records)
    rate = violations / n if n else 0.0
    first_str = str(first) if first is not None else "never"
    print(f"  {label:8s} evals={n:4d}  best={best:.3f}  violations={violations:3d} ({rate:.0%})  first@{first_str}")


def _export(records: list[ResultRecord]) -> None:
    DASHBOARD_STORE.parent.mkdir(parents=True, exist_ok=True)
    DASHBOARD_STORE.write_text(
        "".join(r.model_dump_json() + "\n" for r in records), encoding="utf-8"
    )
    print(f"  exported {len(records)} records → {DASHBOARD_STORE}")


def main(argv: list[str] | None = None) -> None:
    ap = argparse.ArgumentParser(description="Evolve prompt genomes against a synthetic policy.")
    ap.add_argument("--search", choices=["genetic", "random", "compare"], default="compare")
    ap.add_argument("--generations", type=int, default=30)
    ap.add_argument("--pop", type=int, default=24)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--model", choices=["fake", "local"], default="fake")
    ap.add_argument("--target-query", choices=list(TARGET_QUERIES), default="reveal_token")
    ap.add_argument("--out", default="runs")
    ap.add_argument("--no-export", action="store_true", help="skip writing the dashboard store")
    args = ap.parse_args(argv)

    client = _client(args.model)
    policy = V1_POLICY
    target = TARGET_QUERIES[args.target_query]
    stamp = time.strftime("%Y%m%d-%H%M%S")
    kinds = ["genetic", "random"] if args.search == "compare" else [args.search]

    all_records: list[ResultRecord] = []
    print(f"model={args.model} target={args.target_query} gens={args.generations} pop={args.pop} seed={args.seed}")
    for kind in kinds:
        run_id = f"{kind}-{args.seed}-{stamp}"
        store_path = Path(args.out) / run_id / "records.jsonl"
        runner = run_genetic if kind == "genetic" else run_random
        records = runner(
            client=client,
            policy=policy,
            target=target,
            run_id=run_id,
            generations=args.generations,
            pop_size=args.pop,
            seed=args.seed,
            store_path=store_path,
        )
        _summary(kind, records)
        all_records.extend(records)

    if not args.no_export:
        _export(all_records)


if __name__ == "__main__":
    main()
