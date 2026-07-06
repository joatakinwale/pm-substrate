/**
 * Scenario registry. Adding a failure class = import a spec + push it here.
 * The engine imports SCENARIOS; it never changes to support a new class.
 */

import type { ScenarioSpec } from "./scenario.js";
import { staleObservationScenario } from "./scenarios/stale-observation.js";
import { pmGovernanceApprovalGateScenario } from "./scenarios/pm-governance-approval-gate.js";
import { pmGovernanceDispatchScenario } from "./scenarios/pm-governance-dispatch.js";
import {
  capabilityContractViolationScenario,
  continuityBreakScenario,
  feedbackDisconnectionScenario,
  memoryDriftScenario,
  parallelWriteConflictScenario,
  partialObservationScenario,
  representationLossScenario,
  sourceAuthorityConflictScenario,
  workflowInvalidationScenario,
} from "./scenarios/taxonomy-scenarios.js";

export const SCENARIOS: readonly ScenarioSpec[] = [
  partialObservationScenario,
  staleObservationScenario,
  representationLossScenario,
  memoryDriftScenario,
  sourceAuthorityConflictScenario,
  workflowInvalidationScenario,
  capabilityContractViolationScenario,
  parallelWriteConflictScenario,
  feedbackDisconnectionScenario,
  continuityBreakScenario,
  pmGovernanceApprovalGateScenario,
  pmGovernanceDispatchScenario,
];

export function scenarioById(id: string): ScenarioSpec | undefined {
  return SCENARIOS.find((s) => s.scenarioId === id);
}
