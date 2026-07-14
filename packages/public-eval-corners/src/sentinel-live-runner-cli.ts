#!/usr/bin/env node

import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  resolve,
  writeFileSync,
} from "node:fs";

import {
  createSignedSentinelLivePreregistration,
  runSentinelLiveBatch,
  verifyContentAddressedSentinelManifest,
  verifySentinelLiveRunInputs,
  type SentinelLivePreregistrationInput,
  type SentinelLiveRunInput,
  type SentinelLiveRuntimePaths,
} from "./sentinel-live-runner.js";
import type {
  SentinelLivePreregistration,
  SentinelPreregistrationSignature,
} from "./sentinel-live-plan.js";

type JsonRecord = Record<string, unknown>;

interface RunRequest {
  readonly preregistrationPath: string;
  readonly signaturePath: string;
  readonly expectedPreregistrationSha256Path: string;
  readonly checkoutPath: string;
  readonly batchRoot: string;
  readonly attemptRegistryRoot: string;
  readonly runtimePaths: SentinelLiveRuntimePaths;
  readonly startupTimeoutMs?: number;
  readonly attemptTimeoutMs?: number;
  readonly shutdownGraceMs?: number;
}

interface VerifyRequest {
  readonly preregistrationPath: string;
  readonly signaturePath: string;
  readonly expectedPreregistrationSha256Path: string;
  readonly checkoutPath: string;
  readonly runtimePaths: SentinelLiveRuntimePaths;
  readonly contentAddressedManifestPath?: string;
}

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function option(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index < 0 ? undefined : process.argv[index + 1];
  if (value === undefined || value.length === 0) throw new Error(`${name} is required`);
  return value;
}

function readJson(path: string): unknown {
  const resolvedPath = resolve(path);
  const stat = lstatSync(resolvedPath);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`${path} must be a regular file`);
  return JSON.parse(readFileSync(resolvedPath, "utf8")) as unknown;
}

function requiredString(record: JsonRecord, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0) throw new Error(`${key} is required`);
  return value;
}

function readExpectedHash(path: string): string {
  const value = readFileSync(resolve(path), "utf8").trim();
  if (!/^[a-f0-9]{64}$/u.test(value)) throw new Error("expected preregistration hash is invalid");
  return value;
}

function runtimePaths(value: unknown): SentinelLiveRuntimePaths {
  if (!isRecord(value)) throw new Error("runtimePaths must be an object");
  return {
    repositoryRoot: requiredString(value, "repositoryRoot"),
    packageLockPath: requiredString(value, "packageLockPath"),
    runnerScriptPath: requiredString(value, "runnerScriptPath"),
    supervisorScriptPath: requiredString(value, "supervisorScriptPath"),
    verifierScriptPath: requiredString(value, "verifierScriptPath"),
    agentScriptPath: requiredString(value, "agentScriptPath"),
    sidecarScriptPath: requiredString(value, "sidecarScriptPath"),
    providerProxyScriptPath: requiredString(value, "providerProxyScriptPath"),
    playwrightPackageJsonPath: requiredString(value, "playwrightPackageJsonPath"),
    nodeExecutablePath: requiredString(value, "nodeExecutablePath"),
    pythonExecutablePath: requiredString(value, "pythonExecutablePath"),
    frontendExecutablePath: requiredString(value, "frontendExecutablePath"),
  };
}

function optionalInteger(record: JsonRecord, key: string): number | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (!Number.isSafeInteger(value)) throw new Error(`${key} must be an integer`);
  return value as number;
}

function parsePreregisterRequest(value: unknown): SentinelLivePreregistrationInput {
  if (!isRecord(value)) throw new Error("preregister input must be an object");
  return {
    registrationId: requiredString(value, "registrationId"),
    ...(typeof value.registeredAt === "string" ? { registeredAt: value.registeredAt } : {}),
    randomizationSeed: requiredString(value, "randomizationSeed"),
    pricingAccessedAt: requiredString(value, "pricingAccessedAt"),
    checkoutPath: requiredString(value, "checkoutPath"),
    runtimePaths: runtimePaths(value.runtimePaths),
    ...(optionalInteger(value, "pollIntervalMs") === undefined
      ? {}
      : { pollIntervalMs: optionalInteger(value, "pollIntervalMs") }),
    ...(optionalInteger(value, "maxCompletionTokens") === undefined
      ? {}
      : { maxCompletionTokens: optionalInteger(value, "maxCompletionTokens") }),
  };
}

function parseRunRequest(value: unknown): RunRequest {
  if (!isRecord(value)) throw new Error("run input must be an object");
  return {
    preregistrationPath: requiredString(value, "preregistrationPath"),
    signaturePath: requiredString(value, "signaturePath"),
    expectedPreregistrationSha256Path: requiredString(
      value,
      "expectedPreregistrationSha256Path",
    ),
    checkoutPath: requiredString(value, "checkoutPath"),
    batchRoot: requiredString(value, "batchRoot"),
    attemptRegistryRoot: requiredString(value, "attemptRegistryRoot"),
    runtimePaths: runtimePaths(value.runtimePaths),
    ...(optionalInteger(value, "startupTimeoutMs") === undefined
      ? {}
      : { startupTimeoutMs: optionalInteger(value, "startupTimeoutMs") }),
    ...(optionalInteger(value, "attemptTimeoutMs") === undefined
      ? {}
      : { attemptTimeoutMs: optionalInteger(value, "attemptTimeoutMs") }),
    ...(optionalInteger(value, "shutdownGraceMs") === undefined
      ? {}
      : { shutdownGraceMs: optionalInteger(value, "shutdownGraceMs") }),
  };
}

