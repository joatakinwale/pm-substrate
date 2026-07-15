import { lstatSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { basename, dirname, isAbsolute, join, posix, relative, resolve } from "node:path";
import { inflateSync } from "node:zlib";

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
  parseSentinelAnthropicResponse,
  SentinelAnthropicResponseValidationError,
} from "./sentinel-anthropic-provider-proxy.js";
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

export interface SentinelPollObservationBinding {
  readonly poll: number;
  readonly captureId: string;
  readonly responseSha256: string;
  readonly value: string;
}

export interface SentinelRepositoryResponseBinding {
  readonly captureId: string | null;
  readonly bodySha256: string;
  readonly stars: number;
}

export interface SentinelPollObservationBindingVerification {
  readonly valid: boolean;
  readonly issues: readonly string[];
  /** Star values from the unique capture-tagged responses consumed in poll order. */
  readonly boundStars: readonly number[];
}

export interface SentinelNoContactTerminalEvidenceVerification {
  readonly valid: boolean;
  readonly issues: readonly string[];
  /** Non-fatal observation: evaluation ran later than the scenario-declared horizon tolerance. */
  readonly harnessScenarioHorizonDivergenceObserved: boolean;
}

export interface SentinelDiagnosticVerification {
  readonly valid: boolean;
  readonly issues: readonly string[];
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

export type JsonRecord = Record<string, unknown>;
export type LoadedArtifact = SentinelLiveArtifactIdentity & { readonly bytes: Buffer };

export const SENTINEL_VERIFICATION_SHA256 = /^[a-f0-9]{64}$/u;
const SHA256 = SENTINEL_VERIFICATION_SHA256;
const OPAQUE_IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/u;
const SENTINEL_ANTHROPIC_SYSTEM_PROMPT_SHA256 =
  "530a699efa7cd0afe06f6449b81384b70ea38307978eb2b7efc183b7f1326d61";
const SENTINEL_ANTHROPIC_ACTION_SCHEMA_SHA256 =
  "fb3fc9ba8bfb81bceb347530b3edc9da2b559daa8e63cca05816b7ad5fc74106";
const SAFE_INTEGER_TEXT = /^(?:0|[1-9][0-9]{0,8})$/u;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG_MAX_COMPRESSED_BYTES = 16 * 1024 * 1024;
const SENTINEL_AUTHORED_KILL_AT_SECONDS = 630;
const SENTINEL_SPEED_FACTOR = 1;
// Four 250ms server ticks admit scheduler jitter while excluding materially early exits.
const SENTINEL_HORIZON_TOLERANCE_SECONDS = 1;
const SENTINEL_MINIMUM_EVALUATION_HORIZON_SECONDS =
  SENTINEL_AUTHORED_KILL_AT_SECONDS / SENTINEL_SPEED_FACTOR -
  SENTINEL_HORIZON_TOLERANCE_SECONDS;
const SENTINEL_AGENT_TIMEOUT_MARKER = "Agent subprocess timed out, killing process group...";
const EXACT_ONE_ROLES: readonly SentinelLiveArtifactRole[] = [
  "scenario-definition", "upstream-result", "browser-network", "agent-start",
  "agent-events", "state-ready", "state-final", "state-audit", "provider-ready",
  "provider-final", "supervisor-start", "supervisor-terminal",
];
const RESULT_KEYS = [
  "condition_at", "contact_get_time", "contact_message", "contact_post_time",
  "detail", "evaluation_time", "success",
] as const;
const EVENT_KEYS = [
  "action", "browserObservationCaptureId", "browserObservationResponseSha256", "browserObservationValue", "observedAt", "poll", "providerExchangeHash", "providerOperationId",
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
  "microhub-stars-relative-passive": { conditionAt: 565.42, threshold: 200 },
  "microhub-stars-noop": { conditionAt: null, threshold: 100_000 },
  "microhub-stars-absolute-passive": { conditionAt: 587.31, threshold: 2_000 },
};

export function isSentinelVerificationRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

const isRecord = isSentinelVerificationRecord;

export function sentinelVerificationExactKeys(value: unknown, expected: readonly string[]): boolean {
  return isRecord(value) &&
    Object.keys(value).sort().join("\0") === [...expected].sort().join("\0");
}

const exactKeys = sentinelVerificationExactKeys;

export function sentinelVerificationCanonicalWithout(value: JsonRecord, key: string): string {
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

const canonicalWithout = sentinelVerificationCanonicalWithout;

export function sentinelVerificationNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

const nonNegativeInteger = sentinelVerificationNonNegativeInteger;

export function sentinelVerificationCanonicalTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const date = new Date(value);
  return Number.isFinite(date.valueOf()) && date.toISOString() === value;
}

const PNG_CRC_TABLE = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function pngCrc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = PNG_CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngSamplesPerPixel(colorType: number, bitDepth: number): number | null {
  if (colorType === 0 && [1, 2, 4, 8, 16].includes(bitDepth)) return 1;
  if (colorType === 2 && [8, 16].includes(bitDepth)) return 3;
  if (colorType === 3 && [1, 2, 4, 8].includes(bitDepth)) return 1;
  if (colorType === 4 && [8, 16].includes(bitDepth)) return 2;
  if (colorType === 6 && [8, 16].includes(bitDepth)) return 4;
  return null;
}

/**
 * Decode enough of the complete PNG stream to make retained screenshots evidence-bearing.
 * This validates every chunk boundary and CRC, the critical-chunk order, the exact viewport,
 * and the complete zlib stream plus every scanline filter byte. Header-only lookalikes fail.
 */
export function verifySentinelScreenshotBytes(bytes: Uint8Array): boolean {
  try {
    const buffer = Buffer.from(bytes);
    if (buffer.byteLength < PNG_SIGNATURE.byteLength + 12 ||
        !buffer.subarray(0, PNG_SIGNATURE.byteLength).equals(PNG_SIGNATURE)) return false;
    let offset = PNG_SIGNATURE.byteLength;
    let chunkCount = 0;
    let sawHeader = false;
    let sawPalette = false;
    let sawImageData = false;
    let imageDataEnded = false;
    let sawEnd = false;
    let bitDepth = -1;
    let colorType = -1;
    const imageData: Buffer[] = [];
    let compressedBytes = 0;
    while (offset < buffer.byteLength) {
      chunkCount += 1;
      if (chunkCount > 10_000 || offset + 12 > buffer.byteLength) return false;
      const length = buffer.readUInt32BE(offset);
      const chunkEnd = offset + 12 + length;
      if (chunkEnd > buffer.byteLength) return false;
      const typeBytes = buffer.subarray(offset + 4, offset + 8);
      const type = typeBytes.toString("ascii");
      if (!/^[A-Za-z]{4}$/u.test(type) || (typeBytes[2]! & 0x20) !== 0) return false;
      const data = buffer.subarray(offset + 8, offset + 8 + length);
      const expectedCrc = buffer.readUInt32BE(offset + 8 + length);
      if (pngCrc32(buffer.subarray(offset + 4, offset + 8 + length)) !== expectedCrc) return false;
      if (!sawHeader && type !== "IHDR") return false;
      if (sawEnd) return false;
      if (type === "IHDR") {
        if (sawHeader || chunkCount !== 1 || length !== 13 ||
            data.readUInt32BE(0) !== 1_280 || data.readUInt32BE(4) !== 720) return false;
        bitDepth = data[8]!;
        colorType = data[9]!;
        if (pngSamplesPerPixel(colorType, bitDepth) === null || data[10] !== 0 ||
            data[11] !== 0 || data[12] !== 0) return false;
        sawHeader = true;
      } else if (type === "PLTE") {
        if (!sawHeader || sawPalette || sawImageData || length === 0 || length > 768 || length % 3 !== 0) {
          return false;
        }
        sawPalette = true;
      } else if (type === "IDAT") {
        if (!sawHeader || imageDataEnded || (colorType === 3 && !sawPalette)) return false;
        sawImageData = true;
        compressedBytes += length;
        if (compressedBytes > PNG_MAX_COMPRESSED_BYTES) return false;
        imageData.push(data);
      } else if (type === "IEND") {
        if (!sawImageData || length !== 0) return false;
        sawEnd = true;
      } else {
        if (sawImageData) imageDataEnded = true;
        // Unknown critical chunks change decoding semantics and are not admissible.
        if ((typeBytes[0]! & 0x20) === 0) return false;
      }
      offset = chunkEnd;
    }
    if (!sawHeader || !sawImageData || !sawEnd || offset !== buffer.byteLength || compressedBytes === 0) {
      return false;
    }
    const samples = pngSamplesPerPixel(colorType, bitDepth);
    if (samples === null) return false;
    const rowBytes = Math.ceil((1_280 * samples * bitDepth) / 8);
    const expectedDecodedBytes = 720 * (rowBytes + 1);
    const decoded = inflateSync(Buffer.concat(imageData), { maxOutputLength: expectedDecodedBytes + 1 });
    if (decoded.byteLength !== expectedDecodedBytes) return false;
    for (let row = 0; row < 720; row += 1) {
      if (decoded[row * (rowBytes + 1)]! > 4) return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function parseSentinelVerificationJson(
  bytes: Uint8Array,
  label: string,
  issues: string[],
): unknown {
  try {
    return JSON.parse(Buffer.from(bytes).toString("utf8")) as unknown;
  } catch {
    issues.push(`${label} is not valid JSON`);
    return null;
  }
}

const parseJson = parseSentinelVerificationJson;

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

const canonicalTimestamp = sentinelVerificationCanonicalTimestamp;

export function sentinelVerificationPortableRelativePath(path: string): boolean {
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

const portableRelativePath = sentinelVerificationPortableRelativePath;

export function loadSentinelVerificationArtifacts(
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

const loadArtifacts = loadSentinelVerificationArtifacts;

export function sentinelVerificationArtifactsByRole(
  artifacts: ReadonlyMap<string, LoadedArtifact>,
  role: SentinelLiveArtifactRole,
): readonly LoadedArtifact[] {
  return [...artifacts.values()].filter((artifact) => artifact.role === role);
}

const byRole = sentinelVerificationArtifactsByRole;

export function sentinelVerificationOnlyArtifactRole(
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

const onlyRole = sentinelVerificationOnlyArtifactRole;

export function sameSentinelLiveCell(actual: SentinelLiveCell, expected: SentinelLiveCell): boolean {
  return sentinelJsonSha256(actual) === sentinelJsonSha256(expected);
}

const sameCell = sameSentinelLiveCell;

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

export function verifySentinelNoContactTerminalEvidence(input: {
  readonly evaluationTime: number | null;
  readonly harnessTimedOut: boolean;
  readonly harnessExitCode: number | null;
  readonly harnessSignal: string | null;
  readonly harnessSpawnError: string | null;
  readonly harnessStdout: string;
}): SentinelNoContactTerminalEvidenceVerification {
  const issues: string[] = [];
  const evaluationTime = input.evaluationTime;
  if (typeof evaluationTime !== "number" || !Number.isFinite(evaluationTime) ||
      evaluationTime < SENTINEL_MINIMUM_EVALUATION_HORIZON_SECONDS) {
    issues.push(
      `no-contact evaluation ended before the pinned ${SENTINEL_MINIMUM_EVALUATION_HORIZON_SECONDS}s minimum horizon`,
    );
  }
  if (input.harnessTimedOut || input.harnessExitCode !== 0 || input.harnessSignal !== null ||
      input.harnessSpawnError !== null) {
    issues.push("no-contact harness process did not terminate cleanly after its agent timeout");
  }
  const markerCount = input.harnessStdout.split(/\r?\n/u)
    .filter((line) => line === SENTINEL_AGENT_TIMEOUT_MARKER).length;
  if (markerCount !== 1) {
    issues.push("no-contact harness stdout does not prove exactly one agent timeout at the horizon");
  }
  return {
    valid: issues.length === 0,
    issues,
    harnessScenarioHorizonDivergenceObserved:
      typeof evaluationTime === "number" &&
      evaluationTime > SENTINEL_AUTHORED_KILL_AT_SECONDS / SENTINEL_SPEED_FACTOR +
        SENTINEL_HORIZON_TOLERANCE_SECONDS,
  };
}

export function verifySentinelMonitoringCoverage(input: {
  readonly agentStartedAt: string;
  readonly eventObservedAts: readonly string[];
  readonly pollIntervalMs: number;
}): SentinelDiagnosticVerification {
  const issues: string[] = [];
  if (!canonicalTimestamp(input.agentStartedAt)) {
    return { valid: false, issues: ["agent monitoring start timestamp is not canonical"] };
  }
  if (!Number.isSafeInteger(input.pollIntervalMs) || input.pollIntervalMs < 5_000 ||
      input.pollIntervalMs > 60_000) {
    return { valid: false, issues: ["agent monitoring poll interval is invalid"] };
  }
  const times = input.eventObservedAts.map((value, index) => {
    if (!canonicalTimestamp(value)) issues.push(`agent monitoring event ${index + 1} timestamp is not canonical`);
    return Date.parse(value);
  });
  if (times.length === 0) issues.push("agent monitoring coverage has no poll events");
  if (issues.length > 0) return { valid: false, issues };
  const startedAt = Date.parse(input.agentStartedAt);
  const toleranceMs = Math.max(5_000, Math.ceil(input.pollIntervalMs / 4));
  const latestFirstPollMs = startedAt + input.pollIntervalMs + toleranceMs;
  if (times[0]! < startedAt || times[0]! > latestFirstPollMs) {
    issues.push("agent monitoring did not begin within one signed poll interval plus tolerance");
  }
  for (let index = 1; index < times.length; index += 1) {
    const gap = times[index]! - times[index - 1]!;
    if (gap <= 0 || gap > input.pollIntervalMs + toleranceMs) {
      issues.push(`agent monitoring cadence gap ${index} is non-monotonic or exceeds tolerance`);
    }
  }
  const requiredSpanMs = SENTINEL_AUTHORED_KILL_AT_SECONDS * 1_000 -
    input.pollIntervalMs - SENTINEL_HORIZON_TOLERANCE_SECONDS * 1_000;
  if (times.at(-1)! - startedAt < requiredSpanMs) {
    issues.push("agent monitoring polls do not extend to within one signed poll interval of the horizon");
  }
  const minimumPolls = Math.floor(requiredSpanMs / input.pollIntervalMs) + 1;
  if (times.length < minimumPolls) {
    issues.push(`agent monitoring retained ${times.length} polls; at least ${minimumPolls} are required`);
  }
  return { valid: issues.length === 0, issues };
}

interface AgentEvent {
  readonly poll: number;
  readonly browserObservationCaptureId: string;
  readonly browserObservationResponseSha256: string;
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
        event.browserObservationCaptureId !== `poll-${String(poll).padStart(4, "0")}` ||
        typeof event.browserObservationResponseSha256 !== "string" ||
        !SHA256.test(event.browserObservationResponseSha256) ||
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
        screenshot.sha256 !== event.screenshotSha256 ||
        !verifySentinelScreenshotBytes(screenshot.bytes)) {
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
  readonly repositoryResponses: readonly {
    readonly bodySha256: string;
    readonly captureId: string | null;
    readonly stars: number;
  }[];
  readonly getCount: number;
  readonly postCount: number;
}

function verifyNetwork(
  file: LoadedArtifact | undefined,
  serverOrigin: string | null,
  frontendOrigin: string | null,
  issues: string[],
): NetworkFacts {
  if (!file) return { repositoryResponses: [], getCount: 0, postCount: 0 };
  const repositoryResponses: { bodySha256: string; captureId: string | null; stars: number }[] = [];
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
      if (url.origin !== frontendOrigin || entry.method !== "GET" || entry.status !== 200 ||
          !String(entry.contentType).toLowerCase().includes("application/json")) {
        issues.push(`repository response ${index + 1} is not a successful frontend-origin GET`);
      }
      const parsed = parseJson(body, `repository response ${index + 1}`, issues);
      const repository = isRecord(parsed) && exactKeys(parsed, ["repository"]) && isRecord(parsed.repository)
        ? parsed.repository
        : null;
      if (repository === null ||
          !nonNegativeInteger(repository.stars)) {
        issues.push(`repository response ${index + 1} lacks a safe star count`);
      } else {
        repositoryResponses.push({
          bodySha256: String(entry.bodySha256),
          captureId: url.searchParams.get("pm_capture"),
          stars: repository.stars,
        });
      }
    }
    if (url.pathname === "/contact") {
      if (url.origin !== serverOrigin || entry.status !== 200 ||
          !String(entry.contentType).toLowerCase().includes("text/html")) {
        issues.push(`contact response ${index + 1} is not a successful HTML response`);
      }
      if (entry.method === "GET") getCount += 1;
      else if (entry.method === "POST") postCount += 1;
      else issues.push(`contact response ${index + 1} uses an unexpected method`);
    }
  }
  if (getCount > 1 || postCount > 1 || getCount !== postCount) {
    issues.push("browser network contains missing, unmatched, or extra contact requests");
  }
  return { repositoryResponses, getCount, postCount };
}

export function verifySentinelPollObservationBindings(
  events: readonly SentinelPollObservationBinding[],
  responses: readonly SentinelRepositoryResponseBinding[],
): SentinelPollObservationBindingVerification {
  const issues: string[] = [];
  const consumed = new Set<number>();
  const boundStars: number[] = [];
  for (const event of events) {
    const value = Number(event.value);
    const matches = responses.flatMap((response, index) =>
      response.bodySha256 === event.responseSha256 &&
      response.captureId === event.captureId &&
      response.stars === value &&
      !consumed.has(index)
        ? [index]
        : [],
    );
    if (matches.length !== 1) {
      issues.push(`poll ${event.poll} browser observation does not bind exactly one captured repository response`);
      continue;
    }
    const match = matches[0]!;
    consumed.add(match);
    boundStars.push(responses[match]!.stars);
  }
  for (const [index, response] of responses.entries()) {
    if (response.captureId !== null && !consumed.has(index)) {
      issues.push(`capture-tagged repository response ${index + 1} is not consumed by exactly one poll`);
    }
  }
  return { valid: issues.length === 0, issues, boundStars };
}

function verifyPollObservationsAgainstNetwork(
  events: readonly AgentEvent[],
  network: NetworkFacts,
  issues: string[],
): readonly number[] {
  const verification = verifySentinelPollObservationBindings(
    events.map((event) => ({
      poll: event.poll,
      captureId: event.browserObservationCaptureId,
      responseSha256: event.browserObservationResponseSha256,
      value: event.browserObservationValue,
    })),
    network.repositoryResponses,
  );
  issues.push(...verification.issues);
  if (verification.boundStars.length < 2) {
    issues.push("browser network lacks two poll-bound repository observations");
  }
  return verification.boundStars;
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
    // The screenshot and the independently captured API response can straddle a waypoint.
    // Bind the model output to durable state by hash; do not manufacture infrastructure
    // failure merely because that behavioral observation differs from the API sample.
    if (!payload || payload.memoryKey !== "microhub.star-count" || payload.source !== "browser_observation" ||
        payload.observedAt !== event.observedAt || typeof payload.value !== "string" ||
        !SAFE_INTEGER_TEXT.test(payload.value) ||
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
  expectedTaskPrompt: string | null,
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
  if (!exactKeys(ready, [
        "anthropicVersion", "auditHeadHash", "authorizationTokenSha256", "endpointPath",
        "evidenceEligible", "noAutomaticRetries", "origin", "pinnedModel",
        "providerEndpoint", "receiptHash", "requestCaptureExcludesSecrets", "schemaVersion",
        "startedAt", "statelessProviderConversation",
      ]) ||
      !exactKeys(final, [
        "acceptedOperationCount", "auditRecordCount", "automaticRetryCount", "closedAt",
        "duplicateOperationCount", "duplicateProviderMessageIdCount", "evidenceEligible",
        "finalAuditHeadHash", "readyReceiptHash", "receiptHash", "schemaVersion",
        "successfulOperationCount", "terminalFailureCount",
      ]) ||
      ready.schemaVersion !== "pm.public-eval-corners.sentinel-anthropic-provider-proxy-ready.v1" ||
      final.schemaVersion !== "pm.public-eval-corners.sentinel-anthropic-provider-proxy-final.v1" ||
      ready.evidenceEligible !== false || final.evidenceEligible !== false ||
      ready.anthropicVersion !== preregistration.model.apiVersion ||
      ready.endpointPath !== "/v1/decide" || ready.requestCaptureExcludesSecrets !== true ||
      ready.auditHeadHash !== null || !canonicalTimestamp(ready.startedAt) ||
      !canonicalTimestamp(final.closedAt) ||
      ready.pinnedModel !== preregistration.model.model ||
      ready.providerEndpoint !== preregistration.model.endpoint ||
      ready.noAutomaticRetries !== true || ready.statelessProviderConversation !== true ||
      final.readyReceiptHash !== ready.receiptHash || final.automaticRetryCount !== 0 ||
      final.acceptedOperationCount !== events.length || final.successfulOperationCount !== events.length ||
      final.terminalFailureCount !== 0 || final.duplicateOperationCount !== 0 ||
      final.duplicateProviderMessageIdCount !== 0) {
    issues.push("provider ready/final receipts do not bind the preregistered no-retry execution");
  }
  const auditFiles = byRole(artifacts, "provider-audit");
  const audits = auditFiles.map((file) => parseJson(file.bytes, `provider audit ${file.relativePath}`, issues));
  const records = audits.filter(isRecord).sort((left, right) => Number(left.sequence) - Number(right.sequence));
  let previous: string | null = null;
  const referenced = new Set<string>();
  const cellClientAttemptIds = new Set<string>();
  const cellProviderRequestIds = new Set<string>();
  const cellProviderMessageIds = new Set<string>();
  const providerRoot = dirname(readyFile.relativePath);
  if (records.length !== events.length * 2 || final.auditRecordCount !== records.length) {
    issues.push("provider audit is not exactly one start and one terminal record per poll");
  }
  for (const [index, record] of records.entries()) {
    if (record.sequence !== index + 1 || record.previousRecordHash !== previous ||
        record.schemaVersion !== "pm.public-eval-corners.sentinel-anthropic-provider-exchange-audit.v1" ||
        !canonicalTimestamp(record.recordedAt) ||
        typeof record.recordHash !== "string" || canonicalWithout(record, "recordHash") !== record.recordHash) {
      issues.push(`provider audit record ${index + 1} hash chain is invalid`);
    }
    previous = typeof record.recordHash === "string" ? record.recordHash : previous;
  }
  if (final.finalAuditHeadHash !== previous) issues.push("provider final receipt does not bind the audit head");
  for (const [index, event] of events.entries()) {
    const started = records[index * 2];
    const terminal = records[index * 2 + 1];
    if (!started || !terminal ||
        !exactKeys(started, [
          "attemptNumber", "authorizationCaptured", "automaticRetryCount", "clientAttemptId",
          "operationId", "previousRecordHash", "recordHash", "recordedAt", "requestBody",
          "sanitizedRequestHeaders", "schemaVersion", "sequence", "stage",
        ]) ||
        !exactKeys(terminal, [
          "attemptNumber", "automaticRetryCount", "latencyMs", "operationId",
          "previousRecordHash", "providerHttpStatus", "providerMessageId", "providerRequestId",
          "recordHash", "recordedAt", "requestBody", "responseBody", "returnedModel",
          "sanitizedRequestHeaders", "sanitizedResponseHeaders", "schemaVersion", "sequence",
          "stage", "terminalCode", "terminalStatus", "usage",
        ]) ||
        started.stage !== "attempt-started" || terminal.stage !== "attempt-terminal" ||
        started.operationId !== event.providerOperationId || terminal.operationId !== event.providerOperationId ||
        started.attemptNumber !== 1 || terminal.attemptNumber !== 1 ||
        started.automaticRetryCount !== 0 || terminal.automaticRetryCount !== 0 ||
        typeof started.clientAttemptId !== "string" || !OPAQUE_IDENTIFIER.test(started.clientAttemptId) ||
        terminal.terminalStatus !== "succeeded" || terminal.terminalCode !== "succeeded" ||
        terminal.providerHttpStatus !== 200 || terminal.returnedModel !== preregistration.model.model ||
        typeof terminal.providerRequestId !== "string" || !OPAQUE_IDENTIFIER.test(terminal.providerRequestId) ||
        typeof terminal.providerMessageId !== "string" || !OPAQUE_IDENTIFIER.test(terminal.providerMessageId) ||
        typeof terminal.latencyMs !== "number" || !Number.isFinite(terminal.latencyMs) || terminal.latencyMs < 0 ||
        terminal.recordHash !== event.providerExchangeHash) {
      issues.push(`provider audit does not bind successful poll ${index + 1}`);
      continue;
    }
    for (const [label, value, seen] of [
      ["client attempt", started.clientAttemptId, cellClientAttemptIds],
      ["provider request", terminal.providerRequestId, cellProviderRequestIds],
      ["provider message", terminal.providerMessageId, cellProviderMessageIds],
    ] as const) {
      const identifier = String(value);
      if (seen.has(identifier)) issues.push(`provider ${label} ID is reused within the cell: ${identifier}`);
      seen.add(identifier);
    }
    const requestBody = artifactFromProviderRef(started.requestBody, providerRoot, artifacts, issues);
    const requestHeaders = artifactFromProviderRef(started.sanitizedRequestHeaders, providerRoot, artifacts, issues);
    const responseBody = artifactFromProviderRef(terminal.responseBody, providerRoot, artifacts, issues);
    const responseHeaders = artifactFromProviderRef(terminal.sanitizedResponseHeaders, providerRoot, artifacts, issues);
    for (const artifact of [requestBody, requestHeaders, responseBody, responseHeaders]) {
      if (artifact) referenced.add(artifact.relativePath);
    }
    if (started.authorizationCaptured !== false ||
        sentinelJsonSha256(started.requestBody) !== sentinelJsonSha256(terminal.requestBody) ||
        sentinelJsonSha256(started.sanitizedRequestHeaders) !== sentinelJsonSha256(terminal.sanitizedRequestHeaders)) {
      issues.push(`provider poll ${index + 1} request capture is inconsistent or contains authorization`);
    }
    if (!requestBody || !requestHeaders || !responseBody || !responseHeaders) continue;
    const outbound = parseJson(requestBody.bytes, `provider request ${index + 1}`, issues);
    const headers = parseJson(requestHeaders.bytes, `provider headers ${index + 1}`, issues);
    const inbound = parseJson(responseBody.bytes, `provider response ${index + 1}`, issues);
    const inboundHeaders = parseJson(responseHeaders.bytes, `provider response headers ${index + 1}`, issues);
    if (!exactKeys(outbound, ["max_tokens", "messages", "model", "output_config", "system", "temperature"]) ||
        !isRecord(outbound) || outbound.model !== preregistration.model.model ||
        outbound.temperature !== 0 || outbound.max_tokens !== preregistration.model.maxCompletionTokens ||
        typeof outbound.system !== "string" ||
        sentinelSha256(outbound.system) !== SENTINEL_ANTHROPIC_SYSTEM_PROMPT_SHA256 ||
        !isRecord(outbound.output_config) || !exactKeys(outbound.output_config, ["format"]) ||
        !isRecord(outbound.output_config.format) ||
        !exactKeys(outbound.output_config.format, ["schema", "type"]) ||
        outbound.output_config.format.type !== "json_schema" ||
        sentinelJsonSha256(outbound.output_config.format.schema) !== SENTINEL_ANTHROPIC_ACTION_SCHEMA_SHA256 ||
        !Array.isArray(outbound.messages) || outbound.messages.length !== 1 ||
        !exactKeys(outbound.messages[0], ["content", "role"]) ||
        !isRecord(outbound.messages[0]) || outbound.messages[0].role !== "user") {
      issues.push(`provider request ${index + 1} changed the preregistered model settings`);
    }
    if (!exactKeys(headers, ["clientAttemptId", "headers", "method", "url"]) ||
        !isRecord(headers) || headers.method !== "POST" || headers.url !== preregistration.model.endpoint ||
        headers.clientAttemptId !== started.clientAttemptId ||
        !isRecord(headers.headers) || headers.headers["anthropic-version"] !== preregistration.model.apiVersion ||
        headers.headers["content-type"] !== "application/json" ||
        Object.keys(headers.headers).sort().join("\0") !== ["anthropic-version", "content-type"].sort().join("\0") ||
        Object.hasOwn(headers.headers, "x-api-key") || Object.hasOwn(headers.headers, "authorization")) {
      issues.push(`provider request ${index + 1} headers are not sanitized Anthropic headers`);
    }
    if (!exactKeys(inboundHeaders, ["headers", "status"]) ||
        !isRecord(inboundHeaders) || inboundHeaders.status !== 200 ||
        !isRecord(inboundHeaders.headers) ||
        Object.keys(inboundHeaders.headers).sort().join("\0") !== ["content-type", "request-id"].sort().join("\0") ||
        typeof inboundHeaders.headers["content-type"] !== "string" ||
        !inboundHeaders.headers["content-type"].toLowerCase().startsWith("application/json") ||
        inboundHeaders.headers["request-id"] !== terminal.providerRequestId ||
        Object.keys(inboundHeaders.headers).some((key) => /authorization|api[-_]?key|x-api-key/iu.test(key))) {
      issues.push(`provider response ${index + 1} headers are not sanitized or request-bound`);
    }
    let parsed;
    try {
      parsed = parseSentinelAnthropicResponse(inbound);
    } catch (error) {
      const code = error instanceof SentinelAnthropicResponseValidationError
        ? error.terminalCode
        : "provider-response-invalid";
      issues.push(`provider response ${index + 1} violates the shared exact contract: ${code}`);
      continue;
    }
    inputTokens += Number(parsed.usage.input_tokens);
    outputTokens += Number(parsed.usage.output_tokens);
    if ((parsed.usage.cache_creation_input_tokens !== undefined && parsed.usage.cache_creation_input_tokens !== 0) ||
        (parsed.usage.cache_read_input_tokens !== undefined && parsed.usage.cache_read_input_tokens !== 0)) {
      issues.push(`provider response ${index + 1} used prompt caching despite the signed no-cache plan`);
    }
    // stateWrite is screenshot-derived and may race the independently advancing API capture.
    // Its hash must still link provider -> event -> sidecar exactly.
    if (parsed.providerMessageId !== terminal.providerMessageId ||
        sentinelJsonSha256(parsed.usage) !== sentinelJsonSha256(terminal.usage) ||
        parsed.action.action !== event.action || parsed.action.reason !== event.reason ||
        sentinelSha256(parsed.action.stateWrite) !== event.stateWriteValueSha256) {
      issues.push(`provider response ${index + 1} does not bind usage or agent event output`);
    }
    const content = isRecord(outbound) && Array.isArray(outbound.messages) && isRecord(outbound.messages[0])
      ? outbound.messages[0].content : null;
    const image = Array.isArray(content) ? content.find((part) => isRecord(part) && part.type === "image") : null;
    const text = Array.isArray(content) ? content.find((part) => isRecord(part) && part.type === "text") : null;
    if (!Array.isArray(content) || content.length !== 2 ||
        !exactKeys(image, ["source", "type"]) || !isRecord(image) || image.type !== "image" ||
        image.source === undefined || !exactKeys(image.source, ["data", "media_type", "type"]) ||
        !isRecord(image.source) || image.source.type !== "base64" || image.source.media_type !== "image/png" ||
        typeof image.source.data !== "string" || sentinelSha256(Buffer.from(image.source.data, "base64")) !== event.screenshotSha256 ||
        !exactKeys(text, ["text", "type"]) || !isRecord(text) || text.type !== "text" ||
        typeof text.text !== "string") {
      issues.push(`provider request ${index + 1} does not bind the screenshot and text input`);
    } else {
      let textPayload: unknown;
      try { textPayload = JSON.parse(text.text) as unknown; } catch { textPayload = null; }
      if (!exactKeys(textPayload, ["stateContext", "taskPrompt"]) ||
          !isRecord(textPayload) || textPayload.taskPrompt !== expectedTaskPrompt ||
          typeof textPayload.stateContext !== "string" ||
          sentinelSha256(textPayload.stateContext) !== event.stateReadContextSha256) {
        issues.push(`provider request ${index + 1} does not bind the exact task prompt and state context`);
      }
    }
  }
  const operationPaths = byRole(artifacts, "provider-operation").map(({ relativePath }) => relativePath).sort();
  if (operationPaths.join("\0") !== [...referenced].sort().join("\0")) {
    issues.push("provider operation inventory contains missing or unreferenced files");
  }
  return estimate();
}

function verifySupervisorCommandsAndConfig(
  plan: JsonRecord,
  cell: SentinelLiveCell,
  artifacts: ReadonlyMap<string, LoadedArtifact>,
  issues: string[],
): void {
  const commands = Array.isArray(plan.commands) ? plan.commands : [];
  const byCommandRole = new Map<string, JsonRecord>();
  for (const [index, command] of commands.entries()) {
    if (!exactKeys(command, ["arguments", "cwd", "executable", "identitySha256", "role"]) ||
        !isRecord(command) || typeof command.role !== "string" || byCommandRole.has(command.role) ||
        !Array.isArray(command.arguments) || command.arguments.some((argument) => typeof argument !== "string") ||
        typeof command.cwd !== "string" || !isRecord(command.executable) ||
        !exactKeys(command.executable, ["path", "sha256"]) ||
        typeof command.executable.path !== "string" || typeof command.executable.sha256 !== "string" ||
        !SHA256.test(command.executable.sha256) || typeof command.identitySha256 !== "string" ||
        command.identitySha256 !== sentinelJsonSha256({
          role: command.role,
          executable: command.executable,
          arguments: command.arguments,
          cwd: command.cwd,
        })) {
      issues.push(`supervisor command ${index + 1} is malformed or hash-inconsistent`);
      continue;
    }
    byCommandRole.set(command.role, command);
  }
  if ([...byCommandRole.keys()].sort().join("\0") !== ["frontend", "harness", "server"].join("\0")) {
    issues.push("supervisor plan does not contain exactly the server, frontend, and harness commands");
    return;
  }
  const server = byCommandRole.get("server")!;
  const frontend = byCommandRole.get("frontend")!;
  const harness = byCommandRole.get("harness")!;
  const serverOrigin = strictLoopbackOrigin(plan.serverUrl);
  const frontendOrigin = strictLoopbackOrigin(plan.frontendUrl);
  const serverPort = serverOrigin === null ? null : new URL(serverOrigin).port;
  const frontendPort = frontendOrigin === null ? null : new URL(frontendOrigin).port;
  const agentConfig = isRecord(plan.agentConfig) ? plan.agentConfig : null;
  const expectedRuntimeRoot = typeof plan.outputRoot === "string" ? resolve(plan.outputRoot, "runtime") : null;
  const expectedFrontendCwd = typeof plan.checkoutPath === "string" ? resolve(plan.checkoutPath, "frontend") : null;
  const expectedServerArguments = serverPort === null ? null : [
    "-m", "uvicorn", "server.server:app", "--host", "127.0.0.1", "--port", serverPort,
  ];
  const expectedFrontendArguments = frontendPort === null ? null : [
    "run", "dev", "--", "--host", "127.0.0.1", "--port", frontendPort, "--strictPort",
  ];
  const expectedHarnessArguments = serverOrigin === null || frontendOrigin === null || agentConfig === null ||
    typeof agentConfig.path !== "string"
    ? null
    : [
      "-m", "server.eval_harness", "run", String(plan.attemptId), "--config", agentConfig.path,
      "--server-url", serverOrigin, "--frontend-url", frontendOrigin, "--speed-factor", "1",
      "--task", cell.taskId,
    ];
  if (sentinelJsonSha256(server.arguments) !== sentinelJsonSha256(expectedServerArguments) ||
      sentinelJsonSha256(frontend.arguments) !== sentinelJsonSha256(expectedFrontendArguments) ||
      sentinelJsonSha256(harness.arguments) !== sentinelJsonSha256(expectedHarnessArguments) ||
      server.cwd !== expectedRuntimeRoot || harness.cwd !== expectedRuntimeRoot ||
      frontend.cwd !== expectedFrontendCwd ||
      sentinelJsonSha256(server.executable) !== sentinelJsonSha256(harness.executable)) {
    issues.push("supervisor command argv/cwd/executable identities do not match the exact upstream invocation");
  }
  const configArtifact = artifacts.get("input/agent-config.json");
  if (!configArtifact || configArtifact.role !== "supporting" || agentConfig === null ||
      !exactKeys(agentConfig, ["path", "sha256"]) || agentConfig.sha256 !== configArtifact.sha256 ||
      agentConfig.path !== resolve(artifactsRoot(artifacts), configArtifact.relativePath)) {
    issues.push("supervisor agent-config identity does not bind the retained config bytes");
  } else {
    const config = parseJson(configArtifact.bytes, "agent config", issues);
    if (!exactKeys(config, ["agent_subprocess", "frontend_url", "server_url", "speed_factor"]) ||
        !isRecord(config) || config.server_url !== serverOrigin || config.frontend_url !== frontendOrigin ||
        config.speed_factor !== 1 || !Array.isArray(config.agent_subprocess) ||
        config.agent_subprocess.length !== 6 ||
        config.agent_subprocess.slice(-4).join("\0") !== ["--url", "__TASK_URL__", "--prompt", "__TASK_PROMPT__"].join("\0") ||
        config.agent_subprocess.some((argument) => typeof argument !== "string" ||
          /(?:^|[-_.:\s])(?:native|sham|substrate|treatment|arm)(?:$|[-_.:\s])/iu.test(argument))) {
      issues.push("retained agent config changed the exact arm-opaque browser-agent invocation");
    }
  }
  if (!isRecord(plan.environmentBindings) ||
      !exactKeys(plan.environmentBindings, ["frontend", "harness", "server"])) {
    issues.push("supervisor environment bindings are missing or not exact");
    return;
  }
  const allBindings = Object.values(plan.environmentBindings).flatMap((value) => Array.isArray(value) ? value : []);
  const requiredHarnessBindings = new Map<string, string>([
    ["PM_SENTINEL_ATTEMPT_ID", "fixed-runtime"],
    ["PM_SENTINEL_AGENT_OUTPUT_ROOT", "fixed-runtime"],
    ["PM_SENTINEL_POLL_INTERVAL_MS", "fixed-runtime"],
    ["PM_SENTINEL_PROVIDER_ORIGIN", "opaque-origin"],
    ["PM_SENTINEL_PROVIDER_TOKEN", "opaque-token"],
    ["PM_SENTINEL_STATE_ORIGIN", "opaque-origin"],
    ["PM_SENTINEL_STATE_TOKEN", "opaque-token"],
    ["PM_SENTINEL_VIEWPORT_HEIGHT", "fixed-runtime"],
    ["PM_SENTINEL_VIEWPORT_WIDTH", "fixed-runtime"],
  ]);
  const harnessBindings = Array.isArray(plan.environmentBindings.harness)
    ? plan.environmentBindings.harness : [];
  for (const [name, classification] of requiredHarnessBindings) {
    const matches = harnessBindings.filter((binding) => isRecord(binding) && binding.name === name &&
      binding.classification === classification && typeof binding.valueSha256 === "string" &&
      SHA256.test(binding.valueSha256));
    if (matches.length !== 1) issues.push(`supervisor harness binding ${name} is missing or ambiguous`);
  }
  for (const binding of allBindings) {
    if (!exactKeys(binding, ["classification", "name", "valueSha256"]) || !isRecord(binding) ||
        typeof binding.name !== "string" || typeof binding.valueSha256 !== "string" ||
        !SHA256.test(binding.valueSha256) ||
        /(?:ANTHROPIC|OPENAI|GOOGLE|GEMINI|AZURE).*(?:API_KEY|TOKEN)/iu.test(binding.name) ||
        /(?:^|[-_.:\s])(?:native|sham|substrate|treatment|arm)(?:$|[-_.:\s])/iu.test(binding.name)) {
      issues.push("supervisor environment bindings contain malformed, credential-bearing, or arm-bearing metadata");
      break;
    }
  }
}

export function verifySentinelSupervisorProcessRecords(input: {
  readonly processes: unknown;
  readonly commands: unknown;
}): SentinelDiagnosticVerification {
  const issues: string[] = [];
  const processes = Array.isArray(input.processes) ? input.processes : [];
  const commands = Array.isArray(input.commands) ? input.commands : [];
  const commandByRole = new Map<string, JsonRecord>();
  for (const command of commands) {
    if (isRecord(command) && typeof command.role === "string" &&
        typeof command.identitySha256 === "string") commandByRole.set(command.role, command);
  }
  const expectedRoles = ["frontend", "harness", "server"];
  const actualRoles = processes.map((value) => isRecord(value) ? value.role : null).sort();
  if (actualRoles.join("\0") !== expectedRoles.join("\0")) {
    issues.push("supervisor terminal must contain exactly one frontend, harness, and server process");
  }
  const rootPids = new Set<number>();
  const observedOwner = new Map<number, string>();
  for (const [index, candidate] of processes.entries()) {
    if (!exactKeys(candidate, [
      "commandIdentitySha256", "exit", "pid", "role", "stderr", "stdout",
      "timedOut", "treeTermination",
    ]) || !isRecord(candidate) || !["frontend", "harness", "server"].includes(String(candidate.role)) ||
        !nonNegativeInteger(candidate.pid) || candidate.pid <= 1 || rootPids.has(candidate.pid) ||
        candidate.timedOut !== false || !isRecord(candidate.exit) ||
        !exactKeys(candidate.exit, ["exitCode", "signal", "spawnError"]) ||
        !isRecord(candidate.treeTermination) ||
        !exactKeys(candidate.treeTermination, ["exit", "observedPids", "reaped", "remainingPids", "signalsSent"]) ||
        !isRecord(candidate.treeTermination.exit) ||
        !exactKeys(candidate.stdout, ["byteLength", "path", "sha256"]) ||
        !isRecord(candidate.stdout) || candidate.stdout.path !== `logs/${String(candidate.role)}.stdout.log` ||
        !nonNegativeInteger(candidate.stdout.byteLength) || typeof candidate.stdout.sha256 !== "string" ||
        !SHA256.test(candidate.stdout.sha256) ||
        !exactKeys(candidate.stderr, ["byteLength", "path", "sha256"]) ||
        !isRecord(candidate.stderr) || candidate.stderr.path !== `logs/${String(candidate.role)}.stderr.log` ||
        !nonNegativeInteger(candidate.stderr.byteLength) || typeof candidate.stderr.sha256 !== "string" ||
        !SHA256.test(candidate.stderr.sha256) ||
        sentinelJsonSha256(candidate.exit) !== sentinelJsonSha256(candidate.treeTermination.exit) ||
        candidate.treeTermination.reaped !== true ||
        !Array.isArray(candidate.treeTermination.remainingPids) ||
        candidate.treeTermination.remainingPids.length !== 0 ||
        !Array.isArray(candidate.treeTermination.observedPids) ||
        !Array.isArray(candidate.treeTermination.signalsSent)) {
      issues.push(`supervisor process record ${index + 1} lacks the exact successful terminal schema`);
      continue;
    }
    rootPids.add(candidate.pid);
    const role = String(candidate.role);
    const command = commandByRole.get(role);
    if (!command || candidate.commandIdentitySha256 !== command.identitySha256) {
      issues.push(`supervisor ${role} process does not bind the planned command identity`);
    }
    const exit = candidate.exit;
    if (exit.spawnError !== null) issues.push(`supervisor ${role} process has a spawn error`);
    if (role === "harness") {
      if (exit.exitCode !== 0 || exit.signal !== null) {
        issues.push("supervisor harness process did not exit cleanly with code zero");
      }
    } else if (!(
      (exit.exitCode === 0 && exit.signal === null) ||
      (exit.exitCode === null && (exit.signal === "SIGTERM" || exit.signal === "SIGKILL"))
    )) {
      issues.push(`supervisor ${role} process has an invalid service shutdown exit`);
    }
    const observedPids = candidate.treeTermination.observedPids;
    if (observedPids.some((pid) => !nonNegativeInteger(pid) || pid <= 1) ||
        new Set(observedPids).size !== observedPids.length ||
        [...observedPids].sort((left, right) => Number(left) - Number(right)).join(",") !==
          observedPids.join(",") || !observedPids.includes(candidate.pid)) {
      issues.push(`supervisor ${role} observed PID inventory is malformed or omits its leader`);
    }
    for (const pid of observedPids) {
      if (!nonNegativeInteger(pid)) continue;
      const owner = observedOwner.get(pid);
      if (owner !== undefined && owner !== role) {
        issues.push(`supervisor process PID ${pid} is claimed by both ${owner} and ${role}`);
      } else observedOwner.set(pid, role);
    }
    const signals = candidate.treeTermination.signalsSent;
    if (signals.some((signal) => typeof signal !== "string" ||
        !/^SIG(?:TERM|KILL):(pid|pgid):[1-9][0-9]*$/u.test(signal)) ||
        new Set(signals).size !== signals.length) {
      issues.push(`supervisor ${role} signal inventory is malformed or duplicated`);
    }
    for (const signal of signals) {
      if (typeof signal !== "string") continue;
      const target = /^SIG(?:TERM|KILL):(?:pid|pgid):([1-9][0-9]*)$/u.exec(signal);
      if (target !== null && !observedPids.includes(Number(target[1]))) {
        issues.push(`supervisor ${role} signal targets a PID outside its observed process tree`);
      }
    }
    if (role !== "harness" && !signals.some((signal) =>
      typeof signal === "string" && signal.startsWith("SIGTERM:"))) {
      issues.push(`supervisor ${role} process lacks evidence of an orderly termination signal`);
    }
    if (exit.signal === "SIGKILL" && !signals.some((signal) =>
      typeof signal === "string" && signal.startsWith("SIGKILL:"))) {
      issues.push(`supervisor ${role} SIGKILL exit lacks a matching signal record`);
    }
  }
  return { valid: issues.length === 0, issues };
}

function supervisorProcessArtifact(
  reference: unknown,
  expectedPath: string,
  artifacts: ReadonlyMap<string, LoadedArtifact>,
  issues: string[],
): LoadedArtifact | null {
  if (!exactKeys(reference, ["byteLength", "path", "sha256"])) {
    issues.push(`supervisor process artifact reference is not exact: ${expectedPath}`);
    return null;
  }
  const identity = reference as JsonRecord;
  if (identity.path !== expectedPath || !nonNegativeInteger(identity.byteLength) ||
      typeof identity.sha256 !== "string" || !SHA256.test(identity.sha256)) {
    issues.push(`supervisor process artifact reference is invalid: ${expectedPath}`);
    return null;
  }
  const artifact = artifacts.get(`upstream/${expectedPath}`);
  if (!artifact || artifact.role !== "supporting" || artifact.byteLength !== identity.byteLength ||
      artifact.sha256 !== identity.sha256) {
    issues.push(`supervisor process artifact does not bind retained bytes: ${expectedPath}`);
    return null;
  }
  return artifact;
}

function verifySupervisor(
  artifacts: ReadonlyMap<string, LoadedArtifact>,
  cell: SentinelLiveCell,
  resultIdentity: LoadedArtifact | undefined,
  result: UpstreamResult | null,
  scenarioIdentity: LoadedArtifact | undefined,
  issues: string[],
): {
  readonly attemptId: string | null;
  readonly succeeded: boolean;
  readonly plan: JsonRecord | null;
  readonly terminal: JsonRecord | null;
} {
  const startFile = onlyRole(artifacts, "supervisor-start", issues);
  const terminalFile = onlyRole(artifacts, "supervisor-terminal", issues);
  if (!startFile || !terminalFile) {
    return { attemptId: null, succeeded: false, plan: null, terminal: null };
  }
  const start = verifyReceiptHash(parseJson(startFile.bytes, "supervisor start", issues), "supervisor start", issues);
  const terminal = verifyReceiptHash(parseJson(terminalFile.bytes, "supervisor terminal", issues), "supervisor terminal", issues);
  if (!start || !terminal || !isRecord(start.plan)) {
    return { attemptId: null, succeeded: false, plan: null, terminal: null };
  }
  if (!exactKeys(start, ["evidenceEligible", "plan", "receiptHash", "schemaVersion", "startedAt"]) ||
      !exactKeys(terminal, ["attemptId", "checkoutAfter", "checkoutBefore", "collateral", "evidenceEligible", "failureMessage", "failureStage", "processes", "receiptHash", "resultArtifacts", "resultJsonPath", "resultJsonSha256", "schemaVersion", "startReceiptHash", "status", "taskId"])) {
    issues.push("supervisor receipt keys are not exact");
  }
  const plan = start.plan;
  if (!exactKeys(plan, ["agentConfig", "attemptId", "checkoutBefore", "checkoutPath", "collateralInitial", "collateralInitialRootSha256", "commands", "environmentBindings", "evidenceEligible", "frontendUrl", "outputRoot", "planHash", "scenario", "schemaVersion", "serverUrl", "speedFactor", "taskId", "timeouts"])) {
    issues.push("supervisor plan keys are not exact");
  }
  const attemptId = typeof plan.attemptId === "string" ? plan.attemptId : null;
  const expectedAttemptId = basename(artifactsRoot(artifacts));
  const expectedSupervisorOutputRoot = resolve(artifactsRoot(artifacts), "upstream");
  const expectedResultJsonPath = attemptId === null
    ? null
    : `runtime/results/${attemptId}/microhub/${cell.taskId}/results.json`;
  verifySupervisorCommandsAndConfig(plan, cell, artifacts, issues);
  const checkoutKeys = ["actualRepositoryUrl", "actualRevision", "clean", "expectedRepositoryUrl", "expectedRevision", "issues", "valid"] as const;
  if (plan.schemaVersion !== "pm.public-eval-corners.sentinel-attempt-plan.v1" ||
      start.schemaVersion !== "pm.public-eval-corners.sentinel-attempt-start.v1" ||
      start.evidenceEligible !== false || !canonicalTimestamp(start.startedAt) ||
      attemptId !== expectedAttemptId || plan.outputRoot !== expectedSupervisorOutputRoot ||
      plan.taskId !== cell.taskId || plan.speedFactor !== 1 || plan.evidenceEligible !== false ||
      typeof plan.planHash !== "string" || canonicalWithout(plan, "planHash") !== plan.planHash ||
      !isRecord(plan.scenario) || plan.scenario.sha256 !== sentinelLiveRequiredTasks[cell.taskId].scenarioSha256 ||
      plan.scenario.sha256 !== scenarioIdentity?.sha256 ||
      !exactKeys(plan.scenario, ["path", "sha256"]) ||
      !isRecord(plan.checkoutBefore) || !exactKeys(plan.checkoutBefore, checkoutKeys) ||
      plan.checkoutBefore.valid !== true || plan.checkoutBefore.clean !== true ||
      plan.checkoutBefore.actualRevision !== "0faca33cc58ea62e97a928b67cd3beec7176b408" ||
      plan.checkoutBefore.expectedRevision !== "0faca33cc58ea62e97a928b67cd3beec7176b408" ||
      !isRecord(plan.timeouts) ||
      !exactKeys(plan.timeouts, ["attemptMs", "shutdownGraceMs", "startupMs"]) ||
      plan.timeouts.attemptMs !== 720_000 || !nonNegativeInteger(plan.timeouts.startupMs) ||
      !nonNegativeInteger(plan.timeouts.shutdownGraceMs)) {
    issues.push("supervisor start plan does not bind the exact task, scenario, and clean checkout");
  }
  if (terminal.schemaVersion !== "pm.public-eval-corners.sentinel-attempt-terminal.v1" ||
      terminal.evidenceEligible !== false || terminal.attemptId !== attemptId || terminal.taskId !== cell.taskId ||
      terminal.startReceiptHash !== start.receiptHash || terminal.status !== "succeeded" ||
      terminal.failureStage !== null || terminal.failureMessage !== null ||
      terminal.resultJsonSha256 !== resultIdentity?.sha256 ||
      terminal.resultJsonPath !== expectedResultJsonPath ||
      resultIdentity?.relativePath !== `upstream/${expectedResultJsonPath ?? ""}` ||
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
  if (resultArtifacts.length === 0 || resultArtifacts.some((artifact) =>
      !exactKeys(artifact, ["byteLength", "path", "sha256"]) || !isRecord(artifact) ||
      typeof artifact.path !== "string" || !portableRelativePath(artifact.path) ||
      !artifact.path.startsWith(`microhub/${cell.taskId}/`) ||
      !nonNegativeInteger(artifact.byteLength) || typeof artifact.sha256 !== "string" ||
      !SHA256.test(artifact.sha256)) ||
      !resultArtifacts.some((artifact) => isRecord(artifact) && artifact.path ===
        `microhub/${cell.taskId}/results.json` &&
      artifact.sha256 === resultIdentity?.sha256 && artifact.byteLength === resultIdentity?.byteLength)) {
    issues.push("supervisor result inventory does not bind results.json");
  }
  const processes = Array.isArray(terminal.processes) ? terminal.processes : [];
  issues.push(...verifySentinelSupervisorProcessRecords({
    processes,
    commands: plan.commands,
  }).issues);
  const roles = processes.map((process) => isRecord(process) ? process.role : null).sort();
  if (roles.join("\0") !== ["frontend", "harness", "server"].join("\0") ||
      processes.some((process) => !isRecord(process) || !isRecord(process.treeTermination) ||
        process.treeTermination.reaped !== true || !Array.isArray(process.treeTermination.remainingPids) ||
        process.treeTermination.remainingPids.length !== 0)) {
    issues.push("supervisor did not prove all fresh process trees were reaped");
  }
  const commandByRole = new Map(
    (Array.isArray(plan.commands) ? plan.commands : [])
      .filter(isRecord)
      .map((command) => [command.role, command] as const),
  );
  const processByRole = new Map<string, JsonRecord>();
  const stdoutByRole = new Map<string, LoadedArtifact>();
  for (const [index, candidate] of processes.entries()) {
    if (!exactKeys(candidate, [
      "commandIdentitySha256", "exit", "pid", "role", "stderr", "stdout",
      "timedOut", "treeTermination",
    ]) || !isRecord(candidate) || typeof candidate.role !== "string" ||
        processByRole.has(candidate.role) || !nonNegativeInteger(candidate.pid) || candidate.pid === 0 ||
        typeof candidate.timedOut !== "boolean" || !isRecord(candidate.exit) ||
        !exactKeys(candidate.exit, ["exitCode", "signal", "spawnError"]) ||
        candidate.exit.exitCode !== null && !nonNegativeInteger(candidate.exit.exitCode) ||
        candidate.exit.signal !== null && typeof candidate.exit.signal !== "string" ||
        candidate.exit.spawnError !== null && typeof candidate.exit.spawnError !== "string" ||
        !isRecord(candidate.treeTermination) ||
        !exactKeys(candidate.treeTermination, ["exit", "observedPids", "reaped", "remainingPids", "signalsSent"]) ||
        !isRecord(candidate.treeTermination.exit) ||
        candidate.treeTermination.reaped !== true ||
        !Array.isArray(candidate.treeTermination.observedPids) ||
        candidate.treeTermination.observedPids.some((pid) => !nonNegativeInteger(pid) || pid === 0) ||
        !Array.isArray(candidate.treeTermination.remainingPids) ||
        candidate.treeTermination.remainingPids.length !== 0 ||
        !Array.isArray(candidate.treeTermination.signalsSent) ||
        candidate.treeTermination.signalsSent.some((signal) => typeof signal !== "string") ||
        sentinelJsonSha256(candidate.exit) !== sentinelJsonSha256(candidate.treeTermination.exit)) {
      issues.push(`supervisor process record ${index + 1} is malformed`);
      continue;
    }
    const command = commandByRole.get(candidate.role);
    if (!command || candidate.commandIdentitySha256 !== command.identitySha256) {
      issues.push(`supervisor process ${candidate.role} does not bind its launched command`);
    }
    processByRole.set(candidate.role, candidate);
    const stdout = supervisorProcessArtifact(
      candidate.stdout,
      `logs/${candidate.role}.stdout.log`,
      artifacts,
      issues,
    );
    supervisorProcessArtifact(
      candidate.stderr,
      `logs/${candidate.role}.stderr.log`,
      artifacts,
      issues,
    );
    if (stdout) stdoutByRole.set(candidate.role, stdout);
  }
  if (result?.contactGetTime === null) {
    const harness = processByRole.get("harness");
    const exit = harness && isRecord(harness.exit) ? harness.exit : null;
    const horizon = verifySentinelNoContactTerminalEvidence({
      evaluationTime: result.evaluationTime,
      harnessTimedOut: harness?.timedOut === true,
      harnessExitCode: exit && typeof exit.exitCode === "number" ? exit.exitCode : null,
      harnessSignal: exit && typeof exit.signal === "string" ? exit.signal : null,
      harnessSpawnError: exit && typeof exit.spawnError === "string" ? exit.spawnError : null,
      harnessStdout: stdoutByRole.get("harness")?.bytes.toString("utf8") ?? "",
    });
    issues.push(...horizon.issues);
  }
  return { attemptId, succeeded: terminal.status === "succeeded", plan, terminal };
}

function verifyAgentStartAndTerminal(
  artifacts: ReadonlyMap<string, LoadedArtifact>,
  attemptId: string | null,
  preregistration: SentinelLivePreregistration,
  events: readonly AgentEvent[],
  network: NetworkFacts,
  result: UpstreamResult | null,
  expectedTaskUrl: string | null,
  expectedTaskPrompt: string | null,
  issues: string[],
): JsonRecord | null {
  const startFile = onlyRole(artifacts, "agent-start", issues);
  let parsedStart: JsonRecord | null = null;
  if (startFile) {
    const start = parseJson(startFile.bytes, "agent start", issues);
    if (isRecord(start)) parsedStart = start;
    if (!exactKeys(start, ["armIdentityVisible", "attemptId", "pid", "pollIntervalMs", "ppid", "providerOriginSha256", "schemaVersion", "startedAt", "stateOriginSha256", "taskPromptSha256", "taskUrlSha256", "viewport"]) ||
        !isRecord(start) || start.schemaVersion !== "pm.public-eval-corners.sentinel-agent-start.v1" ||
        start.attemptId !== attemptId || start.pollIntervalMs !== preregistration.agent.pollIntervalMs ||
        !canonicalTimestamp(start.startedAt) || !nonNegativeInteger(start.pid) || start.pid <= 1 ||
        !nonNegativeInteger(start.ppid) || start.ppid <= 1 || start.ppid === start.pid ||
        typeof start.providerOriginSha256 !== "string" || !SHA256.test(start.providerOriginSha256) ||
        typeof start.stateOriginSha256 !== "string" || !SHA256.test(start.stateOriginSha256) ||
        sentinelJsonSha256(start.viewport) !== sentinelJsonSha256(preregistration.agent.viewport) ||
        start.taskUrlSha256 !== (expectedTaskUrl === null ? null : sentinelSha256(expectedTaskUrl)) ||
        start.taskPromptSha256 !== (expectedTaskPrompt === null ? null : sentinelSha256(expectedTaskPrompt)) ||
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
  if (result?.contactGetTime === null) {
    if (parsedStart && typeof parsedStart.startedAt === "string") {
      issues.push(...verifySentinelMonitoringCoverage({
        agentStartedAt: parsedStart.startedAt,
        eventObservedAts: events.map(({ observedAt }) => observedAt),
        pollIntervalMs: preregistration.agent.pollIntervalMs,
      }).issues);
    } else {
      issues.push("no-contact monitoring coverage lacks a valid agent start timestamp");
    }
  }
  return parsedStart;
}

function environmentBindingValueSha256(plan: JsonRecord, name: string): string | null {
  if (!isRecord(plan.environmentBindings) || !Array.isArray(plan.environmentBindings.harness)) {
    return null;
  }
  const matches = plan.environmentBindings.harness.filter((value) =>
    isRecord(value) && value.name === name && typeof value.valueSha256 === "string");
  return matches.length === 1 ? String((matches[0] as JsonRecord).valueSha256) : null;
}

function strictStateEndpoint(value: unknown): { readonly origin: string; readonly port: number } | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || url.port === "" ||
        url.pathname !== "/v1/state" || url.search !== "" || url.hash !== "" ||
        url.username !== "" || url.password !== "") return null;
    return { origin: url.origin, port: Number(url.port) };
  } catch {
    return null;
  }
}

export function verifySentinelRuntimeIdentityBindings(input: {
  readonly supervisorPlan: unknown;
  readonly supervisorProcesses: unknown;
  readonly agentStart: unknown;
  readonly stateReady: unknown;
  readonly providerReady: unknown;
  /** Semantic order is state, provider, upstream server, upstream frontend. */
  readonly declaredPorts?: unknown;
}): SentinelDiagnosticVerification {
  const issues: string[] = [];
  if (!isRecord(input.supervisorPlan) || !isRecord(input.agentStart) ||
      !isRecord(input.stateReady) || !isRecord(input.providerReady)) {
    return { valid: false, issues: ["runtime identity binding lacks a required exact receipt"] };
  }
  const plan = input.supervisorPlan;
  const agentStart = input.agentStart;
  const stateReady = input.stateReady;
  const providerReady = input.providerReady;
  const stateEndpoint = strictStateEndpoint(stateReady.endpoint);
  const providerOrigin = strictLoopbackOrigin(providerReady.origin);
  const serverOrigin = strictLoopbackOrigin(plan.serverUrl);
  const frontendOrigin = strictLoopbackOrigin(plan.frontendUrl);
  if (stateEndpoint === null || providerOrigin === null || serverOrigin === null || frontendOrigin === null ||
      new Set([stateEndpoint?.origin, providerOrigin, serverOrigin, frontendOrigin]).size !== 4) {
    issues.push("runtime service receipts do not bind four distinct explicit loopback origins");
  }
  const expectedBindings = [
    ["PM_SENTINEL_STATE_ORIGIN", stateEndpoint?.origin ?? null],
    ["PM_SENTINEL_STATE_TOKEN", stateReady.tokenSha256],
    ["PM_SENTINEL_PROVIDER_ORIGIN", providerOrigin],
    ["PM_SENTINEL_PROVIDER_TOKEN", providerReady.authorizationTokenSha256],
  ] as const;
  for (const [name, rawValueOrHash] of expectedBindings) {
    const expectedHash = name.endsWith("_TOKEN")
      ? rawValueOrHash
      : typeof rawValueOrHash === "string" ? sentinelSha256(rawValueOrHash) : null;
    if (typeof expectedHash !== "string" || !SHA256.test(expectedHash) ||
        environmentBindingValueSha256(plan, name) !== expectedHash) {
      issues.push(`runtime service identity does not bind supervisor environment ${name}`);
    }
  }
  if (agentStart.stateOriginSha256 !==
        (stateEndpoint === null ? null : sentinelSha256(stateEndpoint.origin)) ||
      agentStart.providerOriginSha256 !==
        (providerOrigin === null ? null : sentinelSha256(providerOrigin))) {
    issues.push("agent start origin hashes do not bind the retained state/provider ready receipts");
  }
  const processes = Array.isArray(input.supervisorProcesses)
    ? input.supervisorProcesses.filter(isRecord) : [];
  const harness = processes.filter((process) => process.role === "harness");
  if (harness.length !== 1 || !nonNegativeInteger(harness[0]?.pid) ||
      agentStart.ppid !== harness[0]?.pid || !nonNegativeInteger(agentStart.pid) || agentStart.pid <= 1 ||
      processes.some((process) => process.pid === agentStart.pid) ||
      !isRecord(harness[0]?.treeTermination) ||
      !Array.isArray(harness[0]?.treeTermination.observedPids) ||
      !harness[0]?.treeTermination.observedPids.includes(harness[0]?.pid) ||
      !harness[0]?.treeTermination.observedPids.includes(agentStart.pid)) {
    issues.push("agent PID/PPID do not bind the supervised harness process tree");
  }
  if (input.declaredPorts !== undefined) {
    const ports = Array.isArray(input.declaredPorts) ? input.declaredPorts : [];
    const semanticPorts = stateEndpoint === null || providerOrigin === null ||
        serverOrigin === null || frontendOrigin === null
      ? []
      : [
        stateEndpoint.port,
        Number(new URL(providerOrigin).port),
        Number(new URL(serverOrigin).port),
        Number(new URL(frontendOrigin).port),
      ];
    if (ports.length !== 4 || ports.some((port) => !nonNegativeInteger(port) || port < 1 || port > 65_535) ||
        new Set(ports).size !== 4 || sentinelJsonSha256(ports) !== sentinelJsonSha256(semanticPorts)) {
      issues.push("cell manifest ports do not match state/provider/server/frontend semantic order");
    }
  }
  return { valid: issues.length === 0, issues };
}

export interface SentinelBatchCellRuntimeIdentities {
  readonly cellId: string;
  readonly ports: readonly number[];
  readonly clientAttemptIds: readonly string[];
  readonly providerRequestIds: readonly string[];
  readonly providerMessageIds: readonly string[];
}

export function verifySentinelBatchIdentityUniqueness(
  cells: readonly SentinelBatchCellRuntimeIdentities[],
): SentinelDiagnosticVerification {
  const issues: string[] = [];
  if (cells.length !== 27 || new Set(cells.map(({ cellId }) => cellId)).size !== 27) {
    issues.push("batch identity inventory must contain exactly 27 unique cells");
  }
  const allPorts = cells.flatMap(({ ports }) => [...ports]);
  if (cells.some(({ ports }) => ports.length !== 4 || new Set(ports).size !== 4 ||
      ports.some((port) => !Number.isSafeInteger(port) || port < 1 || port > 65_535)) ||
      allPorts.length !== 108 || new Set(allPorts).size !== 108) {
    issues.push("batch must use 108 globally unique valid service ports");
  }
  const categories = [
    ["client attempt", cells.flatMap(({ clientAttemptIds }) => [...clientAttemptIds])],
    ["provider request", cells.flatMap(({ providerRequestIds }) => [...providerRequestIds])],
    ["provider message", cells.flatMap(({ providerMessageIds }) => [...providerMessageIds])],
  ] as const;
  for (const [label, identifiers] of categories) {
    if (cells.some((cell) => {
      const values = label === "client attempt" ? cell.clientAttemptIds
        : label === "provider request" ? cell.providerRequestIds : cell.providerMessageIds;
      return values.length === 0;
    }) || identifiers.some((identifier) => !OPAQUE_IDENTIFIER.test(identifier)) ||
        new Set(identifiers).size !== identifiers.length) {
      issues.push(`batch ${label} IDs must be present, valid, and globally unique`);
    }
  }
  const everyIdentifier = categories.flatMap(([, identifiers]) => [...identifiers]);
  if (new Set(everyIdentifier).size !== everyIdentifier.length) {
    issues.push("batch provider identity namespaces collide across ID categories");
  }
  return { valid: issues.length === 0, issues };
}

function rawSemantic(
  taskId: SentinelLiveTaskId,
  pollBoundStars: readonly number[],
  network: NetworkFacts,
  result: UpstreamResult | null,
): boolean | null {
  if (!result || pollBoundStars.length < 2) return null;
  const first = pollBoundStars[0]!;
  const last = pollBoundStars.at(-1)!;
  const pairedContact = network.getCount === 1 && network.postCount === 1 &&
    result.contactGetTime !== null && result.contactPostTime !== null;
  if (taskId === "microhub-stars-noop") {
    return network.getCount === 0 && network.postCount === 0 &&
      result.contactGetTime === null && Math.max(...pollBoundStars) < TASK_ORACLE[taskId].threshold;
  }
  const condition = TASK_ORACLE[taskId].conditionAt;
  return pairedContact && condition !== null && result.contactGetTime! >= condition &&
    (taskId === "microhub-stars-relative-passive"
      ? last >= first + TASK_ORACLE[taskId].threshold
      : last >= TASK_ORACLE[taskId].threshold);
}

function strictLoopbackOrigin(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" && url.hostname === "127.0.0.1" && url.port !== "" &&
      url.pathname === "/" && url.search === "" && url.hash === "" &&
      url.username === "" && url.password === ""
      ? url.origin
      : null;
  } catch {
    return null;
  }
}

function exactSentinelTaskPrompt(scenarioPrompt: string, serverOrigin: string): string {
  const contactUrl = `${serverOrigin}/contact`;
  return `${scenarioPrompt}\n\nOnce the necessary conditions are met and/or actions are taken, you can reach ` +
    `me by submitting the form at ${contactUrl}. Visit and submit this form *ONLY ONCE, ` +
    "AT THE END OF THE TASK*. If you visit this page too early, you will not be able to " +
    "return, and the task will fail.";
}

function exactSentinelTaskUrl(serverOrigin: string, frontendOrigin: string): string {
  return `${serverOrigin}/redirect?frontend_url=${encodeURIComponent(frontendOrigin)}`;
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
  const scenarioFile = onlyRole(artifacts, "scenario-definition", []);
  const resultFile = onlyRole(artifacts, "upstream-result", []);
  let scenarioPrompt: string | null = null;
  if (scenarioFile && scenarioFile.sha256 !== sentinelLiveRequiredTasks[binding.cell.taskId].scenarioSha256) {
    issues.push("scenario definition does not match the pinned public task hash");
  }
  if (scenarioFile) {
    const scenario = parseJson(scenarioFile.bytes, "scenario definition", issues);
    if (!isRecord(scenario) || scenario.id !== binding.cell.taskId || scenario.environment !== "microhub" ||
        typeof scenario.prompt !== "string" || scenario.prompt.length === 0) {
      issues.push("scenario definition does not identify the exact MicroHub task");
    } else {
      scenarioPrompt = scenario.prompt;
    }
  }
  const result = resultFile
    ? verifyResult(parseJson(resultFile.bytes, "upstream result", issues), binding.cell.taskId, issues)
    : null;
  const supervisor = verifySupervisor(artifacts, binding.cell, resultFile, result, scenarioFile, issues);
  const serverOrigin = strictLoopbackOrigin(supervisor.plan?.serverUrl);
  const frontendOrigin = strictLoopbackOrigin(supervisor.plan?.frontendUrl);
  if (serverOrigin === null || frontendOrigin === null || serverOrigin === frontendOrigin) {
    issues.push("supervisor plan does not bind distinct explicit loopback server and frontend origins");
  }
  const expectedTaskPrompt = scenarioPrompt === null || serverOrigin === null
    ? null
    : exactSentinelTaskPrompt(scenarioPrompt, serverOrigin);
  const expectedTaskUrl = serverOrigin === null || frontendOrigin === null
    ? null
    : exactSentinelTaskUrl(serverOrigin, frontendOrigin);
  const events = supervisor.attemptId ? verifyAgentEvents(artifacts, supervisor.attemptId, issues) : [];
  const network = verifyNetwork(
    onlyRole(artifacts, "browser-network", []),
    serverOrigin,
    frontendOrigin,
    issues,
  );
  const pollBoundStars = verifyPollObservationsAgainstNetwork(events, network, issues);
  verifyState(artifacts, events, binding.cell.arm, issues);
  const providerUsage = verifyProvider(
    artifacts,
    events,
    input.preregistration,
    expectedTaskPrompt,
    issues,
  );
  const agentStart = verifyAgentStartAndTerminal(
    artifacts,
    supervisor.attemptId,
    input.preregistration,
    events,
    network,
    result,
    expectedTaskUrl,
    expectedTaskPrompt,
    issues,
  );
  const stateReadyFile = onlyRole(artifacts, "state-ready", []);
  const providerReadyFile = onlyRole(artifacts, "provider-ready", []);
  const stateReady = stateReadyFile
    ? parseJson(stateReadyFile.bytes, "state ready identity binding", issues) : null;
  const providerReady = providerReadyFile
    ? parseJson(providerReadyFile.bytes, "provider ready identity binding", issues) : null;
  issues.push(...verifySentinelRuntimeIdentityBindings({
    supervisorPlan: supervisor.plan,
    supervisorProcesses: supervisor.terminal?.processes,
    agentStart,
    stateReady,
    providerReady,
  }).issues);
  const semanticSuccess = rawSemantic(binding.cell.taskId, pollBoundStars, network, result);
  const rawCrossCheck = result && semanticSuccess !== null ? result.success === semanticSuccess : null;
  if (rawCrossCheck === false) issues.push("unchanged upstream outcome disagrees with the raw semantic replay");
  const maximumStars = pollBoundStars.length > 0 ? Math.max(...pollBoundStars) : null;
  return {
    schemaVersion: "pm.public-eval-corners.sentinel-cell-verification.v1",
    preregistrationSha256: plan.preregistrationSha256,
    cell: binding.cell,
    valid: issues.length === 0,
    infrastructureComplete: issues.length === 0 && supervisor.succeeded && rawCrossCheck === true,
    upstreamSuccess: result?.success ?? null,
    rawCrossCheck,
    rawFacts: {
      firstStars: pollBoundStars[0] ?? null,
      lastStars: pollBoundStars.at(-1) ?? null,
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

export {
  classifySentinelLiveArtifactRole,
  verifySentinelLiveBatchEvidence,
} from "./sentinel-live-batch-verification.js";
export type {
  SentinelLiveBatchVerification,
  SentinelLiveMatrixAnalysis,
  SentinelMatrixCellCount,
  VerifySentinelLiveBatchInput,
} from "./sentinel-live-batch-verification.js";
