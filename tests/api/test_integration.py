"""End-to-end integration test against a real Postgres + applied schema.

Skipped unless DATABASE_URL is set. Exercises the full stack (HTTP -> routes ->
run_lifecycle -> psycopg -> DB) with no dependency overrides, so it requires the
migrations in ``migrations/001_init.sql`` to be applied to the target database.
"""

from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient

from api.app import create_app

pytestmark = pytest.mark.skipif(
    not os.environ.get("DATABASE_URL"),
    reason="DATABASE_URL not set; skipping real-DB integration test",
)


@pytest.fixture
def client():
    # No dependency overrides: uses the real get_conn / DATABASE_URL.
    with TestClient(create_app()) as test_client:
        yield test_client


def test_full_lifecycle(client):
    assert client.get("/health").json() == {"status": "ok"}

    created = client.post(
        "/experiments",
        json={"name": "integration", "config": {"random_seed": 1}},
    )
    assert created.status_code == 201
    experiment_id = created.json()["experiment_id"]

    enq = client.post(f"/experiments/{experiment_id}/runs")
    assert enq.status_code == 201
    run_id = enq.json()["run_id"]
    assert enq.json()["status"] == "queued"

    got = client.get(f"/runs/{run_id}")
    assert got.status_code == 200
    assert got.json()["id"] == run_id

    paused = client.post(f"/runs/{run_id}/pause")
    assert paused.status_code == 200
    assert paused.json()["control"] == "pause"

    resumed = client.post(f"/runs/{run_id}/resume")
    assert resumed.json()["control"] == "none"

    stopped = client.post(f"/runs/{run_id}/stop")
    assert stopped.json()["control"] == "stop"

    # read-only feeds should at least return lists for a fresh run
    assert isinstance(client.get(f"/runs/{run_id}/generations").json(), list)
    assert isinstance(client.get(f"/runs/{run_id}/individuals").json(), list)
