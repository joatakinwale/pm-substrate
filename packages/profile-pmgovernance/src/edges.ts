import type { EdgeTypeDef } from "@pm/types";

/**
 * PM-governance edge catalog (refactor plan §4.2).
 *
 * RACI as typed edges with enforced cardinality. The single-accountability
 * rule ("one A per WorkItem") is enforced FOR FREE by the substrate's edge
 * cardinality validator: accountable_to has fromCardinality "exactly:1", so a
 * second accountable_to edge from the same WorkItem is refused at write time.
 * No provenance tower required.
 */

/** WorkItem → AgentRole. THE RACI "A": exactly one accountable owner. */
export const ACCOUNTABLE_TO: EdgeTypeDef = {
  name: "accountable_to",
  fromTypes: ["WorkItem"],
  toTypes: ["AgentRole"],
  fromCardinality: "exactly:1",
  toCardinality: "unbounded",
};

/** AgentRole → WorkItem. RACI "R": any number of responsible doers. */
export const RESPONSIBLE_FOR: EdgeTypeDef = {
  name: "responsible_for",
  fromTypes: ["AgentRole"],
  toTypes: ["WorkItem"],
  fromCardinality: "unbounded",
  toCardinality: "unbounded",
};

/** AgentRole → WorkItem. RACI "C". */
export const CONSULTED_ON: EdgeTypeDef = {
  name: "consulted_on",
  fromTypes: ["AgentRole"],
  toTypes: ["WorkItem"],
  fromCardinality: "unbounded",
  toCardinality: "unbounded",
};

/** AgentRole/Stakeholder → WorkItem. RACI "I". */
export const INFORMED_OF: EdgeTypeDef = {
  name: "informed_of",
  fromTypes: ["AgentRole", "Stakeholder"],
  toTypes: ["WorkItem"],
  fromCardinality: "unbounded",
  toCardinality: "unbounded",
};

/** WorkItem → Initiative. Every WorkItem belongs to exactly one Initiative. */
export const PART_OF: EdgeTypeDef = {
  name: "part_of",
  fromTypes: ["WorkItem"],
  toTypes: ["Initiative"],
  fromCardinality: "exactly:1",
  toCardinality: "unbounded",
};

/** WorkItem → WorkItem. Dependency DAG (cycle check is workflow's job). */
export const DEPENDS_ON: EdgeTypeDef = {
  name: "depends_on",
  fromTypes: ["WorkItem"],
  toTypes: ["WorkItem"],
  fromCardinality: "unbounded",
  toCardinality: "unbounded",
};

/** Milestone → WorkItem. A gate covers one or more WorkItems. */
export const GATED_BY: EdgeTypeDef = {
  name: "gated_by",
  fromTypes: ["Milestone"],
  toTypes: ["WorkItem"],
  fromCardinality: "unbounded",
  toCardinality: "unbounded",
};

/** ApprovalRequest → WorkItem. Each request targets exactly one WorkItem. */
export const REQUESTS: EdgeTypeDef = {
  name: "requests",
  fromTypes: ["ApprovalRequest"],
  toTypes: ["WorkItem"],
  fromCardinality: "exactly:1",
  toCardinality: "unbounded",
};

/** WorkItem → Deliverable. Work produces artifacts. */
export const PRODUCES: EdgeTypeDef = {
  name: "produces",
  fromTypes: ["WorkItem"],
  toTypes: ["Deliverable"],
  fromCardinality: "unbounded",
  toCardinality: "exactly:1",
};

export const PM_GOVERNANCE_EDGES = {
  accountable_to: ACCOUNTABLE_TO,
  responsible_for: RESPONSIBLE_FOR,
  consulted_on: CONSULTED_ON,
  informed_of: INFORMED_OF,
  part_of: PART_OF,
  depends_on: DEPENDS_ON,
  gated_by: GATED_BY,
  requests: REQUESTS,
  produces: PRODUCES,
} as const;
