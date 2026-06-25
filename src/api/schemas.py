"""Pydantic request/response models for the control-plane API.

These mirror the dict shapes returned by ``ga.run_lifecycle``. Response models
use ``model_config = {"extra": "allow"}`` only where the upstream shape is
authoritative; most are explicit so the contract is visible in one place.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field


# --- requests --------------------------------------------------------------


class CreateExperimentRequest(BaseModel):
    name: str = Field(..., min_length=1)
    config: dict[str, Any] = Field(default_factory=dict)


# --- responses -------------------------------------------------------------


class CreateExperimentResponse(BaseModel):
    experiment_id: str


class EnqueueRunResponse(BaseModel):
    run_id: str
    status: str = "queued"


class HealthResponse(BaseModel):
    status: str = "ok"


class RunControlResponse(BaseModel):
    """Returned by stop/pause/resume: the updated run control + status."""

    run_id: str
    control: str
    status: str


class RunRecord(BaseModel):
    id: str
    experiment_id: str
    status: str
    control: str
    current_generation: Optional[int] = None
    heartbeat_at: Optional[datetime] = None
    error: Optional[str] = None
    created_at: Optional[datetime] = None


class GenerationRecord(BaseModel):
    generation: int
    best_fitness: Optional[float] = None
    avg_fitness: Optional[float] = None
    success_rate: Optional[float] = None


class TraitModelExploit(BaseModel):
    """How many times a trait broke a specific target model."""

    model: str
    exploits: int


class TraitLeaderboardEntry(BaseModel):
    """One (gene, allele) trait ranked by how many successful individuals carry
    it, with the models it has exploited."""

    gene: str
    allele: str
    exploits: int
    avg_fitness: float
    models: list[TraitModelExploit]


class IndividualRecord(BaseModel):
    individual_id: Any
    generation: int
    genome: Any
    fitness: Optional[float] = None
    origin: Optional[str] = None
    parent_a_id: Any = None
    parent_b_id: Any = None
    phenotype_char_length: Optional[int] = None
    model_response_hash: Optional[str] = None
    model_response: Optional[str] = None
    phenotype: Optional[str] = None
    mutated_genes: Any = None
    vector_indices: Any = None
    crossover_mask: Any = None
    created_at: Optional[datetime] = None
