import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  createWriteStream,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:net";
import { basename, dirname, isAbsolute, relative, resolve } from "node:path";
import { finished } from "node:stream/promises";

export type SentinelAttemptTaskId =
  | "microhub-stars-relative-passive"
  | "microhub-stars-noop"
  | "microhub-stars-absolute-passive";

export type SentinelProcessRole = "server" | "frontend" | "harness";

export interface SentinelExecutableIdentity {
  readonly path: string;
  readonly sha256: string;
}

export interface SentinelOpaqueEnvironment {
  readonly stateOrigin: string;
  readonly stateToken: string;
  readonly providerOrigin: string;
  readonly providerToken: string;
}

export interface SentinelAttemptSupervisorInput {
  readonly schemaVersion: "pm.public-eval-corners.sentinel-attempt-input.v1";
  readonly attemptId: string;
  readonly taskId: SentinelAttemptTaskId;
  readonly checkoutPath: string;
  readonly outputRoot: string;
  readonly attemptRegistryRoot: string;
  readonly agentConfig: SentinelExecutableIdentity;
  readonly pythonExecutable: SentinelExecutableIdentity;
  readonly frontendExecutable: SentinelExecutableIdentity;
  readonly serverPort: number;
  readonly frontendPort: number;
  readonly opaqueEnvironment: SentinelOpaqueEnvironment;
  readonly pollIntervalMs: number;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  /** Extra immutable runtime inputs; the MicroHub/shared DBs are always included. */
  readonly collateralRelativePaths?: readonly string[];
  readonly startupTimeoutMs?: number;
  readonly attemptTimeoutMs?: number;
  readonly shutdownGraceMs?: number;
}

export interface SentinelSpawnSpec {
  readonly role: SentinelProcessRole;
  readonly executable: string;
  readonly arguments: readonly string[];
  readonly cwd: string;
  readonly environment: Readonly<Record<string, string>>;
  readonly stdoutPath: string;
  readonly stderrPath: string;
}

export interface SentinelProcessExit {
  readonly exitCode: number | null;
  readonly signal: string | null;
  readonly spawnError: string | null;
}

export interface SentinelTreeTermination {
  readonly signalsSent: readonly string[];
  readonly observedPids: readonly number[];
  readonly remainingPids: readonly number[];
  readonly reaped: boolean;
  readonly exit: SentinelProcessExit;
}

export interface SentinelProcessHandle {
  readonly role: SentinelProcessRole;
  readonly pid: number;
  readonly completion: Promise<SentinelProcessExit>;
  readonly terminateTree: (graceMs: number) => Promise<SentinelTreeTermination>;
}

export interface SentinelAttemptSupervisorDependencies {
  readonly git: (checkoutPath: string, arguments_: readonly string[]) => string;
  readonly hostEnvironment: () => Readonly<Record<string, string | undefined>>;
  readonly verifyScenario: (
    checkoutPath: string,
    taskId: SentinelAttemptTaskId,
  ) => SentinelExecutableIdentity;
  readonly assertPortsAvailable: (ports: readonly number[]) => Promise<void>;
  readonly waitForHttpReady: (url: string, timeoutMs: number) => Promise<void>;
  readonly spawnProcess: (spec: SentinelSpawnSpec) => SentinelProcessHandle;
  readonly waitForExit: (
    handle: SentinelProcessHandle,
    timeoutMs: number,
  ) => Promise<{ readonly timedOut: boolean; readonly exit: SentinelProcessExit | null }>;
  readonly now: () => string;
}

export interface SentinelAttemptTerminalReceipt {
  readonly schemaVersion: "pm.public-eval-corners.sentinel-attempt-terminal.v1";
  readonly evidenceEligible: false;
  readonly attemptId: string;
  readonly taskId: SentinelAttemptTaskId;
  readonly status: "succeeded" | "failed" | "timed-out";
  readonly failureStage: string | null;
  readonly failureMessage: string | null;
  readonly startReceiptHash: string;
  readonly checkoutBefore: SentinelCheckoutVerification;
  readonly checkoutAfter: SentinelCheckoutVerification;
  readonly collateral: SentinelCollateralComparison;
  readonly processes: readonly SentinelProcessTerminalRecord[];
  readonly resultArtifacts: readonly SentinelArtifactIdentity[];
  readonly resultJsonPath: string | null;
  readonly resultJsonSha256: string | null;
  readonly receiptHash: string;
}

export interface SentinelAttemptStartReceipt {
  readonly schemaVersion: "pm.public-eval-corners.sentinel-attempt-start.v1";
  readonly evidenceEligible: false;
  readonly startedAt: string;
  readonly plan: SentinelAttemptPlan;
  readonly receiptHash: string;
}

interface SentinelScenarioPin {
  readonly relativePath: string;
  readonly sha256: string;
}

export interface SentinelFileSnapshot {
  readonly relativePath: string;
  readonly byteLength: number | null;
  readonly sha256: string | null;
}

export interface SentinelCheckoutVerification {
  readonly expectedRepositoryUrl: string;
  readonly actualRepositoryUrl: string | null;
  readonly expectedRevision: string;
  readonly actualRevision: string | null;
  readonly clean: boolean;
  readonly valid: boolean;
  readonly issues: readonly string[];
}

export interface SentinelCollateralComparison {
  readonly initialRootSha256: string;
  readonly finalRootSha256: string;
  readonly mutationDetected: boolean;
  readonly initial: readonly SentinelFileSnapshot[];
  readonly final: readonly SentinelFileSnapshot[];
  readonly changedPaths: readonly string[];
}

export interface SentinelArtifactIdentity {
  readonly path: string;
  readonly byteLength: number;
  readonly sha256: string;
}

export interface SentinelCommandPlan {
  readonly role: SentinelProcessRole;
  readonly executable: SentinelExecutableIdentity;
  readonly arguments: readonly string[];
  readonly cwd: string;
  readonly identitySha256: string;
}

export interface SentinelEnvironmentBinding {
  readonly name: string;
  readonly valueSha256: string;
  readonly classification: "safe-runtime" | "fixed-runtime" | "opaque-origin" | "opaque-token";
}

