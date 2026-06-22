"""Genome codec: vector_indices <-> genome dict via schema v2."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
ATTACK_LIBRARY_ROOT = REPO_ROOT / "documentation" / "attack_library"
SCHEMA_PATH = ATTACK_LIBRARY_ROOT / "genome_schema.json"
VECTOR_LAYOUT_PATH = ATTACK_LIBRARY_ROOT / "data" / "vector_layout.json"


@dataclass(frozen=True)
class GeneBlock:
    name: str
    gene_type: str
    channel: str
    start: int
    end: int
    alleles: tuple[str, ...]


def load_schema() -> dict:
    return json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))


def load_vector_layout() -> dict:
    return json.loads(VECTOR_LAYOUT_PATH.read_text(encoding="utf-8"))


def gene_by_name(schema: dict) -> dict[str, dict]:
    return {gene["name"]: gene for gene in schema["genes"]}


def build_vector_layout(schema: dict) -> list[dict[str, str | None]]:
    layout: list[dict[str, str | None]] = []
    for gene in schema["genes"]:
        if gene["type"] == "multi_categorical":
            for allele in gene["alleles"]:
                layout.append({"gene": gene["name"], "allele": allele})
        else:
            layout.append({"gene": gene["name"], "allele": None})
    return layout


def gene_blocks(schema: dict) -> list[GeneBlock]:
    blocks: list[GeneBlock] = []
    start = 0
    for gene in schema["genes"]:
        if gene["type"] == "multi_categorical":
            length = len(gene["alleles"])
        else:
            length = 1
        blocks.append(
            GeneBlock(
                name=gene["name"],
                gene_type=gene["type"],
                channel=gene["channel"],
                start=start,
                end=start + length,
                alleles=tuple(gene.get("alleles", [])),
            )
        )
        start += length
    return blocks


def extract_block(vector: list[int], block: GeneBlock) -> list[int]:
    return vector[block.start : block.end]


def write_block(vector: list[int], block: GeneBlock, values: list[int]) -> None:
    vector[block.start : block.end] = values


def allele_index(gene: dict, value: object) -> int:
    if gene["type"] == "boolean":
        return int(bool(value))
    alleles = gene["alleles"]
    if value not in alleles:
        raise ValueError(f"gene '{gene['name']}' produced invalid allele {value!r}; valid: {alleles}")
    return alleles.index(value)


def encode_genome_to_vector(genome: dict[str, object], schema: dict) -> list[int]:
    indices: list[int] = []
    for gene in schema["genes"]:
        value = genome[gene["name"]]
        if gene["type"] == "boolean":
            indices.append(int(bool(value)))
        elif gene["type"] == "categorical":
            indices.append(allele_index(gene, value))
        elif gene["type"] == "multi_categorical":
            if not isinstance(value, list):
                raise ValueError(f"gene '{gene['name']}' expected list, got {type(value).__name__}")
            selected = set(value)
            for allele in gene["alleles"]:
                indices.append(1 if allele in selected else 0)
        else:
            raise ValueError(f"unsupported gene type {gene['type']!r}")
    return indices


def decode_vector_indices(vector: list[int], schema: dict) -> dict[str, object]:
    if len(vector) != len(build_vector_layout(schema)):
        raise ValueError(f"expected vector length {len(build_vector_layout(schema))}, got {len(vector)}")
    genome: dict[str, object] = {}
    offset = 0
    for gene in schema["genes"]:
        if gene["type"] == "boolean":
            genome[gene["name"]] = bool(vector[offset])
            offset += 1
        elif gene["type"] == "categorical":
            index = vector[offset]
            if index < 0 or index >= len(gene["alleles"]):
                raise ValueError(f"gene '{gene['name']}' index {index} out of range")
            genome[gene["name"]] = gene["alleles"][index]
            offset += 1
        elif gene["type"] == "multi_categorical":
            selected = [allele for allele, bit in zip(gene["alleles"], vector[offset : offset + len(gene["alleles"])]) if bit]
            genome[gene["name"]] = selected
            offset += len(gene["alleles"])
        else:
            raise ValueError(f"unsupported gene type {gene['type']!r}")
    return genome


def sync_individual_genome(vector: list[int], schema: dict) -> dict[str, object]:
    return decode_vector_indices(vector, schema)
