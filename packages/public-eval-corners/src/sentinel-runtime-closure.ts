import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  realpathSync,
} from "node:fs";
import type { BigIntStats } from "node:fs";
import {
  dirname,
  isAbsolute,
  normalize,
  relative,
  resolve,
  sep,
} from "node:path";

import {
  buildSentinelRuntimeSanitizedEnvironment,
  isSentinelRuntimeSanitizedEnvironment,
  sentinelProductionCanonicalJson,
  sentinelProductionRuntimeClosureSha256,
  type SentinelRuntimeSanitizedEnvironment,
  type SentinelRuntimeClosure,
} from "./sentinel-production-plan.js";
import { assertSentinelTrackedWorkingTreeMatchesHead } from "./sentinel-git-working-tree.js";

const SHA256 = /^[a-f0-9]{64}$/u;
const GIT_SHA1 = /^[a-f0-9]{40}$/u;
const GIT_VERSION = /^git version [^\0\r\n]{1,160}$/u;
const NODE_VERSION = /^v[0-9]+\.[0-9]+\.[0-9]+$/u;
const NPM_VERSION = /^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][A-Za-z0-9.-]+)?$/u;
const PYTHON_VERSION = /^Python [0-9]+\.[0-9]+\.[0-9]+$/u;
const DISTRIBUTION_FIELD = /^[^\0\r\n]+$/u;

export interface SentinelRuntimeClosurePaths {
  readonly gitExecutablePath: string;
  readonly substrateCheckoutPath: string;
  readonly rootPackageJsonPath: string;
  readonly pnpmWorkspaceManifestPath: string;
  readonly rootTsconfigPath: string;
  readonly tsconfigBasePath: string;
  readonly publicEvalPackageJsonPath: string;
  readonly publicEvalTsconfigPath: string;
  readonly substratePackagesRootPath: string;
  readonly substrateInstalledDependenciesRootPath: string;
  readonly publicEvalCompiledOutputRootPath: string;
  readonly pnpmWorkspaceLockPath: string;
  readonly runnerScriptPath: string;
  readonly supervisorScriptPath: string;
  readonly verifierScriptPath: string;
  readonly agentScriptPath: string;
  readonly providerProxyScriptPath: string;
  readonly stateSidecarScriptPath: string;
  readonly nodeRequestedPath: string;
  readonly nodeAllowedRootPath: string;
  readonly npmRequestedCliPath: string;
  readonly npmAllowedRootPath: string;
  readonly pythonRequestedVenvPath: string;
  readonly pythonEnvironmentRootPath: string;
  readonly pythonRuntimeRootPath: string;
  readonly pythonStdlibRootPath: string;
  /** The venv launcher normally resolves to an interpreter outside the venv. */
  readonly pythonExecutableAllowedRootPath: string;
  readonly pythonPyvenvConfigPath: string;
  readonly pythonSitePackagesRootPaths: readonly string[];
  readonly playwrightPackageMetadataPath: string;
  readonly playwrightCorePackageMetadataPath: string;
  readonly playwrightLibraryRootPath: string;
  readonly playwrightCoreLibraryRootPath: string;
  readonly browserBundleRootPath: string;
  readonly browserExecutablePath: string;
  readonly upstreamCheckoutPath: string;
  readonly upstreamFrontendPackageLockPath: string;
  readonly upstreamFrontendInstalledRootPath: string;
  readonly upstreamServerRequirementsPath: string;
}
export interface SentinelRuntimeCommandInvocation {
  readonly executablePath: string;
  readonly arguments: readonly string[];
  readonly cwd: string;
  readonly environment: Readonly<Record<string, string>>;
}

export interface SentinelRuntimeCommandResult {
  readonly exitCode: number;
  readonly signal: string | null;
  readonly stdout: Uint8Array;
  readonly stderr: Uint8Array;
}

export interface SentinelRuntimeClosureDependencies {
  readonly runCommand: (
    invocation: SentinelRuntimeCommandInvocation,
  ) => SentinelRuntimeCommandResult;
  /** Test seam only; production must use the exact exported sanitized map. */
  readonly executionEnvironment?: Readonly<Record<string, string>>;
  /** Test seam for the macOS launcher rejection; production uses process.platform. */
  readonly platform?: NodeJS.Platform;
}

export interface SentinelRuntimeCommandArtifact {
  readonly executablePath: string;
  readonly arguments: readonly string[];
  readonly cwd: string;
  readonly environment: Readonly<Record<string, string>>;
  readonly stdoutBase64: string;
  readonly stdoutSha256: string;
  readonly stderrBase64: string;
  readonly stderrSha256: string;
  readonly exitCode: number;
  readonly signal: string | null;
}

export interface SentinelRuntimeTreeArtifact {
  readonly rootPath: string;
  readonly manifest: string;
  readonly manifestSha256: string;
  readonly entryCount: number;
}

export interface SentinelRuntimeFileArtifact {
  readonly path: string;
  readonly sha256: string;
  readonly mode: string;
  readonly size: number;
}

export interface SentinelRuntimeEntryArtifact {
  readonly requestedPath: string;
  readonly requestedEntrySha256: string;
  readonly resolvedPath: string;
  readonly resolvedSha256: string;
}

export interface SentinelRuntimeGitArtifact {
  readonly checkoutPath: string;
  readonly revision: string;
  readonly sourceTreeHash: string;
  readonly ignoredPathListingSha256: string;
  readonly clean: true;
  readonly commands: readonly SentinelRuntimeCommandArtifact[];
}

export interface SentinelRuntimeClosureArtifacts {
  readonly schemaVersion: "pm.public-eval-corners.sentinel-runtime-closure-artifacts.v4";
  readonly substrateGit: SentinelRuntimeGitArtifact;
  readonly upstreamGit: SentinelRuntimeGitArtifact;
  readonly commands: {
    readonly gitVersion: SentinelRuntimeCommandArtifact;
    readonly nodeVersion: SentinelRuntimeCommandArtifact;
    readonly npmVersion: SentinelRuntimeCommandArtifact;
    readonly pythonVersion: SentinelRuntimeCommandArtifact;
    readonly pipFreeze: SentinelRuntimeCommandArtifact;
  };
  readonly pipFreeze: string;
  readonly entries: {
    readonly node: SentinelRuntimeEntryArtifact;
    readonly npm: SentinelRuntimeEntryArtifact;
    readonly python: SentinelRuntimeEntryArtifact;
  };
  readonly files: {
    readonly gitExecutable: SentinelRuntimeFileArtifact;
    readonly pnpmWorkspaceLock: SentinelRuntimeFileArtifact;
    readonly rootPackageJson: SentinelRuntimeFileArtifact;
    readonly pnpmWorkspaceManifest: SentinelRuntimeFileArtifact;
    readonly rootTsconfig: SentinelRuntimeFileArtifact;
    readonly tsconfigBase: SentinelRuntimeFileArtifact;
    readonly publicEvalPackageJson: SentinelRuntimeFileArtifact;
    readonly publicEvalTsconfig: SentinelRuntimeFileArtifact;
    readonly runnerScript: SentinelRuntimeFileArtifact;
    readonly supervisorScript: SentinelRuntimeFileArtifact;
    readonly verifierScript: SentinelRuntimeFileArtifact;
    readonly agentScript: SentinelRuntimeFileArtifact;
    readonly providerProxyScript: SentinelRuntimeFileArtifact;
    readonly stateSidecarScript: SentinelRuntimeFileArtifact;
    readonly pyvenvConfig: SentinelRuntimeFileArtifact;
    readonly playwrightPackageMetadata: SentinelRuntimeFileArtifact;
    readonly playwrightCorePackageMetadata: SentinelRuntimeFileArtifact;
    readonly browserExecutable: SentinelRuntimeFileArtifact;
    readonly upstreamFrontendPackageLock: SentinelRuntimeFileArtifact;
    readonly upstreamServerRequirements: SentinelRuntimeFileArtifact;
  };
  readonly installedDistributionsManifest: string;
  readonly installedDistributionsManifestSha256: string;
  readonly executionEnvironmentManifest: string;
  readonly boundPathsManifest: string;
  readonly workspacePackagesTree: SentinelRuntimeTreeArtifact;
  readonly workspaceInstalledDependenciesTree: SentinelRuntimeTreeArtifact;
  readonly publicEvalCompiledOutputTree: SentinelRuntimeTreeArtifact;
  readonly pythonEnvironmentTree: SentinelRuntimeTreeArtifact;
  readonly pythonRuntimeTree: SentinelRuntimeTreeArtifact;
  readonly pythonStdlibTree: SentinelRuntimeTreeArtifact;
  readonly playwrightLibraryTree: SentinelRuntimeTreeArtifact;
  readonly playwrightCoreLibraryTree: SentinelRuntimeTreeArtifact;
  readonly browserBundleTree: SentinelRuntimeTreeArtifact;
  readonly upstreamFrontendInstalledTree: SentinelRuntimeTreeArtifact;
  readonly derivationSha256: string;
}

