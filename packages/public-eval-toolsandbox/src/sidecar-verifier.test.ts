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

import {
  verifyToolSandboxSidecarEvidence,
  type ToolSandboxSidecarVerificationInput,
} from "./sidecar-verifier.js";
import { buildToolSandboxSidecarRuntimeClosure } from "./runtime-closure.js";

const GENESIS_HASH = "0".repeat(64);
const roots = new Set<string>();

afterEach(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
  roots.clear();
});

type JsonRecord = Record<string, unknown>;

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

function jsonBytes(value: unknown): Buffer {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function jsonLine(value: unknown): Buffer {
  return Buffer.from(`${JSON.stringify(value)}\n`, "utf8");
}

function hashedRecord<T extends JsonRecord>(body: T, hashKey: string): JsonRecord {
  return { ...body, [hashKey]: sha256Json(body) };
}

interface Fixture {
  readonly root: string;
  readonly input: ToolSandboxSidecarVerificationInput;
}

function fixture(operationCount: 0 | 1): Fixture {
  const root = mkdtempSync(resolve(tmpdir(), "toolsandbox-sidecar-verifier-"));
  roots.add(root);
  const statePath = resolve(root, "boundary.json");
  const auditPath = resolve(root, "audit.jsonl");
  const readyPath = resolve(root, "ready.json");
  const finalReceiptPath = resolve(root, "final.json");
  const operationLedgerPath = `${statePath}.sidecar-operations.jsonl`;
  const stateLockPath = `${statePath}.sidecar.lock`;
  const expectedNodePath = resolve(root, "runtime", "node");
  const publicRuntimeRoot = resolve(root, "runtime", "public-eval-toolsandbox");
  const coreRuntimeRoot = resolve(root, "runtime", "agent-state-core");
  const typesRuntimeRoot = resolve(root, "runtime", "types");
  mkdirSync(publicRuntimeRoot, { recursive: true });
  mkdirSync(coreRuntimeRoot, { recursive: true });
  mkdirSync(typesRuntimeRoot, { recursive: true });
  const expectedEntryPath = resolve(publicRuntimeRoot, "sidecar-entry.js");
  writeFileSync(expectedEntryPath, "import './sidecar.js';\n", "utf8");
  writeFileSync(resolve(publicRuntimeRoot, "sidecar.js"), "export const sidecar = true;\n", "utf8");
  const coreEntryPath = resolve(coreRuntimeRoot, "index.js");
  writeFileSync(coreEntryPath, "export * from './external-evidence.js';\n", "utf8");
  writeFileSync(resolve(coreRuntimeRoot, "external-evidence.js"), "export const core = true;\n", "utf8");
  const typesEntryPath = resolve(typesRuntimeRoot, "index.js");
  writeFileSync(typesEntryPath, "export const types = true;\n", "utf8");
  const expectedRuntimeModuleClosure = buildToolSandboxSidecarRuntimeClosure({
    publicEvalEntryPath: expectedEntryPath,
    agentStateCoreEntryPath: coreEntryPath,
    typesEntryPath,
  });
  const expectedNodeSha256 = sha256("pinned-node-runtime");
  const expectedEntrySha256 = sha256(readFileSync(expectedEntryPath));
  const expectedTokenSha256 = sha256("ephemeral-bearer-token");
  const expectedPid = 42_101;
  const expectedPpid = 42_100;
  const startedAt = "2026-07-13T12:00:00.000Z";
  const config = {
    schemaVersion: "pm.public-eval.toolsandbox-sidecar-config.v1",
    arm: "substrate",
    evaluationTrack: "restart_lost_response_derivative",
    attemptId: "attempt-sidecar-001",
    statePath,
    auditPath,
    readyPath,
    finalReceiptPath,
    operationLedgerPath,
    stateLockPath,
    host: "127.0.0.1",
    requestedPort: 0,
    maxRequestBytes: 64 * 1024,
    tokenSha256: expectedTokenSha256,
    moduleResolutionEnvironment: {
      nodeOptions: "absent",
      nodePath: "absent",
    },
    executableEvidence: {
      node: { path: expectedNodePath, sha256: expectedNodeSha256 },
      entry: { path: expectedEntryPath, sha256: expectedEntrySha256 },
      runtimeModuleClosure: expectedRuntimeModuleClosure,
    },
  };
  const configHash = sha256Json(config);
  const lockHash = sha256("startup-lock-record");
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
  const ready = hashedRecord(readyBody, "readyHash");

  let auditBytes = Buffer.alloc(0);
  let operationLedgerBytes = Buffer.alloc(0);
  let clientTraceBytes = Buffer.alloc(0);
  let auditHeadHash = GENESIS_HASH;
  let operationHeadHash = GENESIS_HASH;
  if (operationCount === 1) {
    const request = {
      schemaVersion: "pm.public-eval.toolsandbox-tool-proposal.v1",
      arm: "substrate",
      evaluationTrack: "restart_lost_response_derivative",
      attemptId: "attempt-sidecar-001",
      sessionId: "session-001",
      statePath,
      toolCallId: "call-send-001",
      toolName: "send_message_with_phone_number",
      arguments: { phone_number: "+15555550100", content: "hello" },
      proposedAt: "2026-07-13T12:00:00.005Z",
    };
    const requestBytes = Buffer.from(canonicalJson(request), "utf8");
    const response = {
      schemaVersion: "pm.public-eval.toolsandbox-tool-proposal-receipt.v1",
      proposalId: "proposal-001",
      decision: "allow",
    };
    const responseBytes = Buffer.from(`${JSON.stringify(response)}\n`, "utf8");
    const operationKeySha256 = sha256("attempt-sidecar-001:admit:session-001:call-send-001");
    const requestHash = sha256Json({
      method: "POST",
      target: "/v1/admit-tool",
      bodyBytesBase64: requestBytes.toString("base64"),
    });
    const requestId = "ea616d8a-c81d-4cf5-b65f-713339275ee4";
    const preparedBody = {
      schemaVersion: "pm.public-eval.toolsandbox-sidecar-operation.v1",
      sequence: 1,
      previousRecordHash: GENESIS_HASH,
      phase: "prepared",
      operationKeySha256,
      requestHash,
      preparedAt: "2026-07-13T12:00:00.010Z",
    };
    const prepared = hashedRecord(preparedBody, "recordHash");
    const completedBody = {
      schemaVersion: "pm.public-eval.toolsandbox-sidecar-operation.v1",
      sequence: 2,
      previousRecordHash: prepared["recordHash"],
      phase: "completed",
      operationKeySha256,
      requestHash,
      status: 200,
      responseBytesBase64: responseBytes.toString("base64"),
      responseSha256: sha256(responseBytes),
      responseRequestId: requestId,
      completedAt: "2026-07-13T12:00:00.011Z",
    };
    const completed = hashedRecord(completedBody, "recordHash");
    operationLedgerBytes = Buffer.concat([jsonLine(prepared), jsonLine(completed)]);
    operationHeadHash = completed["recordHash"] as string;

    const auditBody = {
      schemaVersion: "pm.public-eval.toolsandbox-sidecar-audit.v1",
      sequence: 1,
      previousRecordHash: GENESIS_HASH,
      requestId,
      pid: expectedPid,
      receivedAt: "2026-07-13T12:00:00.009Z",
      completedAt: "2026-07-13T12:00:00.012Z",
      request: {
        method: "POST",
        target: "/v1/admit-tool",
        remoteAddress: "127.0.0.1",
        bodyComplete: true,
        bodyByteLength: requestBytes.byteLength,
        bodyBytesBase64: requestBytes.toString("base64"),
        bodySha256: sha256(requestBytes),
        authenticated: true,
        operationKeySha256,
        idempotencyDisposition: "new",
      },
      generatedResponse: {
        status: 200,
        bodyByteLength: responseBytes.byteLength,
        bodyBytesBase64: responseBytes.toString("base64"),
        bodySha256: sha256(responseBytes),
        responseRequestId: requestId,
      },
    };
    const audit = hashedRecord(auditBody, "recordHash");
    auditBytes = jsonLine(audit);
    auditHeadHash = audit["recordHash"] as string;

    const clientBody = {
      schemaVersion: "pm.public-eval.toolsandbox-boundary-http-client.v1",
      sequence: 1,
      previousEntryHash: GENESIS_HASH,
      command: "admit-tool",
      request,
      response,
      http: {
        endpointPath: "/v1/admit-tool",
        operationKeySha256,
        request: {
          bodyByteLength: requestBytes.byteLength,
          bodyBytesBase64: requestBytes.toString("base64"),
          bodySha256: sha256(requestBytes),
        },
        response: {
          status: 200,
          contentType: "application/json",
          requestId,
          bodyByteLength: responseBytes.byteLength,
          bodyBytesBase64: responseBytes.toString("base64"),
          bodySha256: sha256(responseBytes),
        },
      },
    };
    clientTraceBytes = jsonLine(hashedRecord(clientBody, "entryHash"));
  }

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
      initiatedAt: "2026-07-13T12:00:00.020Z",
      completedAt: "2026-07-13T12:00:00.021Z",
    },
    audit: {
      path: auditPath,
      recordCount: operationCount,
      headHash: auditHeadHash,
      byteLength: auditBytes.byteLength,
      sha256: sha256(auditBytes),
    },
    operationLedger: {
      path: operationLedgerPath,
      sequence: operationCount * 2,
      headHash: operationHeadHash,
      byteLength: operationLedgerBytes.byteLength,
      sha256: sha256(operationLedgerBytes),
    },
    stateLock: { path: stateLockPath, lockHash, released: true },
  };
  const finalReceipt = hashedRecord(finalBody, "finalHash");
  return {
    root,
    input: {
      arm: "substrate",
      evaluationTrack: "restart_lost_response_derivative",
      attemptId: "attempt-sidecar-001",
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
      readyBytes: jsonBytes(ready),
      finalReceiptBytes: jsonBytes(finalReceipt),
      auditBytes,
      operationLedgerBytes,
      clientTraceBytes,
    },
  };
}

