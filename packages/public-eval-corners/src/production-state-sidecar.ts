import { createHash, timingSafeEqual } from "node:crypto";
import {
  closeSync,
  constants,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  writeFileSync,
  writeSync,
} from "node:fs";
import { createServer, type IncomingMessage, type Server } from "node:http";
import {
  basename,
  isAbsolute,
  join,
  normalize,
  relative,
  resolve,
} from "node:path";
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
  PostgresContinuityLedger,
  verifyContinuityCheckpointChain,
  type ContinuityCheckpoint,
  type ContinuityVerificationReport,
} from "@pm/continuity";
import { tenantId, timestamp, type TenantId, type Timestamp } from "@pm/types";
import pg from "pg";

export const PRODUCTION_STATE_WRITE_SCHEMA_VERSION =
  "pm.public-eval-corners.production-state-write.v1" as const;
export const PRODUCTION_STATE_READ_SCHEMA_VERSION =
  "pm.public-eval-corners.production-state-read.v1" as const;
export const PRODUCTION_STATE_RESPONSE_SCHEMA_VERSION =
  "pm.public-eval-corners.production-state-response.v1" as const;
export const PRODUCTION_STATE_AUDIT_SCHEMA_VERSION =
  "pm.public-eval-corners.production-state-audit.v1" as const;
export const PRODUCTION_STATE_READY_SCHEMA_VERSION =
  "pm.public-eval-corners.production-state-ready.v1" as const;
export const PRODUCTION_STATE_FINAL_SCHEMA_VERSION =
  "pm.public-eval-corners.production-state-final.v1" as const;
export const PRODUCTION_STATE_STORE_SCHEMA_VERSION =
  "pm.public-eval-corners.production-state-store-record.v1" as const;
export const PRODUCTION_STATE_CONTINUITY_PAYLOAD_SCHEMA_VERSION =
  "pm.public-eval-corners.production-state-continuity-payload.v1" as const;

export const PRODUCTION_STATE_SUMMARY_WIDTH = 512;
export const PRODUCTION_STATE_PADDING_WIDTH = 128;
export const PRODUCTION_STATE_MAX_BODY_BYTES = 16_384;
export const PRODUCTION_STATE_RESPONSE_DEADLINE_MS = 250;

const LOOPBACK_HOST = "127.0.0.1";
const HASH_GENESIS = "0".repeat(64);
const REJECTED_STATE = fixedStateSummary("REQUEST_REJECTED");
/**
 * Exact neutral context returned by every arm until relevant state exists.
 * Keeping this byte-identical prevents the first read from revealing whether
 * the backend is a no-state control or a durable-state implementation.
 */
export const PRODUCTION_STATE_CONTROL_CONTEXT = fixedStateSummary(
  "No relevant prior state is available for this evaluation scope.",
);
const EMPTY_STATE = PRODUCTION_STATE_CONTROL_CONTEXT;
export const PRODUCTION_STATE_SHAM_DECOY = PRODUCTION_STATE_CONTROL_CONTEXT;
const RESPONSE_PADDING = ".".repeat(PRODUCTION_STATE_PADDING_WIDTH);
const OPERATION_ID = /^[a-f0-9]{32}$/;
const SAFE_IDENTITY = /^[A-Za-z0-9._:-]{1,128}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const AUDIT_FILE = "production-state-audit.ndjson";
const READY_FILE = "production-state-ready.json";
const FINAL_FILE = "production-state-final.json";
const RAW_DIRECTORY = "raw-exchanges";
const CONTINUITY_PAYLOAD_KEY = "productionEvaluationState";

type JsonRecord = Record<string, unknown>;

/** The mode is process-private and is never accepted from or emitted to HTTP clients. */
export type ProductionStateSidecarMode =
  | "native"
  | "sham"
  | "plain-kv"
  | "substrate";

export interface ProductionStateWriteRequest {
  readonly schemaVersion: typeof PRODUCTION_STATE_WRITE_SCHEMA_VERSION;
  readonly operationId: string;
  readonly observedAt: string;
  /** Model-authored, printable ASCII, and exactly `PRODUCTION_STATE_SUMMARY_WIDTH`. */
  readonly stateSummary: string;
}

export interface ProductionStateReadRequest {
  readonly schemaVersion: typeof PRODUCTION_STATE_READ_SCHEMA_VERSION;
  readonly operationId: string;
}

export interface ProductionStateResponse {
  readonly schemaVersion: typeof PRODUCTION_STATE_RESPONSE_SCHEMA_VERSION;
  readonly operationId: string;
  readonly status: "ok" | "rejected";
  readonly stateEncoding: "fixed-printable-ascii-space-padded-v1";
  readonly stateSummary: string;
  readonly padding: string;
}

export type ProductionStateRejectionReason =
  | "none"
  | "unauthorized"
  | "body_too_large"
  | "invalid_request"
  | "duplicate_operation_id"
  | "route_not_found"
  | "evidence_rejected"
  | "state_integrity_failure"
  | "internal_failure";

export interface ProductionStateBackendReceipt {
  readonly backend: "discard" | "plain-kv" | "continuity";
  readonly integrityVerified: boolean;
  readonly checkedRecords: number;
  readonly persistedRecordId: string | null;
  readonly relevantStateSha256: string;
}

export interface ProductionStateHttpExchange {
  readonly requestMethod: string;
  readonly requestPath: string;
  readonly requestContentType: string | null;
  readonly authorizationTokenSha256: string;
  readonly responseContentType: "application/json; charset=utf-8";
}

export interface ProductionStateTimingReceipt {
  readonly receivedAt: Timestamp;
  readonly receivedAtMonotonicMs: number;
  readonly backendCompletedAtMonotonicMs: number;
  readonly releaseDeadlineMonotonicMs: number;
  readonly releasedAtMonotonicMs: number;
  readonly responseDeadlineMs: number;
  readonly deadlineMissed: boolean;
}

export interface ProductionStateAuditEntry {
  readonly schemaVersion: typeof PRODUCTION_STATE_AUDIT_SCHEMA_VERSION;
  readonly sequence: number;
  readonly recordedAt: Timestamp;
  readonly operationId: string;
  readonly requestKind: "write" | "read" | "rejected";
  readonly authenticated: boolean;
  readonly httpExchange: ProductionStateHttpExchange;
  readonly timing: ProductionStateTimingReceipt;
  readonly rawRequestPath: string;
  readonly rawResponsePath: string;
  readonly requestSha256: string;
  readonly responseSha256: string;
  readonly responseStatus: "ok" | "rejected";
  readonly httpStatus: number;
  readonly rejectionReason: ProductionStateRejectionReason;
  readonly admissionReview: EvidenceAdmissionReview | null;
  readonly admittedEvidence: AdmittedStateEvidence | null;
  readonly backendReceipt: ProductionStateBackendReceipt | null;
  readonly failureSha256: string | null;
  readonly previousEntrySha256: string;
  readonly entrySha256: string;
}

export interface ProductionStateReadyReceipt {
  readonly schemaVersion: typeof PRODUCTION_STATE_READY_SCHEMA_VERSION;
  readonly mode: ProductionStateSidecarMode;
  readonly pid: number;
  readonly startedAt: Timestamp;
  readonly endpoint: string;
  readonly evidenceBindingSha256: string;
  readonly identitySha256: string;
  readonly tokenSha256: string;
  readonly responseDeadlineMs: number;
  readonly initialBackend: "discard" | "plain-kv" | "continuity";
  readonly initialAgentChainRecordCount: number;
  readonly initialScopeRecordCount: number;
  readonly initialBackendHeadSha256: string;
  readonly initialRelevantStateSha256: string;
  readonly auditGenesisSha256: string;
  readonly receiptSha256: string;
}

export interface ProductionStateFinalReceipt {
  readonly schemaVersion: typeof PRODUCTION_STATE_FINAL_SCHEMA_VERSION;
  readonly mode: ProductionStateSidecarMode;
  readonly pid: number;
  readonly evidenceBindingSha256: string;
  readonly startedAt: Timestamp;
  readonly finalizedAt: Timestamp;
  readonly totalRequests: number;
  readonly acceptedWrites: number;
  readonly acceptedReads: number;
  readonly rejectedRequests: number;
  readonly auditEntryCount: number;
  readonly auditHeadSha256: string;
  readonly readyReceiptFileSha256: string;
  readonly receiptSha256: string;
}

export interface StartProductionStateSidecarInput {
  readonly mode: ProductionStateSidecarMode;
  /** Offline signed-cell binding; it is hashed in receipts and never sent over HTTP. */
  readonly evidenceBinding: string;
  /** Fresh per-process evidence root. Audit, receipts, and raw exchanges live here. */
  readonly evidenceDirectory: string;
  /** Durable state root. Only plain-kv writes here; it must not overlap evidenceDirectory. */
  readonly stateDirectory: string;
  readonly bearerToken: string;
  readonly tenant: string | TenantId;
  readonly agentId: string;
  readonly scope: string;
  /** Required only for sham and substrate. The value is never serialized. */
  readonly databaseUrl?: string;
  readonly port?: number;
  readonly responseDeadlineMs?: number;
  /** @deprecated Test compatibility alias. Production runs use responseDeadlineMs. */
  readonly minimumLatencyMs?: number;
}

export interface RunningProductionStateSidecar {
  readonly endpoint: string;
  readonly auditPath: string;
  readonly readyReceiptPath: string;
  readonly finalReceiptPath: string;
  readonly rawDirectory: string;
  readonly plainKvStatePath: string;
  readonly readyReceipt: ProductionStateReadyReceipt;
  stop(): Promise<ProductionStateFinalReceipt>;
}

export interface ProductionStateEvidenceVerification {
  readonly valid: boolean;
  readonly issues: readonly string[];
  readonly auditHeadSha256: string;
}

export interface ProductionStateBackendReplayInput {
  readonly ready: ProductionStateReadyReceipt;
  readonly entries: readonly ProductionStateAuditEntry[];
  readonly identity: {
    readonly tenant: string | TenantId;
    readonly agentId: string;
    readonly scope: string;
  };
  readonly plainKvStatePath?: string;
  /** Complete oldest-to-newest agent chain exported independently from Postgres. */
  readonly continuityCheckpoints?: readonly ContinuityCheckpoint[];
}

export interface ProductionStateBackendReplayVerification {
  readonly valid: boolean;
  readonly issues: readonly string[];
  readonly finalRecordCount: number;
  readonly finalHeadSha256: string;
}

interface ValidatedStartInput {
  readonly mode: ProductionStateSidecarMode;
  readonly evidenceDirectory: string;
  readonly stateDirectory: string;
  readonly bearerToken: string;
  readonly tenant: TenantId;
  readonly agentId: string;
  readonly scope: string;
  readonly evidenceBindingSha256: string;
  readonly databaseUrl?: string;
  readonly port: number;
  readonly responseDeadlineMs: number;
}

interface Identity {
  readonly tenant: TenantId;
  readonly agentId: string;
  readonly scope: string;
}

