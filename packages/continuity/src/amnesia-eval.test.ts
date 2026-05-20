import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import type { TenantId } from "@pm/types";
import {
  buildContinuityContext,
  findContinuityContradictions,
  PostgresContinuityLedger,
} from "./index.js";

const DATABASE_URL = process.env["PM_DATABASE_URL"];
const describeIfDb = DATABASE_URL ? describe : describe.skip;

describeIfDb("amnesiac-agent continuity eval", () => {
  let pool: pg.Pool;
  let ledger: PostgresContinuityLedger;
  const tenants: TenantId[] = [];

  const makeTenant = async (): Promise<TenantId> => {
    const id = `tnt_eval_${randomUUID().slice(0, 8)}` as TenantId;
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

  it("turns prior session conclusions into primitives for the next amnesiac run", async () => {
    const tenantId = await makeTenant();

    // Session 1: the agent learns/decides something and records it as audit,
    // not recall.
    await ledger.record({
      tenantId,
      agentId: "joat",
      scope: "substrate-discovery",
      kind: "decision",
      title: "Discovery product wedge",
      summary: "Sell a discovery sprint service before building the full platform.",
      decisionRefs: ["coordinated-reality-under-change_2026-05-20.md"],
    });
    await ledger.record({
      tenantId,
      agentId: "joat",
      scope: "substrate-discovery",
      kind: "research",
      title: "Workflow nets bridge",
      summary: "Workflow soundness gives a formal test for local action/global invariant.",
      decisionRefs: ["ADR-0029"],
    });
    await ledger.record({
      tenantId,
      agentId: "joat",
      scope: "substrate-discovery",
      kind: "work",
      title: "Build amnesia eval",
      summary: "Create a test proving continuity changes behavior across sessions.",
    });

    // Session 2: no chat history. The only input is tenant+agent+scope.
    const context = await buildContinuityContext(ledger, {
      tenantId,
      agentId: "joat",
      scope: "substrate-discovery",
    });

    expect(context.decisions.map((c) => c.title)).toContain("Discovery product wedge");
    expect(context.research.map((c) => c.title)).toContain("Workflow nets bridge");
    expect(context.openWork.map((c) => c.title)).toContain("Build amnesia eval");

    const verification = await ledger.verify(tenantId, "joat");
    expect(verification.valid).toBe(true);
    expect(verification.checked).toBe(3);
  });

  it("flags contradictory open claims across sessions", async () => {
    const tenantId = await makeTenant();
    await ledger.record({
      tenantId,
      agentId: "joat",
      scope: "positioning",
      kind: "claim",
      title: "Substrate thesis",
      summary: "The bottleneck for AI operators is coordinated state, not raw intelligence.",
    });
    await ledger.record({
      tenantId,
      agentId: "joat",
      scope: "positioning",
      kind: "claim",
      title: "Substrate thesis",
      summary: "The bottleneck for AI operators is prompt length, not state.",
    });

    const checkpoints = await ledger.list({ tenantId, agentId: "joat", scope: "positioning" });
    const findings = findContinuityContradictions(checkpoints);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.reason).toMatch(/conflicting open summaries/);
  });
});
