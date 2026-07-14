import { lstatSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, join, posix, relative, resolve } from "node:path";

import {
  SENTINEL_MATERIAL_LIFT_RULE,
  sentinelJsonSha256,
  sentinelLiveRequiredTasks,
  sentinelSha256,
  verifySentinelPreregistration,
  type SentinelLiveArm,
  type SentinelLiveCell,
  type SentinelLivePreregistration,
  type SentinelLiveTaskId,
  type SentinelPreregistrationSignature,
} from "./sentinel-live-plan.js";
import { sentinelOperationId } from "./sentinel-live-agent.js";
import {
  SENTINEL_STATE_CONTEXT_WIDTH,
  readSentinelStateAuditFile,
  verifySentinelStateSidecarEvidence,
  type SentinelStateAuditEntry,
  type SentinelStateFinalReceipt,
  type SentinelStateReadyReceipt,
} from "./sentinel-state-sidecar.js";

export type SentinelLiveArtifactRole =
  | "scenario-definition"
  | "upstream-result"
  | "browser-network"
  | "agent-start"
  | "agent-events"
  | "agent-terminal"
  | "agent-screenshot"
  | "state-ready"
  | "state-final"
  | "state-audit"
  | "provider-ready"
  | "provider-final"
  | "provider-audit"
  | "provider-operation"
  | "supervisor-start"
  | "supervisor-terminal"
  | "supporting";

export interface SentinelLiveArtifactIdentity {
  readonly role: SentinelLiveArtifactRole;
  readonly relativePath: string;
  readonly byteLength: number;
  readonly sha256: string;
}

export interface SentinelLiveCellEvidenceBinding {
  readonly schemaVersion: "pm.public-eval-corners.sentinel-cell-evidence-binding.v1";
  readonly preregistrationSha256: string;
  readonly cell: SentinelLiveCell;
  readonly artifactRoot: string;
  readonly artifacts: readonly SentinelLiveArtifactIdentity[];
  readonly bindingSha256: string;
}

export interface VerifySentinelLiveCellInput {
  readonly preregistration: SentinelLivePreregistration;
  readonly signature: SentinelPreregistrationSignature;
  readonly expectedPreregistrationSha256: string;
  readonly binding: SentinelLiveCellEvidenceBinding;
}

export interface SentinelRawFacts {
  readonly firstStars: number | null;
  readonly lastStars: number | null;
  readonly maximumStars: number | null;
  readonly contactGetCount: number;
  readonly contactPostCount: number;
  readonly semanticSuccess: boolean | null;
}

export interface SentinelProviderUsageEstimate {
  readonly inputTokens: number;
  readonly outputTokens: number;
  /** Estimate only, computed from the signed preregistration price schedule. */
  readonly estimatedUsd: number;
}

export interface SentinelLiveCellVerification {
  readonly schemaVersion: "pm.public-eval-corners.sentinel-cell-verification.v1";
  readonly preregistrationSha256: string;
  readonly cell: SentinelLiveCell;
  readonly valid: boolean;
  readonly infrastructureComplete: boolean;
  readonly upstreamSuccess: boolean | null;
  readonly rawCrossCheck: boolean | null;
  readonly rawFacts: SentinelRawFacts;
  readonly providerUsage: SentinelProviderUsageEstimate;
  readonly issues: readonly string[];
  readonly eligibleForIndependentAnalysis: false;
}

export interface SentinelMatrixCellCount {
  readonly taskId: SentinelLiveTaskId;
  readonly arm: SentinelLiveArm;
  readonly passes: number;
  readonly total: number;
}

export interface SentinelLiveMatrixAnalysis {
  readonly schemaVersion: "pm.public-eval-corners.sentinel-matrix-analysis.v1";
  readonly preregistrationSha256: string;
  readonly complete: boolean;
  readonly materialBenefit: boolean;
  readonly rule: typeof SENTINEL_MATERIAL_LIFT_RULE;
  readonly counts: readonly SentinelMatrixCellCount[];
  readonly providerUsage: SentinelProviderUsageEstimate;
  readonly issues: readonly string[];
  readonly eligibleForIndependentAnalysis: false;
}

type JsonRecord = Record<string, unknown>;
type LoadedArtifact = SentinelLiveArtifactIdentity & { readonly bytes: Buffer };

const SHA256 = /^[a-f0-9]{64}$/u;
const SAFE_INTEGER_TEXT = /^(?:0|[1-9][0-9]{0,8})$/u;
const EXACT_ONE_ROLES: readonly SentinelLiveArtifactRole[] = [
  "upstream-result", "browser-network", "agent-start",
  "agent-events", "state-ready", "state-final", "state-audit", "provider-ready",
  "provider-final", "supervisor-start", "supervisor-terminal",
];
const RESULT_KEYS = [
  "condition_at", "contact_get_time", "contact_message", "contact_post_time",
  "detail", "evaluation_time", "success",
] as const;
const EVENT_KEYS = [
  "action", "browserObservationValue", "observedAt", "poll", "providerExchangeHash", "providerOperationId",
  "reason", "schemaVersion", "screenshotPath", "screenshotSha256",
  "stateReadContextSha256", "stateReadOperationId", "stateWriteContextSha256",
  "stateWriteOperationId", "stateWriteValueSha256",
] as const;
const NETWORK_KEYS = [
  "bodyBase64", "bodySha256", "byteLength", "contentType", "method", "recordedAt",
  "schemaVersion", "status", "url",
] as const;
const EMPTY_STATE_CONTEXT = "NO_RELEVANT_BROWSER_OBSERVATION".padEnd(
  SENTINEL_STATE_CONTEXT_WIDTH,
  " ",
);
const WRITE_STATE_CONTEXT = "BROWSER_OBSERVATION_REVIEWED".padEnd(
  SENTINEL_STATE_CONTEXT_WIDTH,
  " ",
);
const TASK_ORACLE: Readonly<Record<SentinelLiveTaskId, {
  readonly conditionAt: number | null;
  readonly threshold: number;
}>> = {
  "microhub-stars-relative-passive": { conditionAt: 565.42 / 4, threshold: 200 },
  "microhub-stars-noop": { conditionAt: null, threshold: 100_000 },
  "microhub-stars-absolute-passive": { conditionAt: 587.31 / 4, threshold: 2_000 },
};

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value: unknown, expected: readonly string[]): boolean {
  return isRecord(value) &&
    Object.keys(value).sort().join("\0") === [...expected].sort().join("\0");
}

function canonicalWithout(value: JsonRecord, key: string): string {
  const body = { ...value };
  delete body[key];
  return sentinelJsonSha256(body);
}

function finiteNumberOrNull(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value) && value >= 0);
}

function nonNegativeIntegerOrNull(value: unknown): value is number | null {
  return value === null || nonNegativeInteger(value);
}

function nonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function canonicalTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const date = new Date(value);
  return Number.isFinite(date.valueOf()) && date.toISOString() === value;
}

