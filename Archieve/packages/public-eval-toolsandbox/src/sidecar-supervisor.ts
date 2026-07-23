import { createHash, randomBytes } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import {
  closeSync,
  existsSync,
  openSync,
  readFileSync,
  realpathSync,
} from "node:fs";
import { resolve } from "node:path";

import type {
  ToolSandboxBoundaryArm,
  ToolSandboxEvaluationTrack,
} from "./index.js";
import {
  computeToolSandboxSidecarRuntimeClosure,
  verifyToolSandboxSidecarRuntimeClosure,
  type ToolSandboxSidecarRuntimeClosure,
} from "./runtime-closure.js";

type JsonRecord = Record<string, unknown>;

export interface ToolSandboxSidecarSupervisorInput {
  readonly nodeExecutable: string;
  readonly entryPath: string;
  readonly arm: ToolSandboxBoundaryArm;
  readonly evaluationTrack: ToolSandboxEvaluationTrack;
  readonly attemptId: string;
  readonly statePath: string;
  readonly auditPath: string;
  readonly readyPath: string;
  readonly finalReceiptPath: string;
  readonly stdoutPath: string;
  readonly stderrPath: string;
  readonly startupTimeoutMs?: number;
  readonly shutdownTimeoutMs?: number;
}

export interface RunningToolSandboxSidecarProcess {
  readonly origin: string;
  readonly bearerToken: string;
  readonly pid: number;
  readonly readyReceipt: Readonly<JsonRecord>;
  readonly runtimeModuleClosure: ToolSandboxSidecarRuntimeClosure;
  stop(): Readonly<JsonRecord>;
}

const sleeper = new Int32Array(new SharedArrayBuffer(4));

