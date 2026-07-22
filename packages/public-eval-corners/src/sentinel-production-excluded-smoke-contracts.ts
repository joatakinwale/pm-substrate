import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readFileSync,
  realpathSync,
} from "node:fs";
import { isAbsolute, resolve } from "node:path";

import { sentinelProductionSha256 } from "./sentinel-production-plan.js";
import type {
  SentinelProductionCheckoutSet,
  SentinelProductionDiagnosticSelection,
} from "./sentinel-production-runner-contracts.js";

export const SENTINEL_DIAGNOSTIC_INVOCATION_MAX_BYTES = 128 * 1024;
export const SENTINEL_DIAGNOSTIC_PREREGISTRATION_MAX_BYTES = 8 * 1024 * 1024;
export const SENTINEL_DIAGNOSTIC_RUNTIME_PATHS_MAX_BYTES = 1024 * 1024;

const SHA256 = /^[a-f0-9]{64}$/u;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/u;
const CELL_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,1023}$/u;
const GIT_SHA1 = /^[a-f0-9]{40}$/u;

export interface SentinelProductionLocalDiagnosticInvocation {
  readonly schemaVersion:
    "pm.public-eval-corners.sentinel-production-local-diagnostic-invocation.v1";
  readonly trustMode: "local-untrusted-diagnostic";
  readonly independent: false;
  readonly batchComplete: false;
  readonly evidenceEligible: false;
  readonly analysisEligible: false;
  readonly materialBenefit: false;
  readonly preregistrationPath: string;
  readonly expectedPreregistrationSha256: string;
  readonly runtimePathsPath: string;
  readonly runtimePathsSha256: string;
  readonly expectedScheduleSha256: string;
  readonly checkouts: SentinelProductionCheckoutSet;
  readonly batchRoot: string;
  readonly attemptRegistryRoot: string;
  readonly selectedBlock: SentinelProductionDiagnosticSelection;
}

export interface SentinelProductionLocalDiagnosticPrepareInvocation {
  readonly schemaVersion:
    "pm.public-eval-corners.sentinel-production-local-diagnostic-prepare.v1";
  readonly trustMode: "local-untrusted-diagnostic";
  readonly independent: false;
  readonly batchComplete: false;
  readonly evidenceEligible: false;
  readonly analysisEligible: false;
  readonly materialBenefit: false;
  readonly runtimePathsPath: string;
  readonly outputRoot: string;
  readonly checkouts: SentinelProductionCheckoutSet;
  readonly batchRoot: string;
  readonly attemptRegistryRoot: string;
  readonly registration: {
    readonly registrationId: string;
    readonly registeredAt: string;
    readonly producerId: string;
    readonly repeatIds: readonly [string, string, string];
    readonly randomizationSeed: string;
    readonly bootstrapSeed: string;
    readonly rawBatchVerifierId: string;
  };
  readonly selectedTaskId: string;
  readonly selectedRepeatId: string;
}

export interface SentinelSafeJsonFile {
  readonly value: unknown;
  readonly bytes: Buffer;
  readonly sha256: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function exactKeys(value: unknown, expected: readonly string[], label: string): void {
  if (!isRecord(value)) throw new Error(`${label} must be an object`);
  if (
    Object.keys(value).sort(compare).join("\0") !==
    [...expected].sort(compare).join("\0")
  ) throw new Error(`${label} keys are not exact`);
}

export function sentinelDiagnosticCanonicalAbsolutePath(
  value: unknown,
  label: string,
): string {
  if (typeof value !== "string" || !isAbsolute(value) || resolve(value) !== value) {
    throw new Error(`${label} must be a canonical absolute path`);
  }
  return value;
}

function id(value: unknown, label: string): string {
  if (typeof value !== "string" || !ID.test(value)) {
    throw new Error(`${label} must be a canonical opaque ID`);
  }
  return value;
}

function cellId(value: unknown, label: string): string {
  if (typeof value !== "string" || !CELL_ID.test(value)) {
    throw new Error(`${label} must be a canonical frozen cell ID`);
  }
  return value;
}

function sha256(value: unknown, label: string): string {
  if (typeof value !== "string" || !SHA256.test(value)) {
    throw new Error(`${label} must be a lowercase SHA-256 digest`);
  }
  return value;
}

function canonicalTimestamp(value: unknown, label: string): string {
  if (typeof value !== "string") throw new Error(`${label} must be a timestamp`);
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.valueOf()) || parsed.toISOString() !== value) {
    throw new Error(`${label} must be a canonical UTC timestamp`);
  }
  return value;
}

function falseBoundary(value: Record<string, unknown>, label: string): void {
  if (
    value.trustMode !== "local-untrusted-diagnostic" ||
    value.independent !== false ||
    value.batchComplete !== false ||
    value.evidenceEligible !== false ||
    value.analysisEligible !== false ||
    value.materialBenefit !== false
  ) throw new Error(`${label} must retain the local untrusted fail-closed boundary`);
}

