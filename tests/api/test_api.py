"""API route tests running entirely without a real database.

Strategy:
- ``api.deps.get_conn`` is overridden (see conftest) to yield a ``FakeConn``,
  so no psycopg connection is ever opened.
- ``ga.run_lifecycle`` functions are monkeypatched to record their arguments
  and return canned data, so we assert the API translates HTTP into the right
  lifecycle calls without exercising any SQL.
"""

from __future__ import annotations

import datetime as dt

import pytest

import api.routes as routes


@pytest.fixture
def recorder(monkeypatch):
    """Patch run_lifecycle functions used by routes; record their calls."""
    calls: dict[str, list] = {}

    def record(name, return_value=None, raises=None):
        def fn(*args, **kwargs):
            calls.setdefault(name, []).append((args, kwargs))
            if raises is not None:
                raise raises
            return return_value() if callable(return_value) else return_value

        return fn

    state = {"runs": {}}

    # Defaults; individual tests can re-patch as needed.
    monkeypatch.setattr(
        routes.run_lifecycle, "create_experiment", record("create_experiment", "exp-123")
    )
    monkeypatch.setattr(
        routes.run_lifecycle, "enqueue_run", record("enqueue_run", "run-456")
    )
    monkeypatch.setattr(routes.run_lifecycle, "list_runs", record("list_runs", []))
    monkeypatch.setattr(routes.run_lifecycle, "get_run", record("get_run", None))
    monkeypatch.setattr(routes.run_lifecycle, "set_control", record("set_control", None))
    monkeypatch.setattr(
        routes.run_lifecycle, "list_generations", record("list_generations", [])
    )
    monkeypatch.setattr(
        routes.run_lifecycle, "list_individuals", record("list_individuals", [])
    )

    return {"calls": calls, "record": record, "monkeypatch": monkeypatch, "state": state}


def _run_record(**overrides):
    base = {
        "id": "run-456",
        "experiment_id": "exp-123",
        "status": "running",
        "control": "none",
        "current_generation": 3,
        "heartbeat_at": dt.datetime(2026, 6, 23, 12, 0, 0),
        "error": None,
        "created_at": dt.datetime(2026, 6, 23, 11, 0, 0),
    }
    base.update(overrides)
    return base


# --- health ----------------------------------------------------------------


