import { describe, expect, it } from "vitest";
import { tenantId, timestamp, type EventId } from "@pm/types";
import {
  checkpointHash,
  verifyContinuityCheckpointChain,
  type ContinuityCheckpoint,
} from "./index.js";

const tenant = tenantId("tnt_continuity_verify");

function checkpoint(
  input: Omit<ContinuityCheckpoint, "contentHash">,
): ContinuityCheckpoint {
  return {
    ...input,
    contentHash: checkpointHash(input),
  };
}

describe("verifyContinuityCheckpointChain", () => {
  it("accepts a valid checkpoint hash chain", () => {
    const first = checkpoint({
      id: "chk_001",
      tenantId: tenant,
      agentId: "agent-axis-a",
      scope: "axis-a",
      kind: "decision",
      title: "AAPL risk gate",
      summary: "Risk gate accepted after fresh risk state.",
      evidenceEventIds: ["evt_risk" as EventId],
      decisionRefs: ["decision:dec_aapl_buy_120"],
      status: "open",
      payload: {},
      createdAt: timestamp("2026-06-03T14:00:00.000Z"),
      priorCheckpointHash: null,
    });
    const second = checkpoint({
      id: "chk_002",
      tenantId: tenant,
      agentId: "agent-axis-a",
      scope: "axis-a",
      kind: "work",
      title: "Terminal packet persisted",
      summary: "Action outcome envelope recorded for replay.",
      evidenceEventIds: ["evt_decision" as EventId],
      decisionRefs: ["action_outcome:aoe_dec_aapl_buy_120"],
      status: "open",
      payload: {},
      createdAt: timestamp("2026-06-03T14:01:00.000Z"),
      priorCheckpointHash: first.contentHash,
    });

    expect(
      verifyContinuityCheckpointChain({
        tenantId: tenant,
        agentId: "agent-axis-a",
        checkpoints: [second, first],
      }),
    ).toMatchObject({
      valid: true,
      checked: 2,
      brokenCheckpointIds: [],
      errors: [],
    });
  });

  it("rejects content tampering", () => {
    const original = checkpoint({
      id: "chk_tampered",
      tenantId: tenant,
      agentId: "agent-axis-a",
      scope: "axis-a",
      kind: "claim",
      title: "Risk state",
      summary: "Current risk state is admissible.",
      evidenceEventIds: [],
      decisionRefs: [],
      status: "open",
      payload: {},
      createdAt: timestamp("2026-06-03T14:00:00.000Z"),
      priorCheckpointHash: null,
    });
    const tampered = {
      ...original,
      summary: "Private memory says risk state is admissible.",
    };

    const report = verifyContinuityCheckpointChain({
      tenantId: tenant,
      agentId: "agent-axis-a",
      checkpoints: [tampered],
    });

    expect(report.valid).toBe(false);
    expect(report.brokenCheckpointIds).toEqual(["chk_tampered"]);
    expect(report.errors).toContain("chk_tampered: contentHash mismatch");
  });

  it("rejects a broken prior-checkpoint link", () => {
    const first = checkpoint({
      id: "chk_prior_001",
      tenantId: tenant,
      agentId: "agent-axis-a",
      scope: "axis-a",
      kind: "decision",
      title: "AAPL risk gate",
      summary: "Risk gate accepted.",
      evidenceEventIds: [],
      decisionRefs: ["decision:dec_aapl_buy_120"],
      status: "open",
      payload: {},
      createdAt: timestamp("2026-06-03T14:00:00.000Z"),
      priorCheckpointHash: null,
    });
    const second = checkpoint({
      id: "chk_prior_002",
      tenantId: tenant,
      agentId: "agent-axis-a",
      scope: "axis-a",
      kind: "work",
      title: "Resume",
      summary: "Resume from terminal state.",
      evidenceEventIds: [],
      decisionRefs: ["action_outcome:aoe_dec_aapl_buy_120"],
      status: "open",
      payload: {},
      createdAt: timestamp("2026-06-03T14:01:00.000Z"),
      priorCheckpointHash: "sha256:not-the-prior",
    });

    const report = verifyContinuityCheckpointChain({
      tenantId: tenant,
      agentId: "agent-axis-a",
      checkpoints: [first, second],
    });

    expect(report.valid).toBe(false);
    expect(report.brokenCheckpointIds).toEqual(["chk_prior_002"]);
    expect(report.errors[0]).toContain("priorCheckpointHash mismatch");
  });
});
