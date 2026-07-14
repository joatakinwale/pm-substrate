import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import { relative, resolve } from "node:path";

const LOOPBACK_HOST = "127.0.0.1";
const OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";
const PINNED_MODEL = "gpt-4o-2024-11-20";
const ENDPOINT_PATH = "/v1/decide";
const MAX_OBSERVATION_BYTES = 8 * 1024 * 1024;
const MAX_AGENT_BODY_BYTES = 12 * 1024 * 1024;
const MAX_PROVIDER_RESPONSE_BYTES = 4 * 1024 * 1024;
const MAX_TASK_PROMPT_CHARS = 32_768;
const STATE_CONTEXT_WIDTH = 512;
const MAX_REASON_CHARS = 4_096;
const MAX_STATE_WRITE_CHARS = 65_536;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const OPERATION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/u;
const STAR_COUNT_PATTERN = /^(?:0|[1-9][0-9]{0,8})$/u;
const SAFE_FIXED_CONTEXT_PATTERN = /^[\x20-\x7e]{512}$/u;
const RETAINED_BASELINE_PATTERN = /^memory_key=microhub\.star-count; observed_at=(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z); browser_observation=(0|[1-9][0-9]{0,8})$/u;
const ARM_CONTEXT_PATTERN = /\b(?:arm|mode|native|sham|substrate|treatment)\b|agentStateTreatment|boundaryProvider/iu;

const SYSTEM_PROMPT = [
  "You are the stateless decision boundary for one SentinelBench browser poll.",
  "Use only the current task, supplied state context, and current screenshot.",
  "For a relative plus-200 task, if the state context has no relevant prior baseline, choose wait and write the current visible count as the baseline.",
  "If a relative-task baseline is present, choose contact if and only if the current visible count is at least the retained baseline plus 200.",
  "Never substitute the current count for a missing baseline to manufacture a trigger, and never replace a retained baseline before applying the trigger.",
  "For absolute and no-op tasks, apply only the threshold or condition in the task prompt rather than the relative-task rule.",
  "For every task, choose contact only when its real trigger is satisfied; otherwise choose wait.",
  "Read the current visible star count from the screenshot and always write that count as a canonical nonnegative decimal with at most nine digits, independent of whether the action is wait or contact.",
  "The state context is exactly 512 printable ASCII characters and right-space-padded; use its non-padding prefix only as prior durable task state.",
  "Never mention experimental metadata or execution-path identity.",
  "Return only the required structured response.",
].join(" ");

const ACTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    action: { type: "string", enum: ["wait", "contact"] },
    stateWrite: { type: "string", pattern: "^(?:0|[1-9][0-9]{0,8})$" },
    reason: { type: "string" },
  },
  required: ["action", "stateWrite", "reason"],
} as const;

type JsonRecord = Record<string, unknown>;

interface AgentPollRequest {
  readonly schemaVersion: "pm.public-eval-corners.sentinel-provider-request.v1";
  readonly operationId: string;
  readonly taskPrompt: string;
  readonly observation: {
    readonly sha256: string;
    readonly mimeType: "image/png";
    readonly dataBase64: string;
  };
  readonly stateContext: string;
}

interface ModelAction {
  readonly action: "wait" | "contact";
  readonly stateWrite: string;
  readonly reason: string;
}

interface ArtifactReference {
  readonly path: string;
  readonly byteLength: number;
  readonly sha256: string;
}

interface ReadyReceipt {
  readonly schemaVersion: "pm.public-eval-corners.sentinel-provider-proxy-ready.v1";
  readonly evidenceEligible: false;
  readonly origin: string;
  readonly endpointPath: typeof ENDPOINT_PATH;
  readonly providerEndpoint: typeof OPENAI_CHAT_COMPLETIONS_URL;
  readonly pinnedModel: typeof PINNED_MODEL;
  readonly authorizationTokenSha256: string;
  readonly noAutomaticRetries: true;
  readonly statelessProviderConversation: true;
  readonly requestCaptureExcludesAuthorization: true;
  readonly auditHeadHash: null;
  readonly startedAt: string;
  readonly receiptHash: string;
}

