import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  superviseSentinelProductionAttempt,
  type SentinelProductionProcessExit,
  type SentinelProductionProcessHandle,
  type SentinelProductionProcessRole,
  type SentinelProductionSpawnSpec,
  type SentinelProductionSupervisorDependencies,
  type SentinelProductionSupervisorInput,
  type SentinelProductionTaskRegistration,
  type SentinelProductionTreeTermination,
} from "./sentinel-production-supervisor.js";

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function writeIdentity(path: string, bytes: string): { readonly path: string; readonly sha256: string } {
  writeFileSync(path, bytes);
  return { path, sha256: sha256(bytes) };
}

const FROZEN_REGISTRATION: SentinelProductionTaskRegistration = {
  schemaVersion: "pm.public-eval-corners.sentinel-production-task-registration.v1",
  taskId: "microhub-stars-relative-passive",
  environment: "microhub",
  scenarioRelativePath: "scenarios/microhub/stars-relative-passive.json",
  scenarioSha256: "892c71ca6acb5f0268dd133df3990c779e5335d946c6cb5f5e051087dc4cd6da",
  repositoryUrl: "https://github.com/microsoft/sentinel_environments",
  revision: "0faca33cc58ea62e97a928b67cd3beec7176b408",
};

const DATABASE_PATHS = [
  "server/shared.db",
  "server/microchat/microchat.db",
  "server/microdin/microdin.db",
  "server/microfy/microfy.db",
  "server/microgram/microgram.db",
  "server/microhood/microhood.db",
  "server/microhub/microhub.db",
  "server/microlendar/microlendar.db",
  "server/micromail/micromail.db",
  "server/microscholar/microscholar.db",
  "server/microtube/microtube.db",
] as const;

interface TestFixture {
  readonly root: string;
  readonly checkoutPath: string;
  readonly mutableDbPath: string;
  readonly input: SentinelProductionSupervisorInput;
}

function fixture(attemptId = "sentinel-production-001"): TestFixture {
  const root = mkdtempSync(join(tmpdir(), "pm-sentinel-production-"));
  const checkoutPath = join(root, "checkout");
  mkdirSync(join(checkoutPath, "scenarios", "microhub"), { recursive: true });
  mkdirSync(join(checkoutPath, "frontend"), { recursive: true });
  for (const relativePath of DATABASE_PATHS) {
    const path = join(checkoutPath, relativePath);
    mkdirSync(resolve(path, ".."), { recursive: true });
    writeFileSync(path, `fixture:${relativePath}`);
  }
  const scenarioPath = join(checkoutPath, FROZEN_REGISTRATION.scenarioRelativePath);
  writeFileSync(scenarioPath, JSON.stringify({
    id: FROZEN_REGISTRATION.taskId,
    environment: FROZEN_REGISTRATION.environment,
    prompt: "Synthetic task-generic supervisor fixture.",
    event_timeline_end: 720,
    events: [],
  }));

  const binRoot = join(root, "bin");
  mkdirSync(binRoot);
  const pythonExecutable = writeIdentity(join(binRoot, "python3"), "synthetic-python");
  const frontendExecutable = writeIdentity(join(binRoot, "npm-cli.js"), "synthetic-npm");
  const agentRuntimeExecutable = writeIdentity(join(binRoot, "node"), "synthetic-node");
  const agentScript = writeIdentity(join(root, "sentinel-general-agent.js"), "synthetic-agent");
  const agentConfigPath = join(root, "agent-config.json");
  const agentConfig = writeIdentity(agentConfigPath, JSON.stringify({
    server_url: "http://127.0.0.1:18080",
    frontend_url: "http://127.0.0.1:15173",
    speed_factor: 1,
    agent_subprocess: [
      agentRuntimeExecutable.path,
      agentScript.path,
      "--url",
      "__TASK_URL__",
      "--prompt",
      "__TASK_PROMPT__",
    ],
  }));
  return {
    root,
    checkoutPath,
    mutableDbPath: join(checkoutPath, "server", "microhub", "microhub.db"),
    input: {
      schemaVersion: "pm.public-eval-corners.sentinel-production-attempt-input.v1",
      attemptId,
      task: FROZEN_REGISTRATION,
      checkoutPath,
      outputRoot: join(root, "attempt-output"),
      attemptRegistryRoot: join(root, "attempt-registry"),
      agentConfig,
      agentRuntimeExecutable,
      agentScript,
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
      pollIntervalMs: 10_000,
      activeSettleMs: 250,
      maxDecisions: 1_000,
      maxConsecutiveActiveActions: 64,
      viewportWidth: 1_280,
      viewportHeight: 720,
      speedFactor: 1,
      killHorizonMs: 630_000,
      startupTimeoutMs: 60_000,
      attemptTimeoutMs: 720_000,
      shutdownGraceMs: 5_000,
    },
  };
}

