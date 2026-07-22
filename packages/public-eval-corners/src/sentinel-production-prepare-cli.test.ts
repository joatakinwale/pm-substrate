import {
  chmodSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import {
  SENTINEL_PRODUCTION_REPOSITORY,
  SENTINEL_PRODUCTION_REVISION,
  SENTINEL_PRODUCTION_SOURCE_TREE,
  sentinelProductionCanonicalJson,
  sentinelProductionJsonSha256,
  sentinelProductionRuntimeClosureSha256,
  sentinelProductionSha256,
  type SentinelRuntimeClosure,
} from "./sentinel-production-plan.js";
import {
  parseSentinelProductionPrepareInvocation,
  parseSentinelRuntimeClosurePaths,
} from "./sentinel-production-prepare-contracts.js";
import { prepareSentinelProductionQualification } from "./sentinel-production-prepare-cli.js";
import { createValidSentinelProductionRuntimeDerivation } from "./sentinel-production-valid-runtime.test-support.js";
import type { SentinelProductionCheckoutPreflight } from "./sentinel-production-runner-manifests.js";
import type { SentinelRuntimeClosurePaths } from "./sentinel-runtime-closure.js";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    try {
      const prepared = resolve(root, "prepared");
      if (existsSync(prepared)) chmodSync(prepared, 0o700);
      chmodSync(root, 0o700);
      rmSync(root, { recursive: true, force: true });
    } catch {
      // Test cleanup only.
    }
  }
});

function root(): string {
  const value = realpathSync(mkdtempSync(join(tmpdir(), "pm-sentinel-prepare-test-")));
  roots.push(value);
  return value;
}

