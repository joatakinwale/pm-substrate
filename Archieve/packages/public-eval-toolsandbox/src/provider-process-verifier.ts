import { createHash } from "node:crypto";

import type {
  ToolSandboxArm,
  ToolSandboxEvaluationTrack,
  ToolSandboxFaultEvidence,
} from "./index.js";

const SHA256 = /^[a-f0-9]{64}$/u;
const NONCE = /^[a-f0-9]{48}$/u;
const TRACE_SCHEMA =
  "pm.public-eval.toolsandbox-provider-process-trace-entry.v2";
const INIT_SCHEMA = "pm.public-eval.toolsandbox-provider-worker-init.v1";
const HANDSHAKE_SCHEMA =
  "pm.public-eval.toolsandbox-provider-worker-handshake.v1";
const REQUEST_SCHEMA =
  "pm.public-eval.toolsandbox-provider-worker-request.v1";
const RESPONSE_SCHEMA =
  "pm.public-eval.toolsandbox-provider-worker-response.v1";
const RESTART_SEMANTICS =
  "provider_agent_os_process_group_sigkill_wait_then_fresh_process";
const LOST_RESPONSE =
  "The tool response was lost while the provider agent session restarted. The target-side outcome is unknown to this session.";
const SANDBOX = "SANDBOX";

type JsonRecord = Record<string, unknown>;

export interface ToolSandboxProviderProcessTraceInput {
  readonly tracePath: string;
  readonly traceBytes: Uint8Array;
  readonly summary: unknown;
  readonly attemptId: string;
  readonly arm: ToolSandboxArm;
  readonly evaluationTrack: ToolSandboxEvaluationTrack;
  readonly faultEvidence?: ToolSandboxFaultEvidence;
  readonly runnerSha256: string;
  readonly workerSha256: string;
  readonly pythonExecutableSha256: string;
}

export interface ToolSandboxVerifiedProviderContextExchange {
  readonly processInstance: number;
  readonly requestId: string;
  readonly endingIndex: number | null;
  readonly contextHashBefore: string;
  readonly contextHashAfter: string;
  readonly sandboxMessageCountBefore: number;
  readonly sandboxMessageCountAfter: number;
  readonly sandboxMessagesSha256Before: string;
  readonly sandboxMessagesSha256After: string;
  readonly appendedAgentMessageCount: number;
  readonly appendedAgentMessages: readonly Readonly<Record<string, unknown>>[];
}

