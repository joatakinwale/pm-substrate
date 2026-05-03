/**
 * Postgres-backed projection runner. Day-1 implementation.
 *
 * Design notes:
 *   - State is materialized into `projections.state` keyed by
 *     (tenant_id, projection_name, projection_version) as a JSONB blob.
 *     This is the smallest day-1 storage that lets us round-trip arbitrary
 *     projection state. Performance failure mode #3 documents the path to
 *     promoting hot projection fields to typed columns when needed.
 *
 *   - The cursor (last_event_id, last_recorded_at) lives in `projections.cursors`.
 *     Catch-up reads events past the cursor, applies them in (recorded_at, id)
 *     order, and writes both the new state AND the new cursor in a single
 *     transaction. Crash mid-run is safe because the next catch-up resumes
 *     from the last committed cursor.
 *
 *   - A version bump is the rebuild trigger. The runner upserts a new row in
 *     `projections.cursors` for (tenant, name, new_version) with a NULL cursor
 *     and a fresh `initial()` state, leaving prior versions in place. Cutover
 *     is the consumer's responsibility (read the highest version installed).
 *
 *   - This is a pull-based runner (catchUp on demand). A push-based runner
 *     wired to @pm/events SubscriptionRouter is the obvious follow-up; both
 *     share this same atomic catch-up step.
 */

import type {
  EventId,
  PMEvent,
  TenantId,
} from "@pm/types";
import type { EventReader } from "@pm/events";
import pg from "pg";
import type { Projection, ProjectionRunner } from "./interfaces.js";

const STATE_TABLE_DDL = `
  CREATE TABLE IF NOT EXISTS projections.state (
    tenant_id          TEXT NOT NULL,
    projection_name    TEXT NOT NULL,
    projection_version INTEGER NOT NULL,
    state              JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, projection_name, projection_version)
  );
`;

interface CursorRow {
  last_event_id: string | null;
  /**
   * Returned as text (not Date) so we keep Postgres microsecond precision
   * verbatim. JS Date rounds to millisecond, which causes off-by-one
   * boundary bugs against `recorded_at > watermark` filters.
   */
  last_recorded_at_text: string | null;
}

interface StateRow<TState> {
  state: TState;
}

export class PostgresProjectionRunner implements ProjectionRunner {
  readonly #pool: pg.Pool;
  readonly #reader: EventReader;
  readonly #projections = new Map<string, Projection<unknown>>();
  #stateTableEnsured = false;

  constructor(pool: pg.Pool, reader: EventReader) {
    this.#pool = pool;
    this.#reader = reader;
  }

  async register<TState>(p: Projection<TState>): Promise<void> {
    await this.#ensureStateTable();
    this.#projections.set(p.name, p as Projection<unknown>);
  }

  async catchUp(tenantId: TenantId, name: string): Promise<void> {
    const p = this.#requireProjection(name);
    await this.#ensureCursor(tenantId, p);

    // Read cursor watermark. Cast to text to preserve microsecond precision —
    // Date.toISOString() rounds to ms which causes boundary off-by-ones.
    const cur = await this.#pool.query<CursorRow>(
      `SELECT last_event_id,
              last_recorded_at::text AS last_recorded_at_text
         FROM projections.cursors
        WHERE tenant_id = $1 AND projection_name = $2 AND projection_version = $3`,
      [tenantId, p.name, p.version],
    );
    const watermark = cur.rows[0]?.last_recorded_at_text ?? null;

    // Pull all matching events past the watermark, in order. We read each
    // pattern separately (the @pm/events read API takes one pattern at a time)
    // and merge by (recorded_at, id). For day-1 sizes this is fine.
    const batches = await Promise.all(
      p.consumes.map((pattern) => {
        const q: {
          tenantId: TenantId;
          typePattern: string;
          limit: number;
          afterRecordedAt?: string;
        } = { tenantId, typePattern: pattern, limit: 10_000 };
        if (watermark) {
          q.afterRecordedAt = watermark;
        }
        return this.#reader.read(q);
      }),
    );
    const flat = batches
      .flatMap((b) => b)
      .sort((a, b) => {
        const ar = new Date(a.recordedAt).getTime();
        const br = new Date(b.recordedAt).getTime();
        if (ar !== br) return ar - br;
        return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
      });

    if (flat.length === 0) return;

