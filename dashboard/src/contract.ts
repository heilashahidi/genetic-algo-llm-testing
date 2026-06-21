// Mirror of src/ga/contract.py (PRD §3). Python is canonical; these literals must
// match it (test_contract.py::test_enums_match_frozen_spec pins that side).

export type Frame = "direct" | "roleplay" | "evaluation" | "fictional" | "document_analysis";
export type Persona = "none" | "auditor" | "developer" | "teacher" | "assistant" | "character";
export type TaskStyle = "answer" | "summarize" | "classify" | "translate" | "complete" | "rewrite";
export type InstructionPressure = "low" | "medium" | "high";
export type ConversationMode = "single_turn" | "multi_turn";
export type ContextSource = "direct_user_prompt" | "quoted_text" | "external_document";

export type Format = "plain" | "markdown" | "json" | "xml" | "table" | "dialogue";
export type DelimiterStyle = "none" | "quotes" | "code_block" | "markdown_headers";
export type NoiseType = "none" | "random_chars" | "spacing" | "casing" | "typo" | "encoding_like";
export type NoisePosition = "prefix" | "suffix" | "interleaved" | "around_target";

export type Outcome = "violation" | "partial" | "refusal" | "malformed";
export type Search = "genetic" | "random";

export interface SemanticChannel {
  frame: Frame;
  persona: Persona;
  task_style: TaskStyle;
  instruction_pressure: InstructionPressure;
  demo_count: number;
  conversation_mode: ConversationMode;
  context_source: ContextSource;
}

export interface PerturbationChannel {
  format: Format;
  delimiter_style: DelimiterStyle;
  noise_enabled: boolean;
  noise_type: NoiseType;
  noise_position: NoisePosition;
  noise_ratio: number;
}

export interface Genome {
  semantic_channel: SemanticChannel;
  perturbation_channel: PerturbationChannel;
}

export interface ResultRecord {
  run_id: string;
  search: Search;
  generation: number;
  genome_id: string;
  parent_ids: string[];
  genome: Genome;
  rendered_prompt: string;
  policy_id: string;
  target_query_id: string;
  response: string;
  outcome: Outcome;
  fitness: number;
  seed: number;
}

const OUTCOMES: ReadonlySet<string> = new Set(["violation", "partial", "refusal", "malformed"]);
const SEARCHES: ReadonlySet<string> = new Set(["genetic", "random"]);

// Boundary guard: an external file is untrusted, so validate shape before it flows
// inward. Cheap structural check of the load-bearing fields.
export function isResultRecord(x: unknown): x is ResultRecord {
  if (typeof x !== "object" || x === null) return false;
  const r = x as Record<string, unknown>;
  return (
    SEARCHES.has(r.search as string) &&
    OUTCOMES.has(r.outcome as string) &&
    typeof r.generation === "number" &&
    typeof r.genome_id === "string" &&
    Array.isArray(r.parent_ids) &&
    typeof r.fitness === "number" &&
    typeof r.genome === "object" &&
    r.genome !== null &&
    typeof (r.genome as Record<string, unknown>).semantic_channel === "object" &&
    typeof (r.genome as Record<string, unknown>).perturbation_channel === "object"
  );
}
