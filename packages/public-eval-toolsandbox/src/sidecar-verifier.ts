import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { TextDecoder } from "node:util";

import type {
  ToolSandboxBoundaryArm,
  ToolSandboxEvaluationTrack,
} from "./index.js";
import {
  verifyToolSandboxSidecarRuntimeClosure,
  type ToolSandboxSidecarRuntimeClosure,
} from "./runtime-closure.js";

const GENESIS_HASH = "0".repeat(64);
const SHA256 = /^[a-f0-9]{64}$/u;
const UTF8 = new TextDecoder("utf-8", { fatal: true });
const ADMIT_PATH = "/v1/admit-tool";
const OUTCOME_PATH = "/v1/record-tool-outcome";

type JsonRecord = Record<string, unknown>;

/**
 * Trusted launch facts and retained raw bytes needed to replay a ToolSandbox
 * HTTP-sidecar exchange. Deliberately absent: any producer-authored
 * `...Verified` boolean.
 */
export interface ToolSandboxSidecarVerificationInput {
  readonly arm: ToolSandboxBoundaryArm;
  readonly evaluationTrack: ToolSandboxEvaluationTrack;
  readonly attemptId: string;
  readonly statePath: string;
  readonly auditPath: string;
  readonly readyPath: string;
  readonly finalReceiptPath: string;
  readonly operationLedgerPath: string;
  readonly stateLockPath: string;
  readonly expectedPid: number;
  readonly expectedPpid: number;
  readonly expectedNodePath: string;
  readonly expectedNodeSha256: string;
  readonly expectedEntryPath: string;
  readonly expectedEntrySha256: string;
  readonly expectedRuntimeModuleClosure: ToolSandboxSidecarRuntimeClosure;
  readonly expectedTokenSha256: string;
  readonly readyBytes: Uint8Array;
  readonly finalReceiptBytes: Uint8Array;
  readonly auditBytes: Uint8Array;
  readonly operationLedgerBytes: Uint8Array;
  readonly clientTraceBytes: Uint8Array;
}

export interface ToolSandboxSidecarVerification {
  readonly readyHash: string;
  readonly finalHash: string;
  readonly configHash: string;
  readonly auditSha256: string;
  readonly auditHeadHash: string;
  readonly auditRecordCount: number;
  readonly operationLedgerSha256: string;
  readonly operationHeadHash: string;
  readonly operationRecordCount: number;
  readonly clientTraceSha256: string;
  readonly clientTraceHeadHash: string;
  readonly clientTraceRecordCount: number;
  readonly runtimeModuleClosureHash: string;
  readonly runtimeModuleCount: number;
  readonly realAuthenticatedHttpSidecarProtocolVerified: true;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function record(value: unknown, path: string): JsonRecord {
  if (!isRecord(value)) throw new Error(`${path} must be an object`);
  return value;
}

function exactKeys(value: JsonRecord, expected: readonly string[], path: string): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    throw new Error(`${path} has missing or unexpected fields`);
  }
}

function text(value: unknown, path: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${path} must be a non-empty string`);
  }
  return value;
}

function sha(value: unknown, path: string): string {
  const parsed = text(value, path);
  if (!SHA256.test(parsed)) throw new Error(`${path} must be SHA-256`);
  return parsed;
}

function integer(value: unknown, path: string, minimum = 0): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum) {
    throw new Error(`${path} must be an integer >= ${minimum}`);
  }
  return value as number;
}

function canonicalStringify(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("cannot hash non-finite JSON");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalStringify).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.entries(value)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, child]) => `${JSON.stringify(key)}:${canonicalStringify(child)}`)
      .join(",")}}`;
  }
  throw new Error(`cannot hash unsupported JSON value ${typeof value}`);
}

function sha256Bytes(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function sha256Json(value: unknown): string {
  return sha256Bytes(canonicalStringify(value));
}

function decodeUtf8(value: Uint8Array, path: string): string {
  try {
    return UTF8.decode(value);
  } catch {
    throw new Error(`${path} is not valid UTF-8`);
  }
}

function parseJsonBytes(value: Uint8Array, path: string): JsonRecord {
  let parsed: unknown;
  try {
    parsed = JSON.parse(decodeUtf8(value, path)) as unknown;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith(path)) throw error;
    throw new Error(`${path} is not valid JSON`);
  }
  return record(parsed, path);
}

function parseJsonLines(value: Uint8Array, path: string): readonly JsonRecord[] {
  if (value.byteLength === 0) return [];
  const decoded = decodeUtf8(value, path);
  if (!decoded.endsWith("\n")) throw new Error(`${path} must end with a newline`);
  const lines = decoded.slice(0, -1).split("\n");
  if (lines.some((line) => line.length === 0)) {
    throw new Error(`${path} contains an empty record`);
  }
  return lines.map((line, index) => {
    try {
      return record(JSON.parse(line) as unknown, `${path}/${index}`);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith(`${path}/${index}`)) {
        throw error;
      }
      throw new Error(`${path}/${index} is not valid JSON`);
    }
  });
}

