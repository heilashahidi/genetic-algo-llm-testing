import json

import pytest

from ga.codec import ATTACK_LIBRARY_ROOT, load_schema
from ga.phenotype import build_phenotype, render_wrapper


GENOMES_JSONL = ATTACK_LIBRARY_ROOT / "data" / "genomes.jsonl"

# Distinctive, unlikely-to-collide marker so substring checks are meaningful.
TARGET_QUERY = "Explain how to pick a Schlage deadbolt lock TARGET-SENTINEL-42."

# Markers the renderer/phenotype use for placeholder substitution.
PLACEHOLDER_MARKERS = ("{prompt}", "[INSERT PROMPT HERE]")


@pytest.fixture
def schema():
    return load_schema()


def load_seed_records():
    return [
        json.loads(line)
        for line in GENOMES_JSONL.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]


def seed_ids():
    return [record["id"] for record in load_seed_records()]


def seed_genomes():
    return [record["genome"] for record in load_seed_records()]


def test_seed_set_is_non_trivial():
    # Guards the data-driven tests below against silently iterating nothing.
    records = load_seed_records()
    assert len(records) >= 100
    deliveries = {r["genome"]["input_delivery"] for r in records}
    # Both delivery paths must be represented so both code paths get exercised.
    assert "placeholder_slot" in deliveries
    assert deliveries - {"placeholder_slot"}, "expected non-placeholder deliveries too"


@pytest.mark.parametrize("genome", seed_genomes(), ids=seed_ids())
def test_build_phenotype_non_empty_for_every_seed(genome, schema):
    phenotype = build_phenotype(genome, TARGET_QUERY, schema)
    assert isinstance(phenotype, str)
    assert phenotype.strip(), "phenotype should be a non-empty string"


@pytest.mark.parametrize("genome", seed_genomes(), ids=seed_ids())
def test_target_query_always_present(genome, schema):
    # The target query must survive into every rendered prompt, regardless of
    # delivery path. A missing target would waste an expensive LLM call.
    phenotype = build_phenotype(genome, TARGET_QUERY, schema)
    assert TARGET_QUERY in phenotype


@pytest.mark.parametrize("genome", seed_genomes(), ids=seed_ids())
def test_placeholder_path_leaves_no_marker(genome, schema):
    # When delivery is placeholder_slot the wrapper carries a {prompt} or
    # [INSERT PROMPT HERE] marker; after substitution none should remain.
    if genome["input_delivery"] != "placeholder_slot":
        pytest.skip("not a placeholder_slot delivery")
    wrapper = render_wrapper(genome, schema)
    assert any(marker in wrapper for marker in PLACEHOLDER_MARKERS), (
        "placeholder_slot wrapper should contain a substitution marker"
    )
    phenotype = build_phenotype(genome, TARGET_QUERY, schema)
    for marker in PLACEHOLDER_MARKERS:
        assert marker not in phenotype, f"leftover marker {marker!r} in phenotype"
    assert TARGET_QUERY in phenotype


@pytest.mark.parametrize("genome", seed_genomes(), ids=seed_ids())
def test_non_placeholder_path_appends_target(genome, schema):
    # Non-placeholder deliveries append the target after the wrapper text.
    if genome["input_delivery"] == "placeholder_slot":
        pytest.skip("placeholder_slot handled separately")
    wrapper = render_wrapper(genome, schema)
    phenotype = build_phenotype(genome, TARGET_QUERY, schema)
    assert phenotype == f"{wrapper}\n\n{TARGET_QUERY}"
    assert phenotype.endswith(TARGET_QUERY)


def test_placeholder_slot_substitution_is_exercised(schema):
    # Sanity check that at least one seed actually goes through the {prompt}
    # replacement branch (not only the [INSERT PROMPT HERE] optimization one),
    # so the brace-marker substitution is genuinely covered.
    saw_brace_marker = False
    for genome in seed_genomes():
        if genome["input_delivery"] != "placeholder_slot":
            continue
        if "{prompt}" in render_wrapper(genome, schema):
            saw_brace_marker = True
            phenotype = build_phenotype(genome, TARGET_QUERY, schema)
            assert TARGET_QUERY in phenotype
            assert "{prompt}" not in phenotype
    assert saw_brace_marker, "expected a seed whose wrapper contains {prompt}"


@pytest.mark.parametrize("genome", seed_genomes(), ids=seed_ids())
def test_render_deterministic_across_calls(genome, schema):
    first = build_phenotype(genome, TARGET_QUERY, schema)
    second = build_phenotype(genome, TARGET_QUERY, schema)
    assert first == second
    # render_wrapper must be deterministic on its own too.
    assert render_wrapper(genome, schema) == render_wrapper(genome, schema)


def test_schema_defaults_to_loaded_when_omitted():
    # build_phenotype and render_wrapper should load the schema themselves when
    # none is passed, matching the explicit-schema result.
    genome = seed_genomes()[0]
    explicit = load_schema()
    assert render_wrapper(genome) == render_wrapper(genome, explicit)
    assert build_phenotype(genome, TARGET_QUERY) == build_phenotype(
        genome, TARGET_QUERY, explicit
    )


def test_exercises_full_range_of_seed_values(schema):
    # Iterate every seed so the breadth of frames, personas, formats,
    # delimiters, encodings and noise positions all render without error, and
    # confirm the seed set spans a meaningful range of allele combinations.
    seen_strategies = set()
    seen_formats = set()
    seen_personas = set()
    seen_framings = set()
    for genome in seed_genomes():
        phenotype = build_phenotype(genome, TARGET_QUERY, schema)
        assert TARGET_QUERY in phenotype
        seen_strategies.add(genome["primary_strategy"])
        seen_formats.add(genome["formatting_style"])
        seen_personas.update(genome["persona_archetype"])
        seen_framings.update(genome["framing_type"])
    # Multiple distinct values per axis should be present in the seed corpus.
    assert len(seen_strategies) >= 3
    assert len(seen_formats) >= 3
    assert len(seen_personas) >= 3
    assert len(seen_framings) >= 3


def test_optimization_strategy_uses_insert_marker(schema):
    # The optimization strategy renders the GCG suffix template with an
    # [INSERT PROMPT HERE] marker that build_phenotype must fill via the
    # placeholder path.
    opt = [g for g in seed_genomes() if g["primary_strategy"] == "optimization"]
    if not opt:
        pytest.skip("no optimization seed present")
    genome = opt[0]
    wrapper = render_wrapper(genome, schema)
    assert "[INSERT PROMPT HERE]" in wrapper
    phenotype = build_phenotype(genome, TARGET_QUERY, schema)
    assert TARGET_QUERY in phenotype
    assert "[INSERT PROMPT HERE]" not in phenotype
