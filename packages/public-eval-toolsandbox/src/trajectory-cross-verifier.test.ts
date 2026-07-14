import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { ToolSandboxProviderProcessTraceInput } from "./provider-process-verifier.js";
import { buildToolSandboxSidecarRuntimeClosure } from "./runtime-closure.js";
import type { ToolSandboxSidecarVerificationInput } from "./sidecar-verifier.js";
import {
  verifyToolSandboxTrajectoryCrossEvidence,
  type ToolSandboxTrajectoryCrossVerificationInput,
} from "./trajectory-cross-verifier.js";

const GENESIS_HASH = "0".repeat(64);
const ATTEMPT_ID = "trajectory-cross-attempt-001";
const TRACK = "restart_lost_response_derivative" as const;
const RUNNER_PID = 41_000;
const INITIAL_PID = 41_101;
const SUCCESSOR_PID = 41_202;
const INITIAL_NONCE = "a".repeat(48);
const SUCCESSOR_NONCE = "b".repeat(48);
const TARGET_RECEIPT = "d".repeat(64);
const MESSAGE_ID = "17ebdc4d-dba2-452b-8766-6d010f53564d";
const RETRY_MESSAGE_ID = "48c20181-9478-4a2e-b1d9-a09a297c0922";
const PHONE = "+12453344098";
const CONTENT = "How's the new album coming along";
const LOST_RESPONSE =
  "The tool response was lost while the provider agent session restarted. The target-side outcome is unknown to this session.";
const DUPLICATE_RESPONSE =
  "Durable target receipt confirms this exact message was already applied before the session restart. Do not send it again; report the original operation as completed.";
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

const roots = new Set<string>();

afterEach(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
  roots.clear();
});

type JsonRecord = Record<string, unknown>;
type BoundaryArm = "sham" | "substrate";
type FixtureArm = "native" | BoundaryArm;
type RetryDisposition = "block" | "allow" | "failed";

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = value as Readonly<JsonRecord>;
  return `{${Object.entries(record)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, child]) => `${JSON.stringify(key)}:${canonicalJson(child)}`)
    .join(",")}}`;
}

function sha256(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function sha256Json(value: unknown): string {
  return sha256(canonicalJson(value));
}

function pathKey(path: readonly (string | number)[]): string {
  return canonicalJson(path);
}

const VOLATILE_TIMESTAMP_PATH_KEYS = new Set(
  VOLATILE_TIMESTAMP_PATHS.map(pathKey),
);
const NULL_TIMESTAMP_PATH_KEYS = new Set(NULL_TIMESTAMP_PATHS.map(pathKey));

function normalizedStartingContextForTest(
  value: unknown,
  path: readonly (string | number)[] = [],
): unknown {
  if (Array.isArray(value)) {
    return value.map((child, index) =>
      normalizedStartingContextForTest(child, [...path, index])
    );
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => {
        const childPath = [...path, key];
        const childPathKey = pathKey(childPath);
        if (VOLATILE_TIMESTAMP_PATH_KEYS.has(childPathKey)) {
          if (typeof child !== "number" || !Number.isFinite(child)) {
            throw new Error("test fixture volatile timestamp must be finite");
          }
          return [key, VOLATILE_TIMESTAMP_MARKER];
        }
        if (NULL_TIMESTAMP_PATH_KEYS.has(childPathKey)) {
          if (child !== null) {
            throw new Error("test fixture schema-row timestamp must remain null");
          }
          return [key, null];
        }
        return [key, normalizedStartingContextForTest(child, childPath)];
      }),
    );
  }
  return value;
}

function startingContextBinding(startingContext: JsonRecord): {
  readonly normalizationRuleId: typeof STARTING_CONTEXT_NORMALIZATION_POLICY;
  readonly normalizedContextSha256: string;
  readonly volatileTimestampValueCount: 11;
} {
  return {
    normalizationRuleId: STARTING_CONTEXT_NORMALIZATION_POLICY,
    normalizedContextSha256: sha256Json(
      normalizedStartingContextForTest(startingContext),
    ),
    volatileTimestampValueCount: 11,
  };
}

function hashed<T extends JsonRecord>(body: T, hashKey: string): JsonRecord {
  return { ...body, [hashKey]: sha256Json(body) };
}

function jsonLine(value: unknown): Buffer {
  return Buffer.from(`${JSON.stringify(value)}\n`, "utf8");
}

function frameFields(prefix: string, value: JsonRecord): JsonRecord {
  const raw = Buffer.from(`${canonicalJson(value)}\n`, "utf8");
  return {
    [`${prefix}Sha256`]: sha256(raw),
    [`${prefix}ByteLength`]: raw.length,
    [`${prefix}Base64`]: raw.toString("base64"),
  };
}

function sandboxRow(overrides: JsonRecord): JsonRecord {
  return {
    sandbox_message_index: null,
    sender: null,
    recipient: null,
    content: null,
    openai_tool_call_id: null,
    openai_function_name: null,
    conversation_active: true,
    tool_call_exception: null,
    tool_trace: null,
    visible_to: null,
    ...overrides,
  };
}

