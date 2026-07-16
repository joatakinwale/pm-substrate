import { readdirSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";

import {
  buildSentinelProductionSchedule,
  verifySentinelProductionPreregistration,
  type SentinelExternalTrustAnchor,
  type SentinelProductionArm,
  type SentinelProductionCell,
  type SentinelProductionPreregistration,
  type SentinelProductionSignature,
  type SentinelProductionTask,
} from "./sentinel-production-plan.js";
import type {
  SentinelProductionBlockManifest,
  SentinelProductionCellManifest,
  SentinelProductionCellManifestReference,
  SentinelProductionCheckoutPreflight,
  SentinelProductionExecutionManifest,
} from "./sentinel-production-runner.js";
import type {
  SentinelProductionExternalCommitmentRecord,
  SentinelProductionRuntimeInspectionReference,
} from "./sentinel-production-runner-evidence.js";
import {
  SENTINEL_ECONOMICS_STATE_RESPONSE_DEADLINE_MS,
  auditSentinelProductionEconomics,
  verifySentinelProductionEconomicsReport,
  type SentinelProductionEconomicsInput,
  type SentinelProductionEconomicsReport,
} from "./sentinel-production-economics.js";
import {
  analyzeSentinelRawMeasurements,
  type SentinelRawAnalysisResult,
  type SentinelRawCellMeasurement,
} from "./sentinel-production-raw-analysis.js";
import {
  deriveSentinelRawCellMeasurement,
  verifySentinelRawCellEvidence,
  type SentinelRawCellVerification,
} from "./sentinel-production-raw-cell.js";
import {
  verifySentinelRawRuntimeBoundary,
  type SentinelRawRuntimeBoundary,
} from "./sentinel-production-raw-runtime.js";
import {
  SENTINEL_RAW_SHA256,
  sentinelRawCanonical,
  sentinelRawCanonicalTimestamp,
  sentinelRawContainedPath,
  sentinelRawExactKeys,
  sentinelRawInventory,
  sentinelRawIsRecord,
  sentinelRawJsonFile,
  sentinelRawJsonSha256,
  sentinelRawRegularFile,
  sentinelRawSha256,
} from "./sentinel-production-raw-utils.js";

const ARMS = ["native", "sham", "plain-kv", "substrate"] as const;
const GENESIS = "0".repeat(64);
const MAXIMUM_ARM_START_SKEW_MS = 1_000;

interface ContentAddressedValue {
  readonly path: string;
  readonly sha256: string;
  readonly value: Record<string, unknown>;
}

interface ExternalObservationEvidence {
  readonly observedAt: string;
  readonly locallyValidatedAt: string;
  readonly receiptPath: string;
  readonly bodyPath: string;
}

interface ParsedExecutionStart {
  readonly value: Record<string, unknown>;
  readonly runStartedAt: string;
  readonly preregistrationSha256: string;
  readonly initialRuntimeInspection: SentinelProductionRuntimeInspectionReference;
  readonly checkoutPreflights: Readonly<Record<SentinelProductionArm, SentinelProductionCheckoutPreflight>>;
}

export interface VerifySentinelProductionRawBatchInput {
  readonly batchRoot: string;
  /** This value must arrive out of band. The retained local copy is never trusted by itself. */
  readonly trustAnchor: SentinelExternalTrustAnchor;
}

export interface SentinelRawBatchVerification {
  readonly schemaVersion: "pm.public-eval-corners.sentinel-production-raw-batch-verification.v1";
  readonly valid: boolean;
  readonly rawComplete: boolean;
  readonly evidenceEligible: boolean;
  readonly attemptTimeRawRootExternallyAnchored: false;
  readonly analysisEligible: boolean;
  readonly materialBenefit: boolean;
  readonly preregistrationSha256: string | null;
  readonly phase: SentinelProductionPreregistration["registration"]["selectedPhase"] | null;
  readonly declaredBlockCount: number;
  readonly verifiedBlockCount: number;
  readonly declaredCellCount: number;
  readonly verifiedCellCount: number;
  readonly cells: readonly SentinelRawCellVerification[];
  readonly measurements: readonly SentinelRawCellMeasurement[];
  readonly analysis: SentinelRawAnalysisResult | null;
  readonly economics: SentinelProductionEconomicsReport | null;
  readonly issues: readonly string[];
}

function issueOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function assertSha256(value: unknown, label: string): string {
  if (typeof value !== "string" || !SENTINEL_RAW_SHA256.test(value)) {
    throw new Error(`${label} is not a SHA-256 digest`);
  }
  return value;
}

function assertNonnegativeInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0) throw new Error(`${label} is not a nonnegative integer`);
  return Number(value);
}

function manifestEntries(batchRoot: string): readonly string[] {
  const root = resolve(batchRoot, "manifests");
  const entries = readdirSync(root, { withFileTypes: true });
  const directories = entries.filter(({ isDirectory }) => isDirectory()).map(({ name }) => name).sort();
  const files = entries.filter(({ isFile }) => isFile()).map(({ name }) => name).sort();
  if (sentinelRawCanonical(directories) !== sentinelRawCanonical(["blocks", "cells", "runtime"])) {
    throw new Error("manifest root has missing, extra, or non-directory namespaces");
  }
  if (entries.some((entry) => !entry.isDirectory() && !entry.isFile())) {
    throw new Error("manifest root contains a symbolic link or special entry");
  }
  return files;
}

function discoverContentAddressedManifest(
  batchRoot: string,
  prefix: "execution-start" | "execution-final",
): ContentAddressedValue {
  const matches = manifestEntries(batchRoot).filter((name) =>
    new RegExp(`^${prefix}-[a-f0-9]{64}\\.json$`, "u").test(name));
  if (matches.length !== 1) throw new Error(`batch lacks exactly one ${prefix} manifest`);
  const path = `manifests/${matches[0]}`;
  const sha256 = matches[0]!.slice(prefix.length + 1, -5);
  return readContentAddressedManifest(batchRoot, path, sha256, prefix);
}

function readContentAddressedManifest(
  batchRoot: string,
  relativePath: unknown,
  expectedSha256: unknown,
  label: string,
): ContentAddressedValue {
  const sha256 = assertSha256(expectedSha256, `${label} expected hash`);
  const path = sentinelRawContainedPath(batchRoot, relativePath, `${label} path`);
  if (!path.endsWith(`-${sha256}.json`)) throw new Error(`${label} filename does not carry its declared hash`);
  const value = sentinelRawJsonFile(path, label);
  if (!sentinelRawIsRecord(value)) throw new Error(`${label} is not an object`);
  const { manifestSha256, ...body } = value;
  if (manifestSha256 !== sha256 || sentinelRawJsonSha256(body) !== sha256) {
    throw new Error(`${label} content address differs from its canonical body`);
  }
  return { path: String(relativePath), sha256, value };
}

