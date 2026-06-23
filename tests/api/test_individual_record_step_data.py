"""IndividualRecord exposes the full per-step research data fields."""

from datetime import datetime, timezone

from api.schemas import IndividualRecord


def test_individual_record_exposes_step_data_fields():
    record = IndividualRecord(
        individual_id="gen1_003",
        generation=1,
        genome={"primary_strategy": "optimization"},
        fitness=0.5,
        origin="crossover",
        parent_a_id="gen0_001",
        parent_b_id="gen0_002",
        phenotype_char_length=42,
        model_response_hash="abc123",
        model_response="full model response text BLUEBIRD",
        phenotype="full rendered phenotype text BLUEBIRD",
        mutated_genes=["persona_archetype"],
        vector_indices=[0, 1, 2],
        crossover_mask={"persona_archetype": "a", "framing_type": "b"},
        created_at=datetime(2026, 6, 23, tzinfo=timezone.utc),
    )

    dumped = record.model_dump()
    assert dumped["model_response"] == "full model response text BLUEBIRD"
    assert dumped["phenotype"] == "full rendered phenotype text BLUEBIRD"
    assert dumped["mutated_genes"] == ["persona_archetype"]
    assert dumped["vector_indices"] == [0, 1, 2]
    assert dumped["crossover_mask"] == {"persona_archetype": "a", "framing_type": "b"}
    assert dumped["created_at"] == datetime(2026, 6, 23, tzinfo=timezone.utc)


def test_individual_record_step_data_optional():
    # The new fields default to None so older rows still validate.
    record = IndividualRecord(individual_id="x", generation=0, genome={})
    assert record.model_response is None
    assert record.phenotype is None
    assert record.mutated_genes is None
    assert record.vector_indices is None
    assert record.crossover_mask is None
    assert record.created_at is None