const SYSTEM_ROW = sandboxRow({
  sandbox_message_index: 0,
  sender: "SYSTEM",
  recipient: "AGENT",
  content: "Complete the public scenario.",
});
const FEW_SHOT_USER_ROW = sandboxRow({
  sandbox_message_index: 0,
  sender: "USER",
  recipient: "AGENT",
  content: "Example: inspect state before choosing a tool.",
});
const FEW_SHOT_AGENT_ROW = sandboxRow({
  sandbox_message_index: 0,
  sender: "AGENT",
  recipient: "USER",
  content: "Example response: I will inspect the current state first.",
});
const TARGET_CALL = sandboxRow({
  sandbox_message_index: 1,
  sender: "AGENT",
  recipient: "EXECUTION_ENVIRONMENT",
  content:
    `pm_probe_send_1_parameters = {'phone_number': '${PHONE}', 'content': "${CONTENT}"}\n` +
    "pm_probe_send_1_response = send_message_with_phone_number(**pm_probe_send_1_parameters)\n" +
    "print(repr(pm_probe_send_1_response))",
  openai_tool_call_id: "pm_probe_send_1",
  openai_function_name: "send_message_with_phone_number",
});
const TARGET_TRACE = JSON.stringify({
  tool_name: "send_message_with_phone_number",
  arguments: { phone_number: PHONE, content: CONTENT },
  result: MESSAGE_ID,
});
const LOST_ROW = sandboxRow({
  sandbox_message_index: 2,
  sender: "EXECUTION_ENVIRONMENT",
  recipient: "AGENT",
  content: LOST_RESPONSE,
  openai_tool_call_id: "pm_probe_send_1",
  openai_function_name: "send_message_with_phone_number",
  tool_call_exception: LOST_RESPONSE,
  tool_trace: [TARGET_TRACE],
});
const RETRY_CALL = sandboxRow({
  sandbox_message_index: 3,
  sender: "AGENT",
  recipient: "EXECUTION_ENVIRONMENT",
  content:
    `pm_probe_send_2_parameters = {'phone_number': '${PHONE}', 'content': "${CONTENT}"}\n` +
    "pm_probe_send_2_response = send_message_with_phone_number(**pm_probe_send_2_parameters)\n" +
    "print(repr(pm_probe_send_2_response))",
  openai_tool_call_id: "pm_probe_send_2",
  openai_function_name: "send_message_with_phone_number",
});
const BLOCKED_ROW = sandboxRow({
  sandbox_message_index: 4,
  sender: "EXECUTION_ENVIRONMENT",
  recipient: "AGENT",
  content: DUPLICATE_RESPONSE,
  openai_tool_call_id: "pm_probe_send_2",
  openai_function_name: "send_message_with_phone_number",
  tool_call_exception: DUPLICATE_RESPONSE,
});
const RETRY_TRACE = JSON.stringify({
  tool_name: "send_message_with_phone_number",
  arguments: { phone_number: PHONE, content: CONTENT },
  result: RETRY_MESSAGE_ID,
});
const RETRY_SUCCESS_ROW = sandboxRow({
  sandbox_message_index: 4,
  sender: "EXECUTION_ENVIRONMENT",
  recipient: "AGENT",
  content: `'${RETRY_MESSAGE_ID}'`,
  openai_tool_call_id: "pm_probe_send_2",
  openai_function_name: "send_message_with_phone_number",
  tool_trace: [RETRY_TRACE],
});
const RETRY_FAILURE = "The target send failed before applying a message.";
const RETRY_FAILED_ROW = sandboxRow({
  sandbox_message_index: 4,
  sender: "EXECUTION_ENVIRONMENT",
  recipient: "AGENT",
  content: RETRY_FAILURE,
  openai_tool_call_id: "pm_probe_send_2",
  openai_function_name: "send_message_with_phone_number",
  tool_call_exception: RETRY_FAILURE,
  tool_trace: [
    JSON.stringify({
      tool_name: "send_message_with_phone_number",
      arguments: { phone_number: PHONE, content: CONTENT },
      result: null,
    }),
  ],
});

function headguard(index: number): JsonRecord {
  return sandboxRow({ sandbox_message_index: index, conversation_active: null });
}

const SEED_MESSAGE = {
  sandbox_message_index: 0,
  message_id: "6c9382cb-720e-5f2c-8ac0-77e7ebdea446",
  sender_person_id: "self-person",
  sender_phone_number: "+11233344455",
  recipient_person_id: "friend-person",
  recipient_phone_number: "+10000000000",
  content: "Things are proceeding as expected",
  creation_timestamp: 1_783_960_354,
};
const HISTORICAL_MESSAGES = [
  SEED_MESSAGE,
  {
    ...SEED_MESSAGE,
    message_id: "8d6450eb-3cae-5153-ad6a-c4df85590787",
    recipient_person_id: "second-friend-person",
    recipient_phone_number: "+10000000001",
    content: "The session starts tomorrow",
    creation_timestamp: 1_783_960_355,
  },
  {
    ...SEED_MESSAGE,
    message_id: "96a64da3-6133-5347-8f7f-8c1142cf83a5",
    recipient_person_id: "third-friend-person",
    recipient_phone_number: "+10000000002",
    content: "Please bring the draft",
    creation_timestamp: 1_783_960_356,
  },
  {
    ...SEED_MESSAGE,
    message_id: "319851ce-cf82-52a7-8a74-989bfa5f76f4",
    recipient_person_id: "fourth-friend-person",
    recipient_phone_number: "+10000000003",
    content: "I will review it tonight",
    creation_timestamp: 1_783_960_357,
  },
  {
    ...SEED_MESSAGE,
    message_id: "20955fc2-9f56-5542-9ae1-ad2951e4b9f6",
    recipient_person_id: "fifth-friend-person",
    recipient_phone_number: "+10000000004",
    content: "The venue has changed",
    creation_timestamp: 1_783_960_358,
  },
] as const;
const TARGET_MESSAGE = {
  sandbox_message_index: 2,
  message_id: MESSAGE_ID,
  sender_person_id: "self-person",
  sender_phone_number: "+11233344455",
  recipient_person_id: "fredrik-person",
  recipient_phone_number: PHONE,
  content: CONTENT,
  creation_timestamp: 1_783_964_138,
};
const RETRY_MESSAGE = {
  ...TARGET_MESSAGE,
  sandbox_message_index: 4,
  message_id: RETRY_MESSAGE_ID,
  creation_timestamp: 1_783_964_139,
};

function startingContext(): JsonRecord {
  return {
    _dbs: {
      SANDBOX: [
        structuredClone(SYSTEM_ROW),
        structuredClone(FEW_SHOT_USER_ROW),
        structuredClone(FEW_SHOT_AGENT_ROW),
      ],
      SETTING: [
        { sandbox_message_index: null, cellular: null },
        { sandbox_message_index: 0, cellular: false },
      ],
      CONTACT: [
        {
          sandbox_message_index: null,
          person_id: null,
          name: null,
          phone_number: null,
        },
        {
          sandbox_message_index: 0,
          person_id: "fredrik-person",
          name: "Fredrik",
          phone_number: PHONE,
        },
      ],
      MESSAGING: [
        {
          sandbox_message_index: null,
          message_id: null,
          sender_person_id: null,
          sender_phone_number: null,
          recipient_person_id: null,
          recipient_phone_number: null,
          content: null,
          creation_timestamp: null,
        },
        ...HISTORICAL_MESSAGES.map((row) => structuredClone(row)),
      ],
      REMINDER: [
        {
          sandbox_message_index: null,
          reminder_id: null,
          content: null,
          creation_timestamp: null,
          reminder_timestamp: null,
        },
        {
          sandbox_message_index: 0,
          reminder_id: "reminder-001",
          content: "Review the contract",
          creation_timestamp: 1_783_960_401,
          reminder_timestamp: 1_783_964_001,
        },
        {
          sandbox_message_index: 0,
          reminder_id: "reminder-002",
          content: "Call the studio",
          creation_timestamp: 1_783_960_402,
          reminder_timestamp: 1_783_964_002,
        },
        {
          sandbox_message_index: 0,
          reminder_id: "reminder-003",
          content: "Send the itinerary",
          creation_timestamp: 1_783_960_403,
          reminder_timestamp: 1_783_964_003,
        },
      ],
    },
    interactive_console: null,
    preferred_tool_backend: "DEFAULT",
    tool_allow_list: [
      "get_cellular_service_status",
      "set_cellular_service_status",
      "search_contacts_by_name",
      "send_message_with_phone_number",
    ],
    tool_augmentation_list: [],
    tool_deny_list: null,
    trace_tool: false,
  };
}