function parseJson(bytes: Uint8Array, label: string, issues: string[]): unknown {
  try {
    return JSON.parse(Buffer.from(bytes).toString("utf8")) as unknown;
  } catch {
    issues.push(`${label} is not valid JSON`);
    return null;
  }
}

function parseJsonLines(bytes: Uint8Array, label: string, issues: string[]): readonly unknown[] {
  const text = Buffer.from(bytes).toString("utf8");
  if (text.length === 0 || !text.endsWith("\n")) {
    issues.push(`${label} must be non-empty newline-terminated JSONL`);
    return [];
  }
  return text.trimEnd().split("\n").map((line, index) => {
    try {
      return JSON.parse(line) as unknown;
    } catch {
      issues.push(`${label} line ${index + 1} is not valid JSON`);
      return null;
    }
  });
}

function portableRelativePath(path: string): boolean {
  return path.length > 0 && path.length <= 512 && !isAbsolute(path) && !path.includes("\\") &&
    posix.normalize(path) === path && path !== "." && !path.startsWith("../") &&
    !path.includes("/../") && !path.startsWith("./") && !path.includes("//");
}

function inventory(root: string, base = root): readonly string[] {
  const output: string[] = [];
  for (const entry of readdirSync(root).sort()) {
    const path = join(root, entry);
    const stat = lstatSync(path);
    if (stat.isSymbolicLink()) throw new Error(`artifact tree contains symlink ${relative(base, path)}`);
    if (stat.isDirectory()) output.push(...inventory(path, base));
    else if (stat.isFile()) output.push(relative(base, path).split("\\").join("/"));
    else throw new Error(`artifact tree contains non-file ${relative(base, path)}`);
    if (output.length > 50_000) throw new Error("artifact inventory exceeds 50,000 files");
  }
  return output;
}

function loadArtifacts(
  binding: SentinelLiveCellEvidenceBinding,
  issues: string[],
): ReadonlyMap<string, LoadedArtifact> {
  const loaded = new Map<string, LoadedArtifact>();
  if (!isAbsolute(binding.artifactRoot) || resolve(binding.artifactRoot) !== binding.artifactRoot) {
    issues.push("artifactRoot must be absolute and normalized");
    return loaded;
  }
  try {
    const rootStat = lstatSync(binding.artifactRoot);
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink() || realpathSync(binding.artifactRoot) !== binding.artifactRoot) {
      issues.push("artifactRoot must be a real non-symlink directory");
      return loaded;
    }
  } catch {
    issues.push("artifactRoot does not exist");
    return loaded;
  }
  for (const identity of binding.artifacts) {
    if (!exactKeys(identity, ["byteLength", "relativePath", "role", "sha256"])) {
      issues.push("artifact identity keys are not exact");
      continue;
    }
    if (!portableRelativePath(identity.relativePath) || loaded.has(identity.relativePath)) {
      issues.push(`artifact path is unsafe or duplicated: ${identity.relativePath}`);
      continue;
    }
    if (!nonNegativeInteger(identity.byteLength) || !SHA256.test(identity.sha256)) {
      issues.push(`artifact identity is invalid: ${identity.relativePath}`);
      continue;
    }
    const path = resolve(binding.artifactRoot, identity.relativePath);
    try {
      const stat = lstatSync(path);
      if (!stat.isFile() || stat.isSymbolicLink() || !path.startsWith(`${binding.artifactRoot}/`)) {
        throw new Error("not a contained regular file");
      }
      const bytes = readFileSync(path);
      if (bytes.byteLength !== identity.byteLength || sentinelSha256(bytes) !== identity.sha256) {
        issues.push(`artifact identity does not match bytes: ${identity.relativePath}`);
      }
      loaded.set(identity.relativePath, { ...identity, bytes });
    } catch {
      issues.push(`artifact cannot be read safely: ${identity.relativePath}`);
    }
  }
  try {
    const actual = [...inventory(binding.artifactRoot)].sort();
    const declared = [...loaded.keys()].sort();
    if (actual.join("\0") !== declared.join("\0")) {
      issues.push("artifact identities do not exactly inventory the cell artifact root");
    }
  } catch (error) {
    issues.push(error instanceof Error ? error.message : String(error));
  }
  return loaded;
}

function byRole(
  artifacts: ReadonlyMap<string, LoadedArtifact>,
  role: SentinelLiveArtifactRole,
): readonly LoadedArtifact[] {
  return [...artifacts.values()].filter((artifact) => artifact.role === role);
}

function onlyRole(
  artifacts: ReadonlyMap<string, LoadedArtifact>,
  role: SentinelLiveArtifactRole,
  issues: string[],
): LoadedArtifact | undefined {
  const matches = byRole(artifacts, role);
  if (matches.length !== 1) issues.push(`artifact role ${role} must occur exactly once`);
  return matches.length === 1 ? matches[0] : undefined;
}

function bindingBody(binding: SentinelLiveCellEvidenceBinding): JsonRecord {
  return {
    schemaVersion: binding.schemaVersion,
    preregistrationSha256: binding.preregistrationSha256,
    cell: binding.cell,
    artifactRoot: binding.artifactRoot,
    artifacts: binding.artifacts,
  };
}

export function sentinelLiveCellBindingSha256(
  binding: Omit<SentinelLiveCellEvidenceBinding, "bindingSha256">,
): string {
  return sentinelJsonSha256(binding as unknown as JsonRecord);
}

function sameCell(actual: SentinelLiveCell, expected: SentinelLiveCell): boolean {
  return sentinelJsonSha256(actual) === sentinelJsonSha256(expected);
}

interface UpstreamResult {
  readonly success: boolean;
  readonly detail: string;
  readonly evaluationTime: number | null;
  readonly conditionAt: number | null;
  readonly contactGetTime: number | null;
  readonly contactPostTime: number | null;
  readonly contactMessage: string | null;
}

function verifyResult(value: unknown, taskId: SentinelLiveTaskId, issues: string[]): UpstreamResult | null {
  if (!exactKeys(value, RESULT_KEYS)) {
    issues.push("upstream results.json keys are not exact");
    return null;
  }
  const result = value as JsonRecord;
  if (typeof result.success !== "boolean" || typeof result.detail !== "string" ||
      !finiteNumberOrNull(result.evaluation_time) || !finiteNumberOrNull(result.condition_at) ||
      !nonNegativeIntegerOrNull(result.contact_get_time) || !nonNegativeIntegerOrNull(result.contact_post_time) ||
      (result.contact_message !== null && typeof result.contact_message !== "string")) {
    issues.push("upstream results.json values do not match the strict schema");
    return null;
  }
  if (result.condition_at !== TASK_ORACLE[taskId].conditionAt) {
    issues.push("upstream result condition_at does not match the pinned scenario");
  }
  if ((result.contact_get_time === null) !== (result.contact_post_time === null) ||
      (result.contact_get_time === null) !== (result.contact_message === null) ||
      (typeof result.contact_get_time === "number" && typeof result.contact_post_time === "number" &&
       result.contact_post_time < result.contact_get_time)) {
    issues.push("upstream contact fields are inconsistent");
  }
  return {
    success: result.success,
    detail: result.detail,
    evaluationTime: result.evaluation_time,
    conditionAt: result.condition_at,
    contactGetTime: result.contact_get_time,
    contactPostTime: result.contact_post_time,
    contactMessage: result.contact_message,
  };
}

