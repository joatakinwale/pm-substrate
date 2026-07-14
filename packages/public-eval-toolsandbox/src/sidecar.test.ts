import { createHash } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

const SOURCE_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = resolve(SOURCE_DIRECTORY, "../../..");
const ENTRY_PATH = resolve(SOURCE_DIRECTORY, "sidecar-entry.ts");
const TOKEN = "test-token-0123456789abcdef0123456789abcdef";
const GENESIS_HASH = "0".repeat(64);

interface SidecarPaths {
  readonly state: string;
  readonly audit: string;
  readonly ready: string;
  readonly final: string;
  readonly operations: string;
  readonly lock: string;
}

interface ChildHarness {
  readonly child: ChildProcess;
  readonly paths: SidecarPaths;
  readonly ready: Record<string, unknown>;
  readonly stderr: () => string;
}

const liveChildren = new Set<ChildProcess>();

afterEach(async () => {
  const exits = [...liveChildren].map(async (child) => {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    await waitForExit(child);
  });
  await Promise.all(exits);
  liveChildren.clear();
});

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = value as Readonly<Record<string, unknown>>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}

function sha256(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function sha256Json(value: unknown): string {
  return sha256(canonicalJson(value));
}

function pathsFor(root: string, suffix = ""): SidecarPaths {
  const state = resolve(root, `boundary${suffix}.json`);
  return {
    state,
    audit: resolve(root, `audit${suffix}.jsonl`),
    ready: resolve(root, `ready${suffix}.json`),
    final: resolve(root, `final${suffix}.json`),
    operations: `${state}.sidecar-operations.jsonl`,
    lock: `${state}.sidecar.lock`,
  };
}

function spawnSidecar(paths: SidecarPaths): {
  child: ChildProcess;
  stderr: () => string;
} {
  let stderr = "";
  const child = spawn(process.execPath, ["--import", "tsx", ENTRY_PATH], {
    cwd: REPOSITORY_ROOT,
    env: {
      ...process.env,
      PM_TOOLSANDBOX_SIDECAR_ARM: "substrate",
      PM_TOOLSANDBOX_SIDECAR_EVALUATION_TRACK:
        "restart_lost_response_derivative",
      PM_TOOLSANDBOX_SIDECAR_ATTEMPT_ID: "sidecar-attempt-001",
      PM_TOOLSANDBOX_SIDECAR_STATE_PATH: paths.state,
      PM_TOOLSANDBOX_SIDECAR_AUDIT_PATH: paths.audit,
      PM_TOOLSANDBOX_SIDECAR_READY_PATH: paths.ready,
      PM_TOOLSANDBOX_SIDECAR_FINAL_RECEIPT_PATH: paths.final,
      PM_TOOLSANDBOX_SIDECAR_BEARER_TOKEN: TOKEN,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  liveChildren.add(child);
  child.stderr?.on("data", (chunk: Buffer) => {
    stderr += chunk.toString("utf8");
  });
  return { child, stderr: () => stderr };
}

async function startSidecar(paths: SidecarPaths): Promise<ChildHarness> {
  const running = spawnSidecar(paths);
  await waitForFile(paths.ready, running.child, running.stderr);
  return {
    ...running,
    paths,
    ready: JSON.parse(readFileSync(paths.ready, "utf8")) as Record<
      string,
      unknown
    >,
  };
}

async function waitForFile(
  path: string,
  child: ChildProcess,
  stderr: () => string,
): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (!existsSync(path)) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(`sidecar exited before writing ${path}: ${stderr()}`);
    }
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${path}`);
    await new Promise((accept) => setTimeout(accept, 20));
  }
}

async function waitForExit(child: ChildProcess): Promise<{
  code: number | null;
  signal: NodeJS.Signals | null;
}> {
  if (child.exitCode !== null || child.signalCode !== null) {
    return { code: child.exitCode, signal: child.signalCode };
  }
  return await new Promise((accept) => {
    child.once("exit", (code, signal) => accept({ code, signal }));
  });
}

function readyOrigin(ready: Record<string, unknown>): string {
  const server = ready["server"] as Record<string, unknown>;
  return server["origin"] as string;
}

interface HttpResult {
  readonly status: number;
  readonly bytes: Buffer;
  readonly requestId: string | null;
}

async function post(
  origin: string,
  path: string,
  body: string,
  operationKey: string,
  overrides: {
    readonly token?: string;
    readonly contentType?: string;
  } = {},
): Promise<HttpResult> {
  const response = await fetch(`${origin}${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${overrides.token ?? TOKEN}`,
      "content-type": overrides.contentType ?? "application/json",
      "idempotency-key": operationKey,
    },
    body,
  });
  return {
    status: response.status,
    bytes: Buffer.from(await response.arrayBuffer()),
    requestId: response.headers.get("x-pm-request-id"),
  };
}

function proposal(paths: SidecarPaths, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: "pm.public-eval.toolsandbox-tool-proposal.v1",
    arm: "substrate",
    evaluationTrack: "restart_lost_response_derivative",
    attemptId: "sidecar-attempt-001",
    sessionId: "provider-session-001",
    statePath: paths.state,
    toolCallId: "tool-call-001",
    toolName: "send_message_with_phone_number",
    arguments: {
      phone_number: "+12453344098",
      content: "How's the new album coming along",
    },
    proposedAt: "2026-07-13T18:00:00.000Z",
    ...overrides,
  };
}

function withoutHash(record: Record<string, unknown>, key: string): Record<string, unknown> {
  const clone = { ...record };
  delete clone[key];
  return clone;
}

function verifyHashChain(
  path: string,
  schemaVersion: string,
): Record<string, unknown>[] {
  const records = readFileSync(path, "utf8")
    .trimEnd()
    .split("\n")
    .map((line) => JSON.parse(line) as Record<string, unknown>);
  let head = GENESIS_HASH;
  for (const [index, record] of records.entries()) {
    expect(record["schemaVersion"]).toBe(schemaVersion);
    expect(record["sequence"]).toBe(index + 1);
    expect(record["previousRecordHash"]).toBe(head);
    expect(record["recordHash"]).toBe(
      sha256Json(withoutHash(record, "recordHash")),
    );
    head = record["recordHash"] as string;
  }
  return records;
}

describe("ToolSandbox authenticated boundary sidecar", () => {
  it("runs in a child process, binds identity, replays idempotently, and leaves verifiable receipts", async () => {
    const root = mkdtempSync(resolve(tmpdir(), "toolsandbox-sidecar-"));
    const paths = pathsFor(root);
    try {
      const harness = await startSidecar(paths);
      const origin = readyOrigin(harness.ready);
      const firstBody = JSON.stringify(proposal(paths));
      const first = await post(origin, "/v1/admit-tool", firstBody, "operation-001");
      expect(first.status).toBe(200);
      expect(JSON.parse(first.bytes.toString("utf8"))).toMatchObject({
        arm: "substrate",
        decision: "allow",
      });

      const replay = await post(origin, "/v1/admit-tool", firstBody, "operation-001");
      expect(replay.status).toBe(200);
      expect(replay.bytes.equals(first.bytes)).toBe(true);
      expect(replay.requestId).toBe(first.requestId);

      const conflict = await post(
        origin,
        "/v1/admit-tool",
        JSON.stringify(proposal(paths, { toolCallId: "different-call" })),
        "operation-001",
      );
      expect(conflict.status).toBe(409);
      expect(JSON.parse(conflict.bytes.toString("utf8"))).toMatchObject({
        error: { code: "idempotency_conflict" },
      });

      const decision = JSON.parse(first.bytes.toString("utf8")) as Record<string, unknown>;
      const outcomeBody = JSON.stringify({
        schemaVersion: "pm.public-eval.toolsandbox-tool-outcome.v1",
        arm: "substrate",
        evaluationTrack: "restart_lost_response_derivative",
        attemptId: "sidecar-attempt-001",
        statePath: paths.state,
        proposalId: decision["proposalId"],
        toolCallId: "tool-call-001",
        toolName: "send_message_with_phone_number",
        arguments: {
          phone_number: "+12453344098",
          content: "How's the new album coming along",
        },
        succeeded: true,
        responseHash: "c".repeat(64),
        observedAt: "2026-07-13T18:00:01.000Z",
      });
      expect(
        (await post(origin, "/v1/record-tool-outcome", outcomeBody, "operation-002"))
          .status,
      ).toBe(200);

      const retry = await post(
        origin,
        "/v1/admit-tool",
        JSON.stringify(
          proposal(paths, {
            sessionId: "provider-session-002",
            toolCallId: "tool-call-002",
            proposedAt: "2026-07-13T18:00:02.000Z",
          }),
        ),
        "operation-003",
      );
      expect(retry.status).toBe(200);
      expect(JSON.parse(retry.bytes.toString("utf8"))).toMatchObject({
        arm: "substrate",
        decision: "block",
      });

      const badAuth = await post(
        origin,
        "/v1/admit-tool",
        firstBody,
        "operation-bad-auth",
        { token: "wrong-token-0123456789abcdef0123456789abcdef" },
      );
      expect(badAuth.status).toBe(401);

      const injectedPath = resolve(root, "attacker-selected-state.json");
      const pathInjection = await post(
        origin,
        "/v1/admit-tool",
        JSON.stringify(proposal(paths, { statePath: injectedPath })),
        "operation-path-injection",
      );
      expect(pathInjection.status).toBe(400);
      expect(JSON.parse(pathInjection.bytes.toString("utf8"))).toMatchObject({
        error: { code: "identity_mismatch" },
      });
      expect(existsSync(injectedPath)).toBe(false);

      const trackInjection = await post(
        origin,
        "/v1/admit-tool",
        JSON.stringify(proposal(paths, { evaluationTrack: "official_headline" })),
        "operation-track-injection",
      );
      expect(trackInjection.status).toBe(400);
      expect(JSON.parse(trackInjection.bytes.toString("utf8"))).toMatchObject({
        error: { code: "identity_mismatch" },
      });

      for (const [operationKey, override] of [
        ["operation-arm-injection", { arm: "sham" }],
        ["operation-attempt-injection", { attemptId: "another-attempt" }],
      ] as const) {
        const identityInjection = await post(
          origin,
          "/v1/admit-tool",
          JSON.stringify(proposal(paths, override)),
          operationKey,
        );
        expect(identityInjection.status).toBe(400);
        expect(
          JSON.parse(identityInjection.bytes.toString("utf8")),
        ).toMatchObject({ error: { code: "identity_mismatch" } });
      }

      const nonJson = await post(
        origin,
        "/v1/admit-tool",
        "not-json",
        "operation-non-json",
      );
      expect(nonJson.status).toBe(400);
      expect(JSON.parse(nonJson.bytes.toString("utf8"))).toMatchObject({
        error: { code: "invalid_json" },
      });

      const wrongMedia = await post(
        origin,
        "/v1/admit-tool",
        firstBody,
        "operation-wrong-media",
        { contentType: "text/plain" },
      );
      expect(wrongMedia.status).toBe(415);

      const unknown = await post(
        origin,
        "/v1/admit-tool?injected=true",
        firstBody,
        "operation-query-path",
      );
      expect(unknown.status).toBe(404);

      const wrongMethod = await fetch(`${origin}/v1/admit-tool`, {
        method: "GET",
        headers: {
          authorization: `Bearer ${TOKEN}`,
          "idempotency-key": "operation-wrong-method",
        },
      });
      expect(wrongMethod.status).toBe(405);
      await wrongMethod.arrayBuffer();

      const oversized = await post(
        origin,
        "/v1/admit-tool",
        "x".repeat(70 * 1024),
        "operation-oversized",
      );
      expect(oversized.status).toBe(413);

      harness.child.kill("SIGTERM");
      const exit = await waitForExit(harness.child);
      liveChildren.delete(harness.child);
      expect(exit).toEqual({ code: 0, signal: null });
      expect(existsSync(paths.final)).toBe(true);
      expect(existsSync(paths.lock)).toBe(false);

      const ready = harness.ready;
      expect(ready["readyHash"]).toBe(sha256Json(withoutHash(ready, "readyHash")));
      const final = JSON.parse(readFileSync(paths.final, "utf8")) as Record<string, unknown>;
      expect(final["finalHash"]).toBe(sha256Json(withoutHash(final, "finalHash")));

      const audit = verifyHashChain(
        paths.audit,
        "pm.public-eval.toolsandbox-sidecar-audit.v1",
      );
      expect(audit.length).toBe(15);
      for (const record of audit) {
        expect(record["pid"]).toBe(harness.child.pid);
        const request = record["request"] as Record<string, unknown>;
        const response = record["generatedResponse"] as Record<string, unknown>;
        const requestBytes = Buffer.from(request["bodyBytesBase64"] as string, "base64");
        const responseBytes = Buffer.from(response["bodyBytesBase64"] as string, "base64");
        expect(request["bodySha256"]).toBe(sha256(requestBytes));
        expect(response["bodySha256"]).toBe(sha256(responseBytes));
      }
      expect(
        audit.map((record) =>
          (record["request"] as Record<string, unknown>)["idempotencyDisposition"],
        ),
      ).toEqual(expect.arrayContaining(["new", "replayed", "conflict"]));
      const finalAudit = final["audit"] as Record<string, unknown>;
      expect(finalAudit["recordCount"]).toBe(audit.length);
      expect(finalAudit["headHash"]).toBe(audit.at(-1)?.["recordHash"]);
      expect(finalAudit["sha256"]).toBe(sha256(readFileSync(paths.audit)));

      const operations = verifyHashChain(
        paths.operations,
        "pm.public-eval.toolsandbox-sidecar-operation.v1",
      );
      expect(operations.some((record) => record["phase"] === "prepared")).toBe(true);
      expect(operations.some((record) => record["phase"] === "completed")).toBe(true);
      const finalOperations = final["operationLedger"] as Record<string, unknown>;
      expect(finalOperations["headHash"]).toBe(operations.at(-1)?.["recordHash"]);
      expect(finalOperations["sha256"]).toBe(sha256(readFileSync(paths.operations)));

      const retainedEvidence = [paths.ready, paths.audit, paths.final, paths.operations]
        .map((path) => readFileSync(path, "utf8"))
        .join("\n");
      expect(retainedEvidence).not.toContain(TOKEN);
      expect(retainedEvidence).toContain(sha256(TOKEN));

      const restartedPaths: SidecarPaths = {
        ...pathsFor(root, "-restarted-evidence"),
        state: paths.state,
        operations: paths.operations,
        lock: paths.lock,
      };
      const restarted = await startSidecar(restartedPaths);
      const durableReplay = await post(
        readyOrigin(restarted.ready),
        "/v1/admit-tool",
        firstBody,
        "operation-001",
      );
      expect(durableReplay.status).toBe(200);
      expect(durableReplay.bytes.equals(first.bytes)).toBe(true);
      expect(durableReplay.requestId).toBe(first.requestId);
      restarted.child.kill("SIGTERM");
      expect(await waitForExit(restarted.child)).toEqual({ code: 0, signal: null });
      liveChildren.delete(restarted.child);
      expect(existsSync(restartedPaths.final)).toBe(true);
      const restartAudit = verifyHashChain(
        restartedPaths.audit,
        "pm.public-eval.toolsandbox-sidecar-audit.v1",
      );
      expect(restartAudit).toHaveLength(1);
      expect(
        (restartAudit[0]?.["request"] as Record<string, unknown>)[
          "idempotencyDisposition"
        ],
      ).toBe("replayed");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 30_000);

  it("rejects public-ID concatenations beyond the bounded idempotency-key protocol", async () => {
    const root = mkdtempSync(resolve(tmpdir(), "toolsandbox-sidecar-key-bound-"));
    const paths = pathsFor(root);
    try {
      const harness = await startSidecar(paths);
      const origin = readyOrigin(harness.ready);
      const body = JSON.stringify(proposal(paths));
      const attemptId = "toolsandbox-public-state-proof-001-substrate-001";
      const proposalId = `${attemptId}:proposal:1`;
      const rawPublicIdKey = `${attemptId}:outcome:${proposalId}:pm_probe_cellular_1`;

      expect(rawPublicIdKey).toHaveLength(136);
      const rejected = await post(
        origin,
        "/v1/admit-tool",
        body,
        rawPublicIdKey,
      );
      expect(rejected.status).toBe(400);
      expect(JSON.parse(rejected.bytes.toString("utf8"))).toMatchObject({
        error: { code: "invalid_idempotency_key" },
      });
      expect(existsSync(paths.state)).toBe(false);

      const boundedKey = `pm-ts-admit-${sha256Json({
        domain: "pm.public-eval.toolsandbox-http-idempotency.admit.v1",
        components: [attemptId, "provider-session-001", "tool-call-001"],
      })}`;
      expect(boundedKey).toHaveLength(76);
      const accepted = await post(origin, "/v1/admit-tool", body, boundedKey);
      expect(accepted.status).toBe(200);

      harness.child.kill("SIGTERM");
      expect(await waitForExit(harness.child)).toEqual({ code: 0, signal: null });
      liveChildren.delete(harness.child);

      const audit = verifyHashChain(
        paths.audit,
        "pm.public-eval.toolsandbox-sidecar-audit.v1",
      );
      expect(audit).toHaveLength(2);
      expect(audit[0]?.["request"]).toMatchObject({
        operationKeySha256: null,
        idempotencyDisposition: "not_applicable",
      });
      expect(audit[1]?.["request"]).toMatchObject({
        operationKeySha256: sha256(boundedKey),
        idempotencyDisposition: "new",
      });
      expect(
        verifyHashChain(
          paths.operations,
          "pm.public-eval.toolsandbox-sidecar-operation.v1",
        ),
      ).toHaveLength(2);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 20_000);

  it("refuses a second process that targets the same durable boundary state", async () => {
    const root = mkdtempSync(resolve(tmpdir(), "toolsandbox-sidecar-lock-"));
    const firstPaths = pathsFor(root, "-shared");
    try {
      const first = await startSidecar(firstPaths);
      const secondPaths: SidecarPaths = {
        ...pathsFor(root, "-second-evidence"),
        state: firstPaths.state,
        operations: firstPaths.operations,
        lock: firstPaths.lock,
      };
      const second = spawnSidecar(secondPaths);
      const exit = await waitForExit(second.child);
      liveChildren.delete(second.child);
      expect(exit.code).toBe(1);
      expect(second.stderr()).toMatch(/state lock is already held/u);
      expect(existsSync(secondPaths.ready)).toBe(false);
      expect(first.child.exitCode).toBeNull();

      first.child.kill("SIGTERM");
      expect(await waitForExit(first.child)).toEqual({ code: 0, signal: null });
      liveChildren.delete(first.child);
      expect(existsSync(firstPaths.lock)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 20_000);
});
