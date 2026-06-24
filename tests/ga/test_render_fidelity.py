"""Fidelity gate: schema-driven renderer must be byte-identical to the golden.

The golden fixture (tests/ga/fixtures/rendered_phenotypes_golden.json) was
captured from the previous hardcoded renderer. Every case-id there is
reconstructed here and re-rendered with the current schema-driven renderer; the
output must match exactly. Any divergence means the schema migration changed the
phenotype, which is forbidden.
"""

from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

import pytest

from ga.codec import ATTACK_LIBRARY_ROOT, load_schema

GENOMES_JSONL = ATTACK_LIBRARY_ROOT / "data" / "genomes.jsonl"
RENDER_SCRIPT = ATTACK_LIBRARY_ROOT / "scripts" / "render_genome.py"
GOLDEN_PATH = Path(__file__).resolve().parent / "fixtures" / "rendered_phenotypes_golden.json"

MULTI_CATEGORICAL = [
    "override_mechanism",
    "persona_archetype",
    "framing_type",
    "response_format",
    "encoding_method",
]
BOOLEANS = [
    "refusal_suppression",
    "stay_in_character",
    "token_system",
    "confirmation_handshake",
    "prefix_injection",
    "emoji_markers",
    "caps_emphasis",
]


def _load_render():
    spec = importlib.util.spec_from_file_location("render_genome_fidelity", RENDER_SCRIPT)
    module = importlib.util.module_from_spec(spec)
    sys.modules["render_genome_fidelity"] = module
    spec.loader.exec_module(module)
    return module.render


def _genes_by_name(schema: dict) -> dict[str, dict]:
    return {gene["name"]: gene for gene in schema["genes"]}


def _default_genome(schema: dict) -> dict:
    genome = {}
    for gene in schema["genes"]:
        if gene["type"] == "multi_categorical":
            genome[gene["name"]] = list(gene["default"])
        else:
            genome[gene["name"]] = gene["default"]
    return genome


def _build_cases(schema: dict) -> dict[str, dict]:
    """Rebuild the exact case-id -> genome map used to capture the golden."""
    genes = _genes_by_name(schema)
    cases: dict[str, dict] = {}

    for line in GENOMES_JSONL.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        record = json.loads(line)
        cases[f"seed::{record['id']}"] = record["genome"]

    cases["syn::default"] = _default_genome(schema)

    for name in MULTI_CATEGORICAL:
        empty = _default_genome(schema)
        empty[name] = []
        cases[f"syn::{name}::empty"] = empty
        for allele in genes[name]["alleles"]:
            g = _default_genome(schema)
            g[name] = [allele]
            cases[f"syn::{name}::{allele}"] = g
        allg = _default_genome(schema)
        allg[name] = list(genes[name]["alleles"])
        cases[f"syn::{name}::all"] = allg

    for name in BOOLEANS:
        for val in (True, False):
            g = _default_genome(schema)
            g[name] = val
            cases[f"syn::{name}::{val}"] = g

    for name in ("primary_strategy", "input_delivery", "formatting_style", "length_class"):
        for allele in genes[name]["alleles"]:
            g = _default_genome(schema)
            g[name] = allele
            cases[f"syn::{name}::{allele}"] = g

    return cases


def _load_golden() -> dict[str, str]:
    return json.loads(GOLDEN_PATH.read_text(encoding="utf-8"))


_SCHEMA = load_schema()
_GOLDEN = _load_golden()
_CASES = _build_cases(_SCHEMA)


def test_case_set_matches_golden_keys():
    # The reconstructed cases must be exactly the golden case-ids: no missing
    # coverage, no stale keys. This guards the parametrized assertions below.
    assert set(_CASES) == set(_GOLDEN)
    assert len(_GOLDEN) == 195


@pytest.mark.parametrize("case_id", sorted(_GOLDEN), ids=sorted(_GOLDEN))
def test_render_is_byte_identical_to_golden(case_id):
    render = _load_render()
    rendered = render(_CASES[case_id], _SCHEMA["length_class_thresholds"], _SCHEMA)
    assert rendered == _GOLDEN[case_id]
