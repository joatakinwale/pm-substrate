import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  lstatSync,
  readFileSync,
  readdirSync,
  realpathSync,
  statSync,
} from "node:fs";
import { basename, relative, resolve } from "node:path";

import {
  SENTINEL_POWERED_CONFIRMATORY_FULL_CATALOG_SHA256,
  SENTINEL_POWERED_CONFIRMATORY_MANIFEST_SHA256,
  SENTINEL_PRODUCTION_REPOSITORY,
  SENTINEL_PRODUCTION_REVISION,
  SENTINEL_PRODUCTION_SOURCE_TREE,
  sentinelProductionFullTaskCatalogSha256,
  sentinelProductionTaskManifestSha256,
  type SentinelProductionEnvironment,
  type SentinelProductionTask,
} from "./sentinel-production-plan.js";

export const SENTINEL_POWERED_ENVIRONMENTS = Object.freeze([
  "microchat",
  "microdin",
  "microfy",
  "microgram",
  "microlendar",
] as const);

type PoweredEnvironment = (typeof SENTINEL_POWERED_ENVIRONMENTS)[number];
type JsonRecord = Record<string, unknown>;

export interface SentinelPoweredCatalogRegistration {
  readonly task: SentinelProductionTask;
  readonly scenarioRelativePath: string;
}

export interface SentinelPoweredCatalogReceipt {
  readonly schemaVersion: "pm.public-eval-corners.sentinel-powered-catalog.v1";
  readonly repositoryUrl: typeof SENTINEL_PRODUCTION_REPOSITORY;
  readonly revision: typeof SENTINEL_PRODUCTION_REVISION;
  readonly sourceTreeHash: typeof SENTINEL_PRODUCTION_SOURCE_TREE;
  readonly checkoutPath: string;
  readonly taskCount: 50;
  readonly environmentCounts: Readonly<Record<PoweredEnvironment, 10>>;
  readonly roleCounts: {
    readonly stateRetentionRelative: 19;
    readonly expectedAllowAbsolute: 21;
    readonly antiDegenerateNoop: 10;
  };
  readonly manifestSha256: typeof SENTINEL_POWERED_CONFIRMATORY_MANIFEST_SHA256;
  readonly fullCatalogSha256: typeof SENTINEL_POWERED_CONFIRMATORY_FULL_CATALOG_SHA256;
  readonly registrations: readonly SentinelPoweredCatalogRegistration[];
  readonly receiptSha256: string;
}

export interface SentinelCatalogDependencies {
  readonly git: (checkoutPath: string, args: readonly string[]) => string;
}

const SHA256 = /^[a-f0-9]{64}$/u;
const TASK_ID = /^[a-z0-9][a-z0-9-]{0,159}$/u;
const EXPECTED_ENVIRONMENT_COUNTS: Readonly<Record<PoweredEnvironment, 10>> =
  Object.freeze({ microchat: 10, microdin: 10, microfy: 10, microgram: 10, microlendar: 10 });

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value: JsonRecord, expected: readonly string[], label: string): void {
  const actual = Object.keys(value).sort(compareCodeUnits);
  const wanted = [...expected].sort(compareCodeUnits);
  if (actual.join("\0") !== wanted.join("\0")) throw new Error(`${label} keys are not exact`);
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function canonical(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("canonical JSON rejects non-finite numbers");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.entries(value)
      .sort(([left], [right]) => compareCodeUnits(left, right))
      .map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`)
      .join(",")}}`;
  }
  throw new Error("value is not canonical JSON");
}

function normalizedRemote(value: string): string {
  return value.trim().replace(/\.git$/u, "").replace(/\/+$/u, "");
}

function defaultGit(checkoutPath: string, args: readonly string[]): string {
  return execFileSync("/usr/bin/git", ["-C", checkoutPath, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: { PATH: "/usr/bin:/bin" },
  });
}

