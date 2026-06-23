"""App factory and uvicorn entrypoint.

Run with: ``uvicorn api.app:app`` (PYTHONPATH=src). The module-level ``app`` is
created via ``create_app()`` so both ``api.app:app`` and a custom factory call
work.
"""

from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routes import router


def create_app() -> FastAPI:
    app = FastAPI(
        title="GA Control Plane",
        version="0.1.0",
        description="HTTP control plane over ga.run_lifecycle (the database control plane).",
    )
    # Local no-auth dev stack: the browser calls the API cross-origin (frontend
    # on :3000, API on :8000). CORS_ALLOW_ORIGINS is a comma-separated list;
    # "*" (the default) is fine here because there are no cookies/credentials.
    origins = os.environ.get("CORS_ALLOW_ORIGINS", "*").split(",")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[o.strip() for o in origins if o.strip()],
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(router)
    return app


app = create_app()
