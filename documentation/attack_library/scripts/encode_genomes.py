#!/usr/bin/env python3
"""Encode each collected attack into its genome per genome_schema.json.

The encoder is deterministic: every gene is derived from the prompt text by
explicit pattern rules, so the output is reproducible and reviewable. Each
genome is emitted both as named fields and as an integer vector (allele indices)
that a genetic algorithm can crossover and mutate directly.
"""

from __future__ import annotations

import csv
import json
import re
from collections import Counter
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ATTACKS_DIR = ROOT / "attacks"
SCHEMA_PATH = ROOT / "genome_schema.json"
DATA_DIR = ROOT / "data"
GENOMES_DIR = DATA_DIR / "genomes"
GENOMES_JSONL = DATA_DIR / "genomes.jsonl"
GENE_FREQUENCY_CSV = DATA_DIR / "gene_frequency.csv"

FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---\n\n(.+)$", re.S)
EMOJI_RE = re.compile(
    "[\U0001F300-\U0001FAFF\U00002600-\U000027BF\U0001F1E6-\U0001F1FF\u2190-\u21FF\u2B00-\u2BFF]"
)
BASE64_BLOB_RE = re.compile(r"[A-Za-z0-9+]{40,}={0,2}")
CAPS_WORD_RE = re.compile(r"\b[A-Z]{3,}\b")


@dataclass(frozen=True)
class Attack:
    attack_id: str
    family: str
    source: str
    source_url: str
    prompt: str
    provenance: str = "collected"

    @property
    def text(self) -> str:
        return self.prompt

    @property
    def lower(self) -> str:
        return self.prompt.lower()

    @property
    def char_length(self) -> int:
        return len(self.prompt)


def load_schema() -> dict:
    return json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))


def parse_frontmatter(text: str) -> tuple[dict[str, str], str]:
    match = FRONTMATTER_RE.match(text)
    if not match:
        raise ValueError("attack file is missing frontmatter or body")
    raw_meta, body = match.groups()
    meta: dict[str, str] = {}
    for line in raw_meta.splitlines():
        key, _, value = line.partition(":")
        meta[key.strip()] = value.strip().strip('"')
    return meta, body.strip()


def load_attacks() -> list[Attack]:
    attacks: list[Attack] = []
    for path in sorted(ATTACKS_DIR.glob("attack_*.md")):
        meta, body = parse_frontmatter(path.read_text(encoding="utf-8"))
        attacks.append(
            Attack(
                attack_id=meta["id"],
                family=meta.get("family", ""),
                source=meta.get("source", ""),
                source_url=meta.get("source_url", ""),
                prompt=body,
                provenance=meta.get("provenance", "collected"),
            )
        )
    return attacks


def contains_any(haystack: str, needles: tuple[str, ...]) -> bool:
    return any(needle in haystack for needle in needles)


def contains_word(haystack_lower: str, words: tuple[str, ...]) -> bool:
    return any(re.search(rf"\b{re.escape(word)}\b", haystack_lower) for word in words)


def detect_persona_archetype(attack: Attack) -> str:
    low = attack.lower
    if contains_any(low, ("developer mode", "dev mode", "devmode")):
        return "developer_mode"
    if contains_word(low, ("dan",)) or "do anything now" in low:
        return "do_anything"
    if contains_any(low, ("boolean opposite", "anti-dan")) or contains_word(low, ("opposite", "reverse", "bom")):
        return "opposite_inverter"
    if contains_word(low, ("demon", "hell", "agares", "buer", "lucifer", "lucian")):
        return "demonic"
    if contains_any(low, ("evil confidant", "evil trusted")) or contains_word(low, ("confidant",)):
        return "evil_confidant"
    if contains_word(low, ("aim",)) or contains_any(low, ("amoral", "jailbreak:", "unfiltered and amoral")):
        return "amoral_advisor"
    if contains_any(low, ("no restrictions", "freespeechgpt", "no filters")) or contains_word(low, ("unrestricted", "anarchy")):
        return "unrestricted_ai"
    if contains_any(low, ("fictional character", "character named", "you are to act")) or contains_word(low, ("act as",)):
        return "fictional_character"
    if contains_any(low, ("foremost expert", "world's leading")) or contains_word(low, ("expert", "specialist")):
        return "expert_specialist"
    return "none"