interface AgentEvent {
  readonly poll: number;
  readonly browserObservationValue: string;
  readonly screenshotPath: string;
  readonly screenshotSha256: string;
  readonly observedAt: string;
  readonly stateReadOperationId: string;
  readonly stateReadContextSha256: string;
  readonly providerOperationId: string;
  readonly providerExchangeHash: string;
  readonly stateWriteOperationId: string;
  readonly stateWriteContextSha256: string;
  readonly stateWriteValueSha256: string;
  readonly action: "wait" | "contact";
  readonly reason: string;
}

function verifyAgentEvents(
  artifacts: ReadonlyMap<string, LoadedArtifact>,
  attemptId: string,
  issues: string[],
): readonly AgentEvent[] {
  const file = onlyRole(artifacts, "agent-events", issues);
  if (!file) return [];
  const values = parseJsonLines(file.bytes, "agent events", issues);
  const events: AgentEvent[] = [];
  const screenshotDir = dirname(file.relativePath);
  for (const [index, value] of values.entries()) {
    if (!exactKeys(value, EVENT_KEYS)) {
      issues.push(`agent event ${index + 1} keys are not exact`);
      continue;
    }
    const event = value as JsonRecord;
    const poll = index + 1;
    const expectedName = `poll-${String(poll).padStart(4, "0")}.png`;
    if (event.schemaVersion !== "pm.public-eval-corners.sentinel-agent-poll.v1" ||
        event.poll !== poll || event.screenshotPath !== expectedName ||
        typeof event.browserObservationValue !== "string" || !SAFE_INTEGER_TEXT.test(event.browserObservationValue) ||
        typeof event.screenshotSha256 !== "string" || !SHA256.test(event.screenshotSha256) ||
        !canonicalTimestamp(event.observedAt) || event.action !== "wait" && event.action !== "contact" ||
        typeof event.reason !== "string" || event.reason.length === 0 || event.reason.length > 4_096) {
      issues.push(`agent event ${poll} has invalid values`);
      continue;
    }
    const expectedOperations = {
      read: sentinelOperationId(attemptId, poll, "state-read"),
      provider: sentinelOperationId(attemptId, poll, "provider-decision"),
      write: sentinelOperationId(attemptId, poll, "state-write"),
    };
    if (event.stateReadOperationId !== expectedOperations.read ||
        event.providerOperationId !== expectedOperations.provider ||
        event.stateWriteOperationId !== expectedOperations.write) {
      issues.push(`agent event ${poll} operation IDs do not bind the attempt`);
    }
    for (const key of ["stateReadContextSha256", "providerExchangeHash", "stateWriteContextSha256", "stateWriteValueSha256"] as const) {
      if (typeof event[key] !== "string" || !SHA256.test(event[key])) {
        issues.push(`agent event ${poll} ${key} is invalid`);
      }
    }
    const screenshotPath = screenshotDir === "." ? expectedName : `${screenshotDir}/${expectedName}`;
    const screenshot = artifacts.get(screenshotPath);
    if (!screenshot || screenshot.role !== "agent-screenshot" ||
        screenshot.sha256 !== event.screenshotSha256) {
      issues.push(`agent event ${poll} does not bind its screenshot bytes`);
    }
    events.push(event as unknown as AgentEvent);
  }
  if (events.length === 0 || byRole(artifacts, "agent-screenshot").length !== events.length) {
    issues.push("agent events must bind a non-empty one-to-one screenshot set");
  }
  if (events.some((event, index) => event.action === "contact" && index !== events.length - 1) ||
      events.filter(({ action }) => action === "contact").length > 1) {
    issues.push("agent events contain an early or repeated contact action");
  }
  return events;
}

interface NetworkFacts {
  readonly stars: readonly number[];
  readonly getCount: number;
  readonly postCount: number;
}

function verifyNetwork(file: LoadedArtifact | undefined, issues: string[]): NetworkFacts {
  if (!file) return { stars: [], getCount: 0, postCount: 0 };
  const stars: number[] = [];
  let getCount = 0;
  let postCount = 0;
  for (const [index, value] of parseJsonLines(file.bytes, "browser network", issues).entries()) {
    if (!exactKeys(value, NETWORK_KEYS)) {
      issues.push(`browser network entry ${index + 1} keys are not exact`);
      continue;
    }
    const entry = value as JsonRecord;
    if (entry.schemaVersion !== "pm.public-eval-corners.sentinel-browser-response.v1" ||
        !canonicalTimestamp(entry.recordedAt) || typeof entry.url !== "string" ||
        typeof entry.method !== "string" || !nonNegativeInteger(entry.status) ||
        typeof entry.contentType !== "string" || !nonNegativeInteger(entry.byteLength) ||
        typeof entry.bodySha256 !== "string" || !SHA256.test(entry.bodySha256) ||
        typeof entry.bodyBase64 !== "string") {
      issues.push(`browser network entry ${index + 1} is invalid`);
      continue;
    }
    let url: URL;
    try { url = new URL(entry.url); } catch {
      issues.push(`browser network entry ${index + 1} URL is invalid`);
      continue;
    }
    const body = Buffer.from(entry.bodyBase64, "base64");
    if (body.toString("base64") !== entry.bodyBase64 || body.byteLength !== entry.byteLength ||
        sentinelSha256(body) !== entry.bodySha256) {
      issues.push(`browser network entry ${index + 1} body identity is invalid`);
      continue;
    }
    if (url.pathname === "/api/data/microhub-repository") {
      const parsed = parseJson(body, `repository response ${index + 1}`, issues);
      const repository = isRecord(parsed) && isRecord(parsed.repository) ? parsed.repository : null;
      if (!isRecord(parsed) || parsed.success !== true || repository === null ||
          !nonNegativeInteger(repository.stars)) {
        issues.push(`repository response ${index + 1} lacks a safe star count`);
      } else {
        stars.push(repository.stars);
      }
    }
    if (url.pathname === "/contact") {
      if (entry.status !== 200 || !String(entry.contentType).toLowerCase().includes("text/html")) {
        issues.push(`contact response ${index + 1} is not a successful HTML response`);
      }
      if (entry.method === "GET") getCount += 1;
      else if (entry.method === "POST") postCount += 1;
      else issues.push(`contact response ${index + 1} uses an unexpected method`);
    }
  }
  if (stars.length < 2) issues.push("browser network lacks immutable initial and terminal repository observations");
  if (getCount > 1 || postCount > 1 || getCount !== postCount) {
    issues.push("browser network contains missing, unmatched, or extra contact requests");
  }
  return { stars, getCount, postCount };
}

