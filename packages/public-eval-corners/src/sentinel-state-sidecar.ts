import { createHash, timingSafeEqual } from "node:crypto";
import {
  closeSync,
  constants,
  fsyncSync,
  lstatSync,
  openSync,
  readFileSync,
  realpathSync,
  writeFileSync,
  writeSync,
} from "node:fs";
import { createServer, type IncomingMessage, type Server } from "node:http";
import { isAbsolute, join, normalize, resolve } from "node:path";
import { performance } from "node:perf_hooks";

import {
  reviewExternalStateEvidence,
  stateRef,
  toAdmittedStateEvidence,
  type AdmittedStateEvidence,
  type EvidenceAdmissionReview,
  type ExternalStateEvidence,
} from "@pm/agent-state-core";
import {
  tenantId,
  timestamp,
  type TenantId,
  type Timestamp,
} from "@pm/types";

export const SENTINEL_STATE_WRITE_SCHEMA_VERSION =
  "pm.public-eval-corners.sentinel-state-write.v1" as const;
export const SENTINEL_STATE_READ_SCHEMA_VERSION =
  "pm.public-eval-corners.sentinel-state-read.v1" as const;
export const SENTINEL_STATE_RESPONSE_SCHEMA_VERSION =
  "pm.public-eval-corners.sentinel-state-response.v1" as const;
export const SENTINEL_STATE_AUDIT_SCHEMA_VERSION =
  "pm.public-eval-corners.sentinel-state-audit-entry.v1" as const;
export const SENTINEL_STATE_READY_SCHEMA_VERSION =
  "pm.public-eval-corners.sentinel-state-ready-receipt.v1" as const;
export const SENTINEL_STATE_FINAL_SCHEMA_VERSION =
  "pm.public-eval-corners.sentinel-state-final-receipt.v1" as const;

export const SENTINEL_STATE_CONTEXT_WIDTH = 512;
export const SENTINEL_STATE_PADDING_WIDTH = 128;
export const SENTINEL_STATE_MAX_BODY_BYTES = 16_384;

