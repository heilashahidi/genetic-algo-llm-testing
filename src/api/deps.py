"""Request-scoped dependencies: the DB connection and the auth seam.

The DB connection dependency reads ``DATABASE_URL`` and yields a connection via
``ga.run_lifecycle.connect``, closing it when the request finishes. Tests
override ``get_conn`` with a fake (see ``app.dependency_overrides``) so no real
database is needed.

``require_auth`` is a no-op stub for v1 (localhost compose, no auth). It exists
as a clean seam: swap its body for token verification later without touching the
route handlers, which already depend on it.
"""

from __future__ import annotations

import os
from typing import Iterator

from fastapi import Depends, HTTPException, status

from ga import run_lifecycle


def get_database_url() -> str:
    """Return the configured ``DATABASE_URL`` or raise 500 if unset."""
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="DATABASE_URL is not configured",
        )
    return url


def get_conn(database_url: str = Depends(get_database_url)) -> Iterator[object]:
    """Yield a psycopg connection via run_lifecycle.connect; close it after.

    Overridden in tests with a fake connection so no real DB is required.
    """
    conn = run_lifecycle.connect(database_url)
    try:
        yield conn
    finally:
        conn.close()


def require_auth() -> None:
    """Auth seam. No-op for v1 (localhost compose).

    Replace the body with token verification (e.g. read a bearer header and
    compare against a configured secret) to add auth without changing routes.
    """
    return None
