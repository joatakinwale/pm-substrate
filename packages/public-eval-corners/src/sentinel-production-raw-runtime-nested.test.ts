import {
  sentinelProductionCanonicalJson,
  sentinelProductionJsonSha256,
  sentinelProductionRuntimeClosureSha256,
  sentinelProductionSha256,
  type SentinelRuntimeClosure,
} from "./sentinel-production-plan.js";
import { verifySentinelRawRuntimeArtifacts } from "./sentinel-production-raw-runtime.js";
import { createValidSentinelProductionRuntimeDerivation } from "./sentinel-production-valid-runtime.test-support.js";
import type {
  SentinelRuntimeClosureArtifacts,
  SentinelRuntimeClosurePaths,
} from "./sentinel-runtime-closure.js";

import { describe, expect, it } from "vitest";

function runtimePaths(base = "/runtime"): SentinelRuntimeClosurePaths {
  return {
    gitExecutablePath: `${base}/git`,
    substrateCheckoutPath: `${base}/substrate`,
    rootPackageJsonPath: `${base}/substrate/package.json`,
    pnpmWorkspaceManifestPath: `${base}/substrate/pnpm-workspace.yaml`,
    rootTsconfigPath: `${base}/substrate/tsconfig.json`,
    tsconfigBasePath: `${base}/substrate/tsconfig.base.json`,
    publicEvalPackageJsonPath: `${base}/substrate/packages/public-eval-corners/package.json`,
    publicEvalTsconfigPath: `${base}/substrate/packages/public-eval-corners/tsconfig.json`,
    substratePackagesRootPath: `${base}/substrate/packages`,
    substrateInstalledDependenciesRootPath: `${base}/substrate/node_modules`,
    publicEvalCompiledOutputRootPath: `${base}/substrate/packages/public-eval-corners/dist`,
    pnpmWorkspaceLockPath: `${base}/substrate/pnpm-lock.yaml`,
    runnerScriptPath: `${base}/substrate/packages/public-eval-corners/dist/sentinel-production-runner.js`,
    supervisorScriptPath: `${base}/substrate/packages/public-eval-corners/dist/sentinel-production-supervisor.js`,
    verifierScriptPath: `${base}/substrate/packages/public-eval-corners/dist/sentinel-production-verifier.js`,
    agentScriptPath: `${base}/substrate/packages/public-eval-corners/dist/sentinel-general-agent.js`,
    providerProxyScriptPath: `${base}/substrate/packages/public-eval-corners/dist/sentinel-general-provider-proxy.js`,
    stateSidecarScriptPath: `${base}/substrate/packages/public-eval-corners/dist/production-state-sidecar.js`,
    nodeRequestedPath: `${base}/node-runtime/bin/node`,
    nodeAllowedRootPath: `${base}/node-runtime`,
    npmRequestedCliPath: `${base}/npm/cli.js`,
    npmAllowedRootPath: `${base}/npm`,
    pythonRequestedVenvPath: `${base}/venv/bin/python`,
    pythonEnvironmentRootPath: `${base}/venv`,
    pythonRuntimeRootPath: `${base}/python-runtime`,
    pythonStdlibRootPath: `${base}/python-runtime/lib/python3.12`,
    pythonExecutableAllowedRootPath: `${base}/python-runtime`,
    pythonPyvenvConfigPath: `${base}/venv/pyvenv.cfg`,
    pythonSitePackagesRootPaths: [`${base}/venv/lib/python3.12/site-packages`],
    playwrightPackageMetadataPath: `${base}/substrate/node_modules/playwright/package.json`,
    playwrightCorePackageMetadataPath: `${base}/substrate/node_modules/playwright-core/package.json`,
    playwrightLibraryRootPath: `${base}/substrate/node_modules/playwright`,
    playwrightCoreLibraryRootPath: `${base}/substrate/node_modules/playwright-core`,
    browserBundleRootPath: `${base}/browser`,
    browserExecutablePath: `${base}/browser/chrome`,
    upstreamCheckoutPath: `${base}/upstream`,
    upstreamFrontendPackageLockPath: `${base}/upstream/frontend/package-lock.json`,
    upstreamFrontendInstalledRootPath: `${base}/upstream/frontend/node_modules`,
    upstreamServerRequirementsPath: `${base}/upstream/server/requirements.txt`,
  };
}

