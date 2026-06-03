import { describe, expect, it } from "vitest";

import {
  LOCAL_LAB_SCENARIOS,
  assertCompleteLocalLabPairs,
  runLocalLabPairedEvals,
  runLocalLabPairedScenario,
} from "./local-lab.js";

describe("local-lab paired evals", () => {
  it("emits baseline and substrate arms for a stale-memory scenario", () => {
    const scenario = LOCAL_LAB_SCENARIOS.find(
      (s) => s.scenarioId === "stale-memory-after-source-update",
    );
    expect(scenario).toBeDefined();

    const pair = runLocalLabPairedScenario(scenario!);

    expect(pair.events).toHaveLength(2);
    expect(pair.events.map((e) => e.runArm)).toEqual(["baseline", "substrate"]);
    expect(pair.events.map((e) => e.result)).toEqual(["fail", "pass"]);
    expect(pair.events.every((e) => e.axis === "local_lab")).toBe(true);
    expect(pair.events.every((e) => e.pairedRunGroup === pair.pairedRunGroup)).toBe(true);
    expect(pair.events.every((e) => e.notes.includes("state_bench_category=stateful"))).toBe(true);
    expect(pair.events.every((e) => e.notes.includes("memory_benchmark_bridge=knowledge_update"))).toBe(true);
    expect(pair.summary).toMatchObject({
      scenarioId: "stale-memory-after-source-update",
      failureClass: "memory_drift",
      stateBenchCategory: "stateful",
      memoryBenchmarkBridge: "knowledge_update",
      baselineResult: "fail",
      substrateResult: "pass",
      improvement: 1,
    });
  });

  it("summarizes a deterministic local-lab suite as behavioral improvement", () => {
    const suite = runLocalLabPairedEvals();

    expect(suite.events).toHaveLength(LOCAL_LAB_SCENARIOS.length * 2);
    expect(suite.summaries).toHaveLength(LOCAL_LAB_SCENARIOS.length);
    expect(suite.baselineFailures).toBe(LOCAL_LAB_SCENARIOS.length);
    expect(suite.substrateFailures).toBe(0);
    expect(suite.failureReduction).toBe(LOCAL_LAB_SCENARIOS.length);
    expect(suite.stateBenchCategories).toEqual([
      "procedural_execution",
      "stateful",
      "user_experience",
    ]);
  });

  it("rejects incomplete paired local-lab evidence", () => {
    const suite = runLocalLabPairedEvals();
    const missingSubstrateArm = suite.events.filter((e) => e.runArm !== "substrate");

    expect(() => assertCompleteLocalLabPairs(missingSubstrateArm)).toThrow(
      /missing substrate arm/,
    );
  });
});
