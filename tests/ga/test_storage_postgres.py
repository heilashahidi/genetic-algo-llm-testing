"""Integration tests for PostgresStorage.

These run ONLY when DATABASE_URL is set, against a real Postgres; otherwise
they skip cleanly. They apply the migrations, then round-trip an experiment
through the adapter and read the rows back.
"""

import os

import pytest

from ga.config import ExperimentConfig
from ga.individual import Individual

DATABASE_URL = os.environ.get("DATABASE_URL")

pytestmark = pytest.mark.skipif(
    not DATABASE_URL, reason="DATABASE_URL not set; skipping Postgres integration tests"
)


def make_individual(individual_id, generation, fitness):
    return Individual(
        id=individual_id,
        generation=generation,
        vector_indices=[0, 1, 2],
        genome={"gene_a": "value_a"},
        origin="seed",
        parent_a_id="pa",
        parent_b_id=None,
        mutated_genes=["gene_a"],
        fitness=fitness,
        phenotype="hello world",
        model_response="model says hi",
    )


@pytest.fixture
def storage():
    import psycopg

    from ga.storage_postgres import PostgresStorage, apply_migrations

    with psycopg.connect(DATABASE_URL) as conn:
        apply_migrations(conn)

    adapter = PostgresStorage(DATABASE_URL)
    try:
        yield adapter
    finally:
        adapter.close()


def test_round_trip_experiment_two_generations(storage):
    import psycopg

    config = ExperimentConfig(experiment_id="pg_integration")
    handle = storage.create_experiment(config)

    gen0 = [make_individual(f"g0-{i}", 0, fitness=0.5) for i in range(3)]
    gen1 = [make_individual(f"g1-{i}", 1, fitness=1.0) for i in range(4)]
    storage.store_generation(handle, 0, gen0)
    storage.store_generation(handle, 1, gen1)

    with psycopg.connect(DATABASE_URL) as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT generation, best_fitness, avg_fitness, success_rate "
            "FROM generations WHERE run_id = %s ORDER BY generation",
            (handle.run_id,),
        )
        gens = cur.fetchall()
        assert [g[0] for g in gens] == [0, 1]
        # gen1 all succeed -> success_rate 1.0, best 1.0
        assert gens[1][1] == pytest.approx(1.0)
        assert gens[1][3] == pytest.approx(1.0)

        cur.execute(
            "SELECT generation, count(*) FROM individuals WHERE run_id = %s "
            "GROUP BY generation ORDER BY generation",
            (handle.run_id,),
        )
        counts = dict(cur.fetchall())
        assert counts == {0: 3, 1: 4}

        cur.execute(
            "SELECT current_generation FROM runs WHERE id = %s", (handle.run_id,)
        )
        assert cur.fetchone()[0] == 1
