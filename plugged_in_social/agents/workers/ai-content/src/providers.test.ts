/**
 * Provider routing tests — pin the prefix→provider mapping, the URL
 * paths the Worker constructs, and the per-provider body shapes.
 *
 * Pure unit tests — no network, no Worker runtime.
 */
import { describe, expect, it } from "vitest";
import {
  buildRequest,
  buildUniversalRequest,
  filterModelsByConfiguredProviders,
  MissingProviderKeyError,
  parseResponse,
  parseResponseAuto,
  providerFor,
  stripLegacyAnthropicSuffix,
  UnsupportedModelError,
  type ProviderEnv,
  type ProviderRequest,
} from "./providers.js";

const BASE = "https://gateway.example.com/v1/acct/gw";

const FULL_ENV: ProviderEnv = {
  CF_AIG_TOKEN: "cf-aig-test",
  ANTHROPIC_API_KEY: "sk-ant-test",
  OPENAI_API_KEY: "sk-oai-test",
  CF_WORKERS_AI_TOKEN: "cf-test",
  GOOGLE_AI_API_KEY: "g-test",
};

const REQ: ProviderRequest = {
  systemPrompt: "You are a witty copywriter.",
  userPrompt: "Write a caption.",
  model: "placeholder",
  maxTokens: 1024,
  temperature: 0.5,
};

describe("providerFor", () => {
  it("routes claude-* to anthropic", () => {
    expect(providerFor("claude-sonnet-4-5")).toBe("anthropic");
    expect(providerFor("claude-opus-4-7")).toBe("anthropic");
    expect(providerFor("Claude-Sonnet-4-6")).toBe("anthropic");
  });

  it("routes gpt-*/o3-* to openai", () => {
    expect(providerFor("gpt-4o-mini")).toBe("openai");
    expect(providerFor("gpt-4.1")).toBe("openai");
    expect(providerFor("o3-mini")).toBe("openai");
  });

  it("routes @cf/* to workers-ai", () => {
    expect(providerFor("@cf/meta/llama-3.1-8b-instruct")).toBe("workers-ai");
    expect(providerFor("@cf/openai/gpt-oss-120b")).toBe("workers-ai");
  });

  it("routes gemini-* to google-ai-studio", () => {
    expect(providerFor("gemini-2.5-pro")).toBe("google-ai-studio");
    expect(providerFor("gemini-2.5-flash")).toBe("google-ai-studio");
  });

  it("throws UnsupportedModelError on unknown prefix", () => {
    expect(() => providerFor("nonsense-model")).toThrow(UnsupportedModelError);
  });
});

describe("filterModelsByConfiguredProviders", () => {
  it("keeps configured providers and reports skipped providers", () => {
    const out = filterModelsByConfiguredProviders(
      [
        "@cf/meta/llama-3.1-8b-instruct",
        "gpt-4o-mini",
        "claude-sonnet-4-6",
      ],
      {
        CF_WORKERS_AI_TOKEN: "cf-test",
        OPENAI_API_KEY: "",
        ANTHROPIC_API_KEY: "",
      },
    );

    expect(out.models).toEqual(["@cf/meta/llama-3.1-8b-instruct"]);
    expect(out.skipped).toEqual([
      { model: "gpt-4o-mini", provider: "openai", envVar: "OPENAI_API_KEY" },
      { model: "claude-sonnet-4-6", provider: "anthropic", envVar: "ANTHROPIC_API_KEY" },
    ]);
  });
});

describe("stripLegacyAnthropicSuffix", () => {
  it("strips trailing /anthropic for backwards-compat", () => {
    expect(
      stripLegacyAnthropicSuffix("https://example.com/v1/acct/gw/anthropic"),
    ).toBe("https://example.com/v1/acct/gw");
  });

  it("strips other provider suffixes too", () => {
    expect(
      stripLegacyAnthropicSuffix("https://example.com/v1/acct/gw/openai/"),
    ).toBe("https://example.com/v1/acct/gw");
  });

  it("leaves a clean base URL alone", () => {
    expect(stripLegacyAnthropicSuffix("https://example.com/v1/acct/gw")).toBe(
      "https://example.com/v1/acct/gw",
    );
  });
});

