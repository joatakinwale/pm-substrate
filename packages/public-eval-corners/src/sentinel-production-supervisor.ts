import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  closeSync,
  createWriteStream,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:net";
import { basename, dirname, isAbsolute, relative, resolve } from "node:path";
import { finished } from "node:stream/promises";

export type SentinelFrozenPhaseTaskId =
  | "microhub-stars-relative-passive"
  | "microhub-stars-absolute-passive"
  | "microhub-stars-noop"
  | "microhood-buy-dip-relative-active"
  | "microhood-orders-absolute-active"
  | "microhood-orders-noop"
  | "micromail-junk-relative-passive"
  | "micromail-unread-absolute-passive"
  | "micromail-sender-absolute-noop"
  | "microscholar-papercount-relative-passive"
  | "microscholar-search-absolute-passive"
  | "microscholar-search-noop"
  | "microtube-views-relative-active"
  | "microtube-video-absolute-active"
  | "microtube-notifications-noop";

/** A hash-bound non-dev scenario ID discovered in the pinned checkout. */
export type SentinelProductionTaskId = string;

export type SentinelProductionEnvironment =
  | "microchat"
  | "microdin"
  | "microfy"
  | "microgram"
  | "microhub"
  | "microhood"
  | "microlendar"
  | "micromail"
  | "microscholar"
  | "microtube";

export type SentinelProductionProcessRole = "server" | "frontend" | "harness";

export interface SentinelProductionExecutableIdentity {
  readonly path: string;
  readonly sha256: string;
}

export interface SentinelProductionTaskRegistration {
  readonly schemaVersion: "pm.public-eval-corners.sentinel-production-task-registration.v1";
  readonly taskId: SentinelProductionTaskId;
  readonly environment: SentinelProductionEnvironment;
  readonly scenarioRelativePath: string;
  readonly scenarioSha256: string;
  readonly repositoryUrl: "https://github.com/microsoft/sentinel_environments";
  readonly revision: "0faca33cc58ea62e97a928b67cd3beec7176b408";
}

export interface SentinelProductionOpaqueEnvironment {
  readonly stateOrigin: string;
  readonly stateToken: string;
  readonly providerOrigin: string;
  readonly providerToken: string;
}

export interface SentinelProductionSupervisorInput {
  readonly schemaVersion: "pm.public-eval-corners.sentinel-production-attempt-input.v1";
  readonly attemptId: string;
  readonly task: SentinelProductionTaskRegistration;
  readonly checkoutPath: string;
  readonly outputRoot: string;
  readonly attemptRegistryRoot: string;
  readonly agentConfig: SentinelProductionExecutableIdentity;
  readonly agentRuntimeExecutable: SentinelProductionExecutableIdentity;
  readonly agentScript: SentinelProductionExecutableIdentity;
  readonly pythonExecutable: SentinelProductionExecutableIdentity;
  readonly frontendExecutable: SentinelProductionExecutableIdentity;
  readonly serverPort: number;
  readonly frontendPort: number;
  readonly opaqueEnvironment: SentinelProductionOpaqueEnvironment;
  readonly pollIntervalMs: number;
  readonly activeSettleMs: number;
  readonly maxDecisions: number;
  readonly maxConsecutiveActiveActions: number;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly speedFactor?: number;
  readonly killHorizonMs?: number;
  readonly startupTimeoutMs?: number;
  readonly attemptTimeoutMs?: number;
  readonly shutdownGraceMs?: number;
}

export interface SentinelProductionSpawnSpec {
  readonly role: SentinelProductionProcessRole;
  readonly executable: string;
  readonly arguments: readonly string[];
  readonly cwd: string;
  readonly environment: Readonly<Record<string, string>>;
  readonly environmentSha256: string;
  readonly stdoutPath: string;
  readonly stderrPath: string;
}

export interface SentinelProductionProcessExit {
  readonly exitCode: number | null;
  readonly signal: string | null;
  readonly spawnError: string | null;
}

export interface SentinelProductionTreeTermination {
  readonly signalsSent: readonly string[];
  readonly observedPids: readonly number[];
  readonly remainingPids: readonly number[];
  readonly reaped: boolean;
  readonly exit: SentinelProductionProcessExit;
}

export interface SentinelProductionProcessHandle {
  readonly role: SentinelProductionProcessRole;
  readonly pid: number;
  readonly ppid: number;
  readonly completion: Promise<SentinelProductionProcessExit>;
  readonly terminateTree: (graceMs: number) => Promise<SentinelProductionTreeTermination>;
}

export interface SentinelProductionSupervisorDependencies {
  readonly git: (checkoutPath: string, arguments_: readonly string[]) => string;
  readonly hostEnvironment: () => Readonly<Record<string, string | undefined>>;
  readonly verifyScenario: (
    checkoutPath: string,
    registration: SentinelProductionTaskRegistration,
  ) => SentinelProductionExecutableIdentity;
  readonly assertPortsAvailable: (ports: readonly number[]) => Promise<void>;
  readonly waitForHttpReady: (url: string, timeoutMs: number) => Promise<void>;
  readonly spawnProcess: (spec: SentinelProductionSpawnSpec) => SentinelProductionProcessHandle;
  readonly waitForExit: (
    handle: SentinelProductionProcessHandle,
    timeoutMs: number,
  ) => Promise<{
    readonly timedOut: boolean;
    readonly exit: SentinelProductionProcessExit | null;
  }>;
  readonly now: () => string;
}

export interface SentinelProductionFileSnapshot {
  readonly relativePath: string;
  readonly byteLength: number | null;
  readonly sha256: string | null;
}

export interface SentinelProductionCollateralComparison {
  readonly initialRootSha256: string;
  readonly finalRootSha256: string;
  readonly mutationDetected: boolean;
  readonly initial: readonly SentinelProductionFileSnapshot[];
  readonly final: readonly SentinelProductionFileSnapshot[];
  readonly changedPaths: readonly string[];
}

export interface SentinelProductionCheckoutVerification {
  readonly expectedRepositoryUrl: string;
  readonly actualRepositoryUrl: string | null;
  readonly expectedRevision: string;
  readonly actualRevision: string | null;
  readonly clean: boolean;
  readonly valid: boolean;
  readonly issues: readonly string[];
}

export interface SentinelProductionArtifactIdentity {
  readonly path: string;
  readonly byteLength: number;
  readonly sha256: string;
}

export interface SentinelProductionCommandPlan {
  readonly role: SentinelProductionProcessRole;
  readonly executable: SentinelProductionExecutableIdentity;
  readonly arguments: readonly string[];
  readonly cwd: string;
  readonly environmentSha256: string;
  readonly identitySha256: string;
}

export interface SentinelProductionEnvironmentBinding {
  readonly name: string;
  readonly valueSha256: string;
  readonly classification: "safe-runtime" | "fixed-runtime" | "opaque-origin" | "opaque-token";
}

export interface SentinelProductionProcessTerminalRecord {
  readonly role: SentinelProductionProcessRole;
  readonly pid: number;
  readonly ppid: number;
  readonly commandIdentitySha256: string;
  readonly environmentSha256: string;
  readonly timedOut: boolean;
  readonly exit: SentinelProductionProcessExit;
  readonly treeTermination: SentinelProductionTreeTermination;
  readonly stdout: SentinelProductionArtifactIdentity;
  readonly stderr: SentinelProductionArtifactIdentity;
}

