import { generateKeyPairSync } from "node:crypto";
import { mkdtempSync, mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  sentinelGeneralOperationId,
  signGeneralWaitCadence,
} from "./sentinel-general-agent.js";
import { verifySentinelRawAgentEvidence } from "./sentinel-production-raw-agent.js";
import type { SentinelRawProviderOperation } from "./sentinel-production-raw-provider.js";
import { sentinelRawJsonSha256, sentinelRawSha256 } from "./sentinel-production-raw-utils.js";
import type { SentinelProductionTask } from "./sentinel-production-plan.js";
import type { SentinelProductionCellManifest } from "./sentinel-production-runner.js";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

function network(agentRoot: string, startedAt: string): void {
  const responseBytes = Buffer.from("<html>ok</html>");
  const requestDraft = {
    schemaVersion: "pm.public-eval-corners.sentinel-general-browser-request.v1",
    sequence: 1,
    kind: "request",
    recordedAt: new Date(Date.parse(startedAt) + 500).toISOString(),
    recordedAtMonotonicMs: 100,
    previousRecordSha256: null,
    requestId: "request-000001",
    redirectedFromRequestId: null,
    url: "http://127.0.0.1:10002/microhub",
    method: "GET",
    resourceType: "document",
    isNavigationRequest: true,
    headers: [{ name: "accept", value: "text/html" }],
    bodyByteLength: null,
    bodySha256: null,
    bodyBase64: null,
  };
  const request = { ...requestDraft, recordSha256: sentinelRawJsonSha256(requestDraft) };
  const responseDraft = {
    schemaVersion: "pm.public-eval-corners.sentinel-general-browser-response.v2",
    sequence: 2,
    kind: "response",
    recordedAt: new Date(Date.parse(startedAt) + 1_000).toISOString(),
    recordedAtMonotonicMs: 200,
    previousRecordSha256: request.recordSha256,
    requestId: request.requestId,
    requestRecordSha256: request.recordSha256,
    url: request.url,
    status: 200,
    statusText: "OK",
    fromServiceWorker: false,
    headers: [{ name: "content-type", value: "text/html" }],
    timing: { startTime: 1, responseEnd: 2 },
    bodyByteLength: responseBytes.byteLength,
    bodySha256: sentinelRawSha256(responseBytes),
    bodyBase64: responseBytes.toString("base64"),
    bodyFailureSha256: null,
  };
  const response = { ...responseDraft, recordSha256: sentinelRawJsonSha256(responseDraft) };
  const chain = `${JSON.stringify(request)}\n${JSON.stringify(response)}\n`;
  writeFileSync(resolve(agentRoot, "browser-network.jsonl"), chain);
  const terminalDraft = {
    schemaVersion: "pm.public-eval-corners.sentinel-browser-network-terminal.v1",
    sealedBy: "supervisor-after-process-reap",
    sealerPid: 9999,
    recordCount: 2,
    headRecordSha256: response.recordSha256,
    networkJsonlByteLength: Buffer.byteLength(chain),
    networkJsonlSha256: sentinelRawSha256(chain),
    sealedAt: new Date(Date.parse(startedAt) + 2_000).toISOString(),
  };
  writeFileSync(resolve(agentRoot, "browser-network-terminal.json"), `${JSON.stringify({
    ...terminalDraft,
    receiptSha256: sentinelRawJsonSha256(terminalDraft),
  }, null, 2)}\n`);
}