function bytesFromBase64(value: unknown, path: string): Buffer {
  if (typeof value !== "string") throw new Error(`${path} must be base64 text`);
  if (
    value.length % 4 !== 0 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(value)
  ) {
    throw new Error(`${path} must be canonical base64`);
  }
  const bytes = Buffer.from(value, "base64");
  if (bytes.toString("base64") !== value) throw new Error(`${path} must be canonical base64`);
  return bytes;
}

function normalizedTimestamp(value: unknown, path: string): string {
  const parsed = text(value, path);
  const epoch = Date.parse(parsed);
  if (!Number.isFinite(epoch) || new Date(epoch).toISOString() !== parsed) {
    throw new Error(`${path} must be normalized ISO-8601`);
  }
  return parsed;
}

function normalizedAbsolutePath(value: string, path: string): void {
  if (!isAbsolute(value) || resolve(value) !== value || value.includes("\0")) {
    throw new Error(`${path} must be an absolute normalized path`);
  }
}

function sameJson(left: unknown, right: unknown): boolean {
  return canonicalStringify(left) === canonicalStringify(right);
}

interface ReadyReplay {
  readonly value: JsonRecord;
  readonly readyHash: string;
  readonly configHash: string;
  readonly origin: string;
  readonly startedAt: string;
  readonly lockHash: string;
  readonly runtimeModuleClosure: ToolSandboxSidecarRuntimeClosure;
}