function exactTrustAnchor(value: unknown, label: string): SentinelExternalTrustAnchor {
  sentinelRawExactKeys(value, [
    "expectedAuthorityId", "expectedAuthorityPublicKeySha256", "expectedPreregistrationSha256",
  ], label);
  if (
    typeof value.expectedAuthorityId !== "string" || value.expectedAuthorityId.length === 0 ||
    !SENTINEL_RAW_SHA256.test(String(value.expectedAuthorityPublicKeySha256)) ||
    !SENTINEL_RAW_SHA256.test(String(value.expectedPreregistrationSha256))
  ) throw new Error(`${label} is invalid`);
  return value as unknown as SentinelExternalTrustAnchor;
}

function selectedTasks(plan: SentinelProductionPreregistration): readonly SentinelProductionTask[] {
  switch (plan.registration.selectedPhase) {
    case "qualification": return plan.benchmark.universes.qualification.tasks;
    case "procedural-holdout": return plan.benchmark.universes.proceduralHoldout.tasks;
    case "powered-confirmatory": return plan.benchmark.universes.poweredConfirmatory.tasks;
  }
}

function runtimeReference(value: unknown, label: string): SentinelProductionRuntimeInspectionReference {
  sentinelRawExactKeys(value, [
    "artifactPath", "artifactSha256", "closureSha256", "derivationSha256", "executableIdentitySha256",
    "executionLeaseIdentitySha256", "inspectedAt", "inspectionReceiptPath", "inspectionReceiptSha256", "valid",
  ], label);
  assertSha256(value.closureSha256, `${label} closure hash`);
  assertSha256(value.executableIdentitySha256, `${label} executable identity`);
  assertSha256(value.inspectionReceiptSha256, `${label} receipt hash`);
  assertSha256(value.derivationSha256, `${label} derivation hash`);
  assertSha256(value.artifactSha256, `${label} artifact hash`);
  assertSha256(value.executionLeaseIdentitySha256, `${label} lease identity`);
  if (
    typeof value.inspectionReceiptPath !== "string" ||
    !/^manifests\/runtime\/(?:runtime-initial|runtime-block-[0-9]{6}-(?:before|after))-[a-f0-9]{64}\.json$/u.test(value.inspectionReceiptPath) ||
    typeof value.artifactPath !== "string" ||
    !/^manifests\/runtime\/runtime-artifacts-[a-f0-9]{64}\.json$/u.test(value.artifactPath) ||
    value.valid !== true
  ) throw new Error(`${label} retained paths or validity are invalid`);
  sentinelRawCanonicalTimestamp(value.inspectedAt, `${label} inspectedAt`);
  return value as unknown as SentinelProductionRuntimeInspectionReference;
}

function preflight(value: unknown, plan: SentinelProductionPreregistration, label: string): SentinelProductionCheckoutPreflight {
  sentinelRawExactKeys(value, [
    "checkoutPath", "cleanTrackedAndUntracked", "databaseRootSha256", "frontendInstalledTreeSha256",
    "frontendPackageLockSha256", "ignoredArtifactRootSha256", "issues", "preflightSha256", "repositoryUrl",
    "revision", "schemaVersion", "selectedScenarioRootSha256", "serverRequirementsSha256", "sourceTreeHash", "valid",
  ], label);
  const { preflightSha256, ...body } = value;
  if (
    value.schemaVersion !== "pm.public-eval-corners.sentinel-production-checkout-preflight.v1" ||
    preflightSha256 !== sentinelRawJsonSha256(body) || value.valid !== true || !Array.isArray(value.issues) || value.issues.length !== 0 ||
    typeof value.checkoutPath !== "string" || !isAbsolute(value.checkoutPath) || resolve(value.checkoutPath) !== value.checkoutPath ||
    typeof value.repositoryUrl !== "string" || value.repositoryUrl.replace(/\.git$/u, "") !== plan.benchmark.repositoryUrl ||
    value.revision !== plan.benchmark.revision || value.sourceTreeHash !== plan.benchmark.sourceTreeHash ||
    value.cleanTrackedAndUntracked !== true ||
    value.frontendInstalledTreeSha256 !== plan.runtime.upstream.frontendInstalledTreeSha256 ||
    value.frontendPackageLockSha256 !== plan.runtime.upstream.frontendPackageLockSha256 ||
    value.serverRequirementsSha256 !== plan.runtime.upstream.serverRequirementsSha256
  ) throw new Error(`${label} is not the exact valid pinned checkout preflight`);
  for (const key of [
    "databaseRootSha256", "frontendInstalledTreeSha256", "frontendPackageLockSha256", "ignoredArtifactRootSha256",
    "preflightSha256", "selectedScenarioRootSha256", "serverRequirementsSha256",
  ] as const) assertSha256(value[key], `${label} ${key}`);
  return value as unknown as SentinelProductionCheckoutPreflight;
}

function parseExecutionStart(
  record: ContentAddressedValue,
  plan: SentinelProductionPreregistration,
  signature: SentinelProductionSignature,
  commitment: SentinelProductionExternalCommitmentRecord,
  preregistrationSha256: string,
  expectedSchedule: readonly SentinelProductionCell[],
): ParsedExecutionStart {
  const value = record.value;
  sentinelRawExactKeys(value, [
    "checkoutPreflights", "declaredBlockCount", "declaredCellCount", "evidenceEligible", "externalCommitmentObservation",
    "externalCommitmentSha256", "initialRuntimeInspection", "manifestSha256", "materialBenefit", "maximumArmStartSkewMs",
    "noAutomaticRetries", "noCellReruns", "noOutcomeInspectionDuringExecution", "noTaskReplacements", "phase",
    "preregistrationSha256", "runStartedAt", "schedule", "schemaVersion", "signatureSha256",
  ], "execution start manifest");
  const runStartedAt = sentinelRawCanonicalTimestamp(value.runStartedAt, "execution runStartedAt");
  const expectedBlocks = expectedSchedule.length / 4;
  if (
    value.schemaVersion !== "pm.public-eval-corners.sentinel-production-execution-start.v1" ||
    value.evidenceEligible !== false || value.materialBenefit !== false ||
    value.preregistrationSha256 !== preregistrationSha256 || value.signatureSha256 !== sentinelRawJsonSha256(signature) ||
    value.externalCommitmentSha256 !== commitment.receiptSha256 || value.phase !== plan.registration.selectedPhase ||
    value.declaredBlockCount !== expectedBlocks || value.declaredCellCount !== expectedSchedule.length ||
    value.maximumArmStartSkewMs !== MAXIMUM_ARM_START_SKEW_MS || value.noAutomaticRetries !== true ||
    value.noCellReruns !== true || value.noTaskReplacements !== true || value.noOutcomeInspectionDuringExecution !== true ||
    !Array.isArray(value.schedule) || sentinelRawCanonical(value.schedule) !== sentinelRawCanonical(expectedSchedule)
  ) throw new Error("execution start manifest differs from the signed, outcome-blind schedule");
  if (Date.parse(signature.authority.signedAt) >= Date.parse(runStartedAt)) {
    throw new Error("signed preregistration does not strictly precede execution start");
  }
  const retainedPreflights = value.checkoutPreflights;
  sentinelRawExactKeys(retainedPreflights, ARMS, "execution checkout preflights");
  const checkoutPreflights = Object.fromEntries(ARMS.map((arm) => [
    arm, preflight(retainedPreflights[arm], plan, `${arm} checkout preflight`),
  ])) as unknown as Record<SentinelProductionArm, SentinelProductionCheckoutPreflight>;
  if (new Set(ARMS.map((arm) => checkoutPreflights[arm].checkoutPath)).size !== 4) {
    throw new Error("four execution arms did not use four disjoint checkout paths");
  }
  const rootFields = [
    "revision", "sourceTreeHash", "ignoredArtifactRootSha256", "databaseRootSha256", "selectedScenarioRootSha256",
    "frontendInstalledTreeSha256", "frontendPackageLockSha256", "serverRequirementsSha256",
  ] as const;
  for (const arm of ARMS.slice(1)) {
    for (const field of rootFields) {
      if (checkoutPreflights[arm][field] !== checkoutPreflights.native[field]) {
        throw new Error(`four-arm checkout ${field} roots differ`);
      }
    }
  }
  return {
    value,
    runStartedAt,
    preregistrationSha256,
    initialRuntimeInspection: runtimeReference(value.initialRuntimeInspection, "initial runtime reference"),
    checkoutPreflights,
  };
}

