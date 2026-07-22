import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  realpathSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  buildSentinelRuntimeSanitizedEnvironment,
  isSentinelRuntimeSanitizedEnvironment,
  SENTINEL_PRODUCTION_REVISION,
  SENTINEL_PRODUCTION_SOURCE_TREE,
  sentinelProductionJsonSha256,
  sentinelProductionRuntimeClosureSha256,
  type SentinelRuntimeClosure,
} from "./sentinel-production-plan.js";
import {
  acquireSentinelRuntimeExecutionLease,
  closeSentinelRuntimeExecutionLease,
  deriveSentinelRuntimeClosure,
  verifySentinelRuntimeClosure,
  type SentinelRuntimeClosureDependencies,
  type SentinelRuntimeClosurePaths,
  type SentinelRuntimeCommandInvocation,
  type SentinelRuntimeCommandResult,
} from "./sentinel-runtime-closure.js";
import {
  createSentinelProductionRuntimeLeaseIdentity,
  retainSentinelProductionRuntimeInspection,
  type SentinelProductionRuntimeInspectionReference,
} from "./sentinel-production-runner-evidence.js";
import { verifySentinelRawRuntimeBoundary } from "./sentinel-production-raw-runtime.js";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function write(path: string, value: string, mode?: number): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, value);
  if (mode !== undefined) chmodSync(path, mode);
}

interface Fixture {
  readonly paths: SentinelRuntimeClosurePaths;
  readonly dependencies: SentinelRuntimeClosureDependencies;
  readonly state: {
    dirtySubstrate: boolean;
    npmVersion: string;
    pipFreeze: string;
    gitIndexFlags: string;
  };
  readonly files: {
    gitExecutable: string;
    nodeTarget: string;
    nodeRequested: string;
    frontendDependency: string;
    pythonPackage: string;
    pythonStdlib: string;
    transitiveWorkspace: string;
    installedDependency: string;
    playwrightLibrary: string;
  };
}

function commandResult(stdout = ""): SentinelRuntimeCommandResult {
  return {
    exitCode: 0,
    signal: null,
    stdout: Buffer.from(stdout, "utf8"),
    stderr: Buffer.alloc(0),
  };
}

