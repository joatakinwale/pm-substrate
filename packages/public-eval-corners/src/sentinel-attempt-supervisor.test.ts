import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  superviseSentinelAttempt,
  type SentinelAttemptSupervisorDependencies,
  type SentinelAttemptSupervisorInput,
  type SentinelProcessExit,
  type SentinelProcessHandle,
  type SentinelProcessRole,
  type SentinelSpawnSpec,
  type SentinelTreeTermination,
} from "./sentinel-attempt-supervisor.js";

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function writeIdentity(path: string, bytes: string): { readonly path: string; readonly sha256: string } {
  writeFileSync(path, bytes);
  return { path, sha256: sha256(bytes) };
}

interface TestFixture {
  readonly root: string;
  readonly checkoutPath: string;
  readonly sharedDbPath: string;
  readonly microhubDbPath: string;
  readonly scenarioPath: string;
  readonly input: SentinelAttemptSupervisorInput;
}

function fixture(attemptId = "sentinel-attempt-001"): TestFixture {
  const root = mkdtempSync(join(tmpdir(), "pm-sentinel-supervisor-"));
  const checkoutPath = join(root, "checkout");
  mkdirSync(join(checkoutPath, "scenarios", "microhub"), { recursive: true });
  mkdirSync(join(checkoutPath, "server", "microhub"), { recursive: true });
  mkdirSync(join(checkoutPath, "frontend"), { recursive: true });
  mkdirSync(join(root, "bin"));
  const scenarioPath = join(checkoutPath, "scenarios", "microhub", "stars-relative-passive.json");
  writeFileSync(
    scenarioPath,
    JSON.stringify({
      id: "microhub-stars-relative-passive",
      environment: "microhub",
      prompt: "synthetic supervisor fixture",
    }),
  );
  const sharedDbPath = join(checkoutPath, "server", "shared.db");
  const microhubDbPath = join(checkoutPath, "server", "microhub", "microhub.db");
  writeFileSync(sharedDbPath, "shared-db-v1");
  writeFileSync(microhubDbPath, "microhub-db-v1");
  const pythonExecutable = writeIdentity(join(root, "bin", "python3"), "synthetic-python");
  const frontendExecutable = writeIdentity(join(root, "bin", "npm-cli.js"), "synthetic-npm");
  const agentConfigPath = join(root, "agent-config.json");
  const configBytes = JSON.stringify({
    server_url: "http://127.0.0.1:18080",
    frontend_url: "http://127.0.0.1:15173",
    speed_factor: 1,
    agent_subprocess: ["/synthetic-agent", "--url", "__TASK_URL__", "--prompt", "__TASK_PROMPT__"],
  });
  const agentConfig = writeIdentity(agentConfigPath, configBytes);
  return {
    root,
    checkoutPath,
    sharedDbPath,
    microhubDbPath,
    scenarioPath,
    input: {
      schemaVersion: "pm.public-eval-corners.sentinel-attempt-input.v1",
      attemptId,
      taskId: "microhub-stars-relative-passive",
      checkoutPath,
      outputRoot: join(root, "attempt-output"),
      attemptRegistryRoot: join(root, "attempt-registry"),
      agentConfig,
      pythonExecutable,
      frontendExecutable,
      serverPort: 18_080,
      frontendPort: 15_173,
      opaqueEnvironment: {
        stateOrigin: "http://127.0.0.1:19001",
        stateToken: "state-token-opaque-000000000000000000000000",
        providerOrigin: "http://127.0.0.1:19002",
        providerToken: "provider-token-opaque-00000000000000000000",
      },
      pollIntervalMs: 5_000,
      viewportWidth: 1_280,
      viewportHeight: 720,
      startupTimeoutMs: 1_000,
      attemptTimeoutMs: 720_000,
      shutdownGraceMs: 100,
    },
  };
}

interface FakeRuntimeOptions {
  readonly timeoutHarness?: boolean;
  readonly mutateCollateral?: (fixture: TestFixture) => void;
  readonly failReadiness?: boolean;
}

