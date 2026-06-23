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


def make_individual(individual_id, generation, fitness, crossover_mask=None):
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
        crossover_mask=crossover_mask,
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


def test_step_data_round_trips(storage):
    import psycopg

    config = ExperimentConfig(experiment_id="pg_step_data")
    handle = storage.create_experiment(config)

    mask = {"gene_a": "a", "gene_b": "b"}
    population = [
        make_individual("s0", 0, fitness=0.5, crossover_mask=mask),
        make_individual("s1", 0, fitness=0.7, crossover_mask=None),
    ]
    storage.store_generation(handle, 0, population)

    with psycopg.connect(DATABASE_URL) as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT individual_id, model_response, phenotype, mutated_genes, "
            "vector_indices, crossover_mask, created_at "
            "FROM individuals WHERE run_id = %s ORDER BY individual_id",
            (handle.run_id,),
        )
        rows = {row[0]: row for row in cur.fetchall()}

    s0 = rows["s0"]
    assert s0[1] == "model says hi"  # full model_response text, no redaction
    assert s0[2] == "hello world"  # full phenotype text
    assert s0[3] == ["gene_a"]  # mutated_genes jsonb
    assert s0[4] == [0, 1, 2]  # vector_indices jsonb
    assert s0[5] == mask  # crossover_mask jsonb donor map
    assert s0[6] is not None  # created_at populated by default

    # single-parent copy stores a NULL crossover_mask
    assert rows["s1"][5] is None
