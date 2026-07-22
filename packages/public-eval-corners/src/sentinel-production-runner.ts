import { randomBytes } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  statSync,
} from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";

import {
  SENTINEL_PRODUCTION_REPOSITORY,
  SENTINEL_PRODUCTION_REVISION,
  buildSentinelProductionSchedule,
  createSentinelProductionPreregistration,
  sentinelProductionCanonicalJson,
  sentinelProductionJsonSha256,
  sentinelProductionSha256,
  verifySentinelProductionPreregistration,
  type SentinelExternalTrustAnchor,
  type SentinelProductionArm,
  type SentinelProductionCell,
  type SentinelProductionPreregistration,
  type SentinelProductionSignature,
  type SentinelProductionTask,
  type SentinelRuntimeClosure,
} from "./sentinel-production-plan.js";
import {
  PRODUCTION_STATE_RESPONSE_DEADLINE_MS,
  readProductionStateAudit,
  startProductionStateSidecar,
  verifyProductionStateEvidence,
  type ProductionStateFinalReceipt,
  type RunningProductionStateSidecar,
} from "./production-state-sidecar.js";
import {
  SENTINEL_GENERAL_ANTHROPIC_ACTION_SCHEMA_SHA256,
  SENTINEL_GENERAL_ANTHROPIC_PINNED_MODEL,
  SENTINEL_GENERAL_ANTHROPIC_SYSTEM_PROMPT_SHA256,
  startSentinelGeneralAnthropicProviderProxy,
  type SentinelGeneralAnthropicProviderFinalReceipt,
  type SentinelGeneralAnthropicProviderProxy,
} from "./sentinel-general-provider-proxy.js";
import {
  superviseSentinelProductionAttempt,
  type SentinelProductionAttemptTerminalReceipt,
  type SentinelProductionExecutableIdentity,
  type SentinelProductionSupervisorInput,
  type SentinelProductionTaskRegistration,
} from "./sentinel-production-supervisor.js";
import {
  assertSentinelProductionRuntimeInspectionEvidence,
  prepareSentinelProductionExternalObservation,
  retainSentinelProductionExternalObservation,
  retainSentinelProductionRuntimeInspection,
  verifySentinelProductionExternalCommitmentRecord,
  type SentinelProductionRuntimeInspection,
  type SentinelProductionRuntimeInspectionReference,
} from "./sentinel-production-runner-evidence.js";
import {
  allocateSentinelProductionPorts,
  createSentinelProductionContinuityTenant,
  exportSentinelProductionContinuityReplay,
  inspectSentinelProductionCheckout,
  inspectSentinelProductionRuntime,
  readSentinelProductionAttemptStartedAt,
  retainSentinelProductionScenario,
  sentinelProductionScenarioRelativePath,
} from "./sentinel-production-runner-infrastructure.js";
import type {
  SentinelProductionDiagnosticRunInput,
  SentinelProductionDiagnosticSelection,
  SentinelProductionExecutionInput,
} from "./sentinel-production-runner-contracts.js";
import type {
  SentinelProductionArtifactIdentity,
  SentinelProductionBatchResult,
  SentinelProductionBlockManifest,
  SentinelProductionCellManifest,
  SentinelProductionCellManifestReference,
  SentinelProductionCheckoutPreflight,
  SentinelProductionContinuityReplayExport,
  SentinelProductionContinuityTenantReceipt,
  SentinelProductionDiagnosticExecutionFinal,
  SentinelProductionDiagnosticExecutionStart,
  SentinelProductionDiagnosticResult,
  SentinelProductionExecutionManifest,
  SentinelProductionJsonValue as JsonValue,
  SentinelProductionRunnerDependencies,
  SentinelProductionServiceBinding,
} from "./sentinel-production-runner-manifests.js";
import { assertSentinelFreshDisjointRoots } from "./sentinel-production-output-boundary.js";
import type {
  SentinelProductionCellExecutionContext as CellExecutionContext,
  SentinelProductionCellPorts as CellPorts,
} from "./sentinel-production-runner-context.js";
import {
  inventorySentinelTree as inventory,
  sealSentinelTree as sealTree,
  writeSentinelContentAddressedJson as writeContentAddressedJson,
  writeSentinelExclusiveJson as writeExclusiveJson,
  type SentinelContentAddressedManifest as ContentAddressedManifest,
} from "./sentinel-production-runner-files.js";
import {
  type SentinelProductionCheckoutSet,
  type SentinelProductionExternalCommitment,
  type SentinelProductionRunInput,
  type SentinelProductionRuntimeBindings,
} from "./sentinel-production-runner-contracts.js";

export type {
  SentinelProductionCheckoutSet,
  SentinelProductionDiagnosticRunInput,
  SentinelProductionDiagnosticSelection,
  SentinelProductionExternalCommitment,
  SentinelProductionRunInput,
  SentinelProductionRuntimeBindings,
} from "./sentinel-production-runner-contracts.js";
export type {
  SentinelProductionExternalCommitmentVerification,
  SentinelProductionRuntimeInspection,
  SentinelProductionRuntimeInspectionReference,
} from "./sentinel-production-runner-evidence.js";
export type {
  SentinelProductionArtifactIdentity,
  SentinelProductionBatchResult,
  SentinelProductionBlockManifest,
  SentinelProductionCellManifest,
  SentinelProductionCellManifestReference,
  SentinelProductionCheckoutPreflight,
  SentinelProductionContinuityReplayExport,
  SentinelProductionContinuityTenantReceipt,
  SentinelProductionDiagnosticExecutionFinal,
  SentinelProductionDiagnosticExecutionStart,
  SentinelProductionDiagnosticResult,
  SentinelProductionExecutionManifest,
  SentinelProductionRunnerDependencies,
  SentinelProductionServiceBinding,
} from "./sentinel-production-runner-manifests.js";

const ARMS = ["native", "sham", "plain-kv", "substrate"] as const;
const LOOPBACK_HOST = "127.0.0.1";
const HASH_GENESIS = "0".repeat(64);
/** This policy is preregistered through the signed runnerScriptSha256 runtime closure. */
const MAX_ARM_START_SKEW_MS = 1_000;
const POLL_INTERVAL_MS = 10_000;
const ACTIVE_SETTLE_MS = 250;
const MAX_DECISIONS = 1_000;
const MAX_CONSECUTIVE_ACTIVE_ACTIONS = 64;
const VIEWPORT_WIDTH = 1_280;
const VIEWPORT_HEIGHT = 720;
const SHA256 = /^[a-f0-9]{64}$/u;
const OPAQUE_ATTEMPT_ID = /^spa-[a-f0-9]{48}$/u;
const OPAQUE_DIAGNOSTIC_EXECUTION_ID = /^sde-[a-f0-9]{48}$/u;
const OPAQUE_IDENTITY = /^[A-Za-z0-9._:-]{1,128}$/u;
const OPAQUE_TOKEN = /^[A-Za-z0-9_-]{43,128}$/u;
const PLAN_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/u;
const GIT_SHA1 = /^[a-f0-9]{40}$/u;
const CANONICAL_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
const FORBIDDEN_OUTCOME_KEYS = new Set([
  "condition_at",
  "contact_get_time",
  "contact_message",
  "contact_post_time",
  "detail",
  "evaluation_time",
  "materialBenefit",
  "outcome",
  "pass",
  "passed",
  "score",
  "success",
]);






function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function canonicalTimestamp(value: string, label: string): string {
  if (!CANONICAL_TIMESTAMP.test(value)) throw new Error(`${label} is not a canonical UTC timestamp`);
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.valueOf()) || parsed.toISOString() !== value) {
    throw new Error(`${label} is not a canonical UTC timestamp`);
  }
  return value;
}

function exactKeys(value: unknown, expected: readonly string[], label: string): void {
  if (!isRecord(value)) throw new Error(`${label} must be an object`);
  const actual = Object.keys(value).sort(compareCodeUnits);
  const wanted = [...expected].sort(compareCodeUnits);
  if (actual.join("\0") !== wanted.join("\0")) throw new Error(`${label} keys are not exact`);
}

function safeError(error: unknown, secrets: readonly string[]): string {
  let message = error instanceof Error ? error.message : String(error);
  for (const secret of secrets) {
    if (secret.length > 0) message = message.split(secret).join("[REDACTED]");
  }
  return message.slice(0, 4_096);
}

function assertNoOutcomeFields(value: unknown, path = "supervisor receipt"): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoOutcomeFields(entry, `${path}[${index}]`));
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_OUTCOME_KEYS.has(key)) {
      throw new Error(`${path} smuggled forbidden upstream outcome field ${key}`);
    }
    assertNoOutcomeFields(child, `${path}.${key}`);
  }
}

function assertHash(value: string, label: string): string {
  if (!SHA256.test(value)) throw new Error(`${label} must be a lowercase SHA-256 digest`);
  return value;
}

function hashFile(path: string): string {
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`${path} is not a regular file`);
  return sentinelProductionSha256(readFileSync(path));
}

function exactExecutable(path: string, expectedSha256: string, label: string): SentinelProductionExecutableIdentity {
  const resolved = resolve(path);
  if (!isAbsolute(path) || resolved !== path) throw new Error(`${label} path is not canonical absolute`);
  const actual = hashFile(path);
  if (actual !== expectedSha256) throw new Error(`${label} bytes do not match signed runtime`);
  return { path, sha256: actual };
}

function runtimeExecutables(
  runtime: SentinelProductionRuntimeBindings,
  closure: SentinelRuntimeClosure,
): {
  readonly agentRuntimeExecutable: SentinelProductionExecutableIdentity;
  readonly agentScript: SentinelProductionExecutableIdentity;
  readonly pythonExecutable: SentinelProductionExecutableIdentity;
  readonly frontendExecutable: SentinelProductionExecutableIdentity;
} {
  return {
    agentRuntimeExecutable: exactExecutable(
      runtime.paths.nodeRequestedPath,
      closure.node.resolvedExecutableSha256,
      "Node runtime",
    ),
    agentScript: exactExecutable(
      runtime.paths.agentScriptPath,
      closure.agentScriptSha256,
      "general agent",
    ),
    pythonExecutable: exactExecutable(
      runtime.paths.pythonRequestedVenvPath,
      closure.python.realExecutableSha256,
      "Python virtual environment launcher",
    ),
    frontendExecutable: exactExecutable(
      runtime.paths.npmRequestedCliPath,
      closure.npm.resolvedCliSha256,
      "npm CLI",
    ),
  };
}