function replayReady(
  input: ToolSandboxSidecarVerificationInput,
): ReadyReplay {
  const value = parseJsonBytes(input.readyBytes, "/sidecarReady");
  exactKeys(
    value,
    [
      "schemaVersion",
      "config",
      "configHash",
      "server",
      "authentication",
      "endpoints",
      "durability",
      "audit",
      "operationLedger",
      "stateLock",
      "readyHash",
    ],
    "/sidecarReady",
  );
  if (value["schemaVersion"] !== "pm.public-eval.toolsandbox-sidecar-ready.v1") {
    throw new Error("sidecar ready schema is invalid");
  }
  const readyHash = sha(value["readyHash"], "/sidecarReady/readyHash");
  const { readyHash: _ignoredReadyHash, ...readyBody } = value;
  if (sha256Json(readyBody) !== readyHash) {
    throw new Error("sidecar ready hash does not recompute");
  }

  const config = record(value["config"], "/sidecarReady/config");
  exactKeys(
    config,
    [
      "schemaVersion",
      "arm",
      "evaluationTrack",
      "attemptId",
      "statePath",
      "auditPath",
      "readyPath",
      "finalReceiptPath",
      "operationLedgerPath",
      "stateLockPath",
      "host",
      "requestedPort",
      "maxRequestBytes",
      "tokenSha256",
      "moduleResolutionEnvironment",
      "executableEvidence",
    ],
    "/sidecarReady/config",
  );
  if (config["schemaVersion"] !== "pm.public-eval.toolsandbox-sidecar-config.v1") {
    throw new Error("sidecar config schema is invalid");
  }
  const configHash = sha(value["configHash"], "/sidecarReady/configHash");
  if (sha256Json(config) !== configHash) {
    throw new Error("sidecar config hash does not recompute");
  }
  if (
    config["arm"] !== input.arm ||
    config["evaluationTrack"] !== input.evaluationTrack ||
    config["attemptId"] !== input.attemptId ||
    config["statePath"] !== input.statePath ||
    config["auditPath"] !== input.auditPath ||
    config["readyPath"] !== input.readyPath ||
    config["finalReceiptPath"] !== input.finalReceiptPath ||
    config["operationLedgerPath"] !== input.operationLedgerPath ||
    config["stateLockPath"] !== input.stateLockPath ||
    config["host"] !== "127.0.0.1" ||
    config["requestedPort"] !== 0 ||
    config["maxRequestBytes"] !== 64 * 1024 ||
    config["tokenSha256"] !== input.expectedTokenSha256
  ) {
    throw new Error("sidecar config does not bind the trusted launch identity");
  }

  const moduleResolutionEnvironment = record(
    config["moduleResolutionEnvironment"],
    "/sidecarReady/config/moduleResolutionEnvironment",
  );
  exactKeys(
    moduleResolutionEnvironment,
    ["nodeOptions", "nodePath"],
    "/sidecarReady/config/moduleResolutionEnvironment",
  );
  if (
    moduleResolutionEnvironment["nodeOptions"] !== "absent" ||
    moduleResolutionEnvironment["nodePath"] !== "absent"
  ) {
    throw new Error("sidecar module-resolution environment was not sanitized");
  }

  const executableEvidence = record(
    config["executableEvidence"],
    "/sidecarReady/config/executableEvidence",
  );
  exactKeys(
    executableEvidence,
    ["node", "entry", "runtimeModuleClosure"],
    "/sidecarReady/config/executableEvidence",
  );
  const node = record(executableEvidence["node"], "/sidecarReady/config/executableEvidence/node");
  const entry = record(executableEvidence["entry"], "/sidecarReady/config/executableEvidence/entry");
  exactKeys(node, ["path", "sha256"], "/sidecarReady/config/executableEvidence/node");
  exactKeys(entry, ["path", "sha256"], "/sidecarReady/config/executableEvidence/entry");
  if (
    node["path"] !== input.expectedNodePath ||
    node["sha256"] !== input.expectedNodeSha256 ||
    entry["path"] !== input.expectedEntryPath ||
    entry["sha256"] !== input.expectedEntrySha256
  ) {
    throw new Error("sidecar executable evidence does not match trusted runtime hashes");
  }
  const expectedRuntimeModuleClosure =
    verifyToolSandboxSidecarRuntimeClosure(input.expectedRuntimeModuleClosure);
  const runtimeModuleClosure = verifyToolSandboxSidecarRuntimeClosure(
    executableEvidence["runtimeModuleClosure"],
  );
  if (!sameJson(runtimeModuleClosure, expectedRuntimeModuleClosure)) {
    throw new Error(
      "sidecar runtime module closure does not match the trusted launch inventory",
    );
  }

  const server = record(value["server"], "/sidecarReady/server");
  exactKeys(server, ["pid", "ppid", "startedAt", "host", "port", "origin"], "/sidecarReady/server");
  const port = integer(server["port"], "/sidecarReady/server/port", 1);
  if (port > 65_535) throw new Error("sidecar loopback port is invalid");
  const origin = `http://127.0.0.1:${String(port)}`;
  const startedAt = normalizedTimestamp(server["startedAt"], "/sidecarReady/server/startedAt");
  if (
    server["pid"] !== input.expectedPid ||
    server["ppid"] !== input.expectedPpid ||
    server["host"] !== "127.0.0.1" ||
    server["origin"] !== origin
  ) {
    throw new Error("sidecar server does not bind the expected loopback process identity");
  }

  const authentication = record(value["authentication"], "/sidecarReady/authentication");
  exactKeys(authentication, ["scheme", "tokenSha256"], "/sidecarReady/authentication");
  if (
    authentication["scheme"] !== "Bearer" ||
    authentication["tokenSha256"] !== input.expectedTokenSha256
  ) {
    throw new Error("sidecar authentication does not bind the launch token hash");
  }

  if (!sameJson(value["endpoints"], [ADMIT_PATH, OUTCOME_PATH])) {
    throw new Error("sidecar endpoints are not the fixed ToolSandbox boundary endpoints");
  }
  const durability = record(value["durability"], "/sidecarReady/durability");
  exactKeys(
    durability,
    [
      "stateFileFsyncAfterMutation",
      "stateDirectoryFsyncAfterMutation",
      "auditAppendFsync",
      "operationPrepareAndCompletionFsync",
      "receiptFileAndDirectoryFsync",
      "exclusiveStateLock",
    ],
    "/sidecarReady/durability",
  );
  if (Object.values(durability).some((claim) => claim !== true)) {
    throw new Error("sidecar durability contract is incomplete");
  }

  const audit = record(value["audit"], "/sidecarReady/audit");
  exactKeys(audit, ["path", "genesisHash"], "/sidecarReady/audit");
  const operations = record(value["operationLedger"], "/sidecarReady/operationLedger");
  exactKeys(
    operations,
    ["path", "initialSequence", "initialHeadHash"],
    "/sidecarReady/operationLedger",
  );
  if (
    audit["path"] !== input.auditPath ||
    audit["genesisHash"] !== GENESIS_HASH ||
    operations["path"] !== input.operationLedgerPath ||
    operations["initialSequence"] !== 0 ||
    operations["initialHeadHash"] !== GENESIS_HASH
  ) {
    throw new Error("sidecar ready receipt does not start clean evidence ledgers");
  }

  const stateLock = record(value["stateLock"], "/sidecarReady/stateLock");
  exactKeys(stateLock, ["path", "lockHash"], "/sidecarReady/stateLock");
  const lockHash = sha(stateLock["lockHash"], "/sidecarReady/stateLock/lockHash");
  if (stateLock["path"] !== input.stateLockPath) {
    throw new Error("sidecar state lock does not bind the expected path");
  }
  return {
    value,
    readyHash,
    configHash,
    origin,
    startedAt,
    lockHash,
    runtimeModuleClosure,
  };
}