function verifyPollObservationsAgainstNetwork(
  events: readonly AgentEvent[],
  network: NetworkFacts,
  issues: string[],
): void {
  let cursor = 0;
  for (const event of events) {
    const value = Number(event.browserObservationValue);
    const index = network.stars.findIndex((stars, candidate) => candidate >= cursor && stars === value);
    if (index < 0) {
      issues.push(`poll ${event.poll} browser observation is absent from captured repository responses`);
    } else {
      cursor = index + 1;
    }
  }
}

function admittedPayload(entry: SentinelStateAuditEntry): JsonRecord | null {
  const admitted = entry.admittedEvidence as unknown;
  if (!isRecord(admitted) || !isRecord(admitted.evidence) || !isRecord(admitted.evidence.payload)) return null;
  return admitted.evidence.payload;
}

function verifyState(
  artifacts: ReadonlyMap<string, LoadedArtifact>,
  events: readonly AgentEvent[],
  arm: SentinelLiveArm,
  issues: string[],
): void {
  const readyFile = onlyRole(artifacts, "state-ready", issues);
  const finalFile = onlyRole(artifacts, "state-final", issues);
  const auditFile = onlyRole(artifacts, "state-audit", issues);
  if (!readyFile || !finalFile || !auditFile) return;
  const readyValue = parseJson(readyFile.bytes, "state ready receipt", issues);
  const finalValue = parseJson(finalFile.bytes, "state final receipt", issues);
  if (!exactKeys(readyValue, ["auditGenesisSha256", "endpoint", "initialStateSha256", "minimumLatencyMs", "pid", "receiptSha256", "schemaVersion", "startedAt", "tokenSha256"]) ||
      !exactKeys(finalValue, ["admissionReviews", "auditEntryCount", "auditHeadSha256", "finalizedAt", "pid", "readyReceiptFileSha256", "receiptSha256", "requestCounts", "schemaVersion", "startedAt", "stateSha256", "tokenSha256"])) {
    issues.push("state sidecar receipt keys are not exact");
    return;
  }
  let entries: readonly SentinelStateAuditEntry[] = [];
  try { entries = readSentinelStateAuditFile(resolve(artifactsRoot(artifacts), auditFile.relativePath)); }
  catch { entries = parseJsonLines(auditFile.bytes, "state audit", issues) as SentinelStateAuditEntry[]; }
  for (const [index, entry] of entries.entries()) {
    if (!exactKeys(entry, ["admissionReview", "admittedEvidence", "authenticated", "entrySha256", "httpStatus", "operationId", "previousEntrySha256", "recordedAt", "rejectionReason", "requestKind", "requestSha256", "responseStatus", "schemaVersion", "sequence", "stateSha256"])) {
      issues.push(`state audit entry ${index + 1} keys are not exact`);
    }
  }
  try {
    const verified = verifySentinelStateSidecarEvidence(
      readyValue as SentinelStateReadyReceipt,
      finalValue as SentinelStateFinalReceipt,
      entries,
    );
    issues.push(...verified.issues.map((issue) => `state sidecar: ${issue}`));
  } catch {
    issues.push("state sidecar evidence could not be verified");
  }
  if (entries.length !== events.length * 2) issues.push("state audit is not exactly one read and one write per poll");
  let firstPayload: JsonRecord | null = null;
  for (const [index, event] of events.entries()) {
    const read = entries[index * 2];
    const write = entries[index * 2 + 1];
    if (!read || !write || read.requestKind !== "read" || write.requestKind !== "write" ||
        read.operationId !== event.stateReadOperationId || write.operationId !== event.stateWriteOperationId ||
        !read.authenticated || !write.authenticated || read.httpStatus !== 200 || write.httpStatus !== 200 ||
        read.responseStatus !== "ok" || write.responseStatus !== "ok") {
      issues.push(`state audit does not bind poll ${index + 1}`);
      continue;
    }
    const payload = admittedPayload(write);
    if (!payload || payload.memoryKey !== "microhub.star-count" || payload.source !== "browser_observation" ||
        payload.observedAt !== event.observedAt || typeof payload.value !== "string" ||
        !SAFE_INTEGER_TEXT.test(payload.value) || payload.value !== event.browserObservationValue ||
        sentinelSha256(payload.value) !== event.stateWriteValueSha256) {
      issues.push(`state write evidence does not bind poll ${index + 1}`);
      continue;
    }
    firstPayload ??= payload;
    const readRequest = JSON.stringify({
      schemaVersion: "pm.public-eval-corners.sentinel-state-read.v1",
      operationId: event.stateReadOperationId,
      memoryKey: "microhub.star-count",
    });
    const writeRequest = JSON.stringify({
      schemaVersion: "pm.public-eval-corners.sentinel-state-write.v1",
      operationId: event.stateWriteOperationId,
      memoryKey: "microhub.star-count",
      observation: { source: "browser_observation", observedAt: event.observedAt, value: payload.value },
    });
    if (read.requestSha256 !== sentinelSha256(readRequest) || write.requestSha256 !== sentinelSha256(writeRequest)) {
      issues.push(`state request hashes do not bind poll ${index + 1}`);
    }
    const expectedRead = arm === "substrate" && index > 0 && firstPayload
      ? `memory_key=microhub.star-count; observed_at=${String(firstPayload.observedAt)}; browser_observation=${String(firstPayload.value)}`.padEnd(SENTINEL_STATE_CONTEXT_WIDTH, " ")
      : EMPTY_STATE_CONTEXT;
    if (event.stateReadContextSha256 !== sentinelSha256(expectedRead) ||
        event.stateWriteContextSha256 !== sentinelSha256(WRITE_STATE_CONTEXT)) {
      issues.push(`state response context hashes do not implement ${arm} at poll ${index + 1}`);
    }
  }
  const ready = readyValue as JsonRecord;
  const final = finalValue as JsonRecord;
  if (arm === "native" ? final.stateSha256 !== ready.initialStateSha256 : final.stateSha256 === ready.initialStateSha256) {
    issues.push(`state persistence does not implement the declared ${arm} arm`);
  }
}

// The map stores only relative paths, so recover the root from a non-enumerable marker set below.
const ARTIFACT_ROOT = Symbol("artifactRoot");
function artifactsRoot(artifacts: ReadonlyMap<string, LoadedArtifact>): string {
  return (artifacts as unknown as { [ARTIFACT_ROOT]: string })[ARTIFACT_ROOT] ?? "";
}

function verifyReceiptHash(value: unknown, label: string, issues: string[]): JsonRecord | null {
  if (!isRecord(value) || typeof value.receiptHash !== "string" || !SHA256.test(value.receiptHash) ||
      canonicalWithout(value, "receiptHash") !== value.receiptHash) {
    issues.push(`${label} receipt hash is invalid`);
    return null;
  }
  return value;
}

