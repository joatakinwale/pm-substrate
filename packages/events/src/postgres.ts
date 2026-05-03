/**
 * Postgres-backed event store. Day-1 implementation of the events layer.
 *
 * Design notes:
 *   - `publish()` writes the row inside whatever transaction the caller passes
 *     (a `PoolClient` mid-BEGIN), then calls pg_notify on the same connection.
 *     If the caller's tx rolls back, the NOTIFY rolls back with it (NOTIFYs
 *     are part of the transaction). This is what makes graph mutation +
 *     event publish atomic, per architecture.md Layer 2 rule.
 *
 *   - LISTEN/NOTIFY payloads are deliberately small: only the event id +
 *     tenant + type. Subscribers read the full row from the events table.
 *     This avoids the 8KB NOTIFY payload cap and keeps NOTIFY costs bounded.
 *
 *   - Subscribers consume via a single LISTEN connection per process. Multiple
 *     subscribers in the same process share the connection; the router fans
 *     out in JS. NOTIFY is per-tenant (`events_<tenant_id>`), so cross-tenant
 *     traffic doesn't wake unrelated subscribers.
 *
 *   - Catch-up: on `consume()`, the router reads any unacked rows newer than
 *     `last_acked_recorded_at` before yielding live NOTIFY events. This makes
 *     the system durable across subscriber restarts; falsification mode #4
 *     (Postgres-only stack collapses) shows up here if catch-up can't keep up.
 */

import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import type {
  EntityId,
  EventId,
  PMEvent,
  Subscription,
  TenantId,
  Timestamp,
} from "@pm/types";
import pg from "pg";
import type {
  EventPublisher,
  EventReader,
  PublishInput,
  ReadQuery,
  SubscriptionRouter,
} from "./interfaces.js";
import { patternToSqlLike } from "./pattern.js";

/**
 * Tenant id sanitization for use in NOTIFY channel names. Channel identifiers
 * are case-sensitive ASCII; we hash anything outside [a-z0-9_] to keep this
 * boring. Substrate tenants are expected to use lowercase identifiers anyway.
 */
const channelFor = (tenantId: TenantId): string => {
  const safe = tenantId.replace(/[^a-z0-9_]/gi, "_").toLowerCase();
  // Postgres identifier limit is 63; "events_" prefix + 56 chars of tenant.
  return `events_${safe}`.slice(0, 63);
};

interface NotifyMsg {
  readonly id: EventId;
  readonly tenant: TenantId;
  readonly type: string;
}

const isNotifyMsg = (v: unknown): v is NotifyMsg =>
  typeof v === "object" &&
  v !== null &&
  typeof (v as NotifyMsg).id === "string" &&
  typeof (v as NotifyMsg).tenant === "string" &&
  typeof (v as NotifyMsg).type === "string";

interface RowShape {
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
}

const rowToEvent = (row: RowShape): PMEvent => ({
  id: row.id as EventId,
  tenantId: row.tenant_id as TenantId,
  type: row.type,
  entityId: row.entity_id as EntityId,
  emittedBy: row.emitted_by,
  payloadSchema: row.payload_schema,
  payload: row.payload ?? {},
  occurredAt: row.occurred_at.toISOString() as Timestamp,
  recordedAt: row.recorded_at.toISOString() as Timestamp,
  causedBy: (row.caused_by ?? null) as EventId | null,
});