function pause(milliseconds: number): void {
  Atomics.wait(sleeper, 0, 0, milliseconds);
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function record(value: unknown, path: string): JsonRecord {
  if (!isRecord(value)) throw new Error(`${path} must be an object`);
  return value;
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
  throw new Error(`cannot hash unsupported JSON ${typeof value}`);
}

function sha256Bytes(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function sha256Json(value: unknown): string {
  return sha256Bytes(canonicalStringify(value));
}

function parseJsonFile(path: string, label: string): JsonRecord {
  try {
    return record(JSON.parse(readFileSync(path, "utf8")) as unknown, label);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith(label)) throw error;
    throw new Error(`${label} is not valid JSON`);
  }
}

function processStillExists(child: ChildProcess): boolean {
  if (child.pid === undefined) return false;
  try {
    process.kill(child.pid, 0);
    return true;
  } catch {
    return false;
  }
}

function waitForFile(
  path: string,
  child: ChildProcess,
  timeoutMs: number,
  phase: string,
): void {
  const deadline = Date.now() + timeoutMs;
  while (!existsSync(path)) {
    if (!processStillExists(child)) {
      throw new Error(`ToolSandbox sidecar exited before ${phase}`);
    }
    if (Date.now() >= deadline) {
      throw new Error(`ToolSandbox sidecar timed out during ${phase}`);
    }
    pause(20);
  }
}

function verifyReadyReceipt(
  value: JsonRecord,
  input: ToolSandboxSidecarSupervisorInput,
  tokenSha256: string,
  pid: number,
  expectedRuntimeClosure: ToolSandboxSidecarRuntimeClosure,
): { readonly origin: string; readonly runtimeModuleClosure: ToolSandboxSidecarRuntimeClosure } {
  if (value["schemaVersion"] !== "pm.public-eval.toolsandbox-sidecar-ready.v1") {
    throw new Error("ToolSandbox sidecar ready receipt schema is invalid");
  }
  const readyHash = value["readyHash"];
  const { readyHash: _ignored, ...body } = value;
  if (typeof readyHash !== "string" || readyHash !== sha256Json(body)) {
    throw new Error("ToolSandbox sidecar ready receipt hash does not recompute");
  }
  const config = record(value["config"], "/sidecarReady/config");
  const server = record(value["server"], "/sidecarReady/server");
  const authentication = record(
    value["authentication"],
    "/sidecarReady/authentication",
  );
  const executableEvidence = record(
    config["executableEvidence"],
    "/sidecarReady/config/executableEvidence",
  );
  const node = record(executableEvidence["node"], "/sidecarReady/config/node");
  const entry = record(executableEvidence["entry"], "/sidecarReady/config/entry");
  const moduleResolutionEnvironment = record(
    config["moduleResolutionEnvironment"],
    "/sidecarReady/config/moduleResolutionEnvironment",
  );
  const runtimeModuleClosure = verifyToolSandboxSidecarRuntimeClosure(
    executableEvidence["runtimeModuleClosure"],
  );
  const expectedOperationPath = `${input.statePath}.sidecar-operations.jsonl`;
  const expectedLockPath = `${input.statePath}.sidecar.lock`;
  if (
    config["arm"] !== input.arm ||
    config["evaluationTrack"] !== input.evaluationTrack ||
    config["attemptId"] !== input.attemptId ||
    config["statePath"] !== input.statePath ||
    config["auditPath"] !== input.auditPath ||
    config["readyPath"] !== input.readyPath ||
    config["finalReceiptPath"] !== input.finalReceiptPath ||
    config["operationLedgerPath"] !== expectedOperationPath ||
    config["stateLockPath"] !== expectedLockPath ||
    config["host"] !== "127.0.0.1" ||
    config["requestedPort"] !== 0 ||
    config["tokenSha256"] !== tokenSha256 ||
    moduleResolutionEnvironment["nodeOptions"] !== "absent" ||
    moduleResolutionEnvironment["nodePath"] !== "absent" ||
    server["pid"] !== pid ||
    server["host"] !== "127.0.0.1" ||
    authentication["scheme"] !== "Bearer" ||
    authentication["tokenSha256"] !== tokenSha256 ||
    node["path"] !== realpathSync(input.nodeExecutable) ||
    node["sha256"] !== sha256Bytes(readFileSync(input.nodeExecutable)) ||
    entry["path"] !== resolve(input.entryPath) ||
    entry["sha256"] !== sha256Bytes(readFileSync(input.entryPath)) ||
    canonicalStringify(runtimeModuleClosure) !==
      canonicalStringify(expectedRuntimeClosure)
  ) {
    throw new Error("ToolSandbox sidecar ready receipt does not bind startup identity/runtime");
  }
  const port = server["port"];
  const origin = server["origin"];
  if (
    !Number.isSafeInteger(port) ||
    (port as number) < 1 ||
    (port as number) > 65_535 ||
    origin !== `http://127.0.0.1:${String(port)}`
  ) {
    throw new Error("ToolSandbox sidecar ready receipt has an invalid loopback origin");
  }
  return { origin, runtimeModuleClosure };
}

function childEnvironment(
  input: ToolSandboxSidecarSupervisorInput,
  bearerToken: string,
): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = { ...process.env };
  for (const name of Object.keys(environment)) {
    const normalized = name.toUpperCase();
    if (
      normalized === "NODE_OPTIONS" ||
      normalized === "NODE_PATH" ||
      normalized.startsWith("PM_TOOLSANDBOX_SIDECAR_")
    ) {
      delete environment[name];
    }
  }
  return {
    ...environment,
    PM_TOOLSANDBOX_SIDECAR_ARM: input.arm,
    PM_TOOLSANDBOX_SIDECAR_EVALUATION_TRACK: input.evaluationTrack,
    PM_TOOLSANDBOX_SIDECAR_ATTEMPT_ID: input.attemptId,
    PM_TOOLSANDBOX_SIDECAR_STATE_PATH: input.statePath,
    PM_TOOLSANDBOX_SIDECAR_AUDIT_PATH: input.auditPath,
    PM_TOOLSANDBOX_SIDECAR_READY_PATH: input.readyPath,
    PM_TOOLSANDBOX_SIDECAR_FINAL_RECEIPT_PATH: input.finalReceiptPath,
    PM_TOOLSANDBOX_SIDECAR_BEARER_TOKEN: bearerToken,
  };
}

