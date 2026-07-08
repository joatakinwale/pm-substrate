import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import type { TenantId } from "@pm/types";
import { PostgresContinuityLedger, buildContinuityContext } from "./index.js";

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
