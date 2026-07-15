import { mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { relative, resolve, resolve as pathResolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  SENTINEL_GENERAL_ANTHROPIC_ACTION_SCHEMA_SHA256,
  SENTINEL_GENERAL_ANTHROPIC_PINNED_MODEL,
  SENTINEL_GENERAL_ANTHROPIC_SYSTEM_PROMPT_SHA256,
  startSentinelGeneralAnthropicProviderProxy,
} from "./sentinel-general-provider-proxy.js";
import { verifySentinelRawProviderEvidence } from "./sentinel-production-raw-provider.js";
import { sentinelProductionSha256, type SentinelProductionPreregistration } from "./sentinel-production-plan.js";
import type { SentinelProductionCellManifest } from "./sentinel-production-runner.js";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

async function fixture(usage: Readonly<Record<string, unknown>> = { input_tokens: 100, output_tokens: 20 }) {
  const cellRoot = mkdtempSync(resolve(realpathSync(tmpdir()), "sentinel-raw-provider-"));
  const providerRoot = resolve(cellRoot, "provider");
  const token = "provider-token-that-is-at-least-thirty-two-bytes";
  const provider = await startSentinelGeneralAnthropicProviderProxy({
    outputRoot: providerRoot,
    anthropicApiKey: "sk-ant-test-secret-value",
    authorizationToken: token,
    clientAttemptId: () => "client-attempt-0001",
    fetchImpl: async () => new Response(JSON.stringify({
      id: "msg_test_0001",
      type: "message",
      role: "assistant",
      model: SENTINEL_GENERAL_ANTHROPIC_PINNED_MODEL,
      content: [{ type: "text", text: JSON.stringify({
        action: "wait",
        memoryNote: "Remember the visible value for the later comparison.",
        reason: "The task requires another observation later.",
      }) }],
      stop_reason: "end_turn",
      stop_sequence: null,
      usage,
    }), {
      status: 200,
      headers: { "content-type": "application/json", "request-id": "request-provider-0001" },
    }),
  });
  const operationId = "1".repeat(32);
  const response = await fetch(`${provider.origin}/v1/decide`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      schemaVersion: "pm.public-eval-corners.sentinel-general-provider-request.v1",
      operationId,
      taskPrompt: "Monitor the visible site and report only when the prompt condition is met.",
      startUrl: "http://127.0.0.1:10001/redirect?frontend_url=http%3A%2F%2F127.0.0.1%3A10002",
      currentUrl: "http://127.0.0.1:10002/microhub",
      observation: { sha256: sentinelProductionSha256(PNG), mimeType: "image/png", dataBase64: PNG.toString("base64") },
      stateContext: "No relevant prior state is available for this evaluation scope.".padEnd(512, " "),
    }),
  });
  expect(response.status).toBe(200);
  await response.arrayBuffer();
  const final = await provider.close();
  const ready = JSON.parse(readFileSync(provider.readyReceiptPath, "utf8")) as { receiptHash: string };
  const plan = {
    model: {
      provider: "anthropic",
      endpoint: "https://api.anthropic.com/v1/messages",
      apiVersion: "2023-06-01",
      model: SENTINEL_GENERAL_ANTHROPIC_PINNED_MODEL,
      temperature: 0,
      maxCompletionTokens: 256,
      automaticRetries: 0,
      providerSeed: "unsupported",
      systemPromptSha256: SENTINEL_GENERAL_ANTHROPIC_SYSTEM_PROMPT_SHA256,
      actionSchemaSha256: SENTINEL_GENERAL_ANTHROPIC_ACTION_SCHEMA_SHA256,
    },
  } as unknown as SentinelProductionPreregistration;
  const manifest = {
    cellRoot: "cells/test",
    ports: { provider: Number(new URL(provider.origin).port), state: 20002, server: 20003, frontend: 20004 },
    serviceBinding: {
      provider: {
        origin: provider.origin,
        tokenSha256: sentinelProductionSha256(token),
        readyReceiptPath: relative(cellRoot, provider.readyReceiptPath),
        readyReceiptSha256: ready.receiptHash,
      },
      state: {} as never,
      continuity: {} as never,
    },
    providerFinalReceiptSha256: final.receiptHash,
  } as unknown as SentinelProductionCellManifest;
  return { cellRoot, providerRoot, plan, manifest };
}

describe("Sentinel raw provider verifier", () => {
  it("replays exact stateless request/response bytes and legal three-stage audit", async () => {
    const built = await fixture();
    const result = verifySentinelRawProviderEvidence(built);
    expect(result.issues).toEqual([]);
    expect(result.valid).toBe(true);
    expect(result.operations).toHaveLength(1);
    expect(result.totalInputTokens).toBe(100);
    expect(result.totalOutputTokens).toBe(20);
  });

  it("rejects a model mismatch and provider response tampering", async () => {
    const built = await fixture();
    const mismatch = {
      ...built.plan,
      model: { ...built.plan.model, model: "claude-unpinned" },
    } as unknown as SentinelProductionPreregistration;
    expect(verifySentinelRawProviderEvidence({ ...built, plan: mismatch }).valid).toBe(false);

    const operationRoot = resolve(built.providerRoot, "operations", sentinelProductionSha256("1".repeat(32)));
    writeFileSync(pathResolve(operationRoot, "provider-response.body.bin"), "{}", { flag: "w" });
    expect(verifySentinelRawProviderEvidence(built).issues.join(" ")).toMatch(/bytes|hash|response/iu);
  });

  it("rejects undeclared prompt-cache usage even when the provider parser accepts it", async () => {
    const built = await fixture({
      input_tokens: 100,
      output_tokens: 20,
      cache_creation_input_tokens: 1,
      cache_read_input_tokens: 0,
    });
    const result = verifySentinelRawProviderEvidence(built);
    expect(result.valid).toBe(false);
    expect(result.issues.join(" ")).toMatch(/prompt caching/iu);
  });
});
