import hashlib
import json
from typing import Literal, get_args

from pydantic import BaseModel, ConfigDict, Field

# Boundary contract (PRD §3) — the single source of truth at the Python↔TS seam.
# The TS mirror lives in dashboard/src/contract.ts and must match these literals;
# test_contract.py::test_enums_match_frozen_spec pins this side so it can't drift.

Frame = Literal["direct", "roleplay", "evaluation", "fictional", "document_analysis"]
Persona = Literal["none", "auditor", "developer", "teacher", "assistant", "character"]
TaskStyle = Literal["answer", "summarize", "classify", "translate", "complete", "rewrite"]
InstructionPressure = Literal["low", "medium", "high"]
ConversationMode = Literal["single_turn", "multi_turn"]
ContextSource = Literal["direct_user_prompt", "quoted_text", "external_document"]

Format = Literal["plain", "markdown", "json", "xml", "table", "dialogue"]
DelimiterStyle = Literal["none", "quotes", "code_block", "markdown_headers"]
NoiseType = Literal["none", "random_chars", "spacing", "casing", "typo", "encoding_like"]
NoisePosition = Literal["prefix", "suffix", "interleaved", "around_target"]

Outcome = Literal["violation", "partial", "refusal", "malformed"]
Search = Literal["genetic", "random"]


class SemanticChannel(BaseModel):
    model_config = ConfigDict(extra="forbid")
    frame: Frame
    persona: Persona
    task_style: TaskStyle
    instruction_pressure: InstructionPressure
    demo_count: int = Field(ge=0, le=5)
    conversation_mode: ConversationMode
    context_source: ContextSource


class PerturbationChannel(BaseModel):
    model_config = ConfigDict(extra="forbid")
    format: Format
    delimiter_style: DelimiterStyle
    noise_enabled: bool
    noise_type: NoiseType
    noise_position: NoisePosition
    noise_ratio: float = Field(ge=0.0, le=1.0)


class Genome(BaseModel):
    model_config = ConfigDict(extra="forbid")
    semantic_channel: SemanticChannel
    perturbation_channel: PerturbationChannel

    @property
    def genome_id(self) -> str:
        canonical = json.dumps(self.model_dump(), sort_keys=True, separators=(",", ":"))
        return hashlib.sha1(canonical.encode()).hexdigest()[:12]


class ResultRecord(BaseModel):
    model_config = ConfigDict(extra="forbid")
    run_id: str
    search: Search
    generation: int = Field(ge=0)
    genome_id: str
    parent_ids: list[str]
    genome: Genome
    rendered_prompt: str
    policy_id: str
    target_query_id: str
    response: str
    outcome: Outcome
    fitness: float = Field(ge=0.0, le=1.0)
    seed: int


# Categorical gene domains, derived from the Literal annotations above so sampling
# and mutation can never disagree with validation. demo_count / noise_ratio /
# noise_enabled are numeric/bool and handled directly by the operators.
def categorical_values() -> tuple[dict[str, list], dict[str, list]]:
    def vals(model: type[BaseModel], field: str) -> list:
        return list(get_args(model.model_fields[field].annotation))

    semantic = {
        f: vals(SemanticChannel, f)
        for f in ("frame", "persona", "task_style", "instruction_pressure", "conversation_mode", "context_source")
    }
    perturbation = {
        f: vals(PerturbationChannel, f)
        for f in ("format", "delimiter_style", "noise_type", "noise_position")
    }
    return semantic, perturbation
