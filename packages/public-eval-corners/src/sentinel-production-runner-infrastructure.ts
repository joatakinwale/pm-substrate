import { execFileSync } from "node:child_process";
import { lstatSync, readFileSync, readdirSync, readlinkSync, realpathSync, statSync, writeFileSync, chmodSync } from "node:fs";
import { createServer } from "node:net";
import { isAbsolute, normalize, relative, resolve } from "node:path";

import pg from "pg";

import {
  SENTINEL_PRODUCTION_REPOSITORY,
  SENTINEL_PRODUCTION_REVISION,
  SENTINEL_PRODUCTION_SOURCE_TREE,
  isSentinelRuntimeSanitizedEnvironment,
  sentinelProductionJsonSha256,
  sentinelProductionSha256,
  type SentinelProductionTask,
  type SentinelRuntimeClosure,
} from "./sentinel-production-plan.js";
import { assertSentinelTrackedWorkingTreeMatchesHead } from "./sentinel-git-working-tree.js";
import { verifySentinelRuntimeClosure } from "./sentinel-runtime-closure.js";
import { createSentinelProductionRuntimeLeaseIdentity } from "./sentinel-production-runner-evidence.js";
import type {
  SentinelProductionArtifactIdentity,
  SentinelProductionCheckoutPreflight,
  SentinelProductionContinuityReplayExport,
  SentinelProductionContinuityTenantReceipt,
  SentinelProductionRuntimeBindings,
  SentinelProductionRuntimeInspection,
} from "./sentinel-production-runner.js";

const LOOPBACK_HOST = "127.0.0.1";
const DATABASE_PATHS = [
  "server/microchat/microchat.db", "server/microdin/microdin.db",
  "server/microfy/microfy.db", "server/microgram/microgram.db",
  "server/microhood/microhood.db", "server/microhub/microhub.db",
  "server/microlendar/microlendar.db", "server/micromail/micromail.db",
  "server/microscholar/microscholar.db", "server/microtube/microtube.db",
] as const;

type JsonValue = null | boolean | number | string | readonly JsonValue[] | { readonly [key: string]: JsonValue };

function compare(left: string, right: string): number { return left < right ? -1 : left > right ? 1 : 0; }
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function hashFile(path: string): string {
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`${path} is not a regular file`);
  return sentinelProductionSha256(readFileSync(path));
}
interface SentinelCheckoutGitInvocation {
  readonly executablePath: string;
  readonly executableSha256: string;
  readonly environment: Readonly<Record<string, string>>;
}

function checkoutGitInvocation(
  plannedRuntime: SentinelRuntimeClosure,
): SentinelCheckoutGitInvocation {
  const executablePath = plannedRuntime.git.executablePath;
  const environment = plannedRuntime.executionEnvironment.values;
  if (
    !isAbsolute(executablePath) ||
    normalize(executablePath) !== executablePath ||
    /[\0\r\n\t]/u.test(executablePath)
  ) throw new Error("signed Git executable path is not canonical absolute");
  if (
    plannedRuntime.executionEnvironment.inheritsHostEnvironment !== false ||
    !isSentinelRuntimeSanitizedEnvironment(environment, plannedRuntime.node.requestedPath)
  ) throw new Error("checkout Git environment is not the exact signed sanitized environment");
  const environmentSha256 = sentinelProductionJsonSha256(environment);
  if (
    plannedRuntime.executionEnvironment.environmentSha256 !== environmentSha256 ||
    plannedRuntime.git.invocationEnvironmentSha256 !== environmentSha256
  ) throw new Error("checkout Git environment is not closure-bound");
  if (hashFile(executablePath) !== plannedRuntime.git.executableSha256) {
    throw new Error("checkout Git executable is not the closure-bound executable");
  }
  return {
    executablePath,
    executableSha256: plannedRuntime.git.executableSha256,
    environment: Object.freeze({ ...environment }),
  };
}