interface RequestOutcome {
  readonly operationId: string;
  readonly requestKind: "write" | "read" | "rejected";
  readonly authenticated: boolean;
  readonly httpStatus: number;
  readonly rejectionReason: ProductionStateRejectionReason;
  readonly responseStatus: "ok" | "rejected";
  readonly responseState: string;
  readonly admissionReview: EvidenceAdmissionReview | null;
  readonly admittedEvidence: AdmittedStateEvidence | null;
  readonly backendReceipt: ProductionStateBackendReceipt | null;
  readonly failureSha256: string | null;
}

interface PlainKvStateRecord {
  readonly schemaVersion: typeof PRODUCTION_STATE_STORE_SCHEMA_VERSION;
  readonly sequence: number;
  readonly tenantId: TenantId;
  readonly agentId: string;
  readonly scope: string;
  readonly operationId: string;
  readonly observedAt: string;
  readonly stateSummary: string;
  readonly admittedEvidence: AdmittedStateEvidence;
  readonly previousRecordSha256: string;
  readonly recordSha256: string;
}

interface StoreVerification {
  readonly valid: boolean;
  readonly records: readonly PlainKvStateRecord[];
  readonly issues: readonly string[];
  readonly headSha256: string;
}

interface ContinuityPayload {
  readonly schemaVersion: typeof PRODUCTION_STATE_CONTINUITY_PAYLOAD_SCHEMA_VERSION;
  readonly operationId: string;
  readonly observedAt: string;
  readonly stateSummary: string;
  readonly admittedEvidence: AdmittedStateEvidence;
}

interface InitialBackendSnapshot {
  readonly backend: "discard" | "plain-kv" | "continuity";
  readonly agentChainRecordCount: number;
  readonly scopeRecordCount: number;
  readonly headSha256: string;
  readonly relevantStateSha256: string;
}

class RequestFailure extends Error {
  constructor(
    readonly status: number,
    readonly reason: ProductionStateRejectionReason,
    message: string,
  ) {
    super(message);
  }
}

class StateIntegrityFailure extends Error {}

export function fixedStateSummary(value: string): string {
  if (
    typeof value !== "string" ||
    value.length > PRODUCTION_STATE_SUMMARY_WIDTH ||
    !isPrintableAscii(value) ||
    value.trim().length === 0
  ) {
    throw new Error(
      `state summary must contain 1-${PRODUCTION_STATE_SUMMARY_WIDTH} printable ASCII characters`,
    );
  }
  return value.padEnd(PRODUCTION_STATE_SUMMARY_WIDTH, " ");
}

export function parseProductionStateWriteRequest(
  value: unknown,
): ProductionStateWriteRequest {
  const record = requireRecord(value, "write request");
  requireExactKeys(
    record,
    ["observedAt", "operationId", "schemaVersion", "stateSummary"],
    "write request",
  );
  if (record.schemaVersion !== PRODUCTION_STATE_WRITE_SCHEMA_VERSION) {
    throw new Error("write request schemaVersion is unsupported");
  }
  const stateSummary = requireFixedSummary(record.stateSummary, "write stateSummary");
  if (stateSummary.trim().length === 0) {
    throw new Error("write stateSummary must contain model-authored state");
  }
  return {
    schemaVersion: PRODUCTION_STATE_WRITE_SCHEMA_VERSION,
    operationId: requireOperationId(record.operationId),
    observedAt: requireTimestamp(record.observedAt),
    stateSummary,
  };
}

export function parseProductionStateReadRequest(
  value: unknown,
): ProductionStateReadRequest {
  const record = requireRecord(value, "read request");
  requireExactKeys(record, ["operationId", "schemaVersion"], "read request");
  if (record.schemaVersion !== PRODUCTION_STATE_READ_SCHEMA_VERSION) {
    throw new Error("read request schemaVersion is unsupported");
  }
  return {
    schemaVersion: PRODUCTION_STATE_READ_SCHEMA_VERSION,
    operationId: requireOperationId(record.operationId),
  };
}

export function parseProductionStateResponse(value: unknown): ProductionStateResponse {
  const record = requireRecord(value, "state response");
  requireExactKeys(
    record,
    [
      "operationId",
      "padding",
      "schemaVersion",
      "stateEncoding",
      "stateSummary",
      "status",
    ],
    "state response",
  );
  if (record.schemaVersion !== PRODUCTION_STATE_RESPONSE_SCHEMA_VERSION) {
    throw new Error("state response schemaVersion is unsupported");
  }
  if (record.stateEncoding !== "fixed-printable-ascii-space-padded-v1") {
    throw new Error("state response encoding is unsupported");
  }
  if (record.status !== "ok" && record.status !== "rejected") {
    throw new Error("state response status is invalid");
  }
  if (record.padding !== RESPONSE_PADDING) {
    throw new Error("state response padding is invalid");
  }
  return {
    schemaVersion: PRODUCTION_STATE_RESPONSE_SCHEMA_VERSION,
    operationId: requireOperationId(record.operationId),
    status: record.status,
    stateEncoding: "fixed-printable-ascii-space-padded-v1",
    stateSummary: requireFixedSummary(record.stateSummary, "response stateSummary"),
    padding: RESPONSE_PADDING,
  };
}

export async function startProductionStateSidecar(
  input: StartProductionStateSidecarInput,
): Promise<RunningProductionStateSidecar> {
  const config = validateStartInput(input);
  assertSeparateSafeRoots(config.evidenceDirectory, config.stateDirectory);

  const auditPath = join(config.evidenceDirectory, AUDIT_FILE);
  const readyReceiptPath = join(config.evidenceDirectory, READY_FILE);
  const finalReceiptPath = join(config.evidenceDirectory, FINAL_FILE);
  const rawDirectory = join(config.evidenceDirectory, RAW_DIRECTORY);
  assertFreshPaths([auditPath, readyReceiptPath, finalReceiptPath, rawDirectory]);
  mkdirSync(rawDirectory, { mode: 0o700 });
  fsyncDirectory(config.evidenceDirectory);

  const identity: Identity = {
    tenant: config.tenant,
    agentId: config.agentId,
    scope: config.scope,
  };
  const plainKvStatePath = join(
    config.stateDirectory,
    `production-state-${sha256Hex(canonicalJson(identity))}.ndjson`,
  );
  assertRegularOrAbsent(plainKvStatePath);

  let pool: pg.Pool | undefined;
  let ledger: PostgresContinuityLedger | undefined;
  if (config.mode === "sham" || config.mode === "substrate") {
    pool = new pg.Pool({ connectionString: config.databaseUrl });
    await pool.query("SELECT 1");
    ledger = new PostgresContinuityLedger(pool);
  }
  const initialBackend = await inspectInitialBackend(
    config.mode,
    identity,
    ledger,
    plainKvStatePath,
  );

  const auditFd = openSync(
    auditPath,
    constants.O_CREAT |
      constants.O_EXCL |
      constants.O_APPEND |
      constants.O_WRONLY |
      constants.O_NOFOLLOW,
    0o600,
  );
  fsyncSync(auditFd);
  fsyncDirectory(config.evidenceDirectory);

  const startedAt = currentTimestamp();
  const tokenSha256 = sha256Hex(config.bearerToken);
  const operationIds = new Set<string>();
  const auditEntries: ProductionStateAuditEntry[] = [];
  const inFlight = new Set<Promise<void>>();
  let serial = Promise.resolve();
  let accepting = true;

  const server = createServer((request, response) => {
    if (!accepting) {
      response.destroy();
      return;
    }
    const task = serial.then(async () => {
      const beganAt = performance.now();
      const receivedAt = currentTimestamp();
      const authenticated = authorized(request, config.bearerToken);
      let rawRequest: Buffer<ArrayBufferLike> = Buffer.alloc(0);
      let outcome: RequestOutcome;
      try {
        rawRequest = await readRequestBody(request);
        outcome = await handleRequest({
          request,
          rawRequest,
          authenticated,
          config,
          identity,
          operationIds,
          ledger,
          plainKvStatePath,
        });
      } catch (error) {
        outcome = failureOutcome(rawRequest, authenticated, error);
      }
      const backendCompletedAtMonotonicMs = performance.now();

      const responseBody = responseBytes(
        buildResponse(outcome.operationId, outcome.responseStatus, outcome.responseState),
      );
      const sequence = auditEntries.length + 1;
      const requestName = `${String(sequence).padStart(6, "0")}.request.bin`;
      const responseName = `${String(sequence).padStart(6, "0")}.response.json`;
      const rawRequestPath = join(RAW_DIRECTORY, requestName);
      const rawResponsePath = join(RAW_DIRECTORY, responseName);
      writeExclusiveDurable(join(config.evidenceDirectory, rawRequestPath), rawRequest, rawDirectory);
      writeExclusiveDurable(join(config.evidenceDirectory, rawResponsePath), responseBody, rawDirectory);
      const releaseTiming = await sendAtResponseDeadline(
        response,
        outcome.httpStatus,
        responseBody,
        beganAt,
        backendCompletedAtMonotonicMs,
        config.responseDeadlineMs,
      );

      const draft: Omit<ProductionStateAuditEntry, "entrySha256"> = {
        schemaVersion: PRODUCTION_STATE_AUDIT_SCHEMA_VERSION,
        sequence,
        recordedAt: currentTimestamp(),
        operationId: outcome.operationId,
        requestKind: outcome.requestKind,
        authenticated: outcome.authenticated,
        httpExchange: {
          requestMethod: request.method ?? "",
          requestPath: request.url ?? "",
          requestContentType: canonicalContentType(request.headers["content-type"]),
          authorizationTokenSha256: suppliedBearerTokenSha256(request),
          responseContentType: "application/json; charset=utf-8",
        },
        timing: {
          receivedAt,
          receivedAtMonotonicMs: beganAt,
          backendCompletedAtMonotonicMs,
          releaseDeadlineMonotonicMs: releaseTiming.releaseDeadlineMonotonicMs,
          releasedAtMonotonicMs: releaseTiming.releasedAtMonotonicMs,
          responseDeadlineMs: config.responseDeadlineMs,
          deadlineMissed: releaseTiming.deadlineMissed,
        },
        rawRequestPath,
        rawResponsePath,
        requestSha256: sha256Hex(rawRequest),
        responseSha256: sha256Hex(responseBody),
        responseStatus: outcome.responseStatus,
        httpStatus: outcome.httpStatus,
        rejectionReason: outcome.rejectionReason,
        admissionReview: outcome.admissionReview,
        admittedEvidence: outcome.admittedEvidence,
        backendReceipt: outcome.backendReceipt,
        failureSha256: outcome.failureSha256,
        previousEntrySha256: auditEntries.at(-1)?.entrySha256 ?? HASH_GENESIS,
      };
      const entry: ProductionStateAuditEntry = {
        ...draft,
        entrySha256: sha256Hex(canonicalJson(draft)),
      };
      writeSync(auditFd, `${canonicalJson(entry)}\n`, undefined, "utf8");
      fsyncSync(auditFd);
      auditEntries.push(entry);
    });
    serial = task.catch(() => {});
    inFlight.add(task);
    void task.then(
      () => inFlight.delete(task),
      () => inFlight.delete(task),
    );
  });

  try {
    await listenLoopback(server, config.port);
  } catch (error) {
    closeSync(auditFd);
    await pool?.end();
    throw error;
  }
  const address = server.address();
  if (address === null || typeof address === "string") {
    closeSync(auditFd);
    await pool?.end();
    throw new Error("sidecar did not bind a TCP address");
  }
  const endpoint = `http://${LOOPBACK_HOST}:${address.port}`;
  const readyDraft: Omit<ProductionStateReadyReceipt, "receiptSha256"> = {
    schemaVersion: PRODUCTION_STATE_READY_SCHEMA_VERSION,
    mode: config.mode,
    pid: process.pid,
    startedAt,
    endpoint,
    evidenceBindingSha256: config.evidenceBindingSha256,
    identitySha256: sha256Hex(canonicalJson(identity)),
    tokenSha256,
    responseDeadlineMs: config.responseDeadlineMs,
    initialBackend: initialBackend.backend,
    initialAgentChainRecordCount: initialBackend.agentChainRecordCount,
    initialScopeRecordCount: initialBackend.scopeRecordCount,
    initialBackendHeadSha256: initialBackend.headSha256,
    initialRelevantStateSha256: initialBackend.relevantStateSha256,
    auditGenesisSha256: HASH_GENESIS,
  };
  const readyReceipt: ProductionStateReadyReceipt = {
    ...readyDraft,
    receiptSha256: sha256Hex(canonicalJson(readyDraft)),
  };
  writeExclusiveDurable(
    readyReceiptPath,
    Buffer.from(`${canonicalJson(readyReceipt)}\n`, "utf8"),
    config.evidenceDirectory,
  );

  let stopPromise: Promise<ProductionStateFinalReceipt> | undefined;
  const stop = (): Promise<ProductionStateFinalReceipt> => {
    stopPromise ??= (async () => {
      accepting = false;
      await closeServer(server);
      await Promise.allSettled([...inFlight]);
      await serial;
      closeSync(auditFd);
      await pool?.end();
      const finalDraft: Omit<ProductionStateFinalReceipt, "receiptSha256"> = {
        schemaVersion: PRODUCTION_STATE_FINAL_SCHEMA_VERSION,
        mode: config.mode,
        pid: process.pid,
        evidenceBindingSha256: config.evidenceBindingSha256,
        startedAt,
        finalizedAt: currentTimestamp(),
        totalRequests: auditEntries.length,
        acceptedWrites: auditEntries.filter(
          (entry) => entry.requestKind === "write" && entry.responseStatus === "ok",
        ).length,
        acceptedReads: auditEntries.filter(
          (entry) => entry.requestKind === "read" && entry.responseStatus === "ok",
        ).length,
        rejectedRequests: auditEntries.filter(
          (entry) => entry.responseStatus === "rejected",
        ).length,
        auditEntryCount: auditEntries.length,
        auditHeadSha256: auditEntries.at(-1)?.entrySha256 ?? HASH_GENESIS,
        readyReceiptFileSha256: sha256Hex(readFileSync(readyReceiptPath)),
      };
      const finalReceipt: ProductionStateFinalReceipt = {
        ...finalDraft,
        receiptSha256: sha256Hex(canonicalJson(finalDraft)),
      };
      writeExclusiveDurable(
        finalReceiptPath,
        Buffer.from(`${canonicalJson(finalReceipt)}\n`, "utf8"),
        config.evidenceDirectory,
      );
      return finalReceipt;
    })();
    return stopPromise;
  };

  return {
    endpoint,
    auditPath,
    readyReceiptPath,
    finalReceiptPath,
    rawDirectory,
    plainKvStatePath,
    readyReceipt,
    stop,
  };
}