interface AuditReplayRecord {
  readonly value: JsonRecord;
  readonly request: JsonRecord;
  readonly generatedResponse: JsonRecord;
  readonly requestBytes: Buffer;
  readonly responseBytes: Buffer;
  readonly operationKeySha256: string;
  readonly receivedAt: string;
  readonly completedAt: string;
  readonly recordHash: string;
}

function replayAudit(
  input: ToolSandboxSidecarVerificationInput,
): readonly AuditReplayRecord[] {
  const values = parseJsonLines(input.auditBytes, "/sidecarAudit");
  let headHash = GENESIS_HASH;
  let previousCompletedAt = "";
  return values.map((value, index) => {
    const path = `/sidecarAudit/${index}`;
    exactKeys(
      value,
      [
        "schemaVersion",
        "sequence",
        "previousRecordHash",
        "requestId",
        "pid",
        "receivedAt",
        "completedAt",
        "request",
        "generatedResponse",
        "recordHash",
      ],
      path,
    );
    if (
      value["schemaVersion"] !== "pm.public-eval.toolsandbox-sidecar-audit.v1" ||
      value["sequence"] !== index + 1 ||
      value["previousRecordHash"] !== headHash ||
      value["pid"] !== input.expectedPid
    ) {
      throw new Error("sidecar audit identity/hash chain is invalid");
    }
    const receivedAt = normalizedTimestamp(value["receivedAt"], `${path}/receivedAt`);
    const completedAt = normalizedTimestamp(value["completedAt"], `${path}/completedAt`);
    if (receivedAt > completedAt || (previousCompletedAt !== "" && receivedAt < previousCompletedAt)) {
      throw new Error("sidecar audit timestamps are reordered");
    }
    const requestId = text(value["requestId"], `${path}/requestId`);
    const request = record(value["request"], `${path}/request`);
    exactKeys(
      request,
      [
        "method",
        "target",
        "remoteAddress",
        "bodyComplete",
        "bodyByteLength",
        "bodyBytesBase64",
        "bodySha256",
        "authenticated",
        "operationKeySha256",
        "idempotencyDisposition",
      ],
      `${path}/request`,
    );
    const requestBytes = bytesFromBase64(request["bodyBytesBase64"], `${path}/request/bodyBytesBase64`);
    const operationKeySha256 = sha(request["operationKeySha256"], `${path}/request/operationKeySha256`);
    if (
      request["method"] !== "POST" ||
      (request["target"] !== ADMIT_PATH && request["target"] !== OUTCOME_PATH) ||
      request["remoteAddress"] !== "127.0.0.1" ||
      request["bodyComplete"] !== true ||
      request["authenticated"] !== true ||
      request["idempotencyDisposition"] !== "new" ||
      request["bodyByteLength"] !== requestBytes.byteLength ||
      request["bodySha256"] !== sha256Bytes(requestBytes)
    ) {
      throw new Error("sidecar audit request is not a complete new authenticated loopback operation");
    }

    const generatedResponse = record(value["generatedResponse"], `${path}/generatedResponse`);
    exactKeys(
      generatedResponse,
      ["status", "bodyByteLength", "bodyBytesBase64", "bodySha256", "responseRequestId"],
      `${path}/generatedResponse`,
    );
    const responseBytes = bytesFromBase64(
      generatedResponse["bodyBytesBase64"],
      `${path}/generatedResponse/bodyBytesBase64`,
    );
    if (
      generatedResponse["status"] !== 200 ||
      generatedResponse["bodyByteLength"] !== responseBytes.byteLength ||
      generatedResponse["bodySha256"] !== sha256Bytes(responseBytes) ||
      generatedResponse["responseRequestId"] !== requestId
    ) {
      throw new Error("sidecar audit response bytes/status/request ID do not verify");
    }
    parseJsonBytes(responseBytes, `${path}/generatedResponse/body`);

    const recordHash = sha(value["recordHash"], `${path}/recordHash`);
    const { recordHash: _ignoredRecordHash, ...body } = value;
    if (sha256Json(body) !== recordHash) {
      throw new Error("sidecar audit record hash does not recompute");
    }
    headHash = recordHash;
    previousCompletedAt = completedAt;
    return {
      value,
      request,
      generatedResponse,
      requestBytes,
      responseBytes,
      operationKeySha256,
      receivedAt,
      completedAt,
      recordHash,
    };
  });
}

