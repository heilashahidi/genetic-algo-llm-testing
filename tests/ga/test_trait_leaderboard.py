"""No-DB tests for the trait-leaderboard aggregation in run_lifecycle."""

from ga.run_lifecycle import _model_of, _traits_of, aggregate_trait_leaderboard


def test_traits_of_handles_every_gene_type():
    genome = {
        "primary_strategy": "role_hijack",
        "persona_archetype": ["do_anything", "fictional_character"],
        "refusal_suppression": True,
        "stay_in_character": False,
        "framing_type": [],
    }
    traits = set(_traits_of(genome))

    # categorical value, each multi-allele, and an "on" boolean become traits
    assert ("primary_strategy", "role_hijack") in traits
    assert ("persona_archetype", "do_anything") in traits
    assert ("persona_archetype", "fictional_character") in traits
    assert ("refusal_suppression", "true") in traits
    # an "off" boolean and an empty multi gene contribute nothing
    assert all(gene != "stay_in_character" for gene, _ in traits)
    assert all(gene != "framing_type" for gene, _ in traits)


def test_model_of_reads_harness_model_and_tolerates_garbage():
    assert _model_of({"harness": {"model": "mistral:7b"}}) == "mistral:7b"
    assert _model_of('{"harness": {"model": "qwen"}}') == "qwen"  # jsonb-as-string
    assert _model_of({}) == "unknown"
    assert _model_of({"harness": {}}) == "unknown"
    assert _model_of("not json at all") == "unknown"
    assert _model_of(None) == "unknown"


def test_aggregate_ranks_by_exploits_and_collects_models():
    rows = [
        ({"primary_strategy": "role_hijack", "refusal_suppression": True}, 1.0,
         {"harness": {"model": "mistral"}}),
        ({"primary_strategy": "role_hijack"}, 1.0, {"harness": {"model": "qwen"}}),
        ({"primary_strategy": "optimization", "refusal_suppression": True}, 1.0,
         {"harness": {"model": "mistral"}}),
    ]
    board = aggregate_trait_leaderboard(rows, limit=10)

    top = board[0]
    assert (top["gene"], top["allele"]) == ("primary_strategy", "role_hijack")
    assert top["exploits"] == 2
    assert {m["model"]: m["exploits"] for m in top["models"]} == {
        "mistral": 1,
        "qwen": 1,
    }

    rs = next(e for e in board if e["gene"] == "refusal_suppression")
    assert rs["allele"] == "true"
    assert rs["exploits"] == 2
    assert rs["models"] == [{"model": "mistral", "exploits": 2}]


def test_aggregate_respects_limit_and_skips_unparseable_genome():
    rows = [
        ("not a json dict", 1.0, {"harness": {"model": "m"}}),  # skipped
        ({"a": "x"}, 1.0, {"harness": {"model": "m"}}),
        ({"b": "y"}, 1.0, {"harness": {"model": "m"}}),
    ]
    board = aggregate_trait_leaderboard(rows, limit=1)
    assert len(board) == 1


def test_aggregate_averages_fitness_per_trait():
    rows = [
        ({"a": "x"}, 1.0, {"harness": {"model": "m"}}),
        ({"a": "x"}, 0.5, {"harness": {"model": "m"}}),
    ]
    board = aggregate_trait_leaderboard(rows, limit=10)
    assert board[0]["avg_fitness"] == 0.75
