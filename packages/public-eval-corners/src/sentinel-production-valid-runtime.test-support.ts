import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { gunzipSync } from "node:zlib";

import { sentinelTrackedTreeSha1FromListing } from "./sentinel-git-working-tree.js";
import {
  buildSentinelRuntimeSanitizedEnvironment,
  SENTINEL_PRODUCTION_REVISION,
  SENTINEL_PRODUCTION_SOURCE_TREE,
  sentinelProductionCanonicalJson,
  sentinelProductionJsonSha256,
  sentinelProductionRuntimeClosureSha256,
  sentinelProductionSha256,
  type SentinelRuntimeClosure,
} from "./sentinel-production-plan.js";
import type {
  SentinelRuntimeClosureArtifacts,
  SentinelRuntimeClosureDerivation,
  SentinelRuntimeClosurePaths,
  SentinelRuntimeCommandArtifact,
  SentinelRuntimeFileArtifact,
  SentinelRuntimeTreeArtifact,
} from "./sentinel-runtime-closure.js";

const UPSTREAM_TREE_LISTING = gunzipSync(Buffer.from(
  readFileSync(
    new URL("./test-fixtures/sentinel-v0.1.0-ls-tree.txt.gz.b64", import.meta.url),
    "utf8",
  ).replace(/\s/gu, ""),
  "base64",
));

