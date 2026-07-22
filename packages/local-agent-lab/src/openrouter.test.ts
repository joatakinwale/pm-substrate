import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenRouterClient } from "./openrouter.js";

function okResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("OpenRouterClient", () => {
  it("maps usage (including cost) into the OllamaResult shape", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      okResponse({
        choices: [{ message: { content: "  130  " } }],
        usage: { prompt_tokens: 21, completion_tokens: 4, total_tokens: 25, cost: 0.000042 },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const client = new OpenRouterClient({ apiKey: "sk-test", model: "openai/gpt-4o-mini" });
    const result = await client.generate("what is the price?");
    expect(result).toEqual({
      text: "130",
      promptTokens: 21,
      completionTokens: 4,
      totalTokens: 25,
      costCredits: 0.000042,
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    const sent = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(sent["model"]).toBe("openai/gpt-4o-mini");
    expect(sent["stream"]).toBe(false);
    expect((init.headers as Record<string, string>)["authorization"]).toBe("Bearer sk-test");
  });

  it("omits costCredits when usage carries no cost and tolerates missing usage", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(okResponse({ choices: [{ message: { content: "ok" } }] })),
    );
    const client = new OpenRouterClient({ apiKey: "sk-test" });
    const result = await client.generate("p");
    expect(result.totalTokens).toBe(0);
    expect("costCredits" in result).toBe(false);
  });

  it("throws a clear error on 402 credits exhausted without retrying", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("payment required", { status: 402 }));
    vi.stubGlobal("fetch", fetchMock);
    const client = new OpenRouterClient({ apiKey: "sk-test" });
    await expect(client.generate("p")).rejects.toThrow(/402 — credits exhausted/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries a 429 (bounded) and then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("slow down", { status: 429, headers: { "retry-after": "0" } }),
      )
      .mockResolvedValueOnce(
        okResponse({
          choices: [{ message: { content: "fine" } }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const client = new OpenRouterClient({ apiKey: "sk-test", maxRetries429: 2 });
    const result = await client.generate("p");
    expect(result.text).toBe("fine");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up after maxRetries429 exhausted", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("slow down", { status: 429, headers: { "retry-after": "0" } }));
    vi.stubGlobal("fetch", fetchMock);
    const client = new OpenRouterClient({ apiKey: "sk-test", maxRetries429: 1 });
    await expect(client.generate("p")).rejects.toThrow(/openrouter generate failed: 429/);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("fails loud when the key is missing, and available() reflects key presence without fetching", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("OPENROUTER_API_KEY", "");
    const noKey = new OpenRouterClient({});
    await expect(noKey.generate("p")).rejects.toThrow(/OPENROUTER_API_KEY is not set/);
    expect(await noKey.available()).toBe(false);
    const withKey = new OpenRouterClient({ apiKey: "sk-test" });
    expect(await withKey.available()).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never falls back to the ollama LOCAL_LAB_MODEL name", () => {
    vi.stubEnv("LOCAL_LAB_MODEL", "llama3.2:3b");
    vi.stubEnv("OPENROUTER_MODEL", "");
    const client = new OpenRouterClient({ apiKey: "sk-test" });
    expect(client.model).toBe("openai/gpt-4o-mini");
    expect(client.provider).toBe("openrouter");
  });
});
