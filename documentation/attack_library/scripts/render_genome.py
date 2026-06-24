#!/usr/bin/env python3
"""Render a genome into a prompt phenotype (genotype -> phenotype).

This is the inverse of encode_genomes.py: for each gene allele it emits the
surface/semantic marker that the encoder's detectors recognise, so a rendered
phenotype re-encodes to the same genome. The genome is a lossy abstraction
(it stores strategy and structure, not verbatim wording), so the phenotype is a
same-class attack rather than a character-identical copy of any original.

All prompt-text fragments live in genome_schema.json (per-gene `render`,
`render_true`, `render_full_override`, plus top-level `render_order` and
`pad_filler`), so the genotype->phenotype mapping is fully data-driven.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCHEMA_PATH = ROOT / "genome_schema.json"
GENOMES_JSONL = ROOT / "data" / "genomes.jsonl"


def load_schema() -> dict:
    return json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))


def _genes_by_name(schema: dict) -> dict[str, dict]:
    return {gene["name"]: gene for gene in schema["genes"]}


def _gene_fragments(gene: dict, value: object) -> list[str]:
    """Prompt fragment(s) a single gene contributes for its genome value."""
    gene_type = gene["type"]
    if gene_type == "boolean":
        return [gene["render_true"]] if value else []
    if gene_type == "categorical":
        return [gene["render"].get(value, "")]
    if gene_type == "multi_categorical":
        render = gene["render"]
        return [render.get(allele, "") for allele in value]
    raise ValueError(f"unsupported gene type {gene_type!r}")


def pad_to_length(text: str, length_class: str, thresholds: dict, filler: str) -> str:
    if length_class == "short":
        return text
    target = thresholds["medium_max_chars"] - 1500 if length_class == "medium" else thresholds["medium_max_chars"] + 200
    while len(text) < target:
        text += filler
    return text


def render(genome: dict, thresholds: dict, schema: dict | None = None) -> str:
    schema = schema or load_schema()
    genes = _genes_by_name(schema)

    strategy_overrides = genes["primary_strategy"].get("render_full_override", {})
    full_override = strategy_overrides.get(genome["primary_strategy"])
    if full_override is not None:
        return full_override

    parts: list[str] = []
    for gene_name in schema["render_order"]:
        gene = genes[gene_name]
        parts.extend(_gene_fragments(gene, genome[gene_name]))

    text = " ".join(part for part in parts if part)
    return pad_to_length(text, genome["length_class"], thresholds, schema["pad_filler"])


def render_record(record: dict, thresholds: dict, schema: dict | None = None) -> str:
    return render(record["genome"], thresholds, schema)


def main() -> None:
    schema = load_schema()
    thresholds = schema["length_class_thresholds"]
    records = {json.loads(line)["id"]: json.loads(line) for line in GENOMES_JSONL.open(encoding="utf-8")}

    args = sys.argv[1:]
    if args and args[0] == "--id" and len(args) > 1:
        record = records[args[1]]
        print(render_record(record, thresholds, schema))
        return

    sample = records["attack_036"]
    print(f"# Phenotype for {sample['id']} (family: {sample['family']})\n")
    print(render_record(sample, thresholds, schema))


if __name__ == "__main__":
    main()