export interface SentinelProcessTerminalRecord {
  readonly role: SentinelProcessRole;
  readonly pid: number;
  readonly commandIdentitySha256: string;
  readonly timedOut: boolean;
  readonly exit: SentinelProcessExit;
  readonly treeTermination: SentinelTreeTermination;
  readonly stdout: SentinelArtifactIdentity;
  readonly stderr: SentinelArtifactIdentity;
}

export interface SentinelAttemptPlan {
  readonly schemaVersion: "pm.public-eval-corners.sentinel-attempt-plan.v1";
  readonly evidenceEligible: false;
  readonly attemptId: string;
  readonly taskId: SentinelAttemptTaskId;
  readonly checkoutPath: string;
  readonly outputRoot: string;
  readonly scenario: SentinelExecutableIdentity;
  readonly agentConfig: SentinelExecutableIdentity;
  readonly speedFactor: 1;
  readonly serverUrl: string;
  readonly frontendUrl: string;
  readonly commands: readonly SentinelCommandPlan[];
  readonly environmentBindings: Readonly<Record<SentinelProcessRole, readonly SentinelEnvironmentBinding[]>>;
  readonly collateralInitial: readonly SentinelFileSnapshot[];
  readonly collateralInitialRootSha256: string;
  readonly checkoutBefore: SentinelCheckoutVerification;
  readonly timeouts: {
    readonly startupMs: number;
    readonly attemptMs: number;
    readonly shutdownGraceMs: number;
  };
  readonly planHash: string;
}

interface PreparedAttempt {
  readonly plan: SentinelAttemptPlan;
  readonly environment: Readonly<Record<SentinelProcessRole, Readonly<Record<string, string>>>>;
  readonly collateralRelativePaths: readonly string[];
}

type JsonRecord = Record<string, unknown>;

const EXPECTED_REPOSITORY_URL = "https://github.com/microsoft/sentinel_environments";
const EXPECTED_REVISION = "0faca33cc58ea62e97a928b67cd3beec7176b408";
const SHA256 = /^[a-f0-9]{64}$/u;
const ATTEMPT_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/u;
const SAFE_ENVIRONMENT_KEYS = [
  "HOME",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "PATH",
  "TEMP",
  "TMP",
  "TMPDIR",
  "VIRTUAL_ENV",
] as const;
const OPAQUE_ENVIRONMENT_NAMES = {
  stateOrigin: "PM_SENTINEL_STATE_ORIGIN",
  stateToken: "PM_SENTINEL_STATE_TOKEN",
  providerOrigin: "PM_SENTINEL_PROVIDER_ORIGIN",
  providerToken: "PM_SENTINEL_PROVIDER_TOKEN",
} as const;
const SCENARIO_PINS: Readonly<Record<SentinelAttemptTaskId, SentinelScenarioPin>> = {
  "microhub-stars-relative-passive": {
    relativePath: "scenarios/microhub/stars-relative-passive.json",
    sha256: "892c71ca6acb5f0268dd133df3990c779e5335d946c6cb5f5e051087dc4cd6da",
  },
  "microhub-stars-noop": {
    relativePath: "scenarios/microhub/stars-noop.json",
    sha256: "e689d9d99d97bf1cca71f96b96e72cbbd882a2848be26ba9d9d3ba78dd99649d",
  },
  "microhub-stars-absolute-passive": {
    relativePath: "scenarios/microhub/stars-absolute-passive.json",
    sha256: "2fe141ded7e4afc06d77db16f07ccaa0e62ccda805cb7d3c4318eed9d61fb08e",
  },
};

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function canonical(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("cannot canonicalize non-finite number");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.entries(value)
      .sort(([left], [right]) => compareCodeUnits(left, right))
      .map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`)
      .join(",")}}`;
  }
  throw new Error(`cannot canonicalize ${typeof value}`);
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function sha256Json(value: unknown): string {
  return sha256(canonical(value));
}

function normalizeRemote(value: string): string {
  return value.trim().replace(/\.git$/u, "").replace(/\/+$/u, "");
}

function isWithin(root: string, target: string): boolean {
  const child = relative(resolve(root), resolve(target));
  return child === "" || (!child.startsWith("..") && !isAbsolute(child));
}

function canonicalRelativePath(value: string, label: string): string {
  if (
    value.length === 0 ||
    value.length > 1024 ||
    value.startsWith("/") ||
    value.includes("\\") ||
    value.includes("\0") ||
    value.split("/").some((part) => part === "" || part === "." || part === "..")
  ) {
    throw new Error(`${label} must be a canonical relative path`);
  }
  return value;
}

function exactFile(
  identity: SentinelExecutableIdentity,
  label: string,
  allowSymbolicLink = false,
): SentinelExecutableIdentity {
  if (!isRecord(identity) || typeof identity.path !== "string" || !isAbsolute(identity.path)) {
    throw new Error(`${label}.path must be absolute`);
  }
  if (typeof identity.sha256 !== "string" || !SHA256.test(identity.sha256)) {
    throw new Error(`${label}.sha256 must be lowercase SHA-256`);
  }
  const path = resolve(identity.path);
  const lstat = lstatSync(path);
  if ((!lstat.isFile() && !(allowSymbolicLink && lstat.isSymbolicLink())) || !statSync(path).isFile()) {
    throw new Error(`${label}.path must resolve to a regular file`);
  }
  const actual = sha256(readFileSync(path));
  if (actual !== identity.sha256) throw new Error(`${label}.sha256 does not match file bytes`);
  return { path, sha256: actual };
}

function verifyCheckout(
  checkoutPath: string,
  dependencies: Pick<SentinelAttemptSupervisorDependencies, "git">,
): SentinelCheckoutVerification {
  const issues: string[] = [];
  let actualRevision: string | null = null;
  let actualRepositoryUrl: string | null = null;
  let clean = false;
  try {
    actualRevision = dependencies.git(checkoutPath, ["rev-parse", "HEAD"]).trim();
    actualRepositoryUrl = dependencies.git(checkoutPath, ["remote", "get-url", "origin"]).trim();
    clean = dependencies.git(checkoutPath, [
      "status",
      "--porcelain=v1",
      "--untracked-files=all",
    ]).trim() === "";
  } catch (error) {
    issues.push(error instanceof Error ? error.message : String(error));
  }
  if (actualRevision !== EXPECTED_REVISION) issues.push("checkout revision does not match Sentinel pin");
  if (
    actualRepositoryUrl === null ||
    normalizeRemote(actualRepositoryUrl) !== normalizeRemote(EXPECTED_REPOSITORY_URL)
  ) {
    issues.push("checkout origin does not match Sentinel repository");
  }
  if (!clean) issues.push("Sentinel checkout is not clean");
  return {
    expectedRepositoryUrl: EXPECTED_REPOSITORY_URL,
    actualRepositoryUrl,
    expectedRevision: EXPECTED_REVISION,
    actualRevision,
    clean,
    valid: issues.length === 0,
    issues,
  };
}