describe("buildRequest — anthropic", () => {
  it("hits /anthropic/v1/messages with native body and x-api-key header", () => {
    const out = buildRequest(BASE, { ...REQ, model: "claude-sonnet-4-5" }, FULL_ENV);
    expect(out.provider).toBe("anthropic");
    expect(out.built.url).toBe(`${BASE}/anthropic/v1/messages`);
    expect(out.built.headers["x-api-key"]).toBe("sk-ant-test");
    expect(out.built.headers["cf-aig-authorization"]).toBe(
      "Bearer cf-aig-test",
    );
    expect(out.built.headers["anthropic-version"]).toBe("2023-06-01");
    const body = JSON.parse(out.built.body);
    expect(body.model).toBe("claude-sonnet-4-5");
    expect(body.system).toBe("You are a witty copywriter.");
    expect(body.messages).toEqual([
      { role: "user", content: "Write a caption." },
    ]);
    expect(body.max_tokens).toBe(1024);
  });

  it("omits 'system' when systemPrompt is null", () => {
    const out = buildRequest(
      BASE,
      { ...REQ, model: "claude-sonnet-4-5", systemPrompt: null },
      FULL_ENV,
    );
    const body = JSON.parse(out.built.body);
    expect("system" in body).toBe(false);
  });

  it("throws MissingProviderKeyError when ANTHROPIC_API_KEY is empty", () => {
    expect(() =>
      buildRequest(BASE, { ...REQ, model: "claude-sonnet-4-5" }, {
        ...FULL_ENV,
        ANTHROPIC_API_KEY: "",
      }),
    ).toThrow(MissingProviderKeyError);
  });

  it("strips legacy /anthropic suffix from base url", () => {
    const out = buildRequest(
      `${BASE}/anthropic`,
      { ...REQ, model: "claude-sonnet-4-5" },
      FULL_ENV,
    );
    expect(out.built.url).toBe(`${BASE}/anthropic/v1/messages`);
  });
});

describe("buildRequest — openai", () => {
  it("hits /openai/chat/completions with bearer auth and chat shape", () => {
    const out = buildRequest(BASE, { ...REQ, model: "gpt-4o-mini" }, FULL_ENV);
    expect(out.provider).toBe("openai");
    expect(out.built.url).toBe(`${BASE}/openai/chat/completions`);
    expect(out.built.headers.authorization).toBe("Bearer sk-oai-test");
    const body = JSON.parse(out.built.body);
    expect(body.model).toBe("gpt-4o-mini");
    expect(body.messages).toEqual([
      { role: "system", content: "You are a witty copywriter." },
      { role: "user", content: "Write a caption." },
    ]);
  });

  it("throws MissingProviderKeyError when OPENAI_API_KEY is empty", () => {
    expect(() =>
      buildRequest(BASE, { ...REQ, model: "gpt-4o-mini" }, {
        ...FULL_ENV,
        OPENAI_API_KEY: "",
      }),
    ).toThrow(MissingProviderKeyError);
  });
});

describe("buildRequest — workers-ai", () => {
  it("hits /workers-ai/{model} with bearer auth and OpenAI-compat body", () => {
    const out = buildRequest(
      BASE,
      { ...REQ, model: "@cf/meta/llama-3.1-8b-instruct" },
      FULL_ENV,
    );
    expect(out.provider).toBe("workers-ai");
    expect(out.built.url).toBe(
      `${BASE}/workers-ai/@cf/meta/llama-3.1-8b-instruct`,
    );
    expect(out.built.headers.authorization).toBe("Bearer cf-test");
    const body = JSON.parse(out.built.body);
    expect(body.messages).toEqual([
      { role: "system", content: "You are a witty copywriter." },
      { role: "user", content: "Write a caption." },
    ]);
  });

  it("throws MissingProviderKeyError when CF_WORKERS_AI_TOKEN is empty", () => {
    expect(() =>
      buildRequest(BASE, { ...REQ, model: "@cf/meta/llama-3.1-8b-instruct" }, {
        ...FULL_ENV,
        CF_WORKERS_AI_TOKEN: "",
      }),
    ).toThrow(MissingProviderKeyError);
  });
});

describe("buildRequest — google-ai-studio", () => {
  it("hits /google-ai-studio/v1/models/{model}:generateContent with x-goog-api-key", () => {
    const out = buildRequest(
      BASE,
      { ...REQ, model: "gemini-2.5-flash" },
      FULL_ENV,
    );
    expect(out.provider).toBe("google-ai-studio");
    expect(out.built.url).toBe(
      `${BASE}/google-ai-studio/v1/models/gemini-2.5-flash:generateContent`,
    );
    expect(out.built.headers["x-goog-api-key"]).toBe("g-test");
  });

  it("uses Gemini's native systemInstruction field for system prompts", () => {
    // Verified at https://ai.google.dev/api/generate-content. The
    // earlier implementation synthesised a user/model primer exchange
    // which was wasteful and degraded output — make sure the regression
    // doesn't return.
    const out = buildRequest(
      BASE,
      { ...REQ, model: "gemini-2.5-flash" },
      FULL_ENV,
    );
    const body = JSON.parse(out.built.body);
    expect(body.systemInstruction).toEqual({
      parts: [{ text: "You are a witty copywriter." }],
    });
    // Contents should hold ONLY the user message — no synthesised primer.
    expect(body.contents).toEqual([
      { role: "user", parts: [{ text: "Write a caption." }] },
    ]);
  });

  it("omits systemInstruction when no system prompt is provided", () => {
    const out = buildRequest(
      BASE,
      { ...REQ, model: "gemini-2.5-flash", systemPrompt: null },
      FULL_ENV,
    );
    const body = JSON.parse(out.built.body);
    expect("systemInstruction" in body).toBe(false);
  });

  it("routes Gemini 3.x preview model ids to the same provider", () => {
    const out = buildRequest(
      BASE,
      { ...REQ, model: "gemini-3-pro-preview" },
      FULL_ENV,
    );
    expect(out.provider).toBe("google-ai-studio");
    expect(out.built.url).toBe(
      `${BASE}/google-ai-studio/v1/models/gemini-3-pro-preview:generateContent`,
    );
  });
});