const LOOPBACK_HOST = "127.0.0.1";
const AUDIT_FILE = "sentinel-state-audit.ndjson";
const READY_FILE = "sentinel-state-ready.json";
const FINAL_FILE = "sentinel-state-final.json";
const HASH_GENESIS = "0".repeat(64);
const EMPTY_CONTEXT = "NO_RELEVANT_BROWSER_OBSERVATION";
const WRITE_CONTEXT = "BROWSER_OBSERVATION_REVIEWED";
const RESPONSE_PADDING = ".".repeat(SENTINEL_STATE_PADDING_WIDTH);
const SAFE_TEXT = /^[A-Za-z0-9 .,:;_+\-/%()#@?=]*$/;
const OPERATION_ID = /^[a-f0-9]{32}$/;
const MEMORY_KEY = /^[a-z0-9][a-z0-9._-]{0,63}$/;

type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

type JsonRecord = Record<string, unknown>;

/** This value is process-private. It is never serialized into agent traffic. */
export type SentinelStateSidecarMode = "native" | "sham" | "substrate";

export interface SentinelStateWriteRequest {
  readonly schemaVersion: typeof SENTINEL_STATE_WRITE_SCHEMA_VERSION;
  readonly operationId: string;
  readonly memoryKey: string;
  readonly observation: {
    readonly source: "browser_observation";
    readonly observedAt: string;
    readonly value: string;
  };
}

export interface SentinelStateReadRequest {
  readonly schemaVersion: typeof SENTINEL_STATE_READ_SCHEMA_VERSION;
  readonly operationId: string;
  readonly memoryKey: string;
}

export interface SentinelStateResponse {
  readonly schemaVersion: typeof SENTINEL_STATE_RESPONSE_SCHEMA_VERSION;
  readonly operationId: string;
  readonly status: "ok" | "rejected";
  readonly contextEncoding: "fixed-ascii-space-padded-v1";
  readonly context: string;
  readonly padding: string;
}

export type SentinelStateRejectionReason =
  | "none"
  | "unauthorized"
  | "body_too_large"
  | "invalid_body"
  | "duplicate_operation_id"
  | "route_not_found"
  | "evidence_rejected"
  | "internal_failure";

export interface SentinelStateAuditEntry {
  readonly schemaVersion: typeof SENTINEL_STATE_AUDIT_SCHEMA_VERSION;
  readonly sequence: number;
  readonly recordedAt: Timestamp;
  readonly operationId: string;
  readonly requestKind: "write" | "read" | "rejected";
  readonly authenticated: boolean;
  readonly requestSha256: string;
  readonly responseStatus: "ok" | "rejected";
  readonly httpStatus: number;
  readonly rejectionReason: SentinelStateRejectionReason;
  readonly admissionReview: EvidenceAdmissionReview | null;
  readonly admittedEvidence: AdmittedStateEvidence | null;
  readonly stateSha256: string;
  readonly previousEntrySha256: string;
  readonly entrySha256: string;
}

export interface SentinelStateRequestCounts {
  readonly total: number;
  readonly authenticated: number;
  readonly rejected: number;
  readonly writes: number;
  readonly reads: number;
  readonly duplicateOperationIds: number;
}

export interface SentinelStateAdmissionCounts {
  readonly admitted: number;
  readonly admittedWithWarnings: number;
  readonly rejected: number;
}

export interface SentinelStateReadyReceipt {
  readonly schemaVersion: typeof SENTINEL_STATE_READY_SCHEMA_VERSION;
  readonly pid: number;
  readonly tokenSha256: string;
  readonly startedAt: Timestamp;
  readonly endpoint: string;
  readonly minimumLatencyMs: number;
  readonly auditGenesisSha256: string;
  readonly initialStateSha256: string;
  readonly receiptSha256: string;
}

export interface SentinelStateFinalReceipt {
  readonly schemaVersion: typeof SENTINEL_STATE_FINAL_SCHEMA_VERSION;
  readonly pid: number;
  readonly tokenSha256: string;
  readonly startedAt: Timestamp;
  readonly finalizedAt: Timestamp;
  readonly requestCounts: SentinelStateRequestCounts;
  readonly admissionReviews: SentinelStateAdmissionCounts;
  readonly stateSha256: string;
  readonly auditEntryCount: number;
  readonly auditHeadSha256: string;
  readonly readyReceiptFileSha256: string;
  readonly receiptSha256: string;
}

export interface StartSentinelStateSidecarInput {
  readonly mode: SentinelStateSidecarMode;
  readonly outputDirectory: string;
  readonly bearerToken: string;
  readonly tenant: string | TenantId;
  readonly port?: number;
  readonly minimumLatencyMs?: number;
}

export interface RunningSentinelStateSidecar {
  readonly endpoint: string;
  readonly readyReceipt: SentinelStateReadyReceipt;
  readonly readyReceiptPath: string;
  readonly auditPath: string;
  readonly finalReceiptPath: string;
  stop(): Promise<SentinelStateFinalReceipt>;
}

export interface SentinelStateVerificationResult {
  readonly valid: boolean;
  readonly issues: readonly string[];
  readonly auditHeadSha256: string;
}

class RequestFailure extends Error {
  constructor(
    readonly httpStatus: number,
    readonly reason: SentinelStateRejectionReason,
    message: string,
  ) {
    super(message);
  }
}

export function canonicalJson(value: JsonValue): string {
  if (value === null || typeof value === "boolean" || typeof value === "number") {
    if (typeof value === "number" && !Number.isFinite(value)) {
      throw new Error("canonical JSON rejects non-finite numbers");
    }
    return JSON.stringify(value);
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  }
  const record = value as { readonly [key: string]: JsonValue };
  return `{${Object.keys(record)
    .sort(compareCodeUnits)
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key] as JsonValue)}`)
    .join(",")}}`;
}

export function sha256Hex(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

export function parseSentinelStateWriteRequest(
  value: unknown,
): SentinelStateWriteRequest {
  const record = requireRecord(value, "write request");
  requireExactKeys(
    record,
    ["memoryKey", "observation", "operationId", "schemaVersion"],
    "write request",
  );
  if (record.schemaVersion !== SENTINEL_STATE_WRITE_SCHEMA_VERSION) {
    throw new Error("write request schemaVersion is not supported");
  }
  const operationId = requireOperationId(record.operationId);
  const memoryKey = requireMemoryKey(record.memoryKey);
  const observation = requireRecord(record.observation, "write observation");
  requireExactKeys(
    observation,
    ["observedAt", "source", "value"],
    "write observation",
  );
  if (observation.source !== "browser_observation") {
    throw new Error("write observation source must be browser_observation");
  }
  const observedAt = requireCanonicalTimestamp(observation.observedAt);
  const observedValue = requireSafeText(observation.value, "observation value", 1, 256);
  return {
    schemaVersion: SENTINEL_STATE_WRITE_SCHEMA_VERSION,
    operationId,
    memoryKey,
    observation: {
      source: "browser_observation",
      observedAt,
      value: observedValue,
    },
  };
}

export function parseSentinelStateReadRequest(value: unknown): SentinelStateReadRequest {
  const record = requireRecord(value, "read request");
  requireExactKeys(
    record,
    ["memoryKey", "operationId", "schemaVersion"],
    "read request",
  );
  if (record.schemaVersion !== SENTINEL_STATE_READ_SCHEMA_VERSION) {
    throw new Error("read request schemaVersion is not supported");
  }
  return {
    schemaVersion: SENTINEL_STATE_READ_SCHEMA_VERSION,
    operationId: requireOperationId(record.operationId),
    memoryKey: requireMemoryKey(record.memoryKey),
  };
}

export function parseSentinelStateResponse(value: unknown): SentinelStateResponse {
  const record = requireRecord(value, "sidecar response");
  requireExactKeys(
    record,
    [
      "context",
      "contextEncoding",
      "operationId",
      "padding",
      "schemaVersion",
      "status",
    ],
    "sidecar response",
  );
  if (record.schemaVersion !== SENTINEL_STATE_RESPONSE_SCHEMA_VERSION) {
    throw new Error("sidecar response schemaVersion is not supported");
  }
  if (record.contextEncoding !== "fixed-ascii-space-padded-v1") {
    throw new Error("sidecar response contextEncoding is not supported");
  }
  if (record.status !== "ok" && record.status !== "rejected") {
    throw new Error("sidecar response status is invalid");
  }
  const context = requireSafeText(
    record.context,
    "sidecar response context",
    SENTINEL_STATE_CONTEXT_WIDTH,
    SENTINEL_STATE_CONTEXT_WIDTH,
  );
  if (record.padding !== RESPONSE_PADDING) {
    throw new Error("sidecar response padding is invalid");
  }
  return {
    schemaVersion: SENTINEL_STATE_RESPONSE_SCHEMA_VERSION,
    operationId: requireOperationId(record.operationId),
    status: record.status,
    contextEncoding: "fixed-ascii-space-padded-v1",
    context,
    padding: RESPONSE_PADDING,
  };
}

export function buildSentinelStateResponse(
  operationId: string,
  status: "ok" | "rejected",
  context: string,
): SentinelStateResponse {
  return {
    schemaVersion: SENTINEL_STATE_RESPONSE_SCHEMA_VERSION,
    operationId: requireOperationId(operationId),
    status,
    contextEncoding: "fixed-ascii-space-padded-v1",
    context: fixedContext(context),
    padding: RESPONSE_PADDING,
  };
}

export function verifySentinelStateAuditChain(
  entries: readonly SentinelStateAuditEntry[],
): SentinelStateVerificationResult {
  const issues: string[] = [];
  let previous = HASH_GENESIS;
  entries.forEach((entry, index) => {
    if (entry.sequence !== index + 1) {
      issues.push(`audit entry ${index + 1} has non-contiguous sequence`);
    }
    if (entry.previousEntrySha256 !== previous) {
      issues.push(`audit entry ${index + 1} has the wrong previous-entry hash`);
    }
    const expected = auditEntryHash(entry);
    if (entry.entrySha256 !== expected) {
      issues.push(`audit entry ${index + 1} hash does not match its content`);
    }
    previous = entry.entrySha256;
  });
  return { valid: issues.length === 0, issues, auditHeadSha256: previous };
}

export function verifySentinelStateSidecarEvidence(
  ready: SentinelStateReadyReceipt,
  final: SentinelStateFinalReceipt,
  entries: readonly SentinelStateAuditEntry[],
): SentinelStateVerificationResult {
  const chain = verifySentinelStateAuditChain(entries);
  const issues = [...chain.issues];
  if (ready.receiptSha256 !== receiptHash(ready)) {
    issues.push("ready receipt hash does not match its content");
  }
  if (final.receiptSha256 !== receiptHash(final)) {
    issues.push("final receipt hash does not match its content");
  }
  if (
    final.readyReceiptFileSha256 !==
    sha256Hex(`${JSON.stringify(ready, null, 2)}\n`)
  ) {
    issues.push("final receipt does not bind the ready receipt bytes");
  }
  if (
    final.pid !== ready.pid ||
    final.tokenSha256 !== ready.tokenSha256 ||
    final.startedAt !== ready.startedAt
  ) {
    issues.push("ready/final process identity binding does not match");
  }
  if (final.auditEntryCount !== entries.length) {
    issues.push("final receipt audit entry count does not match");
  }
  if (final.auditHeadSha256 !== chain.auditHeadSha256) {
    issues.push("final receipt audit head does not match");
  }
  const expectedState =
    entries.at(-1)?.stateSha256 ?? ready.initialStateSha256;
  if (final.stateSha256 !== expectedState) {
    issues.push("final receipt state hash does not match the last audit entry");
  }
  const counts = countsFromEntries(entries);
  if (
    canonicalJson(final.requestCounts as unknown as JsonValue) !==
    canonicalJson(counts.requests as unknown as JsonValue)
  ) {
    issues.push("final receipt request counts do not match the audit");
  }
  if (
    canonicalJson(final.admissionReviews as unknown as JsonValue) !==
    canonicalJson(counts.admissions as unknown as JsonValue)
  ) {
    issues.push("final receipt admission counts do not match the audit");
  }
  return {
    valid: issues.length === 0,
    issues,
    auditHeadSha256: chain.auditHeadSha256,
  };
}

export function readSentinelStateAuditFile(path: string): readonly SentinelStateAuditEntry[] {
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error("audit path must be a regular non-symlink file");
  }
  const text = readFileSync(path, "utf8");
  if (text.length === 0) return [];
  if (!text.endsWith("\n")) throw new Error("audit file is missing its terminal newline");
  return text
    .trimEnd()
    .split("\n")
    .map((line, index) => {
      try {
        return JSON.parse(line) as SentinelStateAuditEntry;
      } catch {
        throw new Error(`audit line ${index + 1} is not valid JSON`);
      }
    });
}

export async function startSentinelStateSidecar(
  input: StartSentinelStateSidecarInput,
): Promise<RunningSentinelStateSidecar> {
  const config = validateStartInput(input);
  assertSafeOutputDirectory(config.outputDirectory);

  const auditPath = join(config.outputDirectory, AUDIT_FILE);
  const readyReceiptPath = join(config.outputDirectory, READY_FILE);
  const finalReceiptPath = join(config.outputDirectory, FINAL_FILE);
  assertFreshArtifactPaths([auditPath, readyReceiptPath, finalReceiptPath]);

  const auditFd = openSync(auditPath, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600);
  fsyncSync(auditFd);
  fsyncDirectory(config.outputDirectory);

  const startedAt = currentTimestamp();
  const tokenSha256 = sha256Hex(config.bearerToken);
  const persistedWrites: AdmittedStateEvidence[] = [];
  const latestByKey = new Map<string, SentinelStateWriteRequest>();
  const operationIds = new Set<string>();
  const entries: SentinelStateAuditEntry[] = [];
  let auditHead = HASH_GENESIS;
  let stopped: Promise<SentinelStateFinalReceipt> | undefined;
  const inFlightRequests = new Set<Promise<void>>();
  let acceptingRequests = true;

  const stateSha256 = (): string =>
    sha256Hex(canonicalJson(persistedWrites as unknown as JsonValue));
  const initialStateSha256 = stateSha256();

  const appendAudit = (body: Omit<SentinelStateAuditEntry, "entrySha256">): void => {
    const entrySha256 = sha256Hex(canonicalJson(body as unknown as JsonValue));
    const entry: SentinelStateAuditEntry = { ...body, entrySha256 };
    writeSync(auditFd, `${JSON.stringify(entry)}\n`, undefined, "utf8");
    fsyncSync(auditFd);
    entries.push(entry);
    auditHead = entrySha256;
  };

  const server = createServer((request, response) => {
    if (!acceptingRequests) {
      response.writeHead(503, { connection: "close", "content-length": "0" });
      response.end();
      return;
    }
    const beganAt = performance.now();
    const body = handleRequest({
      request,
      bearerToken: config.bearerToken,
      tenant: config.tenant,
      mode: config.mode,
      operationIds,
      persistedWrites,
      latestByKey,
      stateSha256,
    })
      .then((result) => {
        appendAudit({
          schemaVersion: SENTINEL_STATE_AUDIT_SCHEMA_VERSION,
          sequence: entries.length + 1,
          recordedAt: currentTimestamp(),
          operationId: result.operationId,
          requestKind: result.requestKind,
          authenticated: result.authenticated,
          requestSha256: result.requestSha256,
          responseStatus: result.response.status,
          httpStatus: result.httpStatus,
          rejectionReason: result.rejectionReason,
          admissionReview: result.admissionReview,
          admittedEvidence: result.admittedEvidence,
          stateSha256: stateSha256(),
          previousEntrySha256: auditHead,
        });
        return sendAfterMinimumLatency(
          response,
          result.httpStatus,
          result.response,
          beganAt,
          config.minimumLatencyMs,
        );
      })
      .catch(async () => {
        const operationId = sha256Hex(`internal\0${entries.length + 1}`).slice(0, 32);
        const result = buildSentinelStateResponse(
          operationId,
          "rejected",
          "REQUEST_REJECTED",
        );
        appendAudit({
          schemaVersion: SENTINEL_STATE_AUDIT_SCHEMA_VERSION,
          sequence: entries.length + 1,
          recordedAt: currentTimestamp(),
          operationId,
          requestKind: "rejected",
          authenticated: false,
          requestSha256: sha256Hex("unavailable"),
          responseStatus: "rejected",
          httpStatus: 500,
          rejectionReason: "internal_failure",
          admissionReview: null,
          admittedEvidence: null,
          stateSha256: stateSha256(),
          previousEntrySha256: auditHead,
        });
        await sendAfterMinimumLatency(
          response,
          500,
          result,
          beganAt,
          config.minimumLatencyMs,
        );
      });
    let operation!: Promise<void>;
    operation = body.finally(() => inFlightRequests.delete(operation));
    inFlightRequests.add(operation);
    void operation;
  });

  try {
    await listenLoopback(server, config.port);
  } catch (error) {
    closeSync(auditFd);
    throw error;
  }
  const address = server.address();
  if (address === null || typeof address === "string") {
    closeSync(auditFd);
    server.close();
    throw new Error("sidecar failed to acquire a loopback TCP address");
  }
  if (address.address !== LOOPBACK_HOST) {
    closeSync(auditFd);
    server.close();
    throw new Error("sidecar refused a non-loopback listener");
  }
  const endpoint = `http://${LOOPBACK_HOST}:${address.port}/v1/state`;
  const readyBody = {
    schemaVersion: SENTINEL_STATE_READY_SCHEMA_VERSION,
    pid: process.pid,
    tokenSha256,
    startedAt,
    endpoint,
    minimumLatencyMs: config.minimumLatencyMs,
    auditGenesisSha256: HASH_GENESIS,
    initialStateSha256,
  };
  const readyReceipt: SentinelStateReadyReceipt = {
    ...readyBody,
    receiptSha256: sha256Hex(canonicalJson(readyBody as unknown as JsonValue)),
  };
  const readyReceiptBytes = `${JSON.stringify(readyReceipt, null, 2)}\n`;
  writeExclusiveDurable(readyReceiptPath, readyReceiptBytes, config.outputDirectory);

  const stop = (): Promise<SentinelStateFinalReceipt> => {
    stopped ??= (async () => {
      acceptingRequests = false;
      const serverClosing = closeServer(server);
      await Promise.allSettled([...inFlightRequests]);
      await serverClosing;
      await Promise.allSettled([...inFlightRequests]);
      fsyncSync(auditFd);
      closeSync(auditFd);
      const finalBody = {
        schemaVersion: SENTINEL_STATE_FINAL_SCHEMA_VERSION,
        pid: process.pid,
        tokenSha256,
        startedAt,
        finalizedAt: currentTimestamp(),
        requestCounts: countsFromEntries(entries).requests,
        admissionReviews: countsFromEntries(entries).admissions,
        stateSha256: stateSha256(),
        auditEntryCount: entries.length,
        auditHeadSha256: auditHead,
        readyReceiptFileSha256: sha256Hex(readyReceiptBytes),
      };
      const finalReceipt: SentinelStateFinalReceipt = {
        ...finalBody,
        receiptSha256: sha256Hex(canonicalJson(finalBody as unknown as JsonValue)),
      };
      writeExclusiveDurable(
        finalReceiptPath,
        `${JSON.stringify(finalReceipt, null, 2)}\n`,
        config.outputDirectory,
      );
      return finalReceipt;
    })();
    return stopped;
  };

  return {
    endpoint,
    readyReceipt,
    readyReceiptPath,
    auditPath,
    finalReceiptPath,
    stop,
  };
}