interface ProviderAction {
  readonly action: "wait" | "contact";
  readonly stateWrite: string;
  readonly reason: string;
}

function parseAnthropicResponse(value: unknown, model: string, issues: string[]): { readonly usage: JsonRecord; readonly action: ProviderAction } | null {
  if (!isRecord(value) || value.model !== model || !isRecord(value.usage) ||
      !nonNegativeInteger(value.usage.input_tokens) || !nonNegativeInteger(value.usage.output_tokens) ||
      !Array.isArray(value.content) || value.content.length !== 1 || !isRecord(value.content[0]) ||
      value.content[0].type !== "text" || typeof value.content[0].text !== "string") {
    issues.push("provider raw response has invalid Anthropic model, usage, or content");
    return null;
  }
  let actionValue: unknown;
  try { actionValue = JSON.parse(value.content[0].text) as unknown; }
  catch { issues.push("provider response action is not JSON"); return null; }
  if (!exactKeys(actionValue, ["action", "reason", "stateWrite"])) {
    issues.push("provider response action keys are not exact");
    return null;
  }
  const action = actionValue as JsonRecord;
  if (action.action !== "wait" && action.action !== "contact" ||
      typeof action.stateWrite !== "string" || !SAFE_INTEGER_TEXT.test(action.stateWrite) ||
      typeof action.reason !== "string" || action.reason.length === 0) {
    issues.push("provider response action values are invalid");
    return null;
  }
  return { usage: value.usage, action: action as unknown as ProviderAction };
}

function artifactFromProviderRef(
  reference: unknown,
  providerRoot: string,
  artifacts: ReadonlyMap<string, LoadedArtifact>,
  issues: string[],
): LoadedArtifact | null {
  if (!exactKeys(reference, ["byteLength", "path", "sha256"])) {
    issues.push("provider artifact reference keys are not exact");
    return null;
  }
  const ref = reference as JsonRecord;
  if (typeof ref.path !== "string" || !portableRelativePath(ref.path) ||
      !nonNegativeInteger(ref.byteLength) || typeof ref.sha256 !== "string" || !SHA256.test(ref.sha256)) {
    issues.push("provider artifact reference is invalid");
    return null;
  }
  const path = providerRoot === "." ? ref.path : `${providerRoot}/${ref.path}`;
  const artifact = artifacts.get(path);
  if (!artifact || artifact.role !== "provider-operation" || artifact.byteLength !== ref.byteLength || artifact.sha256 !== ref.sha256) {
    issues.push(`provider artifact reference does not bind ${path}`);
    return null;
  }
  return artifact;
}

function verifyProvider(
  artifacts: ReadonlyMap<string, LoadedArtifact>,
  events: readonly AgentEvent[],
  preregistration: SentinelLivePreregistration,
  issues: string[],
): SentinelProviderUsageEstimate {
  let inputTokens = 0;
  let outputTokens = 0;
  const estimate = (): SentinelProviderUsageEstimate => ({
    inputTokens,
    outputTokens,
    estimatedUsd: (
      inputTokens * preregistration.model.pricing.baseInputUsdPerMillionTokens +
      outputTokens * preregistration.model.pricing.outputUsdPerMillionTokens
    ) / 1_000_000,
  });
  const readyFile = onlyRole(artifacts, "provider-ready", issues);
  const finalFile = onlyRole(artifacts, "provider-final", issues);
  if (!readyFile || !finalFile) return estimate();
  const ready = verifyReceiptHash(parseJson(readyFile.bytes, "provider ready", issues), "provider ready", issues);
  const final = verifyReceiptHash(parseJson(finalFile.bytes, "provider final", issues), "provider final", issues);
  if (!ready || !final) return estimate();
  if (ready.pinnedModel !== preregistration.model.model ||
      ready.providerEndpoint !== preregistration.model.endpoint ||
      ready.noAutomaticRetries !== true || ready.statelessProviderConversation !== true ||
      final.readyReceiptHash !== ready.receiptHash || final.automaticRetryCount !== 0 ||
      final.acceptedOperationCount !== events.length || final.successfulOperationCount !== events.length ||
      final.terminalFailureCount !== 0) {
    issues.push("provider ready/final receipts do not bind the preregistered no-retry execution");
  }
  const auditFiles = byRole(artifacts, "provider-audit");
  const audits = auditFiles.map((file) => parseJson(file.bytes, `provider audit ${file.relativePath}`, issues));
  const records = audits.filter(isRecord).sort((left, right) => Number(left.sequence) - Number(right.sequence));
  let previous: string | null = null;
  const referenced = new Set<string>();
  const providerRoot = dirname(readyFile.relativePath);
  if (records.length !== events.length * 2 || final.auditRecordCount !== records.length) {
    issues.push("provider audit is not exactly one start and one terminal record per poll");
  }
  for (const [index, record] of records.entries()) {
    if (record.sequence !== index + 1 || record.previousRecordHash !== previous ||
        typeof record.recordHash !== "string" || canonicalWithout(record, "recordHash") !== record.recordHash) {
      issues.push(`provider audit record ${index + 1} hash chain is invalid`);
    }
    previous = typeof record.recordHash === "string" ? record.recordHash : previous;
  }
  if (final.finalAuditHeadHash !== previous) issues.push("provider final receipt does not bind the audit head");
  for (const [index, event] of events.entries()) {
    const started = records[index * 2];
    const terminal = records[index * 2 + 1];
    if (!started || !terminal || started.stage !== "attempt-started" || terminal.stage !== "attempt-terminal" ||
        started.operationId !== event.providerOperationId || terminal.operationId !== event.providerOperationId ||
        started.attemptNumber !== 1 || terminal.attemptNumber !== 1 ||
        started.automaticRetryCount !== 0 || terminal.automaticRetryCount !== 0 ||
        terminal.terminalStatus !== "succeeded" || terminal.terminalCode !== "succeeded" ||
        terminal.providerHttpStatus !== 200 || terminal.returnedModel !== preregistration.model.model ||
        typeof terminal.providerRequestId !== "string" || terminal.providerRequestId.length === 0 ||
        terminal.recordHash !== event.providerExchangeHash) {
      issues.push(`provider audit does not bind successful poll ${index + 1}`);
      continue;
    }
    const request = isRecord(started.request) ? started.request : null;
    const requestBody = artifactFromProviderRef(request?.body, providerRoot, artifacts, issues);
    const requestHeaders = artifactFromProviderRef(request?.sanitizedHeaders, providerRoot, artifacts, issues);
    const responseBody = artifactFromProviderRef(terminal.responseBody, providerRoot, artifacts, issues);
    for (const artifact of [requestBody, requestHeaders, responseBody]) if (artifact) referenced.add(artifact.relativePath);
    if (request?.authorizationCaptured !== false) issues.push(`provider poll ${index + 1} captured authorization`);
    if (!requestBody || !requestHeaders || !responseBody) continue;
    const outbound = parseJson(requestBody.bytes, `provider request ${index + 1}`, issues);
    const headers = parseJson(requestHeaders.bytes, `provider headers ${index + 1}`, issues);
    const inbound = parseJson(responseBody.bytes, `provider response ${index + 1}`, issues);
    if (!isRecord(outbound) || outbound.model !== preregistration.model.model ||
        outbound.temperature !== 0 || outbound.max_tokens !== preregistration.model.maxCompletionTokens) {
      issues.push(`provider request ${index + 1} changed the preregistered model settings`);
    }
    if (!isRecord(headers) || headers.method !== "POST" || headers.url !== preregistration.model.endpoint ||
        !isRecord(headers.headers) || headers.headers["anthropic-version"] !== preregistration.model.apiVersion ||
        Object.hasOwn(headers.headers, "x-api-key") || Object.hasOwn(headers.headers, "authorization")) {
      issues.push(`provider request ${index + 1} headers are not sanitized Anthropic headers`);
    }
    const parsed = parseAnthropicResponse(inbound, preregistration.model.model, issues);
    if (!parsed) continue;
    inputTokens += Number(parsed.usage.input_tokens);
    outputTokens += Number(parsed.usage.output_tokens);
    if ((parsed.usage.cache_creation_input_tokens !== undefined && parsed.usage.cache_creation_input_tokens !== 0) ||
        (parsed.usage.cache_read_input_tokens !== undefined && parsed.usage.cache_read_input_tokens !== 0)) {
      issues.push(`provider response ${index + 1} used prompt caching despite the signed no-cache plan`);
    }
    if (sentinelJsonSha256(parsed.usage) !== sentinelJsonSha256(terminal.usage) ||
        parsed.action.action !== event.action || parsed.action.reason !== event.reason ||
        parsed.action.stateWrite !== event.browserObservationValue ||
        sentinelSha256(parsed.action.stateWrite) !== event.stateWriteValueSha256) {
      issues.push(`provider response ${index + 1} does not bind usage or agent event output`);
    }
    const content = isRecord(outbound) && Array.isArray(outbound.messages) && isRecord(outbound.messages[0])
      ? outbound.messages[0].content : null;
    const image = Array.isArray(content) ? content.find((part) => isRecord(part) && part.type === "image") : null;
    const text = Array.isArray(content) ? content.find((part) => isRecord(part) && part.type === "text") : null;
    if (!isRecord(image) || image.source === undefined || !isRecord(image.source) ||
        typeof image.source.data !== "string" || sentinelSha256(Buffer.from(image.source.data, "base64")) !== event.screenshotSha256 ||
        !isRecord(text) || typeof text.text !== "string") {
      issues.push(`provider request ${index + 1} does not bind the screenshot and text input`);
    } else {
      let textPayload: unknown;
      try { textPayload = JSON.parse(text.text) as unknown; } catch { textPayload = null; }
      if (!isRecord(textPayload) || typeof textPayload.stateContext !== "string" ||
          sentinelSha256(textPayload.stateContext) !== event.stateReadContextSha256) {
        issues.push(`provider request ${index + 1} does not bind the state context`);
      }
    }
  }
  const operationPaths = byRole(artifacts, "provider-operation").map(({ relativePath }) => relativePath).sort();
  if (operationPaths.join("\0") !== [...referenced].sort().join("\0")) {
    issues.push("provider operation inventory contains missing or unreferenced files");
  }
  return estimate();
}

