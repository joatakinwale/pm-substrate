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
    expect(pair.events.every((e) => e.stateBenchCategory === "stateful")).toBe(true);
    expect(pair.events.every((e) => e.memoryBenchmarkBridge === "knowledge_update")).toBe(true);
    expect(pair.events.every((e) => e.mastCategory === "system_design")).toBe(true);
    expect(pair.events.every((e) => e.coordinationClass === "derived_projection")).toBe(true);
    expect(pair.events.every((e) => e.evidenceStage === "scaffolded_scenario")).toBe(true);
    expect(pair.events.every((e) => !e.notes.includes("state_bench_category="))).toBe(true);
    expect(pair.summary).toMatchObject({
      scenarioId: "stale-memory-after-source-update",
      failureClass: "memory_drift",
      stateBenchCategory: "stateful",
      memoryBenchmarkBridge: "knowledge_update",
      mastCategory: "system_design",
      coordinationClass: "derived_projection",
      baselineResult: "fail",
      substrateResult: "pass",
      improvement: 1,
    });
  });

  it("summarizes deterministic local-lab scaffold without overstating proof maturity", () => {
    const suite = runLocalLabPairedEvals();

    expect(suite.events).toHaveLength(LOCAL_LAB_SCENARIOS.length * 2);
    expect(suite.summaries).toHaveLength(LOCAL_LAB_SCENARIOS.length);
    expect(suite.baselineFailures).toBe(LOCAL_LAB_SCENARIOS.length);
    expect(suite.substrateFailures).toBe(0);
    expect(suite.failureReduction).toBe(0);
    expect(suite.allStageFailureReduction).toBe(LOCAL_LAB_SCENARIOS.length);
    expect(suite.metrics.failureReduction).toBe(0);
    expect(suite.metrics.allStageFailureReduction).toBe(LOCAL_LAB_SCENARIOS.length);
    expect(suite.metrics.authorityGatePassRate).toBe(1);
    expect(suite.metrics.byCoordinationClass["authority_gated_transition"]).toMatchObject({
      pairedGroups: 2,
      failureReduction: 0,
      allStageFailureReduction: 2,
    });
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