    // Apply in a transaction: re-read state under FOR UPDATE, fold, write
    // both state and cursor, commit.
    const c = await this.#pool.connect();
    try {
      await c.query("BEGIN");
      const stateRes = await c.query<StateRow<unknown>>(
        `SELECT state FROM projections.state
          WHERE tenant_id = $1 AND projection_name = $2 AND projection_version = $3
          FOR UPDATE`,
        [tenantId, p.name, p.version],
      );
      let state =
        stateRes.rows[0]?.state ?? p.initial(tenantId);

      let last: PMEvent | null = null;
      for (const ev of flat) {
        state = await p.apply(state, ev);
        last = ev;
      }

      await c.query(
        `UPDATE projections.state
            SET state = $4::jsonb,
                updated_at = now()
          WHERE tenant_id = $1 AND projection_name = $2 AND projection_version = $3`,
        [tenantId, p.name, p.version, JSON.stringify(state)],
      );
      // Re-read the row's recorded_at as text from the DB to preserve
      // microsecond precision (event.recordedAt has been ISO-string rounded
      // through JS Date). The cursor must equal the row's exact storage value
      // so the next `recorded_at > watermark` filter works correctly.
      await c.query(
        `UPDATE projections.cursors
            SET last_event_id    = $4,
                last_recorded_at = (SELECT recorded_at FROM events.events
                                     WHERE tenant_id = $1 AND id = $4 LIMIT 1),
                updated_at       = now()
          WHERE tenant_id = $1 AND projection_name = $2 AND projection_version = $3`,
        [tenantId, p.name, p.version, last!.id],
      );
      await c.query("COMMIT");
    } catch (err) {
      await c.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      c.release();
    }
  }

  async rebuild(tenantId: TenantId, name: string): Promise<void> {
    const p = this.#requireProjection(name);
    await this.#ensureStateTable();
    // Reset state + cursor atomically, then catch-up will replay from start.
    const c = await this.#pool.connect();
    try {
      await c.query("BEGIN");
      await c.query(
        `INSERT INTO projections.state (tenant_id, projection_name, projection_version, state)
         VALUES ($1,$2,$3,$4::jsonb)
         ON CONFLICT (tenant_id, projection_name, projection_version) DO UPDATE
           SET state = EXCLUDED.state, updated_at = now()`,
        [tenantId, p.name, p.version, JSON.stringify(p.initial(tenantId))],
      );
      await c.query(
        `INSERT INTO projections.cursors
           (tenant_id, projection_name, projection_version, last_event_id, last_recorded_at)
         VALUES ($1,$2,$3,NULL,NULL)
         ON CONFLICT (tenant_id, projection_name, projection_version) DO UPDATE
           SET last_event_id = NULL, last_recorded_at = NULL, updated_at = now()`,
        [tenantId, p.name, p.version],
      );
      await c.query("COMMIT");
    } catch (err) {
      await c.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      c.release();
    }
    await this.catchUp(tenantId, name);
  }

  async getState<TState>(
    tenantId: TenantId,
    name: string,
  ): Promise<TState | null> {
    const p = this.#requireProjection(name);
    const r = await this.#pool.query<StateRow<TState>>(
      `SELECT state FROM projections.state
        WHERE tenant_id = $1 AND projection_name = $2 AND projection_version = $3`,
      [tenantId, p.name, p.version],
    );
    return r.rows[0]?.state ?? null;
  }

  // -------------------------------------------------------------------------

  #requireProjection(name: string): Projection<unknown> {
    const p = this.#projections.get(name);
    if (!p) throw new Error(`projection not registered: ${name}`);
    return p;
  }

  async #ensureStateTable(): Promise<void> {
    if (this.#stateTableEnsured) return;
    await this.#pool.query(STATE_TABLE_DDL);
    this.#stateTableEnsured = true;
  }

  async #ensureCursor(
    tenantId: TenantId,
    p: Projection<unknown>,
  ): Promise<void> {
    // Idempotent: if rows exist, do nothing.
    await this.#pool.query(
      `INSERT INTO projections.state (tenant_id, projection_name, projection_version, state)
       VALUES ($1,$2,$3,$4::jsonb)
       ON CONFLICT DO NOTHING`,
      [tenantId, p.name, p.version, JSON.stringify(p.initial(tenantId))],
    );
    await this.#pool.query(
      `INSERT INTO projections.cursors
         (tenant_id, projection_name, projection_version, last_event_id, last_recorded_at)
       VALUES ($1,$2,$3,NULL,NULL)
       ON CONFLICT DO NOTHING`,
      [tenantId, p.name, p.version],
    );
  }
}