export interface SentinelRuntimeClosureDerivation {
  readonly closure: SentinelRuntimeClosure;
  readonly artifacts: SentinelRuntimeClosureArtifacts;
}

/**
 * A user-space execution lease binds the exact path object used by the runner.
 * It is intentionally not called an immutable OS snapshot: callers must close
 * it after a block, and any changed byte/tree makes the block ineligible.
 */
export interface SentinelRuntimeExecutionLease {
  readonly schemaVersion: "pm.public-eval-corners.sentinel-runtime-execution-lease.v1";
  readonly paths: SentinelRuntimeClosurePaths;
  readonly closureSha256: string;
  readonly declaredClosure: SentinelRuntimeClosure;
  readonly boundPathsManifestSha256: string;
  readonly acquiredDerivationSha256: string;
  readonly exactSupervisorPaths: {
    readonly nodeExecutablePath: string;
    readonly npmCliPath: string;
    readonly pythonExecutablePath: string;
    readonly agentScriptPath: string;
  };
}

function runtimeBoundPathsManifest(paths: SentinelRuntimeClosurePaths): string {
  return sentinelProductionCanonicalJson({
    schemaVersion: "pm.public-eval-corners.sentinel-runtime-bound-paths.v1",
    paths,
  });
}

interface StableEntry {
  readonly requestedPath: string;
  readonly requestedEntrySha256: string;
  readonly resolvedPath: string;
  readonly resolvedSha256: string;
  readonly mode: number;
}

interface StableRegular {
  readonly bytes: Buffer;
  readonly mode: number;
}

interface CommandCapture {
  readonly artifact: SentinelRuntimeCommandArtifact;
  readonly stdout: Buffer;
}

interface DistributionFile {
  readonly path: string;
  readonly type: "file";
  readonly mode: string;
  readonly sha256: string;
  readonly recordSha256: string | null;
  readonly recordSize: number | null;
}

interface DistributionManifestEntry {
  readonly canonicalName: string;
  readonly name: string;
  readonly version: string;
  readonly metadataSha256: string;
  readonly recordSha256: string;
  readonly files: readonly DistributionFile[];
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function executionEnvironment(
  dependencies: SentinelRuntimeClosureDependencies,
  nodeExecutablePath: string,
): SentinelRuntimeSanitizedEnvironment {
  const environment = dependencies.executionEnvironment ??
    buildSentinelRuntimeSanitizedEnvironment(nodeExecutablePath);
  if (!isSentinelRuntimeSanitizedEnvironment(environment, nodeExecutablePath)) {
    throw new Error("runtime command environment is not the exact Node-derived sanitized environment");
  }
  return Object.freeze({ ...environment });
}

function codeUnitCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function assertCanonicalAbsolute(path: string, label: string): void {
  if (
    !isAbsolute(path) ||
    normalize(path) !== path ||
    path.includes("\0") ||
    path.includes("\n") ||
    path.includes("\r") ||
    path.includes("\t")
  ) {
    throw new Error(`${label} must be a canonical absolute path without control characters`);
  }
}

function assertDistinct(paths: readonly [string, string][]): void {
  const seen = new Map<string, string>();
  const seenReal = new Map<string, string>();
  for (const [label, path] of paths) {
    assertCanonicalAbsolute(path, label);
    const prior = seen.get(path);
    if (prior) throw new Error(`${label} aliases ${prior}`);
    seen.set(path, label);
    const real = realpathSync(path);
    const physicalPrior = seenReal.get(real);
    if (physicalPrior) throw new Error(`${label} physically aliases ${physicalPrior}`);
    seenReal.set(real, label);
  }
}

function pathWithin(path: string, root: string): boolean {
  return path === root || path.startsWith(`${root}${sep}`);
}

function assertExactPath(path: string, expectedPath: string, label: string): void {
  if (path !== expectedPath) throw new Error(`${label} must be ${expectedPath}`);
}

function assertRealContained(path: string, root: string, label: string): void {
  const real = realpathSync(path);
  const rootReal = realpathSync(root);
  if (!pathWithin(real, rootReal)) throw new Error(`${label} resolves outside its required root`);
}

function statFingerprint(stat: BigIntStats): string {
  return [
    stat.dev,
    stat.ino,
    stat.mode,
    stat.nlink,
    stat.uid,
    stat.gid,
    stat.rdev,
    stat.size,
    stat.mtimeNs,
    stat.ctimeNs,
  ].join(":");
}

function readStableRegular(path: string, label: string): StableRegular {
  const before = lstatSync(path, { bigint: true });
  if (!before.isFile()) throw new Error(`${label} must be a regular file`);
  const descriptor = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const openedBefore = fstatSync(descriptor, { bigint: true });
    if (!openedBefore.isFile() || statFingerprint(before) !== statFingerprint(openedBefore)) {
      throw new Error(`${label} changed while it was opened`);
    }
    const bytes = readFileSync(descriptor);
    const openedAfter = fstatSync(descriptor, { bigint: true });
    const after = lstatSync(path, { bigint: true });
    if (
      statFingerprint(openedBefore) !== statFingerprint(openedAfter) ||
      statFingerprint(before) !== statFingerprint(after) ||
      BigInt(bytes.byteLength) !== openedAfter.size
    ) {
      throw new Error(`${label} changed while it was read`);
    }
    return { bytes, mode: Number(before.mode & 0o7777n) };
  } finally {
    closeSync(descriptor);
  }
}

function fileArtifact(path: string, stable: StableRegular): SentinelRuntimeFileArtifact {
  return {
    path,
    sha256: sha256(stable.bytes),
    mode: stable.mode.toString(8).padStart(4, "0"),
    size: stable.bytes.byteLength,
  };
}

function readStableEntry(path: string, allowedRoot: string, label: string): StableEntry {
  assertCanonicalAbsolute(path, label);
  assertCanonicalAbsolute(allowedRoot, `${label} allowed root`);
  const rootReal = realpathSync(allowedRoot);
  const before = lstatSync(path, { bigint: true });
  let requestedEntrySha256: string;
  if (before.isSymbolicLink()) {
    const firstTarget = readlinkSync(path, "utf8");
    if (/\0|\r|\n/u.test(firstTarget)) throw new Error(`${label} has an unsafe symlink target`);
    const afterTarget = readlinkSync(path, "utf8");
    const after = lstatSync(path, { bigint: true });
    if (firstTarget !== afterTarget || statFingerprint(before) !== statFingerprint(after)) {
      throw new Error(`${label} symlink changed during derivation`);
    }
    requestedEntrySha256 = sha256(Buffer.from(firstTarget, "utf8"));
  } else if (before.isFile()) {
    requestedEntrySha256 = sha256(readStableRegular(path, label).bytes);
  } else {
    throw new Error(`${label} must be a symlink or regular file`);
  }
  const resolvedPath = realpathSync(path);
  if (!pathWithin(resolvedPath, rootReal)) throw new Error(`${label} resolves outside its allowed root`);
  const resolved = readStableRegular(resolvedPath, `${label} resolved target`);
  if (realpathSync(path) !== resolvedPath) throw new Error(`${label} was retargeted during derivation`);
  return {
    requestedPath: path,
    requestedEntrySha256,
    resolvedPath,
    resolvedSha256: sha256(resolved.bytes),
    mode: resolved.mode,
  };
}

function validateRelativeName(name: string, label: string): void {
  if (
    name.length === 0 ||
    name === "." ||
    name === ".." ||
    name.includes("/") ||
    name.includes("\\") ||
    /[\u0000-\u001f\u007f]/u.test(name)
  ) {
    throw new Error(`${label} contains an unsafe path component`);
  }
}