function verifySupervisor(
  artifacts: ReadonlyMap<string, LoadedArtifact>,
  cell: SentinelLiveCell,
  resultIdentity: LoadedArtifact | undefined,
  issues: string[],
): { readonly attemptId: string | null; readonly succeeded: boolean; readonly plan: JsonRecord | null } {
  const startFile = onlyRole(artifacts, "supervisor-start", issues);
  const terminalFile = onlyRole(artifacts, "supervisor-terminal", issues);
  if (!startFile || !terminalFile) return { attemptId: null, succeeded: false, plan: null };
  const start = verifyReceiptHash(parseJson(startFile.bytes, "supervisor start", issues), "supervisor start", issues);
  const terminal = verifyReceiptHash(parseJson(terminalFile.bytes, "supervisor terminal", issues), "supervisor terminal", issues);
  if (!start || !terminal || !isRecord(start.plan)) return { attemptId: null, succeeded: false, plan: null };
  if (!exactKeys(start, ["evidenceEligible", "plan", "receiptHash", "schemaVersion", "startedAt"]) ||
      !exactKeys(terminal, ["attemptId", "checkoutAfter", "checkoutBefore", "collateral", "evidenceEligible", "failureMessage", "failureStage", "processes", "receiptHash", "resultArtifacts", "resultJsonPath", "resultJsonSha256", "schemaVersion", "startReceiptHash", "status", "taskId"])) {
    issues.push("supervisor receipt keys are not exact");
  }
  const plan = start.plan;
  if (!exactKeys(plan, ["agentConfig", "attemptId", "checkoutBefore", "checkoutPath", "collateralInitial", "collateralInitialRootSha256", "commands", "environmentBindings", "evidenceEligible", "frontendUrl", "outputRoot", "planHash", "scenario", "schemaVersion", "serverUrl", "speedFactor", "taskId", "timeouts"])) {
    issues.push("supervisor plan keys are not exact");
  }
  const attemptId = typeof plan.attemptId === "string" ? plan.attemptId : null;
  const checkoutKeys = ["actualRepositoryUrl", "actualRevision", "clean", "expectedRepositoryUrl", "expectedRevision", "issues", "valid"] as const;
  if (plan.schemaVersion !== "pm.public-eval-corners.sentinel-attempt-plan.v1" ||
      plan.taskId !== cell.taskId || plan.speedFactor !== 4 || plan.evidenceEligible !== false ||
      typeof plan.planHash !== "string" || canonicalWithout(plan, "planHash") !== plan.planHash ||
      !isRecord(plan.scenario) || plan.scenario.sha256 !== sentinelLiveRequiredTasks[cell.taskId].scenarioSha256 ||
      !exactKeys(plan.scenario, ["path", "sha256"]) ||
      !isRecord(plan.checkoutBefore) || !exactKeys(plan.checkoutBefore, checkoutKeys) ||
      plan.checkoutBefore.valid !== true || plan.checkoutBefore.clean !== true ||
      plan.checkoutBefore.actualRevision !== "0faca33cc58ea62e97a928b67cd3beec7176b408" ||
      plan.checkoutBefore.expectedRevision !== "0faca33cc58ea62e97a928b67cd3beec7176b408") {
    issues.push("supervisor start plan does not bind the exact task, scenario, and clean checkout");
  }
  if (terminal.schemaVersion !== "pm.public-eval-corners.sentinel-attempt-terminal.v1" ||
      terminal.evidenceEligible !== false || terminal.attemptId !== attemptId || terminal.taskId !== cell.taskId ||
      terminal.startReceiptHash !== start.receiptHash || terminal.status !== "succeeded" ||
      terminal.failureStage !== null || terminal.failureMessage !== null ||
      terminal.resultJsonSha256 !== resultIdentity?.sha256 || typeof terminal.resultJsonPath !== "string" ||
      !terminal.resultJsonPath.endsWith(`/microhub/${cell.taskId}/results.json`) ||
      !isRecord(terminal.checkoutBefore) || !exactKeys(terminal.checkoutBefore, checkoutKeys) ||
      terminal.checkoutBefore.valid !== true || terminal.checkoutBefore.clean !== true ||
      !isRecord(terminal.checkoutAfter) || !exactKeys(terminal.checkoutAfter, checkoutKeys) ||
      terminal.checkoutAfter.valid !== true || terminal.checkoutAfter.clean !== true ||
      sentinelJsonSha256(terminal.checkoutBefore) !== sentinelJsonSha256(plan.checkoutBefore) ||
      terminal.checkoutAfter.actualRevision !== "0faca33cc58ea62e97a928b67cd3beec7176b408") {
    issues.push("supervisor terminal receipt is incomplete or does not bind the result");
  }
  if (!isRecord(terminal.collateral) || !Array.isArray(terminal.collateral.initial) ||
      !Array.isArray(terminal.collateral.final) || terminal.collateral.mutationDetected !== false ||
      !exactKeys(terminal.collateral, ["changedPaths", "final", "finalRootSha256", "initial", "initialRootSha256", "mutationDetected"]) ||
      !Array.isArray(terminal.collateral.changedPaths) || terminal.collateral.changedPaths.length !== 0 ||
      terminal.collateral.initialRootSha256 !== sentinelJsonSha256(terminal.collateral.initial) ||
      terminal.collateral.finalRootSha256 !== sentinelJsonSha256(terminal.collateral.final) ||
      terminal.collateral.initialRootSha256 !== terminal.collateral.finalRootSha256 ||
      sentinelJsonSha256(terminal.collateral.initial) !== sentinelJsonSha256(terminal.collateral.final) ||
      plan.collateralInitialRootSha256 !== terminal.collateral.initialRootSha256 ||
      sentinelJsonSha256(plan.collateralInitial) !== plan.collateralInitialRootSha256) {
    issues.push("supervisor collateral initial/final identities are incomplete or changed");
  }
  const resultArtifacts = Array.isArray(terminal.resultArtifacts) ? terminal.resultArtifacts : [];
  if (!resultArtifacts.some((artifact) => isRecord(artifact) && artifact.path === terminal.resultJsonPath &&
      artifact.sha256 === resultIdentity?.sha256 && artifact.byteLength === resultIdentity?.byteLength)) {
    issues.push("supervisor result inventory does not bind results.json");
  }
  const processes = Array.isArray(terminal.processes) ? terminal.processes : [];
  const roles = processes.map((process) => isRecord(process) ? process.role : null).sort();
  if (roles.join("\0") !== ["frontend", "harness", "server"].join("\0") ||
      processes.some((process) => !isRecord(process) || !isRecord(process.treeTermination) ||
        process.treeTermination.reaped !== true || !Array.isArray(process.treeTermination.remainingPids) ||
        process.treeTermination.remainingPids.length !== 0)) {
    issues.push("supervisor did not prove all fresh process trees were reaped");
  }
  return { attemptId, succeeded: terminal.status === "succeeded", plan };
}