interface FakeRuntime {
  readonly dependencies: SentinelAttemptSupervisorDependencies;
  readonly spawns: SentinelSpawnSpec[];
  readonly terminatedRoles: SentinelProcessRole[];
  readonly scenarioRequests: string[];
}

function fakeRuntime(testFixture: TestFixture, options: FakeRuntimeOptions = {}): FakeRuntime {
  const spawns: SentinelSpawnSpec[] = [];
  const terminatedRoles: SentinelProcessRole[] = [];
  const scenarioRequests: string[] = [];
  const exits = new Map<SentinelProcessRole, SentinelProcessExit>();
  const handles = new Map<SentinelProcessRole, SentinelProcessHandle>();
  let nextPid = 41_000;
  const dependencies: SentinelAttemptSupervisorDependencies = {
    git: (_checkoutPath, arguments_) => {
      const command = arguments_.join(" ");
      if (command === "rev-parse HEAD") return "0faca33cc58ea62e97a928b67cd3beec7176b408\n";
      if (command === "remote get-url origin") {
        return "https://github.com/microsoft/sentinel_environments.git\n";
      }
      if (command === "status --porcelain=v1 --untracked-files=all") return "";
      throw new Error(`unexpected git command ${command}`);
    },
    hostEnvironment: () => ({
      PATH: "/synthetic/bin",
      HOME: "/synthetic/home",
      OPENAI_API_KEY: "must-not-leak",
      ANTHROPIC_API_KEY: "must-not-leak",
      PM_ARM: "substrate",
      MODE: "treatment",
    }),
    verifyScenario: (checkoutPath, taskId) => {
      scenarioRequests.push(taskId);
      const path = resolve(checkoutPath, "scenarios/microhub/stars-relative-passive.json");
      return { path, sha256: sha256(readFileSync(path)) };
    },
    assertPortsAvailable: async (ports) => {
      expect(ports).toEqual([18_080, 15_173]);
    },
    waitForHttpReady: async () => {
      if (options.failReadiness === true) throw new Error("synthetic readiness failure");
    },
    spawnProcess: (spec) => {
      spawns.push(spec);
      writeFileSync(spec.stdoutPath, `${spec.role} stdout\n`);
      writeFileSync(spec.stderrPath, `${spec.role} stderr\n`);
      const pid = nextPid++;
      let resolveCompletion: ((exit: SentinelProcessExit) => void) | undefined;
      const naturalExit: SentinelProcessExit = { exitCode: 0, signal: null, spawnError: null };
      const completion = spec.role === "harness" && options.timeoutHarness !== true
        ? Promise.resolve(naturalExit)
        : new Promise<SentinelProcessExit>((resolvePromise) => {
          resolveCompletion = resolvePromise;
        });
      if (spec.role === "harness" && options.timeoutHarness !== true) {
        const attemptIndex = spec.arguments.indexOf("run") + 1;
        const taskIndex = spec.arguments.indexOf("--task") + 1;
        const attemptId = spec.arguments[attemptIndex];
        const taskId = spec.arguments[taskIndex];
        if (!attemptId || !taskId) throw new Error("fake harness missing exact selectors");
        const taskRoot = join(spec.cwd, "results", attemptId, "microhub", taskId);
        mkdirSync(taskRoot, { recursive: true });
        writeFileSync(join(taskRoot, "output.txt"), "synthetic agent transcript\n");
        writeFileSync(join(taskRoot, "results.json"), JSON.stringify({ success: true }));
        options.mutateCollateral?.(testFixture);
      }
      const terminateTree = async (): Promise<SentinelTreeTermination> => {
        terminatedRoles.push(spec.role);
        const exit = exits.get(spec.role) ?? naturalExit;
        resolveCompletion?.(exit);
        return {
          signalsSent: [`SIGTERM:pgid:${pid}`],
          observedPids: [pid, pid + 1],
          remainingPids: [],
          reaped: true,
          exit,
        };
      };
      const handle = { role: spec.role, pid, completion, terminateTree };
      handles.set(spec.role, handle);
      return handle;
    },
    waitForExit: async (handle) => {
      if (handle.role === "harness" && options.timeoutHarness === true) {
        return { timedOut: true, exit: null };
      }
      return { timedOut: false, exit: await handle.completion };
    },
    now: () => "2026-07-14T02:00:00.000Z",
  };
  return { dependencies, spawns, terminatedRoles, scenarioRequests };
}

