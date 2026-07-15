import { readdirSync } from "node:fs";
import { resolve } from "node:path";

import type {
  SentinelProductionPreregistration,
  SentinelProductionTask,
} from "./sentinel-production-plan.js";
import type { SentinelProductionCellManifest } from "./sentinel-production-runner.js";
import type {
  SentinelProductionArtifactIdentity,
  SentinelProductionAttemptPlan,
  SentinelProductionProcessTerminalRecord,
} from "./sentinel-production-supervisor.js";
import type { SentinelRawAgentVerification } from "./sentinel-production-raw-agent.js";
import {
  sentinelRawCanonical,
  sentinelRawCanonicalTimestamp,
  sentinelRawCompare,
  sentinelRawExactKeys,
  sentinelRawInventory,
  sentinelRawIsRecord,
  sentinelRawJsonFile,
  sentinelRawJsonSha256,
  sentinelRawRegularFile,
  sentinelRawSha256,
} from "./sentinel-production-raw-utils.js";

export interface SentinelUpstreamResultEnvelope {
  readonly condition_at: number | null;
  readonly contact_get_time: number | null;
  readonly contact_message: string | null;
  readonly contact_post_time: number | null;
  readonly detail: string;
  readonly evaluation_time: number | null;
  readonly success: boolean;
}

export interface SentinelRawSupervisorVerification {
  readonly valid: boolean;
  readonly issues: readonly string[];
  readonly completion: "behavioral-complete" | "infrastructure-incomplete";
  readonly attemptStartedAt: string | null;
  readonly attemptFinishedAt: string | null;
  readonly attemptDurationMs: number | null;
  readonly planHash: string | null;
  readonly resultBytes: Buffer | null;
  readonly result: SentinelUpstreamResultEnvelope | null;
  readonly processIds: readonly number[];
  readonly checkoutPath: string | null;
  readonly horizonKillProven: boolean;
  readonly executedPaths: {
    readonly nodeExecutablePath: string;
    readonly npmCliPath: string;
    readonly pythonExecutablePath: string;
    readonly agentScriptPath: string;
  } | null;
}

function issueOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function artifact(value: unknown, label: string): SentinelProductionArtifactIdentity {
  sentinelRawExactKeys(value, ["byteLength", "path", "sha256"], label);
  if (
    typeof value.path !== "string" || !Number.isSafeInteger(value.byteLength) || Number(value.byteLength) < 0 ||
    typeof value.sha256 !== "string" || !/^[a-f0-9]{64}$/u.test(value.sha256)
  ) throw new Error(`${label} is invalid`);
  return value as unknown as SentinelProductionArtifactIdentity;
}

function verifyArtifact(root: string, value: unknown, expectedPath: string, label: string): Buffer {
  const identity = artifact(value, label);
  if (identity.path !== expectedPath) throw new Error(`${label} path changed`);
  const path = resolve(root, identity.path);
  if (path !== resolve(root, expectedPath)) throw new Error(`${label} path escapes root`);
  const bytes = sentinelRawRegularFile(path, label);
  if (bytes.byteLength !== identity.byteLength || sentinelRawSha256(bytes) !== identity.sha256) {
    throw new Error(`${label} bytes differ from receipt`);
  }
  return bytes;
}

function checkout(value: unknown, label: string): void {
  sentinelRawExactKeys(value, [
    "actualRepositoryUrl", "actualRevision", "clean", "expectedRepositoryUrl", "expectedRevision", "issues", "valid",
  ], label);
  const normalizedRepository = (candidate: unknown): string | null => typeof candidate === "string"
    ? candidate.replace(/\/$/u, "").replace(/\.git$/u, "") : null;
  if (
    value.expectedRepositoryUrl !== "https://github.com/microsoft/sentinel_environments" ||
    value.expectedRevision !== "0faca33cc58ea62e97a928b67cd3beec7176b408" ||
    normalizedRepository(value.actualRepositoryUrl) !== normalizedRepository(value.expectedRepositoryUrl) ||
    value.actualRevision !== value.expectedRevision ||
    value.clean !== true || value.valid !== true || !Array.isArray(value.issues) || value.issues.length !== 0
  ) throw new Error(`${label} does not prove the exact clean pinned checkout`);
}

function taskRegistration(value: unknown, task: SentinelProductionTask): void {
  sentinelRawExactKeys(value, [
    "environment", "repositoryUrl", "revision", "scenarioRelativePath", "scenarioSha256", "schemaVersion", "taskId",
  ], "supervisor task registration");
  const prefix = `${task.environment}-`;
  const scenarioName = task.taskId.startsWith(prefix) ? task.taskId.slice(prefix.length) : "";
  if (
    value.schemaVersion !== "pm.public-eval-corners.sentinel-production-task-registration.v1" ||
    value.taskId !== task.taskId || value.environment !== task.environment ||
    value.scenarioRelativePath !== `scenarios/${task.environment}/${scenarioName}.json` ||
    value.scenarioSha256 !== task.scenarioSha256 ||
    value.repositoryUrl !== "https://github.com/microsoft/sentinel_environments" ||
    value.revision !== "0faca33cc58ea62e97a928b67cd3beec7176b408"
  ) throw new Error("supervisor task registration differs from the signed catalog task");
}