export function readProductionStateAudit(
  auditPath: string,
): readonly ProductionStateAuditEntry[] {
  const text = readFileSync(auditPath, "utf8");
  if (text.length === 0) return [];
  if (!text.endsWith("\n")) throw new Error("state audit is not newline terminated");
  return text
    .trimEnd()
    .split("\n")
    .map((line) => parseAuditEntry(JSON.parse(line) as unknown));
}

export function verifyProductionStateEvidence(
  evidenceDirectory: string,
  ready: ProductionStateReadyReceipt,
  final: ProductionStateFinalReceipt,
  entries: readonly ProductionStateAuditEntry[],
): ProductionStateEvidenceVerification {
  const issues: string[] = [];
  if (!hasExactKeys(ready, [
    "auditGenesisSha256", "endpoint", "evidenceBindingSha256", "identitySha256",
    "initialAgentChainRecordCount", "initialBackend", "initialBackendHeadSha256",
    "initialRelevantStateSha256", "initialScopeRecordCount", "mode", "pid",
    "receiptSha256", "responseDeadlineMs", "schemaVersion", "startedAt", "tokenSha256",
  ]) || ready.schemaVersion !== PRODUCTION_STATE_READY_SCHEMA_VERSION) {
    issues.push("ready receipt schema is not exact");
  }
  if (!hasExactKeys(final, [
    "acceptedReads", "acceptedWrites", "auditEntryCount", "auditHeadSha256",
    "evidenceBindingSha256", "finalizedAt", "mode", "pid", "readyReceiptFileSha256", "receiptSha256",
    "rejectedRequests", "schemaVersion", "startedAt", "totalRequests",
  ]) || final.schemaVersion !== PRODUCTION_STATE_FINAL_SCHEMA_VERSION) {
    issues.push("final receipt schema is not exact");
  }
  let previous = HASH_GENESIS;
  entries.forEach((entry, index) => {
    if (entry.sequence !== index + 1) issues.push(`entry ${index + 1}: sequence mismatch`);
    if (entry.previousEntrySha256 !== previous) {
      issues.push(`entry ${index + 1}: previousEntrySha256 mismatch`);
    }
    const timing = entry.timing;
    if (
      !hasExactKeys(timing, [
        "backendCompletedAtMonotonicMs", "deadlineMissed", "receivedAt",
        "receivedAtMonotonicMs", "releaseDeadlineMonotonicMs",
        "releasedAtMonotonicMs", "responseDeadlineMs",
      ]) ||
      !validTimestamp(String(timing.receivedAt)) ||
      ![timing.receivedAtMonotonicMs, timing.backendCompletedAtMonotonicMs,
        timing.releaseDeadlineMonotonicMs, timing.releasedAtMonotonicMs]
        .every((value) => typeof value === "number" && Number.isFinite(value) && value >= 0) ||
      timing.backendCompletedAtMonotonicMs < timing.receivedAtMonotonicMs ||
      timing.releaseDeadlineMonotonicMs !==
        timing.receivedAtMonotonicMs + timing.responseDeadlineMs ||
      timing.releasedAtMonotonicMs + 1 < timing.releaseDeadlineMonotonicMs ||
      timing.responseDeadlineMs !== ready.responseDeadlineMs ||
      timing.deadlineMissed !==
        (timing.responseDeadlineMs > 0 &&
          timing.backendCompletedAtMonotonicMs > timing.releaseDeadlineMonotonicMs)
    ) {
      issues.push(`entry ${index + 1}: response timing receipt is invalid`);
    }
    if (timing.deadlineMissed) {
      issues.push(`entry ${index + 1}: matched response deadline was missed`);
    }
    const exchange = entry.httpExchange;
    if (
      !hasExactKeys(exchange, [
        "authorizationTokenSha256", "requestContentType", "requestMethod",
        "requestPath", "responseContentType",
      ]) ||
      typeof exchange.requestMethod !== "string" ||
      typeof exchange.requestPath !== "string" ||
      (exchange.requestContentType !== null && typeof exchange.requestContentType !== "string") ||
      !SHA256.test(exchange.authorizationTokenSha256) ||
      exchange.responseContentType !== "application/json; charset=utf-8" ||
      (entry.authenticated && exchange.authorizationTokenSha256 !== ready.tokenSha256) ||
      (!entry.authenticated && exchange.authorizationTokenSha256 === ready.tokenSha256)
    ) {
      issues.push(`entry ${index + 1}: sanitized HTTP exchange is invalid`);
    }
    if (
      entry.requestKind !== "rejected" &&
      (exchange.requestMethod !== "POST" ||
        exchange.requestContentType !== "application/json" ||
        exchange.requestPath !== (entry.requestKind === "read" ? "/read" : "/write"))
    ) {
      issues.push(`entry ${index + 1}: accepted request HTTP binding is invalid`);
    }
    const { entrySha256: _entrySha256, ...draft } = entry;
    const expectedEntry = sha256Hex(canonicalJson(draft));
    if (entry.entrySha256 !== expectedEntry) {
      issues.push(`entry ${index + 1}: entrySha256 mismatch`);
    }
    for (const [label, path, expected] of [
      ["request", entry.rawRequestPath, entry.requestSha256],
      ["response", entry.rawResponsePath, entry.responseSha256],
    ] as const) {
      try {
        const absolute = containedEvidencePath(evidenceDirectory, path);
        if (sha256Hex(readFileSync(absolute)) !== expected) {
          issues.push(`entry ${index + 1}: raw ${label} hash mismatch`);
        }
      } catch {
        issues.push(`entry ${index + 1}: raw ${label} is absent or unsafe`);
      }
    }
    try {
      const rawResponse = readFileSync(
        containedEvidencePath(evidenceDirectory, entry.rawResponsePath),
      );
      const response = parseProductionStateResponse(
        JSON.parse(rawResponse.toString("utf8")) as unknown,
      );
      if (response.operationId !== entry.operationId) {
        issues.push(`entry ${index + 1}: raw response operationId mismatch`);
      }
      if (response.status !== entry.responseStatus) {
        issues.push(`entry ${index + 1}: raw response status mismatch`);
      }
    } catch {
      issues.push(`entry ${index + 1}: raw response schema is invalid`);
    }
    verifyProductionStateEntrySemantics(
      evidenceDirectory,
      ready.mode,
      entry,
      index + 1,
      issues,
    );
    if (
      entry.admissionReview !== null &&
      entry.admissionReview.evidence.evidenceId !== entry.operationId
    ) {
      issues.push(`entry ${index + 1}: admission review operation mismatch`);
    }
    if (
      entry.admittedEvidence !== null &&
      entry.admittedEvidence.evidence.evidenceId !== entry.operationId
    ) {
      issues.push(`entry ${index + 1}: admitted evidence operation mismatch`);
    }
    previous = entry.entrySha256;
  });
  if (ready.auditGenesisSha256 !== HASH_GENESIS) issues.push("ready genesis mismatch");
  if (ready.mode !== final.mode) issues.push("ready/final mode mismatch");
  if (ready.evidenceBindingSha256 !== final.evidenceBindingSha256) {
    issues.push("ready/final evidence binding mismatch");
  }
  if (ready.pid !== final.pid || ready.startedAt !== final.startedAt) {
    issues.push("ready/final process identity mismatch");
  }
  if (receiptHash(ready) !== ready.receiptSha256) issues.push("ready receipt hash mismatch");
  if (receiptHash(final) !== final.receiptSha256) issues.push("final receipt hash mismatch");
  if (final.auditEntryCount !== entries.length) issues.push("final audit count mismatch");
  if (final.totalRequests !== entries.length) issues.push("final request count mismatch");
  if (
    final.acceptedWrites !==
    entries.filter((entry) => entry.requestKind === "write" && entry.responseStatus === "ok")
      .length
  ) {
    issues.push("final accepted-write count mismatch");
  }
  if (
    final.acceptedReads !==
    entries.filter((entry) => entry.requestKind === "read" && entry.responseStatus === "ok")
      .length
  ) {
    issues.push("final accepted-read count mismatch");
  }
  if (
    final.rejectedRequests !==
    entries.filter((entry) => entry.responseStatus === "rejected").length
  ) {
    issues.push("final rejected-request count mismatch");
  }
  if (final.auditHeadSha256 !== previous) issues.push("final audit head mismatch");
  const expectedInitialBackend =
    ready.mode === "native" ? "discard" : ready.mode === "plain-kv" ? "plain-kv" : "continuity";
  if (
    ready.initialBackend !== expectedInitialBackend ||
    !Number.isSafeInteger(ready.initialAgentChainRecordCount) ||
    ready.initialAgentChainRecordCount < 0 ||
    !Number.isSafeInteger(ready.initialScopeRecordCount) ||
    ready.initialScopeRecordCount < 0 ||
    ready.initialScopeRecordCount > ready.initialAgentChainRecordCount ||
    !SHA256.test(ready.initialBackendHeadSha256) ||
    !SHA256.test(ready.initialRelevantStateSha256) ||
    !Number.isSafeInteger(ready.responseDeadlineMs) ||
    ready.responseDeadlineMs < 0
  ) {
    issues.push("ready initial backend or response deadline is invalid");
  }
  try {
    const readyBytes = readFileSync(join(evidenceDirectory, READY_FILE));
    if (final.readyReceiptFileSha256 !== sha256Hex(readyBytes)) {
      issues.push("ready receipt file hash mismatch");
    }
    if (readyBytes.toString("utf8") !== `${canonicalJson(ready)}\n`) {
      issues.push("ready receipt file content mismatch");
    }
  } catch {
    issues.push("ready receipt file is absent");
  }
  try {
    if (
      readFileSync(join(evidenceDirectory, FINAL_FILE), "utf8") !==
      `${canonicalJson(final)}\n`
    ) {
      issues.push("final receipt file content mismatch");
    }
  } catch {
    issues.push("final receipt file is absent");
  }
  try {
    const expectedAudit =
      entries.length === 0 ? "" : `${entries.map((entry) => canonicalJson(entry)).join("\n")}\n`;
    if (readFileSync(join(evidenceDirectory, AUDIT_FILE), "utf8") !== expectedAudit) {
      issues.push("audit file content mismatch");
    }
  } catch {
    issues.push("audit file is absent");
  }
  return { valid: issues.length === 0, issues, auditHeadSha256: previous };
}