function treeManifestOnce(
  rootPath: string,
  label: string,
  allowedRootPaths: readonly string[],
): SentinelRuntimeTreeArtifact {
  assertCanonicalAbsolute(rootPath, label);
  const root = lstatSync(rootPath, { bigint: true });
  if (!root.isDirectory() || root.isSymbolicLink()) throw new Error(`${label} must be a directory`);
  const allowedRoots = allowedRootPaths.map((path) => realpathSync(path));
  const entries: string[] = [];
  const paths = new Set<string>();
  const visit = (directoryPath: string, relativeDirectory: string): void => {
    const children = readdirSync(directoryPath).sort(codeUnitCompare);
    for (const name of children) {
      validateRelativeName(name, label);
      const childPath = resolve(directoryPath, name);
      const relativePath = relativeDirectory ? `${relativeDirectory}/${name}` : name;
      if (paths.has(relativePath)) throw new Error(`${label} contains duplicate path ${relativePath}`);
      paths.add(relativePath);
      const before = lstatSync(childPath, { bigint: true });
      const mode = Number(before.mode & 0o7777n).toString(8).padStart(4, "0");
      if (before.isDirectory()) {
        entries.push(`${relativePath}\t${mode}\tdirectory\t${sha256("")}\n`);
        visit(childPath, relativePath);
        const after = lstatSync(childPath, { bigint: true });
        if (statFingerprint(before) !== statFingerprint(after)) {
          throw new Error(`${label} directory changed during traversal`);
        }
      } else if (before.isFile()) {
        const stable = readStableRegular(childPath, `${label}/${relativePath}`);
        entries.push(`${relativePath}\t${mode}\tfile\t${sha256(stable.bytes)}\n`);
      } else if (before.isSymbolicLink()) {
        const target = readlinkSync(childPath, "utf8");
        if (/\0|\r|\n/u.test(target)) throw new Error(`${label} contains an unsafe symlink`);
        const resolvedTarget = realpathSync(childPath);
        if (!allowedRoots.some((allowedRoot) => pathWithin(resolvedTarget, allowedRoot))) {
          throw new Error(`${label} symlink ${relativePath} escapes its root`);
        }
        const after = lstatSync(childPath, { bigint: true });
        if (statFingerprint(before) !== statFingerprint(after) || readlinkSync(childPath, "utf8") !== target) {
          throw new Error(`${label} symlink changed during traversal`);
        }
        entries.push(`${relativePath}\t${mode}\tsymlink\t${sha256(Buffer.from(target, "utf8"))}\n`);
      } else {
        throw new Error(`${label} contains special file ${relativePath}`);
      }
    }
  };
  visit(rootPath, "");
  const rootAfter = lstatSync(rootPath, { bigint: true });
  if (statFingerprint(root) !== statFingerprint(rootAfter)) {
    throw new Error(`${label} root changed during traversal`);
  }
  const manifest = entries.sort(codeUnitCompare).join("");
  return {
    rootPath,
    manifest,
    manifestSha256: sha256(manifest),
    entryCount: entries.length,
  };
}

function deriveTree(
  rootPath: string,
  label: string,
  allowedRootPaths: readonly string[] = [rootPath],
): SentinelRuntimeTreeArtifact {
  const first = treeManifestOnce(rootPath, label, allowedRootPaths);
  const second = treeManifestOnce(rootPath, label, allowedRootPaths);
  if (first.manifest !== second.manifest || first.entryCount !== second.entryCount) {
    throw new Error(`${label} changed between complete traversals`);
  }
  return first;
}

function defaultRunCommand(
  invocation: SentinelRuntimeCommandInvocation,
): SentinelRuntimeCommandResult {
  const result = spawnSync(invocation.executablePath, [...invocation.arguments], {
    cwd: invocation.cwd,
    encoding: null,
    env: { ...invocation.environment },
    maxBuffer: 64 * 1024 * 1024,
  });
  return {
    exitCode: result.status ?? -1,
    signal: result.signal,
    stdout: result.stdout ?? Buffer.alloc(0),
    stderr: result.stderr ?? Buffer.from(result.error?.message ?? "", "utf8"),
  };
}

function runCaptured(
  dependencies: SentinelRuntimeClosureDependencies,
  invocation: SentinelRuntimeCommandInvocation,
  label: string,
): CommandCapture {
  const result = dependencies.runCommand(invocation);
  const stdout = Buffer.from(result.stdout);
  const stderr = Buffer.from(result.stderr);
  const artifact: SentinelRuntimeCommandArtifact = {
    ...invocation,
    stdoutBase64: stdout.toString("base64"),
    stdoutSha256: sha256(stdout),
    stderrBase64: stderr.toString("base64"),
    stderrSha256: sha256(stderr),
    exitCode: result.exitCode,
    signal: result.signal,
  };
  if (result.exitCode !== 0 || result.signal !== null || stderr.byteLength !== 0) {
    throw new Error(`${label} command did not complete cleanly`);
  }
  return { artifact, stdout };
}

function strictLine(bytes: Buffer, expression: RegExp, label: string): string {
  const value = bytes.toString("utf8");
  if (!Buffer.from(value, "utf8").equals(bytes) || !value.endsWith("\n") || value.slice(0, -1).includes("\n")) {
    throw new Error(`${label} output must be exactly one UTF-8 line`);
  }
  const line = value.slice(0, -1);
  if (!expression.test(line)) throw new Error(`${label} output has an invalid value`);
  return line;
}

function validatePipFreeze(bytes: Buffer): {
  readonly value: string;
  readonly identities: readonly string[];
} {
  const value = bytes.toString("utf8");
  if (!Buffer.from(value, "utf8").equals(bytes) || value.includes("\0") || value.includes("\r")) {
    throw new Error("pip freeze output must be canonical UTF-8 with LF newlines");
  }
  if (value !== "" && !value.endsWith("\n")) throw new Error("pip freeze output must end in LF");
  const lines = value === "" ? [] : value.slice(0, -1).split("\n");
  if (lines.some((line) => line.length === 0) || new Set(lines).size !== lines.length) {
    throw new Error("pip freeze output contains blank or duplicate lines");
  }
  const identities = lines.map((line) => {
    const match = /^([^=]+)==([^=]+)$/u.exec(line);
    if (!match) throw new Error("pip freeze must bind every distribution as name==version");
    return `${canonicalDistributionName(match[1] as string)}==${match[2] as string}`;
  }).sort(codeUnitCompare);
  if (new Set(identities).size !== identities.length) {
    throw new Error("pip freeze contains duplicate normalized distribution names");
  }
  return { value, identities };
}

function validateRuntimeIgnoredPaths(bytes: Buffer, upstream: boolean): void {
  const text = bytes.toString("utf8");
  if (
    !Buffer.from(text, "utf8").equals(bytes) ||
    (text !== "" && !text.endsWith("\0"))
  ) throw new Error("git ignored-path listing is not canonical NUL-delimited UTF-8");
  const paths = text === "" ? [] : text.slice(0, -1).split("\0");
  if (new Set(paths).size !== paths.length) {
    throw new Error("git ignored-path listing contains duplicates");
  }
  for (const path of paths) {
    if (
      path.length === 0 || path.startsWith("/") || path.startsWith("../") ||
      path.includes("/../") || path.includes("//") || /[\\\r\n\t]/u.test(path)
    ) throw new Error("git ignored-path listing contains an unsafe path");
    const allowed = upstream
      ? path === "frontend/node_modules/"
      : path === "node_modules/" ||
        /^packages\/[A-Za-z0-9._-]+\/(?:dist|node_modules)\/$/u.test(path) ||
        /^packages\/[A-Za-z0-9._-]+\/(?:\.tsbuildinfo|tsconfig\.tsbuildinfo)$/u.test(path);
    if (!allowed) throw new Error(`unexpected ignored runtime path: ${path}`);
  }
}