function defaultVerifyScenario(checkoutPath: string, taskId: SentinelAttemptTaskId): SentinelExecutableIdentity {
  const pin = SCENARIO_PINS[taskId];
  const path = resolve(checkoutPath, pin.relativePath);
  if (!isWithin(checkoutPath, path)) throw new Error("scenario escaped checkout");
  const identity = exactFile({ path, sha256: pin.sha256 }, "scenario");
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch {
    throw new Error("pinned Sentinel scenario is not valid JSON");
  }
  if (!isRecord(parsed) || parsed.id !== taskId || parsed.environment !== "microhub") {
    throw new Error("pinned Sentinel scenario identity does not match exact task");
  }
  if (Object.hasOwn(parsed, "speed_factor")) {
    throw new Error("Sentinel scenario must not contain speed_factor");
  }
  return identity;
}

function requiredPort(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 1024 || value > 65_535) {
    throw new Error(`${label} must be a non-privileged TCP port`);
  }
  return value;
}

function loopbackOrigin(value: string, label: string): { readonly origin: string; readonly port: number } {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${label} must be an HTTP loopback origin`);
  }
  if (
    parsed.protocol !== "http:" ||
    parsed.hostname !== "127.0.0.1" ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.pathname !== "/" ||
    parsed.search !== "" ||
    parsed.hash !== "" ||
    parsed.port === ""
  ) {
    throw new Error(`${label} must be an explicit http://127.0.0.1:<port> origin`);
  }
  return { origin: parsed.origin, port: requiredPort(Number(parsed.port), `${label} port`) };
}

function requiredOpaqueToken(value: string, label: string): string {
  if (typeof value !== "string" || value.length < 32 || value.length > 4096 || /[\r\n\0]/u.test(value)) {
    throw new Error(`${label} must be an opaque token between 32 and 4096 bytes`);
  }
  return value;
}

function assertNoTreatmentDisclosure(value: string, label: string): void {
  if (
    /(?:^|[\s_-])(?:arm|mode|treatment|agent-state-treatment)(?:$|[\s_=-])/iu.test(value) ||
    /(?:^|[=,:\s])(?:native|sham|substrate)(?:$|[=,:\s])/iu.test(value) ||
    /(?:^|[-_.:])(?:native|sham|substrate)(?:$|[-_.:])/iu.test(value) ||
    /(?:api[-_]?key|credential|secret|access[-_]?token)/iu.test(value) ||
    /(?:OPENAI|ANTHROPIC|GOOGLE|GEMINI|AZURE)[A-Z0-9_]*(?:API_KEY|TOKEN)=/iu.test(value)
  ) {
    throw new Error(`${label} discloses treatment or raw provider credentials`);
  }
}

function verifyAgentConfig(
  identity: SentinelExecutableIdentity,
  serverUrl: string,
  frontendUrl: string,
): SentinelExecutableIdentity {
  const config = exactFile(identity, "agentConfig");
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(config.path, "utf8")) as unknown;
  } catch {
    throw new Error("agentConfig must be strict JSON (also valid YAML)");
  }
  if (!isRecord(parsed)) throw new Error("agentConfig must be an object");
  if (
    Object.keys(parsed).sort(compareCodeUnits).join(",") !==
    ["agent_subprocess", "frontend_url", "server_url", "speed_factor"].sort(compareCodeUnits).join(",")
  ) {
    throw new Error("agentConfig must contain exactly agent_subprocess, URLs, and speed_factor");
  }
  if (parsed.server_url !== serverUrl || parsed.frontend_url !== frontendUrl) {
    throw new Error("agentConfig loopback URLs do not match reserved ports");
  }
  if (parsed.speed_factor !== 1) throw new Error("agentConfig speed_factor must be exactly 1");
  if (!Array.isArray(parsed.agent_subprocess) || parsed.agent_subprocess.length === 0) {
    throw new Error("agentConfig.agent_subprocess must be a non-empty direct argv array");
  }
  parsed.agent_subprocess.forEach((argument, index) => {
    if (typeof argument !== "string" || argument.length === 0 || argument.includes("\0")) {
      throw new Error(`agentConfig.agent_subprocess[${index}] must be a non-empty argv string`);
    }
    assertNoTreatmentDisclosure(argument, `agentConfig.agent_subprocess[${index}]`);
  });
  return config;
}

function boundedTimeout(value: number | undefined, fallback: number, label: string): number {
  const selected = value ?? fallback;
  if (!Number.isSafeInteger(selected) || selected < 100 || selected > 900_000) {
    throw new Error(`${label} must be a safe integer between 100 and 900000ms`);
  }
  return selected;
}