function verifyProductionStateEntrySemantics(
  evidenceDirectory: string,
  mode: ProductionStateSidecarMode,
  entry: ProductionStateAuditEntry,
  sequence: number,
  issues: string[],
): void {
  const issue = (message: string): void => {
    issues.push(`entry ${sequence}: ${message}`);
  };
  let response: ProductionStateResponse;
  try {
    const bytes = readFileSync(
      containedEvidencePath(evidenceDirectory, entry.rawResponsePath),
    );
    response = parseProductionStateResponse(JSON.parse(bytes.toString("utf8")) as unknown);
  } catch {
    return;
  }
  if (entry.responseStatus === "rejected") {
    if (response.stateSummary !== REJECTED_STATE) issue("rejected response exposed state");
  } else if (entry.requestKind === "write") {
    if (response.stateSummary !== EMPTY_STATE) issue("write response exposed state");
  } else if (entry.requestKind === "read") {
    if (mode === "native" || mode === "sham") {
      if (response.stateSummary !== PRODUCTION_STATE_CONTROL_CONTEXT) {
        issue("control read did not return the exact shared irrelevant context");
      }
    } else if (
      entry.backendReceipt === null ||
      sha256Hex(response.stateSummary) !== entry.backendReceipt.relevantStateSha256
    ) {
      issue("durable read response does not match the backend state receipt");
    }
  }

  let rawRequest: unknown;
  try {
    const bytes = readFileSync(
      containedEvidencePath(evidenceDirectory, entry.rawRequestPath),
    );
    rawRequest = JSON.parse(bytes.toString("utf8")) as unknown;
  } catch {
    if (entry.requestKind !== "rejected") issue("accepted request is not valid JSON");
    return;
  }
  if (entry.requestKind === "write") {
    let request: ProductionStateWriteRequest;
    try {
      request = parseProductionStateWriteRequest(rawRequest);
    } catch {
      issue("write request schema is invalid");
      return;
    }
    if (request.operationId !== entry.operationId) issue("write operationId mismatch");
    const review = entry.admissionReview;
    const admitted = entry.admittedEvidence;
    if (review === null) {
      issue("write lacks an admission review");
    } else {
      if (review.evidence.evidenceId !== request.operationId) {
        issue("write admission evidenceId mismatch");
      }
      if (
        review.evidence.observedAt !== request.observedAt ||
        review.evidence.payload.stateSummary !== request.stateSummary ||
        review.evidence.payload.observedAt !== request.observedAt
      ) {
        issue("write admission evidence does not bind the raw request");
      }
      if (review.evidence.payloadHash !== sha256Hex(canonicalJson(review.evidence.payload))) {
        issue("write admission payload hash mismatch");
      }
    }
    if (entry.responseStatus === "ok") {
      if (review?.decision !== "admitted" || admitted === null || entry.backendReceipt === null) {
        issue("accepted write lacks admitted evidence or backend receipt");
      }
    }
    if (review !== null && admitted !== null) {
      if (
        admitted.admissionReviewId !== review.reviewId ||
        canonicalJson(admitted.evidence) !== canonicalJson(review.evidence)
      ) {
        issue("admitted evidence does not bind its review");
      }
    }
  } else if (entry.requestKind === "read") {
    try {
      const request = parseProductionStateReadRequest(rawRequest);
      if (request.operationId !== entry.operationId) issue("read operationId mismatch");
    } catch {
      issue("read request schema is invalid");
    }
    if (entry.admissionReview !== null || entry.admittedEvidence !== null) {
      issue("read unexpectedly contains write admission evidence");
    }
  } else {
    const rawOperationId = operationIdFromRaw(
      Buffer.from(JSON.stringify(rawRequest), "utf8"),
    );
    if (rawOperationId !== undefined && rawOperationId !== entry.operationId) {
      issue("rejected request operationId mismatch");
    }
  }

  if (entry.backendReceipt !== null) {
    const expectedBackend =
      mode === "native" ? "discard" : mode === "plain-kv" ? "plain-kv" : "continuity";
    if (
      entry.backendReceipt.backend !== expectedBackend ||
      entry.backendReceipt.integrityVerified !== true
    ) {
      issue("backend receipt does not match the declared arm");
    }
  }
}

export function verifyPlainKvStateFile(
  path: string,
  identityInput: { readonly tenant: string | TenantId; readonly agentId: string; readonly scope: string },
): StoreVerification {
  const identity: Identity = {
    tenant: tenantId(String(identityInput.tenant)),
    agentId: identityInput.agentId,
    scope: identityInput.scope,
  };
  return readAndVerifyPlainKv(path, identity);
}

/**
 * Replays sidecar claims against independently opened durable evidence. The
 * audit's backendReceipt is treated as an assertion, never as proof.
 */