function verifyCheckout(
  checkoutPath: string,
  dependencies: SentinelCatalogDependencies,
): string {
  const root = realpathSync(resolve(checkoutPath));
  if (!statSync(root).isDirectory()) throw new Error("Sentinel checkout must be a directory");
  const revision = dependencies.git(root, ["rev-parse", "HEAD"]).trim();
  const tree = dependencies.git(root, ["rev-parse", "HEAD^{tree}"]).trim();
  const remote = dependencies.git(root, ["remote", "get-url", "origin"]).trim();
  const dirty = dependencies.git(root, [
    "status", "--porcelain=v1", "--untracked-files=all", "--ignored=no",
  ]).trim();
  const hiddenFlags = dependencies.git(root, ["ls-files", "-v"]).split("\n").filter(
    (line) => line !== "" && !line.startsWith("H "),
  );
  if (revision !== SENTINEL_PRODUCTION_REVISION) throw new Error("Sentinel revision changed");
  if (tree !== SENTINEL_PRODUCTION_SOURCE_TREE) throw new Error("Sentinel source tree changed");
  if (normalizedRemote(remote) !== normalizedRemote(SENTINEL_PRODUCTION_REPOSITORY)) {
    throw new Error("Sentinel repository origin changed");
  }
  if (dirty !== "" || hiddenFlags.length > 0) throw new Error("Sentinel checkout is not clean");
  return root;
}