function verifyExternalCommitment(
  batchRoot: string,
  start: ParsedExecutionStart,
  plan: SentinelProductionPreregistration,
  signature: SentinelProductionSignature,
  trustAnchor: SentinelExternalTrustAnchor,
  commitmentValue: unknown,
  expectedPaths: Set<string>,
): ExternalObservationEvidence {
  sentinelRawExactKeys(commitmentValue, [
    "commitmentId", "committedAt", "custodianId", "custodianOwnerId", "expectedAuthorityId",
    "expectedAuthorityPublicKeySha256", "expectedPreregistrationSha256", "independent", "locator", "medium",
    "receiptSha256", "schemaVersion",
  ], "external commitment");
  const commitment = commitmentValue as unknown as SentinelProductionExternalCommitmentRecord;
  const { receiptSha256, ...commitmentBody } = commitment;
  const committedAt = sentinelRawCanonicalTimestamp(commitment.committedAt, "external commitment committedAt");
  const locator = new URL(commitment.locator);
  const opaqueIdentity = /^[A-Za-z0-9._:-]{1,128}$/u;
  if (
    commitment.schemaVersion !== "pm.public-eval-corners.sentinel-production-external-commitment.v1" ||
    commitment.medium !== "independent-append-only-external-record" || commitment.independent !== true ||
    !opaqueIdentity.test(commitment.commitmentId) || !opaqueIdentity.test(commitment.custodianId) ||
    !opaqueIdentity.test(commitment.custodianOwnerId) ||
    receiptSha256 !== sentinelRawJsonSha256(commitmentBody) ||
    commitment.expectedPreregistrationSha256 !== trustAnchor.expectedPreregistrationSha256 ||
    commitment.expectedAuthorityId !== trustAnchor.expectedAuthorityId ||
    commitment.expectedAuthorityPublicKeySha256 !== trustAnchor.expectedAuthorityPublicKeySha256 ||
    commitment.custodianOwnerId === plan.registration.producerId || commitment.custodianOwnerId === signature.authority.ownerId ||
    locator.protocol !== "https:" || locator.username !== "" || locator.password !== "" || locator.hash !== "" ||
    Date.parse(committedAt) < Date.parse(signature.authority.signedAt) || Date.parse(committedAt) >= Date.parse(start.runStartedAt)
  ) throw new Error("external commitment is not independent, content-addressed, or strictly pre-execution");

  sentinelRawExactKeys(start.value.externalCommitmentObservation, [
    "bodyPath", "bodySha256", "observedAt", "path", "receiptSha256",
  ], "execution external observation reference");
  const reference = start.value.externalCommitmentObservation;
  const observationReceiptSha256 = assertSha256(reference.receiptSha256, "external observation receipt hash");
  const receiptPath = String(reference.path);
  if (receiptPath !== `inputs/external-commitment-observation-${observationReceiptSha256}.json`) {
    throw new Error("external observation receipt path is not content addressed");
  }
  const receipt = sentinelRawJsonFile(
    sentinelRawContainedPath(batchRoot, receiptPath, "external observation receipt path"),
    "external observation receipt",
  );
  sentinelRawExactKeys(receipt, [
    "bodyByteLength", "bodyPath", "bodySha256", "commitmentReceiptSha256", "contentType", "evidenceEligible",
    "httpStatus", "issues", "locallyValidatedAt", "locator", "materialBenefit", "observedAt", "receiptSha256",
    "redirected", "responseUrl", "schemaVersion", "valid",
  ], "external observation receipt");
  const { receiptSha256: storedReceiptSha256, ...receiptBody } = receipt;
  const observedAt = sentinelRawCanonicalTimestamp(receipt.observedAt, "external observation observedAt");
  const locallyValidatedAt = sentinelRawCanonicalTimestamp(receipt.locallyValidatedAt, "external observation locallyValidatedAt");
  if (
    receipt.schemaVersion !== "pm.public-eval-corners.sentinel-production-external-commitment-observation.v1" ||
    receipt.evidenceEligible !== false || receipt.materialBenefit !== false || receipt.valid !== true ||
    !Array.isArray(receipt.issues) || receipt.issues.length !== 0 || storedReceiptSha256 !== observationReceiptSha256 ||
    storedReceiptSha256 !== sentinelRawJsonSha256(receiptBody) || receipt.locator !== commitment.locator ||
    receipt.responseUrl !== commitment.locator || receipt.redirected !== false || receipt.httpStatus !== 200 ||
    typeof receipt.contentType !== "string" || receipt.contentType.split(";", 1)[0]?.trim().toLowerCase() !== "application/json" ||
    receipt.commitmentReceiptSha256 !== commitment.receiptSha256 || reference.observedAt !== observedAt ||
    Date.parse(observedAt) < Date.parse(start.runStartedAt) || Date.parse(observedAt) > Date.parse(locallyValidatedAt)
  ) throw new Error("external observation receipt does not prove exact independent retrieval after run start");
  const bodyPath = String(receipt.bodyPath);
  if (bodyPath !== "inputs/external-commitment-observation.body.json" || reference.bodyPath !== bodyPath) {
    throw new Error("external observation body path changed");
  }
  const bytes = sentinelRawRegularFile(sentinelRawContainedPath(batchRoot, bodyPath, "external observation body path"), "external observation body");
  if (
    receipt.bodyByteLength !== bytes.byteLength || receipt.bodySha256 !== sentinelRawSha256(bytes) ||
    reference.bodySha256 !== receipt.bodySha256
  ) throw new Error("external observation bytes differ from their receipt");
  let parsed: unknown;
  try { parsed = JSON.parse(bytes.toString("utf8")) as unknown; }
  catch { throw new Error("external observation body is not JSON"); }
  if (sentinelRawCanonical(parsed) !== sentinelRawCanonical(commitment)) {
    throw new Error("external observation bytes differ from the exact committed receipt");
  }
  expectedPaths.add(receiptPath);
  expectedPaths.add(bodyPath);
  return { observedAt, locallyValidatedAt, receiptPath, bodyPath };
}

