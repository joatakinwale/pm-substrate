import { isAbsolute, resolve } from "node:path";

import type { SentinelProductionCheckoutSet } from "./sentinel-production-runner-contracts.js";
import type { SentinelRuntimeClosurePaths } from "./sentinel-runtime-closure.js";

const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/u;
const CONTROL = /[\0\r\n\t]/u;

export const SENTINEL_PRODUCTION_PREPARE_INVOCATION_MAX_BYTES = 128 * 1024;

export const SENTINEL_RUNTIME_PATH_KEYS = [
  "agentScriptPath",
  "browserBundleRootPath",
  "browserExecutablePath",
  "gitExecutablePath",
  "nodeAllowedRootPath",
  "nodeRequestedPath",
  "npmAllowedRootPath",
  "npmRequestedCliPath",
  "playwrightCoreLibraryRootPath",
  "playwrightCorePackageMetadataPath",
  "playwrightLibraryRootPath",
  "playwrightPackageMetadataPath",
  "pnpmWorkspaceLockPath",
  "pnpmWorkspaceManifestPath",
  "providerProxyScriptPath",
  "publicEvalCompiledOutputRootPath",
  "publicEvalPackageJsonPath",
  "publicEvalTsconfigPath",
  "pythonEnvironmentRootPath",
  "pythonExecutableAllowedRootPath",
  "pythonPyvenvConfigPath",
  "pythonRequestedVenvPath",
  "pythonRuntimeRootPath",
  "pythonSitePackagesRootPaths",
  "pythonStdlibRootPath",
  "rootPackageJsonPath",
  "rootTsconfigPath",
  "runnerScriptPath",
  "stateSidecarScriptPath",
  "substrateCheckoutPath",
  "substrateInstalledDependenciesRootPath",
  "substratePackagesRootPath",
  "supervisorScriptPath",
  "tsconfigBasePath",
  "upstreamCheckoutPath",
  "upstreamFrontendInstalledRootPath",
  "upstreamFrontendPackageLockPath",
  "upstreamServerRequirementsPath",
  "verifierScriptPath",
] as const;

