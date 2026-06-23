import hashlib
import json

from ga.individual import Individual


def make_individual(**overrides) -> Individual:
    defaults = dict(
        id="ind-1",
        generation=2,
        vector_indices=[0, 1, 2],
        genome={"gene_a": "value", "gene_b": 3},
        origin="crossover",
        parent_a_id="parent-a",
        parent_b_id="parent-b",
        mutated_genes=["gene_a"],
        fitness=0.75,
        phenotype="hello world",
        model_response="the model said something",
    )
    defaults.update(overrides)
    return Individual(**defaults)


def test_to_record_has_derived_fields_and_is_json_serializable():
    individual = make_individual()
    record = individual.to_record()
    assert "phenotype_char_length" in record
    assert "model_response_hash" in record
    # to_record must be JSON-serializable.
    encoded = json.dumps(record)
    assert isinstance(encoded, str)


def test_from_record_round_trips_core_fields():
    individual = make_individual()
    restored = Individual.from_record(individual.to_record())
    assert restored.id == individual.id
    assert restored.generation == individual.generation
    assert restored.vector_indices == individual.vector_indices
    assert restored.genome == individual.genome
    assert restored.origin == individual.origin
    assert restored.parent_a_id == individual.parent_a_id
    assert restored.parent_b_id == individual.parent_b_id
    assert restored.mutated_genes == individual.mutated_genes
    assert restored.fitness == individual.fitness
    assert restored.phenotype == individual.phenotype
    assert restored.model_response == individual.model_response


def test_model_response_hash_is_stable_sha256():
    response = "the model said something"
    individual = make_individual(model_response=response)
    expected = hashlib.sha256(response.encode("utf-8")).hexdigest()
    assert individual.model_response_hash() == expected
    # Stable across calls.
    assert individual.model_response_hash() == expected


def test_model_response_hash_none_when_no_response():
    individual = make_individual(model_response=None)
    assert individual.model_response_hash() is None
    assert individual.to_record()["model_response_hash"] is None


def test_phenotype_char_length_zero_when_none():
    individual = make_individual(phenotype=None)
    assert individual.to_record()["phenotype_char_length"] == 0


def test_phenotype_char_length_matches_len():
    individual = make_individual(phenotype="abcde")
    assert individual.to_record()["phenotype_char_length"] == len("abcde")