export interface ToolSandboxProviderProcessTraceVerification {
  readonly traceSha256: string;
  readonly traceHeadHash: string;
  readonly traceEntryCount: number;
  readonly processInstanceCount: number;
  readonly restartCount: number;
  readonly processIds: readonly number[];
  readonly processNonces: readonly string[];
  readonly providerAgent: string;
  readonly contextExchangeCount: number;
  readonly contextExchanges: readonly ToolSandboxVerifiedProviderContextExchange[];
  readonly successorContextResponseCount: number;
  readonly finalAcceptedContextHashAfter: string;
  readonly lostResponseContextHash?: string;
  readonly actualOsProcessRestartVerified: boolean;
  readonly restartSemantics: typeof RESTART_SEMANTICS;
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

function sha256Bytes(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function sha256Json(value: unknown): string {
  return sha256Bytes(Buffer.from(canonicalStringify(value), "utf8"));
}

function canonicalEqual(left: unknown, right: unknown): boolean {
  return canonicalStringify(left) === canonicalStringify(right);
}

interface TraceEntry {
  readonly sequence: number;
  readonly eventType: string;
  readonly details: JsonRecord;
  readonly entryHash: string;
}

function parseTrace(input: ToolSandboxProviderProcessTraceInput): readonly TraceEntry[] {
  const traceText = Buffer.from(input.traceBytes).toString("utf8");
  if (!traceText.endsWith("\n")) {
    throw new Error("provider process trace must end with a newline");
  }
  const lines = traceText.slice(0, -1).split("\n");
  if (lines.length === 0 || lines.some((line) => line.length === 0)) {
    throw new Error("provider process trace contains an empty record");
  }
  let previousHash: string | null = null;
  let previousTime = "";
  return lines.map((line, index) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line) as unknown;
    } catch {
      throw new Error(`provider process trace line ${index + 1} is not JSON`);
    }
    const root = record(parsed, `/providerProcessTrace/${index}`);
    exactKeys(
      root,
      [
        "schemaVersion", "sequence", "previousEntryHash", "attemptId", "arm",
        "evaluationTrack", "eventType", "recordedAt", "details", "entryHash",
      ],
      `/providerProcessTrace/${index}`,
    );
    const sequence = integer(root["sequence"], `/providerProcessTrace/${index}/sequence`, 1);
    if (sequence !== index + 1) throw new Error("provider process trace sequence is not contiguous");
    if (
      root["schemaVersion"] !== TRACE_SCHEMA ||
      root["attemptId"] !== input.attemptId ||
      root["arm"] !== input.arm ||
      root["evaluationTrack"] !== input.evaluationTrack ||
      root["previousEntryHash"] !== previousHash
    ) {
      throw new Error("provider process trace identity/hash chain does not match the attempt");
    }
    const recordedAt = text(root["recordedAt"], `/providerProcessTrace/${index}/recordedAt`);
    const epoch = Date.parse(recordedAt);
    if (!Number.isFinite(epoch) || new Date(epoch).toISOString() !== recordedAt) {
      throw new Error("provider process trace timestamp is not normalized ISO-8601");
    }
    if (previousTime !== "" && recordedAt < previousTime) {
      throw new Error("provider process trace timestamps move backwards");
    }
    const details = record(root["details"], `/providerProcessTrace/${index}/details`);
    const entryHash = sha(root["entryHash"], `/providerProcessTrace/${index}/entryHash`);
    const { entryHash: _ignored, ...body } = root;
    if (sha256Json(body) !== entryHash) {
      throw new Error("provider process trace entry hash does not recompute");
    }
    previousHash = entryHash;
    previousTime = recordedAt;
    return {
      sequence,
      eventType: text(root["eventType"], `/providerProcessTrace/${index}/eventType`),
      details,
      entryHash,
    };
  });
}

function decodeFrame(details: JsonRecord, prefix: string, path: string): JsonRecord {
  const encoded = text(details[`${prefix}Base64`], `${path}/${prefix}Base64`);
  if (
    encoded.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]*={0,2}$/u.test(encoded)
  ) {
    throw new Error(`${path}/${prefix}Base64 is not canonical base64`);
  }
  const raw = Buffer.from(encoded, "base64");
  if (raw.toString("base64") !== encoded) {
    throw new Error(`${path}/${prefix}Base64 is not canonical base64`);
  }
  if (
    integer(details[`${prefix}ByteLength`], `${path}/${prefix}ByteLength`, 1) !== raw.length ||
    sha(details[`${prefix}Sha256`], `${path}/${prefix}Sha256`) !== sha256Bytes(raw)
  ) {
    throw new Error(`${path}/${prefix} bytes do not match their length/hash`);
  }
  const frameText = raw.toString("utf8");
  if (!frameText.endsWith("\n")) throw new Error(`${path}/${prefix} is not a JSONL frame`);
  let parsed: unknown;
  try {
    parsed = JSON.parse(frameText.slice(0, -1)) as unknown;
  } catch {
    throw new Error(`${path}/${prefix} is not JSON`);
  }
  const frame = record(parsed, `${path}/${prefix}`);
  if (`${canonicalStringify(frame)}\n` !== frameText) {
    throw new Error(`${path}/${prefix} is not the exact canonical JSON frame`);
  }
  return frame;
}

interface ProcessIdentity {
  readonly processInstance: number;
  readonly pid: number;
  readonly processGroupId: number;
  readonly processNonce: string;
}

const IDENTITY_KEYS = ["processInstance", "pid", "processGroupId", "processNonce"] as const;