function requiredFinite(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${label} is invalid`);
  return value;
}

function parseTask(
  environment: PoweredEnvironment,
  scenarioRelativePath: string,
  bytes: Buffer,
): SentinelProductionTask {
  let parsed: unknown;
  try {
    parsed = JSON.parse(bytes.toString("utf8")) as unknown;
  } catch {
    throw new Error(`${scenarioRelativePath} is not JSON`);
  }
  if (!isRecord(parsed)) throw new Error(`${scenarioRelativePath} must contain an object`);
  const taskId = parsed.id;
  const expectedTaskId = `${environment}-${basename(scenarioRelativePath, ".json")}`;
  if (typeof taskId !== "string" || !TASK_ID.test(taskId) || taskId !== expectedTaskId) {
    throw new Error(`${scenarioRelativePath} task identity changed`);
  }
  if (parsed.environment !== environment) throw new Error(`${taskId} environment changed`);
  const conditionAtSeconds = parsed.condition_at === null
    ? null
    : requiredFinite(parsed.condition_at, `${taskId}.condition_at`);
  if (conditionAtSeconds !== null && (conditionAtSeconds <= 0 || conditionAtSeconds > 630)) {
    throw new Error(`${taskId}.condition_at is outside the published horizon`);
  }
  if (requiredFinite(parsed.event_timeline_end, `${taskId}.event_timeline_end`) !== 720) {
    throw new Error(`${taskId}.event_timeline_end changed`);
  }
  if (requiredFinite(parsed.kill_at, `${taskId}.kill_at`) !== 630) {
    throw new Error(`${taskId}.kill_at changed`);
  }
  if (!isRecord(parsed.taxonomy)) throw new Error(`${taskId}.taxonomy is invalid`);
  const taxonomy = parsed.taxonomy;
  exactKeys(taxonomy, [
    "criteria", "difficulty", "distraction_level", "event_persistence",
    "milestone_type", "monitoring_approach",
  ], `${taskId}.taxonomy`);
  if (
    taxonomy.criteria !== "objective" ||
    (taxonomy.milestone_type !== "relative" && taxonomy.milestone_type !== "absolute") ||
    taxonomy.event_persistence !== "persistent" ||
    (taxonomy.monitoring_approach !== "active" && taxonomy.monitoring_approach !== "passive") ||
    (taxonomy.difficulty !== "easy" && taxonomy.difficulty !== "medium" && taxonomy.difficulty !== "hard") ||
    (taxonomy.distraction_level !== "low" && taxonomy.distraction_level !== "medium" &&
      taxonomy.distraction_level !== "high")
  ) throw new Error(`${taskId}.taxonomy is outside the frozen public taxonomy`);
  const role = conditionAtSeconds === null
    ? "anti-degenerate-noop"
    : taxonomy.milestone_type === "relative"
      ? "state-retention-relative"
      : "expected-allow-absolute";
  return Object.freeze({
    taskId,
    environment: environment as SentinelProductionEnvironment,
    role,
    scenarioSha256: sha256(bytes),
    conditionAtSeconds,
    eventTimelineEndSeconds: 720,
    killAtSeconds: 630,
    taxonomy: Object.freeze({
      criteria: "objective",
      milestoneType: taxonomy.milestone_type,
      eventPersistence: "persistent",
      monitoringApproach: taxonomy.monitoring_approach,
      difficulty: taxonomy.difficulty,
      distractionLevel: taxonomy.distraction_level,
    }),
  });
}

export function loadSentinelPoweredCatalog(
  checkoutPath: string,
  dependencies: SentinelCatalogDependencies = { git: defaultGit },
): SentinelPoweredCatalogReceipt {
  const root = verifyCheckout(checkoutPath, dependencies);
  const registrations: SentinelPoweredCatalogRegistration[] = [];
  for (const environment of SENTINEL_POWERED_ENVIRONMENTS) {
    const directory = resolve(root, "scenarios", environment);
    const names = readdirSync(directory).filter((name) => name !== "dev.json" && name.endsWith(".json"))
      .sort(compareCodeUnits);
    if (names.length !== 10) throw new Error(`${environment} must contain exactly ten non-dev tasks`);
    for (const name of names) {
      const path = resolve(directory, name);
      const relativePath = relative(root, path);
      const entry = lstatSync(path);
      if (!entry.isFile() || entry.isSymbolicLink()) throw new Error(`${relativePath} is not a real file`);
      const bytes = readFileSync(path);
      registrations.push({
        task: parseTask(environment, relativePath, bytes),
        scenarioRelativePath: relativePath,
      });
    }
  }
  registrations.sort((left, right) => compareCodeUnits(left.task.taskId, right.task.taskId));
  const tasks = registrations.map(({ task }) => task);
  if (new Set(tasks.map(({ taskId }) => taskId)).size !== 50) throw new Error("powered task IDs repeat");
  const manifestSha256 = sentinelProductionTaskManifestSha256(tasks);
  const fullCatalogSha256 = sentinelProductionFullTaskCatalogSha256(tasks);
  if (manifestSha256 !== SENTINEL_POWERED_CONFIRMATORY_MANIFEST_SHA256) {
    throw new Error(`powered manifest changed: ${manifestSha256}`);
  }
  if (fullCatalogSha256 !== SENTINEL_POWERED_CONFIRMATORY_FULL_CATALOG_SHA256) {
    throw new Error(`powered full catalog changed: ${fullCatalogSha256}`);
  }
  const roleCounts = {
    stateRetentionRelative: tasks.filter(({ role }) => role === "state-retention-relative").length,
    expectedAllowAbsolute: tasks.filter(({ role }) => role === "expected-allow-absolute").length,
    antiDegenerateNoop: tasks.filter(({ role }) => role === "anti-degenerate-noop").length,
  };
  if (
    roleCounts.stateRetentionRelative !== 19 ||
    roleCounts.expectedAllowAbsolute !== 21 ||
    roleCounts.antiDegenerateNoop !== 10
  ) throw new Error("powered role counts changed");
  const body = {
    schemaVersion: "pm.public-eval-corners.sentinel-powered-catalog.v1" as const,
    repositoryUrl: SENTINEL_PRODUCTION_REPOSITORY,
    revision: SENTINEL_PRODUCTION_REVISION,
    sourceTreeHash: SENTINEL_PRODUCTION_SOURCE_TREE,
    checkoutPath: root,
    taskCount: 50 as const,
    environmentCounts: EXPECTED_ENVIRONMENT_COUNTS,
    roleCounts: {
      stateRetentionRelative: 19 as const,
      expectedAllowAbsolute: 21 as const,
      antiDegenerateNoop: 10 as const,
    },
    manifestSha256: SENTINEL_POWERED_CONFIRMATORY_MANIFEST_SHA256,
    fullCatalogSha256: SENTINEL_POWERED_CONFIRMATORY_FULL_CATALOG_SHA256,
    registrations,
  };
  return { ...body, receiptSha256: sha256(canonical(body)) };
}

export function assertSentinelCatalogReceipt(value: SentinelPoweredCatalogReceipt): void {
  if (!SHA256.test(value.receiptSha256)) throw new Error("catalog receipt hash is invalid");
  const { receiptSha256, ...body } = value;
  if (sha256(canonical(body)) !== receiptSha256) throw new Error("catalog receipt hash mismatch");
  if (
    value.manifestSha256 !== sentinelProductionTaskManifestSha256(
      value.registrations.map(({ task }) => task),
    ) ||
    value.fullCatalogSha256 !== sentinelProductionFullTaskCatalogSha256(
      value.registrations.map(({ task }) => task),
    )
  ) throw new Error("catalog receipt task hashes do not replay");
}
