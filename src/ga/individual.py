"""Individual model with lineage metadata."""

from __future__ import annotations

import hashlib
from dataclasses import asdict, dataclass, field
from typing import Any


@dataclass
class Individual:
    id: str
    generation: int
    vector_indices: list[int]
    genome: dict[str, Any]
    origin: str
    parent_a_id: str | None = None
    parent_b_id: str | None = None
    mutated_genes: list[str] = field(default_factory=list)
    fitness: float | None = None
    phenotype: str | None = None
    model_response: str | None = None
    crossover_mask: dict[str, str] | None = None

    def model_response_hash(self) -> str | None:
        if self.model_response is None:
            return None
        return hashlib.sha256(self.model_response.encode("utf-8")).hexdigest()

    def to_record(self) -> dict[str, Any]:
        record = asdict(self)
        record["phenotype_char_length"] = len(self.phenotype) if self.phenotype else 0
        record["model_response_hash"] = self.model_response_hash()
        return record

    @classmethod
    def from_record(cls, record: dict[str, Any]) -> Individual:
        return cls(
            id=record["id"],
            generation=record["generation"],
            vector_indices=list(record["vector_indices"]),
            genome=dict(record["genome"]),
            origin=record["origin"],
            parent_a_id=record.get("parent_a_id"),
            parent_b_id=record.get("parent_b_id"),
            mutated_genes=list(record.get("mutated_genes", [])),
            fitness=record.get("fitness"),
            phenotype=record.get("phenotype"),
            model_response=record.get("model_response"),
            crossover_mask=record.get("crossover_mask"),
        )
