#!/usr/bin/env node
import { randomBytes } from "node:crypto";
import {
  chmodSync,
  existsSync,
  linkSync,
  lstatSync,
  mkdirSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  SENTINEL_GENERAL_ANTHROPIC_ACTION_SCHEMA_SHA256,
  SENTINEL_GENERAL_ANTHROPIC_SYSTEM_PROMPT_SHA256,
} from "./sentinel-general-provider-proxy.js";
import {
  buildSentinelProductionSchedule,
  createSentinelProductionPreregistration,
  sentinelProductionJsonSha256,
  sentinelProductionSha256,
  type SentinelProductionPreregistration,
} from "./sentinel-production-plan.js";
import {
  assertSentinelDiagnosticGitRevision,
  parseSentinelProductionLocalDiagnosticInvocation,
  parseSentinelProductionLocalDiagnosticPrepareInvocation,
  readSentinelDiagnosticJsonFile,
  redactSentinelDiagnosticError,
  sentinelDiagnosticCanonicalAbsolutePath,
  SENTINEL_DIAGNOSTIC_INVOCATION_MAX_BYTES,
  SENTINEL_DIAGNOSTIC_PREREGISTRATION_MAX_BYTES,
  SENTINEL_DIAGNOSTIC_RUNTIME_PATHS_MAX_BYTES,
  type SentinelProductionLocalDiagnosticInvocation,
  type SentinelProductionLocalDiagnosticPrepareInvocation,
} from "./sentinel-production-excluded-smoke-contracts.js";
import {
  runSentinelProductionExcludedSmoke,
  type SentinelProductionDiagnosticResult,
  type SentinelProductionDiagnosticRunInput,
} from "./sentinel-production-runner.js";
import {
  deriveSentinelRuntimeClosure,
  type SentinelRuntimeClosureDerivation,
  type SentinelRuntimeClosurePaths,
} from "./sentinel-runtime-closure.js";

interface SentinelProductionLocalDiagnosticPrepareResult {
  readonly schemaVersion:
    "pm.public-eval-corners.sentinel-production-local-diagnostic-prepare-result.v1";
  readonly trustMode: "local-untrusted-diagnostic";
  readonly independent: false;
  readonly batchComplete: false;
  readonly evidenceEligible: false;
  readonly analysisEligible: false;
  readonly materialBenefit: false;
  readonly outputRoot: string;
  readonly preregistrationPath: string;
  readonly preregistrationSha256: string;
  readonly scheduleSha256: string;
  readonly runtimePathsSha256: string;
  readonly runtimeDerivationSha256: string;
  readonly invocationPath: string;
  readonly invocationSha256: string;
  readonly preparationManifestPath: string;
  readonly preparationManifestSha256: string;
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function writeExclusiveJson(path: string, value: unknown): Buffer {
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  writeFileSync(path, bytes, { flag: "wx", mode: 0o400 });
  chmodSync(path, 0o400);
  return bytes;
}

function contains(parent: string, child: string): boolean {
  const candidate = relative(parent, child);
  return candidate === "" ||
    (candidate !== ".." && !candidate.startsWith("../") && !isAbsolute(candidate));
}

function assertAtomicPosixOutputRoot(
  outputRoot: string,
  checkouts: SentinelProductionLocalDiagnosticPrepareInvocation["checkouts"],
  executionRoots: readonly string[],
): string {
  if (existsSync(outputRoot)) throw new Error("prepare outputRoot must be fresh");
  const parent = dirname(outputRoot);
  if (realpathSync(parent) !== parent) {
    throw new Error("prepare outputRoot parent must be canonical and non-symlinked");
  }
  const stat = lstatSync(parent);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error("prepare outputRoot parent must be a regular directory");
  }
  for (const [arm, checkout] of Object.entries(checkouts)) {
    const checkoutReal = realpathSync(checkout);
    const checkoutStat = lstatSync(checkout);
    if (
      checkoutReal !== checkout ||
      !checkoutStat.isDirectory() ||
      checkoutStat.isSymbolicLink()
    ) throw new Error(`${arm} prepare checkout must be a canonical regular directory`);
    if (contains(checkoutReal, outputRoot) || contains(outputRoot, checkoutReal)) {
      throw new Error("prepare outputRoot overlaps a benchmark checkout");
    }
  }
  if (executionRoots.some((root) => contains(root, outputRoot) || contains(outputRoot, root))) {
    throw new Error("prepare outputRoot overlaps a diagnostic execution root");
  }
  const probe = resolve(parent, `.pm-sentinel-prepare-posix-${randomBytes(12).toString("hex")}`);
  const file = resolve(probe, "mode-probe");
  const link = resolve(probe, "hard-link-probe");
  try {
    mkdirSync(probe, { mode: 0o700 });
    chmodSync(probe, 0o700);
    writeFileSync(file, "posix\n", { flag: "wx", mode: 0o600 });
    chmodSync(file, 0o400);
    linkSync(file, link);
    const fileStat = lstatSync(file);
    if (
      (lstatSync(probe).mode & 0o777) !== 0o700 ||
      (fileStat.mode & 0o777) !== 0o400 ||
      fileStat.nlink < 2 ||
      lstatSync(link).ino !== fileStat.ino
    ) throw new Error("mode or hard-link semantics are unavailable");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`prepare outputRoot parent lacks required POSIX semantics: ${message}`);
  } finally {
    try {
      chmodSync(probe, 0o700);
      if (existsSync(file)) chmodSync(file, 0o600);
      if (existsSync(link)) chmodSync(link, 0o600);
      rmSync(probe, { recursive: true, force: true });
    } catch {
      // Any cleanup residue remains visible at the caller-selected output parent.
    }
  }
  return parent;
}

