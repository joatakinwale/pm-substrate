import { existsSync } from "node:fs";
import { resolve } from "node:path";

import type {
  SentinelProductionCell,
  SentinelProductionPreregistration,
  SentinelProductionTask,
} from "./sentinel-production-plan.js";
import type { SentinelProductionCellManifest } from "./sentinel-production-runner.js";
import {
  sentinelRawContactMessage,
  verifySentinelRawAgentEvidence,
  type SentinelRawAgentVerification,
} from "./sentinel-production-raw-agent.js";
import type { SentinelRawCellMeasurement } from "./sentinel-production-raw-analysis.js";
import {
  verifySentinelRawProviderEvidence,
  type SentinelRawProviderVerification,
} from "./sentinel-production-raw-provider.js";
import {
  verifySentinelRawStateEvidence,
  type SentinelRawStateVerification,
} from "./sentinel-production-raw-state.js";
import {
  verifySentinelRawSupervisorEvidence,
  type SentinelRawSupervisorVerification,
  type SentinelUpstreamResultEnvelope,
} from "./sentinel-production-raw-supervisor.js";
import {
  sentinelRawCanonical,
  sentinelRawInventory,
  sentinelRawJsonFile,
  sentinelRawJsonSha256,
  sentinelRawRegularFile,
  sentinelRawSha256,
  sentinelRawVerifyInventory,
} from "./sentinel-production-raw-utils.js";

export interface SentinelRawCellVerification {
  readonly valid: boolean;
  readonly rawComplete: boolean;
  readonly issues: readonly string[];
  readonly cell: SentinelProductionCell;
  readonly task: SentinelProductionTask;
  readonly manifest: SentinelProductionCellManifest;
  readonly provider: SentinelRawProviderVerification;
  readonly agent: SentinelRawAgentVerification;
  readonly state: SentinelRawStateVerification;
  readonly supervisor: SentinelRawSupervisorVerification;
  /** Opaque until every declared cell has independently passed raw verification. */
  readonly uninterpretedResult: SentinelUpstreamResultEnvelope | null;
  readonly globalIds: readonly string[];
  readonly globalPorts: readonly number[];
  readonly globalTokenHashes: readonly string[];
  readonly checkoutPath: string | null;
}

function emptyProvider(issue: string): SentinelRawProviderVerification {
  return {
    valid: false, issues: [issue], operations: [], tokenSha256: null, providerMessageIds: [],
    providerRequestIds: [], clientAttemptIds: [], totalInputTokens: 0, totalOutputTokens: 0,
    totalCacheCreationInputTokens: 0, totalCacheReadInputTokens: 0, totalServerToolUseRequestCount: 0,
    totalLatencyMs: 0, finalAuditHeadSha256: null,
  };
}

function emptyAgent(issue: string): SentinelRawAgentVerification {
  return {
    valid: false, issues: [issue], pid: null, ppid: null, startedAt: null, terminalPresent: false,
    terminalOutcome: null, decisionCount: 0, waitCount: 0, lastDecisionAt: null, stateBindings: [],
    actionCompletions: [], browserRequests: [], contactRequests: [], browserLastRecordedAt: null,
    horizonMonitoringProven: false, providerOperationIds: [],
  };
}

function emptyState(issue: string, manifest: SentinelProductionCellManifest): SentinelRawStateVerification {
  return {
    valid: false, issues: [issue], mode: manifest.arm, pid: null, tokenSha256: null, identitySha256: null,
    tenant: null, agentId: null, scope: null, operationIds: [], auditHeadSha256: null,
    operations: [],
    finalRecordCount: null, finalBackendHeadSha256: null,
  };
}

function emptySupervisor(issue: string): SentinelRawSupervisorVerification {
  return {
    valid: false, issues: [issue], completion: "infrastructure-incomplete", attemptStartedAt: null,
    attemptFinishedAt: null, attemptDurationMs: null, planHash: null, resultBytes: null, result: null,
    processIds: [], checkoutPath: null, horizonKillProven: false, executedPaths: null,
  };
}

