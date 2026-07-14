import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setImmediate as waitForImmediate } from "node:timers/promises";

import { afterEach, describe, expect, it } from "vitest";

import {
  SENTINEL_MEMORY_KEY,
  buildSentinelStateReadRequest,
  buildSentinelStateWriteRequest,
  createPendingWriteBarrier,
  extractContactUrl,
  parseAgentDecision,
  parseAgentStateResponse,
  parseSafeNumericBrowserObservation,
  parseSentinelBrowserStarResponse,
  readSentinelState,
  sentinelOperationId,
  writeSentinelState,
} from "./sentinel-live-agent.js";
import {
  SENTINEL_STATE_READ_SCHEMA_VERSION,
  SENTINEL_STATE_WRITE_SCHEMA_VERSION,
  buildSentinelStateResponse,
  readSentinelStateAuditFile,
  startSentinelStateSidecar,
} from "./sentinel-state-sidecar.js";

const temporaryDirectories: string[] = [];
const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => (error === undefined ? resolve() : reject(error)));
        }),
    ),
  );
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function temporaryDirectory(label: string): string {
  const directory = mkdtempSync(join(realpathSync.native(tmpdir()), `pm-agent-${label}-`));
  temporaryDirectories.push(directory);
  return directory;
}

function bearerToken(label: string): string {
  return `${label}-${"x".repeat(64)}`;
}

function validDecision(operationId: string): Record<string, unknown> {
  return {
    schemaVersion: "pm.public-eval-corners.sentinel-agent-decision.v1",
    operationId,
    action: "wait",
    stateWrite: "1847",
    reason: "The visible star count has not yet reached the trigger.",
    providerExchangeHash: "a".repeat(64),
  };
}

async function listen(server: Server): Promise<string> {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  servers.push(server);
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("test server failed");
  return `http://127.0.0.1:${address.port}`;
}

