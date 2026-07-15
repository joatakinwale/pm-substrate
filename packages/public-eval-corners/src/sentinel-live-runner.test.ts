import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  createSignedSentinelLivePreregistration,
  inspectSentinelLiveRuntime,
  runSentinelLiveBatch,
  verifyContentAddressedSentinelManifest,
  type SentinelLiveRunInput,
  type SentinelLiveRunnerDependencies,
  type SentinelLiveRuntimePaths,
  type SentinelLiveRuntimeSnapshot,
} from "./sentinel-live-runner.js";
import type { SentinelAnthropicProviderProxy as RunningSentinelAnthropicProviderProxy } from "./sentinel-anthropic-provider-proxy.js";
import type {
  RunningSentinelStateSidecar,
  StartSentinelStateSidecarInput,
} from "./sentinel-state-sidecar.js";
import type {
  SentinelAttemptSupervisorInput,
  SentinelAttemptTerminalReceipt,
} from "./sentinel-attempt-supervisor.js";

function sha(character: string): string {
  return character.repeat(64);
}

interface Fixture {
  readonly root: string;
  readonly checkoutPath: string;
  readonly batchRoot: string;
  readonly registryRoot: string;
  readonly runtimePaths: SentinelLiveRuntimePaths;
  readonly runtime: SentinelLiveRuntimeSnapshot;
}

function fixture(label: string): Fixture {
  const root = mkdtempSync(resolve(tmpdir(), `pm-sentinel-live-runner-${label}-`));
  const checkoutPath = resolve(root, "public-source");
  const runtimeRoot = resolve(root, "runtime");
  mkdirSync(checkoutPath);
  mkdirSync(runtimeRoot);
  const files = [
    "pnpm-lock.yaml",
    "runner.js",
    "supervisor.js",
    "verifier.js",
    "agent.js",
    "sidecar.js",
    "provider.js",
    "playwright-package.json",
    "node",
    "python3",
    "pnpm",
  ];
  for (const file of files) {
    writeFileSync(
      resolve(runtimeRoot, file),
      file === "playwright-package.json" ? '{"version":"1.56.1"}\n' : `${file}\n`,
      { mode: 0o700 },
    );
  }
  const runtimePaths: SentinelLiveRuntimePaths = {
    repositoryRoot: root,
    packageLockPath: resolve(runtimeRoot, "pnpm-lock.yaml"),
    runnerScriptPath: resolve(runtimeRoot, "runner.js"),
    supervisorScriptPath: resolve(runtimeRoot, "supervisor.js"),
    verifierScriptPath: resolve(runtimeRoot, "verifier.js"),
    agentScriptPath: resolve(runtimeRoot, "agent.js"),
    sidecarScriptPath: resolve(runtimeRoot, "sidecar.js"),
    providerProxyScriptPath: resolve(runtimeRoot, "provider.js"),
    playwrightPackageJsonPath: resolve(runtimeRoot, "playwright-package.json"),
    nodeExecutablePath: resolve(runtimeRoot, "node"),
    pythonExecutablePath: resolve(runtimeRoot, "python3"),
    frontendExecutablePath: resolve(runtimeRoot, "pnpm"),
  };
  const artifacts: SentinelLiveRuntimeSnapshot["artifacts"] = [
    { role: "package-lock", path: runtimePaths.packageLockPath, byteLength: 1, sha256: sha("1") },
    { role: "runner-script", path: runtimePaths.runnerScriptPath, byteLength: 1, sha256: sha("2") },
    { role: "supervisor-script", path: runtimePaths.supervisorScriptPath, byteLength: 1, sha256: sha("3") },
    { role: "verifier-script", path: runtimePaths.verifierScriptPath, byteLength: 1, sha256: sha("4") },
    { role: "agent-script", path: runtimePaths.agentScriptPath, byteLength: 1, sha256: sha("5") },
    { role: "state-sidecar-script", path: runtimePaths.sidecarScriptPath, byteLength: 1, sha256: sha("6") },
    { role: "provider-proxy-script", path: runtimePaths.providerProxyScriptPath, byteLength: 1, sha256: sha("7") },
    { role: "playwright-package", path: runtimePaths.playwrightPackageJsonPath, byteLength: 1, sha256: sha("8") },
    { role: "node-executable", path: runtimePaths.nodeExecutablePath, byteLength: 1, sha256: sha("9") },
    { role: "python-executable", path: runtimePaths.pythonExecutablePath, byteLength: 1, sha256: sha("a") },
    { role: "frontend-executable", path: runtimePaths.frontendExecutablePath, byteLength: 1, sha256: sha("b") },
  ];
  return {
    root,
    checkoutPath,
    batchRoot: resolve(root, "batch-evidence"),
    registryRoot: resolve(root, "attempt-registry"),
    runtimePaths,
    runtime: {
      substrateRevision: "1".repeat(40),
      sourceTreeHash: "2".repeat(40),
      workingTreeClean: true,
      runtimeClosureSha256: sha("c"),
      packageLockSha256: sha("1"),
      runnerScriptSha256: sha("2"),
      supervisorScriptSha256: sha("3"),
      verifierScriptSha256: sha("4"),
      agentScriptSha256: sha("5"),
      sidecarScriptSha256: sha("6"),
      providerProxyScriptSha256: sha("7"),
      nodeVersion: "v26.0.0",
      pythonVersion: "Python 3.12.13",
      playwrightVersion: "1.56.1",
      artifacts,
      pythonExecutable: { path: runtimePaths.pythonExecutablePath, sha256: sha("a") },
      frontendExecutable: { path: runtimePaths.frontendExecutablePath, sha256: sha("b") },
    },
  };
}

