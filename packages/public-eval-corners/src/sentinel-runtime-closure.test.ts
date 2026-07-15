import { createHash } from "node:crypto";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
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
  SENTINEL_PRODUCTION_REVISION,
  SENTINEL_PRODUCTION_SOURCE_TREE,
  sentinelProductionRuntimeClosureSha256,
  type SentinelRuntimeClosure,
} from "./sentinel-production-plan.js";
import {
  deriveSentinelRuntimeClosure,
  verifySentinelRuntimeClosure,
  type SentinelRuntimeClosureDependencies,
  type SentinelRuntimeClosurePaths,
  type SentinelRuntimeCommandInvocation,
  type SentinelRuntimeCommandResult,
} from "./sentinel-runtime-closure.js";

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
    nodeTarget: string;
    nodeRequested: string;
    frontendDependency: string;
    pythonPackage: string;
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
  const root = mkdtempSync(join(tmpdir(), "pm-sentinel-runtime-"));
  roots.push(root);
  const substrate = join(root, "substrate");
  const upstream = join(root, "upstream");
  const runtime = join(root, "runtime");
  const scripts = join(substrate, "packages", "public-eval-corners", "dist");
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
    pythonExecutableAllowedRootPath: pythonRoot,
    pythonPyvenvConfigPath: join(pythonRoot, "pyvenv.cfg"),
    pythonSitePackagesRootPaths: [siteRoot],
    playwrightPackageMetadataPath: playwrightPackage,
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
    const [first, second, ...rest] = invocation.arguments;
    if (first === "-C") {
      const gitCheckout = second;
      const command = rest.join(" ");
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
    files: { nodeTarget, nodeRequested, frontendDependency, pythonPackage: packageFile },
  };
}

function rehash(closure: SentinelRuntimeClosure): SentinelRuntimeClosure {
  return {
    ...closure,
    closureSha256: sentinelProductionRuntimeClosureSha256(closure),
  };
}

describe("Sentinel production runtime closure", () => {
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
    expect(derived.artifacts.installedDistributionsManifest).toContain('"canonicalName":"demo"');
    expect(derived.artifacts.browserBundleTree.manifest).toContain("resources/snapshot.bin");
    expect(derived.artifacts.upstreamGit.revision).toBe(SENTINEL_PRODUCTION_REVISION);
    expect(verifySentinelRuntimeClosure(value.paths, derived.closure, value.dependencies).closure)
      .toEqual(derived.closure);
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
    unlinkSync(value.paths.pythonRequestedVenvPath);
    symlinkSync(externalPython, value.paths.pythonRequestedVenvPath);
    const paths = { ...value.paths, pythonExecutableAllowedRootPath: externalRoot };
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