function artifactIdentity(value: unknown, label: string): void {
  sentinelRawExactKeys(value, ["byteLength", "path", "sha256"], label);
  if (
    typeof value.path !== "string" || value.path.length === 0 || isAbsolute(value.path) || value.path.split("/").includes("..") ||
    !Number.isSafeInteger(value.byteLength) || Number(value.byteLength) < 0 ||
    typeof value.sha256 !== "string" || !SENTINEL_RAW_SHA256.test(value.sha256)
  ) throw new Error(`${label} is invalid`);
}

function parseCellManifest(
  value: Record<string, unknown>,
  expected: SentinelProductionCell,
  expectedBlockSequence: number,
  preregistrationSha256: string,
  checkoutPreflightSha256: string,
): SentinelProductionCellManifest {
  sentinelRawExactKeys(value, [
    "agentConfigPath", "agentConfigSha256", "arm", "artifactRootSha256", "artifacts", "attemptId", "attemptInvokedAt",
    "attemptStartedAt", "blockSequence", "cellId", "cellRoot", "checkoutPreflightSha256", "evidenceEligible",
    "infrastructureComplete", "manifestSha256", "materialBenefit", "phase", "ports", "providerFinalReceiptSha256",
    "repeatId", "replacementCount", "rerunCount", "retryCount", "runnerFailureCount", "schemaVersion", "sequence",
    "serviceBinding", "stateFinalReceiptSha256", "supervisor", "taskId", "taskRole",
  ], `cell manifest ${expected.sequence}`);
  const expectedAttemptId = `spa-${sentinelRawSha256(
    `pm.sentinel.production.attempt.v1\0${preregistrationSha256}\0${expected.cellId}`,
  ).slice(0, 48)}`;
  const invokedAt = sentinelRawCanonicalTimestamp(value.attemptInvokedAt, `cell ${expected.cellId} invokedAt`);
  const startedAt = sentinelRawCanonicalTimestamp(value.attemptStartedAt, `cell ${expected.cellId} startedAt`);
  if (
    value.schemaVersion !== "pm.public-eval-corners.sentinel-production-cell-manifest.v1" ||
    value.evidenceEligible !== false || value.materialBenefit !== false || value.sequence !== expected.sequence ||
    value.blockSequence !== expectedBlockSequence || value.cellId !== expected.cellId || value.phase !== expected.phase ||
    value.taskId !== expected.taskId || value.taskRole !== expected.taskRole || value.arm !== expected.arm ||
    value.repeatId !== expected.repeatId || value.attemptId !== expectedAttemptId ||
    value.cellRoot !== `cells/${expectedAttemptId}` || value.checkoutPreflightSha256 !== checkoutPreflightSha256 ||
    value.retryCount !== 0 || value.rerunCount !== 0 || value.replacementCount !== 0 || value.runnerFailureCount !== 0 ||
    value.infrastructureComplete !== true || Date.parse(startedAt) < Date.parse(invokedAt)
  ) throw new Error(`cell ${expected.cellId} manifest differs from its exact signed schedule identity`);
  sentinelRawExactKeys(value.ports, ["frontend", "provider", "server", "state"], `cell ${expected.cellId} ports`);
  const ports = Object.values(value.ports);
  if (ports.length !== 4 || new Set(ports).size !== 4 || ports.some((port) =>
    !Number.isSafeInteger(port) || Number(port) < 1_024 || Number(port) > 65_535)) {
    throw new Error(`cell ${expected.cellId} ports are invalid or duplicated`);
  }
  sentinelRawExactKeys(value.supervisor, [
    "completion", "infrastructureIssueSha256", "infrastructureStage", "receiptHash", "returned",
  ], `cell ${expected.cellId} supervisor result`);
  if (
    value.supervisor.returned !== true || value.supervisor.completion !== "behavioral-complete" ||
    value.supervisor.infrastructureIssueSha256 !== null || value.supervisor.infrastructureStage !== null
  ) throw new Error(`cell ${expected.cellId} supervisor did not retain a complete behavioral attempt`);
  assertSha256(value.supervisor.receiptHash, `cell ${expected.cellId} supervisor receipt`);
  assertSha256(value.agentConfigSha256, `cell ${expected.cellId} agent config hash`);
  assertSha256(value.providerFinalReceiptSha256, `cell ${expected.cellId} provider final receipt`);
  assertSha256(value.stateFinalReceiptSha256, `cell ${expected.cellId} state final receipt`);
  assertSha256(value.artifactRootSha256, `cell ${expected.cellId} artifact root`);
  sentinelRawExactKeys(value.serviceBinding, ["continuity", "provider", "state"], `cell ${expected.cellId} service binding`);
  sentinelRawExactKeys(value.serviceBinding.state, [
    "evidenceBindingSha256", "firstStateFresh", "identitySha256", "initialBackendHeadSha256", "initialBackendRecordCount",
    "initialRelevantStateSha256", "mode", "origin", "readyReceiptPath", "readyReceiptSha256", "responseDeadlineMs", "tokenSha256",
  ], `cell ${expected.cellId} state binding`);
  sentinelRawExactKeys(value.serviceBinding.provider, [
    "origin", "readyReceiptPath", "readyReceiptSha256", "tokenSha256",
  ], `cell ${expected.cellId} provider binding`);
  sentinelRawExactKeys(value.serviceBinding.continuity, [
    "agentId", "replayExportPath", "replayExportSha256", "scope", "tenant", "tenantReceiptSha256",
  ], `cell ${expected.cellId} continuity binding`);
  if (
    value.serviceBinding.state.mode !== expected.arm || value.serviceBinding.state.firstStateFresh !== true ||
    value.serviceBinding.state.responseDeadlineMs !== SENTINEL_ECONOMICS_STATE_RESPONSE_DEADLINE_MS
  ) {
    throw new Error(`cell ${expected.cellId} state service does not prove an arm-bound fresh first read`);
  }
  if (!Array.isArray(value.artifacts)) throw new Error(`cell ${expected.cellId} artifact inventory is not an array`);
  value.artifacts.forEach((entry, index) => artifactIdentity(entry, `cell ${expected.cellId} artifact ${index + 1}`));
  if (sentinelRawJsonSha256(value.artifacts) !== value.artifactRootSha256) {
    throw new Error(`cell ${expected.cellId} artifact inventory root is invalid`);
  }
  return value as unknown as SentinelProductionCellManifest;
}

function cellReference(value: unknown, expected: SentinelProductionCell, label: string): SentinelProductionCellManifestReference {
  sentinelRawExactKeys(value, [
    "arm", "attemptId", "cellId", "infrastructureComplete", "path", "sequence", "sha256",
  ], label);
  if (
    value.sequence !== expected.sequence || value.cellId !== expected.cellId || value.arm !== expected.arm ||
    typeof value.attemptId !== "string" || value.infrastructureComplete !== true ||
    typeof value.path !== "string" || !new RegExp(`^manifests/cells/cell-${String(expected.sequence).padStart(6, "0")}-[a-f0-9]{64}\\.json$`, "u").test(value.path)
  ) throw new Error(`${label} differs from the signed cell`);
  assertSha256(value.sha256, `${label} hash`);
  return value as unknown as SentinelProductionCellManifestReference;
}