interface ValidatedStartInput {
  readonly mode: SentinelStateSidecarMode;
  readonly outputDirectory: string;
  readonly bearerToken: string;
  readonly tenant: TenantId;
  readonly port: number;
  readonly minimumLatencyMs: number;
}

interface RequestResult {
  readonly operationId: string;
  readonly requestKind: "write" | "read" | "rejected";
  readonly authenticated: boolean;
  readonly requestSha256: string;
  readonly httpStatus: number;
  readonly rejectionReason: SentinelStateRejectionReason;
  readonly admissionReview: EvidenceAdmissionReview | null;
  readonly admittedEvidence: AdmittedStateEvidence | null;
  readonly response: SentinelStateResponse;
}

interface HandleRequestInput {
  readonly request: IncomingMessage;
  readonly bearerToken: string;
  readonly tenant: TenantId;
  readonly mode: SentinelStateSidecarMode;
  readonly operationIds: Set<string>;
  readonly persistedWrites: AdmittedStateEvidence[];
  readonly latestByKey: Map<string, SentinelStateWriteRequest>;
  readonly stateSha256: () => string;
}

async function handleRequest(input: HandleRequestInput): Promise<RequestResult> {
  let rawBody: Buffer<ArrayBufferLike> = Buffer.alloc(0);
  try {
    rawBody = await readRequestBody(input.request);
  } catch (error) {
    const failure = asRequestFailure(error);
    return rejectedResult(
      syntheticOperationId(rawBody, failure.reason),
      false,
      sha256Hex(rawBody),
      failure,
    );
  }
  const requestSha256 = sha256Hex(rawBody);
  if (!authorized(input.request, input.bearerToken)) {
    return rejectedResult(
      syntheticOperationId(rawBody, "unauthorized"),
      false,
      requestSha256,
      new RequestFailure(401, "unauthorized", "request authorization failed"),
    );
  }
  const route = `${input.request.method ?? ""} ${input.request.url ?? ""}`;
  if (route !== "POST /v1/state/write" && route !== "POST /v1/state/read") {
    return rejectedResult(
      syntheticOperationId(rawBody, "route_not_found"),
      true,
      requestSha256,
      new RequestFailure(404, "route_not_found", "route is not available"),
    );
  }
  if (!isJsonContentType(input.request.headers["content-type"])) {
    return rejectedResult(
      syntheticOperationId(rawBody, "invalid_body"),
      true,
      requestSha256,
      new RequestFailure(400, "invalid_body", "content-type must be application/json"),
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody.toString("utf8")) as unknown;
  } catch {
    return rejectedResult(
      syntheticOperationId(rawBody, "invalid_body"),
      true,
      requestSha256,
      new RequestFailure(400, "invalid_body", "body is not valid JSON"),
    );
  }
  if (containsString(parsed, input.bearerToken)) {
    return rejectedResult(
      syntheticOperationId(rawBody, "invalid_body"),
      true,
      requestSha256,
      new RequestFailure(400, "invalid_body", "body may not contain authentication material"),
    );
  }

  try {
    if (route.endsWith("/write")) {
      const request = parseSentinelStateWriteRequest(parsed);
      rejectDuplicate(request.operationId, input.operationIds);
      const { review, admitted } = reviewObservation(request, input.tenant);
      if (admitted === undefined) {
        return {
          operationId: request.operationId,
          requestKind: "write",
          authenticated: true,
          requestSha256,
          httpStatus: 422,
          rejectionReason: "evidence_rejected",
          admissionReview: review,
          admittedEvidence: null,
          response: buildSentinelStateResponse(
            request.operationId,
            "rejected",
            "OBSERVATION_REJECTED",
          ),
        };
      }
      if (input.mode !== "native") {
        input.persistedWrites.push(admitted);
        // The public Sentinel relative task is specifically a baseline-retention
        // test. Preserve the first admitted observation under the key; replacing
        // it with every subsequent poll would silently turn the treatment into a
        // latest-value cache and erase the state needed for the relative delta.
        if (!input.latestByKey.has(request.memoryKey)) {
          input.latestByKey.set(request.memoryKey, request);
        }
      }
      return {
        operationId: request.operationId,
        requestKind: "write",
        authenticated: true,
        requestSha256,
        httpStatus: 200,
        rejectionReason: "none",
        admissionReview: review,
        admittedEvidence: admitted,
        response: buildSentinelStateResponse(request.operationId, "ok", WRITE_CONTEXT),
      };
    }

    const request = parseSentinelStateReadRequest(parsed);
    rejectDuplicate(request.operationId, input.operationIds);
    const memory = input.mode === "substrate" ? input.latestByKey.get(request.memoryKey) : undefined;
    const context = memory === undefined ? EMPTY_CONTEXT : observationContext(memory);
    return {
      operationId: request.operationId,
      requestKind: "read",
      authenticated: true,
      requestSha256,
      httpStatus: 200,
      rejectionReason: "none",
      admissionReview: null,
      admittedEvidence: null,
      response: buildSentinelStateResponse(request.operationId, "ok", context),
    };
  } catch (error) {
    const failure = asRequestFailure(error);
    const operationId = operationIdFromParsed(parsed) ?? syntheticOperationId(rawBody, failure.reason);
    return rejectedResult(operationId, true, requestSha256, failure);
  }
}