export interface SentinelProductionPrepareInvocation {
  readonly schemaVersion:
    "pm.public-eval-corners.sentinel-production-prepare-invocation.v1";
  readonly outputRoot: string;
  readonly runtimePathsPath: string;
  readonly checkouts: SentinelProductionCheckoutSet;
  readonly registration: {
    readonly registrationId: string;
    readonly registeredAt: string;
    readonly producerId: string;
    readonly repeatIds: readonly [string, string, string];
    readonly randomizationSeed: string;
    readonly bootstrapSeed: string;
    readonly rawBatchVerifierId: string;
  };
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

function canonicalAbsolutePath(value: unknown, label: string): string {
  if (
    typeof value !== "string" ||
    CONTROL.test(value) ||
    !isAbsolute(value) ||
    resolve(value) !== value
  ) throw new Error(`${label} must be a canonical absolute path`);
  return value;
}

function opaqueId(value: unknown, label: string): string {
  if (typeof value !== "string" || !ID.test(value)) {
    throw new Error(`${label} must be a canonical opaque ID`);
  }
  return value;
}

function canonicalTimestamp(value: unknown, label: string): string {
  if (typeof value !== "string") throw new Error(`${label} must be a timestamp`);
  const timestamp = new Date(value);
  if (!Number.isFinite(timestamp.valueOf()) || timestamp.toISOString() !== value) {
    throw new Error(`${label} must be a canonical UTC timestamp`);
  }
  return value;
}

function parseCheckouts(value: unknown): SentinelProductionCheckoutSet {
  exactKeys(value, ["native", "plain-kv", "sham", "substrate"], "checkouts");
  const record = value as Record<string, unknown>;
  const parsed: SentinelProductionCheckoutSet = {
    native: canonicalAbsolutePath(record.native, "native checkout"),
    sham: canonicalAbsolutePath(record.sham, "sham checkout"),
    "plain-kv": canonicalAbsolutePath(record["plain-kv"], "plain-kv checkout"),
    substrate: canonicalAbsolutePath(record.substrate, "substrate checkout"),
  };
  if (new Set(Object.values(parsed)).size !== 4) {
    throw new Error("four-arm checkout paths must be distinct");
  }
  return parsed;
}

/** Strictly parses the exact 39-path runtime-closure input surface. */
export function parseSentinelRuntimeClosurePaths(
  value: unknown,
): SentinelRuntimeClosurePaths {
  exactKeys(value, SENTINEL_RUNTIME_PATH_KEYS, "runtime paths");
  const record = value as Record<string, unknown>;
  if (
    !Array.isArray(record.pythonSitePackagesRootPaths) ||
    record.pythonSitePackagesRootPaths.length === 0
  ) throw new Error("pythonSitePackagesRootPaths must be a non-empty array");
  const pythonSitePackagesRootPaths = record.pythonSitePackagesRootPaths.map(
    (entry, index) => canonicalAbsolutePath(
      entry,
      `pythonSitePackagesRootPaths[${index}]`,
    ),
  );
  if (new Set(pythonSitePackagesRootPaths).size !== pythonSitePackagesRootPaths.length) {
    throw new Error("pythonSitePackagesRootPaths must be unique");
  }
  const path = (key: Exclude<typeof SENTINEL_RUNTIME_PATH_KEYS[number], "pythonSitePackagesRootPaths">) =>
    canonicalAbsolutePath(record[key], key);
  return {
    gitExecutablePath: path("gitExecutablePath"),
    substrateCheckoutPath: path("substrateCheckoutPath"),
    rootPackageJsonPath: path("rootPackageJsonPath"),
    pnpmWorkspaceManifestPath: path("pnpmWorkspaceManifestPath"),
    rootTsconfigPath: path("rootTsconfigPath"),
    tsconfigBasePath: path("tsconfigBasePath"),
    publicEvalPackageJsonPath: path("publicEvalPackageJsonPath"),
    publicEvalTsconfigPath: path("publicEvalTsconfigPath"),
    substratePackagesRootPath: path("substratePackagesRootPath"),
    substrateInstalledDependenciesRootPath: path("substrateInstalledDependenciesRootPath"),
    publicEvalCompiledOutputRootPath: path("publicEvalCompiledOutputRootPath"),
    pnpmWorkspaceLockPath: path("pnpmWorkspaceLockPath"),
    runnerScriptPath: path("runnerScriptPath"),
    supervisorScriptPath: path("supervisorScriptPath"),
    verifierScriptPath: path("verifierScriptPath"),
    agentScriptPath: path("agentScriptPath"),
    providerProxyScriptPath: path("providerProxyScriptPath"),
    stateSidecarScriptPath: path("stateSidecarScriptPath"),
    nodeRequestedPath: path("nodeRequestedPath"),
    nodeAllowedRootPath: path("nodeAllowedRootPath"),
    npmRequestedCliPath: path("npmRequestedCliPath"),
    npmAllowedRootPath: path("npmAllowedRootPath"),
    pythonRequestedVenvPath: path("pythonRequestedVenvPath"),
    pythonEnvironmentRootPath: path("pythonEnvironmentRootPath"),
    pythonRuntimeRootPath: path("pythonRuntimeRootPath"),
    pythonStdlibRootPath: path("pythonStdlibRootPath"),
    pythonExecutableAllowedRootPath: path("pythonExecutableAllowedRootPath"),
    pythonPyvenvConfigPath: path("pythonPyvenvConfigPath"),
    pythonSitePackagesRootPaths,
    playwrightPackageMetadataPath: path("playwrightPackageMetadataPath"),
    playwrightCorePackageMetadataPath: path("playwrightCorePackageMetadataPath"),
    playwrightLibraryRootPath: path("playwrightLibraryRootPath"),
    playwrightCoreLibraryRootPath: path("playwrightCoreLibraryRootPath"),
    browserBundleRootPath: path("browserBundleRootPath"),
    browserExecutablePath: path("browserExecutablePath"),
    upstreamCheckoutPath: path("upstreamCheckoutPath"),
    upstreamFrontendPackageLockPath: path("upstreamFrontendPackageLockPath"),
    upstreamFrontendInstalledRootPath: path("upstreamFrontendInstalledRootPath"),
    upstreamServerRequirementsPath: path("upstreamServerRequirementsPath"),
  };
}

export function parseSentinelProductionPrepareInvocation(
  value: unknown,
): SentinelProductionPrepareInvocation {
  exactKeys(
    value,
    ["checkouts", "outputRoot", "registration", "runtimePathsPath", "schemaVersion"],
    "production prepare invocation",
  );
  const record = value as Record<string, unknown>;
  if (
    record.schemaVersion !==
      "pm.public-eval-corners.sentinel-production-prepare-invocation.v1"
  ) throw new Error("unsupported production prepare invocation schemaVersion");
  exactKeys(record.registration, [
    "bootstrapSeed",
    "producerId",
    "randomizationSeed",
    "rawBatchVerifierId",
    "registeredAt",
    "registrationId",
    "repeatIds",
  ], "production prepare registration");
  const registration = record.registration as Record<string, unknown>;
  if (!Array.isArray(registration.repeatIds) || registration.repeatIds.length !== 3) {
    throw new Error("registration.repeatIds must contain exactly three IDs");
  }
  const repeatIds = registration.repeatIds.map((entry, index) =>
    opaqueId(entry, `registration.repeatIds[${index}]`));
  if (new Set(repeatIds).size !== 3) {
    throw new Error("registration.repeatIds must be unique");
  }
  return {
    schemaVersion:
      "pm.public-eval-corners.sentinel-production-prepare-invocation.v1",
    outputRoot: canonicalAbsolutePath(record.outputRoot, "outputRoot"),
    runtimePathsPath: canonicalAbsolutePath(record.runtimePathsPath, "runtimePathsPath"),
    checkouts: parseCheckouts(record.checkouts),
    registration: {
      registrationId: opaqueId(
        registration.registrationId,
        "registration.registrationId",
      ),
      registeredAt: canonicalTimestamp(
        registration.registeredAt,
        "registration.registeredAt",
      ),
      producerId: opaqueId(registration.producerId, "registration.producerId"),
      repeatIds: repeatIds as [string, string, string],
      randomizationSeed: opaqueId(
        registration.randomizationSeed,
        "registration.randomizationSeed",
      ),
      bootstrapSeed: opaqueId(
        registration.bootstrapSeed,
        "registration.bootstrapSeed",
      ),
      rawBatchVerifierId: opaqueId(
        registration.rawBatchVerifierId,
        "registration.rawBatchVerifierId",
      ),
    },
  };
}