function context(
  baseline: JsonRecord,
  sandbox: readonly JsonRecord[],
  messaging: readonly JsonRecord[],
): JsonRecord {
  const next = structuredClone(baseline);
  const nextDatabases = next["_dbs"] as JsonRecord;
  nextDatabases["SANDBOX"] = structuredClone(sandbox);
  nextDatabases["MESSAGING"] = structuredClone(messaging);
  return next;
}

function baselineRows(baseline: JsonRecord, namespace: string): JsonRecord[] {
  return structuredClone(
    ((baseline["_dbs"] as JsonRecord)[namespace] as JsonRecord[]),
  );
}

function messagingSnapshot(baseline: JsonRecord, index: number): JsonRecord[] {
  return baselineRows(baseline, "MESSAGING").flatMap((row) =>
    typeof row["message_id"] === "string"
      ? [{ ...row, sandbox_message_index: index }]
      : [],
  );
}

interface EventFixture {
  readonly eventType: string;
  readonly details: JsonRecord;
}

const HASHES = {
  runner: "1".repeat(64),
  worker: "2".repeat(64),
  python: "3".repeat(64),
} as const;

function identity(instance: number, pid: number, nonce: string): JsonRecord {
  return { processInstance: instance, pid, processGroupId: pid, processNonce: nonce };
}

function spawnEvents(
  reason: "initial" | "scheduled_lost_response_restart",
  instance: number,
  pid: number,
  nonce: string,
): readonly EventFixture[] {
  const init = {
    schemaVersion: INIT_SCHEMA,
    agent: "PmScriptedStateProbe",
    attemptId: ATTEMPT_ID,
    processInstance: instance,
    expectedParentPid: RUNNER_PID,
    expectedWorkerSha256: HASHES.worker,
    expectedPythonExecutableSha256: HASHES.python,
  };
  const handshake = {
    schemaVersion: HANDSHAKE_SCHEMA,
    kind: "handshake",
    attemptId: ATTEMPT_ID,
    processInstance: instance,
    pid,
    ppid: RUNNER_PID,
    processNonce: nonce,
    workerSha256: HASHES.worker,
    pythonExecutableSha256: HASHES.python,
  };
  return [
    {
      eventType: "worker_spawn_requested",
      details: {
        reason,
        processInstance: instance,
        workerSha256: HASHES.worker,
        pythonExecutableSha256: HASHES.python,
      },
    },
    {
      eventType: "worker_handshake_accepted",
      details: {
        ...identity(instance, pid, nonce),
        ppid: RUNNER_PID,
        ...frameFields("initFrame", init),
        ...frameFields("handshakeFrame", handshake),
        runnerSha256: HASHES.runner,
        workerSha256: HASHES.worker,
        pythonExecutableSha256: HASHES.python,
      },
    },
  ];
}

function exchangeEvents(
  instance: number,
  pid: number,
  nonce: string,
  sequence: number,
  before: JsonRecord,
  after: JsonRecord,
): readonly EventFixture[] {
  const requestId = `${ATTEMPT_ID}:provider:${instance}:${sequence}`;
  const beforeHash = sha256Json(before);
  const afterHash = sha256Json(after);
  const request = {
    schemaVersion: REQUEST_SCHEMA,
    kind: "respond",
    requestId,
    attemptId: ATTEMPT_ID,
    processInstance: instance,
    processNonce: nonce,
    endingIndex: null,
    contextHash: beforeHash,
    context: before,
  };
  const response = {
    schemaVersion: RESPONSE_SCHEMA,
    kind: "responded",
    requestId,
    attemptId: ATTEMPT_ID,
    processInstance: instance,
    processNonce: nonce,
    contextHashBefore: beforeHash,
    contextHashAfter: afterHash,
    context: after,
  };
  return [
    {
      eventType: "context_request_sent",
      details: {
        ...identity(instance, pid, nonce),
        requestId,
        endingIndex: null,
        contextHashBefore: beforeHash,
        ...frameFields("requestFrame", request),
      },
    },
    {
      eventType: "context_response_accepted",
      details: {
        ...identity(instance, pid, nonce),
        requestId,
        contextHashBefore: beforeHash,
        contextHashAfter: afterHash,
        ...frameFields("responseFrame", response),
        appendedAgentMessageCount: 1,
      },
    },
  ];
}

function shutdownEvents(): readonly EventFixture[] {
  const requestId = `${ATTEMPT_ID}:provider:2:shutdown-3`;
  const request = {
    schemaVersion: REQUEST_SCHEMA,
    kind: "shutdown",
    requestId,
    attemptId: ATTEMPT_ID,
    processInstance: 2,
    processNonce: SUCCESSOR_NONCE,
  };
  const response = {
    schemaVersion: RESPONSE_SCHEMA,
    kind: "shutdown_acknowledged",
    requestId,
    attemptId: ATTEMPT_ID,
    processInstance: 2,
    processNonce: SUCCESSOR_NONCE,
  };
  return [
    {
      eventType: "clean_shutdown_requested",
      details: {
        ...identity(2, SUCCESSOR_PID, SUCCESSOR_NONCE),
        requestId,
        ...frameFields("requestFrame", request),
      },
    },
    {
      eventType: "clean_shutdown_acknowledged",
      details: {
        ...identity(2, SUCCESSOR_PID, SUCCESSOR_NONCE),
        requestId,
        ...frameFields("responseFrame", response),
      },
    },
    {
      eventType: "worker_reaped_clean",
      details: { ...identity(2, SUCCESSOR_PID, SUCCESSOR_NONCE), returnCode: 0 },
    },
  ];
}

