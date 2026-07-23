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

/**
 * Evidence runs are deliberately larger than the interactive scenario
 * registry. Every seeded expected-block case is matched, by failure class,
 * with an expected-allow control that suppresses the failure injection. This
 * makes both deny-all and allow-all admission mutants observable.
 *
 * These remain mechanism/conformance probes authored in this repository; they
 * are not independent evidence that the substrate improves public tasks.
 */
export const EVIDENCE_SCENARIOS: readonly ScenarioSpec[] = [
  ...SCENARIOS.map((scenario) => mechanismControl(scenario, "block")),
  ...[
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
  ].map((scenario) => mechanismControl(scenario, "allow")),
];

export function scenarioById(id: string): ScenarioSpec | undefined {
  return SCENARIOS.find((s) => s.scenarioId === id);
}

function mechanismControl(
  scenario: ScenarioSpec,
  expectedAdmission: "allow" | "block",
): ScenarioSpec {
  const controlGroup = scenario.failureClass;
  if (expectedAdmission === "block") {
    return { ...scenario, expectedAdmission, controlGroup };
  }

  return {
    ...scenario,
    scenarioId: `${scenario.scenarioId}-expected-allow`,
    expectedAdmission,
    controlGroup,
    // The expected-allow arm preserves the seeded current state. All of the
    // selected controls have an oracle that treats an admitted current action
    // as pass and a refusal as fail.
    async induce(): Promise<void> {},
  };
}
