import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import type { TenantId, Timestamp } from "@pm/types";
import {
  PostgresContinuityLedger,
  buildContinuityChainRepairPlan,
  buildContinuityContext,
  checkpointHash,
  type ContinuityCheckpoint,
} from "./index.js";

const DATABASE_URL = process.env["PM_DATABASE_URL"];
const describeIfDb = DATABASE_URL ? describe : describe.skip;

describeIfDb("PostgresContinuityLedger", () => {
  let pool: pg.Pool;
  let ledger: PostgresContinuityLedger;
  const tenants: TenantId[] = [];

  const makeTenant = async (): Promise<TenantId> => {
    const id = `tnt_cont_${randomUUID().slice(0, 8)}` as TenantId;
    await pool.query(
      `INSERT INTO substrate.tenants(id, display_name) VALUES ($1, $1)
       ON CONFLICT DO NOTHING`,
      [id],
    );
    tenants.push(id);
    return id;
  };

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: DATABASE_URL });
    ledger = new PostgresContinuityLedger(pool);
  });

  afterAll(async () => {
    for (const t of tenants) {
      await pool.query(`DELETE FROM continuity.checkpoints WHERE tenant_id = $1`, [t]);
      await pool.query(`DELETE FROM substrate.tenants WHERE id = $1`, [t]);
    }
    await pool.end();
  });

  it("records chained checkpoints and verifies continuity", async () => {
    const tenantId = await makeTenant();
    const a = await ledger.record({
      tenantId,
      agentId: "joat",
      scope: "substrate",
      kind: "decision",
      title: "Use event log as evidence",
      summary: "Court-record bridge makes event admissibility a substrate invariant.",
      evidenceEventIds: [],
      decisionRefs: ["ADR-0030"],
    });
    const b = await ledger.record({
      tenantId,
      agentId: "joat",
      scope: "substrate",
      kind: "work",
      title: "Added hash-chain verification",
      summary: "Tenant event chains can now be verified over HTTP.",
      decisionRefs: ["ADR-0030"],
    });

    expect(a.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(a.priorCheckpointHash).toBeNull();
    expect(b.priorCheckpointHash).toBe(a.contentHash);

    const list = await ledger.list({ tenantId, agentId: "joat", scope: "substrate" });
    expect(list.map((c) => c.id)).toContain(a.id);
    expect(list.map((c) => c.id)).toContain(b.id);

    const report = await ledger.verify(tenantId, "joat");
    expect(report.valid).toBe(true);
    expect(report.checked).toBe(2);
  });

  it("serializes concurrent writers for the same tenant and agent", async () => {
    const tenantId = await makeTenant();
    const base = {
      tenantId,
      agentId: "parallel-agents-sharing-one-ledger-identity",
      scope: "substrate",
      kind: "lesson" as const,
    };

    await ledger.record({
      ...base,
      title: "Seed the shared chain",
      summary: "Creates a row that concurrent SELECT FOR UPDATE calls can race behind.",
    });
    await Promise.all(
      Array.from({ length: 24 }, (_, index) =>
        ledger.record({
          ...base,
          title: `Concurrent checkpoint ${index}`,
          summary: `Writer ${index} must extend the immediately preceding committed head.`,
        }),
      ),
    );

    const report = await ledger.verify(tenantId, base.agentId);
    expect(report.valid, report.errors.join("\n")).toBe(true);
    expect(report.checked).toBe(25);
  });

  it("rolls back an in-flight append and releases the chain lock when its process connection dies", async () => {
    const tenantId = await makeTenant();
    const agentId = "killed-writer-agent";
    const client = await pool.connect();
    const killedId = "chk_killed_before_commit";
    try {
      await client.query("BEGIN");
      await client.query(
        `SELECT pg_advisory_xact_lock(
           hashtextextended(jsonb_build_array($1::text, $2::text)::text, 0)
         )`,
        [tenantId, agentId],
      );
      const createdAt = "2026-07-13T12:30:00.000Z" as Timestamp;
      const draft: Omit<ContinuityCheckpoint, "contentHash"> = {
        id: killedId,
        tenantId,
        agentId,
        scope: "substrate",
        kind: "lesson",
        title: "Uncommitted killed append",
        summary: "This row and its transaction-scoped lock must disappear with the socket.",
        evidenceEventIds: [],
        decisionRefs: [],
        status: "open",
        payload: {},
        createdAt,
        priorCheckpointHash: null,
      };
      await client.query(
        `INSERT INTO continuity.checkpoints
           (id, tenant_id, agent_id, scope, kind, title, summary,
            evidence_event_ids, decision_refs, status, payload, created_at,
            content_hash, prior_checkpoint_hash)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14)`,
        [
          draft.id,
          draft.tenantId,
          draft.agentId,
          draft.scope,
          draft.kind,
          draft.title,
          draft.summary,
          draft.evidenceEventIds,
          draft.decisionRefs,
          draft.status,
          JSON.stringify(draft.payload),
          draft.createdAt,
          checkpointHash(draft),
          draft.priorCheckpointHash,
        ],
      );
    } finally {
      // Destroying the socket approximates a killed CLI process: PostgreSQL
      // rolls back the open transaction and releases its xact advisory lock.
      client.release(true);
    }

    const committed = await ledger.record({
      tenantId,
      agentId,
      scope: "substrate",
      kind: "lesson",
      title: "Append after killed writer",
      summary: "Must acquire the released lock and become the sole genesis row.",
    });
    expect(committed.priorCheckpointHash).toBeNull();
    const checkpoints = await ledger.list({ tenantId, agentId, limit: 10 });
    expect(checkpoints.map((checkpoint) => checkpoint.id)).toEqual([
      committed.id,
    ]);
    const report = await ledger.verify(tenantId, agentId);
    expect(report.valid, report.errors.join("\n")).toBe(true);
  });

  it("selects the committed tail by database sequence when timestamps collide", async () => {
    const tenantId = await makeTenant();
    const createdAt = "2026-07-13T12:00:00.000Z" as Timestamp;
    const common = {
      tenantId,
      agentId: "equal-clock-agent",
      scope: "substrate",
      kind: "lesson" as const,
      evidenceEventIds: [],
      decisionRefs: [],
      status: "open" as const,
      payload: {},
      createdAt,
    };
    const rootDraft: Omit<ContinuityCheckpoint, "contentHash"> = {
      ...common,
      id: "chk_z_clock_root",
      title: "Clock root",
      summary: "Sorts after its child by id despite being inserted first.",
      priorCheckpointHash: null,
    };
    const root = { ...rootDraft, contentHash: checkpointHash(rootDraft) };
    const childDraft: Omit<ContinuityCheckpoint, "contentHash"> = {
      ...common,
      id: "chk_a_clock_child",
      title: "Clock child",
      summary: "Same timestamp; database sequence is the only valid order.",
      priorCheckpointHash: root.contentHash,
    };
    const child = { ...childDraft, contentHash: checkpointHash(childDraft) };

    for (const checkpoint of [root, child]) {
      await pool.query(
        `INSERT INTO continuity.checkpoints
           (id, tenant_id, agent_id, scope, kind, title, summary,
            evidence_event_ids, decision_refs, status, payload, created_at,
            content_hash, prior_checkpoint_hash)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14)`,
        [
          checkpoint.id,
          checkpoint.tenantId,
          checkpoint.agentId,
          checkpoint.scope,
          checkpoint.kind,
          checkpoint.title,
          checkpoint.summary,
          checkpoint.evidenceEventIds,
          checkpoint.decisionRefs,
          checkpoint.status,
          JSON.stringify(checkpoint.payload),
          checkpoint.createdAt,
          checkpoint.contentHash,
          checkpoint.priorCheckpointHash,
        ],
      );
    }

    const appended = await ledger.record({
      tenantId,
      agentId: common.agentId,
      scope: common.scope,
      kind: "lesson",
      title: "Post-collision append",
      summary: "Must extend the last committed row, not the clock/id maximum.",
    });

    expect(appended.priorCheckpointHash).toBe(child.contentHash);
    const report = await ledger.verify(tenantId, common.agentId);
    expect(report.valid, report.errors.join("\n")).toBe(true);
  });

  it("refuses ordinary writes on a fork and admits only its exact merge", async () => {
    const tenantId = await makeTenant();
    const agentId = "repairable-fork-agent";
    const root = await ledger.record({
      tenantId,
      agentId,
      scope: "substrate",
      kind: "lesson",
      title: "Fork root",
      summary: "Seed before two legacy concurrent children.",
    });
    const branchDrafts: Omit<ContinuityCheckpoint, "contentHash">[] = [
      {
        ...root,
        id: "chk_fork_db_a",
        title: "DB branch A",
        summary: "First orphan head.",
        createdAt: "2026-07-13T13:00:00.000Z" as Timestamp,
        priorCheckpointHash: root.contentHash,
      },
      {
        ...root,
        id: "chk_fork_db_b",
        title: "DB branch B",
        summary: "Second orphan head.",
        createdAt: "2026-07-13T13:00:00.001Z" as Timestamp,
        priorCheckpointHash: root.contentHash,
      },
    ].map(({ contentHash: _hash, ...draft }) => draft);
    for (const draft of branchDrafts) {
      const contentHash = checkpointHash(draft);
      await pool.query(
        `INSERT INTO continuity.checkpoints
           (id, tenant_id, agent_id, scope, kind, title, summary,
            evidence_event_ids, decision_refs, status, payload, created_at,
            content_hash, prior_checkpoint_hash)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14)`,
        [
          draft.id,
          draft.tenantId,
          draft.agentId,
          draft.scope,
          draft.kind,
          draft.title,
          draft.summary,
          draft.evidenceEventIds,
          draft.decisionRefs,
          draft.status,
          JSON.stringify(draft.payload),
          draft.createdAt,
          contentHash,
          draft.priorCheckpointHash,
        ],
      );
    }

    await expect(
      ledger.record({
        tenantId,
        agentId,
        scope: "substrate",
        kind: "lesson",
        title: "Unsafe append",
        summary: "Must not silently choose one fork head.",
      }),
    ).rejects.toThrow(/only an exact append-only merge may proceed/);

    const forked = await ledger.list({ tenantId, agentId, limit: 100 });
    const plan = buildContinuityChainRepairPlan(forked, "DB regression fork");
    const merge = await ledger.record({
      tenantId,
      agentId,
      scope: "substrate",
      kind: "lesson",
      title: "Exact DB merge",
      summary: "References every orphan head without rewriting history.",
      payload: plan.payload,
    });

    expect(plan.needed).toBe(true);
    expect(merge.priorCheckpointHash).toBe(plan.canonicalHeadHash);
    const report = await ledger.verify(tenantId, agentId);
    expect(report.valid, report.errors.join("\n")).toBe(true);
  });

  it("rejects malformed reserved merge payloads before insert", async () => {
    const tenantId = await makeTenant();
    const agentId = "strict-merge-admission-agent";
    const root = await ledger.record({
      tenantId,
      agentId,
      scope: "substrate",
      kind: "lesson",
      title: "Strict merge root",
      summary: "Malformed merge attempts must leave this healthy chain unchanged.",
    });
    const sparseHashes = Array<string>(1);
    const attempts: readonly {
      readonly label: string;
      readonly payload: Readonly<Record<string, unknown>>;
      readonly expected: RegExp;
    }[] = [
      {
        label: "wrong schema",
        payload: {
          continuityChainMerge: {
            schemaVersion: "continuity-chain-merge.v0",
            mergedHeadHashes: [root.contentHash],
            reason: "obsolete schema",
          },
        },
        expected: /schemaVersion is invalid/,
      },
      {
        label: "empty reason",
        payload: {
          continuityChainMerge: {
            schemaVersion: "continuity-chain-merge.v1",
            mergedHeadHashes: [root.contentHash],
            reason: "   ",
          },
        },
        expected: /reason must be non-empty/,
      },
      {
        label: "wrong reason type",
        payload: {
          continuityChainMerge: {
            schemaVersion: "continuity-chain-merge.v1",
            mergedHeadHashes: [root.contentHash],
            reason: 7,
          },
        },
        expected: /reason must be non-empty/,
      },
      {
        label: "duplicate hashes",
        payload: {
          continuityChainMerge: {
            schemaVersion: "continuity-chain-merge.v1",
            mergedHeadHashes: [root.contentHash, root.contentHash],
            reason: "duplicate parent",
          },
        },
        expected: /mergedHeadHashes must be unique non-empty strings/,
      },
      {
        label: "wrong envelope type",
        payload: { continuityChainMerge: [] },
        expected: /continuityChainMerge must be an object/,
      },
      {
        label: "wrong hash collection type",
        payload: {
          continuityChainMerge: {
            schemaVersion: "continuity-chain-merge.v1",
            mergedHeadHashes: root.contentHash,
            reason: "not an array",
          },
        },
        expected: /mergedHeadHashes must be unique non-empty strings/,
      },
      {
        label: "wrong hash member type",
        payload: {
          continuityChainMerge: {
            schemaVersion: "continuity-chain-merge.v1",
            mergedHeadHashes: [root.contentHash, 7],
            reason: "not all strings",
          },
        },
        expected: /mergedHeadHashes must be unique non-empty strings/,
      },
      {
        label: "empty hash",
        payload: {
          continuityChainMerge: {
            schemaVersion: "continuity-chain-merge.v1",
            mergedHeadHashes: ["   "],
            reason: "empty parent",
          },
        },
        expected: /mergedHeadHashes must be unique non-empty strings/,
      },
      {
        label: "sparse hash array",
        payload: {
          continuityChainMerge: {
            schemaVersion: "continuity-chain-merge.v1",
            mergedHeadHashes: sparseHashes,
            reason: "array holes serialize as null",
          },
        },
        expected: /mergedHeadHashes must be unique non-empty strings/,
      },
      {
        label: "unexpected field",
        payload: {
          continuityChainMerge: {
            schemaVersion: "continuity-chain-merge.v1",
            mergedHeadHashes: [root.contentHash],
            reason: "extra producer-controlled field",
            canonicalHeadHash: root.contentHash,
          },
        },
        expected: /must contain exactly schemaVersion, mergedHeadHashes, and reason/,
      },
    ];

    for (const attempt of attempts) {
      await expect(
        ledger.record({
          tenantId,
          agentId,
          scope: "substrate",
          kind: "lesson",
          title: `Rejected merge: ${attempt.label}`,
          summary: "This malformed reserved payload must never be inserted.",
          payload: attempt.payload,
        }),
      ).rejects.toThrow(attempt.expected);

      const checkpoints = await ledger.list({ tenantId, agentId, limit: 100 });
      expect(checkpoints, attempt.label).toHaveLength(1);
      const report = await ledger.verify(tenantId, agentId);
      expect(report.valid, `${attempt.label}: ${report.errors.join("\n")}`).toBe(true);
    }

    await expect(
      ledger.record({
        tenantId,
        agentId,
        scope: "substrate",
        kind: "lesson",
        title: "Premature well-formed merge",
        summary: "Valid syntax still cannot merge a single-head chain.",
        payload: {
          continuityChainMerge: {
            schemaVersion: "continuity-chain-merge.v1",
            mergedHeadHashes: [root.contentHash],
            reason: "no fork exists",
          },
        },
      }),
    ).rejects.toThrow(/ledger does not currently have multiple heads/);
    expect((await ledger.verify(tenantId, agentId)).valid).toBe(true);

    const ordinary = await ledger.record({
      tenantId,
      agentId,
      scope: "substrate",
      kind: "lesson",
      title: "Ordinary structured payload",
      summary: "Non-reserved checkpoint payloads remain admissible.",
      payload: { benchmarkReceipt: { status: "observed" } },
    });
    expect(ordinary.priorCheckpointHash).toBe(root.contentHash);
    const finalReport = await ledger.verify(tenantId, agentId);
    expect(finalReport.valid, finalReport.errors.join("\n")).toBe(true);
    expect(finalReport.checked).toBe(2);
  });

  it("closes a work item by recording the same title with status closed", async () => {
    const tenantId = await makeTenant();
    const base = { tenantId, agentId: "joat", scope: "substrate" } as const;
    await ledger.record({
      ...base,
      kind: "work",
      title: "Wire the projection",
      summary: "Open work item.",
    });

    const before = await buildContinuityContext(ledger, base);
    expect(before.openWork.map((c) => c.title)).toContain("Wire the projection");

    await ledger.record({
      ...base,
      kind: "work",
      title: "Wire the projection",
      summary: "Shipped and verified.",
      status: "closed",
    });

    const after = await buildContinuityContext(ledger, base);
    expect(after.openWork.map((c) => c.title)).not.toContain("Wire the projection");

    await ledger.record({
      ...base,
      kind: "work",
      title: "Wire the projection",
      summary: "Regression found; reopened.",
    });

    const reopened = await buildContinuityContext(ledger, base);
    expect(reopened.openWork.map((c) => c.title)).toContain("Wire the projection");
  });

  it("detects checkpoint tampering", async () => {
    const tenantId = await makeTenant();
    const c = await ledger.record({
      tenantId,
      agentId: "joat",
      scope: "substrate",
      kind: "claim",
      title: "Claim",
      summary: "Original claim.",
    });
    await pool.query(
      `UPDATE continuity.checkpoints SET summary = $3 WHERE tenant_id = $1 AND id = $2`,
      [tenantId, c.id, "Tampered claim."],
    );
    const report = await ledger.verify(tenantId, "joat");
    expect(report.valid).toBe(false);
    expect(report.brokenCheckpointIds).toContain(c.id);
  });
});