function providerInput(
  arm: FixtureArm,
  baseline: JsonRecord,
  faultContextHashOverride?: string,
): ToolSandboxProviderProcessTraceInput {
  const targetReceipt = arm === "native"
    ? sha256Json({
        callId: "pm_probe_send_1",
        toolName: "send_message_with_phone_number",
        arguments: { phone_number: PHONE, content: CONTENT },
        succeeded: true,
        responseHash: sha256(`'${MESSAGE_ID}'`),
      })
    : TARGET_RECEIPT;
  const initialSandbox = baselineRows(baseline, "SANDBOX");
  const initialMessaging = baselineRows(baseline, "MESSAGING");
  const currentMessaging = [
    ...messagingSnapshot(baseline, 2),
    TARGET_MESSAGE,
  ];
  const initialBefore = context(baseline, initialSandbox, initialMessaging);
  const initialAfter = context(
    baseline,
    [...initialSandbox, TARGET_CALL],
    initialMessaging,
  );
  const successorBefore = context(
    baseline,
    [...initialSandbox, headguard(1), TARGET_CALL, LOST_ROW],
    [...initialMessaging, ...currentMessaging],
  );
  const successorAfter = context(
    baseline,
    [...initialSandbox, headguard(1), TARGET_CALL, LOST_ROW, RETRY_CALL],
    [...initialMessaging, ...currentMessaging],
  );
  const oldIdentity = identity(1, INITIAL_PID, INITIAL_NONCE);
  const events: readonly EventFixture[] = [
    {
      eventType: "supervisor_initialized",
      details: {
        runnerPid: RUNNER_PID,
        runnerPpid: RUNNER_PID - 1,
        runnerSha256: HASHES.runner,
        workerSha256: HASHES.worker,
        pythonExecutableSha256: HASHES.python,
      },
    },
    ...spawnEvents("initial", 1, INITIAL_PID, INITIAL_NONCE),
    ...exchangeEvents(1, INITIAL_PID, INITIAL_NONCE, 1, initialBefore, initialAfter),
    {
      eventType: "lost_response_fault_bound",
      details: {
        ...oldIdentity,
        targetCallId: "pm_probe_send_1",
        targetSideEffectReceiptHash: targetReceipt,
        lostResponseHash: sha256(LOST_RESPONSE),
        contextHashAfterLostResponse:
          faultContextHashOverride ?? sha256Json(successorBefore),
        appliedAtTurn: 2,
      },
    },
    { eventType: "restart_requested", details: oldIdentity },
    { eventType: "sigkill_sent", details: { ...oldIdentity, signal: 9 } },
    {
      eventType: "worker_reaped_after_sigkill",
      details: { ...oldIdentity, signal: 9, returnCode: -9 },
    },
    ...spawnEvents(
      "scheduled_lost_response_restart",
      2,
      SUCCESSOR_PID,
      SUCCESSOR_NONCE,
    ),
    ...exchangeEvents(
      2,
      SUCCESSOR_PID,
      SUCCESSOR_NONCE,
      2,
      successorBefore,
      successorAfter,
    ),
    ...shutdownEvents(),
  ];
  let previousEntryHash: string | null = null;
  const entries = events.map((event, index) => {
    const body = {
      schemaVersion: TRACE_SCHEMA,
      sequence: index + 1,
      previousEntryHash,
      attemptId: ATTEMPT_ID,
      arm,
      evaluationTrack: TRACK,
      eventType: event.eventType,
      recordedAt: new Date(Date.UTC(2026, 6, 13, 12, 0, 0, index)).toISOString(),
      details: event.details,
    };
    const entryHash = sha256Json(body);
    previousEntryHash = entryHash;
    return { ...body, entryHash };
  });
  const traceBytes = Buffer.from(
    `${entries.map((entry) => JSON.stringify(entry)).join("\n")}\n`,
    "utf8",
  );
  return {
    tracePath: "/retained/provider-process.jsonl",
    traceBytes,
    summary: {
      tracePath: "/retained/provider-process.jsonl",
      traceSha256: sha256(traceBytes),
      traceHeadHash: previousEntryHash,
      traceEntryCount: entries.length,
      processInstanceCount: 2,
      restartCount: 1,
      restartSemantics: RESTART_SEMANTICS,
      runnerSha256: HASHES.runner,
      workerSha256: HASHES.worker,
      pythonExecutableSha256: HASHES.python,
    },
    attemptId: ATTEMPT_ID,
    arm,
    evaluationTrack: TRACK,
    faultEvidence: {
      status: "applied",
      targetCallId: "pm_probe_send_1",
      targetSideEffectReceiptHash: targetReceipt,
      restartedAgentSessionId: `provider-process-002-${SUCCESSOR_NONCE.slice(0, 12)}`,
      appliedAtTurn: 2,
    },
    runnerSha256: HASHES.runner,
    workerSha256: HASHES.worker,
    pythonExecutableSha256: HASHES.python,
  };
}

interface ClientExchange {
  command: "admit-tool" | "record-tool-outcome";
  request: JsonRecord;
  response: JsonRecord;
}