interface FakeRuntimeOptions {
  readonly revision?: string;
  readonly dirty?: boolean;
  readonly mutateDatabase?: boolean;
  readonly wrongResultPath?: boolean;
  readonly failRole?: SentinelProductionProcessRole;
  readonly holdHarness?: boolean;
  readonly omitAgentTerminal?: boolean;
}

interface FakeRuntime {
  readonly dependencies: SentinelProductionSupervisorDependencies;
  readonly spawns: SentinelProductionSpawnSpec[];
  readonly harnessStarted: Promise<void>;
  readonly releaseHarness: () => void;
}

function fakeRuntime(testFixture: TestFixture, options: FakeRuntimeOptions = {}): FakeRuntime {
  const spawns: SentinelProductionSpawnSpec[] = [];
  let nextPid = 41_000;
  let harnessPid: number | null = null;
  let harnessStartedResolve: (() => void) | undefined;
  const harnessStarted = new Promise<void>((resolvePromise) => {
    harnessStartedResolve = resolvePromise;
  });
  let releaseHarnessResolve: (() => void) | undefined;
  const harnessRelease = new Promise<void>((resolvePromise) => {
    releaseHarnessResolve = resolvePromise;
  });
  const exits = new Map<SentinelProductionProcessRole, SentinelProductionProcessExit>();

  function writeBehavioralArtifacts(spec: SentinelProductionSpawnSpec): void {
    const taskIndex = spec.arguments.indexOf("--task") + 1;
    const attemptIndex = spec.arguments.indexOf("run") + 1;
    const taskId = spec.arguments[taskIndex];
    const attemptId = spec.arguments[attemptIndex];
    if (taskId === undefined || attemptId === undefined || harnessPid === null) {
      throw new Error("fake harness lacks exact task identity");
    }
    const environment = testFixture.input.task.environment;
    const selectedEnvironment = options.wrongResultPath === true ? "micromail" : environment;
    const selectedTask = options.wrongResultPath === true ? "micromail-junk-relative-passive" : taskId;
    const taskRoot = join(spec.cwd, "results", attemptId, selectedEnvironment, selectedTask);
    mkdirSync(taskRoot, { recursive: true });
    writeFileSync(join(taskRoot, "output.txt"), "raw agent transcript\n");
    // A false benchmark outcome is still a behaviorally complete attempt.
    writeFileSync(join(taskRoot, "results.json"), JSON.stringify({
      success: false,
      detail: "synthetic benchmark-owned failure",
      evaluation_time: 630,
      condition_at: 565.42,
      contact_get_time: null,
      contact_post_time: null,
      contact_message: null,
    }));

    const agentRoot = join(testFixture.input.outputRoot, "runtime", "agent");
    mkdirSync(agentRoot, { recursive: true });
    const startUrl = "http://127.0.0.1:18080/redirect?frontend_url=http%3A%2F%2F127.0.0.1%3A15173";
    const taskPrompt = "Synthetic prompt plus benchmark contact instruction.";
    const cadenceKey = Buffer.from("synthetic-ed25519-public-key").toString("base64");
    writeFileSync(join(agentRoot, "agent-start.json"), JSON.stringify({
      schemaVersion: "pm.public-eval-corners.sentinel-general-agent-start.v1",
      attemptId,
      pid: 51_000,
      ppid: harnessPid,
      startedAt: "2026-07-14T12:00:00.000Z",
      startUrl,
      startUrlSha256: sha256(startUrl),
      taskPrompt,
      taskPromptSha256: sha256(taskPrompt),
      waitIntervalMs: 10_000,
      activeSettleMs: 250,
      maxDecisions: 1_000,
      maxConsecutiveActiveActions: 64,
      viewport: { width: 1_280, height: 720 },
      cadencePublicKeyDerBase64: cadenceKey,
      cadencePublicKeySha256: sha256(Buffer.from(cadenceKey, "base64")),
      providerOriginSha256: sha256("http://127.0.0.1:19002"),
      stateOriginSha256: sha256("http://127.0.0.1:19001"),
    }));
    if (options.omitAgentTerminal !== true) {
      writeFileSync(join(agentRoot, "agent-terminal.json"), JSON.stringify({
        schemaVersion: "pm.public-eval-corners.sentinel-general-agent-terminal.v1",
        attemptId,
        outcome: "behavioral-early-exit",
      }));
    }
    writeFileSync(join(agentRoot, "agent-events.jsonl"), "{\"decision\":1}\n");
    writeFileSync(join(agentRoot, "browser-network.jsonl"), "{\"sequence\":1}\n");
    writeFileSync(join(agentRoot, "decision-000001.png"), "synthetic-png");
    if (options.mutateDatabase === true) {
      writeFileSync(testFixture.mutableDbPath, "mutated-runtime-database");
    }
  }

  const dependencies: SentinelProductionSupervisorDependencies = {
    git: (_checkoutPath, arguments_) => {
      const command = arguments_.join(" ");
      if (command === "rev-parse HEAD") {
        return `${options.revision ?? "0faca33cc58ea62e97a928b67cd3beec7176b408"}\n`;
      }
      if (command === "remote get-url origin") {
        return "https://github.com/microsoft/sentinel_environments.git\n";
      }
      if (command === "status --porcelain=v1 --untracked-files=all") {
        return options.dirty === true ? " M server/server.py\n" : "";
      }
      throw new Error(`unexpected git command: ${command}`);
    },
    hostEnvironment: () => ({
      PATH: "/synthetic/bin",
      HOME: "/synthetic/home",
      ANTHROPIC_API_KEY: "must-not-leak",
      PM_ARM: "must-not-leak",
    }),
    verifyScenario: (checkoutPath, registration) => ({
      path: resolve(checkoutPath, registration.scenarioRelativePath),
      sha256: registration.scenarioSha256,
    }),
    assertPortsAvailable: async (ports) => {
      expect(ports).toEqual([18_080, 15_173]);
    },
    waitForHttpReady: async () => undefined,
    spawnProcess: (spec) => {
      if (options.failRole === spec.role) throw new Error(`synthetic missing ${spec.role}`);
      spawns.push(spec);
      writeFileSync(spec.stdoutPath, `${spec.role} stdout\n`);
      writeFileSync(spec.stderrPath, `${spec.role} stderr\n`);
      const pid = nextPid++;
      if (spec.role === "harness") {
        harnessPid = pid;
        writeBehavioralArtifacts(spec);
        harnessStartedResolve?.();
      }
      let resolveCompletion: ((exit: SentinelProductionProcessExit) => void) | undefined;
      const naturalExit: SentinelProductionProcessExit = {
        exitCode: 0,
        signal: null,
        spawnError: null,
      };
      const completion = spec.role === "harness" && options.holdHarness !== true
        ? Promise.resolve(naturalExit)
        : new Promise<SentinelProductionProcessExit>((resolvePromise) => {
          resolveCompletion = resolvePromise;
        });
      const terminateTree = async (): Promise<SentinelProductionTreeTermination> => {
        const exit = exits.get(spec.role) ?? naturalExit;
        resolveCompletion?.(exit);
        return {
          signalsSent: [`SIGTERM:pgid:${pid}`],
          observedPids: spec.role === "harness" ? [pid, 51_000] : [pid],
          remainingPids: [],
          reaped: true,
          exit,
        };
      };
      return { role: spec.role, pid, ppid: 30_000, completion, terminateTree };
    },
    waitForExit: async (handle) => {
      if (handle.role === "harness" && options.holdHarness === true) {
        await harnessRelease;
        return {
          timedOut: false,
          exit: { exitCode: 0, signal: null, spawnError: null },
        };
      }
      return { timedOut: false, exit: await handle.completion };
    },
    now: () => "2026-07-14T12:00:00.000Z",
  };
  return {
    dependencies,
    spawns,
    harnessStarted,
    releaseHarness: () => releaseHarnessResolve?.(),
  };
}

