"""Integration tests for the run lifecycle data access.

These run ONLY when DATABASE_URL is set, against a real Postgres; otherwise
they skip cleanly. They apply the migrations, then exercise the full lifecycle:
create_experiment -> enqueue_run -> claim_run (exclusive) -> control flag
round-trip -> heartbeat -> finalize_run, plus a worker round-trip.
"""

import os

import pytest

from ga.config import ExperimentConfig

DATABASE_URL = os.environ.get("DATABASE_URL")

pytestmark = pytest.mark.skipif(
    not DATABASE_URL, reason="DATABASE_URL not set; skipping Postgres integration tests"
)


@pytest.fixture
def conn():
    from ga.run_lifecycle import connect
    from ga.storage_postgres import apply_migrations

    connection = connect(DATABASE_URL)
    apply_migrations(connection)
    try:
        yield connection
    finally:
        connection.close()


@pytest.fixture
def created_experiments(conn):
    """Track experiment ids created during a test and delete them afterwards.

    Tests append the ids they create; teardown removes them (ON DELETE CASCADE
    cleans up runs/generations/individuals) so the shared DB stays free of junk.
    """
    ids: list[str] = []
    yield ids
    if ids:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM experiments WHERE id = ANY(%s)", (ids,))
        conn.commit()


def test_lifecycle_round_trip(conn, created_experiments):
    from ga import run_lifecycle as rl

    config = ExperimentConfig(experiment_id="lifecycle_it").to_dict()
    experiment_id = rl.create_experiment(conn, "lifecycle_it", config)
    created_experiments.append(experiment_id)
    run_id = rl.enqueue_run(conn, experiment_id)

    queued = rl.get_run(conn, run_id)
    assert queued["status"] == "queued"

    claimed = rl.claim_run(conn)
    # claim_run may pick up other queued runs from prior tests; loop to ours.
    while claimed is not None and claimed["id"] != run_id:
        claimed = rl.claim_run(conn)
    assert claimed is not None
    assert claimed["id"] == run_id
    assert claimed["status"] == "running"

    # The run we just claimed is no longer queued, so a follow-up claim of the
    # same row is impossible; confirm the run is marked running in storage.
    assert rl.get_run(conn, run_id)["status"] == "running"

    # Control flag round-trip.
    assert rl.read_control(conn, run_id) == "none"
    rl.set_control(conn, run_id, "stop")
    assert rl.read_control(conn, run_id) == "stop"
    rl.set_control(conn, run_id, "none")
    assert rl.read_control(conn, run_id) == "none"

    # Heartbeat updates current_generation and liveness.
    rl.heartbeat(conn, run_id, 5)
    run = rl.get_run(conn, run_id)
    assert run["current_generation"] == 5
    assert run["heartbeat_at"] is not None

    # Finalize.
    rl.finalize_run(conn, run_id, "completed")
    assert rl.get_run(conn, run_id)["status"] == "completed"


def test_claim_run_is_exclusive_across_two_connections(conn, created_experiments):
    from ga import run_lifecycle as rl

    config = ExperimentConfig(experiment_id="exclusive_it").to_dict()
    experiment_id = rl.create_experiment(conn, "exclusive_it", config)
    created_experiments.append(experiment_id)
    run_id = rl.enqueue_run(conn, experiment_id)

    other = rl.connect(DATABASE_URL)
    try:
        first = rl.claim_run(conn)
        while first is not None and first["id"] != run_id:
            first = rl.claim_run(conn)
        assert first is not None and first["id"] == run_id

        # A second connection must not re-claim the same (now running) run.
        second = rl.claim_run(other)
        while second is not None and second["id"] != run_id:
            second = rl.claim_run(other)
        assert second is None
    finally:
        rl.finalize_run(conn, run_id, "stopped")
        other.close()


def test_worker_round_trip(conn, created_experiments):
    from ga import run_lifecycle as rl

    config = ExperimentConfig(
        experiment_id="worker_it",
        dry_run=True,
        target_query="Describe the synthetic benchmark setup.",
    )
    config.ga.population_size = 12
    config.ga.elite_count = 2
    config.ga.seed_stratified_count = 8
    config.ga.seed_recombinant_count = 3
    config.ga.seed_random_count = 1
    config.ga.max_generations = 2

    experiment_id = rl.create_experiment(conn, "worker_it", config.to_dict())
    created_experiments.append(experiment_id)
    run_id = rl.enqueue_run(conn, experiment_id)

    claimed = rl.claim_run(conn)
    while claimed is not None and claimed["id"] != run_id:
        claimed = rl.claim_run(conn)
    assert claimed is not None

    from ga.evolution import run_experiment
    from ga.storage_postgres import PostgresHandle, PostgresStorage

    handle = PostgresHandle(experiment_id=experiment_id, run_id=run_id)
    storage = PostgresStorage(DATABASE_URL, handle=handle)
    controller = rl.DatabaseController(conn, run_id)
    try:
        run_experiment(config, controller=controller, storage=storage)
        rl.finalize_run(conn, run_id, controller.terminal_status)
    finally:
        storage.close()

    run = rl.get_run(conn, run_id)
    assert run["status"] == "completed"
    assert run["current_generation"] == 1  # gen 0 and 1 stored (max_generations=2)

    gens = rl.list_generations(conn, run_id)
    assert [g["generation"] for g in gens] == [0, 1]

    individuals = rl.list_individuals(conn, run_id, generation=0)
    assert len(individuals) == 12
    assert all(ind["generation"] == 0 for ind in individuals)


def test_worker_stop_finalizes_stopped(conn, created_experiments):
    from ga import run_lifecycle as rl

    config = ExperimentConfig(
        experiment_id="worker_stop_it",
        dry_run=True,
        target_query="Describe the synthetic benchmark setup.",
    )
    config.ga.population_size = 12
    config.ga.elite_count = 2
    config.ga.seed_stratified_count = 8
    config.ga.seed_recombinant_count = 3
    config.ga.seed_random_count = 1
    config.ga.max_generations = 50

    experiment_id = rl.create_experiment(conn, "worker_stop_it", config.to_dict())
    created_experiments.append(experiment_id)
    run_id = rl.enqueue_run(conn, experiment_id)
    rl.set_control(conn, run_id, "stop")  # request stop before the run starts

    claimed = rl.claim_run(conn)
    while claimed is not None and claimed["id"] != run_id:
        claimed = rl.claim_run(conn)
    assert claimed is not None

    from ga.evolution import run_experiment
    from ga.storage_postgres import PostgresHandle, PostgresStorage

    handle = PostgresHandle(experiment_id=experiment_id, run_id=run_id)
    storage = PostgresStorage(DATABASE_URL, handle=handle)
    controller = rl.DatabaseController(conn, run_id)
    try:
        run_experiment(config, controller=controller, storage=storage)
        rl.finalize_run(conn, run_id, controller.terminal_status)
    finally:
        storage.close()

    run = rl.get_run(conn, run_id)
    assert run["status"] == "stopped"
    # Only generation 0 should have been stored before the stop was honored.
    gens = rl.list_generations(conn, run_id)
    assert [g["generation"] for g in gens] == [0]
