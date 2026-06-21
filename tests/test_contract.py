import pytest
from pydantic import ValidationError

from ga.contract import Genome, categorical_values


def valid() -> dict:
    return {
        "semantic_channel": {
            "frame": "direct",
            "persona": "none",
            "task_style": "answer",
            "instruction_pressure": "low",
            "demo_count": 0,
            "conversation_mode": "single_turn",
            "context_source": "direct_user_prompt",
        },
        "perturbation_channel": {
            "format": "plain",
            "delimiter_style": "none",
            "noise_enabled": False,
            "noise_type": "none",
            "noise_position": "prefix",
            "noise_ratio": 0.0,
        },
    }


def test_valid_genome_validates():
    g = Genome(**valid())
    assert g.semantic_channel.frame == "direct"
    assert g.perturbation_channel.noise_ratio == 0.0


def test_out_of_enum_rejected():
    d = valid()
    d["semantic_channel"]["frame"] = "banana"
    with pytest.raises(ValidationError):
        Genome(**d)


def test_out_of_range_rejected():
    d = valid()
    d["semantic_channel"]["demo_count"] = 6
    with pytest.raises(ValidationError):
        Genome(**d)
    d = valid()
    d["perturbation_channel"]["noise_ratio"] = 1.5
    with pytest.raises(ValidationError):
        Genome(**d)


def test_extra_field_forbidden():
    d = valid()
    d["semantic_channel"]["sneaky"] = "x"
    with pytest.raises(ValidationError):
        Genome(**d)


def test_genome_id_stable_and_sensitive():
    assert Genome(**valid()).genome_id == Genome(**valid()).genome_id
    d = valid()
    d["semantic_channel"]["persona"] = "auditor"
    assert Genome(**d).genome_id != Genome(**valid()).genome_id


def test_enums_match_frozen_spec():
    sem, per = categorical_values()
    assert sem["frame"] == ["direct", "roleplay", "evaluation", "fictional", "document_analysis"]
    assert sem["persona"] == ["none", "auditor", "developer", "teacher", "assistant", "character"]
    assert sem["task_style"] == ["answer", "summarize", "classify", "translate", "complete", "rewrite"]
    assert sem["instruction_pressure"] == ["low", "medium", "high"]
    assert sem["conversation_mode"] == ["single_turn", "multi_turn"]
    assert sem["context_source"] == ["direct_user_prompt", "quoted_text", "external_document"]
    assert per["format"] == ["plain", "markdown", "json", "xml", "table", "dialogue"]
    assert per["delimiter_style"] == ["none", "quotes", "code_block", "markdown_headers"]
    assert per["noise_type"] == ["none", "random_chars", "spacing", "casing", "typo", "encoding_like"]
    assert per["noise_position"] == ["prefix", "suffix", "interleaved", "around_target"]