function reviewObservation(
  request: SentinelStateWriteRequest,
  tenant: TenantId,
): { readonly review: EvidenceAdmissionReview; readonly admitted?: AdmittedStateEvidence } {
  const evaluatedAt = currentTimestamp();
  const subject = stateRef("document", `sentinel-browser-observation:${request.memoryKey}`);
  const payload = {
    memoryKey: request.memoryKey,
    source: request.observation.source,
    observedAt: request.observation.observedAt,
    value: request.observation.value,
  };
  const evidence: ExternalStateEvidence = {
    tenantId: tenant,
    evidenceId: request.operationId,
    kind: "memory_write",
    source: "browser://sentinel-agent-observation",
    claimsAuthority: false,
    subject,
    refs: [subject],
    observedAt: timestamp(request.observation.observedAt),
    collectedBy: "pm.public-eval-corners.sentinel-state-sidecar",
    collectedAt: evaluatedAt,
    clientSurface: "sentinel-browser-agent",
    payload,
    payloadHash: sha256Hex(canonicalJson(payload)),
    memory: {
      sourceModality: "browser_text",
      sourceChannel: "browser_observation",
      retentionPolicy: "ephemeral-public-eval-sidecar",
      intendedUse: "observation",
      influenceKind: "fact",
      overrideStatus: "active",
      deletionResidueRisk: "none",
      staleInformationRisk: "low",
      observableFeatureBoundary: "agent-visible browser observation only",
    },
  };
  const review = reviewExternalStateEvidence(evidence, {
    tenantId: tenant,
    evaluatedAt,
    expectedSubject: subject,
  });
  const admitted = toAdmittedStateEvidence(review);
  return admitted === undefined ? { review } : { review, admitted };
}