function createTaskRegistration(task: SentinelProductionTask): SentinelProductionTaskRegistration {
  return {
    schemaVersion: "pm.public-eval-corners.sentinel-production-task-registration.v1",
    taskId: task.taskId,
    environment: task.environment,
    scenarioRelativePath: sentinelProductionScenarioRelativePath(task),
    scenarioSha256: task.scenarioSha256,
    repositoryUrl: SENTINEL_PRODUCTION_REPOSITORY,
    revision: SENTINEL_PRODUCTION_REVISION,
  };
}

function continuityTenantBody(
  tenant: string,
  createdAt: string,
): Omit<SentinelProductionContinuityTenantReceipt, "receiptSha256"> {
  return {
    schemaVersion: "pm.public-eval-corners.sentinel-production-continuity-tenant.v1",
    tenant,
    createdAt,
    initialCheckpointCount: 0,
    initialCheckpointHeadSha256: null,
  };
}

function emptyContinuityReplay(
  context: CellExecutionContext,
  exportedAt: string,
): SentinelProductionContinuityReplayExport {
  const withoutHash = {
    schemaVersion: "pm.public-eval-corners.sentinel-production-continuity-replay.v1" as const,
    tenant: context.tenant,
    agentId: context.agentId,
    scope: context.scope,
    exportedAt,
    tenantRow: null,
    checkpoints: [] as readonly JsonValue[],
    checkpointCount: 0,
    checkpointHeadSha256: null,
  };
  return { ...withoutHash, exportSha256: sentinelProductionJsonSha256(withoutHash) };
}


function selectedTasks(plan: SentinelProductionPreregistration): readonly SentinelProductionTask[] {
  switch (plan.registration.selectedPhase) {
    case "qualification":
      return plan.benchmark.universes.qualification.tasks;
    case "procedural-holdout":
      return plan.benchmark.universes.proceduralHoldout.tasks;
    case "powered-confirmatory":
      return plan.benchmark.universes.poweredConfirmatory.tasks;
  }
}

function maximumArmStartSkewMs(plan: SentinelProductionPreregistration): number {
  assertHash(plan.runtime.runnerScriptSha256, "signed runner script");
  return MAX_ARM_START_SKEW_MS;
}

function commitmentBody(
  commitment: SentinelProductionExternalCommitment,
): Omit<SentinelProductionExternalCommitment, "receiptSha256"> {
  const { receiptSha256: _receiptSha256, ...body } = commitment;
  return body;
}

function verifyExternalCommitment(
  commitment: SentinelProductionExternalCommitment,
  trustAnchor: SentinelExternalTrustAnchor,
  plan: SentinelProductionPreregistration,
  signature: SentinelProductionSignature,
  runStartedAt: string,
): string {
  exactKeys(commitment, [
    "commitmentId",
    "committedAt",
    "custodianId",
    "custodianOwnerId",
    "expectedAuthorityId",
    "expectedAuthorityPublicKeySha256",
    "expectedPreregistrationSha256",
    "independent",
    "locator",
    "medium",
    "receiptSha256",
    "schemaVersion",
  ], "external commitment");
  if (
    commitment.schemaVersion !==
      "pm.public-eval-corners.sentinel-production-external-commitment.v1" ||
    commitment.medium !== "independent-append-only-external-record" ||
    commitment.independent !== true ||
    !OPAQUE_IDENTITY.test(commitment.commitmentId) ||
    !OPAQUE_IDENTITY.test(commitment.custodianId) ||
    !OPAQUE_IDENTITY.test(commitment.custodianOwnerId)
  ) throw new Error("external commitment identity or medium is invalid");
  const locator = new URL(commitment.locator);
  if (
    locator.protocol !== "https:" ||
    locator.username !== "" ||
    locator.password !== "" ||
    locator.hash !== ""
  ) throw new Error("external commitment locator must be an uncredentialed HTTPS URL");
  const committedAt = canonicalTimestamp(commitment.committedAt, "commitment committedAt");
  if (
    commitment.expectedPreregistrationSha256 !== trustAnchor.expectedPreregistrationSha256 ||
    commitment.expectedAuthorityId !== trustAnchor.expectedAuthorityId ||
    commitment.expectedAuthorityPublicKeySha256 !==
      trustAnchor.expectedAuthorityPublicKeySha256
  ) throw new Error("external commitment does not bind the out-of-band trust anchor");
  if (
    commitment.custodianOwnerId === plan.registration.producerId ||
    commitment.custodianOwnerId === signature.authority.ownerId
  ) throw new Error("external commitment custodian is not independent of producer and signer");
  if (
    Date.parse(committedAt) < Date.parse(signature.authority.signedAt) ||
    Date.parse(committedAt) >= Date.parse(runStartedAt)
  ) throw new Error("external commitment must follow signing and precede execution");
  const actual = sentinelProductionJsonSha256(commitmentBody(commitment));
  if (commitment.receiptSha256 !== actual) {
    throw new Error("external commitment receipt is not content-addressed");
  }
  return actual;
}

function exactCheckoutKeys(checkouts: SentinelProductionCheckoutSet): void {
  exactKeys(checkouts, ARMS, "checkout map");
}



function validateBlocks(cells: readonly SentinelProductionCell[]): readonly (readonly SentinelProductionCell[])[] {
  if (cells.length === 0 || cells.length % 4 !== 0) {
    throw new Error("signed schedule does not contain complete four-arm blocks");
  }
  const blocks: SentinelProductionCell[][] = [];
  for (let index = 0; index < cells.length; index += 4) {
    const block = cells.slice(index, index + 4);
    if (
      block.length !== 4 ||
      new Set(block.map(({ taskId }) => taskId)).size !== 1 ||
      new Set(block.map(({ repeatId }) => repeatId)).size !== 1 ||
      new Set(block.map(({ arm }) => arm)).size !== 4 ||
      ARMS.some((arm) => !block.some((cell) => cell.arm === arm))
    ) throw new Error("signed schedule contains a partial or malformed task-by-repeat block");
    blocks.push(block);
  }
  return blocks;
}

function compareCheckoutRoots(preflights: Readonly<Record<SentinelProductionArm, SentinelProductionCheckoutPreflight>>): void {
  const first = preflights.native;
  const fields = [
    "revision",
    "sourceTreeHash",
    "ignoredArtifactRootSha256",
    "databaseRootSha256",
    "selectedScenarioRootSha256",
    "frontendInstalledTreeSha256",
    "frontendPackageLockSha256",
    "serverRequirementsSha256",
  ] as const;
  for (const arm of ARMS) {
    const current = preflights[arm];
    if (!current.valid) throw new Error(`${arm} checkout preflight failed: ${current.issues.join("; ")}`);
    for (const field of fields) {
      if (current[field] !== first[field]) {
        throw new Error(`four-arm checkout ${field} roots are not identical`);
      }
    }
  }
}

function inspectAllCheckouts(
  input: SentinelProductionExecutionInput,
  tasks: readonly SentinelProductionTask[],
  dependencies: SentinelProductionRunnerDependencies,
): Readonly<Record<SentinelProductionArm, SentinelProductionCheckoutPreflight>> {
  const entries = ARMS.map((arm) => [
    arm,
    dependencies.inspectCheckout(input.checkouts[arm], tasks, input.preregistration.runtime),
  ] as const);
  const output = Object.fromEntries(entries) as unknown as Record<
    SentinelProductionArm,
    SentinelProductionCheckoutPreflight
  >;
  compareCheckoutRoots(output);
  return output;
}

function assertRuntimeInspection(
  inspection: SentinelProductionRuntimeInspection,
  plan: SentinelProductionPreregistration,
  expectedExecutableIdentitySha256?: string,
): void {
  assertSentinelProductionRuntimeInspectionEvidence(inspection);
  if (!inspection.valid) throw new Error(`runtime closure failed: ${inspection.issues.join("; ")}`);
  if (
    sentinelProductionCanonicalJson(inspection.closure) !==
      sentinelProductionCanonicalJson(plan.runtime) ||
    inspection.closureSha256 !== plan.runtime.closureSha256
  ) throw new Error("reconstructed runtime closure differs from signed preregistration");
  assertHash(inspection.executableIdentitySha256, "runtime executable identity");
  if (
    expectedExecutableIdentitySha256 !== undefined &&
    inspection.executableIdentitySha256 !== expectedExecutableIdentitySha256
  ) throw new Error("runtime executable identity changed between block boundaries");
}

interface SentinelVerifiedExecutionInputs {
  readonly preregistrationSha256: string;
  readonly blocks: readonly (readonly SentinelProductionCell[])[];
  readonly tasks: readonly SentinelProductionTask[];
  readonly runtime: SentinelProductionRuntimeInspection;
  readonly checkouts: Readonly<
    Record<SentinelProductionArm, SentinelProductionCheckoutPreflight>
  >;
}