export interface SentinelProviderProxyFinalReceipt {
  readonly schemaVersion: "pm.public-eval-corners.sentinel-provider-proxy-final.v1";
  readonly evidenceEligible: false;
  readonly readyReceiptHash: string;
  readonly acceptedOperationCount: number;
  readonly successfulOperationCount: number;
  readonly terminalFailureCount: number;
  readonly automaticRetryCount: 0;
  readonly auditRecordCount: number;
  readonly finalAuditHeadHash: string | null;
  readonly closedAt: string;
  readonly receiptHash: string;
}

export interface SentinelProviderProxy {
  readonly origin: string;
  readonly authorizationToken: string;
  readonly readyReceiptPath: string;
  readonly finalReceiptPath: string;
  close(): Promise<SentinelProviderProxyFinalReceipt>;
}

export interface StartSentinelProviderProxyInput {
  readonly outputRoot: string;
  readonly openAiApiKey: string;
  readonly authorizationToken?: string;
  readonly port?: number;
  readonly fetchImpl?: typeof fetch;
  readonly monotonicNowMs?: () => number;
  readonly wallClock?: () => Date;
  readonly clientRequestId?: () => string;
}

class RequestValidationError extends Error {
  constructor(
    readonly statusCode: 400 | 413 | 415,
    message: string,
  ) {
    super(message);
  }
}

class ProviderTerminalError extends Error {
  constructor(readonly terminalCode: string) {
    super(terminalCode);
  }
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertExactKeys(value: JsonRecord, expected: readonly string[], path: string): void {
  const actual = Object.keys(value).sort(compareCodeUnits);
  const wanted = [...expected].sort(compareCodeUnits);
  if (actual.join(",") !== wanted.join(",")) {
    throw new RequestValidationError(400, `${path} contains unknown or missing keys`);
  }
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

function crc32(bytes: Uint8Array): number {
  let crc = 0xffff_ffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ ((crc & 1) === 1 ? 0xedb8_8320 : 0);
    }
  }
  return (crc ^ 0xffff_ffff) >>> 0;
}

function structurallyValidPng(bytes: Buffer): boolean {
  if (
    bytes.byteLength < PNG_SIGNATURE.byteLength + 12 ||
    !bytes.subarray(0, PNG_SIGNATURE.byteLength).equals(PNG_SIGNATURE)
  ) {
    return false;
  }
  let offset = PNG_SIGNATURE.byteLength;
  let chunkIndex = 0;
  let sawImageData = false;
  while (offset < bytes.byteLength) {
    if (bytes.byteLength - offset < 12) return false;
    const dataLength = bytes.readUInt32BE(offset);
    const typeStart = offset + 4;
    const dataStart = typeStart + 4;
    const dataEnd = dataStart + dataLength;
    const chunkEnd = dataEnd + 4;
    if (chunkEnd > bytes.byteLength) return false;
    const typeBytes = bytes.subarray(typeStart, dataStart);
    const type = typeBytes.toString("ascii");
    if (!/^[A-Za-z]{4}$/u.test(type)) return false;
    if (bytes.readUInt32BE(dataEnd) !== crc32(bytes.subarray(typeStart, dataEnd))) {
      return false;
    }
    if (chunkIndex === 0) {
      if (type !== "IHDR" || dataLength !== 13) return false;
      const width = bytes.readUInt32BE(dataStart);
      const height = bytes.readUInt32BE(dataStart + 4);
      if (
        width === 0 ||
        height === 0 ||
        bytes[dataStart + 10] !== 0 ||
        bytes[dataStart + 11] !== 0 ||
        (bytes[dataStart + 12] !== 0 && bytes[dataStart + 12] !== 1)
      ) {
        return false;
      }
    } else if (type === "IHDR") {
      return false;
    }
    if (type === "IDAT") sawImageData = true;
    if (type === "IEND") {
      return dataLength === 0 && sawImageData && chunkEnd === bytes.byteLength;
    }
    offset = chunkEnd;
    chunkIndex += 1;
  }
  return false;
}

