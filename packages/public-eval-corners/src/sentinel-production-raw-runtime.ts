import { createHash } from "node:crypto";
import {
  isAbsolute,
  normalize,
  relative,
  resolve,
  sep,
} from "node:path";

import {
  type SentinelRuntimeClosure,
} from "./sentinel-production-plan.js";
import type {
  SentinelProductionRuntimeInspectionReference,
} from "./sentinel-production-runner-evidence.js";
import type {
  SentinelRuntimeClosureArtifacts,
  SentinelRuntimeClosurePaths,
} from "./sentinel-runtime-closure.js";
import {
  SENTINEL_RAW_SHA256,
  sentinelRawCanonical,
  sentinelRawCanonicalTimestamp,
  sentinelRawCompare,
  sentinelRawContainedPath,
  sentinelRawExactKeys,
  sentinelRawIsRecord,
  sentinelRawJsonFile,
  sentinelRawJsonSha256,
  sentinelRawRegularFile,
  sentinelRawSha256,
} from "./sentinel-production-raw-utils.js";

export interface SentinelRawRuntimeBoundary {
  readonly valid: boolean;
  readonly issues: readonly string[];
  readonly boundary: "initial" | "before" | "after" | null;
  readonly blockSequence: number | null;
  readonly inspectedAt: string | null;
  readonly receiptSha256: string | null;
  readonly derivationSha256: string | null;
  readonly executableIdentitySha256: string | null;
  readonly previousReceiptSha256: string | null;
  readonly exactSupervisorPaths: {
    readonly nodeExecutablePath: string;
    readonly npmCliPath: string;
    readonly pythonExecutablePath: string;
    readonly agentScriptPath: string;
  } | null;
}

function issueOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function canonicalBase64(value: unknown, label: string): Buffer {
  if (typeof value !== "string" || value.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/u.test(value)) {
    throw new Error(`${label} is not canonical base64`);
  }
  const bytes = Buffer.from(value, "base64");
  if (bytes.toString("base64") !== value) throw new Error(`${label} is not canonical base64`);
  return bytes;
}

interface ParsedCommandArtifact {
  readonly executablePath: string;
  readonly arguments: readonly string[];
  readonly cwd: string;
  readonly environment: Readonly<Record<string, string>>;
  readonly stdout: Buffer;
  readonly stderr: Buffer;
}

function commandArtifact(value: unknown, label: string): ParsedCommandArtifact {
  sentinelRawExactKeys(value, [
    "arguments", "cwd", "environment", "executablePath", "exitCode", "signal", "stderrBase64", "stderrSha256",
    "stdoutBase64", "stdoutSha256",
  ], label);
  if (
    typeof value.executablePath !== "string" || !value.executablePath.startsWith("/") ||
    !Array.isArray(value.arguments) || !value.arguments.every((entry) => typeof entry === "string") ||
    typeof value.cwd !== "string" || !value.cwd.startsWith("/") || !sentinelRawIsRecord(value.environment) ||
    Object.values(value.environment).some((entry) => typeof entry !== "string") ||
    value.exitCode !== 0 || value.signal !== null
  ) throw new Error(`${label} invocation or exit is invalid`);
  const stdout = canonicalBase64(value.stdoutBase64, `${label} stdout`);
  const stderr = canonicalBase64(value.stderrBase64, `${label} stderr`);
  if (sentinelRawSha256(stdout) !== value.stdoutSha256 || sentinelRawSha256(stderr) !== value.stderrSha256) {
    throw new Error(`${label} output hashes differ from retained bytes`);
  }
  return {
    executablePath: value.executablePath,
    arguments: value.arguments as readonly string[],
    cwd: value.cwd,
    environment: value.environment as Readonly<Record<string, string>>,
    stdout,
    stderr,
  };
}

function fileArtifact(value: unknown, label: string): void {
  sentinelRawExactKeys(value, ["mode", "path", "sha256", "size"], label);
  if (
    typeof value.path !== "string" || !value.path.startsWith("/") ||
    typeof value.mode !== "string" || !/^[0-7]{4}$/u.test(value.mode) ||
    typeof value.sha256 !== "string" || !SENTINEL_RAW_SHA256.test(value.sha256) ||
    !Number.isSafeInteger(value.size) || Number(value.size) < 0
  ) throw new Error(`${label} identity is invalid`);
}

function runtimeEntryArtifact(
  value: unknown,
  expected: {
    readonly requestedPath: string;
    readonly requestedEntrySha256: string;
    readonly resolvedPath: string;
    readonly resolvedSha256: string;
  },
  label: string,
): void {
  sentinelRawExactKeys(value, ["requestedEntrySha256", "requestedPath", "resolvedPath", "resolvedSha256"], label);
  if (
    value.requestedPath !== expected.requestedPath || value.requestedEntrySha256 !== expected.requestedEntrySha256 ||
    value.resolvedPath !== expected.resolvedPath || value.resolvedSha256 !== expected.resolvedSha256
  ) throw new Error(`${label} differs from the signed requested/resolved entry identity`);
}

interface ParsedTreeEntry {
  readonly path: string;
  readonly mode: string;
  readonly type: "directory" | "file" | "symlink";
  readonly sha256: string;
}

interface ParsedTreeArtifact {
  readonly rootPath: string;
  readonly manifest: string;
  readonly manifestSha256: string;
  readonly entryCount: number;
  readonly entries: readonly ParsedTreeEntry[];
  readonly entriesByPath: ReadonlyMap<string, ParsedTreeEntry>;
}

function canonicalAbsolutePath(value: unknown, label: string): string {
  if (
    typeof value !== "string" || !isAbsolute(value) || normalize(value) !== value ||
    /[\0\r\n\t]/u.test(value)
  ) throw new Error(`${label} must be a canonical absolute path without control characters`);
  return value;
}

function safeRelativePathSegments(value: string, label: string): readonly string[] {
  const segments = value.split("/");
  if (
    value.length === 0 || isAbsolute(value) || value.includes("\\") ||
    /[\u0000-\u001f\u007f]/u.test(value) ||
    segments.some((segment) => segment.length === 0 || segment === "." || segment === "..")
  ) throw new Error(`${label} is not a safe canonical relative path`);
  return segments;
}

function treeArtifact(value: unknown, label: string): ParsedTreeArtifact {
  sentinelRawExactKeys(value, ["entryCount", "manifest", "manifestSha256", "rootPath"], label);
  const rootPath = canonicalAbsolutePath(value.rootPath, `${label} root`);
  if (
    typeof value.manifest !== "string" ||
    typeof value.manifestSha256 !== "string" || !SENTINEL_RAW_SHA256.test(value.manifestSha256) ||
    sentinelRawSha256(value.manifest) !== value.manifestSha256 ||
    !Number.isSafeInteger(value.entryCount) || Number(value.entryCount) < 0
  ) throw new Error(`${label} manifest identity is invalid`);
  if (value.manifest !== "" && !value.manifest.endsWith("\n")) {
    throw new Error(`${label} entry count or newline termination is invalid`);
  }
  const lines = value.manifest === "" ? [] : value.manifest.slice(0, -1).split("\n");
  if (lines.length !== value.entryCount || lines.some((line) => line.length === 0)) {
    throw new Error(`${label} entry count or newline termination is invalid`);
  }
  const entries: ParsedTreeEntry[] = [];
  const entriesByPath = new Map<string, ParsedTreeEntry>();
  let previousPath: string | null = null;
  for (const [index, line] of lines.entries()) {
    const fields = line.split("\t");
    const path = fields[0] ?? "";
    const mode = fields[1] ?? "";
    const type = fields[2] ?? "";
    const sha256 = fields[3] ?? "";
    if (
      fields.length !== 4 || !/^[0-7]{4}$/u.test(mode) ||
      !["directory", "file", "symlink"].includes(type) || !SENTINEL_RAW_SHA256.test(sha256)
    ) throw new Error(`${label} line ${index + 1} is malformed`);
    safeRelativePathSegments(path, `${label} line ${index + 1} path`);
    if (previousPath !== null && sentinelRawCompare(previousPath, path) >= 0) {
      throw new Error(`${label} entries are not strictly sorted and unique`);
    }
    if (type === "directory" && sha256 !== sentinelRawSha256("")) {
      throw new Error(`${label} directory entry ${path} has a non-empty digest`);
    }
    const entry: ParsedTreeEntry = {
      path,
      mode,
      type: type as ParsedTreeEntry["type"],
      sha256,
    };
    entries.push(entry);
    entriesByPath.set(path, entry);
    previousPath = path;
  }
  for (const entry of entries) {
    const segments = entry.path.split("/");
    for (let index = 1; index < segments.length; index += 1) {
      const parentPath = segments.slice(0, index).join("/");
      if (entriesByPath.get(parentPath)?.type !== "directory") {
        throw new Error(`${label} entry ${entry.path} lacks directory parent ${parentPath}`);
      }
    }
  }
  return {
    rootPath,
    manifest: value.manifest,
    manifestSha256: value.manifestSha256,
    entryCount: value.entryCount as number,
    entries,
    entriesByPath,
  };
}