function command(
  git: SentinelCheckoutGitInvocation,
  checkoutPath: string,
  arguments_: readonly string[],
): string {
  if (hashFile(git.executablePath) !== git.executableSha256) {
    throw new Error("checkout Git executable changed during preflight");
  }
  const invocationPrefix = [
    "--exec-path=/dev/null",
    "--no-pager",
    "--no-replace-objects",
    "--literal-pathspecs",
    `--git-dir=${resolve(checkoutPath, ".git")}`,
    `--work-tree=${checkoutPath}`,
    "-c", `core.worktree=${checkoutPath}`,
    "-c", "core.fileMode=true",
    "-c", "core.fsmonitor=false",
    "-c", "core.attributesFile=/dev/null",
    "-c", "core.excludesFile=/dev/null",
    "-c", "core.hooksPath=/dev/null",
  ] as const;
  return execFileSync(git.executablePath, [...invocationPrefix, ...arguments_], {
    encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 60_000,
    maxBuffer: 64 * 1024 * 1024,
    cwd: checkoutPath,
    env: { ...git.environment },
  });
}
function normalizedRemote(value: string): string { return value.trim().replace(/\.git$/u, ""); }

function treeManifest(root: string): string {
  const canonicalRoot = resolve(root);
  const rootStat = lstatSync(canonicalRoot);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error(`${root} must be a non-symlink directory`);
  const rootReal = realpathSync(canonicalRoot);
  const entries: string[] = [];
  const visit = (directory: string, prefix: string): void => {
    for (const name of readdirSync(directory).sort(compare)) {
      if (name === "." || name === ".." || /[\/\\\0\r\n\t]/u.test(name)) throw new Error("runtime tree contains an unsafe name");
      const path = resolve(directory, name);
      const relativePath = prefix ? `${prefix}/${name}` : name;
      const stat = lstatSync(path);
      const mode = (stat.mode & 0o7777).toString(8).padStart(4, "0");
      if (stat.isDirectory()) {
        entries.push(`${relativePath}\t${mode}\tdirectory\t${sentinelProductionSha256("")}\n`);
        visit(path, relativePath);
      } else if (stat.isFile()) {
        entries.push(`${relativePath}\t${mode}\tfile\t${sentinelProductionSha256(readFileSync(path))}\n`);
      } else if (stat.isSymbolicLink()) {
        const target = readlinkSync(path, "utf8");
        const resolvedTarget = realpathSync(path);
        if (resolvedTarget !== rootReal && !resolvedTarget.startsWith(`${rootReal}/`)) throw new Error("runtime tree symlink escapes its root");
        entries.push(`${relativePath}\t${mode}\tsymlink\t${sentinelProductionSha256(target)}\n`);
      } else throw new Error("runtime tree contains a special file");
    }
  };
  visit(canonicalRoot, "");
  return entries.sort(compare).join("");
}
function stableTreeSha256(root: string): string {
  const first = treeManifest(root);
  const second = treeManifest(root);
  if (first !== second) throw new Error(`${root} changed during traversal`);
  return sentinelProductionSha256(first);
}
function filesRoot(checkoutPath: string, paths: readonly string[]): string {
  return sentinelProductionJsonSha256(paths.map((relativePath) => {
    const path = resolve(checkoutPath, relativePath);
    return { relativePath, byteLength: statSync(path).size, sha256: hashFile(path) };
  }));
}
export function sentinelProductionScenarioRelativePath(
  task: Pick<SentinelProductionTask, "taskId" | "environment">,
): string {
  const prefix = `${task.environment}-`;
  if (!task.taskId.startsWith(prefix)) throw new Error(`task ${task.taskId} does not match environment`);
  const name = task.taskId.slice(prefix.length);
  if (!/^[a-z0-9][a-z0-9-]*$/u.test(name)) throw new Error("task scenario name is unsafe");
  return `scenarios/${task.environment}/${name}.json`;
}

export function inspectSentinelProductionRuntime(
  bindings: SentinelProductionRuntimeBindings,
  declared: SentinelRuntimeClosure,
): SentinelProductionRuntimeInspection {
  const issues: string[] = [];
  let closure = declared;
  let artifacts: SentinelProductionRuntimeInspection["artifacts"] = null;
  let executionLeaseIdentity: SentinelProductionRuntimeInspection["executionLeaseIdentity"] = null;
  try {
    const verification = verifySentinelRuntimeClosure(bindings.paths, declared);
    closure = verification.closure;
    artifacts = verification.artifacts;
    executionLeaseIdentity = createSentinelProductionRuntimeLeaseIdentity(
      bindings.paths,
      closure,
      artifacts,
    );
  }
  catch (error) { issues.push(error instanceof Error ? error.message : String(error)); }
  return {
    valid: issues.length === 0,
    closure,
    closureSha256: closure.closureSha256,
    executableIdentitySha256: sentinelProductionJsonSha256({
      node: { path: bindings.paths.nodeRequestedPath, sha256: closure.node.resolvedExecutableSha256 },
      agent: { path: bindings.paths.agentScriptPath, sha256: closure.agentScriptSha256 },
      python: { path: bindings.paths.pythonRequestedVenvPath, sha256: closure.python.realExecutableSha256 },
      npm: { path: bindings.paths.npmRequestedCliPath, sha256: closure.npm.resolvedCliSha256 },
    }),
    artifacts,
    executionLeaseIdentity,
    issues,
  };
}

