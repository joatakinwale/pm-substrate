import {
  defineCapability,
  NoopOnConflict,
  type CapabilityHandler,
  type CapabilityRuntimeDeps,
} from "@pm/capability-kit";
import type { ProfileRegistry } from "@pm/profile-registry";
import { WORK_ITEM_LIFECYCLE } from "@pm/profile-pmgovernance";
import type { EntityId, TenantId } from "@pm/types";

/**
 * pm.stage-gate handler (refactor plan Phase 2, §4.5).
 *
 * On `pm.approval.approved`: walk pmgovernance/requests from the
 * ApprovalRequest to its exactly-one WorkItem, validate the stage-gate
 * transition (in_review → done) against the tenant's INSTALLED profile —
 * the substrate checks legality; this capability decides to move — and apply
 * it idempotently inside one transaction, with the kit's freshness gate
 * refusing stale WorkItem reads.
 *
 * Approvals for WorkItems that are not in an advanceable state are clean
 * no-ops (the gate did not open), recorded via the idempotency row so the
 * same decision never re-fires.
 */

export interface StageGateEventPayload {
  readonly approvalRequestId: EntityId;
  /** Stable caller-assigned id — the idempotency key. */
  readonly gateEventId: string;
  readonly decidedBy: string;
  readonly decidedAt: string;
  readonly reason?: string;
}

export interface StageGateRuntimeDeps extends CapabilityRuntimeDeps {
  readonly profileRegistry: ProfileRegistry;
  readonly emittedBy?: string;
  /** Freshness budget for the locked WorkItem read. Default 30 days. */
  readonly freshnessMaxAgeMs?: number;
}

interface StageGateApplyResult {
  readonly fromState: string;
  readonly toState: string;
}

const ADVANCE: Readonly<Record<string, string>> = Object.fromEntries(
  WORK_ITEM_LIFECYCLE.transitions
    .filter((t) => t.trigger === "pm.approval.approved")
    .flatMap((t) => t.from.map((f) => [f, t.to])),
);

export class StageGateHandler {
  readonly #compiled: CapabilityHandler<StageGateEventPayload>;

  constructor(deps: StageGateRuntimeDeps) {
    const emittedBy = deps.emittedBy ?? "pm.stage-gate";

    this.#compiled = defineCapability<StageGateEventPayload, StageGateApplyResult>(
      {
        name: emittedBy,
        idempotency: {
          table: "pm_governance.applied_gate_events",
          keyColumn: "gate_event_id",
        },
        extractIdempotencyKey: (p) =>
          typeof p.gateEventId === "string" && p.gateEventId.length > 0
            ? p.gateEventId
            : NoopOnConflict,
        freshness: {
          maxAgeMs: deps.freshnessMaxAgeMs ?? 30 * 24 * 60 * 60 * 1000,
        },

        // Walk: ApprovalRequest → requests → WorkItem (exactly one).
        walk: async ({ tenantId, payload, graph }) => {
          const edges = await graph.outgoingEdges(
            tenantId,
            payload.approvalRequestId,
            "pmgovernance/requests",
          );
          return edges.length > 0 ? (edges[0]!.toId as EntityId) : null;
        },

        // Apply: legality-checked stage-gate advancement.
        apply: async ({ tenantId, payload, currentIdentity }) => {
          const fromState = String(currentIdentity["state"] ?? "");
          const toState = ADVANCE[fromState];
          if (toState === undefined) {
            // Gate did not open: approval arrived while the WorkItem was not
            // in an advanceable state. Clean no-op, idempotency retained.
            return null;
          }
          // The substrate validates legality; the capability decides to move.
          const validator = await deps.profileRegistry.validator(
            tenantId as TenantId,
          );
          validator.validateLifecycleTransition({
            tenantId: tenantId as TenantId,
            profile: { tier1: "Engagement", profile: "pmgovernance", concrete: "WorkItem" },
            currentState: fromState,
            proposedState: toState,
          });
          void payload;
          return {
            nextIdentity: { ...currentIdentity, state: toState },
            applyResult: { fromState, toState },
          };
        },

        emit: ({ tenantId, payload, targetId, applyResult }) =>
          applyResult === undefined || targetId === null
            ? null
            : {
                tenantId: tenantId as TenantId,
                type: "pm.workitem.advanced",
                entityId: targetId,
                emittedBy,
                payloadSchema: "pm.workitem.advanced.v1",
                payload: {
                  workItemId: targetId,
                  fromState: applyResult.fromState,
                  toState: applyResult.toState,
                  approvalRequestId: payload.approvalRequestId,
                  sourceGateEventId: payload.gateEventId,
                  ...(payload.reason !== undefined
                    ? { reason: payload.reason }
                    : {}),
                },
              },
      },
      deps,
    );
  }

  get name(): string {
    return this.#compiled.name;
  }

  async handle(tenantId: TenantId, payload: StageGateEventPayload): Promise<void> {
    return this.#compiled.handle(tenantId, payload);
  }
}
