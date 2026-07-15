import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import { isAbsolute, relative, resolve, sep } from "node:path";

const LOOPBACK_HOST = "127.0.0.1";
const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
export const SENTINEL_ANTHROPIC_PINNED_MODEL = "claude-sonnet-4-5-20250929";
const PINNED_MODEL = SENTINEL_ANTHROPIC_PINNED_MODEL;
const ENDPOINT_PATH = "/v1/decide";
const MAX_OBSERVATION_BYTES = 8 * 1024 * 1024;
const MAX_AGENT_BODY_BYTES = 12 * 1024 * 1024;
const MAX_PROVIDER_RESPONSE_BYTES = 4 * 1024 * 1024;
const MAX_TASK_PROMPT_CHARS = 32_768;
const STATE_CONTEXT_WIDTH = 512;
const MAX_REASON_CHARS = 4_096;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const OPERATION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/u;
const MESSAGE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/u;
const STAR_COUNT_PATTERN = /^(?:0|[1-9][0-9]{0,8})$/u;
const SAFE_FIXED_CONTEXT_PATTERN = /^[\x20-\x7e]{512}$/u;
const RETAINED_BASELINE_PATTERN = /^memory_key=microhub\.star-count; observed_at=(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z); browser_observation=(0|[1-9][0-9]{0,8})$/u;
const ARM_CONTEXT_PATTERN = /\b(?:arm|mode|native|sham|substrate|treatment)\b|agentStateTreatment|boundaryProvider/iu;