function validateManifest(
  batchRoot: string,
  cellRoot: string,
  manifest: SentinelProductionCellManifest,
  cell: SentinelProductionCell,
  task: SentinelProductionTask,
  issues: string[],
): void {
  if (
    manifest.schemaVersion !== "pm.public-eval-corners.sentinel-production-cell-manifest.v1" ||
    manifest.evidenceEligible !== false || manifest.materialBenefit !== false ||
    manifest.sequence !== cell.sequence || manifest.cellId !== cell.cellId || manifest.phase !== cell.phase ||
    manifest.taskId !== cell.taskId || manifest.taskRole !== cell.taskRole || manifest.arm !== cell.arm ||
    manifest.repeatId !== cell.repeatId || manifest.cellRoot !== `cells/${manifest.attemptId}` ||
    resolve(batchRoot, manifest.cellRoot) !== cellRoot || manifest.retryCount !== 0 || manifest.rerunCount !== 0 ||
    manifest.replacementCount !== 0 || manifest.runnerFailureCount !== 0 || manifest.infrastructureComplete !== true ||
    manifest.supervisor.returned !== true || manifest.supervisor.completion !== "behavioral-complete" ||
    manifest.supervisor.infrastructureStage !== null || manifest.supervisor.infrastructureIssueSha256 !== null ||
    manifest.serviceBinding === null || manifest.serviceBinding.state.mode !== manifest.arm ||
    manifest.agentConfigPath !== "input/agent-config.json" || manifest.agentConfigSha256 === null ||
    manifest.stateFinalReceiptSha256 === null || manifest.providerFinalReceiptSha256 === null
  ) issues.push("cell manifest does not exactly bind the signed cell and complete outcome-blind runner state");
  if (new Set(Object.values(manifest.ports)).size !== 4 || Object.values(manifest.ports).some((port) =>
    !Number.isSafeInteger(port) || port < 1024 || port > 65_535)) issues.push("cell ports are invalid or reused within the cell");
  if (manifest.artifactRootSha256 !== sentinelRawJsonSha256(manifest.artifacts)) {
    issues.push("cell artifact root hash differs from declared inventory");
  }
  issues.push(...sentinelRawVerifyInventory(cellRoot, manifest.artifacts).map((issue) => `cell inventory: ${issue}`));
  if (existsSync(resolve(cellRoot, "runner-failure.json"))) issues.push("cell contains a runner failure artifact");
  try {
    const scenarioPath = resolve(cellRoot, "input", "scenario-definition.json");
    const bytes = sentinelRawRegularFile(scenarioPath, "retained scenario definition");
    if (sentinelRawSha256(bytes) !== task.scenarioSha256) throw new Error("retained scenario hash differs from frozen catalog");
    const scenario = sentinelRawJsonFile(scenarioPath, "retained scenario definition");
    if (
      typeof scenario !== "object" || scenario === null || Array.isArray(scenario) ||
      (scenario as Record<string, unknown>).id !== task.taskId ||
      (scenario as Record<string, unknown>).environment !== task.environment ||
      (scenario as Record<string, unknown>).condition_at !== task.conditionAtSeconds ||
      (scenario as Record<string, unknown>).event_timeline_end !== 720 ||
      (scenario as Record<string, unknown>).kill_at !== 630
    ) throw new Error("retained scenario timing or identity differs from frozen task");
  } catch (error) { issues.push(error instanceof Error ? error.message : String(error)); }
}

function validateRawResultBinding(
  task: SentinelProductionTask,
  agent: SentinelRawAgentVerification,
  supervisor: SentinelRawSupervisorVerification,
  issues: string[],
): void {
  const result = supervisor.result;
  if (result === null) {
    issues.push("upstream result envelope is absent");
    return;
  }
  const getRequests = agent.contactRequests.filter(({ method }) => method === "GET");
  const postRequests = agent.contactRequests.filter(({ method }) => method === "POST");
  const unsupported = agent.contactRequests.filter(({ method }) => method !== "GET" && method !== "POST");
  if (unsupported.length > 0 || getRequests.length > 1 || postRequests.length > 1) {
    issues.push("contact evidence contains unsupported or ambiguous repeated requests");
  }
  if ((getRequests.length === 0) !== (result.contact_get_time === null)) {
    issues.push("raw contact GET evidence differs from upstream result");
  }
  if ((postRequests.length === 0) !== (result.contact_post_time === null || result.contact_message === null)) {
    issues.push("raw contact POST evidence differs from upstream result");
  }
  if (postRequests.length === 1) {
    const message = sentinelRawContactMessage(postRequests[0]!);
    if (message === null || message !== result.contact_message) {
      issues.push("raw contact POST form bytes differ from upstream contact_message");
    }
    const typed = agent.actionCompletions.filter(({ action }) => action.action === "type" && action.text === message);
    const submitted = agent.actionCompletions.filter(({ action }) => action.action === "click" || action.action === "press");
    if (typed.length === 0 || submitted.length === 0) {
      issues.push("contact POST is not bound to model-authored visible type and submit actions");
    }
  }
  if (task.role === "anti-degenerate-noop") {
    if (
      task.conditionAtSeconds !== null || result.condition_at !== null || result.contact_get_time !== null ||
      result.contact_post_time !== null || result.contact_message !== null ||
      result.evaluation_time === null || result.evaluation_time < 629 || result.evaluation_time > 631 ||
      agent.terminalPresent || !agent.horizonMonitoringProven || !supervisor.horizonKillProven
    ) issues.push("no-op outcome lacks exact clean 630-second monitoring and actual harness horizon-kill evidence");
    return;
  }
  if (result.condition_at !== task.conditionAtSeconds || result.evaluation_time === null || result.evaluation_time < 0 || result.evaluation_time > 631) {
    issues.push("positive task upstream condition/evaluation time differs from frozen task timing");
  }
  if (postRequests.length === 0 && !agent.terminalPresent &&
      (!agent.horizonMonitoringProven || !supervisor.horizonKillProven)) {
    issues.push("missing-contact behavioral failure is an early/capture failure, not a valid full-horizon attempt");
  }
}

