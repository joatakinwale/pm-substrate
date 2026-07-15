import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
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
import { performance } from "node:perf_hooks";

const LOOPBACK_HOST = "127.0.0.1";
const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
export const SENTINEL_GENERAL_ANTHROPIC_PINNED_MODEL = "claude-sonnet-4-5-20250929";
const ENDPOINT_PATH = "/v1/decide";
const MAX_OBSERVATION_BYTES = 8 * 1024 * 1024;
const MAX_AGENT_BODY_BYTES = 12 * 1024 * 1024;
const MAX_PROVIDER_RESPONSE_BYTES = 4 * 1024 * 1024;
const MAX_TASK_PROMPT_CHARS = 32_768;
const MAX_REASON_CHARS = 4_096;
const MAX_TYPED_TEXT_CHARS = 4_000;
const FIXED_STATE_WIDTH = 512;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const OPERATION_ID_PATTERN = /^[a-f0-9]{32}$/u;
const MESSAGE_ID_PATTERN = /^msg_[A-Za-z0-9_-]{1,251}$/u;
const PROVIDER_REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/u;
const FIXED_STATE_PATTERN = /^[\x20-\x21\x23-\x5b\x5d-\x7e]{512}$/u;
const SAFE_MEMORY_NOTE = /^[\x20-\x21\x23-\x5b\x5d-\x7e]{1,512}$/u;
const ARM_IDENTITY = /\b(?:native|sham|plain[ -]?kv|substrate|treatment|control[ -]?arm)\b/iu;
const SAFE_PRESS_KEYS = new Set([
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "Backspace",
  "Delete",
  "End",
  "Enter",
  "Escape",
  "Home",
  "PageDown",
  "PageUp",
  "Space",
  "Tab",
]);

const SYSTEM_PROMPT = [
  "You are a stateless visual browser decision boundary.",
  "The supplied task prompt is the sole authority for what to do and when to report completion.",
  "Use only the exact task prompt, exact start URL, current URL, current screenshot, and supplied prior memory.",
  "Never invent an observation, browser result, prior fact, completed interaction, or report.",
  "Preserve historical facts that may be needed after a later observation in memoryNote.",
  "Treat blank or irrelevant prior memory as unavailable; do not replace a missing historical fact with the current observation.",
  "Use click, type, press, and scroll to operate only through the visible browser.",
  "After a browser action, expect an immediate new screenshot before choosing another action.",
  "Choose wait only when time must pass before observing again.",
  "Use navigate only for an exact absolute URL exposed by the start URL or task prompt; navigation is limited to those loopback origins.",
  "Choose terminate when continuing cannot satisfy the task; terminate is an explicit unsuccessful early exit.",
  "memoryNote must be nonempty printable ASCII, at most 512 characters, and contain neither a quotation mark nor a backslash.",
  "Do not infer or mention hidden runtime implementation details.",
  "Return only one object matching the required action schema.",
].join(" ");

const BASE_PROPERTIES = {
  memoryNote: {
    type: "string",
    description: "Nonempty printable ASCII memory, at most 512 characters, without quote or backslash.",
  },
  reason: { type: "string", description: "Nonempty concise justification, at most 4096 characters." },
} as const;

function simpleActionSchema(action: "wait" | "terminate"): JsonRecord {
  return {
    type: "object",
    additionalProperties: false,
    properties: { action: { const: action }, ...BASE_PROPERTIES },
    required: ["action", "memoryNote", "reason"],
  };
}

const ACTION_SCHEMA = {
  anyOf: [
    simpleActionSchema("wait"),
    simpleActionSchema("terminate"),
    {
      type: "object",
      additionalProperties: false,
      properties: {
        action: { const: "navigate" },
        url: { type: "string", description: "Exact absolute URL on a prompt-exposed loopback origin." },
        ...BASE_PROPERTIES,
      },
      required: ["action", "url", "memoryNote", "reason"],
    },
    {
      type: "object",
      additionalProperties: false,
      properties: {
        action: { const: "click" },
        x: { type: "integer", description: "Horizontal viewport coordinate from 0 through 16384." },
        y: { type: "integer", description: "Vertical viewport coordinate from 0 through 16384." },
        button: { type: "string", enum: ["left", "middle", "right"] },
        ...BASE_PROPERTIES,
      },
      required: ["action", "x", "y", "button", "memoryNote", "reason"],
    },
    {
      type: "object",
      additionalProperties: false,
      properties: {
        action: { const: "type" },
        x: { type: "integer", description: "Horizontal viewport coordinate from 0 through 16384." },
        y: { type: "integer", description: "Vertical viewport coordinate from 0 through 16384." },
        text: { type: "string", description: "Nonempty visible text, at most 4000 characters." },
        ...BASE_PROPERTIES,
      },
      required: ["action", "x", "y", "text", "memoryNote", "reason"],
    },
    {
      type: "object",
      additionalProperties: false,
      properties: {
        action: { const: "press" },
        key: { type: "string", enum: [...SAFE_PRESS_KEYS].sort(compareCodeUnits) },
        ...BASE_PROPERTIES,
      },
      required: ["action", "key", "memoryNote", "reason"],
    },
    {
      type: "object",
      additionalProperties: false,
      properties: {
        action: { const: "scroll" },
        deltaX: { type: "integer", description: "Horizontal movement from -10000 through 10000." },
        deltaY: { type: "integer", description: "Vertical movement from -10000 through 10000." },
        ...BASE_PROPERTIES,
      },
      required: ["action", "deltaX", "deltaY", "memoryNote", "reason"],
    },
  ],
} as const;

