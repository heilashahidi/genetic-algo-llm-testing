"""Shared fixtures for API tests.

The whole suite runs with NO real database. We override ``api.deps.get_conn``
with a fake connection that records the run_lifecycle calls made against it and
returns canned data, so the route layer is exercised without psycopg.
"""

from __future__ import annotations

from typing import Any

import pytest
from fastapi.testclient import TestClient

from api import deps
from api.app import create_app


class FakeConn:
    """A stand-in connection passed straight to run_lifecycle calls.

    run_lifecycle functions accept ``conn`` as their first argument and call
    ``conn.cursor()``. In tests we monkeypatch the run_lifecycle functions
    themselves (recording the conn + args), so the fake conn just needs to be a
    distinct sentinel object. ``close`` records that the dependency cleaned up.
    """

    def __init__(self) -> None:
        self.closed = False

    def close(self) -> None:
        self.closed = True


@pytest.fixture
def fake_conn() -> FakeConn:
    return FakeConn()


@pytest.fixture
def client(fake_conn: FakeConn):
    app = create_app()

    def _override_get_conn():
        yield fake_conn

    app.dependency_overrides[deps.get_conn] = _override_get_conn
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def calls(monkeypatch) -> list[dict[str, Any]]:
    """Record run_lifecycle calls and stub their return values.

    Returns a list each test can inspect; tests set canned return values via
    ``set_return`` entries patched in per-test where needed. By default each
    patched function records and returns a sensible default.
    """
    recorded: list[dict[str, Any]] = []
    return recorded
