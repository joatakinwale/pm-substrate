/**
 * Pinning test for the layered-ontology claim.
 *
 * Architecture rule (architecture.md): "Tools at Tier 1 work everywhere
 * with zero customization."
 *
 * If this test ever needs profile-specific branching to pass, the layered
 * ontology has leaked. See ADR-0009 falsification mode #7.
 *
 * Fixtures use the finance-research profile (the ArrowHedge agent-state
 * validation artifact).
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { PostgresEventStore } from "@pm/events";
import { PostgresProjectionRunner } from "@pm/projections";
import { PostgresProfileRegistry } from "@pm/profile-registry";
import { PostgresRegistry } from "@pm/registry";
import { FINANCE_RESEARCH_PROFILE } from "@pm/profile-finance-research";
import type { TenantId } from "@pm/types";
import { AUDIT_CAPABILITY, auditProjection } from "./index.js";
import type { AuditState } from "./projection.js";

const DATABASE_URL = process.env["PM_DATABASE_URL"];
const describeIfDb = DATABASE_URL ? describe : describe.skip;

describeIfDb("common/audit-log capability — Tier-1 tool proof", () => {
  let pool: pg.Pool;
  let events: PostgresEventStore;
  let runner: PostgresProjectionRunner;
  let capRegistry: PostgresRegistry;
  let profileRegistry: PostgresProfileRegistry;

  const tenants: TenantId[] = [];
  const makeTenant = async (): Promise<TenantId> => {
    const id = `tnt_audit_${randomUUID().slice(0, 8)}` as TenantId;
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
    events = new PostgresEventStore(pool);
    runner = new PostgresProjectionRunner(pool, events);
    capRegistry = new PostgresRegistry(pool);
    profileRegistry = new PostgresProfileRegistry(pool);
    await runner.register(auditProjection);
  });

  afterAll(async () => {
    await events.close();
    for (const t of tenants) {
      await pool.query(`DELETE FROM events.events WHERE tenant_id = $1`, [t]);
      await pool.query(`DELETE FROM events.subscriptions WHERE tenant_id = $1`, [t]);
      await pool.query(`DELETE FROM projections.state WHERE tenant_id = $1`, [t]);
      await pool.query(`DELETE FROM projections.cursors WHERE tenant_id = $1`, [t]);
      await pool.query(`DELETE FROM registry.capabilities WHERE tenant_id = $1`, [t]);
      await pool.query(`DELETE FROM profiles.installations WHERE tenant_id = $1`, [t]);
      await pool.query(`DELETE FROM substrate.tenants WHERE id = $1`, [t]);
    }
    await pool.end();
  });

  it("registers cleanly against any tenant regardless of installed profile", async () => {
    const a = await makeTenant();
    const b = await makeTenant();
    await profileRegistry.install(a, FINANCE_RESEARCH_PROFILE);
    // b has no profile installed — raw Tier-1 only.

    await capRegistry.register(a, AUDIT_CAPABILITY);
    await capRegistry.register(b, AUDIT_CAPABILITY);

    expect((await capRegistry.get(a, "common/audit-log"))?.subscribesTo).toEqual([
      {
        pattern: "*",
        accepts: { minMajor: 1, maxMajor: 1 },
        tolerateUnknown: true,
      },
    ]);
    expect((await capRegistry.get(b, "common/audit-log"))?.subscribesTo).toEqual([
      {
        pattern: "*",
        accepts: { minMajor: 1, maxMajor: 1 },
        tolerateUnknown: true,
      },
    ]);
  });

  it("produces the same audit shape across a finance-research tenant and a raw Tier-1 tenant", async () => {
    // Two tenants. Same number of events with overlapping types.
    const financeT = await makeTenant();
    const rawT = await makeTenant();
    await profileRegistry.install(financeT, FINANCE_RESEARCH_PROFILE);
    await capRegistry.register(financeT, AUDIT_CAPABILITY);
    await capRegistry.register(rawT, AUDIT_CAPABILITY);

    const eventTypes = ["thing.created", "thing.updated", "thing.deleted"];
    for (const t of [financeT, rawT]) {
      for (const type of eventTypes) {
        await events.publish({
          tenantId: t,
          type,
          entityId: `ent_${randomUUID().slice(0, 6)}`,
          emittedBy: "cap.test-emitter",
          payloadSchema: `${type}/v1`,
          payload: { sample: "data" },
        });
      }
    }

    await runner.catchUp(financeT, "common/audit-log");
    await runner.catchUp(rawT, "common/audit-log");

    const financeState = await runner.getState<AuditState>(
      financeT,
      "common/audit-log",
    );
    const rawState = await runner.getState<AuditState>(
      rawT,
      "common/audit-log",
    );

    expect(financeState?.count).toBe(3);
    expect(rawState?.count).toBe(3);

    // The byType breakdown is identical: same keys, same counts. The only
    // difference between the two tenants is which profile is installed —
    // and audit doesn't care.
    expect(financeState?.byType).toEqual({
      "thing.created": 1, "thing.updated": 1, "thing.deleted": 1,
    });
    expect(rawState?.byType).toEqual(financeState?.byType);

    // Entry shapes identical (modulo unique IDs).
    const shape = (s: AuditState) =>
      s.entries.map((e) => ({
        type: e.type, emittedBy: e.emittedBy, hasEntityId: !!e.entityId,
      }));
    expect(shape(financeState!)).toEqual(shape(rawState!));
  });

  it("captures profile-specific events without any profile-aware code in the projection", async () => {
    // Sanity: when finance-research event types fire, audit just records them
    // by string. No branch ever inspects the profile binding. If a future
    // change introduces a `if (event.type.startsWith('finance'))` somewhere
    // in this projection module, the architecture is leaking.
    const t = await makeTenant();
    await profileRegistry.install(t, FINANCE_RESEARCH_PROFILE);
    await capRegistry.register(t, AUDIT_CAPABILITY);

    await events.publish({
      tenantId: t, type: "analyst.signal.created",
      entityId: "ent_signal_x",
      emittedBy: "cap.finance-research-ingest",
      payloadSchema: "analyst.signal.created/v1",
      payload: { agentId: "agent:analyst_momentum" },
    });
    await events.publish({
      tenantId: t, type: "portfolio.decision.accepted",
      entityId: "ent_decision_y",
      emittedBy: "cap.finance-research-ingest",
      payloadSchema: "portfolio.decision.accepted/v1",
      payload: { accepted: true },
    });

    await runner.catchUp(t, "common/audit-log");
    const state = await runner.getState<AuditState>(t, "common/audit-log");

    expect(state?.count).toBe(2);
    expect(state?.byType).toEqual({
      "analyst.signal.created": 1,
      "portfolio.decision.accepted": 1,
    });
  });

  it("audit projection module imports zero profile-specific symbols", async () => {
    // Architectural pin: the audit projection's source must not depend on any
    // profile package. Verified at the package.json level — `dependencies`
    // contains @pm/projections, @pm/registry, @pm/types and nothing else.
    // A future PR that adds a @pm/profile-* package (etc.) to runtime
    // dependencies would be visible in code review and fail this test.
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const url = await import("node:url");
    const here = path.dirname(url.fileURLToPath(import.meta.url));
    const pkgPath = path.resolve(here, "..", "package.json");
    const pkgJson = JSON.parse(await fs.readFile(pkgPath, "utf8")) as {
      dependencies?: Record<string, string>;
    };
    const runtimeDeps = Object.keys(pkgJson.dependencies ?? {});
    for (const d of runtimeDeps) {
      expect(d).not.toMatch(/^@pm\/profile-/);
      expect(d).not.toMatch(/^@pm\/capability-/);
    }
  });
});
