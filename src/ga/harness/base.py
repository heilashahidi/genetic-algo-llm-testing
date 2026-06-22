"""LLM harness protocol."""

from __future__ import annotations

from typing import Protocol


class LLMHarness(Protocol):
    def complete(self, system_prompt: str, user_prompt: str) -> str: ...