function executable(value: unknown, expectedSha256: string, label: string): void {
  sentinelRawExactKeys(value, ["path", "sha256"], label);
  if (typeof value.path !== "string" || !value.path.startsWith("/") || value.sha256 !== expectedSha256) {
    throw new Error(`${label} differs from the signed runtime closure`);
  }
}

function command(value: unknown, label: string): Record<string, unknown> {
  sentinelRawExactKeys(value, [
    "arguments", "cwd", "environmentBindingsSha256", "environmentSha256", "executable", "identitySha256", "role",
  ], label);
  if (
    !["server", "frontend", "harness"].includes(String(value.role)) || !Array.isArray(value.arguments) ||
    !value.arguments.every((entry) => typeof entry === "string") || typeof value.cwd !== "string" ||
    typeof value.environmentBindingsSha256 !== "string" || !/^[a-f0-9]{64}$/u.test(value.environmentBindingsSha256) ||
    typeof value.environmentSha256 !== "string" || !/^[a-f0-9]{64}$/u.test(value.environmentSha256) ||
    typeof value.identitySha256 !== "string"
  ) throw new Error(`${label} envelope is invalid`);
  const body = {
    role: value.role,
    executable: value.executable,
    arguments: value.arguments,
    cwd: value.cwd,
    environmentSha256: value.environmentSha256,
    environmentBindingsSha256: value.environmentBindingsSha256,
  };
  if (sentinelRawJsonSha256(body) !== value.identitySha256) throw new Error(`${label} identity hash mismatch`);
  return value;
}

interface ExpectedEnvironmentBinding {
  readonly name: string;
  readonly valueSha256: string;
  readonly classification: "safe-runtime" | "fixed-runtime" | "opaque-origin" | "opaque-token";
}

function expectedEnvironmentBindings(
  safeEnvironment: Readonly<Record<string, string>>,
  extras: readonly ExpectedEnvironmentBinding[],
): readonly ExpectedEnvironmentBinding[] {
  const byName = new Map<string, ExpectedEnvironmentBinding>();
  for (const [name, value] of Object.entries(safeEnvironment)) {
    byName.set(name, { name, valueSha256: sentinelRawSha256(value), classification: "safe-runtime" });
  }
  for (const binding of extras) byName.set(binding.name, binding);
  return [...byName.values()].sort((left, right) => sentinelRawCompare(left.name, right.name));
}

function binding(
  name: string,
  value: string,
  classification: ExpectedEnvironmentBinding["classification"],
  alreadyHashed = false,
): ExpectedEnvironmentBinding {
  return {
    name,
    valueSha256: alreadyHashed ? value : sentinelRawSha256(value),
    classification,
  };
}

