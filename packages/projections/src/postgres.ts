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
 *   - The cursor (last_event_id, last_event_seq, last_recorded_at) lives in
 *     `projections.cursors`.
 *     Catch-up reads events past the cursor, applies them in event-log sequence
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
  EntityId,
  EventId,
  PMEvent,
  TenantId,
  Timestamp,
} from "@pm/types";
import { patternToSqlLike, type EventReader } from "@pm/events";
import pg from "pg";
import type {
  Projection,
  ProjectionReplayFrontier,
  ProjectionReplayFrontierEvent,
  ProjectionRunner,
} from "./interfaces.js";

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
  last_event_seq: string | number | null;
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

interface EventRow {
  seq: string | number;
  id: string;
  tenant_id: string;
  type: string;
  entity_id: string;
  emitted_by: string;
  payload_schema: string;
  payload: Record<string, unknown>;
  occurred_at: Date;
  recorded_at: Date;
  caused_by: string | null;
  schema_version: number;
  authority: string | null;
  content_hash: string | null;
  prior_event_hash: string | null;
}

interface ProjectionEventRecord {
  readonly event: PMEvent;
  readonly sequence: number;
}

const parseEventSequence = (value: string | number): number => {
  const sequence =
    typeof value === "number" ? value : Number.parseInt(value, 10);
  if (!Number.isSafeInteger(sequence) || sequence < 1) {
    throw new Error(`invalid event sequence: ${String(value)}`);
  }
  return sequence;
};

const rowToEventRecord = (row: EventRow): ProjectionEventRecord => ({
  sequence: parseEventSequence(row.seq),
  event: {
    id: row.id as EventId,
    tenantId: row.tenant_id as TenantId,
    type: row.type,
    entityId: row.entity_id as EntityId,
    emittedBy: row.emitted_by,
    payloadSchema: row.payload_schema,
    payload: row.payload ?? {},
    schemaVersion: row.schema_version,
    authority: row.authority,
    contentHash: row.content_hash,
    priorEventHash: row.prior_event_hash,
    occurredAt: row.occurred_at.toISOString() as Timestamp,
    recordedAt: row.recorded_at.toISOString() as Timestamp,
    causedBy: (row.caused_by ?? null) as EventId | null,
  },
});

const eventRecordToReplayFrontierEvent = (
  record: ProjectionEventRecord,
): ProjectionReplayFrontierEvent => ({
  eventId: record.event.id,
  sequence: record.sequence,
  type: record.event.type,
  entityId: record.event.entityId,
  recordedAt: record.event.recordedAt,
  contentHash: record.event.contentHash,
  authority: record.event.authority,
});

export class PostgresProjectionRunner implements ProjectionRunner {
  readonly #pool: pg.Pool;
  readonly #projections = new Map<string, Projection<unknown>>();
  #stateTableEnsured = false;

  constructor(pool: pg.Pool, _reader: EventReader) {
    this.#pool = pool;
  }

  async register<TState>(p: Projection<TState>): Promise<void> {
    await this.#ensureStateTable();
    this.#projections.set(p.name, p as Projection<unknown>);
  }

