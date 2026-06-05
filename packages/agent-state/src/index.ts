import type { TenantId, Timestamp } from "@pm/types";

export type StateRefKind =
  | "event"
  | "graph_node"
  | "graph_edge"
  | "projection"
  | "workflow_run"
  | "continuity_checkpoint"
  | "capability_invocation"
  | "source_record"
  | "document";

export interface StateRef {
  readonly kind: StateRefKind;
  readonly id: string;
  readonly label?: string;
}

export interface StateConflict {
  readonly conflictType:
    | "source_authority_conflict"
    | "state_disagreement"
    | "stale_observation"
    | "workflow_position_conflict";
  readonly refs: readonly StateRef[];
  readonly message: string;
}

export interface AllowedAction {
  readonly actionType: string;
  readonly label: string;
  readonly requiredRefs: readonly StateRef[];
  readonly requiredWorkflowPosition?: string;
}

export interface CurrentStateView {
  readonly tenantId: TenantId;
  readonly viewId: string;
  readonly subject: StateRef;
  readonly observedAt: Timestamp;
  readonly validUntil?: Timestamp;
  readonly authorityRule: string;
  readonly projectionVersion?: number;
  readonly workflowPosition?: string;
  readonly sourceRefs: readonly StateRef[];
  readonly missingSources: readonly string[];
  readonly conflicts: readonly StateConflict[];
  readonly allowedActions: readonly AllowedAction[];
}

export interface ReadSetEntry {
  readonly ref: StateRef;
  readonly observedAt: Timestamp;
  readonly validUntil?: Timestamp;
  readonly authority: string;
  readonly projectionVersion?: number;
}

export interface ProposedAction {
  readonly tenantId: TenantId;
  readonly actionType: string;
  readonly subject: StateRef;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly readSet: readonly ReadSetEntry[];
  readonly proposedBy: string;
  readonly proposedAt: Timestamp;
}

export type ReadSetValidationIssueCode =
  | "tenant_mismatch"
  | "action_not_allowed"
  | "missing_read_ref"
  | "stale_read_ref"
  | "current_view_conflict"
  | "authority_mismatch"
  | "projection_version_mismatch"
  | "workflow_position_mismatch";

export interface ReadSetValidationIssue {
  readonly code: ReadSetValidationIssueCode;
  readonly path: string;
  readonly message: string;
  readonly ref?: StateRef;
}

export interface ReadSetValidationDecision {
  readonly valid: boolean;
  readonly mode: "warn";
  readonly issues: readonly ReadSetValidationIssue[];
}

export interface EvidenceLinkedContinuityPayload
  extends Readonly<Record<string, unknown>> {
  readonly sourceRefs: readonly StateRef[];
  readonly validUntil?: Timestamp;
  readonly supersedes: readonly string[];
  readonly contradictedBy: readonly string[];
  readonly authorityRule: string;
  readonly currentStateViewId: string;
}

export function stateRef(kind: StateRefKind, id: string, label?: string): StateRef {
  return label === undefined ? { kind, id } : { kind, id, label };
}

export function buildReadSetFromCurrentStateView(
  view: CurrentStateView,
  authority: string,
): readonly ReadSetEntry[] {
  return view.sourceRefs.map((ref) => {
    const entry: ReadSetEntry = {
      ref,
      observedAt: view.observedAt,
      authority,
      ...(view.validUntil !== undefined ? { validUntil: view.validUntil } : {}),
      ...(view.projectionVersion !== undefined
        ? { projectionVersion: view.projectionVersion }
        : {}),
    };
    return entry;
  });
}

export function validateProposedActionReadSet(
  action: ProposedAction,
  view: CurrentStateView,
): ReadSetValidationDecision {
  const issues: ReadSetValidationIssue[] = [];
  const allowedAction = view.allowedActions.find(
    (candidate) => candidate.actionType === action.actionType,
  );

  if (action.tenantId !== view.tenantId) {
    issues.push({
      code: "tenant_mismatch",
      path: "/tenantId",
      message: `Proposed action tenant ${action.tenantId} does not match current state view tenant ${view.tenantId}.`,
    });
  }

  if (!allowedAction) {
    issues.push({
      code: "action_not_allowed",
      path: "/actionType",
      message: `Action type ${action.actionType} is not listed in the current state view allowed actions.`,
    });
  }

  for (const [index, conflict] of view.conflicts.entries()) {
    issues.push({
      code: "current_view_conflict",
      path: `/conflicts/${index}`,
      message: conflict.message,
      ...(conflict.refs[0] ? { ref: conflict.refs[0] } : {}),
    });
  }

  if (allowedAction) {
    for (const ref of allowedAction.requiredRefs) {
      if (!action.readSet.some((entry) => sameStateRef(entry.ref, ref))) {
        issues.push({
          code: "missing_read_ref",
          path: "/readSet",
          message: `Proposed action did not cite required state ref ${formatStateRef(ref)}.`,
          ref,
        });
      }
    }
  }

  for (const [index, missingSource] of view.missingSources.entries()) {
    issues.push({
      code: "missing_read_ref",
      path: `/missingSources/${index}`,
      message: `Current state view is missing required source ${missingSource}.`,
    });
  }

  for (const [index, entry] of action.readSet.entries()) {
    if (entry.validUntil !== undefined && isAfter(action.proposedAt, entry.validUntil)) {
      issues.push({
        code: "stale_read_ref",
        path: `/readSet/${index}/validUntil`,
        message: `Read-set ref ${formatStateRef(entry.ref)} expired at ${entry.validUntil} before action proposal at ${action.proposedAt}.`,
        ref: entry.ref,
      });
    }
  }

  for (const [index, entry] of action.readSet.entries()) {
    if (entry.authority !== view.authorityRule) {
      issues.push({
        code: "authority_mismatch",
        path: `/readSet/${index}/authority`,
        message: `Read-set ref ${formatStateRef(entry.ref)} used authority ${entry.authority}; current view requires ${view.authorityRule}.`,
        ref: entry.ref,
      });
    }
  }

  for (const [index, entry] of action.readSet.entries()) {
    if (
      entry.projectionVersion !== undefined &&
      view.projectionVersion !== undefined &&
      entry.projectionVersion !== view.projectionVersion
    ) {
      issues.push({
        code: "projection_version_mismatch",
        path: `/readSet/${index}/projectionVersion`,
        message: `Read-set ref ${formatStateRef(entry.ref)} used projection version ${entry.projectionVersion}; current view is ${view.projectionVersion}.`,
        ref: entry.ref,
      });
    }
  }

  if (
    allowedAction?.requiredWorkflowPosition !== undefined &&
    view.workflowPosition !== undefined &&
    allowedAction.requiredWorkflowPosition !== view.workflowPosition
  ) {
    issues.push({
      code: "workflow_position_mismatch",
      path: "/workflowPosition",
      message: `Action ${action.actionType} requires workflow position ${allowedAction.requiredWorkflowPosition}; current position is ${view.workflowPosition}.`,
    });
  }

  return { valid: issues.length === 0, mode: "warn", issues };
}

function sameStateRef(left: StateRef, right: StateRef): boolean {
  return left.kind === right.kind && left.id === right.id;
}

function formatStateRef(ref: StateRef): string {
  return `${ref.kind}:${ref.id}`;
}

function isAfter(left: Timestamp, right: Timestamp): boolean {
  return Date.parse(left) > Date.parse(right);
}