function fixture(): Fixture {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "pm-sentinel-runtime-")));
  roots.push(root);
  const substrate = join(root, "substrate");
  const upstream = join(root, "upstream");
  const runtime = join(root, "runtime");
  const scripts = join(substrate, "packages", "public-eval-corners", "dist");
  const packagesRoot = join(substrate, "packages");
  const installedRoot = join(substrate, "node_modules");
  const nodeRoot = join(runtime, "node");
  const npmRoot = join(runtime, "npm");
  const pythonRoot = join(runtime, "venv");
  const siteRoot = join(pythonRoot, "lib", "python3.12", "site-packages");
  const browserRoot = join(runtime, "browser-bundle");
  const frontendInstalled = join(upstream, "frontend", "node_modules");
  mkdirSync(substrate, { recursive: true });
  mkdirSync(upstream, { recursive: true });
  const scriptPaths = {
    runner: join(scripts, "sentinel-production-runner.js"),
    supervisor: join(scripts, "sentinel-production-supervisor.js"),
    verifier: join(scripts, "sentinel-production-verifier.js"),
    agent: join(scripts, "sentinel-general-agent.js"),
    provider: join(scripts, "sentinel-general-provider-proxy.js"),
    sidecar: join(scripts, "production-state-sidecar.js"),
  };
  for (const [role, path] of Object.entries(scriptPaths)) write(path, `export const role = ${JSON.stringify(role)};\n`);
  write(join(substrate, "package.json"), '{"name":"fixture"}\n');
  write(join(substrate, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n");
  write(join(substrate, "tsconfig.json"), '{"files":[]}\n');
  write(join(substrate, "tsconfig.base.json"), '{"compilerOptions":{}}\n');
  write(join(substrate, "packages", "public-eval-corners", "package.json"), '{"name":"@pm/public-eval-corners"}\n');
  write(join(substrate, "packages", "public-eval-corners", "tsconfig.json"), '{"extends":"../../tsconfig.base.json"}\n');
  const transitiveWorkspace = join(substrate, "packages", "continuity", "dist", "index.js");
  write(transitiveWorkspace, "export const continuity = 1;\n");
  const installedDependency = join(installedRoot, "pg", "index.js");
  write(installedDependency, "export const pg = 1;\n");
  write(join(substrate, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
  const gitExecutable = join(runtime, "git");
  write(gitExecutable, "fixture git\n", 0o755);
  const nodeTarget = join(nodeRoot, "bin", "node-real");
  const nodeRequested = join(nodeRoot, "bin", "node");
  write(nodeTarget, "fixture node executable\n", 0o755);
  symlinkSync("node-real", nodeRequested);
  const npmTarget = join(npmRoot, "lib", "npm-cli-real.js");
  const npmRequested = join(npmRoot, "bin", "npm-cli.js");
  write(npmTarget, "fixture npm CLI\n");
  mkdirSync(dirname(npmRequested), { recursive: true });
  symlinkSync("../lib/npm-cli-real.js", npmRequested);
  const pythonTarget = join(pythonRoot, "bin", "python-real");
  const pythonRequested = join(pythonRoot, "bin", "python");
  write(pythonTarget, "fixture python executable\n", 0o755);
  symlinkSync("python-real", pythonRequested);
  write(join(pythonRoot, "pyvenv.cfg"), "home = /fixture/python\nversion = 3.12.13\n");
  const pythonStdlib = join(pythonRoot, "lib", "python3.12", "json", "__init__.py");
  write(pythonStdlib, "# fixture stdlib\n");
  const packageFile = join(siteRoot, "demo.py");
  const metadataFile = join(siteRoot, "demo-1.0.dist-info", "METADATA");
  const recordFile = join(siteRoot, "demo-1.0.dist-info", "RECORD");
  const packageBytes = "VALUE = 1\n";
  const metadataBytes = "Metadata-Version: 2.1\nName: Demo\nVersion: 1.0\n";
  write(packageFile, packageBytes);
  write(metadataFile, metadataBytes);
  const digest = (value: string): string =>
    createHash("sha256").update(value).digest("base64url");
  write(
    recordFile,
    [
      `demo.py,sha256=${digest(packageBytes)},${Buffer.byteLength(packageBytes)}`,
      `demo-1.0.dist-info/METADATA,sha256=${digest(metadataBytes)},${Buffer.byteLength(metadataBytes)}`,
      "demo-1.0.dist-info/RECORD,,",
      "",
    ].join("\n"),
  );
  const playwrightPackage = join(substrate, "node_modules", "playwright", "package.json");
  write(playwrightPackage, '{"name":"playwright","version":"1.56.1"}\n');
  const playwrightLibrary = join(substrate, "node_modules", "playwright", "lib", "index.js");
  write(playwrightLibrary, "export const playwright = 1;\n");
  const playwrightCorePackage = join(substrate, "node_modules", "playwright-core", "package.json");
  write(playwrightCorePackage, '{"name":"playwright-core","version":"1.56.1"}\n');
  write(join(substrate, "node_modules", "playwright-core", "lib", "index.js"), "export const core = 1;\n");
  const browserExecutable = join(browserRoot, "chrome");
  write(browserExecutable, "fixture browser executable\n", 0o755);
  write(join(browserRoot, "resources", "snapshot.bin"), "browser dependency bytes\n");
  const frontendLock = join(upstream, "frontend", "package-lock.json");
  const frontendDependency = join(frontendInstalled, "example", "index.js");
  write(frontendLock, '{"lockfileVersion":3}\n');
  write(frontendDependency, "export default 1;\n");
  const requirements = join(upstream, "server", "requirements.txt");
  write(requirements, "fastapi==0.1\n");
  const paths: SentinelRuntimeClosurePaths = {
    gitExecutablePath: gitExecutable,
    substrateCheckoutPath: substrate,
    rootPackageJsonPath: join(substrate, "package.json"),
    pnpmWorkspaceManifestPath: join(substrate, "pnpm-workspace.yaml"),
    rootTsconfigPath: join(substrate, "tsconfig.json"),
    tsconfigBasePath: join(substrate, "tsconfig.base.json"),
    publicEvalPackageJsonPath: join(substrate, "packages", "public-eval-corners", "package.json"),
    publicEvalTsconfigPath: join(substrate, "packages", "public-eval-corners", "tsconfig.json"),
    substratePackagesRootPath: packagesRoot,
    substrateInstalledDependenciesRootPath: installedRoot,
    publicEvalCompiledOutputRootPath: scripts,
    pnpmWorkspaceLockPath: join(substrate, "pnpm-lock.yaml"),
    runnerScriptPath: scriptPaths.runner,
    supervisorScriptPath: scriptPaths.supervisor,
    verifierScriptPath: scriptPaths.verifier,
    agentScriptPath: scriptPaths.agent,
    providerProxyScriptPath: scriptPaths.provider,
    stateSidecarScriptPath: scriptPaths.sidecar,
    nodeRequestedPath: nodeRequested,
    nodeAllowedRootPath: nodeRoot,
    npmRequestedCliPath: npmRequested,
    npmAllowedRootPath: npmRoot,
    pythonRequestedVenvPath: pythonRequested,
    pythonEnvironmentRootPath: pythonRoot,
    pythonRuntimeRootPath: pythonRoot,
    pythonStdlibRootPath: join(pythonRoot, "lib", "python3.12"),
    pythonExecutableAllowedRootPath: pythonRoot,
    pythonPyvenvConfigPath: join(pythonRoot, "pyvenv.cfg"),
    pythonSitePackagesRootPaths: [siteRoot],
    playwrightPackageMetadataPath: playwrightPackage,
    playwrightCorePackageMetadataPath: playwrightCorePackage,
    playwrightLibraryRootPath: join(substrate, "node_modules", "playwright"),
    playwrightCoreLibraryRootPath: join(substrate, "node_modules", "playwright-core"),
    browserBundleRootPath: browserRoot,
    browserExecutablePath: browserExecutable,
    upstreamCheckoutPath: upstream,
    upstreamFrontendPackageLockPath: frontendLock,
    upstreamFrontendInstalledRootPath: frontendInstalled,
    upstreamServerRequirementsPath: requirements,
  };
  const state = {
    dirtySubstrate: false,
    npmVersion: "11.0.0\n",
    pipFreeze: "Demo==1.0\n",
    gitIndexFlags: "H fixture.txt\n",
  };
  const runCommand = (invocation: SentinelRuntimeCommandInvocation): SentinelRuntimeCommandResult => {
    const [first] = invocation.arguments;
    if (invocation.executablePath === gitExecutable && first === "--version") {
      return commandResult("git version 2.42.0.fixture\n");
    }
    const gitWorkTree = invocation.arguments.find((argument) => argument.startsWith("--work-tree="));
    const commandIndex = invocation.arguments.findIndex((argument) =>
      ["rev-parse", "status", "ls-files"].includes(argument));
    if (gitWorkTree !== undefined && commandIndex >= 0) {
      const gitCheckout = gitWorkTree.slice("--work-tree=".length);
      const command = invocation.arguments.slice(commandIndex).join(" ");
      if (command === "rev-parse --verify HEAD") {
        return commandResult(`${gitCheckout === upstream ? SENTINEL_PRODUCTION_REVISION : "a".repeat(40)}\n`);
      }
      if (command === "rev-parse --verify HEAD^{tree}") {
        return commandResult(`${gitCheckout === upstream ? SENTINEL_PRODUCTION_SOURCE_TREE : "b".repeat(40)}\n`);
      }
      if (command === "status --porcelain=v1 --untracked-files=all") {
        return commandResult(gitCheckout === substrate && state.dirtySubstrate ? " M README.md\n" : "");
      }
      if (command === "ls-files -v") return commandResult(state.gitIndexFlags);
    }
    if (invocation.executablePath === nodeRequested && invocation.arguments.length === 1) {
      return commandResult("v26.0.0\n");
    }
    if (invocation.executablePath === nodeRequested && invocation.arguments[0] === npmRequested) {
      return commandResult(state.npmVersion);
    }
    if (invocation.executablePath === pythonRequested && invocation.arguments[0] === "--version") {
      return commandResult("Python 3.12.13\n");
    }
    if (invocation.executablePath === pythonRequested && invocation.arguments[0] === "-m") {
      return commandResult(state.pipFreeze);
    }
    return { ...commandResult(), exitCode: 127, stderr: Buffer.from("unexpected command", "utf8") };
  };
  return {
    paths,
    dependencies: { runCommand },
    state,
    files: {
      gitExecutable,
      nodeTarget,
      nodeRequested,
      frontendDependency,
      pythonPackage: packageFile,
      pythonStdlib,
      transitiveWorkspace,
      installedDependency,
      playwrightLibrary,
    },
  };
}

function rehash(closure: SentinelRuntimeClosure): SentinelRuntimeClosure {
  return {
    ...closure,
    closureSha256: sentinelProductionRuntimeClosureSha256(closure),
  };
}

function retainRawRuntimeFixture(value: Fixture): {
  readonly batchRoot: string;
  readonly closure: SentinelRuntimeClosure;
  readonly reference: SentinelProductionRuntimeInspectionReference;
} {
  const derived = deriveSentinelRuntimeClosure(value.paths, value.dependencies);
  const batchRoot = join(dirname(value.paths.substrateCheckoutPath), "batch");
  mkdirSync(join(batchRoot, "manifests", "runtime"), { recursive: true });
  const reference = retainSentinelProductionRuntimeInspection({
    batchRoot,
    inspection: {
      valid: true,
      closure: derived.closure,
      closureSha256: derived.closure.closureSha256,
      executableIdentitySha256: sentinelProductionJsonSha256({
        node: { path: value.paths.nodeRequestedPath, sha256: derived.closure.node.resolvedExecutableSha256 },
        agent: { path: value.paths.agentScriptPath, sha256: derived.closure.agentScriptSha256 },
        python: { path: value.paths.pythonRequestedVenvPath, sha256: derived.closure.python.realExecutableSha256 },
        npm: { path: value.paths.npmRequestedCliPath, sha256: derived.closure.npm.resolvedCliSha256 },
      }),
      artifacts: derived.artifacts,
      executionLeaseIdentity: createSentinelProductionRuntimeLeaseIdentity(
        value.paths,
        derived.closure,
        derived.artifacts,
      ),
      issues: [],
    },
    boundary: "initial",
    blockSequence: null,
    inspectedAt: "2026-07-14T12:00:00.000Z",
    preregistrationClosureSha256: derived.closure.closureSha256,
    previousInspectionReceiptSha256: "0".repeat(64),
  });
  return { batchRoot, closure: derived.closure, reference };
}

describe("Sentinel production runtime closure", () => {
  it("independently replays a retained runtime boundary against every signed path and command", () => {
    const retained = retainRawRuntimeFixture(fixture());
    const verified = verifySentinelRawRuntimeBoundary({
      batchRoot: retained.batchRoot,
      reference: retained.reference,
      expectedBoundary: "initial",
      expectedBlockSequence: null,
      expectedPreviousReceiptSha256: "0".repeat(64),
      preregistrationClosure: retained.closure,
    });
    expect(verified.valid, verified.issues.join("; ")).toBe(true);
    expect(verified.exactSupervisorPaths?.nodeExecutablePath).toBe(retained.closure.node.requestedPath);
  });

  it("rejects a content-address-consistent runtime lease that substitutes an unsigned supervisor path", () => {
    const retained = retainRawRuntimeFixture(fixture());
    const originalReceipt = JSON.parse(readFileSync(
      join(retained.batchRoot, retained.reference.inspectionReceiptPath),
      "utf8",
    )) as Record<string, unknown>;
    const lease = structuredClone(originalReceipt.executionLeaseIdentity) as Record<string, unknown>;
    const exactPaths = structuredClone(lease.exactSupervisorPaths) as Record<string, unknown>;
    exactPaths.nodeExecutablePath = "/tmp/unsigned-node";
    lease.exactSupervisorPaths = exactPaths;
    const { identitySha256: _oldLeaseHash, ...leaseBody } = lease;
    lease.identitySha256 = sentinelProductionJsonSha256(leaseBody);
    const tamperedBody = {
      ...originalReceipt,
      executionLeaseIdentity: lease,
    };
    delete tamperedBody.receiptSha256;
    const tamperedReceiptSha256 = sentinelProductionJsonSha256(tamperedBody);
    const tamperedReceipt = { ...tamperedBody, receiptSha256: tamperedReceiptSha256 };
    const tamperedRelativePath = `manifests/runtime/runtime-initial-${tamperedReceiptSha256}.json`;
    write(join(retained.batchRoot, tamperedRelativePath), `${JSON.stringify(tamperedReceipt, null, 2)}\n`, 0o400);
    const verified = verifySentinelRawRuntimeBoundary({
      batchRoot: retained.batchRoot,
      reference: {
        ...retained.reference,
        inspectionReceiptPath: tamperedRelativePath,
        inspectionReceiptSha256: tamperedReceiptSha256,
        executionLeaseIdentitySha256: lease.identitySha256 as string,
      },
      expectedBoundary: "initial",
      expectedBlockSequence: null,
      expectedPreviousReceiptSha256: "0".repeat(64),
      preregistrationClosure: retained.closure,
    });
    expect(verified.valid).toBe(false);
    expect(verified.issues.join("; ")).toMatch(/execution lease/u);
  });

  it("rejects a fully rehashed runtime artifact that substitutes a resolved executable identity", () => {
    const retained = retainRawRuntimeFixture(fixture());
    const artifactRelativePath = retained.reference.artifactPath as string;
    const retainedArtifact = JSON.parse(readFileSync(
      join(retained.batchRoot, artifactRelativePath),
      "utf8",
    )) as Record<string, unknown>;
    const entries = structuredClone(retainedArtifact.entries) as Record<string, Record<string, unknown>>;
    entries.node = { ...entries.node, resolvedSha256: "f".repeat(64) };
    const { artifactSha256: _oldArtifactHash, derivationSha256: _oldDerivation, ...artifactBody } = retainedArtifact;
    const newArtifactBody = { ...artifactBody, entries };
    const derivationSha256 = sentinelProductionJsonSha256(newArtifactBody);
    const artifactWithDerivation = { ...newArtifactBody, derivationSha256 };
    const artifactSha256 = sentinelProductionJsonSha256(artifactWithDerivation);
    const newArtifactRelativePath = `manifests/runtime/runtime-artifacts-${artifactSha256}.json`;
    write(
      join(retained.batchRoot, newArtifactRelativePath),
      `${JSON.stringify({ ...artifactWithDerivation, artifactSha256 }, null, 2)}\n`,
      0o400,
    );

    const originalReceipt = JSON.parse(readFileSync(
      join(retained.batchRoot, retained.reference.inspectionReceiptPath),
      "utf8",
    )) as Record<string, unknown>;
    const lease = structuredClone(originalReceipt.executionLeaseIdentity) as Record<string, unknown>;
    lease.acquiredDerivationSha256 = derivationSha256;
    const { identitySha256: _oldLeaseHash, ...leaseBody } = lease;
    lease.identitySha256 = sentinelProductionJsonSha256(leaseBody);
    const { receiptSha256: _oldReceiptHash, ...receiptWithoutHash } = originalReceipt;
    const receiptBody = {
      ...receiptWithoutHash,
      artifact: { path: newArtifactRelativePath, sha256: artifactSha256, derivationSha256 },
      executionLeaseIdentity: lease,
    };
    const receiptSha256 = sentinelProductionJsonSha256(receiptBody);
    const receiptRelativePath = `manifests/runtime/runtime-initial-${receiptSha256}.json`;
    write(
      join(retained.batchRoot, receiptRelativePath),
      `${JSON.stringify({ ...receiptBody, receiptSha256 }, null, 2)}\n`,
      0o400,
    );
    const verified = verifySentinelRawRuntimeBoundary({
      batchRoot: retained.batchRoot,
      reference: {
        ...retained.reference,
        inspectionReceiptPath: receiptRelativePath,
        inspectionReceiptSha256: receiptSha256,
        artifactPath: newArtifactRelativePath,
        artifactSha256,
        derivationSha256,
        executionLeaseIdentitySha256: lease.identitySha256 as string,
      },
      expectedBoundary: "initial",
      expectedBlockSequence: null,
      expectedPreviousReceiptSha256: "0".repeat(64),
      preregistrationClosure: retained.closure,
    });
    expect(verified.valid).toBe(false);
    expect(verified.issues.join("; ")).toMatch(/Node entry/u);
  });

  it("reconstructs exact runtime bytes and retains independent derivation artifacts", () => {
    const value = fixture();
    const derived = deriveSentinelRuntimeClosure(value.paths, value.dependencies);
    expect(derived.closure.substrateRevision).toBe("a".repeat(40));
    expect(derived.closure.sourceTreeHash).toBe("b".repeat(40));
    expect(derived.closure.node.requestedEntrySha256).toBe(sha256("node-real"));
    expect(derived.closure.node.resolvedExecutableSha256).toBe(
      sha256("fixture node executable\n"),
    );
    expect(derived.closure.python.pipFreezeSha256).toBe(sha256(value.state.pipFreeze));
    expect(derived.closure.git.executableSha256).toBe(sha256("fixture git\n"));
    expect(derived.closure.executionEnvironment.values).toEqual(
      buildSentinelRuntimeSanitizedEnvironment(value.paths.nodeRequestedPath),
    );
    expect(derived.closure.workspace.packagesTreeEntryCount).toBeGreaterThan(0);
    expect(derived.closure.workspace.installedDependenciesTreeEntryCount).toBeGreaterThan(0);
    expect(derived.closure.python.stdlibTreeEntryCount).toBeGreaterThan(0);
    expect(derived.closure.browser.libraryTreeEntryCount).toBeGreaterThan(0);
    expect(derived.artifacts.installedDistributionsManifest).toContain('"canonicalName":"demo"');
    expect(derived.artifacts.browserBundleTree.manifest).toContain("resources/snapshot.bin");
    expect(derived.artifacts.upstreamGit.revision).toBe(SENTINEL_PRODUCTION_REVISION);
    expect(verifySentinelRuntimeClosure(value.paths, derived.closure, value.dependencies).closure)
      .toEqual(derived.closure);
  });

  it("uses only Git builtins with external helpers disabled", () => {
    const value = fixture();
    const { artifacts } = deriveSentinelRuntimeClosure(value.paths, value.dependencies);
    for (const git of [artifacts.substrateGit, artifacts.upstreamGit]) {
      const prefix = [
        "--exec-path=/dev/null",
        "--no-pager",
        "--no-replace-objects",
        "--literal-pathspecs",
        `--git-dir=${join(git.checkoutPath, ".git")}`,
        `--work-tree=${git.checkoutPath}`,
        "-c", `core.worktree=${git.checkoutPath}`,
        "-c", "core.fsmonitor=false",
        "-c", "core.attributesFile=/dev/null",
        "-c", "core.excludesFile=/dev/null",
        "-c", "core.hooksPath=/dev/null",
      ];
      for (const command of git.commands) {
        expect(command.arguments.slice(0, prefix.length)).toEqual(prefix);
        expect(command.arguments).not.toContain("-C");
      }
    }
  });

  it("rejects the macOS Git launcher instead of hashing the unexecuted shim", () => {
    const value = fixture();
    expect(() => deriveSentinelRuntimeClosure(
      { ...value.paths, gitExecutablePath: "/usr/bin/git" },
      { ...value.dependencies, platform: "darwin" },
    )).toThrow(/macOS \/usr\/bin\/git is a launcher/u);
  });

  it("rejects a stale but internally rehashed aggregate", () => {
    const value = fixture();
    const declared = deriveSentinelRuntimeClosure(value.paths, value.dependencies).closure;
    const stale = rehash({
      ...declared,
      upstream: {
        ...declared.upstream,
        frontendInstalledTreeSha256: "0".repeat(64),
      },
    });
    expect(() => verifySentinelRuntimeClosure(value.paths, stale, value.dependencies))
      .toThrow(/does not exactly match/u);
  });

  it("rejects a requested-entry symlink retarget", () => {
    const value = fixture();
    const declared = deriveSentinelRuntimeClosure(value.paths, value.dependencies).closure;
    const alternate = join(dirname(value.files.nodeTarget), "node-alternate");
    write(alternate, "alternate executable\n", 0o755);
    unlinkSync(value.files.nodeRequested);
    symlinkSync("node-alternate", value.files.nodeRequested);
    expect(() => verifySentinelRuntimeClosure(value.paths, declared, value.dependencies))
      .toThrow(/does not exactly match/u);
  });

  it("supports an externally resolved venv interpreter while binding later retargets", () => {
    const value = fixture();
    const externalRoot = join(dirname(value.paths.pythonEnvironmentRootPath), "python-runtime");
    const externalPython = join(externalRoot, "bin", "python3.12");
    const alternatePython = join(externalRoot, "bin", "python3.12-other");
    write(externalPython, "external Python runtime\n", 0o755);
    write(alternatePython, "other external Python runtime\n", 0o755);
    write(join(externalRoot, "lib", "python3.12", "os.py"), "# external stdlib\n");
    unlinkSync(value.paths.pythonRequestedVenvPath);
    symlinkSync(externalPython, value.paths.pythonRequestedVenvPath);
    const paths = {
      ...value.paths,
      pythonExecutableAllowedRootPath: externalRoot,
      pythonRuntimeRootPath: externalRoot,
      pythonStdlibRootPath: join(externalRoot, "lib", "python3.12"),
    };
    const declared = deriveSentinelRuntimeClosure(paths, value.dependencies).closure;
    expect(declared.python.resolvedExecutablePath).toBe(realpathSync(externalPython));
    unlinkSync(value.paths.pythonRequestedVenvPath);
    symlinkSync(alternatePython, value.paths.pythonRequestedVenvPath);
    expect(() => verifySentinelRuntimeClosure(paths, declared, value.dependencies))
      .toThrow(/does not exactly match/u);
  });

  it("rejects a dirty substrate checkout", () => {
    const value = fixture();
    value.state.dirtySubstrate = true;
    expect(() => deriveSentinelRuntimeClosure(value.paths, value.dependencies)).toThrow(/dirty/u);
  });

  it("rejects skip-worktree or assume-unchanged git index flags", () => {
    const value = fixture();
    value.state.gitIndexFlags = "S hidden-runtime.js\n";
    expect(() => deriveSentinelRuntimeClosure(value.paths, value.dependencies))
      .toThrow(/hidden or nonstandard git index flags/u);
  });

  it("rejects a resolved executable byte change", () => {
    const value = fixture();
    const declared = deriveSentinelRuntimeClosure(value.paths, value.dependencies).closure;
    writeFileSync(value.files.nodeTarget, "modified node executable\n");
    expect(() => verifySentinelRuntimeClosure(value.paths, declared, value.dependencies))
      .toThrow(/does not exactly match/u);
  });

  it("rejects a frontend installed-dependency tree change", () => {
    const value = fixture();
    const declared = deriveSentinelRuntimeClosure(value.paths, value.dependencies).closure;
    writeFileSync(value.files.frontendDependency, "export default 2;\n");
    expect(() => verifySentinelRuntimeClosure(value.paths, declared, value.dependencies))
      .toThrow(/does not exactly match/u);
  });

  it("rejects a transitive local workspace compiled-code change", () => {
    const value = fixture();
    const declared = deriveSentinelRuntimeClosure(value.paths, value.dependencies).closure;
    writeFileSync(value.files.transitiveWorkspace, "export const continuity = 2;\n");
    expect(() => verifySentinelRuntimeClosure(value.paths, declared, value.dependencies))
      .toThrow(/does not exactly match/u);
  });

  it("rejects a substrate node_modules dependency change", () => {
    const value = fixture();
    const declared = deriveSentinelRuntimeClosure(value.paths, value.dependencies).closure;
    writeFileSync(value.files.installedDependency, "export const pg = 2;\n");
    expect(() => verifySentinelRuntimeClosure(value.paths, declared, value.dependencies))
      .toThrow(/does not exactly match/u);
  });

  it("rejects a Python standard-library change", () => {
    const value = fixture();
    const declared = deriveSentinelRuntimeClosure(value.paths, value.dependencies).closure;
    writeFileSync(value.files.pythonStdlib, "# altered stdlib\n");
    expect(() => verifySentinelRuntimeClosure(value.paths, declared, value.dependencies))
      .toThrow(/does not exactly match/u);
  });

  it("rejects a Playwright library-code change outside the browser bundle", () => {
    const value = fixture();
    const declared = deriveSentinelRuntimeClosure(value.paths, value.dependencies).closure;
    writeFileSync(value.files.playwrightLibrary, "export const playwright = 2;\n");
    expect(() => verifySentinelRuntimeClosure(value.paths, declared, value.dependencies))
      .toThrow(/does not exactly match/u);
  });

  it("rejects an execution-environment change", () => {
    const value = fixture();
    const declared = deriveSentinelRuntimeClosure(value.paths, value.dependencies).closure;
    const changedDependencies: SentinelRuntimeClosureDependencies = {
      ...value.dependencies,
      executionEnvironment: {
        ...buildSentinelRuntimeSanitizedEnvironment(value.paths.nodeRequestedPath),
        TZ: "Etc/UTC",
      },
    };
    expect(() => verifySentinelRuntimeClosure(value.paths, declared, changedDependencies))
      .toThrow(/exact Node-derived sanitized environment/u);
  });

  it("derives PATH from pinned Node and resolves env-node without inheriting host secrets", () => {
    const environment = buildSentinelRuntimeSanitizedEnvironment(process.execPath);
    expect(environment.PATH).toBe(
      [...new Set([dirname(process.execPath), "/usr/bin", "/bin"])].join(":"),
    );
    expect(Object.hasOwn(environment, "ANTHROPIC_API_KEY")).toBe(false);
    expect(Object.hasOwn(environment, "PM_DATABASE_URL")).toBe(false);
    expect(isSentinelRuntimeSanitizedEnvironment(environment, process.execPath)).toBe(true);
    expect(isSentinelRuntimeSanitizedEnvironment(
      { ...environment, HOST_SECRET: "must-not-cross" },
      process.execPath,
    )).toBe(false);
    expect(() => buildSentinelRuntimeSanitizedEnvironment("/runtime/bin/node-real"))
      .toThrow(/canonical absolute and PATH-safe/u);

    const resolved = spawnSync("/usr/bin/env", ["node", "-p", "process.execPath"], {
      encoding: "utf8",
      env: { ...environment },
      timeout: 10_000,
    });
    expect(resolved.status, resolved.stderr).toBe(0);
    expect(resolved.stdout.trim()).not.toBe("");
  });

  it("rejects a git executable byte change", () => {
    const value = fixture();
    const declared = deriveSentinelRuntimeClosure(value.paths, value.dependencies).closure;
    writeFileSync(value.files.gitExecutable, "mutated fixture git\n");
    expect(() => verifySentinelRuntimeClosure(value.paths, declared, value.dependencies))
      .toThrow(/does not exactly match/u);
  });

  it("invalidates a verified execution lease after a post-verification mutation", () => {
    const value = fixture();
    const declared = deriveSentinelRuntimeClosure(value.paths, value.dependencies).closure;
    const lease = acquireSentinelRuntimeExecutionLease(value.paths, declared, value.dependencies);
    expect(lease.exactSupervisorPaths.agentScriptPath).toBe(value.paths.agentScriptPath);
    writeFileSync(value.files.installedDependency, "export const pg = 3;\n");
    expect(() => closeSentinelRuntimeExecutionLease(lease, value.dependencies))
      .toThrow(/does not exactly match|changed after execution lease/u);
  });

  it("rejects a Python installed file that no longer matches its RECORD", () => {
    const value = fixture();
    writeFileSync(value.files.pythonPackage, "VALUE = 2\n");
    expect(() => deriveSentinelRuntimeClosure(value.paths, value.dependencies))
      .toThrow(/RECORD digest mismatch/u);
  });

  it("rejects a command-output change", () => {
    const value = fixture();
    const declared = deriveSentinelRuntimeClosure(value.paths, value.dependencies).closure;
    value.state.npmVersion = "11.0.1\n";
    expect(() => verifySentinelRuntimeClosure(value.paths, declared, value.dependencies))
      .toThrow(/does not exactly match/u);
  });

  it("rejects lexical path aliasing before reading any runtime entry", () => {
    const value = fixture();
    const aliasedPaths = {
      ...value.paths,
      runnerScriptPath: `${dirname(value.paths.runnerScriptPath)}/../dist/${
        value.paths.runnerScriptPath.split("/").at(-1) as string
      }`,
    };
    expect(() => deriveSentinelRuntimeClosure(aliasedPaths, value.dependencies))
      .toThrow(/canonical absolute path/u);
  });

  it("rejects a caller-selected role file outside the substrate dist root", () => {
    const value = fixture();
    const arbitraryRunner = join(dirname(value.paths.substrateCheckoutPath), "arbitrary-runner.js");
    write(arbitraryRunner, "malicious alternate runner\n");
    expect(() => deriveSentinelRuntimeClosure({
      ...value.paths,
      runnerScriptPath: arbitraryRunner,
    }, value.dependencies)).toThrow(/runner script must be/u);
  });
});
