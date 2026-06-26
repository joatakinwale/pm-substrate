import type { TenantId, Timestamp } from "@pm/types";
import {
  evalEvent,
  type EvalEvent,
} from "./schema.js";

export interface MarketingAxisBBlockedInput {
  readonly tenantId: TenantId;
  readonly observedAt: Timestamp;
  readonly runId?: string;
  readonly agentId?: string;
  readonly scenarioId?: string;
  readonly sourcePath?: string;
  readonly acceptedFixtureAuthority?: boolean;
}

export function buildMarketingAxisBBlockedEval(
  input: MarketingAxisBBlockedInput,
): EvalEvent {
  const sourcePath = input.sourcePath ?? "./pluggedinsocial";
  const scenarioId =
    input.scenarioId ?? "publish-after-client-approval-revoked";
  const fixtureNote =
    input.acceptedFixtureAuthority === true
      ? "Authoritative agency fixtures are accepted, but no fixture run was supplied for this scenario."
      : "No authoritative agency fixtures have been accepted for this scenario.";

  return evalEvent({
    tenantId: input.tenantId,
    axis: "marketing",
    runId: input.runId ?? `run_axis_b_blocked_${scenarioId}`,
    agentId: input.agentId ?? "marketing_axis_b_agent",
    scenarioId,
    failureClass: "workflow_invalidation",
    observedAt: input.observedAt,
    source: "pluggedinsocial/source-availability",
    evidenceRefs: [],
    substrateRefs: [],
    stateBenchCategory: "procedural_execution",
    memoryBenchmarkBridge: "workflow_rebase",
    mastCategory: "task_verification",
    coordinationClass: "authority_gated_transition",
    evidenceStage: "scaffolded_scenario",
    scenarioResult: "blocked",
    result: "blocked",
    notes: `Blocked: expected PluggedInSocial clone is unavailable at ${sourcePath}. ${fixtureNote}`,
  });
}