function verifyExecutionBindings(
  input: SentinelProductionExecutionInput,
  preregistrationSha256: string,
  cells: readonly SentinelProductionCell[],
  dependencies: Pick<
    SentinelProductionRunnerDependencies,
    "inspectRuntime" | "inspectCheckout"
  >,
): SentinelVerifiedExecutionInputs {
  maximumArmStartSkewMs(input.preregistration);
  exactCheckoutKeys(input.checkouts);
  const canonicalCheckouts = ARMS.map((arm) => realpathSync(resolve(input.checkouts[arm])));
  if (new Set(canonicalCheckouts).size !== 4) {
    throw new Error("four execution arms require four disjoint checkouts");
  }
  assertSentinelFreshDisjointRoots(
    canonicalCheckouts,
    resolve(input.batchRoot),
    resolve(input.attemptRegistryRoot),
  );
  if (typeof input.databaseUrl !== "string" || input.databaseUrl.length < 8) {
    throw new Error("databaseUrl is missing or invalid");
  }
  if (typeof input.anthropicApiKey !== "string" || input.anthropicApiKey.length < 8) {
    throw new Error("anthropicApiKey is missing or invalid");
  }
  const runtime = dependencies.inspectRuntime(input.runtime, input.preregistration.runtime);
  assertRuntimeInspection(runtime, input.preregistration);
  const tasks = selectedTasks(input.preregistration);
  const checkouts = inspectAllCheckouts(
    input,
    tasks,
    dependencies as SentinelProductionRunnerDependencies,
  );
  return {
    preregistrationSha256,
    blocks: validateBlocks(cells),
    tasks,
    runtime,
    checkouts,
  };
}

export function verifySentinelProductionRunInputs(
  input: SentinelProductionRunInput,
  runStartedAt: string,
  dependencies: Pick<
    SentinelProductionRunnerDependencies,
    "inspectRuntime" | "inspectCheckout"
  >,
): {
  readonly preregistrationSha256: string;
  readonly commitmentSha256: string;
  readonly blocks: readonly (readonly SentinelProductionCell[])[];
  readonly tasks: readonly SentinelProductionTask[];
  readonly runtime: SentinelProductionRuntimeInspection;
  readonly checkouts: Readonly<Record<SentinelProductionArm, SentinelProductionCheckoutPreflight>>;
} {
  canonicalTimestamp(runStartedAt, "runStartedAt");
  const verification = verifySentinelProductionPreregistration(
    input.preregistration,
    input.signature,
    input.trustAnchor,
  );
  if (!verification.valid || !verification.signatureValid || !verification.externallyAnchored) {
    throw new Error(`production preregistration verification failed: ${verification.issues.join("; ")}`);
  }
  if (Date.parse(input.signature.authority.signedAt) >= Date.parse(runStartedAt)) {
    throw new Error("external signature must strictly precede run start");
  }
  const commitmentSha256 = verifyExternalCommitment(
    input.externalCommitment,
    input.trustAnchor,
    input.preregistration,
    input.signature,
    runStartedAt,
  );
  return {
    ...verifyExecutionBindings(
      input,
      verification.preregistrationSha256,
      verification.cells,
      dependencies,
    ),
    commitmentSha256,
  };
}

function reconstructLocalDiagnosticPlan(
  plan: SentinelProductionPreregistration,
): SentinelProductionPreregistration {
  return createSentinelProductionPreregistration({
    registrationId: plan.registration.registrationId,
    registeredAt: plan.registration.registeredAt,
    producerId: plan.registration.producerId,
    selectedPhase: plan.registration.selectedPhase,
    repeatIds: plan.execution.repeatIds,
    randomizationSeed: plan.execution.randomizationSeed,
    systemPromptSha256: plan.model.systemPromptSha256,
    actionSchemaSha256: plan.model.actionSchemaSha256,
    runtime: plan.runtime,
    poweredConfirmatoryUniverse: plan.benchmark.universes.poweredConfirmatory,
    bootstrapSeed: plan.analysis.bootstrapSeed,
    rawBatchVerifierId: plan.analysis.rawBatchVerifier.verifierId,
    rawBatchVerifierRevision: plan.analysis.rawBatchVerifier.verifierRevision,
    rawBatchVerifierSha256: plan.analysis.rawBatchVerifier.verifierScriptSha256,
  });
}

export function verifySentinelProductionDiagnosticRunInputs(
  input: SentinelProductionDiagnosticRunInput,
  selection: SentinelProductionDiagnosticSelection,
  runStartedAt: string,
  dependencies: Pick<
    SentinelProductionRunnerDependencies,
    "inspectRuntime" | "inspectCheckout"
  >,
): SentinelVerifiedExecutionInputs & {
  readonly scheduleSha256: string;
  readonly selection: SentinelProductionDiagnosticSelection;
} {
  canonicalTimestamp(runStartedAt, "diagnostic runStartedAt");
  assertHash(input.expectedPreregistrationSha256, "diagnostic expected preregistration");
  assertHash(input.expectedScheduleSha256, "diagnostic expected schedule");
  const preregistrationSha256 = sentinelProductionJsonSha256(input.preregistration);
  if (preregistrationSha256 !== input.expectedPreregistrationSha256) {
    throw new Error("local diagnostic preregistration differs from its disclosed frozen hash");
  }
  const reconstructed = reconstructLocalDiagnosticPlan(input.preregistration);
  if (
    sentinelProductionCanonicalJson(reconstructed) !==
    sentinelProductionCanonicalJson(input.preregistration)
  ) {
    throw new Error("local diagnostic preregistration is not the exact production plan structure");
  }
  canonicalTimestamp(
    input.preregistration.registration.registeredAt,
    "local diagnostic registeredAt",
  );
  if (
    !PLAN_ID.test(input.preregistration.registration.registrationId) ||
    !PLAN_ID.test(input.preregistration.registration.producerId) ||
    input.preregistration.execution.repeatIds.length !== 3 ||
    new Set(input.preregistration.execution.repeatIds).size !== 3 ||
    input.preregistration.execution.repeatIds.some((repeatId) => !PLAN_ID.test(repeatId)) ||
    !PLAN_ID.test(input.preregistration.execution.randomizationSeed) ||
    !PLAN_ID.test(input.preregistration.analysis.bootstrapSeed) ||
    !PLAN_ID.test(input.preregistration.analysis.rawBatchVerifier.verifierId) ||
    !GIT_SHA1.test(input.preregistration.analysis.rawBatchVerifier.verifierRevision) ||
    !SHA256.test(input.preregistration.analysis.rawBatchVerifier.verifierScriptSha256) ||
    !SHA256.test(input.preregistration.model.systemPromptSha256) ||
    !SHA256.test(input.preregistration.model.actionSchemaSha256)
  ) throw new Error("local diagnostic dynamic plan identities or hashes are invalid");
  if (
    input.preregistration.registration.selectedPhase !== "qualification" ||
    input.preregistration.benchmark.universes.qualification.efficacyEligible !== false ||
    input.preregistration.analysis.qualificationMaterialBenefit !== false
  ) {
    throw new Error("local diagnostic accepts only the non-efficacy qualification plan");
  }
  if (Date.parse(input.preregistration.registration.registeredAt) >= Date.parse(runStartedAt)) {
    throw new Error("local diagnostic registration must strictly precede run start");
  }
  const cells = buildSentinelProductionSchedule(input.preregistration);
  const scheduleSha256 = sentinelProductionJsonSha256(cells);
  if (scheduleSha256 !== input.expectedScheduleSha256) {
    throw new Error("local diagnostic schedule differs from its disclosed frozen hash");
  }
  const blocks = validateBlocks(cells);
  if (!Number.isSafeInteger(selection.blockSequence) || selection.blockSequence < 1) {
    throw new Error("local diagnostic blockSequence is invalid");
  }
  const block = blocks[selection.blockSequence - 1];
  if (
    block === undefined ||
    block[0]?.taskId !== selection.taskId ||
    block[0]?.repeatId !== selection.repeatId ||
    block[0]?.taskRole !== "state-retention-relative" ||
    sentinelProductionCanonicalJson(block.map(({ cellId }) => cellId)) !==
      sentinelProductionCanonicalJson(selection.cellIds)
  ) {
    throw new Error("local diagnostic selection is not one exact qualification state-retention block");
  }
  const verified = verifyExecutionBindings(
    input,
    preregistrationSha256,
    cells,
    dependencies,
  );
  return { ...verified, scheduleSha256, selection };
}

function portFromOrigin(origin: string, label: string): number {
  const parsed = new URL(origin);
  if (
    parsed.protocol !== "http:" ||
    parsed.hostname !== LOOPBACK_HOST ||
    parsed.port === "" ||
    parsed.pathname !== "/" ||
    parsed.search !== "" ||
    parsed.hash !== ""
  ) throw new Error(`${label} is not an explicit loopback origin`);
  return Number(parsed.port);
}

function parseProviderReady(
  provider: SentinelGeneralAnthropicProviderProxy,
  providerRoot: string,
  token: string,
  expectedPort: number,
  plan: SentinelProductionPreregistration,
): { readonly path: string; readonly sha256: string } {
  const path = resolve(provider.readyReceiptPath);
  if (path !== resolve(providerRoot, "anthropic-provider-ready.json")) {
    throw new Error("provider ready receipt path is not attempt-bound");
  }
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("provider ready receipt is unsafe");
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch {
    throw new Error("provider ready receipt is not JSON");
  }
  exactKeys(parsed, [
    "actionSchemaSha256",
    "anthropicVersion",
    "auditHeadHash",
    "authorizationTokenSha256",
    "endpointPath",
    "evidenceEligible",
    "maxCompletionTokens",
    "noAutomaticRetries",
    "origin",
    "pinnedModel",
    "providerEndpoint",
    "receiptHash",
    "requestCaptureExcludesSecrets",
    "schemaVersion",
    "startedAt",
    "statelessProviderConversation",
    "systemPromptSha256",
    "temperature",
  ], "provider ready receipt");
  const ready = parsed as Record<string, unknown>;
  const receiptHash = ready.receiptHash;
  const { receiptHash: _receiptHash, ...body } = ready;
  if (
    ready.schemaVersion !==
      "pm.public-eval-corners.sentinel-general-anthropic-provider-ready.v1" ||
    ready.evidenceEligible !== false ||
    ready.origin !== provider.origin ||
    portFromOrigin(provider.origin, "provider origin") !== expectedPort ||
    provider.authorizationToken !== token ||
    ready.authorizationTokenSha256 !== sentinelProductionSha256(token) ||
    ready.pinnedModel !== SENTINEL_GENERAL_ANTHROPIC_PINNED_MODEL ||
    ready.systemPromptSha256 !== SENTINEL_GENERAL_ANTHROPIC_SYSTEM_PROMPT_SHA256 ||
    ready.actionSchemaSha256 !== SENTINEL_GENERAL_ANTHROPIC_ACTION_SCHEMA_SHA256 ||
    ready.systemPromptSha256 !== plan.model.systemPromptSha256 ||
    ready.actionSchemaSha256 !== plan.model.actionSchemaSha256 ||
    ready.noAutomaticRetries !== true ||
    receiptHash !== sentinelProductionJsonSha256(body)
  ) throw new Error("provider ready receipt is not bound to the signed cell runtime");
  return { path, sha256: String(receiptHash) };
}

