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
  type ContinuityCheckpoint,
  type ContinuityVerificationReport,
} from "@pm/continuity";
import { tenantId, timestamp, type TenantId, type Timestamp } from "@pm/types";
import pg from "pg";

import {
  PRODUCTION_STATE_AUDIT_SCHEMA_VERSION,
  PRODUCTION_STATE_CONTINUITY_PAYLOAD_SCHEMA_VERSION,
  PRODUCTION_STATE_CONTROL_CONTEXT,
  PRODUCTION_STATE_FINAL_SCHEMA_VERSION,
  PRODUCTION_STATE_MAX_BODY_BYTES,
  PRODUCTION_STATE_PADDING_WIDTH,
  PRODUCTION_STATE_READ_SCHEMA_VERSION,
  PRODUCTION_STATE_READY_SCHEMA_VERSION,
  PRODUCTION_STATE_RESPONSE_DEADLINE_MS,
  PRODUCTION_STATE_RESPONSE_SCHEMA_VERSION,
  PRODUCTION_STATE_SHAM_DECOY,
  PRODUCTION_STATE_STORE_SCHEMA_VERSION,
  PRODUCTION_STATE_SUMMARY_WIDTH,
  PRODUCTION_STATE_WRITE_SCHEMA_VERSION,
  fixedStateSummary,
  parseProductionStateReadRequest,
  parseProductionStateResponse,
  parseProductionStateWriteRequest,
  parseProductionStateContinuityPayload,
  readAndVerifyPlainKvState,
  type PlainKvStateRecord,
  type ProductionStateAuditEntry,
  type ProductionStateBackendReceipt,
  type ProductionStateContinuityPayload,
  type ProductionStateFinalReceipt,
  type ProductionStateHttpExchange,
  type ProductionStateReadRequest,
  type ProductionStateReadyReceipt,
  type ProductionStateRejectionReason,
  type ProductionStateResponse,
  type ProductionStateSidecarMode,
  type ProductionStateStoreVerification,
  type ProductionStateTimingReceipt,
  type ProductionStateWriteRequest,
} from "./production-state-evidence.js";

export {
  PRODUCTION_STATE_AUDIT_SCHEMA_VERSION,
  PRODUCTION_STATE_CONTINUITY_PAYLOAD_SCHEMA_VERSION,
  PRODUCTION_STATE_CONTROL_CONTEXT,
  PRODUCTION_STATE_FINAL_SCHEMA_VERSION,
  PRODUCTION_STATE_MAX_BODY_BYTES,
  PRODUCTION_STATE_PADDING_WIDTH,
  PRODUCTION_STATE_READ_SCHEMA_VERSION,
  PRODUCTION_STATE_READY_SCHEMA_VERSION,
  PRODUCTION_STATE_RESPONSE_DEADLINE_MS,
  PRODUCTION_STATE_RESPONSE_SCHEMA_VERSION,
  PRODUCTION_STATE_SHAM_DECOY,
  PRODUCTION_STATE_STORE_SCHEMA_VERSION,
  PRODUCTION_STATE_SUMMARY_WIDTH,
  PRODUCTION_STATE_WRITE_SCHEMA_VERSION,
  fixedStateSummary,
  parseProductionStateReadRequest,
  parseProductionStateResponse,
  parseProductionStateWriteRequest,
  readProductionStateAudit,
  verifyPlainKvStateFile,
  verifyProductionStateBackendReplay,
  verifyProductionStateEvidence,
} from "./production-state-evidence.js";
export type {
  ProductionStateAuditEntry,
  ProductionStateBackendReceipt,
  ProductionStateBackendReplayInput,
  ProductionStateBackendReplayVerification,
  ProductionStateEvidenceVerification,
  ProductionStateFinalReceipt,
  ProductionStateHttpExchange,
  ProductionStateReadRequest,
  ProductionStateReadyReceipt,
  ProductionStateRejectionReason,
  ProductionStateResponse,
  ProductionStateSidecarMode,
  ProductionStateTimingReceipt,
  ProductionStateWriteRequest,
} from "./production-state-evidence.js";

const LOOPBACK_HOST = "127.0.0.1";
const HASH_GENESIS = "0".repeat(64);
const REJECTED_STATE = fixedStateSummary("REQUEST_REJECTED");
const EMPTY_STATE = PRODUCTION_STATE_CONTROL_CONTEXT;
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
      const before = readAndVerifyPlainKvState(plainKvStatePath, identity);
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
      const after = readAndVerifyPlainKvState(plainKvStatePath, identity);
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
  const payload: ProductionStateContinuityPayload = {
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
      const verified = readAndVerifyPlainKvState(plainKvStatePath, identity);
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
    const verified = readAndVerifyPlainKvState(plainKvStatePath, identity);
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
): { readonly checkpoint: ContinuityCheckpoint; readonly payload: ProductionStateContinuityPayload } | undefined {
  for (const checkpoint of checkpoints) {
    const candidate = checkpoint.payload[CONTINUITY_PAYLOAD_KEY];
    if (candidate === undefined) continue;
    try {
      return { checkpoint, payload: parseProductionStateContinuityPayload(candidate) };
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

function requireValidStore(verification: ProductionStateStoreVerification): void {
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