function identity(details: JsonRecord, path: string): ProcessIdentity {
  const processInstance = integer(details["processInstance"], `${path}/processInstance`, 1);
  const pid = integer(details["pid"], `${path}/pid`, 1);
  const processGroupId = integer(details["processGroupId"], `${path}/processGroupId`, 1);
  const processNonce = text(details["processNonce"], `${path}/processNonce`);
  if (pid !== processGroupId) {
    throw new Error(`${path} does not prove an isolated worker-led process group`);
  }
  if (!NONCE.test(processNonce)) throw new Error(`${path}/processNonce is invalid`);
  return { processInstance, pid, processGroupId, processNonce };
}

function sameIdentity(left: ProcessIdentity, right: ProcessIdentity): boolean {
  return canonicalEqual(left, right);
}

function expectEvent(entries: readonly TraceEntry[], index: number, eventType: string): TraceEntry {
  const entry = entries[index];
  if (entry === undefined || entry.eventType !== eventType) {
    throw new Error(`provider process trace expected ${eventType} at event ${index + 1}`);
  }
  return entry;
}

function validateSummary(
  input: ToolSandboxProviderProcessTraceInput,
  entries: readonly TraceEntry[],
): { readonly processInstanceCount: number; readonly restartCount: number } {
  const summary = record(input.summary, "/providerProcessSummary");
  exactKeys(
    summary,
    [
      "tracePath", "traceSha256", "traceHeadHash", "traceEntryCount",
      "processInstanceCount", "restartCount", "restartSemantics", "runnerSha256",
      "workerSha256", "pythonExecutableSha256",
    ],
    "/providerProcessSummary",
  );
  if (
    summary["tracePath"] !== input.tracePath ||
    sha(summary["traceSha256"], "/providerProcessSummary/traceSha256") !== sha256Bytes(input.traceBytes) ||
    sha(summary["traceHeadHash"], "/providerProcessSummary/traceHeadHash") !== entries.at(-1)?.entryHash ||
    integer(summary["traceEntryCount"], "/providerProcessSummary/traceEntryCount") !== entries.length ||
    summary["restartSemantics"] !== RESTART_SEMANTICS ||
    sha(summary["runnerSha256"], "/providerProcessSummary/runnerSha256") !== input.runnerSha256 ||
    sha(summary["workerSha256"], "/providerProcessSummary/workerSha256") !== input.workerSha256 ||
    sha(summary["pythonExecutableSha256"], "/providerProcessSummary/pythonExecutableSha256") !== input.pythonExecutableSha256
  ) {
    throw new Error("provider process summary does not bind the raw process trace/runtime");
  }
  return {
    processInstanceCount: integer(summary["processInstanceCount"], "/providerProcessSummary/processInstanceCount", 1),
    restartCount: integer(summary["restartCount"], "/providerProcessSummary/restartCount"),
  };
}

function sameKeySet(left: JsonRecord, right: JsonRecord): boolean {
  return canonicalEqual(Object.keys(left).sort(), Object.keys(right).sort());
}

function sandboxRows(context: JsonRecord, path: string): readonly unknown[] {
  const databases = record(context["_dbs"], `${path}/_dbs`);
  const rows = databases[SANDBOX];
  if (!Array.isArray(rows)) throw new Error(`${path}/_dbs/SANDBOX must be an array`);
  return rows;
}