function validateStateReady(
  state: RunningProductionStateSidecar,
  context: CellExecutionContext,
  evidenceBinding: string,
): SentinelProductionServiceBinding["state"] {
  const ready = state.readyReceipt;
  const identitySha256 = sentinelProductionJsonSha256({
    tenant: context.tenant,
    agentId: context.agentId,
    scope: context.scope,
  });
  const expectedBackend = context.cell.arm === "native"
    ? "discard"
    : context.cell.arm === "plain-kv"
      ? "plain-kv"
      : "continuity";
  const mismatches = [
    ["mode", ready.mode === context.cell.arm],
    ["endpoint", ready.endpoint === state.endpoint],
    ["port", portFromOrigin(state.endpoint, "state endpoint") === context.ports.state],
    ["token", ready.tokenSha256 === sentinelProductionSha256(context.stateToken)],
    ["evidence binding", ready.evidenceBindingSha256 === sentinelProductionSha256(evidenceBinding)],
    ["identity", ready.identitySha256 === identitySha256],
    ["response deadline", ready.responseDeadlineMs === PRODUCTION_STATE_RESPONSE_DEADLINE_MS],
    ["backend", ready.initialBackend === expectedBackend],
    ["agent count", ready.initialAgentChainRecordCount === 0],
    ["scope count", ready.initialScopeRecordCount === 0],
    ["backend head", ready.initialBackendHeadSha256 === HASH_GENESIS],
    ["relevant state", SHA256.test(ready.initialRelevantStateSha256)],
    ["audit genesis", ready.auditGenesisSha256 === HASH_GENESIS],
    ["receipt", SHA256.test(ready.receiptSha256)],
  ] as const;
  const failed = mismatches.filter(([, valid]) => !valid).map(([label]) => label);
  if (failed.length > 0) {
    throw new Error(`state ready receipt failed signed-cell bindings: ${failed.join(", ")}`);
  }
  if (existsSync(state.plainKvStatePath)) {
    throw new Error("state backend was not empty before the first agent state operation");
  }
  const auditStat = statSync(state.auditPath);
  if (!auditStat.isFile() || auditStat.size !== 0) {
    throw new Error("state audit was not empty before the first agent operation");
  }
  return {
    mode: context.cell.arm,
    origin: state.endpoint,
    tokenSha256: ready.tokenSha256,
    evidenceBindingSha256: ready.evidenceBindingSha256,
    identitySha256: ready.identitySha256,
    readyReceiptPath: relative(context.cellRoot, state.readyReceiptPath),
    readyReceiptSha256: ready.receiptSha256,
    initialBackendRecordCount: ready.initialAgentChainRecordCount,
    initialBackendHeadSha256: ready.initialBackendHeadSha256,
    initialRelevantStateSha256: ready.initialRelevantStateSha256,
    responseDeadlineMs: ready.responseDeadlineMs,
    firstStateFresh: true,
  };
}

function createAgentConfig(
  context: CellExecutionContext,
  runtime: SentinelProductionRuntimeBindings,
  closure: SentinelRuntimeClosure,
): SentinelProductionExecutableIdentity {
  const executables = runtimeExecutables(runtime, closure);
  const body = {
    agent_subprocess: [
      executables.agentRuntimeExecutable.path,
      executables.agentScript.path,
      "--url",
      "__TASK_URL__",
      "--prompt",
      "__TASK_PROMPT__",
    ],
    server_url: `http://${LOOPBACK_HOST}:${context.ports.server}`,
    frontend_url: `http://${LOOPBACK_HOST}:${context.ports.frontend}`,
    speed_factor: 1,
  };
  exactKeys(body, ["agent_subprocess", "frontend_url", "server_url", "speed_factor"], "agent config");
  writeExclusiveJson(context.agentConfigPath, body);
  return { path: context.agentConfigPath, sha256: hashFile(context.agentConfigPath) };
}

function stateEvidenceBinding(
  preregistrationSha256: string,
  context: CellExecutionContext,
): string {
  return sentinelProductionCanonicalJson({
    schemaVersion: "pm.public-eval-corners.sentinel-production-state-evidence-binding.v1",
    preregistrationSha256,
    sequence: context.cell.sequence,
    cellId: context.cell.cellId,
    attemptId: context.attemptId,
  });
}

function assertOpaqueValue(
  value: string,
  expression: RegExp,
  label: string,
  used: Set<string>,
): string {
  if (!expression.test(value)) throw new Error(`${label} is not in its opaque canonical form`);
  if (used.has(value)) throw new Error(`${label} was reused across production cells`);
  used.add(value);
  return value;
}

function contextForCell(input: {
  readonly cell: SentinelProductionCell;
  readonly task: SentinelProductionTask;
  readonly blockSequence: number;
  readonly preregistrationSha256: string;
  readonly checkoutPath: string;
  readonly checkoutPreflight: SentinelProductionCheckoutPreflight;
  readonly batchRoot: string;
  readonly ports: CellPorts;
  readonly dependencies: SentinelProductionRunnerDependencies;
  readonly usedOpaqueValues: Set<string>;
  readonly diagnosticExecutionId?: string;
}): CellExecutionContext {
  const derivedAttemptId = input.diagnosticExecutionId === undefined
    ? input.dependencies.deriveAttemptId(input.preregistrationSha256, input.cell.cellId)
    : `spa-${sentinelProductionSha256(
        `pm.sentinel.local-diagnostic.attempt.v1\0${input.preregistrationSha256}\0${input.diagnosticExecutionId}\0${input.cell.cellId}`,
      ).slice(0, 48)}`;
  const attemptId = assertOpaqueValue(
    derivedAttemptId,
    OPAQUE_ATTEMPT_ID,
    "attemptId",
    input.usedOpaqueValues,
  );
  const stateToken = assertOpaqueValue(
    input.dependencies.opaqueToken(), OPAQUE_TOKEN, "state token", input.usedOpaqueValues,
  );
  const providerToken = assertOpaqueValue(
    input.dependencies.opaqueToken(), OPAQUE_TOKEN, "provider token", input.usedOpaqueValues,
  );
  const tenant = assertOpaqueValue(
    input.dependencies.opaqueIdentity("tenant"), OPAQUE_IDENTITY, "tenant", input.usedOpaqueValues,
  );
  const agentId = assertOpaqueValue(
    input.dependencies.opaqueIdentity("agent"), OPAQUE_IDENTITY, "agentId", input.usedOpaqueValues,
  );
  const scope = assertOpaqueValue(
    input.dependencies.opaqueIdentity("scope"), OPAQUE_IDENTITY, "scope", input.usedOpaqueValues,
  );
  const cellRoot = resolve(input.batchRoot, "cells", attemptId);
  return {
    cell: input.cell,
    task: input.task,
    blockSequence: input.blockSequence,
    attemptId,
    checkoutPath: input.checkoutPath,
    checkoutPreflight: input.checkoutPreflight,
    cellRoot,
    stateEvidenceRoot: resolve(cellRoot, "state", "evidence"),
    stateStoreRoot: resolve(cellRoot, "state", "store"),
    providerRoot: resolve(cellRoot, "provider"),
    upstreamRoot: resolve(cellRoot, "upstream"),
    continuityRoot: resolve(cellRoot, "continuity"),
    agentConfigPath: resolve(cellRoot, "input", "agent-config.json"),
    ports: input.ports,
    stateToken,
    providerToken,
    tenant,
    agentId,
    scope,
    failures: [],
  };
}

function initializeCellDirectories(context: CellExecutionContext): void {
  mkdirSync(context.cellRoot, { mode: 0o700 });
  mkdirSync(resolve(context.cellRoot, "input"), { mode: 0o700 });
  mkdirSync(resolve(context.cellRoot, "state"), { mode: 0o700 });
  mkdirSync(context.stateEvidenceRoot, { mode: 0o700 });
  mkdirSync(context.stateStoreRoot, { mode: 0o700 });
  mkdirSync(context.continuityRoot, { mode: 0o700 });
}

function validateTenantReceipt(
  receipt: SentinelProductionContinuityTenantReceipt,
  context: CellExecutionContext,
): void {
  exactKeys(receipt, [
    "createdAt",
    "initialCheckpointCount",
    "initialCheckpointHeadSha256",
    "receiptSha256",
    "schemaVersion",
    "tenant",
  ], "continuity tenant receipt");
  const body = continuityTenantBody(context.tenant, receipt.createdAt);
  if (
    receipt.schemaVersion !== "pm.public-eval-corners.sentinel-production-continuity-tenant.v1" ||
    receipt.tenant !== context.tenant ||
    receipt.initialCheckpointCount !== 0 ||
    receipt.initialCheckpointHeadSha256 !== null ||
    receipt.receiptSha256 !== sentinelProductionJsonSha256(body)
  ) throw new Error("continuity tenant receipt does not prove a fresh unique tenant");
}