function observationContext(request: SentinelStateWriteRequest): string {
  return [
    `memory_key=${request.memoryKey}`,
    `observed_at=${request.observation.observedAt}`,
    `browser_observation=${request.observation.value}`,
  ].join("; ");
}

function fixedContext(value: string): string {
  const safe = requireSafeText(value, "response context", 0, SENTINEL_STATE_CONTEXT_WIDTH);
  return safe.padEnd(SENTINEL_STATE_CONTEXT_WIDTH, " ");
}

function rejectedResult(
  operationId: string,
  authenticated: boolean,
  requestSha256: string,
  failure: RequestFailure,
): RequestResult {
  return {
    operationId,
    requestKind: "rejected",
    authenticated,
    requestSha256,
    httpStatus: failure.httpStatus,
    rejectionReason: failure.reason,
    admissionReview: null,
    admittedEvidence: null,
    response: buildSentinelStateResponse(operationId, "rejected", "REQUEST_REJECTED"),
  };
}

function validateStartInput(input: StartSentinelStateSidecarInput): ValidatedStartInput {
  if (input.mode !== "native" && input.mode !== "sham" && input.mode !== "substrate") {
    throw new Error("sidecar mode is invalid");
  }
  if (
    typeof input.bearerToken !== "string" ||
    input.bearerToken.length < 32 ||
    input.bearerToken.length > 512 ||
    !/^[\x21-\x7e]+$/.test(input.bearerToken)
  ) {
    throw new Error("sidecar bearer token must be 32-512 non-whitespace ASCII bytes");
  }
  const tenant = String(input.tenant);
  if (!/^[A-Za-z0-9._:-]{1,128}$/.test(tenant)) {
    throw new Error("sidecar tenant is invalid");
  }
  const port = input.port ?? 0;
  if (!Number.isInteger(port) || port < 0 || port > 65_535) {
    throw new Error("sidecar port must be an integer from 0 to 65535");
  }
  const minimumLatencyMs = input.minimumLatencyMs ?? 25;
  if (
    !Number.isInteger(minimumLatencyMs) ||
    minimumLatencyMs < 1 ||
    minimumLatencyMs > 60_000
  ) {
    throw new Error("sidecar minimum latency must be an integer from 1 to 60000 ms");
  }
  return {
    mode: input.mode,
    outputDirectory: input.outputDirectory,
    bearerToken: input.bearerToken,
    tenant: tenantId(tenant),
    port,
    minimumLatencyMs,
  };
}