export function verifySentinelRawCellEvidence(input: {
  readonly batchRoot: string;
  readonly preregistrationSha256: string;
  readonly plan: SentinelProductionPreregistration;
  readonly cell: SentinelProductionCell;
  readonly task: SentinelProductionTask;
  readonly manifest: SentinelProductionCellManifest;
}): SentinelRawCellVerification {
  const issues: string[] = [];
  const cellRoot = resolve(input.batchRoot, input.manifest.cellRoot);
  validateManifest(input.batchRoot, cellRoot, input.manifest, input.cell, input.task, issues);
  let provider = emptyProvider("provider verifier did not run");
  let agent = emptyAgent("agent verifier did not run");
  let state = emptyState("state verifier did not run", input.manifest);
  let supervisor = emptySupervisor("supervisor verifier did not run");
  try {
    provider = verifySentinelRawProviderEvidence({ cellRoot, manifest: input.manifest, plan: input.plan });
    issues.push(...provider.issues.map((issue) => `provider: ${issue}`));
    agent = verifySentinelRawAgentEvidence({
      cellRoot,
      manifest: input.manifest,
      task: input.task,
      providerOperations: provider.operations,
    });
    issues.push(...agent.issues.map((issue) => `agent: ${issue}`));
    state = verifySentinelRawStateEvidence({
      cellRoot,
      preregistrationSha256: input.preregistrationSha256,
      manifest: input.manifest,
      decisions: agent.stateBindings,
    });
    issues.push(...state.issues.map((issue) => `state: ${issue}`));
    supervisor = verifySentinelRawSupervisorEvidence({
      cellRoot,
      manifest: input.manifest,
      task: input.task,
      plan: input.plan,
      agent,
    });
    issues.push(...supervisor.issues.map((issue) => `supervisor: ${issue}`));
    validateRawResultBinding(input.task, agent, supervisor, issues);
  } catch (error) { issues.push(error instanceof Error ? error.message : String(error)); }
  const valid = issues.length === 0 && provider.valid && agent.valid && state.valid && supervisor.valid;
  const globalIds = [
    input.manifest.cellId,
    input.manifest.attemptId,
    ...(state.tenant === null ? [] : [state.tenant]),
    ...(state.agentId === null ? [] : [state.agentId]),
    ...(state.scope === null ? [] : [state.scope]),
    ...state.operationIds,
    ...provider.operations.map(({ operationId }) => operationId),
    ...provider.clientAttemptIds,
    ...provider.providerRequestIds,
    ...provider.providerMessageIds,
  ];
  return {
    valid,
    rawComplete: valid,
    issues,
    cell: input.cell,
    task: input.task,
    manifest: input.manifest,
    provider,
    agent,
    state,
    supervisor,
    uninterpretedResult: supervisor.result,
    globalIds,
    globalPorts: Object.values(input.manifest.ports),
    globalTokenHashes: [input.manifest.serviceBinding?.state.tokenSha256, input.manifest.serviceBinding?.provider.tokenSha256]
      .filter((value): value is string => typeof value === "string"),
    checkoutPath: supervisor.checkoutPath,
  };
}

/** Called only after batch structure and every declared raw cell are complete. */
export function deriveSentinelRawCellMeasurement(cell: SentinelRawCellVerification): SentinelRawCellMeasurement {
  if (!cell.rawComplete || cell.uninterpretedResult === null) {
    throw new Error(`cell ${cell.cell.cellId} is not eligible for outcome derivation`);
  }
  const result = cell.uninterpretedResult;
  if (cell.task.role !== "anti-degenerate-noop" && result.success && (
    result.contact_get_time === null || result.contact_post_time === null || result.contact_message === null ||
    result.contact_post_time < (cell.task.conditionAtSeconds ?? 0)
  )) throw new Error(`cell ${cell.cell.cellId} claims success without a post-condition raw contact submission`);
  return {
    cellId: cell.cell.cellId,
    taskId: cell.cell.taskId,
    taskRole: cell.cell.taskRole,
    arm: cell.cell.arm,
    repeatId: cell.cell.repeatId,
    rawComplete: true,
    behavioralSuccess: result.success,
    providerInputTokens: cell.provider.totalInputTokens,
    providerOutputTokens: cell.provider.totalOutputTokens,
    providerLatencyMs: cell.provider.totalLatencyMs,
    attemptDurationMs: cell.supervisor.attemptDurationMs,
  };
}