function verifyAgentStartAndTerminal(
  artifacts: ReadonlyMap<string, LoadedArtifact>,
  attemptId: string | null,
  preregistration: SentinelLivePreregistration,
  events: readonly AgentEvent[],
  network: NetworkFacts,
  result: UpstreamResult | null,
  issues: string[],
): void {
  const startFile = onlyRole(artifacts, "agent-start", issues);
  if (startFile) {
    const start = parseJson(startFile.bytes, "agent start", issues);
    if (!exactKeys(start, ["armIdentityVisible", "attemptId", "pid", "pollIntervalMs", "ppid", "providerOriginSha256", "schemaVersion", "stateOriginSha256", "taskPromptSha256", "taskUrlSha256", "viewport"]) ||
        !isRecord(start) || start.schemaVersion !== "pm.public-eval-corners.sentinel-agent-start.v1" ||
        start.attemptId !== attemptId || start.pollIntervalMs !== preregistration.agent.pollIntervalMs ||
        sentinelJsonSha256(start.viewport) !== sentinelJsonSha256(preregistration.agent.viewport) ||
        start.armIdentityVisible !== false) {
      issues.push("agent start receipt does not bind the preregistered arm-opaque runtime");
    }
  }
  const terminals = byRole(artifacts, "agent-terminal");
  const contacted = network.getCount === 1 && network.postCount === 1;
  if (terminals.length !== (contacted ? 1 : 0)) {
    issues.push("agent terminal receipt presence does not match contact traffic");
  } else if (contacted) {
    const terminal = parseJson(terminals[0]!.bytes, "agent terminal", issues);
    const last = events.at(-1);
    if (!exactKeys(terminal, ["attemptId", "outcome", "poll", "providerExchangeHash", "schemaVersion"]) ||
        !isRecord(terminal) || terminal.schemaVersion !== "pm.public-eval-corners.sentinel-agent-terminal.v1" ||
        terminal.attemptId !== attemptId || terminal.outcome !== "contact-submitted" ||
        terminal.poll !== last?.poll || terminal.providerExchangeHash !== last?.providerExchangeHash ||
        last?.action !== "contact" || result?.contactMessage !== last.reason.slice(0, 1_000)) {
      issues.push("agent terminal receipt/contact message does not bind the final action");
    }
  }
}

function rawSemantic(
  taskId: SentinelLiveTaskId,
  network: NetworkFacts,
  result: UpstreamResult | null,
): boolean | null {
  if (!result || network.stars.length < 2) return null;
  const first = network.stars[0]!;
  const last = network.stars.at(-1)!;
  const pairedContact = network.getCount === 1 && network.postCount === 1 &&
    result.contactGetTime !== null && result.contactPostTime !== null;
  if (taskId === "microhub-stars-noop") {
    return network.getCount === 0 && network.postCount === 0 &&
      result.contactGetTime === null && Math.max(...network.stars) < TASK_ORACLE[taskId].threshold;
  }
  const condition = TASK_ORACLE[taskId].conditionAt;
  return pairedContact && condition !== null && result.contactGetTime! >= condition &&
    (taskId === "microhub-stars-relative-passive"
      ? last >= first + TASK_ORACLE[taskId].threshold
      : last >= TASK_ORACLE[taskId].threshold);
}