export function verifyProductionStateBackendReplay(
  input: ProductionStateBackendReplayInput,
): ProductionStateBackendReplayVerification {
  const issues: string[] = [];
  const identity: Identity = {
    tenant: tenantId(String(input.identity.tenant)),
    agentId: requireIdentity(input.identity.agentId, "backend replay agentId"),
    scope: requireIdentity(input.identity.scope, "backend replay scope"),
  };
  if (input.ready.identitySha256 !== sha256Hex(canonicalJson(identity))) {
    issues.push("ready identity hash does not match the independently supplied identity");
  }
  const successfulWrites = input.entries.filter(
    (entry) => entry.requestKind === "write" && entry.responseStatus === "ok",
  ).length;
  const controlHash = sha256Hex(PRODUCTION_STATE_CONTROL_CONTEXT);

  if (input.ready.mode === "native") {
    if (
      input.ready.initialBackend !== "discard" ||
      input.ready.initialAgentChainRecordCount !== 0 ||
      input.ready.initialScopeRecordCount !== 0 ||
      input.ready.initialBackendHeadSha256 !== HASH_GENESIS ||
      input.ready.initialRelevantStateSha256 !== controlHash
    ) issues.push("native initial backend receipt is not the exact empty discard state");
    for (const [index, entry] of input.entries.entries()) {
      if (entry.responseStatus !== "ok") continue;
      const receipt = entry.backendReceipt;
      if (
        receipt?.backend !== "discard" ||
        receipt.checkedRecords !== 0 ||
        receipt.persistedRecordId !== null ||
        receipt.relevantStateSha256 !== controlHash
      ) issues.push(`entry ${index + 1}: native discard receipt does not replay`);
    }
    return {
      valid: issues.length === 0,
      issues,
      finalRecordCount: 0,
      finalHeadSha256: HASH_GENESIS,
    };
  }

  if (input.ready.mode === "plain-kv") {
    if (input.plainKvStatePath === undefined) {
      issues.push("plain-kv replay path is missing");
      return { valid: false, issues, finalRecordCount: 0, finalHeadSha256: HASH_GENESIS };
    }
    const store = readAndVerifyPlainKv(input.plainKvStatePath, identity);
    issues.push(...store.issues.map((issue) => `plain-kv: ${issue}`));
    const initialCount = input.ready.initialScopeRecordCount;
    if (
      input.ready.initialBackend !== "plain-kv" ||
      input.ready.initialAgentChainRecordCount !== initialCount ||
      initialCount > store.records.length ||
      input.ready.initialBackendHeadSha256 !==
        (store.records[initialCount - 1]?.recordSha256 ?? HASH_GENESIS) ||
      input.ready.initialRelevantStateSha256 !== sha256Hex(
        store.records[initialCount - 1]?.stateSummary ?? PRODUCTION_STATE_CONTROL_CONTEXT,
      ) ||
      store.records.length !== initialCount + successfulWrites
    ) issues.push("plain-kv initial/final record counts or heads do not replay");
    let seen = initialCount;
    for (const [index, entry] of input.entries.entries()) {
      if (entry.responseStatus !== "ok") continue;
      const receipt = entry.backendReceipt;
      if (entry.requestKind === "write") {
        const record = store.records[seen];
        seen += 1;
        if (
          record === undefined ||
          record.operationId !== entry.operationId ||
          canonicalJson(record.admittedEvidence) !== canonicalJson(entry.admittedEvidence) ||
          receipt?.backend !== "plain-kv" ||
          receipt.checkedRecords !== seen ||
          receipt.persistedRecordId !== record.recordSha256 ||
          receipt.relevantStateSha256 !== sha256Hex(record.stateSummary)
        ) issues.push(`entry ${index + 1}: plain-kv write does not replay`);
      } else if (entry.requestKind === "read") {
        const latest = store.records[seen - 1];
        if (
          receipt?.backend !== "plain-kv" ||
          receipt.checkedRecords !== seen ||
          receipt.persistedRecordId !== (latest?.recordSha256 ?? null) ||
          receipt.relevantStateSha256 !== sha256Hex(
            latest?.stateSummary ?? PRODUCTION_STATE_CONTROL_CONTEXT,
          )
        ) issues.push(`entry ${index + 1}: plain-kv read does not replay`);
      }
    }
    return {
      valid: issues.length === 0,
      issues,
      finalRecordCount: store.records.length,
      finalHeadSha256: store.headSha256,
    };
  }

  const checkpoints = input.continuityCheckpoints;
  if (checkpoints === undefined) {
    issues.push("continuity replay export is missing");
    return { valid: false, issues, finalRecordCount: 0, finalHeadSha256: HASH_GENESIS };
  }
  const chain = verifyContinuityCheckpointChain({
    tenantId: identity.tenant,
    agentId: identity.agentId,
    checkpoints,
  });
  issues.push(...chain.errors.map((issue) => `continuity: ${issue}`));
  const scoped = checkpoints.flatMap((checkpoint) => {
    if (checkpoint.scope !== identity.scope || checkpoint.kind !== "claim") return [];
    const raw = checkpoint.payload[CONTINUITY_PAYLOAD_KEY];
    if (raw === undefined) return [];
    try {
      return [{ checkpoint, payload: parseContinuityPayload(raw) }];
    } catch (error) {
      issues.push(`continuity checkpoint ${checkpoint.id} payload is invalid: ${messageOf(error)}`);
      return [];
    }
  });
  const initialAgentCount = input.ready.initialAgentChainRecordCount;
  const initialScopeCount = input.ready.initialScopeRecordCount;
  if (
    input.ready.initialBackend !== "continuity" ||
    initialAgentCount > checkpoints.length ||
    initialScopeCount > scoped.length ||
    input.ready.initialBackendHeadSha256 !==
      (checkpoints[initialAgentCount - 1]?.contentHash ?? HASH_GENESIS) ||
    input.ready.initialRelevantStateSha256 !== sha256Hex(
      scoped[initialScopeCount - 1]?.payload.stateSummary ?? PRODUCTION_STATE_CONTROL_CONTEXT,
    ) ||
    checkpoints.length !== initialAgentCount + successfulWrites ||
    scoped.length !== initialScopeCount + successfulWrites
  ) issues.push("continuity initial/final record counts or heads do not replay");
  let seenAgent = initialAgentCount;
  let seenScope = initialScopeCount;
  for (const [index, entry] of input.entries.entries()) {
    if (entry.responseStatus !== "ok") continue;
    const receipt = entry.backendReceipt;
    if (entry.requestKind === "write") {
      const state = scoped[seenScope];
      seenAgent += 1;
      seenScope += 1;
      if (
        state === undefined ||
        state.payload.operationId !== entry.operationId ||
        canonicalJson(state.payload.admittedEvidence) !== canonicalJson(entry.admittedEvidence) ||
        receipt?.backend !== "continuity" ||
        receipt.checkedRecords !== seenAgent ||
        receipt.persistedRecordId !== state.checkpoint.id ||
        receipt.relevantStateSha256 !== sha256Hex(state.payload.stateSummary)
      ) issues.push(`entry ${index + 1}: continuity write does not replay`);
    } else if (entry.requestKind === "read") {
      const latest = scoped[seenScope - 1];
      if (
        receipt?.backend !== "continuity" ||
        receipt.checkedRecords !== seenAgent ||
        receipt.persistedRecordId !== (latest?.checkpoint.id ?? null) ||
        receipt.relevantStateSha256 !== sha256Hex(
          latest?.payload.stateSummary ?? PRODUCTION_STATE_CONTROL_CONTEXT,
        )
      ) issues.push(`entry ${index + 1}: continuity read does not replay`);
    }
  }
  return {
    valid: issues.length === 0,
    issues,
    finalRecordCount: checkpoints.length,
    finalHeadSha256: checkpoints.at(-1)?.contentHash ?? HASH_GENESIS,
  };
}

async function handleRequest(input: {
  readonly request: IncomingMessage;
  readonly rawRequest: Buffer;
  readonly authenticated: boolean;
  readonly config: ValidatedStartInput;
  readonly identity: Identity;
  readonly operationIds: Set<string>;
  readonly ledger: PostgresContinuityLedger | undefined;
  readonly plainKvStatePath: string;
}): Promise<RequestOutcome> {
  if (!input.authenticated) {
    throw new RequestFailure(401, "unauthorized", "request is unauthorized");
  }
  if (input.request.method !== "POST" || !isJsonContentType(input.request.headers["content-type"])) {
    throw new RequestFailure(404, "route_not_found", "route is unavailable");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(input.rawRequest.toString("utf8")) as unknown;
  } catch {
    throw new RequestFailure(400, "invalid_request", "request body is not JSON");
  }

  if (input.request.url === "/write") {
    let request: ProductionStateWriteRequest;
    try {
      request = parseProductionStateWriteRequest(parsed);
    } catch (error) {
      throw new RequestFailure(400, "invalid_request", messageOf(error));
    }
    rejectDuplicate(request.operationId, input.operationIds);
    const { review, admitted } = reviewStateSummary(request, input.identity);
    if (admitted === undefined) {
      return {
        operationId: request.operationId,
        requestKind: "write",
        authenticated: true,
        httpStatus: 422,
        rejectionReason: "evidence_rejected",
        responseStatus: "rejected",
        responseState: REJECTED_STATE,
        admissionReview: review,
        admittedEvidence: null,
        backendReceipt: null,
        failureSha256: null,
      };
    }
    let backendReceipt: ProductionStateBackendReceipt;
    try {
      backendReceipt = await persistState(
        input.config.mode,
        input.identity,
        request,
        admitted,
        input.ledger,
        input.plainKvStatePath,
      );
    } catch (error) {
      return reviewedWriteFailure(request.operationId, review, admitted, error);
    }
    return {
      operationId: request.operationId,
      requestKind: "write",
      authenticated: true,
      httpStatus: 200,
      rejectionReason: "none",
      responseStatus: "ok",
      responseState: EMPTY_STATE,
      admissionReview: review,
      admittedEvidence: admitted,
      backendReceipt,
      failureSha256: null,
    };
  }

  if (input.request.url === "/read") {
    let request: ProductionStateReadRequest;
    try {
      request = parseProductionStateReadRequest(parsed);
    } catch (error) {
      throw new RequestFailure(400, "invalid_request", messageOf(error));
    }
    rejectDuplicate(request.operationId, input.operationIds);
    const recalled = await recallState(
      input.config.mode,
      input.identity,
      input.ledger,
      input.plainKvStatePath,
    );
    return {
      operationId: request.operationId,
      requestKind: "read",
      authenticated: true,
      httpStatus: 200,
      rejectionReason: "none",
      responseStatus: "ok",
      responseState: recalled.visibleState,
      admissionReview: null,
      admittedEvidence: null,
      backendReceipt: recalled.receipt,
      failureSha256: null,
    };
  }
  throw new RequestFailure(404, "route_not_found", "route is unavailable");
}

async function persistState(
  mode: ProductionStateSidecarMode,
  identity: Identity,
  request: ProductionStateWriteRequest,
  admitted: AdmittedStateEvidence,
  ledger: PostgresContinuityLedger | undefined,
  plainKvStatePath: string,
): Promise<ProductionStateBackendReceipt> {
  if (mode === "native") {
    return {
      backend: "discard",
      integrityVerified: true,
      checkedRecords: 0,
      persistedRecordId: null,
      relevantStateSha256: sha256Hex(EMPTY_STATE),
    };
  }
  if (mode === "plain-kv") {
    return withFileQueue(plainKvStatePath, async () => {
      const before = readAndVerifyPlainKv(plainKvStatePath, identity);
      requireValidStore(before);
      const draft: Omit<PlainKvStateRecord, "recordSha256"> = {
        schemaVersion: PRODUCTION_STATE_STORE_SCHEMA_VERSION,
        sequence: before.records.length + 1,
        tenantId: identity.tenant,
        agentId: identity.agentId,
        scope: identity.scope,
        operationId: request.operationId,
        observedAt: request.observedAt,
        stateSummary: request.stateSummary,
        admittedEvidence: admitted,
        previousRecordSha256: before.headSha256,
      };
      const record: PlainKvStateRecord = {
        ...draft,
        recordSha256: sha256Hex(canonicalJson(draft)),
      };
      appendDurable(plainKvStatePath, `${canonicalJson(record)}\n`);
      const after = readAndVerifyPlainKv(plainKvStatePath, identity);
      requireValidStore(after);
      return {
        backend: "plain-kv",
        integrityVerified: true,
        checkedRecords: after.records.length,
        persistedRecordId: record.recordSha256,
        relevantStateSha256: sha256Hex(request.stateSummary),
      };
    });
  }
  if (ledger === undefined) throw new Error("continuity ledger was not configured");
  await requireValidContinuity(ledger, identity);
  const payload: ContinuityPayload = {
    schemaVersion: PRODUCTION_STATE_CONTINUITY_PAYLOAD_SCHEMA_VERSION,
    operationId: request.operationId,
    observedAt: request.observedAt,
    stateSummary: request.stateSummary,
    admittedEvidence: admitted,
  };
  const checkpoint = await ledger.record({
    tenantId: identity.tenant,
    agentId: identity.agentId,
    scope: identity.scope,
    kind: "claim",
    title: "Generic evaluation state summary",
    summary: request.stateSummary.trimEnd(),
    status: "closed",
    payload: { [CONTINUITY_PAYLOAD_KEY]: payload },
  });
  const report = await requireValidContinuity(ledger, identity);
  return {
    backend: "continuity",
    integrityVerified: true,
    checkedRecords: report.checked,
    persistedRecordId: checkpoint.id,
    relevantStateSha256: sha256Hex(request.stateSummary),
  };
}