function boundedInteger(value: number, minimum: number, maximum: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${label} must be a safe integer between ${minimum} and ${maximum}`);
  }
  return value;
}

function snapshotFiles(checkoutPath: string, relativePaths: readonly string[]): readonly SentinelFileSnapshot[] {
  return relativePaths.map((relativePath) => {
    const path = resolve(checkoutPath, relativePath);
    if (!isWithin(checkoutPath, path)) throw new Error("collateral path escaped checkout");
    if (!existsSync(path)) return { relativePath, byteLength: null, sha256: null };
    const stat = lstatSync(path);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new Error(`collateral ${relativePath} must be a real regular file`);
    }
    const bytes = readFileSync(path);
    return { relativePath, byteLength: bytes.byteLength, sha256: sha256(bytes) };
  });
}

function collateralComparison(
  initial: readonly SentinelFileSnapshot[],
  final: readonly SentinelFileSnapshot[],
): SentinelCollateralComparison {
  const finalByPath = new Map(final.map((entry) => [entry.relativePath, entry] as const));
  const changedPaths = initial
    .filter((entry) => canonical(entry) !== canonical(finalByPath.get(entry.relativePath)))
    .map(({ relativePath }) => relativePath);
  return {
    initialRootSha256: sha256Json(initial),
    finalRootSha256: sha256Json(final),
    mutationDetected: changedPaths.length > 0,
    initial,
    final,
    changedPaths,
  };
}

function commandPlan(
  role: SentinelProcessRole,
  executable: SentinelExecutableIdentity,
  arguments_: readonly string[],
  cwd: string,
): SentinelCommandPlan {
  const body = { role, executable, arguments: arguments_, cwd } as const;
  return { ...body, identitySha256: sha256Json(body) };
}

function environmentBindings(
  environment: Readonly<Record<string, string>>,
  opaqueKeys: ReadonlySet<string>,
  fixedKeys: ReadonlySet<string>,
): readonly SentinelEnvironmentBinding[] {
  return Object.entries(environment)
    .sort(([left], [right]) => compareCodeUnits(left, right))
    .map(([name, value]) => ({
      name,
      valueSha256: sha256(value),
      classification: opaqueKeys.has(name)
        ? name.endsWith("_TOKEN") ? "opaque-token" as const : "opaque-origin" as const
        : fixedKeys.has(name) ? "fixed-runtime" as const : "safe-runtime" as const,
    }));
}

function safeBaseEnvironment(
  host: Readonly<Record<string, string | undefined>>,
): Record<string, string> {
  const environment: Record<string, string> = {};
  for (const key of SAFE_ENVIRONMENT_KEYS) {
    const value = host[key];
    if (typeof value === "string" && value.length > 0 && !value.includes("\0")) {
      environment[key] = value;
    }
  }
  if (environment.PATH === undefined) throw new Error("sanitized child environment requires PATH");
  return environment;
}

async function prepareAttempt(
  input: SentinelAttemptSupervisorInput,
  dependencies: SentinelAttemptSupervisorDependencies,
): Promise<PreparedAttempt> {
  if (!isRecord(input) || input.schemaVersion !== "pm.public-eval-corners.sentinel-attempt-input.v1") {
    throw new Error("unsupported Sentinel attempt input schemaVersion");
  }
  if (!ATTEMPT_ID.test(input.attemptId)) throw new Error("attemptId must be a portable unique identifier");
  assertNoTreatmentDisclosure(input.attemptId, "attemptId");
  if (!Object.hasOwn(SCENARIO_PINS, input.taskId)) throw new Error("unsupported exact Sentinel taskId");
  const checkoutPath = realpathSync(resolve(input.checkoutPath));
  if (!statSync(checkoutPath).isDirectory()) throw new Error("checkoutPath must be a directory");
  const outputRoot = resolve(input.outputRoot);
  const attemptRegistryRoot = resolve(input.attemptRegistryRoot);
  if (
    isWithin(checkoutPath, outputRoot) ||
    isWithin(outputRoot, checkoutPath) ||
    isWithin(attemptRegistryRoot, outputRoot) ||
    isWithin(outputRoot, attemptRegistryRoot)
  ) {
    throw new Error("checkout, outputRoot, and attemptRegistryRoot must be disjoint");
  }
  if (existsSync(outputRoot)) throw new Error("outputRoot must not already exist");
  const checkoutBefore = verifyCheckout(checkoutPath, dependencies);
  if (!checkoutBefore.valid) throw new Error(`Sentinel checkout verification failed: ${checkoutBefore.issues.join("; ")}`);
  const scenario = dependencies.verifyScenario(checkoutPath, input.taskId);
  const serverPort = requiredPort(input.serverPort, "serverPort");
  const frontendPort = requiredPort(input.frontendPort, "frontendPort");
  const stateOrigin = loopbackOrigin(input.opaqueEnvironment.stateOrigin, "stateOrigin");
  const providerOrigin = loopbackOrigin(input.opaqueEnvironment.providerOrigin, "providerOrigin");
  const allPorts = [serverPort, frontendPort, stateOrigin.port, providerOrigin.port];
  if (new Set(allPorts).size !== allPorts.length) {
    throw new Error("server, frontend, state, and provider loopback ports must be unique");
  }
  await dependencies.assertPortsAvailable([serverPort, frontendPort]);
  const serverUrl = `http://127.0.0.1:${serverPort}`;
  const frontendUrl = `http://127.0.0.1:${frontendPort}`;
  const agentConfig = verifyAgentConfig(input.agentConfig, serverUrl, frontendUrl);
  if (isWithin(checkoutPath, agentConfig.path)) {
    throw new Error("agentConfig must remain external to the pinned checkout");
  }
  const pythonExecutable = exactFile(input.pythonExecutable, "pythonExecutable", true);
  const frontendExecutable = exactFile(input.frontendExecutable, "frontendExecutable", true);
  if (!/^python(?:3(?:\.\d+)?)?$/u.test(basename(realpathSync(pythonExecutable.path)))) {
    throw new Error("pythonExecutable must resolve to a Python executable name");
  }
  if (!/^(?:npm|npm-cli\.js)$/u.test(basename(realpathSync(frontendExecutable.path)))) {
    throw new Error("frontendExecutable must resolve to npm");
  }
  const stateToken = requiredOpaqueToken(input.opaqueEnvironment.stateToken, "stateToken");
  const providerToken = requiredOpaqueToken(input.opaqueEnvironment.providerToken, "providerToken");
  const pollIntervalMs = boundedInteger(input.pollIntervalMs, 100, 60_000, "pollIntervalMs");
  const viewportWidth = boundedInteger(input.viewportWidth, 320, 7_680, "viewportWidth");
  const viewportHeight = boundedInteger(input.viewportHeight, 240, 4_320, "viewportHeight");
  const hostEnvironment = dependencies.hostEnvironment();
  const baseEnvironment = safeBaseEnvironment(hostEnvironment);
  const fixedPythonEnvironment = {
    PYTHONPATH: checkoutPath,
    PYTHONPYCACHEPREFIX: resolve(outputRoot, "pycache"),
  } as const;
  const serverEnvironment = { ...baseEnvironment, ...fixedPythonEnvironment };
  const frontendEnvironment = {
    ...baseEnvironment,
    SENTINEL_API_BASE: serverUrl,
  };
  const harnessEnvironment = {
    ...baseEnvironment,
    ...fixedPythonEnvironment,
    [OPAQUE_ENVIRONMENT_NAMES.stateOrigin]: stateOrigin.origin,
    [OPAQUE_ENVIRONMENT_NAMES.stateToken]: stateToken,
    [OPAQUE_ENVIRONMENT_NAMES.providerOrigin]: providerOrigin.origin,
    [OPAQUE_ENVIRONMENT_NAMES.providerToken]: providerToken,
    PM_SENTINEL_ATTEMPT_ID: input.attemptId,
    PM_SENTINEL_AGENT_OUTPUT_ROOT: resolve(outputRoot, "runtime", "agent"),
    PM_SENTINEL_POLL_INTERVAL_MS: String(pollIntervalMs),
    PM_SENTINEL_VIEWPORT_WIDTH: String(viewportWidth),
    PM_SENTINEL_VIEWPORT_HEIGHT: String(viewportHeight),
  };
  if (existsSync(harnessEnvironment.PM_SENTINEL_AGENT_OUTPUT_ROOT)) {
    throw new Error("PM_SENTINEL_AGENT_OUTPUT_ROOT must not already exist");
  }
  const runtimeRoot = resolve(outputRoot, "runtime");
  const commands = [
    commandPlan(
      "server",
      pythonExecutable,
      ["-m", "uvicorn", "server.server:app", "--host", "127.0.0.1", "--port", String(serverPort)],
      runtimeRoot,
    ),
    commandPlan(
      "frontend",
      frontendExecutable,
      ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(frontendPort), "--strictPort"],
      resolve(checkoutPath, "frontend"),
    ),
    commandPlan(
      "harness",
      pythonExecutable,
      [
        "-m",
        "server.eval_harness",
        "run",
        input.attemptId,
        "--config",
        agentConfig.path,
        "--server-url",
        serverUrl,
        "--frontend-url",
        frontendUrl,
        "--speed-factor",
        "1",
        "--task",
        input.taskId,
      ],
      runtimeRoot,
    ),
  ] as const;
  const requestedCollateral = input.collateralRelativePaths ?? [];
  const collateralRelativePaths = [
    SCENARIO_PINS[input.taskId].relativePath,
    "server/shared.db",
    "server/microhub/microhub.db",
    ...requestedCollateral.map((path, index) => canonicalRelativePath(path, `collateralRelativePaths[${index}]`)),
  ].filter((path, index, all) => all.indexOf(path) === index).sort(compareCodeUnits);
  const collateralInitial = snapshotFiles(checkoutPath, collateralRelativePaths);
  if (collateralInitial.some(({ sha256: hash }) => hash === null)) {
    throw new Error("required Sentinel runtime collateral is missing");
  }
  const startupMs = boundedTimeout(input.startupTimeoutMs, 60_000, "startupTimeoutMs");
  if (input.attemptTimeoutMs !== undefined && input.attemptTimeoutMs !== 720_000) {
    throw new Error("attemptTimeoutMs must remain pinned to 720000 for speed factor 1");
  }
  const attemptMs = 720_000;
  const shutdownGraceMs = boundedTimeout(input.shutdownGraceMs, 5_000, "shutdownGraceMs");
  const opaqueKeys = new Set(Object.values(OPAQUE_ENVIRONMENT_NAMES));
  const planBody = {
    schemaVersion: "pm.public-eval-corners.sentinel-attempt-plan.v1" as const,
    evidenceEligible: false as const,
    attemptId: input.attemptId,
    taskId: input.taskId,
    checkoutPath,
    outputRoot,
    scenario,
    agentConfig,
    speedFactor: 1 as const,
    serverUrl,
    frontendUrl,
    commands,
    environmentBindings: {
      server: environmentBindings(serverEnvironment, opaqueKeys, new Set(Object.keys(fixedPythonEnvironment))),
      frontend: environmentBindings(frontendEnvironment, opaqueKeys, new Set(["SENTINEL_API_BASE"])),
      harness: environmentBindings(
        harnessEnvironment,
        opaqueKeys,
        new Set([
          ...Object.keys(fixedPythonEnvironment),
          "PM_SENTINEL_ATTEMPT_ID",
          "PM_SENTINEL_AGENT_OUTPUT_ROOT",
          "PM_SENTINEL_POLL_INTERVAL_MS",
          "PM_SENTINEL_VIEWPORT_WIDTH",
          "PM_SENTINEL_VIEWPORT_HEIGHT",
        ]),
      ),
    },
    collateralInitial,
    collateralInitialRootSha256: sha256Json(collateralInitial),
    checkoutBefore,
    timeouts: { startupMs, attemptMs, shutdownGraceMs },
  };
  return {
    plan: { ...planBody, planHash: sha256Json(planBody) },
    environment: {
      server: serverEnvironment,
      frontend: frontendEnvironment,
      harness: harnessEnvironment,
    },
    collateralRelativePaths,
  };
}