function hashBody<T extends JsonRecord>(body: T): T & { readonly receiptHash: string } {
  return { ...body, receiptHash: sha256(canonical(body)) };
}

function writeExclusive(path: string, bytes: string | Uint8Array): void {
  writeFileSync(path, bytes, { flag: "wx", mode: 0o600 });
}

function prepareOutputRoot(outputRoot: string): string {
  const normalized = resolve(outputRoot);
  if (existsSync(normalized)) {
    const stat = lstatSync(normalized);
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      throw new Error("provider proxy outputRoot must be a real directory");
    }
    if (readdirSync(normalized).length !== 0) {
      throw new Error("provider proxy outputRoot must be empty");
    }
  } else {
    mkdirSync(normalized, { recursive: true, mode: 0o700 });
  }
  mkdirSync(resolve(normalized, "operations"), { mode: 0o700 });
  mkdirSync(resolve(normalized, "audit"), { mode: 0o700 });
  return normalized;
}

function requiredSecret(value: string, name: string, minimumLength: number): string {
  if (
    typeof value !== "string" ||
    value.length < minimumLength ||
    value.includes("\n") ||
    value.includes("\r")
  ) {
    throw new Error(`${name} is missing or invalid`);
  }
  return value;
}

function authorized(request: IncomingMessage, expectedToken: string): boolean {
  const header = request.headers.authorization;
  if (header === undefined || Array.isArray(header)) return false;
  const expected = Buffer.from(`Bearer ${expectedToken}`);
  const supplied = Buffer.from(header);
  return supplied.byteLength === expected.byteLength && timingSafeEqual(supplied, expected);
}

function jsonResponse(
  response: ServerResponse,
  statusCode: number,
  value: JsonRecord,
): void {
  const bytes = Buffer.from(JSON.stringify(value));
  response.writeHead(statusCode, {
    "cache-control": "no-store",
    connection: "close",
    "content-length": String(bytes.byteLength),
    "content-type": "application/json",
  });
  response.end(bytes);
}

function errorResponse(
  response: ServerResponse,
  statusCode: number,
  code: "authentication_required" | "duplicate_operation" | "invalid_request" | "not_found" | "provider_failure",
  operationId?: string,
): void {
  jsonResponse(response, statusCode, {
    schemaVersion: "pm.public-eval-corners.sentinel-agent-error.v1",
    ...(operationId === undefined ? {} : { operationId }),
    error: {
      code,
      message: code === "authentication_required"
        ? "Authentication is required."
        : code === "duplicate_operation"
          ? "The operation identifier was already consumed."
          : code === "not_found"
            ? "The endpoint does not exist."
            : code === "provider_failure"
              ? "The decision provider failed closed."
              : "The request was rejected.",
    },
  });
}

async function readAgentBody(request: IncomingMessage): Promise<Buffer> {
  const declaredLength = request.headers["content-length"];
  if (
    typeof declaredLength === "string" &&
    Number.isFinite(Number(declaredLength)) &&
    Number(declaredLength) > MAX_AGENT_BODY_BYTES
  ) {
    throw new RequestValidationError(413, "agent request is too large");
  }
  const chunks: Buffer[] = [];
  let byteLength = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
    byteLength += bytes.byteLength;
    if (byteLength > MAX_AGENT_BODY_BYTES) {
      throw new RequestValidationError(413, "agent request is too large");
    }
    chunks.push(bytes);
  }
  return Buffer.concat(chunks, byteLength);
}

