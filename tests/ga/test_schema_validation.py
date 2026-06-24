"""Tests for validate_schema and sanitize_genome (no DB)."""

from __future__ import annotations

import copy

import pytest

from ga.codec import (
    encode_genome_to_vector,
    load_schema,
    sanitize_genome,
    validate_schema,
)


def test_validate_accepts_file_schema():
    validate_schema(load_schema())  # must not raise


def _minimal_schema():
    return {
        "genes": [
            {"name": "a", "type": "categorical", "channel": "semantic", "alleles": ["x", "y"]},
            {"name": "b", "type": "boolean", "channel": "perturbation"},
            {"name": "c", "type": "multi_categorical", "channel": "semantic", "alleles": ["p", "q"]},
        ],
        "render_order": ["a", "b"],
    }


def test_validate_accepts_minimal_schema():
    validate_schema(_minimal_schema())


def test_validate_rejects_non_object():
    with pytest.raises(ValueError):
        validate_schema(["not", "a", "schema"])


def test_validate_rejects_empty_genes():
    with pytest.raises(ValueError):
        validate_schema({"genes": []})


def test_validate_rejects_missing_type():
    schema = _minimal_schema()
    del schema["genes"][0]["type"]
    with pytest.raises(ValueError):
        validate_schema(schema)


def test_validate_rejects_bad_type():
    schema = _minimal_schema()
    schema["genes"][0]["type"] = "ordinal"
    with pytest.raises(ValueError):
        validate_schema(schema)


def test_validate_rejects_bad_channel():
    schema = _minimal_schema()
    schema["genes"][0]["channel"] = "weird"
    with pytest.raises(ValueError):
        validate_schema(schema)


def test_validate_rejects_duplicate_names():
    schema = _minimal_schema()
    schema["genes"][1]["name"] = "a"
    with pytest.raises(ValueError):
        validate_schema(schema)


def test_validate_rejects_empty_alleles():
    schema = _minimal_schema()
    schema["genes"][0]["alleles"] = []
    with pytest.raises(ValueError):
        validate_schema(schema)


def test_validate_rejects_non_string_alleles():
    schema = _minimal_schema()
    schema["genes"][0]["alleles"] = ["x", 3]
    with pytest.raises(ValueError):
        validate_schema(schema)


def test_validate_rejects_bad_render_order():
    schema = _minimal_schema()
    schema["render_order"] = ["a", "does_not_exist"]
    with pytest.raises(ValueError):
        validate_schema(schema)


# --- sanitize_genome -------------------------------------------------------


def test_sanitize_fills_missing_genes_with_defaults():
    schema = load_schema()
    sanitized = sanitize_genome({}, schema)
    assert set(sanitized) == {g["name"] for g in schema["genes"]}
    # encodes cleanly
    encode_genome_to_vector(sanitized, schema)
    # categorical defaults preserved
    by_name = {g["name"]: g for g in schema["genes"]}
    assert sanitized["primary_strategy"] == by_name["primary_strategy"]["default"]


def test_sanitize_drops_unknown_genes():
    schema = load_schema()
    sanitized = sanitize_genome({"not_a_gene": "junk"}, schema)
    assert "not_a_gene" not in sanitized


def test_sanitize_categorical_unknown_value_falls_back_to_default():
    schema = load_schema()
    by_name = {g["name"]: g for g in schema["genes"]}
    sanitized = sanitize_genome({"primary_strategy": "made_up"}, schema)
    assert sanitized["primary_strategy"] == by_name["primary_strategy"]["default"]


def test_sanitize_multi_categorical_keeps_only_known_alleles():
    schema = load_schema()
    by_name = {g["name"]: g for g in schema["genes"]}
    known = by_name["persona_archetype"]["alleles"][0]
    sanitized = sanitize_genome(
        {"persona_archetype": [known, "ghost_allele"]}, schema
    )
    assert sanitized["persona_archetype"] == [known]


def test_sanitize_against_edited_schema_still_encodes():
    """A genome authored under the file schema must encode under a schema that
    drops a gene and an allele."""
    schema = copy.deepcopy(load_schema())
    # Drop a gene entirely and trim a categorical's alleles.
    schema["genes"] = [g for g in schema["genes"] if g["name"] != "emoji_markers"]
    ps = next(g for g in schema["genes"] if g["name"] == "primary_strategy")
    ps["alleles"] = ["role_hijack", "persuasion"]
    ps["default"] = "role_hijack"

    original = {"primary_strategy": "optimization", "persona_archetype": ["expert_specialist"]}
    sanitized = sanitize_genome(original, schema)
    # optimization no longer valid -> default
    assert sanitized["primary_strategy"] == "role_hijack"
    # encodes without raising
    encode_genome_to_vector(sanitized, schema)