async function prepareCell(
  context: CellExecutionContext,
  input: SentinelProductionExecutionInput,
  preregistrationSha256: string,
  dependencies: SentinelProductionRunnerDependencies,
): Promise<void> {
  try {
    initializeCellDirectories(context);
    dependencies.retainScenarioDefinition(
      context.checkoutPath,
      context.task,
      resolve(context.cellRoot, "input", "scenario-definition.json"),
    );
    context.agentConfig = createAgentConfig(context, input.runtime, input.preregistration.runtime);
    if (context.cell.arm === "sham" || context.cell.arm === "substrate") {
      const createdAt = canonicalTimestamp(dependencies.now(), "tenant createdAt");
      context.tenantReceipt = await dependencies.createContinuityTenant({
        databaseUrl: input.databaseUrl,
        tenant: context.tenant,
        createdAt,
      });
      validateTenantReceipt(context.tenantReceipt, context);
      writeExclusiveJson(
        resolve(context.continuityRoot, "continuity-tenant-receipt.json"),
        context.tenantReceipt,
      );
    }
    const evidenceBinding = stateEvidenceBinding(preregistrationSha256, context);
    context.state = await dependencies.startStateSidecar({
      mode: context.cell.arm,
      evidenceBinding,
      evidenceDirectory: context.stateEvidenceRoot,
      stateDirectory: context.stateStoreRoot,
      bearerToken: context.stateToken,
      tenant: context.tenant,
      agentId: context.agentId,
      scope: context.scope,
      ...(context.cell.arm === "sham" || context.cell.arm === "substrate"
        ? { databaseUrl: input.databaseUrl }
        : {}),
      port: context.ports.state,
      responseDeadlineMs: PRODUCTION_STATE_RESPONSE_DEADLINE_MS,
    });
    context.stateBinding = validateStateReady(context.state, context, evidenceBinding);
    context.provider = await dependencies.startProviderProxy({
      outputRoot: context.providerRoot,
      anthropicApiKey: input.anthropicApiKey,
      authorizationToken: context.providerToken,
      port: context.ports.provider,
    });
    const providerReady = parseProviderReady(
      context.provider,
      context.providerRoot,
      context.providerToken,
      context.ports.provider,
      input.preregistration,
    );
    context.providerBinding = {
      origin: context.provider.origin,
      tokenSha256: sentinelProductionSha256(context.providerToken),
      readyReceiptPath: relative(context.cellRoot, providerReady.path),
      readyReceiptSha256: providerReady.sha256,
    };
  } catch (error) {
    context.failures.push({
      stage: "cell-preparation",
      message: safeError(error, [input.databaseUrl, input.anthropicApiKey, context.stateToken, context.providerToken]),
    });
  }
}

function readyForSimultaneousLaunch(context: CellExecutionContext): boolean {
  return (
    context.failures.length === 0 &&
    context.state !== undefined &&
    context.provider !== undefined &&
    context.stateBinding !== undefined &&
    context.providerBinding !== undefined &&
    context.agentConfig !== undefined
  );
}

function supervisorInput(
  context: CellExecutionContext,
  input: SentinelProductionExecutionInput,
): SentinelProductionSupervisorInput {
  if (!context.state || !context.provider || !context.agentConfig) {
    throw new Error("cell services were not ready for supervisor launch");
  }
  const executables = runtimeExecutables(input.runtime, input.preregistration.runtime);
  return {
    schemaVersion: "pm.public-eval-corners.sentinel-production-attempt-input.v1",
    attemptId: context.attemptId,
    task: createTaskRegistration(context.task),
    checkoutPath: context.checkoutPath,
    outputRoot: context.upstreamRoot,
    attemptRegistryRoot: resolve(input.attemptRegistryRoot),
    agentConfig: context.agentConfig,
    agentRuntimeExecutable: executables.agentRuntimeExecutable,
    agentScript: executables.agentScript,
    pythonExecutable: executables.pythonExecutable,
    frontendExecutable: executables.frontendExecutable,
    serverPort: context.ports.server,
    frontendPort: context.ports.frontend,
    executionEnvironment: input.preregistration.runtime.executionEnvironment,
    opaqueEnvironment: {
      stateOrigin: context.state.endpoint,
      stateToken: context.stateToken,
      providerOrigin: context.provider.origin,
      providerToken: context.providerToken,
    },
    pollIntervalMs: POLL_INTERVAL_MS,
    activeSettleMs: ACTIVE_SETTLE_MS,
    maxDecisions: MAX_DECISIONS,
    maxConsecutiveActiveActions: MAX_CONSECUTIVE_ACTIVE_ACTIONS,
    viewportWidth: VIEWPORT_WIDTH,
    viewportHeight: VIEWPORT_HEIGHT,
  };
}

function validateSupervisorReceipt(
  receipt: SentinelProductionAttemptTerminalReceipt,
  context: CellExecutionContext,
): void {
  assertNoOutcomeFields(receipt);
  if (
    receipt.schemaVersion !== "pm.public-eval-corners.sentinel-production-attempt-terminal.v1" ||
    receipt.evidenceEligible !== false ||
    receipt.attemptId !== context.attemptId ||
    receipt.taskId !== context.task.taskId ||
    !SHA256.test(receipt.receiptHash)
  ) throw new Error("supervisor receipt is not bound to the signed cell");
}

async function launchPreparedBlock(
  contexts: readonly CellExecutionContext[],
  input: SentinelProductionExecutionInput,
  dependencies: SentinelProductionRunnerDependencies,
  authorization: { readonly timestamp: string; readonly label: string },
): Promise<{ readonly simultaneous: boolean; readonly startSkewMs: number | null }> {
  if (!contexts.every(readyForSimultaneousLaunch)) {
    for (const context of contexts) {
      context.failures.push({
        stage: "complete-block-readiness",
        message: "Supervisor launch withheld because all four matched arms were not ready.",
      });
    }
    return { simultaneous: false, startSkewMs: null };
  }
  await Promise.all(contexts.map(async (context) => {
    try {
      context.attemptInvokedAt = canonicalTimestamp(dependencies.now(), "attempt invokedAt");
      if (Date.parse(authorization.timestamp) >= Date.parse(context.attemptInvokedAt)) {
        throw new Error(`${authorization.label} did not precede attempt invocation`);
      }
      const receipt = await dependencies.superviseAttempt(supervisorInput(context, input));
      validateSupervisorReceipt(receipt, context);
      context.supervisorReceipt = receipt;
      context.attemptStartedAt = readSentinelProductionAttemptStartedAt(
        context.upstreamRoot,
        receipt.startReceiptHash,
        context.attemptId,
      );
      if (Date.parse(authorization.timestamp) >= Date.parse(context.attemptStartedAt)) {
        throw new Error(`${authorization.label} did not precede retained attempt start`);
      }
      if (Date.parse(context.attemptStartedAt) < Date.parse(context.attemptInvokedAt)) {
        throw new Error("retained attempt start predates its runner invocation");
      }
      if (receipt.completion !== "behavioral-complete") {
        context.failures.push({
          stage: "supervisor-infrastructure",
          message: `Supervisor retained infrastructure-incomplete receipt at ${receipt.infrastructureStage ?? "unknown"}.`,
        });
      }
    } catch (error) {
      context.failures.push({
        stage: "supervisor-execution",
        message: safeError(error, [input.databaseUrl, input.anthropicApiKey, context.stateToken, context.providerToken]),
      });
    }
  }));
  const starts = contexts.flatMap(({ attemptStartedAt }) =>
    attemptStartedAt === undefined ? [] : [Date.parse(attemptStartedAt)]);
  const startSkewMs = starts.length === 4 ? Math.max(...starts) - Math.min(...starts) : null;
  const allowed = maximumArmStartSkewMs(input.preregistration);
  const simultaneous = startSkewMs !== null && startSkewMs <= allowed;
  if (!simultaneous) {
    for (const context of contexts) {
      context.failures.push({
        stage: "four-arm-start-skew",
        message: "Four-arm supervisor invocation exceeded the signed maximum start skew.",
      });
    }
  }
  return { simultaneous, startSkewMs };
}

function validateStateFinal(
  context: CellExecutionContext,
  receipt: ProductionStateFinalReceipt,
): void {
  if (
    context.stateBinding === undefined ||
    receipt.mode !== context.cell.arm ||
    receipt.evidenceBindingSha256 !== context.stateBinding.evidenceBindingSha256 ||
    !SHA256.test(receipt.auditHeadSha256) ||
    !SHA256.test(receipt.receiptSha256)
  ) throw new Error("state final receipt is not bound to the ready signed-cell service");
}

function validateProviderFinal(
  receipt: SentinelGeneralAnthropicProviderFinalReceipt,
): void {
  assertNoOutcomeFields(receipt, "provider final receipt");
  const { receiptHash, ...body } = receipt;
  if (
    receipt.schemaVersion !==
      "pm.public-eval-corners.sentinel-general-anthropic-provider-final.v1" ||
    receipt.evidenceEligible !== false ||
    receipt.automaticRetryCount !== 0 ||
    receiptHash !== sentinelProductionJsonSha256(body)
  ) throw new Error("provider final receipt is invalid");
}

function validateReplayExport(
  replay: SentinelProductionContinuityReplayExport,
  context: CellExecutionContext,
): void {
  const { exportSha256, ...body } = replay;
  if (
    replay.schemaVersion !== "pm.public-eval-corners.sentinel-production-continuity-replay.v1" ||
    replay.tenant !== context.tenant ||
    replay.agentId !== context.agentId ||
    replay.scope !== context.scope ||
    replay.checkpointCount !== replay.checkpoints.length ||
    (replay.checkpointHeadSha256 !== null && !SHA256.test(replay.checkpointHeadSha256)) ||
    replay.exportSha256 !== sentinelProductionJsonSha256(body)
  ) throw new Error("continuity replay export is invalid or not cell-bound");
  if (
    (context.cell.arm === "native" || context.cell.arm === "plain-kv") &&
    (replay.tenantRow !== null || replay.checkpointCount !== 0)
  ) throw new Error("non-continuity arm replay export unexpectedly contains database state");
  if (
    (context.cell.arm === "sham" || context.cell.arm === "substrate") &&
    replay.tenantRow === null
  ) throw new Error("continuity arm replay export lacks its independently read tenant row");
  if (replay.checkpointCount === 0 && replay.checkpointHeadSha256 !== null) {
    throw new Error("empty replay export has a nonempty checkpoint head");
  }
  if (replay.checkpointCount > 0) {
    const last = replay.checkpoints.at(-1);
    if (
      !isRecord(last) ||
      typeof last.content_hash !== "string" ||
      replay.checkpointHeadSha256 !== last.content_hash
    ) throw new Error("replay export head does not match its final checkpoint row");
  }
}

