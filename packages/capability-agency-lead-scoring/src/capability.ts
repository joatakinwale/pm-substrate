import type { Capability } from "@pm/registry";
import type { CapabilityId } from "@pm/types";

/**
 * Capability descriptor for agency.lead-scoring.
 *
 * Owns `LeadScoringConfig.currentTotalLeadsScored` rollup. The load-bearing
 * mechanism: when a lead-progression event arrives (e.g. `agency.lead.qualified`),
 * the handler walks the graph to find the rollup target without needing
 * `scoring_config_id` on the event payload.
 *
 * Resolution order (mirrors the same graph-inference shape that
 * @pm/capability-wedding-budget uses for budget categories):
 *
 *   1. lead → (agency/lead_scored_by) → LeadScoringConfig    (lead-bound override)
 *   2. lead → (agency/lead_assigned_to_user) → AgencyUser
 *          → (agency/user_default_scoring) → LeadScoringConfig (user default)
 *
 * If neither path resolves, the handler logs a warning and skips — same
 * pattern as wedding.budget when the topology is incomplete.
 *
 * G4 finding: this capability is the second proof point in the anti-fixation
 * test. It's structurally identical to wedding.budget — same atomic-tx
 * shape, same idempotency-table mechanism, same "topology is the contract"
 * design — but operates on agency-profile entities. The pattern transferred
 * with zero substrate changes.
 */
export const AGENCY_LEAD_SCORING_CAPABILITY = {
  id: "cap_agency_lead_scoring_v1" as CapabilityId,
  name: "agency.lead-scoring",
  version: 1,
  readsInterfaces: [
    "Counterparty[name,qualificationStatus,source]",
    "Resource[name,kind,thresholds,currentTotalLeadsScored]",
  ],
  writesInterfaces: [
    "Resource[currentTotalLeadsScored]",
  ],
  readsEdges: [
    "agency/lead_scored_by",
    "agency/lead_assigned_to_user",
    "agency/user_default_scoring",
  ],
  writesEdges: [],
  emits: ["agency.lead.scored"],
  subscribesTo: [
    "agency.lead.qualified",
    "agency.lead.contacted",
    "agency.lead.disqualified",
  ],
  requiredPermissions: ["agency.lead-scoring.write"],
  description:
    "Owns LeadScoringConfig.currentTotalLeadsScored rollup for the agency profile. " +
    "Subscribes to lead-progression events and infers the rollup target by walking " +
    "the graph topology (lead -> lead_scored_by OR lead -> assigned_user -> user_default_scoring). " +
    "No scoring_config_id on the payload — topology is the contract. " +
    "Mirrors @pm/capability-wedding-budget's design as G4 anti-fixation proof.",
} as const satisfies Capability;
