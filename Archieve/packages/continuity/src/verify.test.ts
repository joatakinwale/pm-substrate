import { describe, expect, it } from "vitest";
import { tenantId, timestamp, type EventId } from "@pm/types";
import {
  buildContinuityChainRepairPlan,
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

  it("rejects concurrent sibling heads until an append-only merge records both", () => {
    const root = checkpoint({
      id: "chk_fork_root",
      tenantId: tenant,
      agentId: "agent-axis-a",
      scope: "axis-a",
      kind: "work",
      title: "Shared root",
      summary: "Both writers observed this head.",
      evidenceEventIds: [],
      decisionRefs: [],
      status: "open",
      payload: {},
      createdAt: timestamp("2026-06-03T14:00:00.000Z"),
      priorCheckpointHash: null,
    });
    const branchA = checkpoint({
      ...root,
      id: "chk_fork_a",
      title: "Writer A",
      summary: "First concurrent writer.",
      createdAt: timestamp("2026-06-03T14:01:00.000Z"),
      priorCheckpointHash: root.contentHash,
    });
    const branchB = checkpoint({
      ...root,
      id: "chk_fork_b",
      title: "Writer B",
      summary: "Second concurrent writer.",
      createdAt: timestamp("2026-06-03T14:01:00.001Z"),
      priorCheckpointHash: root.contentHash,
    });
    const forked = [root, branchA, branchB];

    const before = verifyContinuityCheckpointChain({
      tenantId: tenant,
      agentId: "agent-axis-a",
      checkpoints: forked,
    });
    expect(before.valid).toBe(false);
    expect(before.errors).toContain(
      "continuity chain has 2 unmerged heads: chk_fork_a, chk_fork_b",
    );

    const plan = buildContinuityChainRepairPlan(
      forked,
      "Concurrent writers exposed a row-locking race.",
    );
    expect(plan.needed).toBe(true);
    expect(plan.canonicalHeadHash).toBe(branchB.contentHash);
    expect(plan.mergedHeadHashes).toEqual([branchA.contentHash]);
    const merge = checkpoint({
      ...root,
      id: "chk_fork_merge",
      kind: "lesson",
      title: "Merge concurrent heads",
      summary: "Preserve both hashes without rewriting either branch.",
      payload: plan.payload,
      createdAt: timestamp("2026-06-03T14:02:00.000Z"),
      priorCheckpointHash: plan.canonicalHeadHash,
    });

    expect(
      verifyContinuityCheckpointChain({
        tenantId: tenant,
        agentId: "agent-axis-a",
        checkpoints: [...forked, merge],
      }),
    ).toMatchObject({ valid: true, checked: 4, errors: [] });
  });

  it("refuses to launder unrelated genesis chains through a merge", () => {
    const rootA = checkpoint({
      id: "chk_genesis_a",
      tenantId: tenant,
      agentId: "agent-axis-a",
      scope: "axis-a",
      kind: "lesson",
      title: "Genesis A",
      summary: "Legitimate root.",
      evidenceEventIds: [],
      decisionRefs: [],
      status: "open",
      payload: {},
      createdAt: timestamp("2026-06-03T15:00:00.000Z"),
      priorCheckpointHash: null,
    });
    const rootB = checkpoint({
      ...rootA,
      id: "chk_genesis_b",
      title: "Genesis B",
      summary: "Injected reset root.",
      createdAt: timestamp("2026-06-03T15:00:01.000Z"),
    });
    const merge = checkpoint({
      ...rootA,
      id: "chk_unrelated_merge",
      title: "Invalid unrelated merge",
      summary: "Must not make two roots look like one chain.",
      payload: {
        continuityChainMerge: {
          schemaVersion: "continuity-chain-merge.v1",
          mergedHeadHashes: [rootA.contentHash],
          reason: "invalid root laundering",
        },
      },
      createdAt: timestamp("2026-06-03T15:01:00.000Z"),
      priorCheckpointHash: rootB.contentHash,
    });

    const report = verifyContinuityCheckpointChain({
      tenantId: tenant,
      agentId: "agent-axis-a",
      checkpoints: [rootA, rootB, merge],
    });

    expect(report.valid).toBe(false);
    expect(report.errors).toContain(
      "continuity chain requires exactly one genesis checkpoint; found 2: chk_genesis_a, chk_genesis_b",
    );
  });

  it("refuses a fake merge that names an ancestor instead of an orphan head", () => {
    const root = checkpoint({
      id: "chk_linear_root",
      tenantId: tenant,
      agentId: "agent-axis-a",
      scope: "axis-a",
      kind: "lesson",
      title: "Linear root",
      summary: "One chain.",
      evidenceEventIds: [],
      decisionRefs: [],
      status: "open",
      payload: {},
      createdAt: timestamp("2026-06-03T16:00:00.000Z"),
      priorCheckpointHash: null,
    });
    const child = checkpoint({
      ...root,
      id: "chk_linear_child",
      title: "Linear child",
      summary: "Extends root.",
      createdAt: timestamp("2026-06-03T16:01:00.000Z"),
      priorCheckpointHash: root.contentHash,
    });
    const fakeMerge = checkpoint({
      ...root,
      id: "chk_fake_linear_merge",
      title: "Fake merge",
      summary: "Names an ancestor as though it were an orphan head.",
      payload: {
        continuityChainMerge: {
          schemaVersion: "continuity-chain-merge.v1",
          mergedHeadHashes: [root.contentHash],
          reason: "invalid ancestor merge",
        },
      },
      createdAt: timestamp("2026-06-03T16:02:00.000Z"),
      priorCheckpointHash: child.contentHash,
    });

    const report = verifyContinuityCheckpointChain({
      tenantId: tenant,
      agentId: "agent-axis-a",
      checkpoints: [root, child, fakeMerge],
    });

    expect(report.valid).toBe(false);
    expect(report.errors).toContain(
      `${fakeMerge.id}: merge parent ${root.contentHash} was not an unmerged head`,
    );
  });

  it("applies the strict reserved merge schema to historical checkpoints", () => {
    const root = checkpoint({
      id: "chk_strict_schema_root",
      tenantId: tenant,
      agentId: "agent-axis-a",
      scope: "axis-a",
      kind: "lesson",
      title: "Strict schema root",
      summary: "Healthy checkpoint before a malformed historical row.",
      evidenceEventIds: [],
      decisionRefs: [],
      status: "open",
      payload: {},
      createdAt: timestamp("2026-06-03T17:00:00.000Z"),
      priorCheckpointHash: null,
    });
    const malformed = checkpoint({
      ...root,
      id: "chk_strict_schema_malformed",
      title: "Malformed merge row",
      summary: "Producer-controlled fields are not part of the reserved schema.",
      payload: {
        continuityChainMerge: {
          schemaVersion: "continuity-chain-merge.v1",
          mergedHeadHashes: [root.contentHash],
          reason: "historical malformed row",
          canonicalHeadHash: root.contentHash,
        },
      },
      createdAt: timestamp("2026-06-03T17:01:00.000Z"),
      priorCheckpointHash: root.contentHash,
    });

    const report = verifyContinuityCheckpointChain({
      tenantId: tenant,
      agentId: "agent-axis-a",
      checkpoints: [root, malformed],
    });

    expect(report.valid).toBe(false);
    expect(report.brokenCheckpointIds).toContain(malformed.id);
    expect(report.errors).toContain(
      `${malformed.id}: continuityChainMerge must contain exactly ` +
        "schemaVersion, mergedHeadHashes, and reason",
    );
  });
});