describe("parseResponse — anthropic", () => {
  it("concatenates text blocks and reads usage", () => {
    const parsed = parseResponse(
      "anthropic",
      {
        model: "claude-sonnet-4-5",
        content: [
          { type: "text", text: "Hello, " },
          { type: "text", text: "world!" },
        ],
        usage: { input_tokens: 10, output_tokens: 3 },
      },
      "fallback",
    );
    expect(parsed.generatedContent).toBe("Hello, world!");
    expect(parsed.model).toBe("claude-sonnet-4-5");
    expect(parsed.inputTokens).toBe(10);
    expect(parsed.outputTokens).toBe(3);
  });
});

describe("parseResponse — openai", () => {
  it("reads choices[0].message.content and usage", () => {
    const parsed = parseResponse(
      "openai",
      {
        model: "gpt-4o-mini",
        choices: [{ message: { content: "Hi from OpenAI." } }],
        usage: { prompt_tokens: 5, completion_tokens: 4 },
      },
      "fallback",
    );
    expect(parsed.generatedContent).toBe("Hi from OpenAI.");
    expect(parsed.inputTokens).toBe(5);
    expect(parsed.outputTokens).toBe(4);
  });
});

describe("parseResponse — workers-ai", () => {
  it("reads OpenAI-compat shape inside .result wrapper", () => {
    const parsed = parseResponse(
      "workers-ai",
      {
        result: {
          choices: [{ message: { content: "Hello from llama." } }],
          usage: { prompt_tokens: 7, completion_tokens: 9 },
        },
      },
      "@cf/meta/llama-3.1-8b-instruct",
    );
    expect(parsed.generatedContent).toBe("Hello from llama.");
    expect(parsed.inputTokens).toBe(7);
    expect(parsed.outputTokens).toBe(9);
  });

  it("falls back to .response field for native Workers AI shape", () => {
    const parsed = parseResponse(
      "workers-ai",
      { result: { response: "Native Workers AI text." } },
      "@cf/meta/llama-3.1-8b-instruct",
    );
    expect(parsed.generatedContent).toBe("Native Workers AI text.");
  });
});

describe("parseResponse — google-ai-studio", () => {
  it("joins parts[].text and reads usageMetadata", () => {
    const parsed = parseResponse(
      "google-ai-studio",
      {
        candidates: [
          {
            content: {
              parts: [{ text: "Hello, " }, { text: "Gemini!" }],
            },
          },
        ],
        usageMetadata: {
          promptTokenCount: 12,
          candidatesTokenCount: 4,
        },
      },
      "gemini-2.5-flash",
    );
    expect(parsed.generatedContent).toBe("Hello, Gemini!");
    expect(parsed.inputTokens).toBe(12);
    expect(parsed.outputTokens).toBe(4);
  });
});

// ── Universal Endpoint (Layer 2: quota-aware fallback) ──────────────