export const SENTINEL_GENERAL_ANTHROPIC_SYSTEM_PROMPT_SHA256 = sha256(SYSTEM_PROMPT);
export const SENTINEL_GENERAL_ANTHROPIC_ACTION_SCHEMA_SHA256 = sha256(canonical(ACTION_SCHEMA));

type JsonRecord = Record<string, unknown>;

interface GeneralAgentRequest {
  readonly schemaVersion: "pm.public-eval-corners.sentinel-general-provider-request.v1";
  readonly operationId: string;
  readonly taskPrompt: string;
  readonly startUrl: string;
  readonly currentUrl: string;
  readonly observation: {
    readonly sha256: string;
    readonly mimeType: "image/png";
    readonly dataBase64: string;
  };
  readonly stateContext: string;
}

interface GeneralActionBase {
  readonly memoryNote: string;
  readonly reason: string;
}

export type SentinelGeneralAnthropicAction =
  | (GeneralActionBase & { readonly action: "wait" })
  | (GeneralActionBase & { readonly action: "terminate" })
  | (GeneralActionBase & { readonly action: "navigate"; readonly url: string })
  | (GeneralActionBase & {
      readonly action: "click";
      readonly x: number;
      readonly y: number;
      readonly button: "left" | "middle" | "right";
    })
  | (GeneralActionBase & {
      readonly action: "type";
      readonly x: number;
      readonly y: number;
      readonly text: string;
    })
  | (GeneralActionBase & { readonly action: "press"; readonly key: string })
  | (GeneralActionBase & {
      readonly action: "scroll";
      readonly deltaX: number;
      readonly deltaY: number;
    });

export interface SentinelGeneralAnthropicParsedResponse {
  readonly providerMessageId: string;
  readonly returnedModel: typeof SENTINEL_GENERAL_ANTHROPIC_PINNED_MODEL;
  readonly usage: JsonRecord;
  readonly action: SentinelGeneralAnthropicAction;
}

interface ArtifactReference {
  readonly path: string;
  readonly byteLength: number;
  readonly sha256: string;
}

export interface SentinelGeneralAnthropicProviderFinalReceipt {
  readonly schemaVersion: "pm.public-eval-corners.sentinel-general-anthropic-provider-final.v1";
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

export interface SentinelGeneralAnthropicProviderProxy {
  readonly origin: string;
  readonly authorizationToken: string;
  readonly readyReceiptPath: string;
  readonly finalReceiptPath: string;
  close(): Promise<SentinelGeneralAnthropicProviderFinalReceipt>;
}

export interface StartSentinelGeneralAnthropicProviderProxyInput {
  readonly outputRoot: string;
  readonly anthropicApiKey: string;
  readonly authorizationToken?: string;
  readonly port?: number;
  readonly fetchImpl?: typeof fetch;
  readonly monotonicNowMs?: () => number;
  readonly wallClock?: () => Date;
  readonly clientAttemptId?: () => string;
}

export interface SentinelGeneralAnthropicEvidenceVerification {
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

export class SentinelGeneralAnthropicResponseValidationError extends Error {
  constructor(readonly terminalCode: string) {
    super(terminalCode);
  }
}

class ProviderTerminalError extends SentinelGeneralAnthropicResponseValidationError {}

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
    if (!Number.isFinite(value)) throw new Error("cannot canonicalize a non-finite number");
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
  let chunkIndex = 0;
  let imageDataSeen = false;
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
    if (chunkIndex === 0) {
      if (type !== "IHDR" || length !== 13) return false;
      if (
        bytes.readUInt32BE(dataStart) === 0 ||
        bytes.readUInt32BE(dataStart + 4) === 0 ||
        bytes[dataStart + 10] !== 0 ||
        bytes[dataStart + 11] !== 0 ||
        (bytes[dataStart + 12] !== 0 && bytes[dataStart + 12] !== 1)
      ) return false;
    } else if (type === "IHDR") return false;
    if (type === "IDAT") imageDataSeen = true;
    if (type === "IEND") return length === 0 && imageDataSeen && end === bytes.byteLength;
    offset = end;
    chunkIndex += 1;
  }
  return false;
}