interface ParsedGitArtifact {
  readonly checkoutPath: string;
  readonly clean: true;
  readonly commands: readonly unknown[];
  readonly revision: string;
  readonly sourceTreeHash: string;
  readonly ignoredPathListingSha256: string;
}

function gitArtifact(value: unknown, label: string): ParsedGitArtifact {
  sentinelRawExactKeys(value, [
    "checkoutPath", "clean", "commands", "ignoredPathListingSha256", "revision", "sourceTreeHash",
  ], label);
  if (
    typeof value.checkoutPath !== "string" || !value.checkoutPath.startsWith("/") ||
    typeof value.revision !== "string" || !/^[a-f0-9]{40}$/u.test(value.revision) ||
    typeof value.sourceTreeHash !== "string" || !/^[a-f0-9]{40}$/u.test(value.sourceTreeHash) ||
    typeof value.ignoredPathListingSha256 !== "string" || !SENTINEL_RAW_SHA256.test(value.ignoredPathListingSha256) ||
    value.clean !== true || !Array.isArray(value.commands) || value.commands.length === 0
  ) throw new Error(`${label} is invalid`);
  value.commands.forEach((entry, index) => commandArtifact(entry, `${label} command ${index + 1}`));
  return value as unknown as ParsedGitArtifact;
}

const BOUND_PATH_KEYS: readonly (keyof SentinelRuntimeClosurePaths)[] = [
  "agentScriptPath", "browserBundleRootPath", "browserExecutablePath", "gitExecutablePath",
  "nodeAllowedRootPath", "nodeRequestedPath", "npmAllowedRootPath", "npmRequestedCliPath",
  "playwrightCoreLibraryRootPath", "playwrightCorePackageMetadataPath", "playwrightLibraryRootPath",
  "playwrightPackageMetadataPath", "pnpmWorkspaceLockPath", "pnpmWorkspaceManifestPath",
  "providerProxyScriptPath", "publicEvalCompiledOutputRootPath", "publicEvalPackageJsonPath",
  "publicEvalTsconfigPath", "pythonEnvironmentRootPath", "pythonExecutableAllowedRootPath",
  "pythonPyvenvConfigPath", "pythonRequestedVenvPath", "pythonRuntimeRootPath", "pythonSitePackagesRootPaths",
  "pythonStdlibRootPath", "rootPackageJsonPath", "rootTsconfigPath", "runnerScriptPath",
  "stateSidecarScriptPath", "substrateCheckoutPath", "substrateInstalledDependenciesRootPath",
  "substratePackagesRootPath", "supervisorScriptPath", "tsconfigBasePath", "upstreamCheckoutPath",
  "upstreamFrontendInstalledRootPath", "upstreamFrontendPackageLockPath", "upstreamServerRequirementsPath",
  "verifierScriptPath",
];

function parseBoundPaths(value: string): SentinelRuntimeClosurePaths {
  let parsed: unknown;
  try { parsed = JSON.parse(value) as unknown; }
  catch { throw new Error("runtime bound paths manifest is not JSON"); }
  if (sentinelRawCanonical(parsed) !== value) throw new Error("runtime bound paths manifest is not canonical JSON");
  sentinelRawExactKeys(parsed, ["paths", "schemaVersion"], "runtime bound paths manifest");
  if (parsed.schemaVersion !== "pm.public-eval-corners.sentinel-runtime-bound-paths.v1") {
    throw new Error("runtime bound paths manifest schema changed");
  }
  sentinelRawExactKeys(parsed.paths, BOUND_PATH_KEYS, "runtime bound paths");
  for (const [name, path] of Object.entries(parsed.paths)) {
    if (name === "pythonSitePackagesRootPaths") {
      if (!Array.isArray(path) || path.length === 0) {
        throw new Error("runtime Python site-package paths are invalid");
      }
      const siteRoots = path.map((entry, index) =>
        canonicalAbsolutePath(entry, `runtime Python site-package path ${index + 1}`));
      if (new Set(siteRoots).size !== siteRoots.length) {
        throw new Error("runtime Python site-package paths contain duplicates");
      }
    } else {
      canonicalAbsolutePath(path, `runtime bound path ${name}`);
    }
  }
  return parsed.paths as unknown as SentinelRuntimeClosurePaths;
}

function relativeTreeRootPath(rootPath: string, childPath: string, label: string): string {
  const platformRelative = relative(rootPath, childPath);
  if (
    isAbsolute(platformRelative) || platformRelative === ".." ||
    platformRelative.startsWith(`..${sep}`)
  ) throw new Error(`${label} escapes its bound tree root`);
  if (platformRelative === "") return "";
  const relativePath = platformRelative.split(sep).join("/");
  safeRelativePathSegments(relativePath, label);
  return relativePath;
}

function treeEntryLine(entry: ParsedTreeEntry, path = entry.path): string {
  return `${path}\t${entry.mode}\t${entry.type}\t${entry.sha256}\n`;
}

interface ReconstructedSubtree {
  readonly manifest: string;
  readonly entries: readonly ParsedTreeEntry[];
  readonly entriesByPath: ReadonlyMap<string, ParsedTreeEntry>;
}

function reconstructSubtree(
  environmentTree: ParsedTreeArtifact,
  subtreeRootPath: string,
  label: string,
): ReconstructedSubtree {
  const relativeRoot = relativeTreeRootPath(environmentTree.rootPath, subtreeRootPath, label);
  if (relativeRoot !== "" && environmentTree.entriesByPath.get(relativeRoot)?.type !== "directory") {
    throw new Error(`${label} is not a directory in its parent tree`);
  }
  const prefix = relativeRoot === "" ? "" : `${relativeRoot}/`;
  const entries: ParsedTreeEntry[] = [];
  const entriesByPath = new Map<string, ParsedTreeEntry>();
  for (const environmentEntry of environmentTree.entries) {
    if (prefix !== "" && !environmentEntry.path.startsWith(prefix)) continue;
    const path = prefix === "" ? environmentEntry.path : environmentEntry.path.slice(prefix.length);
    if (path.length === 0) continue;
    const entry = { ...environmentEntry, path };
    entries.push(entry);
    entriesByPath.set(path, entry);
  }
  return {
    manifest: entries.map((entry) => treeEntryLine(entry)).join(""),
    entries,
    entriesByPath,
  };
}

function validateContainedTree(
  parentTree: ParsedTreeArtifact,
  childTree: ParsedTreeArtifact,
  label: string,
): void {
  const reconstructed = reconstructSubtree(parentTree, childTree.rootPath, label);
  if (
    reconstructed.manifest !== childTree.manifest ||
    reconstructed.entries.length !== childTree.entryCount ||
    sentinelRawSha256(reconstructed.manifest) !== childTree.manifestSha256
  ) throw new Error(`${label} does not exactly match its retained parent-tree subtree`);
}