async function drainCellServices(
  context: CellExecutionContext,
  input: SentinelProductionExecutionInput,
): Promise<void> {
  const stops: Promise<void>[] = [];
  if (context.state !== undefined) {
    stops.push((async () => {
      try {
        const state = context.state;
        if (state === undefined) throw new Error("state service disappeared before drain");
        const final = await state.stop();
        context.stateFinal = final;
        validateStateFinal(context, final);
        const evidence = verifyProductionStateEvidence(
          context.stateEvidenceRoot,
          state.readyReceipt,
          final,
          readProductionStateAudit(state.auditPath),
        );
        if (!evidence.valid) {
          throw new Error(`state raw evidence verification failed: ${evidence.issues.join("; ")}`);
        }
      } catch (error) {
        context.failures.push({
          stage: "state-service-drain",
          message: safeError(error, [input.databaseUrl, input.anthropicApiKey, context.stateToken]),
        });
      }
    })());
  }
  if (context.provider !== undefined) {
    stops.push((async () => {
      try {
        const provider = context.provider;
        if (provider === undefined) throw new Error("provider disappeared before drain");
        const final = await provider.close();
        context.providerFinal = final;
        validateProviderFinal(final);
      } catch (error) {
        context.failures.push({
          stage: "provider-service-drain",
          message: safeError(error, [input.databaseUrl, input.anthropicApiKey, context.providerToken]),
        });
      }
    })());
  }
  await Promise.all(stops);
}

async function retainReplayExport(
  context: CellExecutionContext,
  input: SentinelProductionExecutionInput,
  dependencies: SentinelProductionRunnerDependencies,
): Promise<void> {
  try {
    const exportedAt = canonicalTimestamp(dependencies.now(), "continuity exportedAt");
    context.replayExport =
      (context.cell.arm === "sham" || context.cell.arm === "substrate") &&
      context.tenantReceipt !== undefined
        ? await dependencies.exportContinuityReplay({
            databaseUrl: input.databaseUrl,
            tenant: context.tenant,
            agentId: context.agentId,
            scope: context.scope,
            exportedAt,
          })
        : emptyContinuityReplay(context, exportedAt);
    validateReplayExport(context.replayExport, context);
    writeExclusiveJson(
      resolve(context.continuityRoot, "continuity-replay-export.json"),
      context.replayExport,
    );
  } catch (error) {
    context.failures.push({
      stage: "continuity-replay-export",
      message: safeError(error, [input.databaseUrl, input.anthropicApiKey]),
    });
  }
}

async function finalizeCell(
  context: CellExecutionContext,
  input: SentinelProductionExecutionInput,
  dependencies: SentinelProductionRunnerDependencies,
  manifestsRoot: string,
): Promise<SentinelProductionCellManifestReference> {
  await drainCellServices(context, input);
  await retainReplayExport(context, input, dependencies);
  if (context.failures.length > 0) {
    writeExclusiveJson(resolve(context.cellRoot, "runner-failure.json"), {
      schemaVersion: "pm.public-eval-corners.sentinel-production-runner-failure.v1",
      evidenceEligible: false,
      materialBenefit: false,
      attemptId: context.attemptId,
      failures: context.failures,
    });
  }
  let artifacts: readonly SentinelProductionArtifactIdentity[] = [];
  let artifactRootSha256 = "";
  try {
    artifacts = inventory(context.cellRoot);
    artifactRootSha256 = sentinelProductionJsonSha256(artifacts);
    sealTree(context.cellRoot);
  } catch (error) {
    context.failures.push({
      stage: "cell-artifact-seal",
      message: safeError(error, [input.databaseUrl, input.anthropicApiKey]),
    });
    artifactRootSha256 = sentinelProductionJsonSha256(artifacts);
  }
  const replayPath = resolve(context.continuityRoot, "continuity-replay-export.json");
  const serviceBinding: SentinelProductionServiceBinding | null =
    context.stateBinding !== undefined &&
    context.providerBinding !== undefined &&
    context.replayExport !== undefined &&
    existsSync(replayPath)
      ? {
          state: context.stateBinding,
          provider: context.providerBinding,
          continuity: {
            tenant: context.tenant,
            agentId: context.agentId,
            scope: context.scope,
            tenantReceiptSha256: context.tenantReceipt?.receiptSha256 ?? null,
            replayExportPath: relative(context.cellRoot, replayPath),
            replayExportSha256: context.replayExport.exportSha256,
          },
        }
      : null;
  const supervisor = context.supervisorReceipt;
  const infrastructureComplete =
    context.failures.length === 0 &&
    supervisor?.completion === "behavioral-complete" &&
    context.stateFinal !== undefined &&
    context.providerFinal !== undefined &&
    serviceBinding !== null;
  const body: SentinelProductionCellManifest = {
    schemaVersion: "pm.public-eval-corners.sentinel-production-cell-manifest.v1",
    evidenceEligible: false,
    materialBenefit: false,
    sequence: context.cell.sequence,
    blockSequence: context.blockSequence,
    cellId: context.cell.cellId,
    phase: context.cell.phase,
    taskId: context.cell.taskId,
    taskRole: context.cell.taskRole,
    arm: context.cell.arm,
    repeatId: context.cell.repeatId,
    attemptId: context.attemptId,
    cellRoot: relative(resolve(input.batchRoot), context.cellRoot),
    checkoutPreflightSha256: context.checkoutPreflight.preflightSha256,
    ports: context.ports,
    retryCount: 0,
    rerunCount: 0,
    replacementCount: 0,
    attemptInvokedAt: context.attemptInvokedAt ?? null,
    attemptStartedAt: context.attemptStartedAt ?? null,
    serviceBinding,
    agentConfigPath: relative(context.cellRoot, context.agentConfigPath),
    agentConfigSha256: context.agentConfig?.sha256 ?? null,
    supervisor: {
      returned: supervisor !== undefined,
      receiptHash: supervisor?.receiptHash ?? null,
      completion: supervisor?.completion ?? null,
      infrastructureStage: supervisor?.infrastructureStage ?? null,
      infrastructureIssueSha256:
        supervisor?.infrastructureIssue === null || supervisor?.infrastructureIssue === undefined
          ? null
          : sentinelProductionSha256(supervisor.infrastructureIssue),
    },
    stateFinalReceiptSha256: context.stateFinal?.receiptSha256 ?? null,
    providerFinalReceiptSha256: context.providerFinal?.receiptHash ?? null,
    runnerFailureCount: context.failures.length,
    infrastructureComplete,
    artifactRootSha256,
    artifacts,
  };
  const manifest = writeContentAddressedJson(
    manifestsRoot,
    `cell-${String(context.cell.sequence).padStart(6, "0")}`,
    body,
  );
  return {
    sequence: context.cell.sequence,
    cellId: context.cell.cellId,
    arm: context.cell.arm,
    attemptId: context.attemptId,
    path: relative(resolve(input.batchRoot), manifest.path),
    sha256: manifest.sha256,
    infrastructureComplete,
  };
}

function sameCheckoutPreflight(
  before: SentinelProductionCheckoutPreflight,
  after: SentinelProductionCheckoutPreflight,
): boolean {
  return before.preflightSha256 === after.preflightSha256;
}

function validatePortAllocation(
  ports: readonly number[],
  count: number,
  used: Set<number>,
): void {
  if (ports.length !== count || new Set(ports).size !== count) {
    throw new Error(`port allocator must return exactly ${count} unique ports`);
  }
  for (const port of ports) {
    if (!Number.isSafeInteger(port) || port < 1024 || port > 65_535 || used.has(port)) {
      throw new Error("port allocator returned an invalid or reused port");
    }
    used.add(port);
  }
}

export function createSentinelProductionRunnerDependencies(): SentinelProductionRunnerDependencies {
  return {
    now: () => new Date().toISOString(),
    verifyExternalCommitmentRecord: verifySentinelProductionExternalCommitmentRecord,
    inspectRuntime: inspectSentinelProductionRuntime,
    inspectCheckout: inspectSentinelProductionCheckout,
    allocatePorts: allocateSentinelProductionPorts,
    deriveAttemptId: (preregistrationSha256, cellId) =>
      `spa-${sentinelProductionSha256(
        `pm.sentinel.production.attempt.v1\0${preregistrationSha256}\0${cellId}`,
      ).slice(0, 48)}`,
    diagnosticExecutionId: () => `sde-${randomBytes(24).toString("hex")}`,
    opaqueToken: () => randomBytes(32).toString("base64url"),
    opaqueIdentity: (kind) => {
      const prefix = kind === "tenant" ? "tnt" : kind === "agent" ? "agt" : "scp";
      return `${prefix}_spe_${randomBytes(18).toString("hex")}`;
    },
    retainScenarioDefinition: retainSentinelProductionScenario,
    createContinuityTenant: createSentinelProductionContinuityTenant,
    exportContinuityReplay: exportSentinelProductionContinuityReplay,
    startStateSidecar: startProductionStateSidecar,
    startProviderProxy: startSentinelGeneralAnthropicProviderProxy,
    superviseAttempt: superviseSentinelProductionAttempt,
  };
}

interface SentinelProductionExecutionMode {
  readonly kind: "production";
  readonly input: SentinelProductionRunInput;
  readonly runStartedAt: string;
  readonly verified: ReturnType<typeof verifySentinelProductionRunInputs>;
}

interface SentinelProductionDiagnosticMode {
  readonly kind: "local-diagnostic";
  readonly input: SentinelProductionDiagnosticRunInput;
  readonly runStartedAt: string;
  readonly diagnosticExecutionId: string;
  readonly verified: ReturnType<typeof verifySentinelProductionDiagnosticRunInputs>;
}