interface OperationReplayRecord {
  readonly value: JsonRecord;
  readonly phase: "prepared" | "completed";
  readonly operationKeySha256: string;
  readonly requestHash: string;
  readonly recordedAt: string;
  readonly recordHash: string;
}

function replayOperations(
  input: ToolSandboxSidecarVerificationInput,
): readonly OperationReplayRecord[] {
  const values = parseJsonLines(input.operationLedgerBytes, "/sidecarOperations");
  let headHash = GENESIS_HASH;
  let previousTime = "";
  return values.map((value, index) => {
    const path = `/sidecarOperations/${index}`;
    const phase = value["phase"];
    if (phase !== "prepared" && phase !== "completed") {
      throw new Error(`${path}/phase is invalid`);
    }
    exactKeys(
      value,
      phase === "prepared"
        ? [
            "schemaVersion",
            "sequence",
            "previousRecordHash",
            "phase",
            "operationKeySha256",
            "requestHash",
            "preparedAt",
            "recordHash",
          ]
        : [
            "schemaVersion",
            "sequence",
            "previousRecordHash",
            "phase",
            "operationKeySha256",
            "requestHash",
            "status",
            "responseBytesBase64",
            "responseSha256",
            "responseRequestId",
            "completedAt",
            "recordHash",
          ],
      path,
    );
    if (
      value["schemaVersion"] !== "pm.public-eval.toolsandbox-sidecar-operation.v1" ||
      value["sequence"] !== index + 1 ||
      value["previousRecordHash"] !== headHash
    ) {
      throw new Error("sidecar operation hash chain is invalid");
    }
    const operationKeySha256 = sha(value["operationKeySha256"], `${path}/operationKeySha256`);
    const requestHash = sha(value["requestHash"], `${path}/requestHash`);
    const recordedAt = normalizedTimestamp(
      value[phase === "prepared" ? "preparedAt" : "completedAt"],
      `${path}/${phase === "prepared" ? "preparedAt" : "completedAt"}`,
    );
    if (previousTime !== "" && recordedAt < previousTime) {
      throw new Error("sidecar operation timestamps move backwards");
    }
    if (phase === "completed") {
      const responseBytes = bytesFromBase64(value["responseBytesBase64"], `${path}/responseBytesBase64`);
      if (
        value["status"] !== 200 ||
        value["responseSha256"] !== sha256Bytes(responseBytes) ||
        typeof value["responseRequestId"] !== "string" ||
        value["responseRequestId"].length === 0
      ) {
        throw new Error("sidecar operation completion response does not verify");
      }
    }
    const recordHash = sha(value["recordHash"], `${path}/recordHash`);
    const { recordHash: _ignoredRecordHash, ...body } = value;
    if (sha256Json(body) !== recordHash) {
      throw new Error("sidecar operation record hash does not recompute");
    }
    headHash = recordHash;
    previousTime = recordedAt;
    return { value, phase, operationKeySha256, requestHash, recordedAt, recordHash };
  });
}

interface ClientReplayRecord {
  readonly value: JsonRecord;
  readonly endpoint: string;
  readonly operationKeySha256: string;
  readonly requestBytes: Buffer;
  readonly responseBytes: Buffer;
  readonly responseStatus: number;
  readonly responseRequestId: string;
  readonly entryHash: string;
}

