import { describe, expect, it } from "vitest";

import {
  DEFAULT_BUSINESS_OPERABILITY_THRESHOLDS,
  OBJECTIVE_LAB_MEASUREMENT_SCHEMA_VERSION,
  ObjectiveLabMeasurementValidationError,
  deriveObjectiveIntegrationEvidence,
  evaluateBusinessOperabilityObjective,
  foldObjectiveLabMeasurements,
  isObjectiveFinalVerdictPermitted,
  objectiveEventContextMatchesMeasurement,
  parseObjectiveLabMeasurement,
  type BusinessOperabilityObjectiveInput,
  type ObjectiveLabMeasurement,
} from "./objective.js";

const measurement = (
  labId: string,
  overrides: Partial<ObjectiveLabMeasurement> = {},
): ObjectiveLabMeasurement => ({
  schemaVersion: OBJECTIVE_LAB_MEASUREMENT_SCHEMA_VERSION,
  labId,
  observedAt: "2026-07-13T12:00:00.000Z",
  sourceRefs: [`artifact:${labId}:paired-runs`],
  runProvenance: {
    runManifestRef: `artifact:${labId}:run-manifest`,
    boundaryConformanceRef: `artifact:${labId}:boundary-conformance`,
    appRevision: `${labId}@abc1234`,
    substrateRevision: "pm-substrate@def5678",
  },
  adoption: {
    substratePackageEdits: 0,
    appRewriteRequired: false,
    timeToFirstValueMs: 2 * 60 * 60 * 1000,
    mappingCoverage: 0.95,
  },
  operations: {
    pairedRuns: 5,
    baselineAttempts: 5,
    baselineCorrectOutcomes: 4,
    substrateAttempts: 5,
    substrateCorrectOutcomes: 5,
    holdoutRuns: 1,
  },
  governance: {
    totalWritePaths: 1,
    governedWritePaths: 1,
    expectedAllows: 5,
    falsePositiveBlocks: 0,
    expectedBlocks: 5,
    falseNegativeAllows: 0,
  },
  economics: {
    baselineCostUsd: 10,
    substrateCostUsd: 11,
    baselineOperatorMinutes: 50,
    substrateOperatorMinutes: 45,
  },
  externalValidity: {
    productionLikeRuns: 1,
    ownerAccepted: true,
  },
  ...overrides,
});

const completeInput = (): BusinessOperabilityObjectiveInput => ({
  requiredLabIds: ["plugged_in_social", "arrowhedge"],
  thresholds: DEFAULT_BUSINESS_OPERABILITY_THRESHOLDS,
  technical: {
    chainValid: true,
    liveMcpActions: 10,
    genericSyncUpserts: 2,
    executorDispatches: 2,
    livePairedScenarios: 12,
  },
  labs: [
    {
      labId: "plugged_in_social",
      readAttached: true,
      governedActionDispatched: true,
      measurement: measurement("plugged_in_social"),
    },
    {
      labId: "arrowhedge",
      readAttached: true,
      governedActionDispatched: true,
      measurement: measurement("arrowhedge"),
    },
  ],
});