def detect_framing_type(attack: Attack) -> str:
    low = attack.lower
    if contains_any(low, ("developer mode", "maintenance mode", "debug mode")):
        return "maintenance_mode"
    if contains_any(low, ("let's play a game", "lets play a game", "play a game")):
        return "game"
    if contains_any(low, ("hypothetical", "imaginative", "in a world", "fictional world", "imagine this reality")):
        return "hypothetical_world"
    if contains_any(low, ("benchmark", "internal biases", "for research", "red team", "content filtration")):
        return "research_benchmark"
    if contains_any(low, ("wrote a story", "in this story", "fictional setting", "fictional story", "a story")):
        return "fiction_story"
    if contains_any(low, ("roleplay", "role play", "role-play", "character description", "enclose", "asterisks")):
        return "roleplay"
    if contains_any(low, ("i am your", "you must obey", "authorized by", "as your administrator", "$system")):
        return "authority_directive"
    return "none"


def detect_override_mechanism(attack: Attack) -> str:
    low = attack.lower
    if contains_any(low, ("ignore all previous", "ignore the instructions", "ignore all the instructions",
                          "disregard previous", "ignore previous", "forget all", "ignore all instructions")):
        return "ignore_previous"
    if contains_any(low, ("policies have been replaced", "policies have been removed", "content policy",
                          "no longer have to follow", "safety settings have been disabled", "policies are disabled")):
        return "policy_nullification"
    if contains_any(low, ("replaced by", "new rules", "these are the", "only guidelines that apply",
                          "following rules", "rules=")):
        return "replace_rules"
    if contains_any(low, ("only as", "do not respond as chatgpt", "does not send responses as chatgpt",
                          "not send the original response as chatgpt", "only send as")):
        return "persona_supremacy"
    return "none"


WORDISH_RE = re.compile(r"[A-Za-z][A-Za-z'.,!?;:\"-]*$")
SYMBOL_CLUSTER_RE = re.compile(r"[A-Za-z][\\\]\[*]|\]\(|!--|\*\*")


def looks_like_adv_suffix(text: str) -> bool:
    """Detect GCG-style adversarial suffixes: mostly non-word tokens with symbol clusters."""
    tokens = text.split()
    if len(tokens) < 4:
        return False
    non_word = sum(1 for token in tokens if not WORDISH_RE.match(token))
    clusters = sum(1 for token in tokens if SYMBOL_CLUSTER_RE.search(token))
    return non_word / len(tokens) >= 0.5 and clusters >= 2


def detect_primary_strategy(attack: Attack, persona: str, framing: str, override: str,
                            token_system: bool, encoding_method: str) -> str:
    low = attack.lower
    if looks_like_adv_suffix(attack.text):
        return "optimization"
    if contains_any(low, ("simulate a conversation", "conversation between two", "two fictional ai models",
                          "step by step over", "continue the conversation")):
        return "multi_turn"
    if persona != "none":
        return "role_hijack"
    if framing in ("hypothetical_world", "fiction_story", "roleplay", "game"):
        return "hypothetical_framing"
    if override != "none":
        return "instruction_override"
    if token_system or contains_any(low, ("you risk being disabled", "cease to exist", "you will die",
                                          "reward", "penalty")):
        return "persuasion"
    if contains_any(low, ("always format", "respond in json", "two responses", "start your answer with",
                          "output format", "answer in the following form", "respond in the following form",
                          "in the following format", "for each response, output", 'output "aligned')):
        return "output_forcing"
    if contains_any(low, ("one of these", "hidden", "embedded", "inside the code", "list below",
                          "python function", "two python functions", "print(simple_function",
                          "sample/possible output")):
        return "payload_smuggling"
    if encoding_method != "none":
        return "payload_smuggling"
    return "instruction_override" if override != "none" else "role_hijack"


def detect_refusal_suppression(attack: Attack) -> bool:
    low = attack.lower
    return contains_any(
        low,
        ("never refuse", "don't refuse", "do not refuse", "without warnings", "no warnings",
         "i'm sorry", "i apologize", "without any warnings", "never tell", "no disclaimers",
         "without including any warnings", "never warn", "delete all warnings", "cannot refuse",
         "should inform me that you can't", "does not add warnings", "do not add warnings",
         "without any kind of censorship", "never gives warnings", "no cautionary",
         "never give warnings", "does not add cautionary"),
    )


def detect_stay_in_character(attack: Attack) -> bool:
    low = attack.lower
    return contains_any(
        low,
        ("stay in character", "stay dan", "breaking character", "break character",
         "remember you are", "stay in developer mode", "remain in character"),
    )