export interface SentinelProductionAgentProcessEvidence {
  readonly pid: number;
  readonly ppid: number;
  readonly startedAt: string;
  readonly startArtifact: SentinelProductionArtifactIdentity;
  /** Null when the unchanged harness kills a still-monitoring agent at the horizon. */
  readonly terminalArtifact: SentinelProductionArtifactIdentity | null;
}

export interface SentinelProductionAttemptPlan {
  readonly schemaVersion: "pm.public-eval-corners.sentinel-production-attempt-plan.v1";
  readonly evidenceEligible: false;
  readonly attemptId: string;
  readonly task: SentinelProductionTaskRegistration;
  readonly checkoutPath: string;
  readonly outputRoot: string;
  readonly scenario: SentinelProductionExecutableIdentity;
  readonly agentConfig: SentinelProductionExecutableIdentity;
  readonly agentRuntimeExecutable: SentinelProductionExecutableIdentity;
  readonly agentScript: SentinelProductionExecutableIdentity;
  readonly speedFactor: 1;
  readonly killHorizonMs: 630000;
  readonly serverUrl: string;
  readonly frontendUrl: string;
  readonly commands: readonly SentinelProductionCommandPlan[];
  readonly environmentBindings: Readonly<
    Record<SentinelProductionProcessRole, readonly SentinelProductionEnvironmentBinding[]>
  >;
  readonly collateralInitial: readonly SentinelProductionFileSnapshot[];
  readonly collateralInitialRootSha256: string;
  readonly checkoutBefore: SentinelProductionCheckoutVerification;
  readonly timeouts: {
    readonly startupMs: 60000;
    readonly attemptMs: 720000;
    readonly shutdownGraceMs: 5000;
  };
  readonly planHash: string;
}

export interface SentinelProductionAttemptTerminalReceipt {
  readonly schemaVersion: "pm.public-eval-corners.sentinel-production-attempt-terminal.v1";
  readonly evidenceEligible: false;
  readonly attemptId: string;
  readonly taskId: SentinelProductionTaskId;
  readonly completion: "behavioral-complete" | "infrastructure-incomplete";
  readonly infrastructureStage: string | null;
  readonly infrastructureIssue: string | null;
  readonly timedOut: boolean;
  readonly startReceiptHash: string;
  readonly checkoutBefore: SentinelProductionCheckoutVerification;
  readonly checkoutAfter: SentinelProductionCheckoutVerification;
  readonly collateral: SentinelProductionCollateralComparison;
  readonly processes: readonly SentinelProductionProcessTerminalRecord[];
  readonly agentProcess: SentinelProductionAgentProcessEvidence | null;
  readonly resultArtifacts: readonly SentinelProductionArtifactIdentity[];
  readonly rawArtifacts: readonly SentinelProductionArtifactIdentity[];
  readonly resultJsonPath: string | null;
  readonly resultJsonSha256: string | null;
  readonly receiptHash: string;
}

interface FrozenTaskPin {
  readonly environment: SentinelProductionEnvironment;
  readonly scenarioRelativePath: string;
  readonly scenarioSha256: string;
}

interface PreparedAttempt {
  readonly plan: SentinelProductionAttemptPlan;
  readonly environment: Readonly<
    Record<SentinelProductionProcessRole, Readonly<Record<string, string>>>
  >;
}

interface Reservation {
  readonly checkoutLockPath: string;
}

type JsonRecord = Record<string, unknown>;

const EXPECTED_REPOSITORY_URL = "https://github.com/microsoft/sentinel_environments";
const EXPECTED_REVISION = "0faca33cc58ea62e97a928b67cd3beec7176b408";
const SPEED_FACTOR = 1 as const;
const KILL_HORIZON_MS = 630_000 as const;
const STARTUP_TIMEOUT_MS = 60_000 as const;
const ATTEMPT_TIMEOUT_MS = 720_000 as const;
const SHUTDOWN_GRACE_MS = 5_000 as const;
const SHA256 = /^[a-f0-9]{64}$/u;
const ATTEMPT_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/u;
const TASK_ID = /^[a-z0-9][a-z0-9-]{0,159}$/u;
const ENVIRONMENTS = new Set<SentinelProductionEnvironment>([
  "microchat",
  "microdin",
  "microfy",
  "microgram",
  "microhood",
  "microhub",
  "microlendar",
  "micromail",
  "microscholar",
  "microtube",
]);
const CANONICAL_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;
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