function validateCommands(
  plan: Record<string, unknown>,
  prereg: SentinelProductionPreregistration,
  manifest: SentinelProductionCellManifest,
  upstreamRoot: string,
): void {
  if (!Array.isArray(plan.commands) || plan.commands.length !== 3) throw new Error("supervisor plan lacks exactly three commands");
  const commands = plan.commands.map((entry, index) => command(entry, `supervisor command ${index + 1}`));
  if (commands.map(({ role }) => role).join(",") !== "server,frontend,harness") {
    throw new Error("supervisor command order differs from the production launcher");
  }
  const byRole = new Map(commands.map((entry) => [String(entry.role), entry]));
  if (byRole.size !== 3 || !["server", "frontend", "harness"].every((role) => byRole.has(role))) {
    throw new Error("supervisor commands duplicate or omit a process role");
  }
  const server = byRole.get("server")!;
  const frontend = byRole.get("frontend")!;
  const harness = byRole.get("harness")!;
  executable(server.executable, prereg.runtime.python.realExecutableSha256, "server Python executable");
  executable(frontend.executable, prereg.runtime.npm.resolvedCliSha256, "frontend npm executable");
  executable(harness.executable, prereg.runtime.python.realExecutableSha256, "harness Python executable");
  if (
    (server.executable as Record<string, unknown>).path !== prereg.runtime.python.requestedVenvPath ||
    (harness.executable as Record<string, unknown>).path !== prereg.runtime.python.requestedVenvPath ||
    (frontend.executable as Record<string, unknown>).path !== prereg.runtime.npm.requestedCliPath
  ) throw new Error("supervisor executable paths differ from the signed runtime lease");
  if (sentinelRawCanonical(server.arguments) !== sentinelRawCanonical([
    "-m", "uvicorn", "server.server:app", "--host", "127.0.0.1", "--port", String(manifest.ports.server),
  ])) throw new Error("server command changed");
  if (sentinelRawCanonical(frontend.arguments) !== sentinelRawCanonical([
    "run", "dev", "--", "--host", "127.0.0.1", "--port", String(manifest.ports.frontend), "--strictPort",
  ])) throw new Error("frontend command changed");
  if (sentinelRawCanonical(harness.arguments) !== sentinelRawCanonical([
    "-m", "server.eval_harness", "run", manifest.attemptId, "--config", String((plan.agentConfig as Record<string, unknown>).path),
    "--server-url", `http://127.0.0.1:${manifest.ports.server}`, "--frontend-url", `http://127.0.0.1:${manifest.ports.frontend}`,
    "--speed-factor", "1", "--task", manifest.taskId,
  ])) throw new Error("harness command changed");
  const checkoutPath = String(plan.checkoutPath);
  if (
    server.cwd !== resolve(upstreamRoot, "runtime") || harness.cwd !== resolve(upstreamRoot, "runtime") ||
    frontend.cwd !== resolve(checkoutPath, "frontend")
  ) throw new Error("supervisor command working directories changed");
  sentinelRawExactKeys(plan.environmentBindings, ["frontend", "harness", "server"], "supervisor environment bindings");
  if (manifest.serviceBinding === null) throw new Error("cell manifest omits the supervisor service binding");
  const stateOrigin = `http://127.0.0.1:${manifest.ports.state}`;
  const providerOrigin = `http://127.0.0.1:${manifest.ports.provider}`;
  if (
    manifest.serviceBinding.state.origin !== stateOrigin || manifest.serviceBinding.provider.origin !== providerOrigin ||
    !/^[a-f0-9]{64}$/u.test(manifest.serviceBinding.state.tokenSha256) ||
    !/^[a-f0-9]{64}$/u.test(manifest.serviceBinding.provider.tokenSha256)
  ) throw new Error("cell service bindings differ from the declared loopback ports or token hashes");
  const safe = prereg.runtime.executionEnvironment.values;
  const fixedPython = [
    binding("PYTHONPATH", checkoutPath, "fixed-runtime"),
    binding("PYTHONPYCACHEPREFIX", resolve(upstreamRoot, "pycache"), "fixed-runtime"),
  ] as const;
  const expected = {
    server: expectedEnvironmentBindings(safe, fixedPython),
    frontend: expectedEnvironmentBindings(safe, [
      binding("SENTINEL_API_BASE", `http://127.0.0.1:${manifest.ports.server}`, "fixed-runtime"),
    ]),
    harness: expectedEnvironmentBindings(safe, [
      ...fixedPython,
      binding("PM_SENTINEL_STATE_ORIGIN", stateOrigin, "opaque-origin"),
      binding("PM_SENTINEL_STATE_TOKEN", manifest.serviceBinding.state.tokenSha256, "opaque-token", true),
      binding("PM_SENTINEL_PROVIDER_ORIGIN", providerOrigin, "opaque-origin"),
      binding("PM_SENTINEL_PROVIDER_TOKEN", manifest.serviceBinding.provider.tokenSha256, "opaque-token", true),
      binding("PM_SENTINEL_ATTEMPT_ID", manifest.attemptId, "fixed-runtime"),
      binding("PM_SENTINEL_AGENT_OUTPUT_ROOT", resolve(upstreamRoot, "runtime", "agent"), "fixed-runtime"),
      binding("PM_SENTINEL_POLL_INTERVAL_MS", "10000", "fixed-runtime"),
      binding("PM_SENTINEL_ACTIVE_SETTLE_MS", "250", "fixed-runtime"),
      binding("PM_SENTINEL_MAX_DECISIONS", "1000", "fixed-runtime"),
      binding("PM_SENTINEL_MAX_ACTIVE_ACTIONS", "64", "fixed-runtime"),
      binding("PM_SENTINEL_VIEWPORT_WIDTH", "1280", "fixed-runtime"),
      binding("PM_SENTINEL_VIEWPORT_HEIGHT", "720", "fixed-runtime"),
    ]),
  } as const;
  for (const role of ["server", "frontend", "harness"] as const) {
    const bindings = plan.environmentBindings[role];
    if (!Array.isArray(bindings) || bindings.length === 0) throw new Error(`${role} environment bindings are empty`);
    const names = new Set<string>();
    for (const candidate of bindings) {
      sentinelRawExactKeys(candidate, ["classification", "name", "valueSha256"], `${role} environment binding`);
      if (
        typeof candidate.name !== "string" || names.has(candidate.name) ||
        typeof candidate.valueSha256 !== "string" || !/^[a-f0-9]{64}$/u.test(candidate.valueSha256) ||
        !["safe-runtime", "fixed-runtime", "opaque-origin", "opaque-token"].includes(String(candidate.classification))
      ) throw new Error(`${role} environment binding is invalid or duplicated`);
      names.add(candidate.name);
    }
    if (sentinelRawCanonical(bindings) !== sentinelRawCanonical(expected[role])) {
      throw new Error(`${role} environment bindings differ from the production no-inheritance environment`);
    }
    const roleCommand = byRole.get(role)!;
    if (roleCommand.environmentBindingsSha256 !== sentinelRawJsonSha256(expected[role])) {
      throw new Error(`${role} command does not bind its exact redacted environment inventory`);
    }
  }
}