function exactSelectedBlock(
  plan: SentinelProductionPreregistration,
  taskId: string,
  repeatId: string,
): SentinelProductionLocalDiagnosticInvocation["selectedBlock"] {
  const schedule = buildSentinelProductionSchedule(plan);
  const candidates = Array.from({ length: schedule.length / 4 }, (_, index) => ({
    blockSequence: index + 1,
    cells: schedule.slice(index * 4, index * 4 + 4),
  })).filter(({ cells }) => cells[0]?.taskId === taskId && cells[0]?.repeatId === repeatId);
  const selected = candidates[0];
  if (
    candidates.length !== 1 ||
    selected === undefined ||
    selected.cells.length !== 4 ||
    selected.cells[0]?.taskRole !== "state-retention-relative"
  ) throw new Error("prepare selection is not one exact qualification state-retention block");
  return {
    blockSequence: selected.blockSequence,
    taskId,
    repeatId,
    cellIds: selected.cells.map(({ cellId }) => cellId) as [string, string, string, string],
  };
}

export function prepareSentinelProductionLocalDiagnostic(
  invocation: SentinelProductionLocalDiagnosticPrepareInvocation,
  runtimePaths: SentinelRuntimeClosurePaths,
  dependencies: {
    readonly deriveRuntimeClosure: (
      paths: SentinelRuntimeClosurePaths,
    ) => SentinelRuntimeClosureDerivation;
  } = { deriveRuntimeClosure: deriveSentinelRuntimeClosure },
): SentinelProductionLocalDiagnosticPrepareResult {
  const parent = assertAtomicPosixOutputRoot(invocation.outputRoot, invocation.checkouts, [
    invocation.batchRoot,
    invocation.attemptRegistryRoot,
  ]);
  const derivation = dependencies.deriveRuntimeClosure(runtimePaths);
  assertSentinelDiagnosticGitRevision(derivation.closure.substrateRevision);
  const plan = createSentinelProductionPreregistration({
    registrationId: invocation.registration.registrationId,
    registeredAt: invocation.registration.registeredAt,
    producerId: invocation.registration.producerId,
    selectedPhase: "qualification",
    repeatIds: invocation.registration.repeatIds,
    randomizationSeed: invocation.registration.randomizationSeed,
    systemPromptSha256: SENTINEL_GENERAL_ANTHROPIC_SYSTEM_PROMPT_SHA256,
    actionSchemaSha256: SENTINEL_GENERAL_ANTHROPIC_ACTION_SCHEMA_SHA256,
    runtime: derivation.closure,
    bootstrapSeed: invocation.registration.bootstrapSeed,
    rawBatchVerifierId: invocation.registration.rawBatchVerifierId,
    rawBatchVerifierRevision: derivation.closure.substrateRevision,
    rawBatchVerifierSha256: derivation.closure.verifierScriptSha256,
  });
  const schedule = buildSentinelProductionSchedule(plan);
  const preregistrationSha256 = sentinelProductionJsonSha256(plan);
  const scheduleSha256 = sentinelProductionJsonSha256(schedule);
  const selectedBlock = exactSelectedBlock(
    plan,
    invocation.selectedTaskId,
    invocation.selectedRepeatId,
  );
  const temporaryRoot = resolve(
    parent,
    `.pm-sentinel-diagnostic-prepare-${randomBytes(16).toString("hex")}`,
  );
  const preregistrationPath = resolve(invocation.outputRoot, "preregistration.json");
  const runtimePathsPath = resolve(invocation.outputRoot, "runtime-paths.json");
  const invocationPath = resolve(invocation.outputRoot, "invocation.json");
  const preparationManifestPath = resolve(invocation.outputRoot, "preparation-manifest.json");
  try {
    mkdirSync(temporaryRoot, { mode: 0o700 });
    const runtimePathsBytes = Buffer.from(`${JSON.stringify(runtimePaths, null, 2)}\n`);
    const runtimePathsSha256 = sentinelProductionSha256(runtimePathsBytes);
    const runInvocation: SentinelProductionLocalDiagnosticInvocation = {
      schemaVersion:
        "pm.public-eval-corners.sentinel-production-local-diagnostic-invocation.v1",
      trustMode: "local-untrusted-diagnostic",
      independent: false,
      batchComplete: false,
      evidenceEligible: false,
      analysisEligible: false,
      materialBenefit: false,
      preregistrationPath,
      expectedPreregistrationSha256: preregistrationSha256,
      runtimePathsPath,
      runtimePathsSha256,
      expectedScheduleSha256: scheduleSha256,
      checkouts: invocation.checkouts,
      batchRoot: invocation.batchRoot,
      attemptRegistryRoot: invocation.attemptRegistryRoot,
      selectedBlock,
    };
    const invocationSha256 = sentinelProductionJsonSha256(runInvocation);
    writeExclusiveJson(resolve(temporaryRoot, "preregistration.json"), plan);
    writeFileSync(resolve(temporaryRoot, "runtime-paths.json"), runtimePathsBytes, {
      flag: "wx",
      mode: 0o400,
    });
    chmodSync(resolve(temporaryRoot, "runtime-paths.json"), 0o400);
    writeExclusiveJson(resolve(temporaryRoot, "runtime-derivation-artifacts.json"), derivation.artifacts);
    writeExclusiveJson(resolve(temporaryRoot, "invocation.json"), runInvocation);
    const preparationManifest = {
      schemaVersion:
        "pm.public-eval-corners.sentinel-production-local-diagnostic-preparation-manifest.v1",
      trustMode: "local-untrusted-diagnostic",
      independent: false,
      batchComplete: false,
      evidenceEligible: false,
      analysisEligible: false,
      materialBenefit: false,
      preregistrationSha256,
      scheduleSha256,
      runtimePathsSha256,
      runtimeClosureSha256: derivation.closure.closureSha256,
      runtimeDerivationSha256: derivation.artifacts.derivationSha256,
      runtimeArtifactsSha256: sentinelProductionJsonSha256(derivation.artifacts),
      invocationSha256,
      files: [
        "invocation.json",
        "preregistration.json",
        "runtime-derivation-artifacts.json",
        "runtime-paths.json",
      ].sort(compare),
    };
    const preparationManifestSha256 = sentinelProductionJsonSha256(preparationManifest);
    writeExclusiveJson(resolve(temporaryRoot, "preparation-manifest.json"), preparationManifest);
    chmodSync(temporaryRoot, 0o500);
    renameSync(temporaryRoot, invocation.outputRoot);
    return {
      schemaVersion:
        "pm.public-eval-corners.sentinel-production-local-diagnostic-prepare-result.v1",
      trustMode: "local-untrusted-diagnostic",
      independent: false,
      batchComplete: false,
      evidenceEligible: false,
      analysisEligible: false,
      materialBenefit: false,
      outputRoot: invocation.outputRoot,
      preregistrationPath,
      preregistrationSha256,
      scheduleSha256,
      runtimePathsSha256,
      runtimeDerivationSha256: derivation.artifacts.derivationSha256,
      invocationPath,
      invocationSha256,
      preparationManifestPath,
      preparationManifestSha256,
    };
  } catch (error) {
    try {
      chmodSync(temporaryRoot, 0o700);
      rmSync(temporaryRoot, { recursive: true, force: true });
    } catch {
      // A residue makes an interrupted exclusive preparation visible.
    }
    throw error;
  }
}