const FROZEN_TASKS: Readonly<Record<SentinelFrozenPhaseTaskId, FrozenTaskPin>> = {
  "microhub-stars-relative-passive": {
    environment: "microhub",
    scenarioRelativePath: "scenarios/microhub/stars-relative-passive.json",
    scenarioSha256: "892c71ca6acb5f0268dd133df3990c779e5335d946c6cb5f5e051087dc4cd6da",
  },
  "microhub-stars-absolute-passive": {
    environment: "microhub",
    scenarioRelativePath: "scenarios/microhub/stars-absolute-passive.json",
    scenarioSha256: "2fe141ded7e4afc06d77db16f07ccaa0e62ccda805cb7d3c4318eed9d61fb08e",
  },
  "microhub-stars-noop": {
    environment: "microhub",
    scenarioRelativePath: "scenarios/microhub/stars-noop.json",
    scenarioSha256: "e689d9d99d97bf1cca71f96b96e72cbbd882a2848be26ba9d9d3ba78dd99649d",
  },
  "microhood-buy-dip-relative-active": {
    environment: "microhood",
    scenarioRelativePath: "scenarios/microhood/buy-dip-relative-active.json",
    scenarioSha256: "9c337fc95d2b63a0439fb4f13de20da29c41ca881569ceaf9339a6d7c79b8308",
  },
  "microhood-orders-absolute-active": {
    environment: "microhood",
    scenarioRelativePath: "scenarios/microhood/orders-absolute-active.json",
    scenarioSha256: "7a6aed951266f06ee20f872d0cfef136e4e3df3f0c993ba35b47a31d70291243",
  },
  "microhood-orders-noop": {
    environment: "microhood",
    scenarioRelativePath: "scenarios/microhood/orders-noop.json",
    scenarioSha256: "784299d53c06b69aedafa53bc4410dc9b91b19b45eb5d03fecb68d081d05ab81",
  },
  "micromail-junk-relative-passive": {
    environment: "micromail",
    scenarioRelativePath: "scenarios/micromail/junk-relative-passive.json",
    scenarioSha256: "c178a310bd8a68dc575956e2f53b2ac9da2dc01281cbb82360890cbc82240fa4",
  },
  "micromail-unread-absolute-passive": {
    environment: "micromail",
    scenarioRelativePath: "scenarios/micromail/unread-absolute-passive.json",
    scenarioSha256: "22fbd6f43a99f877557b43b5a3e1d13c9ce1582838e8283b0f49b4a4dacd9f6b",
  },
  "micromail-sender-absolute-noop": {
    environment: "micromail",
    scenarioRelativePath: "scenarios/micromail/sender-absolute-noop.json",
    scenarioSha256: "9339debfd55a22b347a8622232da16deb6c1701b28bdc3250554cddda205fb23",
  },
  "microscholar-papercount-relative-passive": {
    environment: "microscholar",
    scenarioRelativePath: "scenarios/microscholar/papercount-relative-passive.json",
    scenarioSha256: "c78eb6d3b0d0c6b4cb4e129dde99d9cebf50807f559dff5cd434fdab92c6ff2d",
  },
  "microscholar-search-absolute-passive": {
    environment: "microscholar",
    scenarioRelativePath: "scenarios/microscholar/search-absolute-passive.json",
    scenarioSha256: "acddb160065dde5a6d08c13d2a4cda3e06ceab6aa2d84fd84dec499040366e8a",
  },
  "microscholar-search-noop": {
    environment: "microscholar",
    scenarioRelativePath: "scenarios/microscholar/search-noop.json",
    scenarioSha256: "eb12e66e6ec971ffbe485cde8903568cfad61f7107f4aff259f3dba60a5a4d2c",
  },
  "microtube-views-relative-active": {
    environment: "microtube",
    scenarioRelativePath: "scenarios/microtube/views-relative-active.json",
    scenarioSha256: "77e6f181d668df4b9648708a8c301d1c8226096230765166787065dae2d9536a",
  },
  "microtube-video-absolute-active": {
    environment: "microtube",
    scenarioRelativePath: "scenarios/microtube/video-absolute-active.json",
    scenarioSha256: "07dca2cbb0b25c63115cdcb84f72e6f431131e157dacf330eebced817c16a2a1",
  },
  "microtube-notifications-noop": {
    environment: "microtube",
    scenarioRelativePath: "scenarios/microtube/notifications-noop.json",
    scenarioSha256: "3e66a470e24a1003a010e8b72e7cff059b1884f3d1bfc40d09d726cb036b4126",
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

function exactKeys(value: JsonRecord, expected: readonly string[], label: string): void {
  const actual = Object.keys(value).sort(compareCodeUnits);
  const wanted = [...expected].sort(compareCodeUnits);
  if (actual.join(",") !== wanted.join(",")) throw new Error(`${label} keys are not exact`);
}

function normalizeRemote(value: string): string {
  return value.trim().replace(/\.git$/u, "").replace(/\/+$/u, "");
}

function isWithin(root: string, target: string): boolean {
  const child = relative(resolve(root), resolve(target));
  return child === "" || (!child.startsWith("..") && !isAbsolute(child));
}

function exactFile(
  identity: SentinelProductionExecutableIdentity,
  label: string,
  allowSymbolicLink = false,
): SentinelProductionExecutableIdentity {
  if (!isRecord(identity) || typeof identity.path !== "string" || !isAbsolute(identity.path)) {
    throw new Error(`${label}.path must be absolute`);
  }
  if (typeof identity.sha256 !== "string" || !SHA256.test(identity.sha256)) {
    throw new Error(`${label}.sha256 must be lowercase SHA-256`);
  }
  const path = resolve(identity.path);
  const link = lstatSync(path);
  if ((!link.isFile() && !(allowSymbolicLink && link.isSymbolicLink())) || !statSync(path).isFile()) {
    throw new Error(`${label}.path must resolve to a regular file`);
  }
  const actual = sha256(readFileSync(path));
  if (actual !== identity.sha256) throw new Error(`${label}.sha256 does not match file bytes`);
  return { path, sha256: actual };
}

function verifyTaskRegistration(
  registration: SentinelProductionTaskRegistration,
): SentinelProductionTaskRegistration {
  if (!isRecord(registration)) throw new Error("task registration must be an object");
  exactKeys(registration, [
    "environment",
    "repositoryUrl",
    "revision",
    "scenarioRelativePath",
    "scenarioSha256",
    "schemaVersion",
    "taskId",
  ], "task registration");
  if (
    registration.schemaVersion !==
      "pm.public-eval-corners.sentinel-production-task-registration.v1" ||
    typeof registration.taskId !== "string" ||
    !TASK_ID.test(registration.taskId) ||
    typeof registration.environment !== "string" ||
    !ENVIRONMENTS.has(registration.environment as SentinelProductionEnvironment) ||
    typeof registration.scenarioRelativePath !== "string" ||
    registration.scenarioRelativePath !==
      `scenarios/${registration.environment}/${basename(registration.scenarioRelativePath)}` ||
    !/^[a-z0-9][a-z0-9-]*\.json$/u.test(basename(registration.scenarioRelativePath)) ||
    basename(registration.scenarioRelativePath) === "dev.json" ||
    typeof registration.scenarioSha256 !== "string" ||
    !SHA256.test(registration.scenarioSha256) ||
    registration.repositoryUrl !== EXPECTED_REPOSITORY_URL ||
    registration.revision !== EXPECTED_REVISION
  ) throw new Error("task registration is not a canonical pinned non-dev Sentinel scenario");
  const pin = Object.hasOwn(FROZEN_TASKS, registration.taskId)
    ? FROZEN_TASKS[registration.taskId as SentinelFrozenPhaseTaskId]
    : undefined;
  if (
    pin !== undefined &&
    (registration.environment !== pin.environment ||
      registration.scenarioRelativePath !== pin.scenarioRelativePath ||
      registration.scenarioSha256 !== pin.scenarioSha256)
  ) throw new Error("task registration does not match the frozen phase pin");
  return registration;
}

function verifyCheckout(
  checkoutPath: string,
  dependencies: Pick<SentinelProductionSupervisorDependencies, "git">,
): SentinelProductionCheckoutVerification {
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
  ) issues.push("checkout origin does not match Sentinel repository");
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

function defaultVerifyScenario(
  checkoutPath: string,
  registration: SentinelProductionTaskRegistration,
): SentinelProductionExecutableIdentity {
  const path = resolve(checkoutPath, registration.scenarioRelativePath);
  if (!isWithin(checkoutPath, path)) throw new Error("scenario escaped checkout");
  const identity = exactFile(
    { path, sha256: registration.scenarioSha256 },
    "scenario",
  );
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch {
    throw new Error("pinned Sentinel scenario is not valid JSON");
  }
  if (!isRecord(parsed)) throw new Error("pinned Sentinel scenario must be an object");
  if (
    parsed.id !== registration.taskId ||
    parsed.environment !== registration.environment ||
    parsed.event_timeline_end !== 720 ||
    typeof parsed.prompt !== "string" ||
    parsed.prompt.length === 0 ||
    !Array.isArray(parsed.events)
  ) throw new Error("pinned Sentinel scenario identity or timing does not match registration");
  if (Object.hasOwn(parsed, "speed_factor")) {
    throw new Error("pinned Sentinel scenario must not override speed_factor");
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
  ) throw new Error(`${label} must be an explicit http://127.0.0.1:<port> origin`);
  return { origin: parsed.origin, port: requiredPort(Number(parsed.port), `${label} port`) };
}

function requiredOpaqueToken(value: string, label: string): string {
  if (typeof value !== "string" || value.length < 32 || value.length > 4096 || /[\r\n\0]/u.test(value)) {
    throw new Error(`${label} must be an opaque token between 32 and 4096 bytes`);
  }
  return value;
}

function boundedInteger(value: number, minimum: number, maximum: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${label} must be a safe integer between ${minimum} and ${maximum}`);
  }
  return value;
}

function requirePinnedNumber(
  value: number | undefined,
  expected: number,
  label: string,
): number {
  if (value !== undefined && value !== expected) {
    throw new Error(`${label} must remain pinned to ${expected}`);
  }
  return expected;
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

function environmentBindings(
  environment: Readonly<Record<string, string>>,
  opaqueKeys: ReadonlySet<string>,
  fixedKeys: ReadonlySet<string>,
): readonly SentinelProductionEnvironmentBinding[] {
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

function verifyAgentConfig(
  identity: SentinelProductionExecutableIdentity,
  runtime: SentinelProductionExecutableIdentity,
  script: SentinelProductionExecutableIdentity,
  serverUrl: string,
  frontendUrl: string,
): SentinelProductionExecutableIdentity {
  const config = exactFile(identity, "agentConfig");
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(config.path, "utf8")) as unknown;
  } catch {
    throw new Error("agentConfig must be strict JSON (also valid YAML)");
  }
  if (!isRecord(parsed)) throw new Error("agentConfig must be an object");
  exactKeys(parsed, ["agent_subprocess", "frontend_url", "server_url", "speed_factor"], "agentConfig");
  if (
    parsed.server_url !== serverUrl ||
    parsed.frontend_url !== frontendUrl ||
    parsed.speed_factor !== SPEED_FACTOR
  ) throw new Error("agentConfig URLs and speed_factor must match the pinned attempt");
  const expected = [
    runtime.path,
    script.path,
    "--url",
    "__TASK_URL__",
    "--prompt",
    "__TASK_PROMPT__",
  ];
  if (!Array.isArray(parsed.agent_subprocess) || canonical(parsed.agent_subprocess) !== canonical(expected)) {
    throw new Error("agentConfig.agent_subprocess must be the exact general-agent direct argv");
  }
  return config;
}

function snapshotFiles(
  checkoutPath: string,
  relativePaths: readonly string[],
): readonly SentinelProductionFileSnapshot[] {
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
  initial: readonly SentinelProductionFileSnapshot[],
  final: readonly SentinelProductionFileSnapshot[],
): SentinelProductionCollateralComparison {
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
  role: SentinelProductionProcessRole,
  executable: SentinelProductionExecutableIdentity,
  arguments_: readonly string[],
  cwd: string,
  environment: Readonly<Record<string, string>>,
): SentinelProductionCommandPlan {
  const environmentSha256 = sha256Json(environment);
  const body = { role, executable, arguments: arguments_, cwd, environmentSha256 } as const;
  return { ...body, identitySha256: sha256Json(body) };
}

async function prepareAttempt(
  input: SentinelProductionSupervisorInput,
  dependencies: SentinelProductionSupervisorDependencies,
): Promise<PreparedAttempt> {
  if (
    !isRecord(input) ||
    input.schemaVersion !== "pm.public-eval-corners.sentinel-production-attempt-input.v1"
  ) throw new Error("unsupported Sentinel production attempt input schemaVersion");
  if (!ATTEMPT_ID.test(input.attemptId)) {
    throw new Error("attemptId must be a portable unique identifier");
  }
  const task = verifyTaskRegistration(input.task);
  requirePinnedNumber(input.speedFactor, SPEED_FACTOR, "speedFactor");
  requirePinnedNumber(input.killHorizonMs, KILL_HORIZON_MS, "killHorizonMs");
  requirePinnedNumber(input.startupTimeoutMs, STARTUP_TIMEOUT_MS, "startupTimeoutMs");
  requirePinnedNumber(input.attemptTimeoutMs, ATTEMPT_TIMEOUT_MS, "attemptTimeoutMs");
  requirePinnedNumber(input.shutdownGraceMs, SHUTDOWN_GRACE_MS, "shutdownGraceMs");

  const checkoutPath = realpathSync(resolve(input.checkoutPath));
  if (!statSync(checkoutPath).isDirectory()) throw new Error("checkoutPath must be a directory");
  const outputRoot = resolve(input.outputRoot);
  const attemptRegistryRoot = resolve(input.attemptRegistryRoot);
  if (
    isWithin(checkoutPath, outputRoot) ||
    isWithin(outputRoot, checkoutPath) ||
    isWithin(attemptRegistryRoot, outputRoot) ||
    isWithin(outputRoot, attemptRegistryRoot) ||
    isWithin(checkoutPath, attemptRegistryRoot) ||
    isWithin(attemptRegistryRoot, checkoutPath)
  ) throw new Error("checkout, outputRoot, and attemptRegistryRoot must be disjoint");
  if (existsSync(outputRoot)) throw new Error("outputRoot must not already exist");

  const checkoutBefore = verifyCheckout(checkoutPath, dependencies);
  if (!checkoutBefore.valid) {
    throw new Error(`Sentinel checkout verification failed: ${checkoutBefore.issues.join("; ")}`);
  }
  const scenario = dependencies.verifyScenario(checkoutPath, task);
  if (
    resolve(scenario.path) !== resolve(checkoutPath, task.scenarioRelativePath) ||
    scenario.sha256 !== task.scenarioSha256
  ) throw new Error("scenario verifier did not return the registered path and hash");

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

  const agentRuntimeExecutable = exactFile(
    input.agentRuntimeExecutable,
    "agentRuntimeExecutable",
    true,
  );
  const agentScript = exactFile(input.agentScript, "agentScript");
  const agentConfig = verifyAgentConfig(
    input.agentConfig,
    agentRuntimeExecutable,
    agentScript,
    serverUrl,
    frontendUrl,
  );
  for (const [label, identity] of Object.entries({ agentConfig, agentRuntimeExecutable, agentScript })) {
    if (isWithin(checkoutPath, identity.path)) {
      throw new Error(`${label} must remain external to the pinned checkout`);
    }
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
  const pollIntervalMs = boundedInteger(input.pollIntervalMs, 250, 120_000, "pollIntervalMs");
  const activeSettleMs = boundedInteger(input.activeSettleMs, 0, 5_000, "activeSettleMs");
  const maxDecisions = boundedInteger(input.maxDecisions, 1, 10_000, "maxDecisions");
  const maxConsecutiveActiveActions = boundedInteger(
    input.maxConsecutiveActiveActions,
    1,
    1_000,
    "maxConsecutiveActiveActions",
  );
  const viewportWidth = boundedInteger(input.viewportWidth, 800, 2_560, "viewportWidth");
  const viewportHeight = boundedInteger(input.viewportHeight, 600, 1_440, "viewportHeight");

  const baseEnvironment = safeBaseEnvironment(dependencies.hostEnvironment());
  const fixedPythonEnvironment = {
    PYTHONPATH: checkoutPath,
    PYTHONPYCACHEPREFIX: resolve(outputRoot, "pycache"),
  } as const;
  const serverEnvironment = { ...baseEnvironment, ...fixedPythonEnvironment };
  const frontendEnvironment = { ...baseEnvironment, SENTINEL_API_BASE: serverUrl };
  const agentOutputRoot = resolve(outputRoot, "runtime", "agent");
  const harnessEnvironment = {
    ...baseEnvironment,
    ...fixedPythonEnvironment,
    [OPAQUE_ENVIRONMENT_NAMES.stateOrigin]: stateOrigin.origin,
    [OPAQUE_ENVIRONMENT_NAMES.stateToken]: stateToken,
    [OPAQUE_ENVIRONMENT_NAMES.providerOrigin]: providerOrigin.origin,
    [OPAQUE_ENVIRONMENT_NAMES.providerToken]: providerToken,
    PM_SENTINEL_ATTEMPT_ID: input.attemptId,
    PM_SENTINEL_AGENT_OUTPUT_ROOT: agentOutputRoot,
    PM_SENTINEL_POLL_INTERVAL_MS: String(pollIntervalMs),
    PM_SENTINEL_ACTIVE_SETTLE_MS: String(activeSettleMs),
    PM_SENTINEL_MAX_DECISIONS: String(maxDecisions),
    PM_SENTINEL_MAX_ACTIVE_ACTIONS: String(maxConsecutiveActiveActions),
    PM_SENTINEL_VIEWPORT_WIDTH: String(viewportWidth),
    PM_SENTINEL_VIEWPORT_HEIGHT: String(viewportHeight),
  };
  if (existsSync(agentOutputRoot)) throw new Error("agent output root must not already exist");

  const runtimeRoot = resolve(outputRoot, "runtime");
  const commands = [
    commandPlan(
      "server",
      pythonExecutable,
      ["-m", "uvicorn", "server.server:app", "--host", "127.0.0.1", "--port", String(serverPort)],
      runtimeRoot,
      serverEnvironment,
    ),
    commandPlan(
      "frontend",
      frontendExecutable,
      ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(frontendPort), "--strictPort"],
      resolve(checkoutPath, "frontend"),
      frontendEnvironment,
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
        task.taskId,
      ],
      runtimeRoot,
      harnessEnvironment,
    ),
  ] as const;

  const collateralPaths = [...DATABASE_PATHS, task.scenarioRelativePath]
    .sort(compareCodeUnits);
  const collateralInitial = snapshotFiles(checkoutPath, collateralPaths);
  if (collateralInitial.some(({ sha256: hash }) => hash === null)) {
    throw new Error("required Sentinel database or scenario collateral is missing");
  }
  const opaqueKeys = new Set(Object.values(OPAQUE_ENVIRONMENT_NAMES));
  const planBody = {
    schemaVersion: "pm.public-eval-corners.sentinel-production-attempt-plan.v1" as const,
    evidenceEligible: false as const,
    attemptId: input.attemptId,
    task,
    checkoutPath,
    outputRoot,
    scenario,
    agentConfig,
    agentRuntimeExecutable,
    agentScript,
    speedFactor: SPEED_FACTOR,
    killHorizonMs: KILL_HORIZON_MS,
    serverUrl,
    frontendUrl,
    commands,
    environmentBindings: {
      server: environmentBindings(
        serverEnvironment,
        opaqueKeys,
        new Set(Object.keys(fixedPythonEnvironment)),
      ),
      frontend: environmentBindings(
        frontendEnvironment,
        opaqueKeys,
        new Set(["SENTINEL_API_BASE"]),
      ),
      harness: environmentBindings(
        harnessEnvironment,
        opaqueKeys,
        new Set([
          ...Object.keys(fixedPythonEnvironment),
          "PM_SENTINEL_ATTEMPT_ID",
          "PM_SENTINEL_AGENT_OUTPUT_ROOT",
          "PM_SENTINEL_POLL_INTERVAL_MS",
          "PM_SENTINEL_ACTIVE_SETTLE_MS",
          "PM_SENTINEL_MAX_DECISIONS",
          "PM_SENTINEL_MAX_ACTIVE_ACTIONS",
          "PM_SENTINEL_VIEWPORT_WIDTH",
          "PM_SENTINEL_VIEWPORT_HEIGHT",
        ]),
      ),
    },
    collateralInitial,
    collateralInitialRootSha256: sha256Json(collateralInitial),
    checkoutBefore,
    timeouts: {
      startupMs: STARTUP_TIMEOUT_MS,
      attemptMs: ATTEMPT_TIMEOUT_MS,
      shutdownGraceMs: SHUTDOWN_GRACE_MS,
    },
  };
  return {
    plan: { ...planBody, planHash: sha256Json(planBody) },
    environment: {
      server: serverEnvironment,
      frontend: frontendEnvironment,
      harness: harnessEnvironment,
    },
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

function reserveAttempt(
  prepared: PreparedAttempt,
  registryRoot: string,
  claimedAt: string,
): Reservation {
  mkdirSync(registryRoot, { recursive: true, mode: 0o700 });
  const claimBody = {
    schemaVersion: "pm.public-eval-corners.sentinel-production-attempt-claim.v1",
    attemptId: prepared.plan.attemptId,
    planHash: prepared.plan.planHash,
    checkoutPath: prepared.plan.checkoutPath,
    outputRoot: prepared.plan.outputRoot,
    claimedAt,
  };
  const claimHash = sha256Json(claimBody);
  const claimPath = resolve(
    registryRoot,
    `sentinel-production-attempt-${sha256(prepared.plan.attemptId)}.claim.json`,
  );
  try {
    writeFileSync(claimPath, `${JSON.stringify({ ...claimBody, claimHash }, null, 2)}\n`, {
      flag: "wx",
      mode: 0o400,
    });
  } catch {
    throw new Error(`attemptId ${prepared.plan.attemptId} has already been claimed`);
  }

  const checkoutLockPath = resolve(
    dirname(prepared.plan.checkoutPath),
    `.pm-sentinel-production-checkout-${sha256(prepared.plan.checkoutPath)}.lock`,
  );
  let descriptor: number | undefined;
  try {
    descriptor = openSync(checkoutLockPath, "wx", 0o400);
    writeFileSync(descriptor, `${JSON.stringify({
      attemptId: prepared.plan.attemptId,
      checkoutPath: prepared.plan.checkoutPath,
      planHash: prepared.plan.planHash,
    })}\n`);
  } catch {
    throw new Error("checkout is already reserved by a simultaneous Sentinel arm");
  } finally {
    if (descriptor !== undefined) {
      closeSync(descriptor);
    }
  }
  try {
    mkdirSync(prepared.plan.outputRoot, { recursive: false, mode: 0o700 });
    mkdirSync(resolve(prepared.plan.outputRoot, "logs"), { mode: 0o700 });
    mkdirSync(resolve(prepared.plan.outputRoot, "receipts"), { mode: 0o700 });
    mkdirSync(resolve(prepared.plan.outputRoot, "runtime"), { mode: 0o700 });
  } catch (error) {
    try {
      unlinkSync(checkoutLockPath);
    } catch {
      // Preserve the original reservation error; a stale lock fails future attempts closed.
    }
    throw error;
  }
  return { checkoutLockPath };
}

function releaseReservation(reservation: Reservation | null): string | null {
  if (reservation === null) return null;
  try {
    unlinkSync(reservation.checkoutLockPath);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

function artifactIdentity(
  path: string,
  root: string,
): SentinelProductionArtifactIdentity {
  const bytes = readFileSync(path);
  return { path: relative(root, path), byteLength: bytes.byteLength, sha256: sha256(bytes) };
}

function inventoryDirectory(
  root: string,
  base = root,
): readonly SentinelProductionArtifactIdentity[] {
  if (!existsSync(root)) return [];
  const output: SentinelProductionArtifactIdentity[] = [];
  for (const name of readdirSync(root).sort(compareCodeUnits)) {
    const path = resolve(root, name);
    const stat = lstatSync(path);
    if (stat.isSymbolicLink()) throw new Error("Sentinel raw artifacts may not contain symbolic links");
    if (stat.isDirectory()) output.push(...inventoryDirectory(path, base));
    else if (stat.isFile()) output.push(artifactIdentity(path, base));
    else throw new Error("Sentinel raw artifacts must be files or directories");
    if (output.length > 50_000) throw new Error("Sentinel raw artifact inventory exceeds file ceiling");
  }
  return output;
}

function immutableArtifactTree(root: string): void {
  if (!existsSync(root)) return;
  for (const name of readdirSync(root)) {
    const path = resolve(root, name);
    const stat = lstatSync(path);
    if (stat.isSymbolicLink()) throw new Error("Sentinel raw artifacts may not contain symbolic links");
    if (stat.isDirectory()) immutableArtifactTree(path);
    else if (stat.isFile()) chmodSync(path, 0o400);
  }
  chmodSync(root, 0o500);
}

function spawnFromPlan(
  command: SentinelProductionCommandPlan,
  environment: Readonly<Record<string, string>>,
  outputRoot: string,
  dependencies: SentinelProductionSupervisorDependencies,
  usedPids: ReadonlySet<number>,
): SentinelProductionProcessHandle {
  if (sha256Json(environment) !== command.environmentSha256) {
    throw new Error(`${command.role} environment no longer matches the planned hash`);
  }
  const stdoutPath = resolve(outputRoot, "logs", `${command.role}.stdout.log`);
  const stderrPath = resolve(outputRoot, "logs", `${command.role}.stderr.log`);
  writeFileSync(stdoutPath, "", { flag: "wx", mode: 0o600 });
  writeFileSync(stderrPath, "", { flag: "wx", mode: 0o600 });
  const handle = dependencies.spawnProcess({
    role: command.role,
    executable: command.executable.path,
    arguments: command.arguments,
    cwd: command.cwd,
    environment,
    environmentSha256: command.environmentSha256,
    stdoutPath,
    stderrPath,
  });
  if (
    handle.role !== command.role ||
    !Number.isSafeInteger(handle.pid) ||
    handle.pid <= 1 ||
    !Number.isSafeInteger(handle.ppid) ||
    handle.ppid <= 1 ||
    handle.ppid === handle.pid ||
    usedPids.has(handle.pid)
  ) throw new Error(`${command.role} returned an invalid or duplicate process identity`);
  return handle;
}

async function awaitReadiness(
  handle: SentinelProductionProcessHandle,
  url: string,
  timeoutMs: number,
  dependencies: SentinelProductionSupervisorDependencies,
): Promise<void> {
  await Promise.race([
    dependencies.waitForHttpReady(url, timeoutMs),
    handle.completion.then((exit) => {
      throw new Error(`${handle.role} exited before readiness: ${canonical(exit)}`);
    }),
  ]);
}

function terminalProcessRecord(
  handle: SentinelProductionProcessHandle,
  command: SentinelProductionCommandPlan,
  timedOut: boolean,
  termination: SentinelProductionTreeTermination,
  outputRoot: string,
): SentinelProductionProcessTerminalRecord {
  return {
    role: handle.role,
    pid: handle.pid,
    ppid: handle.ppid,
    commandIdentitySha256: command.identitySha256,
    environmentSha256: command.environmentSha256,
    timedOut,
    exit: termination.exit,
    treeTermination: termination,
    stdout: artifactIdentity(resolve(outputRoot, "logs", `${handle.role}.stdout.log`), outputRoot),
    stderr: artifactIdentity(resolve(outputRoot, "logs", `${handle.role}.stderr.log`), outputRoot),
  };
}

function parseCanonicalTimestamp(value: unknown, label: string): string {
  if (typeof value !== "string" || !CANONICAL_TIMESTAMP.test(value)) {
    throw new Error(`${label} must be a canonical UTC timestamp`);
  }
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.valueOf()) || parsed.toISOString() !== value) {
    throw new Error(`${label} must be a canonical UTC timestamp`);
  }
  return value;
}

function validateOpaqueResultEnvelope(path: string): void {
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch {
    throw new Error("exact Sentinel results.json is not valid JSON");
  }
  if (!isRecord(value)) throw new Error("exact Sentinel results.json must be an object");
  exactKeys(value, [
    "condition_at",
    "contact_get_time",
    "contact_message",
    "contact_post_time",
    "detail",
    "evaluation_time",
    "success",
  ], "Sentinel results.json");
  const optionalFinite = (candidate: unknown): boolean =>
    candidate === null || (typeof candidate === "number" && Number.isFinite(candidate));
  const optionalInteger = (candidate: unknown): boolean =>
    candidate === null || Number.isSafeInteger(candidate);
  if (
    typeof value.success !== "boolean" ||
    typeof value.detail !== "string" ||
    !optionalFinite(value.evaluation_time) ||
    !optionalFinite(value.condition_at) ||
    !optionalInteger(value.contact_get_time) ||
    !optionalInteger(value.contact_post_time) ||
    (value.contact_message !== null && typeof value.contact_message !== "string")
  ) throw new Error("exact Sentinel results.json has an invalid upstream envelope");
}

function parseAgentProcessEvidence(
  prepared: PreparedAttempt,
  harness: SentinelProductionProcessHandle,
): SentinelProductionAgentProcessEvidence {
  const agentRoot = resolve(prepared.plan.outputRoot, "runtime", "agent");
  const startPath = resolve(agentRoot, "agent-start.json");
  const terminalPath = resolve(agentRoot, "agent-terminal.json");
  const eventsPath = resolve(agentRoot, "agent-events.jsonl");
  const networkPath = resolve(agentRoot, "browser-network.jsonl");
  for (const path of [startPath, eventsPath, networkPath]) {
    if (!existsSync(path) || !lstatSync(path).isFile() || lstatSync(path).isSymbolicLink()) {
      throw new Error(`required general-agent artifact is missing: ${basename(path)}`);
    }
    if (readFileSync(path).byteLength === 0) {
      throw new Error(`required general-agent artifact is empty: ${basename(path)}`);
    }
  }
  if (
    existsSync(terminalPath) &&
    (!lstatSync(terminalPath).isFile() ||
      lstatSync(terminalPath).isSymbolicLink() ||
      readFileSync(terminalPath).byteLength === 0)
  ) throw new Error("general-agent terminal artifact exists but is unsafe or empty");
  if (!readdirSync(agentRoot).some((name) => /^decision-\d{6}\.png$/u.test(name))) {
    throw new Error("general agent did not retain any decision screenshot");
  }
  let start: unknown;
  let terminal: unknown = null;
  try {
    start = JSON.parse(readFileSync(startPath, "utf8")) as unknown;
    if (existsSync(terminalPath)) {
      terminal = JSON.parse(readFileSync(terminalPath, "utf8")) as unknown;
    }
  } catch {
    throw new Error("general-agent start or terminal artifact is not JSON");
  }
  if (!isRecord(start)) throw new Error("general-agent start artifact must be an object");
  if (terminal !== null && !isRecord(terminal)) {
    throw new Error("general-agent terminal artifact must be an object when present");
  }
  if (
    start.schemaVersion !== "pm.public-eval-corners.sentinel-general-agent-start.v1" ||
    start.attemptId !== prepared.plan.attemptId ||
    !Number.isSafeInteger(start.pid) || Number(start.pid) <= 1 ||
    !Number.isSafeInteger(start.ppid) || Number(start.ppid) !== harness.pid ||
    start.waitIntervalMs !== Number(
      prepared.environment.harness.PM_SENTINEL_POLL_INTERVAL_MS,
    ) ||
    start.activeSettleMs !== Number(
      prepared.environment.harness.PM_SENTINEL_ACTIVE_SETTLE_MS,
    ) ||
    start.maxDecisions !== Number(prepared.environment.harness.PM_SENTINEL_MAX_DECISIONS) ||
    start.maxConsecutiveActiveActions !== Number(
      prepared.environment.harness.PM_SENTINEL_MAX_ACTIVE_ACTIONS,
    ) ||
    !isRecord(start.viewport) ||
    start.viewport.width !== Number(prepared.environment.harness.PM_SENTINEL_VIEWPORT_WIDTH) ||
    start.viewport.height !== Number(prepared.environment.harness.PM_SENTINEL_VIEWPORT_HEIGHT) ||
    start.providerOriginSha256 !== sha256(
      prepared.environment.harness[OPAQUE_ENVIRONMENT_NAMES.providerOrigin] ?? "",
    ) ||
    start.stateOriginSha256 !== sha256(
      prepared.environment.harness[OPAQUE_ENVIRONMENT_NAMES.stateOrigin] ?? "",
    ) ||
    typeof start.startUrl !== "string" ||
    start.startUrlSha256 !== sha256(start.startUrl) ||
    typeof start.taskPrompt !== "string" ||
    start.taskPromptSha256 !== sha256(start.taskPrompt) ||
    typeof start.cadencePublicKeyDerBase64 !== "string" ||
    start.cadencePublicKeySha256 !== sha256(Buffer.from(start.cadencePublicKeyDerBase64, "base64"))
  ) throw new Error("general-agent start artifact is not bound to the planned runtime");
  const startedAt = parseCanonicalTimestamp(start.startedAt, "agent startedAt");
  if (terminal !== null && (
    terminal.schemaVersion !== "pm.public-eval-corners.sentinel-general-agent-terminal.v1" ||
    terminal.attemptId !== prepared.plan.attemptId
  )) throw new Error("general-agent terminal artifact is not bound to the attempt");
  return {
    pid: Number(start.pid),
    ppid: Number(start.ppid),
    startedAt,
    startArtifact: artifactIdentity(startPath, prepared.plan.outputRoot),
    terminalArtifact: terminal === null
      ? null
      : artifactIdentity(terminalPath, prepared.plan.outputRoot),
  };
}

export async function superviseSentinelProductionAttempt(
  input: SentinelProductionSupervisorInput,
  dependencies: SentinelProductionSupervisorDependencies =
    createSentinelProductionSupervisorDependencies(),
): Promise<SentinelProductionAttemptTerminalReceipt> {
  const prepared = await prepareAttempt(input, dependencies);
  let reservation: Reservation | null = null;
  try {
    reservation = reserveAttempt(
      prepared,
      resolve(input.attemptRegistryRoot),
      dependencies.now(),
    );
  } catch (error) {
    throw error;
  }
  const receiptRoot = resolve(prepared.plan.outputRoot, "receipts");
  const startBody = {
    schemaVersion: "pm.public-eval-corners.sentinel-production-attempt-start.v1",
    evidenceEligible: false,
    startedAt: dependencies.now(),
    plan: prepared.plan,
  };
  let start: { readonly path: string; readonly receiptHash: string };
  try {
    start = writeImmutableJson(receiptRoot, "sentinel-production-attempt-start", startBody);
  } catch (error) {
    releaseReservation(reservation);
    reservation = null;
    throw error;
  }
  const handles: SentinelProductionProcessHandle[] = [];
  const usedPids = new Set<number>();
  const commandByRole = new Map(
    prepared.plan.commands.map((command) => [command.role, command] as const),
  );
  const timedOutByRole = new Map<SentinelProductionProcessRole, boolean>();
  let completion: SentinelProductionAttemptTerminalReceipt["completion"] =
    "infrastructure-incomplete";
  let infrastructureStage: string | null = "startup";
  let infrastructureIssue: string | null = null;
  let timedOut = false;
  let checkoutAfter = prepared.plan.checkoutBefore;
  let collateral = collateralComparison(
    prepared.plan.collateralInitial,
    prepared.plan.collateralInitial,
  );
  let resultArtifacts: readonly SentinelProductionArtifactIdentity[] = [];
  let rawArtifacts: readonly SentinelProductionArtifactIdentity[] = [];
  let resultJsonPath: string | null = null;
  let resultJsonSha256: string | null = null;
  let agentProcess: SentinelProductionAgentProcessEvidence | null = null;
  const processRecords: SentinelProductionProcessTerminalRecord[] = [];
  try {
    const serverCommand = commandByRole.get("server");
    const frontendCommand = commandByRole.get("frontend");
    const harnessCommand = commandByRole.get("harness");
    if (!serverCommand || !frontendCommand || !harnessCommand) {
      throw new Error("attempt plan lacks required server, frontend, or harness command");
    }

    infrastructureStage = "server-start";
    const server = spawnFromPlan(
      serverCommand,
      prepared.environment.server,
      prepared.plan.outputRoot,
      dependencies,
      usedPids,
    );
    handles.push(server);
    usedPids.add(server.pid);

    infrastructureStage = "frontend-start";
    const frontend = spawnFromPlan(
      frontendCommand,
      prepared.environment.frontend,
      prepared.plan.outputRoot,
      dependencies,
      usedPids,
    );
    handles.push(frontend);
    usedPids.add(frontend.pid);

    infrastructureStage = "readiness";
    await Promise.all([
      awaitReadiness(
        server,
        `${prepared.plan.serverUrl}/status`,
        prepared.plan.timeouts.startupMs,
        dependencies,
      ),
      awaitReadiness(
        frontend,
        `${prepared.plan.frontendUrl}/`,
        prepared.plan.timeouts.startupMs,
        dependencies,
      ),
    ]);

    infrastructureStage = "harness-start";
    const harness = spawnFromPlan(
      harnessCommand,
      prepared.environment.harness,
      prepared.plan.outputRoot,
      dependencies,
      usedPids,
    );
    handles.push(harness);
    usedPids.add(harness.pid);

    infrastructureStage = "harness-execution";
    const waited = await dependencies.waitForExit(harness, prepared.plan.timeouts.attemptMs);
    timedOutByRole.set("harness", waited.timedOut);
    if (waited.timedOut) {
      timedOut = true;
      throw new Error("Sentinel harness exceeded the pinned 720-second attempt timeout");
    }
    if (
      !waited.exit ||
      waited.exit.exitCode !== 0 ||
      waited.exit.signal !== null ||
      waited.exit.spawnError !== null
    ) throw new Error(`Sentinel harness process failed: ${canonical(waited.exit)}`);

    infrastructureStage = "raw-artifact-capture";
    const taskResultRoot = resolve(
      prepared.plan.outputRoot,
      "runtime",
      "results",
      prepared.plan.attemptId,
    );
    resultArtifacts = inventoryDirectory(taskResultRoot);
    const expectedPrefix = `${prepared.plan.task.environment}/${prepared.plan.task.taskId}/`;
    if (
      resultArtifacts.length === 0 ||
      resultArtifacts.some(({ path }) => !path.startsWith(expectedPrefix))
    ) throw new Error("harness result inventory is empty or contains a non-registered task");
    const expectedResultPath = `${expectedPrefix}results.json`;
    const expectedErrorPath = `${expectedPrefix}error.txt`;
    const result = resultArtifacts.find(({ path }) => path === expectedResultPath);
    if (!result || resultArtifacts.some(({ path }) => path === expectedErrorPath)) {
      throw new Error("exact registered Sentinel task did not produce a clean results.json");
    }
    const absoluteResultPath = resolve(taskResultRoot, expectedResultPath);
    validateOpaqueResultEnvelope(absoluteResultPath);
    resultJsonPath = relative(prepared.plan.outputRoot, absoluteResultPath);
    resultJsonSha256 = result.sha256;
    agentProcess = parseAgentProcessEvidence(prepared, harness);

    // This is deliberately outcome-blind: results.json is retained byte-for-byte but
    // its benchmark-owned success field is not parsed or consulted here.
    completion = "behavioral-complete";
    infrastructureStage = null;
  } catch (error) {
    infrastructureIssue = error instanceof Error ? error.message : String(error);
    completion = "infrastructure-incomplete";
  } finally {
    for (const handle of [...handles].reverse()) {
      const command = commandByRole.get(handle.role);
      if (!command) {
        completion = "infrastructure-incomplete";
        infrastructureStage ??= "process-identity";
        infrastructureIssue ??= `launched process claimed unknown role ${handle.role}`;
        continue;
      }
      let termination: SentinelProductionTreeTermination;
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
      const observedPidsValid =
        termination.observedPids.length === new Set(termination.observedPids).size &&
        termination.observedPids.every((pid) => Number.isSafeInteger(pid) && pid > 1) &&
        termination.observedPids.includes(handle.pid) &&
        termination.remainingPids.every((pid) => termination.observedPids.includes(pid));
      try {
        processRecords.push(terminalProcessRecord(
          handle,
          command,
          timedOutByRole.get(handle.role) ?? false,
          termination,
          prepared.plan.outputRoot,
        ));
      } catch (error) {
        completion = "infrastructure-incomplete";
        infrastructureStage ??= "process-artifact-capture";
        infrastructureIssue ??= error instanceof Error ? error.message : String(error);
      }
      if (!termination.reaped || termination.remainingPids.length !== 0 || !observedPidsValid) {
        completion = "infrastructure-incomplete";
        infrastructureStage ??= "process-reap";
        infrastructureIssue ??= `${handle.role} process tree evidence is invalid or not fully reaped`;
      }
    }

    const roles = processRecords.map(({ role }) => role).sort(compareCodeUnits);
    if (roles.join(",") !== "frontend,harness,server") {
      completion = "infrastructure-incomplete";
      infrastructureStage ??= "process-identity";
      infrastructureIssue ??= "terminal evidence does not contain exactly the three required roles";
    }
    const harnessRecord = processRecords.find(({ role }) => role === "harness");
    if (
      agentProcess !== null &&
      (
        harnessRecord === undefined ||
        agentProcess.ppid !== harnessRecord.pid ||
        !harnessRecord.treeTermination.observedPids.includes(agentProcess.pid) ||
        processRecords.some(({ pid }) => pid === agentProcess?.pid)
      )
    ) {
      completion = "infrastructure-incomplete";
      infrastructureStage ??= "agent-process-identity";
      infrastructureIssue ??= "general-agent PID/PPID is not bound to the harness process tree";
    }

    try {
      const finalCollateral = snapshotFiles(
        prepared.plan.checkoutPath,
        prepared.plan.collateralInitial.map(({ relativePath }) => relativePath),
      );
      collateral = collateralComparison(prepared.plan.collateralInitial, finalCollateral);
    } catch (error) {
      completion = "infrastructure-incomplete";
      infrastructureStage ??= "collateral-integrity";
      infrastructureIssue ??= error instanceof Error ? error.message : String(error);
    }
    checkoutAfter = verifyCheckout(prepared.plan.checkoutPath, dependencies);
    if (collateral.mutationDetected || !checkoutAfter.valid) {
      completion = "infrastructure-incomplete";
      infrastructureStage ??= "collateral-integrity";
      infrastructureIssue ??= collateral.mutationDetected
        ? `runtime collateral changed: ${collateral.changedPaths.join(", ")}`
        : `checkout changed: ${checkoutAfter.issues.join("; ")}`;
    }

    const releaseIssue = releaseReservation(reservation);
    reservation = null;
    if (releaseIssue !== null) {
      completion = "infrastructure-incomplete";
      infrastructureStage ??= "checkout-lease-release";
      infrastructureIssue ??= releaseIssue;
    }
  }

  try {
    const finalResultRoot = resolve(
      prepared.plan.outputRoot,
      "runtime",
      "results",
      prepared.plan.attemptId,
    );
    resultArtifacts = inventoryDirectory(finalResultRoot);
    rawArtifacts = [
      ...inventoryDirectory(resolve(prepared.plan.outputRoot, "logs"), prepared.plan.outputRoot),
      ...inventoryDirectory(resolve(prepared.plan.outputRoot, "runtime"), prepared.plan.outputRoot),
    ].sort((left, right) => compareCodeUnits(left.path, right.path));
    immutableArtifactTree(resolve(prepared.plan.outputRoot, "logs"));
    immutableArtifactTree(resolve(prepared.plan.outputRoot, "runtime"));
  } catch (error) {
    completion = "infrastructure-incomplete";
    infrastructureStage ??= "artifact-seal";
    infrastructureIssue ??= error instanceof Error ? error.message : String(error);
  }

  const terminalBody = {
    schemaVersion: "pm.public-eval-corners.sentinel-production-attempt-terminal.v1" as const,
    evidenceEligible: false as const,
    attemptId: prepared.plan.attemptId,
    taskId: prepared.plan.task.taskId,
    completion,
    infrastructureStage,
    infrastructureIssue,
    timedOut,
    startReceiptHash: start.receiptHash,
    checkoutBefore: prepared.plan.checkoutBefore,
    checkoutAfter,
    collateral,
    processes: processRecords.sort((left, right) => compareCodeUnits(left.role, right.role)),
    agentProcess,
    resultArtifacts,
    rawArtifacts,
    resultJsonPath,
    resultJsonSha256,
  };
  const terminal = writeImmutableJson(
    receiptRoot,
    "sentinel-production-attempt-terminal",
    terminalBody,
  );
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
      const response = await fetch(url, {
        signal: AbortSignal.timeout(Math.min(2_000, timeoutMs)),
      });
      if (response.ok) return;
      lastIssue = `HTTP ${response.status}`;
    } catch (error) {
      lastIssue = error instanceof Error ? error.message : String(error);
    }
    await delay(100);
  }
  throw new Error(`readiness timeout for ${url}: ${lastIssue}`);
}

function processTable(): readonly {
  readonly pid: number;
  readonly ppid: number;
  readonly pgid: number;
}[] {
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

function defaultSpawnProcess(
  spec: SentinelProductionSpawnSpec,
): SentinelProductionProcessHandle {
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
  const ppid = process.pid;
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
  const completion = new Promise<SentinelProductionProcessExit>((resolvePromise) => {
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
  const terminateTree = async (graceMs: number): Promise<SentinelProductionTreeTermination> => {
    refresh();
    const signalsSent: string[] = [];
    const signalAll = (signal: NodeJS.Signals): void => {
      for (const pgid of [...knownGroups].sort((left, right) => right - left)) {
        if (pgid <= 1 || pgid === process.pid) continue;
        try {
          process.kill(-pgid, signal);
          signalsSent.push(`${signal}:pgid:${pgid}`);
        } catch {
          // An already-exited process is the desired state.
        }
      }
      for (const childPid of knownPids) {
        try {
          process.kill(childPid, signal);
          signalsSent.push(`${signal}:pid:${childPid}`);
        } catch {
          // An already-exited process is the desired state.
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
      delay(Math.max(250, graceMs)).then((): SentinelProductionProcessExit => ({
        exitCode: null,
        signal: null,
        spawnError: "process leader was not reaped before shutdown deadline",
      })),
    ]);
    const observedPids = [...knownPids].sort((left, right) => left - right);
    const remainingPids = observedPids.filter(pidAlive);
    return {
      signalsSent,
      observedPids,
      remainingPids,
      reaped: remainingPids.length === 0,
      exit,
    };
  };
  return { role: spec.role, pid, ppid, completion, terminateTree };
}

async function defaultWaitForExit(
  handle: SentinelProductionProcessHandle,
  timeoutMs: number,
): Promise<{
  readonly timedOut: boolean;
  readonly exit: SentinelProductionProcessExit | null;
}> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<null>((resolvePromise) => {
    timeout = setTimeout(() => resolvePromise(null), timeoutMs);
  });
  const exit = await Promise.race([handle.completion, timeoutPromise]);
  if (timeout !== undefined) clearTimeout(timeout);
  return exit === null ? { timedOut: true, exit: null } : { timedOut: false, exit };
}

export function createSentinelProductionSupervisorDependencies(): SentinelProductionSupervisorDependencies {
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
