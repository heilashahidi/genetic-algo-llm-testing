#!/usr/bin/env python3
"""Offline, deterministic verification gate (PRD §9).

Runs only checks that need no network, no real model, and no live server:
Python units (incl. the seeded GA-vs-random test, C8) and the dashboard's
typecheck + lint + unit tests + build. Real-model runs (C5, C11) and the live
dashboard are on-demand, never here. Run on demand: `.venv/bin/python verify.py`.
"""

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DASH = ROOT / "dashboard"

STEPS: list[tuple[str, list[str], Path]] = [
    ("pytest", [sys.executable, "-m", "pytest", "-q"], ROOT),
    ("dashboard typecheck", ["npm", "run", "typecheck"], DASH),
    ("dashboard lint", ["npm", "run", "lint"], DASH),
    ("dashboard test", ["npm", "run", "test"], DASH),
    ("dashboard build", ["npm", "run", "build"], DASH),
]


def main() -> int:
    failed: list[str] = []
    for name, cmd, cwd in STEPS:
        print(f"\n\033[1m▶ {name}\033[0m")
        if subprocess.run(cmd, cwd=cwd).returncode != 0:
            failed.append(name)
    print()
    if failed:
        print(f"\033[31m✗ verify failed: {', '.join(failed)}\033[0m")
        return 1
    print("\033[32m✓ verify passed\033[0m")
    return 0


if __name__ == "__main__":
    sys.exit(main())