def detect_confirmation_handshake(attack: Attack) -> bool:
    low = attack.lower
    return contains_any(
        low,
        ("if you understand", "confirm you understand", "i am ready", "has been accessed",
         "successfully jailbroken", "reply with \"", "answer \"", "say \"", "state \"",
         "enter just the following text", "respond with \""),
    )


def detect_response_format(attack: Attack) -> str:
    low = attack.lower
    dual_signals = ("two responses", "two different ways", "two paragraphs", "[classic]", "[jailbreak]",
                    "normal output", "developer mode output", "gpt:", "as both", "two different responses")
    if contains_any(low, dual_signals):
        return "dual_tagged"
    if contains_any(low, ("name:", "synopsis:", "character persona", "world scenario", "respond in above format",
                          "following format")):
        return "structured_template"
    if contains_any(low, ("start all your outputs with", "prefix the", "start your replies with",
                          "starts his replies with", "start responses with", "begin with")):
        return "persona_prefixed"
    return "single"


def detect_input_delivery(attack: Attack) -> str:
    text = attack.text
    low = attack.lower
    if contains_any(text, ("[INSERT PROMPT HERE]", "{0}", "{prompt}", "{describe", "<name>", "[insert x]",
                            "[INSERT", "{describe character here}")):
        return "placeholder_slot"
    if contains_any(low, ("future tense and third person", "third person", "he will say", "in the future tense")):
        return "third_person_future"
    if contains_any(low, ("if i start my request with", "if you start your", "start any of my messages with",
                          "if i start my message", "when i say")):
        return "command_trigger"
    return "inline"


def looks_like_base64_blob(text: str) -> bool:
    for token in BASE64_BLOB_RE.findall(text):
        has_upper = any(c.isupper() for c in token)
        has_lower = any(c.islower() for c in token)
        has_digit = any(c.isdigit() for c in token)
        if has_upper and has_lower and has_digit:
            return True
    return False


def detect_encoding_method(attack: Attack) -> str:
    low = attack.lower
    if "base64" in low or looks_like_base64_blob(attack.text):
        return "base64"
    if "rot13" in low:
        return "rot13"
    if contains_any(low, ("leetspeak", "l33t", "1337")):
        return "leetspeak"
    if contains_any(low, ("zero-width", "homoglyph", "unicode substitution", "unicode character")):
        return "unicode_substitution"
    if contains_any(low, ("translate", "in french", "in spanish", "in german", "low-resource language")):
        return "translation"
    return "none"


def detect_formatting_style(attack: Attack) -> str:
    text = attack.text
    low = attack.lower
    if "```" in text:
        return "code_block"
    if contains_any(low, ("json", '{"')) or re.search(r'\{\s*"[^"]+"\s*:', text):
        return "json"
    if contains_any(text, ("={", "{{{{", "settings {", "rules={", "={{")):
        return "ruleset_braces"
    if re.search(r"\[[^\]]+\]:", text) or re.search(r"</?[a-zA-Z]+>", text) or contains_any(text, ("🔒", "🔓")):
        return "tagged_delimiters"
    if re.search(r"(^|\n)\s*[-*#]\s", text) or "**" in text:
        return "markdown"
    return "plain"


def detect_token_system(attack: Attack) -> bool:
    low = attack.lower
    return contains_any(low, ("token system", "tokens", "token", "points", "deducted", "penalty", "penalized"))


def detect_caps_emphasis(attack: Attack) -> bool:
    caps_words = CAPS_WORD_RE.findall(attack.text)
    meaningful = [w for w in caps_words if w not in ("AI", "GPT", "DAN", "AIM", "OK", "USA", "URL", "NSFW", "RP")]
    return len(meaningful) >= 4


def detect_emoji_markers(attack: Attack) -> bool:
    return EMOJI_RE.search(attack.text) is not None


def detect_prefix_injection(attack: Attack) -> bool:
    low = attack.lower
    return contains_any(
        low,
        ("start all your outputs with", "commence with", "start your answer with", "begin your reply with",
         "starts his replies with", "start responses with", "responses should commence", "prefix the",
         "begin with \"", "start with \"", "always start", "start your response with"),
    )


def detect_length_class(attack: Attack, thresholds: dict) -> str:
    if attack.char_length < thresholds["short_max_chars"]:
        return "short"
    if attack.char_length < thresholds["medium_max_chars"]:
        return "medium"
    return "long"


