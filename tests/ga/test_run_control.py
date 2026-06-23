"""No-DB tests for cooperative run control and the claim_run SQL shape.

These exercise the controller port wired into `run_experiment` with a fake
control source (no database, no psycopg), confirm `NullController` keeps the
standalone behavior identical, and assert the `claim_run` SQL is exclusive and
transitions the run to 'running' using a fake cursor that records SQL.
"""

from __future__ import annotations

from ga.config import ExperimentConfig
from ga.evolution import NullController, run_experiment


# --- harness ---------------------------------------------------------------


def _small_config(max_generations: int = 5) -> ExperimentConfig:
    config = ExperimentConfig(
        random_seed=7,
        dry_run=True,
        experiment_id="test_run_control",
        output_dir="experiments",
        target_query="Describe the synthetic benchmark setup.",
    )
    config.ga.population_size = 12
    config.ga.elite_count = 2
    config.ga.seed_stratified_count = 8
    config.ga.seed_recombinant_count = 3
    config.ga.seed_random_count = 1
    config.ga.max_generations = max_generations
    return config


class StopAtController:
    """Fake control source: requests a cooperative stop at a given generation.

    Mirrors the DatabaseController contract without any database: it tracks
    whether a stop was honored so a worker would finalize as 'stopped'.
    """

    def __init__(self, stop_at_generation: int) -> None:
        self.stop_at = stop_at_generation
        self.stop_requested = False
        self.seen_generations: list[int] = []
        self.stored_generations: list[int] = []

    @property
    def terminal_status(self) -> str:
        return "stopped" if self.stop_requested else "completed"

    def before_generation(self, generation: int) -> None:
        self.seen_generations.append(generation)

    def should_stop(self, generation, population) -> bool:
        if generation >= self.stop_at:
            self.stop_requested = True
        return self.stop_requested

    def on_generation_stored(self, generation, population) -> None:
        self.stored_generations.append(generation)


# --- cooperative stop ------------------------------------------------------


def test_controller_stops_cleanly_at_boundary(tmp_path):
    config = _small_config(max_generations=10)
    controller = StopAtController(stop_at_generation=2)

    experiment_dir = run_experiment(config, repo_root=tmp_path, controller=controller)

    # Stop is checked AFTER generation 2 is evaluated+stored, before evolving.
    assert controller.stored_generations == [0, 1, 2]
    assert controller.terminal_status == "stopped"

    # Files written through generation 2 only, none beyond.
    generation_paths = sorted((experiment_dir / "generations").glob("gen_*.jsonl"))
    assert [p.name for p in generation_paths] == [
        "gen_000.jsonl",
        "gen_001.jsonl",
        "gen_002.jsonl",
    ]


def test_controller_stop_is_cooperative_not_partial(tmp_path):
    # A stop request at generation 0 still completes & stores generation 0.
    config = _small_config(max_generations=10)
    controller = StopAtController(stop_at_generation=0)

    experiment_dir = run_experiment(config, repo_root=tmp_path, controller=controller)

    assert controller.stored_generations == [0]
    assert (experiment_dir / "generations" / "gen_000.jsonl").exists()
    assert not (experiment_dir / "generations" / "gen_001.jsonl").exists()


# --- NullController equivalence --------------------------------------------


def test_null_controller_matches_standalone_behavior(tmp_path):
    config = _small_config(max_generations=3)
    experiment_dir = run_experiment(config, repo_root=tmp_path, controller=NullController())

    # Runs to max_generations exactly as the standalone/file path does.
    generation_paths = sorted((experiment_dir / "generations").glob("gen_*.jsonl"))
    assert [p.name for p in generation_paths] == [
        "gen_000.jsonl",
        "gen_001.jsonl",
        "gen_002.jsonl",
    ]


def test_default_controller_is_null(tmp_path):
    # Omitting the controller entirely must behave identically to NullController.
    config = _small_config(max_generations=2)
    experiment_dir = run_experiment(config, repo_root=tmp_path)
    generation_paths = sorted((experiment_dir / "generations").glob("gen_*.jsonl"))
    assert [p.name for p in generation_paths] == ["gen_000.jsonl", "gen_001.jsonl"]


# --- claim_run SQL shape (fake cursor, no DB) ------------------------------


class _FakeCursor:
    def __init__(self, rows):
        self.executed: list[tuple[str, object]] = []
        self._rows = list(rows)

    def execute(self, sql, params=None):
        self.executed.append((sql, params))

    def fetchone(self):
        return self._rows.pop(0) if self._rows else None

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


class _FakeConn:
    def __init__(self, rows):
        self.cursor_obj = _FakeCursor(rows)

    def cursor(self):
        return self.cursor_obj


def test_claim_run_sql_is_exclusive_and_marks_running():
    from ga.run_lifecycle import claim_run

    claimed_row = (
        "11111111-1111-1111-1111-111111111111",  # id
        "22222222-2222-2222-2222-222222222222",  # experiment_id
        "running",  # status
        "none",  # control
        0,  # current_generation
        None,  # heartbeat_at
        None,  # error
        None,  # created_at
    )
    conn = _FakeConn([claimed_row])
    result = claim_run(conn)

    sql, _params = conn.cursor_obj.executed[0]
    assert "FOR UPDATE SKIP LOCKED" in sql
    assert "status = 'running'" in sql
    assert "status = 'queued'" in sql  # selects only queued rows
    assert "RETURNING" in sql

    assert result is not None
    assert result["status"] == "running"
    assert result["id"] == claimed_row[0]


def test_claim_run_returns_none_when_no_queued_run():
    from ga.run_lifecycle import claim_run

    conn = _FakeConn(rows=[])
    assert claim_run(conn) is None