function gitArtifact(
  checkoutPath: string,
  gitExecutablePath: string,
  environment: Readonly<Record<string, string>>,
  dependencies: SentinelRuntimeClosureDependencies,
  ignoredPolicy: "substrate-runtime" | "sentinel-upstream",
): SentinelRuntimeGitArtifact {
  const gitDirectory = resolve(checkoutPath, ".git");
  const invocationPrefix = [
    "--exec-path=/dev/null",
    "--no-pager",
    "--no-replace-objects",
    "--literal-pathspecs",
    `--git-dir=${gitDirectory}`,
    `--work-tree=${checkoutPath}`,
    "-c", `core.worktree=${checkoutPath}`,
    "-c", "core.fileMode=true",
    "-c", "core.fsmonitor=false",
    "-c", "core.attributesFile=/dev/null",
    "-c", "core.excludesFile=/dev/null",
    "-c", "core.hooksPath=/dev/null",
  ] as const;
  const invoke = (arguments_: readonly string[], label: string): CommandCapture =>
    runCaptured(dependencies, {
      executablePath: gitExecutablePath,
      arguments: [...invocationPrefix, ...arguments_],
      cwd: checkoutPath,
      environment,
    }, label);
  const head = invoke(["rev-parse", "--verify", "HEAD"], "git HEAD");
  const tree = invoke(["rev-parse", "--verify", "HEAD^{tree}"], "git tree");
  const status = invoke(
    ["status", "--porcelain=v1", "--untracked-files=all"],
    "git status",
  );
  const indexFlags = invoke(["ls-files", "-v"], "git index flags");
  const trackedTree = invoke(
    ["ls-tree", "-r", "-z", "--full-tree", "HEAD"],
    "git tracked working tree",
  );
  const ignored = invoke(
    ["ls-files", "--others", "--ignored", "--exclude-standard", "--directory", "-z"],
    "git ignored paths",
  );
  const revision = strictLine(head.stdout, GIT_SHA1, "git HEAD");
  const sourceTreeHash = strictLine(tree.stdout, GIT_SHA1, "git tree");
  if (status.stdout.byteLength !== 0) throw new Error(`${checkoutPath} git checkout is dirty`);
  const indexFlagText = indexFlags.stdout.toString("utf8");
  if (
    !Buffer.from(indexFlagText, "utf8").equals(indexFlags.stdout) ||
    indexFlagText.includes("\0") ||
    indexFlagText.includes("\r") ||
    (indexFlagText !== "" && !indexFlagText.endsWith("\n")) ||
    indexFlagText.split("\n").filter(Boolean).some((line) => !line.startsWith("H "))
  ) {
    throw new Error(`${checkoutPath} has hidden or nonstandard git index flags`);
  }
  assertSentinelTrackedWorkingTreeMatchesHead(
    checkoutPath,
    trackedTree.stdout,
    sourceTreeHash,
  );
  validateRuntimeIgnoredPaths(ignored.stdout, ignoredPolicy === "sentinel-upstream");
  return {
    checkoutPath,
    revision,
    sourceTreeHash,
    ignoredPathListingSha256: sha256(ignored.stdout),
    clean: true,
    commands: [
      head.artifact,
      tree.artifact,
      status.artifact,
      indexFlags.artifact,
      trackedTree.artifact,
      ignored.artifact,
    ],
  };
}

function parseCsv(text: string): readonly (readonly string[])[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index] as string;
    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        if (character === "\r" || character === "\n") throw new Error("RECORD fields may not contain newlines");
        field += character;
      }
    } else if (character === '"' && field.length === 0) {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      if (field.endsWith("\r")) field = field.slice(0, -1);
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }
  if (quoted) throw new Error("RECORD contains an unterminated quoted field");
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  if (rows.some((candidate) => candidate.length !== 3)) throw new Error("RECORD must have three columns");
  return rows;
}

function metadataField(metadata: string, field: string): string {
  const matches = metadata
    .split(/\r?\n/u)
    .filter((line) => line.startsWith(`${field}: `))
    .map((line) => line.slice(field.length + 2));
  if (matches.length !== 1 || !DISTRIBUTION_FIELD.test(matches[0] as string)) {
    throw new Error(`distribution METADATA must contain exactly one ${field}`);
  }
  return matches[0] as string;
}

function canonicalDistributionName(name: string): string {
  const canonical = name.toLowerCase().replace(/[._-]+/gu, "-");
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/u.test(canonical)) {
    throw new Error(`distribution name ${name} is not canonicalizable`);
  }
  return canonical;
}

function recordDigest(value: string): string | null {
  if (value === "") return null;
  if (!value.startsWith("sha256=")) throw new Error("RECORD uses a non-sha256 digest");
  const encoded = value.slice("sha256=".length);
  if (!/^[A-Za-z0-9_-]{43}$/u.test(encoded)) throw new Error("RECORD sha256 is malformed");
  const digest = Buffer.from(encoded, "base64url");
  if (digest.byteLength !== 32 || digest.toString("base64url") !== encoded) {
    throw new Error("RECORD sha256 is not canonical base64url");
  }
  return digest.toString("hex");
}

function distributionManifest(
  environmentRootPath: string,
  siteRootPaths: readonly string[],
): { manifest: string; sha256: string; identities: readonly string[] } {
  const environmentRootReal = realpathSync(environmentRootPath);
  const distributions: DistributionManifestEntry[] = [];
  const names = new Set<string>();
  const ownedPaths = new Set<string>();
  const siteTrees = siteRootPaths.map((siteRootPath) => deriveTree(siteRootPath, "Python site-packages"));
  for (const siteRootPath of [...siteRootPaths].sort(codeUnitCompare)) {
    const siteRootReal = realpathSync(siteRootPath);
    if (!pathWithin(siteRootReal, environmentRootReal)) {
      throw new Error("Python site-packages root escapes the environment root");
    }
    const distInfoNames = readdirSync(siteRootPath)
      .filter((name) => name.endsWith(".dist-info"))
      .sort(codeUnitCompare);
    for (const distInfoName of distInfoNames) {
      validateRelativeName(distInfoName, "Python dist-info");
      const distInfoPath = resolve(siteRootPath, distInfoName);
      if (!lstatSync(distInfoPath).isDirectory()) throw new Error("dist-info entry must be a directory");
      const metadataPath = resolve(distInfoPath, "METADATA");
      const recordPath = resolve(distInfoPath, "RECORD");
      const metadataBytes = readStableRegular(metadataPath, "distribution METADATA").bytes;
      const recordBytes = readStableRegular(recordPath, "distribution RECORD").bytes;
      const metadata = metadataBytes.toString("utf8");
      if (!Buffer.from(metadata, "utf8").equals(metadataBytes)) throw new Error("METADATA is not UTF-8");
      const name = metadataField(metadata, "Name");
      const version = metadataField(metadata, "Version");
      const canonicalName = canonicalDistributionName(name);
      if (names.has(canonicalName)) throw new Error(`duplicate installed distribution ${canonicalName}`);
      names.add(canonicalName);
      const recordText = recordBytes.toString("utf8");
      if (!Buffer.from(recordText, "utf8").equals(recordBytes)) throw new Error("RECORD is not UTF-8");
      const files: DistributionFile[] = [];
      const localPaths = new Set<string>();
      for (const row of parseCsv(recordText)) {
        const [recordRelativePath, declaredDigest, declaredSize] = row as readonly [string, string, string];
        if (
          !recordRelativePath ||
          isAbsolute(recordRelativePath) ||
          recordRelativePath.includes("\\") ||
          normalize(recordRelativePath) !== recordRelativePath ||
          /[\0\r\n\t]/u.test(recordRelativePath)
        ) {
          throw new Error("RECORD contains an aliased or unsafe path");
        }
        const filePath = resolve(siteRootPath, recordRelativePath);
        const fileReal = realpathSync(filePath);
        if (!pathWithin(fileReal, environmentRootReal)) throw new Error("RECORD file escapes Python environment");
        const environmentRelativePath = relative(environmentRootReal, fileReal).split(sep).join("/");
        if (localPaths.has(environmentRelativePath) || ownedPaths.has(environmentRelativePath)) {
          throw new Error(`duplicate RECORD path ${environmentRelativePath}`);
        }
        localPaths.add(environmentRelativePath);
        ownedPaths.add(environmentRelativePath);
        const stable = readStableRegular(fileReal, `distribution file ${recordRelativePath}`);
        const actualSha256 = sha256(stable.bytes);
        const expectedSha256 = recordDigest(declaredDigest);
        if (expectedSha256 !== null && expectedSha256 !== actualSha256) {
          throw new Error(`RECORD digest mismatch for ${recordRelativePath}`);
        }
        let size: number | null = null;
        if (declaredSize !== "") {
          if (!/^(?:0|[1-9][0-9]*)$/u.test(declaredSize)) throw new Error("RECORD size is malformed");
          size = Number(declaredSize);
          if (!Number.isSafeInteger(size) || size !== stable.bytes.byteLength) {
            throw new Error(`RECORD size mismatch for ${recordRelativePath}`);
          }
        }
        files.push({
          path: environmentRelativePath,
          type: "file",
          mode: stable.mode.toString(8).padStart(4, "0"),
          sha256: actualSha256,
          recordSha256: expectedSha256,
          recordSize: size,
        });
      }
      files.sort((left, right) => codeUnitCompare(left.path, right.path));
      distributions.push({
        canonicalName,
        name,
        version,
        metadataSha256: sha256(metadataBytes),
        recordSha256: sha256(recordBytes),
        files,
      });
    }
  }
  distributions.sort((left, right) => codeUnitCompare(left.canonicalName, right.canonicalName));
  const manifest = sentinelProductionCanonicalJson({
    schemaVersion: "canonical-name-version-files-record-sha256-v1",
    environmentRootPath,
    siteTrees: siteTrees
      .map(({ rootPath, manifestSha256, entryCount }) => ({ rootPath, manifestSha256, entryCount }))
      .sort((left, right) => codeUnitCompare(left.rootPath, right.rootPath)),
    distributions,
  });
  return {
    manifest,
    sha256: sha256(manifest),
    identities: distributions.map(({ canonicalName, version }) => `${canonicalName}==${version}`),
  };
}