function verifyFinalReceipt(
  value: JsonRecord,
  input: ToolSandboxSidecarSupervisorInput,
  readyReceipt: Readonly<JsonRecord>,
  pid: number,
): void {
  if (value["schemaVersion"] !== "pm.public-eval.toolsandbox-sidecar-final.v1") {
    throw new Error("ToolSandbox sidecar final receipt schema is invalid");
  }
  const finalHash = value["finalHash"];
  const { finalHash: _ignored, ...body } = value;
  if (typeof finalHash !== "string" || finalHash !== sha256Json(body)) {
    throw new Error("ToolSandbox sidecar final receipt hash does not recompute");
  }
  if (value["readyHash"] !== readyReceipt["readyHash"]) {
    throw new Error("ToolSandbox sidecar final receipt does not bind ready receipt");
  }
  const server = record(value["server"], "/sidecarFinal/server");
  const shutdown = record(value["shutdown"], "/sidecarFinal/shutdown");
  const audit = record(value["audit"], "/sidecarFinal/audit");
  const operations = record(value["operationLedger"], "/sidecarFinal/operationLedger");
  const lock = record(value["stateLock"], "/sidecarFinal/stateLock");
  const auditBytes = readFileSync(input.auditPath);
  const operationPath = `${input.statePath}.sidecar-operations.jsonl`;
  const operationBytes = readFileSync(operationPath);
  if (
    server["pid"] !== pid ||
    shutdown["reason"] !== "SIGTERM" ||
    audit["path"] !== input.auditPath ||
    audit["byteLength"] !== auditBytes.byteLength ||
    audit["sha256"] !== sha256Bytes(auditBytes) ||
    operations["path"] !== operationPath ||
    operations["byteLength"] !== operationBytes.byteLength ||
    operations["sha256"] !== sha256Bytes(operationBytes) ||
    lock["path"] !== `${input.statePath}.sidecar.lock` ||
    lock["released"] !== true ||
    existsSync(`${input.statePath}.sidecar.lock`)
  ) {
    throw new Error("ToolSandbox sidecar final receipt does not bind durable evidence/lock release");
  }
}

/** Starts the compiled sidecar as a separate process for a single matched arm. */
export function startToolSandboxSidecarProcess(
  input: ToolSandboxSidecarSupervisorInput,
): RunningToolSandboxSidecarProcess {
  const bearerToken = randomBytes(48).toString("base64url");
  const tokenSha256 = sha256Bytes(bearerToken);
  const expectedRuntimeClosure = computeToolSandboxSidecarRuntimeClosure(
    input.entryPath,
  );
  const stdoutDescriptor = openSync(input.stdoutPath, "wx", 0o600);
  const stderrDescriptor = openSync(input.stderrPath, "wx", 0o600);
  let child: ChildProcess;
  try {
    child = spawn(input.nodeExecutable, [input.entryPath], {
      cwd: resolve(input.entryPath, ".."),
      env: childEnvironment(input, bearerToken),
      shell: false,
      stdio: ["ignore", stdoutDescriptor, stderrDescriptor],
    });
  } finally {
    closeSync(stdoutDescriptor);
    closeSync(stderrDescriptor);
  }
  const pid = child.pid;
  if (pid === undefined) throw new Error("ToolSandbox sidecar did not receive a PID");
  try {
    waitForFile(
      input.readyPath,
      child,
      input.startupTimeoutMs ?? 15_000,
      "startup",
    );
    const readyReceipt = parseJsonFile(input.readyPath, "/sidecarReady");
    const verifiedReady = verifyReadyReceipt(
      readyReceipt,
      input,
      tokenSha256,
      pid,
      expectedRuntimeClosure,
    );
    let stopped = false;
    return {
      origin: verifiedReady.origin,
      bearerToken,
      pid,
      readyReceipt,
      runtimeModuleClosure: verifiedReady.runtimeModuleClosure,
      stop(): Readonly<JsonRecord> {
        if (stopped) throw new Error("ToolSandbox sidecar process is already stopped");
        stopped = true;
        if (!child.kill("SIGTERM")) {
          throw new Error("ToolSandbox sidecar process could not receive SIGTERM");
        }
        waitForFile(
          input.finalReceiptPath,
          child,
          input.shutdownTimeoutMs ?? 15_000,
          "shutdown",
        );
        const finalReceipt = parseJsonFile(input.finalReceiptPath, "/sidecarFinal");
        verifyFinalReceipt(finalReceipt, input, readyReceipt, pid);
        return finalReceipt;
      },
    };
  } catch (error) {
    if (processStillExists(child)) child.kill("SIGKILL");
    throw error;
  }
}