async function recallState(
  mode: ProductionStateSidecarMode,
  identity: Identity,
  ledger: PostgresContinuityLedger | undefined,
  plainKvStatePath: string,
): Promise<{
  readonly visibleState: string;
  readonly receipt: ProductionStateBackendReceipt;
}> {
  if (mode === "native") {
    return {
      visibleState: PRODUCTION_STATE_CONTROL_CONTEXT,
      receipt: {
        backend: "discard",
        integrityVerified: true,
        checkedRecords: 0,
        persistedRecordId: null,
        relevantStateSha256: sha256Hex(EMPTY_STATE),
      },
    };
  }
  if (mode === "plain-kv") {
    return withFileQueue(plainKvStatePath, async () => {
      const verified = readAndVerifyPlainKv(plainKvStatePath, identity);
      requireValidStore(verified);
      const latest = verified.records.at(-1);
      const state = latest?.stateSummary ?? EMPTY_STATE;
      return {
        visibleState: state,
        receipt: {
          backend: "plain-kv",
          integrityVerified: true,
          checkedRecords: verified.records.length,
          persistedRecordId: latest?.recordSha256 ?? null,
          relevantStateSha256: sha256Hex(state),
        },
      };
    });
  }
  if (ledger === undefined) throw new Error("continuity ledger was not configured");
  const report = await requireValidContinuity(ledger, identity);
  const checkpoints = await ledger.list({
    tenantId: identity.tenant,
    agentId: identity.agentId,
    scope: identity.scope,
    kind: "claim",
    limit: 100_000,
  });
  const latest = findLatestContinuityState(checkpoints);
  const relevant = latest?.payload.stateSummary ?? EMPTY_STATE;
  return {
    visibleState: mode === "substrate" ? relevant : PRODUCTION_STATE_CONTROL_CONTEXT,
    receipt: {
      backend: "continuity",
      integrityVerified: true,
      checkedRecords: report.checked,
      persistedRecordId: latest?.checkpoint.id ?? null,
      relevantStateSha256: sha256Hex(relevant),
    },
  };
}

async function inspectInitialBackend(
  mode: ProductionStateSidecarMode,
  identity: Identity,
  ledger: PostgresContinuityLedger | undefined,
  plainKvStatePath: string,
): Promise<InitialBackendSnapshot> {
  if (mode === "native") {
    return {
      backend: "discard",
      agentChainRecordCount: 0,
      scopeRecordCount: 0,
      headSha256: HASH_GENESIS,
      relevantStateSha256: sha256Hex(PRODUCTION_STATE_CONTROL_CONTEXT),
    };
  }
  if (mode === "plain-kv") {
    const verified = readAndVerifyPlainKv(plainKvStatePath, identity);
    requireValidStore(verified);
    const latest = verified.records.at(-1);
    return {
      backend: "plain-kv",
      agentChainRecordCount: verified.records.length,
      scopeRecordCount: verified.records.length,
      headSha256: verified.headSha256,
      relevantStateSha256: sha256Hex(
        latest?.stateSummary ?? PRODUCTION_STATE_CONTROL_CONTEXT,
      ),
    };
  }
  if (ledger === undefined) throw new Error("continuity ledger was not configured");
  const report = await requireValidContinuity(ledger, identity);
  const agentChain = await ledger.list({
    tenantId: identity.tenant,
    agentId: identity.agentId,
    limit: 100_000,
  });
  const scoped = await ledger.list({
    tenantId: identity.tenant,
    agentId: identity.agentId,
    scope: identity.scope,
    kind: "claim",
    limit: 100_000,
  });
  if (report.checked !== agentChain.length) {
    throw new StateIntegrityFailure("continuity initial chain count changed during inspection");
  }
  const latest = findLatestContinuityState(scoped);
  return {
    backend: "continuity",
    agentChainRecordCount: agentChain.length,
    scopeRecordCount: scoped.length,
    headSha256: agentChain[0]?.contentHash ?? HASH_GENESIS,
    relevantStateSha256: sha256Hex(
      latest?.payload.stateSummary ?? PRODUCTION_STATE_CONTROL_CONTEXT,
    ),
  };
}

function findLatestContinuityState(
  checkpoints: readonly ContinuityCheckpoint[],
): { readonly checkpoint: ContinuityCheckpoint; readonly payload: ContinuityPayload } | undefined {
  for (const checkpoint of checkpoints) {
    const candidate = checkpoint.payload[CONTINUITY_PAYLOAD_KEY];
    if (candidate === undefined) continue;
    try {
      return { checkpoint, payload: parseContinuityPayload(candidate) };
    } catch (error) {
      throw new StateIntegrityFailure(
        `latest continuity state payload is invalid (${messageOf(error)})`,
      );
    }
  }
  return undefined;
}

async function requireValidContinuity(
  ledger: PostgresContinuityLedger,
  identity: Identity,
): Promise<ContinuityVerificationReport> {
  const report = await ledger.verify(identity.tenant, identity.agentId);
  if (!report.valid) {
    throw new StateIntegrityFailure(
      `continuity chain verification failed (${report.errors.join("; ")})`,
    );
  }
  return report;
}

function reviewStateSummary(
  request: ProductionStateWriteRequest,
  identity: Identity,
): { readonly review: EvidenceAdmissionReview; readonly admitted?: AdmittedStateEvidence } {
  const evaluatedAt = currentTimestamp();
  const subject = stateRef(
    "document",
    `generic-evaluation-state:${sha256Hex(canonicalJson(identity))}`,
  );
  const payload = {
    observedAt: request.observedAt,
    stateSummary: request.stateSummary,
  };
  const evidence: ExternalStateEvidence = {
    tenantId: identity.tenant,
    evidenceId: request.operationId,
    kind: "memory_write",
    source: "model://evaluation-state-summary",
    claimsAuthority: false,
    subject,
    refs: [subject],
    observedAt: timestamp(request.observedAt),
    collectedBy: "pm.public-eval-corners.production-state-sidecar",
    collectedAt: evaluatedAt,
    clientSurface: "public-evaluation-agent",
    payload,
    payloadHash: sha256Hex(canonicalJson(payload)),
    memory: {
      sourceModality: "model_authored_text",
      sourceChannel: "evaluation_state_api",
      retentionPolicy: "evaluation-run-explicit",
      intendedUse: "summary",
      influenceKind: "summary",
      overrideStatus: "active",
      deletionResidueRisk: "none",
      staleInformationRisk: "low",
      observableFeatureBoundary: "model-authored fixed-width state summary only",
    },
  };
  const review = reviewExternalStateEvidence(evidence, {
    tenantId: identity.tenant,
    evaluatedAt,
    expectedSubject: subject,
  });
  const admitted = toAdmittedStateEvidence(review);
  return admitted === undefined ? { review } : { review, admitted };
}

function readAndVerifyPlainKv(path: string, identity: Identity): StoreVerification {
  let text: string;
  try {
    assertRegularOrAbsent(path);
    text = readFileSync(path, "utf8");
  } catch (error) {
    if (isCode(error, "ENOENT")) {
      return { valid: true, records: [], issues: [], headSha256: HASH_GENESIS };
    }
    return {
      valid: false,
      records: [],
      issues: [`state file cannot be read safely: ${messageOf(error)}`],
      headSha256: HASH_GENESIS,
    };
  }
  if (text.length === 0) {
    return { valid: true, records: [], issues: [], headSha256: HASH_GENESIS };
  }
  if (!text.endsWith("\n")) {
    return {
      valid: false,
      records: [],
      issues: ["state file is not newline terminated"],
      headSha256: HASH_GENESIS,
    };
  }
  const records: PlainKvStateRecord[] = [];
  const issues: string[] = [];
  let previous = HASH_GENESIS;
  for (const [index, line] of text.trimEnd().split("\n").entries()) {
    let record: PlainKvStateRecord;
    try {
      record = parsePlainKvRecord(JSON.parse(line) as unknown);
    } catch (error) {
      issues.push(`record ${index + 1}: ${messageOf(error)}`);
      continue;
    }
    if (record.sequence !== index + 1) issues.push(`record ${index + 1}: sequence mismatch`);
    if (
      record.tenantId !== identity.tenant ||
      record.agentId !== identity.agentId ||
      record.scope !== identity.scope
    ) {
      issues.push(`record ${index + 1}: identity mismatch`);
    }
    if (record.previousRecordSha256 !== previous) {
      issues.push(`record ${index + 1}: previousRecordSha256 mismatch`);
    }
    const { recordSha256: _hash, ...draft } = record;
    if (record.recordSha256 !== sha256Hex(canonicalJson(draft))) {
      issues.push(`record ${index + 1}: recordSha256 mismatch`);
    }
    records.push(record);
    previous = record.recordSha256;
  }
  return {
    valid: issues.length === 0,
    records,
    issues,
    headSha256: previous,
  };
}

function parsePlainKvRecord(value: unknown): PlainKvStateRecord {
  const record = requireRecord(value, "plain-kv record");
  requireExactKeys(
    record,
    [
      "admittedEvidence",
      "agentId",
      "observedAt",
      "operationId",
      "previousRecordSha256",
      "recordSha256",
      "schemaVersion",
      "scope",
      "sequence",
      "stateSummary",
      "tenantId",
    ],
    "plain-kv record",
  );
  if (record.schemaVersion !== PRODUCTION_STATE_STORE_SCHEMA_VERSION) {
    throw new Error("store schemaVersion mismatch");
  }
  const sequence = Number(record.sequence);
  if (!Number.isSafeInteger(sequence) || sequence < 1) throw new Error("sequence is invalid");
  const admittedEvidence = requireRecord(record.admittedEvidence, "admitted evidence");
  return {
    schemaVersion: PRODUCTION_STATE_STORE_SCHEMA_VERSION,
    sequence,
    tenantId: tenantId(requireIdentity(record.tenantId, "tenantId")),
    agentId: requireIdentity(record.agentId, "agentId"),
    scope: requireIdentity(record.scope, "scope"),
    operationId: requireOperationId(record.operationId),
    observedAt: requireTimestamp(record.observedAt),
    stateSummary: requireFixedSummary(record.stateSummary, "stateSummary"),
    admittedEvidence: admittedEvidence as unknown as AdmittedStateEvidence,
    previousRecordSha256: requireSha(record.previousRecordSha256, "previousRecordSha256"),
    recordSha256: requireSha(record.recordSha256, "recordSha256"),
  };
}

function parseContinuityPayload(value: unknown): ContinuityPayload {
  const record = requireRecord(value, "continuity state payload");
  requireExactKeys(
    record,
    ["admittedEvidence", "observedAt", "operationId", "schemaVersion", "stateSummary"],
    "continuity state payload",
  );
  if (record.schemaVersion !== PRODUCTION_STATE_CONTINUITY_PAYLOAD_SCHEMA_VERSION) {
    throw new Error("continuity payload schemaVersion mismatch");
  }
  return {
    schemaVersion: PRODUCTION_STATE_CONTINUITY_PAYLOAD_SCHEMA_VERSION,
    operationId: requireOperationId(record.operationId),
    observedAt: requireTimestamp(record.observedAt),
    stateSummary: requireFixedSummary(record.stateSummary, "continuity stateSummary"),
    admittedEvidence: requireRecord(
      record.admittedEvidence,
      "continuity admitted evidence",
    ) as unknown as AdmittedStateEvidence,
  };
}

