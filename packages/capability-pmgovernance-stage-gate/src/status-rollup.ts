import type { PMEvent } from "@pm/types";

/**
 * pm-governance status rollup — a pure, deterministic projection over the
 * event log (refactor plan §4.4: "Reporting / dashboards / burndown" maps to
 * @pm/projections read-models, NOT the provenance tower). Mirrors the
 * capability-audit pattern: stateless apply, versioned initial state.
 */

export interface StatusRollupState {
  readonly advancedCount: number;
  readonly byToState: Readonly<Record<string, number>>;
  readonly byWorkItem: Readonly<Record<string, string>>;
  readonly lastEventId: string | null;
}

export const PM_STATUS_ROLLUP_PROJECTION = {
  name: "pm_governance.status_rollup",
  version: 1,
  /** Matches the stage-gate capability's emitted event type. */
  pattern: "pm.workitem.advanced",
  initial: (): StatusRollupState => ({
    advancedCount: 0,
    byToState: {},
    byWorkItem: {},
    lastEventId: null,
  }),
  apply: (state: StatusRollupState, event: PMEvent): StatusRollupState => {
    const payload = event.payload as {
      workItemId?: string;
      toState?: string;
    };
    const toState = payload.toState ?? "unknown";
    const workItemId = payload.workItemId ?? String(event.entityId);
    return {
      advancedCount: state.advancedCount + 1,
      byToState: {
        ...state.byToState,
        [toState]: (state.byToState[toState] ?? 0) + 1,
      },
      byWorkItem: { ...state.byWorkItem, [workItemId]: toState },
      lastEventId: String(event.id),
    };
  },
} as const;