function relativeTreeEntryPath(treeRootPath: string, entryPath: string): string | null {
  const platformRelative = relative(treeRootPath, entryPath);
  if (
    isAbsolute(platformRelative) || platformRelative === ".." ||
    platformRelative.startsWith(`..${sep}`)
  ) return null;
  if (platformRelative === "") return "";
  const relativePath = platformRelative.split(sep).join("/");
  safeRelativePathSegments(relativePath, "runtime retained file path");
  return relativePath;
}

function validateFileAgainstContainingTrees(
  value: unknown,
  label: string,
  trees: readonly ParsedTreeArtifact[],
): void {
  sentinelRawExactKeys(value, ["mode", "path", "sha256", "size"], label);
  const path = canonicalAbsolutePath(value.path, `${label} path`);
  for (const tree of trees) {
    const relativePath = relativeTreeEntryPath(tree.rootPath, path);
    if (relativePath === null) continue;
    if (relativePath === "") throw new Error(`${label} aliases retained tree root ${tree.rootPath}`);
    const treeEntry = tree.entriesByPath.get(relativePath);
    if (
      treeEntry?.type !== "file" || treeEntry.mode !== value.mode ||
      treeEntry.sha256 !== value.sha256
    ) throw new Error(`${label} contradicts retained tree ${tree.rootPath}`);
  }
}

function canonicalDistributionName(name: string): string {
  const canonical = name.toLowerCase().replace(/[._-]+/gu, "-");
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/u.test(canonical)) {
    throw new Error(`runtime distribution name ${name} is not canonicalizable`);
  }
  return canonical;
}

function pipFreezeIdentities(value: string): readonly string[] {
  if (
    Buffer.from(value, "utf8").toString("utf8") !== value ||
    value.includes("\0") || value.includes("\r") ||
    (value !== "" && !value.endsWith("\n"))
  ) throw new Error("runtime pip freeze is not canonical UTF-8 with LF newlines");
  const lines = value === "" ? [] : value.slice(0, -1).split("\n");
  if (lines.some((line) => line.length === 0) || new Set(lines).size !== lines.length) {
    throw new Error("runtime pip freeze contains blank or duplicate lines");
  }
  const identities = lines.map((line) => {
    const match = /^([^=]+)==([^=]+)$/u.exec(line);
    if (match === null) throw new Error("runtime pip freeze must use exact name==version identities");
    return `${canonicalDistributionName(match[1] as string)}==${match[2] as string}`;
  }).sort(sentinelRawCompare);
  if (new Set(identities).size !== identities.length) {
    throw new Error("runtime pip freeze contains duplicate canonical identities");
  }
  return identities;
}

interface DistInfoHashPair {
  readonly metadataSha256: string;
  readonly recordSha256: string;
}

function validateInstalledDistributionsManifest(
  value: unknown,
  closure: SentinelRuntimeClosure,
  paths: SentinelRuntimeClosurePaths,
  pipFreeze: string,
  environmentTree: ParsedTreeArtifact,
): void {
  sentinelRawExactKeys(value, [
    "distributions", "environmentRootPath", "schemaVersion", "siteTrees",
  ], "runtime installed-distributions manifest");
  if (
    value.schemaVersion !== closure.python.installedDistributionsManifestSchema ||
    value.environmentRootPath !== closure.python.environmentRootPath ||
    value.environmentRootPath !== paths.pythonEnvironmentRootPath ||
    environmentTree.rootPath !== paths.pythonEnvironmentRootPath ||
    !Array.isArray(value.distributions) || !Array.isArray(value.siteTrees)
  ) throw new Error("runtime installed-distributions manifest identity differs from the signed closure");

  const expectedSiteRoots = [...paths.pythonSitePackagesRootPaths];
  for (const [index, rootPath] of expectedSiteRoots.entries()) {
    canonicalAbsolutePath(rootPath, `runtime Python site-package path ${index + 1}`);
    relativeTreeRootPath(environmentTree.rootPath, rootPath, `runtime Python site-package path ${index + 1}`);
  }
  if (new Set(expectedSiteRoots).size !== expectedSiteRoots.length) {
    throw new Error("runtime Python site-package paths contain duplicates");
  }
  expectedSiteRoots.sort(sentinelRawCompare);
  if (value.siteTrees.length !== expectedSiteRoots.length) {
    throw new Error("runtime installed-distributions site trees do not exactly match bound roots");
  }

  const distInfoHashPairs: DistInfoHashPair[] = [];
  for (const [index, expectedRootPath] of expectedSiteRoots.entries()) {
    const siteTree = value.siteTrees[index];
    sentinelRawExactKeys(siteTree, ["entryCount", "manifestSha256", "rootPath"], `runtime site tree ${index + 1}`);
    const rootPath = canonicalAbsolutePath(siteTree.rootPath, `runtime site tree ${index + 1} root`);
    if (
      rootPath !== expectedRootPath ||
      typeof siteTree.manifestSha256 !== "string" || !SENTINEL_RAW_SHA256.test(siteTree.manifestSha256) ||
      !Number.isSafeInteger(siteTree.entryCount) || Number(siteTree.entryCount) < 0
    ) throw new Error(`runtime site tree ${index + 1} identity is invalid`);
    const reconstructed = reconstructSubtree(environmentTree, rootPath, `runtime site tree ${index + 1}`);
    if (
      siteTree.manifestSha256 !== sentinelRawSha256(reconstructed.manifest) ||
      siteTree.entryCount !== reconstructed.entries.length
    ) throw new Error(`runtime site tree ${index + 1} does not match the Python environment subtree`);

    for (const entry of reconstructed.entries) {
      if (entry.path.includes("/") || !entry.path.endsWith(".dist-info")) continue;
      if (entry.type !== "directory") {
        throw new Error(`runtime site tree ${index + 1} has a non-directory dist-info entry`);
      }
      const metadata = reconstructed.entriesByPath.get(`${entry.path}/METADATA`);
      const record = reconstructed.entriesByPath.get(`${entry.path}/RECORD`);
      if (metadata?.type !== "file" || record?.type !== "file") {
        throw new Error(`runtime site tree ${index + 1} dist-info entry lacks regular METADATA or RECORD files`);
      }
      distInfoHashPairs.push({ metadataSha256: metadata.sha256, recordSha256: record.sha256 });
    }
  }

  if (distInfoHashPairs.length !== value.distributions.length) {
    throw new Error("runtime installed distributions do not exactly cover site-tree dist-info entries");
  }
  const usedDistInfoPairs = new Set<number>();
  const ownedFilePaths = new Set<string>();
  const distributionIdentities: string[] = [];
  let previousCanonicalName: string | null = null;
  for (const [distributionIndex, distribution] of value.distributions.entries()) {
    const label = `runtime installed distribution ${distributionIndex + 1}`;
    sentinelRawExactKeys(distribution, [
      "canonicalName", "files", "metadataSha256", "name", "recordSha256", "version",
    ], label);
    if (
      typeof distribution.name !== "string" || !/^[^\0\r\n]+$/u.test(distribution.name) ||
      typeof distribution.version !== "string" || !/^[^\0\r\n]+$/u.test(distribution.version) ||
      typeof distribution.canonicalName !== "string" ||
      distribution.canonicalName !== canonicalDistributionName(distribution.name) ||
      typeof distribution.metadataSha256 !== "string" || !SENTINEL_RAW_SHA256.test(distribution.metadataSha256) ||
      typeof distribution.recordSha256 !== "string" || !SENTINEL_RAW_SHA256.test(distribution.recordSha256) ||
      !Array.isArray(distribution.files)
    ) throw new Error(`${label} identity is invalid`);
    if (
      previousCanonicalName !== null &&
      sentinelRawCompare(previousCanonicalName, distribution.canonicalName) >= 0
    ) throw new Error("runtime installed distributions are not strictly canonical-name sorted and unique");
    previousCanonicalName = distribution.canonicalName;

    const distInfoPairIndex = distInfoHashPairs.findIndex((pair, index) =>
      !usedDistInfoPairs.has(index) &&
      pair.metadataSha256 === distribution.metadataSha256 &&
      pair.recordSha256 === distribution.recordSha256);
    if (distInfoPairIndex < 0) {
      throw new Error(`${label} metadata or RECORD hash is absent from the bound site trees`);
    }
    usedDistInfoPairs.add(distInfoPairIndex);

    let previousFilePath: string | null = null;
    for (const [fileIndex, file] of distribution.files.entries()) {
      const fileLabel = `${label} file ${fileIndex + 1}`;
      sentinelRawExactKeys(file, [
        "mode", "path", "recordSha256", "recordSize", "sha256", "type",
      ], fileLabel);
      if (typeof file.path !== "string") throw new Error(`${fileLabel} path is invalid`);
      safeRelativePathSegments(file.path, `${fileLabel} path`);
      if (
        file.type !== "file" || typeof file.mode !== "string" || !/^[0-7]{4}$/u.test(file.mode) ||
        typeof file.sha256 !== "string" || !SENTINEL_RAW_SHA256.test(file.sha256) ||
        !(file.recordSha256 === null ||
          (typeof file.recordSha256 === "string" && SENTINEL_RAW_SHA256.test(file.recordSha256))) ||
        !(file.recordSize === null ||
          (Number.isSafeInteger(file.recordSize) && Number(file.recordSize) >= 0)) ||
        (file.recordSha256 !== null && file.recordSha256 !== file.sha256)
      ) throw new Error(`${fileLabel} identity is invalid`);
      if (
        previousFilePath !== null && sentinelRawCompare(previousFilePath, file.path) >= 0
      ) throw new Error(`${label} files are not strictly path-sorted and unique`);
      if (ownedFilePaths.has(file.path)) {
        throw new Error(`runtime installed distributions duplicate owned file ${file.path}`);
      }
      const environmentEntry = environmentTree.entriesByPath.get(file.path);
      if (
        environmentEntry?.type !== "file" || environmentEntry.mode !== file.mode ||
        environmentEntry.sha256 !== file.sha256
      ) throw new Error(`${fileLabel} does not match the Python environment tree`);
      previousFilePath = file.path;
      ownedFilePaths.add(file.path);
    }
    distributionIdentities.push(`${distribution.canonicalName}==${distribution.version}`);
  }

  const freezeIdentities = pipFreezeIdentities(pipFreeze);
  if (
    freezeIdentities.length !== distributionIdentities.length ||
    freezeIdentities.some((identity, index) => identity !== distributionIdentities[index])
  ) throw new Error("runtime pip freeze does not exactly match installed distribution identities");
}

