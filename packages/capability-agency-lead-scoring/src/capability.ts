import type { Capability } from "@pm/registry";
import type { CapabilityId } from "@pm/types";

const leadProgressionSub = (pattern: string) => ({
  pattern,
  accepts: { minMajor: 1, maxMajor: 1 },
});

/**
 * Capability descriptor for agency.lead-scoring.
 *
 * Owns `LeadScoringConfig.currentTotalLeadsScored` rollup. The load-bearing
 * mechanism: when a lead-progression event arrives (e.g. `agency.lead.qualified`),
 * the handler walks the graph to find the rollup target without needing
 * `scoring_config_id` on the event payload.
 */
export const AGENCY_LEAD_SCORING_CAPABILITY = {
  id: "cap_agency_lead_scoring_v1" as CapabilityId,
  name: "agency.lead-scoring",
  version: 1,
  readsInterfaces: [
    {
      interface: "Counterparty",
      fields: ["name", "qualificationStatus", "source"],
      cardinality: "exactly-one",
      required: true,
    },
    {
      interface: "Resource",
      fields: ["name", "kind", "thresholds", "currentTotalLeadsScored"],
      cardinality: "exactly-one",
      required: true,
    },
  ],
  writesInterfaces: [
    {
      interface: "Resource",
      fields: ["currentTotalLeadsScored"],
      ownership: "owner",
    },
  ],
  readsEdges: [
    "agency/lead_scored_by",
    "agency/lead_assigned_to_user",
    "agency/user_default_scoring",
  ],
  writesEdges: [],
  emits: [
    {
      schema: {
        type: "agency.lead.scored",
        version: { major: 1, minor: 0, patch: 0 },
        schemaPath: "schemas/lead-scored.v1.json",
      },
      affectsEntities: ["Resource", "Counterparty"],
    },
  ],
  subscribesTo: [
    leadProgressionSub("agency.lead.qualified"),
    leadProgressionSub("agency.lead.contacted"),
    leadProgressionSub("agency.lead.disqualified"),
  ],
  requiredPermissions: ["agency.lead-scoring.write"],
  description:
    "Owns LeadScoringConfig.currentTotalLeadsScored rollup for the agency profile. " +
    "Subscribes to lead-progression events and infers the rollup target by walking " +
    "the graph topology (lead -> lead_scored_by OR lead -> assigned_user -> user_default_scoring). " +
    "No scoring_config_id on the payload — topology is the contract. " +
    "Mirrors @pm/capability-wedding-budget's design as G4 anti-fixation proof.",
} as const satisfies Capability;
