import { createHash } from "node:crypto";
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  startSentinelAnthropicProviderProxy,
  verifySentinelAnthropicProviderEvidence,
  type SentinelAnthropicProviderProxy,
} from "./sentinel-anthropic-provider-proxy.js";

const API_KEY = "sk-ant-test-key-must-never-persist-123456789";
const AGENT_TOKEN = "agent-auth-token-must-never-persist-123456789";
const PINNED_MODEL = "claude-sonnet-4-5-20250929";
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
}

const TEMP_PATHS: string[] = [];
const PROXIES: SentinelAnthropicProviderProxy[] = [];

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

function fixedStateContext(prefix = "NO_RELEVANT_BROWSER_OBSERVATION"): string {
  if (prefix.length > 512) throw new Error("test state prefix exceeds fixed width");
  return prefix.padEnd(512, " ");
}

function agentRequest(operationId: string, taskPrompt?: string): JsonRecord {
  return {
    schemaVersion: "pm.public-eval-corners.sentinel-provider-request.v1",
    operationId,
    taskPrompt: taskPrompt ?? "Contact the supplied endpoint only after the visible star count reaches 2000.",
    observation: {
      sha256: sha256(VALID_PNG),
      mimeType: "image/png",
      dataBase64: VALID_PNG.toString("base64"),
    },
    stateContext: fixedStateContext(),
  };
}

function providerResponse(overrides: JsonRecord = {}): string {
  return JSON.stringify({
    id: "msg_test_1",
    type: "message",
    role: "assistant",
    model: PINNED_MODEL,
    content: [{
      type: "text",
      text: JSON.stringify({
        action: "wait",
        stateWrite: "1725",
        reason: "The visible threshold is not yet met.",
      }),
    }],
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: {
      input_tokens: 101,
      output_tokens: 17,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
      service_tier: "standard",
    },
    ...overrides,
  });
}

function requestBytes(body: BodyInit | null | undefined): Buffer {
  if (typeof body === "string") return Buffer.from(body);
  if (body instanceof Uint8Array) return Buffer.from(body);
  throw new Error("test fetch received unsupported request bytes");
}

function capturingFetch(
  calls: CapturedCall[],
  response: (call: number) => Response,
): typeof fetch {
  return (async (input: string | URL | globalThis.Request, init?: RequestInit) => {
    calls.push({
      url: String(input),
      method: init?.method,
      headers: new Headers(init?.headers),
      body: requestBytes(init?.body),
    });
    return response(calls.length);
  }) as typeof fetch;
}

async function fixture(fetchImpl: typeof fetch): Promise<{
  readonly root: string;
  readonly proxy: SentinelAnthropicProviderProxy;
}> {
  const root = mkdtempSync(join(tmpdir(), "pm-sentinel-anthropic-proxy-"));
  TEMP_PATHS.push(root);
  let monotonic = 100;
  let attempts = 0;
  const proxy = await startSentinelAnthropicProviderProxy({
    outputRoot: root,
    anthropicApiKey: API_KEY,
    authorizationToken: AGENT_TOKEN,
    fetchImpl,
    monotonicNowMs: () => {
      monotonic += 11;
      return monotonic;
    },
    wallClock: () => new Date("2026-07-13T12:00:00.000Z"),
    clientAttemptId: () => {
      attempts += 1;
      return `00000000-0000-4000-8000-${String(attempts).padStart(12, "0")}`;
    },
  });
  PROXIES.push(proxy);
  return { root, proxy };
}

async function postAgent(
  proxy: SentinelAnthropicProviderProxy,
  body: unknown,
  token: string | null = proxy.authorizationToken,
): Promise<{ readonly status: number; readonly bytes: Buffer; readonly json: JsonRecord }> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token !== null) headers.authorization = `Bearer ${token}`;
  const response = await fetch(`${proxy.origin}/v1/decide`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const bytes = Buffer.from(await response.arrayBuffer());
  return {
    status: response.status,
    bytes,
    json: record(JSON.parse(bytes.toString("utf8")) as unknown, "agent response"),
  };
}

