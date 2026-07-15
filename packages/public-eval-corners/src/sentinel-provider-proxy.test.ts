import { createHash } from "node:crypto";
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  startSentinelProviderProxy,
  type SentinelProviderProxy,
} from "./sentinel-provider-proxy.js";

const API_KEY = "sk-test-provider-key-must-never-persist-123456789";
const AGENT_TOKEN = "agent-auth-token-must-never-persist-123456789";
const PINNED_MODEL = "gpt-4o-2024-11-20";
const VALID_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

type JsonRecord = Record<string, unknown>;

interface CapturedFetchCall {
  readonly url: string;
  readonly method: string | undefined;
  readonly headers: Headers;
  readonly body: Buffer;
}

const TEMP_PATHS: string[] = [];
const PROXIES: SentinelProviderProxy[] = [];

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

function canonical(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
      .map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`)
      .join(",")}}`;
  }
  throw new Error(`cannot canonicalize ${typeof value}`);
}

function fixedStateContext(prefix = "NO_RELEVANT_BROWSER_OBSERVATION"): string {
  if (prefix.length > 512) throw new Error("test state prefix exceeds fixed width");
  return prefix.padEnd(512, " ");
}

function observation(bytes = VALID_PNG): JsonRecord {
  return {
    sha256: sha256(bytes),
    mimeType: "image/png",
    dataBase64: bytes.toString("base64"),
  };
}

function agentRequest(
  operationId: string,
  stateContext = fixedStateContext(),
): JsonRecord {
  return {
    schemaVersion: "pm.public-eval-corners.sentinel-provider-request.v1",
    operationId,
    taskPrompt: "Contact the supplied endpoint only after the visible star count reaches 2000.",
    observation: observation(),
    stateContext,
  };
}

function providerResponseBody(
  model = PINNED_MODEL,
  modelAction: JsonRecord = {
    action: "wait",
    stateWrite: "1725",
    reason: "The visible threshold is not yet met.",
  },
): string {
  return JSON.stringify({
    id: "chatcmpl_test",
    object: "chat.completion",
    created: 1_700_000_000,
    model,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: JSON.stringify(modelAction),
          refusal: null,
        },
        logprobs: null,
        finish_reason: "stop",
      },
    ],
    usage: {
      prompt_tokens: 101,
      completion_tokens: 17,
      total_tokens: 118,
      prompt_tokens_details: { cached_tokens: 0 },
      completion_tokens_details: { reasoning_tokens: 0 },
    },
    system_fingerprint: "fp_test",
  });
}

function requestBodyBytes(body: BodyInit | null | undefined): Buffer {
  if (typeof body === "string") return Buffer.from(body);
  if (body instanceof Uint8Array) return Buffer.from(body);
  throw new Error("test fetch received an unsupported request body");
}

function capturingFetch(
  calls: CapturedFetchCall[],
  response: (callNumber: number) => Response,
): typeof fetch {
  return (async (input: string | URL | globalThis.Request, init?: RequestInit) => {
    calls.push({
      url: String(input),
      method: init?.method,
      headers: new Headers(init?.headers),
      body: requestBodyBytes(init?.body),
    });
    return response(calls.length);
  }) as typeof fetch;
}

async function startFixture(fetchImpl: typeof fetch): Promise<{
  readonly root: string;
  readonly proxy: SentinelProviderProxy;
}> {
  const root = mkdtempSync(join(tmpdir(), "pm-sentinel-provider-proxy-"));
  TEMP_PATHS.push(root);
  let monotonic = 100;
  let clientRequestSequence = 0;
  const proxy = await startSentinelProviderProxy({
    outputRoot: root,
    openAiApiKey: API_KEY,
    authorizationToken: AGENT_TOKEN,
    fetchImpl,
    monotonicNowMs: () => {
      monotonic += 7;
      return monotonic;
    },
    wallClock: () => new Date("2026-07-13T12:00:00.000Z"),
    clientRequestId: () => {
      clientRequestSequence += 1;
      return `00000000-0000-4000-8000-${String(clientRequestSequence).padStart(12, "0")}`;
    },
  });
  PROXIES.push(proxy);
  return { root, proxy };
}