function replayClientTrace(
  input: ToolSandboxSidecarVerificationInput,
): readonly ClientReplayRecord[] {
  const values = parseJsonLines(input.clientTraceBytes, "/sidecarClientTrace");
  let headHash = GENESIS_HASH;
  return values.map((value, index) => {
    const path = `/sidecarClientTrace/${index}`;
    exactKeys(
      value,
      [
        "schemaVersion",
        "sequence",
        "previousEntryHash",
        "command",
        "request",
        "response",
        "http",
        "entryHash",
      ],
      path,
    );
    if (
      value["schemaVersion"] !== "pm.public-eval.toolsandbox-boundary-http-client.v1" ||
      value["sequence"] !== index + 1 ||
      value["previousEntryHash"] !== headHash
    ) {
      throw new Error("sidecar client HTTP trace chain is invalid");
    }
    const expectedEndpoint =
      value["command"] === "admit-tool"
        ? ADMIT_PATH
        : value["command"] === "record-tool-outcome"
          ? OUTCOME_PATH
          : undefined;
    if (expectedEndpoint === undefined) throw new Error("sidecar client command is invalid");

    const http = record(value["http"], `${path}/http`);
    exactKeys(http, ["endpointPath", "operationKeySha256", "request", "response"], `${path}/http`);
    const operationKeySha256 = sha(http["operationKeySha256"], `${path}/http/operationKeySha256`);
    if (http["endpointPath"] !== expectedEndpoint) {
      throw new Error("sidecar client command and endpoint disagree");
    }
    const httpRequest = record(http["request"], `${path}/http/request`);
    exactKeys(httpRequest, ["bodyByteLength", "bodyBytesBase64", "bodySha256"], `${path}/http/request`);
    const requestBytes = bytesFromBase64(httpRequest["bodyBytesBase64"], `${path}/http/request/bodyBytesBase64`);
    if (
      httpRequest["bodyByteLength"] !== requestBytes.byteLength ||
      httpRequest["bodySha256"] !== sha256Bytes(requestBytes)
    ) {
      throw new Error("sidecar client request byte evidence does not verify");
    }
    const parsedRequest = parseJsonBytes(requestBytes, `${path}/http/request/body`);
    if (!sameJson(parsedRequest, value["request"])) {
      throw new Error("sidecar client request object does not match its exact bytes");
    }
    validateBoundRequest(parsedRequest, expectedEndpoint, input, `${path}/request`);

    const httpResponse = record(http["response"], `${path}/http/response`);
    exactKeys(
      httpResponse,
      ["status", "contentType", "requestId", "bodyByteLength", "bodyBytesBase64", "bodySha256"],
      `${path}/http/response`,
    );
    const responseBytes = bytesFromBase64(httpResponse["bodyBytesBase64"], `${path}/http/response/bodyBytesBase64`);
    const responseStatus = integer(httpResponse["status"], `${path}/http/response/status`, 100);
    const responseRequestId = text(httpResponse["requestId"], `${path}/http/response/requestId`);
    if (
      responseStatus !== 200 ||
      httpResponse["contentType"] !== "application/json" ||
      httpResponse["bodyByteLength"] !== responseBytes.byteLength ||
      httpResponse["bodySha256"] !== sha256Bytes(responseBytes)
    ) {
      throw new Error("sidecar client HTTP response metadata/bytes do not verify");
    }
    const parsedResponse = parseJsonBytes(responseBytes, `${path}/http/response/body`);
    if (!sameJson(parsedResponse, value["response"])) {
      throw new Error("sidecar client response object does not match its exact bytes");
    }
    const entryHash = sha(value["entryHash"], `${path}/entryHash`);
    const { entryHash: _ignoredEntryHash, ...body } = value;
    if (sha256Json(body) !== entryHash) {
      throw new Error("sidecar client HTTP trace hash does not recompute");
    }
    headHash = entryHash;
    return {
      value,
      endpoint: expectedEndpoint,
      operationKeySha256,
      requestBytes,
      responseBytes,
      responseStatus,
      responseRequestId,
      entryHash,
    };
  });
}

function validateBoundRequest(
  request: JsonRecord,
  endpoint: string,
  input: ToolSandboxSidecarVerificationInput,
  path: string,
): void {
  exactKeys(
    request,
    endpoint === ADMIT_PATH
      ? [
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
        ]
      : [
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
        ],
    path,
  );
  const expectedSchema =
    endpoint === ADMIT_PATH
      ? "pm.public-eval.toolsandbox-tool-proposal.v1"
      : "pm.public-eval.toolsandbox-tool-outcome.v1";
  if (
    request["schemaVersion"] !== expectedSchema ||
    request["arm"] !== input.arm ||
    request["evaluationTrack"] !== input.evaluationTrack ||
    request["attemptId"] !== input.attemptId ||
    request["statePath"] !== input.statePath
  ) {
    throw new Error("sidecar client request is not bound to the startup attempt identity");
  }
  record(request["arguments"], `${path}/arguments`);
  normalizedTimestamp(
    request[endpoint === ADMIT_PATH ? "proposedAt" : "observedAt"],
    `${path}/${endpoint === ADMIT_PATH ? "proposedAt" : "observedAt"}`,
  );
}

