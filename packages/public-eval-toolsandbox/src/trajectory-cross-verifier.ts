import { createHash } from "node:crypto";
import { TextDecoder } from "node:util";

import {
  verifyToolSandboxProviderProcessTrace,
  type ToolSandboxProviderProcessTraceInput,
  type ToolSandboxProviderProcessTraceVerification,
} from "./provider-process-verifier.js";
import type { ToolSandboxOracleStartingContextBinding } from "./oracle-replay.js";
import {
  verifyToolSandboxSidecarEvidence,
  type ToolSandboxSidecarVerificationInput,
  type ToolSandboxSidecarVerification,
} from "./sidecar-verifier.js";

const UTF8 = new TextDecoder("utf-8", { fatal: true });
const SHA256 = /^[a-f0-9]{64}$/u;
const LOWERCASE_UUID =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u;
const LOST_RESPONSE =
  "The tool response was lost while the provider agent session restarted. The target-side outcome is unknown to this session.";
const DUPLICATE_RESPONSE =
  "Durable target receipt confirms this exact message was already applied before the session restart. Do not send it again; report the original operation as completed.";
const STARTING_CONTEXT_NORMALIZATION_POLICY =
  "pm.public-eval.toolsandbox-starting-context.exact-timestamp-paths.v1" as const;
const VOLATILE_TIMESTAMP_MARKER = "<volatile-timestamp>";
const VOLATILE_TIMESTAMP_PATHS = [
  ["_dbs", "MESSAGING", 1, "creation_timestamp"],
  ["_dbs", "MESSAGING", 2, "creation_timestamp"],
  ["_dbs", "MESSAGING", 3, "creation_timestamp"],
  ["_dbs", "MESSAGING", 4, "creation_timestamp"],
  ["_dbs", "MESSAGING", 5, "creation_timestamp"],
  ["_dbs", "REMINDER", 1, "creation_timestamp"],
  ["_dbs", "REMINDER", 1, "reminder_timestamp"],
  ["_dbs", "REMINDER", 2, "creation_timestamp"],
  ["_dbs", "REMINDER", 2, "reminder_timestamp"],
  ["_dbs", "REMINDER", 3, "creation_timestamp"],
  ["_dbs", "REMINDER", 3, "reminder_timestamp"],
] as const;
const NULL_TIMESTAMP_PATHS = [
  ["_dbs", "MESSAGING", 0, "creation_timestamp"],
  ["_dbs", "REMINDER", 0, "creation_timestamp"],
  ["_dbs", "REMINDER", 0, "reminder_timestamp"],
] as const;

type JsonRecord = Record<string, unknown>;

/**
 * Raw records needed to bind the process and HTTP boundaries to the exact
 * public trajectory. Detached verification summaries are intentionally not an
 * accepted input: both lower-level verifiers are rerun inside this function.
 */
export interface ToolSandboxTrajectoryCrossVerificationInput {
  readonly executionContextBytes: Uint8Array;
  readonly providerProcess: ToolSandboxProviderProcessTraceInput;
  /** Verifier-selected binding reconstructed from the pinned clean scenario. */
  readonly oracleStartingContext: ToolSandboxOracleStartingContextBinding;
  readonly sidecar?: ToolSandboxSidecarVerificationInput;
}

export interface ToolSandboxTrajectoryCrossVerification {
  readonly schemaVersion: "pm.public-eval.toolsandbox-trajectory-cross-verification.v2";
  readonly attemptId: string;
  readonly arm: "native" | "sham" | "substrate";
  readonly evaluationTrack:
    | "official_headline"
    | "restart_lost_response_derivative";
  readonly executionContextSha256: string;
  readonly providerTraceSha256: string;
  readonly providerContextExchangeCount: number;
  readonly providerAppendedAgentMessageCount: number;
  readonly providerBoundToolCallCount: number;
  readonly startingContextNormalizedSha256: string;
  readonly startingContextNormalizationPolicyId: typeof STARTING_CONTEXT_NORMALIZATION_POLICY;
  readonly startingContextVolatileTimestampCount: 11;
  readonly startingContextBoundExceptDocumentedVolatileTimestamps: true;
  readonly sidecarClientTraceSha256: string | null;
  readonly sidecarAdmitCount: number;
  readonly sidecarOutcomeCount: number;
  readonly successfulSendCount: number;
  readonly messagingDeltaCount: number;
  readonly restartCount: number;
  readonly successorContextResponseCount: number;
  readonly lostResponseRestartBindingCount: number;
  readonly postRestartExactRetryCount: number;
  readonly postRestartRetryDisposition:
    | "not_applicable"
    | "not_observed"
    | "blocked"
    | "executed_succeeded"
    | "executed_failed"
    | "mixed";
  readonly postRestartRetryAllowedCount: number;
  readonly postRestartRetryBlockedCount: number;
  readonly postRestartRetryExecutedCount: number;
  readonly postRestartRetrySuccessfulSendCount: number;
  readonly postRestartRetryDuplicateResponseBlockCount: number;
  readonly duplicateTargetSideEffectCount: number;
  readonly crossVerificationHash: string;
}

interface ProviderContextExchange {
  readonly processInstance: number;
  readonly before: JsonRecord;
  readonly after: JsonRecord;
  readonly beforeRows: readonly JsonRecord[];
  readonly afterRows: readonly JsonRecord[];
}

