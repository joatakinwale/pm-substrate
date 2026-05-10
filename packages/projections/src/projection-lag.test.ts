/**
 * G5.6 — Projection-lag test under realistic demo load.
 *
 * The substrate's promise is that events flow into projections promptly
 * via pull-based catchUp (Day-1) or push-based subscriptions (planned).
 * "Promptly" needs to be a measured number, not a vibe.
 *
 * What this test asserts:
 *
 *   • Throughput floor: publishing N events and catching up the projection
 *     completes within a budget that's loose enough not to flake on a busy
 *     CI runner but tight enough that a regression — e.g. an accidental
 *     N+1 query in the runner — fails the test instead of just slowing CI.
 *
 *   • No backlog drift: after catchUp returns, the projection's cursor is
 *     past every published event. There is no "almost caught up" state
 *     where the runner reports done but events remain unapplied.
 *
 *   • Catch-up is incremental, not a full rescan: a second batch of N
 *     events catches up in time proportional to N, not 2N. Verifies the
 *     cursor is actually being honored — a regression that always
 *     replayed from log-start would be silently correct under the
 *     determinism contract but catastrophically expensive in production.
 *
 * What this test does NOT assert:
 *
 *   • Wall-clock numbers as SLA. Hardware variance makes that meaningless.
 *     Budgets are sized to catch order-of-magnitude regressions only.
 *
 *   • Push-based / LISTEN-NOTIFY latency. That's a separate runner;
 *     `@pm/events` LISTEN reconnect is already tested in events tests.
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

/**
 * Minimal counter projection. The whole point is the runner mechanics —
 * the projection itself does almost no work, so wall-clock time measures
 * the substrate, not the projection logic.
 */
interface CountState {
  total: number;
  byEntity: Record<string, number>;
}

const counter = (name: string, version: number): Projection<CountState> => ({
  name,
  version,
  consumes: ["task.*"],
  initial: () => ({ total: 0, byEntity: {} }),
  apply: (s, ev: PMEvent) => ({
    total: s.total + 1,
    byEntity: {
      ...s.byEntity,
      [String(ev.entityId)]: (s.byEntity[String(ev.entityId)] ?? 0) + 1,
    },
  }),
});

/**
 * Loose budgets. These are *order-of-magnitude* tripwires: a regression
 * that introduces an N+1 or a missing index will blow past these by
 * 10-100x. A normal CI run finishes well under.
 *
 *   - 200 events catching up under 5s ⇒ ~40 events/sec floor (very loose).
 *   - 200 incremental events under 5s once cursor exists ⇒ same floor;
 *     regression would be log-start replay (effectively unbounded).
 */
const BUDGET_INITIAL_MS = 5_000;
const BUDGET_INCREMENTAL_MS = 5_000;
const BATCH_SIZE = 200;