describe("Sentinel live agent state boundary", () => {
  it("derives deterministic, purpose-separated 32-character lowercase hex operation IDs", () => {
    const attemptId = "opaque-attempt-0001";
    const read = sentinelOperationId(attemptId, 1, "state-read");
    expect(read).toMatch(/^[a-f0-9]{32}$/u);
    expect(sentinelOperationId(attemptId, 1, "state-read")).toBe(read);
    expect(sentinelOperationId(attemptId, 1, "provider-decision")).not.toBe(read);
    expect(sentinelOperationId(attemptId, 1, "state-write")).not.toBe(read);
    expect(sentinelOperationId(attemptId, 2, "state-read")).not.toBe(read);
    expect(() => sentinelOperationId(attemptId, 0, "state-read")).toThrow(/poll is invalid/);
  });

  it("builds only the sidecar's exact read and numeric browser-observation write schemas", () => {
    const readOperationId = "1".repeat(32);
    const writeOperationId = "2".repeat(32);
    const observedAt = "2026-07-13T12:34:56.789Z";
    expect(buildSentinelStateReadRequest(readOperationId)).toEqual({
      schemaVersion: SENTINEL_STATE_READ_SCHEMA_VERSION,
      operationId: readOperationId,
      memoryKey: SENTINEL_MEMORY_KEY,
    });
    expect(buildSentinelStateWriteRequest(writeOperationId, observedAt, "1847")).toEqual({
      schemaVersion: SENTINEL_STATE_WRITE_SCHEMA_VERSION,
      operationId: writeOperationId,
      memoryKey: SENTINEL_MEMORY_KEY,
      observation: {
        source: "browser_observation",
        observedAt,
        value: "1847",
      },
    });
    expect(() =>
      buildSentinelStateWriteRequest(writeOperationId, "2026-07-13 12:34:56Z", "1847"),
    ).toThrow(/timestamp is not canonical/);
  });

  it("fails closed on non-canonical, non-numeric, oversized, or absent provider state", () => {
    for (const safe of ["0", "7", "1847", "999999999"]) {
      expect(parseSafeNumericBrowserObservation(safe)).toBe(safe);
    }
    for (const unsafe of [
      null,
      undefined,
      1847,
      "",
      "00",
      "01847",
      "+1847",
      "1847 ",
      "1,847",
      "1847.0",
      "1000000000",
      "1847; substrate",
    ]) {
      expect(() => parseSafeNumericBrowserObservation(unsafe)).toThrow(
        /safe numeric browser observation/,
      );
    }
  });

  it("binds the independent browser-origin response to one canonical star observation", () => {
    const body = JSON.stringify({ success: true, repository: { stars: 1847 } });
    const observation = parseSentinelBrowserStarResponse(body);
    expect(observation.value).toBe("1847");
    expect(observation.responseSha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(parseSentinelBrowserStarResponse(body)).toEqual(observation);
    for (const invalid of [
      "not json",
      JSON.stringify({ success: false, repository: { stars: 1847 } }),
      JSON.stringify({ success: true, repository: { stars: "1847" } }),
      JSON.stringify({ success: true, repository: { stars: -1 } }),
      JSON.stringify({ success: true, repository: { stars: 1_000_000_000 } }),
    ]) {
      expect(() => parseSentinelBrowserStarResponse(invalid)).toThrow();
    }
  });

  it("strictly parses provider decisions and rejects poisoning or arm disclosure", () => {
    const operationId = "3".repeat(32);
    expect(parseAgentDecision(validDecision(operationId), operationId).stateWrite).toBe("1847");
    expect(() =>
      parseAgentDecision({ ...validDecision(operationId), stateWrite: "stars=1847" }, operationId),
    ).toThrow(/safe numeric browser observation/);
    expect(() =>
      parseAgentDecision({ ...validDecision(operationId), stateWrite: null }, operationId),
    ).toThrow(/safe numeric browser observation/);
    expect(() =>
      parseAgentDecision(
        { ...validDecision(operationId), reason: "The substrate arm should wait." },
        operationId,
      ),
    ).toThrow(/experiment-arm identity/);
    expect(() =>
      parseAgentDecision({ ...validDecision(operationId), extra: true }, operationId),
    ).toThrow(/keys are not exact/);
  });

  it("strictly binds a sidecar response to its operation and rejects arm-bearing context", () => {
    const operationId = "4".repeat(32);
    const accepted = buildSentinelStateResponse(operationId, "ok", "NO_RELEVANT_BROWSER_OBSERVATION");
    expect(parseAgentStateResponse(accepted, operationId)).toEqual(accepted);
    expect(() => parseAgentStateResponse({ ...accepted, unknown: true }, operationId)).toThrow(
      /missing or unknown keys/,
    );
    expect(() => parseAgentStateResponse(accepted, "5".repeat(32))).toThrow(
      /does not match request/,
    );
    expect(() =>
      parseAgentStateResponse(
        buildSentinelStateResponse(operationId, "rejected", "REQUEST_REJECTED"),
        operationId,
      ),
    ).toThrow(/rejected the operation/);
    expect(() =>
      parseAgentStateResponse(
        buildSentinelStateResponse(operationId, "ok", "substrate treatment"),
        operationId,
      ),
    ).toThrow(/experiment-arm identity/);
  });

  it("uses POST /v1/state/write and /v1/state/read against the real arm-opaque sidecar", async () => {
    const token = bearerToken("exact-wire");
    const sidecar = await startSentinelStateSidecar({
      mode: "substrate",
      outputDirectory: temporaryDirectory("exact-wire"),
      bearerToken: token,
      tenant: "sentinel-live-agent-test",
      minimumLatencyMs: 1,
    });
    try {
      const write = await writeSentinelState(
        new URL(sidecar.endpoint).origin,
        token,
        "6".repeat(32),
        "2026-07-13T12:34:56.789Z",
        "1847",
      );
      expect(write.status).toBe("ok");
      const read = await readSentinelState(
        new URL(sidecar.endpoint).origin,
        token,
        "7".repeat(32),
      );
      expect(read.context).toContain("memory_key=microhub.star-count");
      expect(read.context).toContain("browser_observation=1847");
      expect(read.context.toLowerCase()).not.toMatch(/\b(?:native|sham|substrate)\b/u);
    } finally {
      await sidecar.stop();
    }
    const audit = readSentinelStateAuditFile(sidecar.auditPath);
    expect(audit.map((entry) => entry.requestKind)).toEqual(["write", "read"]);
    expect(audit[0]?.admittedEvidence?.evidence.payload).toMatchObject({
      memoryKey: SENTINEL_MEMORY_KEY,
      value: "1847",
    });
  });

  it("never includes a malicious HTTP error body or bearer token in its exception", async () => {
    const secretBody = "DO_NOT_LEAK_RAW_RESPONSE_BODY_9012";
    const token = bearerToken("do-not-leak-token");
    const server = createServer((request, response) => {
      request.resume();
      response.writeHead(422, {
        "content-type": "text/plain",
        "content-length": String(Buffer.byteLength(secretBody)),
      });
      response.end(secretBody);
    });
    const origin = await listen(server);

    let failure: unknown;
    try {
      await readSentinelState(origin, token, "8".repeat(32));
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(Error);
    const message = (failure as Error).message;
    expect(message).toContain("HTTP 422");
    expect(message).not.toContain(secretBody);
    expect(message).not.toContain(token);
  });

  it("does not resolve the network-write barrier early and redacts rejected work details", async () => {
    const barrier = createPendingWriteBarrier();
    let release: (() => void) | undefined;
    barrier.track(
      new Promise<void>((resolve) => {
        release = resolve;
      }),
    );
    let flushed = false;
    const flushing = barrier.flush().then(() => {
      flushed = true;
    });
    await waitForImmediate();
    expect(flushed).toBe(false);
    release?.();
    await flushing;
    expect(flushed).toBe(true);

    const failed = createPendingWriteBarrier();
    failed.track(Promise.reject(new Error("RAW_NETWORK_SECRET")));
    let failure: unknown;
    try {
      await failed.flush();
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toBe("browser network capture failed");
    expect((failure as Error).message).not.toContain("RAW_NETWORK_SECRET");
  });

  it("accepts exactly one loopback contact URL", () => {
    expect(
      extractContactUrl("When ready, send a message at http://127.0.0.1:8000/contact now."),
    ).toBe("http://127.0.0.1:8000/contact");
    expect(() => extractContactUrl("Contact https://example.com/contact")).toThrow(/loopback/);
    expect(() =>
      extractContactUrl(
        "Use http://127.0.0.1:8000/contact or http://127.0.0.1:8001/contact",
      ),
    ).toThrow(/exactly one/);
  });
});