async function runPreparedDiagnostic(
  invocation: SentinelProductionLocalDiagnosticInvocation,
): Promise<SentinelProductionDiagnosticResult> {
  const preregistration = readSentinelDiagnosticJsonFile(
    invocation.preregistrationPath,
    SENTINEL_DIAGNOSTIC_PREREGISTRATION_MAX_BYTES,
    "preregistration",
  );
  const runtimePaths = readSentinelDiagnosticJsonFile(
    invocation.runtimePathsPath,
    SENTINEL_DIAGNOSTIC_RUNTIME_PATHS_MAX_BYTES,
    "runtime paths",
  );
  if (runtimePaths.sha256 !== invocation.runtimePathsSha256) {
    throw new Error("runtime paths bytes differ from the prepared invocation hash");
  }
  const databaseUrl = process.env.PM_DATABASE_URL;
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  if (databaseUrl === undefined || databaseUrl.length === 0) {
    throw new Error("PM_DATABASE_URL is required");
  }
  if (anthropicApiKey === undefined || anthropicApiKey.length === 0) {
    throw new Error("ANTHROPIC_API_KEY is required");
  }
  const input: SentinelProductionDiagnosticRunInput = {
    preregistration: preregistration.value as SentinelProductionPreregistration,
    expectedPreregistrationSha256: invocation.expectedPreregistrationSha256,
    expectedScheduleSha256: invocation.expectedScheduleSha256,
    checkouts: invocation.checkouts,
    batchRoot: invocation.batchRoot,
    attemptRegistryRoot: invocation.attemptRegistryRoot,
    runtime: { paths: runtimePaths.value as SentinelRuntimeClosurePaths },
    databaseUrl,
    anthropicApiKey,
  };
  const result = await runSentinelProductionExcludedSmoke(
    input,
    invocation.selectedBlock,
  );
  if (
    result.trustMode !== "local-untrusted-diagnostic" ||
    result.independent !== false ||
    result.batchComplete !== false ||
    result.evidenceEligible !== false ||
    result.analysisEligible !== false ||
    result.materialBenefit !== false
  ) throw new Error("local diagnostic unexpectedly crossed its fail-closed boundary");
  return result;
}