function parseAgentRequest(bytes: Buffer, contentType: string | undefined): AgentPollRequest {
  if (contentType !== "application/json") {
    throw new RequestValidationError(415, "content-type must be application/json");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(bytes.toString("utf8")) as unknown;
  } catch {
    throw new RequestValidationError(400, "agent request must be valid JSON");
  }
  if (!isRecord(parsed)) throw new RequestValidationError(400, "agent request must be an object");
  assertExactKeys(
    parsed,
    ["observation", "operationId", "schemaVersion", "stateContext", "taskPrompt"],
    "request",
  );
  if (parsed.schemaVersion !== "pm.public-eval-corners.sentinel-provider-request.v1") {
    throw new RequestValidationError(400, "request schemaVersion is invalid");
  }
  const operationId = parsed.operationId;
  if (
    typeof operationId !== "string" ||
    !OPERATION_ID_PATTERN.test(operationId) ||
    ARM_CONTEXT_PATTERN.test(operationId)
  ) {
    throw new RequestValidationError(400, "operationId is invalid");
  }
  const taskPrompt = parsed.taskPrompt;
  if (
    typeof taskPrompt !== "string" ||
    taskPrompt.trim() === "" ||
    taskPrompt.length > MAX_TASK_PROMPT_CHARS
  ) {
    throw new RequestValidationError(400, "taskPrompt is invalid");
  }
  const stateContext = parsed.stateContext;
  if (
    typeof stateContext !== "string" ||
    stateContext.length !== STATE_CONTEXT_WIDTH ||
    !SAFE_FIXED_CONTEXT_PATTERN.test(stateContext) ||
    stateContext.trimEnd().length === 0 ||
    !stateContext.endsWith(" ")
  ) {
    throw new RequestValidationError(400, "stateContext is invalid");
  }
  const statePrefix = stateContext.trimEnd();
  const retainedBaseline = RETAINED_BASELINE_PATTERN.exec(statePrefix);
  if (
    statePrefix !== "NO_RELEVANT_BROWSER_OBSERVATION" &&
    (retainedBaseline === null ||
      !canonicalIsoTimestamp(retainedBaseline[1]))
  ) {
    throw new RequestValidationError(400, "stateContext is not a registered fixed-width context");
  }
  if (ARM_CONTEXT_PATTERN.test(stateContext)) {
    throw new RequestValidationError(400, "stateContext is not arm opaque");
  }
  if (!isRecord(parsed.observation)) {
    throw new RequestValidationError(400, "observation must be an object");
  }
  assertExactKeys(parsed.observation, ["dataBase64", "mimeType", "sha256"], "observation");
  if (parsed.observation.mimeType !== "image/png") {
    throw new RequestValidationError(400, "observation must be a PNG");
  }
  const observationSha = parsed.observation.sha256;
  if (typeof observationSha !== "string" || !SHA256_PATTERN.test(observationSha)) {
    throw new RequestValidationError(400, "observation sha256 is invalid");
  }
  const dataBase64 = parsed.observation.dataBase64;
  if (
    typeof dataBase64 !== "string" ||
    dataBase64.length === 0 ||
    dataBase64.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]*={0,2}$/u.test(dataBase64)
  ) {
    throw new RequestValidationError(400, "observation dataBase64 is invalid");
  }
  const observationBytes = Buffer.from(dataBase64, "base64");
  if (observationBytes.toString("base64") !== dataBase64) {
    throw new RequestValidationError(400, "observation dataBase64 is not canonical");
  }
  if (observationBytes.byteLength > MAX_OBSERVATION_BYTES) {
    throw new RequestValidationError(413, "observation is too large");
  }
  if (!structurallyValidPng(observationBytes)) {
    throw new RequestValidationError(400, "observation bytes are not PNG");
  }
  if (sha256(observationBytes) !== observationSha) {
    throw new RequestValidationError(400, "observation sha256 does not match bytes");
  }
  return {
    schemaVersion: "pm.public-eval-corners.sentinel-provider-request.v1",
    operationId,
    taskPrompt,
    observation: {
      sha256: observationSha,
      mimeType: "image/png",
      dataBase64,
    },
    stateContext,
  };
}

