"""Fitness evaluator protocol."""

from __future__ import annotations

from typing import Protocol


class FitnessEvaluator(Protocol):
    def score(self, phenotype: str, response: str, target_query: str) -> float: ...
