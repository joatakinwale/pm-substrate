/**
 * @pm/capability-agency-lead-scoring — owns LeadScoringConfig.currentTotalLeadsScored rollup.
 *
 * Tier-2 capability: profile-bound to the agency profile. Subscribes to
 * lead-progression events and infers the rollup target by walking the graph
 * topology:
 *
 *   lead → (agency/lead_scored_by) → LeadScoringConfig                     (preferred)
 *   lead → (agency/lead_assigned_to_user) → AgencyUser
 *        → (agency/user_default_scoring) → LeadScoringConfig                (fallback)
 *
 * The architectural point: `scoring_config_id` does NOT appear on lead-event
 * payloads. The rollup target is derived from the graph, not from a field
 * that can be left null at creation time. Same anti-pattern repair the
 * retired wedding-era budget capability (G4 anti-fixation proof).
 *
 * Idempotency: each scoring event is recorded in
 * `lead_scoring.applied_scoring_events` before the rollup write.
 * Re-delivering the same `scoringEventId` is a no-op.
 *
 * Atomicity: the rollup UPDATE and the outbound event emit run in a single
 * Postgres transaction. If either fails, both are rolled back.
 *
 * G4 anti-fixation status: this package is the second proof point that the
 * substrate's capability shape is profile-agnostic. It was implemented
 * without a single edit to substrate packages or to any other capability.
 * See research/discovery-engine/pm-substrate-research-gap-audit-2026-05-05.md.
 */

export { AGENCY_LEAD_SCORING_CAPABILITY } from "./capability.js";
export { LeadScoringHandler } from "./handler.js";
export type {
  LeadScoringEventPayload,
  LeadScoringRuntimeDeps,
} from "./handler.js";