describe("buildUniversalRequest", () => {
  it("hits the bare gateway base URL (no provider suffix)", () => {
    const out = buildUniversalRequest(
      BASE,
      REQ,
      ["claude-sonnet-4-6", "gpt-4o-mini"],
      FULL_ENV,
    );
    expect(out.url).toBe(BASE);
  });

  it("encodes a JSON array of {provider, endpoint, headers, query} entries", () => {
    const out = buildUniversalRequest(
      BASE,
      REQ,
      [
        "claude-sonnet-4-6",
        "gpt-4o-mini",
        "@cf/meta/llama-3.1-8b-instruct",
      ],
      FULL_ENV,
    );
    const body = JSON.parse(out.body) as Array<Record<string, unknown>>;
    expect(body).toHaveLength(3);

    expect(body[0]!.provider).toBe("anthropic");
    expect(body[0]!.endpoint).toBe("v1/messages");
    const ah = body[0]!.headers as Record<string, string>;
    expect(ah["x-api-key"]).toBe("sk-ant-test");
    expect(ah["cf-aig-authorization"]).toBe("Bearer cf-aig-test");
    const aq = body[0]!.query as Record<string, unknown>;
    expect(aq.model).toBe("claude-sonnet-4-6");

    expect(body[1]!.provider).toBe("openai");
    expect(body[1]!.endpoint).toBe("chat/completions");

    expect(body[2]!.provider).toBe("workers-ai");
    expect(body[2]!.endpoint).toBe("@cf/meta/llama-3.1-8b-instruct");
  });

  it("preserves chain order in the returned chain hint", () => {
    const out = buildUniversalRequest(
      BASE,
      REQ,
      ["claude-haiku-4-5", "gpt-4o-mini"],
      FULL_ENV,
    );
    expect(out.chain).toEqual(["anthropic", "openai"]);
  });

  it("rejects single-model chains (caller should use buildRequest instead)", () => {
    expect(() =>
      buildUniversalRequest(BASE, REQ, ["claude-sonnet-4-6"], FULL_ENV),
    ).toThrow(/at least 2/);
  });

  it("strips legacy /anthropic suffix off the gateway base", () => {
    const out = buildUniversalRequest(
      `${BASE}/anthropic`,
      REQ,
      ["claude-sonnet-4-6", "gpt-4o-mini"],
      FULL_ENV,
    );
    expect(out.url).toBe(BASE);
  });

  it("propagates missing-key errors for any provider in the chain", () => {
    expect(() =>
      buildUniversalRequest(
        BASE,
        REQ,
        ["claude-sonnet-4-6", "gpt-4o-mini"],
        { ...FULL_ENV, OPENAI_API_KEY: "" },
      ),
    ).toThrow(MissingProviderKeyError);
  });
});

describe("parseResponseAuto — shape detection", () => {
  it("detects Anthropic by content[] + usage.input_tokens", () => {
    const parsed = parseResponseAuto(
      {
        model: "claude-sonnet-4-6",
        content: [{ type: "text", text: "Hi from Claude." }],
        usage: { input_tokens: 5, output_tokens: 4 },
      },
      "fallback",
    );
    expect(parsed.provider).toBe("anthropic");
    expect(parsed.generatedContent).toBe("Hi from Claude.");
    expect(parsed.inputTokens).toBe(5);
  });

  it("detects OpenAI by choices[] + usage.prompt_tokens", () => {
    const parsed = parseResponseAuto(
      {
        model: "gpt-4o-mini",
        choices: [{ message: { content: "Hi from OpenAI." } }],
        usage: { prompt_tokens: 3, completion_tokens: 4 },
      },
      "fallback",
    );
    expect(parsed.provider).toBe("openai");
    expect(parsed.generatedContent).toBe("Hi from OpenAI.");
  });

  it("detects Workers AI by {result, success} envelope", () => {
    const parsed = parseResponseAuto(
      {
        result: { response: "Hello from llama." },
        success: true,
        errors: [],
        messages: [],
      },
      "@cf/meta/llama-3.1-8b-instruct",
    );
    expect(parsed.provider).toBe("workers-ai");
    expect(parsed.generatedContent).toBe("Hello from llama.");
  });

  it("detects Gemini by candidates[]", () => {
    const parsed = parseResponseAuto(
      {
        candidates: [
          { content: { parts: [{ text: "Hello from Gemini." }] } },
        ],
        usageMetadata: { promptTokenCount: 2, candidatesTokenCount: 3 },
      },
      "gemini-2.5-flash",
    );
    expect(parsed.provider).toBe("google-ai-studio");
    expect(parsed.generatedContent).toBe("Hello from Gemini.");
  });

  it("falls back to chain hint when shape is ambiguous", () => {
    // Empty body — no detectable keys. Hint disambiguates.
    const parsed = parseResponseAuto({}, "fallback", ["openai"]);
    expect(parsed.provider).toBe("openai");
  });

  it("throws when no detection AND no hint", () => {
    expect(() => parseResponseAuto({}, "fallback")).toThrow(
      /cannot detect provider/,
    );
  });

  it("does NOT confuse Workers AI envelope with OpenAI when both have choices", () => {
    // Workers AI on the OpenAI-compat path can return {result: {choices...}}
    // — the envelope MUST win over the inner `choices` array.
    const parsed = parseResponseAuto(
      {
        result: {
          choices: [{ message: { content: "Hello." } }],
          usage: { prompt_tokens: 1, completion_tokens: 1 },
        },
        success: true,
        errors: [],
        messages: [],
      },
      "@cf/meta/llama-3.1-8b-instruct",
    );
    expect(parsed.provider).toBe("workers-ai");
    expect(parsed.generatedContent).toBe("Hello.");
  });
});