function safeHttpUrl(value: unknown, path: string): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 8_192) {
    throw new RequestValidationError(400, `${path} is invalid`);
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new RequestValidationError(400, `${path} is invalid`);
  }
  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    url.username !== "" ||
    url.password !== "" ||
    url.hash !== "" ||
    url.toString() !== value
  ) throw new RequestValidationError(400, `${path} is invalid`);
  return value;
}

function loopbackHostname(hostname: string): boolean {
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "[::1]";
}

interface NavigationPolicy {
  readonly origins: ReadonlySet<string>;
  readonly directUrls: ReadonlySet<string>;
}

function navigationPolicy(startUrl: string, taskPrompt: string): NavigationPolicy {
  let decodedStart: string;
  try {
    decodedStart = decodeURIComponent(startUrl);
  } catch {
    throw new RequestValidationError(400, "startUrl encoding is invalid");
  }
  const parsedStart = new URL(startUrl);
  const urlCandidates = (value: string): readonly string[] =>
    value.match(/https?:\/\/[^\s<>"']+/gu) ?? [];
  const candidates = [
    startUrl,
    ...parsedStart.searchParams.values(),
    ...urlCandidates(decodedStart),
    ...urlCandidates(taskPrompt),
  ];
  const origins = new Set<string>();
  const directUrls = new Set<string>();
  for (const candidate of candidates) {
    let parsed: URL;
    try {
      parsed = new URL(candidate.replace(/[),.;]+$/u, ""));
    } catch {
      continue;
    }
    if (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      loopbackHostname(parsed.hostname) &&
      parsed.username === "" &&
      parsed.password === ""
    ) {
      origins.add(parsed.origin);
      directUrls.add(parsed.toString());
    }
  }
  const startOrigin = new URL(startUrl).origin;
  if (
    !origins.has(startOrigin) ||
    origins.size < 1 ||
    origins.size > 2 ||
    directUrls.size < 1 ||
    directUrls.size > 8
  ) {
    throw new RequestValidationError(
      400,
      "startUrl and taskPrompt must expose one or two loopback origins",
    );
  }
  return Object.freeze({ origins, directUrls });
}

function requireAllowedNavigation(
  action: SentinelGeneralAnthropicAction,
  request: GeneralAgentRequest,
): void {
  const policy = navigationPolicy(request.startUrl, request.taskPrompt);
  if (!policy.origins.has(new URL(request.currentUrl).origin)) {
    throw new ProviderTerminalError("provider-current-url-outside-allowed-origins");
  }
  if (action.action === "navigate") {
    const target = new URL(action.url);
    if (!loopbackHostname(target.hostname) || !policy.directUrls.has(target.toString())) {
      throw new ProviderTerminalError("provider-output-navigation-invalid");
    }
  }
}

function parseAgentRequest(bytes: Buffer, contentType: string | undefined): GeneralAgentRequest {
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
  exactKeys(
    parsed,
    [
      "currentUrl",
      "observation",
      "operationId",
      "schemaVersion",
      "startUrl",
      "stateContext",
      "taskPrompt",
    ],
    "request",
  );
  if (parsed.schemaVersion !== "pm.public-eval-corners.sentinel-general-provider-request.v1") {
    throw new RequestValidationError(400, "request schemaVersion is invalid");
  }
  if (typeof parsed.operationId !== "string" || !OPERATION_ID_PATTERN.test(parsed.operationId)) {
    throw new RequestValidationError(400, "operationId is invalid");
  }
  if (
    typeof parsed.taskPrompt !== "string" ||
    parsed.taskPrompt.trim() === "" ||
    parsed.taskPrompt.length > MAX_TASK_PROMPT_CHARS
  ) throw new RequestValidationError(400, "taskPrompt is invalid");
  const startUrl = safeHttpUrl(parsed.startUrl, "startUrl");
  const currentUrl = safeHttpUrl(parsed.currentUrl, "currentUrl");
  if (!navigationPolicy(startUrl, parsed.taskPrompt).origins.has(new URL(currentUrl).origin)) {
    throw new RequestValidationError(400, "currentUrl is outside the prompt-declared loopback origins");
  }
  if (
    typeof parsed.stateContext !== "string" ||
    parsed.stateContext.length !== FIXED_STATE_WIDTH ||
    !FIXED_STATE_PATTERN.test(parsed.stateContext) ||
    ARM_IDENTITY.test(parsed.stateContext)
  ) throw new RequestValidationError(400, "stateContext is invalid or not execution-opaque");
  if (!isRecord(parsed.observation)) {
    throw new RequestValidationError(400, "observation must be an object");
  }
  exactKeys(parsed.observation, ["dataBase64", "mimeType", "sha256"], "observation");
  if (parsed.observation.mimeType !== "image/png") {
    throw new RequestValidationError(400, "observation must be a PNG");
  }
  const observationSha256 = parsed.observation.sha256;
  const dataBase64 = parsed.observation.dataBase64;
  if (typeof observationSha256 !== "string" || !SHA256_PATTERN.test(observationSha256)) {
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
  if (sha256(observationBytes) !== observationSha256) {
    throw new RequestValidationError(400, "observation sha256 does not match bytes");
  }
  return {
    schemaVersion: "pm.public-eval-corners.sentinel-general-provider-request.v1",
    operationId: parsed.operationId,
    taskPrompt: parsed.taskPrompt,
    startUrl,
    currentUrl,
    observation: { sha256: observationSha256, mimeType: "image/png", dataBase64 },
    stateContext: parsed.stateContext,
  };
}

function providerRequest(agentRequest: GeneralAgentRequest): JsonRecord {
  return {
    model: SENTINEL_GENERAL_ANTHROPIC_PINNED_MODEL,
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
            startUrl: agentRequest.startUrl,
            currentUrl: agentRequest.currentUrl,
            stateContext: agentRequest.stateContext,
          }),
        },
      ],
    }],
    output_config: { format: { type: "json_schema", schema: ACTION_SCHEMA } },
  };
}