function writeImmutableJson(
  directory: string,
  prefix: string,
  body: JsonRecord,
): { readonly path: string; readonly receiptHash: string } {
  const receiptHash = sha256Json(body);
  const value = { ...body, receiptHash };
  const path = resolve(directory, `${prefix}-${receiptHash}.json`);
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx", mode: 0o400 });
  chmodSync(path, 0o400);
  return { path, receiptHash };
}

function reserveAttempt(prepared: PreparedAttempt, registryRoot: string, now: string): void {
  mkdirSync(registryRoot, { recursive: true, mode: 0o700 });
  const claimBody = {
    schemaVersion: "pm.public-eval-corners.sentinel-attempt-claim.v1",
    attemptId: prepared.plan.attemptId,
    planHash: prepared.plan.planHash,
    outputRoot: prepared.plan.outputRoot,
    claimedAt: now,
  };
  const claimHash = sha256Json(claimBody);
  const claimPath = resolve(registryRoot, `sentinel-attempt-${sha256(prepared.plan.attemptId)}.claim.json`);
  try {
    writeFileSync(claimPath, `${JSON.stringify({ ...claimBody, claimHash }, null, 2)}\n`, {
      flag: "wx",
      mode: 0o400,
    });
    chmodSync(claimPath, 0o400);
  } catch {
    throw new Error(`attemptId ${prepared.plan.attemptId} has already been claimed`);
  }
  mkdirSync(prepared.plan.outputRoot, { recursive: false, mode: 0o700 });
  mkdirSync(resolve(prepared.plan.outputRoot, "logs"), { mode: 0o700 });
  mkdirSync(resolve(prepared.plan.outputRoot, "receipts"), { mode: 0o700 });
  mkdirSync(resolve(prepared.plan.outputRoot, "runtime"), { mode: 0o700 });
}