function rehashArtifact(value: Record<string, unknown>): Record<string, unknown> {
  const { artifactSha256: _artifact, derivationSha256: _derivation, ...body } = value;
  const withDerivation = {
    ...body,
    derivationSha256: sentinelProductionJsonSha256(body),
  };
  return {
    ...withDerivation,
    artifactSha256: sentinelProductionJsonSha256(withDerivation),
  };
}

function rawArtifact(artifacts: SentinelRuntimeClosureArtifacts): Record<string, unknown> {
  return rehashArtifact(structuredClone(artifacts) as unknown as Record<string, unknown>);
}

function rehashClosure(closure: SentinelRuntimeClosure): SentinelRuntimeClosure {
  return {
    ...closure,
    closureSha256: sentinelProductionRuntimeClosureSha256(closure),
  };
}

function withInstalledManifest(
  artifact: Record<string, unknown>,
  closure: SentinelRuntimeClosure,
  mutate: (manifest: Record<string, unknown>) => void,
): { readonly artifact: Record<string, unknown>; readonly closure: SentinelRuntimeClosure } {
  const changed = structuredClone(artifact);
  const manifest = JSON.parse(changed.installedDistributionsManifest as string) as Record<string, unknown>;
  mutate(manifest);
  const installedDistributionsManifest = sentinelProductionCanonicalJson(manifest);
  const installedDistributionsManifestSha256 = sentinelProductionSha256(installedDistributionsManifest);
  changed.installedDistributionsManifest = installedDistributionsManifest;
  changed.installedDistributionsManifestSha256 = installedDistributionsManifestSha256;
  return {
    artifact: rehashArtifact(changed),
    closure: rehashClosure({
      ...closure,
      python: { ...closure.python, installedDistributionsManifestSha256 },
    }),
  };
}