function runtimePaths(base = "/runtime"): Record<string, unknown> {
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

function setup() {
  const base = root();
  const checkouts = {
    native: resolve(base, "native"),
    sham: resolve(base, "sham"),
    "plain-kv": resolve(base, "plain-kv"),
    substrate: resolve(base, "substrate"),
  } as const;
  for (const path of Object.values(checkouts)) mkdirSync(path);
  const parsedPaths = parseSentinelRuntimeClosurePaths(
    runtimePaths(resolve(base, "runtime")),
  );
  for (const path of [
    parsedPaths.substrateCheckoutPath,
    parsedPaths.upstreamCheckoutPath,
    parsedPaths.substratePackagesRootPath,
    parsedPaths.substrateInstalledDependenciesRootPath,
    parsedPaths.publicEvalCompiledOutputRootPath,
    parsedPaths.nodeAllowedRootPath,
    parsedPaths.npmAllowedRootPath,
    parsedPaths.pythonEnvironmentRootPath,
    parsedPaths.pythonRuntimeRootPath,
    parsedPaths.pythonStdlibRootPath,
    parsedPaths.pythonExecutableAllowedRootPath,
    ...parsedPaths.pythonSitePackagesRootPaths,
    parsedPaths.playwrightLibraryRootPath,
    parsedPaths.playwrightCoreLibraryRootPath,
    parsedPaths.browserBundleRootPath,
    parsedPaths.upstreamFrontendInstalledRootPath,
  ]) mkdirSync(path, { recursive: true });
  const invocation = parseSentinelProductionPrepareInvocation({
    schemaVersion: "pm.public-eval-corners.sentinel-production-prepare-invocation.v1",
    outputRoot: resolve(base, "prepared"),
    runtimePathsPath: resolve(base, "runtime-paths-input.json"),
    checkouts,
    registration: {
      registrationId: "sentinel-qualification-test",
      registeredAt: "2026-07-21T12:00:00.000Z",
      producerId: "producer-test",
      repeatIds: ["repeat-01", "repeat-02", "repeat-03"],
      randomizationSeed: "randomization-test",
      bootstrapSeed: "bootstrap-test",
      rawBatchVerifierId: "raw-verifier-test",
    },
  });
  return { base, checkouts, invocation, parsedPaths };
}

function preflight(
  checkoutPath: string,
  runtime: SentinelRuntimeClosure,
): SentinelProductionCheckoutPreflight {
  const ignoredPathListingSha256 = runtime.upstream.ignoredPathListingSha256;
  const frontendInstalledTreeSha256 = runtime.upstream.frontendInstalledTreeSha256;
  const body = {
    schemaVersion:
      "pm.public-eval-corners.sentinel-production-checkout-preflight.v2" as const,
    checkoutPath,
    repositoryUrl: SENTINEL_PRODUCTION_REPOSITORY,
    revision: SENTINEL_PRODUCTION_REVISION,
    sourceTreeHash: SENTINEL_PRODUCTION_SOURCE_TREE,
    cleanTrackedAndUntracked: true,
    ignoredArtifactRootSha256: sentinelProductionJsonSha256({
      ignoredListingSha256: ignoredPathListingSha256,
      frontendInstalledTreeSha256,
    }),
    ignoredPathListingBase64: "ZnJvbnRlbmQvbm9kZV9tb2R1bGVzLwA=",
    ignoredPathListingSha256,
    databaseRootSha256: "6".repeat(64),
    selectedScenarioRootSha256: "7".repeat(64),
    frontendInstalledTreeSha256,
    frontendPackageLockSha256: runtime.upstream.frontendPackageLockSha256,
    serverRequirementsSha256: runtime.upstream.serverRequirementsSha256,
    valid: true,
    issues: [] as readonly string[],
  };
  return { ...body, preflightSha256: sentinelProductionJsonSha256(body) };
}

function dependencies(
  inspect = preflight,
) {
  return {
    deriveRuntimeClosure: (paths: SentinelRuntimeClosurePaths) =>
      createValidSentinelProductionRuntimeDerivation(paths),
    inspectCheckout: (
      checkoutPath: string,
      _selectedTasks: unknown,
      runtime: SentinelRuntimeClosure,
    ) => inspect(checkoutPath, runtime),
  };
}

type ValidDerivation = ReturnType<typeof createValidSentinelProductionRuntimeDerivation>;

function coherentlyMutatedDerivation(
  paths: SentinelRuntimeClosurePaths,
  mutate: (
    closure: Record<string, unknown>,
    artifactBody: Record<string, unknown>,
  ) => void,
): ValidDerivation {
  const valid = createValidSentinelProductionRuntimeDerivation(paths);
  const closure = structuredClone(valid.closure) as unknown as Record<string, unknown>;
  const { derivationSha256: _derivationSha256, ...artifactBody } =
    structuredClone(valid.artifacts) as unknown as Record<string, unknown>;
  mutate(closure, artifactBody);
  closure.closureSha256 = sentinelProductionRuntimeClosureSha256(
    closure as unknown as SentinelRuntimeClosure,
  );
  const artifacts = {
    ...artifactBody,
    derivationSha256: sentinelProductionJsonSha256(artifactBody),
  } as unknown as ValidDerivation["artifacts"];
  return { closure: closure as unknown as SentinelRuntimeClosure, artifacts };
}

describe("Sentinel production preparation contracts", () => {
  it("strictly parses only the exact invocation and 39 runtime-path keys", () => {
    const paths = runtimePaths();
    expect(Object.keys(parseSentinelRuntimeClosurePaths(paths))).toHaveLength(39);
    expect(() => parseSentinelRuntimeClosurePaths({ ...paths, unexpected: "/runtime/x" }))
      .toThrow(/keys are not exact/u);
    const { gitExecutablePath: _removed, ...missing } = paths;
    expect(() => parseSentinelRuntimeClosurePaths(missing)).toThrow(/keys are not exact/u);
    expect(() => parseSentinelRuntimeClosurePaths({
      ...paths,
      pythonSitePackagesRootPaths: [],
    })).toThrow(/non-empty/u);

    const { invocation } = setup();
    expect(() => parseSentinelProductionPrepareInvocation({
      ...invocation,
      signature: "forbidden",
    })).toThrow(/keys are not exact/u);
  });

  it("publishes the exact unsigned, outcome-free 36-cell preparation bundle", () => {
    const value = setup();
    const { invocation, parsedPaths } = value;
    const result = prepareSentinelProductionQualification(
      invocation,
      parsedPaths,
      dependencies(),
    );
    expect(result).toMatchObject({
      preparationOnly: true,
      qualification: false,
      materialBenefit: false,
      evidenceEligible: false,
      analysisEligible: false,
      cellCount: 36,
      blockCount: 9,
    });
    expect(readdirSync(invocation.outputRoot).sort()).toEqual([
      "checkout-preflights.json",
      "preparation-manifest.json",
      "preregistration.json",
      "runtime-derivation-artifacts.json",
      "runtime-paths.json",
      "schedule.json",
    ]);
    const schedule = JSON.parse(
      readFileSync(resolve(invocation.outputRoot, "schedule.json"), "utf8"),
    ) as readonly { readonly taskId: string; readonly repeatId: string; readonly arm: string }[];
    expect(schedule).toHaveLength(36);
    for (let index = 0; index < schedule.length; index += 4) {
      const block = schedule.slice(index, index + 4);
      expect(new Set(block.map(({ taskId }) => taskId)).size).toBe(1);
      expect(new Set(block.map(({ repeatId }) => repeatId)).size).toBe(1);
      expect(new Set(block.map(({ arm }) => arm)).size).toBe(4);
    }
    const manifest = JSON.parse(
      readFileSync(resolve(invocation.outputRoot, "preparation-manifest.json"), "utf8"),
    ) as Record<string, unknown>;
    expect(manifest).toMatchObject({
      preparationOnly: true,
      qualification: false,
      materialBenefit: false,
      evidenceEligible: false,
      analysisEligible: false,
      selectedPhase: "qualification",
      contains: {
        credentials: false,
        signature: false,
        privateKey: false,
        externalTrustAnchor: false,
        externalCommitment: false,
        outcomes: false,
      },
      schedule: { cellCount: 36, blockCount: 9, taskCount: 3, repeatCount: 3, armCount: 4 },
    });
  });

  it("fails before publication when any checkout is invalid", () => {
    const value = setup();
    const { invocation, parsedPaths } = value;
    expect(() => prepareSentinelProductionQualification(
      invocation,
      parsedPaths,
      dependencies((checkoutPath, runtime) => {
        const valid = preflight(checkoutPath, runtime);
        if (!checkoutPath.endsWith("/sham")) return valid;
        const body = { ...valid, valid: false, issues: ["dirty checkout"] };
        const { preflightSha256: _hash, ...withoutHash } = body;
        return {
          ...withoutHash,
          preflightSha256: sentinelProductionJsonSha256(withoutHash),
        };
      }),
    )).toThrow(/sham checkout preflight failed/u);
    expect(existsSync(invocation.outputRoot)).toBe(false);
  });

  it("fails before publication when valid checkout roots are not matched", () => {
    const value = setup();
    const { invocation, parsedPaths } = value;
    expect(() => prepareSentinelProductionQualification(
      invocation,
      parsedPaths,
      dependencies((checkoutPath, runtime) => {
        const valid = preflight(checkoutPath, runtime);
        if (!checkoutPath.endsWith("/plain-kv")) return valid;
        const { preflightSha256: _hash, ...body } = valid;
        const mismatched = { ...body, databaseRootSha256: "b".repeat(64) };
        return {
          ...mismatched,
          preflightSha256: sentinelProductionJsonSha256(mismatched),
        };
      }),
    )).toThrow(/databaseRootSha256 roots are not identical/u);
    expect(existsSync(invocation.outputRoot)).toBe(false);
  });

  it("rejects an output root inside any closure-bound runtime tree", () => {
    const value = setup();
    const { invocation, parsedPaths } = value;
    const nestedOutput = resolve(parsedPaths.pythonEnvironmentRootPath, "prepared");
    expect(() => prepareSentinelProductionQualification(
      { ...invocation, outputRoot: nestedOutput },
      parsedPaths,
      dependencies(),
    )).toThrow(/overlaps a checkout or runtime source root/iu);
    expect(existsSync(nestedOutput)).toBe(false);
  });

  it("rejects physically aliased four-arm checkout roots before inspection", () => {
    const value = setup();
    const aliased = {
      ...value.invocation,
      checkouts: {
        ...value.invocation.checkouts,
        sham: value.invocation.checkouts.native,
      },
    };
    expect(() => prepareSentinelProductionQualification(
      aliased,
      value.parsedPaths,
      dependencies(),
    )).toThrow(/physically disjoint checkout roots/iu);
    expect(existsSync(value.invocation.outputRoot)).toBe(false);
  });

  it("removes the temporary bundle when runtime or checkouts change before publication", () => {
    const value = setup();
    const { invocation, parsedPaths } = value;
    let derivationCount = 0;
    expect(() => prepareSentinelProductionQualification(invocation, parsedPaths, {
      ...dependencies(),
      deriveRuntimeClosure: (paths) => {
        derivationCount += 1;
        return createValidSentinelProductionRuntimeDerivation(paths, derivationCount);
      },
    })).toThrow(/runtime changed during/iu);
    expect(existsSync(invocation.outputRoot)).toBe(false);

    const second = setup();
    let inspectionCount = 0;
    expect(() => prepareSentinelProductionQualification(
      second.invocation,
      second.parsedPaths,
      {
        ...dependencies(),
        inspectCheckout: (checkoutPath, _selectedTasks, runtime) => {
          inspectionCount += 1;
          const value = preflight(checkoutPath, runtime);
          if (inspectionCount <= 4 || !checkoutPath.endsWith("/substrate")) return value;
          const { preflightSha256: _hash, ...body } = value;
          const changed = { ...body, databaseRootSha256: "b".repeat(64) };
          return { ...changed, preflightSha256: sentinelProductionJsonSha256(changed) };
        },
      },
    )).toThrow(/checkout.*changed|roots are not identical/iu);
    expect(existsSync(second.invocation.outputRoot)).toBe(false);
  });

  it("rejects malformed closure and artifact schemas even when their hashes are coherent", () => {
    const first = setup();
    const validDerivation = createValidSentinelProductionRuntimeDerivation(
      first.parsedPaths,
    );
    const validClosure = validDerivation.closure;
    const malformedClosure = {
      ...validClosure,
      closureSchemaVersion: "pm.public-eval-corners.sentinel-runtime-closure.v2",
    } as unknown as SentinelRuntimeClosure;
    const coherentlyHashedClosure = {
      ...malformedClosure,
      closureSha256: sentinelProductionRuntimeClosureSha256(malformedClosure),
    };
    expect(() => prepareSentinelProductionQualification(
      first.invocation,
      first.parsedPaths,
      {
        ...dependencies(),
        deriveRuntimeClosure: () => ({
          closure: coherentlyHashedClosure,
          artifacts: validDerivation.artifacts,
        }),
      },
    )).toThrow(/exact valid v3 closure/iu);
    expect(existsSync(first.invocation.outputRoot)).toBe(false);

    const second = setup();
    const secondDerivation = createValidSentinelProductionRuntimeDerivation(
      second.parsedPaths,
    );
    const validArtifacts = secondDerivation.artifacts as unknown as Record<string, unknown>;
    const { derivationSha256: _hash, ...artifactBody } = validArtifacts;
    const malformedBody = {
      ...artifactBody,
      schemaVersion: "pm.public-eval-corners.sentinel-runtime-closure-artifacts.v3",
    };
    const malformedArtifacts = {
      ...malformedBody,
      derivationSha256: sentinelProductionJsonSha256(malformedBody),
    } as unknown as typeof secondDerivation.artifacts;
    expect(() => prepareSentinelProductionQualification(
      second.invocation,
      second.parsedPaths,
      {
        ...dependencies(),
        deriveRuntimeClosure: () => ({
          closure: secondDerivation.closure,
          artifacts: malformedArtifacts,
        }),
      },
    )).toThrow(/doubly content-addressed/iu);
    expect(existsSync(second.invocation.outputRoot)).toBe(false);
  });

  it.each([
    ["adds forbidden outcome and private-key fields inside the installed-distribution manifest", (
      closure: Record<string, unknown>,
      artifact: Record<string, unknown>,
    ) => {
      const manifest = JSON.parse(String(artifact.installedDistributionsManifest)) as Record<string, unknown>;
      const distributions = manifest.distributions as Record<string, unknown>[];
      distributions[0] = { ...distributions[0], outcome: true, privateKey: "forbidden" };
      const canonical = sentinelProductionCanonicalJson(manifest);
      const sha256 = sentinelProductionSha256(canonical);
      artifact.installedDistributionsManifest = canonical;
      artifact.installedDistributionsManifestSha256 = sha256;
      (closure.python as Record<string, unknown>).installedDistributionsManifestSha256 = sha256;
    }],
    ["inserts an unsafe dot-segment into a retained tree", (
      closure: Record<string, unknown>,
      artifact: Record<string, unknown>,
    ) => {
      const retainedTree = artifact.browserBundleTree as Record<string, unknown>;
      const manifest = `a/../browser\t0644\tfile\t${"a".repeat(64)}\n`;
      retainedTree.manifest = manifest;
      retainedTree.manifestSha256 = sentinelProductionSha256(manifest);
      retainedTree.entryCount = 1;
      (closure.browser as Record<string, unknown>).bundleTreeSha256 =
        retainedTree.manifestSha256;
    }],
    ["substitutes the signed Git executable in a nested command", (
      _closure: Record<string, unknown>,
      artifact: Record<string, unknown>,
    ) => {
      const git = artifact.substrateGit as Record<string, unknown>;
      const commands = git.commands as Record<string, unknown>[];
      commands[0] = { ...commands[0], executablePath: "/tmp/forged-git" };
    }],
  ] as const)("rejects a coherently rehashed runtime artifact that %s", (_label, mutate) => {
    const value = setup();
    const malformed = coherentlyMutatedDerivation(value.parsedPaths, mutate);
    expect(() => prepareSentinelProductionQualification(
      value.invocation,
      value.parsedPaths,
      {
        ...dependencies(),
        deriveRuntimeClosure: () => malformed,
      },
    )).toThrow(/runtime|distribution|tree|path|git|keys/iu);
    expect(existsSync(value.invocation.outputRoot)).toBe(false);
  });

  it("rejects callback tampering with the private on-disk bundle inventory", () => {
    const value = setup();
    let inspectionCount = 0;
    expect(() => prepareSentinelProductionQualification(
      value.invocation,
      value.parsedPaths,
      {
        ...dependencies(),
        inspectCheckout: (checkoutPath, _selectedTasks, runtime) => {
          inspectionCount += 1;
          if (inspectionCount === 5) {
            const temporaryName = readdirSync(value.base).find((name) =>
              name.startsWith(".pm-sentinel-production-prepare-"));
            if (temporaryName === undefined) throw new Error("test did not find private bundle");
            writeFileSync(resolve(value.base, temporaryName, "injected-outcome.json"), "{}\n");
          }
          return preflight(checkoutPath, runtime);
        },
      },
    )).toThrow(/on-disk inventory differs/iu);
    expect(existsSync(value.invocation.outputRoot)).toBe(false);
  });

  it("never replaces or deletes a concurrently claimed output root", () => {
    const value = setup();
    let inspectionCount = 0;
    expect(() => prepareSentinelProductionQualification(
      value.invocation,
      value.parsedPaths,
      {
        ...dependencies(),
        inspectCheckout: (checkoutPath, _selectedTasks, runtime) => {
          inspectionCount += 1;
          if (inspectionCount === 5) mkdirSync(value.invocation.outputRoot, { mode: 0o700 });
          return preflight(checkoutPath, runtime);
        },
      },
    )).toThrow(/outputRoot must be fresh/iu);
    expect(existsSync(value.invocation.outputRoot)).toBe(true);
    expect(readdirSync(value.invocation.outputRoot)).toEqual([]);
  });
});