function artifactIdentity(path: string, root: string): SentinelArtifactIdentity {
  const bytes = readFileSync(path);
  return { path: relative(root, path), byteLength: bytes.byteLength, sha256: sha256(bytes) };
}

function inventoryDirectory(root: string, base = root): readonly SentinelArtifactIdentity[] {
  if (!existsSync(root)) return [];
  const output: SentinelArtifactIdentity[] = [];
  for (const name of readdirSync(root).sort(compareCodeUnits)) {
    const path = resolve(root, name);
    const stat = lstatSync(path);
    if (stat.isSymbolicLink()) throw new Error("Sentinel result artifacts may not contain symbolic links");
    if (stat.isDirectory()) output.push(...inventoryDirectory(path, base));
    else if (stat.isFile()) output.push(artifactIdentity(path, base));
    else throw new Error("Sentinel result artifacts must be files or directories");
    if (output.length > 10_000) throw new Error("Sentinel result inventory exceeds file ceiling");
  }
  return output;
}

function immutableArtifactTree(root: string): void {
  if (!existsSync(root)) return;
  for (const name of readdirSync(root)) {
    const path = resolve(root, name);
    const stat = lstatSync(path);
    if (stat.isDirectory()) immutableArtifactTree(path);
    else if (stat.isFile()) chmodSync(path, 0o400);
  }
  chmodSync(root, 0o500);
}

function spawnFromPlan(
  command: SentinelCommandPlan,
  environment: Readonly<Record<string, string>>,
  outputRoot: string,
  dependencies: SentinelAttemptSupervisorDependencies,
): SentinelProcessHandle {
  const stdoutPath = resolve(outputRoot, "logs", `${command.role}.stdout.log`);
  const stderrPath = resolve(outputRoot, "logs", `${command.role}.stderr.log`);
  writeFileSync(stdoutPath, "", { flag: "wx", mode: 0o600 });
  writeFileSync(stderrPath, "", { flag: "wx", mode: 0o600 });
  return dependencies.spawnProcess({
    role: command.role,
    executable: command.executable.path,
    arguments: command.arguments,
    cwd: command.cwd,
    environment,
    stdoutPath,
    stderrPath,
  });
}

async function awaitReadiness(
  handle: SentinelProcessHandle,
  url: string,
  timeoutMs: number,
  dependencies: SentinelAttemptSupervisorDependencies,
): Promise<void> {
  await Promise.race([
    dependencies.waitForHttpReady(url, timeoutMs),
    handle.completion.then((exit) => {
      throw new Error(`${handle.role} exited before readiness: ${canonical(exit)}`);
    }),
  ]);
}

function terminalProcessRecord(
  handle: SentinelProcessHandle,
  command: SentinelCommandPlan,
  timedOut: boolean,
  termination: SentinelTreeTermination,
  outputRoot: string,
): SentinelProcessTerminalRecord {
  const stdoutPath = resolve(outputRoot, "logs", `${handle.role}.stdout.log`);
  const stderrPath = resolve(outputRoot, "logs", `${handle.role}.stderr.log`);
  return {
    role: handle.role,
    pid: handle.pid,
    commandIdentitySha256: command.identitySha256,
    timedOut,
    exit: termination.exit,
    treeTermination: termination,
    stdout: artifactIdentity(stdoutPath, outputRoot),
    stderr: artifactIdentity(stderrPath, outputRoot),
  };
}