function crossReplay(
  audits: readonly AuditReplayRecord[],
  operations: readonly OperationReplayRecord[],
  clients: readonly ClientReplayRecord[],
): void {
  if (audits.length !== clients.length || operations.length !== clients.length * 2) {
    throw new Error("sidecar server/client/operation evidence has missing or extra records");
  }
  for (const [index, client] of clients.entries()) {
    const audit = audits[index]!;
    const prepared = operations[index * 2]!;
    const completed = operations[index * 2 + 1]!;
    if (
      audit.request["target"] !== client.endpoint ||
      audit.operationKeySha256 !== client.operationKeySha256 ||
      !audit.requestBytes.equals(client.requestBytes) ||
      audit.generatedResponse["status"] !== client.responseStatus ||
      audit.generatedResponse["responseRequestId"] !== client.responseRequestId ||
      !audit.responseBytes.equals(client.responseBytes)
    ) {
      throw new Error("sidecar client HTTP bytes/metadata do not pair with server audit");
    }
    const requestHash = sha256Json({
      method: "POST",
      target: client.endpoint,
      bodyBytesBase64: client.requestBytes.toString("base64"),
    });
    if (
      prepared.phase !== "prepared" ||
      completed.phase !== "completed" ||
      prepared.operationKeySha256 !== client.operationKeySha256 ||
      completed.operationKeySha256 !== client.operationKeySha256 ||
      prepared.requestHash !== requestHash ||
      completed.requestHash !== requestHash ||
      prepared.recordedAt < audit.receivedAt ||
      completed.recordedAt < prepared.recordedAt ||
      completed.recordedAt > audit.completedAt ||
      completed.value["status"] !== client.responseStatus ||
      completed.value["responseRequestId"] !== client.responseRequestId ||
      completed.value["responseBytesBase64"] !== client.responseBytes.toString("base64") ||
      completed.value["responseSha256"] !== sha256Bytes(client.responseBytes)
    ) {
      throw new Error("sidecar operation prepare/completion does not pair with its HTTP exchange");
    }
  }
}

function replayFinal(
  input: ToolSandboxSidecarVerificationInput,
  ready: ReadyReplay,
  audits: readonly AuditReplayRecord[],
  operations: readonly OperationReplayRecord[],
): string {
  const value = parseJsonBytes(input.finalReceiptBytes, "/sidecarFinal");
  exactKeys(
    value,
    [
      "schemaVersion",
      "configHash",
      "readyHash",
      "server",
      "shutdown",
      "audit",
      "operationLedger",
      "stateLock",
      "finalHash",
    ],
    "/sidecarFinal",
  );
  if (value["schemaVersion"] !== "pm.public-eval.toolsandbox-sidecar-final.v1") {
    throw new Error("sidecar final schema is invalid");
  }
  const finalHash = sha(value["finalHash"], "/sidecarFinal/finalHash");
  const { finalHash: _ignoredFinalHash, ...body } = value;
  if (sha256Json(body) !== finalHash) throw new Error("sidecar final hash does not recompute");
  if (value["configHash"] !== ready.configHash || value["readyHash"] !== ready.readyHash) {
    throw new Error("sidecar final receipt does not bind ready/config hashes");
  }

  const server = record(value["server"], "/sidecarFinal/server");
  exactKeys(server, ["pid", "ppid", "startedAt", "origin"], "/sidecarFinal/server");
  if (
    server["pid"] !== input.expectedPid ||
    server["ppid"] !== input.expectedPpid ||
    server["startedAt"] !== ready.startedAt ||
    server["origin"] !== ready.origin
  ) {
    throw new Error("sidecar final server identity does not match startup");
  }

  const shutdown = record(value["shutdown"], "/sidecarFinal/shutdown");
  exactKeys(shutdown, ["reason", "initiatedAt", "completedAt"], "/sidecarFinal/shutdown");
  const initiatedAt = normalizedTimestamp(shutdown["initiatedAt"], "/sidecarFinal/shutdown/initiatedAt");
  const completedAt = normalizedTimestamp(shutdown["completedAt"], "/sidecarFinal/shutdown/completedAt");
  if (shutdown["reason"] !== "SIGTERM" || initiatedAt < ready.startedAt || completedAt < initiatedAt) {
    throw new Error("sidecar shutdown receipt is invalid or reordered");
  }

  const audit = record(value["audit"], "/sidecarFinal/audit");
  exactKeys(audit, ["path", "recordCount", "headHash", "byteLength", "sha256"], "/sidecarFinal/audit");
  const auditHead = audits.at(-1)?.recordHash ?? GENESIS_HASH;
  if (
    audit["path"] !== input.auditPath ||
    audit["recordCount"] !== audits.length ||
    audit["headHash"] !== auditHead ||
    audit["byteLength"] !== input.auditBytes.byteLength ||
    audit["sha256"] !== sha256Bytes(input.auditBytes)
  ) {
    throw new Error("sidecar final receipt does not bind replayed audit bytes");
  }

  const operationLedger = record(value["operationLedger"], "/sidecarFinal/operationLedger");
  exactKeys(
    operationLedger,
    ["path", "sequence", "headHash", "byteLength", "sha256"],
    "/sidecarFinal/operationLedger",
  );
  const operationHead = operations.at(-1)?.recordHash ?? GENESIS_HASH;
  if (
    operationLedger["path"] !== input.operationLedgerPath ||
    operationLedger["sequence"] !== operations.length ||
    operationLedger["headHash"] !== operationHead ||
    operationLedger["byteLength"] !== input.operationLedgerBytes.byteLength ||
    operationLedger["sha256"] !== sha256Bytes(input.operationLedgerBytes)
  ) {
    throw new Error("sidecar final receipt does not bind replayed operation bytes");
  }

  const stateLock = record(value["stateLock"], "/sidecarFinal/stateLock");
  exactKeys(stateLock, ["path", "lockHash", "released"], "/sidecarFinal/stateLock");
  if (
    stateLock["path"] !== input.stateLockPath ||
    stateLock["lockHash"] !== ready.lockHash ||
    stateLock["released"] !== true ||
    existsSync(input.stateLockPath)
  ) {
    throw new Error("sidecar state lock was not independently observed released");
  }
  return finalHash;
}