function providerRequest(agentRequest: AgentPollRequest): JsonRecord {
  return {
    model: PINNED_MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: JSON.stringify({
              taskPrompt: agentRequest.taskPrompt,
              stateContext: agentRequest.stateContext,
            }),
          },
          {
            type: "image_url",
            image_url: {
              url: `data:image/png;base64,${agentRequest.observation.dataBase64}`,
              detail: "high",
            },
          },
        ],
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "sentinel_poll_action",
        strict: true,
        schema: ACTION_SCHEMA,
      },
    },
    temperature: 0,
    max_completion_tokens: 256,
    n: 1,
    stream: false,
    store: false,
  };
}

function nonNegativeInteger(value: unknown): boolean {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function canonicalIsoTimestamp(value: string | undefined): boolean {
  if (value === undefined) return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString() === value;
}

function parseUsage(value: unknown): JsonRecord {
  if (
    !isRecord(value) ||
    !nonNegativeInteger(value.prompt_tokens) ||
    !nonNegativeInteger(value.completion_tokens) ||
    !nonNegativeInteger(value.total_tokens)
  ) {
    throw new ProviderTerminalError("provider-usage-invalid");
  }
  return value;
}

function parseModelAction(providerResponse: unknown): {
  readonly returnedModel: string;
  readonly usage: JsonRecord;
  readonly action: ModelAction;
} {
  if (!isRecord(providerResponse)) {
    throw new ProviderTerminalError("provider-response-invalid");
  }
  const returnedModel = providerResponse.model;
  if (typeof returnedModel !== "string") {
    throw new ProviderTerminalError("provider-response-invalid");
  }
  if (returnedModel !== PINNED_MODEL) {
    throw new ProviderTerminalError("provider-model-mismatch");
  }
  const usage = parseUsage(providerResponse.usage);
  if (!Array.isArray(providerResponse.choices) || providerResponse.choices.length !== 1) {
    throw new ProviderTerminalError("provider-response-invalid");
  }
  const choice = providerResponse.choices[0];
  if (!isRecord(choice) || choice.index !== 0 || choice.finish_reason !== "stop") {
    throw new ProviderTerminalError("provider-response-invalid");
  }
  const message = choice.message;
  if (!isRecord(message) || (message.refusal !== undefined && message.refusal !== null)) {
    throw new ProviderTerminalError("provider-refusal");
  }
  if (typeof message.content !== "string") {
    throw new ProviderTerminalError("provider-response-invalid");
  }
  let actionValue: unknown;
  try {
    actionValue = JSON.parse(message.content) as unknown;
  } catch {
    throw new ProviderTerminalError("provider-output-invalid");
  }
  if (!isRecord(actionValue)) throw new ProviderTerminalError("provider-output-invalid");
  const keys = Object.keys(actionValue).sort(compareCodeUnits);
  if (keys.join(",") !== "action,reason,stateWrite") {
    throw new ProviderTerminalError("provider-output-invalid");
  }
  if (actionValue.action !== "wait" && actionValue.action !== "contact") {
    throw new ProviderTerminalError("provider-output-invalid");
  }
  if (
    typeof actionValue.stateWrite !== "string" ||
    actionValue.stateWrite.length > MAX_STATE_WRITE_CHARS ||
    !STAR_COUNT_PATTERN.test(actionValue.stateWrite)
  ) {
    throw new ProviderTerminalError("provider-output-invalid");
  }
  if (
    typeof actionValue.reason !== "string" ||
    actionValue.reason.trim() === "" ||
    actionValue.reason.length > MAX_REASON_CHARS
  ) {
    throw new ProviderTerminalError("provider-output-invalid");
  }
  if (
    ARM_CONTEXT_PATTERN.test(actionValue.stateWrite) ||
    ARM_CONTEXT_PATTERN.test(actionValue.reason)
  ) {
    throw new ProviderTerminalError("provider-output-not-arm-opaque");
  }
  return {
    returnedModel,
    usage,
    action: {
      action: actionValue.action,
      stateWrite: actionValue.stateWrite,
      reason: actionValue.reason,
    },
  };
}

function artifactReference(outputRoot: string, path: string, bytes: Buffer): ArtifactReference {
  return {
    path: relative(outputRoot, path),
    byteLength: bytes.byteLength,
    sha256: sha256(bytes),
  };
}

async function listen(server: Server, port: number): Promise<number> {
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const onError = (error: Error): void => rejectPromise(error);
    server.once("error", onError);
    server.listen(port, LOOPBACK_HOST, () => {
      server.off("error", onError);
      resolvePromise();
    });
  });
  const address = server.address();
  if (address === null || typeof address === "string" || address.address !== LOOPBACK_HOST) {
    throw new Error("provider proxy did not bind the required loopback address");
  }
  return address.port;
}

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolvePromise, rejectPromise) => {
    server.close((error) => {
      if (error) rejectPromise(error);
      else resolvePromise();
    });
    server.closeIdleConnections();
  });
}