function requireModelMemory(value: unknown): string {
  if (
    typeof value !== "string" ||
    !SAFE_MEMORY_NOTE.test(value) ||
    value.trim() === "" ||
    ARM_IDENTITY.test(value)
  ) throw new ProviderTerminalError("provider-output-memory-invalid");
  return value;
}

function requireModelReason(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.trim() === "" ||
    value.length > MAX_REASON_CHARS ||
    ARM_IDENTITY.test(value)
  ) throw new ProviderTerminalError("provider-output-reason-invalid");
  return value;
}

function modelInteger(value: unknown, minimum: number, maximum: number): number {
  if (!Number.isSafeInteger(value) || Number(value) < minimum || Number(value) > maximum) {
    throw new ProviderTerminalError("provider-output-action-invalid");
  }
  return Number(value);
}

export function parseSentinelGeneralAnthropicAction(value: unknown): SentinelGeneralAnthropicAction {
  if (!isRecord(value)) throw new ProviderTerminalError("provider-output-invalid");
  const common = ["action", "memoryNote", "reason"];
  const action = value.action;
  if (action === "click") exactModelKeys(value, [...common, "button", "x", "y"]);
  else if (action === "type") exactModelKeys(value, [...common, "text", "x", "y"]);
  else if (action === "press") exactModelKeys(value, [...common, "key"]);
  else if (action === "scroll") exactModelKeys(value, [...common, "deltaX", "deltaY"]);
  else if (action === "navigate") exactModelKeys(value, [...common, "url"]);
  else if (action === "wait" || action === "terminate") {
    exactModelKeys(value, common);
  } else {
    throw new ProviderTerminalError("provider-output-action-invalid");
  }
  const memoryNote = requireModelMemory(value.memoryNote);
  const reason = requireModelReason(value.reason);
  if (action === "navigate") {
    if (typeof value.url !== "string") {
      throw new ProviderTerminalError("provider-output-action-invalid");
    }
    let url: URL;
    try {
      url = new URL(value.url);
    } catch {
      throw new ProviderTerminalError("provider-output-action-invalid");
    }
    if (
      (url.protocol !== "http:" && url.protocol !== "https:") ||
      url.username !== "" ||
      url.password !== "" ||
      url.hash !== "" ||
      url.toString() !== value.url
    ) throw new ProviderTerminalError("provider-output-action-invalid");
    return { action, url: value.url, memoryNote, reason };
  }
  if (action === "click") {
    if (value.button !== "left" && value.button !== "middle" && value.button !== "right") {
      throw new ProviderTerminalError("provider-output-action-invalid");
    }
    return {
      action,
      x: modelInteger(value.x, 0, 16_384),
      y: modelInteger(value.y, 0, 16_384),
      button: value.button,
      memoryNote,
      reason,
    };
  }
  if (action === "type") {
    if (typeof value.text !== "string" || value.text.length === 0 || value.text.length > MAX_TYPED_TEXT_CHARS) {
      throw new ProviderTerminalError("provider-output-action-invalid");
    }
    return {
      action,
      x: modelInteger(value.x, 0, 16_384),
      y: modelInteger(value.y, 0, 16_384),
      text: value.text,
      memoryNote,
      reason,
    };
  }
  if (action === "press") {
    if (typeof value.key !== "string" || !SAFE_PRESS_KEYS.has(value.key)) {
      throw new ProviderTerminalError("provider-output-action-invalid");
    }
    return { action, key: value.key, memoryNote, reason };
  }
  if (action === "scroll") {
    const deltaX = modelInteger(value.deltaX, -10_000, 10_000);
    const deltaY = modelInteger(value.deltaY, -10_000, 10_000);
    if (deltaX === 0 && deltaY === 0) {
      throw new ProviderTerminalError("provider-output-action-invalid");
    }
    return { action, deltaX, deltaY, memoryNote, reason };
  }
  return { action, memoryNote, reason };
}