describe("Sentinel raw nested runtime validation", () => {
  it("accepts an exact production-shaped nested runtime derivation", () => {
    const paths = runtimePaths();
    const { artifacts, closure } = createValidSentinelProductionRuntimeDerivation(paths);
    expect(() => verifySentinelRawRuntimeArtifacts(rawArtifact(artifacts), closure)).not.toThrow();
  });

  it.each([
    {
      name: "an aliased root",
      mutate(tree: Record<string, unknown>) { tree.rootPath = "/runtime/venv/../venv"; },
      error: /canonical absolute path/iu,
    },
    {
      name: "a control-character path",
      mutate(tree: Record<string, unknown>) {
        tree.manifest = `bad\u0001name\t0644\tfile\t${"1".repeat(64)}\n`;
        tree.manifestSha256 = sentinelProductionSha256(tree.manifest as string);
        tree.entryCount = 1;
      },
      error: /safe canonical relative path/iu,
    },
    {
      name: "a backslash path",
      mutate(tree: Record<string, unknown>) {
        tree.manifest = `bad\\name\t0644\tfile\t${"1".repeat(64)}\n`;
        tree.manifestSha256 = sentinelProductionSha256(tree.manifest as string);
        tree.entryCount = 1;
      },
      error: /safe canonical relative path/iu,
    },
    {
      name: "an empty path segment",
      mutate(tree: Record<string, unknown>) {
        tree.manifest = `bad//name\t0644\tfile\t${"1".repeat(64)}\n`;
        tree.manifestSha256 = sentinelProductionSha256(tree.manifest as string);
        tree.entryCount = 1;
      },
      error: /safe canonical relative path/iu,
    },
    {
      name: "a dot path segment",
      mutate(tree: Record<string, unknown>) {
        tree.manifest = `bad/./name\t0644\tfile\t${"1".repeat(64)}\n`;
        tree.manifestSha256 = sentinelProductionSha256(tree.manifest as string);
        tree.entryCount = 1;
      },
      error: /safe canonical relative path/iu,
    },
    {
      name: "unsorted entries",
      mutate(tree: Record<string, unknown>) {
        const empty = sentinelProductionSha256("");
        tree.manifest = `z\t0755\tdirectory\t${empty}\na\t0755\tdirectory\t${empty}\n`;
        tree.manifestSha256 = sentinelProductionSha256(tree.manifest as string);
        tree.entryCount = 2;
      },
      error: /strictly sorted and unique/iu,
    },
    {
      name: "a missing directory parent",
      mutate(tree: Record<string, unknown>) {
        tree.manifest = `missing/file\t0644\tfile\t${"1".repeat(64)}\n`;
        tree.manifestSha256 = sentinelProductionSha256(tree.manifest as string);
        tree.entryCount = 1;
      },
      error: /lacks directory parent/iu,
    },
    {
      name: "a non-empty directory digest",
      mutate(tree: Record<string, unknown>) {
        tree.manifest = `directory\t0755\tdirectory\t${"1".repeat(64)}\n`;
        tree.manifestSha256 = sentinelProductionSha256(tree.manifest as string);
        tree.entryCount = 1;
      },
      error: /non-empty digest/iu,
    },
  ])("rejects a coherently rehashed tree with $name", ({ mutate, error }) => {
    const paths = runtimePaths();
    const { artifacts, closure } = createValidSentinelProductionRuntimeDerivation(paths);
    const changed = rawArtifact(artifacts);
    mutate(changed.pythonEnvironmentTree as Record<string, unknown>);
    expect(() => verifySentinelRawRuntimeArtifacts(rehashArtifact(changed), closure)).toThrow(error);
  });

  it("rejects non-exact nested distribution file keys after coherent rehashing", () => {
    const paths = runtimePaths();
    const { artifacts, closure } = createValidSentinelProductionRuntimeDerivation(paths);
    const changed = withInstalledManifest(rawArtifact(artifacts), closure, (manifest) => {
      const distribution = (manifest.distributions as Record<string, unknown>[])[0] as Record<string, unknown>;
      const file = (distribution.files as Record<string, unknown>[])[0] as Record<string, unknown>;
      file.unbound = true;
    });
    expect(() => verifySentinelRawRuntimeArtifacts(changed.artifact, changed.closure))
      .toThrow(/file 1 keys are not exact/iu);
  });

  it("rejects a valid-looking site-tree hash that is not reconstructed from the environment tree", () => {
    const paths = runtimePaths();
    const { artifacts, closure } = createValidSentinelProductionRuntimeDerivation(paths);
    const changed = withInstalledManifest(rawArtifact(artifacts), closure, (manifest) => {
      const siteTree = (manifest.siteTrees as Record<string, unknown>[])[0] as Record<string, unknown>;
      siteTree.manifestSha256 = "f".repeat(64);
    });
    expect(() => verifySentinelRawRuntimeArtifacts(changed.artifact, changed.closure))
      .toThrow(/does not match the Python environment subtree/iu);
  });

  it("rejects distribution file hashes that do not match the environment tree", () => {
    const paths = runtimePaths();
    const { artifacts, closure } = createValidSentinelProductionRuntimeDerivation(paths);
    const changed = withInstalledManifest(rawArtifact(artifacts), closure, (manifest) => {
      const distribution = (manifest.distributions as Record<string, unknown>[])[0] as Record<string, unknown>;
      const files = distribution.files as Record<string, unknown>[];
      const packageFile = files.find((file) => (file.path as string).endsWith("/demo.py")) as Record<string, unknown>;
      packageFile.sha256 = "f".repeat(64);
      packageFile.recordSha256 = packageFile.sha256;
    });
    expect(() => verifySentinelRawRuntimeArtifacts(changed.artifact, changed.closure))
      .toThrow(/does not match the Python environment tree/iu);
  });

  it("rejects pip-freeze identities that differ from canonical distribution identities", () => {
    const paths = runtimePaths();
    const { artifacts, closure } = createValidSentinelProductionRuntimeDerivation(paths);
    const changed = rawArtifact(artifacts);
    changed.pipFreeze = "Other==1.0\n";
    const changedClosure = rehashClosure({
      ...closure,
      python: { ...closure.python, pipFreezeSha256: sentinelProductionSha256(changed.pipFreeze as string) },
    });
    expect(() => verifySentinelRawRuntimeArtifacts(rehashArtifact(changed), changedClosure))
      .toThrow(/does not exactly match installed distribution identities/iu);
  });

  it("rejects a coherently rehashed verifier file that contradicts its compiled tree", () => {
    const paths = runtimePaths();
    const { artifacts, closure } = createValidSentinelProductionRuntimeDerivation(paths);
    const changed = rawArtifact(artifacts);
    const files = changed.files as Record<string, Record<string, unknown>>;
    const substitutedSha256 = "f".repeat(64);
    files.verifierScript = { ...files.verifierScript, sha256: substitutedSha256 };
    const changedClosure = rehashClosure({
      ...closure,
      verifierScriptSha256: substitutedSha256,
    });
    expect(() => verifySentinelRawRuntimeArtifacts(rehashArtifact(changed), changedClosure))
      .toThrow(/verifierScript file contradicts retained tree/iu);
  });

  it("rejects a coherently rehashed compiled subtree that contradicts the workspace tree", () => {
    const paths = runtimePaths();
    const { artifacts, closure } = createValidSentinelProductionRuntimeDerivation(paths);
    const changed = rawArtifact(artifacts);
    const compiledTree = changed.publicEvalCompiledOutputTree as Record<string, unknown>;
    const verifierLine = (compiledTree.manifest as string)
      .split("\n")
      .find((line) => line.startsWith("sentinel-production-verifier.js\t")) as string;
    const [path, mode, type] = verifierLine.split("\t") as [string, string, string];
    const substitutedLine = `${path}\t${mode}\t${type}\t${"f".repeat(64)}`;
    compiledTree.manifest = (compiledTree.manifest as string).replace(verifierLine, substitutedLine);
    compiledTree.manifestSha256 = sentinelProductionSha256(compiledTree.manifest as string);
    const changedClosure = rehashClosure({
      ...closure,
      workspace: {
        ...closure.workspace,
        compiledOutputTreeSha256: compiledTree.manifestSha256 as string,
      },
    });
    expect(() => verifySentinelRawRuntimeArtifacts(rehashArtifact(changed), changedClosure))
      .toThrow(/compiled-output tree does not exactly match its retained parent-tree subtree/iu);
  });

  it("rejects a coherently substituted browser executable tree file", () => {
    const paths = runtimePaths();
    const { artifacts, closure } = createValidSentinelProductionRuntimeDerivation(paths);
    const changed = rawArtifact(artifacts);
    const files = changed.files as Record<string, Record<string, unknown>>;
    const browserTree = changed.browserBundleTree as Record<string, unknown>;
    const resourceLine = (browserTree.manifest as string)
      .split("\n")
      .find((line) => line.startsWith("resources/snapshot.bin\t")) as string;
    const [resourcePath, , resourceType, sha256] = resourceLine.split("\t") as [string, string, string, string];
    const executableResourceLine = `${resourcePath}\t0755\t${resourceType}\t${sha256}`;
    browserTree.manifest = (browserTree.manifest as string).replace(resourceLine, executableResourceLine);
    browserTree.manifestSha256 = sentinelProductionSha256(browserTree.manifest as string);
    files.browserExecutable = {
      ...files.browserExecutable,
      path: `${paths.browserBundleRootPath}/resources/snapshot.bin`,
      mode: "0755",
      sha256,
    };
    const changedClosure = rehashClosure({
      ...closure,
      browser: {
        ...closure.browser,
        executableSha256: sha256,
        bundleTreeSha256: browserTree.manifestSha256 as string,
      },
    });
    expect(() => verifySentinelRawRuntimeArtifacts(rehashArtifact(changed), changedClosure))
      .toThrow(/bound requested file or its retained symlink target/iu);
  });
});