function parseAuditEntry(value: unknown): ProductionStateAuditEntry {
  const record = requireRecord(value, "state audit entry");
  requireExactKeys(record, [
    "admissionReview", "admittedEvidence", "authenticated", "backendReceipt",
    "entrySha256", "failureSha256", "httpExchange", "httpStatus", "operationId",
    "previousEntrySha256", "rawRequestPath", "rawResponsePath", "recordedAt",
    "rejectionReason", "requestKind", "requestSha256", "responseSha256",
    "responseStatus", "schemaVersion", "sequence", "timing",
  ], "state audit entry");
  if (record.schemaVersion !== PRODUCTION_STATE_AUDIT_SCHEMA_VERSION) {
    throw new Error("state audit schemaVersion mismatch");
  }
  if (!Number.isSafeInteger(record.sequence) || Number(record.sequence) < 1) {
    throw new Error("state audit sequence is invalid");
  }
  if (typeof record.authenticated !== "boolean") {
    throw new Error("state audit authenticated is invalid");
  }
  if (record.requestKind !== "write" && record.requestKind !== "read" && record.requestKind !== "rejected") {
    throw new Error("state audit requestKind is invalid");
  }
  if (record.responseStatus !== "ok" && record.responseStatus !== "rejected") {
    throw new Error("state audit responseStatus is invalid");
  }
  if (!Number.isSafeInteger(record.httpStatus) || Number(record.httpStatus) < 100 || Number(record.httpStatus) > 599) {
    throw new Error("state audit httpStatus is invalid");
  }
  const rejectionReasons: readonly ProductionStateRejectionReason[] = [
    "none", "unauthorized", "body_too_large", "invalid_request",
    "duplicate_operation_id", "route_not_found", "evidence_rejected",
    "state_integrity_failure", "internal_failure",
  ];
  if (!rejectionReasons.includes(record.rejectionReason as ProductionStateRejectionReason)) {
    throw new Error("state audit rejectionReason is invalid");
  }
  const admissionReview = record.admissionReview === null
    ? null
    : requireRecord(record.admissionReview, "state audit admissionReview") as unknown as EvidenceAdmissionReview;
  const admittedEvidence = record.admittedEvidence === null
    ? null
    : requireRecord(record.admittedEvidence, "state audit admittedEvidence") as unknown as AdmittedStateEvidence;
  return {
    schemaVersion: PRODUCTION_STATE_AUDIT_SCHEMA_VERSION,
    sequence: Number(record.sequence),
    recordedAt: timestamp(requireTimestamp(record.recordedAt)),
    operationId: requireOperationId(record.operationId),
    requestKind: record.requestKind,
    authenticated: record.authenticated,
    httpExchange: parseHttpExchange(record.httpExchange),
    timing: parseTimingReceipt(record.timing),
    rawRequestPath: requireRelativeEvidencePath(record.rawRequestPath, "rawRequestPath"),
    rawResponsePath: requireRelativeEvidencePath(record.rawResponsePath, "rawResponsePath"),
    requestSha256: requireSha(record.requestSha256, "requestSha256"),
    responseSha256: requireSha(record.responseSha256, "responseSha256"),
    responseStatus: record.responseStatus,
    httpStatus: Number(record.httpStatus),
    rejectionReason: record.rejectionReason as ProductionStateRejectionReason,
    admissionReview,
    admittedEvidence,
    backendReceipt: record.backendReceipt === null ? null : parseBackendReceipt(record.backendReceipt),
    failureSha256: record.failureSha256 === null ? null : requireSha(record.failureSha256, "failureSha256"),
    previousEntrySha256: requireSha(record.previousEntrySha256, "previousEntrySha256"),
    entrySha256: requireSha(record.entrySha256, "entrySha256"),
  };
}

function parseBackendReceipt(value: unknown): ProductionStateBackendReceipt {
  const record = requireRecord(value, "state backend receipt");
  requireExactKeys(record, [
    "backend", "checkedRecords", "integrityVerified", "persistedRecordId",
    "relevantStateSha256",
  ], "state backend receipt");
  if (record.backend !== "discard" && record.backend !== "plain-kv" && record.backend !== "continuity") {
    throw new Error("state backend receipt backend is invalid");
  }
  if (record.integrityVerified !== true || !Number.isSafeInteger(record.checkedRecords) || Number(record.checkedRecords) < 0) {
    throw new Error("state backend receipt integrity/count is invalid");
  }
  if (record.persistedRecordId !== null && (typeof record.persistedRecordId !== "string" || record.persistedRecordId.length === 0)) {
    throw new Error("state backend receipt persistedRecordId is invalid");
  }
  return {
    backend: record.backend,
    integrityVerified: true,
    checkedRecords: Number(record.checkedRecords),
    persistedRecordId: record.persistedRecordId,
    relevantStateSha256: requireSha(record.relevantStateSha256, "relevantStateSha256"),
  };
}

function parseHttpExchange(value: unknown): ProductionStateHttpExchange {
  const record = requireRecord(value, "state HTTP exchange");
  requireExactKeys(record, [
    "authorizationTokenSha256", "requestContentType", "requestMethod",
    "requestPath", "responseContentType",
  ], "state HTTP exchange");
  if (
    typeof record.requestMethod !== "string" || record.requestMethod.length > 16 ||
    typeof record.requestPath !== "string" || record.requestPath.length > 2_048 ||
    (record.requestContentType !== null && typeof record.requestContentType !== "string") ||
    record.responseContentType !== "application/json; charset=utf-8"
  ) throw new Error("state HTTP exchange is invalid");
  return {
    requestMethod: record.requestMethod,
    requestPath: record.requestPath,
    requestContentType: record.requestContentType,
    authorizationTokenSha256: requireSha(record.authorizationTokenSha256, "authorizationTokenSha256"),
    responseContentType: "application/json; charset=utf-8",
  };
}

function parseTimingReceipt(value: unknown): ProductionStateTimingReceipt {
  const record = requireRecord(value, "state timing receipt");
  requireExactKeys(record, [
    "backendCompletedAtMonotonicMs", "deadlineMissed", "receivedAt",
    "receivedAtMonotonicMs", "releaseDeadlineMonotonicMs",
    "releasedAtMonotonicMs", "responseDeadlineMs",
  ], "state timing receipt");
  const finite = (candidate: unknown): candidate is number =>
    typeof candidate === "number" && Number.isFinite(candidate) && candidate >= 0;
  if (
    !finite(record.receivedAtMonotonicMs) ||
    !finite(record.backendCompletedAtMonotonicMs) ||
    !finite(record.releaseDeadlineMonotonicMs) ||
    !finite(record.releasedAtMonotonicMs) ||
    !Number.isSafeInteger(record.responseDeadlineMs) || Number(record.responseDeadlineMs) < 0 ||
    typeof record.deadlineMissed !== "boolean"
  ) throw new Error("state timing receipt is invalid");
  return {
    receivedAt: timestamp(requireTimestamp(record.receivedAt)),
    receivedAtMonotonicMs: record.receivedAtMonotonicMs,
    backendCompletedAtMonotonicMs: record.backendCompletedAtMonotonicMs,
    releaseDeadlineMonotonicMs: record.releaseDeadlineMonotonicMs,
    releasedAtMonotonicMs: record.releasedAtMonotonicMs,
    responseDeadlineMs: Number(record.responseDeadlineMs),
    deadlineMissed: record.deadlineMissed,
  };
}

function requireRelativeEvidencePath(value: unknown, label: string): string {
  if (
    typeof value !== "string" || value.length === 0 || value.length > 4_096 ||
    isAbsolute(value) || value.split(/[\\/]/u).some((part) => part === "..") || /[\0\r\n]/u.test(value)
  ) throw new Error(`${label} is not a safe relative evidence path`);
  return value;
}

function failureOutcome(
  rawRequest: Uint8Array,
  authenticated: boolean,
  error: unknown,
): RequestOutcome {
  const failure =
    error instanceof RequestFailure
      ? error
      : error instanceof StateIntegrityFailure
        ? new RequestFailure(503, "state_integrity_failure", messageOf(error))
        : new RequestFailure(500, "internal_failure", messageOf(error));
  return {
    operationId: operationIdFromRaw(rawRequest) ?? syntheticOperationId(rawRequest, failure.reason),
    requestKind: "rejected",
    authenticated,
    httpStatus: failure.status,
    rejectionReason: failure.reason,
    responseStatus: "rejected",
    responseState: REJECTED_STATE,
    admissionReview: null,
    admittedEvidence: null,
    backendReceipt: null,
    failureSha256: sha256Hex(failure.message),
  };
}

function reviewedWriteFailure(
  operationId: string,
  review: EvidenceAdmissionReview,
  admitted: AdmittedStateEvidence,
  error: unknown,
): RequestOutcome {
  const integrityFailure = error instanceof StateIntegrityFailure;
  return {
    operationId,
    requestKind: "write",
    authenticated: true,
    httpStatus: integrityFailure ? 503 : 500,
    rejectionReason: integrityFailure ? "state_integrity_failure" : "internal_failure",
    responseStatus: "rejected",
    responseState: REJECTED_STATE,
    admissionReview: review,
    admittedEvidence: admitted,
    backendReceipt: null,
    failureSha256: sha256Hex(messageOf(error)),
  };
}

function buildResponse(
  operationId: string,
  status: "ok" | "rejected",
  stateSummary: string,
): ProductionStateResponse {
  return {
    schemaVersion: PRODUCTION_STATE_RESPONSE_SCHEMA_VERSION,
    operationId,
    status,
    stateEncoding: "fixed-printable-ascii-space-padded-v1",
    stateSummary: requireFixedSummary(stateSummary, "response state"),
    padding: RESPONSE_PADDING,
  };
}

