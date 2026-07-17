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
export { OpenRouterClient } from "./openrouter.js";
export type { OpenRouterConfig } from "./openrouter.js";
export { defaultLabProvider } from "./provider.js";
export type { LabModelClient, LabProviderName, LabProviderOptions } from "./provider.js";
export { classifyAttemptCause, runArmWithRetries } from "./attempt-loop.js";
export type {
  ArmAttemptSeries,
  AttemptCause,
  AttemptLoopConfig,
  AttemptOutcome,
  AttemptRecord,
} from "./attempt-loop.js";
export {
  TOKEN_USAGE_EVENT_TYPE,
  computeTokenUsage,
  listTokenUsageRuns,
  renderTokenUsageCsv,
  renderTokenUsageTable,
} from "./token-usage-metrics.js";
export type {
  TokenUsageMetrics,
  TokenUsageRunSummary,
  TokenUsageScenarioRow,
} from "./token-usage-metrics.js";
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
  ExpectedAdmission,
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
export { EVIDENCE_SCENARIOS, SCENARIOS, scenarioById } from "./registry.js";
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
