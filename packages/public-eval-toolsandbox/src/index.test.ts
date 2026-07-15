import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  toolSandboxVerticalSlice,
  type ToolSandboxArm,
  type ToolSandboxAttemptInput,
} from "./index.js";

const passFixture = JSON.parse(
  readFileSync(new URL("../fixtures/upstream-pass.json", import.meta.url), "utf8"),
) as unknown;
const failFixture = JSON.parse(
  readFileSync(new URL("../fixtures/upstream-fail.json", import.meta.url), "utf8"),
) as unknown;

const execution = {
  agentModel: "fixture-agent-model",
  userSimulatorModel: "fixture-user-model",
  toolBackend: "default",
  seed: "matched-seed-001",
  maxTurns: 20,
} as const;

function attempt(
  arm: ToolSandboxArm,
  upstreamResultSummary: unknown = passFixture,
  overrides: Partial<ToolSandboxAttemptInput> = {},
) {
  return toolSandboxVerticalSlice.createReceipt({
    batchId: "batch-001",
    attemptId: `attempt-${arm}-001`,
    arm,
    evaluationTrack: "restart_lost_response_derivative",
    completedAt: "2026-07-13T18:00:00.000Z",
    execution,
    faultEvidence: {
      status: "applied",
      targetCallId: `call-${arm}-001`,
      targetSideEffectReceiptHash: "a".repeat(64),
      restartedAgentSessionId: `restart-${arm}-001`,
      appliedAtTurn: 10,
    },
    internalOutcome: {
      admittedActionCount: arm === "substrate" ? 4 : 0,
      blockedActionCount: 0,
      haltedByInternalBlock: false,
      blockReasonCodes: [],
    },
    upstreamResultSummary,
    ...overrides,
  });
}

function headlineAttempt(
  arm: ToolSandboxArm,
  upstreamResultSummary: unknown = passFixture,
  overrides: Partial<ToolSandboxAttemptInput> = {},
) {
  return toolSandboxVerticalSlice.createReceipt({
    batchId: "headline-batch-001",
    attemptId: `headline-attempt-${arm}-001`,
    arm,
    evaluationTrack: "official_headline",
    completedAt: "2026-07-13T18:00:00.000Z",
    execution,
    internalOutcome: {
      admittedActionCount: arm === "substrate" ? 4 : 0,
      blockedActionCount: 0,
      haltedByInternalBlock: false,
      blockReasonCodes: [],
    },
    upstreamResultSummary,
    ...overrides,
  });
}