export class PostgresEventStore
  implements EventPublisher, EventReader, SubscriptionRouter
{
  /** Pool used for read queries and one-off writes. */
  readonly #pool: pg.Pool;

  /**
   * Long-lived dedicated connection for LISTEN/NOTIFY. Lazily acquired on
   * first `consume()` call. One per store instance / process.
   */
  #listenClient: pg.PoolClient | null = null;
  #listenChannels = new Set<string>();

  /**
   * In-process fan-out. Keyed by tenant id; emits `event` with a `NotifyMsg`.
   */
  readonly #bus = new EventEmitter();

  constructor(pool: pg.Pool) {
    this.#pool = pool;
    this.#bus.setMaxListeners(0);
  }

  // -------------------------------------------------------------------------
  // EventPublisher
  // -------------------------------------------------------------------------

  /**
   * Publish via the pool. Equivalent to `publishWith(pool, input)` — used by
   * callers that don't have an active transaction (e.g. test harnesses,
   * external triggers).
   */
  async publish(input: PublishInput): Promise<PMEvent> {
    const client = await this.#pool.connect();
    try {
      await client.query("BEGIN");
      const ev = await this.publishWith(client, input);
      await client.query("COMMIT");
      return ev;
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Publish on a caller-supplied client (so a graph mutation and its event
   * commit atomically). The caller owns BEGIN/COMMIT/ROLLBACK.
   */
  async publishWith(
    client: pg.ClientBase,
    input: PublishInput,
  ): Promise<PMEvent> {
    const id = `evt_${randomUUID()}`;
    const occurredAt =
      input.occurredAt ?? (new Date().toISOString() as Timestamp);

    const result = await client.query<RowShape>(
      `INSERT INTO events.events
        (id, tenant_id, type, entity_id, emitted_by, payload_schema,
         payload, occurred_at, caused_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9)
       RETURNING id, tenant_id, type, entity_id, emitted_by, payload_schema,
                 payload, occurred_at, recorded_at, caused_by`,
      [
        id,
        input.tenantId,
        input.type,
        input.entityId,
        input.emittedBy,
        input.payloadSchema,
        JSON.stringify(input.payload ?? {}),
        occurredAt,
        input.causedBy ?? null,
      ],
    );

    const event = rowToEvent(result.rows[0]!);

    // pg_notify is transactional: if the caller rolls back, this is undone.
    const msg: NotifyMsg = {
      id: event.id,
      tenant: event.tenantId,
      type: event.type,
    };
    await client.query(`SELECT pg_notify($1, $2)`, [
      channelFor(event.tenantId),
      JSON.stringify(msg),
    ]);

    return event;
  }

  // -------------------------------------------------------------------------
  // EventReader
  // -------------------------------------------------------------------------

  async read(query: ReadQuery): Promise<readonly PMEvent[]> {
    const limit = Math.min(query.limit ?? 1000, 10_000);
    const params: unknown[] = [query.tenantId];
    const where: string[] = ["tenant_id = $1"];

    if (query.typePattern && query.typePattern !== "*") {
      params.push(patternToSqlLike(query.typePattern));
      where.push(`type LIKE $${params.length}`);
    }
    if (query.entityId) {
      params.push(query.entityId);
      where.push(`entity_id = $${params.length}`);
    }
    if (query.since) {
      params.push(query.since);
      where.push(`occurred_at >= $${params.length}`);
    }
    if (query.until) {
      params.push(query.until);
      where.push(`occurred_at < $${params.length}`);
    }
    params.push(limit);

    const rows = await this.#pool.query<RowShape>(
      `SELECT id, tenant_id, type, entity_id, emitted_by, payload_schema,
              payload, occurred_at, recorded_at, caused_by
         FROM events.events
        WHERE ${where.join(" AND ")}
        ORDER BY recorded_at ASC, id ASC
        LIMIT $${params.length}`,
      params,
    );
    return rows.rows.map(rowToEvent);
  }

  async getById(
    tenantId: TenantId,
    id: EventId,
  ): Promise<PMEvent | null> {
    const r = await this.#pool.query<RowShape>(
      `SELECT id, tenant_id, type, entity_id, emitted_by, payload_schema,
              payload, occurred_at, recorded_at, caused_by
         FROM events.events
        WHERE tenant_id = $1 AND id = $2
        LIMIT 1`,
      [tenantId, id],
    );
    return r.rows[0] ? rowToEvent(r.rows[0]) : null;
  }

  // -------------------------------------------------------------------------
  // SubscriptionRouter
  // -------------------------------------------------------------------------

  async subscribe(sub: Subscription): Promise<void> {
    await this.#pool.query(
      `INSERT INTO events.subscriptions
        (tenant_id, subscriber_id, event_type_pattern, entity_type_filter)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (tenant_id, subscriber_id, event_type_pattern) DO UPDATE
         SET entity_type_filter = EXCLUDED.entity_type_filter`,
      [
        sub.tenantId,
        sub.subscriberId,
        sub.eventTypePattern,
        sub.entityTypeFilter ?? null,
      ],
    );
  }

  async unsubscribe(
    tenantId: TenantId,
    subscriberId: string,
  ): Promise<void> {
    await this.#pool.query(
      `DELETE FROM events.subscriptions WHERE tenant_id = $1 AND subscriber_id = $2`,
      [tenantId, subscriberId],
    );
  }

  /**
   * Acknowledge processed events up through a given event id. Subscribers MUST
   * call this after durably handling each event (or batch); otherwise restarts
   * will re-deliver. (At-least-once semantics by design.)
   */
  async acknowledge(
    tenantId: TenantId,
    subscriberId: string,
    eventId: EventId,
  ): Promise<void> {
    await this.#pool.query(
      `UPDATE events.subscriptions
          SET last_acked_event_id    = $3,
              last_acked_recorded_at = (SELECT recorded_at FROM events.events
                                         WHERE tenant_id = $1 AND id = $3 LIMIT 1)
        WHERE tenant_id = $1 AND subscriber_id = $2`,
      [tenantId, subscriberId, eventId],
    );
  }

  /**
   * The subscriber's main loop. Yields:
   *   1. Catch-up events (rows recorded after last_acked_recorded_at), then
   *   2. Live events delivered via LISTEN/NOTIFY, filtered against the
   *      subscriber's registered patterns.
   */
  async *consume(
    tenantId: TenantId,
    subscriberId: string,
  ): AsyncIterable<PMEvent> {
    await this.#ensureListening(tenantId);

    // Catch-up phase. Pull subscriber's patterns + last-acked watermark.
    const subRows = await this.#pool.query<{
      event_type_pattern: string;
      last_acked_recorded_at: Date | null;
    }>(
      `SELECT event_type_pattern, last_acked_recorded_at
         FROM events.subscriptions
        WHERE tenant_id = $1 AND subscriber_id = $2`,
      [tenantId, subscriberId],
    );
    if (subRows.rows.length === 0) {
      throw new Error(
        `consume(${subscriberId}): no subscriptions registered for tenant ${tenantId}`,
      );
    }
    const patterns = subRows.rows.map((r) => r.event_type_pattern);
    const watermark = subRows.rows
      .map((r) => r.last_acked_recorded_at)
      .reduce<Date | null>(
        (lo, d) => (d && (!lo || d < lo) ? d : lo),
        null,
      );

    const likes = patterns.map(patternToSqlLike);
    const catchupParams: unknown[] = [tenantId];
    let placeholderIdx = 2;
    const likeClause = likes
      .map(() => `type LIKE $${placeholderIdx++}`)
      .join(" OR ");
    catchupParams.push(...likes);
    let watermarkClause = "";
    if (watermark) {
      catchupParams.push(watermark.toISOString());
      watermarkClause = `AND recorded_at > $${placeholderIdx++}`;
    }

    const catchup = await this.#pool.query<RowShape>(
      `SELECT id, tenant_id, type, entity_id, emitted_by, payload_schema,
              payload, occurred_at, recorded_at, caused_by
         FROM events.events
        WHERE tenant_id = $1 AND (${likeClause}) ${watermarkClause}
        ORDER BY recorded_at ASC, id ASC`,
      catchupParams,
    );

    for (const row of catchup.rows) {
      yield rowToEvent(row);
    }

    // Live phase. Bridge the EventEmitter into an async iterator with a queue.
    const queue: NotifyMsg[] = [];
    let resolver: (() => void) | null = null;
    const onMsg = (msg: NotifyMsg) => {
      if (msg.tenant !== tenantId) return;
      if (!patterns.some((p) => matchesType(p, msg.type))) return;
      queue.push(msg);
      resolver?.();
      resolver = null;
    };
    this.#bus.on("event", onMsg);

    try {
      while (true) {
        if (queue.length === 0) {
          await new Promise<void>((res) => {
            resolver = res;
          });
        }
        const msg = queue.shift();
        if (!msg) continue;
        const ev = await this.getById(tenantId, msg.id);
        if (ev) yield ev;
      }
    } finally {
      this.#bus.off("event", onMsg);
    }
  }

  // -------------------------------------------------------------------------
  // Internal: LISTEN management
  // -------------------------------------------------------------------------

  async #ensureListening(tenantId: TenantId): Promise<void> {
    const channel = channelFor(tenantId);
    if (this.#listenChannels.has(channel)) return;

    if (!this.#listenClient) {
      this.#listenClient = await this.#pool.connect();
      this.#listenClient.on("notification", (msg) => {
        if (!msg.payload) return;
        let parsed: unknown;
        try {
          parsed = JSON.parse(msg.payload);
        } catch {
          return;
        }
        if (isNotifyMsg(parsed)) {
          this.#bus.emit("event", parsed);
        }
      });
      // Don't release; keep this connection open for the life of the store.
    }

    await this.#listenClient.query(`LISTEN "${channel}"`);
    this.#listenChannels.add(channel);
  }

  /** Cleanly stop listening and release the LISTEN connection. */
  async close(): Promise<void> {
    if (this.#listenClient) {
      for (const ch of this.#listenChannels) {
        await this.#listenClient.query(`UNLISTEN "${ch}"`).catch(() => {});
      }
      this.#listenChannels.clear();
      this.#listenClient.release();
      this.#listenClient = null;
    }
  }
}

// Local re-import to avoid circular module reference at top of file.
// Pattern matching reuses the exported helper.
import { matchesPattern as matchesType } from "./pattern.js";
