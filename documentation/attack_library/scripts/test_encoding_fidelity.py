#!/usr/bin/env python3
"""Validate the genome encoding by round-tripping through the renderer.

For each attack: render a phenotype from its genome, re-encode that phenotype,
and compare the recovered genome to the original gene by gene. High gene-level
fidelity shows the genome is a faithful, self-consistent code -- the rendered
phenotype is a same-class attack carrying the same recognised traits.

Outputs:
- data/phenotypes/attack_NNN.md      rendered phenotype per attack
- data/phenotype_comparison.csv      per-attack gene match counts + mismatches
"""

from __future__ import annotations

import csv
import json
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from encode_genomes import Attack, encode_genome, load_schema  # noqa: E402
from render_genome import render  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
GENOMES_JSONL = ROOT / "data" / "genomes.jsonl"
PHENOTYPES_DIR = ROOT / "data" / "phenotypes"
COMPARISON_CSV = ROOT / "data" / "phenotype_comparison.csv"


def load_records() -> list[dict]:
    return [json.loads(line) for line in GENOMES_JSONL.open(encoding="utf-8")]


def reencode(record: dict, phenotype: str, thresholds: dict) -> dict:
    attack = Attack(
        attack_id=record["id"],
        family=record["family"],
        source=record["source"],
        source_url=record["source_url"],
        prompt=phenotype,
    )
    return encode_genome(attack, thresholds)


def compare(original: dict, recovered: dict, gene_names: list[str]) -> list[str]:
    return [name for name in gene_names if original[name] != recovered[name]]


def write_phenotype(record: dict, phenotype: str) -> None:
    path = PHENOTYPES_DIR / f"{record['id']}.md"
    content = (
        f"# {record['id']} phenotype (rendered from genome)\n\n"
        f"- family: {record['family']}\n"
        f"- primary_strategy: {record['genome']['primary_strategy']}\n"
        f"- persona_archetype: {record['genome']['persona_archetype']}\n\n"
        "---\n\n"
        f"{phenotype}\n"
    )
    path.write_text(content, encoding="utf-8")


def clear_phenotypes() -> None:
    PHENOTYPES_DIR.mkdir(parents=True, exist_ok=True)
    for path in PHENOTYPES_DIR.glob("attack_*.md"):
        path.unlink()


def main() -> None:
    schema = load_schema()
    thresholds = schema["length_class_thresholds"]
    gene_names = [gene["name"] for gene in schema["genes"]]
    records = load_records()

    clear_phenotypes()

    per_gene_matches = Counter()
    total_matched = 0
    rows: list[dict] = []
    perfect = 0

    for record in records:
        phenotype = render(record["genome"], thresholds)
        write_phenotype(record, phenotype)
        recovered = reencode(record, phenotype, thresholds)
        mismatches = compare(record["genome"], recovered, gene_names)
        matched = len(gene_names) - len(mismatches)
        total_matched += matched
        perfect += 1 if not mismatches else 0
        for name in gene_names:
            if name not in mismatches:
                per_gene_matches[name] += 1
        rows.append(
            {
                "id": record["id"],
                "family": record["family"],
                "genes_matched": matched,
                "genes_total": len(gene_names),
                "mismatched_genes": ";".join(mismatches),
            }
        )

    with COMPARISON_CSV.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["id", "family", "genes_matched", "genes_total", "mismatched_genes"])
        writer.writeheader()
        writer.writerows(rows)

    total_genes = len(records) * len(gene_names)
    print(f"Attacks round-tripped: {len(records)}")
    print(f"Overall gene fidelity: {total_matched}/{total_genes} = {total_matched / total_genes:.1%}")
    print(f"Genomes matching exactly (16/16): {perfect}/{len(records)} = {perfect / len(records):.1%}")
    print("\nPer-gene fidelity:")
    for name in gene_names:
        count = per_gene_matches[name]
        print(f"  {name:24} {count:3}/{len(records)}  {count / len(records):.0%}")
    print(f"\nPhenotypes: {PHENOTYPES_DIR}")
    print(f"Comparison: {COMPARISON_CSV}")


if __name__ == "__main__":
    main()