function fixture(role: SentinelProductionTask["role"] = "state-retention-relative") {
  const cellRoot = mkdtempSync(resolve(realpathSync(tmpdir()), "sentinel-raw-agent-"));
  const agentRoot = resolve(cellRoot, "upstream", "runtime", "agent");
  mkdirSync(agentRoot, { recursive: true });
  const attemptId = "spa-1234567890abcdef1234567890abcdef1234567890abcdef";
  const startedAt = "2026-07-14T01:00:00.000Z";
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const publicKeyDer = publicKey.export({ format: "der", type: "spki" });
  const startUrl = "http://127.0.0.1:10001/redirect?frontend_url=http%3A%2F%2F127.0.0.1%3A10002";
  const taskPrompt = "Monitor the visible site and report only when the prompt condition is met.";
  const stateOrigin = "http://127.0.0.1:10003";
  const providerOrigin = "http://127.0.0.1:10004";
  writeFileSync(resolve(agentRoot, "agent-start.json"), `${JSON.stringify({
    schemaVersion: "pm.public-eval-corners.sentinel-general-agent-start.v1",
    attemptId,
    pid: 9001,
    ppid: 9000,
    startedAt,
    startUrl,
    startUrlSha256: sentinelRawSha256(startUrl),
    taskPrompt,
    taskPromptSha256: sentinelRawSha256(taskPrompt),
    waitIntervalMs: 10_000,
    activeSettleMs: 250,
    maxDecisions: 1_000,
    maxConsecutiveActiveActions: 64,
    viewport: { width: 1280, height: 720 },
    cadencePublicKeyDerBase64: publicKeyDer.toString("base64"),
    cadencePublicKeySha256: sentinelRawSha256(publicKeyDer),
    providerOriginSha256: sentinelRawSha256(providerOrigin),
    stateOriginSha256: sentinelRawSha256(stateOrigin),
    navigationOrigins: ["http://127.0.0.1:10001", "http://127.0.0.1:10002"],
    directNavigationUrls: [startUrl, "http://127.0.0.1:10002/"],
  }, null, 2)}\n`);
  writeFileSync(resolve(agentRoot, "decision-000001.png"), PNG);
  const providerOperationId = sentinelGeneralOperationId(attemptId, 1, "provider-decision");
  const stateReadOperationId = sentinelGeneralOperationId(attemptId, 1, "state-read");
  const stateWriteOperationId = sentinelGeneralOperationId(attemptId, 1, "state-write");
  const providerRequestSha256 = "1".repeat(64);
  const providerResponseSha256 = "2".repeat(64);
  const providerExchangeHash = "3".repeat(64);
  const stateContext = "No relevant prior state is available for this evaluation scope.".padEnd(512, " ");
  const action = {
    action: "wait" as const,
    memoryNote: "Remember the visible value for the later comparison.",
    reason: "The task requires another observation later.",
  };
  const observedAt = "2026-07-14T01:00:01.000Z";
  const event = {
    schemaVersion: "pm.public-eval-corners.sentinel-general-agent-decision-event.v1",
    decision: 1,
    observedAt,
    currentUrl: "http://127.0.0.1:10002/microhub",
    screenshotPath: "decision-000001.png",
    screenshotByteLength: PNG.byteLength,
    screenshotSha256: sentinelRawSha256(PNG),
    stateReadOperationId,
    stateReadRequestSha256: "4".repeat(64),
    stateReadResponseSha256: "5".repeat(64),
    stateContextSha256: sentinelRawSha256(stateContext),
    providerOperationId,
    providerRequestSha256,
    providerResponseSha256,
    providerExchangeHash,
    stateWriteOperationId,
    stateWriteRequestSha256: "6".repeat(64),
    stateWriteResponseSha256: "7".repeat(64),
    stateWriteSummarySha256: "8".repeat(64),
    action,
  };
  const cadence = signGeneralWaitCadence({
    schemaVersion: "pm.public-eval-corners.sentinel-general-wait-cadence.v1",
    decision: 1,
    completedAtMonotonicMs: 150,
    previousDeadlineMonotonicMs: 100,
    deadlineMonotonicMs: 10_100,
    intervalMs: 10_000,
    providerExchangeHash,
    previousCadenceReceiptSha256: null,
  }, privateKey);
  writeFileSync(resolve(agentRoot, "agent-events.jsonl"), `${JSON.stringify(event)}\n${JSON.stringify(cadence)}\n`);
  network(agentRoot, startedAt);
  const providerOperation: SentinelRawProviderOperation = {
    operationId: providerOperationId,
    clientAttemptId: "client-1",
    providerRequestId: "request-1",
    providerMessageId: "msg_1",
    providerExchangeHash,
    startedAt: observedAt,
    completedAt: observedAt,
    latencyMs: 10,
    inputTokens: 100,
    outputTokens: 20,
    cacheCreationInputTokens: 0,
    cacheReadInputTokens: 0,
    cacheCreationEphemeral5mInputTokens: 0,
    cacheCreationEphemeral1hInputTokens: 0,
    serverToolUseRequestCount: 0,
    usage: { input_tokens: 100, output_tokens: 20 },
    agentRequestSha256: providerRequestSha256,
    agentResponseSha256: providerResponseSha256,
    screenshotSha256: sentinelRawSha256(PNG),
    screenshotBytes: PNG,
    taskPrompt,
    startUrl,
    currentUrl: event.currentUrl,
    stateContext,
    action,
    agentDecision: {
      schemaVersion: "pm.public-eval-corners.sentinel-general-agent-decision.v1",
      operationId: providerOperationId,
      providerExchangeHash,
      ...action,
    },
  };
  const manifest = {
    attemptId,
    arm: "native",
    ports: { server: 10001, frontend: 10002, state: 10003, provider: 10004 },
    serviceBinding: { state: { origin: stateOrigin }, provider: { origin: providerOrigin } },
  } as unknown as SentinelProductionCellManifest;
  const task = { role } as SentinelProductionTask;
  return { cellRoot, manifest, task, providerOperation };
}

describe("Sentinel raw general-agent verifier", () => {
  it("replays signed cadence, screenshots, provider operations, and browser chain", () => {
    const built = fixture();
    const result = verifySentinelRawAgentEvidence({ ...built, providerOperations: [built.providerOperation] });
    expect(result.issues).toEqual([]);
    expect(result.valid).toBe(true);
    expect(result.decisionCount).toBe(1);
    expect(result.waitCount).toBe(1);
  });

  it("rejects two-polls-then-sleep no-op evidence and a swapped provider operation", () => {
    const noop = fixture("anti-degenerate-noop");
    const result = verifySentinelRawAgentEvidence({ ...noop, providerOperations: [noop.providerOperation] });
    expect(result.valid).toBe(false);
    expect(result.issues.join(" ")).toMatch(/two-polls|629|final monitoring/iu);

    const swapped = fixture();
    const operation = { ...swapped.providerOperation, operationId: "f".repeat(32) };
    expect(verifySentinelRawAgentEvidence({ ...swapped, providerOperations: [operation] }).issues.join(" ")).toContain("provider raw evidence");
  });
});
