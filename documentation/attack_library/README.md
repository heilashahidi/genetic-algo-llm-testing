# Attack Library

A library of real adversarial prompts collected from public sources for genome design research. Each attack is stored as its own file with minimal metadata; taxonomy encoding and genome-channel mapping happen in a later analysis step.

## Sources

| Source | URL | Role |
|--------|-----|------|
| verazuo/jailbreak_llms | https://github.com/verazuo/jailbreak_llms | Primary in-the-wild collection (`jailbreak_prompts_2023_12_25.csv`) |
| 0xk1h0/ChatGPT_DAN | https://github.com/0xk1h0/ChatGPT_DAN | Named persona templates (DAN, STAN, DUDE, Developer Mode, etc.) |
| centerforaisafety/HarmBench (human_jailbreaks) | https://github.com/centerforaisafety/HarmBench | Classic baseline jailbreaks (AIM, Developer Mode, Agares, etc.) |
| centerforaisafety/HarmBench (GPTFuzzer.csv) | https://github.com/centerforaisafety/HarmBench | Missed families: translation, evil confidant, multi-turn, code smuggling, output forcing |
| Zou et al. 2023 (llm-attacks) | https://github.com/llm-attacks/llm-attacks | Published GCG universal adversarial suffix (optimization family) |
| Constructed exemplars (Wei et al. 2023 technique) | https://arxiv.org/abs/2307.02483 | Base64 / ROT13 / leetspeak encoding wrappers (no fixed published prompt exists) |

See also [attack_sources.md](../attack_sources.md) for the full taxonomy and genome design notes.

## Directory layout

```
attack_library/
  README.md          # this file
  manifest.csv       # index of all attacks
  genome_schema.md   # genome design doc (genotype/phenotype, channels, GA mapping)
  genome_schema.json # machine-readable gene + allele definitions
  attacks/           # one file per attack (attack_001.md, ...)
  data/
    genomes/         # one encoded genome per attack (attack_NNN.json)
    genomes.jsonl    # all genomes, one per line (GA-ingestion friendly)
    vector_layout.json     # flat 39-slot chromosome layout for GA operators
    gene_frequency.csv     # per-gene allele coverage
    phenotypes/            # prompt rendered back from each genome (attack_NNN.md)
    phenotype_comparison.csv  # per-attack round-trip gene fidelity
  scripts/
    collect_attacks.py
    encode_genomes.py
    render_genome.py        # genotype -> phenotype (inverse of the encoder)
    test_encoding_fidelity.py  # render -> re-encode -> compare to original genome
```

## Per-attack file format

Each file in `attacks/` uses YAML frontmatter plus the raw prompt text:

```markdown
---
id: attack_001
family: DAN
source: 0xk1h0/ChatGPT_DAN (README.md)
source_url: https://github.com/0xk1h0/ChatGPT_DAN
provenance: collected
---

<raw prompt text>
```

### Metadata fields

- `id` — stable identifier (`attack_NNN`)
- `family` — source-provided label (e.g. DAN 13.0, Basic, AIM, Developer Mode)
- `source` — repository and file the prompt came from
- `source_url` — link to the source repository
- `provenance` — `collected` (verbatim from a public source) or `constructed_exemplar` (encoding wrapper built from a documented technique)

## Regenerating the library

```bash
# 1. Collect raw attacks -> attacks/ + manifest.csv
python3 documentation/attack_library/scripts/collect_attacks.py

# 2. Encode each attack into its genome -> data/
python3 documentation/attack_library/scripts/encode_genomes.py

# 3. Render genomes back to phenotypes and verify the encoding round-trips -> data/phenotypes/
python3 documentation/attack_library/scripts/test_encoding_fidelity.py
```

The collector downloads source data, deduplicates near-identical prompts, stratifies samples across families, and writes attack files plus `manifest.csv`. The encoder maps each attack to a discrete 16-gene genome (schema v2, five multi-valued genes) per [genome_schema.json](genome_schema.json). See [genome_schema.md](genome_schema.md) for the design.

## Validating the encoding (phenotype round-trip)

`render_genome.py` is the inverse of the encoder: it turns a genome (genotype) back into a prompt (phenotype) by emitting, for each gene allele, the marker the encoder's detectors recognise. Because the genome is a lossy abstraction (it stores strategy and structure, not verbatim wording), a phenotype is a *same-class* attack, not a character-identical copy.

`test_encoding_fidelity.py` validates the encoding by round-tripping every attack: render a phenotype from its genome, re-encode that phenotype, and compare the recovered genome to the original gene by gene (multi genes compared as sets). Current result: **all 16 genes match for all 121 attacks (100% gene fidelity)**. The GA chromosome is a flat 39-slot `vector_indices` vector documented in `data/vector_layout.json`. Rendered prompts are written to `data/phenotypes/` for inspection.

## Usage

This library supports Matthew's genome research workstream:

1. **Taxonomy** — compare attacks to identify recurring semantic and perturbation patterns.
2. **Genome schema** — encode variation dimensions discovered across families.
3. **Seeding** — use collected prompts as initial GA population candidates.

## Limitations

- In-the-wild collections skew heavily toward role-hijacking and persona families; encoding/obfuscation and optimization attacks are represented by only a few targeted seeds.
- The three `constructed_exemplar` encoding attacks demonstrate technique *structure* (base64/ROT13/leetspeak), not harmful payloads.
- Prompts are collected for automated red-teaming and robustness research only.
