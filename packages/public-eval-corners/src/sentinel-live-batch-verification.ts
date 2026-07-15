import { lstatSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";

import {
  SENTINEL_MATERIAL_LIFT_RULE,
  sentinelJsonSha256,
  sentinelLiveRequiredTasks,
  verifySentinelPreregistration,
  type SentinelLiveArm,
  type SentinelLiveCell,
  type SentinelLivePreregistration,
  type SentinelLiveTaskId,
  type SentinelPreregistrationSignature,
} from "./sentinel-live-plan.js";
import {
  SENTINEL_VERIFICATION_SHA256 as SHA256,
  isSentinelVerificationRecord as isRecord,
  loadSentinelVerificationArtifacts as loadArtifacts,
  parseSentinelVerificationJson as parseJson,
  sameSentinelLiveCell as sameCell,
  sentinelLiveCellBindingSha256,
  sentinelVerificationArtifactsByRole as byRole,
  sentinelVerificationCanonicalTimestamp as canonicalTimestamp,
  sentinelVerificationCanonicalWithout as canonicalWithout,
  sentinelVerificationExactKeys as exactKeys,
  sentinelVerificationNonNegativeInteger as nonNegativeInteger,
  sentinelVerificationOnlyArtifactRole as onlyRole,
  sentinelVerificationPortableRelativePath as portableRelativePath,
  verifySentinelBatchIdentityUniqueness,
  verifySentinelLiveCell,
  verifySentinelRuntimeIdentityBindings,
  type JsonRecord,
  type LoadedArtifact,
  type SentinelBatchCellRuntimeIdentities,
  type SentinelLiveArtifactIdentity,
  type SentinelLiveArtifactRole,
  type SentinelLiveCellEvidenceBinding,
  type SentinelLiveCellVerification,
  type SentinelProviderUsageEstimate,
} from "./sentinel-live-verification.js";

export interface SentinelMatrixCellCount {
  readonly taskId: SentinelLiveTaskId;
  readonly arm: SentinelLiveArm;
  readonly passes: number;
  readonly total: number;
}

export interface SentinelLiveMatrixAnalysis {
  readonly schemaVersion: "pm.public-eval-corners.sentinel-matrix-analysis.v1";
  readonly preregistrationSha256: string;
  readonly complete: boolean;
  /** Internal rule result; only raw batch verification may promote it to materialBenefit. */
  readonly preregisteredRuleSatisfied: boolean;
  readonly rule: typeof SENTINEL_MATERIAL_LIFT_RULE;
  readonly counts: readonly SentinelMatrixCellCount[];
  readonly providerUsage: SentinelProviderUsageEstimate;
  readonly issues: readonly string[];
  readonly eligibleForIndependentAnalysis: false;
}

export interface VerifySentinelLiveBatchInput {
  readonly batchRoot: string;
  readonly executionManifestPath: string;
  readonly executionManifestSha256: string;
  readonly preregistration: SentinelLivePreregistration;
  readonly signature: SentinelPreregistrationSignature;
  readonly expectedPreregistrationSha256: string;
  readonly cellManifestPaths: readonly string[];
}

export interface SentinelLiveBatchVerification {
  readonly schemaVersion: "pm.public-eval-corners.sentinel-live-batch-verification.v1";
  readonly valid: boolean;
  readonly complete: boolean;
  readonly materialBenefit: boolean;
  readonly executionManifestValid: boolean;
  readonly preregistrationSha256: string;
  readonly declaredCellCount: number;
  readonly verifiedCellCount: number;
  readonly cells: readonly SentinelLiveCellVerification[];
  readonly analysis: SentinelLiveMatrixAnalysis;
  readonly issues: readonly string[];
  readonly eligibleForIndependentAnalysis: false;
  readonly publicEfficacyEligible: false;
  readonly qualificationOnly: true;
}

function analyzeSentinelLiveMatrix(
  preregistration: SentinelLivePreregistration,
  signature: SentinelPreregistrationSignature,
  expectedPreregistrationSha256: string,
  cells: readonly SentinelLiveCellVerification[],
): SentinelLiveMatrixAnalysis {
  const plan = verifySentinelPreregistration(preregistration, signature, expectedPreregistrationSha256);
  const issues = [...plan.issues.map((issue) => `preregistration: ${issue}`)];
  const actual = new Map<string, SentinelLiveCellVerification>();
  for (const cell of cells) {
    if (actual.has(cell.cell.cellId)) issues.push(`duplicate cell verification: ${cell.cell.cellId}`);
    else actual.set(cell.cell.cellId, cell);
  }
  for (const expected of plan.cells) {
    const cell = actual.get(expected.cellId);
    if (!cell) issues.push(`missing preregistered cell: ${expected.cellId}`);
    else if (cell.preregistrationSha256 !== plan.preregistrationSha256 || !sameCell(cell.cell, expected)) {
      issues.push(`cell verification does not match schedule: ${expected.cellId}`);
    } else if (!cell.valid || !cell.infrastructureComplete || cell.rawCrossCheck !== true ||
               cell.upstreamSuccess === null) {
      issues.push(`infrastructure-incomplete cell: ${expected.cellId}`);
    }
  }
  for (const cellId of actual.keys()) {
    if (!plan.cells.some((cell) => cell.cellId === cellId)) issues.push(`undeclared/shopped cell: ${cellId}`);
  }
  const tasks = Object.keys(sentinelLiveRequiredTasks) as SentinelLiveTaskId[];
  const arms: readonly SentinelLiveArm[] = ["native", "sham", "substrate"];
  const counts = tasks.flatMap((taskId) => arms.map((arm) => {
    const selected = plan.cells.map(({ cellId }) => actual.get(cellId)).filter(
      (cell): cell is SentinelLiveCellVerification => cell?.cell.taskId === taskId && cell.cell.arm === arm,
    );
    return { taskId, arm, passes: selected.filter(({ upstreamSuccess }) => upstreamSuccess === true).length, total: selected.length };
  }));
  const count = (taskId: SentinelLiveTaskId, arm: SentinelLiveArm): number =>
    counts.find((entry) => entry.taskId === taskId && entry.arm === arm)?.passes ?? 0;
  const complete = issues.length === 0 && cells.length === 27 && plan.cells.length === 27;
  const preregisteredRuleSatisfied = complete &&
    count("microhub-stars-relative-passive", "substrate") >= 2 &&
    count("microhub-stars-relative-passive", "native") <= 1 &&
    count("microhub-stars-relative-passive", "sham") <= 1 &&
    arms.every((arm) => count("microhub-stars-noop", arm) >= 2 &&
      count("microhub-stars-absolute-passive", arm) >= 2);
  const providerUsage = cells.reduce<SentinelProviderUsageEstimate>((total, cell) => ({
    inputTokens: total.inputTokens + cell.providerUsage.inputTokens,
    outputTokens: total.outputTokens + cell.providerUsage.outputTokens,
    estimatedUsd: total.estimatedUsd + cell.providerUsage.estimatedUsd,
  }), { inputTokens: 0, outputTokens: 0, estimatedUsd: 0 });
  return {
    schemaVersion: "pm.public-eval-corners.sentinel-matrix-analysis.v1",
    preregistrationSha256: plan.preregistrationSha256,
    complete,
    preregisteredRuleSatisfied,
    rule: SENTINEL_MATERIAL_LIFT_RULE,
    counts,
    providerUsage,
    issues,
    eligibleForIndependentAnalysis: false,
  };
}

export function classifySentinelLiveArtifactRole(
  relativePath: string,
): SentinelLiveArtifactRole {
  if (!portableRelativePath(relativePath)) throw new Error("Sentinel artifact path is not portable");
  if (relativePath === "input/scenario-definition.json") return "scenario-definition";
  if (/^upstream\/runtime\/results\/[^/]+\/microhub\/[^/]+\/results\.json$/u.test(relativePath)) {
    return "upstream-result";
  }
  if (relativePath === "upstream/runtime/agent/browser-network.jsonl") return "browser-network";
  if (relativePath === "upstream/runtime/agent/agent-start.json") return "agent-start";
  if (relativePath === "upstream/runtime/agent/agent-events.jsonl") return "agent-events";
  if (relativePath === "upstream/runtime/agent/agent-terminal.json") return "agent-terminal";
  if (/^upstream\/runtime\/agent\/poll-[0-9]{4}\.png$/u.test(relativePath)) return "agent-screenshot";
  if (relativePath === "state/sentinel-state-ready.json") return "state-ready";
  if (relativePath === "state/sentinel-state-final.json") return "state-final";
  if (relativePath === "state/sentinel-state-audit.ndjson") return "state-audit";
  if (relativePath === "provider/anthropic-provider-proxy-ready.json") return "provider-ready";
  if (relativePath === "provider/anthropic-provider-proxy-final.json") return "provider-final";
  if (/^provider\/audit\/[0-9]{8}-[a-f0-9]{64}\.json$/u.test(relativePath)) return "provider-audit";
  if (/^provider\/operations\/[a-f0-9]{64}\/[^/]+$/u.test(relativePath)) return "provider-operation";
  if (/^upstream\/receipts\/sentinel-attempt-start-[a-f0-9]{64}\.json$/u.test(relativePath)) {
    return "supervisor-start";
  }
  if (/^upstream\/receipts\/sentinel-attempt-terminal-[a-f0-9]{64}\.json$/u.test(relativePath)) {
    return "supervisor-terminal";
  }
  return "supporting";
}

function readContentAddressedManifest(
  path: string,
  expectedSha256: string | null,
  label: string,
  issues: string[],
): JsonRecord | null {
  let value: unknown;
  try {
    const stat = lstatSync(path);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("not a regular file");
    value = JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch {
    issues.push(`${label} cannot be read as a regular JSON file`);
    return null;
  }
  if (!isRecord(value) || typeof value.manifestSha256 !== "string" || !SHA256.test(value.manifestSha256)) {
    issues.push(`${label} lacks a valid manifestSha256`);
    return null;
  }
  const actual = canonicalWithout(value, "manifestSha256");
  const filenameMatch = /-([a-f0-9]{64})\.json$/u.exec(path);
  if (actual !== value.manifestSha256 || filenameMatch?.[1] !== actual ||
      (expectedSha256 !== null && expectedSha256 !== actual)) {
    issues.push(`${label} content address does not match its bytes, filename, or declared hash`);
  }
  return value;
}

function manifestArtifactIdentities(
  value: unknown,
  issues: string[],
  label: string,
): readonly { readonly path: string; readonly byteLength: number; readonly sha256: string }[] {
  if (!Array.isArray(value)) {
    issues.push(`${label}.artifacts must be an array`);
    return [];
  }
  const output: { path: string; byteLength: number; sha256: string }[] = [];
  for (const [index, identity] of value.entries()) {
    if (!exactKeys(identity, ["byteLength", "path", "sha256"])) {
      issues.push(`${label}.artifacts[${index}] keys are not exact`);
      continue;
    }
    const record = identity as JsonRecord;
    if (typeof record.path !== "string" || !portableRelativePath(record.path) ||
        !nonNegativeInteger(record.byteLength) || typeof record.sha256 !== "string" ||
        !SHA256.test(record.sha256) || output.some(({ path }) => path === record.path)) {
      issues.push(`${label}.artifacts[${index}] is invalid or duplicated`);
      continue;
    }
    output.push({ path: record.path, byteLength: record.byteLength, sha256: record.sha256 });
  }
  return output;
}

function receiptHashFromArtifact(
  root: string,
  artifacts: readonly SentinelLiveArtifactIdentity[],
  role: SentinelLiveArtifactRole,
  field: "receiptHash" | "receiptSha256",
): string | null {
  const selected = artifacts.filter((artifact) => artifact.role === role);
  if (selected.length !== 1) return null;
  try {
    const value = JSON.parse(readFileSync(resolve(root, selected[0]!.relativePath), "utf8")) as unknown;
    return isRecord(value) && typeof value[field] === "string" ? value[field] as string : null;
  } catch {
    return null;
  }
}

function collectBatchCellRuntimeIdentities(
  binding: SentinelLiveCellEvidenceBinding,
  declaredPorts: unknown,
  issues: string[],
): SentinelBatchCellRuntimeIdentities {
  const artifacts = loadArtifacts(binding, issues) as Map<string, LoadedArtifact>;
  const parseRole = (role: SentinelLiveArtifactRole): JsonRecord | null => {
    const file = onlyRole(artifacts, role, issues);
    if (!file) return null;
    const value = parseJson(file.bytes, `${binding.cell.cellId} ${role}`, issues);
    return isRecord(value) ? value : null;
  };
  const supervisorStart = parseRole("supervisor-start");
  const supervisorTerminal = parseRole("supervisor-terminal");
  const agentStart = parseRole("agent-start");
  const stateReady = parseRole("state-ready");
  const providerReady = parseRole("provider-ready");
  issues.push(...verifySentinelRuntimeIdentityBindings({
    supervisorPlan: supervisorStart?.plan,
    supervisorProcesses: supervisorTerminal?.processes,
    agentStart,
    stateReady,
    providerReady,
    declaredPorts,
  }).issues.map((issue) => `${binding.cell.cellId}: ${issue}`));
  const audits = byRole(artifacts, "provider-audit")
    .map((file) => parseJson(file.bytes, `${binding.cell.cellId} provider audit`, issues))
    .filter(isRecord)
    .sort((left, right) => Number(left.sequence) - Number(right.sequence));
  const clientAttemptIds = audits.flatMap((audit) =>
    audit.stage === "attempt-started" && typeof audit.clientAttemptId === "string"
      ? [audit.clientAttemptId] : []);
  const providerRequestIds = audits.flatMap((audit) =>
    audit.stage === "attempt-terminal" && typeof audit.providerRequestId === "string"
      ? [audit.providerRequestId] : []);
  const providerMessageIds = audits.flatMap((audit) =>
    audit.stage === "attempt-terminal" && typeof audit.providerMessageId === "string"
      ? [audit.providerMessageId] : []);
  return {
    cellId: binding.cell.cellId,
    ports: Array.isArray(declaredPorts)
      ? declaredPorts.filter((port): port is number => typeof port === "number") : [],
    clientAttemptIds,
    providerRequestIds,
    providerMessageIds,
  };
}

function buildCellBindingFromManifest(
  manifest: JsonRecord,
  expectedCell: SentinelLiveCell,
  preregistrationSha256: string,
  batchRoot: string,
  issues: string[],
): SentinelLiveCellEvidenceBinding | null {
  const label = `cell manifest ${expectedCell.sequence}`;
  const exactManifestKeys = [
    "arm", "artifactRootSha256", "artifacts", "attemptId", "attemptReceiptHash",
    "cellId", "cellRoot", "evidenceEligible", "manifestSha256", "ports",
    "providerFinalReceiptHash", "publicEfficacyEligible", "qualificationOnly", "repeatId",
    "retryCount", "runnerFailureCount", "schemaVersion", "sequence",
    "stateFinalReceiptHash", "supervisorReturnedTerminalReceipt", "taskId", "taskRole",
  ] as const;
  if (!exactKeys(manifest, exactManifestKeys)) issues.push(`${label} keys are not exact`);
  if (manifest.schemaVersion !== "pm.public-eval-corners.sentinel-live-cell-manifest.v1" ||
      manifest.evidenceEligible !== false || manifest.publicEfficacyEligible !== false ||
      manifest.qualificationOnly !== true || manifest.sequence !== expectedCell.sequence ||
      manifest.cellId !== expectedCell.cellId || manifest.taskId !== expectedCell.taskId ||
      manifest.taskRole !== expectedCell.taskRole || manifest.arm !== expectedCell.arm ||
      manifest.repeatId !== expectedCell.repeatId || manifest.retryCount !== 0) {
    issues.push(`${label} does not match the exact preregistered cell`);
  }
  if (typeof manifest.attemptId !== "string" || !/^slc-[a-f0-9]{40}$/u.test(manifest.attemptId)) {
    issues.push(`${label}.attemptId is invalid`);
    return null;
  }
  const expectedRoot = resolve(batchRoot, "cells", manifest.attemptId);
  if (manifest.cellRoot !== expectedRoot) issues.push(`${label}.cellRoot is not the exact batch cell root`);
  const ports = Array.isArray(manifest.ports) ? manifest.ports : [];
  if (ports.length !== 4 || new Set(ports).size !== 4 ||
      ports.some((port) => !nonNegativeInteger(port) || port < 1 || port > 65_535)) {
    issues.push(`${label}.ports must be four unique TCP ports`);
  }
  const rawArtifacts = manifestArtifactIdentities(manifest.artifacts, issues, label);
  if (manifest.artifactRootSha256 !== sentinelJsonSha256(rawArtifacts)) {
    issues.push(`${label}.artifactRootSha256 does not bind the declared artifact inventory`);
  }
  const artifacts = rawArtifacts.map((identity): SentinelLiveArtifactIdentity => ({
    role: classifySentinelLiveArtifactRole(identity.path),
    relativePath: identity.path,
    byteLength: identity.byteLength,
    sha256: identity.sha256,
  }));
  const attemptReceiptHash = receiptHashFromArtifact(expectedRoot, artifacts, "supervisor-terminal", "receiptHash");
  const stateReceiptHash = receiptHashFromArtifact(expectedRoot, artifacts, "state-final", "receiptSha256");
  const providerReceiptHash = receiptHashFromArtifact(expectedRoot, artifacts, "provider-final", "receiptHash");
  if (manifest.supervisorReturnedTerminalReceipt !== (attemptReceiptHash !== null) ||
      manifest.attemptReceiptHash !== attemptReceiptHash ||
      manifest.stateFinalReceiptHash !== stateReceiptHash ||
      manifest.providerFinalReceiptHash !== providerReceiptHash) {
    issues.push(`${label} receipt pointers do not bind the retained terminal receipts`);
  }
  const failureArtifacts = rawArtifacts.filter(({ path }) => /^runner-terminal-failure-[a-f0-9]{64}\.json$/u.test(path));
  if (!nonNegativeInteger(manifest.runnerFailureCount) ||
      manifest.runnerFailureCount !== failureArtifacts.length) {
    issues.push(`${label}.runnerFailureCount does not bind retained runner failures`);
  }
  const body = {
    schemaVersion: "pm.public-eval-corners.sentinel-cell-evidence-binding.v1" as const,
    preregistrationSha256,
    cell: expectedCell,
    artifactRoot: expectedRoot,
    artifacts,
  };
  return { ...body, bindingSha256: sentinelLiveCellBindingSha256(body) };
}

export function verifySentinelLiveBatchEvidence(
  input: VerifySentinelLiveBatchInput,
): SentinelLiveBatchVerification {
  const issues: string[] = [];
  const plan = verifySentinelPreregistration(
    input.preregistration,
    input.signature,
    input.expectedPreregistrationSha256,
  );
  issues.push(...plan.issues.map((issue) => `preregistration: ${issue}`));
  const batchRoot = resolve(input.batchRoot);
  if (!isAbsolute(input.batchRoot) || batchRoot !== input.batchRoot) {
    issues.push("batchRoot must be absolute and normalized");
  }
  const execution = readContentAddressedManifest(
    resolve(input.executionManifestPath),
    input.executionManifestSha256,
    "execution manifest",
    issues,
  );
  const executionKeys = [
    "attemptedCellCount", "cells", "completedAt", "declaredCellCount", "evidenceEligible",
    "manifestSha256", "noOutcomeInspectionDuringExecution", "preregistrationSha256",
    "publicEfficacyEligible", "qualificationOnly", "retryCount", "schemaVersion",
    "signaturePublicKeySha256",
  ] as const;
  let executionManifestValid = execution !== null;
  if (!execution || !exactKeys(execution, executionKeys) ||
      execution.schemaVersion !== "pm.public-eval-corners.sentinel-live-execution-manifest.v1" ||
      execution.evidenceEligible !== false || execution.publicEfficacyEligible !== false ||
      execution.qualificationOnly !== true || execution.preregistrationSha256 !== plan.preregistrationSha256 ||
      execution.signaturePublicKeySha256 !== input.signature.publicKeySha256 ||
      execution.declaredCellCount !== 27 || execution.attemptedCellCount !== 27 ||
      execution.retryCount !== 0 || execution.noOutcomeInspectionDuringExecution !== true ||
      !canonicalTimestamp(execution.completedAt) || !Array.isArray(execution.cells) ||
      execution.cells.length !== 27) {
    issues.push("execution manifest is not the exact completed outcome-blind 27-cell universe");
    executionManifestValid = false;
  }
  if (input.cellManifestPaths.length !== 27 || new Set(input.cellManifestPaths).size !== 27) {
    issues.push("cell manifest path list must contain exactly 27 unique paths");
  }
  const executionCells = execution && Array.isArray(execution.cells) ? execution.cells : [];
  const declaredCellManifestPaths = new Set(input.cellManifestPaths.map((path) => resolve(path)));
  const executionByCellId = new Map<string, JsonRecord>();
  const executionAttemptIds = new Set<string>();
  for (const [index, value] of executionCells.entries()) {
    if (!exactKeys(value, [
      "arm", "attemptId", "cellId", "cellManifestPath", "cellManifestSha256", "repeatId",
      "sequence", "taskId",
    ])) {
      issues.push(`execution manifest cell ${index + 1} keys are not exact`);
      continue;
    }
    const record = value as JsonRecord;
    if (typeof record.cellId !== "string" || executionByCellId.has(record.cellId)) {
      issues.push(`execution manifest cell ${index + 1} is duplicated or invalid`);
      continue;
    }
    if (typeof record.attemptId !== "string" || !/^slc-[a-f0-9]{40}$/u.test(record.attemptId) ||
        executionAttemptIds.has(record.attemptId)) {
      issues.push(`execution manifest cell ${index + 1} reuses or has an invalid attemptId`);
      continue;
    }
    executionAttemptIds.add(record.attemptId);
    executionByCellId.set(record.cellId, record);
  }
  const cells: SentinelLiveCellVerification[] = [];
  const batchRuntimeIdentities: SentinelBatchCellRuntimeIdentities[] = [];
  const boundArtifactRoots = new Set<string>();
  for (const expectedCell of plan.cells) {
    const executionCell = executionByCellId.get(expectedCell.cellId);
    if (!executionCell) {
      issues.push(`execution manifest is missing ${expectedCell.cellId}`);
      continue;
    }
    if (executionCell.sequence !== expectedCell.sequence || executionCell.taskId !== expectedCell.taskId ||
        executionCell.arm !== expectedCell.arm || executionCell.repeatId !== expectedCell.repeatId ||
        typeof executionCell.cellManifestPath !== "string" ||
        typeof executionCell.cellManifestSha256 !== "string" || !SHA256.test(executionCell.cellManifestSha256)) {
      issues.push(`execution manifest cell does not match schedule: ${expectedCell.cellId}`);
      continue;
    }
    const manifestPath = resolve(String(executionCell.cellManifestPath));
    if (!declaredCellManifestPaths.has(manifestPath) ||
        relative(resolve(batchRoot, "manifests", "cells"), manifestPath).startsWith("..")) {
      issues.push(`cell manifest path escaped or was not declared: ${expectedCell.cellId}`);
      continue;
    }
    const manifest = readContentAddressedManifest(
      manifestPath,
      String(executionCell.cellManifestSha256),
      `cell manifest ${expectedCell.sequence}`,
      issues,
    );
    if (!manifest) continue;
    if (manifest.attemptId !== executionCell.attemptId) {
      issues.push(`cell manifest attempt does not match execution manifest: ${expectedCell.cellId}`);
      continue;
    }
    const binding = buildCellBindingFromManifest(
      manifest,
      expectedCell,
      plan.preregistrationSha256,
      batchRoot,
      issues,
    );
    if (!binding) continue;
    if (binding.artifactRoot !== resolve(batchRoot, "cells", String(executionCell.attemptId)) ||
        boundArtifactRoots.has(binding.artifactRoot)) {
      issues.push(`cell artifact root is reused or mismatched: ${expectedCell.cellId}`);
      continue;
    }
    boundArtifactRoots.add(binding.artifactRoot);
    batchRuntimeIdentities.push(collectBatchCellRuntimeIdentities(binding, manifest.ports, issues));
    cells.push(verifySentinelLiveCell({
      preregistration: input.preregistration,
      signature: input.signature,
      expectedPreregistrationSha256: input.expectedPreregistrationSha256,
      binding,
    }));
  }
  issues.push(...verifySentinelBatchIdentityUniqueness(batchRuntimeIdentities).issues);
  const analysis = analyzeSentinelLiveMatrix(
    input.preregistration,
    input.signature,
    input.expectedPreregistrationSha256,
    cells,
  );
  issues.push(...analysis.issues.map((issue) => `analysis: ${issue}`));
  const complete = executionManifestValid && cells.length === 27 && analysis.complete && issues.length === 0;
  return {
    schemaVersion: "pm.public-eval-corners.sentinel-live-batch-verification.v1",
    valid: complete,
    complete,
    materialBenefit: complete && analysis.preregisteredRuleSatisfied,
    executionManifestValid,
    preregistrationSha256: plan.preregistrationSha256,
    declaredCellCount: plan.cells.length,
    verifiedCellCount: cells.length,
    cells,
    analysis,
    issues,
    eligibleForIndependentAnalysis: false,
    publicEfficacyEligible: false,
    qualificationOnly: true,
  };
}
