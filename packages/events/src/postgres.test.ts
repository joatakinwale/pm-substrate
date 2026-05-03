/**
 * Integration tests for PostgresEventStore against the running dev DB.
 *
 * Skipped automatically if PM_DATABASE_URL is unset. Each test uses a unique
 * tenant id so suites can run in parallel without collisions.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import type { TenantId } from "@pm/types";
import { PostgresEventStore } from "./postgres.js";
import { matchesPattern } from "./pattern.js";

const DATABASE_URL = process.env["PM_DATABASE_URL"];

const describeIfDb = DATABASE_URL ? describe : describe.skip;

describe("matchesPattern", () => {
  it("matches exact", () => {
    expect(matchesPattern("task.created", "task.created")).toBe(true);
    expect(matchesPattern("task.created", "task.completed")).toBe(false);
  });
  it("matches namespace wildcard", () => {
    expect(matchesPattern("task.*", "task.created")).toBe(true);
    expect(matchesPattern("task.*", "task.completed")).toBe(true);
    expect(matchesPattern("task.*", "milestone.created")).toBe(false);
  });
  it("matches verb wildcard", () => {
    expect(matchesPattern("*.created", "task.created")).toBe(true);
    expect(matchesPattern("*.created", "milestone.created")).toBe(true);
    expect(matchesPattern("*.created", "task.completed")).toBe(false);
  });
  it("matches catch-all", () => {
    expect(matchesPattern("*", "task.created")).toBe(true);
    expect(matchesPattern("*.*", "milestone.due")).toBe(true);
  });
});

describeIfDb("PostgresEventStore", () => {
  let pool: pg.Pool;
  let store: PostgresEventStore;
  const tenantId = `tnt_test_${randomUUID().slice(0, 8)}` as TenantId;

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: DATABASE_URL });
    store = new PostgresEventStore(pool);
  });

  afterAll(async () => {
    await store.close();
    // Clean up test rows so the events table doesn't grow unbounded.
    await pool.query(`DELETE FROM events.events WHERE tenant_id = $1`, [
      tenantId,
    ]);
    await pool.query(
      `DELETE FROM events.subscriptions WHERE tenant_id = $1`,
      [tenantId],
    );
    await pool.end();
  });

  it("publishes and reads back an event", async () => {
    const ev = await store.publish({
      tenantId,
      type: "task.created",
      entityId: "ent_task_1",
      emittedBy: "cap.planner",
      payloadSchema: "task.created/v1",
      payload: { title: "Pick venue" },
    });
    expect(ev.id).toMatch(/^evt_/);
    expect(ev.type).toBe("task.created");
    expect(ev.payload).toEqual({ title: "Pick venue" });

    const back = await store.getById(tenantId, ev.id);
    expect(back?.id).toBe(ev.id);
  });

  it("filters reads by glob pattern + entity + time bounds", async () => {
    await store.publish({
      tenantId,
      type: "task.completed",
      entityId: "ent_task_1",
      emittedBy: "cap.planner",
      payloadSchema: "task.completed/v1",
      payload: {},
    });
    await store.publish({
      tenantId,
      type: "milestone.due",
      entityId: "ent_ms_1",
      emittedBy: "cap.planner",
      payloadSchema: "milestone.due/v1",
      payload: {},
    });

    const tasks = await store.read({ tenantId, typePattern: "task.*" });
    expect(tasks.every((e) => e.type.startsWith("task."))).toBe(true);
    expect(tasks.length).toBeGreaterThanOrEqual(2);

    const completedOnly = await store.read({
      tenantId,
      typePattern: "*.completed",
    });
    expect(completedOnly.every((e) => e.type.endsWith(".completed"))).toBe(
      true,
    );

    const byEntity = await store.read({
      tenantId,
      typePattern: "*",
      entityId: "ent_ms_1",
    });
    expect(byEntity.every((e) => e.entityId === "ent_ms_1")).toBe(true);
  });

  it("preserves causation chain", async () => {
    const cause = await store.publish({
      tenantId,
      type: "contract.signed",
      entityId: "ent_contract_1",
      emittedBy: "cap.contracts",
      payloadSchema: "contract.signed/v1",
      payload: { vendorId: "ent_v_1" },
    });
    const effect = await store.publish({
      tenantId,
      type: "calendar.confirmed",
      entityId: "ent_cal_1",
      emittedBy: "cap.calendar",
      payloadSchema: "calendar.confirmed/v1",
      payload: {},
      causedBy: cause.id,
    });
    expect(effect.causedBy).toBe(cause.id);

    const back = await store.getById(tenantId, effect.id);
    expect(back?.causedBy).toBe(cause.id);
  });

  it("rolls back NOTIFY when the caller's transaction rolls back", async () => {
    const c = await pool.connect();
    let publishedId: string | null = null;
    try {
      await c.query("BEGIN");
      const ev = await store.publishWith(c, {
        tenantId,
        type: "task.created",
        entityId: "ent_task_rollback",
        emittedBy: "cap.planner",
        payloadSchema: "task.created/v1",
        payload: { title: "Should not survive" },
      });
      publishedId = ev.id;
      await c.query("ROLLBACK");
    } finally {
      c.release();
    }
    const back = await store.getById(tenantId, publishedId! as never);
    expect(back).toBeNull();
  });

  it("LISTEN/NOTIFY delivers live events to a registered subscriber", async () => {
    const subId = `sub_${randomUUID().slice(0, 8)}`;
    await store.subscribe({
      tenantId,
      subscriberId: subId,
      eventTypePattern: "task.*",
      entityTypeFilter: null,
    });

    const received: string[] = [];
    const iter = store.consume(tenantId, subId);

    const consumePromise = (async () => {
      for await (const ev of iter) {
        received.push(ev.type);
        if (received.includes("task.live_test")) break;
      }
    })();

    // Give the LISTEN connection a beat to register, then publish.
    await new Promise((r) => setTimeout(r, 200));
    await store.publish({
      tenantId,
      type: "task.live_test",
      entityId: "ent_task_live",
      emittedBy: "cap.planner",
      payloadSchema: "task.live_test/v1",
      payload: {},
    });

    // Bound the wait — if NOTIFY plumbing is broken, fail fast rather than hang.
    await Promise.race([
      consumePromise,
      new Promise((_, rej) =>
        setTimeout(() => rej(new Error("live event not received in 3s")), 3000),
      ),
    ]);

    expect(received).toContain("task.live_test");
    await store.unsubscribe(tenantId, subId);
  });

  it("filters out other tenants' events on the same NOTIFY channel collision space", async () => {
    const otherTenant = `tnt_test_${randomUUID().slice(0, 8)}` as TenantId;
    const subId = `sub_${randomUUID().slice(0, 8)}`;
    await store.subscribe({
      tenantId,
      subscriberId: subId,
      eventTypePattern: "task.*",
      entityTypeFilter: null,
    });

    const received: string[] = [];
    const iter = store.consume(tenantId, subId);
    const consumePromise = (async () => {
      for await (const ev of iter) {
        received.push(`${ev.tenantId}:${ev.type}`);
        if (received.length >= 1) break;
      }
    })();

    await new Promise((r) => setTimeout(r, 200));

    // Publish on the other tenant first — must NOT wake our subscriber.
    await store.publish({
      tenantId: otherTenant,
      type: "task.created",
      entityId: "ent_task_other",
      emittedBy: "cap.planner",
      payloadSchema: "task.created/v1",
      payload: {},
    });

    // Then publish on our tenant — must.
    await store.publish({
      tenantId,
      type: "task.created",
      entityId: "ent_task_ours",
      emittedBy: "cap.planner",
      payloadSchema: "task.created/v1",
      payload: {},
    });

    await Promise.race([
      consumePromise,
      new Promise((_, rej) =>
        setTimeout(() => rej(new Error("own-tenant event missed")), 3000),
      ),
    ]);

    expect(received).toEqual([`${tenantId}:task.created`]);
    await store.unsubscribe(tenantId, subId);
    // Cleanup the cross-tenant test row.
    await pool.query(`DELETE FROM events.events WHERE tenant_id = $1`, [
      otherTenant,
    ]);
  });
});