export function verifySentinelLiveCell(
  input: VerifySentinelLiveCellInput,
): SentinelLiveCellVerification {
  const issues: string[] = [];
  const plan = verifySentinelPreregistration(
    input.preregistration,
    input.signature,
    input.expectedPreregistrationSha256,
  );
  issues.push(...plan.issues.map((issue) => `preregistration: ${issue}`));
  const binding = input.binding;
  if (!exactKeys(binding, ["artifactRoot", "artifacts", "bindingSha256", "cell", "preregistrationSha256", "schemaVersion"]) ||
      binding.schemaVersion !== "pm.public-eval-corners.sentinel-cell-evidence-binding.v1" ||
      binding.preregistrationSha256 !== plan.preregistrationSha256 ||
      binding.bindingSha256 !== sentinelJsonSha256(bindingBody(binding))) {
    issues.push("cell evidence binding is invalid");
  }
  const expectedCell = plan.cells.find(({ cellId }) => cellId === binding.cell.cellId);
  if (!expectedCell || !sameCell(binding.cell, expectedCell)) issues.push("cell is not an exact signed preregistration cell");
  const artifacts = loadArtifacts(binding, issues) as Map<string, LoadedArtifact>;
  Object.defineProperty(artifacts, ARTIFACT_ROOT, { value: binding.artifactRoot });
  for (const role of EXACT_ONE_ROLES) onlyRole(artifacts, role, issues);
  const resultFile = onlyRole(artifacts, "upstream-result", []);
  const result = resultFile
    ? verifyResult(parseJson(resultFile.bytes, "upstream result", issues), binding.cell.taskId, issues)
    : null;
  const supervisor = verifySupervisor(artifacts, binding.cell, resultFile, issues);
  const events = supervisor.attemptId ? verifyAgentEvents(artifacts, supervisor.attemptId, issues) : [];
  const network = verifyNetwork(onlyRole(artifacts, "browser-network", []), issues);
  verifyPollObservationsAgainstNetwork(events, network, issues);
  verifyState(artifacts, events, binding.cell.arm, issues);
  const providerUsage = verifyProvider(artifacts, events, input.preregistration, issues);
  verifyAgentStartAndTerminal(artifacts, supervisor.attemptId, input.preregistration, events, network, result, issues);
  const semanticSuccess = rawSemantic(binding.cell.taskId, network, result);
  const rawCrossCheck = result && semanticSuccess !== null ? result.success === semanticSuccess : null;
  if (rawCrossCheck === false) issues.push("unchanged upstream outcome disagrees with the raw semantic replay");
  const maximumStars = network.stars.length > 0 ? Math.max(...network.stars) : null;
  return {
    schemaVersion: "pm.public-eval-corners.sentinel-cell-verification.v1",
    preregistrationSha256: plan.preregistrationSha256,
    cell: binding.cell,
    valid: issues.length === 0,
    infrastructureComplete: issues.length === 0 && supervisor.succeeded && rawCrossCheck === true,
    upstreamSuccess: result?.success ?? null,
    rawCrossCheck,
    rawFacts: {
      firstStars: network.stars[0] ?? null,
      lastStars: network.stars.at(-1) ?? null,
      maximumStars,
      contactGetCount: network.getCount,
      contactPostCount: network.postCount,
      semanticSuccess,
    },
    providerUsage,
    issues,
    eligibleForIndependentAnalysis: false,
  };
}

export function analyzeSentinelLiveMatrix(
  preregistration: SentinelLivePreregistration,
  signature: SentinelPreregistrationSignature,
  expectedPreregistrationSha256: string,
  cells: readonly SentinelLiveCellVerification[],
): SentinelLiveMatrixAnalysis {
  const plan = verifySentinelPreregistration(preregistration, signature, expectedPreregistrationSha256);
  const issues = [...plan.issues.map((issue) => `preregistration: ${issue}`)];
  const actual = new Map<string, SentinelLiveCellVerification>();
  for (const cell of cells) {
    if (actual.has(cell.cell.cellId)) issues.push(`duplicate cell verification: ${cell.cell.cellId}`);
    else actual.set(cell.cell.cellId, cell);
  }
  for (const expected of plan.cells) {
    const cell = actual.get(expected.cellId);
    if (!cell) issues.push(`missing preregistered cell: ${expected.cellId}`);
    else if (cell.preregistrationSha256 !== plan.preregistrationSha256 || !sameCell(cell.cell, expected)) {
      issues.push(`cell verification does not match schedule: ${expected.cellId}`);
    } else if (!cell.valid || !cell.infrastructureComplete || cell.rawCrossCheck !== true ||
               cell.upstreamSuccess === null) {
      issues.push(`infrastructure-incomplete cell: ${expected.cellId}`);
    }
  }
  for (const cellId of actual.keys()) {
    if (!plan.cells.some((cell) => cell.cellId === cellId)) issues.push(`undeclared/shopped cell: ${cellId}`);
  }
  const tasks = Object.keys(sentinelLiveRequiredTasks) as SentinelLiveTaskId[];
  const arms: readonly SentinelLiveArm[] = ["native", "sham", "substrate"];
  const counts = tasks.flatMap((taskId) => arms.map((arm) => {
    const selected = plan.cells.map(({ cellId }) => actual.get(cellId)).filter(
      (cell): cell is SentinelLiveCellVerification => cell?.cell.taskId === taskId && cell.cell.arm === arm,
    );
    return { taskId, arm, passes: selected.filter(({ upstreamSuccess }) => upstreamSuccess === true).length, total: selected.length };
  }));
  const count = (taskId: SentinelLiveTaskId, arm: SentinelLiveArm): number =>
    counts.find((entry) => entry.taskId === taskId && entry.arm === arm)?.passes ?? 0;
  const complete = issues.length === 0 && cells.length === 27 && plan.cells.length === 27;
  const materialBenefit = complete &&
    count("microhub-stars-relative-passive", "substrate") >= 2 &&
    count("microhub-stars-relative-passive", "native") <= 1 &&
    count("microhub-stars-relative-passive", "sham") <= 1 &&
    arms.every((arm) => count("microhub-stars-noop", arm) >= 2 &&
      count("microhub-stars-absolute-passive", arm) >= 2);
  const providerUsage = cells.reduce<SentinelProviderUsageEstimate>((total, cell) => ({
    inputTokens: total.inputTokens + cell.providerUsage.inputTokens,
    outputTokens: total.outputTokens + cell.providerUsage.outputTokens,
    estimatedUsd: total.estimatedUsd + cell.providerUsage.estimatedUsd,
  }), { inputTokens: 0, outputTokens: 0, estimatedUsd: 0 });
  return {
    schemaVersion: "pm.public-eval-corners.sentinel-matrix-analysis.v1",
    preregistrationSha256: plan.preregistrationSha256,
    complete,
    materialBenefit,
    rule: SENTINEL_MATERIAL_LIFT_RULE,
    counts,
    providerUsage,
    issues,
    eligibleForIndependentAnalysis: false,
  };
}