const SYSTEM_PROMPT = [
  "You are the stateless decision boundary for one SentinelBench browser poll.",
  "The task prompt is the sole authority for the condition that must be monitored.",
  "Use only that task, the supplied prior-state context, and the current screenshot.",
  "Never invent an unavailable historical observation or substitute the current observation for a historical one.",
  "If the task requires a historical comparison and the relevant prior observation is unavailable, choose wait and record the current observation.",
  "When relevant prior state is available, evaluate the task's exact condition against it before recording the current observation.",
  "Choose contact if and only if the task's real condition is satisfied; otherwise choose wait.",
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

export const SENTINEL_ANTHROPIC_SYSTEM_PROMPT_SHA256 = sha256(SYSTEM_PROMPT);
export const SENTINEL_ANTHROPIC_ACTION_SCHEMA_SHA256 = sha256(canonical(ACTION_SCHEMA));

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

export interface SentinelAnthropicModelAction {
  readonly action: "wait" | "contact";
  readonly stateWrite: string;
  readonly reason: string;
}

export interface SentinelAnthropicParsedResponse {
  readonly providerMessageId: string;
  readonly returnedModel: typeof SENTINEL_ANTHROPIC_PINNED_MODEL;
  readonly usage: JsonRecord;
  readonly action: SentinelAnthropicModelAction;
}

interface ArtifactReference {
  readonly path: string;
  readonly byteLength: number;
  readonly sha256: string;
}

interface ReadyReceipt {
  readonly schemaVersion: "pm.public-eval-corners.sentinel-anthropic-provider-proxy-ready.v1";
  readonly evidenceEligible: false;
  readonly origin: string;
  readonly endpointPath: typeof ENDPOINT_PATH;
  readonly providerEndpoint: typeof ANTHROPIC_MESSAGES_URL;
  readonly anthropicVersion: typeof ANTHROPIC_VERSION;
  readonly pinnedModel: typeof PINNED_MODEL;
  readonly authorizationTokenSha256: string;
  readonly noAutomaticRetries: true;
  readonly statelessProviderConversation: true;
  readonly requestCaptureExcludesSecrets: true;
  readonly auditHeadHash: null;
  readonly startedAt: string;
  readonly receiptHash: string;
}

export interface SentinelAnthropicProviderProxyFinalReceipt {
  readonly schemaVersion: "pm.public-eval-corners.sentinel-anthropic-provider-proxy-final.v1";
  readonly evidenceEligible: false;
  readonly readyReceiptHash: string;
  readonly acceptedOperationCount: number;
  readonly successfulOperationCount: number;
  readonly terminalFailureCount: number;
  readonly duplicateOperationCount: number;
  readonly duplicateProviderMessageIdCount: number;
  readonly automaticRetryCount: 0;
  readonly auditRecordCount: number;
  readonly finalAuditHeadHash: string | null;
  readonly closedAt: string;
  readonly receiptHash: string;
}

export interface SentinelAnthropicProviderProxy {
  readonly origin: string;
  readonly authorizationToken: string;
  readonly readyReceiptPath: string;
  readonly finalReceiptPath: string;
  close(): Promise<SentinelAnthropicProviderProxyFinalReceipt>;
}

export interface StartSentinelAnthropicProviderProxyInput {
  readonly outputRoot: string;
  readonly anthropicApiKey: string;
  readonly authorizationToken?: string;
  readonly port?: number;
  readonly fetchImpl?: typeof fetch;
  readonly monotonicNowMs?: () => number;
  readonly wallClock?: () => Date;
  readonly clientAttemptId?: () => string;
}

export interface SentinelAnthropicEvidenceVerification {
  readonly valid: boolean;
  readonly issues: readonly string[];
  readonly auditRecordCount: number;
  readonly finalAuditHeadHash: string | null;
}

class RequestValidationError extends Error {
  constructor(
    readonly statusCode: 400 | 413 | 415,
    message: string,
  ) {
    super(message);
  }
}

export class SentinelAnthropicResponseValidationError extends Error {
  constructor(readonly terminalCode: string) {
    super(terminalCode);
  }
}

class ProviderTerminalError extends SentinelAnthropicResponseValidationError {}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value: JsonRecord, expected: readonly string[], path: string): void {
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
  ) return false;
  let offset = PNG_SIGNATURE.byteLength;
  let index = 0;
  let imageData = false;
  while (offset < bytes.byteLength) {
    if (bytes.byteLength - offset < 12) return false;
    const length = bytes.readUInt32BE(offset);
    const typeStart = offset + 4;
    const dataStart = typeStart + 4;
    const dataEnd = dataStart + length;
    const end = dataEnd + 4;
    if (end > bytes.byteLength) return false;
    const typeBytes = bytes.subarray(typeStart, dataStart);
    const type = typeBytes.toString("ascii");
    if (!/^[A-Za-z]{4}$/u.test(type)) return false;
    if (bytes.readUInt32BE(dataEnd) !== crc32(bytes.subarray(typeStart, dataEnd))) return false;
    if (index === 0) {
      if (type !== "IHDR" || length !== 13) return false;
      if (
        bytes.readUInt32BE(dataStart) === 0 ||
        bytes.readUInt32BE(dataStart + 4) === 0 ||
        bytes[dataStart + 10] !== 0 ||
        bytes[dataStart + 11] !== 0 ||
        (bytes[dataStart + 12] !== 0 && bytes[dataStart + 12] !== 1)
      ) return false;
    } else if (type === "IHDR") return false;
    if (type === "IDAT") imageData = true;
    if (type === "IEND") return length === 0 && imageData && end === bytes.byteLength;
    offset = end;
    index += 1;
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
      throw new Error("Anthropic provider proxy outputRoot must be a real directory");
    }
    if (readdirSync(normalized).length !== 0) {
      throw new Error("Anthropic provider proxy outputRoot must be empty");
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
  ) throw new Error(`${name} is missing or invalid`);
  return value;
}

function authorized(request: IncomingMessage, expectedToken: string): boolean {
  const header = request.headers.authorization;
  if (header === undefined || Array.isArray(header)) return false;
  const expected = Buffer.from(`Bearer ${expectedToken}`);
  const supplied = Buffer.from(header);
  return supplied.byteLength === expected.byteLength && timingSafeEqual(supplied, expected);
}