function exactCommand(
  value: unknown,
  expected: {
    readonly executablePath: string;
    readonly arguments: readonly string[];
    readonly cwd: string;
    readonly environment: Readonly<Record<string, string>>;
    readonly stdoutLine?: string;
    readonly stdoutBytes?: string;
  },
  label: string,
): void {
  const command = commandArtifact(value, label);
  if (
    command.executablePath !== expected.executablePath || command.cwd !== expected.cwd ||
    sentinelRawCanonical(command.arguments) !== sentinelRawCanonical(expected.arguments) ||
    sentinelRawCanonical(command.environment) !== sentinelRawCanonical(expected.environment) ||
    command.stderr.byteLength !== 0
  ) throw new Error(`${label} invocation differs from the signed runtime derivation`);
  if (expected.stdoutLine !== undefined && command.stdout.toString("utf8") !== `${expected.stdoutLine}\n`) {
    throw new Error(`${label} output differs from the signed runtime version`);
  }
  if (expected.stdoutBytes !== undefined && command.stdout.toString("utf8") !== expected.stdoutBytes) {
    throw new Error(`${label} output differs from the retained runtime bytes`);
  }
}

function nulDelimitedUtf8(bytes: Buffer, label: string): readonly string[] {
  const text = bytes.toString("utf8");
  if (
    !Buffer.from(text, "utf8").equals(bytes) ||
    (text !== "" && !text.endsWith("\0"))
  ) throw new Error(`${label} is not canonical NUL-delimited UTF-8`);
  const entries = text === "" ? [] : text.slice(0, -1).split("\0");
  if (new Set(entries).size !== entries.length) throw new Error(`${label} contains duplicates`);
  return entries;
}

function safeGitRelativePath(path: string, label: string, allowDirectorySuffix = false): void {
  const segments = path.split("/");
  const checkedSegments = allowDirectorySuffix && path.endsWith("/") ? segments.slice(0, -1) : segments;
  if (
    path.length === 0 || path.startsWith("/") || /[\\\r\n\t]/u.test(path) ||
    checkedSegments.length === 0 ||
    checkedSegments.some((segment) => segment === "" || segment === "." || segment === ".." || segment === ".git")
  ) throw new Error(`${label} contains an unsafe path`);
}

interface RawGitTreeNode {
  readonly blobs: Map<string, { readonly mode: string; readonly sha1: string }>;
  readonly trees: Map<string, RawGitTreeNode>;
}

function rawGitTreeNode(): RawGitTreeNode {
  return { blobs: new Map(), trees: new Map() };
}

function rawGitTreeSha1(node: RawGitTreeNode): string {
  const entries: Array<{
    readonly name: string;
    readonly tree: boolean;
    readonly mode: string;
    readonly sha1: string;
  }> = [];
  for (const [name, blob] of node.blobs) entries.push({ name, tree: false, ...blob });
  for (const [name, tree] of node.trees) {
    entries.push({ name, tree: true, mode: "40000", sha1: rawGitTreeSha1(tree) });
  }
  entries.sort((left, right) => Buffer.compare(
    Buffer.concat([Buffer.from(left.name, "utf8"), Buffer.from([left.tree ? 0x2f : 0])]),
    Buffer.concat([Buffer.from(right.name, "utf8"), Buffer.from([right.tree ? 0x2f : 0])]),
  ));
  const content = Buffer.concat(entries.flatMap(({ mode, name, sha1 }) => [
    Buffer.from(`${mode} ${name}\0`, "utf8"),
    Buffer.from(sha1, "hex"),
  ]));
  return createHash("sha1")
    .update(`tree ${content.byteLength}\0`, "utf8")
    .update(content)
    .digest("hex");
}

function validateRetainedGitTreeListing(bytes: Buffer, label: string): string {
  const entries = nulDelimitedUtf8(bytes, `${label} tracked-tree listing`);
  if (entries.length === 0) throw new Error(`${label} tracked-tree listing is empty`);
  const paths = new Set<string>();
  const root = rawGitTreeNode();
  for (const entry of entries) {
    const match = /^(100644|100755|120000) blob ([a-f0-9]{40})\t(.+)$/u.exec(entry);
    if (match === null) throw new Error(`${label} tracked-tree entry is invalid`);
    const path = match[3] as string;
    safeGitRelativePath(path, `${label} tracked-tree listing`);
    if (paths.has(path)) throw new Error(`${label} tracked-tree path is duplicated`);
    paths.add(path);
    const segments = path.split("/");
    if (segments.some((segment) => segment === "" || segment === "." || segment === ".." || segment === ".git")) {
      throw new Error(`${label} tracked-tree listing contains an unsafe segment`);
    }
    const leaf = segments.pop() as string;
    let node = root;
    for (const segment of segments) {
      if (node.blobs.has(segment)) throw new Error(`${label} tracked-tree path collides`);
      let child = node.trees.get(segment);
      if (child === undefined) {
        child = rawGitTreeNode();
        node.trees.set(segment, child);
      }
      node = child;
    }
    if (node.trees.has(leaf) || node.blobs.has(leaf)) {
      throw new Error(`${label} tracked-tree path collides`);
    }
    node.blobs.set(leaf, { mode: match[1] as string, sha1: match[2] as string });
  }
  return rawGitTreeSha1(root);
}

