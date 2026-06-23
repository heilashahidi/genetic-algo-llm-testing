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


def _seed_generation_with_individuals(conn, run_id):
    """Insert one generation row and two individual rows for a run (test data)."""
    import uuid

    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO generations "
            "(id, run_id, generation, best_fitness, avg_fitness, success_rate) "
            "VALUES (%s, %s, 0, 0.5, 0.2, 0.0)",
            (str(uuid.uuid4()), run_id),
        )
        for label in ("ind-a", "ind-b"):
            cur.execute(
                "INSERT INTO individuals "
                "(id, run_id, individual_id, generation, genome, origin) "
                "VALUES (%s, %s, %s, 0, %s, 'seed')",
                (str(uuid.uuid4()), run_id, label, "{}"),
            )


def test_delete_run_removes_data_and_orphan_experiment(conn, created_experiments):
    from ga import run_lifecycle as rl

    config = ExperimentConfig(experiment_id="delete_it").to_dict()
    experiment_id = rl.create_experiment(conn, "delete_it", config)
    created_experiments.append(experiment_id)
    run_id = rl.enqueue_run(conn, experiment_id)
    _seed_generation_with_individuals(conn, run_id)

    # Sanity: data exists before deletion.
    assert rl.get_run(conn, run_id) is not None
    assert len(rl.list_generations(conn, run_id)) == 1
    assert len(rl.list_individuals(conn, run_id)) == 2

    assert rl.delete_run(conn, run_id) is True

    # Run, generations, and individuals are all gone (cascade).
    assert rl.get_run(conn, run_id) is None
    assert rl.list_generations(conn, run_id) == []
    assert rl.list_individuals(conn, run_id) == []

    # The experiment had no other runs, so it was cleaned up too.
    with conn.cursor() as cur:
        cur.execute("SELECT 1 FROM experiments WHERE id = %s", (experiment_id,))
        assert cur.fetchone() is None


def test_delete_run_keeps_experiment_with_other_runs(conn, created_experiments):
    from ga import run_lifecycle as rl

    config = ExperimentConfig(experiment_id="delete_multi_it").to_dict()
    experiment_id = rl.create_experiment(conn, "delete_multi_it", config)
    created_experiments.append(experiment_id)
    run_one = rl.enqueue_run(conn, experiment_id)
    run_two = rl.enqueue_run(conn, experiment_id)

    assert rl.delete_run(conn, run_one) is True

    # The deleted run is gone, but the sibling run and experiment remain.
    assert rl.get_run(conn, run_one) is None
    assert rl.get_run(conn, run_two) is not None
    with conn.cursor() as cur:
        cur.execute("SELECT 1 FROM experiments WHERE id = %s", (experiment_id,))
        assert cur.fetchone() is not None


def test_delete_run_returns_false_for_unknown_id(conn):
    import uuid

    from ga import run_lifecycle as rl

    assert rl.delete_run(conn, str(uuid.uuid4())) is False


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
    # This test verifies generation progression, not leak detection. Disable
    # forbidden-output scoring so the mock harness's leak response is not scored
    # as a success that would early-stop the run at generation 0.
    config.fitness.forbidden_outputs = []
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
    # This test verifies cooperative stop, not leak detection. Disable
    # forbidden-output scoring so a mock leak doesn't early-stop on success
    # before the control=stop flag is honored at the generation boundary.
    config.fitness.forbidden_outputs = []
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