function validSource() {
  return {
    valid: true,
    manifestSha256: "9da3305715740840299a1acc8b47bacf9a706eb293ad0cde3aee5d7e3adf1989",
    revision: "0faca33cc58ea62e97a928b67cd3beec7176b408",
    checkoutClean: true,
    issues: [],
  } as const;
}

function signed(fixture_: Fixture) {
  return createSignedSentinelLivePreregistration(
    {
      registrationId: "sentinel-live-runner-test",
      registeredAt: "2026-07-13T22:00:00.000Z",
      randomizationSeed: "sentinel-live-runner-randomization",
      pricingAccessedAt: "2026-07-13T21:00:00.000Z",
      checkoutPath: fixture_.checkoutPath,
      runtimePaths: fixture_.runtimePaths,
      pollIntervalMs: 5_000,
      maxCompletionTokens: 256,
    },
    {
      inspectRuntime: () => fixture_.runtime,
      verifySource: validSource,
      now: () => "2026-07-13T22:00:00.000Z",
    },
  );
}

interface SyntheticDependencies {
  readonly dependencies: SentinelLiveRunnerDependencies;
  readonly supervised: SentinelAttemptSupervisorInput[];
  readonly stateStarts: StartSentinelStateSidecarInput[];
  readonly providerStarts: unknown[];
  readonly lifecycle: string[];
}

function syntheticDependencies(
  fixture_: Fixture,
  failureCall = 7,
): SyntheticDependencies {
  const supervised: SentinelAttemptSupervisorInput[] = [];
  const stateStarts: StartSentinelStateSidecarInput[] = [];
  const providerStarts: unknown[] = [];
  const lifecycle: string[] = [];
  let attemptSequence = 0;
  let nextPort = 20_000;
  const dependencies: SentinelLiveRunnerDependencies = {
    inspectRuntime: () => fixture_.runtime,
    verifySource: validSource,
    allocatePorts: async (count, excluded) => {
      const ports: number[] = [];
      while (ports.length < count) {
        nextPort += 1;
        if (!excluded.has(nextPort)) ports.push(nextPort);
      }
      return ports;
    },
    opaqueAttemptId: () => {
      attemptSequence += 1;
      return `slc-${attemptSequence.toString(16).padStart(40, "0")}`;
    },
    opaqueToken: () => `opaque-${"x".repeat(40)}-${attemptSequence}`,
    now: () => "2026-07-13T22:00:00.000Z",
    retainScenarioDefinition: (_checkoutPath, inputRoot, taskId) => {
      writeFileSync(resolve(inputRoot, "scenario-definition.json"), `${taskId}\n`);
    },
    startStateSidecar: async (input) => {
      stateStarts.push(input);
      lifecycle.push(`state:${stateStarts.length}`);
      writeFileSync(resolve(input.outputDirectory, "ready.json"), "state-ready\n");
      return {
        endpoint: `http://127.0.0.1:${input.port}/v1/state`,
        stop: async () => {
          writeFileSync(resolve(input.outputDirectory, "final.json"), "state-final\n");
          return { receiptSha256: sha("d") };
        },
      } as unknown as RunningSentinelStateSidecar;
    },
    startProviderProxy: async (input) => {
      providerStarts.push(input);
      lifecycle.push(`provider:${providerStarts.length}`);
      mkdirSync(input.outputRoot);
      writeFileSync(resolve(input.outputRoot, "ready.json"), "provider-ready\n");
      return {
        origin: `http://127.0.0.1:${input.port}`,
        authorizationToken: input.authorizationToken!,
        close: async () => {
          writeFileSync(resolve(input.outputRoot, "final.json"), "provider-final\n");
          return { receiptHash: sha("e") };
        },
      } satisfies RunningSentinelAnthropicProviderProxy;
    },
    superviseAttempt: async (input) => {
      supervised.push(input);
      lifecycle.push(`supervise:${supervised.length}`);
      const config = JSON.parse(readFileSync(input.agentConfig.path, "utf8")) as {
        readonly agent_subprocess: readonly string[];
        readonly speed_factor: number;
      };
      expect(config.agent_subprocess.slice(-4)).toEqual([
        "--url",
        "__TASK_URL__",
        "--prompt",
        "__TASK_PROMPT__",
      ]);
      expect(config.speed_factor).toBe(4);
      expect(JSON.stringify(input)).not.toContain("anthropic-test-secret");
      expect(JSON.stringify(input)).not.toMatch(/"(?:arm|mode|treatment)"/iu);
      expect(JSON.stringify(input)).not.toMatch(/\b(?:native|sham|substrate)\b/iu);
      if (supervised.length === failureCall) throw new Error("synthetic terminal infrastructure failure");
      mkdirSync(input.outputRoot);
      writeFileSync(resolve(input.outputRoot, "terminal.txt"), "retained\n");
      return { receiptHash: sha("f") } as SentinelAttemptTerminalReceipt;
    },
  };
  return { dependencies, supervised, stateStarts, providerStarts, lifecycle };
}