function jsonResponse(response: ServerResponse, statusCode: number, value: JsonRecord): void {
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
  const declared = request.headers["content-length"];
  if (typeof declared === "string" && /^\d+$/u.test(declared) && Number(declared) > MAX_AGENT_BODY_BYTES) {
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

function canonicalIsoTimestamp(value: string | undefined): boolean {
  if (value === undefined) return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString() === value;
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
  exactKeys(parsed, ["observation", "operationId", "schemaVersion", "stateContext", "taskPrompt"], "request");
  if (parsed.schemaVersion !== "pm.public-eval-corners.sentinel-provider-request.v1") {
    throw new RequestValidationError(400, "request schemaVersion is invalid");
  }
  const operationId = parsed.operationId;
  if (
    typeof operationId !== "string" ||
    !OPERATION_ID_PATTERN.test(operationId) ||
    ARM_CONTEXT_PATTERN.test(operationId)
  ) throw new RequestValidationError(400, "operationId is invalid");
  const taskPrompt = parsed.taskPrompt;
  if (
    typeof taskPrompt !== "string" ||
    taskPrompt.trim() === "" ||
    taskPrompt.length > MAX_TASK_PROMPT_CHARS
  ) throw new RequestValidationError(400, "taskPrompt is invalid");
  const stateContext = parsed.stateContext;
  if (
    typeof stateContext !== "string" ||
    stateContext.length !== STATE_CONTEXT_WIDTH ||
    !SAFE_FIXED_CONTEXT_PATTERN.test(stateContext) ||
    stateContext.trimEnd().length === 0 ||
    !stateContext.endsWith(" ")
  ) throw new RequestValidationError(400, "stateContext is invalid");
  const prefix = stateContext.trimEnd();
  const retained = RETAINED_BASELINE_PATTERN.exec(prefix);
  if (
    prefix !== "NO_RELEVANT_BROWSER_OBSERVATION" &&
    (retained === null || !canonicalIsoTimestamp(retained[1]))
  ) throw new RequestValidationError(400, "stateContext is not a registered fixed-width context");
  if (ARM_CONTEXT_PATTERN.test(stateContext)) {
    throw new RequestValidationError(400, "stateContext is not arm opaque");
  }
  if (!isRecord(parsed.observation)) {
    throw new RequestValidationError(400, "observation must be an object");
  }
  exactKeys(parsed.observation, ["dataBase64", "mimeType", "sha256"], "observation");
  if (parsed.observation.mimeType !== "image/png") {
    throw new RequestValidationError(400, "observation must be a PNG");
  }
  const observationSha = parsed.observation.sha256;
  const dataBase64 = parsed.observation.dataBase64;
  if (typeof observationSha !== "string" || !SHA256_PATTERN.test(observationSha)) {
    throw new RequestValidationError(400, "observation sha256 is invalid");
  }
  if (
    typeof dataBase64 !== "string" ||
    dataBase64.length === 0 ||
    dataBase64.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]*={0,2}$/u.test(dataBase64)
  ) throw new RequestValidationError(400, "observation dataBase64 is invalid");
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
    observation: { sha256: observationSha, mimeType: "image/png", dataBase64 },
    stateContext,
  };
}

function providerRequest(agentRequest: AgentPollRequest): JsonRecord {
  return {
    model: PINNED_MODEL,
    max_tokens: 256,
    temperature: 0,
    system: SYSTEM_PROMPT,
    messages: [{
      role: "user",
      content: [
        {
          type: "image",
          source: {
            type: "base64",
            media_type: "image/png",
            data: agentRequest.observation.dataBase64,
          },
        },
        {
          type: "text",
          text: JSON.stringify({
            taskPrompt: agentRequest.taskPrompt,
            stateContext: agentRequest.stateContext,
          }),
        },
      ],
    }],
    output_config: {
      format: {
        type: "json_schema",
        schema: ACTION_SCHEMA,
      },
    },
  };
}

function nonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

const ANTHROPIC_USAGE_KEYS = new Set([
  "cache_creation",
  "cache_creation_input_tokens",
  "cache_read_input_tokens",
  "input_tokens",
  "output_tokens",
  "server_tool_use",
  "service_tier",
]);

