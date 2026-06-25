"""HTTP endpoints translating requests into ``ga.run_lifecycle`` calls.

No GA logic and no direct database access live here: every data operation is a
call into ``ga.run_lifecycle`` using the request-scoped connection from
``deps.get_conn``. Config validation is done by round-tripping the submitted
config through ``ExperimentConfig.from_dict(...).to_dict()`` so malformed
configs are rejected with HTTP 422 before any DB write.
"""

from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status

from functools import lru_cache

from ga import run_lifecycle
from ga.codec import build_vector_layout, load_schema, validate_schema
from ga.config import ExperimentConfig

from . import schemas
from .deps import get_conn, require_auth

router = APIRouter()


@lru_cache(maxsize=1)
def _genome_schema() -> dict[str, Any]:
    """The genome schema (genes, types, channels, alleles), cached."""
    return load_schema()


def _validate_config(raw: dict[str, Any]) -> dict[str, Any]:
    """Round-trip the config through ExperimentConfig; 422 on failure.

    ``ExperimentConfig.from_dict`` filters unknown nested keys but still fails
    on structurally invalid input (e.g. a non-mapping ``ga`` block or a field
    with an unconstructible value), which is exactly what we want to reject.
    """
    try:
        return ExperimentConfig.from_dict(raw).to_dict()
    except (TypeError, ValueError, AttributeError) as exc:
        raise HTTPException(
            status_code=422,  # Unprocessable Content / Entity
            detail=f"invalid experiment config: {exc}",
        ) from exc


@router.get("/health", response_model=schemas.HealthResponse)
def health() -> schemas.HealthResponse:
    return schemas.HealthResponse(status="ok")


def _active_schema(conn) -> dict[str, Any]:
    """The schema serving as the current source of truth: the DB draft if one
    exists, else the file schema. Resilient to DB read failures."""
    try:
        draft = run_lifecycle.get_draft_schema(conn)
    except Exception:  # noqa: BLE001 - never let a DB hiccup hide the file schema
        draft = None
    return draft if draft is not None else _genome_schema()


@router.get("/schema")
def genome_schema(conn=Depends(get_conn)) -> dict[str, Any]:
    """Return the editable genome schema: the persisted DB draft if present,
    otherwise the file schema. The UI uses this to enumerate genes, types,
    channels, and the full allele set (including alleles absent from a run)."""
    return _active_schema(conn)


@router.put("/schema", dependencies=[Depends(require_auth)])
def put_schema(
    body: dict[str, Any],
    conn=Depends(get_conn),
) -> dict[str, Any]:
    """Validate and persist an edited schema as the singleton draft.

    Rejects structurally invalid schemas with 422 (see ``validate_schema``) and
    also confirms the codec can build a vector layout from it, so a saved draft
    is always usable for rendering and seeding."""
    try:
        validate_schema(body)
        build_vector_layout(body)  # codec round-trip sanity check
    except (ValueError, KeyError, TypeError) as exc:
        raise HTTPException(status_code=422, detail=f"invalid schema: {exc}") from exc
    run_lifecycle.save_draft_schema(conn, body)
    return body


@router.post(
    "/experiments",
    response_model=schemas.CreateExperimentResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_auth)],
)
def create_experiment(
    body: schemas.CreateExperimentRequest,
    conn=Depends(get_conn),
) -> schemas.CreateExperimentResponse:
    config = _validate_config(body.config)
    # Snapshot the active schema (DB draft else file) into the experiment so the
    # run renders and seeds from a frozen copy and the viewer can read the run's
    # own schema later via GET /runs/{id}/schema.
    config["schema"] = _active_schema(conn)
    experiment_id = run_lifecycle.create_experiment(conn, body.name, config)
    return schemas.CreateExperimentResponse(experiment_id=experiment_id)