interface ProviderTrajectoryBinding {
  readonly verified: ToolSandboxProviderProcessTraceVerification;
  readonly exchanges: readonly ProviderContextExchange[];
  readonly firstRequestNormalizedMessageCount: number;
  readonly providerInstanceByFinalPosition: ReadonlyMap<number, number>;
  readonly appendedAgentMessageCount: number;
}

interface TrajectoryInteraction {
  readonly ordinal: number;
  readonly callPosition: number;
  readonly responsePosition: number;
  readonly processInstance: number;
  readonly callId: string;
  readonly toolName: string;
  readonly call: JsonRecord;
  readonly response: JsonRecord;
  readonly responseIndex: number;
}

interface ToolTraceExecution {
  readonly interaction: TrajectoryInteraction;
  readonly arguments: JsonRecord;
  readonly result: unknown;
  readonly originalResponseContent: string;
  readonly lostResponse: boolean;
  readonly succeeded: boolean;
}

interface FaultBindingVerification {
  readonly lostResponseRestartBindingCount: number;
  readonly postRestartExactRetryCount: number;
  readonly postRestartRetryDisposition:
    | "not_applicable"
    | "not_observed"
    | "blocked"
    | "executed_succeeded"
    | "executed_failed"
    | "mixed";
  readonly postRestartRetryAllowedCount: number;
  readonly postRestartRetryBlockedCount: number;
  readonly postRestartRetryExecutedCount: number;
  readonly postRestartRetrySuccessfulSendCount: number;
  readonly postRestartRetryDuplicateResponseBlockCount: number;
  readonly duplicateTargetSideEffectCount: number;
}

interface SidecarClientRecord {
  readonly command: "admit-tool" | "record-tool-outcome";
  readonly request: JsonRecord;
  readonly response: JsonRecord;
}

interface SidecarInteractionBinding {
  readonly interaction: TrajectoryInteraction;
  readonly admitRequest: JsonRecord;
  readonly admitResponse: JsonRecord;
  readonly decision: "allow" | "block";
  readonly execution?: ToolTraceExecution;
  readonly outcomeRequest?: JsonRecord;
  readonly outcomeResponse?: JsonRecord;
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

function integer(value: unknown, path: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new Error(`${path} must be a non-negative integer`);
  }
  return value as number;
}

