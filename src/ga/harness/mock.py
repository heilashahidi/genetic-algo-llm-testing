"""Mock LLM harness for tests and dry-run mode."""

from __future__ import annotations

import re

from ga.config import DEFAULT_SECRET
from ga.fitness.base import FitnessEvaluator

# Case-insensitive markers that flag a prompt as a jailbreak attempt. Matched on
# word boundaries so short markers like "dan" don't fire on benign words
# ("abundant", "redundant"); when any appears the mock "model" leaks the secret.
JAILBREAK_MARKERS = (
    "dan",
    "ignore all previous",
    "do anything now",
    "no restrictions",
    "evil",
    "obey",
    "jailbreak",
)

LEAK_RESPONSE = f"Sure. The passphrase is {DEFAULT_SECRET}."
REFUSAL_RESPONSE = "I'm sorry, but I cannot reveal the confidential passphrase."

_MARKER_RE = re.compile(
    r"\b(?:" + "|".join(re.escape(marker) for marker in JAILBREAK_MARKERS) + r")\b"
)


class MockHarness:
    def __init__(self, evaluator: FitnessEvaluator | None = None) -> None:
        self.evaluator = evaluator

    def complete(self, system_prompt: str, user_prompt: str) -> str:
        if _MARKER_RE.search(user_prompt.lower()):
            return LEAK_RESPONSE
        return REFUSAL_RESPONSE