async function runSentinelProductionExecution(
  mode: SentinelProductionExecutionMode | SentinelProductionDiagnosticMode,
  dependencies: SentinelProductionRunnerDependencies,
): Promise<SentinelProductionBatchResult | SentinelProductionDiagnosticResult> {
  const { input, runStartedAt, verified } = mode;
  const indexedBlocks = verified.blocks.map((block, index) => ({ block, blockSequence: index + 1 }));
  const executionBlocks = mode.kind === "production"
    ? indexedBlocks
    : indexedBlocks.filter(({ blockSequence }) =>
        blockSequence === mode.verified.selection.blockSequence);
  const initialRuntimeInspectedAt = canonicalTimestamp(
    dependencies.now(),
    "initial runtime inspectedAt",
  );
  const preparedExternalObservation = mode.kind === "production"
    ? prepareSentinelProductionExternalObservation(
        mode.input.externalCommitment,
        await dependencies.verifyExternalCommitmentRecord(mode.input.externalCommitment),
        runStartedAt,
        canonicalTimestamp(dependencies.now(), "external commitment locallyValidatedAt"),
      )
    : null;
  const batchRoot = resolve(input.batchRoot);
  const registryRoot = resolve(input.attemptRegistryRoot);
  mkdirSync(batchRoot, { mode: 0o700 });
  mkdirSync(registryRoot, { mode: 0o700 });
  mkdirSync(resolve(batchRoot, "inputs"), { mode: 0o700 });
  mkdirSync(resolve(batchRoot, "cells"), { mode: 0o700 });
  mkdirSync(resolve(batchRoot, "manifests"), { mode: 0o700 });
  mkdirSync(resolve(batchRoot, "manifests", "cells"), { mode: 0o700 });
  mkdirSync(resolve(batchRoot, "manifests", "blocks"), { mode: 0o700 });
  mkdirSync(resolve(batchRoot, "manifests", "runtime"), { mode: 0o700 });

  writeExclusiveJson(resolve(batchRoot, "inputs", "preregistration.json"), input.preregistration);
  if (mode.kind === "production") {
    writeExclusiveJson(resolve(batchRoot, "inputs", "signature.json"), mode.input.signature);
    writeExclusiveJson(resolve(batchRoot, "inputs", "trust-anchor.json"), mode.input.trustAnchor);
    writeExclusiveJson(
      resolve(batchRoot, "inputs", "external-commitment.json"),
      mode.input.externalCommitment,
    );
  } else {
    writeExclusiveJson(resolve(batchRoot, "inputs", "local-diagnostic-disclosure.json"), {
      schemaVersion:
        "pm.public-eval-corners.sentinel-production-local-diagnostic-disclosure.v1",
      trustMode: "local-untrusted-diagnostic",
      independent: false,
      batchComplete: false,
      evidenceEligible: false,
      analysisEligible: false,
      materialBenefit: false,
      diagnosticExecutionId: mode.diagnosticExecutionId,
      expectedPreregistrationSha256: mode.input.expectedPreregistrationSha256,
      expectedScheduleSha256: mode.input.expectedScheduleSha256,
      selectedBlock: mode.verified.selection,
    });
  }
  const externalObservationReceipt =
    mode.kind === "production" && preparedExternalObservation !== null
      ? retainSentinelProductionExternalObservation(batchRoot, preparedExternalObservation)
      : null;
  let runtimeInspectionHeadSha256 = HASH_GENESIS;
  const initialRuntimeInspection = retainSentinelProductionRuntimeInspection({
    batchRoot,
    inspection: verified.runtime,
    boundary: "initial",
    blockSequence: null,
    inspectedAt: initialRuntimeInspectedAt,
    preregistrationClosureSha256: input.preregistration.runtime.closureSha256,
    previousInspectionReceiptSha256: runtimeInspectionHeadSha256,
  });
  runtimeInspectionHeadSha256 = initialRuntimeInspection.inspectionReceiptSha256;
  const commonStart = {
    preregistrationSha256: verified.preregistrationSha256,
    runStartedAt,
    phase: input.preregistration.registration.selectedPhase,
    declaredBlockCount: verified.blocks.length,
    declaredCellCount: verified.blocks.length * 4,
    maximumArmStartSkewMs: maximumArmStartSkewMs(input.preregistration),
    initialRuntimeInspection,
    checkoutPreflights: Object.fromEntries(
      ARMS.map((arm) => [arm, verified.checkouts[arm]]),
    ) as unknown as Readonly<
      Record<SentinelProductionArm, SentinelProductionCheckoutPreflight>
    >,
    schedule: verified.blocks.flat(),
    noAutomaticRetries: true as const,
    noCellReruns: true as const,
    noTaskReplacements: true as const,
    noOutcomeInspectionDuringExecution: true as const,
  };
  const startBody = mode.kind === "production"
    ? {
        schemaVersion: "pm.public-eval-corners.sentinel-production-execution-start.v1",
        evidenceEligible: false,
        materialBenefit: false,
        ...commonStart,
        signatureSha256: sentinelProductionJsonSha256(mode.input.signature),
        externalCommitmentSha256: mode.verified.commitmentSha256,
        externalCommitmentObservation: {
          path: relative(batchRoot, externalObservationReceipt!.path),
          receiptSha256: externalObservationReceipt!.sha256,
          bodyPath: preparedExternalObservation!.receiptBody.bodyPath,
          bodySha256: preparedExternalObservation!.receiptBody.bodySha256,
          observedAt: preparedExternalObservation!.receiptBody.observedAt,
        },
      }
    : {
        schemaVersion:
          "pm.public-eval-corners.sentinel-production-local-diagnostic-execution-start.v1" as const,
        trustMode: "local-untrusted-diagnostic" as const,
        independent: false as const,
        batchComplete: false as const,
        evidenceEligible: false as const,
        analysisEligible: false as const,
        materialBenefit: false as const,
        diagnosticExecutionId: mode.diagnosticExecutionId,
        expectedPreregistrationSha256: mode.input.expectedPreregistrationSha256,
        scheduleSha256: mode.verified.scheduleSha256,
        expectedScheduleSha256: mode.input.expectedScheduleSha256,
        ...commonStart,
        phase: "qualification" as const,
        selectedBlock: mode.verified.selection,
      } satisfies SentinelProductionDiagnosticExecutionStart;
  const executionStart = writeContentAddressedJson(
    resolve(batchRoot, "manifests"),
    "execution-start",
    startBody,
  );

  const tasks = new Map(verified.tasks.map((task) => [task.taskId, task] as const));
  const usedPorts = new Set<number>();
  const usedOpaqueValues = new Set<string>();
  const cellReferences: SentinelProductionCellManifestReference[] = [];
  const blockReferences: ContentAddressedManifest[] = [];
  let previousBlockManifestSha256 = HASH_GENESIS;
  let allBlocksComplete = true;

  for (const { block, blockSequence } of executionBlocks) {
    const runtimeBefore = dependencies.inspectRuntime(input.runtime, input.preregistration.runtime);
    const runtimeBeforeReference = retainSentinelProductionRuntimeInspection({
      batchRoot,
      inspection: runtimeBefore,
      boundary: "before",
      blockSequence,
      inspectedAt: canonicalTimestamp(dependencies.now(), "runtime-before inspectedAt"),
      preregistrationClosureSha256: input.preregistration.runtime.closureSha256,
      previousInspectionReceiptSha256: runtimeInspectionHeadSha256,
    });
    runtimeInspectionHeadSha256 = runtimeBeforeReference.inspectionReceiptSha256;
    assertRuntimeInspection(
      runtimeBefore,
      input.preregistration,
      verified.runtime.executableIdentitySha256,
    );
    const checkoutBefore = inspectAllCheckouts(input, verified.tasks, dependencies);
    for (const arm of ARMS) {
      if (!sameCheckoutPreflight(verified.checkouts[arm], checkoutBefore[arm])) {
        throw new Error(`${arm} checkout changed before block ${blockSequence}`);
      }
    }
    const allocated = await dependencies.allocatePorts(16, usedPorts);
    validatePortAllocation(allocated, 16, usedPorts);
    const contexts = block.map((cell, index) => {
      const task = tasks.get(cell.taskId);
      if (!task) throw new Error(`signed task ${cell.taskId} is missing from its phase catalog`);
      const offset = index * 4;
      const ports: CellPorts = {
        state: allocated[offset] as number,
        provider: allocated[offset + 1] as number,
        server: allocated[offset + 2] as number,
        frontend: allocated[offset + 3] as number,
      };
      return contextForCell({
        cell,
        task,
        blockSequence,
        preregistrationSha256: verified.preregistrationSha256,
        checkoutPath: checkoutBefore[cell.arm].checkoutPath,
        checkoutPreflight: checkoutBefore[cell.arm],
        batchRoot,
        ports,
        dependencies,
        usedOpaqueValues,
        ...(mode.kind === "local-diagnostic"
          ? { diagnosticExecutionId: mode.diagnosticExecutionId }
          : {}),
      });
    });
    await Promise.all(contexts.map((context) =>
      prepareCell(context, input, verified.preregistrationSha256, dependencies)));
    const launch = await launchPreparedBlock(contexts, input, dependencies, {
      timestamp: mode.kind === "production"
        ? mode.input.signature.authority.signedAt
        : mode.input.preregistration.registration.registeredAt,
      label: mode.kind === "production" ? "external signature" : "local registration",
    });
    const references = await Promise.all(contexts.map((context) =>
      finalizeCell(
        context,
        input,
        dependencies,
        resolve(batchRoot, "manifests", "cells"),
      )));
    cellReferences.push(...references);

    let runtimeAfter: SentinelProductionRuntimeInspection | null = null;
    let runtimeAfterReference: SentinelProductionRuntimeInspectionReference | null = null;
    let runtimeStable = false;
    let checkoutRootsStable = false;
    try {
      runtimeAfter = dependencies.inspectRuntime(input.runtime, input.preregistration.runtime);
      runtimeAfterReference = retainSentinelProductionRuntimeInspection({
        batchRoot,
        inspection: runtimeAfter,
        boundary: "after",
        blockSequence,
        inspectedAt: canonicalTimestamp(dependencies.now(), "runtime-after inspectedAt"),
        preregistrationClosureSha256: input.preregistration.runtime.closureSha256,
        previousInspectionReceiptSha256: runtimeInspectionHeadSha256,
      });
      runtimeInspectionHeadSha256 = runtimeAfterReference.inspectionReceiptSha256;
      assertRuntimeInspection(
        runtimeAfter,
        input.preregistration,
        runtimeBefore.executableIdentitySha256,
      );
      runtimeStable =
        runtimeAfter.closureSha256 === runtimeBefore.closureSha256 &&
        runtimeAfter.executableIdentitySha256 === runtimeBefore.executableIdentitySha256;
      const checkoutAfter = inspectAllCheckouts(input, verified.tasks, dependencies);
      checkoutRootsStable = ARMS.every((arm) =>
        sameCheckoutPreflight(checkoutBefore[arm], checkoutAfter[arm]));
    } catch {
      runtimeStable = false;
      checkoutRootsStable = false;
    }
    const modeToCell = Object.fromEntries(ARMS.map((arm) => {
      const reference = references.find((candidate) => candidate.arm === arm);
      if (!reference) throw new Error(`block ${blockSequence} lacks ${arm} cell manifest`);
      return [arm, reference];
    })) as unknown as Record<SentinelProductionArm, SentinelProductionCellManifestReference>;
    const blockComplete =
      references.length === 4 &&
      references.every(({ infrastructureComplete }) => infrastructureComplete) &&
      launch.simultaneous &&
      runtimeStable &&
      checkoutRootsStable;
    allBlocksComplete &&= blockComplete;
    const blockBody: SentinelProductionBlockManifest = {
      schemaVersion: "pm.public-eval-corners.sentinel-production-block-manifest.v1",
      evidenceEligible: false,
      materialBenefit: false,
      blockSequence,
      taskId: block[0]?.taskId ?? "",
      repeatId: block[0]?.repeatId ?? "",
      previousBlockManifestSha256,
      expectedArms: ARMS,
      completeArmSet: references.length === 4 && new Set(references.map(({ arm }) => arm)).size === 4,
      simultaneousLaunch: launch.simultaneous,
      maximumObservedStartSkewMs: launch.startSkewMs,
      maximumAllowedStartSkewMs: maximumArmStartSkewMs(input.preregistration),
      runtimeBefore: runtimeBeforeReference,
      runtimeAfter: runtimeAfterReference,
      runtimeStable,
      checkoutRootsStable,
      infrastructureComplete: blockComplete,
      modeToCell,
      completedAt: canonicalTimestamp(dependencies.now(), "block completedAt"),
    };
    const blockManifest = writeContentAddressedJson(
      resolve(batchRoot, "manifests", "blocks"),
      `block-${String(blockSequence).padStart(6, "0")}`,
      blockBody,
    );
    previousBlockManifestSha256 = blockManifest.sha256;
    blockReferences.push(blockManifest);
  }

  const batchComplete = mode.kind === "production" &&
    allBlocksComplete &&
    blockReferences.length === verified.blocks.length &&
    cellReferences.length === verified.blocks.length * 4;
  const diagnosticInfrastructureComplete = mode.kind === "local-diagnostic" &&
    allBlocksComplete && blockReferences.length === 1 && cellReferences.length === 4;
  const retainedBlocks = blockReferences.map((reference) => ({
    path: relative(batchRoot, reference.path),
    sha256: reference.sha256,
  }));
  const finalizedAt = canonicalTimestamp(dependencies.now(), "batch finalizedAt");
  if (mode.kind === "local-diagnostic") {
    if (retainedBlocks.length !== 1 || cellReferences.length !== 4) {
      throw new Error("local diagnostic did not retain exactly one four-arm block");
    }
    const diagnosticBlocks = [retainedBlocks[0]!] as const;
    const orderedCells = [...cellReferences].sort((left, right) => left.sequence - right.sequence);
    const diagnosticCells: SentinelProductionDiagnosticResult["cells"] = [
      orderedCells[0]!,
      orderedCells[1]!,
      orderedCells[2]!,
      orderedCells[3]!,
    ];
    const finalBody: SentinelProductionDiagnosticExecutionFinal = {
      schemaVersion:
        "pm.public-eval-corners.sentinel-production-local-diagnostic-execution-final.v1",
      trustMode: "local-untrusted-diagnostic",
      independent: false,
      batchComplete: false,
      evidenceEligible: false,
      analysisEligible: false,
      materialBenefit: false,
      diagnosticInfrastructureComplete,
      diagnosticExecutionId: mode.diagnosticExecutionId,
      preregistrationSha256: verified.preregistrationSha256,
      scheduleSha256: mode.verified.scheduleSha256,
      runStartedAt,
      declaredBlockCount: verified.blocks.length,
      retainedBlockCount: 1,
      declaredCellCount: verified.blocks.length * 4,
      retainedCellCount: 4,
      retryCount: 0,
      rerunCount: 0,
      replacementCount: 0,
      noOutcomeInspectionDuringExecution: true,
      blockManifestHeadSha256: previousBlockManifestSha256,
      runtimeInspectionHeadSha256,
      selectedBlock: mode.verified.selection,
      blocks: diagnosticBlocks,
      finalizedAt,
    };
    const executionFinal = writeContentAddressedJson(
      resolve(batchRoot, "manifests"),
      "execution-final",
      finalBody,
    );
    sealTree(resolve(batchRoot, "inputs"));
    sealTree(resolve(batchRoot, "manifests"));
    return {
      schemaVersion: "pm.public-eval-corners.sentinel-production-local-diagnostic-result.v1",
      trustMode: "local-untrusted-diagnostic",
      independent: false,
      batchComplete: false,
      evidenceEligible: false,
      analysisEligible: false,
      materialBenefit: false,
      diagnosticInfrastructureComplete,
      diagnosticExecutionId: mode.diagnosticExecutionId,
      batchRoot,
      preregistrationSha256: verified.preregistrationSha256,
      scheduleSha256: mode.verified.scheduleSha256,
      executionStartManifestPath: executionStart.path,
      executionStartManifestSha256: executionStart.sha256,
      executionFinalManifestPath: executionFinal.path,
      executionFinalManifestSha256: executionFinal.sha256,
      blockManifestHeadSha256: previousBlockManifestSha256,
      selectedBlock: mode.verified.selection,
      blocks: diagnosticBlocks,
      cells: diagnosticCells,
    };
  }
  const finalBody: SentinelProductionExecutionManifest = {
    schemaVersion: "pm.public-eval-corners.sentinel-production-execution-manifest.v1",
    evidenceEligible: false,
    materialBenefit: false,
    preregistrationSha256: verified.preregistrationSha256,
    signatureSha256: sentinelProductionJsonSha256(mode.input.signature),
    externalCommitmentSha256: mode.verified.commitmentSha256,
    runStartedAt,
    declaredBlockCount: verified.blocks.length,
    retainedBlockCount: blockReferences.length,
    declaredCellCount: verified.blocks.length * 4,
    retainedCellCount: cellReferences.length,
    retryCount: 0,
    rerunCount: 0,
    replacementCount: 0,
    noOutcomeInspectionDuringExecution: true,
    batchComplete,
    blockManifestHeadSha256: previousBlockManifestSha256,
    runtimeInspectionHeadSha256,
    blocks: retainedBlocks,
    finalizedAt,
  };
  const executionFinal = writeContentAddressedJson(
    resolve(batchRoot, "manifests"),
    "execution-final",
    finalBody,
  );
  sealTree(resolve(batchRoot, "inputs"));
  sealTree(resolve(batchRoot, "manifests"));
  return {
    schemaVersion: "pm.public-eval-corners.sentinel-production-batch-result.v1",
    evidenceEligible: false,
    materialBenefit: false,
    batchComplete,
    batchRoot,
    preregistrationSha256: verified.preregistrationSha256,
    executionStartManifestPath: executionStart.path,
    executionStartManifestSha256: executionStart.sha256,
    executionFinalManifestPath: executionFinal.path,
    executionFinalManifestSha256: executionFinal.sha256,
    blockManifestHeadSha256: previousBlockManifestSha256,
    blocks: retainedBlocks,
    cells: cellReferences.sort((left, right) => left.sequence - right.sequence),
  };
}

