/**
 * Auto-provisioner for monthly events partitions.
 *
 * Why this exists (ADR-0005):
 *   `events.events` is range-partitioned by `recorded_at`. Migration 0003
 *   bootstraps a few months; migration 0007 adds a DEFAULT catch-all. Without
 *   active partition management, future inserts would land in the DEFAULT
 *   forever, defeating the point of monthly partitions (cheap detach +
 *   archival).
 *
 * Strategy:
 *   - On every `publish()`, check (cached, ~once per process per month) that
 *     a partition exists for the current month. If not, create it.
 *   - Lookahead one month so we never sit on the boundary right at midnight.
 *   - Use `CREATE TABLE IF NOT EXISTS ... PARTITION OF` — idempotent.
 *   - Concurrency-safe via Postgres advisory lock so two parallel publishes
 *     don't race to CREATE the same partition. PG17 `pg_try_advisory_lock`
 *     is per-session; we hold it for the duration of the create.
 */

import pg from "pg";

const ADVISORY_LOCK_KEY = 4_270_511_001; // arbitrary, namespaced to events partitioning

const provisionedMonths = new Set<string>();

export interface PartitionRange {
  readonly tableName: string;
  readonly from: string; // 'YYYY-MM-01'
  readonly to: string; // 'YYYY-MM-01' (exclusive upper bound, next month)
}

/**
 * Compute the partition range for the month containing `at` (UTC).
 */
export const monthRange = (at: Date): PartitionRange => {
  const y = at.getUTCFullYear();
  const m = at.getUTCMonth(); // 0-indexed
  const startY = y;
  const startM = m;
  const endY = m === 11 ? y + 1 : y;
  const endM = m === 11 ? 0 : m + 1;
  const fmt = (yy: number, mm: number) =>
    `${yy.toString().padStart(4, "0")}-${(mm + 1).toString().padStart(2, "0")}-01`;
  return {
    tableName: `events_${startY}_${(startM + 1).toString().padStart(2, "0")}`,
    from: fmt(startY, startM),
    to: fmt(endY, endM),
  };
};

/**
 * Ensure a partition exists for the month containing `at` AND for the next
 * month (lookahead). No-op after the first call per (process, month).
 *
 * Safe to call from any code path that's about to publish; the cache + the
 * `IF NOT EXISTS` make it cheap on the hot path.
 */
export const ensureMonthPartition = async (
  pool: pg.Pool,
  at: Date,
): Promise<void> => {
  const current = monthRange(at);
  const lookahead = monthRange(new Date(Date.UTC(
    at.getUTCFullYear(),
    at.getUTCMonth() + 1,
    1,
  )));
  for (const r of [current, lookahead]) {
    if (provisionedMonths.has(r.tableName)) continue;
    await ensureOne(pool, r);
    provisionedMonths.add(r.tableName);
  }
};

const ensureOne = async (
  pool: pg.Pool,
  r: PartitionRange,
): Promise<void> => {
  // Cheap check first — most calls hit this fast path and never run DDL.
  const exists = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'events' AND c.relname = $1
     ) AS exists`,
    [r.tableName],
  );
  if (exists.rows[0]?.exists) return;

  // Slow path: take an advisory lock so concurrent processes don't both
  // try to CREATE the same partition. Lock is auto-released on connection
  // return; we use a single connection here.
  const c = await pool.connect();
  try {
    await c.query(`SELECT pg_advisory_lock($1)`, [ADVISORY_LOCK_KEY]);
    // Re-check after acquiring lock (another process may have created it).
    const recheck = await c.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM pg_class c
           JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'events' AND c.relname = $1
       ) AS exists`,
      [r.tableName],
    );
    if (recheck.rows[0]?.exists) return;
    // Identifiers can't be parameterized — sanitize from our generated name.
    if (!/^events_\d{4}_\d{2}$/.test(r.tableName)) {
      throw new Error(`refusing to CREATE unexpected partition name: ${r.tableName}`);
    }
    await c.query(
      `CREATE TABLE IF NOT EXISTS events.${r.tableName}
        PARTITION OF events.events
        FOR VALUES FROM ('${r.from}') TO ('${r.to}')`,
    );
  } finally {
    await c.query(`SELECT pg_advisory_unlock($1)`, [ADVISORY_LOCK_KEY]).catch(() => {});
    c.release();
  }
};

/** Test helper — clear the cache so tests can verify provisioning happens. */
export const __clearPartitionCacheForTesting = (): void => {
  provisionedMonths.clear();
};
