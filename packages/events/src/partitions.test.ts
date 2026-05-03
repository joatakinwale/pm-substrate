/**
 * Pinning tests for the events partitioning strategy (ADR-0005).
 *
 * The audit caught the missing-partition failure mode: PG range partitioning
 * has no implicit catch-all, and the bootstrap migration only creates a few
 * months. These tests pin the two-layer defense:
 *   1. ensureMonthPartition() auto-provisions partitions on demand.
 *   2. events_default catches anything that escapes the auto-provisioner.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import {
  __clearPartitionCacheForTesting,
  ensureMonthPartition,
  monthRange,
} from "./partitions.js";
import { PostgresEventStore } from "./postgres.js";
import type { TenantId } from "@pm/types";

const DATABASE_URL = process.env["PM_DATABASE_URL"];
const describeIfDb = DATABASE_URL ? describe : describe.skip;

describe("monthRange", () => {
  it("computes inclusive-from / exclusive-to bounds", () => {
    const r = monthRange(new Date(Date.UTC(2026, 4, 15))); // 2026-05-15 UTC
    expect(r.tableName).toBe("events_2026_05");
    expect(r.from).toBe("2026-05-01");
    expect(r.to).toBe("2026-06-01");
  });
  it("handles December → January year rollover", () => {
    const r = monthRange(new Date(Date.UTC(2026, 11, 31))); // 2026-12-31 UTC
    expect(r.tableName).toBe("events_2026_12");
    expect(r.from).toBe("2026-12-01");
    expect(r.to).toBe("2027-01-01");
  });
});

describeIfDb("partition auto-provisioning + DEFAULT safety net", () => {
  let pool: pg.Pool;
  let store: PostgresEventStore;
  let tenantId: TenantId;
  // A future month deliberately past any bootstrap partition (2026-05/06/07).
  // We use 2026-09 — chosen so that auto-provisioning creates it cleanly,
  // and far enough out that we can test BEFORE the auto-provisioner runs
  // for it.
  const futureMonth = new Date(Date.UTC(2026, 8, 15)); // 2026-09-15 UTC

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: DATABASE_URL });
    store = new PostgresEventStore(pool);
    tenantId = `tnt_part_${Date.now()}` as TenantId;
    await pool.query(
      `INSERT INTO substrate.tenants(id, display_name) VALUES ($1, $1)
       ON CONFLICT DO NOTHING`,
      [tenantId],
    );
    // Partition tests don't share state with other suites; clear cache so
    // the provisioner actually runs DDL during the test (instead of seeing
    // an entry in the in-process cache from another test file).
    __clearPartitionCacheForTesting();
  });

  afterAll(async () => {
    await store.close();
    await pool.query(`DELETE FROM events.events WHERE tenant_id = $1`, [tenantId]);
    await pool.query(`DELETE FROM substrate.tenants WHERE id = $1`, [tenantId]);
    await pool.end();
  });

  it("ensureMonthPartition creates a partition for the requested month if absent", async () => {
    const r = monthRange(futureMonth);

    // Sanity: partition does not exist yet (drop if a prior run left it).
    await pool.query(`DROP TABLE IF EXISTS events.${r.tableName}`);
    __clearPartitionCacheForTesting();

    await ensureMonthPartition(pool, futureMonth);

    const exists = await pool.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM pg_class c
           JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'events' AND c.relname = $1
       ) AS exists`,
      [r.tableName],
    );
    expect(exists.rows[0]?.exists).toBe(true);
  });

  it("ensureMonthPartition is idempotent (safe to call repeatedly)", async () => {
    // First call provisioned (or no-op'd). Second call must be a no-op.
    await ensureMonthPartition(pool, futureMonth);
    await ensureMonthPartition(pool, futureMonth);
    // Just survives without error.
    expect(true).toBe(true);
  });

  it("publish() routes a backdated event into the DEFAULT safety net (no error)", async () => {
    // Force a recorded_at past any month we'd auto-provision (5 years out).
    // The auto-provisioner handles `now()`'s month + lookahead; this row
    // intentionally bypasses that, hitting the DEFAULT partition.
    const farFuture = "2031-06-15T00:00:00Z";
    const c = await pool.connect();
    try {
      await c.query("BEGIN");
      const r = await c.query<{ id: string; tableoid: string }>(
        `INSERT INTO events.events
          (id, tenant_id, type, entity_id, emitted_by, payload_schema,
           payload, occurred_at, recorded_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9)
         RETURNING id, tableoid::regclass::text AS tableoid`,
        [
          `evt_default_${Date.now()}`,
          tenantId,
          "test.default",
          "ent_x",
          "cap.x",
          "v1",
          "{}",
          farFuture,
          farFuture,
        ],
      );
      await c.query("COMMIT");
      expect(r.rows[0]?.tableoid).toBe("events.events_default");
    } finally {
      c.release();
    }
  });

  it("normal publish() lands in the current month's partition (auto-provisioned)", async () => {
    const ev = await store.publish({
      tenantId,
      type: "task.created",
      entityId: "ent_t1",
      emittedBy: "cap.test",
      payloadSchema: "task.created/v1",
      payload: {},
    });
    const r = await pool.query<{ tableoid: string }>(
      `SELECT tableoid::regclass::text AS tableoid
         FROM events.events WHERE id = $1`,
      [ev.id],
    );
    // Must NOT land in the default — should be the current-month partition.
    expect(r.rows[0]?.tableoid).not.toBe("events.events_default");
    expect(r.rows[0]?.tableoid).toMatch(/^events\.events_\d{4}_\d{2}$/);
  });
});