function runInput(fixture_: Fixture): SentinelLiveRunInput {
  return {
    ...signed(fixture_),
    checkoutPath: fixture_.checkoutPath,
    batchRoot: fixture_.batchRoot,
    attemptRegistryRoot: fixture_.registryRoot,
    runtimePaths: fixture_.runtimePaths,
    anthropicApiKey: "anthropic-test-secret",
    startupTimeoutMs: 100,
    attemptTimeoutMs: 100,
    shutdownGraceMs: 100,
  };
}

describe("live Sentinel batch runner", () => {
  it("preserves a virtual-environment executable symlink while hashing its target", () => {
    const root = mkdtempSync(resolve(tmpdir(), "pm-sentinel-runtime-symlink-"));
    const pythonLink = resolve(root, "python");
    symlinkSync(process.execPath, pythonLink);
    const placeholder = (name: string, body = `${name}\n`): string => {
      const path = resolve(root, name);
      writeFileSync(path, body, { mode: 0o700 });
      return path;
    };
    const snapshot = inspectSentinelLiveRuntime({
      repositoryRoot: process.cwd(),
      packageLockPath: resolve(process.cwd(), "pnpm-lock.yaml"),
      runnerScriptPath: placeholder("runner.js"),
      supervisorScriptPath: placeholder("supervisor.js"),
      verifierScriptPath: placeholder("verifier.js"),
      agentScriptPath: placeholder("agent.js"),
      sidecarScriptPath: placeholder("sidecar.js"),
      providerProxyScriptPath: placeholder("provider.js"),
      playwrightPackageJsonPath: placeholder("playwright-package.json", '{"version":"1.56.1"}\n'),
      nodeExecutablePath: process.execPath,
      pythonExecutablePath: pythonLink,
      frontendExecutablePath: placeholder("frontend"),
    });

    expect(snapshot.pythonExecutable.path).toBe(pythonLink);
    expect(snapshot.pythonExecutable.sha256).toBe(
      snapshot.artifacts.find(({ role }) => role === "node-executable")?.sha256,
    );
  });

  it("signs with a transient Ed25519 key and returns no private material", () => {
    const testFixture = fixture("sign");
    const result = signed(testFixture);
    expect(result.signature.algorithm).toBe("Ed25519");
    expect(result.signature.publicKeyPem).toContain("BEGIN PUBLIC KEY");
    expect(JSON.stringify(result)).not.toContain("PRIVATE KEY");
    expect(Object.keys(result)).toEqual([
      "preregistration",
      "signature",
      "expectedPreregistrationSha256",
    ]);
    expect(result.preregistration.model).toMatchObject({
      provider: "anthropic",
      apiVersion: "2023-06-01",
      model: "claude-sonnet-4-5-20250929",
      pricing: {
        baseInputUsdPerMillionTokens: 3,
        outputUsdPerMillionTokens: 15,
        promptCachingEnabled: false,
      },
    });
  });

  it("executes and retains all 27 cells exactly once without exposing arms or the API key", async () => {
    const testFixture = fixture("matrix");
    const synthetic = syntheticDependencies(testFixture);
    let postRunCallCount = 0;
    let supervisedAtPostRun = 0;
    const input: SentinelLiveRunInput = {
      ...runInput(testFixture),
      postRunVerify: async ({ cellManifestPaths }) => {
        postRunCallCount += 1;
        supervisedAtPostRun = synthetic.supervised.length;
        expect(cellManifestPaths).toHaveLength(27);
        return {
          schemaVersion: "pm.public-eval-corners.synthetic-post-run.v1",
          valid: true,
          issues: [],
        };
      },
    };
    const result = await runSentinelLiveBatch(input, synthetic.dependencies);
    expect(synthetic.supervised).toHaveLength(27);
    expect(new Set(synthetic.supervised.map(({ attemptId }) => attemptId))).toHaveLength(27);
    expect(synthetic.stateStarts).toHaveLength(27);
    expect(synthetic.providerStarts).toHaveLength(27);
    expect(postRunCallCount).toBe(1);
    expect(supervisedAtPostRun).toBe(27);
    expect(result.cells).toHaveLength(27);
    expect(result.evidenceEligible).toBe(false);
    expect(result.publicEfficacyEligible).toBe(false);
    expect(result.qualificationOnly).toBe(true);

    const failedCell = JSON.parse(
      readFileSync(result.cells[6]!.cellManifestPath, "utf8"),
    ) as {
      readonly runnerFailureCount: number;
      readonly artifacts: readonly { readonly path: string }[];
      readonly retryCount: number;
    };
    expect(failedCell.runnerFailureCount).toBe(1);
    expect(failedCell.retryCount).toBe(0);
    expect(failedCell.artifacts.some(({ path }) => path.startsWith("runner-terminal-failure-"))).toBe(true);
    expect(verifyContentAddressedSentinelManifest(result.finalManifestPath)).toMatchObject({
      valid: true,
    });

    const allPorts = synthetic.supervised.flatMap(({ serverPort, frontendPort, opaqueEnvironment }) => [
      serverPort,
      frontendPort,
      Number(new URL(opaqueEnvironment.stateOrigin).port),
      Number(new URL(opaqueEnvironment.providerOrigin).port),
    ]);
    expect(new Set(allPorts).size).toBe(108);
    expect(new Set(synthetic.stateStarts.map(({ mode }) => mode))).toEqual(
      new Set(["native", "sham", "substrate"]),
    );
  });

  it("rejects signed-plan tampering before creating a cell or calling a provider", async () => {
    const testFixture = fixture("plan-tamper");
    const synthetic = syntheticDependencies(testFixture);
    const input = runInput(testFixture);
    const tampered: SentinelLiveRunInput = {
      ...input,
      preregistration: {
        ...input.preregistration,
        randomizationSeed: "tampered-randomization",
      },
    };
    await expect(runSentinelLiveBatch(tampered, synthetic.dependencies)).rejects.toThrow(
      /preregistration|signature/u,
    );
    expect(synthetic.supervised).toHaveLength(0);
    expect(synthetic.providerStarts).toHaveLength(0);
  });

  it("rejects compiled runtime closure tampering before any cell execution", async () => {
    const testFixture = fixture("runtime-tamper");
    const synthetic = syntheticDependencies(testFixture);
    const dependencies: SentinelLiveRunnerDependencies = {
      ...synthetic.dependencies,
      inspectRuntime: () => ({
        ...testFixture.runtime,
        agentScriptSha256: sha("0"),
      }),
    };
    await expect(runSentinelLiveBatch(runInput(testFixture), dependencies)).rejects.toThrow(
      /agent script/u,
    );
    expect(synthetic.supervised).toHaveLength(0);
    expect(synthetic.providerStarts).toHaveLength(0);
  });

  it("detects a tampered content-addressed final manifest", async () => {
    const testFixture = fixture("manifest-tamper");
    const synthetic = syntheticDependencies(testFixture, -1);
    const result = await runSentinelLiveBatch(runInput(testFixture), synthetic.dependencies);
    chmodSync(result.finalManifestPath, 0o600);
    const parsed = JSON.parse(readFileSync(result.finalManifestPath, "utf8")) as Record<string, unknown>;
    parsed.retainedCellCount = 26;
    writeFileSync(result.finalManifestPath, `${JSON.stringify(parsed, null, 2)}\n`);
    expect(verifyContentAddressedSentinelManifest(result.finalManifestPath)).toMatchObject({
      valid: false,
    });
  });
});
