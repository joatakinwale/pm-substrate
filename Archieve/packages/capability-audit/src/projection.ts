import type { Projection } from "@pm/projections";
import type { EntityId, PMEvent, TenantId } from "@pm/types";

/**
 * One audit row per event. Append-only by construction; the projection
 * never mutates a previously-stored entry.
 */
export interface AuditEntry {
  readonly eventId: string;
  readonly type: string;
  readonly entityId: EntityId;
  readonly emittedBy: string;
  readonly recordedAt: string;
  readonly causedBy: string | null;
}

export interface AuditState {
  readonly entries: readonly AuditEntry[];
  readonly count: number;
  /** Top-N event types by frequency. Useful for operator dashboards. */
  readonly byType: Readonly<Record<string, number>>;
}

const initial = (_tenantId: TenantId): AuditState => ({
  entries: [],
  count: 0,
  byType: {},
});

const apply = (state: AuditState, event: PMEvent): AuditState => {
  const entry: AuditEntry = {
    eventId: event.id,
    type: event.type,
    entityId: event.entityId,
    emittedBy: event.emittedBy,
    recordedAt: event.recordedAt,
    causedBy: event.causedBy,
  };
  return {
    entries: [...state.entries, entry],
    count: state.count + 1,
    byType: {
      ...state.byType,
      [event.type]: (state.byType[event.type] ?? 0) + 1,
    },
  };
};

/**
 * The audit projection. Versioned at 1 — bumping triggers a rebuild from
 * log start, which produces the same materialized state because the apply
 * function is deterministic.
 */
export const auditProjection: Projection<AuditState> = {
  name: "common/audit-log",
  version: 1,
  consumes: ["*"],
  initial,
  apply,
};