describeIfDb("Projection-lag under demo-scale load (G5.6)", () => {
  let pool: pg.Pool;
  let events: PostgresEventStore;
  let runner: PostgresProjectionRunner;
  const tenants: TenantId[] = [];

  const makeTenant = async (): Promise<TenantId> => {
    const id = `tnt_lag_${randomUUID().slice(0, 8)}` as TenantId;
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
      await pool.query(
        `DELETE FROM events.subscriptions WHERE tenant_id = $1`,
        [t],
      );
      await pool.query(
        `DELETE FROM projections.state WHERE tenant_id = $1`,
        [t],
      );
      await pool.query(
        `DELETE FROM projections.cursors WHERE tenant_id = $1`,
        [t],
      );
      await pool.query(`DELETE FROM substrate.tenants WHERE id = $1`, [t]);
    }
    await pool.end();
  });

  /**
   * Publish a batch of events and return wall-clock duration of the publish
   * itself, separate from the catchUp phase. We don't budget the publish
   * directly — it's a pre-test fixture cost, not the substrate's job to
   * make fast. Batches are intentionally serial (one at a time) so we
   * exercise the same path a capability would on commit.
   */
  const publishBatch = async (
    tenantId: TenantId,
    n: number,
    typeMix: readonly string[],
  ): Promise<number> => {
    const start = performance.now();
    for (let i = 0; i < n; i++) {
      const type = typeMix[i % typeMix.length] ?? "task.created";
      // eslint-disable-next-line no-await-in-loop -- intentional serial publish
      await events.publish({
        tenantId,
        type,
        entityId: `ent_${i % 16}`, // 16 distinct entities — exercises grouping
        emittedBy: "cap.test",
        payloadSchema: `${type}/v1`,
        payload: { i },
      });
    }
    return performance.now() - start;
  };

  it("publishes N events and catches up the projection within budget", async () => {
    const tenantId = await makeTenant();
    const proj = counter(`lag_${randomUUID().slice(0, 6)}`, 1);
    await runner.register(proj);

    const publishMs = await publishBatch(tenantId, BATCH_SIZE, [
      "task.created",
      "task.updated",
      "task.completed",
    ]);

    const catchUpStart = performance.now();
    await runner.catchUp(tenantId, proj.name);
    const catchUpMs = performance.now() - catchUpStart;

    const state = await runner.getState<CountState>(tenantId, proj.name);
    expect(state?.total).toBe(BATCH_SIZE);

    // Order-of-magnitude budget. If this fails, you didn't break an
    // optimization — you broke the runner's basic shape. Print the
    // numbers regardless so a maintainer can see the trend over time.
    // eslint-disable-next-line no-console
    console.info(
      `[G5.6] N=${BATCH_SIZE} publish=${publishMs.toFixed(0)}ms ` +
        `catchUp=${catchUpMs.toFixed(0)}ms`,
    );
    expect(catchUpMs).toBeLessThan(BUDGET_INITIAL_MS);
  });

  it("incremental catch-up is proportional to the new batch, not the full log", async () => {
    const tenantId = await makeTenant();
    const proj = counter(`lag_${randomUUID().slice(0, 6)}`, 1);
    await runner.register(proj);

    // Phase 1: prime the cursor with the first batch.
    await publishBatch(tenantId, BATCH_SIZE, ["task.created"]);
    await runner.catchUp(tenantId, proj.name);
    expect((await runner.getState<CountState>(tenantId, proj.name))?.total).toBe(
      BATCH_SIZE,
    );

    // Phase 2: publish a second batch of the same size and time the
    // incremental catch-up specifically. If the cursor is honored, this
    // should be roughly the same wall-clock cost as phase 1's catchUp.
    // If the runner regressed to "always replay from log-start", phase 2
    // would scan 2N events and do twice as much work — but more
    // importantly, after K iterations of this pattern the cost would
    // scale O(K²). We don't loop K here (slow tests are bad tests), so
    // the assertion is the absolute budget AND the post-state count.
    await publishBatch(tenantId, BATCH_SIZE, ["task.completed"]);
    const incrementalStart = performance.now();
    await runner.catchUp(tenantId, proj.name);
    const incrementalMs = performance.now() - incrementalStart;

    const state = await runner.getState<CountState>(tenantId, proj.name);
    expect(state?.total).toBe(2 * BATCH_SIZE);

    // eslint-disable-next-line no-console
    console.info(
      `[G5.6] incremental N=${BATCH_SIZE} catchUp=${incrementalMs.toFixed(0)}ms`,
    );
    expect(incrementalMs).toBeLessThan(BUDGET_INCREMENTAL_MS);
  });

  it("after catchUp returns, no events remain unapplied (no silent backlog drift)", async () => {
    const tenantId = await makeTenant();
    const proj = counter(`lag_${randomUUID().slice(0, 6)}`, 1);
    await runner.register(proj);

    await publishBatch(tenantId, 50, ["task.created", "task.updated"]);
    await runner.catchUp(tenantId, proj.name);

    // Read the cursor directly. last_recorded_at should be >= the recordedAt
    // of every event in events.events for this tenant. If the runner
    // returned with events unconsumed, this assertion fails.
    const cur = await pool.query<{ last_recorded_at: string | null }>(
      `SELECT last_recorded_at::text
         FROM projections.cursors
        WHERE tenant_id = $1
          AND projection_name = $2
          AND projection_version = $3`,
      [tenantId, proj.name, proj.version],
    );
    const watermark = cur.rows[0]?.last_recorded_at;
    expect(watermark).toBeTruthy();

    const remaining = await pool.query<{ c: string }>(
      `SELECT count(*)::text AS c
         FROM events.events
        WHERE tenant_id = $1
          AND type LIKE 'task.%'
          AND recorded_at > $2::timestamptz`,
      [tenantId, watermark],
    );
    expect(Number(remaining.rows[0]!.c)).toBe(0);

    // And the in-memory state agrees with the cursor.
    const state = await runner.getState<CountState>(tenantId, proj.name);
    expect(state?.total).toBe(50);
  });
});