export function inspectSentinelProductionCheckout(
  checkoutPath: string,
  selectedTasks: readonly SentinelProductionTask[],
  plannedRuntime: SentinelRuntimeClosure,
): SentinelProductionCheckoutPreflight {
  const issues: string[] = [];
  let canonicalPath = resolve(checkoutPath);
  let repositoryUrl: string | null = null;
  let revision: string | null = null;
  let sourceTreeHash: string | null = null;
  let cleanTrackedAndUntracked = false;
  let ignoredArtifactRootSha256 = "", databaseRootSha256 = "", selectedScenarioRootSha256 = "";
  let ignoredPathListingBase64 = "", ignoredPathListingSha256 = "";
  let frontendInstalledTreeSha256 = "", frontendPackageLockSha256 = "", serverRequirementsSha256 = "";
  try {
    const git = checkoutGitInvocation(plannedRuntime);
    canonicalPath = realpathSync(canonicalPath);
    const rootStat = lstatSync(canonicalPath);
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error("checkout is unsafe");
    repositoryUrl = command(git, canonicalPath, ["remote", "get-url", "origin"]).trim();
    revision = command(git, canonicalPath, ["rev-parse", "--verify", "HEAD"]).trim();
    sourceTreeHash = command(git, canonicalPath, ["rev-parse", "--verify", "HEAD^{tree}"]).trim();
    cleanTrackedAndUntracked = command(git, canonicalPath, ["status", "--porcelain=v1", "--untracked-files=all"]).length === 0;
    const hiddenIndexFlags = command(git, canonicalPath, ["ls-files", "-v"])
      .split("\n").filter((line) => line !== "" && !line.startsWith("H "));
    if (hiddenIndexFlags.length > 0) {
      throw new Error("checkout has skip-worktree or assume-unchanged index flags");
    }
    const trackedTree = command(git, canonicalPath, ["ls-tree", "-r", "-z", "--full-tree", "HEAD"]);
    assertSentinelTrackedWorkingTreeMatchesHead(canonicalPath, trackedTree, sourceTreeHash);
    const ignoredListing = command(git, canonicalPath, [
      "ls-files", "--others", "--ignored", "--exclude-standard", "--directory", "-z",
    ]);
    const ignored = ignoredListing.split("\0").filter(Boolean);
    const canonicalIgnoredListing = ignored.length === 0
      ? ""
      : `${[...ignored].sort(compare).join("\0")}\0`;
    if (ignoredListing !== canonicalIgnoredListing || new Set(ignored).size !== ignored.length) {
      throw new Error("checkout ignored-path listing is not canonical");
    }
    const unsafeIgnored = ignored.filter((path) => path !== "frontend/node_modules/");
    if (unsafeIgnored.length > 0) throw new Error(`checkout has non-runtime ignored artifacts: ${unsafeIgnored.slice(0, 8).join(", ")}`);
    ignoredPathListingBase64 = Buffer.from(ignoredListing, "utf8").toString("base64");
    ignoredPathListingSha256 = sentinelProductionSha256(ignoredListing);
    frontendInstalledTreeSha256 = stableTreeSha256(resolve(canonicalPath, "frontend/node_modules"));
    ignoredArtifactRootSha256 = sentinelProductionJsonSha256({
      ignoredListingSha256: ignoredPathListingSha256, frontendInstalledTreeSha256,
    });
    databaseRootSha256 = filesRoot(canonicalPath, DATABASE_PATHS);
    selectedScenarioRootSha256 = filesRoot(canonicalPath, selectedTasks.map(sentinelProductionScenarioRelativePath).sort(compare));
    frontendPackageLockSha256 = hashFile(resolve(canonicalPath, "frontend/package-lock.json"));
    serverRequirementsSha256 = hashFile(resolve(canonicalPath, "server/requirements.txt"));
    if (normalizedRemote(repositoryUrl) !== normalizedRemote(SENTINEL_PRODUCTION_REPOSITORY)) issues.push("checkout repository URL changed");
    if (revision !== SENTINEL_PRODUCTION_REVISION) issues.push("checkout revision changed");
    if (sourceTreeHash !== SENTINEL_PRODUCTION_SOURCE_TREE) issues.push("checkout source tree changed");
    if (!cleanTrackedAndUntracked) issues.push("checkout is not clean");
    if (ignoredPathListingSha256 !== plannedRuntime.upstream.ignoredPathListingSha256) {
      issues.push("checkout ignored-path listing changed");
    }
    if (frontendInstalledTreeSha256 !== plannedRuntime.upstream.frontendInstalledTreeSha256) issues.push("frontend runtime tree changed");
    if (frontendPackageLockSha256 !== plannedRuntime.upstream.frontendPackageLockSha256) issues.push("frontend lock changed");
    if (serverRequirementsSha256 !== plannedRuntime.upstream.serverRequirementsSha256) issues.push("requirements changed");
  } catch (error) { issues.push(error instanceof Error ? error.message : String(error)); }
  const body = {
    schemaVersion: "pm.public-eval-corners.sentinel-production-checkout-preflight.v2" as const,
    checkoutPath: canonicalPath, repositoryUrl, revision, sourceTreeHash, cleanTrackedAndUntracked,
    ignoredArtifactRootSha256, ignoredPathListingBase64, ignoredPathListingSha256,
    databaseRootSha256, selectedScenarioRootSha256,
    frontendInstalledTreeSha256, frontendPackageLockSha256, serverRequirementsSha256,
    valid: issues.length === 0, issues,
  };
  return { ...body, preflightSha256: sentinelProductionJsonSha256(body) };
}