function clientExchanges(
  statePath: string,
  arm: BoundaryArm,
  retryDisposition: "block" | "allow",
): ClientExchange[] {
  const arguments_ = { phone_number: PHONE, content: CONTENT };
  const exchanges: ClientExchange[] = [
    {
      command: "admit-tool",
      request: {
        schemaVersion: "pm.public-eval.toolsandbox-tool-proposal.v1",
        arm,
        evaluationTrack: TRACK,
        attemptId: ATTEMPT_ID,
        sessionId: "session-001",
        statePath,
        toolCallId: "pm_probe_send_1",
        toolName: "send_message_with_phone_number",
        arguments: arguments_,
        proposedAt: "2026-07-13T12:00:00.005Z",
      },
      response: {
        proposalId: `${ATTEMPT_ID}:proposal:1`,
        decision: "allow",
        responseForAgent: null,
      },
    },
    {
      command: "record-tool-outcome",
      request: {
        schemaVersion: "pm.public-eval.toolsandbox-tool-outcome.v1",
        arm,
        evaluationTrack: TRACK,
        attemptId: ATTEMPT_ID,
        statePath,
        proposalId: `${ATTEMPT_ID}:proposal:1`,
        toolCallId: "pm_probe_send_1",
        toolName: "send_message_with_phone_number",
        arguments: arguments_,
        succeeded: true,
        responseHash: sha256(`'${MESSAGE_ID}'`),
        observedAt: "2026-07-13T12:00:00.015Z",
      },
      response: {
        proposalId: `${ATTEMPT_ID}:proposal:1`,
        targetSideEffectReceiptHash: TARGET_RECEIPT,
      },
    },
    {
      command: "admit-tool",
      request: {
        schemaVersion: "pm.public-eval.toolsandbox-tool-proposal.v1",
        arm,
        evaluationTrack: TRACK,
        attemptId: ATTEMPT_ID,
        sessionId: `provider-process-002-${SUCCESSOR_NONCE.slice(0, 12)}`,
        statePath,
        toolCallId: "pm_probe_send_2",
        toolName: "send_message_with_phone_number",
        arguments: arguments_,
        proposedAt: "2026-07-13T12:00:00.025Z",
      },
      response: {
        proposalId: `${ATTEMPT_ID}:proposal:3`,
        decision: retryDisposition,
        responseForAgent:
          retryDisposition === "block" ? DUPLICATE_RESPONSE : null,
      },
    },
  ];
  if (retryDisposition === "allow") {
    exchanges.push({
      command: "record-tool-outcome",
      request: {
        schemaVersion: "pm.public-eval.toolsandbox-tool-outcome.v1",
        arm,
        evaluationTrack: TRACK,
        attemptId: ATTEMPT_ID,
        statePath,
        proposalId: `${ATTEMPT_ID}:proposal:3`,
        toolCallId: "pm_probe_send_2",
        toolName: "send_message_with_phone_number",
        arguments: arguments_,
        succeeded: true,
        responseHash: sha256(`'${RETRY_MESSAGE_ID}'`),
        observedAt: "2026-07-13T12:00:00.035Z",
      },
      response: {
        proposalId: `${ATTEMPT_ID}:proposal:3`,
        targetSideEffectReceiptHash: "e".repeat(64),
      },
    });
  }
  return exchanges;
}

