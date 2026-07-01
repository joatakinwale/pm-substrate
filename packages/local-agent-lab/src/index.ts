/**
 * @pm/local-agent-lab — Axis C live testbed.
 *
 * Real local (Ollama) agents run two arms (no_substrate vs substrate) against
 * the real event store; state failures are measured at the admission boundary,
 * never hardcoded. Dynamic ScenarioSpec registry — add a failure class without
 * rebuilding the engine. See docs/state-validation/local-agent-lab-scenarios.md
 * and docs/state-validation/reality-qualities.md.
 */

export { OllamaClient } from "./ollama.js";
export type { OllamaConfig, OllamaResult } from "./ollama.js";
export { World } from "./world.js";
export type { AdmitInput, KeyView } from "./world.js";
export { LabAgent } from "./agent.js";
export type { AgentTokenLedger } from "./agent.js";
export { runLabSession, LabSessionRunner, armsForMode } from "./session.js";
export type {
  LabSessionAgentResult,
  LabSessionRequest,
  LabSessionRun,
  LabSessionRunnerConfig,
} from "./session.js";
export type {
  LabSessionEvent,
  LabSessionEventListener,
  LabSessionEventType,
  LabSessionMode,
  LabSessionStatus,
} from "./session-events.js";
export type { LabInjection, LabInjectionType } from "./injection.js";
export type { LabMutation, LabMutationType } from "./mutation.js";
export type {
  Arm,
  EvalResult,
  Observation,
  IntendedAction,
  AdmitOutcome,
  ScenarioContext,
  ScenarioSpec,
} from "./scenario.js";
export {
  buildLocalAgentLabActionOutcomeEnvelope,
  defaultLocalAgentLabActionOutcomeAuthorityProvider,
  runScenario,
  runSuite,
} from "./engine.js";
export type {
  ArmRun,
  ScenarioRun,
  SuiteResult,
  EngineConfig,
  LocalAgentLabActionOutcomeAuthorityInput,
  LocalAgentLabActionOutcomeAuthorityProvider,
} from "./engine.js";
export { SCENARIOS, scenarioById } from "./registry.js";
export { staleObservationScenario } from "./scenarios/stale-observation.js";
export {
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
