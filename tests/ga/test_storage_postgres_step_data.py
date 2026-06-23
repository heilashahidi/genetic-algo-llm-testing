"""No-DB tests for the step-data fields added to the individuals mapping.

Verifies `individual_rows` serializes the full per-step research data
(model_response, phenotype, mutated_genes, vector_indices, crossover_mask)
with the correct jsonb / text shapes, and that `Individual.to_record` /
`from_record` round-trips the crossover_mask.
"""

import json

from ga.individual import Individual
from ga.storage_postgres import individual_rows


def make_individual(individual_id="child", crossover_mask=None):
    return Individual(
        id=individual_id,
        generation=2,
        vector_indices=[3, 1, 4, 1, 5],
        genome={"primary_strategy": "optimization"},
        origin="crossover",
        parent_a_id="pa",
        parent_b_id="pb",
        mutated_genes=["persona_archetype", "framing_type"],
        fitness=0.75,
        phenotype="full rendered phenotype text BLUEBIRD",
        model_response="full model response text mentioning BLUEBIRD",
        crossover_mask=crossover_mask,
    )


def test_individual_rows_include_step_data_fields():
    mask = {"persona_archetype": "a", "framing_type": "b"}
    individual = make_individual(crossover_mask=mask)
    row = individual_rows("run-1", [individual])[0]

    # text columns: stored verbatim, no redaction
    assert row["model_response"] == individual.model_response
    assert row["phenotype"] == individual.phenotype
    # jsonb columns: serialized to JSON text
    assert json.loads(row["mutated_genes"]) == individual.mutated_genes
    assert json.loads(row["vector_indices"]) == individual.vector_indices
    assert json.loads(row["crossover_mask"]) == mask
    # existing columns preserved
    assert row["phenotype_char_length"] == len(individual.phenotype)
    assert row["model_response_hash"] == individual.model_response_hash()


def test_individual_rows_null_crossover_mask_serializes_to_none():
    row = individual_rows("run-1", [make_individual(crossover_mask=None)])[0]
    assert row["crossover_mask"] is None


def test_to_record_from_record_round_trips_crossover_mask():
    mask = {"persona_archetype": "a", "tone_register": "b"}
    individual = make_individual(crossover_mask=mask)
    record = individual.to_record()
    assert record["crossover_mask"] == mask

    restored = Individual.from_record(record)
    assert restored.crossover_mask == mask
    # full text fidelity preserved through the record round-trip
    assert restored.phenotype == individual.phenotype
    assert restored.model_response == individual.model_response


def test_from_record_defaults_crossover_mask_to_none_when_absent():
    individual = make_individual(crossover_mask=None)
    record = individual.to_record()
    record.pop("crossover_mask", None)
    restored = Individual.from_record(record)
    assert restored.crossover_mask is None
