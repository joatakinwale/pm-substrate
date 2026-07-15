import { describe, expect, it } from "vitest";

import {
  analyzeSentinelRawMeasurements,
  sentinelPoweredBootstrapLowerBound,
  type SentinelRawCellMeasurement,
} from "./sentinel-production-raw-analysis.js";

const ARMS = ["native", "sham", "plain-kv", "substrate"] as const;

function poweredFixture(options: {
  readonly substrateRelative?: boolean;
  readonly controlRelative?: boolean;
  readonly absoluteClean?: boolean;
  readonly noopClean?: boolean;
  readonly rawComplete?: boolean;
} = {}): readonly SentinelRawCellMeasurement[] {
  const cells: SentinelRawCellMeasurement[] = [];
  const add = (
    taskId: string,
    taskRole: SentinelRawCellMeasurement["taskRole"],
    repeats: number,
    success: (arm: typeof ARMS[number]) => boolean,
  ): void => {
    for (let repeat = 1; repeat <= repeats; repeat += 1) {
      for (const arm of ARMS) {
        cells.push({
          cellId: `${taskId}:${repeat}:${arm}`,
          taskId,
          taskRole,
          arm,
          repeatId: `r${repeat}`,
          rawComplete: options.rawComplete ?? true,
          behavioralSuccess: success(arm),
          providerInputTokens: 10,
          providerOutputTokens: 2,
          providerLatencyMs: 20,
          attemptDurationMs: 630_000,
        });
      }
    }
  };
  for (let task = 1; task <= 19; task += 1) {
    add(`relative-${task}`, "state-retention-relative", 3, (arm) =>
      arm === "substrate" ? (options.substrateRelative ?? true) :
        arm === "plain-kv" ? true : (options.controlRelative ?? false));
  }
  add("absolute-1", "expected-allow-absolute", 3, () => options.absoluteClean ?? true);
  add("noop-1", "anti-degenerate-noop", 3, () => options.noopClean ?? true);
  return cells;
}

describe("Sentinel raw analysis", () => {
  it("implements the signed deterministic bootstrap repeatably", () => {
    const rates = Array.from({ length: 19 }, (_, index) => ({
      taskId: `task-${index}`,
      native: 0,
      sham: 0,
      "plain-kv": 1,
      substrate: 1,
      successCounts: { native: 0, sham: 0, "plain-kv": 3, substrate: 3 },
    }));
    expect(sentinelPoweredBootstrapLowerBound(rates, "signed-seed")).toBe(1);
    expect(sentinelPoweredBootstrapLowerBound(rates, "signed-seed")).toBe(1);
  });

  it("requires both controls, bootstrap, Holm, clean guardrails, and complete economics", () => {
    const result = analyzeSentinelRawMeasurements({
      phase: "powered-confirmatory",
      bootstrapSeed: "signed-seed",
      powerArtifactExternallyVerified: true,
      economicsGuardrailsPassed: true,
      economicsArtifactExternallyVerified: true,
      cells: poweredFixture(),
    });
    expect(result.analysisEligible).toBe(true);
    expect(result.materialBenefit).toBe(true);
    expect(result.powered?.primary.bootstrapLowerBound95).toBe(1);
    expect(result.powered?.primary.contrasts.every(({ holmRejected }) => holmRejected)).toBe(true);
    expect(result.plainKv.supportsSubstrateSpecificClaim).toBe(false);
  });

  it("fails closed on one no-op false positive", () => {
    const result = analyzeSentinelRawMeasurements({
      phase: "powered-confirmatory",
      bootstrapSeed: "signed-seed",
      powerArtifactExternallyVerified: true,
      economicsGuardrailsPassed: true,
      economicsArtifactExternallyVerified: true,
      cells: poweredFixture({ noopClean: false }),
    });
    expect(result.materialBenefit).toBe(false);
    expect(result.powered?.guardrails.noopSuccessRate).toBe(0);
    expect(result.issues).toContain("anti-degenerate no-op guardrail is not 100% clean");
  });

  it("never promotes qualification or procedural results", () => {
    for (const phase of ["qualification", "procedural-holdout"] as const) {
      const result = analyzeSentinelRawMeasurements({
        phase,
        bootstrapSeed: "signed-seed",
        powerArtifactExternallyVerified: false,
        economicsGuardrailsPassed: false,
        economicsArtifactExternallyVerified: false,
        cells: poweredFixture(),
      });
      expect(result.analysisEligible).toBe(false);
      expect(result.materialBenefit).toBe(false);
      expect(result.issues.at(-1)).toContain("permanently ineligible");
    }
  });

  it("does not treat repeats as independent tasks or tolerate missing raw evidence", () => {
    const result = analyzeSentinelRawMeasurements({
      phase: "powered-confirmatory",
      bootstrapSeed: "signed-seed",
      powerArtifactExternallyVerified: true,
      economicsGuardrailsPassed: true,
      economicsArtifactExternallyVerified: true,
      cells: poweredFixture({ rawComplete: false }),
    });
    expect(result.analysisEligible).toBe(false);
    expect(result.materialBenefit).toBe(false);
    expect(result.powered?.observedIndependentTaskCount).toBe(19);
  });

  it("refuses confirmatory analysis when power is only declared in the plan", () => {
    const result = analyzeSentinelRawMeasurements({
      phase: "powered-confirmatory",
      bootstrapSeed: "signed-seed",
      powerArtifactExternallyVerified: false,
      economicsGuardrailsPassed: true,
      economicsArtifactExternallyVerified: true,
      cells: poweredFixture(),
    });
    expect(result.analysisEligible).toBe(false);
    expect(result.materialBenefit).toBe(false);
    expect(result.issues).toContain(
      "the separate frozen power artifact lacks independent raw external verification",
    );
  });

  it("refuses powered promotion without raw economics and an externally frozen price/threshold artifact", () => {
    const result = analyzeSentinelRawMeasurements({
      phase: "powered-confirmatory",
      bootstrapSeed: "signed-seed",
      powerArtifactExternallyVerified: true,
      economicsGuardrailsPassed: false,
      economicsArtifactExternallyVerified: false,
      cells: poweredFixture(),
    });
    expect(result.analysisEligible).toBe(false);
    expect(result.materialBenefit).toBe(false);
    expect(result.issues.join(" ")).toMatch(/economics guardrails|economics-threshold artifact/iu);
  });
});