function parseBlockManifest(
  value: Record<string, unknown>,
  blockSequence: number,
  expectedBlock: readonly SentinelProductionCell[],
  previousBlockManifestSha256: string,
  maximumAllowedStartSkewMs: number,
): SentinelProductionBlockManifest {
  sentinelRawExactKeys(value, [
    "blockSequence", "checkoutRootsStable", "completeArmSet", "completedAt", "evidenceEligible", "expectedArms",
    "infrastructureComplete", "manifestSha256", "materialBenefit", "maximumAllowedStartSkewMs", "maximumObservedStartSkewMs",
    "modeToCell", "previousBlockManifestSha256", "repeatId", "runtimeAfter", "runtimeBefore", "runtimeStable",
    "schemaVersion", "simultaneousLaunch", "taskId",
  ], `block ${blockSequence} manifest`);
  if (
    value.schemaVersion !== "pm.public-eval-corners.sentinel-production-block-manifest.v1" ||
    value.evidenceEligible !== false || value.materialBenefit !== false || value.blockSequence !== blockSequence ||
    value.taskId !== expectedBlock[0]?.taskId || value.repeatId !== expectedBlock[0]?.repeatId ||
    value.previousBlockManifestSha256 !== previousBlockManifestSha256 ||
    sentinelRawCanonical(value.expectedArms) !== sentinelRawCanonical(ARMS) || value.completeArmSet !== true ||
    value.simultaneousLaunch !== true || value.maximumAllowedStartSkewMs !== maximumAllowedStartSkewMs ||
    !Number.isSafeInteger(value.maximumObservedStartSkewMs) || Number(value.maximumObservedStartSkewMs) < 0 ||
    Number(value.maximumObservedStartSkewMs) > maximumAllowedStartSkewMs || value.runtimeStable !== true ||
    value.checkoutRootsStable !== true || value.infrastructureComplete !== true
  ) throw new Error(`block ${blockSequence} is incomplete, unstable, or not a simultaneous four-arm block`);
  sentinelRawCanonicalTimestamp(value.completedAt, `block ${blockSequence} completedAt`);
  sentinelRawExactKeys(value.modeToCell, ARMS, `block ${blockSequence} arm map`);
  runtimeReference(value.runtimeBefore, `block ${blockSequence} runtime-before reference`);
  runtimeReference(value.runtimeAfter, `block ${blockSequence} runtime-after reference`);
  // The runtime receipt chain is enforced by verifySentinelRawRuntimeBoundary
  // (expectedPreviousReceiptSha256) at the call site, not here.
  return value as unknown as SentinelProductionBlockManifest;
}

function parseExecutionFinal(
  value: Record<string, unknown>,
  start: ParsedExecutionStart,
  signature: SentinelProductionSignature,
  commitment: SentinelProductionExternalCommitmentRecord,
): SentinelProductionExecutionManifest {
  sentinelRawExactKeys(value, [
    "batchComplete", "blockManifestHeadSha256", "blocks", "declaredBlockCount", "declaredCellCount", "evidenceEligible",
    "externalCommitmentSha256", "finalizedAt", "manifestSha256", "materialBenefit", "noOutcomeInspectionDuringExecution",
    "preregistrationSha256", "replacementCount", "rerunCount", "retainedBlockCount", "retainedCellCount", "retryCount",
    "runStartedAt", "runtimeInspectionHeadSha256", "schemaVersion", "signatureSha256",
  ], "execution final manifest");
  if (
    value.schemaVersion !== "pm.public-eval-corners.sentinel-production-execution-manifest.v1" ||
    value.evidenceEligible !== false || value.materialBenefit !== false || value.batchComplete !== true ||
    value.preregistrationSha256 !== start.preregistrationSha256 || value.signatureSha256 !== sentinelRawJsonSha256(signature) ||
    value.externalCommitmentSha256 !== commitment.receiptSha256 || value.runStartedAt !== start.runStartedAt ||
    value.declaredBlockCount !== start.value.declaredBlockCount || value.retainedBlockCount !== value.declaredBlockCount ||
    value.declaredCellCount !== start.value.declaredCellCount || value.retainedCellCount !== value.declaredCellCount ||
    value.retryCount !== 0 || value.rerunCount !== 0 || value.replacementCount !== 0 ||
    value.noOutcomeInspectionDuringExecution !== true || !Array.isArray(value.blocks) || value.blocks.length !== value.declaredBlockCount
  ) throw new Error("execution final manifest does not prove a complete no-retry/no-replacement batch");
  assertSha256(value.blockManifestHeadSha256, "execution final block head");
  assertSha256(value.runtimeInspectionHeadSha256, "execution final runtime head");
  sentinelRawCanonicalTimestamp(value.finalizedAt, "execution finalizedAt");
  return value as unknown as SentinelProductionExecutionManifest;
}

function addRuntimePaths(expectedPaths: Set<string>, reference: SentinelProductionRuntimeInspectionReference): void {
  expectedPaths.add(reference.inspectionReceiptPath);
  if (reference.artifactPath === null) throw new Error("valid runtime inspection lacks retained artifact path");
  expectedPaths.add(reference.artifactPath);
}

function ensureGloballyUnique(values: readonly string[], label: string): void {
  if (new Set(values).size !== values.length) throw new Error(`${label} are reused across the batch`);
}

function verifyBatchInventory(batchRoot: string, expectedPaths: ReadonlySet<string>): void {
  const actual = sentinelRawInventory(batchRoot).map(({ path }) => path);
  const expected = [...expectedPaths].sort();
  if (sentinelRawCanonical(actual) !== sentinelRawCanonical(expected)) {
    const actualSet = new Set(actual);
    const extras = actual.filter((path) => !expectedPaths.has(path));
    const missing = expected.filter((path) => !actualSet.has(path));
    throw new Error(
      `batch inventory has orphan/extra or missing evidence (extras: ${extras.slice(0, 8).join(", ") || "none"}; missing: ${missing.slice(0, 8).join(", ") || "none"})`,
    );
  }
}

function emptyResult(issues: readonly string[]): SentinelRawBatchVerification {
  return {
    schemaVersion: "pm.public-eval-corners.sentinel-production-raw-batch-verification.v1",
    valid: false,
    rawComplete: false,
    evidenceEligible: false,
    attemptTimeRawRootExternallyAnchored: false,
    analysisEligible: false,
    materialBenefit: false,
    preregistrationSha256: null,
    phase: null,
    declaredBlockCount: 0,
    verifiedBlockCount: 0,
    declaredCellCount: 0,
    verifiedCellCount: 0,
    cells: [],
    measurements: [],
    analysis: null,
    economics: null,
    issues,
  };
}

/**
 * Independently reconstruct a production batch from retained bytes. Caller-provided
 * cell outcomes, summaries, and materiality flags are intentionally not accepted.
 */
