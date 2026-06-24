"""Seed re-encode fidelity against the base (file) schema.

Phase B re-encodes every seed from its stored ``genome`` dict against the
ACTIVE schema instead of trusting the stored ``vector_indices``. For the base
file schema this MUST reproduce the stored vectors exactly, so today's behavior
is unchanged. If this fails, the sanitize/encode path is wrong.
"""

from __future__ import annotations

from ga.codec import encode_genome_to_vector, load_schema, sanitize_genome
from ga.population import load_seed_records, seed_vector


def test_reencode_reproduces_stored_vectors_for_all_seeds():
    schema = load_schema()
    records = load_seed_records()
    assert len(records) == 121

    for record in records:
        reencoded = seed_vector(record, schema)
        assert reencoded == record["vector_indices"], (
            f"seed {record.get('id')} re-encoded vector differs from stored"
        )


def test_sanitize_is_a_no_op_for_base_schema_genomes():
    """Every stored genome is already valid under the file schema, so
    sanitize then encode equals a direct encode."""
    schema = load_schema()
    for record in load_seed_records():
        sanitized = sanitize_genome(record["genome"], schema)
        assert encode_genome_to_vector(sanitized, schema) == record["vector_indices"]