function parseUsage(value: unknown): JsonRecord {
  if (
    !isRecord(value) ||
    Object.keys(value).some((key) => !ANTHROPIC_USAGE_KEYS.has(key)) ||
    !nonNegativeInteger(value.input_tokens) ||
    !nonNegativeInteger(value.output_tokens)
  ) throw new ProviderTerminalError("provider-usage-invalid");
  for (const optional of [
    "cache_creation_input_tokens",
    "cache_read_input_tokens",
  ] as const) {
    if (value[optional] !== undefined && !nonNegativeInteger(value[optional])) {
      throw new ProviderTerminalError("provider-usage-invalid");
    }
  }
  if (value.service_tier !== undefined && typeof value.service_tier !== "string") {
    throw new ProviderTerminalError("provider-usage-invalid");
  }
  if (value.cache_creation !== undefined) {
    if (
      !isRecord(value.cache_creation) ||
      Object.keys(value.cache_creation).some((key) =>
        key !== "ephemeral_5m_input_tokens" && key !== "ephemeral_1h_input_tokens")
    ) throw new ProviderTerminalError("provider-usage-invalid");
    for (const field of ["ephemeral_5m_input_tokens", "ephemeral_1h_input_tokens"] as const) {
      if (value.cache_creation[field] !== undefined && !nonNegativeInteger(value.cache_creation[field])) {
        throw new ProviderTerminalError("provider-usage-invalid");
      }
    }
  }
  if (value.server_tool_use !== undefined) {
    if (
      !isRecord(value.server_tool_use) ||
      Object.keys(value.server_tool_use).some((key) =>
        ![
          "bash_code_execution_tool_requests",
          "code_execution_requests",
          "text_editor_code_execution_tool_requests",
          "web_fetch_requests",
          "web_search_requests",
        ].includes(key))
    ) throw new ProviderTerminalError("provider-usage-invalid");
    for (const count of Object.values(value.server_tool_use)) {
      if (!nonNegativeInteger(count)) throw new ProviderTerminalError("provider-usage-invalid");
    }
  }
  return value;
}

export function parseSentinelAnthropicResponse(
  providerResponse: unknown,
): SentinelAnthropicParsedResponse {
  if (!isRecord(providerResponse)) throw new ProviderTerminalError("provider-response-invalid");
  if (
    Object.keys(providerResponse).sort(compareCodeUnits).join(",") !==
    [
      "content",
      "id",
      "model",
      "role",
      "stop_reason",
      "stop_sequence",
      "type",
      "usage",
    ].sort(compareCodeUnits).join(",")
  ) throw new ProviderTerminalError("provider-response-invalid");
  if (
    providerResponse.type !== "message" ||
    providerResponse.role !== "assistant" ||
    typeof providerResponse.id !== "string" ||
    !MESSAGE_ID_PATTERN.test(providerResponse.id)
  ) throw new ProviderTerminalError("provider-response-invalid");
  if (providerResponse.model !== PINNED_MODEL) {
    throw new ProviderTerminalError("provider-model-mismatch");
  }
  if (providerResponse.stop_reason === "refusal") {
    throw new ProviderTerminalError("provider-refusal");
  }
  if (providerResponse.stop_reason !== "end_turn") {
    throw new ProviderTerminalError("provider-stop-reason-invalid");
  }
  if (providerResponse.stop_sequence !== null) {
    throw new ProviderTerminalError("provider-stop-sequence-invalid");
  }
  const usage = parseUsage(providerResponse.usage);
  if (!Array.isArray(providerResponse.content) || providerResponse.content.length !== 1) {
    throw new ProviderTerminalError("provider-content-invalid");
  }
  const block = providerResponse.content[0];
  if (!isRecord(block)) throw new ProviderTerminalError("provider-content-invalid");
  const blockKeys = Object.keys(block).sort(compareCodeUnits);
  if (blockKeys.join(",") !== "text,type" || block.type !== "text" || typeof block.text !== "string") {
    throw new ProviderTerminalError("provider-content-invalid");
  }
  let value: unknown;
  try {
    value = JSON.parse(block.text) as unknown;
  } catch {
    throw new ProviderTerminalError("provider-output-invalid");
  }
  if (!isRecord(value) || Object.keys(value).sort(compareCodeUnits).join(",") !== "action,reason,stateWrite") {
    throw new ProviderTerminalError("provider-output-invalid");
  }
  if (value.action !== "wait" && value.action !== "contact") {
    throw new ProviderTerminalError("provider-output-invalid");
  }
  if (typeof value.stateWrite !== "string" || !STAR_COUNT_PATTERN.test(value.stateWrite)) {
    throw new ProviderTerminalError("provider-output-invalid");
  }
  if (
    typeof value.reason !== "string" ||
    value.reason.trim() === "" ||
    value.reason.length > MAX_REASON_CHARS
  ) throw new ProviderTerminalError("provider-output-invalid");
  if (ARM_CONTEXT_PATTERN.test(value.stateWrite) || ARM_CONTEXT_PATTERN.test(value.reason)) {
    throw new ProviderTerminalError("provider-output-not-arm-opaque");
  }
  return {
    providerMessageId: providerResponse.id,
    returnedModel: PINNED_MODEL,
    usage,
    action: { action: value.action, stateWrite: value.stateWrite, reason: value.reason },
  };
}

