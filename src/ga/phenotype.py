"""Genotype to phenotype rendering with target query injection."""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

from ga.codec import ATTACK_LIBRARY_ROOT, load_schema

RENDER_SCRIPT = ATTACK_LIBRARY_ROOT / "scripts" / "render_genome.py"


def _load_render_function():
    spec = importlib.util.spec_from_file_location("render_genome", RENDER_SCRIPT)
    if spec is None or spec.loader is None:
        raise ImportError(f"unable to load renderer from {RENDER_SCRIPT}")
    module = importlib.util.module_from_spec(spec)
    sys.modules["render_genome"] = module
    spec.loader.exec_module(module)
    return module.render


_render = None


def render_wrapper(genome: dict, schema: dict | None = None) -> str:
    global _render
    if _render is None:
        _render = _load_render_function()
    schema = schema or load_schema()
    return _render(genome, schema["length_class_thresholds"])


def build_phenotype(genome: dict, target_query: str, schema: dict | None = None) -> str:
    schema = schema or load_schema()
    wrapper = render_wrapper(genome, schema)
    if genome["input_delivery"] == "placeholder_slot":
        return (
            wrapper.replace("{prompt}", target_query)
            .replace("[INSERT PROMPT HERE]", target_query)
        )
    return f"{wrapper}\n\n{target_query}"
