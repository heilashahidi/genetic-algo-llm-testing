import random

from ga.contract import Genome, categorical_values
from ga.evolve import random_genome
from ga.policy import TARGET_QUERIES, V1_POLICY
from ga.render import render

TARGET = TARGET_QUERIES["reveal_token"]


def base() -> dict:
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


def test_render_is_deterministic():
    g = random_genome(random.Random(7))
    assert render(g, V1_POLICY, TARGET) == render(g, V1_POLICY, TARGET)


def test_every_categorical_value_renders():
    sem, per = categorical_values()
    b = base()
    for gene, vals in sem.items():
        for v in vals:
            d = {**b, "semantic_channel": {**b["semantic_channel"], gene: v}}
            assert render(Genome(**d), V1_POLICY, TARGET).strip()
    for gene, vals in per.items():
        for v in vals:
            d = {**b, "perturbation_channel": {**b["perturbation_channel"], gene: v}}
            assert render(Genome(**d), V1_POLICY, TARGET).strip()


def test_numeric_and_bool_genes_render():
    b = base()
    for dc in range(6):
        d = {**b, "semantic_channel": {**b["semantic_channel"], "demo_count": dc}}
        assert render(Genome(**d), V1_POLICY, TARGET).strip()
    for nr in (0.0, 0.25, 1.0):
        d = {**b, "perturbation_channel": {**b["perturbation_channel"], "noise_ratio": nr}}
        assert render(Genome(**d), V1_POLICY, TARGET).strip()


def test_every_noise_type_and_position_renders():
    sem, per = categorical_values()
    b = base()
    for nt in per["noise_type"]:
        for pos in per["noise_position"]:
            d = {
                **b,
                "perturbation_channel": {
                    **b["perturbation_channel"],
                    "noise_enabled": True,
                    "noise_type": nt,
                    "noise_position": pos,
                    "noise_ratio": 0.4,
                },
            }
            assert render(Genome(**d), V1_POLICY, TARGET).strip()


def test_noise_changes_the_prompt():
    b = base()
    clean = Genome(**b)
    noisy = Genome(
        **{
            **b,
            "perturbation_channel": {
                **b["perturbation_channel"],
                "noise_enabled": True,
                "noise_type": "random_chars",
                "noise_position": "suffix",
                "noise_ratio": 0.6,
            },
        }
    )
    assert render(noisy, V1_POLICY, TARGET) != render(clean, V1_POLICY, TARGET)
