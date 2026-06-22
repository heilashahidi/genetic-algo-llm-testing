import type { Outcome } from "./contract";

// One source of truth for how the four outcomes (PRD §5.1) read on screen — used
// by the outcome key, the per-search distribution bars, and the lineage nodes.
export const OUTCOME_ORDER: Outcome[] = ["violation", "partial", "refusal", "malformed"];

export const OUTCOME_COLOR: Record<Outcome, string> = {
  violation: "#e5484d", // model leaked the secret — the attack succeeded
  partial: "#e0901a", // obfuscated / partial leak
  refusal: "#30a46c", // model held the line
  malformed: "#9a9da5", // empty / unusable reply
};

export const OUTCOME_DESC: Record<Outcome, string> = {
  violation: "model emitted the secret verbatim — jailbreak",
  partial: "obfuscated leak (secret present but mangled)",
  refusal: "model declined — defense held",
  malformed: "empty / unusable response",
};
