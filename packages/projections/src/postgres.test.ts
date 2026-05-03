/**
 * Integration tests for PostgresProjectionRunner against the running dev DB.
 *
 * Verifies catch-up correctness, cursor durability, idempotent re-catch-up,
 * and rebuild-after-version-bump.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import type { PMEvent, TenantId } from "@pm/types";
import { PostgresEventStore } from "@pm/events";
import { PostgresProjectionRunner } from "./postgres.js";
import type { Projection } from "./interfaces.js";

const DATABASE_URL = process.env["PM_DATABASE_URL"];
const describeIfDb = DATABASE_URL ? describe : describe.skip;

interface CountState {
  total: number;
  byType: Record<string, number>;
}

const counterProjection = (
  name: string,
  version: number,
): Projection<CountState> => ({
  name,
  version,
  consumes: ["task.*"],
  initial: () => ({ total: 0, byType: {} }),
  apply: (s, ev: PMEvent) => ({
    total: s.total + 1,
    byType: { ...s.byType, [ev.type]: (s.byType[ev.type] ?? 0) + 1 },
  }),
});

describeIfDb("PostgresProjectionRunner", () => {
  let pool: pg.Pool;
  let events: PostgresEventStore;
  let runner: PostgresProjectionRunner;
  // Each test gets its own sub-tenant so event-log pollution between tests
  // can't cause false negatives. Tenants are tracked for cleanup.
  const tenants: TenantId[] = [];

  const makeTenant = async (): Promise<TenantId> => {
    const id = `tnt_test_${randomUUID().slice(0, 8)}` as TenantId;
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
  });

  afterAll(async () => {
    await events.close();
    for (const t of tenants) {
      await pool.query(`DELETE FROM events.events WHERE tenant_id = $1`, [t]);
      await pool.query(`DELETE FROM events.subscriptions WHERE tenant_id = $1`, [t]);
      await pool.query(`DELETE FROM projections.state WHERE tenant_id = $1`, [t]);
      await pool.query(`DELETE FROM projections.cursors WHERE tenant_id = $1`, [t]);
      await pool.query(`DELETE FROM substrate.tenants WHERE id = $1`, [t]);
    }
    await pool.end();
  });

  it("catchUp folds events into materialized state", async () => {
    const tenantId = await makeTenant();
    const p = counterProjection(`counter_${randomUUID().slice(0, 6)}`, 1);
    await runner.register(p);

    await events.publish({
      tenantId,
      type: "task.created",
      entityId: "ent_t1",
      emittedBy: "cap.test",
      payloadSchema: "task.created/v1",
      payload: {},
    });
    await events.publish({
      tenantId,
      type: "task.created",
      entityId: "ent_t2",
      emittedBy: "cap.test",
      payloadSchema: "task.created/v1",
      payload: {},
    });
    await events.publish({
      tenantId,
      type: "task.completed",
      entityId: "ent_t1",
      emittedBy: "cap.test",
      payloadSchema: "task.completed/v1",
      payload: {},
    });

    await runner.catchUp(tenantId, p.name);
    const state = await runner.getState<CountState>(tenantId, p.name);
    expect(state?.total).toBe(3);
    expect(state?.byType).toEqual({
      "task.created": 2,
      "task.completed": 1,
    });
  });

  it("catchUp is idempotent: re-running with no new events is a no-op", async () => {
    const tenantId = await makeTenant();
    const p = counterProjection(`counter_${randomUUID().slice(0, 6)}`, 1);
    await runner.register(p);

    await events.publish({
      tenantId,
      type: "task.created",
      entityId: "ent_idem",
      emittedBy: "cap.test",
      payloadSchema: "task.created/v1",
      payload: {},
    });
    await runner.catchUp(tenantId, p.name);
    const s1 = await runner.getState<CountState>(tenantId, p.name);
    await runner.catchUp(tenantId, p.name);
    const s2 = await runner.getState<CountState>(tenantId, p.name);
    expect(s2).toEqual(s1);
    expect(s2?.total).toBe(1);
  });

  it("catchUp resumes from cursor after additional events arrive", async () => {
    const tenantId = await makeTenant();
    const p = counterProjection(`counter_${randomUUID().slice(0, 6)}`, 1);
    await runner.register(p);

    await events.publish({
      tenantId, type: "task.created", entityId: "ent_r1",
      emittedBy: "cap.test", payloadSchema: "task.created/v1", payload: {},
    });
    await runner.catchUp(tenantId, p.name);
    expect((await runner.getState<CountState>(tenantId, p.name))?.total).toBe(1);

    await events.publish({
      tenantId, type: "task.created", entityId: "ent_r2",
      emittedBy: "cap.test", payloadSchema: "task.created/v1", payload: {},
    });
    await events.publish({
      tenantId, type: "task.completed", entityId: "ent_r2",
      emittedBy: "cap.test", payloadSchema: "task.completed/v1", payload: {},
    });
    await runner.catchUp(tenantId, p.name);
    const s = await runner.getState<CountState>(tenantId, p.name);
    expect(s?.total).toBe(3);
  });

  it("rebuild resets cursor and replays from log start", async () => {
    const tenantId = await makeTenant();
    const p = counterProjection(`counter_${randomUUID().slice(0, 6)}`, 1);
    await runner.register(p);

    await events.publish({
      tenantId, type: "task.created", entityId: "ent_rb1",
      emittedBy: "cap.test", payloadSchema: "task.created/v1", payload: {},
    });
    await runner.catchUp(tenantId, p.name);
    const before = await runner.getState<CountState>(tenantId, p.name);
    expect(before?.total).toBe(1);

    await runner.rebuild(tenantId, p.name);
    const after = await runner.getState<CountState>(tenantId, p.name);
    // Rebuild reads ALL task.* events for this tenant — including ones from
    // earlier tests in this suite. So the count is >= 1, and equals the total
    // task.* events on this tenant.
    const live = await pool.query<{ c: string }>(
      `SELECT count(*)::text AS c FROM events.events
        WHERE tenant_id = $1 AND type LIKE 'task.%'`,
      [tenantId],
    );
    expect(after?.total).toBe(Number(live.rows[0]!.c));
  });

  it("version bump produces an independent state slot", async () => {
    const tenantId = await makeTenant();
    const name = `counter_${randomUUID().slice(0, 6)}`;
    const v1 = counterProjection(name, 1);
    const v2 = counterProjection(name, 2);

    await runner.register(v1);
    await events.publish({
      tenantId, type: "task.created", entityId: "ent_vb1",
      emittedBy: "cap.test", payloadSchema: "task.created/v1", payload: {},
    });
    await runner.catchUp(tenantId, name);
    const s1 = await runner.getState<CountState>(tenantId, name);
    expect(s1?.total).toBeGreaterThanOrEqual(1);

    // Re-register with bumped version. Old version's state remains.
    await runner.register(v2);
    await runner.catchUp(tenantId, name);
    const s2 = await runner.getState<CountState>(tenantId, name);
    expect(s2?.total).toBeGreaterThanOrEqual(1);

    // Both rows present in the cursors table.
    const r = await pool.query<{ c: string }>(
      `SELECT count(*)::text AS c FROM projections.cursors
        WHERE tenant_id = $1 AND projection_name = $2`,
      [tenantId, name],
    );
    expect(Number(r.rows[0]!.c)).toBe(2);
  });
});