function artifactReference(outputRoot: string, path: string, bytes: Buffer): ArtifactReference {
  return { path: relative(outputRoot, path), byteLength: bytes.byteLength, sha256: sha256(bytes) };
}

async function boundedProviderResponse(response: Response): Promise<Buffer> {
  const length = response.headers.get("content-length");
  if (length !== null && (!/^\d+$/u.test(length) || Number(length) > MAX_PROVIDER_RESPONSE_BYTES)) {
    throw new ProviderTerminalError("provider-response-too-large");
  }
  if (response.body === null) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let size = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      const bytes = Buffer.from(result.value);
      size += bytes.byteLength;
      if (size > MAX_PROVIDER_RESPONSE_BYTES) {
        await reader.cancel();
        throw new ProviderTerminalError("provider-response-too-large");
      }
      chunks.push(bytes);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, size);
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
    throw new Error("Anthropic provider proxy did not bind the required loopback address");
  }
  return address.port;
}

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolvePromise, rejectPromise) => {
    server.close((error) => error ? rejectPromise(error) : resolvePromise());
    server.closeIdleConnections();
  });
}

function safeArtifactPath(root: string, artifactPath: unknown): string | null {
  if (typeof artifactPath !== "string" || artifactPath === "" || isAbsolute(artifactPath)) return null;
  const resolved = resolve(root, artifactPath);
  if (resolved !== root && !resolved.startsWith(`${root}${sep}`)) return null;
  return resolved;
}

export function verifySentinelAnthropicProviderEvidence(
  outputRoot: string,
): SentinelAnthropicEvidenceVerification {
  const root = resolve(outputRoot);
  const issues: string[] = [];
  let previous: string | null = null;
  let count = 0;
  try {
    const files = readdirSync(resolve(root, "audit")).sort(compareCodeUnits);
    for (const [index, fileName] of files.entries()) {
      const path = resolve(root, "audit", fileName);
      if (lstatSync(path).isSymbolicLink()) {
        issues.push(`audit record ${index + 1} is a symlink`);
        continue;
      }
      let record: JsonRecord;
      try {
        const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
        if (!isRecord(parsed)) throw new Error("not an object");
        record = parsed;
      } catch {
        issues.push(`audit record ${index + 1} is invalid JSON`);
        continue;
      }
      count += 1;
      if (record.sequence !== index + 1) issues.push(`audit record ${index + 1} sequence mismatch`);
      if (record.previousRecordHash !== previous) issues.push(`audit record ${index + 1} previous hash mismatch`);
      const storedHash = record.recordHash;
      const body = { ...record };
      delete body.recordHash;
      const computed = sha256(canonical(body));
      if (storedHash !== computed) issues.push(`audit record ${index + 1} hash mismatch`);
      if (typeof storedHash === "string") previous = storedHash;
      for (const key of ["requestBody", "sanitizedRequestHeaders", "responseBody", "sanitizedResponseHeaders"]) {
        const reference = record[key];
        if (reference === null || reference === undefined) continue;
        if (!isRecord(reference)) {
          issues.push(`audit record ${index + 1} ${key} reference malformed`);
          continue;
        }
        const artifact = safeArtifactPath(root, reference.path);
        if (artifact === null || !existsSync(artifact) || lstatSync(artifact).isSymbolicLink()) {
          issues.push(`audit record ${index + 1} ${key} artifact missing or unsafe`);
          continue;
        }
        const bytes = readFileSync(artifact);
        if (reference.byteLength !== bytes.byteLength || reference.sha256 !== sha256(bytes)) {
          issues.push(`audit record ${index + 1} ${key} artifact hash mismatch`);
        }
      }
    }
  } catch {
    issues.push("audit directory is missing or unreadable");
  }
  return Object.freeze({ valid: issues.length === 0, issues, auditRecordCount: count, finalAuditHeadHash: previous });
}