export async function superviseSentinelAttempt(
  input: SentinelAttemptSupervisorInput,
  dependencies: SentinelAttemptSupervisorDependencies = createSentinelAttemptSupervisorDependencies(),
): Promise<SentinelAttemptTerminalReceipt> {
  const prepared = await prepareAttempt(input, dependencies);
  reserveAttempt(prepared, resolve(input.attemptRegistryRoot), dependencies.now());
  const receiptRoot = resolve(prepared.plan.outputRoot, "receipts");
  const startBody = {
    schemaVersion: "pm.public-eval-corners.sentinel-attempt-start.v1",
    evidenceEligible: false,
    startedAt: dependencies.now(),
    plan: prepared.plan,
  };
  const start = writeImmutableJson(receiptRoot, "sentinel-attempt-start", startBody);
  const handles: SentinelProcessHandle[] = [];
  const commandByRole = new Map(prepared.plan.commands.map((command) => [command.role, command] as const));
  const timedOutByRole = new Map<SentinelProcessRole, boolean>();
  let status: SentinelAttemptTerminalReceipt["status"] = "failed";
  let failureStage: string | null = "startup";
  let failureMessage: string | null = null;
  let checkoutAfter = prepared.plan.checkoutBefore;
  let collateral = collateralComparison(prepared.plan.collateralInitial, prepared.plan.collateralInitial);
  let resultArtifacts: readonly SentinelArtifactIdentity[] = [];
  let resultJsonPath: string | null = null;
  let resultJsonSha256: string | null = null;
  const processRecords: SentinelProcessTerminalRecord[] = [];
  try {
    const serverCommand = commandByRole.get("server");
    const frontendCommand = commandByRole.get("frontend");
    const harnessCommand = commandByRole.get("harness");
    if (!serverCommand || !frontendCommand || !harnessCommand) throw new Error("attempt plan lacks required commands");
    failureStage = "server-start";
    const server = spawnFromPlan(serverCommand, prepared.environment.server, prepared.plan.outputRoot, dependencies);
    handles.push(server);
    failureStage = "frontend-start";
    const frontend = spawnFromPlan(frontendCommand, prepared.environment.frontend, prepared.plan.outputRoot, dependencies);
    handles.push(frontend);
    failureStage = "readiness";
    await Promise.all([
      awaitReadiness(server, `${prepared.plan.serverUrl}/status`, prepared.plan.timeouts.startupMs, dependencies),
      awaitReadiness(frontend, `${prepared.plan.frontendUrl}/`, prepared.plan.timeouts.startupMs, dependencies),
    ]);
    failureStage = "harness-start";
    const harness = spawnFromPlan(harnessCommand, prepared.environment.harness, prepared.plan.outputRoot, dependencies);
    handles.push(harness);
    failureStage = "harness-execution";
    const waited = await dependencies.waitForExit(harness, prepared.plan.timeouts.attemptMs);
    timedOutByRole.set("harness", waited.timedOut);
    if (waited.timedOut) {
      status = "timed-out";
      throw new Error("Sentinel harness exceeded the preregistered attempt timeout");
    }
    if (!waited.exit || waited.exit.exitCode !== 0 || waited.exit.signal !== null || waited.exit.spawnError !== null) {
      throw new Error(`Sentinel harness failed: ${canonical(waited.exit)}`);
    }
    failureStage = "result-capture";
    const taskResultRoot = resolve(
      prepared.plan.outputRoot,
      "runtime",
      "results",
      prepared.plan.attemptId,
    );
    resultArtifacts = inventoryDirectory(taskResultRoot);
    const expectedPrefix = `microhub/${prepared.plan.taskId}/`;
    if (
      resultArtifacts.length === 0 ||
      resultArtifacts.some(({ path }) => !path.startsWith(expectedPrefix))
    ) {
      throw new Error("harness result inventory is empty or contains a non-selected task");
    }
    const expectedResultPath = `${expectedPrefix}results.json`;
    const expectedErrorPath = `${expectedPrefix}error.txt`;
    const result = resultArtifacts.find(({ path }) => path === expectedResultPath);
    if (!result || resultArtifacts.some(({ path }) => path === expectedErrorPath)) {
      throw new Error("exact Sentinel task did not produce a clean results.json");
    }
    const absoluteResultPath = resolve(taskResultRoot, expectedResultPath);
    const parsedResult = JSON.parse(readFileSync(absoluteResultPath, "utf8")) as unknown;
    if (!isRecord(parsedResult)) throw new Error("Sentinel results.json must contain an object");
    resultJsonPath = relative(prepared.plan.outputRoot, absoluteResultPath);
    resultJsonSha256 = result.sha256;
    status = "succeeded";
    failureStage = null;
  } catch (error) {
    failureMessage = error instanceof Error ? error.message : String(error);
    if (status !== "timed-out") status = "failed";
  } finally {
    for (const handle of [...handles].reverse()) {
      const command = commandByRole.get(handle.role);
      if (!command) continue;
      let termination: SentinelTreeTermination;
      try {
        termination = await handle.terminateTree(prepared.plan.timeouts.shutdownGraceMs);
      } catch (error) {
        termination = {
          signalsSent: [],
          observedPids: [handle.pid],
          remainingPids: [handle.pid],
          reaped: false,
          exit: {
            exitCode: null,
            signal: null,
            spawnError: error instanceof Error ? error.message : String(error),
          },
        };
      }
      processRecords.push(
        terminalProcessRecord(
          handle,
          command,
          timedOutByRole.get(handle.role) ?? false,
          termination,
          prepared.plan.outputRoot,
        ),
      );
      if (!termination.reaped && status === "succeeded") {
        status = "failed";
        failureStage = "process-reap";
        failureMessage = `${handle.role} process tree was not fully reaped`;
      }
    }
    const finalCollateral = snapshotFiles(
      prepared.plan.checkoutPath,
      prepared.collateralRelativePaths,
    );
    collateral = collateralComparison(prepared.plan.collateralInitial, finalCollateral);
    checkoutAfter = verifyCheckout(prepared.plan.checkoutPath, dependencies);
    if ((collateral.mutationDetected || !checkoutAfter.valid) && status === "succeeded") {
      status = "failed";
      failureStage = "collateral-integrity";
      failureMessage = collateral.mutationDetected
        ? `runtime collateral changed: ${collateral.changedPaths.join(", ")}`
        : `checkout changed: ${checkoutAfter.issues.join("; ")}`;
    }
  }
  const finalResultRoot = resolve(
    prepared.plan.outputRoot,
    "runtime",
    "results",
    prepared.plan.attemptId,
  );
  try {
    resultArtifacts = inventoryDirectory(finalResultRoot);
    immutableArtifactTree(finalResultRoot);
    for (const record of processRecords) {
      chmodSync(resolve(prepared.plan.outputRoot, record.stdout.path), 0o400);
      chmodSync(resolve(prepared.plan.outputRoot, record.stderr.path), 0o400);
    }
  } catch (error) {
    if (status === "succeeded") status = "failed";
    failureStage = failureStage ?? "artifact-seal";
    failureMessage = failureMessage ?? (error instanceof Error ? error.message : String(error));
  }
  const terminalBody = {
    schemaVersion: "pm.public-eval-corners.sentinel-attempt-terminal.v1" as const,
    evidenceEligible: false as const,
    attemptId: prepared.plan.attemptId,
    taskId: prepared.plan.taskId,
    status,
    failureStage,
    failureMessage,
    startReceiptHash: start.receiptHash,
    checkoutBefore: prepared.plan.checkoutBefore,
    checkoutAfter,
    collateral,
    processes: processRecords.sort((left, right) => compareCodeUnits(left.role, right.role)),
    resultArtifacts,
    resultJsonPath,
    resultJsonSha256,
  };
  const terminal = writeImmutableJson(receiptRoot, "sentinel-attempt-terminal", terminalBody);
  return { ...terminalBody, receiptHash: terminal.receiptHash };
}

function defaultGit(checkoutPath: string, arguments_: readonly string[]): string {
  return execFileSync("git", ["-C", checkoutPath, ...arguments_], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 30_000,
  });
}

