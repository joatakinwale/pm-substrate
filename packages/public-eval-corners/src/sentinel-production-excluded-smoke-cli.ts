#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";

import type {
  SentinelExternalTrustAnchor,
  SentinelProductionPreregistration,
  SentinelProductionSignature,
} from "./sentinel-production-plan.js";
import {
  runSentinelProductionExcludedSmoke,
  type SentinelProductionCheckoutSet,
  type SentinelProductionExternalCommitment,
  type SentinelProductionRunInput,
} from "./sentinel-production-runner.js";
import type { SentinelRuntimeClosurePaths } from "./sentinel-runtime-closure.js";

interface ExcludedSmokeInvocation {
  readonly schemaVersion:
    "pm.public-eval-corners.sentinel-production-excluded-smoke-invocation.v1";
  readonly preregistrationPath: string;
  readonly signaturePath: string;
  readonly trustAnchorPath: string;
  readonly externalCommitmentPath: string;
  readonly runtimePathsPath: string;
  readonly checkouts: SentinelProductionCheckoutSet;
  readonly batchRoot: string;
  readonly attemptRegistryRoot: string;
  readonly taskId: string;
  readonly repeatId: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  label: string,
): void {
  const actual = Object.keys(value).sort();
  const required = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(required)) {
    throw new Error(`${label} keys are not exact`);
  }
}

function canonicalAbsolutePath(value: unknown, label: string): string {
  if (typeof value !== "string" || !isAbsolute(value) || resolve(value) !== value) {
    throw new Error(`${label} must be a canonical absolute path`);
  }
  return value;
}

function nonemptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0 || /[\0\r\n]/u.test(value)) {
    throw new Error(`${label} must be a nonempty single-line string`);
  }
  return value;
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

function parseInvocation(value: unknown): ExcludedSmokeInvocation {
  if (!isRecord(value)) throw new Error("excluded-smoke invocation must be an object");
  exactKeys(value, [
    "attemptRegistryRoot",
    "batchRoot",
    "checkouts",
    "externalCommitmentPath",
    "preregistrationPath",
    "repeatId",
    "runtimePathsPath",
    "schemaVersion",
    "signaturePath",
    "taskId",
    "trustAnchorPath",
  ], "excluded-smoke invocation");
  if (
    value.schemaVersion !==
      "pm.public-eval-corners.sentinel-production-excluded-smoke-invocation.v1"
  ) throw new Error("unsupported excluded-smoke invocation schemaVersion");
  if (!isRecord(value.checkouts)) throw new Error("checkouts must be an object");
  exactKeys(value.checkouts, ["native", "plain-kv", "sham", "substrate"], "checkouts");
  const checkouts: SentinelProductionCheckoutSet = {
    native: canonicalAbsolutePath(value.checkouts.native, "native checkout"),
    sham: canonicalAbsolutePath(value.checkouts.sham, "sham checkout"),
    "plain-kv": canonicalAbsolutePath(value.checkouts["plain-kv"], "plain-kv checkout"),
    substrate: canonicalAbsolutePath(value.checkouts.substrate, "substrate checkout"),
  };
  return {
    schemaVersion:
      "pm.public-eval-corners.sentinel-production-excluded-smoke-invocation.v1",
    preregistrationPath: canonicalAbsolutePath(
      value.preregistrationPath,
      "preregistrationPath",
    ),
    signaturePath: canonicalAbsolutePath(value.signaturePath, "signaturePath"),
    trustAnchorPath: canonicalAbsolutePath(value.trustAnchorPath, "trustAnchorPath"),
    externalCommitmentPath: canonicalAbsolutePath(
      value.externalCommitmentPath,
      "externalCommitmentPath",
    ),
    runtimePathsPath: canonicalAbsolutePath(value.runtimePathsPath, "runtimePathsPath"),
    checkouts,
    batchRoot: canonicalAbsolutePath(value.batchRoot, "batchRoot"),
    attemptRegistryRoot: canonicalAbsolutePath(
      value.attemptRegistryRoot,
      "attemptRegistryRoot",
    ),
    taskId: nonemptyString(value.taskId, "taskId"),
    repeatId: nonemptyString(value.repeatId, "repeatId"),
  };
}

async function main(): Promise<void> {
  if (process.argv.length !== 3) {
    throw new Error("usage: pm-sentinel-production-smoke /absolute/path/to/invocation.json");
  }
  const invocationPath = canonicalAbsolutePath(process.argv[2], "invocation path");
  const invocation = parseInvocation(readJson(invocationPath));
  const databaseUrl = process.env.PM_DATABASE_URL;
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  if (databaseUrl === undefined || databaseUrl.length === 0) {
    throw new Error("PM_DATABASE_URL is required");
  }
  if (anthropicApiKey === undefined || anthropicApiKey.length === 0) {
    throw new Error("ANTHROPIC_API_KEY is required");
  }
  const input: SentinelProductionRunInput = {
    preregistration: readJson(
      invocation.preregistrationPath,
    ) as SentinelProductionPreregistration,
    signature: readJson(invocation.signaturePath) as SentinelProductionSignature,
    trustAnchor: readJson(invocation.trustAnchorPath) as SentinelExternalTrustAnchor,
    externalCommitment: readJson(
      invocation.externalCommitmentPath,
    ) as SentinelProductionExternalCommitment,
    checkouts: invocation.checkouts,
    batchRoot: invocation.batchRoot,
    attemptRegistryRoot: invocation.attemptRegistryRoot,
    runtime: {
      paths: readJson(invocation.runtimePathsPath) as SentinelRuntimeClosurePaths,
    },
    databaseUrl,
    anthropicApiKey,
  };
  const result = await runSentinelProductionExcludedSmoke(input, {
    taskId: invocation.taskId,
    repeatId: invocation.repeatId,
  });
  if (result.batchComplete || result.evidenceEligible || result.materialBenefit) {
    throw new Error("excluded smoke unexpectedly crossed its fail-closed evidence boundary");
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`sentinel production excluded smoke failed: ${message}\n`);
  process.exitCode = 1;
});