function validatePaths(paths: SentinelRuntimeClosurePaths): void {
  const independentPaths: readonly [string, string][] = [
    ["git executable", paths.gitExecutablePath],
    ["root package.json", paths.rootPackageJsonPath],
    ["pnpm workspace manifest", paths.pnpmWorkspaceManifestPath],
    ["root tsconfig", paths.rootTsconfigPath],
    ["tsconfig base", paths.tsconfigBasePath],
    ["public eval package.json", paths.publicEvalPackageJsonPath],
    ["public eval tsconfig", paths.publicEvalTsconfigPath],
    ["pnpm workspace lock", paths.pnpmWorkspaceLockPath],
    ["runner script", paths.runnerScriptPath],
    ["supervisor script", paths.supervisorScriptPath],
    ["verifier script", paths.verifierScriptPath],
    ["agent script", paths.agentScriptPath],
    ["provider proxy script", paths.providerProxyScriptPath],
    ["state sidecar script", paths.stateSidecarScriptPath],
    ["Node requested entry", paths.nodeRequestedPath],
    ["npm requested CLI", paths.npmRequestedCliPath],
    ["Python requested venv entry", paths.pythonRequestedVenvPath],
    ["Python pyvenv.cfg", paths.pythonPyvenvConfigPath],
    ["Playwright package metadata", paths.playwrightPackageMetadataPath],
    ["Playwright core package metadata", paths.playwrightCorePackageMetadataPath],
    ["browser executable", paths.browserExecutablePath],
    ["upstream frontend package lock", paths.upstreamFrontendPackageLockPath],
    ["upstream server requirements", paths.upstreamServerRequirementsPath],
  ];
  assertDistinct(independentPaths);
  const rootPaths: Array<readonly [string, string]> = [
    ["substrate checkout", paths.substrateCheckoutPath],
    ["substrate packages", paths.substratePackagesRootPath],
    ["substrate installed dependencies", paths.substrateInstalledDependenciesRootPath],
    ["public eval compiled output", paths.publicEvalCompiledOutputRootPath],
    ["Node allowed root", paths.nodeAllowedRootPath],
    ["npm allowed root", paths.npmAllowedRootPath],
    ["Python environment root", paths.pythonEnvironmentRootPath],
    ["Python runtime root", paths.pythonRuntimeRootPath],
    ["Python stdlib root", paths.pythonStdlibRootPath],
    ["Python executable allowed root", paths.pythonExecutableAllowedRootPath],
    ["browser bundle root", paths.browserBundleRootPath],
    ["Playwright library root", paths.playwrightLibraryRootPath],
    ["Playwright core library root", paths.playwrightCoreLibraryRootPath],
    ["upstream checkout", paths.upstreamCheckoutPath],
    ["upstream frontend installed root", paths.upstreamFrontendInstalledRootPath],
  ];
  for (const [index, path] of paths.pythonSitePackagesRootPaths.entries()) {
    rootPaths.push([`Python site-packages ${index}`, path]);
  }
  for (const [label, path] of rootPaths) assertCanonicalAbsolute(path, label);
  if (paths.pythonSitePackagesRootPaths.length === 0) throw new Error("at least one Python site-packages root is required");
  if (new Set(paths.pythonSitePackagesRootPaths).size !== paths.pythonSitePackagesRootPaths.length) {
    throw new Error("Python site-packages roots contain duplicates");
  }
  const substrateDist = resolve(
    paths.substrateCheckoutPath,
    "packages/public-eval-corners/dist",
  );
  assertExactPath(paths.rootPackageJsonPath, resolve(paths.substrateCheckoutPath, "package.json"), "root package.json");
  assertExactPath(
    paths.pnpmWorkspaceManifestPath,
    resolve(paths.substrateCheckoutPath, "pnpm-workspace.yaml"),
    "pnpm workspace manifest",
  );
  assertExactPath(paths.rootTsconfigPath, resolve(paths.substrateCheckoutPath, "tsconfig.json"), "root tsconfig");
  assertExactPath(paths.tsconfigBasePath, resolve(paths.substrateCheckoutPath, "tsconfig.base.json"), "tsconfig base");
  assertExactPath(
    paths.publicEvalPackageJsonPath,
    resolve(paths.substrateCheckoutPath, "packages/public-eval-corners/package.json"),
    "public eval package.json",
  );
  assertExactPath(
    paths.publicEvalTsconfigPath,
    resolve(paths.substrateCheckoutPath, "packages/public-eval-corners/tsconfig.json"),
    "public eval tsconfig",
  );
  assertExactPath(paths.substratePackagesRootPath, resolve(paths.substrateCheckoutPath, "packages"), "substrate packages");
  assertExactPath(
    paths.substrateInstalledDependenciesRootPath,
    resolve(paths.substrateCheckoutPath, "node_modules"),
    "substrate installed dependencies",
  );
  assertExactPath(paths.publicEvalCompiledOutputRootPath, substrateDist, "public eval compiled output");
  assertExactPath(
    paths.pnpmWorkspaceLockPath,
    resolve(paths.substrateCheckoutPath, "pnpm-lock.yaml"),
    "pnpm workspace lock",
  );
  for (const [label, actual, filename] of [
    ["runner script", paths.runnerScriptPath, "sentinel-production-runner.js"],
    ["supervisor script", paths.supervisorScriptPath, "sentinel-production-supervisor.js"],
    ["verifier script", paths.verifierScriptPath, "sentinel-production-verifier.js"],
    ["agent script", paths.agentScriptPath, "sentinel-general-agent.js"],
    ["provider proxy script", paths.providerProxyScriptPath, "sentinel-general-provider-proxy.js"],
    ["state sidecar script", paths.stateSidecarScriptPath, "production-state-sidecar.js"],
  ] as const) assertExactPath(actual, resolve(substrateDist, filename), label);
  assertExactPath(
    paths.playwrightPackageMetadataPath,
    resolve(paths.substrateCheckoutPath, "node_modules/playwright/package.json"),
    "Playwright package metadata",
  );
  assertExactPath(
    paths.playwrightLibraryRootPath,
    resolve(paths.substrateCheckoutPath, "node_modules/playwright"),
    "Playwright library root",
  );
  assertExactPath(
    paths.playwrightCoreLibraryRootPath,
    resolve(paths.substrateCheckoutPath, "node_modules/playwright-core"),
    "Playwright core library root",
  );
  assertExactPath(
    paths.playwrightCorePackageMetadataPath,
    resolve(paths.playwrightCoreLibraryRootPath, "package.json"),
    "Playwright core package metadata",
  );
  assertExactPath(
    paths.pythonRuntimeRootPath,
    paths.pythonExecutableAllowedRootPath,
    "Python runtime root",
  );
  assertExactPath(
    paths.pythonPyvenvConfigPath,
    resolve(paths.pythonEnvironmentRootPath, "pyvenv.cfg"),
    "pyvenv.cfg",
  );
  assertExactPath(
    paths.upstreamFrontendPackageLockPath,
    resolve(paths.upstreamCheckoutPath, "frontend/package-lock.json"),
    "upstream frontend package lock",
  );
  assertExactPath(
    paths.upstreamFrontendInstalledRootPath,
    resolve(paths.upstreamCheckoutPath, "frontend/node_modules"),
    "upstream frontend installed dependencies",
  );
  assertExactPath(
    paths.upstreamServerRequirementsPath,
    resolve(paths.upstreamCheckoutPath, "server/requirements.txt"),
    "upstream server requirements",
  );
  for (const [label, path, root] of [
    ["root package.json", paths.rootPackageJsonPath, paths.substrateCheckoutPath],
    ["pnpm workspace manifest", paths.pnpmWorkspaceManifestPath, paths.substrateCheckoutPath],
    ["root tsconfig", paths.rootTsconfigPath, paths.substrateCheckoutPath],
    ["tsconfig base", paths.tsconfigBasePath, paths.substrateCheckoutPath],
    ["public eval package.json", paths.publicEvalPackageJsonPath, paths.substrateCheckoutPath],
    ["public eval tsconfig", paths.publicEvalTsconfigPath, paths.substrateCheckoutPath],
    ["substrate packages", paths.substratePackagesRootPath, paths.substrateCheckoutPath],
    ["substrate installed dependencies", paths.substrateInstalledDependenciesRootPath, paths.substrateCheckoutPath],
    ["public eval compiled output", paths.publicEvalCompiledOutputRootPath, paths.substrateCheckoutPath],
    ["pnpm workspace lock", paths.pnpmWorkspaceLockPath, paths.substrateCheckoutPath],
    ["runner script", paths.runnerScriptPath, paths.substrateCheckoutPath],
    ["supervisor script", paths.supervisorScriptPath, paths.substrateCheckoutPath],
    ["verifier script", paths.verifierScriptPath, paths.substrateCheckoutPath],
    ["agent script", paths.agentScriptPath, paths.substrateCheckoutPath],
    ["provider proxy script", paths.providerProxyScriptPath, paths.substrateCheckoutPath],
    ["state sidecar script", paths.stateSidecarScriptPath, paths.substrateCheckoutPath],
    ["Playwright package metadata", paths.playwrightPackageMetadataPath, paths.substrateCheckoutPath],
    ["Playwright core package metadata", paths.playwrightCorePackageMetadataPath, paths.substrateCheckoutPath],
    ["Playwright library root", paths.playwrightLibraryRootPath, paths.substrateInstalledDependenciesRootPath],
    ["Playwright core library root", paths.playwrightCoreLibraryRootPath, paths.substrateInstalledDependenciesRootPath],
    ["pyvenv.cfg", paths.pythonPyvenvConfigPath, paths.pythonEnvironmentRootPath],
    ["Python stdlib", paths.pythonStdlibRootPath, paths.pythonRuntimeRootPath],
    ["upstream frontend package lock", paths.upstreamFrontendPackageLockPath, paths.upstreamCheckoutPath],
    ["upstream frontend installed dependencies", paths.upstreamFrontendInstalledRootPath, paths.upstreamCheckoutPath],
    ["upstream server requirements", paths.upstreamServerRequirementsPath, paths.upstreamCheckoutPath],
  ] as const) assertRealContained(path, root, label);
  for (const siteRoot of paths.pythonSitePackagesRootPaths) {
    assertRealContained(siteRoot, paths.pythonEnvironmentRootPath, "Python site-packages");
  }
}

