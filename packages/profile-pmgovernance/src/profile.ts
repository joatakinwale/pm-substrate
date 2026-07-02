import type { ProfileDefinition } from "@pm/types";
import { PM_GOVERNANCE_EDGES } from "./edges.js";
import {
  APPROVAL_REQUEST_LIFECYCLE,
  INITIATIVE_LIFECYCLE,
  MILESTONE_LIFECYCLE,
  WORK_ITEM_LIFECYCLE,
} from "./lifecycles.js";

/**
 * PM-governance profile definition (refactor plan §4).
 *
 * PM methodology as governance for multi-agent work:
 *   - single accountable owner   → accountable_to edge, exactly:1 (substrate-enforced)
 *   - stage-gate advancement     → lifecycles + capability-pmgovernance-stage-gate
 *   - approval before action     → ApprovalRequest lifecycle + gate capability
 *   - reporting                  → projections over the event log
 *
 * Installed per tenant at runtime; the substrate names no profile.
 */
export const PM_GOVERNANCE_PROFILE: ProfileDefinition = {
  name: "pmgovernance",
  version: 1,
  description:
    "Project-management methodology as multi-agent governance: RACI edges, stage-gate lifecycles, approval gates, identity primacy on Initiative.",
  identityPrimacy: "Initiative",
  entityTypes: {
    Initiative: {
      concrete: "Initiative",
      tier1: "Engagement",
      requiredFields: ["title", "scopeStart", "scopeEnd", "state"],
      optionalFields: [],
      schemaVersion: 1,
    },
    WorkItem: {
      concrete: "WorkItem",
      tier1: "Engagement",
      requiredFields: ["title", "scopeStart", "scopeEnd", "state", "priority"],
      optionalFields: [],
      schemaVersion: 1,
    },
    Milestone: {
      concrete: "Milestone",
      tier1: "Event",
      requiredFields: ["kind", "occurredAt", "gateState"],
      optionalFields: [],
      schemaVersion: 1,
    },
    Deliverable: {
      concrete: "Deliverable",
      tier1: "Document",
      requiredFields: ["sha256", "mimeType", "filename"],
      optionalFields: [],
      schemaVersion: 1,
    },
    AgentRole: {
      concrete: "AgentRole",
      tier1: "Resource",
      requiredFields: ["name", "kind"],
      optionalFields: [],
      schemaVersion: 1,
    },
    Stakeholder: {
      concrete: "Stakeholder",
      tier1: "Counterparty",
      requiredFields: ["name"],
      optionalFields: ["email", "phone", "externalRef"],
      schemaVersion: 1,
    },
    ApprovalRequest: {
      concrete: "ApprovalRequest",
      tier1: "Event",
      requiredFields: ["kind", "occurredAt", "decisionState"],
      optionalFields: [],
      schemaVersion: 1,
    },
  },
  edgeTypes: PM_GOVERNANCE_EDGES,
  lifecycles: {
    Initiative: INITIATIVE_LIFECYCLE,
    WorkItem: WORK_ITEM_LIFECYCLE,
    Milestone: MILESTONE_LIFECYCLE,
    ApprovalRequest: APPROVAL_REQUEST_LIFECYCLE,
  },
};