function validateRetainedIgnoredPaths(
  bytes: Buffer,
  policy: "substrate-runtime" | "sentinel-upstream",
  label: string,
): void {
  for (const path of nulDelimitedUtf8(bytes, `${label} ignored-path listing`)) {
    safeGitRelativePath(path, `${label} ignored-path listing`, true);
    const allowed = policy === "sentinel-upstream"
      ? path === "frontend/node_modules/"
      : path === "node_modules/" ||
        /^packages\/[A-Za-z0-9._-]+\/(?:dist|node_modules)\/$/u.test(path) ||
        /^packages\/[A-Za-z0-9._-]+\/(?:\.tsbuildinfo|tsconfig\.tsbuildinfo)$/u.test(path);
    if (!allowed) throw new Error(`${label} contains an unexpected ignored runtime path`);
  }
}

function validateGitArtifact(
  value: unknown,
  expected: {
    readonly checkoutPath: string;
    readonly revision: string;
    readonly sourceTreeHash: string;
    readonly ignoredPathListingSha256: string;
    readonly gitExecutablePath: string;
    readonly environment: Readonly<Record<string, string>>;
    readonly ignoredPolicy: "substrate-runtime" | "sentinel-upstream";
  },
  label: string,
): void {
  const record = gitArtifact(value, label);
  if (
    record.checkoutPath !== expected.checkoutPath || record.revision !== expected.revision ||
    record.sourceTreeHash !== expected.sourceTreeHash || !Array.isArray(record.commands) || record.commands.length !== 6
  ) throw new Error(`${label} identity differs from the signed checkout`);
  const prefix = [
    "--exec-path=/dev/null",
    "--no-pager",
    "--no-replace-objects",
    "--literal-pathspecs",
    `--git-dir=${resolve(expected.checkoutPath, ".git")}`,
    `--work-tree=${expected.checkoutPath}`,
    "-c", `core.worktree=${expected.checkoutPath}`,
    "-c", "core.fileMode=true",
    "-c", "core.fsmonitor=false",
    "-c", "core.attributesFile=/dev/null",
    "-c", "core.excludesFile=/dev/null",
    "-c", "core.hooksPath=/dev/null",
  ] as const;
  const specifications = [
    { arguments: [...prefix, "rev-parse", "--verify", "HEAD"], stdoutBytes: `${expected.revision}\n` },
    { arguments: [...prefix, "rev-parse", "--verify", "HEAD^{tree}"], stdoutBytes: `${expected.sourceTreeHash}\n` },
    { arguments: [...prefix, "status", "--porcelain=v1", "--untracked-files=all"], stdoutBytes: "" },
    { arguments: [...prefix, "ls-files", "-v"] },
    { arguments: [...prefix, "ls-tree", "-r", "-z", "--full-tree", "HEAD"] },
    { arguments: [...prefix, "ls-files", "--others", "--ignored", "--exclude-standard", "--directory", "-z"] },
  ] as const;
  specifications.forEach((specification, index) => {
    const command = commandArtifact(record.commands[index], `${label} command ${index + 1}`);
    if (
      command.executablePath !== expected.gitExecutablePath || command.cwd !== expected.checkoutPath ||
      sentinelRawCanonical(command.arguments) !== sentinelRawCanonical(specification.arguments) ||
      sentinelRawCanonical(command.environment) !== sentinelRawCanonical(expected.environment) || command.stderr.byteLength !== 0 ||
      ("stdoutBytes" in specification && command.stdout.toString("utf8") !== specification.stdoutBytes)
    ) throw new Error(`${label} command ${index + 1} does not replay the signed git inspection`);
    if (index === 3) {
      const text = command.stdout.toString("utf8");
      if (text.includes("\r") || (text !== "" && !text.endsWith("\n")) ||
          text.split("\n").filter(Boolean).some((line) => !line.startsWith("H "))) {
        throw new Error(`${label} index flags conceal nonstandard git state`);
      }
    }
    if (index === 4 && validateRetainedGitTreeListing(command.stdout, label) !== expected.sourceTreeHash) {
      throw new Error(`${label} tracked-tree listing does not reconstruct the signed source tree`);
    }
    if (index === 5) {
      if (
        sentinelRawSha256(command.stdout) !== record.ignoredPathListingSha256 ||
        record.ignoredPathListingSha256 !== expected.ignoredPathListingSha256
      ) throw new Error(`${label} ignored-path listing differs from the signed closure`);
      validateRetainedIgnoredPaths(command.stdout, expected.ignoredPolicy, label);
    }
  });
}

export interface SentinelValidatedRawRuntimeArtifacts {
  readonly artifacts: SentinelRuntimeClosureArtifacts;
  readonly paths: SentinelRuntimeClosurePaths;
}

/**
 * Independently replays every retained runtime-derivation artifact against the
 * declared closure. Preparation and post-run verification deliberately share
 * this one fail-closed boundary so a shallow producer-side check cannot admit
 * evidence that the raw verifier would later reject.
 */
