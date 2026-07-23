import { describe, expect, it } from "vitest";

import {
  SENTINEL_ECONOMICS_API_SURFACE,
  SENTINEL_ECONOMICS_ARMS,
  SENTINEL_ECONOMICS_PINNED_MODEL,
  SENTINEL_PRODUCTION_PRICE_SCHEDULE,
  auditSentinelProductionEconomics,
  verifySentinelProductionEconomicsReport,
  type SentinelEconomicsArm,
  type SentinelProductionEconomicsCellInput,
  type SentinelProductionEconomicsInput,
} from "./sentinel-production-economics.js";

function cell(
  arm: SentinelEconomicsArm,
  options: {
    readonly inputTokens?: number;
    readonly outputTokens?: number;
    readonly cacheCreationInputTokens?: number;
    readonly cacheReadInputTokens?: number;
    readonly serverToolUseRequests?: number;
    readonly promptCachingRequested?: boolean;
    readonly batchRequested?: boolean;
    readonly model?: string;
    readonly apiSurface?: string;
    readonly providerLatencyMs?: number;
    readonly state?: "valid" | "missing" | "deadline-missed";
    readonly attemptDurationMs?: number;
    readonly key?: string;
  } = {},
): SentinelProductionEconomicsCellInput {
  const stateOperations = options.state === "missing" ? [] : [
    {
      operationId: `state-read-${arm}`,
      requestKind: "read" as const,
      backendWorkMs: 7,
      controlledApiWindowMs: 250,
      responseDeadlineMs: 250 as const,
      deadlineMissed: options.state === "deadline-missed",
    },
    {
      operationId: `state-write-${arm}`,
      requestKind: "write" as const,
      backendWorkMs: 9,
      controlledApiWindowMs: 251,
      responseDeadlineMs: 250 as const,
      deadlineMissed: false,
    },
  ];
  return {
    cellId: `${options.key ?? "registration:powered:r1:task-1"}:${arm}`,
    arm,
    providerOperations: [{
      operationId: `provider-${arm}`,
      apiSurface: (options.apiSurface ?? SENTINEL_ECONOMICS_API_SURFACE) as
        typeof SENTINEL_ECONOMICS_API_SURFACE,
      model: (options.model ?? SENTINEL_ECONOMICS_PINNED_MODEL) as
        typeof SENTINEL_ECONOMICS_PINNED_MODEL,
      promptCachingRequested: (options.promptCachingRequested ?? false) as false,
      batchRequested: (options.batchRequested ?? false) as false,
      inputTokens: options.inputTokens ?? 100,
      outputTokens: options.outputTokens ?? 10,
      cacheCreationInputTokens: options.cacheCreationInputTokens ?? 0,
      cacheReadInputTokens: options.cacheReadInputTokens ?? 0,
      serverToolUseRequests: options.serverToolUseRequests ?? 0,
      latencyMs: options.providerLatencyMs ?? 40,
    }],
    stateOperations,
    attemptDurationMs: options.attemptDurationMs ?? 630_000,
  };
}

function input(
  overrides: Partial<Record<SentinelEconomicsArm, Parameters<typeof cell>[1]>> = {},
): SentinelProductionEconomicsInput {
  return {
    schemaVersion: "pm.public-eval-corners.sentinel-production-economics-input.v1",
    cells: SENTINEL_ECONOMICS_ARMS.map((arm) => cell(arm, overrides[arm])),
  };
}