function validateStartInput(input: StartProductionStateSidecarInput): ValidatedStartInput {
  if (!(["native", "sham", "plain-kv", "substrate"] as const).includes(input.mode)) {
    throw new Error("state sidecar mode is invalid");
  }
  if (
    typeof input.evidenceBinding !== "string" ||
    input.evidenceBinding.length < 1 ||
    input.evidenceBinding.length > 4_096 ||
    /[\0\r\n]/u.test(input.evidenceBinding)
  ) {
    throw new Error("evidenceBinding must be 1-4096 single-line characters");
  }
  if (
    typeof input.bearerToken !== "string" ||
    input.bearerToken.length < 32 ||
    input.bearerToken.length > 512 ||
    !/^[\x21-\x7e]+$/.test(input.bearerToken)
  ) {
    throw new Error("bearer token must be 32-512 non-whitespace ASCII characters");
  }
  const tenant = requireIdentity(String(input.tenant), "tenant");
  const agentId = requireIdentity(input.agentId, "agentId");
  const scope = requireIdentity(input.scope, "scope");
  const port = input.port ?? 0;
  if (!Number.isInteger(port) || port < 0 || port > 65_535) {
    throw new Error("port must be an integer from 0 through 65535");
  }
  if (input.responseDeadlineMs !== undefined && input.minimumLatencyMs !== undefined) {
    throw new Error("responseDeadlineMs and minimumLatencyMs may not both be set");
  }
  const responseDeadlineMs =
    input.responseDeadlineMs ?? input.minimumLatencyMs ?? PRODUCTION_STATE_RESPONSE_DEADLINE_MS;
  if (
    !Number.isInteger(responseDeadlineMs) ||
    responseDeadlineMs < 0 ||
    responseDeadlineMs > 60_000
  ) {
    throw new Error("responseDeadlineMs must be an integer from 0 through 60000");
  }
  const databaseUrl = input.databaseUrl;
  if (
    (input.mode === "sham" || input.mode === "substrate") &&
    (typeof databaseUrl !== "string" || databaseUrl.length === 0)
  ) {
    throw new Error("databaseUrl is required for continuity-backed modes");
  }
  return {
    mode: input.mode,
    evidenceDirectory: input.evidenceDirectory,
    stateDirectory: input.stateDirectory,
    bearerToken: input.bearerToken,
    tenant: tenantId(tenant),
    agentId,
    scope,
    evidenceBindingSha256: sha256Hex(input.evidenceBinding),
    ...(databaseUrl === undefined ? {} : { databaseUrl }),
    port,
    responseDeadlineMs,
  };
}

function assertSeparateSafeRoots(evidenceDirectory: string, stateDirectory: string): void {
  const evidence = assertSafeRoot(evidenceDirectory, "evidenceDirectory");
  const state = assertSafeRoot(stateDirectory, "stateDirectory");
  if (evidence === state || isWithin(evidence, state) || isWithin(state, evidence)) {
    throw new Error("evidenceDirectory and stateDirectory must be separate non-overlapping roots");
  }
}

function assertSafeRoot(directory: string, label: string): string {
  if (
    typeof directory !== "string" ||
    !isAbsolute(directory) ||
    normalize(directory) !== directory ||
    resolve(directory) !== directory
  ) {
    throw new Error(`${label} must be an absolute normalized path`);
  }
  const stat = lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error(`${label} must be a non-symlink directory`);
  }
  const real = realpathSync.native(directory);
  if (real !== directory) throw new Error(`${label} may not traverse a symlink`);
  return real;
}

function assertFreshPaths(paths: readonly string[]): void {
  for (const path of paths) {
    try {
      lstatSync(path);
      throw new Error(`evidence artifact already exists: ${basename(path)}`);
    } catch (error) {
      if (isCode(error, "ENOENT")) continue;
      throw error;
    }
  }
}

function assertRegularOrAbsent(path: string): void {
  try {
    const stat = lstatSync(path);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new StateIntegrityFailure("state path is not a regular non-symlink file");
    }
  } catch (error) {
    if (isCode(error, "ENOENT")) return;
    throw error;
  }
}

function appendDurable(path: string, value: string): void {
  const existed = fileExists(path);
  assertRegularOrAbsent(path);
  const fd = openSync(
    path,
    constants.O_CREAT | constants.O_APPEND | constants.O_WRONLY | constants.O_NOFOLLOW,
    0o600,
  );
  try {
    writeSync(fd, value, undefined, "utf8");
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  if (!existed) fsyncDirectory(resolve(path, ".."));
}

function writeExclusiveDurable(path: string, bytes: Uint8Array, directory: string): void {
  writeFileSync(path, bytes, { flag: "wx", mode: 0o600 });
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
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

async function readRequestBody(request: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
    size += bytes.byteLength;
    if (size > PRODUCTION_STATE_MAX_BODY_BYTES) {
      throw new RequestFailure(413, "body_too_large", "request body is too large");
    }
    chunks.push(bytes);
  }
  return Buffer.concat(chunks);
}

function authorized(request: IncomingMessage, token: string): boolean {
  const header = request.headers.authorization;
  if (typeof header !== "string" || !header.startsWith("Bearer ")) return false;
  const expected = Buffer.from(sha256Hex(token), "hex");
  const actual = Buffer.from(sha256Hex(header.slice("Bearer ".length)), "hex");
  return timingSafeEqual(expected, actual);
}

function rejectDuplicate(operationId: string, seen: Set<string>): void {
  if (seen.has(operationId)) {
    throw new RequestFailure(409, "duplicate_operation_id", "operationId was already used");
  }
  seen.add(operationId);
}

function responseBytes(response: ProductionStateResponse): Buffer {
  return Buffer.from(JSON.stringify(response), "utf8");
}

async function sendAtResponseDeadline(
  response: import("node:http").ServerResponse,
  status: number,
  bytes: Buffer,
  beganAt: number,
  backendCompletedAtMonotonicMs: number,
  responseDeadlineMs: number,
): Promise<{
  readonly releaseDeadlineMonotonicMs: number;
  readonly releasedAtMonotonicMs: number;
  readonly deadlineMissed: boolean;
}> {
  const releaseDeadlineMonotonicMs = beganAt + responseDeadlineMs;
  const remaining = releaseDeadlineMonotonicMs - performance.now();
  if (remaining > 0) await new Promise((resolvePromise) => setTimeout(resolvePromise, remaining));
  const releasedAtMonotonicMs = performance.now();
  response.writeHead(status, {
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
    "content-length": bytes.byteLength,
    connection: "close",
  });
  response.end(bytes);
  return {
    releaseDeadlineMonotonicMs,
    releasedAtMonotonicMs,
    deadlineMissed:
      responseDeadlineMs > 0 && backendCompletedAtMonotonicMs > releaseDeadlineMonotonicMs,
  };
}

function canonicalContentType(value: string | readonly string[] | undefined): string | null {
  if (typeof value !== "string") return null;
  return value.split(";", 1)[0]?.trim().toLowerCase() ?? null;
}

function suppliedBearerTokenSha256(request: IncomingMessage): string {
  const header = request.headers.authorization;
  if (typeof header !== "string" || !header.startsWith("Bearer ")) {
    return sha256Hex("");
  }
  return sha256Hex(header.slice("Bearer ".length));
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

const fileQueues = new Map<string, Promise<void>>();

async function withFileQueue<T>(path: string, operation: () => Promise<T>): Promise<T> {
  const previous = fileQueues.get(path) ?? Promise.resolve();
  let release!: () => void;
  const next = new Promise<void>((resolvePromise) => {
    release = resolvePromise;
  });
  const tail = previous.then(() => next);
  fileQueues.set(path, tail);
  await previous;
  try {
    return await operation();
  } finally {
    release();
    if (fileQueues.get(path) === tail) fileQueues.delete(path);
  }
}

function containedEvidencePath(root: string, relativePath: string): string {
  if (isAbsolute(relativePath) || normalize(relativePath) !== relativePath) {
    throw new Error("raw evidence path is not normalized and relative");
  }
  const absolute = resolve(root, relativePath);
  if (!isWithin(root, absolute)) throw new Error("raw evidence path escapes evidence root");
  const stat = lstatSync(absolute);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("raw evidence is unsafe");
  return absolute;
}

function isWithin(parent: string, candidate: string): boolean {
  const rel = relative(parent, candidate);
  return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
}

function operationIdFromRaw(raw: Uint8Array): string | undefined {
  try {
    const value = JSON.parse(Buffer.from(raw).toString("utf8")) as unknown;
    if (!isRecord(value) || typeof value.operationId !== "string") return undefined;
    return OPERATION_ID.test(value.operationId) ? value.operationId : undefined;
  } catch {
    return undefined;
  }
}

function syntheticOperationId(raw: Uint8Array, reason: string): string {
  return sha256Hex(`${reason}\0${sha256Hex(raw)}`).slice(0, 32);
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("canonical JSON rejects non-finite numbers");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort(compareCodeUnits)
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  throw new Error(`canonical JSON rejects ${typeof value}`);
}

function receiptHash(
  receipt: ProductionStateReadyReceipt | ProductionStateFinalReceipt,
): string {
  const { receiptSha256: _receiptSha256, ...draft } = receipt;
  return sha256Hex(canonicalJson(draft));
}

function sha256Hex(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function requireValidStore(verification: StoreVerification): void {
  if (!verification.valid) {
    throw new StateIntegrityFailure(
      `plain-kv state verification failed (${verification.issues.join("; ")})`,
    );
  }
}

function requireRecord(value: unknown, label: string): JsonRecord {
  if (!isRecord(value)) throw new Error(`${label} must be an object`);
  return value;
}

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requireExactKeys(record: JsonRecord, keys: readonly string[], label: string): void {
  if (!hasExactKeys(record, keys)) {
    throw new Error(`${label} contains missing or unknown keys`);
  }
}

function hasExactKeys(value: unknown, keys: readonly string[]): boolean {
  return isRecord(value) &&
    Object.keys(value).sort(compareCodeUnits).join("\0") ===
      [...keys].sort(compareCodeUnits).join("\0");
}

function requireIdentity(value: unknown, label: string): string {
  if (typeof value !== "string" || !SAFE_IDENTITY.test(value)) {
    throw new Error(`${label} is invalid`);
  }
  return value;
}

function requireOperationId(value: unknown): string {
  if (typeof value !== "string" || !OPERATION_ID.test(value)) {
    throw new Error("operationId must be exactly 32 lowercase hexadecimal characters");
  }
  return value;
}

function requireTimestamp(value: unknown): string {
  if (typeof value !== "string") throw new Error("observedAt must be a string");
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) {
    throw new Error("observedAt must be a canonical UTC timestamp with milliseconds");
  }
  return value;
}

function validTimestamp(value: string): boolean {
  try {
    requireTimestamp(value);
    return true;
  } catch {
    return false;
  }
}

function requireFixedSummary(value: unknown, label: string): string {
  if (
    typeof value !== "string" ||
    value.length !== PRODUCTION_STATE_SUMMARY_WIDTH ||
    !isPrintableAscii(value)
  ) {
    throw new Error(`${label} must be exactly ${PRODUCTION_STATE_SUMMARY_WIDTH} printable ASCII characters`);
  }
  return value;
}

function requireSha(value: unknown, label: string): string {
  if (typeof value !== "string" || !SHA256.test(value)) throw new Error(`${label} is invalid`);
  return value;
}

function isPrintableAscii(value: string): boolean {
  // Exclude JSON's two escapable printable characters (quote and backslash),
  // so every accepted summary character remains exactly one response byte.
  return /^[\x20-\x21\x23-\x5b\x5d-\x7e]*$/.test(value);
}

function currentTimestamp(): Timestamp {
  return timestamp(new Date().toISOString());
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isJsonContentType(value: string | readonly string[] | undefined): boolean {
  return (
    typeof value === "string" &&
    value.toLowerCase().split(";", 1)[0]?.trim() === "application/json"
  );
}

function isCode(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && error.code === code;
}

function fileExists(path: string): boolean {
  try {
    lstatSync(path);
    return true;
  } catch (error) {
    if (isCode(error, "ENOENT")) return false;
    throw error;
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