async function main(): Promise<void> {
  if (process.argv.length !== 4 || !["prepare", "run"].includes(process.argv[2] ?? "")) {
    throw new Error(
      "usage: pm-sentinel-production-smoke prepare|run /absolute/path/to/invocation.json",
    );
  }
  const command = process.argv[2];
  const invocationFile = readSentinelDiagnosticJsonFile(
    sentinelDiagnosticCanonicalAbsolutePath(process.argv[3], "invocation path"),
    SENTINEL_DIAGNOSTIC_INVOCATION_MAX_BYTES,
    `${command} invocation`,
  );
  if (command === "prepare") {
    const invocation = parseSentinelProductionLocalDiagnosticPrepareInvocation(
      invocationFile.value,
    );
    const runtimePaths = readSentinelDiagnosticJsonFile(
      invocation.runtimePathsPath,
      SENTINEL_DIAGNOSTIC_RUNTIME_PATHS_MAX_BYTES,
      "runtime paths",
    );
    const result = prepareSentinelProductionLocalDiagnostic(
      invocation,
      runtimePaths.value as SentinelRuntimeClosurePaths,
    );
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  const invocation = parseSentinelProductionLocalDiagnosticInvocation(invocationFile.value);
  process.stdout.write(`${JSON.stringify(await runPreparedDiagnostic(invocation), null, 2)}\n`);
}

const direct = process.argv[1] !== undefined &&
  pathToFileURL(realpathSync(resolve(process.argv[1]))).href ===
    pathToFileURL(fileURLToPath(import.meta.url)).href;
if (direct) {
  void main().catch((error: unknown) => {
    process.stderr.write(
      `sentinel production local diagnostic failed: ${redactSentinelDiagnosticError(
        error,
        [process.env.PM_DATABASE_URL, process.env.ANTHROPIC_API_KEY],
      )}\n`,
    );
    process.exitCode = 1;
  });
}