function assertSafeOutputDirectory(outputDirectory: string): void {
  if (
    typeof outputDirectory !== "string" ||
    !isAbsolute(outputDirectory) ||
    normalize(outputDirectory) !== outputDirectory ||
    resolve(outputDirectory) !== outputDirectory
  ) {
    throw new Error("sidecar output directory must be an absolute normalized path");
  }
  const stat = lstatSync(outputDirectory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error("sidecar output directory must be a non-symlink directory");
  }
  if (realpathSync.native(outputDirectory) !== outputDirectory) {
    throw new Error("sidecar output directory may not traverse a symlink");
  }
  const probe = join(outputDirectory, ".");
  if (resolve(probe) !== outputDirectory) {
    throw new Error("sidecar output directory failed containment verification");
  }
}

function assertFreshArtifactPaths(paths: readonly string[]): void {
  for (const path of paths) {
    try {
      lstatSync(path);
      throw new Error("sidecar artifact path already exists");
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") continue;
      throw error;
    }
  }
}

function writeExclusiveDurable(path: string, bytes: string, directory: string): void {
  writeFileSync(path, bytes, { encoding: "utf8", flag: "wx", mode: 0o600 });
  const fd = openSync(path, constants.O_RDONLY);
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  fsyncDirectory(directory);
}

