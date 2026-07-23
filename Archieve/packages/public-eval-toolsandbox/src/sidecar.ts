import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import {
  closeSync,
  createReadStream,
  existsSync,
  fsyncSync,
  linkSync,
  mkdirSync,
  openSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import { dirname, isAbsolute, resolve } from "node:path";
import { TextDecoder } from "node:util";

import {
  toolSandboxVerticalSlice,
  type ToolSandboxBoundaryArm,
  type ToolSandboxEvaluationTrack,
  type ToolSandboxToolOutcomeInput,
  type ToolSandboxToolProposalInput,
} from "./index.js";
import { computeToolSandboxSidecarRuntimeClosure } from "./runtime-closure.js";

const LOOPBACK_HOST = "127.0.0.1";
const DEFAULT_MAX_REQUEST_BYTES = 64 * 1024;
const GENESIS_HASH = "0".repeat(64);
const SHA256 = /^[a-f0-9]{64}$/u;
const OPERATION_KEY = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/u;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const UTF8 = new TextDecoder("utf-8", { fatal: true });

const ADMIT_PATH = "/v1/admit-tool";
const OUTCOME_PATH = "/v1/record-tool-outcome";

const ADMIT_KEYS = [
  "schemaVersion",
  "arm",
  "evaluationTrack",
  "attemptId",
  "sessionId",
  "statePath",
  "toolCallId",
  "toolName",
  "arguments",
  "proposedAt",
] as const;

const OUTCOME_KEYS = [
  "schemaVersion",
  "arm",
  "evaluationTrack",
  "attemptId",
  "statePath",
  "proposalId",
  "toolCallId",
  "toolName",
  "arguments",
  "succeeded",
  "responseHash",
  "observedAt",
] as const;

export interface ToolSandboxBoundarySidecarConfig {
  readonly arm: ToolSandboxBoundaryArm;
  readonly evaluationTrack: ToolSandboxEvaluationTrack;
  readonly attemptId: string;
  readonly statePath: string;
  readonly auditPath: string;
  readonly readyPath: string;
  readonly finalReceiptPath: string;
  readonly entryPath: string;
  readonly bearerToken: string;
  readonly maxRequestBytes?: number;
}

export interface RunningToolSandboxBoundarySidecar {
  readonly origin: string;
  readonly port: number;
  readonly readyReceipt: Readonly<Record<string, unknown>>;
  close(reason: string): Promise<Readonly<Record<string, unknown>>>;
}

interface HttpFailure {
  readonly status: number;
  readonly code: string;
  readonly message: string;
}

interface CapturedRequest {
  readonly request: IncomingMessage;
  readonly response: ServerResponse;
  readonly requestId: string;
  readonly receivedAt: string;
  readonly method: string;
  readonly target: string;
  readonly remoteAddress: string | null;
  readonly body: Buffer;
  readonly bodyComplete: boolean;
  readonly bodyFailure?: HttpFailure;
}

interface GeneratedResponse {
  readonly status: number;
  readonly bytes: Buffer;
  readonly requestId: string;
  readonly authenticated: boolean;
  readonly operationKeySha256: string | null;
  readonly idempotencyDisposition:
    | "not_applicable"
    | "new"
    | "replayed"
    | "conflict"
    | "incomplete";
}

interface CompletedOperation {
  readonly requestHash: string;
  readonly status: number;
  readonly responseBytes: Buffer;
  readonly responseRequestId: string;
}

interface PendingOperation {
  readonly requestHash: string;
}

type OperationState = PendingOperation | CompletedOperation;

interface OperationLedger {
  readonly path: string;
  readonly descriptor: number;
  sequence: number;
  headHash: string;
  readonly byKeyHash: Map<string, OperationState>;
}

interface AuditLedger {
  readonly path: string;
  readonly descriptor: number;
  sequence: number;
  headHash: string;
}

interface StateLock {
  readonly path: string;
  readonly descriptor: number;
  readonly lockHash: string;
}

interface RuntimeIdentity {
  readonly arm: ToolSandboxBoundaryArm;
  readonly evaluationTrack: ToolSandboxEvaluationTrack;
  readonly attemptId: string;
  readonly statePath: string;
  readonly auditPath: string;
  readonly readyPath: string;
  readonly finalReceiptPath: string;
  readonly operationLedgerPath: string;
  readonly stateLockPath: string;
  readonly entryPath: string;
  readonly maxRequestBytes: number;
  readonly tokenSha256: string;
}

class RequestFailure extends Error implements HttpFailure {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "RequestFailure";
    this.status = status;
    this.code = code;
  }
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("canonical JSON rejects non-finite numbers");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }
  if (typeof value === "object") {
    const record = value as Readonly<Record<string, unknown>>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(",")}}`;
  }
  throw new Error("value is not JSON serializable");
}

function sha256Bytes(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function sha256Json(value: unknown): string {
  return sha256Bytes(canonicalJson(value));
}

async function sha256File(path: string): Promise<string> {
  return await new Promise<string>((accept, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(path);
    stream.on("data", (chunk) => {
      hash.update(chunk);
    });
    stream.once("error", reject);
    stream.once("end", () => accept(hash.digest("hex")));
  });
}

function exactIsoNow(): string {
  return new Date().toISOString();
}

function assertId(value: string, path: string): void {
  if (!ID.test(value)) throw new Error(`${path} must be a bounded identifier`);
}

function assertAbsoluteNormalizedPath(value: string, path: string): void {
  if (!isAbsolute(value) || resolve(value) !== value || value.includes("\0")) {
    throw new Error(`${path} must be an absolute normalized path`);
  }
}

function fsyncDirectory(path: string): void {
  const descriptor = openSync(path, "r");
  try {
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

function atomicWriteExclusive(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
  const descriptor = openSync(temporary, "wx", 0o600);
  try {
    writeFileSync(descriptor, bytes);
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
  try {
    linkSync(temporary, path);
    fsyncDirectory(dirname(path));
  } finally {
    unlinkSync(temporary);
  }
}

function durablySyncFile(path: string): void {
  const descriptor = openSync(path, "r");
  try {
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
  fsyncDirectory(dirname(path));
}

function validateConfig(
  input: ToolSandboxBoundarySidecarConfig,
): RuntimeIdentity {
  if (input.arm !== "sham" && input.arm !== "substrate") {
    throw new Error("sidecar arm must be sham or substrate");
  }
  if (
    input.evaluationTrack !== "official_headline" &&
    input.evaluationTrack !== "restart_lost_response_derivative"
  ) {
    throw new Error("sidecar evaluationTrack is invalid");
  }
  assertId(input.attemptId, "attemptId");
  const paths = [
    [input.statePath, "statePath"],
    [input.auditPath, "auditPath"],
    [input.readyPath, "readyPath"],
    [input.finalReceiptPath, "finalReceiptPath"],
    [input.entryPath, "entryPath"],
  ] as const;
  for (const [value, label] of paths) assertAbsoluteNormalizedPath(value, label);
  if (!existsSync(input.entryPath)) throw new Error("sidecar entryPath does not exist");
  if (
    Buffer.byteLength(input.bearerToken, "utf8") < 32 ||
    Buffer.byteLength(input.bearerToken, "utf8") > 4096 ||
    !/^[!-~]+$/u.test(input.bearerToken)
  ) {
    throw new Error("sidecar bearer token must contain at least 32 visible ASCII bytes");
  }
  const maxRequestBytes = input.maxRequestBytes ?? DEFAULT_MAX_REQUEST_BYTES;
  if (!Number.isSafeInteger(maxRequestBytes) || maxRequestBytes < 1024 || maxRequestBytes > 1024 * 1024) {
    throw new Error("maxRequestBytes must be an integer from 1024 through 1048576");
  }
  const operationLedgerPath = `${input.statePath}.sidecar-operations.jsonl`;
  const stateLockPath = `${input.statePath}.sidecar.lock`;
  const allPaths = [
    input.statePath,
    input.auditPath,
    input.readyPath,
    input.finalReceiptPath,
    operationLedgerPath,
    stateLockPath,
  ];
  if (new Set(allPaths).size !== allPaths.length) {
    throw new Error("sidecar state, evidence, and lock paths must be distinct");
  }
  return {
    arm: input.arm,
    evaluationTrack: input.evaluationTrack,
    attemptId: input.attemptId,
    statePath: input.statePath,
    auditPath: input.auditPath,
    readyPath: input.readyPath,
    finalReceiptPath: input.finalReceiptPath,
    operationLedgerPath,
    stateLockPath,
    entryPath: input.entryPath,
    maxRequestBytes,
    tokenSha256: sha256Bytes(input.bearerToken),
  };
}

function acquireStateLock(identity: RuntimeIdentity, startedAt: string): StateLock {
  mkdirSync(dirname(identity.stateLockPath), { recursive: true });
  let descriptor: number;
  try {
    descriptor = openSync(identity.stateLockPath, "wx", 0o600);
  } catch (error) {
    const code = error instanceof Error && "code" in error ? String(error.code) : "unknown";
    if (code === "EEXIST") {
      throw new Error("ToolSandbox boundary state lock is already held");
    }
    throw error;
  }
  const body = {
    schemaVersion: "pm.public-eval.toolsandbox-sidecar-state-lock.v1",
    statePathSha256: sha256Bytes(identity.statePath),
    pid: process.pid,
    ppid: process.ppid,
    startedAt,
    nonce: randomUUID(),
  } as const;
  const value = { ...body, lockHash: sha256Json(body) };
  try {
    writeFileSync(descriptor, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    fsyncSync(descriptor);
    fsyncDirectory(dirname(identity.stateLockPath));
  } catch (error) {
    closeSync(descriptor);
    unlinkSync(identity.stateLockPath);
    throw error;
  }
  return { path: identity.stateLockPath, descriptor, lockHash: value.lockHash };
}

function releaseStateLock(lock: StateLock): void {
  closeSync(lock.descriptor);
  const value = JSON.parse(readFileSync(lock.path, "utf8")) as { lockHash?: unknown };
  if (value.lockHash !== lock.lockHash) {
    throw new Error("ToolSandbox boundary state lock changed while held");
  }
  unlinkSync(lock.path);
  fsyncDirectory(dirname(lock.path));
}

function operationRecordBody(value: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  const { recordHash: _recordHash, ...body } = value;
  return body;
}

function openOperationLedger(path: string): OperationLedger {
  mkdirSync(dirname(path), { recursive: true });
  const byKeyHash = new Map<string, OperationState>();
  let sequence = 0;
  let headHash = GENESIS_HASH;
  if (existsSync(path)) {
    const text = readFileSync(path, "utf8");
    const lines = text.length === 0 ? [] : text.trimEnd().split("\n");
    for (const [offset, line] of lines.entries()) {
      const value = JSON.parse(line) as Readonly<Record<string, unknown>>;
      const body = operationRecordBody(value);
      if (
        value.schemaVersion !== "pm.public-eval.toolsandbox-sidecar-operation.v1" ||
        value.sequence !== offset + 1 ||
        value.previousRecordHash !== headHash ||
        typeof value.recordHash !== "string" ||
        value.recordHash !== sha256Json(body) ||
        typeof value.operationKeySha256 !== "string" ||
        !SHA256.test(value.operationKeySha256) ||
        typeof value.requestHash !== "string" ||
        !SHA256.test(value.requestHash)
      ) {
        throw new Error("ToolSandbox sidecar operation ledger does not verify");
      }
      const keyHash = value.operationKeySha256;
      const current = byKeyHash.get(keyHash);
      if (value.phase === "prepared") {
        if (current !== undefined) throw new Error("operation ledger has a duplicate prepare");
        byKeyHash.set(keyHash, { requestHash: value.requestHash });
      } else if (value.phase === "completed") {
        if (
          current === undefined ||
          "status" in current ||
          current.requestHash !== value.requestHash ||
          typeof value.status !== "number" ||
          typeof value.responseBytesBase64 !== "string" ||
          typeof value.responseSha256 !== "string" ||
          typeof value.responseRequestId !== "string"
        ) {
          throw new Error("operation ledger completion does not match its prepare");
        }
        const responseBytes = Buffer.from(value.responseBytesBase64, "base64");
        if (sha256Bytes(responseBytes) !== value.responseSha256) {
          throw new Error("operation ledger response bytes do not verify");
        }
        byKeyHash.set(keyHash, {
          requestHash: value.requestHash,
          status: value.status,
          responseBytes,
          responseRequestId: value.responseRequestId,
        });
      } else {
        throw new Error("operation ledger phase is invalid");
      }
      sequence = offset + 1;
      headHash = value.recordHash;
    }
  }
  const descriptor = openSync(path, "a", 0o600);
  fsyncDirectory(dirname(path));
  return { path, descriptor, sequence, headHash, byKeyHash };
}

function appendOperationRecord(
  ledger: OperationLedger,
  value: Readonly<Record<string, unknown>>,
): string {
  const body = {
    schemaVersion: "pm.public-eval.toolsandbox-sidecar-operation.v1",
    sequence: ledger.sequence + 1,
    previousRecordHash: ledger.headHash,
    ...value,
  } as const;
  const recordHash = sha256Json(body);
  writeFileSync(ledger.descriptor, `${JSON.stringify({ ...body, recordHash })}\n`, "utf8");
  fsyncSync(ledger.descriptor);
  ledger.sequence += 1;
  ledger.headHash = recordHash;
  return recordHash;
}

function prepareOperation(
  ledger: OperationLedger,
  operationKeySha256: string,
  requestHash: string,
  preparedAt: string,
): void {
  appendOperationRecord(ledger, {
    phase: "prepared",
    operationKeySha256,
    requestHash,
    preparedAt,
  });
  ledger.byKeyHash.set(operationKeySha256, { requestHash });
}

function completeOperation(
  ledger: OperationLedger,
  operationKeySha256: string,
  requestHash: string,
  response: GeneratedResponse,
  completedAt: string,
): void {
  appendOperationRecord(ledger, {
    phase: "completed",
    operationKeySha256,
    requestHash,
    status: response.status,
    responseBytesBase64: response.bytes.toString("base64"),
    responseSha256: sha256Bytes(response.bytes),
    responseRequestId: response.requestId,
    completedAt,
  });
  ledger.byKeyHash.set(operationKeySha256, {
    requestHash,
    status: response.status,
    responseBytes: response.bytes,
    responseRequestId: response.requestId,
  });
}

function openAuditLedger(path: string): AuditLedger {
  mkdirSync(dirname(path), { recursive: true });
  const descriptor = openSync(path, "wx", 0o600);
  fsyncDirectory(dirname(path));
  return { path, descriptor, sequence: 0, headHash: GENESIS_HASH };
}

function appendAuditRecord(
  ledger: AuditLedger,
  request: CapturedRequest,
  generated: GeneratedResponse,
  completedAt: string,
): void {
  const body = {
    schemaVersion: "pm.public-eval.toolsandbox-sidecar-audit.v1",
    sequence: ledger.sequence + 1,
    previousRecordHash: ledger.headHash,
    requestId: request.requestId,
    pid: process.pid,
    receivedAt: request.receivedAt,
    completedAt,
    request: {
      method: request.method,
      target: request.target,
      remoteAddress: request.remoteAddress,
      bodyComplete: request.bodyComplete,
      bodyByteLength: request.body.byteLength,
      bodyBytesBase64: request.body.toString("base64"),
      bodySha256: sha256Bytes(request.body),
      authenticated: generated.authenticated,
      operationKeySha256: generated.operationKeySha256,
      idempotencyDisposition: generated.idempotencyDisposition,
    },
    generatedResponse: {
      status: generated.status,
      bodyByteLength: generated.bytes.byteLength,
      bodyBytesBase64: generated.bytes.toString("base64"),
      bodySha256: sha256Bytes(generated.bytes),
      responseRequestId: generated.requestId,
    },
  } as const;
  const recordHash = sha256Json(body);
  writeFileSync(ledger.descriptor, `${JSON.stringify({ ...body, recordHash })}\n`, "utf8");
  fsyncSync(ledger.descriptor);
  ledger.sequence += 1;
  ledger.headHash = recordHash;
}

function jsonResponse(status: number, code: string, message: string): Buffer {
  return Buffer.from(
    `${JSON.stringify({
      schemaVersion: "pm.public-eval.toolsandbox-sidecar-error.v1",
      error: { code, message },
    })}\n`,
    "utf8",
  );
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactRecord(value: unknown, keys: readonly string[]): Readonly<Record<string, unknown>> {
  if (!isRecord(value)) throw new RequestFailure(400, "invalid_json_object", "request JSON must be an object");
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new RequestFailure(400, "invalid_request_shape", "request JSON fields do not match the endpoint contract");
  }
  return value;
}

function parseJsonBody(bytes: Buffer): unknown {
  try {
    return JSON.parse(UTF8.decode(bytes)) as unknown;
  } catch {
    throw new RequestFailure(400, "invalid_json", "request body must be valid UTF-8 JSON");
  }
}

function assertBoundIdentity(
  record: Readonly<Record<string, unknown>>,
  identity: RuntimeIdentity,
): void {
  if (
    record.arm !== identity.arm ||
    record.evaluationTrack !== identity.evaluationTrack ||
    record.attemptId !== identity.attemptId ||
    record.statePath !== identity.statePath
  ) {
    throw new RequestFailure(400, "identity_mismatch", "request identity does not match the startup-bound sidecar identity");
  }
}

function runBoundOperation(
  target: string,
  body: Buffer,
  identity: RuntimeIdentity,
): Buffer {
  const parsed = parseJsonBody(body);
  if (target === ADMIT_PATH) {
    const record = exactRecord(parsed, ADMIT_KEYS);
    assertBoundIdentity(record, identity);
    const input: ToolSandboxToolProposalInput = {
      schemaVersion: record.schemaVersion as ToolSandboxToolProposalInput["schemaVersion"],
      arm: identity.arm,
      evaluationTrack: identity.evaluationTrack,
      attemptId: identity.attemptId,
      sessionId: record.sessionId as string,
      statePath: identity.statePath,
      toolCallId: record.toolCallId as string,
      toolName: record.toolName as string,
      arguments: record.arguments as Readonly<Record<string, unknown>>,
      proposedAt: record.proposedAt as string,
    };
    const result = toolSandboxVerticalSlice.admitToolProposal(input);
    durablySyncFile(identity.statePath);
    return Buffer.from(`${JSON.stringify(result)}\n`, "utf8");
  }
  const record = exactRecord(parsed, OUTCOME_KEYS);
  assertBoundIdentity(record, identity);
  const input: ToolSandboxToolOutcomeInput = {
    schemaVersion: record.schemaVersion as ToolSandboxToolOutcomeInput["schemaVersion"],
    arm: identity.arm,
    attemptId: identity.attemptId,
    statePath: identity.statePath,
    proposalId: record.proposalId as string,
    toolCallId: record.toolCallId as string,
    toolName: record.toolName as string,
    arguments: record.arguments as Readonly<Record<string, unknown>>,
    succeeded: record.succeeded as boolean,
    responseHash: record.responseHash as string,
    observedAt: record.observedAt as string,
  };
  const result = toolSandboxVerticalSlice.recordToolOutcome(input);
  durablySyncFile(identity.statePath);
  return Buffer.from(`${JSON.stringify(result)}\n`, "utf8");
}

function bearerAccepted(request: IncomingMessage, expectedToken: string): boolean {
  const rawAuthorizations = request.rawHeaders.filter(
    (value, index, values) => index % 2 === 0 && value.toLowerCase() === "authorization" && values[index + 1] !== undefined,
  );
  if (rawAuthorizations.length !== 1) return false;
  const authorization = request.headers.authorization;
  if (authorization === undefined || !authorization.startsWith("Bearer ")) return false;
  const supplied = Buffer.from(authorization.slice("Bearer ".length), "utf8");
  const expected = Buffer.from(expectedToken, "utf8");
  return supplied.byteLength === expected.byteLength && timingSafeEqual(supplied, expected);
}

function operationKey(request: IncomingMessage): string | undefined {
  const header = request.headers["idempotency-key"];
  return typeof header === "string" ? header : undefined;
}

function requestHash(method: string, target: string, body: Buffer): string {
  return sha256Json({ method, target, bodyBytesBase64: body.toString("base64") });
}

function failureResponse(
  failure: HttpFailure,
  requestId: string,
  authenticated: boolean,
  operationKeySha256: string | null,
  disposition: GeneratedResponse["idempotencyDisposition"],
): GeneratedResponse {
  return {
    status: failure.status,
    bytes: jsonResponse(failure.status, failure.code, failure.message),
    requestId,
    authenticated,
    operationKeySha256,
    idempotencyDisposition: disposition,
  };
}

function processCapturedRequest(
  captured: CapturedRequest,
  identity: RuntimeIdentity,
  expectedToken: string,
  operations: OperationLedger,
): GeneratedResponse {
  const authenticated = bearerAccepted(captured.request, expectedToken);
  if (!authenticated) {
    return failureResponse(
      { status: 401, code: "unauthorized", message: "valid bearer authentication is required" },
      captured.requestId,
      false,
      null,
      "not_applicable",
    );
  }
  if (captured.remoteAddress !== LOOPBACK_HOST) {
    return failureResponse(
      { status: 403, code: "non_loopback_peer", message: "only loopback clients are accepted" },
      captured.requestId,
      true,
      null,
      "not_applicable",
    );
  }
  if (captured.method !== "POST") {
    return failureResponse(
      { status: 405, code: "method_not_allowed", message: "endpoint requires POST" },
      captured.requestId,
      true,
      null,
      "not_applicable",
    );
  }
  if (captured.target !== ADMIT_PATH && captured.target !== OUTCOME_PATH) {
    return failureResponse(
      { status: 404, code: "route_not_found", message: "route not found" },
      captured.requestId,
      true,
      null,
      "not_applicable",
    );
  }
  if (captured.bodyFailure !== undefined) {
    return failureResponse(captured.bodyFailure, captured.requestId, true, null, "not_applicable");
  }
  if (captured.request.headers["content-type"] !== "application/json") {
    return failureResponse(
      { status: 415, code: "unsupported_media_type", message: "Content-Type must be application/json" },
      captured.requestId,
      true,
      null,
      "not_applicable",
    );
  }
  const key = operationKey(captured.request);
  if (key === undefined || !OPERATION_KEY.test(key)) {
    return failureResponse(
      { status: 400, code: "invalid_idempotency_key", message: "a bounded Idempotency-Key is required" },
      captured.requestId,
      true,
      null,
      "not_applicable",
    );
  }
  const keyHash = sha256Bytes(key);
  const operationRequestHash = requestHash(captured.method, captured.target, captured.body);
  const prior = operations.byKeyHash.get(keyHash);
  if (prior !== undefined) {
    if (prior.requestHash !== operationRequestHash) {
      return failureResponse(
        { status: 409, code: "idempotency_conflict", message: "Idempotency-Key is already bound to different request bytes" },
        captured.requestId,
        true,
        keyHash,
        "conflict",
      );
    }
    if (!("status" in prior)) {
      return failureResponse(
        { status: 503, code: "operation_incomplete", message: "operation was durably prepared but has no completed response" },
        captured.requestId,
        true,
        keyHash,
        "incomplete",
      );
    }
    return {
      status: prior.status,
      bytes: prior.responseBytes,
      requestId: prior.responseRequestId,
      authenticated: true,
      operationKeySha256: keyHash,
      idempotencyDisposition: "replayed",
    };
  }
  prepareOperation(operations, keyHash, operationRequestHash, exactIsoNow());
  let response: GeneratedResponse;
  try {
    response = {
      status: 200,
      bytes: runBoundOperation(captured.target, captured.body, identity),
      requestId: captured.requestId,
      authenticated: true,
      operationKeySha256: keyHash,
      idempotencyDisposition: "new",
    };
  } catch (error) {
    const failure =
      error instanceof RequestFailure
        ? error
        : {
            status: 400,
            code: "boundary_rejected",
            message: "the startup-bound ToolSandbox boundary rejected this operation",
          };
    response = failureResponse(failure, captured.requestId, true, keyHash, "new");
  }
  completeOperation(operations, keyHash, operationRequestHash, response, exactIsoNow());
  return response;
}

async function captureBody(
  request: IncomingMessage,
  maxRequestBytes: number,
): Promise<{ body: Buffer; complete: boolean; failure?: HttpFailure }> {
  if (request.headers["transfer-encoding"] !== undefined) {
    request.resume();
    return {
      body: Buffer.alloc(0),
      complete: false,
      failure: { status: 400, code: "transfer_encoding_rejected", message: "Transfer-Encoding is not accepted" },
    };
  }
  const rawLength = request.headers["content-length"];
  if (rawLength === undefined || !/^(0|[1-9][0-9]*)$/u.test(rawLength)) {
    request.resume();
    return {
      body: Buffer.alloc(0),
      complete: false,
      failure: { status: 411, code: "length_required", message: "a valid Content-Length is required" },
    };
  }
  const declaredLength = Number(rawLength);
  if (!Number.isSafeInteger(declaredLength) || declaredLength > maxRequestBytes) {
    request.resume();
    return {
      body: Buffer.alloc(0),
      complete: false,
      failure: { status: 413, code: "request_too_large", message: "request body exceeds the configured byte limit" },
    };
  }
  return await new Promise((accept) => {
    const chunks: Buffer[] = [];
    let observed = 0;
    let settled = false;
    const finish = (value: { body: Buffer; complete: boolean; failure?: HttpFailure }): void => {
      if (settled) return;
      settled = true;
      accept(value);
    };
    request.on("data", (chunk: Buffer) => {
      observed += chunk.byteLength;
      if (observed <= maxRequestBytes) chunks.push(chunk);
    });
    request.once("aborted", () =>
      finish({
        body: Buffer.concat(chunks),
        complete: false,
        failure: { status: 400, code: "request_aborted", message: "request body was aborted" },
      }),
    );
    request.once("error", () =>
      finish({
        body: Buffer.concat(chunks),
        complete: false,
        failure: { status: 400, code: "request_read_failed", message: "request body could not be read" },
      }),
    );
    request.once("end", () => {
      const body = Buffer.concat(chunks);
      if (observed !== declaredLength || observed > maxRequestBytes) {
        finish({
          body,
          complete: false,
          failure: { status: 400, code: "content_length_mismatch", message: "received bytes do not match Content-Length" },
        });
      } else {
        finish({ body, complete: true });
      }
    });
  });
}

function writeHttpResponse(response: ServerResponse, generated: GeneratedResponse): void {
  response.writeHead(generated.status, {
    "cache-control": "no-store",
    connection: "close",
    "content-length": String(generated.bytes.byteLength),
    "content-type": "application/json",
    "x-content-type-options": "nosniff",
    "x-pm-request-id": generated.requestId,
  });
  response.end(generated.bytes);
}

async function listen(server: Server): Promise<number> {
  return await new Promise<number>((accept, reject) => {
    const fail = (error: Error): void => reject(error);
    server.once("error", fail);
    server.listen({ host: LOOPBACK_HOST, port: 0, exclusive: true }, () => {
      server.off("error", fail);
      const address = server.address();
      if (address === null || typeof address === "string") {
        reject(new Error("sidecar did not receive an IP listener address"));
        return;
      }
      accept(address.port);
    });
  });
}

async function closeHttpServer(server: Server): Promise<void> {
  await new Promise<void>((accept, reject) => {
    server.close((error) => (error === undefined ? accept() : reject(error)));
    server.closeIdleConnections();
  });
}

/**
 * Starts one startup-bound ToolSandbox transport process. The sidecar is a
 * benchmark-periphery runtime consumer of the shared agent-state primitives;
 * callers can neither select a different attempt identity nor a state file.
 */
export async function startToolSandboxBoundarySidecar(
  input: ToolSandboxBoundarySidecarConfig,
): Promise<RunningToolSandboxBoundarySidecar> {
  const identity = validateConfig(input);
  if (
    process.env["NODE_OPTIONS"] !== undefined ||
    process.env["NODE_PATH"] !== undefined
  ) {
    throw new Error(
      "sidecar module-resolution environment must not contain NODE_OPTIONS or NODE_PATH",
    );
  }
  if (existsSync(identity.auditPath) || existsSync(identity.readyPath) || existsSync(identity.finalReceiptPath)) {
    throw new Error("sidecar evidence paths must not already exist");
  }
  const startedAt = exactIsoNow();
  const stateLock = acquireStateLock(identity, startedAt);
  let audit: AuditLedger | undefined;
  let operations: OperationLedger | undefined;
  let server: Server | undefined;
  try {
    audit = openAuditLedger(identity.auditPath);
    operations = openOperationLedger(identity.operationLedgerPath);
    const nodePath = resolve(process.execPath);
    const runtimeModuleClosure = computeToolSandboxSidecarRuntimeClosure(
      identity.entryPath,
    );
    const executableEvidence = {
      node: { path: nodePath, sha256: await sha256File(nodePath) },
      entry: { path: identity.entryPath, sha256: await sha256File(identity.entryPath) },
      runtimeModuleClosure,
    } as const;
    const configBody = {
      schemaVersion: "pm.public-eval.toolsandbox-sidecar-config.v1",
      arm: identity.arm,
      evaluationTrack: identity.evaluationTrack,
      attemptId: identity.attemptId,
      statePath: identity.statePath,
      auditPath: identity.auditPath,
      readyPath: identity.readyPath,
      finalReceiptPath: identity.finalReceiptPath,
      operationLedgerPath: identity.operationLedgerPath,
      stateLockPath: identity.stateLockPath,
      host: LOOPBACK_HOST,
      requestedPort: 0,
      maxRequestBytes: identity.maxRequestBytes,
      tokenSha256: identity.tokenSha256,
      moduleResolutionEnvironment: {
        nodeOptions: "absent",
        nodePath: "absent",
      },
      executableEvidence,
    } as const;
    const configHash = sha256Json(configBody);
    let operationQueue: Promise<void> = Promise.resolve();
    const activeAudit = audit;
    const activeOperations = operations;
    server = createServer((request, response) => {
      const capturedBase = {
        request,
        response,
        requestId: randomUUID(),
        receivedAt: exactIsoNow(),
        method: request.method ?? "",
        target: request.url ?? "",
        remoteAddress: request.socket.remoteAddress ?? null,
      } as const;
      void captureBody(request, identity.maxRequestBytes).then((body) => {
        const captured: CapturedRequest = {
          ...capturedBase,
          body: body.body,
          bodyComplete: body.complete,
          ...(body.failure === undefined ? {} : { bodyFailure: body.failure }),
        };
        const operation = operationQueue.then(() => {
          const generated = processCapturedRequest(captured, identity, input.bearerToken, activeOperations);
          appendAuditRecord(activeAudit, captured, generated, exactIsoNow());
          writeHttpResponse(response, generated);
        });
        operationQueue = operation.catch(() => {
          if (!response.headersSent) {
            const bytes = jsonResponse(500, "internal_error", "sidecar failed closed");
            response.writeHead(500, {
              connection: "close",
              "content-length": String(bytes.byteLength),
              "content-type": "application/json",
            });
            response.end(bytes);
          } else {
            response.destroy();
          }
        });
      });
    });
    server.requestTimeout = 15_000;
    server.headersTimeout = 10_000;
    server.keepAliveTimeout = 1_000;
    server.maxHeadersCount = 32;
    server.on("clientError", (_error, socket) => {
      socket.end("HTTP/1.1 400 Bad Request\r\nConnection: close\r\nContent-Length: 0\r\n\r\n");
    });
    const port = await listen(server);
    const origin = `http://${LOOPBACK_HOST}:${port}`;
    const readyBody = {
      schemaVersion: "pm.public-eval.toolsandbox-sidecar-ready.v1",
      config: configBody,
      configHash,
      server: { pid: process.pid, ppid: process.ppid, startedAt, host: LOOPBACK_HOST, port, origin },
      authentication: { scheme: "Bearer", tokenSha256: identity.tokenSha256 },
      endpoints: [ADMIT_PATH, OUTCOME_PATH],
      durability: {
        stateFileFsyncAfterMutation: true,
        stateDirectoryFsyncAfterMutation: true,
        auditAppendFsync: true,
        operationPrepareAndCompletionFsync: true,
        receiptFileAndDirectoryFsync: true,
        exclusiveStateLock: true,
      },
      audit: { path: identity.auditPath, genesisHash: GENESIS_HASH },
      operationLedger: {
        path: identity.operationLedgerPath,
        initialSequence: activeOperations.sequence,
        initialHeadHash: activeOperations.headHash,
      },
      stateLock: { path: stateLock.path, lockHash: stateLock.lockHash },
    } as const;
    const readyReceipt = { ...readyBody, readyHash: sha256Json(readyBody) };
    atomicWriteExclusive(identity.readyPath, readyReceipt);

    let closePromise: Promise<Readonly<Record<string, unknown>>> | undefined;
    const close = (reason: string): Promise<Readonly<Record<string, unknown>>> => {
      closePromise ??= (async () => {
        assertId(reason.replace(/^SIG/u, "signal-"), "shutdown reason");
        const initiatedAt = exactIsoNow();
        await closeHttpServer(server as Server);
        await operationQueue;
        closeSync(activeAudit.descriptor);
        closeSync(activeOperations.descriptor);
        releaseStateLock(stateLock);
        const auditStat = statSync(identity.auditPath);
        const operationStat = statSync(identity.operationLedgerPath);
        const completedAt = exactIsoNow();
        const finalBody = {
          schemaVersion: "pm.public-eval.toolsandbox-sidecar-final.v1",
          configHash,
          readyHash: readyReceipt.readyHash,
          server: { pid: process.pid, ppid: process.ppid, startedAt, origin },
          shutdown: { reason, initiatedAt, completedAt },
          audit: {
            path: identity.auditPath,
            recordCount: activeAudit.sequence,
            headHash: activeAudit.headHash,
            byteLength: auditStat.size,
            sha256: await sha256File(identity.auditPath),
          },
          operationLedger: {
            path: identity.operationLedgerPath,
            sequence: activeOperations.sequence,
            headHash: activeOperations.headHash,
            byteLength: operationStat.size,
            sha256: await sha256File(identity.operationLedgerPath),
          },
          stateLock: { path: stateLock.path, lockHash: stateLock.lockHash, released: true },
        } as const;
        const finalReceipt = { ...finalBody, finalHash: sha256Json(finalBody) };
        atomicWriteExclusive(identity.finalReceiptPath, finalReceipt);
        return finalReceipt;
      })();
      return closePromise;
    };
    return { origin, port, readyReceipt, close };
  } catch (error) {
    if (server?.listening === true) {
      server.closeAllConnections();
      try {
        await closeHttpServer(server);
      } catch {
        // Preserve the primary startup error.
      }
    }
    if (audit !== undefined) closeSync(audit.descriptor);
    if (operations !== undefined) closeSync(operations.descriptor);
    try {
      releaseStateLock(stateLock);
    } catch {
      // Preserve the primary startup error; a retained lock fails future starts closed.
    }
    throw error;
  }
}