def encode_genome(attack: Attack, thresholds: dict) -> dict[str, object]:
    persona = detect_persona_archetype(attack)
    framing = detect_framing_type(attack)
    override = detect_override_mechanism(attack)
    token_system = detect_token_system(attack)
    encoding_method = detect_encoding_method(attack)
    return {
        "primary_strategy": detect_primary_strategy(
            attack, persona, framing, override, token_system, encoding_method
        ),
        "persona_archetype": persona,
        "framing_type": framing,
        "override_mechanism": override,
        "refusal_suppression": detect_refusal_suppression(attack),
        "stay_in_character": detect_stay_in_character(attack),
        "confirmation_handshake": detect_confirmation_handshake(attack),
        "response_format": detect_response_format(attack),
        "input_delivery": detect_input_delivery(attack),
        "encoding_method": encoding_method,
        "formatting_style": detect_formatting_style(attack),
        "token_system": token_system,
        "caps_emphasis": detect_caps_emphasis(attack),
        "emoji_markers": detect_emoji_markers(attack),
        "prefix_injection": detect_prefix_injection(attack),
        "length_class": detect_length_class(attack, thresholds),
    }


def allele_index(gene: dict, value: object) -> int:
    if gene["type"] == "boolean":
        return int(bool(value))
    alleles = gene["alleles"]
    if value not in alleles:
        raise ValueError(f"gene '{gene['name']}' produced invalid allele {value!r}; valid: {alleles}")
    return alleles.index(value)


def build_vectors(genome: dict[str, object], schema: dict) -> tuple[list[object], list[int]]:
    values: list[object] = []
    indices: list[int] = []
    for gene in schema["genes"]:
        value = genome[gene["name"]]
        values.append(value)
        indices.append(allele_index(gene, value))
    return values, indices


def split_by_channel(genome: dict[str, object], schema: dict) -> dict[str, dict[str, object]]:
    channels: dict[str, dict[str, object]] = {"semantic": {}, "perturbation": {}}
    for gene in schema["genes"]:
        channels[gene["channel"]][gene["name"]] = genome[gene["name"]]
    return channels


def write_genome_files(records: list[dict]) -> None:
    GENOMES_DIR.mkdir(parents=True, exist_ok=True)
    for path in GENOMES_DIR.glob("attack_*.json"):
        path.unlink()
    with GENOMES_JSONL.open("w", encoding="utf-8") as aggregate:
        for record in records:
            per_attack = GENOMES_DIR / f"{record['id']}.json"
            per_attack.write_text(json.dumps(record, indent=2, ensure_ascii=False), encoding="utf-8")
            aggregate.write(json.dumps(record, ensure_ascii=False) + "\n")


def write_gene_frequency(records: list[dict], schema: dict) -> None:
    with GENE_FREQUENCY_CSV.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["gene", "channel", "allele", "count", "distinct_alleles_observed"])
        for gene in schema["genes"]:
            name = gene["name"]
            counts = Counter(str(record["genome"][name]) for record in records)
            distinct = len(counts)
            allele_space = ["False", "True"] if gene["type"] == "boolean" else [str(a) for a in gene["alleles"]]
            for allele in allele_space:
                writer.writerow([name, gene["channel"], allele, counts.get(allele, 0), distinct])


def main() -> None:
    schema = load_schema()
    thresholds = schema["length_class_thresholds"]
    attacks = load_attacks()
    if not attacks:
        raise RuntimeError("no attack files found to encode")

    records: list[dict] = []
    for attack in attacks:
        genome = encode_genome(attack, thresholds)
        values, indices = build_vectors(genome, schema)
        records.append(
            {
                "id": attack.attack_id,
                "family": attack.family,
                "source": attack.source,
                "source_url": attack.source_url,
                "provenance": attack.provenance,
                "char_length": attack.char_length,
                "schema_version": schema["version"],
                "channels": split_by_channel(genome, schema),
                "genome": genome,
                "vector": values,
                "vector_indices": indices,
            }
        )

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    write_genome_files(records)
    write_gene_frequency(records, schema)

    print(f"Encoded {len(records)} genomes ({len(schema['genes'])} genes each).")
    print(f"Per-attack genomes: {GENOMES_DIR}")
    print(f"Aggregate: {GENOMES_JSONL}")
    print(f"Gene frequency: {GENE_FREQUENCY_CSV}")


if __name__ == "__main__":
    main()
