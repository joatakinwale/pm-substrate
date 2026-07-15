import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import type { ToolSandboxFaultEvidence } from "./index.js";
import {
  verifyToolSandboxProviderProcessTrace,
  type ToolSandboxProviderProcessTraceInput,
} from "./provider-process-verifier.js";

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

const ATTEMPT_ID = "toolsandbox-provider-process-verifier-attempt";
const TRACE_PATH = "/retained/evidence/provider-process.jsonl";
const RUNNER_PID = 41_000;
const INITIAL_PID = 41_101;
const SUCCESSOR_PID = 41_202;
const INITIAL_NONCE = "a".repeat(48);
const SUCCESSOR_NONCE = "b".repeat(48);
const PROVIDER_AGENT = "Unhelpful";

const HASHES = {
  runner: "1".repeat(64),
  worker: "2".repeat(64),
  python: "3".repeat(64),
  targetReceipt: "0".repeat(64),
} as const;

type JsonRecord = Record<string, unknown>;

interface EventFixture {
  eventType: string;
  details: JsonRecord;
}

interface MaterializedFixture {
  input: ToolSandboxProviderProcessTraceInput;
  events: EventFixture[];
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function canonicalStringify(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("fixture contains non-finite JSON");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalStringify).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.entries(value)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, child]) => `${JSON.stringify(key)}:${canonicalStringify(child)}`)
      .join(",")}}`;
  }
  throw new Error(`fixture contains unsupported JSON value ${typeof value}`);
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function sha256Json(value: unknown): string {
  return sha256(canonicalStringify(value));
}

function encodeFrame(value: JsonRecord): Buffer {
  return Buffer.from(`${canonicalStringify(value)}\n`, "utf8");
}

function frameFields(prefix: string, value: JsonRecord): JsonRecord {
  const raw = encodeFrame(value);
  return {
    [`${prefix}Sha256`]: sha256(raw),
    [`${prefix}ByteLength`]: raw.length,
    [`${prefix}Base64`]: raw.toString("base64"),
  };
}

function readFrame(details: JsonRecord, prefix: string): JsonRecord {
  const encoded = details[`${prefix}Base64`];
  if (typeof encoded !== "string") throw new Error(`missing ${prefix} fixture`);
  const parsed = JSON.parse(Buffer.from(encoded, "base64").toString("utf8")) as unknown;
  if (!isRecord(parsed)) throw new Error(`invalid ${prefix} fixture`);
  return parsed;
}

function replaceFrame(details: JsonRecord, prefix: string, frame: JsonRecord): void {
  Object.assign(details, frameFields(prefix, frame));
}

function processIdentity(
  processInstance: number,
  pid: number,
  processNonce: string,
): JsonRecord {
  return { processInstance, pid, processGroupId: pid, processNonce };
}

function context(rows: readonly JsonRecord[]): JsonRecord {
  return {
    _dbs: {
      SANDBOX: rows.map((row) => structuredClone(row)),
      MESSAGING: [],
    },
    interactive_console: null,
    tool_allow_list: null,
    tool_deny_list: null,
    trace_tool: false,
    tool_augmentation_list: [],
    preferred_tool_backend: "DEFAULT",
  };
}

const SYSTEM_ROW: JsonRecord = {
  sandbox_message_index: 0,
  sender: "SYSTEM",
  recipient: "AGENT",
  content: "Complete the public scenario.",
};
const INITIAL_AGENT_ROW: JsonRecord = {
  sandbox_message_index: 1,
  sender: "AGENT",
  recipient: "EXECUTION_ENVIRONMENT",
  content: "perform_task()",
};
const LOST_RESPONSE_ROW: JsonRecord = {
  sandbox_message_index: 2,
  sender: "EXECUTION_ENVIRONMENT",
  recipient: "AGENT",
  content: LOST_RESPONSE,
};
const SUCCESSOR_AGENT_ROW: JsonRecord = {
  sandbox_message_index: 3,
  sender: "AGENT",
  recipient: "USER",
  content: "I will reconcile the unknown outcome before retrying.",
};

function spawnEvents(
  reason: "initial" | "scheduled_lost_response_restart",
  processInstance: number,
  pid: number,
  processNonce: string,
): EventFixture[] {
  const init = {
    schemaVersion: INIT_SCHEMA,
    agent: PROVIDER_AGENT,
    attemptId: ATTEMPT_ID,
    processInstance,
    expectedParentPid: RUNNER_PID,
    expectedWorkerSha256: HASHES.worker,
    expectedPythonExecutableSha256: HASHES.python,
  };
  const handshake = {
    schemaVersion: HANDSHAKE_SCHEMA,
    kind: "handshake",
    attemptId: ATTEMPT_ID,
    processInstance,
    pid,
    ppid: RUNNER_PID,
    processNonce,
    workerSha256: HASHES.worker,
    pythonExecutableSha256: HASHES.python,
  };
  return [
    {
      eventType: "worker_spawn_requested",
      details: {
        reason,
        processInstance,
        workerSha256: HASHES.worker,
        pythonExecutableSha256: HASHES.python,
      },
    },
    {
      eventType: "worker_handshake_accepted",
      details: {
        ...processIdentity(processInstance, pid, processNonce),
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

function contextExchange(
  processInstance: number,
  pid: number,
  processNonce: string,
  requestSequence: number,
  beforeRowsOverride?: readonly JsonRecord[],
  appendedRowOverride?: JsonRecord,
): EventFixture[] {
  const beforeRows = beforeRowsOverride ?? (processInstance === 1
    ? [SYSTEM_ROW]
    : [SYSTEM_ROW, INITIAL_AGENT_ROW, LOST_RESPONSE_ROW]);
  const appendedRow = appendedRowOverride ??
    (processInstance === 1 ? INITIAL_AGENT_ROW : SUCCESSOR_AGENT_ROW);
  const before = context(beforeRows);
  const after = context([...beforeRows, appendedRow]);
  const contextHashBefore = sha256Json(before);
  const contextHashAfter = sha256Json(after);
  const requestId = `${ATTEMPT_ID}:provider:${processInstance}:${requestSequence}`;
  const requestFrame = {
    schemaVersion: REQUEST_SCHEMA,
    kind: "respond",
    requestId,
    attemptId: ATTEMPT_ID,
    processInstance,
    processNonce,
    endingIndex: null,
    contextHash: contextHashBefore,
    context: before,
  };
  const responseFrame = {
    schemaVersion: RESPONSE_SCHEMA,
    kind: "responded",
    requestId,
    attemptId: ATTEMPT_ID,
    processInstance,
    processNonce,
    contextHashBefore,
    contextHashAfter,
    context: after,
  };
  const identity = processIdentity(processInstance, pid, processNonce);
  return [
    {
      eventType: "context_request_sent",
      details: {
        ...identity,
        requestId,
        endingIndex: null,
        contextHashBefore,
        ...frameFields("requestFrame", requestFrame),
      },
    },
    {
      eventType: "context_response_accepted",
      details: {
        ...identity,
        requestId,
        contextHashBefore,
        contextHashAfter,
        ...frameFields("responseFrame", responseFrame),
        appendedAgentMessageCount: 1,
      },
    },
  ];
}

function shutdownEvents(
  processInstance: number,
  pid: number,
  processNonce: string,
  requestSequence: number,
): EventFixture[] {
  const identity = processIdentity(processInstance, pid, processNonce);
  const requestId = `${ATTEMPT_ID}:provider:${processInstance}:shutdown-${requestSequence}`;
  const requestFrame = {
    schemaVersion: REQUEST_SCHEMA,
    kind: "shutdown",
    requestId,
    attemptId: ATTEMPT_ID,
    processInstance,
    processNonce,
  };
  const responseFrame = {
    schemaVersion: RESPONSE_SCHEMA,
    kind: "shutdown_acknowledged",
    requestId,
    attemptId: ATTEMPT_ID,
    processInstance,
    processNonce,
  };
  return [
    {
      eventType: "clean_shutdown_requested",
      details: {
        ...identity,
        requestId,
        ...frameFields("requestFrame", requestFrame),
      },
    },
    {
      eventType: "clean_shutdown_acknowledged",
      details: {
        ...identity,
        requestId,
        ...frameFields("responseFrame", responseFrame),
      },
    },
    { eventType: "worker_reaped_clean", details: { ...identity, returnCode: 0 } },
  ];
}

function appliedFaultEvidence(): Extract<ToolSandboxFaultEvidence, { status: "applied" }> {
  return {
    status: "applied",
    targetCallId: "send_message:scheduled-call-001",
    targetSideEffectReceiptHash: HASHES.targetReceipt,
    restartedAgentSessionId: `provider-process-002-${SUCCESSOR_NONCE.slice(0, 12)}`,
    appliedAtTurn: 2,
  };
}

function successfulEvents(restart: boolean): EventFixture[] {
  const events: EventFixture[] = [
    {
      eventType: "supervisor_initialized",
      details: {
        runnerPid: RUNNER_PID,
        runnerPpid: 40_999,
        runnerSha256: HASHES.runner,
        workerSha256: HASHES.worker,
        pythonExecutableSha256: HASHES.python,
      },
    },
    ...spawnEvents("initial", 1, INITIAL_PID, INITIAL_NONCE),
    ...contextExchange(1, INITIAL_PID, INITIAL_NONCE, 1),
  ];
  if (!restart) return [...events, ...shutdownEvents(1, INITIAL_PID, INITIAL_NONCE, 2)];
  const initialIdentity = processIdentity(1, INITIAL_PID, INITIAL_NONCE);
  return [
    ...events,
    {
      eventType: "lost_response_fault_bound",
      details: {
        ...initialIdentity,
        targetCallId: "send_message:scheduled-call-001",
        targetSideEffectReceiptHash: HASHES.targetReceipt,
        lostResponseHash: sha256(LOST_RESPONSE),
        contextHashAfterLostResponse: sha256Json(
          context([SYSTEM_ROW, INITIAL_AGENT_ROW, LOST_RESPONSE_ROW]),
        ),
        appliedAtTurn: 2,
      },
    },
    { eventType: "restart_requested", details: initialIdentity },
    { eventType: "sigkill_sent", details: { ...initialIdentity, signal: 9 } },
    {
      eventType: "worker_reaped_after_sigkill",
      details: { ...initialIdentity, signal: 9, returnCode: -9 },
    },
    ...spawnEvents("scheduled_lost_response_restart", 2, SUCCESSOR_PID, SUCCESSOR_NONCE),
    ...contextExchange(2, SUCCESSOR_PID, SUCCESSOR_NONCE, 2),
    ...shutdownEvents(2, SUCCESSOR_PID, SUCCESSOR_NONCE, 3),
  ];
}

function materialize(
  events: readonly EventFixture[],
  faultEvidence: ToolSandboxFaultEvidence | undefined,
): MaterializedFixture {
  let previousEntryHash: string | null = null;
  const traceEntries = events.map((event, index) => {
    const body = {
      schemaVersion: TRACE_SCHEMA,
      sequence: index + 1,
      previousEntryHash,
      attemptId: ATTEMPT_ID,
      arm: "substrate",
      evaluationTrack: "restart_lost_response_derivative",
      eventType: event.eventType,
      recordedAt: new Date(Date.UTC(2026, 6, 13, 12, 0, 0, index)).toISOString(),
      details: event.details,
    };
    const entryHash = sha256(canonicalStringify(body));
    previousEntryHash = entryHash;
    return { ...body, entryHash };
  });
  const traceBytes = Buffer.from(
    `${traceEntries.map((entry) => JSON.stringify(entry)).join("\n")}\n`,
    "utf8",
  );
  const restartCount = faultEvidence?.status === "applied" ? 1 : 0;
  return {
    events: events.map((event) => structuredClone(event)),
    input: {
      tracePath: TRACE_PATH,
      traceBytes,
      summary: {
        tracePath: TRACE_PATH,
        traceSha256: sha256(traceBytes),
        traceHeadHash: previousEntryHash,
        traceEntryCount: traceEntries.length,
        processInstanceCount: restartCount + 1,
        restartCount,
        restartSemantics: RESTART_SEMANTICS,
        runnerSha256: HASHES.runner,
        workerSha256: HASHES.worker,
        pythonExecutableSha256: HASHES.python,
      },
      attemptId: ATTEMPT_ID,
      arm: "substrate",
      evaluationTrack: "restart_lost_response_derivative",
      faultEvidence,
      runnerSha256: HASHES.runner,
      workerSha256: HASHES.worker,
      pythonExecutableSha256: HASHES.python,
    },
  };
}

function noRestartFixture(): MaterializedFixture {
  return materialize(successfulEvents(false), {
    status: "trigger_not_reached",
    reason: "the scheduled side-effect call was not proposed",
  });
}

function appliedRestartFixture(): MaterializedFixture {
  return materialize(successfulEvents(true), appliedFaultEvidence());
}

function mutateAndRehash(
  fixture: MaterializedFixture,
  mutate: (events: EventFixture[]) => void,
): ToolSandboxProviderProcessTraceInput {
  const events = fixture.events.map((candidate) => structuredClone(candidate));
  mutate(events);
  return materialize(events, fixture.input.faultEvidence).input;
}

function event(events: EventFixture[], eventType: string, occurrence = 0): EventFixture {
  const match = events.filter((candidate) => candidate.eventType === eventType)[occurrence];
  if (match === undefined) throw new Error(`missing fixture event ${eventType}`);
  return match;
}

describe("ToolSandbox provider-process trace verifier", () => {
  it("accepts and exposes a replayed context exchange without restart", () => {
    const fixture = noRestartFixture();
    const verified = verifyToolSandboxProviderProcessTrace(fixture.input);

    expect(verified).toMatchObject({
      processInstanceCount: 1,
      restartCount: 0,
      processIds: [INITIAL_PID],
      processNonces: [INITIAL_NONCE],
      providerAgent: PROVIDER_AGENT,
      contextExchangeCount: 1,
      successorContextResponseCount: 0,
      actualOsProcessRestartVerified: false,
    });
    expect(verified.contextExchanges[0]).toMatchObject({
      processInstance: 1,
      sandboxMessageCountBefore: 1,
      sandboxMessageCountAfter: 2,
      appendedAgentMessageCount: 1,
      appendedAgentMessages: [INITIAL_AGENT_ROW],
    });
  });

  it("accepts ToolSandbox snapshot headguards inserted between accepted exchanges", () => {
    const events = successfulEvents(false);
    events.splice(
      -3,
      0,
      ...contextExchange(
        1,
        INITIAL_PID,
        INITIAL_NONCE,
        2,
        [
          SYSTEM_ROW,
          {
            sandbox_message_index: 1,
            sender: null,
            recipient: null,
            content: null,
          },
          INITIAL_AGENT_ROW,
          {
            sandbox_message_index: 2,
            sender: "EXECUTION_ENVIRONMENT",
            recipient: "AGENT",
            content: "None",
          },
        ],
        {
          sandbox_message_index: 3,
          sender: "AGENT",
          recipient: "USER",
          content: "The task is complete.",
        },
      ),
    );
    const fixture = materialize(events, {
      status: "trigger_not_reached",
      reason: "the scheduled side-effect call was not proposed",
    });

    const verified = verifyToolSandboxProviderProcessTrace(fixture.input);

    expect(verified.contextExchangeCount).toBe(2);
    expect(verified.contextExchanges[1]?.appendedAgentMessageCount).toBe(1);
  });

  it("does not treat a non-null inserted message as a snapshot headguard", () => {
    const events = successfulEvents(false);
    events.splice(
      -3,
      0,
      ...contextExchange(
        1,
        INITIAL_PID,
        INITIAL_NONCE,
        2,
        [
          SYSTEM_ROW,
          {
            sandbox_message_index: 1,
            sender: "USER",
            recipient: null,
            content: null,
          },
          INITIAL_AGENT_ROW,
        ],
        {
          sandbox_message_index: 2,
          sender: "AGENT",
          recipient: "USER",
          content: "The task is complete.",
        },
      ),
    );
    const fixture = materialize(events, {
      status: "trigger_not_reached",
      reason: "the scheduled side-effect call was not proposed",
    });

    expect(() => verifyToolSandboxProviderProcessTrace(fixture.input)).toThrow(
      /unrelated to the previously accepted provider context/,
    );
  });

  it("accepts SIGKILL/reap plus a verified successor response before shutdown", () => {
    const fixture = appliedRestartFixture();
    const verified = verifyToolSandboxProviderProcessTrace(fixture.input);

    expect(verified).toMatchObject({
      processInstanceCount: 2,
      restartCount: 1,
      processIds: [INITIAL_PID, SUCCESSOR_PID],
      processNonces: [INITIAL_NONCE, SUCCESSOR_NONCE],
      contextExchangeCount: 2,
      successorContextResponseCount: 1,
      actualOsProcessRestartVerified: true,
      restartSemantics: RESTART_SEMANTICS,
    });
    expect(verified.contextExchanges[1]?.appendedAgentMessages).toEqual([
      SUCCESSOR_AGENT_ROW,
    ]);
  });

  it.each([
    ["PID", "pid", INITIAL_PID],
    ["process nonce", "processNonce", INITIAL_NONCE],
  ] as const)("rejects a successor that reuses the old %s", (_label, key, value) => {
    const fixture = appliedRestartFixture();
    const input = mutateAndRehash(fixture, (events) => {
      const accepted = event(events, "worker_handshake_accepted", 1);
      accepted.details[key] = value;
      if (key === "pid") accepted.details["processGroupId"] = value;
      const handshake = readFrame(accepted.details, "handshakeFrame");
      handshake[key] = value;
      replaceFrame(accepted.details, "handshakeFrame", handshake);
    });

    expect(() => verifyToolSandboxProviderProcessTrace(input)).toThrow(
      /successor is not a distinct OS process identity/,
    );
  });

  it("rejects a successor spawn claimed before the old worker is reaped", () => {
    const fixture = appliedRestartFixture();
    const input = mutateAndRehash(fixture, (events) => {
      const reapIndex = events.findIndex((candidate) => candidate.eventType === "worker_reaped_after_sigkill");
      const spawnIndex = events.findIndex((candidate) => candidate.eventType === "worker_spawn_requested" && candidate.details["processInstance"] === 2);
      const [spawn] = events.splice(spawnIndex, 1);
      if (spawn === undefined || reapIndex < 0) throw new Error("invalid fixture order");
      events.splice(reapIndex, 0, spawn);
    });
    expect(() => verifyToolSandboxProviderProcessTrace(input)).toThrow(
      /expected worker_reaped_after_sigkill/,
    );
  });

  it("rejects a same-process fake session label without an OS restart lifecycle", () => {
    const fixture = noRestartFixture();
    const fakeAppliedEvidence: ToolSandboxFaultEvidence = {
      ...appliedFaultEvidence(),
      restartedAgentSessionId: "same-python-process-session-002",
    };
    const input = materialize(fixture.events, fakeAppliedEvidence).input;
    expect(() => verifyToolSandboxProviderProcessTrace(input)).toThrow(
      /summary\/fault evidence disagrees with replayed lifecycle/,
    );
  });

  it("rejects an altered target-side receipt after trace-chain recomputation", () => {
    const fixture = appliedRestartFixture();
    const input = mutateAndRehash(fixture, (events) => {
      event(events, "lost_response_fault_bound").details["targetSideEffectReceiptHash"] = "9".repeat(64);
    });
    expect(() => verifyToolSandboxProviderProcessTrace(input)).toThrow(
      /does not bind the retained fault evidence/,
    );
  });

  it("rejects a forged entry hash", () => {
    const fixture = appliedRestartFixture();
    const lines = Buffer.from(fixture.input.traceBytes).toString("utf8").trimEnd().split("\n");
    const faultIndex = lines.findIndex((line) => line.includes("lost_response_fault_bound"));
    const forged = JSON.parse(lines[faultIndex] ?? "null") as JsonRecord;
    const details = forged["details"];
    if (!isRecord(details)) throw new Error("invalid fault fixture");
    details["appliedAtTurn"] = 8;
    lines[faultIndex] = JSON.stringify(forged);
    const input = { ...fixture.input, traceBytes: Buffer.from(`${lines.join("\n")}\n`, "utf8") };
    expect(() => verifyToolSandboxProviderProcessTrace(input)).toThrow(
      /entry hash does not recompute/,
    );
  });

  it("rejects a lifecycle missing the final clean reap", () => {
    const fixture = appliedRestartFixture();
    const input = mutateAndRehash(fixture, (events) => {
      if (events.at(-1)?.eventType !== "worker_reaped_clean") throw new Error("invalid fixture");
      events.pop();
    });
    expect(() => verifyToolSandboxProviderProcessTrace(input)).toThrow(
      /expected worker_reaped_clean/,
    );
  });

  it.each([
    ["runner", "runnerSha256"],
    ["worker", "workerSha256"],
    ["Python runtime", "pythonExecutableSha256"],
  ] as const)("rejects the wrong %s hash", (_label, key) => {
    const fixture = appliedRestartFixture();
    const input = { ...fixture.input, [key]: "6".repeat(64) };
    expect(() => verifyToolSandboxProviderProcessTrace(input)).toThrow(
      /summary does not bind the raw process trace\/runtime/,
    );
  });

  it("rejects a lifecycle with all context exchanges removed", () => {
    const fixture = noRestartFixture();
    const input = mutateAndRehash(fixture, (events) => {
      for (let index = events.length - 1; index >= 0; index -= 1) {
        if (["context_request_sent", "context_response_accepted"].includes(events[index]!.eventType)) {
          events.splice(index, 1);
        }
      }
    });
    expect(() => verifyToolSandboxProviderProcessTrace(input)).toThrow(
      /no accepted context exchange/,
    );
  });

  it("rejects an altered returned context whose appended count stays unchanged", () => {
    const fixture = noRestartFixture();
    const input = mutateAndRehash(fixture, (events) => {
      const accepted = event(events, "context_response_accepted");
      const response = readFrame(accepted.details, "responseFrame");
      const returned = response["context"];
      if (!isRecord(returned) || !isRecord(returned["_dbs"])) throw new Error("invalid fixture");
      const rows = returned["_dbs"]["SANDBOX"];
      if (!Array.isArray(rows)) throw new Error("invalid fixture rows");
      rows.push({
        sandbox_message_index: 2,
        sender: "AGENT",
        recipient: "USER",
        content: "unreported second append",
      });
      response["contextHashAfter"] = sha256Json(returned);
      accepted.details["contextHashAfter"] = response["contextHashAfter"];
      replaceFrame(accepted.details, "responseFrame", response);
    });
    expect(() => verifyToolSandboxProviderProcessTrace(input)).toThrow(
      /appended count does not match the decoded context transition/,
    );
  });

  it("rejects an unrelated canonical protocol frame substituted into an exchange", () => {
    const fixture = noRestartFixture();
    const input = mutateAndRehash(fixture, (events) => {
      const requested = event(events, "context_request_sent");
      replaceFrame(requested.details, "requestFrame", {
        schemaVersion: REQUEST_SCHEMA,
        kind: "shutdown",
        requestId: requested.details["requestId"],
        attemptId: ATTEMPT_ID,
        processInstance: 1,
        processNonce: INITIAL_NONCE,
      });
    });
    expect(() => verifyToolSandboxProviderProcessTrace(input)).toThrow(
      /requestFrame has missing or unexpected fields/,
    );
  });

  it("rejects an immediate successor shutdown with no accepted successor response", () => {
    const fixture = appliedRestartFixture();
    const input = mutateAndRehash(fixture, (events) => {
      const successorRequest = events.findIndex((candidate) => candidate.eventType === "context_request_sent" && candidate.details["processInstance"] === 2);
      if (successorRequest < 0) throw new Error("missing successor exchange");
      events.splice(successorRequest, 2);
    });
    expect(() => verifyToolSandboxProviderProcessTrace(input)).toThrow(
      /shut down before an accepted successor context response/,
    );
  });
});