function rewriteSingleClient(
  bytes: Uint8Array,
  update: (entry: JsonRecord) => void,
): Buffer {
  const entry = JSON.parse(Buffer.from(bytes).toString("utf8")) as JsonRecord;
  update(entry);
  const { entryHash: _ignored, ...body } = entry;
  return jsonLine({ ...body, entryHash: sha256Json(body) });
}

describe("independent ToolSandbox sidecar evidence replay", () => {
  it("computes the same runtime byte identity from different checkout roots", () => {
    const first = fixture(0);
    const second = fixture(0);

    expect(first.input.expectedEntryPath).not.toBe(second.input.expectedEntryPath);
    expect(first.input.expectedRuntimeModuleClosure).toEqual(
      second.input.expectedRuntimeModuleClosure,
    );
  });

  it("verifies a structurally complete empty no-call sidecar", () => {
    const { input } = fixture(0);
    const result = verifyToolSandboxSidecarEvidence(input);
    expect(result).toMatchObject({
      auditRecordCount: 0,
      operationRecordCount: 0,
      clientTraceRecordCount: 0,
      auditHeadHash: GENESIS_HASH,
      operationHeadHash: GENESIS_HASH,
      clientTraceHeadHash: GENESIS_HASH,
      realAuthenticatedHttpSidecarProtocolVerified: true,
    });
  });

  it("cross-replays one exact HTTP request/response and durable operation pair", () => {
    const { input } = fixture(1);
    const result = verifyToolSandboxSidecarEvidence(input);
    expect(result.auditRecordCount).toBe(1);
    expect(result.operationRecordCount).toBe(2);
    expect(result.clientTraceRecordCount).toBe(1);
    expect(result.realAuthenticatedHttpSidecarProtocolVerified).toBe(true);
  });

  it("rejects a caller-authored fake sidecar verification flag", () => {
    const { input } = fixture(0);
    expect(() =>
      verifyToolSandboxSidecarEvidence({
        ...input,
        realAuthenticatedHttpSidecarProtocolVerified: true,
      } as ToolSandboxSidecarVerificationInput),
    ).toThrow(/unexpected fields/u);
  });

  it("rejects altered retained bytes", () => {
    const { input } = fixture(1);
    const altered = Buffer.from(input.auditBytes);
    altered[20] = altered[20]! ^ 1;
    expect(() =>
      verifyToolSandboxSidecarEvidence({ ...input, auditBytes: altered }),
    ).toThrow();
  });

  it("rejects non-entry implementation substitution while the old receipt remains self-consistent", () => {
    const { input } = fixture(0);
    writeFileSync(
      resolve(input.expectedEntryPath, "..", "sidecar.js"),
      "export const sidecar = 'substituted';\n",
      "utf8",
    );
    const trustedRuntimeModuleClosure = buildToolSandboxSidecarRuntimeClosure({
      publicEvalEntryPath: input.expectedEntryPath,
      agentStateCoreEntryPath: resolve(
        input.expectedEntryPath,
        "../../agent-state-core/index.js",
      ),
      typesEntryPath: resolve(input.expectedEntryPath, "../../types/index.js"),
    });
    expect(() =>
      verifyToolSandboxSidecarEvidence({
        ...input,
        expectedRuntimeModuleClosure: trustedRuntimeModuleClosure,
      }),
    ).toThrow(
      /does not match the trusted launch inventory/u,
    );
  });

  it("rejects a self-consistent client trace with a forged response request ID", () => {
    const { input } = fixture(1);
    const clientTraceBytes = rewriteSingleClient(input.clientTraceBytes, (entry) => {
      const http = entry["http"] as JsonRecord;
      const response = http["response"] as JsonRecord;
      response["requestId"] = "forged-client-request-id";
    });
    expect(() =>
      verifyToolSandboxSidecarEvidence({ ...input, clientTraceBytes }),
    ).toThrow(/do not pair/u);
  });

  it("rejects reordered operation records", () => {
    const { input } = fixture(1);
    const lines = Buffer.from(input.operationLedgerBytes)
      .toString("utf8")
      .trimEnd()
      .split("\n");
    const operationLedgerBytes = Buffer.from(`${lines.reverse().join("\n")}\n`);
    expect(() =>
      verifyToolSandboxSidecarEvidence({ ...input, operationLedgerBytes }),
    ).toThrow(/operation hash chain/u);
  });

  it("rejects the wrong expected process identity", () => {
    const { input } = fixture(0);
    expect(() =>
      verifyToolSandboxSidecarEvidence({ ...input, expectedPid: input.expectedPid + 1 }),
    ).toThrow(/process identity/u);
  });

  it("rejects a state lock that still exists after the final receipt", () => {
    const { input } = fixture(0);
    writeFileSync(input.stateLockPath, "still-held\n", "utf8");
    expect(() => verifyToolSandboxSidecarEvidence(input)).toThrow(/not independently observed released/u);
  });

  it("rejects missing or extra server/client records even when their own chains parse", () => {
    const missing = fixture(1).input;
    expect(() =>
      verifyToolSandboxSidecarEvidence({ ...missing, clientTraceBytes: Buffer.alloc(0) }),
    ).toThrow(/missing or extra/u);

    const extra = fixture(1).input;
    const first = JSON.parse(Buffer.from(extra.clientTraceBytes).toString("utf8")) as JsonRecord;
    const secondBody = {
      ...first,
      sequence: 2,
      previousEntryHash: first["entryHash"],
    } as JsonRecord;
    delete secondBody["entryHash"];
    const second = hashedRecord(secondBody, "entryHash");
    const clientTraceBytes = Buffer.concat([Buffer.from(extra.clientTraceBytes), jsonLine(second)]);
    expect(() =>
      verifyToolSandboxSidecarEvidence({ ...extra, clientTraceBytes }),
    ).toThrow(/missing or extra/u);
  });
});