export function verifySentinelProductionRawBatch(
  input: VerifySentinelProductionRawBatchInput,
): SentinelRawBatchVerification {
  const issues: string[] = [];
  const cellVerifications: SentinelRawCellVerification[] = [];
  const measurements: SentinelRawCellMeasurement[] = [];
  let preregistrationSha256: string | null = null;
  let phase: SentinelRawBatchVerification["phase"] = null;
  let declaredBlockCount = 0;
  let declaredCellCount = 0;
  let verifiedBlockCount = 0;
  let economics: SentinelProductionEconomicsReport | null = null;
  try {
    const batchRoot = resolve(input.batchRoot);
    const expectedPaths = new Set<string>([
      "inputs/preregistration.json",
      "inputs/signature.json",
      "inputs/trust-anchor.json",
      "inputs/external-commitment.json",
    ]);
    const preregistrationValue = sentinelRawJsonFile(resolve(batchRoot, "inputs", "preregistration.json"), "retained preregistration");
    const signatureValue = sentinelRawJsonFile(resolve(batchRoot, "inputs", "signature.json"), "retained signature");
    const localTrustAnchor = exactTrustAnchor(
      sentinelRawJsonFile(resolve(batchRoot, "inputs", "trust-anchor.json"), "retained trust anchor"),
      "retained trust anchor",
    );
    const outOfBandTrustAnchor = exactTrustAnchor(input.trustAnchor, "out-of-band trust anchor");
    if (sentinelRawCanonical(localTrustAnchor) !== sentinelRawCanonical(outOfBandTrustAnchor)) {
      throw new Error("retained trust anchor differs from the caller-supplied out-of-band trust anchor");
    }
    const planVerification = verifySentinelProductionPreregistration(
      preregistrationValue,
      signatureValue,
      outOfBandTrustAnchor,
    );
    if (!planVerification.valid || !planVerification.signatureValid || !planVerification.externallyAnchored) {
      throw new Error(`signed preregistration verification failed: ${planVerification.issues.join("; ")}`);
    }
    const plan = preregistrationValue as SentinelProductionPreregistration;
    const signature = signatureValue as SentinelProductionSignature;
    preregistrationSha256 = planVerification.preregistrationSha256;
    phase = plan.registration.selectedPhase;
    const expectedSchedule = buildSentinelProductionSchedule(plan);
    if (sentinelRawCanonical(expectedSchedule) !== sentinelRawCanonical(planVerification.cells)) {
      throw new Error("independently reconstructed schedule differs from preregistration verification");
    }
    if (expectedSchedule.length === 0 || expectedSchedule.length % 4 !== 0) {
      throw new Error("signed schedule is not a nonempty sequence of four-arm blocks");
    }

    const commitmentValue = sentinelRawJsonFile(resolve(batchRoot, "inputs", "external-commitment.json"), "external commitment");
    const commitment = commitmentValue as SentinelProductionExternalCommitmentRecord;
    const startRecord = discoverContentAddressedManifest(batchRoot, "execution-start");
    const start = parseExecutionStart(
      startRecord,
      plan,
      signature,
      commitment,
      preregistrationSha256,
      expectedSchedule,
    );
    expectedPaths.add(startRecord.path);
    const observation = verifyExternalCommitment(
      batchRoot,
      start,
      plan,
      signature,
      outOfBandTrustAnchor,
      commitmentValue,
      expectedPaths,
    );
    const initialRuntime = verifySentinelRawRuntimeBoundary({
      batchRoot,
      reference: start.initialRuntimeInspection,
      expectedBoundary: "initial",
      expectedBlockSequence: null,
      expectedPreviousReceiptSha256: GENESIS,
      preregistrationClosure: plan.runtime,
    });
    if (
      !initialRuntime.valid || initialRuntime.receiptSha256 === null || initialRuntime.inspectedAt === null ||
      initialRuntime.derivationSha256 === null || initialRuntime.executableIdentitySha256 === null ||
      initialRuntime.exactSupervisorPaths === null
    ) {
      throw new Error(`initial runtime inspection failed: ${initialRuntime.issues.join("; ")}`);
    }
    if (Date.parse(initialRuntime.inspectedAt) < Date.parse(start.runStartedAt)) {
      throw new Error("initial runtime reconstruction predates the local run start");
    }
    addRuntimePaths(expectedPaths, start.initialRuntimeInspection);

    const finalRecord = discoverContentAddressedManifest(batchRoot, "execution-final");
    const final = parseExecutionFinal(finalRecord.value, start, signature, commitment);
    expectedPaths.add(finalRecord.path);
    declaredBlockCount = final.declaredBlockCount;
    declaredCellCount = final.declaredCellCount;
    if (declaredBlockCount !== expectedSchedule.length / 4 || declaredCellCount !== expectedSchedule.length) {
      throw new Error("execution declared counts differ from the independently reconstructed schedule");
    }
    const tasks = new Map(selectedTasks(plan).map((task) => [task.taskId, task] as const));
    let previousBlockManifestSha256 = GENESIS;
    let previousRuntimeReceiptSha256 = initialRuntime.receiptSha256;
    let previousRuntimeDerivationSha256 = initialRuntime.derivationSha256;
    let previousRuntimeExecutableIdentitySha256 = initialRuntime.executableIdentitySha256;
    let previousRuntimeTime = Date.parse(initialRuntime.inspectedAt);
    let lastBlockCompletedAt = Date.parse(start.runStartedAt);
    const allGlobalIds: string[] = [];
    const allPorts: number[] = [];
    const allTokenHashes: string[] = [];
    const checkoutByArm = new Map<SentinelProductionArm, string>();
    const allCellManifestPaths = new Set<string>();
    let earliestAttemptStarted = Number.POSITIVE_INFINITY;

    for (let blockIndex = 0; blockIndex < declaredBlockCount; blockIndex += 1) {
      const blockSequence = blockIndex + 1;
      const expectedBlock = expectedSchedule.slice(blockIndex * 4, blockIndex * 4 + 4);
      const finalReference = final.blocks[blockIndex];
      sentinelRawExactKeys(finalReference, ["path", "sha256"], `final block reference ${blockSequence}`);
      if (
        typeof finalReference.path !== "string" ||
        !new RegExp(`^manifests/blocks/block-${String(blockSequence).padStart(6, "0")}-[a-f0-9]{64}\\.json$`, "u").test(finalReference.path)
      ) throw new Error(`final block reference ${blockSequence} path is invalid`);
      const blockRecord = readContentAddressedManifest(
        batchRoot,
        finalReference.path,
        finalReference.sha256,
        `block ${blockSequence}`,
      );
      const block = parseBlockManifest(
        blockRecord.value,
        blockSequence,
        expectedBlock,
        previousBlockManifestSha256,
        MAXIMUM_ARM_START_SKEW_MS,
      );
      expectedPaths.add(blockRecord.path);
      previousBlockManifestSha256 = blockRecord.sha256;

      const runtimeBeforeReference = runtimeReference(block.runtimeBefore, `block ${blockSequence} runtime-before reference`);
      const runtimeBefore = verifySentinelRawRuntimeBoundary({
        batchRoot,
        reference: runtimeBeforeReference,
        expectedBoundary: "before",
        expectedBlockSequence: blockSequence,
        expectedPreviousReceiptSha256: previousRuntimeReceiptSha256,
        preregistrationClosure: plan.runtime,
      });
      if (!runtimeBefore.valid || runtimeBefore.receiptSha256 === null || runtimeBefore.inspectedAt === null) {
        throw new Error(`block ${blockSequence} runtime-before failed: ${runtimeBefore.issues.join("; ")}`);
      }
      if (runtimeBefore.exactSupervisorPaths === null) {
        throw new Error(`block ${blockSequence} runtime-before lacks exact execution lease paths`);
      }
      if (
        Date.parse(runtimeBefore.inspectedAt) < previousRuntimeTime ||
        Date.parse(runtimeBefore.inspectedAt) < lastBlockCompletedAt ||
        runtimeBefore.derivationSha256 !== previousRuntimeDerivationSha256 ||
        runtimeBefore.executableIdentitySha256 !== previousRuntimeExecutableIdentitySha256
      ) throw new Error(`block ${blockSequence} runtime-before changed or moved backward in time`);
      addRuntimePaths(expectedPaths, runtimeBeforeReference);
      previousRuntimeReceiptSha256 = runtimeBefore.receiptSha256;
      previousRuntimeTime = Date.parse(runtimeBefore.inspectedAt);

      const blockCells: SentinelRawCellVerification[] = [];
      for (const arm of ARMS) {
        const expectedCell = expectedBlock.find((candidate) => candidate.arm === arm);
        if (expectedCell === undefined) throw new Error(`signed block ${blockSequence} omits ${arm}`);
        const reference = cellReference(block.modeToCell[arm], expectedCell, `block ${blockSequence} ${arm} cell reference`);
        if (allCellManifestPaths.has(reference.path)) throw new Error("cell manifest path is reused across blocks");
        allCellManifestPaths.add(reference.path);
        const cellRecord = readContentAddressedManifest(batchRoot, reference.path, reference.sha256, `cell ${expectedCell.cellId}`);
        const manifest = parseCellManifest(
          cellRecord.value,
          expectedCell,
          blockSequence,
          preregistrationSha256,
          start.checkoutPreflights[arm].preflightSha256,
        );
        if (reference.attemptId !== manifest.attemptId) throw new Error(`cell ${expectedCell.cellId} reference attempt ID changed`);
        expectedPaths.add(cellRecord.path);
        for (const identity of manifest.artifacts) expectedPaths.add(`${manifest.cellRoot}/${identity.path}`);
        const task = tasks.get(expectedCell.taskId);
        if (task === undefined) throw new Error(`signed task ${expectedCell.taskId} is absent from its selected universe`);
        const verification = verifySentinelRawCellEvidence({
          batchRoot,
          preregistrationSha256,
          plan,
          cell: expectedCell,
          task,
          manifest,
        });
        cellVerifications.push(verification);
        blockCells.push(verification);
        if (!verification.rawComplete) {
          issues.push(...verification.issues.map((issue) => `${expectedCell.cellId}: ${issue}`));
        }
        if (
          verification.supervisor.executedPaths === null ||
          sentinelRawCanonical(verification.supervisor.executedPaths) !==
            sentinelRawCanonical(runtimeBefore.exactSupervisorPaths)
        ) throw new Error(`cell ${expectedCell.cellId} executed paths differ from the retained runtime lease`);
        if (
          verification.supervisor.attemptStartedAt === null || verification.supervisor.attemptFinishedAt === null ||
          verification.provider.operations.some((operation) =>
            Date.parse(operation.startedAt) < Date.parse(verification.supervisor.attemptStartedAt as string) ||
            Date.parse(operation.completedAt) > Date.parse(verification.supervisor.attemptFinishedAt as string)) ||
          verification.state.operations.some((operation) =>
            Date.parse(operation.receivedAt) < Date.parse(verification.supervisor.attemptStartedAt as string) ||
            Date.parse(operation.receivedAt) > Date.parse(verification.supervisor.attemptFinishedAt as string))
        ) throw new Error(`cell ${expectedCell.cellId} provider chronology falls outside the supervisor attempt boundary`);
        allGlobalIds.push(...verification.globalIds);
        allPorts.push(...verification.globalPorts);
        allTokenHashes.push(...verification.globalTokenHashes);
        const checkout = verification.checkoutPath;
        if (checkout !== null) {
          const prior = checkoutByArm.get(arm);
          if (prior !== undefined && prior !== checkout) throw new Error(`${arm} checkout path changed across blocks`);
          if (checkout !== start.checkoutPreflights[arm].checkoutPath) throw new Error(`${arm} supervisor checkout differs from preflight`);
          checkoutByArm.set(arm, checkout);
        }
        const invokedAt = Date.parse(manifest.attemptInvokedAt as string);
        const startedAt = Date.parse(manifest.attemptStartedAt as string);
        if (Date.parse(signature.authority.signedAt) >= invokedAt || Date.parse(observation.locallyValidatedAt) >= invokedAt) {
          throw new Error(`cell ${expectedCell.cellId} did not start strictly after external signing and local observation validation`);
        }
        earliestAttemptStarted = Math.min(earliestAttemptStarted, startedAt);
      }
      const processIds = blockCells.flatMap(({ supervisor, agent }) => [
        ...supervisor.processIds,
        ...(agent.pid === null ? [] : [agent.pid]),
      ]);
      if (new Set(processIds).size !== processIds.length) {
        throw new Error(`block ${blockSequence} reused a process identity across simultaneous cells`);
      }
      const starts = blockCells.map(({ manifest }) => Date.parse(manifest.attemptStartedAt as string));
      const invocations = blockCells.map(({ manifest }) => Date.parse(manifest.attemptInvokedAt as string));
      const observedSkew = Math.max(...starts) - Math.min(...starts);
      if (observedSkew !== block.maximumObservedStartSkewMs || Date.parse(runtimeBefore.inspectedAt) > Math.min(...invocations)) {
        throw new Error(`block ${blockSequence} start skew or pre-start runtime boundary does not replay`);
      }

      const runtimeAfterReference = runtimeReference(block.runtimeAfter, `block ${blockSequence} runtime-after reference`);
      const runtimeAfter = verifySentinelRawRuntimeBoundary({
        batchRoot,
        reference: runtimeAfterReference,
        expectedBoundary: "after",
        expectedBlockSequence: blockSequence,
        expectedPreviousReceiptSha256: previousRuntimeReceiptSha256,
        preregistrationClosure: plan.runtime,
      });
      if (!runtimeAfter.valid || runtimeAfter.receiptSha256 === null || runtimeAfter.inspectedAt === null) {
        throw new Error(`block ${blockSequence} runtime-after failed: ${runtimeAfter.issues.join("; ")}`);
      }
      const latestAttemptFinish = Math.max(...blockCells.map(({ supervisor }) =>
        supervisor.attemptFinishedAt === null ? Number.POSITIVE_INFINITY : Date.parse(supervisor.attemptFinishedAt)));
      if (
        Date.parse(runtimeAfter.inspectedAt) < latestAttemptFinish ||
        Date.parse(runtimeAfter.inspectedAt) < previousRuntimeTime ||
        runtimeAfter.derivationSha256 !== previousRuntimeDerivationSha256 ||
        runtimeAfter.executableIdentitySha256 !== previousRuntimeExecutableIdentitySha256 ||
        runtimeAfter.exactSupervisorPaths === null ||
        sentinelRawCanonical(runtimeAfter.exactSupervisorPaths) !== sentinelRawCanonical(runtimeBefore.exactSupervisorPaths)
      ) throw new Error(`block ${blockSequence} runtime-after changed, predates completion, or moved backward in time`);
      if (Date.parse(block.completedAt) < Date.parse(runtimeAfter.inspectedAt)) {
        throw new Error(`block ${blockSequence} completion predates its runtime-after boundary`);
      }
      addRuntimePaths(expectedPaths, runtimeAfterReference);
      previousRuntimeReceiptSha256 = runtimeAfter.receiptSha256;
      previousRuntimeTime = Date.parse(runtimeAfter.inspectedAt);
      lastBlockCompletedAt = Date.parse(block.completedAt);
      verifiedBlockCount += 1;
    }

    if (
      previousBlockManifestSha256 !== final.blockManifestHeadSha256 ||
      previousRuntimeReceiptSha256 !== final.runtimeInspectionHeadSha256 ||
      Date.parse(final.finalizedAt) < lastBlockCompletedAt
    ) throw new Error("execution final heads or finalization time do not close the exact block/runtime chains");
    if (earliestAttemptStarted <= Date.parse(observation.locallyValidatedAt)) {
      throw new Error("external observation validation did not strictly precede every retained attempt");
    }
    ensureGloballyUnique(allGlobalIds, "opaque/state/provider identifiers");
    if (new Set(allPorts).size !== allPorts.length) throw new Error("TCP ports are reused across the production batch");
    ensureGloballyUnique(allTokenHashes, "state/provider authorization token hashes");
    if (checkoutByArm.size !== 4 || new Set(checkoutByArm.values()).size !== 4) {
      throw new Error("verified supervisor checkouts are absent, unstable, or reused across arms");
    }
    verifyBatchInventory(batchRoot, expectedPaths);

    const rawComplete =
      issues.length === 0 && verifiedBlockCount === declaredBlockCount &&
      cellVerifications.length === declaredCellCount && cellVerifications.every(({ rawComplete }) => rawComplete);
    let analysis: SentinelRawAnalysisResult | null = null;
    if (rawComplete) {
      for (const cell of cellVerifications) measurements.push(deriveSentinelRawCellMeasurement(cell));
      const economicsInput: SentinelProductionEconomicsInput = {
        schemaVersion: "pm.public-eval-corners.sentinel-production-economics-input.v1",
        cells: cellVerifications.map((cell) => {
          if (cell.supervisor.attemptDurationMs === null) {
            throw new Error(`raw-complete cell ${cell.cell.cellId} lacks supervisor attempt duration`);
          }
          return {
            cellId: cell.cell.cellId,
            arm: cell.cell.arm,
            providerOperations: cell.provider.operations.map((operation) => ({
              operationId: operation.operationId,
              apiSurface: "anthropic-first-party-messages-standard" as const,
              model: "claude-sonnet-4-5-20250929" as const,
              promptCachingRequested: false as const,
              batchRequested: false as const,
              inputTokens: operation.inputTokens,
              outputTokens: operation.outputTokens,
              cacheCreationInputTokens: operation.cacheCreationInputTokens,
              cacheReadInputTokens: operation.cacheReadInputTokens,
              serverToolUseRequests: operation.serverToolUseRequestCount,
              latencyMs: operation.latencyMs,
            })),
            stateOperations: cell.state.operations.map((operation) => {
              if (operation.responseDeadlineMs !== SENTINEL_ECONOMICS_STATE_RESPONSE_DEADLINE_MS) {
                throw new Error(`cell ${cell.cell.cellId} state timing changed the frozen 250ms response boundary`);
              }
              return {
                operationId: operation.operationId,
                requestKind: operation.requestKind,
                backendWorkMs: operation.backendCompletedAtMonotonicMs - operation.receivedAtMonotonicMs,
                controlledApiWindowMs: operation.releasedAtMonotonicMs - operation.receivedAtMonotonicMs,
                responseDeadlineMs: operation.responseDeadlineMs,
                deadlineMissed: operation.deadlineMissed,
              };
            }),
            attemptDurationMs: cell.supervisor.attemptDurationMs,
          };
        }),
      };
      economics = auditSentinelProductionEconomics(economicsInput);
      const economicsVerification = verifySentinelProductionEconomicsReport(economics);
      if (!economicsVerification.valid || economics.inputSha256 !== sentinelRawJsonSha256(economicsInput)) {
        throw new Error(`raw-derived economics report failed independent replay: ${economicsVerification.issues.join("; ")}`);
      }
      analysis = analyzeSentinelRawMeasurements({
        phase: plan.registration.selectedPhase,
        bootstrapSeed: plan.analysis.bootstrapSeed,
        // The current runner retains no independently anchored, raw-verifiable power artifact.
        // Passing `true` here would be a verifier-fabricable promotion and is forbidden.
        powerArtifactExternallyVerified: false,
        economicsGuardrailsPassed: economics.guardrails.allGuardrailsPassed,
        // Current batch schema has no independent retained price/threshold observation.
        economicsArtifactExternallyVerified: false,
        cells: measurements,
      });
    }
    return {
      schemaVersion: "pm.public-eval-corners.sentinel-production-raw-batch-verification.v1",
      // A structurally complete raw replay is necessary but not a valid proof until
      // an independent post-run witness binds the exact block/cell/raw heads.
      valid: false,
      rawComplete,
      // The current producer schema has no independent post-run receipt over these raw heads.
      evidenceEligible: false,
      attemptTimeRawRootExternallyAnchored: false,
      analysisEligible: false,
      materialBenefit: false,
      preregistrationSha256,
      phase,
      declaredBlockCount,
      verifiedBlockCount,
      declaredCellCount,
      verifiedCellCount: cellVerifications.filter(({ rawComplete: complete }) => complete).length,
      cells: cellVerifications,
      measurements,
      analysis,
      economics,
      issues: [
        ...issues,
        ...(analysis?.issues ?? []),
        "attempt-time block/cell/raw roots lack an independently verified post-run external anchor",
      ],
    };
  } catch (error) {
    issues.push(issueOf(error));
    return {
      ...emptyResult(issues),
      preregistrationSha256,
      phase,
      declaredBlockCount,
      verifiedBlockCount,
      declaredCellCount,
      verifiedCellCount: cellVerifications.filter(({ rawComplete }) => rawComplete).length,
      cells: cellVerifications,
      measurements,
      economics,
    };
  }
}