function checkouts(value: unknown): SentinelProductionCheckoutSet {
  exactKeys(value, ["native", "plain-kv", "sham", "substrate"], "checkouts");
  const record = value as Record<string, unknown>;
  return {
    native: sentinelDiagnosticCanonicalAbsolutePath(record.native, "native checkout"),
    sham: sentinelDiagnosticCanonicalAbsolutePath(record.sham, "sham checkout"),
    "plain-kv": sentinelDiagnosticCanonicalAbsolutePath(
      record["plain-kv"],
      "plain-kv checkout",
    ),
    substrate: sentinelDiagnosticCanonicalAbsolutePath(record.substrate, "substrate checkout"),
  };
}

function selectedBlock(value: unknown): SentinelProductionDiagnosticSelection {
  exactKeys(value, ["blockSequence", "cellIds", "repeatId", "taskId"], "selectedBlock");
  const record = value as Record<string, unknown>;
  if (!Number.isSafeInteger(record.blockSequence) || Number(record.blockSequence) < 1) {
    throw new Error("selectedBlock.blockSequence must be a positive integer");
  }
  if (!Array.isArray(record.cellIds) || record.cellIds.length !== 4) {
    throw new Error("selectedBlock.cellIds must contain exactly four IDs");
  }
  const cellIds = record.cellIds.map((value, index) =>
    cellId(value, `selectedBlock.cellIds[${index}]`));
  if (new Set(cellIds).size !== 4) throw new Error("selectedBlock.cellIds must be unique");
  return {
    blockSequence: Number(record.blockSequence),
    taskId: id(record.taskId, "selectedBlock.taskId"),
    repeatId: id(record.repeatId, "selectedBlock.repeatId"),
    cellIds: cellIds as [string, string, string, string],
  };
}

export function readSentinelDiagnosticJsonFile(
  path: string,
  maximumBytes: number,
  label: string,
): SentinelSafeJsonFile {
  sentinelDiagnosticCanonicalAbsolutePath(path, `${label} path`);
  if (realpathSync(path) !== path) throw new Error(`${label} path traverses a symbolic link`);
  let descriptor: number | null = null;
  try {
    descriptor = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    const before = fstatSync(descriptor);
    const namedBefore = lstatSync(path);
    if (!before.isFile() || before.size < 2 || before.size > maximumBytes) {
      throw new Error(`${label} must be a regular file within its size ceiling`);
    }
    if (
      namedBefore.isSymbolicLink() || namedBefore.dev !== before.dev || namedBefore.ino !== before.ino
    ) throw new Error(`${label} named path differs from the opened regular file`);
    const bytes = readFileSync(descriptor);
    const after = fstatSync(descriptor);
    const namedAfter = lstatSync(path);
    if (
      after.dev !== before.dev ||
      after.ino !== before.ino ||
      after.size !== before.size ||
      after.mtimeMs !== before.mtimeMs ||
      bytes.byteLength !== before.size ||
      namedAfter.isSymbolicLink() ||
      namedAfter.dev !== after.dev ||
      namedAfter.ino !== after.ino ||
      realpathSync(path) !== path
    ) throw new Error(`${label} changed while it was read`);
    return {
      value: JSON.parse(bytes.toString("utf8")) as unknown,
      bytes,
      sha256: sentinelProductionSha256(bytes),
    };
  } finally {
    if (descriptor !== null) closeSync(descriptor);
  }
}

export function parseSentinelProductionLocalDiagnosticInvocation(
  value: unknown,
): SentinelProductionLocalDiagnosticInvocation {
  exactKeys(value, [
    "analysisEligible", "attemptRegistryRoot", "batchComplete", "batchRoot", "checkouts",
    "evidenceEligible", "expectedPreregistrationSha256", "expectedScheduleSha256", "independent",
    "materialBenefit", "preregistrationPath", "runtimePathsPath", "runtimePathsSha256", "schemaVersion",
    "selectedBlock", "trustMode",
  ], "local diagnostic invocation");
  const record = value as Record<string, unknown>;
  if (
    record.schemaVersion !==
      "pm.public-eval-corners.sentinel-production-local-diagnostic-invocation.v1"
  ) throw new Error("unsupported local diagnostic invocation schemaVersion");
  falseBoundary(record, "local diagnostic invocation");
  return {
    schemaVersion:
      "pm.public-eval-corners.sentinel-production-local-diagnostic-invocation.v1",
    trustMode: "local-untrusted-diagnostic",
    independent: false,
    batchComplete: false,
    evidenceEligible: false,
    analysisEligible: false,
    materialBenefit: false,
    preregistrationPath: sentinelDiagnosticCanonicalAbsolutePath(
      record.preregistrationPath,
      "preregistrationPath",
    ),
    expectedPreregistrationSha256: sha256(
      record.expectedPreregistrationSha256,
      "expectedPreregistrationSha256",
    ),
    runtimePathsPath: sentinelDiagnosticCanonicalAbsolutePath(
      record.runtimePathsPath,
      "runtimePathsPath",
    ),
    runtimePathsSha256: sha256(record.runtimePathsSha256, "runtimePathsSha256"),
    expectedScheduleSha256: sha256(record.expectedScheduleSha256, "expectedScheduleSha256"),
    checkouts: checkouts(record.checkouts),
    batchRoot: sentinelDiagnosticCanonicalAbsolutePath(record.batchRoot, "batchRoot"),
    attemptRegistryRoot: sentinelDiagnosticCanonicalAbsolutePath(
      record.attemptRegistryRoot,
      "attemptRegistryRoot",
    ),
    selectedBlock: selectedBlock(record.selectedBlock),
  };
}