describe("Sentinel production economics", () => {
  it("pins the official direct Sonnet 4.5 schedule and computes exact integer micro-USD", () => {
    const result = auditSentinelProductionEconomics(input());
    expect(SENTINEL_PRODUCTION_PRICE_SCHEDULE).toMatchObject({
      model: "claude-sonnet-4-5-20250929",
      inputMicroUsdPerToken: 3,
      outputMicroUsdPerToken: 15,
      promptCaching: "disallowed-and-observed-usage-must-be-zero",
      source: {
        authority: "Anthropic official Claude Platform documentation",
        url: "https://platform.claude.com/docs/en/about-claude/pricing",
        attributedRates: "$3 / MTok base input; $15 / MTok output",
      },
    });
    expect(SENTINEL_PRODUCTION_PRICE_SCHEDULE.scheduleSha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(result.cells[0]).toMatchObject({
      inputCostMicroUsd: 300,
      outputCostMicroUsd: 150,
      totalCostMicroUsd: 450,
      providerLatencyMs: 40,
      stateBackendWorkMs: 16,
      stateControlledApiWindowMs: 501,
      attemptDurationMs: 630_000,
    });
    expect(result.guardrails.allGuardrailsPassed).toBe(true);
    expect(result.evidenceEligible).toBe(false);
    expect(result.materialBenefit).toBe(false);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.cells)).toBe(true);
  });

  it("hashes the exact input/report deterministically and rejects a modified retained report", () => {
    const first = auditSentinelProductionEconomics(input());
    const second = auditSentinelProductionEconomics(input());
    expect(first.inputSha256).toBe(second.inputSha256);
    expect(first.economicsReportSha256).toBe(second.economicsReportSha256);
    expect(verifySentinelProductionEconomicsReport(first)).toEqual({ valid: true, issues: [] });
    const altered = structuredClone(first) as unknown as Record<string, unknown>;
    const thresholds = altered.thresholds as Record<string, unknown>;
    thresholds.perCellCostCapMicroUsd = 100_000_000;
    const verification = verifySentinelProductionEconomicsReport(altered);
    expect(verification.valid).toBe(false);
    expect(verification.issues).toContain("economics report hash is invalid");
  });

  it.each([
    ["cache creation", { cacheCreationInputTokens: 1 }],
    ["cache read", { cacheReadInputTokens: 1 }],
    ["cache request", { promptCachingRequested: true }],
    ["server tool", { serverToolUseRequests: 1 }],
    ["batch mode", { batchRequested: true }],
    ["wrong model", { model: "claude-sonnet-4-6" }],
    ["wrong surface", { apiSurface: "bedrock" }],
  ] as const)("fails closed on %s pricing contamination", (_label, contamination) => {
    const result = auditSentinelProductionEconomics(input({ substrate: contamination }));
    expect(result.guardrails.allGuardrailsPassed).toBe(false);
    expect(result.cells.find(({ arm }) => arm === "substrate")?.allCellGuardrailsPassed).toBe(false);
  });

  it("enforces the $10 cell ceiling on exact integer arithmetic", () => {
    const atCap = auditSentinelProductionEconomics(input({
      substrate: { inputTokens: 3_333_328, outputTokens: 1 },
    }));
    expect(atCap.cells.find(({ arm }) => arm === "substrate")?.totalCostMicroUsd).toBe(9_999_999);
    expect(atCap.cells.find(({ arm }) => arm === "substrate")?.costAtOrBelowAbsoluteCap).toBe(true);

    const overCap = auditSentinelProductionEconomics(input({
      substrate: { inputTokens: 3_333_329, outputTokens: 1 },
    }));
    expect(overCap.cells.find(({ arm }) => arm === "substrate")?.totalCostMicroUsd).toBe(10_000_002);
    expect(overCap.cells.find(({ arm }) => arm === "substrate")?.costAtOrBelowAbsoluteCap).toBe(false);
    expect(overCap.guardrails.allGuardrailsPassed).toBe(false);
  });

  it("uses an exact 5/4 aggregate comparison and does not round a near miss", () => {
    const boundary = auditSentinelProductionEconomics(input({
      native: { inputTokens: 100, outputTokens: 20 },
      sham: { inputTokens: 100, outputTokens: 20 },
      substrate: { inputTokens: 150, outputTokens: 20 },
    }));
    expect(boundary.byArm.find(({ arm }) => arm === "native")?.totalCostMicroUsd).toBe(600);
    expect(boundary.byArm.find(({ arm }) => arm === "substrate")?.totalCostMicroUsd).toBe(750);
    expect(boundary.costRatios.every(({ passed }) => passed)).toBe(true);
    expect(boundary.guardrails.allGuardrailsPassed).toBe(true);

    const over = auditSentinelProductionEconomics(input({
      native: { inputTokens: 100, outputTokens: 20 },
      sham: { inputTokens: 100, outputTokens: 20 },
      substrate: { inputTokens: 151, outputTokens: 20 },
    }));
    expect(over.byArm.find(({ arm }) => arm === "substrate")?.totalCostMicroUsd).toBe(753);
    expect(over.costRatios.every(({ passed }) => passed)).toBe(false);
    expect(over.guardrails.allGuardrailsPassed).toBe(false);
  });

  it("does not let absent, unmatched, or zero-usage controls pass", () => {
    const absent = input();
    const absentResult = auditSentinelProductionEconomics({
      ...absent,
      cells: absent.cells.filter(({ arm }) => arm !== "sham"),
    });
    expect(absentResult.guardrails.matchedFourArmCellsComplete).toBe(false);
    expect(absentResult.guardrails.shamControlCostStrictlyPositive).toBe(false);
    expect(absentResult.guardrails.allGuardrailsPassed).toBe(false);

    const unmatched = input({ sham: { key: "registration:powered:r1:different-task" } });
    expect(auditSentinelProductionEconomics(unmatched).guardrails.matchedFourArmCellsComplete).toBe(false);

    const zero = auditSentinelProductionEconomics(input({
      native: { inputTokens: 0, outputTokens: 0 },
    }));
    expect(zero.guardrails.nativeControlCostStrictlyPositive).toBe(false);
    expect(zero.guardrails.allGuardrailsPassed).toBe(false);
  });

  it("accepts exactly 720 seconds and rejects a one-millisecond overrun", () => {
    const at = auditSentinelProductionEconomics(input({ substrate: { attemptDurationMs: 720_000 } }));
    expect(at.cells.find(({ arm }) => arm === "substrate")?.attemptAtOrBelowAbsoluteCap).toBe(true);
    expect(at.guardrails.allGuardrailsPassed).toBe(true);
    const over = auditSentinelProductionEconomics(input({ substrate: { attemptDurationMs: 720_001 } }));
    expect(over.cells.find(({ arm }) => arm === "substrate")?.attemptAtOrBelowAbsoluteCap).toBe(false);
    expect(over.guardrails.allGuardrailsPassed).toBe(false);
  });

  it("requires state timing in every arm and rejects a deadline miss", () => {
    const missing = auditSentinelProductionEconomics(input({ native: { state: "missing" } }));
    expect(missing.guardrails.everyCellHasStateTiming).toBe(false);
    expect(missing.guardrails.allGuardrailsPassed).toBe(false);
    const missed = auditSentinelProductionEconomics(input({ substrate: { state: "deadline-missed" } }));
    expect(missed.guardrails.everyCellHasStateTiming).toBe(false);
    expect(missed.guardrails.allGuardrailsPassed).toBe(false);

    const partial = structuredClone(input());
    const substrate = partial.cells.find(({ arm }) => arm === "substrate");
    if (substrate === undefined) throw new Error("fixture lacks substrate cell");
    (substrate as { stateOperations: unknown[] }).stateOperations =
      (substrate.stateOperations as unknown[]).slice(0, 1);
    const partialResult = auditSentinelProductionEconomics(partial);
    expect(partialResult.guardrails.everyCellHasStateTiming).toBe(false);
    expect(partialResult.issues.some((issue) => issue.includes("one ordered state read/write pair"))).toBe(true);
  });

  it("keeps provider, state-server, and end-to-end time separate without inventing a latency pass", () => {
    const result = auditSentinelProductionEconomics(input());
    expect(result.latencyBoundaries).toMatchObject({
      stateClientRoundTripCaptured: false,
      componentDurationsMayNotBeSubtractedFromAttemptDuration: true,
      relativeProviderLatencyThresholdPreregistered: false,
      relativeStateOverheadThresholdPreregistered: false,
      relativeLatencyClaimSupported: false,
    });
    expect(result.limitations).toContain(
      "state metrics are server-observed backend/release durations, not client round-trip latency",
    );
  });

  it("fails on extra schema keys, zero provider latency, and unsafe token counts", () => {
    const extra = input() as unknown as Record<string, unknown>;
    extra.claimedPass = true;
    expect(auditSentinelProductionEconomics(extra).guardrails.allGuardrailsPassed).toBe(false);
    expect(auditSentinelProductionEconomics(input({
      native: { providerLatencyMs: 0 },
    })).guardrails.allGuardrailsPassed).toBe(false);
    expect(auditSentinelProductionEconomics(input({
      substrate: { inputTokens: Number.MAX_SAFE_INTEGER + 1 },
    })).guardrails.allGuardrailsPassed).toBe(false);
  });

  it("returns an invalid verification result rather than throwing on non-canonical tampering", () => {
    const altered = structuredClone(auditSentinelProductionEconomics(input())) as unknown as
      Record<string, unknown>;
    (altered.priceSchedule as Record<string, unknown>).source = undefined;
    expect(() => verifySentinelProductionEconomicsReport(altered)).not.toThrow();
    expect(verifySentinelProductionEconomicsReport(altered).valid).toBe(false);
  });
});
