import type { ProfileEntity } from "@pm/types";

/**
 * PM-governance profile concrete entity types (refactor plan §4.1).
 *
 * PM methodology expressed on the seven Tier-1 primitives. Identity primacy:
 * Initiative — every record reaches an Initiative through edges.
 *
 * G4 anti-fixation rule: building this package must not require any change
 * to packages/types, graph, events, registry, workflow, projections,
 * profile-registry, or substrate-http. Enforced by
 * scripts/validate-zero-edit-plugin.ts.
 */

/** Initiative — the governed unit of work (project/program). Engagement. */
export interface Initiative
  extends ProfileEntity<{
    title: string;
    scopeStart: string | null;
    scopeEnd: string | null;
    state: string;
  }> {}

/** WorkItem — a stage-gated task inside an Initiative. Engagement. */
export interface WorkItem
  extends ProfileEntity<{
    title: string;
    scopeStart: string | null;
    scopeEnd: string | null;
    state: string;
    priority: string;
  }> {}

/** Milestone — a gate that passes or fails at a point in time. Event. */
export interface Milestone
  extends ProfileEntity<{
    kind: string;
    occurredAt: string;
    gateState: string;
  }> {}

/** Deliverable — a produced artifact. Document. */
export interface Deliverable
  extends ProfileEntity<{
    sha256: string;
    mimeType: string;
    filename: string;
  }> {}

/** AgentRole — a human or AI actor holding RACI assignments. Resource. */
export interface AgentRole
  extends ProfileEntity<{
    name: string;
    /** "agent" | "human" — profile-level discriminator. */
    kind: string;
  }> {}

/** Stakeholder — an external party informed/consulted. Counterparty. */
export interface Stakeholder
  extends ProfileEntity<{
    name: string;
    email?: string | null;
    phone?: string | null;
    externalRef?: string | null;
  }> {}

/** ApprovalRequest — a decision record gating an action. Event. */
export interface ApprovalRequest
  extends ProfileEntity<{
    kind: string;
    occurredAt: string;
    decisionState: string;
  }> {}