async function postAgent(
  proxy: SentinelProviderProxy,
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

function auditRecords(root: string): readonly JsonRecord[] {
  return readdirSync(join(root, "audit"))
    .sort()
    .map((fileName) =>
      record(
        JSON.parse(readFileSync(join(root, "audit", fileName), "utf8")) as unknown,
        fileName,
      ),
    );
}

function verifyAuditChain(records: readonly JsonRecord[]): string | null {
  let previous: string | null = null;
  for (const [index, current] of records.entries()) {
    expect(current.sequence).toBe(index + 1);
    expect(current.previousRecordHash).toBe(previous);
    const body = structuredClone(current);
    const recordHash = body.recordHash;
    delete body.recordHash;
    expect(recordHash).toBe(sha256(canonical(body)));
    previous = recordHash as string;
  }
  return previous;
}

afterEach(async () => {
  for (const proxy of PROXIES.splice(0)) {
    await proxy.close().catch(() => undefined);
  }
  for (const path of TEMP_PATHS.splice(0)) rmSync(path, { recursive: true, force: true });
});

describe("Sentinel harness-owned OpenAI provider capture proxy", () => {
  it("sends stateless pinned multimodal requests and captures raw bytes, usage, and request IDs", async () => {
    const calls: CapturedFetchCall[] = [];
    const rawProviderResponse = providerResponseBody();
    const { root, proxy } = await startFixture(
      capturingFetch(calls, (callNumber) =>
        new Response(rawProviderResponse, {
          status: 200,
          headers: { "x-request-id": `req_provider_${callNumber}` },
        }),
      ),
    );

    const firstContext = fixedStateContext();
    const retainedBaseline = fixedStateContext(
      "memory_key=microhub.star-count; observed_at=2026-07-13T12:00:00.000Z; browser_observation=1725",
    );
    const first = await postAgent(
      proxy,
      agentRequest("sentinel:poll:0001:model", firstContext),
    );
    const second = await postAgent(
      proxy,
      agentRequest("sentinel:poll:0002:model", retainedBaseline),
    );
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(Object.keys(first.json).sort()).toEqual([
      "action",
      "operationId",
      "providerExchangeHash",
      "reason",
      "schemaVersion",
      "stateWrite",
    ]);
    expect(first.json).toMatchObject({
      schemaVersion: "pm.public-eval-corners.sentinel-agent-decision.v1",
      operationId: "sentinel:poll:0001:model",
      action: "wait",
      stateWrite: "1725",
    });
    expect(JSON.stringify(first.json)).not.toMatch(/"(?:arm|mode)"\s*:/iu);
    expect(calls).toHaveLength(2);

    for (const call of calls) {
      expect(call.url).toBe("https://api.openai.com/v1/chat/completions");
      expect(call.method).toBe("POST");
      expect(call.headers.get("authorization")).toBe(`Bearer ${API_KEY}`);
      expect(call.headers.get("content-type")).toBe("application/json");
      expect(call.headers.get("x-client-request-id")).toMatch(/^[0-9a-f-]{36}$/u);
      const providerRequest = record(
        JSON.parse(call.body.toString("utf8")) as unknown,
        "provider request",
      );
      expect(providerRequest.model).toBe(PINNED_MODEL);
      expect(providerRequest.store).toBe(false);
      expect(providerRequest.stream).toBe(false);
      expect(providerRequest.n).toBe(1);
      expect(providerRequest.max_completion_tokens).toBe(256);
      expect(providerRequest.messages).toHaveLength(2);
      const messages = providerRequest.messages as unknown[];
      const systemMessage = record(messages[0], "system message");
      expect(systemMessage.role).toBe("system");
      expect(systemMessage.content).toEqual(expect.stringContaining(
        "if the state context has no relevant prior baseline, choose wait",
      ));
      expect(systemMessage.content).toEqual(expect.stringContaining(
        "current visible count is at least the retained baseline plus 200",
      ));
      expect(systemMessage.content).toEqual(expect.stringContaining(
        "Never substitute the current count for a missing baseline",
      ));
      expect(systemMessage.content).toEqual(expect.stringContaining(
        "For absolute and no-op tasks",
      ));
      const userContent = record(messages[1], "user message").content as unknown[];
      expect(userContent).toHaveLength(2);
      expect(record(userContent[1], "image content").type).toBe("image_url");
      expect(
        record(record(userContent[1], "image content").image_url, "image URL").url,
      ).toBe(`data:image/png;base64,${VALID_PNG.toString("base64")}`);
      const responseFormat = record(providerRequest.response_format, "response format");
      expect(responseFormat.type).toBe("json_schema");
      const jsonSchema = record(responseFormat.json_schema, "JSON schema");
      expect(jsonSchema.strict).toBe(true);
      expect(
        record(
          record(record(jsonSchema.schema, "schema").properties, "properties").stateWrite,
          "stateWrite schema",
        ).pattern,
      ).toBe("^(?:0|[1-9][0-9]{0,8})$");
    }
    const outboundContexts = calls.map(({ body }) => {
      const request = record(JSON.parse(body.toString("utf8")) as unknown, "request");
      const messages = request.messages as unknown[];
      const userContent = record(messages[1], "user message").content as unknown[];
      const text = record(userContent[0], "text content").text;
      if (typeof text !== "string") throw new Error("provider text content missing");
      return record(JSON.parse(text) as unknown, "provider text payload").stateContext;
    });
    expect(outboundContexts).toEqual([firstContext, retainedBaseline]);

    const requestBodies = allFiles(root).filter((path) => path.endsWith("provider-request.body.json"));
    const responseBodies = allFiles(root).filter((path) => path.endsWith("provider-response.body.bin"));
    expect(requestBodies).toHaveLength(2);
    expect(responseBodies).toHaveLength(2);
    expect(requestBodies.map((path) => sha256(readFileSync(path))).sort()).toEqual(
      calls.map(({ body }) => sha256(body)).sort(),
    );
    for (const path of responseBodies) {
      expect(readFileSync(path).toString("utf8")).toBe(rawProviderResponse);
    }

    const audit = auditRecords(root);
    expect(audit).toHaveLength(4);
    const head = verifyAuditChain(audit);
    const terminal = audit.filter((entry) => entry.stage === "attempt-terminal");
    expect(terminal.map((entry) => entry.providerRequestId)).toEqual([
      "req_provider_1",
      "req_provider_2",
    ]);
    expect(terminal.every((entry) => entry.returnedModel === PINNED_MODEL)).toBe(true);
    expect(record(terminal[0]?.usage, "usage")).toMatchObject({
      prompt_tokens: 101,
      completion_tokens: 17,
      total_tokens: 118,
    });
    expect(first.json.providerExchangeHash).toBe(terminal[0]?.recordHash);
    expect(second.json.providerExchangeHash).toBe(terminal[1]?.recordHash);

    const final = await proxy.close();
    expect(final).toMatchObject({
      acceptedOperationCount: 2,
      successfulOperationCount: 2,
      terminalFailureCount: 0,
      automaticRetryCount: 0,
      auditRecordCount: 4,
      finalAuditHeadHash: head,
    });
    expect(await proxy.close()).toEqual(final);
    expect(statSync(proxy.readyReceiptPath).isFile()).toBe(true);
    expect(statSync(proxy.finalReceiptPath).isFile()).toBe(true);
    const allEvidence = Buffer.concat(allFiles(root).map((path) => readFileSync(path)));
    expect(allEvidence.includes(Buffer.from(API_KEY))).toBe(false);
    expect(allEvidence.includes(Buffer.from(AGENT_TOKEN))).toBe(false);
  });

  it("fails closed and retains the exact response when the provider returns a different model", async () => {
    const calls: CapturedFetchCall[] = [];
    const rawProviderResponse = providerResponseBody("gpt-4o");
    const { root, proxy } = await startFixture(
      capturingFetch(calls, () =>
        new Response(rawProviderResponse, {
          status: 200,
          headers: { "x-request-id": "req_model_mismatch" },
        }),
      ),
    );

    const result = await postAgent(proxy, agentRequest("sentinel:model-mismatch"));
    expect(result.status).toBe(502);
    expect(result.json.error).toEqual({
      code: "provider_failure",
      message: "The decision provider failed closed.",
    });
    expect(result.json).not.toHaveProperty("action");
    expect(calls).toHaveLength(1);
    const terminal = auditRecords(root).find((entry) => entry.stage === "attempt-terminal");
    expect(terminal).toMatchObject({
      terminalStatus: "failed",
      terminalCode: "provider-model-mismatch",
      providerRequestId: "req_model_mismatch",
      returnedModel: "gpt-4o",
    });
    const rawPath = allFiles(root).find((path) => path.endsWith("provider-response.body.bin"));
    expect(rawPath).toBeDefined();
    expect(readFileSync(rawPath as string).toString("utf8")).toBe(rawProviderResponse);
  });

  it("never retries upstream and consumes an operation ID after its terminal failure", async () => {
    const calls: CapturedFetchCall[] = [];
    const { root, proxy } = await startFixture(
      capturingFetch(calls, () =>
        new Response('{"error":{"message":"rate limited"}}', {
          status: 429,
          headers: { "x-request-id": "req_rate_limited" },
        }),
      ),
    );
    const request = agentRequest("sentinel:no-retry");
    const first = await postAgent(proxy, request);
    const duplicate = await postAgent(proxy, request);
    expect(first.status).toBe(502);
    expect(duplicate.status).toBe(409);
    expect(duplicate.json.error).toEqual({
      code: "duplicate_operation",
      message: "The operation identifier was already consumed.",
    });
    expect(calls).toHaveLength(1);
    const audit = auditRecords(root);
    expect(audit).toHaveLength(2);
    expect(audit[1]).toMatchObject({
      stage: "attempt-terminal",
      attemptNumber: 1,
      automaticRetryCount: 0,
      terminalStatus: "failed",
      terminalCode: "provider-http-error",
      providerHttpStatus: 429,
      providerRequestId: "req_rate_limited",
    });
    const final = await proxy.close();
    expect(final).toMatchObject({
      acceptedOperationCount: 1,
      successfulOperationCount: 0,
      terminalFailureCount: 1,
      automaticRetryCount: 0,
      auditRecordCount: 2,
    });
  });

  it("rejects unauthenticated, unknown-key, bad-hash, non-PNG, and oversized requests before upstream", async () => {
    const calls: CapturedFetchCall[] = [];
    const { root, proxy } = await startFixture(
      capturingFetch(calls, () => new Response(providerResponseBody(), { status: 200 })),
    );
    expect((await postAgent(proxy, agentRequest("sentinel:no-auth"), null)).status).toBe(401);
    expect((await postAgent(proxy, agentRequest("sentinel:bad-auth"), "x".repeat(40))).status).toBe(401);

    const unknownKey = agentRequest("sentinel:unknown-key");
    unknownKey.unregistered = true;
    expect((await postAgent(proxy, unknownKey)).status).toBe(400);

    expect((await postAgent(proxy, agentRequest("sentinel:arm:leak"))).status).toBe(400);
    expect((await postAgent(
      proxy,
      agentRequest("sentinel:unregistered-context", fixedStateContext("arbitrary context")),
    )).status).toBe(400);

    const badHash = agentRequest("sentinel:bad-hash");
    record(badHash.observation, "observation").sha256 = "0".repeat(64);
    expect((await postAgent(proxy, badHash)).status).toBe(400);

    const nonPng = agentRequest("sentinel:non-png");
    nonPng.observation = observation(Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.from("signature only is not a PNG"),
    ]));
    expect((await postAgent(proxy, nonPng)).status).toBe(400);

    const oversizedPng = Buffer.concat([
      VALID_PNG.subarray(0, 8),
      Buffer.alloc(8 * 1024 * 1024),
      Buffer.from([0]),
    ]);
    const oversized = agentRequest("sentinel:oversized");
    oversized.observation = observation(oversizedPng);
    expect((await postAgent(proxy, oversized)).status).toBe(413);

    expect(calls).toHaveLength(0);
    expect(auditRecords(root)).toHaveLength(0);
    const final = await proxy.close();
    expect(final).toMatchObject({
      acceptedOperationCount: 0,
      successfulOperationCount: 0,
      terminalFailureCount: 0,
      auditRecordCount: 0,
    });
  }, 30_000);

  it("withholds provider output that exposes execution-path identity", async () => {
    const calls: CapturedFetchCall[] = [];
    const maliciousProviderResponse = providerResponseBody(PINNED_MODEL, {
      action: "contact",
      stateWrite: "2000",
      reason: "The substrate arm should contact now.",
    });
    const { root, proxy } = await startFixture(
      capturingFetch(calls, () =>
        new Response(maliciousProviderResponse, {
          status: 200,
          headers: { "x-request-id": "req_identity_leak" },
        }),
      ),
    );
    const result = await postAgent(proxy, agentRequest("sentinel:identity-leak"));
    expect(result.status).toBe(502);
    expect(result.bytes.toString("utf8")).not.toMatch(/\b(?:arm|mode|native|sham|substrate)\b/iu);
    const terminal = auditRecords(root).find((entry) => entry.stage === "attempt-terminal");
    expect(terminal?.terminalCode).toBe("provider-output-not-arm-opaque");
    expect(calls).toHaveLength(1);
  });
});
