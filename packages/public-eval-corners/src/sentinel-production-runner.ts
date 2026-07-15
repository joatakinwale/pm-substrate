import { randomBytes } from "node:crypto";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";

import {
  SENTINEL_PRODUCTION_REPOSITORY,
  SENTINEL_PRODUCTION_REVISION,
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
  type StartProductionStateSidecarInput,
} from "./production-state-sidecar.js";
import {
  SENTINEL_GENERAL_ANTHROPIC_ACTION_SCHEMA_SHA256,
  SENTINEL_GENERAL_ANTHROPIC_PINNED_MODEL,
  SENTINEL_GENERAL_ANTHROPIC_SYSTEM_PROMPT_SHA256,
  startSentinelGeneralAnthropicProviderProxy,
  type SentinelGeneralAnthropicProviderFinalReceipt,
  type SentinelGeneralAnthropicProviderProxy,
  type StartSentinelGeneralAnthropicProviderProxyInput,
} from "./sentinel-general-provider-proxy.js";
import {
  superviseSentinelProductionAttempt,
  type SentinelProductionAttemptTerminalReceipt,
  type SentinelProductionExecutableIdentity,
  type SentinelProductionSupervisorInput,
  type SentinelProductionTaskRegistration,
} from "./sentinel-production-supervisor.js";
import {
  type SentinelRuntimeClosurePaths,
} from "./sentinel-runtime-closure.js";
import {
  assertSentinelProductionRuntimeInspectionEvidence,
  prepareSentinelProductionExternalObservation,
  retainSentinelProductionExternalObservation,
  retainSentinelProductionRuntimeInspection,
  verifySentinelProductionExternalCommitmentRecord,
  type SentinelProductionExternalCommitmentVerification,
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
const MAX_ARTIFACTS_PER_CELL = 100_000;
const SHA256 = /^[a-f0-9]{64}$/u;
const OPAQUE_ATTEMPT_ID = /^spa-[a-f0-9]{48}$/u;
const OPAQUE_IDENTITY = /^[A-Za-z0-9._:-]{1,128}$/u;
const OPAQUE_TOKEN = /^[A-Za-z0-9_-]{43,128}$/u;
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
type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

export interface SentinelProductionRuntimeBindings {
  readonly paths: SentinelRuntimeClosurePaths;
}

export interface SentinelProductionCheckoutSet {
  readonly native: string;
  readonly sham: string;
  readonly "plain-kv": string;
  readonly substrate: string;
}

export interface SentinelProductionExternalCommitment {
  readonly schemaVersion: "pm.public-eval-corners.sentinel-production-external-commitment.v1";
  readonly medium: "independent-append-only-external-record";
  readonly commitmentId: string;
  readonly committedAt: string;
  readonly custodianId: string;
  readonly custodianOwnerId: string;
  readonly independent: true;
  readonly locator: string;
  readonly expectedPreregistrationSha256: string;
  readonly expectedAuthorityId: string;
  readonly expectedAuthorityPublicKeySha256: string;
  readonly receiptSha256: string;
}

export interface SentinelProductionRunInput {
  readonly preregistration: SentinelProductionPreregistration;
  readonly signature: SentinelProductionSignature;
  readonly trustAnchor: SentinelExternalTrustAnchor;
  readonly externalCommitment: SentinelProductionExternalCommitment;
  readonly checkouts: SentinelProductionCheckoutSet;
  readonly batchRoot: string;
  readonly attemptRegistryRoot: string;
  readonly runtime: SentinelProductionRuntimeBindings;
  /** Passed only to continuity-backed state services and never serialized. */
  readonly databaseUrl: string;
  /** Passed only to the provider proxy and never serialized. */
  readonly anthropicApiKey: string;
}

export type {
  SentinelProductionExternalCommitmentVerification,
  SentinelProductionRuntimeInspection,
  SentinelProductionRuntimeInspectionReference,
} from "./sentinel-production-runner-evidence.js";

export interface SentinelProductionCheckoutPreflight {
  readonly schemaVersion: "pm.public-eval-corners.sentinel-production-checkout-preflight.v1";
  readonly checkoutPath: string;
  readonly repositoryUrl: string | null;
  readonly revision: string | null;
  readonly sourceTreeHash: string | null;
  readonly cleanTrackedAndUntracked: boolean;
  readonly ignoredArtifactRootSha256: string;
  readonly databaseRootSha256: string;
  readonly selectedScenarioRootSha256: string;
  readonly frontendInstalledTreeSha256: string;
  readonly frontendPackageLockSha256: string;
  readonly serverRequirementsSha256: string;
  readonly valid: boolean;
  readonly issues: readonly string[];
  readonly preflightSha256: string;
}

export interface SentinelProductionContinuityTenantReceipt {
  readonly schemaVersion: "pm.public-eval-corners.sentinel-production-continuity-tenant.v1";
  readonly tenant: string;
  readonly createdAt: string;
  readonly initialCheckpointCount: 0;
  readonly initialCheckpointHeadSha256: null;
  readonly receiptSha256: string;
}

export interface SentinelProductionContinuityReplayExport {
  readonly schemaVersion: "pm.public-eval-corners.sentinel-production-continuity-replay.v1";
  readonly tenant: string;
  readonly agentId: string;
  readonly scope: string;
  readonly exportedAt: string;
  readonly tenantRow: JsonValue;
  readonly checkpoints: readonly JsonValue[];
  readonly checkpointCount: number;
  readonly checkpointHeadSha256: string | null;
  readonly exportSha256: string;
}

export interface SentinelProductionArtifactIdentity {
  readonly path: string;
  readonly byteLength: number;
  readonly sha256: string;
}

export interface SentinelProductionServiceBinding {
  readonly state: {
    readonly mode: SentinelProductionArm;
    readonly origin: string;
    readonly tokenSha256: string;
    readonly evidenceBindingSha256: string;
    readonly identitySha256: string;
    readonly readyReceiptPath: string;
    readonly readyReceiptSha256: string;
    readonly initialBackendRecordCount: number;
    readonly initialBackendHeadSha256: string | null;
    readonly initialRelevantStateSha256: string;
    readonly responseDeadlineMs: number;
    readonly firstStateFresh: boolean;
  };
  readonly provider: {
    readonly origin: string;
    readonly tokenSha256: string;
    readonly readyReceiptPath: string;
    readonly readyReceiptSha256: string;
  };
  readonly continuity: {
    readonly tenant: string;
    readonly agentId: string;
    readonly scope: string;
    readonly tenantReceiptSha256: string | null;
    readonly replayExportPath: string;
    readonly replayExportSha256: string;
  };
}

export interface SentinelProductionCellManifest {
  readonly schemaVersion: "pm.public-eval-corners.sentinel-production-cell-manifest.v1";
  readonly evidenceEligible: false;
  readonly materialBenefit: false;
  readonly sequence: number;
  readonly blockSequence: number;
  readonly cellId: string;
  readonly phase: SentinelProductionCell["phase"];
  readonly taskId: string;
  readonly taskRole: SentinelProductionCell["taskRole"];
  readonly arm: SentinelProductionArm;
  readonly repeatId: string;
  readonly attemptId: string;
  readonly cellRoot: string;
  readonly checkoutPreflightSha256: string;
  readonly ports: {
    readonly state: number;
    readonly provider: number;
    readonly server: number;
    readonly frontend: number;
  };
  readonly retryCount: 0;
  readonly rerunCount: 0;
  readonly replacementCount: 0;
  readonly attemptInvokedAt: string | null;
  readonly attemptStartedAt: string | null;
  readonly serviceBinding: SentinelProductionServiceBinding | null;
  readonly agentConfigPath: string;
  readonly agentConfigSha256: string | null;
  readonly supervisor: {
    readonly returned: boolean;
    readonly receiptHash: string | null;
    readonly completion: "behavioral-complete" | "infrastructure-incomplete" | null;
    readonly infrastructureStage: string | null;
    readonly infrastructureIssueSha256: string | null;
  };
  readonly stateFinalReceiptSha256: string | null;
  readonly providerFinalReceiptSha256: string | null;
  readonly runnerFailureCount: number;
  readonly infrastructureComplete: boolean;
  readonly artifactRootSha256: string;
  readonly artifacts: readonly SentinelProductionArtifactIdentity[];
}

export interface SentinelProductionCellManifestReference {
  readonly sequence: number;
  readonly cellId: string;
  readonly arm: SentinelProductionArm;
  readonly attemptId: string;
  readonly path: string;
  readonly sha256: string;
  readonly infrastructureComplete: boolean;
}

export interface SentinelProductionBlockManifest {
  readonly schemaVersion: "pm.public-eval-corners.sentinel-production-block-manifest.v1";
  readonly evidenceEligible: false;
  readonly materialBenefit: false;
  readonly blockSequence: number;
  readonly taskId: string;
  readonly repeatId: string;
  readonly previousBlockManifestSha256: string;
  readonly expectedArms: readonly ["native", "sham", "plain-kv", "substrate"];
  readonly completeArmSet: boolean;
  readonly simultaneousLaunch: boolean;
  readonly maximumObservedStartSkewMs: number | null;
  readonly maximumAllowedStartSkewMs: number;
  readonly runtimeBefore: SentinelProductionRuntimeInspectionReference;
  readonly runtimeAfter: SentinelProductionRuntimeInspectionReference | null;
  readonly runtimeStable: boolean;
  readonly checkoutRootsStable: boolean;
  readonly infrastructureComplete: boolean;
  readonly modeToCell: Readonly<Record<SentinelProductionArm, SentinelProductionCellManifestReference>>;
  readonly completedAt: string;
}

export interface SentinelProductionExecutionManifest {
  readonly schemaVersion: "pm.public-eval-corners.sentinel-production-execution-manifest.v1";
  readonly evidenceEligible: false;
  readonly materialBenefit: false;
  readonly preregistrationSha256: string;
  readonly signatureSha256: string;
  readonly externalCommitmentSha256: string;
  readonly runStartedAt: string;
  readonly declaredBlockCount: number;
  readonly retainedBlockCount: number;
  readonly declaredCellCount: number;
  readonly retainedCellCount: number;
  readonly retryCount: 0;
  readonly rerunCount: 0;
  readonly replacementCount: 0;
  readonly noOutcomeInspectionDuringExecution: true;
  readonly batchComplete: boolean;
  readonly blockManifestHeadSha256: string;
  readonly runtimeInspectionHeadSha256: string;
  readonly blocks: readonly { readonly path: string; readonly sha256: string }[];
  readonly finalizedAt: string;
}

export interface SentinelProductionBatchResult {
  readonly schemaVersion: "pm.public-eval-corners.sentinel-production-batch-result.v1";
  readonly evidenceEligible: false;
  readonly materialBenefit: false;
  readonly batchComplete: boolean;
  readonly batchRoot: string;
  readonly preregistrationSha256: string;
  readonly executionStartManifestPath: string;
  readonly executionStartManifestSha256: string;
  readonly executionFinalManifestPath: string;
  readonly executionFinalManifestSha256: string;
  readonly blockManifestHeadSha256: string;
  readonly blocks: readonly { readonly path: string; readonly sha256: string }[];
  readonly cells: readonly SentinelProductionCellManifestReference[];
}

export interface SentinelProductionRunnerDependencies {
  readonly now: () => string;
  readonly verifyExternalCommitmentRecord: (
    commitment: SentinelProductionExternalCommitment,
  ) => Promise<SentinelProductionExternalCommitmentVerification>;
  readonly inspectRuntime: (
    bindings: SentinelProductionRuntimeBindings,
    declared: SentinelRuntimeClosure,
  ) => SentinelProductionRuntimeInspection;
  readonly inspectCheckout: (
    checkoutPath: string,
    selectedTasks: readonly SentinelProductionTask[],
    plannedRuntime: SentinelRuntimeClosure,
  ) => SentinelProductionCheckoutPreflight;
  readonly allocatePorts: (
    count: number,
    excluded: ReadonlySet<number>,
  ) => Promise<readonly number[]>;
  readonly deriveAttemptId: (preregistrationSha256: string, cellId: string) => string;
  readonly opaqueToken: () => string;
  readonly opaqueIdentity: (kind: "tenant" | "agent" | "scope") => string;
  readonly retainScenarioDefinition: (
    checkoutPath: string,
    task: SentinelProductionTask,
    targetPath: string,
  ) => SentinelProductionArtifactIdentity;
  readonly createContinuityTenant: (input: {
    readonly databaseUrl: string;
    readonly tenant: string;
    readonly createdAt: string;
  }) => Promise<SentinelProductionContinuityTenantReceipt>;
  readonly exportContinuityReplay: (input: {
    readonly databaseUrl: string;
    readonly tenant: string;
    readonly agentId: string;
    readonly scope: string;
    readonly exportedAt: string;
  }) => Promise<SentinelProductionContinuityReplayExport>;
  readonly startStateSidecar: (
    input: StartProductionStateSidecarInput,
  ) => Promise<RunningProductionStateSidecar>;
  readonly startProviderProxy: (
    input: StartSentinelGeneralAnthropicProviderProxyInput,
  ) => Promise<SentinelGeneralAnthropicProviderProxy>;
  readonly superviseAttempt: (
    input: SentinelProductionSupervisorInput,
  ) => Promise<SentinelProductionAttemptTerminalReceipt>;
}

interface ContentAddressedManifest {
  readonly path: string;
  readonly sha256: string;
}

interface CellPorts {
  readonly state: number;
  readonly provider: number;
  readonly server: number;
  readonly frontend: number;
}

interface CellExecutionContext {
  readonly cell: SentinelProductionCell;
  readonly task: SentinelProductionTask;
  readonly blockSequence: number;
  readonly attemptId: string;
  readonly checkoutPath: string;
  readonly checkoutPreflight: SentinelProductionCheckoutPreflight;
  readonly cellRoot: string;
  readonly stateEvidenceRoot: string;
  readonly stateStoreRoot: string;
  readonly providerRoot: string;
  readonly upstreamRoot: string;
  readonly continuityRoot: string;
  readonly agentConfigPath: string;
  readonly ports: CellPorts;
  readonly stateToken: string;
  readonly providerToken: string;
  readonly tenant: string;
  readonly agentId: string;
  readonly scope: string;
  readonly failures: { stage: string; message: string }[];
  state?: RunningProductionStateSidecar;
  provider?: SentinelGeneralAnthropicProviderProxy;
  tenantReceipt?: SentinelProductionContinuityTenantReceipt;
  stateBinding?: SentinelProductionServiceBinding["state"];
  providerBinding?: SentinelProductionServiceBinding["provider"];
  agentConfig?: SentinelProductionExecutableIdentity;
  supervisorReceipt?: SentinelProductionAttemptTerminalReceipt;
  attemptInvokedAt?: string;
  attemptStartedAt?: string;
  stateFinal?: ProductionStateFinalReceipt;
  providerFinal?: SentinelGeneralAnthropicProviderFinalReceipt;
  replayExport?: SentinelProductionContinuityReplayExport;
}

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

function writeExclusiveJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx", mode: 0o400 });
  chmodSync(path, 0o400);
}