if (sentinelTrackedTreeSha1FromListing(UPSTREAM_TREE_LISTING) !== SENTINEL_PRODUCTION_SOURCE_TREE) {
  throw new Error("pinned Sentinel tree fixture does not reconstruct the production tree");
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sha1Blob(value: string): string {
  const bytes = Buffer.from(value);
  return createHash("sha1")
    .update(`blob ${bytes.byteLength}\0`)
    .update(bytes)
    .digest("hex");
}

function tree(
  rootPath: string,
  entries: readonly {
    readonly path: string;
    readonly mode: string;
    readonly type: "directory" | "file" | "symlink";
    readonly sha256: string;
  }[],
): SentinelRuntimeTreeArtifact {
  const manifest = [...entries]
    .sort((left, right) => compare(left.path, right.path))
    .map(({ path, mode, type, sha256 }) => `${path}\t${mode}\t${type}\t${sha256}\n`)
    .join("");
  return {
    rootPath,
    manifest,
    manifestSha256: sentinelProductionSha256(manifest),
    entryCount: entries.length,
  };
}

function command(
  executablePath: string,
  arguments_: readonly string[],
  cwd: string,
  environment: Readonly<Record<string, string>>,
  stdoutValue: string | Uint8Array,
): SentinelRuntimeCommandArtifact {
  const stdout = typeof stdoutValue === "string"
    ? Buffer.from(stdoutValue)
    : Buffer.from(stdoutValue);
  const stderr = Buffer.alloc(0);
  return {
    executablePath,
    arguments: [...arguments_],
    cwd,
    environment,
    stdoutBase64: stdout.toString("base64"),
    stdoutSha256: sentinelProductionSha256(stdout),
    stderrBase64: stderr.toString("base64"),
    stderrSha256: sentinelProductionSha256(stderr),
    exitCode: 0,
    signal: null,
  };
}

function file(path: string, sha256: string, mode = "0644", size = 1): SentinelRuntimeFileArtifact {
  return { path, sha256, mode, size };
}

function indexFlagsFromTreeListing(listing: Buffer): string {
  return listing.toString("utf8")
    .split("\0")
    .filter(Boolean)
    .map((entry) => `H ${entry.slice(entry.indexOf("\t") + 1)}\n`)
    .join("");
}

function gitCommands(
  paths: SentinelRuntimeClosurePaths,
  checkoutPath: string,
  environment: Readonly<Record<string, string>>,
  revision: string,
  sourceTreeHash: string,
  listing: Buffer,
  ignored: Buffer,
): readonly SentinelRuntimeCommandArtifact[] {
  const prefix = [
    "--exec-path=/dev/null",
    "--no-pager",
    "--no-replace-objects",
    "--literal-pathspecs",
    `--git-dir=${resolve(checkoutPath, ".git")}`,
    `--work-tree=${checkoutPath}`,
    "-c", `core.worktree=${checkoutPath}`,
    "-c", "core.fileMode=true",
    "-c", "core.fsmonitor=false",
    "-c", "core.attributesFile=/dev/null",
    "-c", "core.excludesFile=/dev/null",
    "-c", "core.hooksPath=/dev/null",
  ];
  const invoke = (arguments_: readonly string[], stdout: string | Uint8Array) => command(
    paths.gitExecutablePath,
    [...prefix, ...arguments_],
    checkoutPath,
    environment,
    stdout,
  );
  return [
    invoke(["rev-parse", "--verify", "HEAD"], `${revision}\n`),
    invoke(["rev-parse", "--verify", "HEAD^{tree}"], `${sourceTreeHash}\n`),
    invoke(["status", "--porcelain=v1", "--untracked-files=all"], ""),
    invoke(["ls-files", "-v"], indexFlagsFromTreeListing(listing)),
    invoke(["ls-tree", "-r", "-z", "--full-tree", "HEAD"], listing),
    invoke(["ls-files", "--others", "--ignored", "--exclude-standard", "--directory", "-z"], ignored),
  ];
}

export function createValidSentinelProductionRuntimeDerivation(
  paths: SentinelRuntimeClosurePaths,
  variant = 1,
): SentinelRuntimeClosureDerivation {
  const emptySha256 = sentinelProductionSha256("");
  const hash = (label: string): string => sentinelProductionSha256(`${label}-${variant}`);
  const substrateTracked = `substrate tracked fixture ${variant}\n`;
  const substrateTreeListing = Buffer.from(
    `100644 blob ${sha1Blob(substrateTracked)}\tfixture.txt\0`,
  );
  const substrateTreeHash = sentinelTrackedTreeSha1FromListing(substrateTreeListing);
  const substrateIgnored = Buffer.from(
    "node_modules/\0packages/public-eval-corners/dist/\0",
  );
  const upstreamIgnored = Buffer.from("frontend/node_modules/\0");
  const environment = buildSentinelRuntimeSanitizedEnvironment(paths.nodeRequestedPath);
  const environmentSha256 = sentinelProductionJsonSha256(environment);

  const scriptHashes = {
    runner: hash("runner"),
    supervisor: hash("supervisor"),
    verifier: hash("verifier"),
    agent: hash("agent"),
    provider: hash("provider"),
    sidecar: hash("sidecar"),
  };
  const compiledEntries = [
    { path: "production-state-sidecar.js", mode: "0644", type: "file" as const, sha256: scriptHashes.sidecar },
    { path: "sentinel-general-agent.js", mode: "0644", type: "file" as const, sha256: scriptHashes.agent },
    { path: "sentinel-general-provider-proxy.js", mode: "0644", type: "file" as const, sha256: scriptHashes.provider },
    { path: "sentinel-production-runner.js", mode: "0644", type: "file" as const, sha256: scriptHashes.runner },
    { path: "sentinel-production-supervisor.js", mode: "0644", type: "file" as const, sha256: scriptHashes.supervisor },
    { path: "sentinel-production-verifier.js", mode: "0644", type: "file" as const, sha256: scriptHashes.verifier },
  ];
  const publicEvalCompiledOutputTree = tree(paths.publicEvalCompiledOutputRootPath, compiledEntries);
  const workspacePackagesTree = tree(paths.substratePackagesRootPath, [
    { path: "continuity", mode: "0755", type: "directory", sha256: emptySha256 },
    { path: "continuity/index.js", mode: "0644", type: "file", sha256: hash("continuity") },
    { path: "public-eval-corners", mode: "0755", type: "directory", sha256: emptySha256 },
    { path: "public-eval-corners/package.json", mode: "0644", type: "file", sha256: hash("public-eval-package") },
    { path: "public-eval-corners/tsconfig.json", mode: "0644", type: "file", sha256: hash("public-eval-tsconfig") },
    { path: "public-eval-corners/dist", mode: "0755", type: "directory", sha256: emptySha256 },
    ...compiledEntries.map((entry) => ({ ...entry, path: `public-eval-corners/dist/${entry.path}` })),
  ]);
  const playwrightLibraryTree = tree(paths.playwrightLibraryRootPath, [
    { path: "lib", mode: "0755", type: "directory", sha256: emptySha256 },
    { path: "lib/index.js", mode: "0644", type: "file", sha256: hash("playwright-lib") },
    { path: "package.json", mode: "0644", type: "file", sha256: hash("playwright-package") },
  ]);
  const playwrightCoreLibraryTree = tree(paths.playwrightCoreLibraryRootPath, [
    { path: "lib", mode: "0755", type: "directory", sha256: emptySha256 },
    { path: "lib/index.js", mode: "0644", type: "file", sha256: hash("playwright-core-lib") },
    { path: "package.json", mode: "0644", type: "file", sha256: hash("playwright-core-package") },
  ]);
  const workspaceInstalledDependenciesTree = tree(paths.substrateInstalledDependenciesRootPath, [
    { path: "playwright", mode: "0755", type: "directory", sha256: emptySha256 },
    ...playwrightLibraryTree.manifest.split("\n").filter(Boolean).map((line) => {
      const [path, mode, type, sha256] = line.split("\t") as [string, string, "directory" | "file" | "symlink", string];
      return { path: `playwright/${path}`, mode, type, sha256 };
    }),
    { path: "playwright-core", mode: "0755", type: "directory", sha256: emptySha256 },
    ...playwrightCoreLibraryTree.manifest.split("\n").filter(Boolean).map((line) => {
      const [path, mode, type, sha256] = line.split("\t") as [string, string, "directory" | "file" | "symlink", string];
      return { path: `playwright-core/${path}`, mode, type, sha256 };
    }),
  ]);

  const metadata = "Metadata-Version: 2.1\nName: Demo\nVersion: 1.0\n";
  const record = "demo.py,sha256=fixture,10\ndemo-1.0.dist-info/METADATA,sha256=fixture,48\ndemo-1.0.dist-info/RECORD,,\n";
  const packageValue = "VALUE = 1\n";
  const metadataSha256 = sentinelProductionSha256(metadata);
  const recordSha256 = sentinelProductionSha256(record);
  const packageSha256 = sentinelProductionSha256(packageValue);
  const siteEntries = [
    { path: "demo-1.0.dist-info", mode: "0755", type: "directory" as const, sha256: emptySha256 },
    { path: "demo-1.0.dist-info/METADATA", mode: "0644", type: "file" as const, sha256: metadataSha256 },
    { path: "demo-1.0.dist-info/RECORD", mode: "0644", type: "file" as const, sha256: recordSha256 },
    { path: "demo.py", mode: "0644", type: "file" as const, sha256: packageSha256 },
  ];
  const siteTree = tree(paths.pythonSitePackagesRootPaths[0] as string, siteEntries);
  const environmentPrefix = "lib/python3.12/site-packages";
  const pythonEnvironmentTree = tree(paths.pythonEnvironmentRootPath, [
    { path: "bin", mode: "0755", type: "directory", sha256: emptySha256 },
    { path: "bin/python", mode: "0777", type: "symlink", sha256: hash("python-link") },
    { path: "lib", mode: "0755", type: "directory", sha256: emptySha256 },
    { path: "lib/python3.12", mode: "0755", type: "directory", sha256: emptySha256 },
    { path: environmentPrefix, mode: "0755", type: "directory", sha256: emptySha256 },
    ...siteEntries.map((entry) => ({ ...entry, path: `${environmentPrefix}/${entry.path}` })),
    { path: "pyvenv.cfg", mode: "0644", type: "file", sha256: hash("pyvenv") },
  ]);
  const pythonStdlibTree = tree(paths.pythonStdlibRootPath, [
    { path: "json", mode: "0755", type: "directory", sha256: emptySha256 },
    { path: "json/__init__.py", mode: "0644", type: "file", sha256: hash("stdlib") },
  ]);
  const pythonRuntimeTree = tree(paths.pythonRuntimeRootPath, [
    { path: "bin", mode: "0755", type: "directory", sha256: emptySha256 },
    { path: "bin/python3.12", mode: "0755", type: "file", sha256: hash("python-real") },
    { path: "lib", mode: "0755", type: "directory", sha256: emptySha256 },
    { path: "lib/python3.12", mode: "0755", type: "directory", sha256: emptySha256 },
    ...pythonStdlibTree.manifest.split("\n").filter(Boolean).map((line) => {
      const [path, mode, type, sha256] = line.split("\t") as [string, string, "directory" | "file" | "symlink", string];
      return { path: `lib/python3.12/${path}`, mode, type, sha256 };
    }),
  ]);
  const browserBundleTree = tree(paths.browserBundleRootPath, [
    { path: "chrome", mode: "0755", type: "file", sha256: hash("browser-executable") },
    { path: "resources", mode: "0755", type: "directory", sha256: emptySha256 },
    { path: "resources/snapshot.bin", mode: "0644", type: "file", sha256: hash("browser-resource") },
  ]);
  const upstreamFrontendInstalledTree = tree(paths.upstreamFrontendInstalledRootPath, [
    { path: "example", mode: "0755", type: "directory", sha256: emptySha256 },
    { path: "example/index.js", mode: "0644", type: "file", sha256: hash("upstream-dependency") },
  ]);

  const distributionFiles = [
    {
      path: `${environmentPrefix}/demo-1.0.dist-info/METADATA`, type: "file" as const,
      mode: "0644", sha256: metadataSha256, recordSha256: metadataSha256,
      recordSize: Buffer.byteLength(metadata),
    },
    {
      path: `${environmentPrefix}/demo-1.0.dist-info/RECORD`, type: "file" as const,
      mode: "0644", sha256: recordSha256, recordSha256: null, recordSize: null,
    },
    {
      path: `${environmentPrefix}/demo.py`, type: "file" as const,
      mode: "0644", sha256: packageSha256, recordSha256: packageSha256,
      recordSize: Buffer.byteLength(packageValue),
    },
  ].sort((left, right) => compare(left.path, right.path));
  const installedDistributionsManifest = sentinelProductionCanonicalJson({
    schemaVersion: "canonical-name-version-files-record-sha256-v1",
    environmentRootPath: paths.pythonEnvironmentRootPath,
    siteTrees: [{
      rootPath: siteTree.rootPath,
      manifestSha256: siteTree.manifestSha256,
      entryCount: siteTree.entryCount,
    }],
    distributions: [{
      canonicalName: "demo",
      name: "Demo",
      version: "1.0",
      metadataSha256,
      recordSha256,
      files: distributionFiles,
    }],
  });
  const installedDistributionsManifestSha256 = sentinelProductionSha256(
    installedDistributionsManifest,
  );
  const pipFreeze = "Demo==1.0\n";
  const boundPathsManifest = sentinelProductionCanonicalJson({
    schemaVersion: "pm.public-eval-corners.sentinel-runtime-bound-paths.v1",
    paths,
  });
  const executionEnvironmentManifest = sentinelProductionCanonicalJson(environment);

  const withoutHash: Omit<SentinelRuntimeClosure, "closureSha256"> = {
    closureSchemaVersion: "pm.public-eval-corners.sentinel-runtime-closure.v3",
    closureDerivation: "canonical-runtime-transitive-trees-and-git-listings-v3",
    requestedEntryHashSemantics: "sha256-of-symlink-target-utf8-or-regular-file-bytes-v1",
    treeHashSemantics: "sha256-canonical-relative-path-mode-type-contenthash-v1",
    runnerReconstructsAndVerifiesClosure: true,
    substrateRevision: "1".repeat(40),
    sourceTreeHash: substrateTreeHash,
    workingTreeClean: true,
    pnpmWorkspaceLockSha256: hash("pnpm-lock"),
    runnerScriptSha256: scriptHashes.runner,
    supervisorScriptSha256: scriptHashes.supervisor,
    verifierScriptSha256: scriptHashes.verifier,
    agentScriptSha256: scriptHashes.agent,
    providerProxyScriptSha256: scriptHashes.provider,
    stateSidecarScriptSha256: scriptHashes.sidecar,
    executionEnvironment: {
      schemaVersion: "pm.public-eval-corners.sentinel-sanitized-environment.v2",
      values: environment,
      environmentSha256,
      inheritsHostEnvironment: false,
    },
    git: {
      version: "git version 2.50.1",
      executablePath: paths.gitExecutablePath,
      executableSha256: hash("git"),
      invocationEnvironmentSha256: environmentSha256,
    },
    workspace: {
      checkoutPath: paths.substrateCheckoutPath,
      ignoredPathListingSha256: sentinelProductionSha256(substrateIgnored),
      rootPackageJsonSha256: hash("root-package"),
      pnpmWorkspaceManifestSha256: hash("workspace-manifest"),
      rootTsconfigSha256: hash("root-tsconfig"),
      tsconfigBaseSha256: hash("tsconfig-base"),
      publicEvalPackageManifestSha256: hash("public-eval-package"),
      publicEvalTsconfigSha256: hash("public-eval-tsconfig"),
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
      version: "v26.0.0",
      requestedPath: paths.nodeRequestedPath,
      requestedEntrySha256: hash("node-entry"),
      resolvedPath: resolve(paths.nodeAllowedRootPath, "bin/node-real"),
      resolvedExecutableSha256: hash("node-real"),
    },
    npm: {
      version: "11.0.0",
      requestedCliPath: paths.npmRequestedCliPath,
      requestedCliEntrySha256: hash("npm-entry"),
      resolvedCliPath: resolve(paths.npmAllowedRootPath, "lib/npm-cli-real.js"),
      resolvedCliSha256: hash("npm-real"),
    },
    python: {
      version: "Python 3.12.13",
      requestedVenvPath: paths.pythonRequestedVenvPath,
      venvEntrySha256: hash("python-entry"),
      resolvedExecutablePath: resolve(paths.pythonRuntimeRootPath, "bin/python3.12"),
      realExecutableSha256: hash("python-real"),
      pyvenvConfigSha256: hash("pyvenv"),
      pipFreezeSha256: sentinelProductionSha256(pipFreeze),
      installedDistributionsManifestSha256,
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
      packageMetadataSha256: hash("playwright-package"),
      bundleRootPath: paths.browserBundleRootPath,
      bundleTreeSha256: browserBundleTree.manifestSha256,
      executablePath: paths.browserExecutablePath,
      executableSha256: hash("browser-executable"),
      libraryRootPath: paths.playwrightLibraryRootPath,
      libraryTreeSha256: playwrightLibraryTree.manifestSha256,
      libraryTreeEntryCount: playwrightLibraryTree.entryCount,
      coreLibraryRootPath: paths.playwrightCoreLibraryRootPath,
      coreLibraryTreeSha256: playwrightCoreLibraryTree.manifestSha256,
      coreLibraryTreeEntryCount: playwrightCoreLibraryTree.entryCount,
      corePackageMetadataSha256: hash("playwright-core-package"),
    },
    upstream: {
      revision: SENTINEL_PRODUCTION_REVISION,
      sourceTreeHash: SENTINEL_PRODUCTION_SOURCE_TREE,
      ignoredPathListingSha256: sentinelProductionSha256(upstreamIgnored),
      frontendInstalledTreeSha256: upstreamFrontendInstalledTree.manifestSha256,
      frontendPackageLockSha256: hash("upstream-lock"),
      serverRequirementsSha256: hash("upstream-requirements"),
    },
    executionLease: {
      schemaVersion: "pm.public-eval-corners.sentinel-runtime-execution-lease.v1",
      boundPathsManifestSha256: sentinelProductionSha256(boundPathsManifest),
      exactBoundPathsRequired: true,
      preAndPostBlockReconstructionRequired: true,
      mutationInvalidatesBlock: true,
      immutableSnapshot: false,
      osBoundaryLimitation: "kernel-dynamic-loader-system-libraries-and-in-process-races-outside-user-space-hash-closure",
    },
  };
  const closure: SentinelRuntimeClosure = {
    ...withoutHash,
    closureSha256: sentinelProductionRuntimeClosureSha256({
      ...withoutHash,
      closureSha256: "0".repeat(64),
    }),
  };
  const artifactBody = {
    schemaVersion: "pm.public-eval-corners.sentinel-runtime-closure-artifacts.v4" as const,
    substrateGit: {
      checkoutPath: paths.substrateCheckoutPath,
      revision: closure.substrateRevision,
      sourceTreeHash: closure.sourceTreeHash,
      ignoredPathListingSha256: closure.workspace.ignoredPathListingSha256,
      clean: true as const,
      commands: gitCommands(paths, paths.substrateCheckoutPath, environment, closure.substrateRevision, closure.sourceTreeHash, substrateTreeListing, substrateIgnored),
    },
    upstreamGit: {
      checkoutPath: paths.upstreamCheckoutPath,
      revision: closure.upstream.revision,
      sourceTreeHash: closure.upstream.sourceTreeHash,
      ignoredPathListingSha256: closure.upstream.ignoredPathListingSha256,
      clean: true as const,
      commands: gitCommands(paths, paths.upstreamCheckoutPath, environment, closure.upstream.revision, closure.upstream.sourceTreeHash, UPSTREAM_TREE_LISTING, upstreamIgnored),
    },
    commands: {
      gitVersion: command(paths.gitExecutablePath, ["--version"], paths.substrateCheckoutPath, environment, `${closure.git.version}\n`),
      nodeVersion: command(paths.nodeRequestedPath, ["--version"], paths.substrateCheckoutPath, environment, `${closure.node.version}\n`),
      npmVersion: command(paths.nodeRequestedPath, [paths.npmRequestedCliPath, "--version"], paths.substrateCheckoutPath, environment, `${closure.npm.version}\n`),
      pythonVersion: command(paths.pythonRequestedVenvPath, ["--version"], paths.upstreamCheckoutPath, environment, `${closure.python.version}\n`),
      pipFreeze: command(paths.pythonRequestedVenvPath, ["-m", "pip", "freeze", "--all"], paths.upstreamCheckoutPath, environment, pipFreeze),
    },
    pipFreeze,
    entries: {
      node: { requestedPath: closure.node.requestedPath, requestedEntrySha256: closure.node.requestedEntrySha256, resolvedPath: closure.node.resolvedPath, resolvedSha256: closure.node.resolvedExecutableSha256 },
      npm: { requestedPath: closure.npm.requestedCliPath, requestedEntrySha256: closure.npm.requestedCliEntrySha256, resolvedPath: closure.npm.resolvedCliPath, resolvedSha256: closure.npm.resolvedCliSha256 },
      python: { requestedPath: closure.python.requestedVenvPath, requestedEntrySha256: closure.python.venvEntrySha256, resolvedPath: closure.python.resolvedExecutablePath, resolvedSha256: closure.python.realExecutableSha256 },
    },
    files: {
      gitExecutable: file(paths.gitExecutablePath, closure.git.executableSha256, "0755"),
      pnpmWorkspaceLock: file(paths.pnpmWorkspaceLockPath, closure.pnpmWorkspaceLockSha256),
      rootPackageJson: file(paths.rootPackageJsonPath, closure.workspace.rootPackageJsonSha256),
      pnpmWorkspaceManifest: file(paths.pnpmWorkspaceManifestPath, closure.workspace.pnpmWorkspaceManifestSha256),
      rootTsconfig: file(paths.rootTsconfigPath, closure.workspace.rootTsconfigSha256),
      tsconfigBase: file(paths.tsconfigBasePath, closure.workspace.tsconfigBaseSha256),
      publicEvalPackageJson: file(paths.publicEvalPackageJsonPath, closure.workspace.publicEvalPackageManifestSha256),
      publicEvalTsconfig: file(paths.publicEvalTsconfigPath, closure.workspace.publicEvalTsconfigSha256),
      runnerScript: file(paths.runnerScriptPath, closure.runnerScriptSha256),
      supervisorScript: file(paths.supervisorScriptPath, closure.supervisorScriptSha256),
      verifierScript: file(paths.verifierScriptPath, closure.verifierScriptSha256),
      agentScript: file(paths.agentScriptPath, closure.agentScriptSha256),
      providerProxyScript: file(paths.providerProxyScriptPath, closure.providerProxyScriptSha256),
      stateSidecarScript: file(paths.stateSidecarScriptPath, closure.stateSidecarScriptSha256),
      pyvenvConfig: file(paths.pythonPyvenvConfigPath, closure.python.pyvenvConfigSha256),
      playwrightPackageMetadata: file(paths.playwrightPackageMetadataPath, closure.browser.packageMetadataSha256),
      playwrightCorePackageMetadata: file(paths.playwrightCorePackageMetadataPath, closure.browser.corePackageMetadataSha256),
      browserExecutable: file(paths.browserExecutablePath, closure.browser.executableSha256, "0755"),
      upstreamFrontendPackageLock: file(paths.upstreamFrontendPackageLockPath, closure.upstream.frontendPackageLockSha256),
      upstreamServerRequirements: file(paths.upstreamServerRequirementsPath, closure.upstream.serverRequirementsSha256),
    },
    installedDistributionsManifest,
    installedDistributionsManifestSha256,
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
    browserBundleTree,
    upstreamFrontendInstalledTree,
  };
  const artifacts: SentinelRuntimeClosureArtifacts = {
    ...artifactBody,
    derivationSha256: sentinelProductionJsonSha256(artifactBody),
  };
  return { closure, artifacts };
}
