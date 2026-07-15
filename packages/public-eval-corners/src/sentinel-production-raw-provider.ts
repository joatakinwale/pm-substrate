import { lstatSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import { parseSentinelGeneralDecision } from "./sentinel-general-agent.js";
import {
  SENTINEL_GENERAL_ANTHROPIC_PINNED_MODEL,
  parseSentinelGeneralAnthropicResponse,
  type SentinelGeneralAnthropicAction,
} from "./sentinel-general-provider-proxy.js";
import type { SentinelProductionPreregistration } from "./sentinel-production-plan.js";
import type { SentinelProductionCellManifest } from "./sentinel-production-runner.js";
import {
  SENTINEL_RAW_SHA256,
  sentinelRawCanonical,
  sentinelRawCanonicalTimestamp,
  sentinelRawCompare,
  sentinelRawContainedPath,
  sentinelRawExactKeys,
  sentinelRawIsRecord,
  sentinelRawJsonFile,
  sentinelRawJsonSha256,
  sentinelRawRegularFile,
  sentinelRawSha256,
  sentinelRawStructurallyValidPng,
} from "./sentinel-production-raw-utils.js";

const OPERATION_ID = /^[a-f0-9]{32}$/u;
const REQUEST_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/u;

interface ArtifactReference {
  readonly path: string;
  readonly byteLength: number;
  readonly sha256: string;
}

export interface SentinelRawProviderOperation {
  readonly operationId: string;
  readonly clientAttemptId: string;
  readonly providerRequestId: string;
  readonly providerMessageId: string;
  readonly providerExchangeHash: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly latencyMs: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cacheCreationInputTokens: number;
  readonly cacheReadInputTokens: number;
  readonly cacheCreationEphemeral5mInputTokens: number;
  readonly cacheCreationEphemeral1hInputTokens: number;
  readonly serverToolUseRequestCount: number;
  readonly usage: Readonly<Record<string, unknown>>;
  readonly agentRequestSha256: string;
  readonly agentResponseSha256: string;
  readonly screenshotSha256: string;
  readonly screenshotBytes: Buffer;
  readonly taskPrompt: string;
  readonly startUrl: string;
  readonly currentUrl: string;
  readonly stateContext: string;
  readonly action: SentinelGeneralAnthropicAction;
  readonly agentDecision: ReturnType<typeof parseSentinelGeneralDecision>;
}

export interface SentinelRawProviderVerification {
  readonly valid: boolean;
  readonly issues: readonly string[];
  readonly operations: readonly SentinelRawProviderOperation[];
  readonly tokenSha256: string | null;
  readonly providerMessageIds: readonly string[];
  readonly providerRequestIds: readonly string[];
  readonly clientAttemptIds: readonly string[];
  readonly totalInputTokens: number;
  readonly totalOutputTokens: number;
  readonly totalCacheCreationInputTokens: number;
  readonly totalCacheReadInputTokens: number;
  readonly totalServerToolUseRequestCount: number;
  readonly totalLatencyMs: number;
  readonly finalAuditHeadSha256: string | null;
}

function issueOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function reference(value: unknown, label: string): ArtifactReference {
  sentinelRawExactKeys(value, ["byteLength", "path", "sha256"], label);
  if (
    typeof value.path !== "string" || !Number.isSafeInteger(value.byteLength) ||
    Number(value.byteLength) < 0 || typeof value.sha256 !== "string" ||
    !SENTINEL_RAW_SHA256.test(value.sha256)
  ) throw new Error(`${label} is invalid`);
  return value as unknown as ArtifactReference;
}

function bytesForReference(root: string, value: unknown, expectedPath: string, label: string): Buffer {
  const ref = reference(value, label);
  if (ref.path !== expectedPath) throw new Error(`${label} path is not operation-bound`);
  const bytes = sentinelRawRegularFile(sentinelRawContainedPath(root, ref.path, label), label);
  if (bytes.byteLength !== ref.byteLength || sentinelRawSha256(bytes) !== ref.sha256) {
    throw new Error(`${label} bytes differ from the audit reference`);
  }
  return bytes;
}

function parseJsonBytes(bytes: Buffer, label: string): Record<string, unknown> {
  let value: unknown;
  try { value = JSON.parse(bytes.toString("utf8")) as unknown; }
  catch { throw new Error(`${label} is not JSON`); }
  if (!sentinelRawIsRecord(value)) throw new Error(`${label} is not an object`);
  return value;
}

function validateAgentRequest(value: Record<string, unknown>): {
  readonly operationId: string;
  readonly taskPrompt: string;
  readonly startUrl: string;
  readonly currentUrl: string;
  readonly stateContext: string;
  readonly screenshotSha256: string;
  readonly screenshotBytes: Buffer;
} {
  sentinelRawExactKeys(value, [
    "currentUrl", "observation", "operationId", "schemaVersion", "startUrl", "stateContext", "taskPrompt",
  ], "provider agent request");
  if (
    value.schemaVersion !== "pm.public-eval-corners.sentinel-general-provider-request.v1" ||
    typeof value.operationId !== "string" || !OPERATION_ID.test(value.operationId) ||
    typeof value.taskPrompt !== "string" || value.taskPrompt.trim() === "" ||
    typeof value.startUrl !== "string" || typeof value.currentUrl !== "string" ||
    typeof value.stateContext !== "string" || value.stateContext.length !== 512
  ) throw new Error("provider agent request envelope is invalid");
  for (const [label, raw] of [["startUrl", value.startUrl], ["currentUrl", value.currentUrl]] as const) {
    const url = new URL(raw);
    if (!["http:", "https:"].includes(url.protocol) || url.username !== "" || url.password !== "" || url.hash !== "" || url.toString() !== raw) {
      throw new Error(`provider agent request ${label} is invalid`);
    }
  }
  sentinelRawExactKeys(value.observation, ["dataBase64", "mimeType", "sha256"], "provider observation");
  if (
    value.observation.mimeType !== "image/png" ||
    typeof value.observation.sha256 !== "string" || !SENTINEL_RAW_SHA256.test(value.observation.sha256) ||
    typeof value.observation.dataBase64 !== "string" || value.observation.dataBase64.length % 4 !== 0
  ) throw new Error("provider observation envelope is invalid");
  const screenshotBytes = Buffer.from(value.observation.dataBase64, "base64");
  if (
    screenshotBytes.toString("base64") !== value.observation.dataBase64 ||
    sentinelRawSha256(screenshotBytes) !== value.observation.sha256 ||
    !sentinelRawStructurallyValidPng(screenshotBytes)
  ) throw new Error("provider observation is not the declared structurally valid PNG");
  return {
    operationId: value.operationId,
    taskPrompt: value.taskPrompt,
    startUrl: value.startUrl,
    currentUrl: value.currentUrl,
    stateContext: value.stateContext,
    screenshotSha256: value.observation.sha256,
    screenshotBytes,
  };
}

function validateProviderRequest(
  value: Record<string, unknown>,
  agent: ReturnType<typeof validateAgentRequest>,
  plan: SentinelProductionPreregistration,
): void {
  sentinelRawExactKeys(value, ["max_tokens", "messages", "model", "output_config", "system", "temperature"], "Anthropic request");
  if (
    value.model !== SENTINEL_GENERAL_ANTHROPIC_PINNED_MODEL ||
    value.model !== plan.model.model || value.max_tokens !== 256 || value.max_tokens !== plan.model.maxCompletionTokens ||
    value.temperature !== 0 || value.temperature !== plan.model.temperature ||
    typeof value.system !== "string" || sentinelRawSha256(value.system) !== plan.model.systemPromptSha256 ||
    !Array.isArray(value.messages) || value.messages.length !== 1
  ) throw new Error("Anthropic request model, sampling, system, or stateless message count changed");
  const message = value.messages[0];
  sentinelRawExactKeys(message, ["content", "role"], "Anthropic user message");
  if (message.role !== "user" || !Array.isArray(message.content) || message.content.length !== 2) {
    throw new Error("Anthropic request is not one stateless multimodal user message");
  }
  const image = message.content[0];
  const text = message.content[1];
  sentinelRawExactKeys(image, ["source", "type"], "Anthropic image block");
  sentinelRawExactKeys(image.source, ["data", "media_type", "type"], "Anthropic image source");
  sentinelRawExactKeys(text, ["text", "type"], "Anthropic text block");
  if (
    image.type !== "image" || image.source.type !== "base64" || image.source.media_type !== "image/png" ||
    image.source.data !== agent.screenshotBytes.toString("base64") || text.type !== "text" || typeof text.text !== "string"
  ) throw new Error("Anthropic request does not bind the exact agent screenshot");
  let textPayload: unknown;
  try { textPayload = JSON.parse(text.text) as unknown; }
  catch { throw new Error("Anthropic text payload is not JSON"); }
  sentinelRawExactKeys(textPayload, ["currentUrl", "startUrl", "stateContext", "taskPrompt"], "Anthropic text payload");
  if (sentinelRawCanonical(textPayload) !== sentinelRawCanonical({
    taskPrompt: agent.taskPrompt,
    startUrl: agent.startUrl,
    currentUrl: agent.currentUrl,
    stateContext: agent.stateContext,
  })) throw new Error("Anthropic text payload differs from the exact agent request");
  sentinelRawExactKeys(value.output_config, ["format"], "Anthropic output config");
  sentinelRawExactKeys(value.output_config.format, ["schema", "type"], "Anthropic output format");
  if (
    value.output_config.format.type !== "json_schema" ||
    sentinelRawSha256(sentinelRawCanonical(value.output_config.format.schema)) !== plan.model.actionSchemaSha256
  ) throw new Error("Anthropic action schema changed or hidden tools were introduced");
}

function validateSanitizedHeaders(bytes: Buffer, clientAttemptId: string): string {
  const value = parseJsonBytes(bytes, "sanitized provider request headers");
  sentinelRawExactKeys(value, ["clientAttemptId", "headers", "method", "secretValueCaptured", "url"], "sanitized provider request headers");
  sentinelRawExactKeys(value.headers, ["anthropic-version", "content-type", "x-api-key-sha256"], "sanitized Anthropic headers");
  if (
    value.method !== "POST" || value.url !== "https://api.anthropic.com/v1/messages" ||
    value.clientAttemptId !== clientAttemptId || value.secretValueCaptured !== false ||
    value.headers["anthropic-version"] !== "2023-06-01" ||
    value.headers["content-type"] !== "application/json" ||
    typeof value.headers["x-api-key-sha256"] !== "string" ||
    !SENTINEL_RAW_SHA256.test(value.headers["x-api-key-sha256"])
  ) throw new Error("sanitized Anthropic request headers are invalid or expose a retry/tool path");
  return value.headers["x-api-key-sha256"];
}

function auditRecord(path: string, index: number, previous: string | null): Record<string, unknown> {
  const value = sentinelRawJsonFile(path, `provider audit record ${index + 1}`);
  if (!sentinelRawIsRecord(value)) throw new Error(`provider audit record ${index + 1} is not an object`);
  if (
    value.schemaVersion !== "pm.public-eval-corners.sentinel-general-anthropic-exchange-audit.v1" ||
    value.sequence !== index + 1 || value.previousRecordHash !== previous ||
    typeof value.recordHash !== "string" || !SENTINEL_RAW_SHA256.test(value.recordHash)
  ) throw new Error(`provider audit record ${index + 1} chain envelope is invalid`);
  sentinelRawCanonicalTimestamp(value.recordedAt, `provider audit record ${index + 1} recordedAt`);
  const body = { ...value };
  delete body.recordHash;
  if (sentinelRawJsonSha256(body) !== value.recordHash) throw new Error(`provider audit record ${index + 1} hash mismatch`);
  return value;
}

function readyReceipt(cellRoot: string, providerRoot: string, manifest: SentinelProductionCellManifest, plan: SentinelProductionPreregistration): string {
  const binding = manifest.serviceBinding;
  if (binding === null) throw new Error("provider service binding is absent");
  const readyPath = sentinelRawContainedPath(cellRoot, binding.provider.readyReceiptPath, "provider ready path");
  if (readyPath !== resolve(providerRoot, "anthropic-provider-ready.json")) throw new Error("provider ready path is not cell-bound");
  const ready = sentinelRawJsonFile(readyPath, "provider ready receipt");
  sentinelRawExactKeys(ready, [
    "actionSchemaSha256", "anthropicVersion", "auditHeadHash", "authorizationTokenSha256", "endpointPath",
    "evidenceEligible", "maxCompletionTokens", "noAutomaticRetries", "origin", "pinnedModel", "providerEndpoint",
    "receiptHash", "requestCaptureExcludesSecrets", "schemaVersion", "startedAt", "statelessProviderConversation",
    "systemPromptSha256", "temperature",
  ], "provider ready receipt");
  const { receiptHash, ...body } = ready;
  if (
    ready.schemaVersion !== "pm.public-eval-corners.sentinel-general-anthropic-provider-ready.v1" ||
    ready.evidenceEligible !== false || ready.endpointPath !== "/v1/decide" ||
    ready.providerEndpoint !== plan.model.endpoint || ready.anthropicVersion !== plan.model.apiVersion ||
    ready.pinnedModel !== plan.model.model || ready.maxCompletionTokens !== plan.model.maxCompletionTokens ||
    ready.temperature !== plan.model.temperature || ready.noAutomaticRetries !== true ||
    ready.statelessProviderConversation !== true || ready.requestCaptureExcludesSecrets !== true ||
    ready.auditHeadHash !== null || ready.systemPromptSha256 !== plan.model.systemPromptSha256 ||
    ready.actionSchemaSha256 !== plan.model.actionSchemaSha256 ||
    ready.authorizationTokenSha256 !== binding.provider.tokenSha256 ||
    receiptHash !== binding.provider.readyReceiptSha256 || receiptHash !== sentinelRawJsonSha256(body)
  ) throw new Error("provider ready receipt differs from the signed stateless model boundary");
  sentinelRawCanonicalTimestamp(ready.startedAt, "provider ready startedAt");
  const origin = new URL(String(ready.origin));
  if (
    origin.protocol !== "http:" || origin.hostname !== "127.0.0.1" || origin.pathname !== "/" ||
    Number(origin.port) !== manifest.ports.provider || ready.origin !== binding.provider.origin
  ) throw new Error("provider ready origin is not bound to the cell port");
  return String(ready.authorizationTokenSha256);
}

export function verifySentinelRawProviderEvidence(input: {
  readonly cellRoot: string;
  readonly manifest: SentinelProductionCellManifest;
  readonly plan: SentinelProductionPreregistration;
}): SentinelRawProviderVerification {
  const issues: string[] = [];
  const operations: SentinelRawProviderOperation[] = [];
  let tokenSha256: string | null = null;
  let previous: string | null = null;
  try {
    const providerRoot = resolve(input.cellRoot, "provider");
    tokenSha256 = readyReceipt(input.cellRoot, providerRoot, input.manifest, input.plan);
    const names = readdirSync(resolve(providerRoot, "audit")).sort(sentinelRawCompare);
    if (names.length === 0 || names.some((name, index) =>
      !new RegExp(`^${String(index + 1).padStart(8, "0")}-[a-f0-9]{64}\\.json$`, "u").test(name))) {
      throw new Error("provider audit files are absent, extra, or not sequence-addressed");
    }
    const records = names.map((name, index) => {
      const path = resolve(providerRoot, "audit", name);
      if (lstatSync(path).isSymbolicLink()) throw new Error("provider audit contains a symlink");
      const record = auditRecord(path, index, previous);
      if (name !== `${String(index + 1).padStart(8, "0")}-${String(record.recordHash)}.json`) {
        throw new Error(`provider audit record ${index + 1} filename hash mismatch`);
      }
      previous = String(record.recordHash);
      return record;
    });
    if (records.length % 3 !== 0) throw new Error("provider audit is not a sequence of exact three-stage operations");
    let apiKeySha256: string | null = null;
    for (let offset = 0; offset < records.length; offset += 3) {
      const started = records[offset]!;
      const terminal = records[offset + 1]!;
      const delivered = records[offset + 2]!;
      sentinelRawExactKeys(started, [
        "agentRequestBody", "agentResponseBody", "attemptNumber", "automaticRetryCount", "clientAttemptId",
        "operationId", "previousRecordHash", "recordHash", "recordedAt", "requestBody", "responseBody",
        "responseHeaders", "sanitizedRequestHeaders", "schemaVersion", "sequence", "stage",
      ], "provider attempt-started audit");
      sentinelRawExactKeys(terminal, [
        "agentRequestBody", "agentResponseBody", "attemptNumber", "automaticRetryCount", "latencyMs",
        "operationId", "previousRecordHash", "providerHttpStatus", "providerMessageId", "providerRequestId",
        "recordHash", "recordedAt", "requestBody", "responseBody", "responseHeaders", "returnedModel",
        "sanitizedRequestHeaders", "schemaVersion", "sequence", "stage", "terminalCode", "terminalStatus", "usage",
      ], "provider attempt-terminal audit");
      sentinelRawExactKeys(delivered, [
        "agentRequestBody", "agentResponseBody", "operationId", "previousRecordHash", "providerExchangeHash",
        "recordHash", "recordedAt", "schemaVersion", "sequence", "stage",
      ], "provider operation-delivered audit");
      if (
        started.stage !== "attempt-started" || terminal.stage !== "attempt-terminal" || delivered.stage !== "operation-delivered" ||
        typeof started.operationId !== "string" || !OPERATION_ID.test(started.operationId) ||
        terminal.operationId !== started.operationId || delivered.operationId !== started.operationId ||
        started.attemptNumber !== 1 || terminal.attemptNumber !== 1 ||
        started.automaticRetryCount !== 0 || terminal.automaticRetryCount !== 0 ||
        started.agentResponseBody !== null || started.responseBody !== null || started.responseHeaders !== null ||
        terminal.agentResponseBody !== null || terminal.terminalStatus !== "succeeded" || terminal.terminalCode !== "succeeded" ||
        terminal.providerHttpStatus !== 200 || terminal.returnedModel !== input.plan.model.model ||
        delivered.providerExchangeHash !== terminal.recordHash
      ) throw new Error(`provider operation ${offset / 3 + 1} is not the legal no-retry three-stage transition`);
      const operationId = started.operationId;
      const operationPath = `operations/${sentinelRawSha256(operationId)}`;
      const agentRequestBytes = bytesForReference(providerRoot, started.agentRequestBody, `${operationPath}/agent-request.body.json`, "provider agent request");
      const providerRequestBytes = bytesForReference(providerRoot, started.requestBody, `${operationPath}/provider-request.body.json`, "raw Anthropic request");
      const sanitizedBytes = bytesForReference(providerRoot, started.sanitizedRequestHeaders, `${operationPath}/provider-request.headers.sanitized.json`, "sanitized Anthropic request headers");
      const responseBytes = bytesForReference(providerRoot, terminal.responseBody, `${operationPath}/provider-response.body.bin`, "raw Anthropic response");
      const responseHeadersBytes = bytesForReference(providerRoot, terminal.responseHeaders, `${operationPath}/provider-response.headers.json`, "raw Anthropic response headers");
      const agentResponseBytes = bytesForReference(providerRoot, delivered.agentResponseBody, `${operationPath}/agent-response.body.json`, "provider agent response");
      if (
        sentinelRawCanonical(started.agentRequestBody) !== sentinelRawCanonical(terminal.agentRequestBody) ||
        sentinelRawCanonical(started.agentRequestBody) !== sentinelRawCanonical(delivered.agentRequestBody) ||
        sentinelRawCanonical(started.requestBody) !== sentinelRawCanonical(terminal.requestBody) ||
        sentinelRawCanonical(started.sanitizedRequestHeaders) !== sentinelRawCanonical(terminal.sanitizedRequestHeaders)
      ) throw new Error(`provider operation ${operationId} stage artifact references changed`);
      if (typeof started.clientAttemptId !== "string" || !REQUEST_ID.test(started.clientAttemptId)) {
        throw new Error(`provider operation ${operationId} client attempt ID is invalid`);
      }
      const observedKeyHash = validateSanitizedHeaders(sanitizedBytes, started.clientAttemptId);
      apiKeySha256 ??= observedKeyHash;
      if (apiKeySha256 !== observedKeyHash) throw new Error("provider API key identity changed within a cell");
      const agent = validateAgentRequest(parseJsonBytes(agentRequestBytes, "provider agent request"));
      if (agent.operationId !== operationId) throw new Error("provider operation ID differs from raw agent request");
      validateProviderRequest(parseJsonBytes(providerRequestBytes, "raw Anthropic request"), agent, input.plan);
      const parsedProvider = parseSentinelGeneralAnthropicResponse(parseJsonBytes(responseBytes, "raw Anthropic response"));
      const agentDecision = parseSentinelGeneralDecision(parseJsonBytes(agentResponseBytes, "provider agent response"), operationId);
      if (
        parsedProvider.providerMessageId !== terminal.providerMessageId ||
        terminal.providerMessageId !== String(terminal.providerMessageId) ||
        parsedProvider.returnedModel !== terminal.returnedModel ||
        sentinelRawCanonical(parsedProvider.usage) !== sentinelRawCanonical(terminal.usage) ||
        sentinelRawCanonical(parsedProvider.action) !== sentinelRawCanonical(
          Object.fromEntries(Object.entries(agentDecision).filter(([key]) =>
            !["schemaVersion", "operationId", "providerExchangeHash"].includes(key))),
        ) ||
        agentDecision.providerExchangeHash !== terminal.recordHash
      ) throw new Error(`provider operation ${operationId} raw response, audit, and delivered action do not match`);
      const responseHeaders = parseJsonBytes(responseHeadersBytes, "raw Anthropic response headers");
      sentinelRawExactKeys(responseHeaders, ["headers", "status"], "raw Anthropic response headers");
      if (
        responseHeaders.status !== 200 || !sentinelRawIsRecord(responseHeaders.headers) ||
        responseHeaders.headers["request-id"] !== terminal.providerRequestId ||
        typeof terminal.providerRequestId !== "string" || !REQUEST_ID.test(terminal.providerRequestId) ||
        typeof terminal.providerMessageId !== "string" ||
        !Number.isFinite(terminal.latencyMs) || Number(terminal.latencyMs) < 0 ||
        !sentinelRawIsRecord(terminal.usage) || !Number.isSafeInteger(terminal.usage.input_tokens) ||
        !Number.isSafeInteger(terminal.usage.output_tokens)
      ) throw new Error(`provider operation ${operationId} headers, usage, or latency are invalid`);
      const usage = terminal.usage;
      const cacheCreationInputTokens = Number(usage.cache_creation_input_tokens ?? 0);
      const cacheReadInputTokens = Number(usage.cache_read_input_tokens ?? 0);
      const cacheCreation = usage.cache_creation;
      const cacheCreationEphemeral5mInputTokens = sentinelRawIsRecord(cacheCreation)
        ? Number(cacheCreation.ephemeral_5m_input_tokens ?? 0) : 0;
      const cacheCreationEphemeral1hInputTokens = sentinelRawIsRecord(cacheCreation)
        ? Number(cacheCreation.ephemeral_1h_input_tokens ?? 0) : 0;
      const serverToolUse = usage.server_tool_use;
      const serverToolUseRequestCount = sentinelRawIsRecord(serverToolUse)
        ? Object.values(serverToolUse).reduce<number>((sum, count) => sum + Number(count), 0) : 0;
      if (
        !Number.isSafeInteger(cacheCreationInputTokens) || cacheCreationInputTokens !== 0 ||
        !Number.isSafeInteger(cacheReadInputTokens) || cacheReadInputTokens !== 0 ||
        !Number.isSafeInteger(cacheCreationEphemeral5mInputTokens) || cacheCreationEphemeral5mInputTokens !== 0 ||
        !Number.isSafeInteger(cacheCreationEphemeral1hInputTokens) || cacheCreationEphemeral1hInputTokens !== 0 ||
        !Number.isSafeInteger(serverToolUseRequestCount) || serverToolUseRequestCount !== 0
      ) throw new Error(`provider operation ${operationId} used undeclared prompt caching or server tools`);
      operations.push({
        operationId,
        clientAttemptId: started.clientAttemptId,
        providerRequestId: terminal.providerRequestId,
        providerMessageId: terminal.providerMessageId,
        providerExchangeHash: String(terminal.recordHash),
        startedAt: sentinelRawCanonicalTimestamp(started.recordedAt, "provider operation startedAt"),
        completedAt: sentinelRawCanonicalTimestamp(terminal.recordedAt, "provider operation completedAt"),
        latencyMs: Number(terminal.latencyMs),
        inputTokens: Number(terminal.usage.input_tokens),
        outputTokens: Number(terminal.usage.output_tokens),
        cacheCreationInputTokens,
        cacheReadInputTokens,
        cacheCreationEphemeral5mInputTokens,
        cacheCreationEphemeral1hInputTokens,
        serverToolUseRequestCount,
        usage: { ...usage },
        agentRequestSha256: sentinelRawSha256(agentRequestBytes),
        agentResponseSha256: sentinelRawSha256(agentResponseBytes),
        screenshotSha256: agent.screenshotSha256,
        screenshotBytes: agent.screenshotBytes,
        taskPrompt: agent.taskPrompt,
        startUrl: agent.startUrl,
        currentUrl: agent.currentUrl,
        stateContext: agent.stateContext,
        action: parsedProvider.action,
        agentDecision,
      });
    }
    const final = sentinelRawJsonFile(resolve(providerRoot, "anthropic-provider-final.json"), "provider final receipt");
    sentinelRawExactKeys(final, [
      "acceptedOperationCount", "auditRecordCount", "automaticRetryCount", "closedAt", "duplicateOperationCount",
      "duplicateProviderMessageIdCount", "evidenceEligible", "finalAuditHeadHash", "readyReceiptHash", "receiptHash",
      "schemaVersion", "successfulOperationCount", "terminalFailureCount",
    ], "provider final receipt");
    const { receiptHash, ...body } = final;
    if (
      final.schemaVersion !== "pm.public-eval-corners.sentinel-general-anthropic-provider-final.v1" ||
      final.evidenceEligible !== false || final.acceptedOperationCount !== operations.length ||
      final.successfulOperationCount !== operations.length || final.terminalFailureCount !== 0 ||
      final.duplicateOperationCount !== 0 || final.duplicateProviderMessageIdCount !== 0 ||
      final.automaticRetryCount !== 0 || final.auditRecordCount !== records.length ||
      final.finalAuditHeadHash !== previous || receiptHash !== input.manifest.providerFinalReceiptSha256 ||
      receiptHash !== sentinelRawJsonSha256(body)
    ) throw new Error("provider final receipt does not prove an exact successful no-retry drain");
    sentinelRawCanonicalTimestamp(final.closedAt, "provider final closedAt");
    const ids = operations.flatMap((operation) => [operation.operationId, operation.clientAttemptId, operation.providerRequestId, operation.providerMessageId]);
    if (new Set(ids).size !== ids.length) throw new Error("provider operation or request/message IDs are reused within the cell");
  } catch (error) { issues.push(issueOf(error)); }
  return {
    valid: issues.length === 0,
    issues,
    operations,
    tokenSha256,
    providerMessageIds: operations.map(({ providerMessageId }) => providerMessageId),
    providerRequestIds: operations.map(({ providerRequestId }) => providerRequestId),
    clientAttemptIds: operations.map(({ clientAttemptId }) => clientAttemptId),
    totalInputTokens: operations.reduce((sum, { inputTokens }) => sum + inputTokens, 0),
    totalOutputTokens: operations.reduce((sum, { outputTokens }) => sum + outputTokens, 0),
    totalCacheCreationInputTokens: operations.reduce((sum, { cacheCreationInputTokens }) => sum + cacheCreationInputTokens, 0),
    totalCacheReadInputTokens: operations.reduce((sum, { cacheReadInputTokens }) => sum + cacheReadInputTokens, 0),
    totalServerToolUseRequestCount: operations.reduce((sum, { serverToolUseRequestCount }) => sum + serverToolUseRequestCount, 0),
    totalLatencyMs: operations.reduce((sum, { latencyMs }) => sum + latencyMs, 0),
    finalAuditHeadSha256: previous,
  };
}