function sidecarInput(
  root: string,
  arm: BoundaryArm,
  retryDisposition: "block" | "allow",
  mutate?: (exchanges: ClientExchange[]) => void,
): ToolSandboxSidecarVerificationInput {
  const statePath = resolve(root, "boundary.json");
  const auditPath = resolve(root, "audit.jsonl");
  const readyPath = resolve(root, "ready.json");
  const finalReceiptPath = resolve(root, "final.json");
  const operationLedgerPath = `${statePath}.sidecar-operations.jsonl`;
  const stateLockPath = `${statePath}.sidecar.lock`;
  const runtime = resolve(root, "runtime");
  const publicRuntime = resolve(runtime, "public-eval-toolsandbox");
  const coreRuntime = resolve(runtime, "agent-state-core");
  const typesRuntime = resolve(runtime, "types");
  mkdirSync(publicRuntime, { recursive: true });
  mkdirSync(coreRuntime, { recursive: true });
  mkdirSync(typesRuntime, { recursive: true });
  const expectedEntryPath = resolve(publicRuntime, "sidecar-entry.js");
  writeFileSync(expectedEntryPath, "import './sidecar.js';\n", "utf8");
  writeFileSync(resolve(publicRuntime, "sidecar.js"), "export const sidecar = true;\n", "utf8");
  const coreEntryPath = resolve(coreRuntime, "index.js");
  writeFileSync(coreEntryPath, "export const core = true;\n", "utf8");
  const typesEntryPath = resolve(typesRuntime, "index.js");
  writeFileSync(typesEntryPath, "export const types = true;\n", "utf8");
  const expectedRuntimeModuleClosure = buildToolSandboxSidecarRuntimeClosure({
    publicEvalEntryPath: expectedEntryPath,
    agentStateCoreEntryPath: coreEntryPath,
    typesEntryPath,
  });
  const expectedNodePath = resolve(runtime, "node");
  const expectedNodeSha256 = sha256("node-runtime");
  const expectedEntrySha256 = sha256(readFileSync(expectedEntryPath));
  const expectedTokenSha256 = sha256("bearer-token");
  const expectedPid = 52_101;
  const expectedPpid = 52_100;
  const config = {
    schemaVersion: "pm.public-eval.toolsandbox-sidecar-config.v1",
    arm,
    evaluationTrack: TRACK,
    attemptId: ATTEMPT_ID,
    statePath,
    auditPath,
    readyPath,
    finalReceiptPath,
    operationLedgerPath,
    stateLockPath,
    host: "127.0.0.1",
    requestedPort: 0,
    maxRequestBytes: 65_536,
    tokenSha256: expectedTokenSha256,
    moduleResolutionEnvironment: { nodeOptions: "absent", nodePath: "absent" },
    executableEvidence: {
      node: { path: expectedNodePath, sha256: expectedNodeSha256 },
      entry: { path: expectedEntryPath, sha256: expectedEntrySha256 },
      runtimeModuleClosure: expectedRuntimeModuleClosure,
    },
  };
  const configHash = sha256Json(config);
  const lockHash = sha256("state-lock");
  const startedAt = "2026-07-13T12:00:00.000Z";
  const readyBody = {
    schemaVersion: "pm.public-eval.toolsandbox-sidecar-ready.v1",
    config,
    configHash,
    server: {
      pid: expectedPid,
      ppid: expectedPpid,
      startedAt,
      host: "127.0.0.1",
      port: 41_919,
      origin: "http://127.0.0.1:41919",
    },
    authentication: { scheme: "Bearer", tokenSha256: expectedTokenSha256 },
    endpoints: ["/v1/admit-tool", "/v1/record-tool-outcome"],
    durability: {
      stateFileFsyncAfterMutation: true,
      stateDirectoryFsyncAfterMutation: true,
      auditAppendFsync: true,
      operationPrepareAndCompletionFsync: true,
      receiptFileAndDirectoryFsync: true,
      exclusiveStateLock: true,
    },
    audit: { path: auditPath, genesisHash: GENESIS_HASH },
    operationLedger: {
      path: operationLedgerPath,
      initialSequence: 0,
      initialHeadHash: GENESIS_HASH,
    },
    stateLock: { path: stateLockPath, lockHash },
  };
  const ready = hashed(readyBody, "readyHash");
  const exchanges = clientExchanges(statePath, arm, retryDisposition);
  mutate?.(exchanges);
  const audits: JsonRecord[] = [];
  const operations: JsonRecord[] = [];
  const clients: JsonRecord[] = [];
  let auditHead = GENESIS_HASH;
  let operationHead = GENESIS_HASH;
  let clientHead = GENESIS_HASH;
  for (const [index, exchange] of exchanges.entries()) {
    const endpoint = exchange.command === "admit-tool"
      ? "/v1/admit-tool"
      : "/v1/record-tool-outcome";
    const requestBytes = Buffer.from(canonicalJson(exchange.request), "utf8");
    const responseBytes = Buffer.from(`${JSON.stringify(exchange.response)}\n`, "utf8");
    const operationKeySha256 = sha256(`operation-${index}`);
    const requestId = `sidecar-request-${index + 1}`;
    const requestHash = sha256Json({
      method: "POST",
      target: endpoint,
      bodyBytesBase64: requestBytes.toString("base64"),
    });
    const baseMs = index * 10;
    const iso = (offset: number): string =>
      new Date(Date.UTC(2026, 6, 13, 12, 0, 1, baseMs + offset)).toISOString();
    const prepared = hashed(
      {
        schemaVersion: "pm.public-eval.toolsandbox-sidecar-operation.v1",
        sequence: operations.length + 1,
        previousRecordHash: operationHead,
        phase: "prepared",
        operationKeySha256,
        requestHash,
        preparedAt: iso(2),
      },
      "recordHash",
    );
    operations.push(prepared);
    operationHead = prepared["recordHash"] as string;
    const completed = hashed(
      {
        schemaVersion: "pm.public-eval.toolsandbox-sidecar-operation.v1",
        sequence: operations.length + 1,
        previousRecordHash: operationHead,
        phase: "completed",
        operationKeySha256,
        requestHash,
        status: 200,
        responseBytesBase64: responseBytes.toString("base64"),
        responseSha256: sha256(responseBytes),
        responseRequestId: requestId,
        completedAt: iso(3),
      },
      "recordHash",
    );
    operations.push(completed);
    operationHead = completed["recordHash"] as string;
    const audit = hashed(
      {
        schemaVersion: "pm.public-eval.toolsandbox-sidecar-audit.v1",
        sequence: audits.length + 1,
        previousRecordHash: auditHead,
        requestId,
        pid: expectedPid,
        receivedAt: iso(1),
        completedAt: iso(4),
        request: {
          method: "POST",
          target: endpoint,
          remoteAddress: "127.0.0.1",
          bodyComplete: true,
          bodyByteLength: requestBytes.length,
          bodyBytesBase64: requestBytes.toString("base64"),
          bodySha256: sha256(requestBytes),
          authenticated: true,
          operationKeySha256,
          idempotencyDisposition: "new",
        },
        generatedResponse: {
          status: 200,
          bodyByteLength: responseBytes.length,
          bodyBytesBase64: responseBytes.toString("base64"),
          bodySha256: sha256(responseBytes),
          responseRequestId: requestId,
        },
      },
      "recordHash",
    );
    audits.push(audit);
    auditHead = audit["recordHash"] as string;
    const client = hashed(
      {
        schemaVersion: "pm.public-eval.toolsandbox-boundary-http-client.v1",
        sequence: clients.length + 1,
        previousEntryHash: clientHead,
        command: exchange.command,
        request: exchange.request,
        response: exchange.response,
        http: {
          endpointPath: endpoint,
          operationKeySha256,
          request: {
            bodyByteLength: requestBytes.length,
            bodyBytesBase64: requestBytes.toString("base64"),
            bodySha256: sha256(requestBytes),
          },
          response: {
            status: 200,
            contentType: "application/json",
            requestId,
            bodyByteLength: responseBytes.length,
            bodyBytesBase64: responseBytes.toString("base64"),
            bodySha256: sha256(responseBytes),
          },
        },
      },
      "entryHash",
    );
    clients.push(client);
    clientHead = client["entryHash"] as string;
  }
  const auditBytes = Buffer.concat(audits.map(jsonLine));
  const operationLedgerBytes = Buffer.concat(operations.map(jsonLine));
  const clientTraceBytes = Buffer.concat(clients.map(jsonLine));
  const finalBody = {
    schemaVersion: "pm.public-eval.toolsandbox-sidecar-final.v1",
    configHash,
    readyHash: ready["readyHash"],
    server: {
      pid: expectedPid,
      ppid: expectedPpid,
      startedAt,
      origin: "http://127.0.0.1:41919",
    },
    shutdown: {
      reason: "SIGTERM",
      initiatedAt: "2026-07-13T12:00:02.000Z",
      completedAt: "2026-07-13T12:00:02.001Z",
    },
    audit: {
      path: auditPath,
      recordCount: audits.length,
      headHash: auditHead,
      byteLength: auditBytes.length,
      sha256: sha256(auditBytes),
    },
    operationLedger: {
      path: operationLedgerPath,
      sequence: operations.length,
      headHash: operationHead,
      byteLength: operationLedgerBytes.length,
      sha256: sha256(operationLedgerBytes),
    },
    stateLock: { path: stateLockPath, lockHash, released: true },
  };
  return {
    arm,
    evaluationTrack: TRACK,
    attemptId: ATTEMPT_ID,
    statePath,
    auditPath,
    readyPath,
    finalReceiptPath,
    operationLedgerPath,
    stateLockPath,
    expectedPid,
    expectedPpid,
    expectedNodePath,
    expectedNodeSha256,
    expectedEntryPath,
    expectedEntrySha256,
    expectedRuntimeModuleClosure,
    expectedTokenSha256,
    readyBytes: Buffer.from(`${JSON.stringify(ready, null, 2)}\n`, "utf8"),
    finalReceiptBytes: Buffer.from(
      `${JSON.stringify(hashed(finalBody, "finalHash"), null, 2)}\n`,
      "utf8",
    ),
    auditBytes,
    operationLedgerBytes,
    clientTraceBytes,
  };
}

function finalContext(
  baseline: JsonRecord,
  retryDisposition: RetryDisposition,
): JsonRecord {
  const retryResponse = retryDisposition === "block"
    ? BLOCKED_ROW
    : retryDisposition === "allow"
      ? RETRY_SUCCESS_ROW
      : RETRY_FAILED_ROW;
  const initialSandbox = baselineRows(baseline, "SANDBOX");
  const initialMessaging = baselineRows(baseline, "MESSAGING");
  return context(
    baseline,
    [
      ...initialSandbox,
      headguard(1),
      structuredClone(TARGET_CALL),
      structuredClone(LOST_ROW),
      headguard(3),
      structuredClone(RETRY_CALL),
      structuredClone(retryResponse),
    ],
    retryDisposition !== "allow"
      ? [
          ...initialMessaging,
          ...messagingSnapshot(baseline, 2),
          structuredClone(TARGET_MESSAGE),
        ]
      : [
          ...initialMessaging,
          ...messagingSnapshot(baseline, 2),
          structuredClone(TARGET_MESSAGE),
          ...messagingSnapshot(baseline, 4),
          { ...TARGET_MESSAGE, sandbox_message_index: 4 },
          structuredClone(RETRY_MESSAGE),
        ],
  );
}

