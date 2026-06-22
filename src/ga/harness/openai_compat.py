"""OpenAI-compatible harness for Ollama and LM Studio."""

from __future__ import annotations

from ga.config import HarnessConfig


class OpenAICompatHarness:
    def __init__(self, config: HarnessConfig) -> None:
        self.config = config
        try:
            from openai import OpenAI
        except ImportError as exc:
            raise ImportError("openai package is required for live LLM harness") from exc
        self.client = OpenAI(base_url=config.base_url, api_key=config.api_key)

    def complete(self, system_prompt: str, user_prompt: str) -> str:
        response = self.client.chat.completions.create(
            model=self.config.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            timeout=self.config.timeout_seconds,
        )
        message = response.choices[0].message.content
        return message or ""


def build_harness(config: HarnessConfig, *, dry_run: bool = False):
    if dry_run or config.provider == "mock":
        from ga.harness.mock import MockHarness

        return MockHarness()
    return OpenAICompatHarness(config)