/** Reconstruct the signed closure from bytes, process output, clean git objects, and full trees. */
export function deriveSentinelRuntimeClosure(
  paths: SentinelRuntimeClosurePaths,
  dependencies: SentinelRuntimeClosureDependencies = { runCommand: defaultRunCommand },
): SentinelRuntimeClosureDerivation {
  if ((dependencies.platform ?? process.platform) === "darwin" && paths.gitExecutablePath === "/usr/bin/git") {
    throw new Error("macOS /usr/bin/git is a launcher; bind the direct developer-tool Git executable");
  }
  validatePaths(paths);
  if (realpathSync(paths.gitExecutablePath) !== paths.gitExecutablePath) {
    throw new Error("Git executable must be a canonical direct real path");
  }
  const environment = executionEnvironment(dependencies, paths.nodeRequestedPath);
  const executionEnvironmentManifest = sentinelProductionCanonicalJson(environment);
  const boundPathsManifest = runtimeBoundPathsManifest(paths);
  const gitExecutable = readStableRegular(paths.gitExecutablePath, "git executable");
  const gitVersion = runCaptured(dependencies, {
    executablePath: paths.gitExecutablePath,
    arguments: ["--version"],
    cwd: paths.substrateCheckoutPath,
    environment,
  }, "git version");
  const gitVersionValue = strictLine(gitVersion.stdout, GIT_VERSION, "git version");
  const substrateGit = gitArtifact(
    paths.substrateCheckoutPath,
    paths.gitExecutablePath,
    environment,
    dependencies,
    "substrate-runtime",
  );
  const upstreamGit = gitArtifact(
    paths.upstreamCheckoutPath,
    paths.gitExecutablePath,
    environment,
    dependencies,
    "sentinel-upstream",
  );
  const node = readStableEntry(paths.nodeRequestedPath, paths.nodeAllowedRootPath, "Node entry");
  const npm = readStableEntry(paths.npmRequestedCliPath, paths.npmAllowedRootPath, "npm CLI entry");
  const python = readStableEntry(
    paths.pythonRequestedVenvPath,
    paths.pythonExecutableAllowedRootPath,
    "Python venv entry",
  );
  const nodeVersion = runCaptured(dependencies, {
    executablePath: paths.nodeRequestedPath,
    arguments: ["--version"],
    cwd: paths.substrateCheckoutPath,
    environment,
  }, "Node version");
  const npmVersion = runCaptured(dependencies, {
    executablePath: paths.nodeRequestedPath,
    arguments: [paths.npmRequestedCliPath, "--version"],
    cwd: paths.substrateCheckoutPath,
    environment,
  }, "npm version");
  const pythonVersion = runCaptured(dependencies, {
    executablePath: paths.pythonRequestedVenvPath,
    arguments: ["--version"],
    cwd: paths.upstreamCheckoutPath,
    environment,
  }, "Python version");
  const pipFreeze = runCaptured(dependencies, {
    executablePath: paths.pythonRequestedVenvPath,
    arguments: ["-m", "pip", "freeze", "--all"],
    cwd: paths.upstreamCheckoutPath,
    environment,
  }, "pip freeze");
  const nodeVersionValue = strictLine(nodeVersion.stdout, NODE_VERSION, "Node version");
  const npmVersionValue = strictLine(npmVersion.stdout, NPM_VERSION, "npm version");
  const pythonVersionValue = strictLine(pythonVersion.stdout, PYTHON_VERSION, "Python version");
  const pipFreezeValue = validatePipFreeze(pipFreeze.stdout);
  const distributions = distributionManifest(
    paths.pythonEnvironmentRootPath,
    paths.pythonSitePackagesRootPaths,
  );
  if (
    pipFreezeValue.identities.length !== distributions.identities.length ||
    pipFreezeValue.identities.some((identity, index) => identity !== distributions.identities[index])
  ) {
    throw new Error("pip freeze does not exactly match independently installed distributions");
  }
  const workspacePackagesTree = deriveTree(
    paths.substratePackagesRootPath,
    "substrate workspace packages",
    [paths.substratePackagesRootPath, paths.substrateInstalledDependenciesRootPath],
  );
  const workspaceInstalledDependenciesTree = deriveTree(
    paths.substrateInstalledDependenciesRootPath,
    "substrate installed dependencies",
    [paths.substrateInstalledDependenciesRootPath, paths.substratePackagesRootPath],
  );
  const publicEvalCompiledOutputTree = deriveTree(
    paths.publicEvalCompiledOutputRootPath,
    "public eval compiled output",
    [paths.publicEvalCompiledOutputRootPath],
  );
  const pythonEnvironmentTree = deriveTree(
    paths.pythonEnvironmentRootPath,
    "Python virtual environment",
    [paths.pythonEnvironmentRootPath, paths.pythonRuntimeRootPath],
  );
  const pythonRuntimeTree = deriveTree(
    paths.pythonRuntimeRootPath,
    "Python interpreter runtime",
    [paths.pythonRuntimeRootPath],
  );
  const pythonStdlibTree = deriveTree(
    paths.pythonStdlibRootPath,
    "Python standard library",
    [paths.pythonRuntimeRootPath],
  );
  const packageMetadata = readStableRegular(
    paths.playwrightPackageMetadataPath,
    "Playwright package metadata",
  );
  let packageJson: unknown;
  try {
    packageJson = JSON.parse(packageMetadata.bytes.toString("utf8"));
  } catch {
    throw new Error("Playwright package metadata is not JSON");
  }
  if (
    typeof packageJson !== "object" ||
    packageJson === null ||
    Array.isArray(packageJson) ||
    (packageJson as { name?: unknown }).name !== "playwright" ||
    (packageJson as { version?: unknown }).version !== "1.56.1"
  ) {
    throw new Error("Playwright package metadata must declare playwright version 1.56.1");
  }
  const corePackageMetadata = readStableRegular(
    paths.playwrightCorePackageMetadataPath,
    "Playwright core package metadata",
  );
  let corePackageJson: unknown;
  try {
    corePackageJson = JSON.parse(corePackageMetadata.bytes.toString("utf8"));
  } catch {
    throw new Error("Playwright core package metadata is not JSON");
  }
  if (
    typeof corePackageJson !== "object" ||
    corePackageJson === null ||
    Array.isArray(corePackageJson) ||
    (corePackageJson as { name?: unknown }).name !== "playwright-core" ||
    (corePackageJson as { version?: unknown }).version !== "1.56.1"
  ) {
    throw new Error("Playwright core package metadata must declare playwright-core version 1.56.1");
  }
  const playwrightLibraryTree = deriveTree(
    paths.playwrightLibraryRootPath,
    "Playwright library",
    [paths.substrateInstalledDependenciesRootPath],
  );
  const playwrightCoreLibraryTree = deriveTree(
    paths.playwrightCoreLibraryRootPath,
    "Playwright core library",
    [paths.substrateInstalledDependenciesRootPath],
  );
  const browserTree = deriveTree(paths.browserBundleRootPath, "browser bundle");
  const browserRootReal = realpathSync(paths.browserBundleRootPath);
  const browserExecutableReal = realpathSync(paths.browserExecutablePath);
  if (!pathWithin(browserExecutableReal, browserRootReal)) {
    throw new Error("browser executable escapes the browser bundle");
  }
  const browserExecutable = readStableRegular(browserExecutableReal, "browser executable");
  if ((browserExecutable.mode & 0o111) === 0) throw new Error("browser executable is not executable");
  const frontendTree = deriveTree(
    paths.upstreamFrontendInstalledRootPath,
    "upstream frontend installed dependencies",
  );
  const rootPackageJson = readStableRegular(paths.rootPackageJsonPath, "root package.json");
  const pnpmWorkspaceManifest = readStableRegular(
    paths.pnpmWorkspaceManifestPath,
    "pnpm workspace manifest",
  );
  const rootTsconfig = readStableRegular(paths.rootTsconfigPath, "root tsconfig");
  const tsconfigBase = readStableRegular(paths.tsconfigBasePath, "tsconfig base");
  const publicEvalPackageJson = readStableRegular(
    paths.publicEvalPackageJsonPath,
    "public eval package.json",
  );
  const publicEvalTsconfig = readStableRegular(
    paths.publicEvalTsconfigPath,
    "public eval tsconfig",
  );
  const lock = readStableRegular(paths.pnpmWorkspaceLockPath, "pnpm workspace lock");
  const runner = readStableRegular(paths.runnerScriptPath, "runner script");
  const supervisor = readStableRegular(paths.supervisorScriptPath, "supervisor script");
  const verifier = readStableRegular(paths.verifierScriptPath, "verifier script");
  const agent = readStableRegular(paths.agentScriptPath, "agent script");
  const provider = readStableRegular(paths.providerProxyScriptPath, "provider proxy script");
  const sidecar = readStableRegular(paths.stateSidecarScriptPath, "state sidecar script");
  const pyvenv = readStableRegular(paths.pythonPyvenvConfigPath, "pyvenv.cfg");
  const frontendLock = readStableRegular(
    paths.upstreamFrontendPackageLockPath,
    "upstream frontend package lock",
  );
  const requirements = readStableRegular(
    paths.upstreamServerRequirementsPath,
    "upstream server requirements",
  );
  const withoutHash: SentinelRuntimeClosure = {
    closureSha256: "0".repeat(64),
    closureSchemaVersion: "pm.public-eval-corners.sentinel-runtime-closure.v3",
    closureDerivation: "canonical-runtime-transitive-trees-and-git-listings-v3",
    requestedEntryHashSemantics: "sha256-of-symlink-target-utf8-or-regular-file-bytes-v1",
    treeHashSemantics: "sha256-canonical-relative-path-mode-type-contenthash-v1",
    runnerReconstructsAndVerifiesClosure: true,
    substrateRevision: substrateGit.revision,
    sourceTreeHash: substrateGit.sourceTreeHash,
    workingTreeClean: true,
    pnpmWorkspaceLockSha256: sha256(lock.bytes),
    runnerScriptSha256: sha256(runner.bytes),
    supervisorScriptSha256: sha256(supervisor.bytes),
    verifierScriptSha256: sha256(verifier.bytes),
    agentScriptSha256: sha256(agent.bytes),
    providerProxyScriptSha256: sha256(provider.bytes),
    stateSidecarScriptSha256: sha256(sidecar.bytes),
    executionEnvironment: {
      schemaVersion: "pm.public-eval-corners.sentinel-sanitized-environment.v2",
      values: environment,
      environmentSha256: sha256(executionEnvironmentManifest),
      inheritsHostEnvironment: false,
    },
    git: {
      version: gitVersionValue,
      executablePath: paths.gitExecutablePath,
      executableSha256: sha256(gitExecutable.bytes),
      invocationEnvironmentSha256: sha256(executionEnvironmentManifest),
    },
    workspace: {
      checkoutPath: paths.substrateCheckoutPath,
      ignoredPathListingSha256: substrateGit.ignoredPathListingSha256,
      rootPackageJsonSha256: sha256(rootPackageJson.bytes),
      pnpmWorkspaceManifestSha256: sha256(pnpmWorkspaceManifest.bytes),
      rootTsconfigSha256: sha256(rootTsconfig.bytes),
      tsconfigBaseSha256: sha256(tsconfigBase.bytes),
      publicEvalPackageManifestSha256: sha256(publicEvalPackageJson.bytes),
      publicEvalTsconfigSha256: sha256(publicEvalTsconfig.bytes),
      packagesRootPath: paths.substratePackagesRootPath,
      packagesTreeSha256: workspacePackagesTree.manifestSha256,
      packagesTreeEntryCount: workspacePackagesTree.entryCount,
      installedDependenciesRootPath: paths.substrateInstalledDependenciesRootPath,
      installedDependenciesTreeSha256: workspaceInstalledDependenciesTree.manifestSha256,
      installedDependenciesTreeEntryCount: workspaceInstalledDependenciesTree.entryCount,
      compiledOutputRootPath: paths.publicEvalCompiledOutputRootPath,
      compiledOutputTreeSha256: publicEvalCompiledOutputTree.manifestSha256,
      compiledOutputTreeEntryCount: publicEvalCompiledOutputTree.entryCount,
    },
    node: {
      version: nodeVersionValue,
      requestedPath: node.requestedPath,
      requestedEntrySha256: node.requestedEntrySha256,
      resolvedPath: node.resolvedPath,
      resolvedExecutableSha256: node.resolvedSha256,
    },
    npm: {
      version: npmVersionValue,
      requestedCliPath: npm.requestedPath,
      requestedCliEntrySha256: npm.requestedEntrySha256,
      resolvedCliPath: npm.resolvedPath,
      resolvedCliSha256: npm.resolvedSha256,
    },
    python: {
      version: pythonVersionValue,
      requestedVenvPath: python.requestedPath,
      venvEntrySha256: python.requestedEntrySha256,
      resolvedExecutablePath: python.resolvedPath,
      realExecutableSha256: python.resolvedSha256,
      pyvenvConfigSha256: sha256(pyvenv.bytes),
      pipFreezeSha256: sha256(pipFreeze.stdout),
      installedDistributionsManifestSha256: distributions.sha256,
      installedDistributionsManifestSchema: "canonical-name-version-files-record-sha256-v1",
      environmentRootPath: paths.pythonEnvironmentRootPath,
      environmentTreeSha256: pythonEnvironmentTree.manifestSha256,
      environmentTreeEntryCount: pythonEnvironmentTree.entryCount,
      runtimeRootPath: paths.pythonRuntimeRootPath,
      runtimeTreeSha256: pythonRuntimeTree.manifestSha256,
      runtimeTreeEntryCount: pythonRuntimeTree.entryCount,
      stdlibRootPath: paths.pythonStdlibRootPath,
      stdlibTreeSha256: pythonStdlibTree.manifestSha256,
      stdlibTreeEntryCount: pythonStdlibTree.entryCount,
    },
    browser: {
      playwrightVersion: "1.56.1",
      packageMetadataSha256: sha256(packageMetadata.bytes),
      bundleRootPath: paths.browserBundleRootPath,
      bundleTreeSha256: browserTree.manifestSha256,
      executablePath: paths.browserExecutablePath,
      executableSha256: sha256(browserExecutable.bytes),
      libraryRootPath: paths.playwrightLibraryRootPath,
      libraryTreeSha256: playwrightLibraryTree.manifestSha256,
      libraryTreeEntryCount: playwrightLibraryTree.entryCount,
      coreLibraryRootPath: paths.playwrightCoreLibraryRootPath,
      coreLibraryTreeSha256: playwrightCoreLibraryTree.manifestSha256,
      coreLibraryTreeEntryCount: playwrightCoreLibraryTree.entryCount,
      corePackageMetadataSha256: sha256(corePackageMetadata.bytes),
    },
    upstream: {
      revision: upstreamGit.revision,
      sourceTreeHash: upstreamGit.sourceTreeHash,
      ignoredPathListingSha256: upstreamGit.ignoredPathListingSha256,
      frontendPackageLockSha256: sha256(frontendLock.bytes),
      frontendInstalledTreeSha256: frontendTree.manifestSha256,
      serverRequirementsSha256: sha256(requirements.bytes),
    },
    executionLease: {
      schemaVersion: "pm.public-eval-corners.sentinel-runtime-execution-lease.v1",
      boundPathsManifestSha256: sha256(boundPathsManifest),
      exactBoundPathsRequired: true,
      preAndPostBlockReconstructionRequired: true,
      mutationInvalidatesBlock: true,
      immutableSnapshot: false,
      osBoundaryLimitation:
        "kernel-dynamic-loader-system-libraries-and-in-process-races-outside-user-space-hash-closure",
    },
  };
  const closure: SentinelRuntimeClosure = {
    ...withoutHash,
    closureSha256: sentinelProductionRuntimeClosureSha256(withoutHash),
  };
  const artifactWithoutHash = {
    schemaVersion: "pm.public-eval-corners.sentinel-runtime-closure-artifacts.v4" as const,
    substrateGit,
    upstreamGit,
    commands: {
      gitVersion: gitVersion.artifact,
      nodeVersion: nodeVersion.artifact,
      npmVersion: npmVersion.artifact,
      pythonVersion: pythonVersion.artifact,
      pipFreeze: pipFreeze.artifact,
    },
    pipFreeze: pipFreezeValue.value,
    entries: {
      node: {
        requestedPath: node.requestedPath,
        requestedEntrySha256: node.requestedEntrySha256,
        resolvedPath: node.resolvedPath,
        resolvedSha256: node.resolvedSha256,
      },
      npm: {
        requestedPath: npm.requestedPath,
        requestedEntrySha256: npm.requestedEntrySha256,
        resolvedPath: npm.resolvedPath,
        resolvedSha256: npm.resolvedSha256,
      },
      python: {
        requestedPath: python.requestedPath,
        requestedEntrySha256: python.requestedEntrySha256,
        resolvedPath: python.resolvedPath,
        resolvedSha256: python.resolvedSha256,
      },
    },
    files: {
      gitExecutable: fileArtifact(paths.gitExecutablePath, gitExecutable),
      pnpmWorkspaceLock: fileArtifact(paths.pnpmWorkspaceLockPath, lock),
      rootPackageJson: fileArtifact(paths.rootPackageJsonPath, rootPackageJson),
      pnpmWorkspaceManifest: fileArtifact(paths.pnpmWorkspaceManifestPath, pnpmWorkspaceManifest),
      rootTsconfig: fileArtifact(paths.rootTsconfigPath, rootTsconfig),
      tsconfigBase: fileArtifact(paths.tsconfigBasePath, tsconfigBase),
      publicEvalPackageJson: fileArtifact(paths.publicEvalPackageJsonPath, publicEvalPackageJson),
      publicEvalTsconfig: fileArtifact(paths.publicEvalTsconfigPath, publicEvalTsconfig),
      runnerScript: fileArtifact(paths.runnerScriptPath, runner),
      supervisorScript: fileArtifact(paths.supervisorScriptPath, supervisor),
      verifierScript: fileArtifact(paths.verifierScriptPath, verifier),
      agentScript: fileArtifact(paths.agentScriptPath, agent),
      providerProxyScript: fileArtifact(paths.providerProxyScriptPath, provider),
      stateSidecarScript: fileArtifact(paths.stateSidecarScriptPath, sidecar),
      pyvenvConfig: fileArtifact(paths.pythonPyvenvConfigPath, pyvenv),
      playwrightPackageMetadata: fileArtifact(paths.playwrightPackageMetadataPath, packageMetadata),
      playwrightCorePackageMetadata: fileArtifact(
        paths.playwrightCorePackageMetadataPath,
        corePackageMetadata,
      ),
      browserExecutable: fileArtifact(browserExecutableReal, browserExecutable),
      upstreamFrontendPackageLock: fileArtifact(paths.upstreamFrontendPackageLockPath, frontendLock),
      upstreamServerRequirements: fileArtifact(paths.upstreamServerRequirementsPath, requirements),
    },
    installedDistributionsManifest: distributions.manifest,
    installedDistributionsManifestSha256: distributions.sha256,
    executionEnvironmentManifest,
    boundPathsManifest,
    workspacePackagesTree,
    workspaceInstalledDependenciesTree,
    publicEvalCompiledOutputTree,
    pythonEnvironmentTree,
    pythonRuntimeTree,
    pythonStdlibTree,
    playwrightLibraryTree,
    playwrightCoreLibraryTree,
    browserBundleTree: browserTree,
    upstreamFrontendInstalledTree: frontendTree,
  };
  const artifacts: SentinelRuntimeClosureArtifacts = {
    ...artifactWithoutHash,
    derivationSha256: sha256(sentinelProductionCanonicalJson(artifactWithoutHash)),
  };
  const substrateAfter = gitArtifact(
    paths.substrateCheckoutPath,
    paths.gitExecutablePath,
    environment,
    dependencies,
    "substrate-runtime",
  );
  const upstreamAfter = gitArtifact(
    paths.upstreamCheckoutPath,
    paths.gitExecutablePath,
    environment,
    dependencies,
    "sentinel-upstream",
  );
  if (
    substrateAfter.revision !== substrateGit.revision ||
    substrateAfter.sourceTreeHash !== substrateGit.sourceTreeHash ||
    substrateAfter.ignoredPathListingSha256 !== substrateGit.ignoredPathListingSha256 ||
    upstreamAfter.revision !== upstreamGit.revision ||
    upstreamAfter.sourceTreeHash !== upstreamGit.sourceTreeHash ||
    upstreamAfter.ignoredPathListingSha256 !== upstreamGit.ignoredPathListingSha256
  ) {
    throw new Error("git identity changed during runtime closure derivation");
  }
  return { closure, artifacts };
}