@router.post(
    "/experiments/{experiment_id}/runs",
    response_model=schemas.EnqueueRunResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_auth)],
)
def enqueue_run(
    experiment_id: str,
    conn=Depends(get_conn),
) -> schemas.EnqueueRunResponse:
    run_id = run_lifecycle.enqueue_run(conn, experiment_id)
    return schemas.EnqueueRunResponse(run_id=run_id, status="queued")


@router.get("/runs", response_model=list[schemas.RunRecord])
def list_runs(conn=Depends(get_conn)) -> list[dict[str, Any]]:
    return run_lifecycle.list_runs(conn)


@router.get("/leaderboard", response_model=list[schemas.TraitLeaderboardEntry])
def get_leaderboard(
    threshold: float = Query(default=1.0),
    limit: int = Query(default=25, ge=1, le=200),
    conn=Depends(get_conn),
) -> list[dict[str, Any]]:
    """Cross-run leaderboard of the traits that break models: (gene, allele)
    pairs present in successful individuals (fitness >= threshold), ranked by
    exploit count, each with the target models it has broken."""
    return run_lifecycle.trait_leaderboard(conn, threshold=threshold, limit=limit)


@router.get("/runs/{run_id}", response_model=schemas.RunRecord)
def get_run(run_id: str, conn=Depends(get_conn)) -> dict[str, Any]:
    run = run_lifecycle.get_run(conn, run_id)
    if run is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"run {run_id} not found",
        )
    return run


@router.delete(
    "/runs/{run_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_auth)],
)
def delete_run(run_id: str, conn=Depends(get_conn)) -> Response:
    deleted = run_lifecycle.delete_run(conn, run_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"run {run_id} not found",
        )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _set_control_and_return(
    conn, run_id: str, control: str
) -> schemas.RunControlResponse:
    """Set the control flag (404 if run missing) and return updated state."""
    run = run_lifecycle.get_run(conn, run_id)
    if run is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"run {run_id} not found",
        )
    run_lifecycle.set_control(conn, run_id, control)
    return schemas.RunControlResponse(
        run_id=run_id, control=control, status=run["status"]
    )


@router.post(
    "/runs/{run_id}/stop",
    response_model=schemas.RunControlResponse,
    dependencies=[Depends(require_auth)],
)
def stop_run(run_id: str, conn=Depends(get_conn)) -> schemas.RunControlResponse:
    return _set_control_and_return(conn, run_id, "stop")


@router.post(
    "/runs/{run_id}/pause",
    response_model=schemas.RunControlResponse,
    dependencies=[Depends(require_auth)],
)
def pause_run(run_id: str, conn=Depends(get_conn)) -> schemas.RunControlResponse:
    return _set_control_and_return(conn, run_id, "pause")


@router.post(
    "/runs/{run_id}/resume",
    response_model=schemas.RunControlResponse,
    dependencies=[Depends(require_auth)],
)
def resume_run(run_id: str, conn=Depends(get_conn)) -> schemas.RunControlResponse:
    return _set_control_and_return(conn, run_id, "none")


@router.get("/runs/{run_id}/schema")
def get_run_schema(run_id: str, conn=Depends(get_conn)) -> dict[str, Any]:
    """Return the schema snapshot frozen into this run's experiment, falling
    back to the file schema if the run's config carries no snapshot. The viewer
    uses this so lineage/allele views read the run's own schema."""
    snapshot = run_lifecycle.get_run_schema(conn, run_id)
    return snapshot if snapshot is not None else _genome_schema()


@router.get(
    "/runs/{run_id}/generations",
    response_model=list[schemas.GenerationRecord],
)
def list_generations(run_id: str, conn=Depends(get_conn)) -> list[dict[str, Any]]:
    return run_lifecycle.list_generations(conn, run_id)


@router.get(
    "/runs/{run_id}/individuals",
    response_model=list[schemas.IndividualRecord],
)
def list_individuals(
    run_id: str,
    generation: Optional[int] = Query(default=None),
    conn=Depends(get_conn),
) -> list[dict[str, Any]]:
    return run_lifecycle.list_individuals(conn, run_id, generation=generation)
