/**
 * G5.5 — Time-travel test.
 *
 * Validates the substrate's time-travel claim from `docs/architecture.md`:
 *
 *     "Time-travel queries are supported by reading the event log at a
 *      given timestamp; projections are rebuilt from the log on demand."
 *
 * The substrate exposes two primitives that, composed, prove this claim:
 *
 *   1. `EventReader.read({ until })` — returns all events for a tenant
 *      with `occurredAt <= T`. Append-only log + tombstone-not-delete
 *      means the historical answer is recoverable verbatim.
 *
 *   2. `Projection.apply` — a deterministic, replayable fold from the
 *      event stream to a read-model. Same event sequence ⇒ same state,
 *      regardless of when we replay it.
 *
 * What this test asserts:
 *
 *   • Reconstruction-at-T: folding events with `occurredAt <= T` produces
 *     the state the system would have shown at T. Verified for three
 *     distinct watermarks (T1, T2, T3 = "now") against a known fixture.
 *
 *   • Determinism: rebuilding from log-start twice yields byte-identical
 *     state. The audit's research claim (event log enables replay)
 *     reduces to this property.
 *
 *   • Tombstones survive replay: a deleted edge → a "deleted" event.
 *     Time-travel to before the delete shows the entity as live; after
 *     the delete shows it as tombstoned. No mutation of the historical
 *     record.
 *
 * What this test deliberately does NOT assert:
 *
 *   • That `Graph.getNode` has an `asOf(t)` flavor. It doesn't, and it
 *     doesn't need one — `graph` is current-state cache; the event log
 *     is the source of truth. Adding `getNodeAsOf` would be a feature,
 *     not a substrate guarantee.
 *
 *   • Performance under realistic load. That's G5.6 (projection-lag).
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import type { PMEvent, TenantId, Timestamp } from "@pm/types";
import { PostgresEventStore } from "@pm/events";
import type { Projection } from "./interfaces.js";

const DATABASE_URL = process.env["PM_DATABASE_URL"];
const describeIfDb = DATABASE_URL ? describe : describe.skip;

/**
 * Order-tracker projection — folds order lifecycle events into a current
 * snapshot. Deterministic by construction: pure functions of the event
 * stream.
 *
 *   order.created   → orders[id] = { status: "open", total }
 *   order.updated   → orders[id].total = new total
 *   order.cancelled → orders[id].status = "cancelled"
 *   order.deleted   → tombstone (kept in map with status "deleted" so
 *                     time-travel can show the row was-here-and-removed)
 */
interface OrderState {
  orders: Record<
    string,
    { status: "open" | "cancelled" | "deleted"; total: number }
  >;
  totals: { sumOpen: number; cancelledCount: number };
}

const orderProjection = (name: string, version: number): Projection<OrderState> => ({
  name,
  version,
  consumes: ["order.*"],
  initial: () => ({ orders: {}, totals: { sumOpen: 0, cancelledCount: 0 } }),
  apply: (s, ev: PMEvent) => {
    const id = String(ev.entityId);
    const orders = { ...s.orders };
    let { sumOpen, cancelledCount } = s.totals;
    switch (ev.type) {
      case "order.created": {
        const total = Number(ev.payload["total"] ?? 0);
        orders[id] = { status: "open", total };
        sumOpen += total;
        break;
      }
      case "order.updated": {
        const cur = orders[id];
        if (cur && cur.status === "open") {
          const newTotal = Number(ev.payload["total"] ?? cur.total);
          sumOpen += newTotal - cur.total;
          orders[id] = { ...cur, total: newTotal };
        }
        break;
      }
      case "order.cancelled": {
        const cur = orders[id];
        if (cur && cur.status === "open") {
          sumOpen -= cur.total;
          cancelledCount += 1;
          orders[id] = { ...cur, status: "cancelled" };
        }
        break;
      }
      case "order.deleted": {
        const cur = orders[id];
        if (cur) {
          if (cur.status === "open") sumOpen -= cur.total;
          orders[id] = { ...cur, status: "deleted" };
        }
        break;
      }
    }
    return { orders, totals: { sumOpen, cancelledCount } };
  },
});

/**
 * Pure folder: replay a list of events through a projection's `apply`,
 * starting from `initial(tenantId)`. This is the "as-of-T" reconstruction
 * primitive — drive the same fold the runner uses, but over an
 * application-controlled event slice.
 */
async function foldEvents<TState>(
  proj: Projection<TState>,
  tenantId: TenantId,
  events: readonly PMEvent[],
): Promise<TState> {
  let state = proj.initial(tenantId);
  for (const ev of events) {
    // eslint-disable-next-line no-await-in-loop -- folds are sequential by definition
    state = await proj.apply(state, ev);
  }
  return state;
}

