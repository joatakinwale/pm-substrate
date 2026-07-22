#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import type {
  SentinelExternalTrustAnchor,
  SentinelProductionPreregistration,
  SentinelProductionSignature,
} from "./sentinel-production-plan.js";
import {
  parseSentinelRuntimeClosurePaths,
} from "./sentinel-production-prepare-contracts.js";
import {
  readSentinelDiagnosticJsonFile,
  redactSentinelDiagnosticError,
  sentinelDiagnosticCanonicalAbsolutePath,
  SENTINEL_DIAGNOSTIC_INVOCATION_MAX_BYTES,
  SENTINEL_DIAGNOSTIC_PREREGISTRATION_MAX_BYTES,
  SENTINEL_DIAGNOSTIC_RUNTIME_PATHS_MAX_BYTES,
  type SentinelSafeJsonFile,
} from "./sentinel-production-excluded-smoke-contracts.js";
import {
  runSentinelProductionBatch,
  type SentinelProductionCheckoutSet,
  type SentinelProductionExternalCommitment,
  type SentinelProductionRunInput,
} from "./sentinel-production-runner.js";

const SENTINEL_PRODUCTION_REFERENCE_MAX_BYTES = 1024 * 1024;
const SHA256 = /^[a-f0-9]{64}$/u;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/u;

export interface SentinelProductionRunInvocation {
  readonly schemaVersion:
    "pm.public-eval-corners.sentinel-production-run-invocation.v1";
  readonly preregistrationPath: string;
  readonly signaturePath: string;
  readonly trustAnchorPath: string;
  readonly externalCommitmentPath: string;
  readonly runtimePathsPath: string;
  readonly checkouts: SentinelProductionCheckoutSet;
  readonly batchRoot: string;
  readonly attemptRegistryRoot: string;
}

interface SentinelProductionRunEnvironment {
  readonly PM_DATABASE_URL?: string;
  readonly ANTHROPIC_API_KEY?: string;
}

export interface SentinelProductionRunCliDependencies {
  readonly environment: SentinelProductionRunEnvironment;
  readonly readJsonFile: (
    path: string,
    maximumBytes: number,
    label: string,
  ) => SentinelSafeJsonFile;
  readonly runBatch: (input: SentinelProductionRunInput) => Promise<unknown>;
}

export function redactSentinelProductionRunError(
  error: unknown,
  environment: SentinelProductionRunEnvironment,
): string {
  return redactSentinelDiagnosticError(error, [
    environment.PM_DATABASE_URL,
    environment.ANTHROPIC_API_KEY,
  ]);
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
    substrate: sentinelDiagnosticCanonicalAbsolutePath(
      record.substrate,
      "substrate checkout",
    ),
  };
}

function parseTrustAnchor(value: unknown): SentinelExternalTrustAnchor {
  exactKeys(value, [
    "expectedAuthorityId",
    "expectedAuthorityPublicKeySha256",
    "expectedPreregistrationSha256",
  ], "trust anchor");
  const record = value as Record<string, unknown>;
  if (
    typeof record.expectedAuthorityId !== "string" || !ID.test(record.expectedAuthorityId) ||
    typeof record.expectedAuthorityPublicKeySha256 !== "string" ||
      !SHA256.test(record.expectedAuthorityPublicKeySha256) ||
    typeof record.expectedPreregistrationSha256 !== "string" ||
      !SHA256.test(record.expectedPreregistrationSha256)
  ) throw new Error("trust anchor values are invalid");
  return record as unknown as SentinelExternalTrustAnchor;
}

export function parseSentinelProductionRunInvocation(
  value: unknown,
): SentinelProductionRunInvocation {
  exactKeys(value, [
    "attemptRegistryRoot",
    "batchRoot",
    "checkouts",
    "externalCommitmentPath",
    "preregistrationPath",
    "runtimePathsPath",
    "schemaVersion",
    "signaturePath",
    "trustAnchorPath",
  ], "production run invocation");
  const record = value as Record<string, unknown>;
  if (
    record.schemaVersion !==
      "pm.public-eval-corners.sentinel-production-run-invocation.v1"
  ) throw new Error("unsupported production run invocation schemaVersion");
  return {
    schemaVersion: "pm.public-eval-corners.sentinel-production-run-invocation.v1",
    preregistrationPath: sentinelDiagnosticCanonicalAbsolutePath(
      record.preregistrationPath,
      "preregistrationPath",
    ),
    signaturePath: sentinelDiagnosticCanonicalAbsolutePath(
      record.signaturePath,
      "signaturePath",
    ),
    trustAnchorPath: sentinelDiagnosticCanonicalAbsolutePath(
      record.trustAnchorPath,
      "trustAnchorPath",
    ),
    externalCommitmentPath: sentinelDiagnosticCanonicalAbsolutePath(
      record.externalCommitmentPath,
      "externalCommitmentPath",
    ),
    runtimePathsPath: sentinelDiagnosticCanonicalAbsolutePath(
      record.runtimePathsPath,
      "runtimePathsPath",
    ),
    checkouts: checkouts(record.checkouts),
    batchRoot: sentinelDiagnosticCanonicalAbsolutePath(record.batchRoot, "batchRoot"),
    attemptRegistryRoot: sentinelDiagnosticCanonicalAbsolutePath(
      record.attemptRegistryRoot,
      "attemptRegistryRoot",
    ),
  };
}

