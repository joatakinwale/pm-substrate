import { createHash } from "node:crypto";
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  SENTINEL_GENERAL_ANTHROPIC_PINNED_MODEL,
  parseSentinelGeneralAnthropicAction,
  parseSentinelGeneralAnthropicResponse,
  startSentinelGeneralAnthropicProviderProxy,
  verifySentinelGeneralAnthropicProviderEvidence,
  type SentinelGeneralAnthropicProviderProxy,
} from "./sentinel-general-provider-proxy.js";

const API_KEY = "sk-ant-general-test-key-never-persist-123456789";
const AGENT_TOKEN = "general-agent-auth-token-never-persist-123456789";
const VALID_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

type JsonRecord = Record<string, unknown>;

interface CapturedCall {
  readonly url: string;
  readonly method: string | undefined;
  readonly headers: Headers;
  readonly body: Buffer;
  readonly signal: AbortSignal | null | undefined;
}

const TEMPORARY_DIRECTORIES: string[] = [];
const PROXIES: SentinelGeneralAnthropicProviderProxy[] = [];

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function record(value: unknown, path: string): JsonRecord {
  if (!isRecord(value)) throw new Error(`${path} must be an object`);
  return value;
}

function agentRequest(operationId = "1".repeat(32), stateContext = " ".repeat(512)): JsonRecord {
  return {
    schemaVersion: "pm.public-eval-corners.sentinel-general-provider-request.v1",
    operationId,
    taskPrompt: "Observe the visible page over time and report only when the requested outcome is shown.",
    startUrl: "http://127.0.0.1:8765/start",
    currentUrl: "http://127.0.0.1:8765/start",
    observation: {
      sha256: sha256(VALID_PNG),
      mimeType: "image/png",
      dataBase64: VALID_PNG.toString("base64"),
    },
    stateContext,
  };
}

function modelAction(overrides: JsonRecord = {}): JsonRecord {
  return {
    action: "wait",
    memoryNote: "Initial visible value retained for a later comparison",
    reason: "More time must pass before the requested outcome can be reported.",
    ...overrides,
  };
}

function providerResponse(action: JsonRecord = modelAction(), overrides: JsonRecord = {}): string {
  return JSON.stringify({
    id: "msg_general_1",
    type: "message",
    role: "assistant",
    model: SENTINEL_GENERAL_ANTHROPIC_PINNED_MODEL,
    content: [{ type: "text", text: JSON.stringify(action) }],
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: {
      input_tokens: 201,
      output_tokens: 31,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
      service_tier: "standard",
    },
    ...overrides,
  });
}

function bodyBytes(body: BodyInit | null | undefined): Buffer {
  if (typeof body === "string") return Buffer.from(body);
  if (body instanceof Uint8Array) return Buffer.from(body);
  throw new Error("test fetch received an unsupported request body");
}

function capturingFetch(
  calls: CapturedCall[],
  response: (call: number, request: CapturedCall) => Response | Promise<Response>,
): typeof fetch {
  return (async (input: string | URL | globalThis.Request, init?: RequestInit) => {
    const captured: CapturedCall = {
      url: String(input),
      method: init?.method,
      headers: new Headers(init?.headers),
      body: bodyBytes(init?.body),
      signal: init?.signal,
    };
    calls.push(captured);
    return response(calls.length, captured);
  }) as typeof fetch;
}

function successResponse(action: JsonRecord = modelAction(), requestId = "req_general_1"): Response {
  return new Response(providerResponse(action), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "request-id": requestId,
      "x-test-evidence": "captured-exactly",
    },
  });
}

async function fixture(fetchImpl: typeof fetch): Promise<{
  readonly root: string;
  readonly proxy: SentinelGeneralAnthropicProviderProxy;
}> {
  const root = mkdtempSync(join(tmpdir(), "pm-sentinel-general-provider-"));
  TEMPORARY_DIRECTORIES.push(root);
  let monotonic = 100;
  let attempt = 0;
  const proxy = await startSentinelGeneralAnthropicProviderProxy({
    outputRoot: root,
    anthropicApiKey: API_KEY,
    authorizationToken: AGENT_TOKEN,
    fetchImpl,
    monotonicNowMs: () => {
      monotonic += 7;
      return monotonic;
    },
    wallClock: () => new Date("2026-07-14T12:00:00.000Z"),
    clientAttemptId: () => {
      attempt += 1;
      return `attempt-${attempt}`;
    },
  });
  PROXIES.push(proxy);
  return { root, proxy };
}