export function verifySentinelRawRuntimeArtifacts(
  value: unknown,
  closure: SentinelRuntimeClosure,
): SentinelValidatedRawRuntimeArtifacts {
  sentinelRawExactKeys(value, [
    "artifactSha256", "boundPathsManifest", "browserBundleTree", "commands", "derivationSha256", "entries", "executionEnvironmentManifest",
    "files", "installedDistributionsManifest", "installedDistributionsManifestSha256", "pipFreeze", "playwrightCoreLibraryTree",
    "playwrightLibraryTree", "publicEvalCompiledOutputTree", "pythonEnvironmentTree", "pythonRuntimeTree", "pythonStdlibTree",
    "schemaVersion", "substrateGit", "upstreamFrontendInstalledTree", "upstreamGit", "workspaceInstalledDependenciesTree",
    "workspacePackagesTree",
  ], "runtime artifact");
  const { artifactSha256, ...artifactWithDerivation } = value;
  const { derivationSha256, ...artifactBody } = artifactWithDerivation;
  if (
    value.schemaVersion !== "pm.public-eval-corners.sentinel-runtime-closure-artifacts.v4" ||
    typeof artifactSha256 !== "string" || artifactSha256 !== sentinelRawJsonSha256(artifactWithDerivation) ||
    typeof derivationSha256 !== "string" || derivationSha256 !== sentinelRawJsonSha256(artifactBody)
  ) throw new Error("runtime artifact is not doubly content-addressed");
  sentinelRawExactKeys(value.commands, ["gitVersion", "nodeVersion", "npmVersion", "pipFreeze", "pythonVersion"], "runtime commands");
  sentinelRawExactKeys(value.entries, ["node", "npm", "python"], "runtime requested/resolved entries");
  runtimeEntryArtifact(value.entries.node, {
    requestedPath: closure.node.requestedPath,
    requestedEntrySha256: closure.node.requestedEntrySha256,
    resolvedPath: closure.node.resolvedPath,
    resolvedSha256: closure.node.resolvedExecutableSha256,
  }, "runtime Node entry");
  runtimeEntryArtifact(value.entries.npm, {
    requestedPath: closure.npm.requestedCliPath,
    requestedEntrySha256: closure.npm.requestedCliEntrySha256,
    resolvedPath: closure.npm.resolvedCliPath,
    resolvedSha256: closure.npm.resolvedCliSha256,
  }, "runtime npm entry");
  runtimeEntryArtifact(value.entries.python, {
    requestedPath: closure.python.requestedVenvPath,
    requestedEntrySha256: closure.python.venvEntrySha256,
    resolvedPath: closure.python.resolvedExecutablePath,
    resolvedSha256: closure.python.realExecutableSha256,
  }, "runtime Python entry");
  sentinelRawExactKeys(value.files, [
    "agentScript", "browserExecutable", "gitExecutable", "playwrightCorePackageMetadata", "playwrightPackageMetadata",
    "pnpmWorkspaceLock", "providerProxyScript", "publicEvalPackageJson", "publicEvalTsconfig", "pyvenvConfig", "rootPackageJson",
    "rootTsconfig", "runnerScript", "stateSidecarScript", "supervisorScript", "tsconfigBase", "upstreamFrontendPackageLock",
    "upstreamServerRequirements", "verifierScript", "pnpmWorkspaceManifest",
  ], "runtime files");
  Object.entries(value.files).forEach(([name, entry]) => fileArtifact(entry, `runtime ${name} file`));
  const parsedTrees = new Map<string, ParsedTreeArtifact>();
  for (const name of [
    "workspacePackagesTree", "workspaceInstalledDependenciesTree", "publicEvalCompiledOutputTree", "pythonEnvironmentTree",
    "pythonRuntimeTree", "pythonStdlibTree", "playwrightLibraryTree", "playwrightCoreLibraryTree", "browserBundleTree",
    "upstreamFrontendInstalledTree",
  ] as const) parsedTrees.set(name, treeArtifact(value[name], `runtime ${name}`));
  const expectedEnvironmentManifest = sentinelRawCanonical(closure.executionEnvironment.values);
  if (
    typeof value.installedDistributionsManifest !== "string" ||
    sentinelRawSha256(value.installedDistributionsManifest) !== value.installedDistributionsManifestSha256 ||
    value.installedDistributionsManifestSha256 !== closure.python.installedDistributionsManifestSha256 ||
    typeof value.executionEnvironmentManifest !== "string" ||
    value.executionEnvironmentManifest !== expectedEnvironmentManifest ||
    sentinelRawSha256(value.executionEnvironmentManifest) !== closure.executionEnvironment.environmentSha256 ||
    sentinelRawSha256(value.executionEnvironmentManifest) !== closure.git.invocationEnvironmentSha256 ||
    typeof value.boundPathsManifest !== "string" || sentinelRawSha256(value.boundPathsManifest) !== closure.executionLease.boundPathsManifestSha256 ||
    typeof value.pipFreeze !== "string" || sentinelRawSha256(value.pipFreeze) !== closure.python.pipFreezeSha256
  ) throw new Error("runtime manifest, environment, bound paths, or pip freeze does not bind the signed closure");
  let installedDistributions: unknown;
  try { installedDistributions = JSON.parse(value.installedDistributionsManifest) as unknown; }
  catch { throw new Error("runtime installed-distributions manifest is not JSON"); }
  if (sentinelRawCanonical(installedDistributions) !== value.installedDistributionsManifest) {
    throw new Error("runtime installed-distributions manifest is not canonical JSON");
  }
  const paths = parseBoundPaths(value.boundPathsManifest);
  const pythonEnvironmentTree = parsedTrees.get("pythonEnvironmentTree");
  if (pythonEnvironmentTree === undefined) throw new Error("runtime Python environment tree is absent");
  validateInstalledDistributionsManifest(
    installedDistributions,
    closure,
    paths,
    value.pipFreeze,
    pythonEnvironmentTree,
  );
  const exactPathBindings: readonly [unknown, unknown, string][] = [
    [paths.gitExecutablePath, closure.git.executablePath, "git executable"],
    [paths.substrateCheckoutPath, closure.workspace.checkoutPath, "substrate checkout"],
    [paths.substratePackagesRootPath, closure.workspace.packagesRootPath, "workspace packages"],
    [paths.substrateInstalledDependenciesRootPath, closure.workspace.installedDependenciesRootPath, "workspace dependencies"],
    [paths.publicEvalCompiledOutputRootPath, closure.workspace.compiledOutputRootPath, "compiled output"],
    [paths.nodeRequestedPath, closure.node.requestedPath, "Node requested entry"],
    [paths.npmRequestedCliPath, closure.npm.requestedCliPath, "npm requested CLI"],
    [paths.pythonRequestedVenvPath, closure.python.requestedVenvPath, "Python requested entry"],
    [paths.pythonEnvironmentRootPath, closure.python.environmentRootPath, "Python environment"],
    [paths.pythonRuntimeRootPath, closure.python.runtimeRootPath, "Python runtime"],
    [paths.pythonStdlibRootPath, closure.python.stdlibRootPath, "Python stdlib"],
    [paths.browserBundleRootPath, closure.browser.bundleRootPath, "browser bundle"],
    [paths.browserExecutablePath, closure.browser.executablePath, "browser requested executable"],
    [paths.playwrightLibraryRootPath, closure.browser.libraryRootPath, "Playwright library"],
    [paths.playwrightCoreLibraryRootPath, closure.browser.coreLibraryRootPath, "Playwright core library"],
  ];
  for (const [actual, expected, label] of exactPathBindings) {
    if (actual !== expected) throw new Error(`runtime bound ${label} path differs from the signed closure`);
  }

  const requiredTree = (name: string): ParsedTreeArtifact => {
    const tree = parsedTrees.get(name);
    if (tree === undefined) throw new Error(`runtime retained tree ${name} is absent`);
    return tree;
  };
  for (const [parentTree, childTree, label] of [
    [
      requiredTree("workspacePackagesTree"),
      requiredTree("publicEvalCompiledOutputTree"),
      "runtime compiled-output tree",
    ],
    [
      requiredTree("workspaceInstalledDependenciesTree"),
      requiredTree("playwrightLibraryTree"),
      "runtime Playwright library tree",
    ],
    [
      requiredTree("workspaceInstalledDependenciesTree"),
      requiredTree("playwrightCoreLibraryTree"),
      "runtime Playwright core library tree",
    ],
    [
      requiredTree("pythonRuntimeTree"),
      requiredTree("pythonStdlibTree"),
      "runtime Python stdlib tree",
    ],
  ] as const) validateContainedTree(parentTree, childTree, label);

  validateGitArtifact(value.substrateGit, {
    checkoutPath: paths.substrateCheckoutPath,
    revision: closure.substrateRevision,
    sourceTreeHash: closure.sourceTreeHash,
    ignoredPathListingSha256: closure.workspace.ignoredPathListingSha256,
    gitExecutablePath: paths.gitExecutablePath,
    environment: closure.executionEnvironment.values,
    ignoredPolicy: "substrate-runtime",
  }, "substrate git artifact");
  validateGitArtifact(value.upstreamGit, {
    checkoutPath: paths.upstreamCheckoutPath,
    revision: closure.upstream.revision,
    sourceTreeHash: closure.upstream.sourceTreeHash,
    ignoredPathListingSha256: closure.upstream.ignoredPathListingSha256,
    gitExecutablePath: paths.gitExecutablePath,
    environment: closure.executionEnvironment.values,
    ignoredPolicy: "sentinel-upstream",
  }, "upstream git artifact");
  exactCommand(value.commands.gitVersion, {
    executablePath: paths.gitExecutablePath,
    arguments: ["--version"],
    cwd: paths.substrateCheckoutPath,
    environment: closure.executionEnvironment.values,
    stdoutLine: closure.git.version,
  }, "runtime git version command");
  exactCommand(value.commands.nodeVersion, {
    executablePath: paths.nodeRequestedPath,
    arguments: ["--version"],
    cwd: paths.substrateCheckoutPath,
    environment: closure.executionEnvironment.values,
    stdoutLine: closure.node.version,
  }, "runtime Node version command");
  exactCommand(value.commands.npmVersion, {
    executablePath: paths.nodeRequestedPath,
    arguments: [paths.npmRequestedCliPath, "--version"],
    cwd: paths.substrateCheckoutPath,
    environment: closure.executionEnvironment.values,
    stdoutLine: closure.npm.version,
  }, "runtime npm version command");
  exactCommand(value.commands.pythonVersion, {
    executablePath: paths.pythonRequestedVenvPath,
    arguments: ["--version"],
    cwd: paths.upstreamCheckoutPath,
    environment: closure.executionEnvironment.values,
    stdoutLine: closure.python.version,
  }, "runtime Python version command");
  exactCommand(value.commands.pipFreeze, {
    executablePath: paths.pythonRequestedVenvPath,
    arguments: ["-m", "pip", "freeze", "--all"],
    cwd: paths.upstreamCheckoutPath,
    environment: closure.executionEnvironment.values,
    stdoutBytes: value.pipFreeze,
  }, "runtime pip freeze command");
  const files = value.files;
  const mappings: readonly [unknown, string, string | null, string][] = [
    [files.gitExecutable, closure.git.executableSha256, paths.gitExecutablePath, "git executable"],
    [files.pnpmWorkspaceLock, closure.pnpmWorkspaceLockSha256, paths.pnpmWorkspaceLockPath, "pnpm lock"],
    [files.rootPackageJson, closure.workspace.rootPackageJsonSha256, paths.rootPackageJsonPath, "root package manifest"],
    [files.pnpmWorkspaceManifest, closure.workspace.pnpmWorkspaceManifestSha256, paths.pnpmWorkspaceManifestPath, "pnpm workspace manifest"],
    [files.rootTsconfig, closure.workspace.rootTsconfigSha256, paths.rootTsconfigPath, "root tsconfig"],
    [files.tsconfigBase, closure.workspace.tsconfigBaseSha256, paths.tsconfigBasePath, "base tsconfig"],
    [files.publicEvalPackageJson, closure.workspace.publicEvalPackageManifestSha256, paths.publicEvalPackageJsonPath, "public-eval package manifest"],
    [files.publicEvalTsconfig, closure.workspace.publicEvalTsconfigSha256, paths.publicEvalTsconfigPath, "public-eval tsconfig"],
    [files.runnerScript, closure.runnerScriptSha256, paths.runnerScriptPath, "runner"],
    [files.supervisorScript, closure.supervisorScriptSha256, paths.supervisorScriptPath, "supervisor"],
    [files.verifierScript, closure.verifierScriptSha256, paths.verifierScriptPath, "verifier"],
    [files.agentScript, closure.agentScriptSha256, paths.agentScriptPath, "agent"],
    [files.providerProxyScript, closure.providerProxyScriptSha256, paths.providerProxyScriptPath, "provider"],
    [files.stateSidecarScript, closure.stateSidecarScriptSha256, paths.stateSidecarScriptPath, "state sidecar"],
    [files.pyvenvConfig, closure.python.pyvenvConfigSha256, paths.pythonPyvenvConfigPath, "pyvenv"],
    [files.playwrightPackageMetadata, closure.browser.packageMetadataSha256, paths.playwrightPackageMetadataPath, "Playwright metadata"],
    [files.playwrightCorePackageMetadata, closure.browser.corePackageMetadataSha256, paths.playwrightCorePackageMetadataPath, "Playwright core metadata"],
    [files.browserExecutable, closure.browser.executableSha256, null, "browser executable"],
    [files.upstreamFrontendPackageLock, closure.upstream.frontendPackageLockSha256, paths.upstreamFrontendPackageLockPath, "upstream frontend lock"],
    [files.upstreamServerRequirements, closure.upstream.serverRequirementsSha256, paths.upstreamServerRequirementsPath, "upstream requirements"],
  ];
  for (const [entry, expectedHash, expectedPath, label] of mappings) {
    if (
      !sentinelRawIsRecord(entry) || entry.sha256 !== expectedHash ||
      (expectedPath !== null && entry.path !== expectedPath)
    ) throw new Error(`runtime ${label} differs from signed closure`);
  }
  const retainedTrees = [...parsedTrees.values()];
  for (const [name, file] of Object.entries(files)) {
    validateFileAgainstContainingTrees(file, `runtime ${name} file`, retainedTrees);
  }
  const browserTree = parsedTrees.get("browserBundleTree");
  if (browserTree === undefined || browserTree.rootPath !== paths.browserBundleRootPath) {
    throw new Error("runtime browser bundle tree root differs from bound path");
  }
  const browserExecutable = files.browserExecutable;
  if (!sentinelRawIsRecord(browserExecutable)) {
    throw new Error("runtime browser executable identity is invalid");
  }
  const browserExecutablePath = canonicalAbsolutePath(
    browserExecutable.path,
    "runtime browser executable path",
  );
  const browserExecutableRelativePath = relativeTreeRootPath(
    browserTree.rootPath,
    browserExecutablePath,
    "runtime browser executable path",
  );
  if (browserExecutableRelativePath === "") {
    throw new Error("runtime browser executable must be a descendant of the browser bundle root");
  }
  const browserTreeEntry = browserTree.entriesByPath.get(browserExecutableRelativePath);
  if (
    browserTreeEntry?.type !== "file" || browserTreeEntry.sha256 !== browserExecutable.sha256 ||
    browserTreeEntry.mode !== browserExecutable.mode ||
    (Number.parseInt(browserTreeEntry.mode, 8) & 0o111) === 0
  ) throw new Error("runtime browser executable does not match an executable browser-tree file");
  const requestedBrowserRelativePath = relativeTreeRootPath(
    browserTree.rootPath,
    paths.browserExecutablePath,
    "runtime requested browser executable path",
  );
  if (requestedBrowserRelativePath === "") {
    throw new Error("runtime requested browser executable must be a descendant of the browser bundle root");
  }
  const requestedBrowserEntry = browserTree.entriesByPath.get(requestedBrowserRelativePath);
  if (
    requestedBrowserEntry === undefined || requestedBrowserEntry.type === "directory" ||
    (requestedBrowserEntry.type === "file" && browserExecutablePath !== paths.browserExecutablePath)
  ) throw new Error("runtime browser executable path is not the bound requested file or its retained symlink target");
  const trees: readonly [unknown, string, number | null, string, string][] = [
    [value.workspacePackagesTree, closure.workspace.packagesTreeSha256, closure.workspace.packagesTreeEntryCount, paths.substratePackagesRootPath, "workspace packages"],
    [value.workspaceInstalledDependenciesTree, closure.workspace.installedDependenciesTreeSha256, closure.workspace.installedDependenciesTreeEntryCount, paths.substrateInstalledDependenciesRootPath, "workspace dependencies"],
    [value.publicEvalCompiledOutputTree, closure.workspace.compiledOutputTreeSha256, closure.workspace.compiledOutputTreeEntryCount, paths.publicEvalCompiledOutputRootPath, "compiled output"],
    [value.pythonEnvironmentTree, closure.python.environmentTreeSha256, closure.python.environmentTreeEntryCount, paths.pythonEnvironmentRootPath, "Python environment"],
    [value.pythonRuntimeTree, closure.python.runtimeTreeSha256, closure.python.runtimeTreeEntryCount, paths.pythonRuntimeRootPath, "Python runtime"],
    [value.pythonStdlibTree, closure.python.stdlibTreeSha256, closure.python.stdlibTreeEntryCount, paths.pythonStdlibRootPath, "Python stdlib"],
    [value.playwrightLibraryTree, closure.browser.libraryTreeSha256, closure.browser.libraryTreeEntryCount, paths.playwrightLibraryRootPath, "Playwright library"],
    [value.playwrightCoreLibraryTree, closure.browser.coreLibraryTreeSha256, closure.browser.coreLibraryTreeEntryCount, paths.playwrightCoreLibraryRootPath, "Playwright core library"],
    [value.browserBundleTree, closure.browser.bundleTreeSha256, null, paths.browserBundleRootPath, "browser bundle"],
    [value.upstreamFrontendInstalledTree, closure.upstream.frontendInstalledTreeSha256, null, paths.upstreamFrontendInstalledRootPath, "upstream frontend"],
  ];
  for (const [entry, hash, count, rootPath, label] of trees) {
    if (
      !sentinelRawIsRecord(entry) || entry.manifestSha256 !== hash || entry.rootPath !== rootPath ||
      (count !== null && entry.entryCount !== count)
    ) {
      throw new Error(`runtime ${label} tree differs from signed closure`);
    }
  }
  return {
    artifacts: artifactWithDerivation as unknown as SentinelRuntimeClosureArtifacts,
    paths,
  };
}