function writeContentAddressedJson(
  directory: string,
  prefix: string,
  body: Record<string, unknown>,
): ContentAddressedManifest {
  const hash = sentinelProductionJsonSha256(body);
  const path = resolve(directory, `${prefix}-${hash}.json`);
  writeExclusiveJson(path, { ...body, manifestSha256: hash });
  return { path, sha256: hash };
}

function artifactIdentity(path: string, root: string): SentinelProductionArtifactIdentity {
  const bytes = readFileSync(path);
  return { path: relative(root, path), byteLength: bytes.byteLength, sha256: sentinelProductionSha256(bytes) };
}

function inventory(root: string, current = root): readonly SentinelProductionArtifactIdentity[] {
  if (!existsSync(current)) return [];
  const output: SentinelProductionArtifactIdentity[] = [];
  for (const name of readdirSync(current).sort(compareCodeUnits)) {
    const path = resolve(current, name);
    const stat = lstatSync(path);
    if (stat.isSymbolicLink()) throw new Error("cell evidence contains a symbolic link");
    if (stat.isDirectory()) output.push(...inventory(root, path));
    else if (stat.isFile()) output.push(artifactIdentity(path, root));
    else throw new Error("cell evidence contains a special file");
    if (output.length > MAX_ARTIFACTS_PER_CELL) throw new Error("cell artifact ceiling exceeded");
  }
  return output.sort((left, right) => compareCodeUnits(left.path, right.path));
}