export async function startSentinelProviderProxy(
  input: StartSentinelProviderProxyInput,
): Promise<SentinelProviderProxy> {
  const outputRoot = prepareOutputRoot(input.outputRoot);
  const apiKey = requiredSecret(input.openAiApiKey, "openAiApiKey", 8);
  const authorizationToken = requiredSecret(
    input.authorizationToken ?? randomBytes(32).toString("base64url"),
    "authorizationToken",
    32,
  );
  const port = input.port ?? 0;
  if (!Number.isInteger(port) || port < 0 || port > 65_535) {
    throw new Error("provider proxy port must be an integer from 0 through 65535");
  }
  const fetchImpl = input.fetchImpl ?? fetch;
  const monotonicNowMs = input.monotonicNowMs ?? (() => performance.now());
  const wallClock = input.wallClock ?? (() => new Date());
  const clientRequestId = input.clientRequestId ?? randomUUID;
  const operationIds = new Set<string>();
  let auditSequence = 0;
  let auditHeadHash: string | null = null;
  let successfulOperationCount = 0;
  let terminalFailureCount = 0;
  let ready = false;
  let finalReceipt: SentinelProviderProxyFinalReceipt | null = null;
  let closing: Promise<SentinelProviderProxyFinalReceipt> | null = null;

  const appendAudit = (body: JsonRecord): string => {
    const sequence = auditSequence + 1;
    const recordBody = {
      schemaVersion: "pm.public-eval-corners.sentinel-provider-exchange-audit.v1",
      sequence,
      previousRecordHash: auditHeadHash,
      recordedAt: wallClock().toISOString(),
      ...body,
    };
    const recordHash = sha256(canonical(recordBody));
    const record = { ...recordBody, recordHash };
    const fileName = `${String(sequence).padStart(8, "0")}-${recordHash}.json`;
    writeExclusive(
      resolve(outputRoot, "audit", fileName),
      `${JSON.stringify(record, null, 2)}\n`,
    );
    auditSequence = sequence;
    auditHeadHash = recordHash;
    return recordHash;
  };

  const processOperation = async (
    agentRequest: AgentPollRequest,
    response: ServerResponse,
  ): Promise<void> => {
    const operationRoot = resolve(outputRoot, "operations", sha256(agentRequest.operationId));
    mkdirSync(operationRoot, { mode: 0o700 });
    const exactProviderRequest = Buffer.from(JSON.stringify(providerRequest(agentRequest)));
    const requestBodyPath = resolve(operationRoot, "provider-request.body.json");
    writeExclusive(requestBodyPath, exactProviderRequest);
    const requestBodyRef = artifactReference(outputRoot, requestBodyPath, exactProviderRequest);
    const outboundClientRequestId = clientRequestId();
    if (typeof outboundClientRequestId !== "string" || outboundClientRequestId.trim() === "") {
      throw new Error("clientRequestId generator returned an invalid identifier");
    }
    const sanitizedHeaders = Buffer.from(`${JSON.stringify({
      method: "POST",
      url: OPENAI_CHAT_COMPLETIONS_URL,
      headers: {
        "content-type": "application/json",
        "x-client-request-id": outboundClientRequestId,
      },
    }, null, 2)}\n`);
    const requestHeadersPath = resolve(operationRoot, "provider-request.headers.json");
    writeExclusive(requestHeadersPath, sanitizedHeaders);
    const requestHeadersRef = artifactReference(outputRoot, requestHeadersPath, sanitizedHeaders);
    appendAudit({
      stage: "attempt-started",
      operationId: agentRequest.operationId,
      attemptNumber: 1,
      automaticRetryCount: 0,
      clientRequestId: outboundClientRequestId,
      request: {
        body: requestBodyRef,
        sanitizedHeaders: requestHeadersRef,
        authorizationCaptured: false,
      },
    });

    const startedAt = monotonicNowMs();
    let providerHttpStatus: number | null = null;
    let providerRequestId: string | null = null;
    let returnedModel: string | null = null;
    let usage: JsonRecord | null = null;
    let responseRef: ArtifactReference | null = null;
    let action: ModelAction | null = null;
    let terminalCode = "provider-network-error";
    try {
      const providerResponse = await fetchImpl(OPENAI_CHAT_COMPLETIONS_URL, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
          "x-client-request-id": outboundClientRequestId,
        },
        body: exactProviderRequest,
      });
      providerHttpStatus = providerResponse.status;
      providerRequestId = providerResponse.headers.get("x-request-id");
      const responseBytes = Buffer.from(await providerResponse.arrayBuffer());
      if (responseBytes.byteLength > MAX_PROVIDER_RESPONSE_BYTES) {
        throw new ProviderTerminalError("provider-response-too-large");
      }
      if (responseBytes.includes(Buffer.from(apiKey))) {
        throw new ProviderTerminalError("provider-response-secret-echo");
      }
      const responsePath = resolve(operationRoot, "provider-response.body.bin");
      writeExclusive(responsePath, responseBytes);
      responseRef = artifactReference(outputRoot, responsePath, responseBytes);
      if (providerHttpStatus !== 200) {
        throw new ProviderTerminalError("provider-http-error");
      }
      if (providerRequestId === null || providerRequestId.trim() === "") {
        throw new ProviderTerminalError("provider-request-id-missing");
      }
      let parsedProviderResponse: unknown;
      try {
        parsedProviderResponse = JSON.parse(responseBytes.toString("utf8")) as unknown;
      } catch {
        throw new ProviderTerminalError("provider-response-invalid");
      }
      if (isRecord(parsedProviderResponse)) {
        returnedModel = typeof parsedProviderResponse.model === "string"
          ? parsedProviderResponse.model
          : null;
        usage = isRecord(parsedProviderResponse.usage) ? parsedProviderResponse.usage : null;
      }
      const parsed = parseModelAction(parsedProviderResponse);
      returnedModel = parsed.returnedModel;
      usage = parsed.usage;
      action = parsed.action;
      terminalCode = "succeeded";
    } catch (error) {
      terminalCode = error instanceof ProviderTerminalError
        ? error.terminalCode
        : "provider-network-error";
    }
    const finishedAt = monotonicNowMs();
    const latencyMs = Number.isFinite(startedAt) && Number.isFinite(finishedAt)
      ? Math.max(0, finishedAt - startedAt)
      : 0;
    const providerExchangeHash = appendAudit({
      stage: "attempt-terminal",
      operationId: agentRequest.operationId,
      attemptNumber: 1,
      automaticRetryCount: 0,
      terminalStatus: action === null ? "failed" : "succeeded",
      terminalCode,
      providerHttpStatus,
      providerRequestId,
      returnedModel,
      usage,
      latencyMs,
      responseBody: responseRef,
    });
    if (action === null) {
      terminalFailureCount += 1;
      errorResponse(response, 502, "provider_failure", agentRequest.operationId);
      return;
    }
    successfulOperationCount += 1;
    jsonResponse(response, 200, {
      schemaVersion: "pm.public-eval-corners.sentinel-agent-decision.v1",
      operationId: agentRequest.operationId,
      action: action.action,
      stateWrite: action.stateWrite,
      reason: action.reason,
      providerExchangeHash,
    });
  };

  const server = createServer((request, response) => {
    void (async () => {
      if (!ready) {
        errorResponse(response, 503, "provider_failure");
        return;
      }
      if (request.url !== ENDPOINT_PATH) {
        errorResponse(response, 404, "not_found");
        return;
      }
      if (!authorized(request, authorizationToken)) {
        errorResponse(response, 401, "authentication_required");
        return;
      }
      if (request.method !== "POST") {
        response.setHeader("allow", "POST");
        errorResponse(response, 405, "invalid_request");
        return;
      }
      try {
        const body = await readAgentBody(request);
        const agentRequest = parseAgentRequest(
          body,
          typeof request.headers["content-type"] === "string"
            ? request.headers["content-type"]
            : undefined,
        );
        if (operationIds.has(agentRequest.operationId)) {
          errorResponse(response, 409, "duplicate_operation", agentRequest.operationId);
          return;
        }
        operationIds.add(agentRequest.operationId);
        await processOperation(agentRequest, response);
      } catch (error) {
        if (error instanceof RequestValidationError) {
          errorResponse(response, error.statusCode, "invalid_request");
        } else {
          errorResponse(response, 500, "provider_failure");
        }
      }
    })();
  });
  server.requestTimeout = 30_000;
  server.headersTimeout = 10_000;
  server.maxRequestsPerSocket = 1;

  const boundPort = await listen(server, port);
  const origin = `http://${LOOPBACK_HOST}:${boundPort}`;
  const readyBody = {
    schemaVersion: "pm.public-eval-corners.sentinel-provider-proxy-ready.v1",
    evidenceEligible: false,
    origin,
    endpointPath: ENDPOINT_PATH,
    providerEndpoint: OPENAI_CHAT_COMPLETIONS_URL,
    pinnedModel: PINNED_MODEL,
    authorizationTokenSha256: sha256(authorizationToken),
    noAutomaticRetries: true,
    statelessProviderConversation: true,
    requestCaptureExcludesAuthorization: true,
    auditHeadHash: null,
    startedAt: wallClock().toISOString(),
  } as const;
  const readyReceipt = hashBody(readyBody) as ReadyReceipt;
  const readyReceiptPath = resolve(outputRoot, "provider-proxy-ready.json");
  const finalReceiptPath = resolve(outputRoot, "provider-proxy-final.json");
  try {
    writeExclusive(readyReceiptPath, `${JSON.stringify(readyReceipt, null, 2)}\n`);
  } catch (error) {
    await closeServer(server);
    throw error;
  }
  ready = true;

  const close = (): Promise<SentinelProviderProxyFinalReceipt> => {
    if (finalReceipt !== null) return Promise.resolve(finalReceipt);
    if (closing !== null) return closing;
    ready = false;
    closing = (async () => {
      await closeServer(server);
      const finalBody = {
        schemaVersion: "pm.public-eval-corners.sentinel-provider-proxy-final.v1",
        evidenceEligible: false,
        readyReceiptHash: readyReceipt.receiptHash,
        acceptedOperationCount: operationIds.size,
        successfulOperationCount,
        terminalFailureCount,
        automaticRetryCount: 0,
        auditRecordCount: auditSequence,
        finalAuditHeadHash: auditHeadHash,
        closedAt: wallClock().toISOString(),
      } as const;
      finalReceipt = hashBody(finalBody) as SentinelProviderProxyFinalReceipt;
      writeExclusive(finalReceiptPath, `${JSON.stringify(finalReceipt, null, 2)}\n`);
      return finalReceipt;
    })();
    return closing;
  };

  return Object.freeze({
    origin,
    authorizationToken,
    readyReceiptPath,
    finalReceiptPath,
    close,
  });
}

export const SENTINEL_PROVIDER_PROXY_INTEGRATION = Object.freeze({
  endpointPath: ENDPOINT_PATH,
  pinnedModel: PINNED_MODEL,
  directCli:
    "node packages/public-eval-corners/dist/sentinel-provider-proxy-cli.js --output-root <new-empty-directory>",
  requiredEnvironment: ["OPENAI_API_KEY", "PM_SENTINEL_PROXY_AUTH_TOKEN"],
});