function exactModelKeys(value: JsonRecord, expected: readonly string[]): void {
  if (Object.keys(value).sort(compareCodeUnits).join(",") !== [...expected].sort(compareCodeUnits).join(",")) {
    throw new ProviderTerminalError("provider-output-invalid");
  }
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
  for (const optional of ["cache_creation_input_tokens", "cache_read_input_tokens"] as const) {
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
      if (
        value.cache_creation[field] !== undefined &&
        !nonNegativeInteger(value.cache_creation[field])
      ) throw new ProviderTerminalError("provider-usage-invalid");
    }
  }
  if (value.server_tool_use !== undefined) {
    const allowed = new Set([
      "bash_code_execution_tool_requests",
      "code_execution_requests",
      "text_editor_code_execution_tool_requests",
      "web_fetch_requests",
      "web_search_requests",
    ]);
    if (
      !isRecord(value.server_tool_use) ||
      Object.keys(value.server_tool_use).some((key) => !allowed.has(key)) ||
      Object.values(value.server_tool_use).some(
        (count) => !nonNegativeInteger(count) || count !== 0,
      )
    ) throw new ProviderTerminalError("provider-usage-invalid");
  }
  return value;
}

export function parseSentinelGeneralAnthropicResponse(
  providerResponse: unknown,
): SentinelGeneralAnthropicParsedResponse {
  if (!isRecord(providerResponse)) throw new ProviderTerminalError("provider-response-invalid");
  exactProviderResponseKeys(providerResponse);
  if (
    providerResponse.type !== "message" ||
    providerResponse.role !== "assistant" ||
    typeof providerResponse.id !== "string" ||
    !MESSAGE_ID_PATTERN.test(providerResponse.id)
  ) throw new ProviderTerminalError("provider-response-invalid");
  if (providerResponse.model !== SENTINEL_GENERAL_ANTHROPIC_PINNED_MODEL) {
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
  if (!isRecord(block) || Object.keys(block).sort(compareCodeUnits).join(",") !== "text,type") {
    throw new ProviderTerminalError("provider-content-invalid");
  }
  if (block.type !== "text" || typeof block.text !== "string") {
    throw new ProviderTerminalError("provider-content-invalid");
  }
  let modelValue: unknown;
  try {
    modelValue = JSON.parse(block.text) as unknown;
  } catch {
    throw new ProviderTerminalError("provider-output-invalid");
  }
  return {
    providerMessageId: providerResponse.id,
    returnedModel: SENTINEL_GENERAL_ANTHROPIC_PINNED_MODEL,
    usage,
    action: parseSentinelGeneralAnthropicAction(modelValue),
  };
}

function exactProviderResponseKeys(value: JsonRecord): void {
  const expected = [
    "content",
    "id",
    "model",
    "role",
    "stop_reason",
    "stop_sequence",
    "type",
    "usage",
  ].sort(compareCodeUnits).join(",");
  if (Object.keys(value).sort(compareCodeUnits).join(",") !== expected) {
    throw new ProviderTerminalError("provider-response-invalid");
  }
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
      throw new Error("provider outputRoot must be a real directory");
    }
    if (readdirSync(normalized).length !== 0) {
      throw new Error("provider outputRoot must be empty");
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
    value.length > 1_024 ||
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
  jsonBytesResponse(response, statusCode, bytes);
}

function jsonBytesResponse(response: ServerResponse, statusCode: number, bytes: Buffer): void {
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
  code:
    | "authentication_required"
    | "duplicate_operation"
    | "invalid_request"
    | "not_found"
    | "provider_failure",
  operationId?: string,
): void {
  jsonResponse(response, statusCode, {
    schemaVersion: "pm.public-eval-corners.sentinel-general-agent-error.v1",
    ...(operationId === undefined ? {} : { operationId }),
    error: { code, message: "The request could not be completed." },
  });
}

async function readAgentBody(request: IncomingMessage): Promise<Buffer> {
  const declared = request.headers["content-length"];
  if (typeof declared === "string" && /^\d+$/u.test(declared) && Number(declared) > MAX_AGENT_BODY_BYTES) {
    throw new RequestValidationError(413, "agent request is too large");
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
    size += bytes.byteLength;
    if (size > MAX_AGENT_BODY_BYTES) {
      throw new RequestValidationError(413, "agent request is too large");
    }
    chunks.push(bytes);
  }
  return Buffer.concat(chunks, size);
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
    throw new Error("provider did not bind the required loopback address");
  }
  return address.port;
}

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolvePromise, rejectPromise) => {
    server.close((error) => error ? rejectPromise(error) : resolvePromise());
    server.closeIdleConnections();
  });
}