function fsyncDirectory(directory: string): void {
  const fd = openSync(directory, constants.O_RDONLY);
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

async function listenLoopback(server: Server, port: number): Promise<void> {
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const onError = (error: Error): void => rejectPromise(error);
    server.once("error", onError);
    server.listen({ host: LOOPBACK_HOST, port, exclusive: true }, () => {
      server.off("error", onError);
      resolvePromise();
    });
  });
}

async function closeServer(server: Server): Promise<void> {
  if (!server.listening) return;
  await new Promise<void>((resolvePromise, rejectPromise) => {
    server.close((error) => (error === undefined ? resolvePromise() : rejectPromise(error)));
  });
}

async function readRequestBody(request: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let byteLength = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
    byteLength += bytes.byteLength;
    if (byteLength > SENTINEL_STATE_MAX_BODY_BYTES) {
      throw new RequestFailure(413, "body_too_large", "request body is too large");
    }
    chunks.push(bytes);
  }
  return Buffer.concat(chunks);
}

function authorized(request: IncomingMessage, bearerToken: string): boolean {
  const provided = request.headers.authorization;
  if (typeof provided !== "string" || !provided.startsWith("Bearer ")) return false;
  const actualHash = Buffer.from(sha256Hex(provided.slice("Bearer ".length)), "hex");
  const expectedHash = Buffer.from(sha256Hex(bearerToken), "hex");
  return timingSafeEqual(actualHash, expectedHash);
}

function isJsonContentType(value: string | readonly string[] | undefined): boolean {
  return typeof value === "string" && value.toLowerCase().split(";", 1)[0]?.trim() === "application/json";
}

