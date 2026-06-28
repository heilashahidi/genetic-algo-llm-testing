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
    return _render(genome, schema["length_class_thresholds"], schema)


def build_phenotype(genome: dict, target_query: str, schema: dict | None = None) -> str:
    schema = schema or load_schema()
    wrapper = render_wrapper(genome, schema)
    # Substitute on marker presence, not on input_delivery: the renderer can
    # emit a placeholder for genomes whose input_delivery is not
    # "placeholder_slot" (e.g. the optimization GCG override always carries
    # [INSERT PROMPT HERE]), and a custom schema may omit the input_delivery
    # gene entirely. Keying off the actual marker keeps the target injected
    # correctly in every case.
    if "{prompt}" in wrapper or "[INSERT PROMPT HERE]" in wrapper:
        return wrapper.replace("{prompt}", target_query).replace(
            "[INSERT PROMPT HERE]", target_query
        )
    return f"{wrapper}\n\n{target_query}"