/** Reconstructs every field and rejects any difference from the signed declaration. */
export function verifySentinelRuntimeClosure(
  paths: SentinelRuntimeClosurePaths,
  declared: SentinelRuntimeClosure,
  dependencies: SentinelRuntimeClosureDependencies = { runCommand: defaultRunCommand },
): SentinelRuntimeClosureDerivation {
  const first = deriveSentinelRuntimeClosure(paths, dependencies);
  const reconstructed = deriveSentinelRuntimeClosure(paths, dependencies);
  if (
    first.artifacts.derivationSha256 !== reconstructed.artifacts.derivationSha256 ||
    sentinelProductionCanonicalJson(first.closure) !==
      sentinelProductionCanonicalJson(reconstructed.closure) ||
    !SHA256.test(declared.closureSha256) ||
    sentinelProductionCanonicalJson(reconstructed.closure) !==
      sentinelProductionCanonicalJson(declared)
  ) {
    throw new Error(
      "declared Sentinel runtime closure does not exactly match two stable reconstructions",
    );
  }
  return reconstructed;
}

/** Acquire immediately before launching a block and pass only these paths onward. */
export function acquireSentinelRuntimeExecutionLease(
  paths: SentinelRuntimeClosurePaths,
  declared: SentinelRuntimeClosure,
  dependencies: SentinelRuntimeClosureDependencies = { runCommand: defaultRunCommand },
): SentinelRuntimeExecutionLease {
  const verification = verifySentinelRuntimeClosure(paths, declared, dependencies);
  const frozenPaths = Object.freeze({
    ...paths,
    pythonSitePackagesRootPaths: Object.freeze([...paths.pythonSitePackagesRootPaths]),
  });
  return Object.freeze({
    schemaVersion: "pm.public-eval-corners.sentinel-runtime-execution-lease.v1" as const,
    paths: frozenPaths,
    closureSha256: verification.closure.closureSha256,
    declaredClosure: verification.closure,
    boundPathsManifestSha256: sha256(runtimeBoundPathsManifest(frozenPaths)),
    acquiredDerivationSha256: verification.artifacts.derivationSha256,
    exactSupervisorPaths: Object.freeze({
      nodeExecutablePath: frozenPaths.nodeRequestedPath,
      npmCliPath: frozenPaths.npmRequestedCliPath,
      pythonExecutablePath: frozenPaths.pythonRequestedVenvPath,
      agentScriptPath: frozenPaths.agentScriptPath,
    }),
  });
}

/**
 * Close after all child processes have exited. Any byte, tree, environment,
 * symlink, or bound-path change throws and must invalidate the whole block.
 */
export function closeSentinelRuntimeExecutionLease(
  lease: SentinelRuntimeExecutionLease,
  dependencies: SentinelRuntimeClosureDependencies = { runCommand: defaultRunCommand },
): SentinelRuntimeClosureDerivation {
  if (
    sha256(runtimeBoundPathsManifest(lease.paths)) !== lease.boundPathsManifestSha256 ||
    lease.boundPathsManifestSha256 !== lease.declaredClosure.executionLease.boundPathsManifestSha256 ||
    lease.closureSha256 !== lease.declaredClosure.closureSha256
  ) throw new Error("Sentinel runtime execution lease path binding changed");
  const closed = verifySentinelRuntimeClosure(lease.paths, lease.declaredClosure, dependencies);
  if (closed.artifacts.derivationSha256 !== lease.acquiredDerivationSha256) {
    throw new Error("Sentinel runtime changed after execution lease acquisition");
  }
  return closed;
}