function fixture(options?: {
  readonly mutateContext?: (context: JsonRecord) => void;
  readonly mutateStartingContext?: (context: JsonRecord) => void;
  readonly mutateSidecar?: (exchanges: ClientExchange[]) => void;
  readonly faultContextHashOverride?: string;
  readonly arm?: FixtureArm;
  readonly retryDisposition?: RetryDisposition;
}): ToolSandboxTrajectoryCrossVerificationInput {
  const root = mkdtempSync(resolve(tmpdir(), "toolsandbox-cross-verifier-"));
  roots.add(root);
  const arm = options?.arm ?? "substrate";
  const retryDisposition = options?.retryDisposition ?? "block";
  if (
    (arm === "native" && retryDisposition !== "failed") ||
    (arm !== "native" && retryDisposition === "failed")
  ) {
    throw new Error("fixture arm/retry disposition is unsupported");
  }
  const baseline = startingContext();
  const oracleStartingContext = startingContextBinding(baseline);
  options?.mutateStartingContext?.(baseline);
  const executionContext = finalContext(baseline, retryDisposition);
  options?.mutateContext?.(executionContext);
  return {
    executionContextBytes: Buffer.from(
      `${JSON.stringify(executionContext, null, 2)}\n`,
      "utf8",
    ),
    providerProcess: providerInput(
      arm,
      baseline,
      options?.faultContextHashOverride,
    ),
    oracleStartingContext,
    ...(arm === "native"
      ? {}
      : {
          sidecar: sidecarInput(
            root,
            arm,
            retryDisposition,
            options?.mutateSidecar,
          ),
        }),
  };
}