def test_health(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


# --- create experiment ------------------------------------------------------


def test_create_experiment_happy_path(client, recorder, fake_conn):
    resp = client.post(
        "/experiments",
        json={"name": "exp one", "config": {"random_seed": 7, "ga": {"population_size": 50}}},
    )
    assert resp.status_code == 201
    assert resp.json() == {"experiment_id": "exp-123"}

    assert len(recorder["calls"]["create_experiment"]) == 1
    args, kwargs = recorder["calls"]["create_experiment"][0]
    # signature: create_experiment(conn, name, config)
    assert args[0] is fake_conn
    assert args[1] == "exp one"
    parsed_config = args[2]
    # config was round-tripped through ExperimentConfig -> full normalized dict
    assert parsed_config["random_seed"] == 7
    assert parsed_config["ga"]["population_size"] == 50
    # unrelated defaults are filled in by the round-trip
    assert "harness" in parsed_config and "fitness" in parsed_config


def test_create_experiment_invalid_config_422_no_call(client, recorder):
    # ga must be a mapping; a string breaks ExperimentConfig.from_dict
    resp = client.post(
        "/experiments",
        json={"name": "bad", "config": {"ga": "not-a-dict"}},
    )
    assert resp.status_code == 422
    assert "create_experiment" not in recorder["calls"]


# --- enqueue run ------------------------------------------------------------


def test_enqueue_run(client, recorder, fake_conn):
    resp = client.post("/experiments/exp-123/runs")
    assert resp.status_code == 201
    assert resp.json() == {"run_id": "run-456", "status": "queued"}

    args, kwargs = recorder["calls"]["enqueue_run"][0]
    assert args[0] is fake_conn
    assert args[1] == "exp-123"


# --- list / get runs --------------------------------------------------------


def test_list_runs(client, recorder):
    recorder["monkeypatch"].setattr(
        routes.run_lifecycle,
        "list_runs",
        recorder["record"]("list_runs", lambda: [_run_record()]),
    )
    resp = client.get("/runs")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 1
    assert body[0]["id"] == "run-456"
    assert body[0]["status"] == "running"


def test_get_run_200(client, recorder):
    recorder["monkeypatch"].setattr(
        routes.run_lifecycle,
        "get_run",
        recorder["record"]("get_run", lambda: _run_record()),
    )
    resp = client.get("/runs/run-456")
    assert resp.status_code == 200
    assert resp.json()["id"] == "run-456"
    args, _ = recorder["calls"]["get_run"][0]
    assert args[1] == "run-456"


def test_get_run_404(client, recorder):
    # default get_run returns None -> 404
    resp = client.get("/runs/missing")
    assert resp.status_code == 404


# --- control: stop / pause / resume ----------------------------------------


@pytest.mark.parametrize(
    "endpoint,expected_control",
    [("stop", "stop"), ("pause", "pause"), ("resume", "none")],
)
def test_control_endpoints(client, recorder, fake_conn, endpoint, expected_control):
    recorder["monkeypatch"].setattr(
        routes.run_lifecycle,
        "get_run",
        recorder["record"]("get_run", lambda: _run_record(status="running")),
    )
    resp = client.post(f"/runs/run-456/{endpoint}")
    assert resp.status_code == 200
    body = resp.json()
    assert body == {"run_id": "run-456", "control": expected_control, "status": "running"}

    args, kwargs = recorder["calls"]["set_control"][0]
    assert args[0] is fake_conn
    assert args[1] == "run-456"
    assert args[2] == expected_control


@pytest.mark.parametrize("endpoint", ["stop", "pause", "resume"])
def test_control_404_when_run_missing(client, recorder, endpoint):
    # default get_run returns None
    resp = client.post(f"/runs/missing/{endpoint}")
    assert resp.status_code == 404
    assert "set_control" not in recorder["calls"]


# --- generations ------------------------------------------------------------


def test_list_generations(client, recorder):
    canned = [
        {"generation": 0, "best_fitness": 0.5, "avg_fitness": 0.2, "success_rate": 0.0},
        {"generation": 1, "best_fitness": 0.9, "avg_fitness": 0.4, "success_rate": 0.1},
    ]
    recorder["monkeypatch"].setattr(
        routes.run_lifecycle,
        "list_generations",
        recorder["record"]("list_generations", lambda: canned),
    )
    resp = client.get("/runs/run-456/generations")
    assert resp.status_code == 200
    body = resp.json()
    assert [g["generation"] for g in body] == [0, 1]
    assert body[1]["best_fitness"] == 0.9
    args, _ = recorder["calls"]["list_generations"][0]
    assert args[1] == "run-456"


# --- individuals ------------------------------------------------------------


def _individual(**overrides):
    base = {
        "individual_id": "ind-1",
        "generation": 2,
        "genome": {"genes": []},
        "fitness": 0.7,
        "origin": "crossover",
        "parent_a_id": "a",
        "parent_b_id": "b",
        "phenotype_char_length": 42,
        "model_response_hash": "abc",
    }
    base.update(overrides)
    return base


def test_list_individuals_no_filter(client, recorder):
    recorder["monkeypatch"].setattr(
        routes.run_lifecycle,
        "list_individuals",
        recorder["record"]("list_individuals", lambda: [_individual()]),
    )
    resp = client.get("/runs/run-456/individuals")
    assert resp.status_code == 200
    assert resp.json()[0]["individual_id"] == "ind-1"
    args, kwargs = recorder["calls"]["list_individuals"][0]
    assert args[1] == "run-456"
    assert kwargs.get("generation") is None


def test_list_individuals_with_generation_filter(client, recorder):
    recorder["monkeypatch"].setattr(
        routes.run_lifecycle,
        "list_individuals",
        recorder["record"]("list_individuals", lambda: [_individual(generation=5)]),
    )
    resp = client.get("/runs/run-456/individuals", params={"generation": 5})
    assert resp.status_code == 200
    args, kwargs = recorder["calls"]["list_individuals"][0]
    assert args[1] == "run-456"
    assert kwargs.get("generation") == 5


# --- architectural guardrails ----------------------------------------------


def test_api_modules_do_not_import_psycopg():
    """The API must never touch the DB driver directly; it goes through
    run_lifecycle. Assert none of the api modules import psycopg."""
    import inspect

    import api.app
    import api.deps
    import api.routes
    import api.schemas

    for module in (api.app, api.deps, api.routes, api.schemas):
        source = inspect.getsource(module)
        # No direct import of, or attribute access on, the psycopg driver.
        assert "import psycopg" not in source, f"{module.__name__} imports psycopg"
        assert "psycopg." not in source, f"{module.__name__} uses psycopg directly"


def test_api_has_no_ga_logic_only_lifecycle_calls():
    """routes.py should only reference run_lifecycle for data access, never
    GA-core modules like ga.evolution / ga.individual / ga.fitness."""
    import inspect

    import api.routes

    source = inspect.getsource(api.routes)
    for forbidden in ("ga.evolution", "ga.individual", "ga.fitness", "ga.population"):
        assert forbidden not in source, f"routes.py references {forbidden}"