export function parseSentinelProductionLocalDiagnosticPrepareInvocation(
  value: unknown,
): SentinelProductionLocalDiagnosticPrepareInvocation {
  exactKeys(value, [
    "analysisEligible", "attemptRegistryRoot", "batchComplete", "batchRoot", "checkouts",
    "evidenceEligible", "independent", "materialBenefit", "outputRoot", "registration",
    "runtimePathsPath", "schemaVersion", "selectedRepeatId", "selectedTaskId", "trustMode",
  ], "local diagnostic prepare invocation");
  const record = value as Record<string, unknown>;
  if (
    record.schemaVersion !== "pm.public-eval-corners.sentinel-production-local-diagnostic-prepare.v1"
  ) throw new Error("unsupported local diagnostic prepare schemaVersion");
  falseBoundary(record, "local diagnostic prepare invocation");
  exactKeys(record.registration, [
    "bootstrapSeed", "producerId", "randomizationSeed", "rawBatchVerifierId", "registeredAt",
    "registrationId", "repeatIds",
  ], "local diagnostic registration");
  const registration = record.registration as Record<string, unknown>;
  if (!Array.isArray(registration.repeatIds) || registration.repeatIds.length !== 3) {
    throw new Error("registration.repeatIds must contain exactly three IDs");
  }
  const repeatIds = registration.repeatIds.map((value, index) =>
    id(value, `registration.repeatIds[${index}]`));
  if (new Set(repeatIds).size !== 3) throw new Error("registration.repeatIds must be unique");
  if (
    typeof registration.rawBatchVerifierId !== "string" ||
    !ID.test(registration.rawBatchVerifierId)
  ) throw new Error("registration.rawBatchVerifierId is invalid");
  return {
    schemaVersion: "pm.public-eval-corners.sentinel-production-local-diagnostic-prepare.v1",
    trustMode: "local-untrusted-diagnostic",
    independent: false,
    batchComplete: false,
    evidenceEligible: false,
    analysisEligible: false,
    materialBenefit: false,
    runtimePathsPath: sentinelDiagnosticCanonicalAbsolutePath(
      record.runtimePathsPath,
      "runtimePathsPath",
    ),
    outputRoot: sentinelDiagnosticCanonicalAbsolutePath(record.outputRoot, "outputRoot"),
    checkouts: checkouts(record.checkouts),
    batchRoot: sentinelDiagnosticCanonicalAbsolutePath(record.batchRoot, "batchRoot"),
    attemptRegistryRoot: sentinelDiagnosticCanonicalAbsolutePath(
      record.attemptRegistryRoot,
      "attemptRegistryRoot",
    ),
    registration: {
      registrationId: id(registration.registrationId, "registration.registrationId"),
      registeredAt: canonicalTimestamp(registration.registeredAt, "registration.registeredAt"),
      producerId: id(registration.producerId, "registration.producerId"),
      repeatIds: repeatIds as [string, string, string],
      randomizationSeed: id(registration.randomizationSeed, "registration.randomizationSeed"),
      bootstrapSeed: id(registration.bootstrapSeed, "registration.bootstrapSeed"),
      rawBatchVerifierId: registration.rawBatchVerifierId,
    },
    selectedTaskId: id(record.selectedTaskId, "selectedTaskId"),
    selectedRepeatId: id(record.selectedRepeatId, "selectedRepeatId"),
  };
}

export function redactSentinelDiagnosticError(
  error: unknown,
  secrets: readonly (string | undefined)[],
): string {
  let message = error instanceof Error ? error.message : String(error);
  for (const secret of secrets) {
    if (secret !== undefined && secret.length > 0) {
      message = message.split(secret).join("[REDACTED]");
    }
  }
  return message
    .replace(/postgres(?:ql)?:\/\/[^\s@]+@/giu, "postgres://[REDACTED]@")
    .replace(/sk-ant-[A-Za-z0-9_-]{8,}/gu, "[REDACTED-ANTHROPIC-KEY]")
    .replace(/[\0\r\n]+/gu, " ")
    .slice(0, 4_096);
}

export function assertSentinelDiagnosticGitRevision(value: string): void {
  if (!GIT_SHA1.test(value)) throw new Error("derived substrate revision is not a Git SHA-1");
}