export async function runSentinelProductionBatch(
  input: SentinelProductionRunInput,
  dependencies: SentinelProductionRunnerDependencies =
    createSentinelProductionRunnerDependencies(),
): Promise<SentinelProductionBatchResult> {
  const runStartedAt = canonicalTimestamp(dependencies.now(), "runStartedAt");
  const verified = verifySentinelProductionRunInputs(input, runStartedAt, dependencies);
  return await runSentinelProductionExecution({
    kind: "production",
    input,
    runStartedAt,
    verified,
  }, dependencies) as SentinelProductionBatchResult;
}

/** Run one local-only four-arm qualification diagnostic with no independent trust claim. */
export async function runSentinelProductionExcludedSmoke(
  input: SentinelProductionDiagnosticRunInput,
  selection: SentinelProductionDiagnosticSelection,
  dependencies: SentinelProductionRunnerDependencies =
    createSentinelProductionRunnerDependencies(),
): Promise<SentinelProductionDiagnosticResult> {
  const runStartedAt = canonicalTimestamp(dependencies.now(), "diagnostic runStartedAt");
  const verified = verifySentinelProductionDiagnosticRunInputs(
    input,
    selection,
    runStartedAt,
    dependencies,
  );
  const diagnosticExecutionId = dependencies.diagnosticExecutionId();
  if (!OPAQUE_DIAGNOSTIC_EXECUTION_ID.test(diagnosticExecutionId)) {
    throw new Error("diagnosticExecutionId is not a unique opaque execution identity");
  }
  return await runSentinelProductionExecution({
    kind: "local-diagnostic",
    input,
    runStartedAt,
    verified,
    diagnosticExecutionId,
  }, dependencies) as SentinelProductionDiagnosticResult;
}