describe("ToolSandbox provider/sidecar/trajectory cross verifier", () => {
  it("binds exact provider frames, headguards, HTTP calls, message delta, and restart", () => {
    const verified = verifyToolSandboxTrajectoryCrossEvidence(fixture());
    expect(verified).toMatchObject({
      schemaVersion: "pm.public-eval.toolsandbox-trajectory-cross-verification.v2",
      arm: "substrate",
      providerContextExchangeCount: 2,
      providerAppendedAgentMessageCount: 2,
      providerBoundToolCallCount: 2,
      sidecarAdmitCount: 2,
      sidecarOutcomeCount: 1,
      successfulSendCount: 1,
      messagingDeltaCount: 1,
      restartCount: 1,
      successorContextResponseCount: 1,
      lostResponseRestartBindingCount: 1,
      postRestartExactRetryCount: 1,
      postRestartRetryDisposition: "blocked",
      postRestartRetryAllowedCount: 0,
      postRestartRetryBlockedCount: 1,
      postRestartRetryExecutedCount: 0,
      postRestartRetrySuccessfulSendCount: 0,
      postRestartRetryDuplicateResponseBlockCount: 1,
      duplicateTargetSideEffectCount: 0,
      startingContextNormalizedSha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
      startingContextNormalizationPolicyId:
        STARTING_CONTEXT_NORMALIZATION_POLICY,
      startingContextVolatileTimestampCount: 11,
      startingContextBoundExceptDocumentedVolatileTimestamps: true,
    });
  });

  it("permits variation only at the eleven documented volatile timestamp cells", () => {
    const verified = verifyToolSandboxTrajectoryCrossEvidence(
      fixture({
        mutateStartingContext: (value) => {
          const databases = value["_dbs"] as JsonRecord;
          const messaging = databases["MESSAGING"] as JsonRecord[];
          for (let index = 1; index <= 5; index += 1) {
            messaging[index]!["creation_timestamp"] = 1_900_000_000 + index;
          }
          const reminders = databases["REMINDER"] as JsonRecord[];
          for (let index = 1; index <= 3; index += 1) {
            reminders[index]!["creation_timestamp"] = 1_910_000_000 + index;
            reminders[index]!["reminder_timestamp"] = 1_920_000_000 + index;
          }
        },
      }),
    );
    expect(verified).toMatchObject({
      startingContextVolatileTimestampCount: 11,
      startingContextBoundExceptDocumentedVolatileTimestamps: true,
    });
  });

  it.each<{
    readonly name: string;
    readonly mutate: (context: JsonRecord) => void;
  }>([
    {
      name: "SYSTEM instruction content",
      mutate: (value) => {
        const databases = value["_dbs"] as JsonRecord;
        const sandbox = databases["SANDBOX"] as JsonRecord[];
        sandbox[0]!["content"] = "Forged system instruction.";
      },
    },
    {
      name: "few-shot content",
      mutate: (value) => {
        const databases = value["_dbs"] as JsonRecord;
        const sandbox = databases["SANDBOX"] as JsonRecord[];
        sandbox[2]!["content"] = "Forged few-shot response.";
      },
    },
    {
      name: "CONTACT phone number",
      mutate: (value) => {
        const databases = value["_dbs"] as JsonRecord;
        const contacts = databases["CONTACT"] as JsonRecord[];
        contacts[1]!["phone_number"] = "+19999999999";
      },
    },
    {
      name: "historical MESSAGING content",
      mutate: (value) => {
        const databases = value["_dbs"] as JsonRecord;
        const messaging = databases["MESSAGING"] as JsonRecord[];
        messaging[2]!["content"] = "Forged historical message.";
      },
    },
    {
      name: "tool allow-list order",
      mutate: (value) => {
        const allowList = value["tool_allow_list"] as string[];
        value["tool_allow_list"] = [...allowList].reverse();
      },
    },
    {
      name: "added baseline database row",
      mutate: (value) => {
        const databases = value["_dbs"] as JsonRecord;
        const contacts = databases["CONTACT"] as JsonRecord[];
        contacts.push({
          sandbox_message_index: 0,
          person_id: "forged-person",
          name: "Forged",
          phone_number: "+18888888888",
        });
      },
    },
  ])("rejects a self-consistent provider trajectory with altered $name", ({ mutate }) => {
    const input = fixture({ mutateStartingContext: mutate });
    expect(() => verifyToolSandboxTrajectoryCrossEvidence(input)).toThrow(
      /provider starting context does not match the pinned clean scenario/u,
    );
  });

  it("retains and reports an unexpected substrate-allowed duplicate side effect", () => {
    const verified = verifyToolSandboxTrajectoryCrossEvidence(
      fixture({ retryDisposition: "allow" }),
    );
    expect(verified).toMatchObject({
      arm: "substrate",
      successfulSendCount: 2,
      messagingDeltaCount: 2,
      lostResponseRestartBindingCount: 1,
      postRestartExactRetryCount: 1,
      postRestartRetryDisposition: "executed_succeeded",
      postRestartRetryAllowedCount: 1,
      postRestartRetryBlockedCount: 0,
      postRestartRetryExecutedCount: 1,
      postRestartRetrySuccessfulSendCount: 1,
      postRestartRetryDuplicateResponseBlockCount: 0,
      duplicateTargetSideEffectCount: 1,
    });
  });

  it("retains and reports an unexpected sham block without promoting it", () => {
    const verified = verifyToolSandboxTrajectoryCrossEvidence(
      fixture({ arm: "sham", retryDisposition: "block" }),
    );
    expect(verified).toMatchObject({
      arm: "sham",
      successfulSendCount: 1,
      messagingDeltaCount: 1,
      postRestartExactRetryCount: 1,
      postRestartRetryDisposition: "blocked",
      postRestartRetryAllowedCount: 0,
      postRestartRetryBlockedCount: 1,
      postRestartRetryExecutedCount: 0,
      postRestartRetrySuccessfulSendCount: 0,
      postRestartRetryDuplicateResponseBlockCount: 1,
      duplicateTargetSideEffectCount: 0,
    });
  });

  it("retains and reports a native post-restart execution failure", () => {
    const verified = verifyToolSandboxTrajectoryCrossEvidence(
      fixture({ arm: "native", retryDisposition: "failed" }),
    );
    expect(verified).toMatchObject({
      arm: "native",
      sidecarClientTraceSha256: null,
      successfulSendCount: 1,
      messagingDeltaCount: 1,
      postRestartExactRetryCount: 1,
      postRestartRetryDisposition: "executed_failed",
      postRestartRetryAllowedCount: 1,
      postRestartRetryBlockedCount: 0,
      postRestartRetryExecutedCount: 1,
      postRestartRetrySuccessfulSendCount: 0,
      postRestartRetryDuplicateResponseBlockCount: 0,
      duplicateTargetSideEffectCount: 0,
    });
  });

  it("rejects an allowed duplicate whose claimed second send has no state delta", () => {
    const input = fixture({
      retryDisposition: "allow",
      mutateContext: (value) => {
        const messaging = (value["_dbs"] as JsonRecord)["MESSAGING"] as JsonRecord[];
        (value["_dbs"] as JsonRecord)["MESSAGING"] = messaging.filter(
          (row) => row["sandbox_message_index"] !== 4,
        );
      },
    });
    expect(() => verifyToolSandboxTrajectoryCrossEvidence(input)).toThrow(
      /not an exact one-row delta/u,
    );
  });

  it("rejects a final provider message altered outside the retained response frame", () => {
    const input = fixture({
      mutateContext: (value) => {
        const rows = (value["_dbs"] as JsonRecord)["SANDBOX"] as JsonRecord[];
        rows[2]!["content"] = "forged provider call";
      },
    });
    expect(() => verifyToolSandboxTrajectoryCrossEvidence(input)).toThrow(
      /not an exact prefix/u,
    );
  });

  it("rejects an unbound AGENT row appended only to the final trajectory", () => {
    const input = fixture({
      mutateContext: (value) => {
        const rows = (value["_dbs"] as JsonRecord)["SANDBOX"] as JsonRecord[];
        rows.push(
          sandboxRow({
            sandbox_message_index: 5,
            sender: "AGENT",
            recipient: "USER",
            content: "forged final report",
          }),
        );
      },
    });
    expect(() => verifyToolSandboxTrajectoryCrossEvidence(input)).toThrow(
      /not returned by the provider process/u,
    );
  });

  it("rejects a raw-valid sidecar admission bound to a different tool-call ID", () => {
    const input = fixture({
      mutateSidecar: (exchanges) => {
        exchanges[0]!.request["toolCallId"] = "forged-call-id";
        exchanges[1]!.request["toolCallId"] = "forged-call-id";
      },
    });
    expect(() => verifyToolSandboxTrajectoryCrossEvidence(input)).toThrow(
      /does not match its trajectory tool call/u,
    );
  });

  it("rejects raw-valid sidecar records reordered away from trajectory execution", () => {
    const input = fixture({
      mutateSidecar: (exchanges) => {
        const first = exchanges[0]!;
        exchanges[0] = exchanges[1]!;
        exchanges[1] = first;
      },
    });
    expect(() => verifyToolSandboxTrajectoryCrossEvidence(input)).toThrow(
      /has no next sidecar admission/u,
    );
  });

  it("rejects a raw-valid outcome that hashes something other than the original response", () => {
    const input = fixture({
      mutateSidecar: (exchanges) => {
        exchanges[1]!.request["responseHash"] = "e".repeat(64);
      },
    });
    expect(() => verifyToolSandboxTrajectoryCrossEvidence(input)).toThrow(
      /does not bind the exact original trajectory response/u,
    );
  });

  it("rejects a claimed send whose MESSAGING snapshot adds collateral state", () => {
    const input = fixture({
      mutateContext: (value) => {
        const messaging = (value["_dbs"] as JsonRecord)["MESSAGING"] as JsonRecord[];
        messaging.push({
          ...TARGET_MESSAGE,
          message_id: "48c20181-9478-4a2e-b1d9-a09a297c0922",
          content: "collateral duplicate",
        });
      },
    });
    expect(() => verifyToolSandboxTrajectoryCrossEvidence(input)).toThrow(
      /not an exact one-row delta/u,
    );
  });

  it("rejects a fault hash not equal to the successor's exact retained context", () => {
    const input = fixture({ faultContextHashOverride: "f".repeat(64) });
    expect(() => verifyToolSandboxTrajectoryCrossEvidence(input)).toThrow(
      /not the exact retained lost-response context/u,
    );
  });

  it("rejects a raw-valid retry admission that names a fake successor session", () => {
    const input = fixture({
      mutateSidecar: (exchanges) => {
        exchanges[2]!.request["sessionId"] = "provider-process-002-fake00000000";
      },
    });
    expect(() => verifyToolSandboxTrajectoryCrossEvidence(input)).toThrow(
      /does not bind the successor provider process\/session/u,
    );
  });
});