function sealTree(root: string): void {
  if (!existsSync(root)) return;
  for (const name of readdirSync(root)) {
    const path = resolve(root, name);
    const stat = lstatSync(path);
    if (stat.isSymbolicLink()) throw new Error("cannot seal symbolic-link evidence");
    if (stat.isDirectory()) sealTree(path);
    else if (stat.isFile()) chmodSync(path, 0o400);
    else throw new Error("cannot seal special-file evidence");
  }
  chmodSync(root, 0o500);
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

function assertFreshDisjointRoots(
  checkouts: readonly string[],
  batchRoot: string,
  registryRoot: string,
): void {
  if (!isAbsolute(batchRoot) || resolve(batchRoot) !== batchRoot) {
    throw new Error("batchRoot must be a canonical absolute path");
  }
  if (!isAbsolute(registryRoot) || resolve(registryRoot) !== registryRoot) {
    throw new Error("attemptRegistryRoot must be a canonical absolute path");
  }
  if (batchRoot === registryRoot || batchRoot.startsWith(`${registryRoot}/`) || registryRoot.startsWith(`${batchRoot}/`)) {
    throw new Error("batch and attempt registry roots overlap");
  }
  for (const checkout of checkouts) {
    if (
      batchRoot === checkout ||
      registryRoot === checkout ||
      batchRoot.startsWith(`${checkout}/`) ||
      registryRoot.startsWith(`${checkout}/`) ||
      checkout.startsWith(`${batchRoot}/`) ||
      checkout.startsWith(`${registryRoot}/`)
    ) throw new Error("execution roots overlap a benchmark checkout");
  }
  if (existsSync(batchRoot) || existsSync(registryRoot)) {
    throw new Error("batchRoot and attemptRegistryRoot must both be fresh");
  }
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
  input: SentinelProductionRunInput,
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
  maximumArmStartSkewMs(input.preregistration);
  exactCheckoutKeys(input.checkouts);
  const canonicalCheckouts = ARMS.map((arm) => realpathSync(resolve(input.checkouts[arm])));
  if (new Set(canonicalCheckouts).size !== 4) {
    throw new Error("four execution arms require four disjoint checkouts");
  }
  const batchRoot = resolve(input.batchRoot);
  const registryRoot = resolve(input.attemptRegistryRoot);
  assertFreshDisjointRoots(canonicalCheckouts, batchRoot, registryRoot);
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
    preregistrationSha256: verification.preregistrationSha256,
    commitmentSha256,
    blocks: validateBlocks(verification.cells),
    tasks,
    runtime,
    checkouts,
  };
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
}): CellExecutionContext {
  const attemptId = assertOpaqueValue(
    input.dependencies.deriveAttemptId(input.preregistrationSha256, input.cell.cellId),
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
  input: SentinelProductionRunInput,
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
  input: SentinelProductionRunInput,
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
  input: SentinelProductionRunInput,
  dependencies: SentinelProductionRunnerDependencies,
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
      if (Date.parse(input.signature.authority.signedAt) >= Date.parse(context.attemptInvokedAt)) {
        throw new Error("external signature did not precede attempt invocation");
      }
      const receipt = await dependencies.superviseAttempt(supervisorInput(context, input));
      validateSupervisorReceipt(receipt, context);
      context.supervisorReceipt = receipt;
      context.attemptStartedAt = readSentinelProductionAttemptStartedAt(
        context.upstreamRoot,
        receipt.startReceiptHash,
        context.attemptId,
      );
      if (Date.parse(input.signature.authority.signedAt) >= Date.parse(context.attemptStartedAt)) {
        throw new Error("external signature did not precede retained attempt start");
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
  input: SentinelProductionRunInput,
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
  input: SentinelProductionRunInput,
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
  input: SentinelProductionRunInput,
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
    body as unknown as Record<string, unknown>,
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

interface SentinelProductionDiagnosticSelection {
  readonly taskId: string;
  readonly repeatId: string;
}

async function runSentinelProductionBatchInternal(
  input: SentinelProductionRunInput,
  dependencies: SentinelProductionRunnerDependencies,
  diagnosticSelection?: SentinelProductionDiagnosticSelection,
): Promise<SentinelProductionBatchResult> {
  const runStartedAt = canonicalTimestamp(dependencies.now(), "runStartedAt");
  const verified = verifySentinelProductionRunInputs(input, runStartedAt, dependencies);
  const indexedBlocks = verified.blocks.map((block, index) => ({ block, blockSequence: index + 1 }));
  const executionBlocks = diagnosticSelection === undefined
    ? indexedBlocks
    : indexedBlocks.filter(({ block }) =>
        block[0]?.taskId === diagnosticSelection.taskId &&
        block[0]?.repeatId === diagnosticSelection.repeatId);
  if (diagnosticSelection !== undefined) {
    if (
      input.preregistration.registration.selectedPhase !== "qualification" ||
      executionBlocks.length !== 1 ||
      executionBlocks[0]?.block[0]?.taskRole !== "state-retention-relative"
    ) {
      throw new Error("excluded smoke must select exactly one qualification state-retention block");
    }
  }
  const initialRuntimeInspectedAt = canonicalTimestamp(
    dependencies.now(),
    "initial runtime inspectedAt",
  );
  const externalObservation = await dependencies.verifyExternalCommitmentRecord(
    input.externalCommitment,
  );
  const preparedExternalObservation = prepareSentinelProductionExternalObservation(
    input.externalCommitment,
    externalObservation,
    runStartedAt,
    canonicalTimestamp(dependencies.now(), "external commitment locallyValidatedAt"),
  );
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
  writeExclusiveJson(resolve(batchRoot, "inputs", "signature.json"), input.signature);
  writeExclusiveJson(resolve(batchRoot, "inputs", "trust-anchor.json"), input.trustAnchor);
  writeExclusiveJson(
    resolve(batchRoot, "inputs", "external-commitment.json"),
    input.externalCommitment,
  );
  const externalObservationReceipt = retainSentinelProductionExternalObservation(
    batchRoot,
    preparedExternalObservation,
  );
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
  const signatureSha256 = sentinelProductionJsonSha256(input.signature);
  const startBody = {
    schemaVersion: "pm.public-eval-corners.sentinel-production-execution-start.v1",
    evidenceEligible: false,
    materialBenefit: false,
    preregistrationSha256: verified.preregistrationSha256,
    signatureSha256,
    externalCommitmentSha256: verified.commitmentSha256,
    externalCommitmentObservation: {
      path: relative(batchRoot, externalObservationReceipt.path),
      receiptSha256: externalObservationReceipt.sha256,
      bodyPath: preparedExternalObservation.receiptBody.bodyPath,
      bodySha256: preparedExternalObservation.receiptBody.bodySha256,
      observedAt: preparedExternalObservation.receiptBody.observedAt,
    },
    runStartedAt,
    phase: input.preregistration.registration.selectedPhase,
    declaredBlockCount: verified.blocks.length,
    declaredCellCount: verified.blocks.length * 4,
    maximumArmStartSkewMs: maximumArmStartSkewMs(input.preregistration),
    initialRuntimeInspection,
    checkoutPreflights: Object.fromEntries(ARMS.map((arm) => [arm, verified.checkouts[arm]])),
    schedule: verified.blocks.flat(),
    noAutomaticRetries: true,
    noCellReruns: true,
    noTaskReplacements: true,
    noOutcomeInspectionDuringExecution: true,
  };
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
      });
    });
    await Promise.all(contexts.map((context) =>
      prepareCell(context, input, verified.preregistrationSha256, dependencies)));
    const launch = await launchPreparedBlock(contexts, input, dependencies);
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
      blockBody as unknown as Record<string, unknown>,
    );
    previousBlockManifestSha256 = blockManifest.sha256;
    blockReferences.push(blockManifest);
  }

  const batchComplete =
    diagnosticSelection === undefined &&
    allBlocksComplete &&
    blockReferences.length === verified.blocks.length &&
    cellReferences.length === verified.blocks.length * 4;
  const finalBody: SentinelProductionExecutionManifest = {
    schemaVersion: "pm.public-eval-corners.sentinel-production-execution-manifest.v1",
    evidenceEligible: false,
    materialBenefit: false,
    preregistrationSha256: verified.preregistrationSha256,
    signatureSha256,
    externalCommitmentSha256: verified.commitmentSha256,
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
    blocks: blockReferences.map((reference) => ({
      path: relative(batchRoot, reference.path),
      sha256: reference.sha256,
    })),
    finalizedAt: canonicalTimestamp(dependencies.now(), "batch finalizedAt"),
  };
  const executionFinal = writeContentAddressedJson(
    resolve(batchRoot, "manifests"),
    "execution-final",
    finalBody as unknown as Record<string, unknown>,
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
    blocks: blockReferences.map((reference) => ({
      path: relative(batchRoot, reference.path),
      sha256: reference.sha256,
    })),
    cells: cellReferences.sort((left, right) => left.sequence - right.sequence),
  };
}

export async function runSentinelProductionBatch(
  input: SentinelProductionRunInput,
  dependencies: SentinelProductionRunnerDependencies =
    createSentinelProductionRunnerDependencies(),
): Promise<SentinelProductionBatchResult> {
  return runSentinelProductionBatchInternal(input, dependencies);
}

/** Run one four-arm qualification block; the declared full schedule stays incomplete. */
export async function runSentinelProductionExcludedSmoke(
  input: SentinelProductionRunInput,
  selection: SentinelProductionDiagnosticSelection,
  dependencies: SentinelProductionRunnerDependencies =
    createSentinelProductionRunnerDependencies(),
): Promise<SentinelProductionBatchResult> {
  return runSentinelProductionBatchInternal(input, dependencies, selection);
}