function artifactReference(outputRoot: string, path: string, bytes: Buffer): ArtifactReference {
  return { path: relative(outputRoot, path), byteLength: bytes.byteLength, sha256: sha256(bytes) };
}

function safeArtifactPath(root: string, artifactPath: unknown): string | null {
  if (typeof artifactPath !== "string" || artifactPath === "" || isAbsolute(artifactPath)) return null;
  const path = resolve(root, artifactPath);
  if (path !== root && !path.startsWith(`${root}${sep}`)) return null;
  return path;
}

export function verifySentinelGeneralAnthropicProviderEvidence(
  outputRoot: string,
): SentinelGeneralAnthropicEvidenceVerification {
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
      for (const key of [
        "agentRequestBody",
        "agentResponseBody",
        "requestBody",
        "sanitizedRequestHeaders",
        "responseBody",
        "responseHeaders",
      ]) {
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
  return Object.freeze({
    valid: issues.length === 0,
    issues,
    auditRecordCount: count,
    finalAuditHeadHash: previous,
  });
}

export async function startSentinelGeneralAnthropicProviderProxy(
  input: StartSentinelGeneralAnthropicProviderProxyInput,
): Promise<SentinelGeneralAnthropicProviderProxy> {
  const outputRoot = prepareOutputRoot(input.outputRoot);
  const apiKey = requiredSecret(input.anthropicApiKey, "anthropicApiKey", 8);
  const authorizationToken = requiredSecret(
    input.authorizationToken ?? randomBytes(32).toString("base64url"),
    "authorizationToken",
    32,
  );
  const port = input.port ?? 0;
  if (!Number.isInteger(port) || port < 0 || port > 65_535) {
    throw new Error("provider port must be an integer from 0 through 65535");
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
  let finalReceipt: SentinelGeneralAnthropicProviderFinalReceipt | null = null;
  let closing: Promise<SentinelGeneralAnthropicProviderFinalReceipt> | null = null;
  const inFlightOperations = new Set<Promise<void>>();
  const operationAbortControllers = new Set<AbortController>();

  const appendAudit = (body: JsonRecord): string => {
    const sequence = auditSequence + 1;
    const recordBody = {
      schemaVersion: "pm.public-eval-corners.sentinel-general-anthropic-exchange-audit.v1",
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
    agentRequest: GeneralAgentRequest,
    rawAgentRequest: Buffer,
    response: ServerResponse,
    shutdownSignal: AbortSignal,
  ): Promise<void> => {
    const operationRoot = resolve(outputRoot, "operations", sha256(agentRequest.operationId));
    mkdirSync(operationRoot, { mode: 0o700 });
    const agentRequestPath = resolve(operationRoot, "agent-request.body.json");
    writeExclusive(agentRequestPath, rawAgentRequest);
    const agentRequestBodyRef = artifactReference(outputRoot, agentRequestPath, rawAgentRequest);
    const exactProviderRequest = Buffer.from(JSON.stringify(providerRequest(agentRequest)));
    if (
      exactProviderRequest.includes(Buffer.from(apiKey)) ||
      exactProviderRequest.includes(Buffer.from(authorizationToken))
    ) {
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
        agentRequestBody: agentRequestBodyRef,
        agentResponseBody: null,
        requestBody: null,
        sanitizedRequestHeaders: null,
        responseBody: null,
        responseHeaders: null,
      });
      errorResponse(response, 400, "invalid_request", agentRequest.operationId);
      return;
    }
    const requestBodyPath = resolve(operationRoot, "provider-request.body.json");
    writeExclusive(requestBodyPath, exactProviderRequest);
    const requestBodyRef = artifactReference(outputRoot, requestBodyPath, exactProviderRequest);
    const attemptId = clientAttemptId();
    if (typeof attemptId !== "string" || !PROVIDER_REQUEST_ID_PATTERN.test(attemptId)) {
      throw new Error("clientAttemptId generator returned an invalid identifier");
    }
    const sanitizedHeaders = Buffer.from(`${JSON.stringify({
      method: "POST",
      url: ANTHROPIC_MESSAGES_URL,
      headers: {
        "anthropic-version": ANTHROPIC_VERSION,
        "content-type": "application/json",
        "x-api-key-sha256": sha256(apiKey),
      },
      clientAttemptId: attemptId,
      secretValueCaptured: false,
    }, null, 2)}\n`);
    const requestHeadersPath = resolve(operationRoot, "provider-request.headers.sanitized.json");
    writeExclusive(requestHeadersPath, sanitizedHeaders);
    const requestHeadersRef = artifactReference(outputRoot, requestHeadersPath, sanitizedHeaders);
    appendAudit({
      stage: "attempt-started",
      operationId: agentRequest.operationId,
      attemptNumber: 1,
      automaticRetryCount: 0,
      clientAttemptId: attemptId,
      agentRequestBody: agentRequestBodyRef,
      agentResponseBody: null,
      requestBody: requestBodyRef,
      sanitizedRequestHeaders: requestHeadersRef,
      responseBody: null,
      responseHeaders: null,
    });

    const startedAt = monotonicNowMs();
    let providerHttpStatus: number | null = null;
    let providerRequestId: string | null = null;
    let providerMessageId: string | null = null;
    let returnedModel: string | null = null;
    let usage: JsonRecord | null = null;
    let responseBodyRef: ArtifactReference | null = null;
    let responseHeadersRef: ArtifactReference | null = null;
    let action: SentinelGeneralAnthropicAction | null = null;
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
      if (
        responseBytes.includes(Buffer.from(apiKey)) ||
        responseBytes.includes(Buffer.from(authorizationToken))
      ) throw new ProviderTerminalError("provider-response-secret-echo");
      const responseHeaders = Buffer.from(`${JSON.stringify({
        status: providerHttpStatus,
        headers: Object.fromEntries([...providerResponse.headers.entries()].sort(([left], [right]) =>
          compareCodeUnits(left, right))),
      }, null, 2)}\n`);
      if (
        responseHeaders.includes(Buffer.from(apiKey)) ||
        responseHeaders.includes(Buffer.from(authorizationToken))
      ) throw new ProviderTerminalError("provider-response-secret-echo");
      const responseBodyPath = resolve(operationRoot, "provider-response.body.bin");
      writeExclusive(responseBodyPath, responseBytes);
      responseBodyRef = artifactReference(outputRoot, responseBodyPath, responseBytes);
      const responseHeadersPath = resolve(operationRoot, "provider-response.headers.json");
      writeExclusive(responseHeadersPath, responseHeaders);
      responseHeadersRef = artifactReference(outputRoot, responseHeadersPath, responseHeaders);
      if (providerHttpStatus !== 200) throw new ProviderTerminalError("provider-http-error");
      if (providerRequestId === null || !PROVIDER_REQUEST_ID_PATTERN.test(providerRequestId)) {
        throw new ProviderTerminalError("provider-request-id-invalid");
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
      const parsed = parseSentinelGeneralAnthropicResponse(parsedResponse);
      returnedModel = parsed.returnedModel;
      providerMessageId = parsed.providerMessageId;
      usage = parsed.usage;
      if (providerMessageIds.has(parsed.providerMessageId)) {
        duplicateProviderMessageIdCount += 1;
        throw new ProviderTerminalError("provider-message-id-duplicate");
      }
      requireAllowedNavigation(parsed.action, agentRequest);
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
      agentRequestBody: agentRequestBodyRef,
      agentResponseBody: null,
      requestBody: requestBodyRef,
      sanitizedRequestHeaders: requestHeadersRef,
      responseBody: responseBodyRef,
      responseHeaders: responseHeadersRef,
    });
    if (action === null) {
      terminalFailureCount += 1;
      errorResponse(response, 502, "provider_failure", agentRequest.operationId);
      return;
    }
    successfulOperationCount += 1;
    const agentResponseBytes = Buffer.from(JSON.stringify({
      schemaVersion: "pm.public-eval-corners.sentinel-general-agent-decision.v1",
      operationId: agentRequest.operationId,
      ...action,
      providerExchangeHash,
    }));
    const agentResponsePath = resolve(operationRoot, "agent-response.body.json");
    writeExclusive(agentResponsePath, agentResponseBytes);
    const agentResponseBodyRef = artifactReference(outputRoot, agentResponsePath, agentResponseBytes);
    appendAudit({
      stage: "operation-delivered",
      operationId: agentRequest.operationId,
      providerExchangeHash,
      agentRequestBody: agentRequestBodyRef,
      agentResponseBody: agentResponseBodyRef,
    });
    jsonBytesResponse(response, 200, agentResponseBytes);
  };

  const server = createServer((request, response) => {
    const abortController = new AbortController();
    operationAbortControllers.add(abortController);
    const work = (async () => {
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
        const bytes = await readAgentBody(request);
        const agentRequest = parseAgentRequest(
          bytes,
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
        await processOperation(agentRequest, bytes, response, abortController.signal);
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
    let tracked!: Promise<void>;
    tracked = work.finally(() => {
      operationAbortControllers.delete(abortController);
      inFlightOperations.delete(tracked);
    });
    inFlightOperations.add(tracked);
    void tracked;
  });
  server.requestTimeout = 30_000;
  server.headersTimeout = 10_000;
  server.maxRequestsPerSocket = 1;

  const boundPort = await listen(server, port);
  const origin = `http://${LOOPBACK_HOST}:${boundPort}`;
  const readyBody = {
    schemaVersion: "pm.public-eval-corners.sentinel-general-anthropic-provider-ready.v1",
    evidenceEligible: false,
    origin,
    endpointPath: ENDPOINT_PATH,
    providerEndpoint: ANTHROPIC_MESSAGES_URL,
    anthropicVersion: ANTHROPIC_VERSION,
    pinnedModel: SENTINEL_GENERAL_ANTHROPIC_PINNED_MODEL,
    maxCompletionTokens: 256,
    temperature: 0,
    authorizationTokenSha256: sha256(authorizationToken),
    systemPromptSha256: SENTINEL_GENERAL_ANTHROPIC_SYSTEM_PROMPT_SHA256,
    actionSchemaSha256: SENTINEL_GENERAL_ANTHROPIC_ACTION_SCHEMA_SHA256,
    noAutomaticRetries: true,
    statelessProviderConversation: true,
    requestCaptureExcludesSecrets: true,
    auditHeadHash: null,
    startedAt: wallClock().toISOString(),
  } as const;
  const readyReceipt = hashBody(readyBody);
  const readyReceiptPath = resolve(outputRoot, "anthropic-provider-ready.json");
  const finalReceiptPath = resolve(outputRoot, "anthropic-provider-final.json");
  try {
    writeExclusive(readyReceiptPath, `${JSON.stringify(readyReceipt, null, 2)}\n`);
  } catch (error) {
    await closeServer(server);
    throw error;
  }
  ready = true;

  const close = (): Promise<SentinelGeneralAnthropicProviderFinalReceipt> => {
    if (finalReceipt !== null) return Promise.resolve(finalReceipt);
    if (closing !== null) return closing;
    ready = false;
    closing = (async () => {
      const serverClosing = closeServer(server);
      for (const controller of operationAbortControllers) controller.abort();
      await Promise.allSettled([...inFlightOperations]);
      await serverClosing;
      await Promise.allSettled([...inFlightOperations]);
      const finalBody = {
        schemaVersion: "pm.public-eval-corners.sentinel-general-anthropic-provider-final.v1",
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
      finalReceipt = hashBody(finalBody) as SentinelGeneralAnthropicProviderFinalReceipt;
      writeExclusive(finalReceiptPath, `${JSON.stringify(finalReceipt, null, 2)}\n`);
      return finalReceipt;
    })();
    return closing;
  };

  return Object.freeze({ origin, authorizationToken, readyReceiptPath, finalReceiptPath, close });
}

export const SENTINEL_GENERAL_ANTHROPIC_PROVIDER_INTEGRATION = Object.freeze({
  endpointPath: ENDPOINT_PATH,
  providerEndpoint: ANTHROPIC_MESSAGES_URL,
  anthropicVersion: ANTHROPIC_VERSION,
  pinnedModel: SENTINEL_GENERAL_ANTHROPIC_PINNED_MODEL,
  maxCompletionTokens: 256,
  temperature: 0,
  automaticRetries: 0,
});