async function postAgent(
  proxy: SentinelGeneralAnthropicProviderProxy,
  body: unknown,
  token: string | null = proxy.authorizationToken,
): Promise<{ readonly status: number; readonly json: JsonRecord }> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token !== null) headers.authorization = `Bearer ${token}`;
  const response = await fetch(`${proxy.origin}/v1/decide`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, json: record(JSON.parse(text) as unknown, "agent response") };
}

function allFiles(root: string): readonly string[] {
  const files: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile()) files.push(path);
    }
  };
  visit(root);
  return files.sort();
}

afterEach(async () => {
  for (const proxy of PROXIES.splice(0)) await proxy.close().catch(() => undefined);
  for (const directory of TEMPORARY_DIRECTORIES.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("task-agnostic Anthropic capture proxy", () => {
  it("parses strict action-specific shapes and a strict Anthropic envelope", () => {
    expect(parseSentinelGeneralAnthropicAction(modelAction())).toMatchObject({ action: "wait" });
    expect(parseSentinelGeneralAnthropicAction(modelAction({ action: "terminate" }))).toMatchObject({
      action: "terminate",
    });
    expect(parseSentinelGeneralAnthropicAction(modelAction({
      action: "navigate",
      url: "http://127.0.0.1:8765/form",
    }))).toMatchObject({ action: "navigate", url: "http://127.0.0.1:8765/form" });
    expect(parseSentinelGeneralAnthropicAction(modelAction({
      action: "click",
      x: 100,
      y: 200,
      button: "left",
    }))).toMatchObject({ action: "click", x: 100, y: 200 });
    expect(parseSentinelGeneralAnthropicAction(modelAction({
      action: "type",
      x: 100,
      y: 200,
      text: "report text",
    }))).toMatchObject({ action: "type", text: "report text" });
    expect(parseSentinelGeneralAnthropicAction(modelAction({ action: "press", key: "Tab" }))).toMatchObject({
      action: "press",
      key: "Tab",
    });
    expect(parseSentinelGeneralAnthropicAction(modelAction({
      action: "scroll",
      deltaX: 0,
      deltaY: 500,
    }))).toMatchObject({ action: "scroll", deltaY: 500 });
    expect(() => parseSentinelGeneralAnthropicAction({
      ...modelAction(),
      x: 20,
    })).toThrow("provider-output-invalid");
    expect(() => parseSentinelGeneralAnthropicAction(modelAction({
      action: "press",
      key: "Meta+A",
    }))).toThrow("provider-output-action-invalid");
    expect(() => parseSentinelGeneralAnthropicAction(modelAction({
      action: "navigate",
      url: "file:///tmp/form",
    }))).toThrow("provider-output-action-invalid");

    const parsed = parseSentinelGeneralAnthropicResponse(JSON.parse(providerResponse()) as unknown);
    expect(parsed).toMatchObject({
      providerMessageId: "msg_general_1",
      returnedModel: SENTINEL_GENERAL_ANTHROPIC_PINNED_MODEL,
      usage: { input_tokens: 201, output_tokens: 31 },
      action: { action: "wait" },
    });
    expect(() => parseSentinelGeneralAnthropicResponse({
      ...JSON.parse(providerResponse()) as JsonRecord,
      extra: true,
    })).toThrow("provider-response-invalid");
    expect(() => parseSentinelGeneralAnthropicResponse({
      ...JSON.parse(providerResponse()) as JsonRecord,
      id: "not_anthropic",
    })).toThrow("provider-response-invalid");
    expect(() => parseSentinelGeneralAnthropicResponse({
      ...JSON.parse(providerResponse()) as JsonRecord,
      usage: { input_tokens: 1, output_tokens: 1, invented_tokens: 5 },
    })).toThrow("provider-usage-invalid");
    expect(() => parseSentinelGeneralAnthropicResponse({
      ...JSON.parse(providerResponse()) as JsonRecord,
      usage: {
        input_tokens: 1,
        output_tokens: 1,
        server_tool_use: { web_search_requests: 1 },
      },
    })).toThrow("provider-usage-invalid");
  });

  it("makes one pinned stateless image-first call and captures exact raw evidence", async () => {
    const calls: CapturedCall[] = [];
    const { root, proxy } = await fixture(capturingFetch(calls, () => successResponse()));
    const result = await postAgent(proxy, agentRequest());
    expect(result.status).toBe(200);
    expect(result.json).toMatchObject({
      schemaVersion: "pm.public-eval-corners.sentinel-general-agent-decision.v1",
      operationId: "1".repeat(32),
      action: "wait",
      memoryNote: "Initial visible value retained for a later comparison",
      providerExchangeHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
    });
    expect(calls).toHaveLength(1);
    const call = calls[0];
    expect(call?.url).toBe("https://api.anthropic.com/v1/messages");
    expect(call?.method).toBe("POST");
    expect(call?.headers.get("x-api-key")).toBe(API_KEY);
    expect(call?.headers.get("anthropic-version")).toBe("2023-06-01");

    const request = record(JSON.parse(call?.body.toString("utf8") ?? "") as unknown, "provider request");
    expect(request).toMatchObject({
      model: SENTINEL_GENERAL_ANTHROPIC_PINNED_MODEL,
      max_tokens: 256,
      temperature: 0,
      system: expect.stringContaining("task prompt is the sole authority"),
    });
    const messages = request.messages;
    expect(Array.isArray(messages)).toBe(true);
    const firstMessage = record((messages as unknown[])[0], "message");
    const content = firstMessage.content;
    expect(Array.isArray(content)).toBe(true);
    expect(record((content as unknown[])[0], "image block")).toMatchObject({ type: "image" });
    const textBlock = record((content as unknown[])[1], "text block");
    const exactInputs = record(JSON.parse(String(textBlock.text)) as unknown, "model inputs");
    expect(exactInputs).toEqual({
      taskPrompt: agentRequest().taskPrompt,
      startUrl: agentRequest().startUrl,
      currentUrl: agentRequest().currentUrl,
      stateContext: " ".repeat(512),
    });
    const format = record(record(request.output_config, "output config").format, "format");
    const schema = record(format.schema, "schema");
    expect(schema.anyOf).toHaveLength(7);

    const final = await proxy.close();
    expect(final).toMatchObject({
      acceptedOperationCount: 1,
      successfulOperationCount: 1,
      terminalFailureCount: 0,
      automaticRetryCount: 0,
      auditRecordCount: 3,
    });
    expect(verifySentinelGeneralAnthropicProviderEvidence(root)).toMatchObject({ valid: true });
    const files = allFiles(root);
    const agentRequestPath = files.find((path) => path.endsWith("agent-request.body.json"));
    const agentResponsePath = files.find((path) => path.endsWith("agent-response.body.json"));
    expect(agentRequestPath).toBeDefined();
    expect(agentResponsePath).toBeDefined();
    expect(readFileSync(agentRequestPath!, "utf8")).toBe(JSON.stringify(agentRequest()));
    expect(JSON.parse(readFileSync(agentResponsePath!, "utf8"))).toEqual(result.json);
    expect(files.some((path) => path.endsWith("provider-request.body.json"))).toBe(true);
    expect(files.some((path) => path.endsWith("provider-response.body.bin"))).toBe(true);
    expect(files.some((path) => path.endsWith("provider-response.headers.json"))).toBe(true);
    const persisted = files.map((path) => readFileSync(path)).map((bytes) => bytes.toString("utf8")).join("\n");
    expect(persisted).not.toContain(API_KEY);
    expect(persisted).not.toContain(AGENT_TOKEN);
    expect(persisted).toContain("x-test-evidence");
    expect(persisted).toContain('"input_tokens": 201');
  });

  it("rejects malformed, mixed, and execution-revealing inputs before any provider call", async () => {
    const calls: CapturedCall[] = [];
    const { proxy } = await fixture(capturingFetch(calls, () => successResponse()));
    const malformed = await postAgent(proxy, agentRequest("not-32-hex"));
    expect(malformed.status).toBe(400);
    const extra = await postAgent(proxy, { ...agentRequest("2".repeat(32)), hidden: true });
    expect(extra.status).toBe(400);
    const revealed = await postAgent(
      proxy,
      agentRequest("3".repeat(32), "substrate memory".padEnd(512, " ")),
    );
    expect(revealed.status).toBe(400);
    const unauthorized = await postAgent(proxy, agentRequest("4".repeat(32)), "wrong-token-value");
    expect(unauthorized.status).toBe(401);
    expect(calls).toHaveLength(0);
  });

  it("never retries a provider failure and records it as terminal", async () => {
    const calls: CapturedCall[] = [];
    const { root, proxy } = await fixture(capturingFetch(calls, () => new Response(
      JSON.stringify({ type: "error", error: { type: "overloaded_error" } }),
      { status: 529, headers: { "request-id": "req_failure_1", "content-type": "application/json" } },
    )));
    const result = await postAgent(proxy, agentRequest());
    expect(result.status).toBe(502);
    expect(calls).toHaveLength(1);
    const final = await proxy.close();
    expect(final).toMatchObject({
      acceptedOperationCount: 1,
      successfulOperationCount: 0,
      terminalFailureCount: 1,
      automaticRetryCount: 0,
    });
    expect(verifySentinelGeneralAnthropicProviderEvidence(root).valid).toBe(true);
  });

  it("rejects model navigation outside the prompt-declared loopback origins", async () => {
    const calls: CapturedCall[] = [];
    const { proxy } = await fixture(capturingFetch(calls, () => successResponse(modelAction({
      action: "navigate",
      url: "http://127.0.0.1:9999/form",
    }))));
    const result = await postAgent(proxy, agentRequest());
    expect(result.status).toBe(502);
    expect(calls).toHaveLength(1);
    const final = await proxy.close();
    expect(final).toMatchObject({ successfulOperationCount: 0, terminalFailureCount: 1 });
  });

  it("rejects undeclared same-origin status and data shortcuts", async () => {
    for (const url of [
      "http://127.0.0.1:8765/status",
      "http://127.0.0.1:8765/data/config",
      "http://127.0.0.1:8765/scenarios",
    ]) {
      const calls: CapturedCall[] = [];
      const { proxy } = await fixture(capturingFetch(calls, () => successResponse(modelAction({
        action: "navigate",
        url,
      }))));
      const result = await postAgent(proxy, agentRequest());
      expect(result.status).toBe(502);
      expect(calls).toHaveLength(1);
      const final = await proxy.close();
      expect(final).toMatchObject({ successfulOperationCount: 0, terminalFailureCount: 1 });
    }
  });

  it("aborts and drains an in-flight upstream call before sealing final evidence", async () => {
    const calls: CapturedCall[] = [];
    let announceStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      announceStarted = resolve;
    });
    const neverCompletes = capturingFetch(calls, (_number, request) => new Promise<Response>((_resolve, reject) => {
      announceStarted();
      request.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), {
        once: true,
      });
    }));
    const { root, proxy } = await fixture(neverCompletes);
    const pendingPost = postAgent(proxy, agentRequest());
    await started;
    const final = await proxy.close();
    const postResult = await pendingPost;
    expect(postResult.status).toBe(502);
    expect(final).toMatchObject({
      acceptedOperationCount: 1,
      successfulOperationCount: 0,
      terminalFailureCount: 1,
      auditRecordCount: 2,
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.signal?.aborted).toBe(true);
    expect(verifySentinelGeneralAnthropicProviderEvidence(root)).toMatchObject({
      valid: true,
      auditRecordCount: 2,
    });
  });
});