export function retainSentinelProductionScenario(
  checkoutPath: string, task: SentinelProductionTask, targetPath: string,
): SentinelProductionArtifactIdentity {
  const bytes = readFileSync(resolve(checkoutPath, sentinelProductionScenarioRelativePath(task)));
  const hash = sentinelProductionSha256(bytes);
  if (hash !== task.scenarioSha256) throw new Error("scenario changed after checkout preflight");
  writeFileSync(targetPath, bytes, { flag: "wx", mode: 0o400 });
  chmodSync(targetPath, 0o400);
  return { path: targetPath, byteLength: bytes.byteLength, sha256: hash };
}

export async function allocateSentinelProductionPorts(
  count: number, excluded: ReadonlySet<number>,
): Promise<readonly number[]> {
  const reservations: ReturnType<typeof createServer>[] = [], ports: number[] = [];
  try {
    while (ports.length < count) {
      const server = createServer();
      await new Promise<void>((accept, reject) => { server.once("error", reject); server.listen({ host: LOOPBACK_HOST, port: 0, exclusive: true }, accept); });
      const address = server.address();
      if (address === null || typeof address === "string") throw new Error("port allocator did not receive a TCP address");
      if (excluded.has(address.port) || ports.includes(address.port) || address.port < 1024) {
        await new Promise<void>((accept) => server.close(() => accept()));
      } else { reservations.push(server); ports.push(address.port); }
    }
  } finally {
    await Promise.all(reservations.map((server) => new Promise<void>((accept) => server.close(() => accept()))));
  }
  return ports;
}

function tenantBody(tenant: string, createdAt: string) {
  return { schemaVersion: "pm.public-eval-corners.sentinel-production-continuity-tenant.v1" as const,
    tenant, createdAt, initialCheckpointCount: 0 as const, initialCheckpointHeadSha256: null };
}
export async function createSentinelProductionContinuityTenant(input: {
  readonly databaseUrl: string; readonly tenant: string; readonly createdAt: string;
}): Promise<SentinelProductionContinuityTenantReceipt> {
  const pool = new pg.Pool({ connectionString: input.databaseUrl, max: 1 });
  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
    await client.query("INSERT INTO substrate.tenants(id, display_name, created_at) VALUES ($1,$2,$3)",
      [input.tenant, `Sentinel production evaluation ${input.tenant}`, input.createdAt]);
    const count = await client.query<{ count: string; head: string | null }>(
      `SELECT count(*)::text AS count, (array_agg(content_hash ORDER BY seq DESC))[1] AS head
         FROM continuity.checkpoints WHERE tenant_id = $1`, [input.tenant]);
    if (count.rows[0]?.count !== "0" || count.rows[0]?.head !== null) throw new Error("new continuity tenant was not empty");
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK").catch(() => {}); throw error; }
  finally { client.release(); await pool.end(); }
  const body = tenantBody(input.tenant, input.createdAt);
  return { ...body, receiptSha256: sentinelProductionJsonSha256(body) };
}

