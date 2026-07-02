import type { Capability } from "@pm/registry";
import type { CapabilityId } from "@pm/types";

/**
 * Capability descriptor for pm.stage-gate (refactor plan Phase 2, §4.5).
 *
 * Owns `WorkItem.state` stage-gate advancement under approval governance.
 * The load-bearing mechanism mirrors lead-scoring: no workItemId on the
 * payload — the handler walks pmgovernance/requests from the ApprovalRequest
 * to find its exactly-one WorkItem. Topology is the contract.
 */
export const PM_STAGE_GATE_CAPABILITY = {
  id: "cap_pm_stage_gate_v1" as CapabilityId,
  name: "pm.stage-gate",
  version: 1,
  readsInterfaces: [
    {
      interface: "Event",
      fields: ["kind", "occurredAt", "decisionState"],
      cardinality: "exactly-one",
      required: true,
    },
    {
      interface: "Engagement",
      fields: ["title", "state", "priority"],
      cardinality: "exactly-one",
      required: true,
    },
  ],
  writesInterfaces: [
    {
      interface: "Engagement",
      fields: ["state"],
      ownership: "owner",
    },
  ],
  readsEdges: ["pmgovernance/requests"],
  writesEdges: [],
  emits: [
    {
      schema: {
        type: "pm.workitem.advanced",
        version: { major: 1, minor: 0, patch: 0 },
        schemaPath: "schemas/workitem-advanced.v1.json",
      },
      affectsEntities: ["Engagement", "Event"],
    },
  ],
  subscribesTo: [
    { pattern: "pm.approval.approved", accepts: { minMajor: 1, maxMajor: 1 } },
  ],
  requiredPermissions: ["pm.stage-gate.write"],
  description:
    "Advances WorkItem.state through the pm-governance stage-gate lifecycle when an " +
    "approval decision event arrives. Walks pmgovernance/requests from the ApprovalRequest " +
    "to its exactly-one WorkItem (topology is the contract), validates the lifecycle " +
    "transition via the tenant's installed profile, refuses stale reads via the kit's " +
    "freshness gate, and applies idempotently in one transaction.",
} as const satisfies Capability;