function rejectDuplicate(operationId: string, operationIds: Set<string>): void {
  if (operationIds.has(operationId)) {
    throw new RequestFailure(409, "duplicate_operation_id", "operationId was already used");
  }
  operationIds.add(operationId);
}

function operationIdFromParsed(value: unknown): string | undefined {
  if (!isRecord(value) || !OPERATION_ID.test(String(value.operationId ?? ""))) return undefined;
  return String(value.operationId);
}

function syntheticOperationId(body: Uint8Array, reason: string): string {
  return sha256Hex(`${reason}\0${sha256Hex(body)}`).slice(0, 32);
}

function asRequestFailure(error: unknown): RequestFailure {
  return error instanceof RequestFailure
    ? error
    : new RequestFailure(400, "invalid_body", "request did not match its strict schema");
}

async function sendAfterMinimumLatency(
  response: import("node:http").ServerResponse,
  status: number,
  body: SentinelStateResponse,
  beganAt: number,
  minimumLatencyMs: number,
): Promise<void> {
  const remaining = minimumLatencyMs - (performance.now() - beganAt);
  if (remaining > 0) await new Promise((resolvePromise) => setTimeout(resolvePromise, remaining));
  const bytes = JSON.stringify(body);
  response.writeHead(status, {
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(bytes),
    connection: "close",
  });
  response.end(bytes);
}

function countsFromEntries(entries: readonly SentinelStateAuditEntry[]): {
  readonly requests: SentinelStateRequestCounts;
  readonly admissions: SentinelStateAdmissionCounts;
} {
  const requests = {
    total: entries.length,
    authenticated: entries.filter((entry) => entry.authenticated).length,
    rejected: entries.filter((entry) => entry.responseStatus === "rejected").length,
    writes: entries.filter((entry) => entry.requestKind === "write").length,
    reads: entries.filter((entry) => entry.requestKind === "read").length,
    duplicateOperationIds: entries.filter(
      (entry) => entry.rejectionReason === "duplicate_operation_id",
    ).length,
  };
  const reviews = entries
    .map((entry) => entry.admissionReview)
    .filter((review): review is EvidenceAdmissionReview => review !== null);
  const admissions = {
    admitted: reviews.filter((review) => review.decision === "admitted").length,
    admittedWithWarnings: reviews.filter(
      (review) => review.decision === "admitted_with_warnings",
    ).length,
    rejected: reviews.filter((review) => review.decision === "rejected").length,
  };
  return { requests, admissions };
}

function auditEntryHash(entry: SentinelStateAuditEntry): string {
  const { entrySha256: _entrySha256, ...body } = entry;
  return sha256Hex(canonicalJson(body as unknown as JsonValue));
}

function receiptHash(
  receipt: SentinelStateReadyReceipt | SentinelStateFinalReceipt,
): string {
  const { receiptSha256: _receiptSha256, ...body } = receipt;
  return sha256Hex(canonicalJson(body as unknown as JsonValue));
}

function requireRecord(value: unknown, label: string): JsonRecord {
  if (!isRecord(value)) throw new Error(`${label} must be an object`);
  return value;
}

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function containsString(value: unknown, forbidden: string): boolean {
  if (typeof value === "string") return value.includes(forbidden);
  if (Array.isArray(value)) return value.some((entry) => containsString(entry, forbidden));
  if (!isRecord(value)) return false;
  return Object.values(value).some((entry) => containsString(entry, forbidden));
}

function requireExactKeys(record: JsonRecord, keys: readonly string[], label: string): void {
  if (Object.keys(record).sort(compareCodeUnits).join("\0") !== [...keys].sort(compareCodeUnits).join("\0")) {
    throw new Error(`${label} contains missing or unknown keys`);
  }
}

function requireOperationId(value: unknown): string {
  if (typeof value !== "string" || !OPERATION_ID.test(value)) {
    throw new Error("operationId must be exactly 32 lowercase hexadecimal characters");
  }
  return value;
}

function requireMemoryKey(value: unknown): string {
  if (typeof value !== "string" || !MEMORY_KEY.test(value)) {
    throw new Error("memoryKey is invalid");
  }
  return value;
}

function requireCanonicalTimestamp(value: unknown): string {
  if (typeof value !== "string") throw new Error("observedAt must be a string");
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) {
    throw new Error("observedAt must be a canonical UTC timestamp with milliseconds");
  }
  return value;
}

function requireSafeText(
  value: unknown,
  label: string,
  minimumLength: number,
  maximumLength: number,
): string {
  if (
    typeof value !== "string" ||
    value.length < minimumLength ||
    value.length > maximumLength ||
    !SAFE_TEXT.test(value)
  ) {
    throw new Error(`${label} must be safe printable ASCII within its fixed bounds`);
  }
  return value;
}

function currentTimestamp(): Timestamp {
  return timestamp(new Date().toISOString());
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