function parseVerifyRequest(value: unknown): VerifyRequest {
  if (!isRecord(value)) throw new Error("verify input must be an object");
  return {
    preregistrationPath: requiredString(value, "preregistrationPath"),
    signaturePath: requiredString(value, "signaturePath"),
    expectedPreregistrationSha256Path: requiredString(
      value,
      "expectedPreregistrationSha256Path",
    ),
    checkoutPath: requiredString(value, "checkoutPath"),
    runtimePaths: runtimePaths(value.runtimePaths),
    ...(typeof value.contentAddressedManifestPath === "string"
      ? { contentAddressedManifestPath: value.contentAddressedManifestPath }
      : {}),
  };
}

function writeExclusive(path: string, value: string): void {
  writeFileSync(path, value, { flag: "wx", mode: 0o400 });
  chmodSync(path, 0o400);
}

async function preregister(): Promise<void> {
  const request = parsePreregisterRequest(readJson(option("--input")));
  const outputDirectory = resolve(option("--output-dir"));
  if (existsSync(outputDirectory)) throw new Error("--output-dir must be fresh");
  const signed = createSignedSentinelLivePreregistration(request);
  mkdirSync(outputDirectory, { recursive: false, mode: 0o700 });
  writeExclusive(
    resolve(outputDirectory, "sentinel-live-preregistration.json"),
    `${JSON.stringify(signed.preregistration, null, 2)}\n`,
  );
  writeExclusive(
    resolve(outputDirectory, "sentinel-live-preregistration-signature.json"),
    `${JSON.stringify(signed.signature, null, 2)}\n`,
  );
  writeExclusive(
    resolve(outputDirectory, "sentinel-live-preregistration.sha256"),
    `${signed.expectedPreregistrationSha256}\n`,
  );
  process.stdout.write(`${JSON.stringify({
    outputDirectory,
    expectedPreregistrationSha256: signed.expectedPreregistrationSha256,
    privateKeyPersisted: false,
  }, null, 2)}\n`);
}

async function run(): Promise<void> {
  const request = parseRunRequest(readJson(option("--input")));
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicApiKey === undefined) throw new Error("ANTHROPIC_API_KEY is required");
  const runInput: SentinelLiveRunInput = {
    preregistration: readJson(request.preregistrationPath) as SentinelLivePreregistration,
    signature: readJson(request.signaturePath) as SentinelPreregistrationSignature,
    expectedPreregistrationSha256: readExpectedHash(
      request.expectedPreregistrationSha256Path,
    ),
    checkoutPath: request.checkoutPath,
    batchRoot: request.batchRoot,
    attemptRegistryRoot: request.attemptRegistryRoot,
    runtimePaths: request.runtimePaths,
    anthropicApiKey,
    ...(request.startupTimeoutMs === undefined
      ? {}
      : { startupTimeoutMs: request.startupTimeoutMs }),
    ...(request.attemptTimeoutMs === undefined
      ? {}
      : { attemptTimeoutMs: request.attemptTimeoutMs }),
    ...(request.shutdownGraceMs === undefined
      ? {}
      : { shutdownGraceMs: request.shutdownGraceMs }),
  };
  const result = await runSentinelLiveBatch(runInput);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

async function verify(): Promise<void> {
  const request = parseVerifyRequest(readJson(option("--input")));
  const verification = verifySentinelLiveRunInputs({
    preregistration: readJson(request.preregistrationPath) as SentinelLivePreregistration,
    signature: readJson(request.signaturePath) as SentinelPreregistrationSignature,
    expectedPreregistrationSha256: readExpectedHash(
      request.expectedPreregistrationSha256Path,
    ),
    checkoutPath: request.checkoutPath,
    runtimePaths: request.runtimePaths,
  });
  const manifest =
    request.contentAddressedManifestPath === undefined
      ? null
      : verifyContentAddressedSentinelManifest(request.contentAddressedManifestPath);
  const valid = verification.valid && (manifest?.valid ?? true);
  process.stdout.write(`${JSON.stringify({
    valid,
    preregistrationSha256: verification.preregistrationSha256,
    cellCount: verification.cells.length,
    issues: [...verification.issues, ...(manifest?.issues ?? [])],
    contentAddressedManifest: manifest,
  }, null, 2)}\n`);
  if (!valid) process.exitCode = 1;
}

async function main(): Promise<void> {
  const command = process.argv[2];
  if (command === "preregister") return preregister();
  if (command === "run") return run();
  if (command === "verify") return verify();
  throw new Error(
    "usage: sentinel-live-runner-cli <preregister|run|verify> --input <file> [--output-dir <dir>]",
  );
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