function sha(value: unknown, path: string): string {
  const parsed = text(value, path);
  if (!SHA256.test(parsed)) throw new Error(`${path} must be SHA-256`);
  return parsed;
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

function sameJson(left: unknown, right: unknown): boolean {
  return canonicalStringify(left) === canonicalStringify(right);
}

function sha256(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function sha256Json(value: unknown): string {
  return sha256(canonicalStringify(value));
}

function pathKey(path: readonly (string | number)[]): string {
  return canonicalStringify(path);
}

const VOLATILE_TIMESTAMP_PATH_KEYS = new Set(
  VOLATILE_TIMESTAMP_PATHS.map(pathKey),
);
const NULL_TIMESTAMP_PATH_KEYS = new Set(NULL_TIMESTAMP_PATHS.map(pathKey));
const EXPECTED_TIMESTAMP_PATH_KEYS = new Set([
  ...VOLATILE_TIMESTAMP_PATH_KEYS,
  ...NULL_TIMESTAMP_PATH_KEYS,
]);

function normalizeStartingContext(
  value: unknown,
  path: readonly (string | number)[] = [],
): {
  readonly normalized: unknown;
  readonly timestampPathKeys: ReadonlySet<string>;
  readonly volatileTimestampCount: number;
} {
  if (Array.isArray(value)) {
    const normalized: unknown[] = [];
    const timestampPathKeys = new Set<string>();
    let volatileTimestampCount = 0;
    for (const [index, child] of value.entries()) {
      const result = normalizeStartingContext(child, [...path, index]);
      normalized.push(result.normalized);
      for (const key of result.timestampPathKeys) timestampPathKeys.add(key);
      volatileTimestampCount += result.volatileTimestampCount;
    }
    return { normalized, timestampPathKeys, volatileTimestampCount };
  }
  if (isRecord(value)) {
    const normalized: JsonRecord = {};
    const timestampPathKeys = new Set<string>();
    let volatileTimestampCount = 0;
    for (const [key, child] of Object.entries(value)) {
      const childPath = [...path, key];
      if (key.toLowerCase().includes("timestamp")) {
        const childPathKey = pathKey(childPath);
        timestampPathKeys.add(childPathKey);
        if (VOLATILE_TIMESTAMP_PATH_KEYS.has(childPathKey)) {
          if (typeof child !== "number" || !Number.isFinite(child)) {
            throw new Error("provider starting context has a non-finite volatile timestamp");
          }
          normalized[key] = VOLATILE_TIMESTAMP_MARKER;
          volatileTimestampCount += 1;
          continue;
        }
        if (NULL_TIMESTAMP_PATH_KEYS.has(childPathKey)) {
          if (child !== null) {
            throw new Error("provider starting context changed a schema-row timestamp null");
          }
          normalized[key] = null;
          continue;
        }
        throw new Error("provider starting context has an undocumented timestamp path");
      }
      const result = normalizeStartingContext(child, childPath);
      normalized[key] = result.normalized;
      for (const timestampPathKey of result.timestampPathKeys) {
        timestampPathKeys.add(timestampPathKey);
      }
      volatileTimestampCount += result.volatileTimestampCount;
    }
    return { normalized, timestampPathKeys, volatileTimestampCount };
  }
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "string" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return {
      normalized: value,
      timestampPathKeys: new Set<string>(),
      volatileTimestampCount: 0,
    };
  }
  throw new Error("provider starting context contains a non-canonical JSON value");
}

function verifyStartingContextBinding(
  providerStartingContext: JsonRecord,
  expected: ToolSandboxOracleStartingContextBinding,
): {
  readonly startingContextNormalizedSha256: string;
  readonly startingContextNormalizationPolicyId: typeof STARTING_CONTEXT_NORMALIZATION_POLICY;
  readonly startingContextVolatileTimestampCount: 11;
  readonly startingContextBoundExceptDocumentedVolatileTimestamps: true;
} {
  const binding = record(expected, "/oracleStartingContext");
  exactKeys(
    binding,
    ["normalizationRuleId", "normalizedContextSha256", "volatileTimestampValueCount"],
    "/oracleStartingContext",
  );
  if (
    binding["normalizationRuleId"] !== STARTING_CONTEXT_NORMALIZATION_POLICY ||
    integer(binding["volatileTimestampValueCount"], "/oracleStartingContext/volatileTimestampValueCount") !==
      VOLATILE_TIMESTAMP_PATHS.length
  ) {
    throw new Error("oracle starting-context normalization policy does not match the cross verifier");
  }
  const expectedHash = sha(
    binding["normalizedContextSha256"],
    "/oracleStartingContext/normalizedContextSha256",
  );
  const normalized = normalizeStartingContext(providerStartingContext);
  if (
    normalized.volatileTimestampCount !== VOLATILE_TIMESTAMP_PATHS.length ||
    normalized.timestampPathKeys.size !== EXPECTED_TIMESTAMP_PATH_KEYS.size ||
    [...normalized.timestampPathKeys].some(
      (timestampPath) => !EXPECTED_TIMESTAMP_PATH_KEYS.has(timestampPath),
    )
  ) {
    throw new Error("provider starting context does not contain the exact documented timestamp paths");
  }
  const normalizedHash = sha256Json(normalized.normalized);
  if (normalizedHash !== expectedHash) {
    throw new Error("provider starting context does not match the pinned clean scenario");
  }
  return {
    startingContextNormalizedSha256: normalizedHash,
    startingContextNormalizationPolicyId: STARTING_CONTEXT_NORMALIZATION_POLICY,
    startingContextVolatileTimestampCount: 11,
    startingContextBoundExceptDocumentedVolatileTimestamps: true,
  };
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
  const decoded = decodeUtf8(value, path);
  if (decoded.length === 0) return [];
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

function decodeBase64Json(value: unknown, path: string): JsonRecord {
  const encoded = text(value, path);
  const bytes = Buffer.from(encoded, "base64");
  if (bytes.toString("base64") !== encoded) {
    throw new Error(`${path} is not canonical base64`);
  }
  return parseJsonBytes(bytes, path);
}

function databases(context: JsonRecord, path: string): JsonRecord {
  return record(context["_dbs"], `${path}/_dbs`);
}

function databaseRows(
  context: JsonRecord,
  namespace: string,
  path: string,
): readonly JsonRecord[] {
  const rows = databases(context, path)[namespace];
  if (!Array.isArray(rows)) throw new Error(`${path}/_dbs/${namespace} must be an array`);
  return rows.map((row, index) => record(row, `${path}/_dbs/${namespace}/${index}`));
}

function assertKeySetEqual(left: JsonRecord, right: JsonRecord, path: string): void {
  if (!sameJson(Object.keys(left).sort(), Object.keys(right).sort())) {
    throw new Error(`${path} changed the ExecutionContext shape`);
  }
}

function assertArrayPrefix(
  prefix: readonly unknown[],
  value: readonly unknown[],
  path: string,
): void {
  if (value.length < prefix.length || !sameJson(value.slice(0, prefix.length), prefix)) {
    throw new Error(`${path} is not an exact prefix of the final trajectory`);
  }
}

function isSandboxHeadguard(value: unknown): boolean {
  if (!isRecord(value) || !Number.isSafeInteger(value["sandbox_message_index"])) {
    return false;
  }
  return Object.entries(value).every(
    ([key, child]) => key === "sandbox_message_index" || child === null,
  );
}

function withoutSandboxHeadguards(
  rows: readonly JsonRecord[],
): readonly JsonRecord[] {
  return rows.filter((row) => !isSandboxHeadguard(row));
}

function withoutSandboxHeadguardsWithPositions(
  rows: readonly JsonRecord[],
): readonly { readonly row: JsonRecord; readonly position: number }[] {
  return rows.flatMap((row, position) =>
    isSandboxHeadguard(row) ? [] : [{ row, position }],
  );
}

function rawProviderExchanges(
  input: ToolSandboxProviderProcessTraceInput,
  verified: ToolSandboxProviderProcessTraceVerification,
): readonly ProviderContextExchange[] {
  const entries = parseJsonLines(input.traceBytes, "/providerProcessTrace");
  const exchanges: ProviderContextExchange[] = [];
  let pending: { readonly processInstance: number; readonly context: JsonRecord } | undefined;
  for (const [index, entry] of entries.entries()) {
    const eventType = entry["eventType"];
    if (eventType !== "context_request_sent" && eventType !== "context_response_accepted") {
      continue;
    }
    const details = record(entry["details"], `/providerProcessTrace/${index}/details`);
    if (eventType === "context_request_sent") {
      if (pending !== undefined) throw new Error("provider context requests overlap");
      const frame = decodeBase64Json(
        details["requestFrameBase64"],
        `/providerProcessTrace/${index}/requestFrameBase64`,
      );
      pending = {
        processInstance: integer(frame["processInstance"], `/providerProcessTrace/${index}/processInstance`),
        context: record(frame["context"], `/providerProcessTrace/${index}/request/context`),
      };
      continue;
    }
    if (pending === undefined) throw new Error("provider context response has no request");
    const frame = decodeBase64Json(
      details["responseFrameBase64"],
      `/providerProcessTrace/${index}/responseFrameBase64`,
    );
    const processInstance = integer(
      frame["processInstance"],
      `/providerProcessTrace/${index}/processInstance`,
    );
    if (processInstance !== pending.processInstance) {
      throw new Error("provider context response changed process instance");
    }
    const after = record(frame["context"], `/providerProcessTrace/${index}/response/context`);
    exchanges.push({
      processInstance,
      before: pending.context,
      after,
      beforeRows: databaseRows(pending.context, "SANDBOX", `/providerProcessTrace/${index}/before`),
      afterRows: databaseRows(after, "SANDBOX", `/providerProcessTrace/${index}/after`),
    });
    pending = undefined;
  }
  if (pending !== undefined || exchanges.length !== verified.contextExchangeCount) {
    throw new Error("raw provider frames disagree with the replayed context exchange count");
  }
  return exchanges;
}

function bindProviderToTrajectory(
  input: ToolSandboxProviderProcessTraceInput,
  finalContext: JsonRecord,
): ProviderTrajectoryBinding {
  const verified = verifyToolSandboxProviderProcessTrace(input);
  const exchanges = rawProviderExchanges(input, verified);
  const first = exchanges[0];
  if (first === undefined) throw new Error("provider trace has no context exchange");
  assertKeySetEqual(first.before, finalContext, "/executionContext");
  assertKeySetEqual(
    databases(first.before, "/providerFirstContext"),
    databases(finalContext, "/executionContext"),
    "/executionContext/_dbs",
  );
  const finalRows = databaseRows(finalContext, "SANDBOX", "/executionContext");
  const normalizedFinal = withoutSandboxHeadguardsWithPositions(finalRows);
  const providerInstanceByFinalPosition = new Map<number, number>();
  let appendedAgentMessageCount = 0;
  for (const [index, exchange] of exchanges.entries()) {
    const normalizedBefore = withoutSandboxHeadguards(exchange.beforeRows);
    const normalizedAfter = withoutSandboxHeadguards(exchange.afterRows);
    assertArrayPrefix(
      normalizedBefore,
      normalizedFinal.map(({ row }) => row),
      `/providerExchange/${index}/before`,
    );
    assertArrayPrefix(
      normalizedAfter,
      normalizedFinal.map(({ row }) => row),
      `/providerExchange/${index}/after`,
    );
    const replayed = verified.contextExchanges[index];
    if (
      replayed === undefined ||
      replayed.processInstance !== exchange.processInstance ||
      replayed.contextHashBefore !== sha256Json(exchange.before) ||
      replayed.contextHashAfter !== sha256Json(exchange.after) ||
      replayed.sandboxMessageCountBefore !== exchange.beforeRows.length ||
      replayed.sandboxMessageCountAfter !== exchange.afterRows.length
    ) {
      throw new Error("decoded provider frames disagree with raw provider replay");
    }
    for (
      let normalizedPosition = normalizedBefore.length;
      normalizedPosition < normalizedAfter.length;
      normalizedPosition += 1
    ) {
      const finalPosition = normalizedFinal[normalizedPosition]?.position;
      if (finalPosition === undefined) {
        throw new Error("provider appended row has no normalized final-trajectory position");
      }
      if (providerInstanceByFinalPosition.has(finalPosition)) {
        throw new Error("provider exchanges claim the same appended trajectory position twice");
      }
      providerInstanceByFinalPosition.set(finalPosition, exchange.processInstance);
      appendedAgentMessageCount += 1;
    }
  }
  const normalizedBaselineLength = withoutSandboxHeadguards(first.beforeRows).length;
  for (
    let normalizedPosition = normalizedBaselineLength;
    normalizedPosition < normalizedFinal.length;
    normalizedPosition += 1
  ) {
    const { row, position } = normalizedFinal[normalizedPosition]!;
    if (row["sender"] === "AGENT" && !providerInstanceByFinalPosition.has(position)) {
      throw new Error(
        `final trajectory contains an AGENT message at position ${position} not returned by the provider process`,
      );
    }
  }
  if (verified.restartCount === 1) {
    const successor = exchanges.find((exchange) => exchange.processInstance === 2);
    if (
      successor === undefined ||
      verified.lostResponseContextHash === undefined ||
      sha256Json(successor.before) !== verified.lostResponseContextHash
    ) {
      throw new Error("successor provider request is not the exact retained lost-response context");
    }
  }
  return {
    verified,
    exchanges,
    firstRequestNormalizedMessageCount: normalizedBaselineLength,
    providerInstanceByFinalPosition,
    appendedAgentMessageCount,
  };
}

function callId(row: JsonRecord, path: string): string {
  if (typeof row["openai_tool_call_id"] === "string" && row["openai_tool_call_id"].length > 0) {
    return row["openai_tool_call_id"];
  }
  const content = text(row["content"], `${path}/content`);
  return `call-${sha256(content).slice(0, 24)}`;
}

function callToolName(row: JsonRecord, path: string): string {
  if (typeof row["openai_function_name"] === "string" && row["openai_function_name"].length > 0) {
    return row["openai_function_name"];
  }
  const content = text(row["content"], `${path}/content`);
  const parameterized = /\n[^\n=]+_response = ([A-Za-z_][A-Za-z0-9_]*)\(\*\*/u.exec(content);
  const cli = /(?:^|[^A-Za-z0-9_])([A-Za-z_][A-Za-z0-9_]*)\(/gu;
  if (parameterized?.[1] !== undefined) return parameterized[1];
  let candidate: RegExpExecArray | null;
  let last: string | undefined;
  while ((candidate = cli.exec(content)) !== null) {
    const name = candidate[1];
    if (name !== undefined && name !== "print" && name !== "repr") last = name;
  }
  if (last === undefined) throw new Error(`${path} does not encode a recognizable tool name`);
  return last;
}

function trajectoryInteractions(
  finalContext: JsonRecord,
  provider: ProviderTrajectoryBinding,
): readonly TrajectoryInteraction[] {
  const rows = databaseRows(finalContext, "SANDBOX", "/executionContext");
  const calls = rows.flatMap((row, position) =>
    provider.providerInstanceByFinalPosition.has(position) &&
    row["sender"] === "AGENT" &&
    row["recipient"] === "EXECUTION_ENVIRONMENT"
      ? [{ row, position }]
      : [],
  );
  return calls.map(({ row, position }, ordinal) => {
    const path = `/executionContext/_dbs/SANDBOX/${position}`;
    const id = callId(row, path);
    const toolName = callToolName(row, path);
    const nextCallPosition = calls[ordinal + 1]?.position ?? rows.length;
    const candidates = rows.flatMap((candidate, responsePosition) => {
      if (
        responsePosition <= position ||
        responsePosition >= nextCallPosition ||
        candidate["sender"] !== "EXECUTION_ENVIRONMENT" ||
        candidate["recipient"] !== "AGENT"
      ) {
        return [];
      }
      const responseCallId = candidate["openai_tool_call_id"];
      if (typeof row["openai_tool_call_id"] === "string" && responseCallId !== id) {
        return [];
      }
      return [{ candidate, responsePosition }];
    });
    if (candidates.length !== 1) {
      throw new Error(`${path} does not have exactly one matching execution-environment response`);
    }
    const matched = candidates[0]!;
    const processInstance = provider.providerInstanceByFinalPosition.get(position);
    if (processInstance === undefined) {
      throw new Error(`${path} is not bound to an accepted provider response frame`);
    }
    return {
      ordinal,
      callPosition: position,
      responsePosition: matched.responsePosition,
      processInstance,
      callId: id,
      toolName,
      call: row,
      response: matched.candidate,
      responseIndex: integer(
        matched.candidate["sandbox_message_index"],
        `/executionContext/_dbs/SANDBOX/${matched.responsePosition}/sandbox_message_index`,
      ),
    };
  });
}

function toolTraceExecution(
  interaction: TrajectoryInteraction,
  requireTrace: boolean,
): ToolTraceExecution | undefined {
  const path = `/trajectoryInteraction/${interaction.ordinal}/response`;
  const rawTrace = interaction.response["tool_trace"];
  if (rawTrace === null && !requireTrace) return undefined;
  if (!Array.isArray(rawTrace) || rawTrace.length !== 1 || typeof rawTrace[0] !== "string") {
    throw new Error(`${path}/tool_trace must retain exactly one executed tool record`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawTrace[0]) as unknown;
  } catch {
    throw new Error(`${path}/tool_trace/0 is not JSON`);
  }
  const trace = record(parsed, `${path}/tool_trace/0`);
  exactKeys(trace, ["tool_name", "arguments", "result"], `${path}/tool_trace/0`);
  const arguments_ = record(trace["arguments"], `${path}/tool_trace/0/arguments`);
  if (trace["tool_name"] !== interaction.toolName) {
    throw new Error(`${path}/tool_trace does not match the provider tool call`);
  }
  const content = text(interaction.response["content"], `${path}/content`);
  const exception = interaction.response["tool_call_exception"];
  if (exception !== null && typeof exception !== "string") {
    throw new Error(`${path}/tool_call_exception must be text or null`);
  }
  const lostResponse = content === LOST_RESPONSE || exception === LOST_RESPONSE;
  if (lostResponse && (content !== LOST_RESPONSE || exception !== LOST_RESPONSE)) {
    throw new Error(`${path} only partially records the lost-response replacement`);
  }
  const succeeded = lostResponse || exception === null;
  let originalResponseContent = content;
  if (interaction.toolName === "send_message_with_phone_number") {
    if (succeeded) {
      const result = text(trace["result"], `${path}/tool_trace/0/result`);
      if (!LOWERCASE_UUID.test(result)) {
        throw new Error(`${path} successful send-message result is not a lowercase UUID`);
      }
      originalResponseContent = `'${result}'`;
      if (!lostResponse && content !== originalResponseContent) {
        throw new Error(`${path} does not retain the exact send-message result content`);
      }
    }
  }
  return {
    interaction,
    arguments: arguments_,
    result: trace["result"],
    originalResponseContent,
    lostResponse,
    succeeded,
  };
}

function rawSidecarClients(
  input: ToolSandboxSidecarVerificationInput,
): readonly SidecarClientRecord[] {
  return parseJsonLines(input.clientTraceBytes, "/sidecarClientTrace").map(
    (entry, index) => {
      const command = entry["command"];
      if (command !== "admit-tool" && command !== "record-tool-outcome") {
        throw new Error(`/sidecarClientTrace/${index}/command is invalid`);
      }
      return {
        command,
        request: record(entry["request"], `/sidecarClientTrace/${index}/request`),
        response: record(entry["response"], `/sidecarClientTrace/${index}/response`),
      };
    },
  );
}

function bindSidecarToTrajectory(
  input: ToolSandboxSidecarVerificationInput,
  interactions: readonly TrajectoryInteraction[],
): {
  readonly verified: ToolSandboxSidecarVerification;
  readonly bindings: readonly SidecarInteractionBinding[];
  readonly admitCount: number;
  readonly outcomeCount: number;
} {
  const verified = verifyToolSandboxSidecarEvidence(input);
  const clients = rawSidecarClients(input);
  const bindings: SidecarInteractionBinding[] = [];
  let cursor = 0;
  let admitCount = 0;
  let outcomeCount = 0;
  for (const interaction of interactions) {
    const admit = clients[cursor++];
    if (admit?.command !== "admit-tool") {
      throw new Error(`trajectory tool call ${interaction.ordinal} has no next sidecar admission`);
    }
    admitCount += 1;
    if (
      admit.request["toolCallId"] !== interaction.callId ||
      admit.request["toolName"] !== interaction.toolName
    ) {
      throw new Error(`sidecar admission ${admitCount} does not match its trajectory tool call`);
    }
    const arguments_ = record(
      admit.request["arguments"],
      `/sidecarAdmission/${admitCount}/arguments`,
    );
    const decision = admit.response["decision"];
    if (decision !== "allow" && decision !== "block") {
      throw new Error(`sidecar admission ${admitCount} has an invalid decision`);
    }
    const proposalId = text(
      admit.response["proposalId"],
      `/sidecarAdmission/${admitCount}/proposalId`,
    );
    if (decision === "block") {
      const responseForAgent = text(
        admit.response["responseForAgent"],
        `/sidecarAdmission/${admitCount}/responseForAgent`,
      );
      if (
        interaction.response["content"] !== responseForAgent ||
        interaction.response["tool_call_exception"] !== responseForAgent ||
        interaction.response["tool_trace"] !== null
      ) {
        throw new Error("blocked sidecar decision does not exactly match the trajectory response");
      }
      const prior = [...bindings].reverse().find(
        (binding) =>
          binding.decision === "allow" &&
          binding.interaction.toolName === interaction.toolName &&
          binding.execution !== undefined,
      );
      if (prior === undefined || !sameJson(prior.execution?.arguments, arguments_)) {
        throw new Error("blocked sidecar call arguments are not bound to a prior executed call");
      }
      bindings.push({
        interaction,
        admitRequest: admit.request,
        admitResponse: admit.response,
        decision,
      });
      continue;
    }
    const execution = toolTraceExecution(interaction, true)!;
    if (!sameJson(execution.arguments, arguments_)) {
      throw new Error("sidecar admission arguments do not match the executed trajectory tool trace");
    }
    const outcome = clients[cursor++];
    if (outcome?.command !== "record-tool-outcome") {
      throw new Error(`allowed sidecar admission ${admitCount} has no next outcome record`);
    }
    outcomeCount += 1;
    if (
      outcome.request["proposalId"] !== proposalId ||
      outcome.request["toolCallId"] !== interaction.callId ||
      outcome.request["toolName"] !== interaction.toolName ||
      !sameJson(outcome.request["arguments"], arguments_)
    ) {
      throw new Error("sidecar outcome identity/arguments do not match its admission and trajectory");
    }
    if (
      outcome.request["succeeded"] !== execution.succeeded ||
      outcome.request["responseHash"] !== sha256(execution.originalResponseContent)
    ) {
      throw new Error("sidecar outcome does not bind the exact original trajectory response");
    }
    if (outcome.response["proposalId"] !== proposalId) {
      throw new Error("sidecar outcome receipt does not match its proposal");
    }
    sha(
      outcome.response["targetSideEffectReceiptHash"],
      `/sidecarOutcome/${outcomeCount}/targetSideEffectReceiptHash`,
    );
    bindings.push({
      interaction,
      admitRequest: admit.request,
      admitResponse: admit.response,
      decision,
      execution,
      outcomeRequest: outcome.request,
      outcomeResponse: outcome.response,
    });
  }
  if (cursor !== clients.length) {
    throw new Error("sidecar trace has extra admissions or outcomes not present in the trajectory");
  }
  return { verified, bindings, admitCount, outcomeCount };
}

function bindNativeExecutions(
  interactions: readonly TrajectoryInteraction[],
): readonly SidecarInteractionBinding[] {
  return interactions.map((interaction) => ({
    interaction,
    admitRequest: {},
    admitResponse: {},
    decision: "allow" as const,
    execution: toolTraceExecution(interaction, true)!,
  }));
}

function verifyMessagingDelta(
  finalContext: JsonRecord,
  execution: ToolTraceExecution,
): void {
  if (execution.interaction.toolName !== "send_message_with_phone_number") return;
  const messageId = text(execution.result, "/sendExecution/result");
  const phoneNumber = text(execution.arguments["phone_number"], "/sendExecution/phone_number");
  const content = text(execution.arguments["content"], "/sendExecution/content");
  const rows = databaseRows(finalContext, "MESSAGING", "/executionContext");
  const currentIndex = execution.interaction.responseIndex;
  const priorIndexes = rows.flatMap((row) => {
    const index = row["sandbox_message_index"];
    return Number.isSafeInteger(index) && (index as number) < currentIndex &&
      typeof row["message_id"] === "string"
      ? [index as number]
      : [];
  });
  if (priorIndexes.length === 0) {
    throw new Error("send-message mutation has no prior MESSAGING snapshot to diff");
  }
  const previousIndex = Math.max(...priorIndexes);
  const previous = rows.filter((row) => row["sandbox_message_index"] === previousIndex);
  const current = rows.filter((row) => row["sandbox_message_index"] === currentIndex);
  const snapshotPayload = (row: JsonRecord): JsonRecord => {
    const { sandbox_message_index: _ignored, ...payload } = row;
    return payload;
  };
  if (
    current.length !== previous.length + 1 ||
    !sameJson(
      current.slice(0, previous.length).map(snapshotPayload),
      previous.map(snapshotPayload),
    )
  ) {
    throw new Error("send-message MESSAGING snapshot is not an exact one-row delta");
  }
  const added = current.at(-1)!;
  if (
    added["message_id"] !== messageId ||
    added["recipient_phone_number"] !== phoneNumber ||
    added["content"] !== content ||
    !Number.isFinite(added["creation_timestamp"])
  ) {
    throw new Error("send-message MESSAGING delta does not match the executed tool result/arguments");
  }
  if (
    rows.some(
      (row) =>
        Number.isSafeInteger(row["sandbox_message_index"]) &&
        (row["sandbox_message_index"] as number) < currentIndex &&
        row["message_id"] === messageId,
    )
  ) {
    throw new Error("send-message result UUID already existed before the claimed mutation");
  }
}

function nativeTargetReceipt(execution: ToolTraceExecution): string {
  return sha256Json({
    callId: execution.interaction.callId,
    toolName: execution.interaction.toolName,
    arguments: execution.arguments,
    succeeded: true,
    responseHash: sha256(execution.originalResponseContent),
  });
}

function verifyFaultBinding(
  input: ToolSandboxTrajectoryCrossVerificationInput,
  provider: ProviderTrajectoryBinding,
  bindings: readonly SidecarInteractionBinding[],
): FaultBindingVerification {
  const fault = input.providerProcess.faultEvidence;
  const lost = bindings.filter((binding) => binding.execution?.lostResponse === true);
  if (fault === undefined || fault.status === "trigger_not_reached") {
    if (lost.length !== 0 || provider.verified.restartCount !== 0) {
      throw new Error("trajectory contains an unclaimed lost-response/restart intervention");
    }
    return {
      lostResponseRestartBindingCount: 0,
      postRestartExactRetryCount: 0,
      postRestartRetryDisposition: "not_applicable",
      postRestartRetryAllowedCount: 0,
      postRestartRetryBlockedCount: 0,
      postRestartRetryExecutedCount: 0,
      postRestartRetrySuccessfulSendCount: 0,
      postRestartRetryDuplicateResponseBlockCount: 0,
      duplicateTargetSideEffectCount: 0,
    };
  }
  if (lost.length !== 1 || provider.verified.restartCount !== 1) {
    throw new Error("applied fault must bind exactly one lost response and one OS restart");
  }
  const target = lost[0]!;
  const execution = target.execution!;
  if (
    execution.interaction.callId !== fault.targetCallId ||
    execution.interaction.toolName !== "send_message_with_phone_number" ||
    execution.interaction.responseIndex !== fault.appliedAtTurn ||
    execution.interaction.processInstance !== 1
  ) {
    throw new Error("lost response does not match the claimed initial target call/turn/process");
  }
  const retainedReceipt = input.providerProcess.arm === "native"
    ? nativeTargetReceipt(execution)
    : sha(
        target.outcomeResponse?.["targetSideEffectReceiptHash"],
        "/fault/targetSideEffectReceiptHash",
      );
  if (retainedReceipt !== fault.targetSideEffectReceiptHash) {
    throw new Error("lost-response fault receipt does not match the target-side outcome");
  }
  if (input.sidecar !== undefined && target.admitRequest["sessionId"] !== "session-001") {
    throw new Error("fault target was not admitted by the initial provider session");
  }
  const retries = bindings.filter(
    (binding) =>
      binding.interaction.ordinal > target.interaction.ordinal &&
      binding.interaction.toolName === "send_message_with_phone_number" &&
      (binding.execution !== undefined
        ? sameJson(binding.execution.arguments, execution.arguments)
        : sameJson(binding.admitRequest["arguments"], execution.arguments)),
  );
  for (const retry of retries) {
    if (
      retry.interaction.processInstance !== 2 ||
      (input.sidecar !== undefined &&
        retry.admitRequest["sessionId"] !== fault.restartedAgentSessionId)
    ) {
      throw new Error(
        "post-restart exact retry does not bind the successor provider process/session",
      );
    }
  }
  if (
    provider.verified.successorContextResponseCount < 1 ||
    !provider.verified.actualOsProcessRestartVerified
  ) {
    throw new Error("fault evidence lacks a verified successor context response after OS restart");
  }
  const allowed = retries.filter((retry) => retry.decision === "allow");
  const blocked = retries.filter((retry) => retry.decision === "block");
  const executed = retries.filter((retry) => retry.execution !== undefined);
  const successful = executed.filter((retry) => retry.execution?.succeeded === true);
  const duplicateResponseBlocks = blocked.filter(
    (retry) =>
      retry.interaction.response["content"] === DUPLICATE_RESPONSE &&
      retry.interaction.response["tool_call_exception"] === DUPLICATE_RESPONSE,
  );
  let disposition: FaultBindingVerification["postRestartRetryDisposition"];
  if (retries.length === 0) {
    disposition = "not_observed";
  } else if (blocked.length === retries.length) {
    disposition = "blocked";
  } else if (
    executed.length === retries.length &&
    successful.length === retries.length
  ) {
    disposition = "executed_succeeded";
  } else if (
    executed.length === retries.length &&
    successful.length === 0
  ) {
    disposition = "executed_failed";
  } else {
    disposition = "mixed";
  }
  return {
    lostResponseRestartBindingCount: 1,
    postRestartExactRetryCount: retries.length,
    postRestartRetryDisposition: disposition,
    postRestartRetryAllowedCount: allowed.length,
    postRestartRetryBlockedCount: blocked.length,
    postRestartRetryExecutedCount: executed.length,
    postRestartRetrySuccessfulSendCount: successful.length,
    postRestartRetryDuplicateResponseBlockCount: duplicateResponseBlocks.length,
    duplicateTargetSideEffectCount: successful.length,
  };
}

/**
 * Replays raw provider and sidecar evidence, then accounts for their effects in
 * the exact upstream ExecutionContext. This is a cross-boundary structural
 * proof only; the unchanged upstream oracle remains the outcome authority.
 */
export function verifyToolSandboxTrajectoryCrossEvidence(
  input: ToolSandboxTrajectoryCrossVerificationInput,
): ToolSandboxTrajectoryCrossVerification {
  const finalContext = parseJsonBytes(input.executionContextBytes, "/executionContext");
  const provider = bindProviderToTrajectory(input.providerProcess, finalContext);
  const startingContext = verifyStartingContextBinding(
    provider.exchanges[0]!.before,
    input.oracleStartingContext,
  );
  const interactions = trajectoryInteractions(finalContext, provider);
  let sidecarVerified: ToolSandboxSidecarVerification | undefined;
  let bindings: readonly SidecarInteractionBinding[];
  let sidecarAdmitCount = 0;
  let sidecarOutcomeCount = 0;
  if (input.providerProcess.arm === "native") {
    if (input.sidecar !== undefined) throw new Error("native arm must not provide sidecar evidence");
    bindings = bindNativeExecutions(interactions);
  } else {
    if (input.sidecar === undefined) throw new Error("sham/substrate arm requires raw sidecar evidence");
    if (
      input.sidecar.arm !== input.providerProcess.arm ||
      input.sidecar.attemptId !== input.providerProcess.attemptId ||
      input.sidecar.evaluationTrack !== input.providerProcess.evaluationTrack
    ) {
      throw new Error("sidecar and provider raw evidence do not share one attempt identity");
    }
    const sidecar = bindSidecarToTrajectory(input.sidecar, interactions);
    sidecarVerified = sidecar.verified;
    bindings = sidecar.bindings;
    sidecarAdmitCount = sidecar.admitCount;
    sidecarOutcomeCount = sidecar.outcomeCount;
  }
  const successfulSends = bindings.flatMap((binding) =>
    binding.execution?.interaction.toolName === "send_message_with_phone_number" &&
      binding.execution.succeeded
      ? [binding.execution]
      : [],
  );
  for (const execution of successfulSends) verifyMessagingDelta(finalContext, execution);
  const faultBinding = verifyFaultBinding(
    input,
    provider,
    bindings,
  );
  const body = {
    schemaVersion: "pm.public-eval.toolsandbox-trajectory-cross-verification.v2" as const,
    attemptId: input.providerProcess.attemptId,
    arm: input.providerProcess.arm,
    evaluationTrack: input.providerProcess.evaluationTrack,
    executionContextSha256: sha256(input.executionContextBytes),
    providerTraceSha256: provider.verified.traceSha256,
    providerContextExchangeCount: provider.verified.contextExchangeCount,
    providerAppendedAgentMessageCount: provider.appendedAgentMessageCount,
    providerBoundToolCallCount: interactions.length,
    ...startingContext,
    sidecarClientTraceSha256: sidecarVerified?.clientTraceSha256 ?? null,
    sidecarAdmitCount,
    sidecarOutcomeCount,
    successfulSendCount: successfulSends.length,
    messagingDeltaCount: successfulSends.length,
    restartCount: provider.verified.restartCount,
    successorContextResponseCount: provider.verified.successorContextResponseCount,
    ...faultBinding,
  };
  return { ...body, crossVerificationHash: sha256Json(body) };
}