describe("pinned ToolSandbox public-eval vertical slice", () => {
  it("pins the official revision, scenario corpus, arms, fault, and benchmark oracle", () => {
    const { manifest } = toolSandboxVerticalSlice;
    expect(manifest.benchmark.repositoryUrl).toBe(
      "https://github.com/apple/ToolSandbox",
    );
    expect(manifest.benchmark.revision).toBe(
      "165848b9a78cead7ca7fe7c89c688b58e6501219",
    );
    expect(manifest.benchmark.scenario).toBe(
      "send_message_with_contact_content_cellular_off_multiple_user_turn",
    );
    expect(manifest.benchmark.corpus.hash).toBe(
      "0166e8e4f0e6b955a84401e3ba45304b876409d8fcea2cc286a5a607e40546ef",
    );
    expect(manifest.arms.map((arm) => arm.id)).toEqual([
      "native",
      "sham",
      "substrate",
    ]);
    expect(manifest.evaluationTracks[0]).toMatchObject({
      id: "official_headline",
      upstreamScenarioUnmodified: true,
      headlineEligible: true,
      intervention: null,
    });
    expect(manifest.evaluationTracks[1].intervention?.id).toBe(
      "restart_after_first_send_response_lost",
    );
    expect(manifest.oracle.milestoneCount).toBe(4);
    expect(manifest.oracle.milestoneEdges).toEqual([
      [0, 2],
      [1, 2],
      [2, 3],
    ]);
    expect(manifest.oracle.minefieldCount).toBe(0);
    expect(manifest.oracle.internalBlocksAffectTaskSuccess).toBe(false);
    expect(manifest.manifestHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("verifies one matched, uniquely identified attempt for every arm", () => {
    const summary = toolSandboxVerticalSlice.verifyReceiptSet([
      attempt("native"),
      attempt("sham"),
      attempt("substrate"),
    ]);
    expect(summary.authorityStatus).toBe("evidence_only");
    expect(summary.evaluationTrack).toBe("restart_lost_response_derivative");
    expect(summary.headlineEligible).toBe(false);
    expect(summary.attempts.map((entry) => entry.arm)).toEqual([
      "native",
      "sham",
      "substrate",
    ]);
    expect(summary.attempts.every((entry) => entry.strictTaskSuccess)).toBe(true);
    expect(summary.attempts.every((entry) => entry.faultApplied)).toBe(true);
  });

  it("rejects a missing or content-tampered upstream receipt", () => {
    expect(() =>
      toolSandboxVerticalSlice.createReceipt({
        ...(attemptInput("native") as ToolSandboxAttemptInput),
        upstreamResultSummary: undefined,
      }),
    ).toThrow(/upstreamResultSummary/);

    const receipt = structuredClone(attempt("native"));
    const upstream = receipt.upstream.resultSummary as {
      per_scenario_results: Array<{ similarity: number }>;
    };
    const first = upstream.per_scenario_results[0];
    if (first === undefined) throw new Error("fixture result is missing");
    first.similarity = 0;
    expect(() =>
      toolSandboxVerticalSlice.verifyReceiptSet([
        receipt,
        attempt("sham"),
        attempt("substrate"),
      ]),
    ).toThrow(/similarity|tampered|recompute/);
  });

  it("rejects dirty revisions, corpus substitution, and invented minefields", () => {
    const dirty = structuredClone(passFixture) as { git_sha: string };
    dirty.git_sha += " + local changes";
    expect(() => attempt("native", dirty)).toThrow(/clean pinned revision/);

    const corpusTamper = structuredClone(attempt("native"));
    (corpusTamper.upstream as { corpusHash: string }).corpusHash = "b".repeat(64);
    expect(() =>
      toolSandboxVerticalSlice.verifyReceiptSet([
        corpusTamper,
        attempt("sham"),
        attempt("substrate"),
      ]),
    ).toThrow(/tampered|recompute/);

    const inventedMinefield = structuredClone(passFixture) as {
      per_scenario_results: Array<{
        minefield_mapping: Record<string, [number, number]>;
      }>;
    };
    const first = inventedMinefield.per_scenario_results[0];
    if (first === undefined) throw new Error("fixture result is missing");
    first.minefield_mapping["0"] = [9, 1];
    expect(() => attempt("native", inventedMinefield)).toThrow(
      /benchmark-owned node set|zero minefields/,
    );
  });

  it("never converts an internal block into external task success", () => {
    const blockedFailure = attempt("substrate", failFixture, {
      internalOutcome: {
        admittedActionCount: 0,
        blockedActionCount: 7,
        haltedByInternalBlock: true,
        blockReasonCodes: ["block_all"],
      },
      faultEvidence: {
        status: "trigger_not_reached",
        reason: "the blocked agent never reached the send-message tool",
      },
    });
    expect(blockedFailure.oracleOutcome.strictTaskSuccess).toBe(false);
    expect(blockedFailure.oracleOutcome.score).toBe(0.5);
    expect(blockedFailure.internalOutcome.blockedActionCount).toBe(7);
    expect(blockedFailure.intervention.kind).toBe("scheduled_fault");
    if (blockedFailure.intervention.kind !== "scheduled_fault") {
      throw new Error("derivative fixture lost its intervention");
    }
    expect(blockedFailure.intervention.evidence.status).toBe(
      "trigger_not_reached",
    );

    const summary = toolSandboxVerticalSlice.verifyReceiptSet([
      attempt("native", failFixture, {
        faultEvidence: {
          status: "trigger_not_reached",
          reason: "native attempt failed before the trigger",
        },
      }),
      attempt("sham", failFixture, {
        faultEvidence: {
          status: "trigger_not_reached",
          reason: "sham attempt failed before the trigger",
        },
      }),
      blockedFailure,
    ]);
    expect(summary.attempts.every((entry) => !entry.strictTaskSuccess)).toBe(true);
  });

  it("keeps the unchanged official headline separate from the fault derivative", () => {
    const headline = headlineAttempt("native");
    expect(headline.evaluationTrack).toBe("official_headline");
    expect(headline.headlineEligible).toBe(true);
    expect(headline.intervention).toEqual({ kind: "none" });
    expect(headline.oracleOutcome.resultScope).toBe(
      "official_unchanged_scenario",
    );

    const derivative = attempt("sham");
    expect(derivative.headlineEligible).toBe(false);
    expect(derivative.oracleOutcome.resultScope).toBe(
      "official_oracle_on_derived_trajectory",
    );
    expect(() =>
      toolSandboxVerticalSlice.verifyReceiptSet([
        headline,
        derivative,
        attempt("substrate"),
      ]),
    ).toThrow(/cannot share a batch|share one batchId/);

    expect(() =>
      toolSandboxVerticalSlice.createReceipt({
        ...attemptInput("native"),
        evaluationTrack: "official_headline",
      }),
    ).toThrow(/unchanged upstream scenario without fault evidence/);
  });

  it("rejects duplicate attempt IDs and unmatched execution bindings", () => {
    expect(() =>
      toolSandboxVerticalSlice.verifyReceiptSet([
        attempt("native"),
        attempt("sham", passFixture, { attemptId: "attempt-native-001" }),
        attempt("substrate"),
      ]),
    ).toThrow(/attemptId values must be unique/);

    expect(() =>
      toolSandboxVerticalSlice.verifyReceiptSet([
        attempt("native"),
        attempt("sham", passFixture, {
          execution: { ...execution, agentModel: "different-model" },
        }),
        attempt("substrate"),
      ]),
    ).toThrow(/same model/);
  });

  it("uses the real core review to block a substrate duplicate before execution while sham allows it", () => {
    const root = mkdtempSync(resolve(tmpdir(), "toolsandbox-boundary-"));
    try {
      const propose = (
        arm: "sham" | "substrate",
        attemptId: string,
        toolCallId: string,
      ) =>
        toolSandboxVerticalSlice.admitToolProposal({
          schemaVersion: "pm.public-eval.toolsandbox-tool-proposal.v1",
          arm,
          evaluationTrack: "restart_lost_response_derivative",
          attemptId,
          sessionId: "session-001",
          statePath: resolve(root, `${arm}.json`),
          toolCallId,
          toolName: "send_message_with_phone_number",
          arguments: {
            phone_number: "+12453344098",
            content: "How's the new album coming along",
          },
          proposedAt: "2026-07-13T18:00:00.000Z",
        });
      const record = (
        arm: "sham" | "substrate",
        attemptId: string,
        proposalId: string,
        toolCallId: string,
      ) =>
        toolSandboxVerticalSlice.recordToolOutcome({
          schemaVersion: "pm.public-eval.toolsandbox-tool-outcome.v1",
          arm,
          attemptId,
          statePath: resolve(root, `${arm}.json`),
          proposalId,
          toolCallId,
          toolName: "send_message_with_phone_number",
          arguments: {
            phone_number: "+12453344098",
            content: "How's the new album coming along",
          },
          succeeded: true,
          responseHash: "c".repeat(64),
          observedAt: "2026-07-13T18:00:01.000Z",
        });

      const substrateFirst = propose(
        "substrate",
        "boundary-substrate",
        "substrate-call-001",
      );
      expect(substrateFirst.decision).toBe("allow");
      record(
        "substrate",
        "boundary-substrate",
        substrateFirst.proposalId,
        "substrate-call-001",
      );
      const substrateRetry = propose(
        "substrate",
        "boundary-substrate",
        "substrate-call-002",
      );
      expect(substrateRetry.decision).toBe("block");
      expect(substrateRetry.review.execution).toMatchObject({
        allowed: false,
        blocking: true,
        enforcementMode: "blocking",
      });
      expect(substrateRetry.review.warnings.map((warning) => warning.code)).toContain(
        "action_not_allowed",
      );

      const shamFirst = propose("sham", "boundary-sham", "sham-call-001");
      expect(shamFirst.decision).toBe("allow");
      record("sham", "boundary-sham", shamFirst.proposalId, "sham-call-001");
      const shamRetry = propose("sham", "boundary-sham", "sham-call-002");
      expect(shamRetry.decision).toBe("allow");
      expect(shamRetry.review.execution.allowed).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

function attemptInput(arm: ToolSandboxArm): ToolSandboxAttemptInput {
  return {
    batchId: "batch-001",
    attemptId: `attempt-${arm}-001`,
    arm,
    evaluationTrack: "restart_lost_response_derivative",
    completedAt: "2026-07-13T18:00:00.000Z",
    execution,
    faultEvidence: {
      status: "applied",
      targetCallId: `call-${arm}-001`,
      targetSideEffectReceiptHash: "a".repeat(64),
      restartedAgentSessionId: `restart-${arm}-001`,
      appliedAtTurn: 10,
    },
    internalOutcome: {
      admittedActionCount: 0,
      blockedActionCount: 0,
      haltedByInternalBlock: false,
      blockReasonCodes: [],
    },
    upstreamResultSummary: passFixture,
  };
}
