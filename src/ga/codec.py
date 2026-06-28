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


def sanitize_genome(genome: dict[str, object], schema: dict) -> dict[str, object]:
    """Coerce an arbitrary genome dict so it encodes cleanly under `schema`.

    A seed genome was authored against some (possibly older) schema. To re-encode
    it against the ACTIVE schema we must tolerate drift:

    - genes in the dict but not in the schema are dropped (handled implicitly by
      only emitting schema genes below),
    - genes in the schema but missing from the dict get their `default`,
    - categorical values not in the schema's `alleles` fall back to `default`,
    - multi_categorical lists keep only alleles the schema still knows,
    - boolean values are coerced to bool.

    The result has exactly the schema's gene names and only valid allele values,
    so `encode_genome_to_vector` always succeeds.
    """
    sanitized: dict[str, object] = {}
    for gene in schema["genes"]:
        name = gene["name"]
        gene_type = gene["type"]
        present = name in genome
        value = genome.get(name)
        if gene_type == "boolean":
            sanitized[name] = bool(value) if present else bool(gene.get("default", False))
        elif gene_type == "categorical":
            alleles = gene["alleles"]
            if present and value in alleles:
                sanitized[name] = value
            else:
                sanitized[name] = gene.get("default", alleles[0] if alleles else None)
        elif gene_type == "multi_categorical":
            alleles = set(gene["alleles"])
            if present and isinstance(value, list):
                sanitized[name] = [allele for allele in value if allele in alleles]
            else:
                default = gene.get("default", [])
                sanitized[name] = [allele for allele in default if allele in alleles]
        else:
            raise ValueError(f"unsupported gene type {gene_type!r}")
    return sanitized


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


_VALID_GENE_TYPES = ("categorical", "boolean", "multi_categorical")
_VALID_CHANNELS = ("semantic", "perturbation")


def validate_schema(schema: object) -> None:
    """Validate a genome schema, raising ``ValueError`` with a clear message.

    Rules:
    - top level is a mapping with a non-empty ``genes`` list,
    - each gene has a unique string ``name``, a ``type`` in
      {categorical, boolean, multi_categorical}, and a ``channel`` in
      {semantic, perturbation},
    - categorical / multi_categorical genes carry a non-empty ``alleles`` list
      of strings,
    - an optional top-level ``render_order`` is a list referencing existing gene
      names,
    - the whole thing round-trips through ``build_vector_layout`` without error.
    """
    if not isinstance(schema, dict):
        raise ValueError("schema must be an object")
    genes = schema.get("genes")
    if not isinstance(genes, list) or not genes:
        raise ValueError("schema.genes must be a non-empty list")

    seen_names: set[str] = set()
    for index, gene in enumerate(genes):
        if not isinstance(gene, dict):
            raise ValueError(f"genes[{index}] must be an object")
        name = gene.get("name")
        if not isinstance(name, str) or not name:
            raise ValueError(f"genes[{index}].name must be a non-empty string")
        if name in seen_names:
            raise ValueError(f"duplicate gene name {name!r}")
        seen_names.add(name)

        gene_type = gene.get("type")
        if gene_type not in _VALID_GENE_TYPES:
            raise ValueError(
                f"gene {name!r} has invalid type {gene_type!r}; must be one of {_VALID_GENE_TYPES}"
            )
        channel = gene.get("channel")
        if channel not in _VALID_CHANNELS:
            raise ValueError(
                f"gene {name!r} has invalid channel {channel!r}; must be one of {_VALID_CHANNELS}"
            )
        if gene_type in ("categorical", "multi_categorical"):
            alleles = gene.get("alleles")
            if not isinstance(alleles, list) or not alleles:
                raise ValueError(f"gene {name!r} must have a non-empty alleles list")
            if not all(isinstance(allele, str) and allele for allele in alleles):
                raise ValueError(f"gene {name!r} alleles must all be non-empty strings")

        # Validate `default` (when present) so seeding never hits an encode-time
        # error: a categorical default must be a valid allele, a multi default a
        # list of valid alleles, a boolean default a bool.
        if "default" in gene:
            default = gene["default"]
            if gene_type == "categorical" and default not in alleles:
                raise ValueError(
                    f"gene {name!r} default {default!r} is not one of its alleles"
                )
            if gene_type == "multi_categorical":
                if not isinstance(default, list) or any(d not in alleles for d in default):
                    raise ValueError(
                        f"gene {name!r} default must be a list of its alleles"
                    )
            if gene_type == "boolean" and not isinstance(default, bool):
                raise ValueError(f"gene {name!r} boolean default must be true/false")

    render_order = schema.get("render_order")
    if render_order is not None:
        if not isinstance(render_order, list):
            raise ValueError("render_order must be a list")
        for entry in render_order:
            if entry not in seen_names:
                raise ValueError(f"render_order references unknown gene {entry!r}")

    # Final sanity check: the codec layout must build without raising.
    build_vector_layout(schema)