describeIfDb("Time-travel via event-log replay (G5.5)", () => {
  let pool: pg.Pool;
  let events: PostgresEventStore;
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
  });

  afterAll(async () => {
    await events.close();
    for (const t of tenants) {
      await pool.query(`DELETE FROM events.events WHERE tenant_id = $1`, [t]);
      await pool.query(`DELETE FROM substrate.tenants WHERE id = $1`, [t]);
    }
    await pool.end();
  });

  it("reconstruct-at-T: folding events with occurredAt<=T yields the historical state", async () => {
    const tenantId = await makeTenant();
    const proj = orderProjection(`orders_${randomUUID().slice(0, 6)}`, 1);

    // Fixed wall-clock fixture. Spread far enough apart that recordedAt
    // ordering can't accidentally match occurredAt ordering for the wrong
    // reason — i.e. the test is verifying we filter by occurredAt, not
    // by recordedAt.
    const T0 = "2026-01-01T00:00:00.000Z" as Timestamp;
    const T1 = "2026-01-15T00:00:00.000Z" as Timestamp;
    const T2 = "2026-02-01T00:00:00.000Z" as Timestamp;
    const T3 = "2026-03-01T00:00:00.000Z" as Timestamp;

    // Sequence:
    //   T0     order A created total=100        ⇒ open A=100
    //   T0+1ms order B created total=50         ⇒ open A=100, B=50
    //   T1+1ms order A updated total=120        ⇒ open A=120, B=50
    //   T2+1ms order B cancelled                 ⇒ open A=120; B cancelled
    //   T3-1ms order A deleted                   ⇒ open ∅; A=deleted, B=cancelled
    await events.publish({
      tenantId, type: "order.created", entityId: "ord_A",
      emittedBy: "cap.test", payloadSchema: "order.created/v1",
      payload: { total: 100 }, occurredAt: T0,
    });
    await events.publish({
      tenantId, type: "order.created", entityId: "ord_B",
      emittedBy: "cap.test", payloadSchema: "order.created/v1",
      payload: { total: 50 }, occurredAt: addMs(T0, 1),
    });
    await events.publish({
      tenantId, type: "order.updated", entityId: "ord_A",
      emittedBy: "cap.test", payloadSchema: "order.updated/v1",
      payload: { total: 120 }, occurredAt: addMs(T1, 1),
    });
    await events.publish({
      tenantId, type: "order.cancelled", entityId: "ord_B",
      emittedBy: "cap.test", payloadSchema: "order.cancelled/v1",
      payload: {}, occurredAt: addMs(T2, 1),
    });
    await events.publish({
      tenantId, type: "order.deleted", entityId: "ord_A",
      emittedBy: "cap.test", payloadSchema: "order.deleted/v1",
      payload: {}, occurredAt: addMs(T3, -1),
    });

    // ── State as of T1 (after both creates, before the update) ──
    const eventsUpToT1 = await events.read({
      tenantId, typePattern: "order.*", until: T1,
    });
    const stateAtT1 = await foldEvents(proj, tenantId, eventsUpToT1);
    expect(stateAtT1.orders).toEqual({
      ord_A: { status: "open", total: 100 },
      ord_B: { status: "open", total: 50 },
    });
    expect(stateAtT1.totals).toEqual({ sumOpen: 150, cancelledCount: 0 });

    // ── State as of T2 (after update, before cancel) ──
    const eventsUpToT2 = await events.read({
      tenantId, typePattern: "order.*", until: T2,
    });
    const stateAtT2 = await foldEvents(proj, tenantId, eventsUpToT2);
    expect(stateAtT2.orders).toEqual({
      ord_A: { status: "open", total: 120 },
      ord_B: { status: "open", total: 50 },
    });
    expect(stateAtT2.totals).toEqual({ sumOpen: 170, cancelledCount: 0 });

    // ── State as of T3 ("now") — full log ──
    const eventsUpToT3 = await events.read({
      tenantId, typePattern: "order.*", until: T3,
    });
    const stateAtT3 = await foldEvents(proj, tenantId, eventsUpToT3);
    expect(stateAtT3.orders).toEqual({
      ord_A: { status: "deleted", total: 120 },
      ord_B: { status: "cancelled", total: 50 },
    });
    expect(stateAtT3.totals).toEqual({ sumOpen: 0, cancelledCount: 1 });

    // ── Sanity: the read API doesn't return future events ──
    expect(eventsUpToT1.length).toBe(2);
    expect(eventsUpToT2.length).toBe(3);
    expect(eventsUpToT3.length).toBe(5);
  });

  it("determinism: rebuilding twice from the same event log produces byte-identical state", async () => {
    const tenantId = await makeTenant();
    const proj = orderProjection(`orders_${randomUUID().slice(0, 6)}`, 1);

    // Out-of-order publishes by occurredAt — recordedAt assigned by Postgres
    // monotonically, but occurredAt is caller-supplied. Time-travel must
    // sort by occurredAt, not by recordedAt.
    const baseTs = new Date("2026-04-01T12:00:00.000Z").getTime();
    const ts = (offsetMs: number): Timestamp =>
      new Date(baseTs + offsetMs).toISOString() as Timestamp;

    await events.publish({
      tenantId, type: "order.created", entityId: "ord_X",
      emittedBy: "cap.test", payloadSchema: "order.created/v1",
      payload: { total: 200 }, occurredAt: ts(2_000),
    });
    await events.publish({
      tenantId, type: "order.created", entityId: "ord_Y",
      emittedBy: "cap.test", payloadSchema: "order.created/v1",
      payload: { total: 75 }, occurredAt: ts(1_000), // earlier occurredAt
    });
    await events.publish({
      tenantId, type: "order.updated", entityId: "ord_X",
      emittedBy: "cap.test", payloadSchema: "order.updated/v1",
      payload: { total: 250 }, occurredAt: ts(3_000),
    });
    await events.publish({
      tenantId, type: "order.cancelled", entityId: "ord_Y",
      emittedBy: "cap.test", payloadSchema: "order.cancelled/v1",
      payload: {}, occurredAt: ts(4_000),
    });

    const sortByOccurredAt = (evs: readonly PMEvent[]): readonly PMEvent[] =>
      [...evs].sort((a, b) => {
        const ao = new Date(a.occurredAt).getTime();
        const bo = new Date(b.occurredAt).getTime();
        if (ao !== bo) return ao - bo;
        // Stable tiebreaker: id. Two events with identical occurredAt are
        // ordered by id so reconstruction is fully deterministic even at
        // millisecond collisions.
        return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
      });

    const all = await events.read({ tenantId, typePattern: "order.*" });
    const ordered = sortByOccurredAt(all);

    const replayA = await foldEvents(proj, tenantId, ordered);
    const replayB = await foldEvents(proj, tenantId, ordered);

    expect(replayA).toEqual(replayB);
    expect(JSON.stringify(replayA)).toBe(JSON.stringify(replayB));
    expect(replayA.orders).toEqual({
      ord_X: { status: "open", total: 250 },
      ord_Y: { status: "cancelled", total: 75 },
    });
    expect(replayA.totals).toEqual({ sumOpen: 250, cancelledCount: 1 });
  });

  it("tombstones survive replay: deletion is a recorded event, not a memory hole", async () => {
    const tenantId = await makeTenant();
    const proj = orderProjection(`orders_${randomUUID().slice(0, 6)}`, 1);

    const beforeDelete = "2026-05-01T00:00:00.000Z" as Timestamp;
    const atDelete = "2026-05-15T00:00:00.000Z" as Timestamp;
    const afterDelete = "2026-06-01T00:00:00.000Z" as Timestamp;

    await events.publish({
      tenantId, type: "order.created", entityId: "ord_Z",
      emittedBy: "cap.test", payloadSchema: "order.created/v1",
      payload: { total: 999 }, occurredAt: beforeDelete,
    });
    await events.publish({
      tenantId, type: "order.deleted", entityId: "ord_Z",
      emittedBy: "cap.test", payloadSchema: "order.deleted/v1",
      payload: {}, occurredAt: atDelete,
    });

    // BEFORE delete — the order is open and counted.
    const before = await foldEvents(
      proj,
      tenantId,
      await events.read({
        tenantId, typePattern: "order.*",
        until: addMs(beforeDelete, 1),
      }),
    );
    expect(before.orders["ord_Z"]).toEqual({ status: "open", total: 999 });
    expect(before.totals.sumOpen).toBe(999);

    // AFTER delete — the order is tombstoned but the row is still in the
    // projection. The substrate's delete-by-tombstone rule is what makes
    // time-travel honest: nothing is ever silently dropped.
    const after = await foldEvents(
      proj,
      tenantId,
      await events.read({
        tenantId, typePattern: "order.*", until: afterDelete,
      }),
    );
    expect(after.orders["ord_Z"]).toEqual({ status: "deleted", total: 999 });
    expect(after.totals.sumOpen).toBe(0);

    // The historical "before" view is unaffected by the later delete event.
    // Re-reading the same time window returns the same answer — this is
    // the immutability invariant time-travel depends on.
    const beforeAgain = await foldEvents(
      proj,
      tenantId,
      await events.read({
        tenantId, typePattern: "order.*",
        until: addMs(beforeDelete, 1),
      }),
    );
    expect(beforeAgain).toEqual(before);
  });
});

/**
 * Helper: shift an ISO timestamp by N milliseconds. Returns a Timestamp
 * brand. Negative offsets are supported.
 */
function addMs(t: Timestamp, ms: number): Timestamp {
  return new Date(new Date(t).getTime() + ms).toISOString() as Timestamp;
}