function jsonSafe(value: unknown): JsonValue {
  if (value === null || typeof value === "boolean" || typeof value === "string" || (typeof value === "number" && Number.isFinite(value))) return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (isRecord(value)) return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, jsonSafe(entry)]));
  throw new Error("database replay export contains a non-JSON value");
}
export async function exportSentinelProductionContinuityReplay(input: {
  readonly databaseUrl: string; readonly tenant: string; readonly agentId: string;
  readonly scope: string; readonly exportedAt: string;
}): Promise<SentinelProductionContinuityReplayExport> {
  const pool = new pg.Pool({ connectionString: input.databaseUrl, max: 1 });
  try {
    const tenant = await pool.query("SELECT id, display_name, created_at, archived_at FROM substrate.tenants WHERE id=$1", [input.tenant]);
    const checkpoints = await pool.query(
      `SELECT seq,id,tenant_id,agent_id,scope,kind,title,summary,evidence_event_ids,
              decision_refs,status,payload,created_at,content_hash,prior_checkpoint_hash
         FROM continuity.checkpoints WHERE tenant_id=$1 AND agent_id=$2 ORDER BY seq ASC`,
      [input.tenant, input.agentId]);
    if (tenant.rows.length !== 1) throw new Error("continuity replay tenant is missing");
    const rows = checkpoints.rows.map(jsonSafe);
    const last = rows.at(-1);
    const head = isRecord(last) && typeof last.content_hash === "string" ? last.content_hash : null;
    const body = { schemaVersion: "pm.public-eval-corners.sentinel-production-continuity-replay.v1" as const,
      tenant: input.tenant, agentId: input.agentId, scope: input.scope, exportedAt: input.exportedAt,
      tenantRow: jsonSafe(tenant.rows[0]), checkpoints: rows, checkpointCount: rows.length,
      checkpointHeadSha256: head };
    return { ...body, exportSha256: sentinelProductionJsonSha256(body) };
  } finally { await pool.end(); }
}

export function readSentinelProductionAttemptStartedAt(
  upstreamRoot: string,
  expectedStartReceiptHash: string,
  attemptId: string,
): string {
  const receipts = resolve(upstreamRoot, "receipts");
  const names = readdirSync(receipts).filter((name) =>
    name.startsWith("sentinel-production-attempt-start-") && name.endsWith(".json"));
  if (names.length !== 1) throw new Error("supervisor retained other than one attempt-start receipt");
  const path = resolve(receipts, names[0] as string);
  const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
  if (!isRecord(parsed) || !isRecord(parsed.plan)) throw new Error("attempt-start receipt is malformed");
  const keys = Object.keys(parsed).sort(compare).join("\0");
  if (keys !== ["evidenceEligible", "plan", "receiptHash", "schemaVersion", "startedAt"].sort(compare).join("\0")) {
    throw new Error("attempt-start receipt keys are not exact");
  }
  const { receiptHash, ...body } = parsed;
  if (
    parsed.schemaVersion !== "pm.public-eval-corners.sentinel-production-attempt-start.v1" ||
    parsed.evidenceEligible !== false ||
    parsed.plan.attemptId !== attemptId ||
    receiptHash !== expectedStartReceiptHash ||
    receiptHash !== sentinelProductionJsonSha256(body) ||
    typeof parsed.startedAt !== "string"
  ) throw new Error("attempt-start receipt is not bound to the supervisor terminal receipt");
  const date = new Date(parsed.startedAt);
  if (!Number.isFinite(date.valueOf()) || date.toISOString() !== parsed.startedAt) {
    throw new Error("attempt-start receipt timestamp is not canonical");
  }
  return parsed.startedAt;
}