  async catchUp(tenantId: TenantId, name: string): Promise<void> {
    const p = this.#requireProjection(name);
    await this.#ensureCursor(tenantId, p);

    const cursor = await this.#readCursor(tenantId, p);
    const watermark = cursor.lastEventSeq;

    // Pull all matching events past the sequence cursor, in admitted log order.
    // recorded_at is still retained for compatibility and display, but it is
    // not the authority for replay identity.
    const flat = await this.#readProjectionEventRecords(tenantId, p, {
      afterSeq: watermark,
      limitPerPattern: 10_000,
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

      let last: ProjectionEventRecord | null = null;
      for (const record of flat) {
        state = await p.apply(state, record.event);
        last = record;
      }

      await c.query(
        `UPDATE projections.state
            SET state = $4::jsonb,
                updated_at = now()
          WHERE tenant_id = $1 AND projection_name = $2 AND projection_version = $3`,
        [tenantId, p.name, p.version, JSON.stringify(state)],
      );
      await c.query(
        `UPDATE projections.cursors
            SET last_event_id    = $4,
                last_event_seq   = $5,
                last_recorded_at = (SELECT recorded_at FROM events.events
                                     WHERE tenant_id = $1 AND id = $4 LIMIT 1),
                updated_at       = now()
          WHERE tenant_id = $1 AND projection_name = $2 AND projection_version = $3`,
        [tenantId, p.name, p.version, last!.event.id, last!.sequence],
      );
      await c.query("COMMIT");
    } catch (err) {
      await c.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      c.release();
    }
  }

  async getReplayFrontier(
    tenantId: TenantId,
    name: string,
  ): Promise<ProjectionReplayFrontier | null> {
    const p = this.#requireProjection(name);
    await this.#ensureCursor(tenantId, p);
    const cursor = await this.#readCursor(tenantId, p);

    if (
      cursor.lastEventId === null ||
      cursor.lastEventSeq === null
    ) {
      return {
        tenantId,
        projectionName: p.name,
        projectionVersion: p.version,
        replayedToEventId: null,
        replayedToPosition: 0,
        replayedToRecordedAt: null,
        consumedEventCount: 0,
        transitionEvents: [],
      };
    }

    const transitionRecords = await this.#readProjectionEventRecords(
      tenantId,
      p,
      {
        throughSeq: cursor.lastEventSeq,
        limitPerPattern: 100_000,
      },
    );

    return {
      tenantId,
      projectionName: p.name,
      projectionVersion: p.version,
      replayedToEventId: cursor.lastEventId,
      replayedToPosition: cursor.lastEventSeq,
      replayedToRecordedAt: cursor.lastRecordedAtText,
      consumedEventCount: transitionRecords.length,
      transitionEvents: transitionRecords.map(eventRecordToReplayFrontierEvent),
    };
  }

  async #readCursor(
    tenantId: TenantId,
    p: Projection<unknown>,
  ): Promise<{
    readonly lastEventId: EventId | null;
    readonly lastEventSeq: number | null;
    readonly lastRecordedAtText: string | null;
  }> {
    const cur = await this.#pool.query<CursorRow>(
      `SELECT last_event_id,
              last_event_seq,
              last_recorded_at::text AS last_recorded_at_text
         FROM projections.cursors
        WHERE tenant_id = $1 AND projection_name = $2 AND projection_version = $3`,
      [tenantId, p.name, p.version],
    );

    const row = cur.rows[0];
    const lastEventId = (row?.last_event_id ?? null) as EventId | null;
    let lastEventSeq =
      row?.last_event_seq === null || row?.last_event_seq === undefined
        ? null
        : parseEventSequence(row.last_event_seq);

    if (lastEventId !== null && lastEventSeq === null) {
      const backfill = await this.#pool.query<{ seq: string | number }>(
        `SELECT seq
           FROM events.events
          WHERE tenant_id = $1 AND id = $2
          LIMIT 1`,
        [tenantId, lastEventId],
      );
      const sequence = backfill.rows[0]?.seq;
      if (sequence === undefined) {
        throw new Error(
          `projection cursor references missing event: ${tenantId}/${String(lastEventId)}`,
        );
      }
      lastEventSeq = parseEventSequence(sequence);
    }

    return {
      lastEventId,
      lastEventSeq,
      lastRecordedAtText: row?.last_recorded_at_text ?? null,
    };
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
           (tenant_id, projection_name, projection_version, last_event_id, last_event_seq, last_recorded_at)
         VALUES ($1,$2,$3,NULL,NULL,NULL)
         ON CONFLICT (tenant_id, projection_name, projection_version) DO UPDATE
           SET last_event_id = NULL, last_event_seq = NULL, last_recorded_at = NULL, updated_at = now()`,
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
         (tenant_id, projection_name, projection_version, last_event_id, last_event_seq, last_recorded_at)
       VALUES ($1,$2,$3,NULL,NULL,NULL)
       ON CONFLICT DO NOTHING`,
      [tenantId, p.name, p.version],
    );
  }

  async #readProjectionEventRecords(
    tenantId: TenantId,
    p: Projection<unknown>,
    options: {
      readonly afterSeq?: number | null;
      readonly throughSeq?: number | null;
      readonly limitPerPattern: number;
    },
  ): Promise<readonly ProjectionEventRecord[]> {
    const batches = await Promise.all(
      p.consumes.map(async (pattern) => {
        const params: unknown[] = [tenantId, patternToSqlLike(pattern)];
        const where = ["tenant_id = $1", "type LIKE $2"];
        if (options.afterSeq !== undefined && options.afterSeq !== null) {
          params.push(options.afterSeq);
          where.push(`seq > $${params.length}`);
        }
        if (options.throughSeq !== undefined && options.throughSeq !== null) {
          params.push(options.throughSeq);
          where.push(`seq <= $${params.length}`);
        }
        params.push(options.limitPerPattern);

        const rows = await this.#pool.query<EventRow>(
          `SELECT seq, id, tenant_id, type, entity_id, emitted_by, payload_schema,
                  payload, occurred_at, recorded_at, caused_by, schema_version,
                  authority, content_hash, prior_event_hash
             FROM events.events
            WHERE ${where.join(" AND ")}
            ORDER BY seq ASC
            LIMIT $${params.length}`,
          params,
        );
        return rows.rows.map(rowToEventRecord);
      }),
    );

    return batches
      .flatMap((batch) => batch)
      .sort((a, b) => {
        if (a.sequence !== b.sequence) return a.sequence - b.sequence;
        return a.event.id < b.event.id ? -1 : a.event.id > b.event.id ? 1 : 0;
      });
  }
}
