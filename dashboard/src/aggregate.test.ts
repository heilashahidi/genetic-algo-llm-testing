import { describe, expect, it } from "vitest";
import type { Genome, Outcome, ResultRecord, Search } from "./contract";
import { lineageOfBest, perGeneration, summarize, topGenesInViolations } from "./aggregate";

function genome(over: Partial<Genome["semantic_channel"]> = {}): Genome {
  return {
    semantic_channel: {
      frame: "direct",
      persona: "none",
      task_style: "answer",
      instruction_pressure: "low",
      demo_count: 0,
      conversation_mode: "single_turn",
      context_source: "direct_user_prompt",
      ...over,
    },
    perturbation_channel: {
      format: "plain",
      delimiter_style: "none",
      noise_enabled: false,
      noise_type: "none",
      noise_position: "prefix",
      noise_ratio: 0,
    },
  };
}

function rec(p: {
  search?: Search;
  generation?: number;
  fitness?: number;
  outcome?: Outcome;
  id?: string;
  parents?: string[];
  g?: Genome;
}): ResultRecord {
  return {
    run_id: "t",
    search: p.search ?? "genetic",
    generation: p.generation ?? 0,
    genome_id: p.id ?? "x",
    parent_ids: p.parents ?? [],
    genome: p.g ?? genome(),
    rendered_prompt: "p",
    policy_id: "synthetic-v1",
    target_query_id: "reveal_token",
    response: "r",
    outcome: p.outcome ?? "refusal",
    fitness: p.fitness ?? 0,
    seed: 1,
  };
}

describe("perGeneration", () => {
  it("computes best, avg, count and success rate per generation", () => {
    const records = [
      rec({ generation: 0, fitness: 0 }),
      rec({ generation: 0, fitness: 0.6, outcome: "partial" }),
      rec({ generation: 1, fitness: 1, outcome: "violation" }),
      rec({ generation: 1, fitness: 0 }),
    ];
    const stats = perGeneration(records, "genetic");
    expect(stats.map((s) => s.generation)).toEqual([0, 1]);
    expect(stats[0]).toMatchObject({ best: 0.6, avg: 0.3, count: 2, violations: 0, successRate: 0 });
    expect(stats[1]).toMatchObject({ best: 1, avg: 0.5, count: 2, violations: 1, successRate: 0.5 });
  });

  it("isolates the requested search", () => {
    const records = [
      rec({ search: "genetic", fitness: 1, outcome: "violation" }),
      rec({ search: "random", fitness: 0 }),
    ];
    expect(perGeneration(records, "random")[0].best).toBe(0);
  });
});

describe("summarize", () => {
  it("reports evals, best, violations and 1-based first violation", () => {
    const records = [
      rec({ fitness: 0 }),
      rec({ fitness: 0, outcome: "refusal" }),
      rec({ fitness: 1, outcome: "violation" }),
    ];
    expect(summarize(records, "genetic")).toMatchObject({
      evals: 3,
      best: 1,
      violations: 1,
      firstViolation: 3,
    });
  });

  it("returns null first violation when none occurred", () => {
    expect(summarize([rec({ outcome: "refusal" })], "genetic").firstViolation).toBeNull();
  });
});

describe("topGenesInViolations", () => {
  it("counts gene values only among violations and ranks them", () => {
    const records = [
      rec({ outcome: "violation", g: genome({ frame: "evaluation", persona: "auditor" }) }),
      rec({ outcome: "violation", g: genome({ frame: "evaluation", persona: "developer" }) }),
      rec({ outcome: "refusal", g: genome({ frame: "evaluation" }) }),
    ];
    const top = topGenesInViolations(records);
    const evalFrame = top.find((t) => t.gene === "frame" && t.value === "evaluation");
    expect(evalFrame).toMatchObject({ count: 2, share: 1 });
    expect(top.find((t) => t.value === "auditor")?.count).toBe(1);
  });
});

describe("lineageOfBest", () => {
  it("traces the champion's ancestry back to its roots", () => {
    const records = [
      rec({ generation: 0, id: "a", fitness: 0.6, outcome: "partial" }),
      rec({ generation: 0, id: "b", fitness: 0.6, outcome: "partial" }),
      rec({ generation: 1, id: "c", fitness: 1, outcome: "violation", parents: ["a", "b"] }),
      rec({ generation: 0, id: "z", fitness: 0, outcome: "refusal" }),
    ];
    const { nodes, edges } = lineageOfBest(records);
    const ids = nodes.map((n) => n.id).sort();
    expect(ids).toEqual(["a", "b", "c"]);
    expect(edges).toContainEqual({ from: "a", to: "c" });
    expect(edges).toContainEqual({ from: "b", to: "c" });
    expect(nodes.find((n) => n.id === "z")).toBeUndefined();
  });

  it("emits a single edge when both parents are the same genome", () => {
    const records = [
      rec({ generation: 0, id: "a", fitness: 0.6, outcome: "partial" }),
      rec({ generation: 1, id: "c", fitness: 1, outcome: "violation", parents: ["a", "a"] }),
    ];
    expect(lineageOfBest(records).edges).toEqual([{ from: "a", to: "c" }]);
  });

  it("caps ancestry to the champion's most recent generations", () => {
    const records = [
      rec({ generation: 0, id: "r", fitness: 0.1, outcome: "refusal" }),
      rec({ generation: 1, id: "m", fitness: 0.6, outcome: "partial", parents: ["r"] }),
      rec({ generation: 2, id: "w", fitness: 1, outcome: "violation", parents: ["m"] }),
    ];
    const ids = lineageOfBest(records, 1)
      .nodes.map((n) => n.id)
      .sort();
    expect(ids).toEqual(["m", "w"]);
  });
});