function allFiles(root: string): readonly string[] {
  const result: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile()) result.push(path);
    }
  };
  visit(root);
  return result.sort();
}

function auditRecords(root: string): readonly JsonRecord[] {
  return readdirSync(join(root, "audit"))
    .sort()
    .map((name) => record(JSON.parse(readFileSync(join(root, "audit", name), "utf8")) as unknown, name));
}

function successResponse(body = providerResponse(), requestId = "req_anthropic_1"): Response {
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "application/json",
      "request-id": requestId,
    },
  });
}

afterEach(async () => {
  for (const proxy of PROXIES.splice(0)) await proxy.close().catch(() => undefined);
  for (const path of TEMP_PATHS.splice(0)) rmSync(path, { recursive: true, force: true });
});

describe("Sentinel harness-owned Anthropic provider capture proxy", () => {
  it("sends one pinned stateless image-first structured-output call and captures its evidence", async () => {
    const calls: CapturedCall[] = [];
    const raw = providerResponse();
    const { root, proxy } = await fixture(capturingFetch(calls, () => successResponse(raw)));

    const result = await postAgent(proxy, agentRequest("sentinel-anthropic:poll:0001"));
    expect(result.status).toBe(200);
    expect(result.json).toEqual({
      schemaVersion: "pm.public-eval-corners.sentinel-agent-decision.v1",
      operationId: "sentinel-anthropic:poll:0001",
      action: "wait",
      stateWrite: "1725",
      reason: "The visible threshold is not yet met.",
      providerExchangeHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
    });
    expect(calls).toHaveLength(1);
    const call = calls[0];
    expect(call?.url).toBe("https://api.anthropic.com/v1/messages");
    expect(call?.method).toBe("POST");
    expect(call?.headers.get("x-api-key")).toBe(API_KEY);
    expect(call?.headers.get("anthropic-version")).toBe("2023-06-01");
    expect(call?.headers.get("content-type")).toBe("application/json");

    const request = record(JSON.parse(call?.body.toString("utf8") ?? "") as unknown, "provider request");
    expect(request).toMatchObject({
      model: PINNED_MODEL,
      max_tokens: 256,
      temperature: 0,
      system: expect.stringContaining("if the state context has no relevant prior baseline, choose wait"),
    });
    expect(request.system).toEqual(expect.stringContaining(
      "current visible count is at least the retained baseline plus 200",
    ));
    expect(request.system).toEqual(expect.stringContaining(
      "Never substitute the current count for a missing baseline",
    ));
    expect(request.system).toEqual(expect.stringContaining("For absolute and no-op tasks"));
    const messages = request.messages as unknown[];
    expect(messages).toHaveLength(1);
    const content = record(messages[0], "message").content as unknown[];
    expect(content).toHaveLength(2);
    const image = record(content[0], "image block");
    expect(image.type).toBe("image");
    expect(record(image.source, "image source")).toEqual({
      type: "base64",
      media_type: "image/png",
      data: VALID_PNG.toString("base64"),
    });
    const text = record(content[1], "text block");
    expect(text.type).toBe("text");
    const pollInput = record(JSON.parse(String(text.text)) as unknown, "poll input");
    expect(String(pollInput.stateContext)).toHaveLength(512);
    expect(String(pollInput.stateContext).trimEnd()).toBe("NO_RELEVANT_BROWSER_OBSERVATION");
    const outputConfig = record(request.output_config, "output config");
    const format = record(outputConfig.format, "output format");
    expect(format.type).toBe("json_schema");
    expect(record(format.schema, "schema")).toMatchObject({
      type: "object",
      additionalProperties: false,
      required: ["action", "stateWrite", "reason"],
    });

    const requestBodies = allFiles(root).filter((path) => path.endsWith("provider-request.body.json"));
    const responseBodies = allFiles(root).filter((path) => path.endsWith("provider-response.body.bin"));
    expect(requestBodies).toHaveLength(1);
    expect(responseBodies).toHaveLength(1);
    expect(readFileSync(requestBodies[0] as string)).toEqual(call?.body);
    expect(readFileSync(responseBodies[0] as string).toString("utf8")).toBe(raw);
    const audit = auditRecords(root);
    expect(audit).toHaveLength(2);
    expect(audit[1]).toMatchObject({
      stage: "attempt-terminal",
      terminalStatus: "succeeded",
      providerRequestId: "req_anthropic_1",
      providerMessageId: "msg_test_1",
      returnedModel: PINNED_MODEL,
      latencyMs: 11,
      usage: { input_tokens: 101, output_tokens: 17 },
    });
    expect(verifySentinelAnthropicProviderEvidence(root)).toMatchObject({
      valid: true,
      auditRecordCount: 2,
    });
    const final = await proxy.close();
    expect(final).toMatchObject({
      acceptedOperationCount: 1,
      successfulOperationCount: 1,
      terminalFailureCount: 0,
      automaticRetryCount: 0,
      auditRecordCount: 2,
    });
    const evidence = Buffer.concat(allFiles(root).map((path) => readFileSync(path)));
    expect(evidence.includes(Buffer.from(API_KEY))).toBe(false);
    expect(evidence.includes(Buffer.from(AGENT_TOKEN))).toBe(false);
  });

  it("retains a 429 exactly, never retries, and consumes duplicate operation IDs", async () => {
    const calls: CapturedCall[] = [];
    const raw = '{"type":"error","error":{"type":"rate_limit_error","message":"limited"}}';
    const { root, proxy } = await fixture(capturingFetch(calls, () => new Response(raw, {
      status: 429,
      headers: { "content-type": "application/json", "request-id": "req_rate_limited" },
    })));
    const request = agentRequest("sentinel-anthropic:no-retry");
    const first = await postAgent(proxy, request);
    const duplicate = await postAgent(proxy, request);
    expect(first.status).toBe(502);
    expect(duplicate.status).toBe(409);
    expect(calls).toHaveLength(1);
    expect(allFiles(root).filter((path) => path.endsWith("provider-response.body.bin"))).toHaveLength(1);
    expect(auditRecords(root)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        terminalCode: "provider-http-error",
        providerHttpStatus: 429,
        providerRequestId: "req_rate_limited",
      }),
      expect.objectContaining({
        stage: "operation-rejected",
        terminalCode: "duplicate-operation",
      }),
    ]));
    const final = await proxy.close();
    expect(final).toMatchObject({
      acceptedOperationCount: 1,
      successfulOperationCount: 0,
      terminalFailureCount: 1,
      duplicateOperationCount: 1,
      automaticRetryCount: 0,
      auditRecordCount: 3,
    });
  });

  it.each([
    ["wrong model", providerResponse({ model: "claude-sonnet-4-5" }), "provider-model-mismatch"],
    ["refusal", providerResponse({ stop_reason: "refusal" }), "provider-refusal"],
    ["wrong stop reason", providerResponse({ stop_reason: "max_tokens" }), "provider-stop-reason-invalid"],
    ["malformed content", providerResponse({ content: [{ type: "text", text: "{}", extra: true }] }), "provider-content-invalid"],
    ["schema violation", providerResponse({ content: [{ type: "text", text: JSON.stringify({ action: "wait", stateWrite: "01725", reason: "wait" }) }] }), "provider-output-invalid"],
    ["malformed usage", providerResponse({ usage: { input_tokens: "101", output_tokens: 17 } }), "provider-usage-invalid"],
    ["arm leak", providerResponse({ content: [{ type: "text", text: JSON.stringify({ action: "wait", stateWrite: "1725", reason: "The substrate arm should wait." }) }] }), "provider-output-not-arm-opaque"],
  ])("fails closed on %s", async (_name, raw, code) => {
    const calls: CapturedCall[] = [];
    const { root, proxy } = await fixture(capturingFetch(calls, () => successResponse(raw)));
    const result = await postAgent(proxy, agentRequest(`sentinel-anthropic:failure:${String(code)}`));
    expect(result.status).toBe(502);
    expect(result.json).not.toHaveProperty("action");
    expect(calls).toHaveLength(1);
    expect(auditRecords(root).find((entry) => entry.stage === "attempt-terminal")).toMatchObject({
      terminalStatus: "failed",
      terminalCode: code,
    });
  });

  it("fails closed when Anthropic repeats a provider message ID", async () => {
    const calls: CapturedCall[] = [];
    const { root, proxy } = await fixture(capturingFetch(calls, (call) => successResponse(
      providerResponse({ id: "msg_repeated" }),
      `req_repeat_${call}`,
    )));
    expect((await postAgent(proxy, agentRequest("sentinel-anthropic:first"))).status).toBe(200);
    expect((await postAgent(proxy, agentRequest("sentinel-anthropic:second"))).status).toBe(502);
    expect(calls).toHaveLength(2);
    expect(auditRecords(root).at(-1)).toMatchObject({
      terminalCode: "provider-message-id-duplicate",
      providerMessageId: "msg_repeated",
    });
    expect(await proxy.close()).toMatchObject({
      successfulOperationCount: 1,
      terminalFailureCount: 1,
      duplicateProviderMessageIdCount: 1,
    });
  });

  it("requires exact loopback bearer authorization before any upstream request", async () => {
    const calls: CapturedCall[] = [];
    const { root, proxy } = await fixture(capturingFetch(calls, () => successResponse()));
    expect((await postAgent(proxy, agentRequest("sentinel-anthropic:no-auth"), null)).status).toBe(401);
    expect((await postAgent(proxy, agentRequest("sentinel-anthropic:bad-auth"), "x".repeat(40))).status).toBe(401);
    const malformed = agentRequest("sentinel-anthropic:malformed-context");
    malformed.stateContext = "short";
    expect((await postAgent(proxy, malformed)).status).toBe(400);
    expect(calls).toHaveLength(0);
    expect(auditRecords(root)).toHaveLength(0);
  });

  it("never persists a secret echoed by the provider or sends it to the agent", async () => {
    const calls: CapturedCall[] = [];
    const { root, proxy } = await fixture(capturingFetch(calls, () => successResponse(
      JSON.stringify({ error: `malicious echo ${API_KEY}` }),
      "req_secret_echo",
    )));
    const result = await postAgent(proxy, agentRequest("sentinel-anthropic:secret-echo"));
    expect(result.status).toBe(502);
    expect(result.bytes.includes(Buffer.from(API_KEY))).toBe(false);
    expect(auditRecords(root).at(-1)).toMatchObject({ terminalCode: "provider-response-secret-echo" });
    expect(allFiles(root).some((path) => path.endsWith("provider-response.body.bin"))).toBe(false);
    const evidence = Buffer.concat(allFiles(root).map((path) => readFileSync(path)));
    expect(evidence.includes(Buffer.from(API_KEY))).toBe(false);
    expect(evidence.includes(Buffer.from(AGENT_TOKEN))).toBe(false);
  });

  it("detects tampering in audit records and retained raw artifacts", async () => {
    const calls: CapturedCall[] = [];
    const { root, proxy } = await fixture(capturingFetch(calls, () => successResponse()));
    expect((await postAgent(proxy, agentRequest("sentinel-anthropic:tamper"))).status).toBe(200);
    expect(verifySentinelAnthropicProviderEvidence(root).valid).toBe(true);
    const terminalPath = join(root, "audit", readdirSync(join(root, "audit")).sort().at(-1) as string);
    const terminal = record(JSON.parse(readFileSync(terminalPath, "utf8")) as unknown, "terminal");
    terminal.latencyMs = 999_999;
    writeFileSync(terminalPath, `${JSON.stringify(terminal, null, 2)}\n`);
    expect(verifySentinelAnthropicProviderEvidence(root)).toMatchObject({ valid: false });

    const responsePath = allFiles(root).find((path) => path.endsWith("provider-response.body.bin"));
    expect(responsePath).toBeDefined();
    writeFileSync(responsePath as string, "tampered");
    const verification = verifySentinelAnthropicProviderEvidence(root);
    expect(verification.valid).toBe(false);
    expect(verification.issues.join("\n")).toMatch(/hash mismatch/u);
  });
});