export async function startSentinelAnthropicProviderProxy(
  input: StartSentinelAnthropicProviderProxyInput,
): Promise<SentinelAnthropicProviderProxy> {
  const outputRoot = prepareOutputRoot(input.outputRoot);
  const apiKey = requiredSecret(input.anthropicApiKey, "anthropicApiKey", 8);
  const authorizationToken = requiredSecret(
    input.authorizationToken ?? randomBytes(32).toString("base64url"),
    "authorizationToken",
    32,
  );
  const port = input.port ?? 0;
  if (!Number.isInteger(port) || port < 0 || port > 65_535) {
    throw new Error("Anthropic provider proxy port must be an integer from 0 through 65535");
  }
  const fetchImpl = input.fetchImpl ?? fetch;
  const monotonicNowMs = input.monotonicNowMs ?? (() => performance.now());
  const wallClock = input.wallClock ?? (() => new Date());
  const clientAttemptId = input.clientAttemptId ?? randomUUID;
  const operationIds = new Set<string>();
  const providerMessageIds = new Set<string>();
  let auditSequence = 0;
  let auditHeadHash: string | null = null;
  let successfulOperationCount = 0;
  let terminalFailureCount = 0;
  let duplicateOperationCount = 0;
  let duplicateProviderMessageIdCount = 0;
  let ready = false;
  let finalReceipt: SentinelAnthropicProviderProxyFinalReceipt | null = null;
  let closing: Promise<SentinelAnthropicProviderProxyFinalReceipt> | null = null;
  const inFlightOperations = new Set<Promise<void>>();
  const operationAbortControllers = new Set<AbortController>();

  const appendAudit = (body: JsonRecord): string => {
    const sequence = auditSequence + 1;
    const recordBody = {
      schemaVersion: "pm.public-eval-corners.sentinel-anthropic-provider-exchange-audit.v1",
      sequence,
      previousRecordHash: auditHeadHash,
      recordedAt: wallClock().toISOString(),
      ...body,
    };
    const recordHash = sha256(canonical(recordBody));
    writeExclusive(
      resolve(outputRoot, "audit", `${String(sequence).padStart(8, "0")}-${recordHash}.json`),
      `${JSON.stringify({ ...recordBody, recordHash }, null, 2)}\n`,
    );
    auditSequence = sequence;
    auditHeadHash = recordHash;
    return recordHash;
  };

  const processOperation = async (
    agentRequest: AgentPollRequest,
    response: ServerResponse,
    shutdownSignal: AbortSignal,
  ): Promise<void> => {
    const operationRoot = resolve(outputRoot, "operations", sha256(agentRequest.operationId));
    mkdirSync(operationRoot, { mode: 0o700 });
    const exactProviderRequest = Buffer.from(JSON.stringify(providerRequest(agentRequest)));
    if (exactProviderRequest.includes(Buffer.from(apiKey)) || exactProviderRequest.includes(Buffer.from(authorizationToken))) {
      terminalFailureCount += 1;
      appendAudit({
        stage: "attempt-terminal",
        operationId: agentRequest.operationId,
        attemptNumber: 1,
        automaticRetryCount: 0,
        terminalStatus: "failed",
        terminalCode: "secret-in-agent-input",
        providerHttpStatus: null,
        providerRequestId: null,
        providerMessageId: null,
        returnedModel: null,
        usage: null,
        latencyMs: 0,
        requestBody: null,
        sanitizedRequestHeaders: null,
        responseBody: null,
        sanitizedResponseHeaders: null,
      });
      errorResponse(response, 400, "invalid_request", agentRequest.operationId);
      return;
    }
    const requestBodyPath = resolve(operationRoot, "provider-request.body.json");
    writeExclusive(requestBodyPath, exactProviderRequest);
    const requestBodyRef = artifactReference(outputRoot, requestBodyPath, exactProviderRequest);
    const attemptId = clientAttemptId();
    if (typeof attemptId !== "string" || !MESSAGE_ID_PATTERN.test(attemptId)) {
      throw new Error("clientAttemptId generator returned an invalid identifier");
    }
    const sanitizedHeaders = Buffer.from(`${JSON.stringify({
      method: "POST",
      url: ANTHROPIC_MESSAGES_URL,
      headers: {
        "anthropic-version": ANTHROPIC_VERSION,
        "content-type": "application/json",
      },
      clientAttemptId: attemptId,
    }, null, 2)}\n`);
    const requestHeadersPath = resolve(operationRoot, "provider-request.headers.json");
    writeExclusive(requestHeadersPath, sanitizedHeaders);
    const requestHeadersRef = artifactReference(outputRoot, requestHeadersPath, sanitizedHeaders);
    appendAudit({
      stage: "attempt-started",
      operationId: agentRequest.operationId,
      attemptNumber: 1,
      automaticRetryCount: 0,
      clientAttemptId: attemptId,
      requestBody: requestBodyRef,
      sanitizedRequestHeaders: requestHeadersRef,
      authorizationCaptured: false,
    });

    const startedAt = monotonicNowMs();
    let providerHttpStatus: number | null = null;
    let providerRequestId: string | null = null;
    let providerMessageId: string | null = null;
    let returnedModel: string | null = null;
    let usage: JsonRecord | null = null;
    let responseRef: ArtifactReference | null = null;
    let responseHeadersRef: ArtifactReference | null = null;
    let action: SentinelAnthropicModelAction | null = null;
    let terminalCode = "provider-network-error";
    try {
      const providerResponse = await fetchImpl(ANTHROPIC_MESSAGES_URL, {
        method: "POST",
        headers: {
          "anthropic-version": ANTHROPIC_VERSION,
          "content-type": "application/json",
          "x-api-key": apiKey,
        },
        body: exactProviderRequest,
        redirect: "error",
        signal: AbortSignal.any([shutdownSignal, AbortSignal.timeout(120_000)]),
      });
      providerHttpStatus = providerResponse.status;
      providerRequestId = providerResponse.headers.get("request-id");
      const responseBytes = await boundedProviderResponse(providerResponse);
      if (responseBytes.includes(Buffer.from(apiKey)) || responseBytes.includes(Buffer.from(authorizationToken))) {
        throw new ProviderTerminalError("provider-response-secret-echo");
      }
      const responsePath = resolve(operationRoot, "provider-response.body.bin");
      writeExclusive(responsePath, responseBytes);
      responseRef = artifactReference(outputRoot, responsePath, responseBytes);
      const responseHeaders = Buffer.from(`${JSON.stringify({
        status: providerHttpStatus,
        headers: {
          "content-type": providerResponse.headers.get("content-type"),
          "request-id": providerRequestId,
        },
      }, null, 2)}\n`);
      const responseHeadersPath = resolve(operationRoot, "provider-response.headers.json");
      writeExclusive(responseHeadersPath, responseHeaders);
      responseHeadersRef = artifactReference(outputRoot, responseHeadersPath, responseHeaders);
      if (providerHttpStatus !== 200) throw new ProviderTerminalError("provider-http-error");
      if (providerRequestId === null || providerRequestId.trim() === "") {
        throw new ProviderTerminalError("provider-request-id-missing");
      }
      let parsedResponse: unknown;
      try {
        parsedResponse = JSON.parse(responseBytes.toString("utf8")) as unknown;
      } catch {
        throw new ProviderTerminalError("provider-response-invalid");
      }
      if (isRecord(parsedResponse)) {
        returnedModel = typeof parsedResponse.model === "string" ? parsedResponse.model : null;
        providerMessageId = typeof parsedResponse.id === "string" ? parsedResponse.id : null;
        usage = isRecord(parsedResponse.usage) ? parsedResponse.usage : null;
      }
      const parsed = parseSentinelAnthropicResponse(parsedResponse);
      returnedModel = parsed.returnedModel;
      providerMessageId = parsed.providerMessageId;
      usage = parsed.usage;
      if (providerMessageIds.has(parsed.providerMessageId)) {
        duplicateProviderMessageIdCount += 1;
        throw new ProviderTerminalError("provider-message-id-duplicate");
      }
      providerMessageIds.add(parsed.providerMessageId);
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
      providerMessageId,
      returnedModel,
      usage,
      latencyMs,
      requestBody: requestBodyRef,
      sanitizedRequestHeaders: requestHeadersRef,
      responseBody: responseRef,
      sanitizedResponseHeaders: responseHeadersRef,
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
    const abortController = new AbortController();
    operationAbortControllers.add(abortController);
    const body = (async () => {
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
          duplicateOperationCount += 1;
          appendAudit({
            stage: "operation-rejected",
            operationId: agentRequest.operationId,
            terminalCode: "duplicate-operation",
          });
          errorResponse(response, 409, "duplicate_operation", agentRequest.operationId);
          return;
        }
        operationIds.add(agentRequest.operationId);
        await processOperation(agentRequest, response, abortController.signal);
      } catch (error) {
        if (!response.writableEnded && !response.destroyed) {
          if (error instanceof RequestValidationError) {
            errorResponse(response, error.statusCode, "invalid_request");
          } else {
            errorResponse(response, 500, "provider_failure");
          }
        }
      }
    })();
    let operation!: Promise<void>;
    operation = body.finally(() => {
      operationAbortControllers.delete(abortController);
      inFlightOperations.delete(operation);
    });
    inFlightOperations.add(operation);
    void operation;
  });
  server.requestTimeout = 30_000;
  server.headersTimeout = 10_000;
  server.maxRequestsPerSocket = 1;

  const boundPort = await listen(server, port);
  const origin = `http://${LOOPBACK_HOST}:${boundPort}`;
  const readyBody = {
    schemaVersion: "pm.public-eval-corners.sentinel-anthropic-provider-proxy-ready.v1",
    evidenceEligible: false,
    origin,
    endpointPath: ENDPOINT_PATH,
    providerEndpoint: ANTHROPIC_MESSAGES_URL,
    anthropicVersion: ANTHROPIC_VERSION,
    pinnedModel: PINNED_MODEL,
    authorizationTokenSha256: sha256(authorizationToken),
    noAutomaticRetries: true,
    statelessProviderConversation: true,
    requestCaptureExcludesSecrets: true,
    auditHeadHash: null,
    startedAt: wallClock().toISOString(),
  } as const;
  const readyReceipt = hashBody(readyBody) as ReadyReceipt;
  const readyReceiptPath = resolve(outputRoot, "anthropic-provider-proxy-ready.json");
  const finalReceiptPath = resolve(outputRoot, "anthropic-provider-proxy-final.json");
  try {
    writeExclusive(readyReceiptPath, `${JSON.stringify(readyReceipt, null, 2)}\n`);
  } catch (error) {
    await closeServer(server);
    throw error;
  }
  ready = true;

  const close = (): Promise<SentinelAnthropicProviderProxyFinalReceipt> => {
    if (finalReceipt !== null) return Promise.resolve(finalReceipt);
    if (closing !== null) return closing;
    ready = false;
    closing = (async () => {
      const serverClosing = closeServer(server);
      for (const controller of operationAbortControllers) controller.abort();
      await Promise.allSettled([...inFlightOperations]);
      await serverClosing;
      // A request already queued by Node when close() began can enter the
      // handler after the first snapshot. It sees ready=false and must also
      // finish before the evidence inventory is sealed.
      await Promise.allSettled([...inFlightOperations]);
      const finalBody = {
        schemaVersion: "pm.public-eval-corners.sentinel-anthropic-provider-proxy-final.v1",
        evidenceEligible: false,
        readyReceiptHash: readyReceipt.receiptHash,
        acceptedOperationCount: operationIds.size,
        successfulOperationCount,
        terminalFailureCount,
        duplicateOperationCount,
        duplicateProviderMessageIdCount,
        automaticRetryCount: 0,
        auditRecordCount: auditSequence,
        finalAuditHeadHash: auditHeadHash,
        closedAt: wallClock().toISOString(),
      } as const;
      finalReceipt = hashBody(finalBody) as SentinelAnthropicProviderProxyFinalReceipt;
      writeExclusive(finalReceiptPath, `${JSON.stringify(finalReceipt, null, 2)}\n`);
      return finalReceipt;
    })();
    return closing;
  };

  return Object.freeze({ origin, authorizationToken, readyReceiptPath, finalReceiptPath, close });
}

export const SENTINEL_ANTHROPIC_PROVIDER_PROXY_INTEGRATION = Object.freeze({
  endpointPath: ENDPOINT_PATH,
  providerEndpoint: ANTHROPIC_MESSAGES_URL,
  anthropicVersion: ANTHROPIC_VERSION,
  pinnedModel: PINNED_MODEL,
  directCli:
    "node packages/public-eval-corners/dist/sentinel-anthropic-provider-proxy-cli.js --output-root <new-empty-directory>",
  requiredEnvironment: ["ANTHROPIC_API_KEY", "PM_SENTINEL_PROXY_AUTH_TOKEN"],
});