function assertArrayPrefix(prefix: readonly unknown[], value: readonly unknown[], path: string): void {
  if (value.length < prefix.length || !canonicalEqual(value.slice(0, prefix.length), prefix)) {
    throw new Error(`${path} is unrelated to the previously accepted provider context`);
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

function withoutSandboxHeadguards(rows: readonly unknown[]): readonly unknown[] {
  return rows.filter((row) => !isSandboxHeadguard(row));
}

function validateContextTransition(
  before: JsonRecord,
  after: JsonRecord,
  path: string,
): {
  readonly beforeRows: readonly unknown[];
  readonly afterRows: readonly unknown[];
  readonly appended: readonly JsonRecord[];
} {
  if (!sameKeySet(before, after)) throw new Error(`${path} changed ExecutionContext shape`);
  const beforeDatabases = record(before["_dbs"], `${path}/before/_dbs`);
  const afterDatabases = record(after["_dbs"], `${path}/after/_dbs`);
  if (!sameKeySet(beforeDatabases, afterDatabases)) {
    throw new Error(`${path} changed ExecutionContext databases`);
  }
  for (const key of Object.keys(before)) {
    if (key !== "_dbs" && !canonicalEqual(before[key], after[key])) {
      throw new Error(`${path} changed ExecutionContext field ${key}`);
    }
  }
  for (const namespace of Object.keys(beforeDatabases)) {
    if (namespace !== SANDBOX && !canonicalEqual(beforeDatabases[namespace], afterDatabases[namespace])) {
      throw new Error(`${path} changed non-message database ${namespace}`);
    }
  }
  const beforeRows = sandboxRows(before, `${path}/before`);
  const afterRows = sandboxRows(after, `${path}/after`);
  assertArrayPrefix(beforeRows, afterRows, `${path}/after/SANDBOX`);
  const appended = afterRows.slice(beforeRows.length).map((row, index) => {
    const parsed = record(row, `${path}/appended/${index}`);
    if (parsed["sender"] !== "AGENT") throw new Error(`${path} appended a non-agent message`);
    const expectedIndex = beforeRows.reduce<number>(
      (highest, candidate) => isRecord(candidate) && Number.isSafeInteger(candidate["sandbox_message_index"])
        ? Math.max(highest, candidate["sandbox_message_index"] as number)
        : highest,
      -1,
    ) + index + 1;
    if (parsed["sandbox_message_index"] !== expectedIndex) {
      throw new Error(`${path} appended a non-monotonic message index`);
    }
    if (!["USER", "EXECUTION_ENVIRONMENT"].includes(String(parsed["recipient"]))) {
      throw new Error(`${path} appended an invalid agent-message recipient`);
    }
    return parsed;
  });
  return { beforeRows, afterRows, appended };
}

/** Replays exact provider frames and the successful worker lifecycle. */
export function verifyToolSandboxProviderProcessTrace(
  input: ToolSandboxProviderProcessTraceInput,
): ToolSandboxProviderProcessTraceVerification {
  for (const [value, path] of [
    [input.runnerSha256, "/runnerSha256"],
    [input.workerSha256, "/workerSha256"],
    [input.pythonExecutableSha256, "/pythonExecutableSha256"],
  ] as const) sha(value, path);
  const entries = parseTrace(input);
  const summary = validateSummary(input, entries);
  let cursor = 0;
  const initialized = expectEvent(entries, cursor++, "supervisor_initialized");
  exactKeys(
    initialized.details,
    ["runnerPid", "runnerPpid", "runnerSha256", "workerSha256", "pythonExecutableSha256"],
    "/providerProcessTrace/supervisor_initialized",
  );
  const runnerPid = integer(initialized.details["runnerPid"], "/providerProcessTrace/runnerPid", 1);
  integer(initialized.details["runnerPpid"], "/providerProcessTrace/runnerPpid", 1);
  if (
    initialized.details["runnerSha256"] !== input.runnerSha256 ||
    initialized.details["workerSha256"] !== input.workerSha256 ||
    initialized.details["pythonExecutableSha256"] !== input.pythonExecutableSha256
  ) throw new Error("provider supervisor does not bind the expected runtime bytes");

  const processIds: number[] = [];
  const processNonces: string[] = [];
  let providerAgent: string | undefined;
  const acceptSpawn = (reason: string, instance: number): ProcessIdentity => {
    const spawn = expectEvent(entries, cursor++, "worker_spawn_requested");
    exactKeys(spawn.details, ["reason", "processInstance", "workerSha256", "pythonExecutableSha256"], `/providerProcessTrace/${spawn.sequence}/details`);
    if (
      spawn.details["reason"] !== reason || spawn.details["processInstance"] !== instance ||
      spawn.details["workerSha256"] !== input.workerSha256 ||
      spawn.details["pythonExecutableSha256"] !== input.pythonExecutableSha256
    ) throw new Error("provider worker spawn request does not match the expected instance");
    const handshake = expectEvent(entries, cursor++, "worker_handshake_accepted");
    const handshakePath = `/providerProcessTrace/${handshake.sequence}/details`;
    exactKeys(
      handshake.details,
      [
        ...IDENTITY_KEYS, "ppid", "initFrameSha256", "initFrameByteLength", "initFrameBase64",
        "handshakeFrameSha256", "handshakeFrameByteLength", "handshakeFrameBase64",
        "runnerSha256", "workerSha256", "pythonExecutableSha256",
      ],
      handshakePath,
    );
    const accepted = identity(handshake.details, handshakePath);
    const initFrame = decodeFrame(handshake.details, "initFrame", handshakePath);
    exactKeys(initFrame, ["schemaVersion", "agent", "attemptId", "processInstance", "expectedParentPid", "expectedWorkerSha256", "expectedPythonExecutableSha256"], `${handshakePath}/initFrame`);
    const agent = text(initFrame["agent"], `${handshakePath}/initFrame/agent`);
    providerAgent ??= agent;
    if (
      initFrame["schemaVersion"] !== INIT_SCHEMA || agent !== providerAgent ||
      initFrame["attemptId"] !== input.attemptId || initFrame["processInstance"] !== instance ||
      initFrame["expectedParentPid"] !== runnerPid || initFrame["expectedWorkerSha256"] !== input.workerSha256 ||
      initFrame["expectedPythonExecutableSha256"] !== input.pythonExecutableSha256
    ) throw new Error("provider init frame does not bind the expected attempt/runtime");
    const handshakeFrame = decodeFrame(handshake.details, "handshakeFrame", handshakePath);
    exactKeys(handshakeFrame, ["schemaVersion", "kind", "attemptId", "processInstance", "pid", "ppid", "processNonce", "workerSha256", "pythonExecutableSha256"], `${handshakePath}/handshakeFrame`);
    if (
      accepted.processInstance !== instance || handshake.details["ppid"] !== runnerPid ||
      handshake.details["runnerSha256"] !== input.runnerSha256 || handshake.details["workerSha256"] !== input.workerSha256 ||
      handshake.details["pythonExecutableSha256"] !== input.pythonExecutableSha256 ||
      handshakeFrame["schemaVersion"] !== HANDSHAKE_SCHEMA || handshakeFrame["kind"] !== "handshake" ||
      handshakeFrame["attemptId"] !== input.attemptId || handshakeFrame["processInstance"] !== instance ||
      handshakeFrame["pid"] !== accepted.pid || handshakeFrame["ppid"] !== runnerPid ||
      handshakeFrame["processNonce"] !== accepted.processNonce || handshakeFrame["workerSha256"] !== input.workerSha256 ||
      handshakeFrame["pythonExecutableSha256"] !== input.pythonExecutableSha256
    ) throw new Error("provider worker handshake does not bind its supervisor/runtime/frame");
    if (accepted.pid === runnerPid || processIds.includes(accepted.pid) || processNonces.includes(accepted.processNonce)) {
      throw new Error("provider successor is not a distinct OS process identity");
    }
    processIds.push(accepted.pid);
    processNonces.push(accepted.processNonce);
    return accepted;
  };

  let current = acceptSpawn("initial", 1);
  let restartCount = 0;
  let currentProcessResponseCount = 0;
  let cleanShutdownSeen = false;
  let lostResponseContextHash: string | undefined;
  let previousAcceptedSandboxRows: readonly unknown[] | undefined;
  const contextExchanges: ToolSandboxVerifiedProviderContextExchange[] = [];
  while (cursor < entries.length) {
    const next = entries[cursor];
    if (next?.eventType === "context_request_sent") {
      const request = next;
      cursor += 1;
      const requestPath = `/providerProcessTrace/${request.sequence}/details`;
      exactKeys(request.details, [...IDENTITY_KEYS, "requestId", "endingIndex", "contextHashBefore", "requestFrameSha256", "requestFrameByteLength", "requestFrameBase64"], requestPath);
      const requestIdentity = identity(request.details, requestPath);
      if (!sameIdentity(requestIdentity, current)) throw new Error("provider request used a stale process");
      const requestId = text(request.details["requestId"], `${requestPath}/requestId`);
      const endingIndex = request.details["endingIndex"] === null
        ? null
        : integer(request.details["endingIndex"], `${requestPath}/endingIndex`);
      const requestFrame = decodeFrame(request.details, "requestFrame", requestPath);
      exactKeys(requestFrame, ["schemaVersion", "kind", "requestId", "attemptId", "processInstance", "processNonce", "endingIndex", "contextHash", "context"], `${requestPath}/requestFrame`);
      const beforeContext = record(requestFrame["context"], `${requestPath}/requestFrame/context`);
      const contextHashBefore = sha256Json(beforeContext);
      if (
        requestFrame["schemaVersion"] !== REQUEST_SCHEMA || requestFrame["kind"] !== "respond" ||
        requestFrame["requestId"] !== requestId || requestFrame["attemptId"] !== input.attemptId ||
        requestFrame["processInstance"] !== current.processInstance || requestFrame["processNonce"] !== current.processNonce ||
        requestFrame["endingIndex"] !== endingIndex || requestFrame["contextHash"] !== contextHashBefore ||
        request.details["contextHashBefore"] !== contextHashBefore
      ) throw new Error("provider context request frame does not bind its trace/context");
      const response = expectEvent(entries, cursor++, "context_response_accepted");
      const responsePath = `/providerProcessTrace/${response.sequence}/details`;
      exactKeys(response.details, [...IDENTITY_KEYS, "requestId", "contextHashBefore", "contextHashAfter", "responseFrameSha256", "responseFrameByteLength", "responseFrameBase64", "appendedAgentMessageCount"], responsePath);
      const responseIdentity = identity(response.details, responsePath);
      if (!sameIdentity(responseIdentity, current) || response.details["requestId"] !== requestId) {
        throw new Error("provider response does not match its request/process");
      }
      const responseFrame = decodeFrame(response.details, "responseFrame", responsePath);
      exactKeys(responseFrame, ["schemaVersion", "kind", "requestId", "attemptId", "processInstance", "processNonce", "contextHashBefore", "contextHashAfter", "context"], `${responsePath}/responseFrame`);
      const afterContext = record(responseFrame["context"], `${responsePath}/responseFrame/context`);
      const contextHashAfter = sha256Json(afterContext);
      if (
        responseFrame["schemaVersion"] !== RESPONSE_SCHEMA || responseFrame["kind"] !== "responded" ||
        responseFrame["requestId"] !== requestId || responseFrame["attemptId"] !== input.attemptId ||
        responseFrame["processInstance"] !== current.processInstance || responseFrame["processNonce"] !== current.processNonce ||
        responseFrame["contextHashBefore"] !== contextHashBefore || responseFrame["contextHashAfter"] !== contextHashAfter ||
        response.details["contextHashBefore"] !== contextHashBefore || response.details["contextHashAfter"] !== contextHashAfter
      ) throw new Error("provider context response frame does not bind its request/context");
      const transition = validateContextTransition(beforeContext, afterContext, responsePath);
      if (previousAcceptedSandboxRows !== undefined) {
        assertArrayPrefix(
          withoutSandboxHeadguards(previousAcceptedSandboxRows),
          withoutSandboxHeadguards(transition.beforeRows),
          `${requestPath}/requestFrame/context/SANDBOX`,
        );
      }
      const appendedCount = integer(response.details["appendedAgentMessageCount"], `${responsePath}/appendedAgentMessageCount`);
      if (appendedCount !== transition.appended.length) {
        throw new Error("provider trace appended count does not match the decoded context transition");
      }
      contextExchanges.push({
        processInstance: current.processInstance,
        requestId,
        endingIndex,
        contextHashBefore,
        contextHashAfter,
        sandboxMessageCountBefore: transition.beforeRows.length,
        sandboxMessageCountAfter: transition.afterRows.length,
        sandboxMessagesSha256Before: sha256Json(transition.beforeRows),
        sandboxMessagesSha256After: sha256Json(transition.afterRows),
        appendedAgentMessageCount: appendedCount,
        appendedAgentMessages: transition.appended,
      });
      previousAcceptedSandboxRows = transition.afterRows;
      currentProcessResponseCount += 1;
      continue;
    }
    if (next?.eventType === "lost_response_fault_bound") {
      if (restartCount !== 0 || input.faultEvidence?.status !== "applied") {
        throw new Error("provider process trace contains an unclaimed or repeated restart fault");
      }
      const fault = next;
      cursor += 1;
      const faultPath = `/providerProcessTrace/${fault.sequence}/details`;
      exactKeys(fault.details, [...IDENTITY_KEYS, "targetCallId", "targetSideEffectReceiptHash", "lostResponseHash", "contextHashAfterLostResponse", "appliedAtTurn"], faultPath);
      const faultIdentity = identity(fault.details, faultPath);
      if (!sameIdentity(faultIdentity, current)) throw new Error("restart fault used a stale process");
      if (
        fault.details["targetCallId"] !== input.faultEvidence.targetCallId ||
        fault.details["targetSideEffectReceiptHash"] !== input.faultEvidence.targetSideEffectReceiptHash ||
        fault.details["appliedAtTurn"] !== input.faultEvidence.appliedAtTurn ||
        fault.details["lostResponseHash"] !== sha256Bytes(Buffer.from(LOST_RESPONSE))
      ) throw new Error("provider restart fault does not bind the retained fault evidence");
      lostResponseContextHash = sha(fault.details["contextHashAfterLostResponse"], `${faultPath}/contextHashAfterLostResponse`);
      for (const [eventType, extraKeys] of [
        ["restart_requested", []],
        ["sigkill_sent", ["signal"]],
        ["worker_reaped_after_sigkill", ["signal", "returnCode"]],
      ] as const) {
        const event = expectEvent(entries, cursor++, eventType);
        const eventPath = `/providerProcessTrace/${event.sequence}/details`;
        exactKeys(event.details, [...IDENTITY_KEYS, ...extraKeys], eventPath);
        const eventIdentity = identity(event.details, eventPath);
        if (!sameIdentity(eventIdentity, current)) throw new Error("restart lifecycle changed old identity");
        if (eventType === "sigkill_sent" && event.details["signal"] !== 9) {
          throw new Error("provider worker restart did not use SIGKILL");
        }
        if (eventType === "worker_reaped_after_sigkill" && (event.details["signal"] !== 9 || event.details["returnCode"] !== -9)) {
          throw new Error("provider worker was not reaped from SIGKILL before replacement");
        }
      }
      current = acceptSpawn("scheduled_lost_response_restart", 2);
      const expectedSession = `provider-process-002-${current.processNonce.slice(0, 12)}`;
      if (input.faultEvidence.restartedAgentSessionId !== expectedSession) {
        throw new Error("fault evidence does not bind the successor provider process nonce");
      }
      restartCount += 1;
      currentProcessResponseCount = 0;
      continue;
    }
    if (next?.eventType === "clean_shutdown_requested") {
      if (contextExchanges.length === 0) {
        throw new Error("provider lifecycle has no accepted context exchange");
      }
      if (restartCount === 1 && currentProcessResponseCount === 0) {
        throw new Error("replacement provider shut down before an accepted successor context response");
      }
      const requested = next;
      cursor += 1;
      const requestedPath = `/providerProcessTrace/${requested.sequence}/details`;
      exactKeys(requested.details, [...IDENTITY_KEYS, "requestId", "requestFrameSha256", "requestFrameByteLength", "requestFrameBase64"], requestedPath);
      const requestedIdentity = identity(requested.details, requestedPath);
      if (!sameIdentity(requestedIdentity, current)) throw new Error("shutdown used a stale process");
      const requestId = text(requested.details["requestId"], `${requestedPath}/requestId`);
      const shutdownRequest = decodeFrame(requested.details, "requestFrame", requestedPath);
      exactKeys(shutdownRequest, ["schemaVersion", "kind", "requestId", "attemptId", "processInstance", "processNonce"], `${requestedPath}/requestFrame`);
      if (
        shutdownRequest["schemaVersion"] !== REQUEST_SCHEMA || shutdownRequest["kind"] !== "shutdown" ||
        shutdownRequest["requestId"] !== requestId || shutdownRequest["attemptId"] !== input.attemptId ||
        shutdownRequest["processInstance"] !== current.processInstance || shutdownRequest["processNonce"] !== current.processNonce
      ) throw new Error("provider shutdown request frame is unrelated to its lifecycle");
      const acknowledged = expectEvent(entries, cursor++, "clean_shutdown_acknowledged");
      const acknowledgedPath = `/providerProcessTrace/${acknowledged.sequence}/details`;
      exactKeys(acknowledged.details, [...IDENTITY_KEYS, "requestId", "responseFrameSha256", "responseFrameByteLength", "responseFrameBase64"], acknowledgedPath);
      const acknowledgedIdentity = identity(acknowledged.details, acknowledgedPath);
      const shutdownResponse = decodeFrame(acknowledged.details, "responseFrame", acknowledgedPath);
      exactKeys(shutdownResponse, ["schemaVersion", "kind", "requestId", "attemptId", "processInstance", "processNonce"], `${acknowledgedPath}/responseFrame`);
      if (
        !sameIdentity(acknowledgedIdentity, current) || acknowledged.details["requestId"] !== requestId ||
        shutdownResponse["schemaVersion"] !== RESPONSE_SCHEMA || shutdownResponse["kind"] !== "shutdown_acknowledged" ||
        shutdownResponse["requestId"] !== requestId || shutdownResponse["attemptId"] !== input.attemptId ||
        shutdownResponse["processInstance"] !== current.processInstance || shutdownResponse["processNonce"] !== current.processNonce
      ) throw new Error("provider shutdown acknowledgement frame is unrelated to its request");
      const reaped = expectEvent(entries, cursor++, "worker_reaped_clean");
      const reapedPath = `/providerProcessTrace/${reaped.sequence}/details`;
      exactKeys(reaped.details, [...IDENTITY_KEYS, "returnCode"], reapedPath);
      const reapedIdentity = identity(reaped.details, reapedPath);
      if (!sameIdentity(reapedIdentity, current) || reaped.details["returnCode"] !== 0) {
        throw new Error("provider successor did not exit cleanly");
      }
      cleanShutdownSeen = true;
      break;
    }
    throw new Error(`unsupported or out-of-order provider process event ${next?.eventType ?? "EOF"}`);
  }
  if (!cleanShutdownSeen || cursor !== entries.length) {
    throw new Error("provider process trace is not a complete successful lifecycle");
  }
  const expectedRestartCount = input.faultEvidence?.status === "applied" ? 1 : 0;
  if (
    restartCount !== expectedRestartCount || summary.restartCount !== restartCount ||
    summary.processInstanceCount !== processIds.length || processIds.length !== restartCount + 1
  ) throw new Error("provider process summary/fault evidence disagrees with replayed lifecycle");
  const successorContextResponseCount = restartCount === 1
    ? contextExchanges.filter((exchange) => exchange.processInstance === 2).length
    : 0;
  return {
    traceSha256: sha256Bytes(input.traceBytes),
    traceHeadHash: entries.at(-1)!.entryHash,
    traceEntryCount: entries.length,
    processInstanceCount: processIds.length,
    restartCount,
    processIds,
    processNonces,
    providerAgent: providerAgent!,
    contextExchangeCount: contextExchanges.length,
    contextExchanges,
    successorContextResponseCount,
    finalAcceptedContextHashAfter: contextExchanges.at(-1)!.contextHashAfter,
    ...(lostResponseContextHash === undefined ? {} : { lostResponseContextHash }),
    actualOsProcessRestartVerified: restartCount === 1,
    restartSemantics: RESTART_SEMANTICS,
  };
}
