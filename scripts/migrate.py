#!/usr/bin/env python3
"""Apply SQL migrations under migrations/ to the database in DATABASE_URL."""

from __future__ import annotations

import os
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "src"))

from ga.storage_postgres import apply_migrations


def main() -> None:
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise SystemExit("DATABASE_URL must be set")

    import psycopg

    with psycopg.connect(database_url) as conn:
        applied = apply_migrations(conn)
    print(f"Applied migrations: {', '.join(applied) if applied else '(none)'}")


if __name__ == "__main__":
    main()
