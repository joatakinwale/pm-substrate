/**
 * Smoke tests for stevie-ai-content.
 *
 * Two layers:
 *   1. Message-contract validation (validateMessage).
 *   2. The retry-classification decision tree, exercised via a mocked
 *      BackendClient and a mocked global fetch (the AI Gateway call).
 *
 * End-to-end tests against the real gateway live in
 * /scripts/test-ai-content.sh (covered in a later task).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  InvalidMessageError,
  PermanentError,
  RetryableError,
  validateMessage,
  type AIContentMessage,
} from "@stevie/shared";
import {
  BackendCallError,
  BackendClient,
} from "@stevie/backend-client";

// ── Contract validation ─────────────────────────────────────

describe("validateMessage(ai.content.generate)", () => {
  const valid: AIContentMessage = {
    type: "ai.content.generate",
    org_id: "11111111-2222-3333-4444-555555555555",
    idempotency_key: "ai-content-abc123",
    emitted_at: "2026-05-01T12:00:00Z",
    request_id: "aa-bb-cc",
  };

  it("accepts a well-formed message", () => {
    expect(() =>
      validateMessage<AIContentMessage>(valid, "ai.content.generate")
    ).not.toThrow();
  });

  it("rejects mismatched type", () => {
    expect(() =>
      validateMessage<AIContentMessage>(
        { ...valid, type: "stripe.invoice.sync" },
        "ai.content.generate"
      )
    ).toThrow(InvalidMessageError);
  });

  it("rejects missing org_id", () => {
    const { org_id: _omit, ...rest } = valid;
    expect(() =>
      validateMessage<AIContentMessage>(rest, "ai.content.generate")
    ).toThrow(InvalidMessageError);
  });

  it("rejects empty idempotency_key", () => {
    expect(() =>
      validateMessage<AIContentMessage>(
        { ...valid, idempotency_key: "" },
        "ai.content.generate"
      )
    ).toThrow(InvalidMessageError);
  });

  it("rejects non-object input", () => {
    expect(() =>
      validateMessage<AIContentMessage>(null, "ai.content.generate")
    ).toThrow(InvalidMessageError);
    expect(() =>
      validateMessage<AIContentMessage>("string", "ai.content.generate")
    ).toThrow(InvalidMessageError);
  });
});

// ── Retry-classification decision tree ──────────────────────
//
// We exercise the queue() handler as if CF Queues delivered a single message,
// with two collaborators mocked:
//   - global fetch (the AI Gateway call) → controlled per test.
//   - BackendClient methods               → spied so we can assert ordering.
//
// We assert msg.ack() vs msg.retry() through a fake msg object — that's the
// observable side-effect handleConsumerError() ultimately produces.

interface FakeMsg {
  body: unknown;
  ack: ReturnType<typeof vi.fn>;
  retry: ReturnType<typeof vi.fn>;
}

function makeMsg(body: unknown): FakeMsg {
  return {
    body,
    ack: vi.fn(),
    retry: vi.fn(),
  };
}

const ENV = {
  WEBHOOK_SECRET: "test-secret",
  BACKEND_BASE_URL: "https://backend.test",
  ENVIRONMENT: "development" as const,
  ANTHROPIC_API_KEY: "sk-test",
  CF_AI_GATEWAY_URL: "https://gateway.test/v1/acct/gw/anthropic",
};

const VALID_MSG: AIContentMessage = {
  type: "ai.content.generate",
  org_id: "11111111-2222-3333-4444-555555555555",
  idempotency_key: "ai-content-abc123",
  emitted_at: "2026-05-01T12:00:00Z",
  request_id: "aa-bb-cc",
};

const PROMPT_DTO = {
  system_prompt: "You are a witty copywriter.",
  user_prompt: "Write a caption for our spring launch.",
  model: "claude-sonnet-4-6",
  max_tokens: 1024,
  temperature: 0.7,
};

describe("queue handler — retry classification", () => {
  // `any` here so the tests aren't coupled to vitest's MockInstance generic
  // (which has changed shape across minor versions). The runtime behaviour
  // we assert on (`mock.calls`, `mockResolvedValueOnce`, etc.) is stable.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let fetchSpy: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let beginSpy: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let completeSpy: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let failSpy: any;

  beforeEach(() => {
    // Stub BackendClient so we never hit a real backend.
    beginSpy = vi
      .spyOn(BackendClient.prototype, "beginAIContent")
      .mockResolvedValue(PROMPT_DTO);
    completeSpy = vi
      .spyOn(BackendClient.prototype, "completeAIContent")
      .mockResolvedValue(undefined as unknown as void);
    failSpy = vi
      .spyOn(BackendClient.prototype, "failAIContent")
      .mockResolvedValue(undefined as unknown as void);

    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("success → markComplete called and msg.ack()", async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({
          model: "claude-sonnet-4-6",
          content: [{ type: "text", text: "Hello, spring!" }],
          usage: { input_tokens: 42, output_tokens: 7 },
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      ) as unknown as Response
    );

    // Late-import the handler so the spies above are in place when the
    // module first reads `globalThis.fetch`.
    const { default: handler } = await import("./index.js");
    const msg = makeMsg(VALID_MSG);

    await handler.queue(
      { messages: [msg] } as unknown as MessageBatch<unknown>,
      ENV,
      {} as unknown as ExecutionContext
    );

    expect(beginSpy).toHaveBeenCalledTimes(1);
    expect(completeSpy).toHaveBeenCalledTimes(1);
    const completeArg = completeSpy.mock.calls[0]![0] as unknown as Record<
      string,
      unknown
    >;
    expect(completeArg).toMatchObject({
      request_id: VALID_MSG.request_id,
      org_id: VALID_MSG.org_id,
      generated_content: "Hello, spring!",
      model: "claude-sonnet-4-6",
      input_tokens: 42,
      output_tokens: 7,
    });
    expect(typeof completeArg["latency_ms"]).toBe("number");
    expect(failSpy).not.toHaveBeenCalled();
    expect(msg.ack).toHaveBeenCalledTimes(1);
    expect(msg.retry).not.toHaveBeenCalled();
  });

  it("gateway 429 → RetryableError → msg.retry() and no /fail", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ error: "rate limited" }), {
        status: 429,
      }) as unknown as Response
    );

    const { default: handler } = await import("./index.js");
    const msg = makeMsg(VALID_MSG);

    await handler.queue(
      { messages: [msg] } as unknown as MessageBatch<unknown>,
      ENV,
      {} as unknown as ExecutionContext
    );

    expect(completeSpy).not.toHaveBeenCalled();
    expect(failSpy).not.toHaveBeenCalled();
    expect(msg.retry).toHaveBeenCalledTimes(1);
    expect(msg.ack).not.toHaveBeenCalled();
  });

  it("gateway 429 with billing quota body → /fail called and msg.ack()", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ error: { code: "insufficient_quota" } }), {
        status: 429,
      }) as unknown as Response
    );

    const { default: handler } = await import("./index.js");
    const msg = makeMsg(VALID_MSG);

    await handler.queue(
      { messages: [msg] } as unknown as MessageBatch<unknown>,
      ENV,
      {} as unknown as ExecutionContext
    );

    expect(completeSpy).not.toHaveBeenCalled();
    expect(failSpy).toHaveBeenCalledTimes(1);
    const failArg = failSpy.mock.calls[0]![0] as Record<string, unknown>;
    expect(String(failArg["error_message"])).toMatch(/billing unavailable/i);
    expect(msg.ack).toHaveBeenCalledTimes(1);
    expect(msg.retry).not.toHaveBeenCalled();
  });

  it("skips unconfigured fallback providers and calls the configured model", async () => {
    beginSpy.mockResolvedValueOnce({
      ...PROMPT_DTO,
      model: "@cf/meta/llama-3.1-8b-instruct",
      model_chain: [
        "@cf/meta/llama-3.1-8b-instruct",
        "gpt-4o-mini",
        "claude-sonnet-4-6",
      ],
    });
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({
          result: {
            choices: [{ message: { content: "Workers AI carried it." } }],
            usage: { prompt_tokens: 12, completion_tokens: 5 },
          },
          success: true,
          errors: [],
          messages: [],
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      ) as unknown as Response
    );

    const { default: handler } = await import("./index.js");
    const msg = makeMsg(VALID_MSG);

    await handler.queue(
      { messages: [msg] } as unknown as MessageBatch<unknown>,
      {
        ...ENV,
        ANTHROPIC_API_KEY: "",
        CF_WORKERS_AI_TOKEN: "cf-workers-test",
      },
      {} as unknown as ExecutionContext
    );

    expect(fetchSpy.mock.calls[0]![0]).toBe(
      "https://gateway.test/v1/acct/gw/workers-ai/@cf/meta/llama-3.1-8b-instruct",
    );
    expect(completeSpy).toHaveBeenCalledTimes(1);
    const completeArg = completeSpy.mock.calls[0]![0] as Record<string, unknown>;
    expect(completeArg["model"]).toBe("@cf/meta/llama-3.1-8b-instruct");
    expect(failSpy).not.toHaveBeenCalled();
    expect(msg.ack).toHaveBeenCalledTimes(1);
  });

  it("marks failed when every model in the chain lacks provider credentials", async () => {
    beginSpy.mockResolvedValueOnce({
      ...PROMPT_DTO,
      model: "@cf/meta/llama-3.1-8b-instruct",
      model_chain: ["@cf/meta/llama-3.1-8b-instruct", "gpt-4o-mini"],
    });

    const { default: handler } = await import("./index.js");
    const msg = makeMsg(VALID_MSG);

    await handler.queue(
      { messages: [msg] } as unknown as MessageBatch<unknown>,
      { ...ENV, ANTHROPIC_API_KEY: "" },
      {} as unknown as ExecutionContext
    );

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(completeSpy).not.toHaveBeenCalled();
    expect(failSpy).toHaveBeenCalledTimes(1);
    const failArg = failSpy.mock.calls[0]![0] as Record<string, unknown>;
    expect(String(failArg["error_message"])).toMatch(/No configured AI provider/i);
    expect(msg.ack).toHaveBeenCalledTimes(1);
    expect(msg.retry).not.toHaveBeenCalled();
  });

  it("gateway 401 → PermanentError → /fail called and msg.ack()", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ error: "invalid api key" }), {
        status: 401,
      }) as unknown as Response
    );

    const { default: handler } = await import("./index.js");
    const msg = makeMsg(VALID_MSG);

    await handler.queue(
      { messages: [msg] } as unknown as MessageBatch<unknown>,
      ENV,
      {} as unknown as ExecutionContext
    );

    expect(completeSpy).not.toHaveBeenCalled();
    expect(failSpy).toHaveBeenCalledTimes(1);
    const failArg = failSpy.mock.calls[0]![0] as Record<string, unknown>;
    expect(failArg["request_id"]).toBe(VALID_MSG.request_id);
    expect(failArg["org_id"]).toBe(VALID_MSG.org_id);
    expect(String(failArg["error_message"])).toMatch(/auth/i);
    // PermanentError → handleConsumerError ack()s the message.
    expect(msg.ack).toHaveBeenCalledTimes(1);
    expect(msg.retry).not.toHaveBeenCalled();
  });

  it("gateway 400 → PermanentError → /fail called and msg.ack()", async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({ error: { type: "invalid_request_error" } }),
        { status: 400 }
      ) as unknown as Response
    );

    const { default: handler } = await import("./index.js");
    const msg = makeMsg(VALID_MSG);

    await handler.queue(
      { messages: [msg] } as unknown as MessageBatch<unknown>,
      ENV,
      {} as unknown as ExecutionContext
    );

    expect(completeSpy).not.toHaveBeenCalled();
    expect(failSpy).toHaveBeenCalledTimes(1);
    const failArg = failSpy.mock.calls[0]![0] as Record<string, unknown>;
    expect(String(failArg["error_message"])).toMatch(/bad request/i);
    expect(msg.ack).toHaveBeenCalledTimes(1);
    expect(msg.retry).not.toHaveBeenCalled();
  });

  it("backend begin returns 5xx → RetryableError → msg.retry() and no Anthropic call", async () => {
    beginSpy.mockRejectedValueOnce(
      new BackendCallError("backend down", 503)
    );

    const { default: handler } = await import("./index.js");
    const msg = makeMsg(VALID_MSG);

    await handler.queue(
      { messages: [msg] } as unknown as MessageBatch<unknown>,
      ENV,
      {} as unknown as ExecutionContext
    );

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(completeSpy).not.toHaveBeenCalled();
    expect(failSpy).not.toHaveBeenCalled();
    expect(msg.retry).toHaveBeenCalledTimes(1);
    expect(msg.ack).not.toHaveBeenCalled();
  });
});

// Surface the imports so unused-import lint doesn't drop them.
void PermanentError;
void RetryableError;