export function verifySentinelRawRuntimeBoundary(input: {
  readonly batchRoot: string;
  readonly reference: SentinelProductionRuntimeInspectionReference;
  readonly expectedBoundary: "initial" | "before" | "after";
  readonly expectedBlockSequence: number | null;
  readonly expectedPreviousReceiptSha256: string;
  readonly preregistrationClosure: SentinelRuntimeClosure;
}): SentinelRawRuntimeBoundary {
  const issues: string[] = [];
  let boundary: SentinelRawRuntimeBoundary["boundary"] = null;
  let blockSequence: number | null = null;
  let inspectedAt: string | null = null;
  let receiptSha256: string | null = null;
  let derivationSha256: string | null = null;
  let executableIdentitySha256: string | null = null;
  let previousReceiptSha256: string | null = null;
  let exactSupervisorPaths: SentinelRawRuntimeBoundary["exactSupervisorPaths"] = null;
  try {
    const receiptPath = sentinelRawContainedPath(input.batchRoot, input.reference.inspectionReceiptPath, "runtime inspection receipt path");
    const expectedPrefix = input.expectedBoundary === "initial"
      ? "runtime-initial"
      : `runtime-block-${String(input.expectedBlockSequence).padStart(6, "0")}-${input.expectedBoundary}`;
    if (input.reference.inspectionReceiptPath !==
        `manifests/runtime/${expectedPrefix}-${input.reference.inspectionReceiptSha256}.json`) {
      throw new Error("runtime inspection receipt path is not boundary/sequence content-addressed");
    }
    const receipt = sentinelRawJsonFile(receiptPath, "runtime inspection receipt");
    sentinelRawExactKeys(receipt, [
      "artifact", "blockSequence", "boundary", "closure", "closureSha256", "evidenceEligible", "executableIdentitySha256",
      "executionLeaseIdentity", "inspectedAt", "issues", "materialBenefit", "preregistrationClosureSha256",
      "previousInspectionReceiptSha256", "receiptSha256", "schemaVersion", "valid",
    ], "runtime inspection receipt");
    const { receiptSha256: storedReceipt, ...receiptBody } = receipt;
    receiptSha256 = String(storedReceipt);
    boundary = receipt.boundary as SentinelRawRuntimeBoundary["boundary"];
    blockSequence = receipt.blockSequence as number | null;
    inspectedAt = sentinelRawCanonicalTimestamp(receipt.inspectedAt, "runtime inspectedAt");
    executableIdentitySha256 = String(receipt.executableIdentitySha256);
    previousReceiptSha256 = String(receipt.previousInspectionReceiptSha256);
    if (
      receipt.schemaVersion !== "pm.public-eval-corners.sentinel-production-runtime-inspection.v1" ||
      receipt.evidenceEligible !== false || receipt.materialBenefit !== false || receipt.valid !== true ||
      !Array.isArray(receipt.issues) || receipt.issues.length !== 0 || boundary !== input.expectedBoundary ||
      blockSequence !== input.expectedBlockSequence || previousReceiptSha256 !== input.expectedPreviousReceiptSha256 ||
      storedReceipt !== sentinelRawJsonSha256(receiptBody) || storedReceipt !== input.reference.inspectionReceiptSha256 ||
      !receiptPath.endsWith(`-${storedReceipt}.json`) ||
      receipt.preregistrationClosureSha256 !== input.preregistrationClosure.closureSha256 ||
      receipt.closureSha256 !== input.preregistrationClosure.closureSha256 ||
      sentinelRawCanonical(receipt.closure) !== sentinelRawCanonical(input.preregistrationClosure) ||
      input.reference.closureSha256 !== receipt.closureSha256 || input.reference.executableIdentitySha256 !== executableIdentitySha256 ||
      input.reference.inspectedAt !== inspectedAt || input.reference.valid !== true
    ) throw new Error("runtime inspection receipt differs from the expected boundary, chain, or signed closure");
    sentinelRawExactKeys(receipt.artifact, ["derivationSha256", "path", "sha256"], "runtime artifact reference");
    if (
      input.reference.artifactPath !== receipt.artifact.path || input.reference.artifactSha256 !== receipt.artifact.sha256 ||
      input.reference.derivationSha256 !== receipt.artifact.derivationSha256
    ) throw new Error("runtime artifact reference differs between boundary reference and receipt");
    const artifactPath = sentinelRawContainedPath(input.batchRoot, receipt.artifact.path, "runtime artifact path");
    const artifactBytes = sentinelRawRegularFile(artifactPath, "runtime artifact");
    const artifactValue = JSON.parse(artifactBytes.toString("utf8")) as unknown;
    if (
      !sentinelRawIsRecord(artifactValue) || artifactValue.artifactSha256 !== receipt.artifact.sha256 ||
      receipt.artifact.path !== `manifests/runtime/runtime-artifacts-${receipt.artifact.sha256}.json` ||
      !artifactPath.endsWith(`-${receipt.artifact.sha256}.json`)
    ) throw new Error("runtime artifact filename/reference differs from its content address");
    const validatedArtifacts = verifySentinelRawRuntimeArtifacts(
      artifactValue,
      input.preregistrationClosure,
    );
    derivationSha256 = validatedArtifacts.artifacts.derivationSha256;
    if (receipt.artifact.derivationSha256 !== derivationSha256) throw new Error("runtime derivation hash differs from receipt");
    sentinelRawExactKeys(receipt.executionLeaseIdentity, [
      "acquiredDerivationSha256", "boundPathsManifestSha256", "closureSha256", "exactSupervisorPaths", "identitySha256", "schemaVersion",
    ], "runtime execution lease identity");
    sentinelRawExactKeys(receipt.executionLeaseIdentity.exactSupervisorPaths, [
      "agentScriptPath", "nodeExecutablePath", "npmCliPath", "pythonExecutablePath",
    ], "runtime execution lease paths");
    const { identitySha256, ...leaseBody } = receipt.executionLeaseIdentity;
    const expectedSupervisorPaths = {
      nodeExecutablePath: validatedArtifacts.paths.nodeRequestedPath,
      npmCliPath: validatedArtifacts.paths.npmRequestedCliPath,
      pythonExecutablePath: validatedArtifacts.paths.pythonRequestedVenvPath,
      agentScriptPath: validatedArtifacts.paths.agentScriptPath,
    };
    const expectedExecutableIdentitySha256 = sentinelRawJsonSha256({
      node: {
        path: validatedArtifacts.paths.nodeRequestedPath,
        sha256: input.preregistrationClosure.node.resolvedExecutableSha256,
      },
      agent: {
        path: validatedArtifacts.paths.agentScriptPath,
        sha256: input.preregistrationClosure.agentScriptSha256,
      },
      python: {
        path: validatedArtifacts.paths.pythonRequestedVenvPath,
        sha256: input.preregistrationClosure.python.realExecutableSha256,
      },
      npm: {
        path: validatedArtifacts.paths.npmRequestedCliPath,
        sha256: input.preregistrationClosure.npm.resolvedCliSha256,
      },
    });
    if (
      receipt.executionLeaseIdentity.schemaVersion !== "pm.public-eval-corners.sentinel-runtime-execution-lease-identity.v1" ||
      identitySha256 !== sentinelRawJsonSha256(leaseBody) || identitySha256 !== input.reference.executionLeaseIdentitySha256 ||
      receipt.executionLeaseIdentity.closureSha256 !== input.preregistrationClosure.closureSha256 ||
      receipt.executionLeaseIdentity.boundPathsManifestSha256 !== input.preregistrationClosure.executionLease.boundPathsManifestSha256 ||
      receipt.executionLeaseIdentity.acquiredDerivationSha256 !== derivationSha256 ||
      sentinelRawCanonical(receipt.executionLeaseIdentity.exactSupervisorPaths) !== sentinelRawCanonical(expectedSupervisorPaths) ||
      executableIdentitySha256 !== expectedExecutableIdentitySha256
    ) throw new Error("runtime execution lease does not bind the exact retained derivation");
    exactSupervisorPaths = expectedSupervisorPaths;
  } catch (error) { issues.push(issueOf(error)); }
  return {
    valid: issues.length === 0,
    issues,
    boundary,
    blockSequence,
    inspectedAt,
    receiptSha256,
    derivationSha256,
    executableIdentitySha256,
    previousReceiptSha256,
    exactSupervisorPaths,
  };
}