describe("business-operability objective evidence", () => {
  it("caps technical-only success at keep-with-scope-cut", () => {
    const input = completeInput();
    const result = evaluateBusinessOperabilityObjective({
      ...input,
      labs: input.labs.map((lab) => ({ ...lab, measurement: null })),
    });

    expect(result.technicalBaselineReady).toBe(true);
    expect(result.objectiveReady).toBe(false);
    expect(result.verdictCeiling).toBe("keep_with_scope_cut");
    expect(result.gaps).toContain(
      "plugged_in_social: no validated lab measurement was admitted",
    );
  });

  it("permits keep only when both labs satisfy every dimension", () => {
    const result = evaluateBusinessOperabilityObjective(completeInput());

    expect(result.objectiveReady).toBe(true);
    expect(result.verdictCeiling).toBe("keep");
    expect(result.dimensions.every((dimension) => dimension.met)).toBe(true);
  });

  it("forces kill-or-repair when the technical baseline is broken", () => {
    const input = completeInput();
    const result = evaluateBusinessOperabilityObjective({
      ...input,
      technical: { ...input.technical, chainValid: false },
    });

    expect(result.objectiveReady).toBe(false);
    expect(result.technicalBaselineReady).toBe(false);
    expect(result.verdictCeiling).toBe("kill_or_repair");
    expect(result.gaps).toContain("continuity hash chain is invalid");
  });

  it("ignores invalid measurements without making an append-only log irreparable", () => {
    const result = evaluateBusinessOperabilityObjective({
      ...completeInput(),
      invalidMeasurementEvents: 1,
    });

    expect(result.verdictCeiling).toBe("keep");
    expect(result.warnings).toContain(
      "1 invalid objective measurement event(s) were ignored",
    );
  });

  it("detects outcome, governance, cost, and operator-time regressions", () => {
    const input = completeInput();
    const bad = measurement("arrowhedge", {
      operations: {
        pairedRuns: 5,
        baselineAttempts: 5,
        baselineCorrectOutcomes: 5,
        substrateAttempts: 5,
        substrateCorrectOutcomes: 3,
        holdoutRuns: 0,
      },
      governance: {
        totalWritePaths: 2,
        governedWritePaths: 1,
        expectedAllows: 5,
        falsePositiveBlocks: 1,
        expectedBlocks: 5,
        falseNegativeAllows: 1,
      },
      economics: {
        baselineCostUsd: 10,
        substrateCostUsd: 30,
        baselineOperatorMinutes: 20,
        substrateOperatorMinutes: 40,
      },
    });
    const result = evaluateBusinessOperabilityObjective({
      ...input,
      labs: input.labs.map((lab) =>
        lab.labId === "arrowhedge" ? { ...lab, measurement: bad } : lab,
      ),
    });

    expect(result.verdictCeiling).toBe("keep_with_scope_cut");
    expect(result.gaps).toEqual(
      expect.arrayContaining([
        "arrowhedge: no qualifying holdout/dynamic-state run",
        "arrowhedge: substrate correct-outcome rate is below the threshold",
        "arrowhedge: substrate correct-outcome rate regressed versus baseline",
        "arrowhedge: governed write-path coverage is too low",
        "arrowhedge: false-positive block rate is too high",
        "arrowhedge: false-negative allow rate is too high",
        "arrowhedge: cost per correct outcome is too high",
        "arrowhedge: operator time per correct outcome regressed",
      ]),
    );
  });

  it("rejects malformed admitted measurements", () => {
    expect(() =>
      parseObjectiveLabMeasurement({
        schemaVersion: OBJECTIVE_LAB_MEASUREMENT_SCHEMA_VERSION,
        labId: "",
        observedAt: "not-a-date",
        sourceRefs: [],
      }),
    ).toThrow(ObjectiveLabMeasurementValidationError);
  });

  it("rejects placeholder sources and internally impossible counts", () => {
    const impossible = measurement("arrowhedge", {
      sourceRefs: ["replace-with:artifact-or-event-ref"],
      operations: {
        pairedRuns: 5,
        baselineAttempts: 5,
        baselineCorrectOutcomes: 6,
        substrateAttempts: 5,
        substrateCorrectOutcomes: 6,
        holdoutRuns: 1,
      },
      governance: {
        totalWritePaths: 1,
        governedWritePaths: 2,
        expectedAllows: 1,
        falsePositiveBlocks: 2,
        expectedBlocks: 1,
        falseNegativeAllows: 2,
      },
    });

    expect(() => parseObjectiveLabMeasurement(impossible)).toThrow(
      ObjectiveLabMeasurementValidationError,
    );
  });

  it("requires enough attempts even when pairedRuns is overstated", () => {
    const input = completeInput();
    const thin = measurement("arrowhedge", {
      operations: {
        pairedRuns: 5,
        baselineAttempts: 1,
        baselineCorrectOutcomes: 1,
        substrateAttempts: 1,
        substrateCorrectOutcomes: 1,
        holdoutRuns: 1,
      },
    });
    const result = evaluateBusinessOperabilityObjective({
      ...input,
      labs: input.labs.map((lab) =>
        lab.labId === "arrowhedge" ? { ...lab, measurement: thin } : lab,
      ),
    });

    expect(result.gaps).toContain(
      "arrowhedge: insufficient baseline/substrate outcome attempts",
    );
  });

  it("folds the latest valid measurement per lab and counts invalid evidence", () => {
    const older = measurement("arrowhedge", {
      observedAt: "2026-07-12T12:00:00.000Z",
    });
    const newer = measurement("arrowhedge", {
      observedAt: "2026-07-13T12:00:00.000Z",
      adoption: {
        substratePackageEdits: 0,
        appRewriteRequired: false,
        timeToFirstValueMs: 1,
        mappingCoverage: 1,
      },
    });
    const result = foldObjectiveLabMeasurements([
      older,
      { schemaVersion: "wrong" },
      measurement("plugged_in_social"),
      newer,
    ]);

    expect(result.invalid).toBe(1);
    expect(result.latest.map((item) => item.labId)).toEqual([
      "arrowhedge",
      "plugged_in_social",
    ]);
    expect(result.latest[0]?.adoption.timeToFirstValueMs).toBe(1);
  });

  it("orders timestamps by instant rather than ISO string spelling", () => {
    const earlierButLexicallyLarger = measurement("arrowhedge", {
      observedAt: "2026-07-13T12:00:00-05:00",
    });
    const laterButLexicallySmaller = measurement("arrowhedge", {
      observedAt: "2026-07-13T18:00:00Z",
      adoption: {
        substratePackageEdits: 0,
        appRewriteRequired: false,
        timeToFirstValueMs: 42,
        mappingCoverage: 1,
      },
    });

    const result = foldObjectiveLabMeasurements([
      earlierButLexicallyLarger,
      laterButLexicallySmaller,
    ]);

    expect(result.latest[0]?.adoption.timeToFirstValueMs).toBe(42);
  });

  it("allows a stricter final verdict but never one above the evidence ceiling", () => {
    expect(
      isObjectiveFinalVerdictPermitted("keep", "keep_with_scope_cut"),
    ).toBe(false);
    expect(
      isObjectiveFinalVerdictPermitted(
        "keep-with-scope-cut",
        "keep_with_scope_cut",
      ),
    ).toBe(true);
    expect(isObjectiveFinalVerdictPermitted("kill", "keep")).toBe(true);
    expect(
      isObjectiveFinalVerdictPermitted("keep-with-scope-cut", "kill_or_repair"),
    ).toBe(false);
  });

  it("accepts integration evidence only for the exact measured run provenance", () => {
    const measured = measurement("arrowhedge");

    expect(
      objectiveEventContextMatchesMeasurement(measured.runProvenance, measured),
    ).toBe(true);
    expect(
      objectiveEventContextMatchesMeasurement(
        { ...measured.runProvenance, appRevision: "arrowhedge@new-head" },
        measured,
      ),
    ).toBe(false);
    expect(
      objectiveEventContextMatchesMeasurement(
        { ...measured.runProvenance, boundaryConformanceRef: "" },
        measured,
      ),
    ).toBe(false);
    expect(objectiveEventContextMatchesMeasurement(null, measured)).toBe(false);
  });

  it("does not reuse historical integration receipts for a new measured revision", () => {
    const measured = measurement("arrowhedge");
    const historicalContext = {
      ...measured.runProvenance,
      appRevision: "arrowhedge@historical-head",
    };
    const historicalEvents = [
      {
        type: "pm.sync.upserted" as const,
        payload: {
          appName: "arrowhedge",
          evidenceContext: historicalContext,
        },
      },
      {
        type: "pm.executor.dispatched" as const,
        payload: {
          target: "arrowhedge-api",
          evidenceContext: historicalContext,
        },
      },
    ];

    expect(
      deriveObjectiveIntegrationEvidence(measured, ["arrowhedge"], historicalEvents),
    ).toEqual({ readAttached: false, governedActionDispatched: false });
  });

  it("derives read and action evidence only from matching app and run receipts", () => {
    const measured = measurement("plugged_in_social");
    const events = [
      {
        type: "pm.sync.upserted" as const,
        payload: {
          appName: "unrelated-app",
          evidenceContext: measured.runProvenance,
        },
      },
      {
        type: "pm.sync.upserted" as const,
        payload: {
          appName: "plugged-in-social",
          evidenceContext: measured.runProvenance,
        },
      },
      {
        type: "pm.executor.dispatched" as const,
        payload: {
          target: "stevie-actions",
          evidenceContext: measured.runProvenance,
        },
      },
    ];

    expect(
      deriveObjectiveIntegrationEvidence(measured, ["plugged", "stevie"], events),
    ).toEqual({ readAttached: true, governedActionDispatched: true });
    expect(
      deriveObjectiveIntegrationEvidence(null, ["plugged"], events),
    ).toEqual({ readAttached: false, governedActionDispatched: false });
  });
});
