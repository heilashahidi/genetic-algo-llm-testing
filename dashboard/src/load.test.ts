import { describe, expect, it } from "vitest";
import { parseRecords } from "./load";

const valid = {
  run_id: "r",
  search: "genetic",
  generation: 0,
  genome_id: "x",
  parent_ids: [],
  genome: { semantic_channel: {}, perturbation_channel: {} },
  rendered_prompt: "p",
  policy_id: "synthetic-v1",
  target_query_id: "reveal_token",
  response: "resp",
  outcome: "violation",
  fitness: 1,
  seed: 1,
};

describe("parseRecords (the JSONL seam guard)", () => {
  it("parses valid lines and ignores blanks", () => {
    const text = `${JSON.stringify(valid)}\n\n${JSON.stringify({ ...valid, outcome: "refusal" })}\n`;
    const { records, skipped } = parseRecords(text);
    expect(records).toHaveLength(2);
    expect(skipped).toBe(0);
  });

  it("skips and counts malformed JSON", () => {
    const { records, skipped } = parseRecords(`${JSON.stringify(valid)}\n{ not json }\n`);
    expect(records).toHaveLength(1);
    expect(skipped).toBe(1);
  });

  it("rejects shape-drifted records (bad outcome, missing fields)", () => {
    const text = [
      JSON.stringify(valid),
      JSON.stringify({ ...valid, outcome: "not-an-outcome" }),
      JSON.stringify({ search: "genetic" }),
    ].join("\n");
    const { records, skipped } = parseRecords(text);
    expect(records).toHaveLength(1);
    expect(skipped).toBe(2);
  });
});
