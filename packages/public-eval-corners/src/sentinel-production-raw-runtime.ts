import { resolve } from "node:path";

import {
  SENTINEL_PRODUCTION_REVISION,
  SENTINEL_PRODUCTION_SOURCE_TREE,
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

function treeArtifact(value: unknown, label: string): void {
  sentinelRawExactKeys(value, ["entryCount", "manifest", "manifestSha256", "rootPath"], label);
  if (
    typeof value.rootPath !== "string" || !value.rootPath.startsWith("/") || typeof value.manifest !== "string" ||
    typeof value.manifestSha256 !== "string" || sentinelRawSha256(value.manifest) !== value.manifestSha256 ||
    !Number.isSafeInteger(value.entryCount) || Number(value.entryCount) < 0
  ) throw new Error(`${label} manifest identity is invalid`);
  const lines = value.manifest === "" ? [] : value.manifest.split("\n").filter(Boolean);
  if (lines.length !== value.entryCount || (value.manifest !== "" && !value.manifest.endsWith("\n"))) {
    throw new Error(`${label} entry count or newline termination is invalid`);
  }
  const paths = new Set<string>();
  for (const [index, line] of lines.entries()) {
    const fields = line.split("\t");
    if (
      fields.length !== 4 || fields[0] === "" || fields[0]?.startsWith("/") || fields[0]?.split("/").includes("..") ||
      !/^[0-7]{4}$/u.test(fields[1] ?? "") || !["directory", "file", "symlink"].includes(fields[2] ?? "") ||
      !SENTINEL_RAW_SHA256.test(fields[3] ?? "") || paths.has(fields[0] ?? "")
    ) throw new Error(`${label} line ${index + 1} is malformed or duplicated`);
    paths.add(fields[0] as string);
  }
}

interface ParsedGitArtifact {
  readonly checkoutPath: string;
  readonly clean: true;
  readonly commands: readonly unknown[];
  readonly revision: string;
  readonly sourceTreeHash: string;
}

function gitArtifact(value: unknown, label: string): ParsedGitArtifact {
  sentinelRawExactKeys(value, ["checkoutPath", "clean", "commands", "revision", "sourceTreeHash"], label);
  if (
    typeof value.checkoutPath !== "string" || !value.checkoutPath.startsWith("/") ||
    typeof value.revision !== "string" || !/^[a-f0-9]{40}$/u.test(value.revision) ||
    typeof value.sourceTreeHash !== "string" || !/^[a-f0-9]{40}$/u.test(value.sourceTreeHash) ||
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
      if (!Array.isArray(path) || path.length === 0 || path.some((entry) => typeof entry !== "string" || !entry.startsWith("/"))) {
        throw new Error("runtime Python site-package paths are invalid");
      }
    } else if (typeof path !== "string" || !path.startsWith("/")) {
      throw new Error(`runtime bound path ${name} is invalid`);
    }
  }
  return parsed.paths as unknown as SentinelRuntimeClosurePaths;
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

function validateGitArtifact(
  value: unknown,
  expected: {
    readonly checkoutPath: string;
    readonly revision: string;
    readonly sourceTreeHash: string;
    readonly gitExecutablePath: string;
    readonly environment: Readonly<Record<string, string>>;
  },
  label: string,
): void {
  const record = gitArtifact(value, label);
  if (
    record.checkoutPath !== expected.checkoutPath || record.revision !== expected.revision ||
    record.sourceTreeHash !== expected.sourceTreeHash || !Array.isArray(record.commands) || record.commands.length !== 4
  ) throw new Error(`${label} identity differs from the signed checkout`);
  const prefix = [
    "--exec-path=/dev/null",
    "--no-pager",
    "--no-replace-objects",
    "--literal-pathspecs",
    `--git-dir=${resolve(expected.checkoutPath, ".git")}`,
    `--work-tree=${expected.checkoutPath}`,
    "-c", `core.worktree=${expected.checkoutPath}`,
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
  });
}

interface ValidatedRuntimeArtifacts {
  readonly artifacts: SentinelRuntimeClosureArtifacts;
  readonly paths: SentinelRuntimeClosurePaths;
}

function validateArtifacts(value: unknown, closure: SentinelRuntimeClosure): ValidatedRuntimeArtifacts {
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
    value.schemaVersion !== "pm.public-eval-corners.sentinel-runtime-closure-artifacts.v3" ||
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
  for (const name of [
    "workspacePackagesTree", "workspaceInstalledDependenciesTree", "publicEvalCompiledOutputTree", "pythonEnvironmentTree",
    "pythonRuntimeTree", "pythonStdlibTree", "playwrightLibraryTree", "playwrightCoreLibraryTree", "browserBundleTree",
    "upstreamFrontendInstalledTree",
  ] as const) treeArtifact(value[name], `runtime ${name}`);
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
  sentinelRawExactKeys(installedDistributions, ["distributions", "environmentRootPath", "schemaVersion", "siteTrees"], "runtime installed-distributions manifest");
  if (
    installedDistributions.schemaVersion !== closure.python.installedDistributionsManifestSchema ||
    installedDistributions.environmentRootPath !== closure.python.environmentRootPath ||
    !Array.isArray(installedDistributions.distributions) || !Array.isArray(installedDistributions.siteTrees)
  ) throw new Error("runtime installed-distributions manifest identity differs from the signed closure");

  const paths = parseBoundPaths(value.boundPathsManifest);
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

  validateGitArtifact(value.substrateGit, {
    checkoutPath: paths.substrateCheckoutPath,
    revision: closure.substrateRevision,
    sourceTreeHash: closure.sourceTreeHash,
    gitExecutablePath: paths.gitExecutablePath,
    environment: closure.executionEnvironment.values,
  }, "substrate git artifact");
  validateGitArtifact(value.upstreamGit, {
    checkoutPath: paths.upstreamCheckoutPath,
    revision: SENTINEL_PRODUCTION_REVISION,
    sourceTreeHash: SENTINEL_PRODUCTION_SOURCE_TREE,
    gitExecutablePath: paths.gitExecutablePath,
    environment: closure.executionEnvironment.values,
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
    const validatedArtifacts = validateArtifacts(artifactValue, input.preregistrationClosure);
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