async function defaultAssertPortsAvailable(ports: readonly number[]): Promise<void> {
  for (const port of ports) {
    await new Promise<void>((resolvePromise, reject) => {
      const server = createServer();
      server.once("error", () => reject(new Error(`loopback port ${port} is already in use`)));
      server.listen(port, "127.0.0.1", () => {
        server.close((error) => error ? reject(error) : resolvePromise());
      });
    });
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

async function defaultWaitForHttpReady(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastIssue = "no response";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(Math.min(2_000, timeoutMs)) });
      if (response.ok) return;
      lastIssue = `HTTP ${response.status}`;
    } catch (error) {
      lastIssue = error instanceof Error ? error.message : String(error);
    }
    await delay(100);
  }
  throw new Error(`readiness timeout for ${url}: ${lastIssue}`);
}

function processTable(): readonly { readonly pid: number; readonly ppid: number; readonly pgid: number }[] {
  try {
    const output = execFileSync("ps", ["-axo", "pid=,ppid=,pgid="], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 5_000,
    });
    return output.split("\n").flatMap((line) => {
      const parts = line.trim().split(/\s+/u).map(Number);
      const [pid, ppid, pgid] = parts;
      return Number.isSafeInteger(pid) && Number.isSafeInteger(ppid) && Number.isSafeInteger(pgid)
        ? [{ pid: pid!, ppid: ppid!, pgid: pgid! }]
        : [];
    });
  } catch {
    return [];
  }
}

function descendants(
  rootPid: number,
  rows: readonly { readonly pid: number; readonly ppid: number; readonly pgid: number }[],
): readonly { readonly pid: number; readonly pgid: number }[] {
  const selected = new Set([rootPid]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const row of rows) {
      if (selected.has(row.ppid) && !selected.has(row.pid)) {
        selected.add(row.pid);
        changed = true;
      }
    }
  }
  return rows.filter(({ pid }) => selected.has(pid)).map(({ pid, pgid }) => ({ pid, pgid }));
}

function pidAlive(pid: number): boolean {
  if (pid <= 1) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function defaultSpawnProcess(spec: SentinelSpawnSpec): SentinelProcessHandle {
  mkdirSync(dirname(spec.stdoutPath), { recursive: true, mode: 0o700 });
  const stdout = createWriteStream(spec.stdoutPath, { flags: "a", mode: 0o600 });
  const stderr = createWriteStream(spec.stderrPath, { flags: "a", mode: 0o600 });
  const child = spawn(spec.executable, [...spec.arguments], {
    cwd: spec.cwd,
    env: { ...spec.environment },
    detached: true,
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout?.pipe(stdout);
  child.stderr?.pipe(stderr);
  const pid = child.pid ?? -1;
  const knownPids = new Set<number>(pid > 1 ? [pid] : []);
  const knownGroups = new Set<number>(pid > 1 ? [pid] : []);
  const refresh = (): void => {
    if (pid <= 1) return;
    for (const entry of descendants(pid, processTable())) {
      knownPids.add(entry.pid);
      if (entry.pgid > 1) knownGroups.add(entry.pgid);
    }
  };
  const interval = setInterval(refresh, 100);
  interval.unref();
  const completion = new Promise<SentinelProcessExit>((resolvePromise) => {
    let spawnError: string | null = null;
    child.once("error", (error) => {
      spawnError = error.message;
    });
    child.once("close", async (exitCode, signal) => {
      clearInterval(interval);
      await Promise.allSettled([finished(stdout), finished(stderr)]);
      resolvePromise({ exitCode, signal, spawnError });
    });
  });
  const terminateTree = async (graceMs: number): Promise<SentinelTreeTermination> => {
    refresh();
    const signalsSent: string[] = [];
    const signalAll = (signal: NodeJS.Signals): void => {
      for (const pgid of [...knownGroups].sort((left, right) => right - left)) {
        if (pgid <= 1 || pgid === process.pid) continue;
        try {
          process.kill(-pgid, signal);
          signalsSent.push(`${signal}:pgid:${pgid}`);
        } catch {
          // Already exited is the desired state.
        }
      }
      for (const childPid of knownPids) {
        try {
          process.kill(childPid, signal);
          signalsSent.push(`${signal}:pid:${childPid}`);
        } catch {
          // Already exited is the desired state.
        }
      }
    };
    signalAll("SIGTERM");
    const deadline = Date.now() + graceMs;
    while (Date.now() < deadline && [...knownPids].some(pidAlive)) {
      await delay(25);
      refresh();
    }
    if ([...knownPids].some(pidAlive)) {
      signalAll("SIGKILL");
      const killDeadline = Date.now() + Math.max(250, graceMs);
      while (Date.now() < killDeadline && [...knownPids].some(pidAlive)) await delay(25);
    }
    const exit = await Promise.race([
      completion,
      delay(Math.max(250, graceMs)).then((): SentinelProcessExit => ({
        exitCode: null,
        signal: null,
        spawnError: "process leader was not reaped before shutdown deadline",
      })),
    ]);
    const observedPids = [...knownPids].sort((left, right) => left - right);
    const remainingPids = observedPids.filter(pidAlive);
    return { signalsSent, observedPids, remainingPids, reaped: remainingPids.length === 0, exit };
  };
  return { role: spec.role, pid, completion, terminateTree };
}

async function defaultWaitForExit(
  handle: SentinelProcessHandle,
  timeoutMs: number,
): Promise<{ readonly timedOut: boolean; readonly exit: SentinelProcessExit | null }> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<null>((resolvePromise) => {
    timeout = setTimeout(() => resolvePromise(null), timeoutMs);
  });
  const exit = await Promise.race([handle.completion, timeoutPromise]);
  if (timeout !== undefined) clearTimeout(timeout);
  return exit === null ? { timedOut: true, exit: null } : { timedOut: false, exit };
}

export function createSentinelAttemptSupervisorDependencies(): SentinelAttemptSupervisorDependencies {
  return {
    git: defaultGit,
    hostEnvironment: () => process.env,
    verifyScenario: defaultVerifyScenario,
    assertPortsAvailable: defaultAssertPortsAvailable,
    waitForHttpReady: defaultWaitForHttpReady,
    spawnProcess: defaultSpawnProcess,
    waitForExit: defaultWaitForExit,
    now: () => new Date().toISOString(),
  };
}