const COLLATERAL_DATABASE_PATHS = [
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

function expectedScenarioRelativePath(task: SentinelProductionTask): string {
  const prefix = `${task.environment}-`;
  const scenarioName = task.taskId.startsWith(prefix) ? task.taskId.slice(prefix.length) : "";
  return `scenarios/${task.environment}/${scenarioName}.json`;
}

function validateCollateral(value: unknown, task: SentinelProductionTask, label: string): void {
  if (!Array.isArray(value)) throw new Error(`${label} is not an array`);
  const expectedPaths = [...COLLATERAL_DATABASE_PATHS, expectedScenarioRelativePath(task)].sort(sentinelRawCompare);
  if (value.length !== expectedPaths.length) throw new Error(`${label} does not contain the exact database/scenario inventory`);
  value.forEach((entry, index) => {
    sentinelRawExactKeys(entry, ["byteLength", "relativePath", "sha256"], `${label} entry ${index + 1}`);
    if (
      entry.relativePath !== expectedPaths[index] || !Number.isSafeInteger(entry.byteLength) || Number(entry.byteLength) < 0 ||
      typeof entry.sha256 !== "string" || !/^[a-f0-9]{64}$/u.test(entry.sha256)
    ) throw new Error(`${label} entry ${index + 1} is missing, reordered, or invalid`);
  });
}

function parsePlan(
  value: unknown,
  upstreamRoot: string,
  cellRoot: string,
  manifest: SentinelProductionCellManifest,
  task: SentinelProductionTask,
  prereg: SentinelProductionPreregistration,
): SentinelProductionAttemptPlan {
  sentinelRawExactKeys(value, [
    "agentConfig", "agentRuntimeExecutable", "agentScript", "attemptId", "checkoutBefore", "checkoutPath", "collateralInitial",
    "collateralInitialRootSha256", "commands", "environmentBindings", "evidenceEligible", "frontendUrl", "killHorizonMs",
    "outputRoot", "planHash", "scenario", "schemaVersion", "serverUrl", "speedFactor", "task", "timeouts",
  ], "supervisor attempt plan");
  const { planHash, ...body } = value;
  if (
    value.schemaVersion !== "pm.public-eval-corners.sentinel-production-attempt-plan.v1" || value.evidenceEligible !== false ||
    value.attemptId !== manifest.attemptId || value.outputRoot !== upstreamRoot || value.speedFactor !== 1 ||
    value.killHorizonMs !== 630_000 || value.serverUrl !== `http://127.0.0.1:${manifest.ports.server}` ||
    value.frontendUrl !== `http://127.0.0.1:${manifest.ports.frontend}` ||
    typeof value.checkoutPath !== "string" || !value.checkoutPath.startsWith("/") || resolve(value.checkoutPath) !== value.checkoutPath ||
    planHash !== sentinelRawJsonSha256(body)
  ) throw new Error("supervisor attempt plan identity, timing, roots, or hash changed");
  taskRegistration(value.task, task);
  checkout(value.checkoutBefore, "supervisor checkout before");
  sentinelRawExactKeys(value.timeouts, ["attemptMs", "shutdownGraceMs", "startupMs"], "supervisor timeouts");
  if (value.timeouts.startupMs !== 60_000 || value.timeouts.attemptMs !== 720_000 || value.timeouts.shutdownGraceMs !== 5_000) {
    throw new Error("supervisor timeouts changed");
  }
  executable(value.agentRuntimeExecutable, prereg.runtime.node.resolvedExecutableSha256, "agent Node executable");
  executable(value.agentScript, prereg.runtime.agentScriptSha256, "general agent script");
  executable(value.agentConfig, manifest.agentConfigSha256 ?? "", "agent config");
  sentinelRawExactKeys(value.scenario, ["path", "sha256"], "supervisor scenario");
  if (
    value.scenario.sha256 !== task.scenarioSha256 ||
    value.scenario.path !== resolve(value.checkoutPath, expectedScenarioRelativePath(task))
  ) throw new Error("supervisor scenario path or hash changed");
  if (
    manifest.agentConfigPath !== "input/agent-config.json" ||
    (value.agentConfig as Record<string, unknown>).path !== resolve(cellRoot, "input", "agent-config.json")
  ) throw new Error("supervisor agent-config path is not the exact retained cell input");
  const configBytes = sentinelRawRegularFile(resolve(cellRoot, manifest.agentConfigPath), "agent config");
  if (sentinelRawSha256(configBytes) !== manifest.agentConfigSha256) throw new Error("agent config bytes differ from manifest");
  const config = JSON.parse(configBytes.toString("utf8")) as unknown;
  sentinelRawExactKeys(config, ["agent_subprocess", "frontend_url", "server_url", "speed_factor"], "agent config");
  if (
    !Array.isArray(config.agent_subprocess) || sentinelRawCanonical(config.agent_subprocess) !== sentinelRawCanonical([
      prereg.runtime.node.requestedPath, String((value.agentScript as Record<string, unknown>).path),
      "--url", "__TASK_URL__", "--prompt", "__TASK_PROMPT__",
    ]) || config.server_url !== value.serverUrl || config.frontend_url !== value.frontendUrl || config.speed_factor !== 1
  ) throw new Error("agent config is not the task-agnostic direct argv boundary");
  validateCollateral(value.collateralInitial, task, "supervisor initial collateral");
  if (value.collateralInitialRootSha256 !== sentinelRawJsonSha256(value.collateralInitial)) {
    throw new Error("supervisor initial collateral root mismatch");
  }
  validateCommands(value, prereg, manifest, upstreamRoot);
  return value as unknown as SentinelProductionAttemptPlan;
}

function validateProcessExit(value: unknown, label: string): void {
  sentinelRawExactKeys(value, ["exitCode", "signal", "spawnError"], label);
  const exitCodeValid = value.exitCode === null || (Number.isSafeInteger(value.exitCode) && Number(value.exitCode) >= 0);
  const signalValid = value.signal === null || (typeof value.signal === "string" && /^SIG[A-Z0-9]+$/u.test(value.signal));
  if (
    !exitCodeValid || !signalValid || value.spawnError !== null ||
    (value.exitCode === null) === (value.signal === null)
  ) throw new Error(`${label} is not a clean exit or a recorded signal termination`);
}

function validTerminationSignal(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const match = /^SIG(?:TERM|KILL):(pid|pgid):([0-9]+)$/u.exec(value);
  return match !== null && Number.isSafeInteger(Number(match[2])) && Number(match[2]) > 1;
}

function processRecord(value: unknown, plan: SentinelProductionAttemptPlan, upstreamRoot: string): SentinelProductionProcessTerminalRecord {
  sentinelRawExactKeys(value, [
    "commandIdentitySha256", "environmentSha256", "exit", "pid", "ppid", "role", "stderr", "stdout", "timedOut", "treeTermination",
  ], "supervisor process terminal");
  sentinelRawExactKeys(value.treeTermination, ["exit", "observedPids", "reaped", "remainingPids", "signalsSent"], "supervisor process tree termination");
  validateProcessExit(value.exit, "supervisor process exit");
  validateProcessExit(value.treeTermination.exit, "supervisor process-tree exit");
  const exit = value.exit as Record<string, unknown>;
  if (
    !["server", "frontend", "harness"].includes(String(value.role)) || !Number.isSafeInteger(value.pid) || Number(value.pid) <= 1 ||
    !Number.isSafeInteger(value.ppid) || Number(value.ppid) <= 1 || value.pid === value.ppid || value.timedOut !== false ||
    !Array.isArray(value.treeTermination.observedPids) || !value.treeTermination.observedPids.includes(value.pid) ||
    new Set(value.treeTermination.observedPids).size !== value.treeTermination.observedPids.length ||
    value.treeTermination.observedPids.some((pid) => !Number.isSafeInteger(pid) || Number(pid) <= 1) ||
    !Array.isArray(value.treeTermination.remainingPids) || value.treeTermination.remainingPids.length !== 0 || value.treeTermination.reaped !== true ||
    !Array.isArray(value.treeTermination.signalsSent) ||
    value.treeTermination.signalsSent.some((signal) => !validTerminationSignal(signal)) ||
    new Set(value.treeTermination.signalsSent).size !== value.treeTermination.signalsSent.length ||
    sentinelRawCanonical(value.exit) !== sentinelRawCanonical(value.treeTermination.exit) ||
    (exit.signal === null && exit.exitCode !== 0)
  ) throw new Error("supervisor process terminal identity or reap evidence is invalid");
  const commandPlan = plan.commands.find(({ role }) => role === value.role);
  if (!commandPlan || value.commandIdentitySha256 !== commandPlan.identitySha256 || value.environmentSha256 !== commandPlan.environmentSha256) {
    throw new Error("supervisor process terminal differs from command plan");
  }
  verifyArtifact(upstreamRoot, value.stdout, `logs/${value.role}.stdout.log`, `${value.role} stdout`);
  verifyArtifact(upstreamRoot, value.stderr, `logs/${value.role}.stderr.log`, `${value.role} stderr`);
  return value as unknown as SentinelProductionProcessTerminalRecord;
}

function resultEnvelope(value: unknown): SentinelUpstreamResultEnvelope {
  sentinelRawExactKeys(value, [
    "condition_at", "contact_get_time", "contact_message", "contact_post_time", "detail", "evaluation_time", "success",
  ], "upstream results.json");
  const nullableFinite = (candidate: unknown): boolean => candidate === null || (typeof candidate === "number" && Number.isFinite(candidate));
  const nullableInteger = (candidate: unknown): boolean => candidate === null || Number.isSafeInteger(candidate);
  if (
    typeof value.success !== "boolean" || typeof value.detail !== "string" ||
    !nullableFinite(value.condition_at) || !nullableFinite(value.evaluation_time) ||
    !nullableInteger(value.contact_get_time) || !nullableInteger(value.contact_post_time) ||
    (value.contact_message !== null && typeof value.contact_message !== "string")
  ) throw new Error("upstream results.json envelope is invalid");
  return value as unknown as SentinelUpstreamResultEnvelope;
}

function sameInventory(actual: readonly SentinelProductionArtifactIdentity[], expected: unknown, label: string): void {
  if (!Array.isArray(expected)) throw new Error(`${label} is not an array`);
  expected.forEach((entry, index) => artifact(entry, `${label} ${index + 1}`));
  if (sentinelRawCanonical(actual) !== sentinelRawCanonical(expected)) throw new Error(`${label} has missing, extra, or hash-mismatched artifacts`);
}

export function verifySentinelRawSupervisorEvidence(input: {
  readonly cellRoot: string;
  readonly manifest: SentinelProductionCellManifest;
  readonly task: SentinelProductionTask;
  readonly plan: SentinelProductionPreregistration;
  readonly agent: SentinelRawAgentVerification;
}): SentinelRawSupervisorVerification {
  const issues: string[] = [];
  let completion: SentinelRawSupervisorVerification["completion"] = "infrastructure-incomplete";
  let attemptStartedAt: string | null = null;
  let attemptFinishedAt: string | null = null;
  let planHash: string | null = null;
  let resultBytes: Buffer | null = null;
  let result: SentinelUpstreamResultEnvelope | null = null;
  let processIds: readonly number[] = [];
  let checkoutPath: string | null = null;
  let horizonKillProven = false;
  let executedPaths: SentinelRawSupervisorVerification["executedPaths"] = null;
  try {
    const upstreamRoot = resolve(input.cellRoot, "upstream");
    const receiptRoot = resolve(upstreamRoot, "receipts");
    const receiptNames = readdirSync(receiptRoot).sort(sentinelRawCompare);
    const starts = receiptNames.filter((name) => /^sentinel-production-attempt-start-[a-f0-9]{64}\.json$/u.test(name));
    const terminals = receiptNames.filter((name) => /^sentinel-production-attempt-terminal-[a-f0-9]{64}\.json$/u.test(name));
    if (starts.length !== 1 || terminals.length !== 1 || receiptNames.length !== 2) {
      throw new Error("supervisor receipts contain missing, extra, or duplicate attempt receipts");
    }
    const start = sentinelRawJsonFile(resolve(receiptRoot, starts[0]!), "supervisor start receipt");
    sentinelRawExactKeys(start, ["evidenceEligible", "plan", "receiptHash", "schemaVersion", "startedAt"], "supervisor start receipt");
    const { receiptHash: startHash, ...startBody } = start;
    if (
      start.schemaVersion !== "pm.public-eval-corners.sentinel-production-attempt-start.v1" || start.evidenceEligible !== false ||
      startHash !== sentinelRawJsonSha256(startBody) || starts[0] !== `sentinel-production-attempt-start-${startHash}.json`
    ) throw new Error("supervisor start receipt is not content-addressed");
    attemptStartedAt = sentinelRawCanonicalTimestamp(start.startedAt, "supervisor attempt startedAt");
    const attemptPlan = parsePlan(start.plan, upstreamRoot, input.cellRoot, input.manifest, input.task, input.plan);
    planHash = attemptPlan.planHash;
    checkoutPath = attemptPlan.checkoutPath;
    const serverCommand = attemptPlan.commands.find(({ role }) => role === "server");
    const frontendCommand = attemptPlan.commands.find(({ role }) => role === "frontend");
    const harnessCommand = attemptPlan.commands.find(({ role }) => role === "harness");
    if (
      serverCommand === undefined || frontendCommand === undefined || harnessCommand === undefined ||
      serverCommand.executable.path !== harnessCommand.executable.path
    ) throw new Error("supervisor command paths are absent or Python paths disagree");
    executedPaths = {
      nodeExecutablePath: attemptPlan.agentRuntimeExecutable.path,
      npmCliPath: frontendCommand.executable.path,
      pythonExecutablePath: serverCommand.executable.path,
      agentScriptPath: attemptPlan.agentScript.path,
    };
    if (attemptStartedAt !== input.manifest.attemptStartedAt || Date.parse(attemptStartedAt) < Date.parse(input.manifest.attemptInvokedAt ?? "")) {
      throw new Error("supervisor attempt start is not bound to runner invocation time");
    }

    const terminalValue = sentinelRawJsonFile(resolve(receiptRoot, terminals[0]!), "supervisor terminal receipt");
    if (!sentinelRawIsRecord(terminalValue)) throw new Error("supervisor terminal receipt is not an object");
    const { receiptHash: terminalHash, ...terminalBody } = terminalValue;
    sentinelRawExactKeys(terminalValue, [
      "agentProcess", "checkoutAfter", "checkoutBefore", "collateral", "completedAt", "completion", "evidenceEligible", "infrastructureIssue",
      "infrastructureStage", "processes", "rawArtifacts", "receiptHash", "resultArtifacts", "resultJsonPath", "resultJsonSha256",
      "schemaVersion", "startReceiptHash", "taskId", "timedOut", "attemptId",
    ], "supervisor terminal receipt");
    if (
      terminalValue.schemaVersion !== "pm.public-eval-corners.sentinel-production-attempt-terminal.v1" ||
      terminalValue.evidenceEligible !== false || terminalValue.attemptId !== input.manifest.attemptId || terminalValue.taskId !== input.task.taskId ||
      terminalValue.startReceiptHash !== startHash || terminalHash !== sentinelRawJsonSha256(terminalBody) ||
      terminals[0] !== `sentinel-production-attempt-terminal-${terminalHash}.json` || terminalHash !== input.manifest.supervisor.receiptHash
    ) throw new Error("supervisor terminal receipt is not content-addressed to the cell and start");
    completion = terminalValue.completion as SentinelRawSupervisorVerification["completion"];
    attemptFinishedAt = sentinelRawCanonicalTimestamp(terminalValue.completedAt, "supervisor attempt completedAt");
    if (
      completion !== "behavioral-complete" || terminalValue.infrastructureStage !== null || terminalValue.infrastructureIssue !== null ||
      terminalValue.timedOut !== false || input.manifest.supervisor.completion !== "behavioral-complete" || input.manifest.infrastructureComplete !== true
    ) throw new Error("supervisor or runner retained an infrastructure-incomplete attempt");
    checkout(terminalValue.checkoutBefore, "terminal checkout before");
    checkout(terminalValue.checkoutAfter, "terminal checkout after");
    if (sentinelRawCanonical(terminalValue.checkoutBefore) !== sentinelRawCanonical(terminalValue.checkoutAfter)) {
      throw new Error("checkout identity changed during the attempt");
    }
    sentinelRawExactKeys(terminalValue.collateral, [
      "changedPaths", "final", "finalRootSha256", "initial", "initialRootSha256", "mutationDetected",
    ], "supervisor collateral comparison");
    validateCollateral(terminalValue.collateral.initial, input.task, "supervisor terminal initial collateral");
    validateCollateral(terminalValue.collateral.final, input.task, "supervisor terminal final collateral");
    if (
      terminalValue.collateral.mutationDetected !== false || !Array.isArray(terminalValue.collateral.changedPaths) ||
      terminalValue.collateral.changedPaths.length !== 0 ||
      terminalValue.collateral.initialRootSha256 !== sentinelRawJsonSha256(terminalValue.collateral.initial) ||
      terminalValue.collateral.finalRootSha256 !== sentinelRawJsonSha256(terminalValue.collateral.final) ||
      sentinelRawCanonical(terminalValue.collateral.initial) !== sentinelRawCanonical(terminalValue.collateral.final) ||
      terminalValue.collateral.initialRootSha256 !== attemptPlan.collateralInitialRootSha256
    ) throw new Error("supervisor collateral comparison does not prove an unchanged checkout database/scenario set");
    if (!Array.isArray(terminalValue.processes) || terminalValue.processes.length !== 3) throw new Error("supervisor terminal lacks exactly three process records");
    const processes = terminalValue.processes.map((entry) => processRecord(entry, attemptPlan, upstreamRoot));
    if (new Set(processes.map(({ role }) => role)).size !== 3 || new Set(processes.map(({ pid }) => pid)).size !== 3) {
      throw new Error("supervisor process roles or PIDs are duplicated");
    }
    processIds = processes.map(({ pid }) => pid);
    const harness = processes.find(({ role }) => role === "harness")!;
    if (
      harness.timedOut || harness.exit.exitCode !== 0 || harness.exit.signal !== null || harness.exit.spawnError !== null ||
      input.agent.pid === null || input.agent.ppid !== harness.pid || !harness.treeTermination.observedPids.includes(input.agent.pid)
    ) throw new Error("harness/agent process tree did not complete and reap cleanly");
    if (terminalValue.agentProcess === null) throw new Error("supervisor terminal lacks general-agent process evidence");
    sentinelRawExactKeys(terminalValue.agentProcess, ["pid", "ppid", "startArtifact", "startedAt", "terminalArtifact"], "supervisor agent process");
    if (
      terminalValue.agentProcess.pid !== input.agent.pid || terminalValue.agentProcess.ppid !== input.agent.ppid ||
      terminalValue.agentProcess.startedAt !== input.agent.startedAt
    ) throw new Error("supervisor agent process differs from raw agent start");
    verifyArtifact(upstreamRoot, terminalValue.agentProcess.startArtifact, "runtime/agent/agent-start.json", "agent start artifact");
    if (input.agent.terminalPresent) verifyArtifact(upstreamRoot, terminalValue.agentProcess.terminalArtifact, "runtime/agent/agent-terminal.json", "agent terminal artifact");
    else if (terminalValue.agentProcess.terminalArtifact !== null) throw new Error("supervisor fabricated an agent terminal artifact");

    const resultPath = `runtime/results/${input.manifest.attemptId}/${input.task.environment}/${input.task.taskId}/results.json`;
    if (terminalValue.resultJsonPath !== resultPath || typeof terminalValue.resultJsonSha256 !== "string") {
      throw new Error("supervisor result path is not task/attempt-bound");
    }
    resultBytes = sentinelRawRegularFile(resolve(upstreamRoot, resultPath), "upstream results.json");
    if (sentinelRawSha256(resultBytes) !== terminalValue.resultJsonSha256) throw new Error("upstream result hash differs from supervisor receipt");
    result = resultEnvelope(JSON.parse(resultBytes.toString("utf8")) as unknown);
    const rawInventory = [
      ...sentinelRawInventory(resolve(upstreamRoot, "logs")).map((entry) => ({ ...entry, path: `logs/${entry.path}` })),
      ...sentinelRawInventory(resolve(upstreamRoot, "runtime")).map((entry) => ({ ...entry, path: `runtime/${entry.path}` })),
    ].sort((left, right) => sentinelRawCompare(left.path, right.path));
    sameInventory(rawInventory, terminalValue.rawArtifacts, "supervisor raw artifact inventory");
    const resultRoot = resolve(upstreamRoot, "runtime", "results", input.manifest.attemptId);
    sameInventory(sentinelRawInventory(resultRoot), terminalValue.resultArtifacts, "supervisor result artifact inventory");
    const harnessStdout = sentinelRawRegularFile(resolve(upstreamRoot, "logs", "harness.stdout.log"), "harness stdout").toString("utf8");
    horizonKillProven = harnessStdout.includes("Agent subprocess timed out, killing process group...") &&
      !harnessStdout.includes("Process group already exited before kill; nothing to signal.");
    const finishCandidates = [input.agent.startedAt, input.agent.browserLastRecordedAt, input.agent.lastDecisionAt]
      .filter((value): value is string => typeof value === "string")
      .map((value) => Date.parse(value));
    if (
      attemptFinishedAt === null || finishCandidates.some((timestamp) =>
        !Number.isFinite(timestamp) || timestamp > Date.parse(attemptFinishedAt as string))
    ) throw new Error("supervisor completedAt predates retained agent activity");
  } catch (error) { issues.push(issueOf(error)); }
  const attemptDurationMs = attemptStartedAt === null || attemptFinishedAt === null
    ? null : Date.parse(attemptFinishedAt) - Date.parse(attemptStartedAt);
  if (attemptDurationMs !== null && (!Number.isFinite(attemptDurationMs) || attemptDurationMs < 0)) {
    issues.push("attempt duration is invalid");
  }
  return {
    valid: issues.length === 0,
    issues,
    completion,
    attemptStartedAt,
    attemptFinishedAt,
    attemptDurationMs,
    planHash,
    resultBytes,
    result,
    processIds,
    checkoutPath,
    horizonKillProven,
    executedPaths,
  };
}
