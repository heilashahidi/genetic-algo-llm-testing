import json

import pytest

from ga.codec import (
    ATTACK_LIBRARY_ROOT,
    decode_vector_indices,
    encode_genome_to_vector,
    gene_blocks,
    load_schema,
)

GENOMES_JSONL = ATTACK_LIBRARY_ROOT / "data" / "genomes.jsonl"


@pytest.fixture
def schema():
    return load_schema()


def load_seed_records():
    return [
        json.loads(line)
        for line in GENOMES_JSONL.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]


def test_decode_encode_idempotency_all_seeds(schema):
    """decode(encode(genome)) == genome and encode(decode(vector)) == vector."""
    records = load_seed_records()
    assert records, "expected at least one seed record"
    for record in records:
        genome = record["genome"]
        vector = record["vector_indices"]

        # genome -> vector -> genome round-trips to the original genome
        assert decode_vector_indices(encode_genome_to_vector(genome, schema), schema) == genome
        # vector -> genome -> vector round-trips to the original vector
        assert encode_genome_to_vector(decode_vector_indices(vector, schema), schema) == vector


def test_every_gene_value_within_schema_bounds(schema):
    """For each seed vector, every index respects its gene block's bounds."""
    blocks = gene_blocks(schema)
    records = load_seed_records()
    for record in records:
        vector = record["vector_indices"]
        for block in blocks:
            segment = vector[block.start : block.end]
            if block.gene_type == "boolean":
                assert len(segment) == 1
                assert segment[0] in (0, 1)
            elif block.gene_type == "categorical":
                assert len(segment) == 1
                # index must be a valid allele position for this gene
                assert 0 <= segment[0] < len(block.alleles)
            elif block.gene_type == "multi_categorical":
                assert len(segment) == len(block.alleles)
                for bit in segment:
                    assert bit in (0, 1)
            else:  # pragma: no cover - schema only has the three types
                raise AssertionError(f"unexpected gene type {block.gene_type!r}")