describe("Sentinel upstream attempt supervisor", () => {
  it("runs the exact task on fresh loopback processes with a sanitized environment", async () => {
    const testFixture = fixture();
    const runtime = fakeRuntime(testFixture);
    const receipt = await superviseSentinelAttempt(testFixture.input, runtime.dependencies);

    expect(receipt.status).toBe("succeeded");
    expect(receipt.evidenceEligible).toBe(false);
    expect(receipt.collateral.mutationDetected).toBe(false);
    expect(receipt.checkoutBefore.valid).toBe(true);
    expect(receipt.checkoutAfter.valid).toBe(true);
    expect(receipt.resultJsonSha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(runtime.scenarioRequests).toEqual(["microhub-stars-relative-passive"]);
    expect(runtime.spawns.map(({ role }) => role)).toEqual(["server", "frontend", "harness"]);
    const harness = runtime.spawns.find(({ role }) => role === "harness");
    expect(harness?.arguments).toEqual([
      "-m",
      "server.eval_harness",
      "run",
      "sentinel-attempt-001",
      "--config",
      testFixture.input.agentConfig.path,
      "--server-url",
      "http://127.0.0.1:18080",
      "--frontend-url",
      "http://127.0.0.1:15173",
      "--speed-factor",
      "1",
      "--task",
      "microhub-stars-relative-passive",
    ]);
    expect(harness?.environment).toMatchObject({
      PM_SENTINEL_STATE_ORIGIN: "http://127.0.0.1:19001",
      PM_SENTINEL_PROVIDER_ORIGIN: "http://127.0.0.1:19002",
      PM_SENTINEL_ATTEMPT_ID: "sentinel-attempt-001",
      PM_SENTINEL_AGENT_OUTPUT_ROOT: join(testFixture.input.outputRoot, "runtime", "agent"),
      PM_SENTINEL_POLL_INTERVAL_MS: "5000",
      PM_SENTINEL_VIEWPORT_WIDTH: "1280",
      PM_SENTINEL_VIEWPORT_HEIGHT: "720",
    });
    expect(harness?.environment).not.toHaveProperty("OPENAI_API_KEY");
    expect(harness?.environment).not.toHaveProperty("ANTHROPIC_API_KEY");
    expect(harness?.environment).not.toHaveProperty("PM_ARM");
    expect(harness?.environment).not.toHaveProperty("MODE");
    const server = runtime.spawns.find(({ role }) => role === "server");
    const frontend = runtime.spawns.find(({ role }) => role === "frontend");
    expect(frontend?.arguments).toEqual([
      "run", "dev", "--", "--host", "127.0.0.1", "--port", "15173", "--strictPort",
    ]);
    expect(server?.environment).not.toHaveProperty("PM_SENTINEL_PROVIDER_TOKEN");
    expect(frontend?.environment).toMatchObject({ SENTINEL_API_BASE: "http://127.0.0.1:18080" });
    expect(runtime.terminatedRoles.sort()).toEqual(["frontend", "harness", "server"]);
    expect(receipt.processes.every(({ treeTermination }) => treeTermination.reaped)).toBe(true);

    const receipts = readdirSync(join(testFixture.input.outputRoot, "receipts"));
    expect(receipts.filter((name) => name.startsWith("sentinel-attempt-start-"))).toHaveLength(1);
    expect(receipts.filter((name) => name.startsWith("sentinel-attempt-terminal-"))).toHaveLength(1);
  });

  it("writes a timed-out terminal receipt and reaps every launched process tree", async () => {
    const testFixture = fixture("sentinel-timeout-001");
    const runtime = fakeRuntime(testFixture, { timeoutHarness: true });
    const receipt = await superviseSentinelAttempt(testFixture.input, runtime.dependencies);
    expect(receipt.status).toBe("timed-out");
    expect(receipt.failureStage).toBe("harness-execution");
    expect(receipt.processes.find(({ role }) => role === "harness")?.timedOut).toBe(true);
    expect(receipt.processes.every(({ treeTermination }) => treeTermination.reaped)).toBe(true);
    expect(runtime.terminatedRoles.sort()).toEqual(["frontend", "harness", "server"]);
  });

  it("turns collateral database mutation into a failed attempt", async () => {
    const testFixture = fixture("sentinel-collateral-001");
    const runtime = fakeRuntime(testFixture, {
      mutateCollateral: ({ microhubDbPath }) => writeFileSync(microhubDbPath, "mutated-db"),
    });
    const receipt = await superviseSentinelAttempt(testFixture.input, runtime.dependencies);
    expect(receipt.status).toBe("failed");
    expect(receipt.failureStage).toBe("collateral-integrity");
    expect(receipt.collateral.mutationDetected).toBe(true);
    expect(receipt.collateral.changedPaths).toContain("server/microhub/microhub.db");
  });

  it("refuses reused output roots and globally claimed attempt IDs", async () => {
    const testFixture = fixture("sentinel-reuse-001");
    const firstRuntime = fakeRuntime(testFixture);
    await superviseSentinelAttempt(testFixture.input, firstRuntime.dependencies);

    const reusedRootRuntime = fakeRuntime(testFixture);
    await expect(
      superviseSentinelAttempt(
        { ...testFixture.input, attemptId: "sentinel-reuse-002" },
        reusedRootRuntime.dependencies,
      ),
    ).rejects.toThrow("outputRoot must not already exist");

    const reusedAttemptRuntime = fakeRuntime(testFixture);
    await expect(
      superviseSentinelAttempt(
        { ...testFixture.input, outputRoot: join(testFixture.root, "different-output") },
        reusedAttemptRuntime.dependencies,
      ),
    ).rejects.toThrow("has already been claimed");
  });

  it("rejects treatment-bearing agent config before launching children", async () => {
    const testFixture = fixture("sentinel-config-red-001");
    const configBytes = JSON.stringify({
      server_url: "http://127.0.0.1:18080",
      frontend_url: "http://127.0.0.1:15173",
      speed_factor: 1,
      agent_subprocess: ["/synthetic-agent", "--arm", "substrate"],
    });
    writeFileSync(testFixture.input.agentConfig.path, configBytes);
    const runtime = fakeRuntime(testFixture);
    await expect(
      superviseSentinelAttempt(
        {
          ...testFixture.input,
          agentConfig: { path: testFixture.input.agentConfig.path, sha256: sha256(configBytes) },
        },
        runtime.dependencies,
      ),
    ).rejects.toThrow("discloses treatment");
    expect(runtime.spawns).toEqual([]);
  });

  it("rejects pnpm because its run separator leaves Vite on the public default bind", async () => {
    const testFixture = fixture("sentinel-pnpm-red-001");
    const pnpm = writeIdentity(join(testFixture.root, "bin", "pnpm"), "synthetic-pnpm");
    const runtime = fakeRuntime(testFixture);
    await expect(superviseSentinelAttempt(
      { ...testFixture.input, frontendExecutable: pnpm },
      runtime.dependencies,
    )).rejects.toThrow("frontendExecutable must resolve to npm");
    expect(runtime.spawns).toEqual([]);
  });

  it("rejects an early caller-selected timeout that could manufacture control failures", async () => {
    const testFixture = fixture("sentinel-timeout-pin-red-001");
    const runtime = fakeRuntime(testFixture);
    await expect(superviseSentinelAttempt(
      { ...testFixture.input, attemptTimeoutMs: 629_000 },
      runtime.dependencies,
    )).rejects.toThrow("attemptTimeoutMs must remain pinned to 720000");
    expect(runtime.spawns).toEqual([]);
  });
});