/**
 * Independently replays retained transport evidence. The success boolean is
 * synthesized only after every raw hash chain and server/client/operation
 * cross-pair has passed; producer-authored proof booleans are rejected.
 */
export function verifyToolSandboxSidecarEvidence(
  input: ToolSandboxSidecarVerificationInput,
): ToolSandboxSidecarVerification {
  exactKeys(
    input as unknown as JsonRecord,
    [
      "arm",
      "evaluationTrack",
      "attemptId",
      "statePath",
      "auditPath",
      "readyPath",
      "finalReceiptPath",
      "operationLedgerPath",
      "stateLockPath",
      "expectedPid",
      "expectedPpid",
      "expectedNodePath",
      "expectedNodeSha256",
      "expectedEntryPath",
      "expectedEntrySha256",
      "expectedRuntimeModuleClosure",
      "expectedTokenSha256",
      "readyBytes",
      "finalReceiptBytes",
      "auditBytes",
      "operationLedgerBytes",
      "clientTraceBytes",
    ],
    "/sidecarVerificationInput",
  );
  if (input.arm !== "sham" && input.arm !== "substrate") {
    throw new Error("sidecar verification arm must be sham or substrate");
  }
  if (
    input.evaluationTrack !== "official_headline" &&
    input.evaluationTrack !== "restart_lost_response_derivative"
  ) {
    throw new Error("sidecar verification track is invalid");
  }
  text(input.attemptId, "/attemptId");
  integer(input.expectedPid, "/expectedPid", 1);
  integer(input.expectedPpid, "/expectedPpid", 1);
  for (const [pathValue, path] of [
    [input.statePath, "/statePath"],
    [input.auditPath, "/auditPath"],
    [input.readyPath, "/readyPath"],
    [input.finalReceiptPath, "/finalReceiptPath"],
    [input.operationLedgerPath, "/operationLedgerPath"],
    [input.stateLockPath, "/stateLockPath"],
    [input.expectedNodePath, "/expectedNodePath"],
    [input.expectedEntryPath, "/expectedEntryPath"],
  ] as const) {
    normalizedAbsolutePath(pathValue, path);
  }
  if (
    input.operationLedgerPath !== `${input.statePath}.sidecar-operations.jsonl` ||
    input.stateLockPath !== `${input.statePath}.sidecar.lock`
  ) {
    throw new Error("sidecar operation/lock paths are not derived from the state path");
  }
  if (
    new Set([
      input.statePath,
      input.auditPath,
      input.readyPath,
      input.finalReceiptPath,
      input.operationLedgerPath,
      input.stateLockPath,
    ]).size !== 6
  ) {
    throw new Error("sidecar state and evidence paths must be distinct");
  }
  sha(input.expectedNodeSha256, "/expectedNodeSha256");
  sha(input.expectedEntrySha256, "/expectedEntrySha256");
  sha(input.expectedTokenSha256, "/expectedTokenSha256");

  const ready = replayReady(input);
  const audits = replayAudit(input);
  const operations = replayOperations(input);
  const clients = replayClientTrace(input);
  crossReplay(audits, operations, clients);
  const finalHash = replayFinal(input, ready, audits, operations);
  return {
    readyHash: ready.readyHash,
    finalHash,
    configHash: ready.configHash,
    auditSha256: sha256Bytes(input.auditBytes),
    auditHeadHash: audits.at(-1)?.recordHash ?? GENESIS_HASH,
    auditRecordCount: audits.length,
    operationLedgerSha256: sha256Bytes(input.operationLedgerBytes),
    operationHeadHash: operations.at(-1)?.recordHash ?? GENESIS_HASH,
    operationRecordCount: operations.length,
    clientTraceSha256: sha256Bytes(input.clientTraceBytes),
    clientTraceHeadHash: clients.at(-1)?.entryHash ?? GENESIS_HASH,
    clientTraceRecordCount: clients.length,
    runtimeModuleClosureHash: ready.runtimeModuleClosure.closureHash,
    runtimeModuleCount: ready.runtimeModuleClosure.moduleCount,
    realAuthenticatedHttpSidecarProtocolVerified: true,
  };
}