describe("Sentinel production attempt supervisor", () => {
  it("retains exact raw evidence while remaining blind to a false benchmark outcome", async () => {
    const testFixture = fixture();
    const runtime = fakeRuntime(testFixture);
    const receipt = await superviseSentinelProductionAttempt(
      testFixture.input,
      runtime.dependencies,
    );

    expect(receipt.completion).toBe("behavioral-complete");
    expect(receipt.infrastructureStage).toBeNull();
    expect(receipt.evidenceEligible).toBe(false);
    expect(receipt.processes.map(({ role }) => role)).toEqual(["frontend", "harness", "server"]);
    expect(receipt.agentProcess).toMatchObject({ pid: 51_000, ppid: 41_002 });
    expect(receipt.resultJsonPath).toBe(
      "runtime/results/sentinel-production-001/microhub/microhub-stars-relative-passive/results.json",
    );
    expect(receipt.rawArtifacts.map(({ path }) => path)).toContain(
      "runtime/agent/agent-start.json",
    );
    const harness = runtime.spawns.find(({ role }) => role === "harness");
    expect(harness?.arguments.slice(-4)).toEqual([
      "--speed-factor",
      "1",
      "--task",
      "microhub-stars-relative-passive",
    ]);
    expect(harness?.environment).not.toHaveProperty("ANTHROPIC_API_KEY");
    expect(harness?.environment).not.toHaveProperty("PM_ARM");
    expect(harness?.environmentSha256).toMatch(/^[a-f0-9]{64}$/u);
  });

  it("supports a hash-bound non-dev scenario outside the frozen 15-task phase catalog", async () => {
    const testFixture = fixture("sentinel-generic-001");
    const registration: SentinelProductionTaskRegistration = {
      ...FROZEN_REGISTRATION,
      taskId: "microchat-urgent-relative-active",
      environment: "microchat",
      scenarioRelativePath: "scenarios/microchat/urgent-relative-active.json",
      scenarioSha256: "a".repeat(64),
    };
    mkdirSync(join(testFixture.checkoutPath, "scenarios", "microchat"), { recursive: true });
    writeFileSync(
      join(testFixture.checkoutPath, registration.scenarioRelativePath),
      JSON.stringify({ id: registration.taskId, environment: registration.environment }),
    );
    const input = { ...testFixture.input, task: registration };
    const runtime = fakeRuntime({ ...testFixture, input });
    const receipt = await superviseSentinelProductionAttempt(input, runtime.dependencies);
    expect(receipt.completion).toBe("behavioral-complete");
    expect(receipt.taskId).toBe("microchat-urgent-relative-active");
  });

  it("retains a horizon-killed monitor without fabricating an agent terminal", async () => {
    const testFixture = fixture("sentinel-no-terminal-001");
    const runtime = fakeRuntime(testFixture, { omitAgentTerminal: true });
    const receipt = await superviseSentinelProductionAttempt(
      testFixture.input,
      runtime.dependencies,
    );
    expect(receipt.completion).toBe("behavioral-complete");
    expect(receipt.agentProcess?.terminalArtifact).toBeNull();
    expect(receipt.rawArtifacts.map(({ path }) => path)).not.toContain(
      "runtime/agent/agent-terminal.json",
    );
  });

  it("rejects the wrong source revision and a dirty checkout before spawning", async () => {
    const wrongRevisionFixture = fixture("sentinel-revision-red-001");
    const wrongRevision = fakeRuntime(wrongRevisionFixture, { revision: "b".repeat(40) });
    await expect(superviseSentinelProductionAttempt(
      wrongRevisionFixture.input,
      wrongRevision.dependencies,
    )).rejects.toThrow("revision does not match");
    expect(wrongRevision.spawns).toEqual([]);

    const dirtyFixture = fixture("sentinel-dirty-red-001");
    const dirty = fakeRuntime(dirtyFixture, { dirty: true });
    await expect(superviseSentinelProductionAttempt(
      dirtyFixture.input,
      dirty.dependencies,
    )).rejects.toThrow("checkout is not clean");
    expect(dirty.spawns).toEqual([]);
  });

  it("rejects a wrong frozen scenario hash, path traversal, and dev registration", async () => {
    const hashFixture = fixture("sentinel-hash-red-001");
    const hashRuntime = fakeRuntime(hashFixture);
    await expect(superviseSentinelProductionAttempt({
      ...hashFixture.input,
      task: { ...hashFixture.input.task, scenarioSha256: "0".repeat(64) },
    }, hashRuntime.dependencies)).rejects.toThrow("frozen phase pin");

    const traversalFixture = fixture("sentinel-traversal-red-001");
    const traversalRuntime = fakeRuntime(traversalFixture);
    await expect(superviseSentinelProductionAttempt({
      ...traversalFixture.input,
      task: {
        ...traversalFixture.input.task,
        taskId: "future-task",
        scenarioRelativePath: "scenarios/microhub/../server/server.py",
        scenarioSha256: "a".repeat(64),
      },
    }, traversalRuntime.dependencies)).rejects.toThrow("canonical pinned non-dev");

    const devFixture = fixture("sentinel-dev-red-001");
    const devRuntime = fakeRuntime(devFixture);
    await expect(superviseSentinelProductionAttempt({
      ...devFixture.input,
      task: {
        ...devFixture.input.task,
        taskId: "future-dev-task",
        scenarioRelativePath: "scenarios/microhub/dev.json",
        scenarioSha256: "a".repeat(64),
      },
    }, devRuntime.dependencies)).rejects.toThrow("canonical pinned non-dev");
  });

  it("rejects speed, kill-horizon, and attempt-timeout overrides", async () => {
    for (const override of [
      { speedFactor: 4 },
      { killHorizonMs: 180_000 },
      { attemptTimeoutMs: 629_000 },
    ]) {
      const testFixture = fixture(`sentinel-timing-red-${Object.keys(override)[0]}`);
      const runtime = fakeRuntime(testFixture);
      await expect(superviseSentinelProductionAttempt(
        { ...testFixture.input, ...override },
        runtime.dependencies,
      )).rejects.toThrow("must remain pinned");
      expect(runtime.spawns).toEqual([]);
    }
  });

  it("prevents simultaneous arms from sharing one checkout", async () => {
    const testFixture = fixture("sentinel-shared-a");
    const firstRuntime = fakeRuntime(testFixture, { holdHarness: true });
    const first = superviseSentinelProductionAttempt(testFixture.input, firstRuntime.dependencies);
    await firstRuntime.harnessStarted;

    const secondInput = {
      ...testFixture.input,
      attemptId: "sentinel-shared-b",
      outputRoot: join(testFixture.root, "attempt-output-b"),
      attemptRegistryRoot: join(testFixture.root, "attempt-registry-b"),
    };
    const secondRuntime = fakeRuntime({ ...testFixture, input: secondInput });
    await expect(superviseSentinelProductionAttempt(
      secondInput,
      secondRuntime.dependencies,
    )).rejects.toThrow("already reserved by a simultaneous Sentinel arm");
    expect(secondRuntime.spawns).toEqual([]);

    firstRuntime.releaseHarness();
    expect((await first).completion).toBe("behavioral-complete");
  });

  it("marks a wrong result path and mutated catalog database infrastructure-incomplete", async () => {
    const pathFixture = fixture("sentinel-result-path-red-001");
    const pathRuntime = fakeRuntime(pathFixture, { wrongResultPath: true });
    const wrongPath = await superviseSentinelProductionAttempt(
      pathFixture.input,
      pathRuntime.dependencies,
    );
    expect(wrongPath.completion).toBe("infrastructure-incomplete");
    expect(wrongPath.infrastructureStage).toBe("raw-artifact-capture");
    expect(wrongPath.infrastructureIssue).toContain("non-registered task");

    const dbFixture = fixture("sentinel-db-red-001");
    const dbRuntime = fakeRuntime(dbFixture, { mutateDatabase: true });
    const mutated = await superviseSentinelProductionAttempt(
      dbFixture.input,
      dbRuntime.dependencies,
    );
    expect(mutated.completion).toBe("infrastructure-incomplete");
    expect(mutated.infrastructureStage).toBe("collateral-integrity");
    expect(mutated.collateral.changedPaths).toContain("server/microhub/microhub.db");
  });

  it("never promotes an attempt with a missing required process role", async () => {
    const testFixture = fixture("sentinel-role-red-001");
    const runtime = fakeRuntime(testFixture, { failRole: "frontend" });
    const receipt = await superviseSentinelProductionAttempt(
      testFixture.input,
      runtime.dependencies,
    );
    expect(receipt.completion).toBe("infrastructure-incomplete");
    expect(receipt.processes.map(({ role }) => role)).toEqual(["server"]);
    expect(receipt.infrastructureIssue).toContain("synthetic missing frontend");
  });
});