export async function executeSentinelProductionRunInvocation(
  invocation: SentinelProductionRunInvocation,
  dependencies: SentinelProductionRunCliDependencies = {
    environment: process.env,
    readJsonFile: readSentinelDiagnosticJsonFile,
    runBatch: runSentinelProductionBatch,
  },
): Promise<unknown> {
  const databaseUrl = dependencies.environment.PM_DATABASE_URL;
  const anthropicApiKey = dependencies.environment.ANTHROPIC_API_KEY;
  if (databaseUrl === undefined || databaseUrl.length === 0) {
    throw new Error("PM_DATABASE_URL is required");
  }
  if (anthropicApiKey === undefined || anthropicApiKey.length === 0) {
    throw new Error("ANTHROPIC_API_KEY is required");
  }

  const preregistration = dependencies.readJsonFile(
    invocation.preregistrationPath,
    SENTINEL_DIAGNOSTIC_PREREGISTRATION_MAX_BYTES,
    "preregistration",
  );
  const signature = dependencies.readJsonFile(
    invocation.signaturePath,
    SENTINEL_PRODUCTION_REFERENCE_MAX_BYTES,
    "signature",
  );
  const trustAnchor = dependencies.readJsonFile(
    invocation.trustAnchorPath,
    SENTINEL_PRODUCTION_REFERENCE_MAX_BYTES,
    "trust anchor",
  );
  const externalCommitment = dependencies.readJsonFile(
    invocation.externalCommitmentPath,
    SENTINEL_PRODUCTION_REFERENCE_MAX_BYTES,
    "external commitment",
  );
  const runtimePaths = dependencies.readJsonFile(
    invocation.runtimePathsPath,
    SENTINEL_DIAGNOSTIC_RUNTIME_PATHS_MAX_BYTES,
    "runtime paths",
  );

  const input: SentinelProductionRunInput = {
    preregistration: preregistration.value as SentinelProductionPreregistration,
    signature: signature.value as SentinelProductionSignature,
    trustAnchor: parseTrustAnchor(trustAnchor.value),
    externalCommitment:
      externalCommitment.value as SentinelProductionExternalCommitment,
    runtime: { paths: parseSentinelRuntimeClosurePaths(runtimePaths.value) },
    checkouts: invocation.checkouts,
    batchRoot: invocation.batchRoot,
    attemptRegistryRoot: invocation.attemptRegistryRoot,
    databaseUrl,
    anthropicApiKey,
  };
  return await dependencies.runBatch(input);
}

async function main(): Promise<void> {
  if (process.argv.length !== 3) {
    throw new Error(
      "usage: pm-sentinel-production-run /absolute/path/to/invocation.json",
    );
  }
  const invocationPath = sentinelDiagnosticCanonicalAbsolutePath(
    process.argv[2],
    "invocation path",
  );
  const invocationFile = readSentinelDiagnosticJsonFile(
    invocationPath,
    SENTINEL_DIAGNOSTIC_INVOCATION_MAX_BYTES,
    "production run invocation",
  );
  const invocation = parseSentinelProductionRunInvocation(invocationFile.value);
  process.stdout.write(
    `${JSON.stringify(await executeSentinelProductionRunInvocation(invocation), null, 2)}\n`,
  );
}

const direct = process.argv[1] !== undefined &&
  pathToFileURL(realpathSync(resolve(process.argv[1]))).href ===
    pathToFileURL(fileURLToPath(import.meta.url)).href;
if (direct) {
  void main().catch((error: unknown) => {
    process.stderr.write(
      `sentinel production run failed: ${redactSentinelProductionRunError(
        error,
        process.env,
      )}\n`,
    );
    process.exitCode = 1;
  });
}
