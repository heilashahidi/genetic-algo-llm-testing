import json

import pytest

from ga.codec import (
    ATTACK_LIBRARY_ROOT,
    decode_vector_indices,
    encode_genome_to_vector,
    gene_blocks,
    load_schema,
)
from ga.config import ExperimentConfig


GENOMES_JSONL = ATTACK_LIBRARY_ROOT / "data" / "genomes.jsonl"


@pytest.fixture
def schema():
    return load_schema()


def load_seed_records():
    return [json.loads(line) for line in GENOMES_JSONL.read_text(encoding="utf-8").splitlines() if line.strip()]


def test_round_trip_all_seeds(schema):
    for record in load_seed_records():
        genome = record["genome"]
        vector = encode_genome_to_vector(genome, schema)
        assert vector == record["vector_indices"]
        decoded = decode_vector_indices(vector, schema)
        assert decoded == genome


def test_gene_blocks_cover_all_genes(schema):
    blocks = gene_blocks(schema)
    assert len(blocks) == len(schema["genes"])
    assert sum(block.end - block.start for block in blocks) == 39


def test_decode_invalid_length_raises(schema):
    with pytest.raises(ValueError):
        decode_vector_indices([0] * 10, schema)
