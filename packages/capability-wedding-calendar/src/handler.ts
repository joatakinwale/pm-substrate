/**
 * CalendarEventHandler \u2014 the load-bearing logic of the wedding.calendar
 * capability.
 *
 * Triggered by the wedding.task.created event. Creates a CalendarEvent
 * graph node, a PlannerTask \u2192 CalendarEvent edge, and emits
 * wedding.calendar.event_created in a single Postgres transaction.
 *
 * Idempotency: at most one CalendarEvent per task (the
 * `task_calendar_event` edge has cardinality at-most:1 from the task
 * side). If wedding.task.created fires twice for the same taskId, the
 * second handler call detects the existing edge and exits clean.
 *
 * Time policy: the substrate has no opinion on when calendar events
 * happen. The default policy schedules events 7 days out at 09:00 UTC
 * for 1 hour. Tenants can override via a TimePolicy.
 *
 * Architecture: handler reads the upstream event payload and writes
 * through Graph + EventStore. It does NOT call back into wedding.tasks,
 * does NOT consult the registry, does NOT know what (if anything)
 * subscribes to wedding.calendar.event_created.
 */

import type { EventPublisher, PublishInput } from "@pm/events";
import type { Graph } from "@pm/graph";
import type { ProfileValidator } from "@pm/profile-registry";
import type { EntityId, TenantId } from "@pm/types";
import pg from "pg";

export interface TaskCreatedPayload {
  /** EntityId of the task that was created. */
  readonly taskId: EntityId;
  /** EntityId of the contract that spawned the task. */
  readonly contractId: EntityId;
  /** Domain task kind (e.g., "vendor_walkthrough"). */
  readonly taskKind: string;
  readonly title: string;
  readonly category: string;
  readonly priority: string;
}

export interface CalendarRuntimeDeps {
  readonly pool: pg.Pool;
  readonly graph: Graph;
  readonly events: EventPublisher;
  readonly validator: ProfileValidator;
  readonly emittedBy?: string;
}

type TransactionalEvents = EventPublisher & {
  publishWith(
    client: pg.ClientBase,
    input: PublishInput,
  ): Promise<ReturnType<EventPublisher["publish"]>>;
};

export interface TimePolicy {
  /** Returns ISO-8601 UTC start time for a calendar event given a task. */
  startFor(payload: TaskCreatedPayload, now: Date): string;
  /** Duration in minutes. */
  durationMinutes(payload: TaskCreatedPayload): number;
  timezone(payload: TaskCreatedPayload): string;
}

export const DEFAULT_TIME_POLICY: TimePolicy = {
  startFor: (_payload, now) => {
    const start = new Date(now);
    start.setUTCDate(start.getUTCDate() + 7);
    start.setUTCHours(9, 0, 0, 0);
    return start.toISOString();
  },
  durationMinutes: () => 60,
  timezone: () => "UTC",
};

export class CalendarEventHandler {
  readonly #pool: pg.Pool;
  readonly #graph: Graph;
  readonly #events: TransactionalEvents;
  readonly #emittedBy: string;
  readonly #timePolicy: TimePolicy;
  readonly #now: () => Date;

  constructor(
    deps: CalendarRuntimeDeps & {
      timePolicy?: TimePolicy;
      now?: () => Date;
    },
  ) {
    this.#pool = deps.pool;
    this.#graph = deps.graph;
    this.#events = deps.events as TransactionalEvents;
    this.#emittedBy = deps.emittedBy ?? "wedding.calendar";
    this.#timePolicy = deps.timePolicy ?? DEFAULT_TIME_POLICY;
    this.#now = deps.now ?? (() => new Date());
  }

  async handle(
    tenantId: TenantId,
    payload: TaskCreatedPayload,
  ): Promise<EntityId | null> {
    // Idempotency: if a CalendarEvent already exists for this task, exit.
    const existingEdges = await this.#graph.outgoingEdges(
      tenantId,
      payload.taskId,
      "wedding/task_calendar_event",
    );
    if (existingEdges.length > 0) {
      return null;
    }

    const startAt = this.#timePolicy.startFor(payload, this.#now());
    const durationMin = this.#timePolicy.durationMinutes(payload);
    const startMs = Date.parse(startAt);
    const endAt = new Date(startMs + durationMin * 60_000).toISOString();
    const tz = this.#timePolicy.timezone(payload);

    const c = await this.#pool.connect();
    try {
      await c.query("BEGIN");

      const { node: eventNode } = await (this.#graph as Graph & {
        createNode: (
          input: Parameters<Graph["createNode"]>[0],
          tx?: pg.ClientBase,
        ) => ReturnType<Graph["createNode"]>;
      }).createNode(
        {
          tenantId,
          profile: {
            tier1: "Resource",
            profile: "wedding",
            concrete: "CalendarEvent",
          },
          identity: {
            title: payload.title,
            kind: "task_block",
            startAt,
            endAt,
            timezone: tz,
            state: "scheduled",
            sourceType: "wedding.calendar",
            externalRef: `task:${payload.taskId}`,
          },
          schemaVersion: 1,
        },
        c,
      );

      await (this.#graph as Graph & {
        createEdge: (
          input: Parameters<Graph["createEdge"]>[0],
          tx?: pg.ClientBase,
        ) => ReturnType<Graph["createEdge"]>;
      }).createEdge(
        {
          tenantId,
          type: "wedding/task_calendar_event",
          fromId: payload.taskId,
          toId: eventNode.id,
          attrs: {},
        },
        c,
      );

      await this.#events.publishWith(c, {
        tenantId,
        type: "wedding.calendar.event_created",
        entityId: eventNode.id as EntityId,
        emittedBy: this.#emittedBy,
        payloadSchema: "wedding.calendar.event_created/v1",
        payload: {
          calendarEventId: eventNode.id,
          taskId: payload.taskId,
          contractId: payload.contractId,
          startAt,
          endAt,
          timezone: tz,
        },
      });

      await c.query("COMMIT");
      return eventNode.id as EntityId;
    } catch (err) {
      await c.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      c.release();
    }
  }
}
