/**
 * OpenRouter client for the local-agent lab — lets the same lab scenarios run
 * against many hosted models (OpenAI-compatible /chat/completions) instead of
 * only local Ollama.
 *
 * Returns the same shape as OllamaClient.generate so the LabAgent is
 * provider-blind, plus `costCredits` from OpenRouter's always-included usage
 * accounting (usage.cost, denominated in OpenRouter credits).
 *
 * Deliberate non-fallback: the default model does NOT read LOCAL_LAB_MODEL —
 * that env carries Ollama-style names ("llama3.2:3b") which would 404 against
 * OpenRouter's "vendor/model" namespace. Use OPENROUTER_MODEL or config.model.
 */

import type { OllamaResult } from "./ollama.js";

export interface OpenRouterConfig {
  readonly apiKey?: string;
  readonly baseUrl?: string;
  readonly model?: string;
  /** Deterministic by default so runs are reproducible (provider permitting). */
  readonly temperature?: number;
  readonly seed?: number;
  /** Bounded retries for 429 responses; other errors never retry. */
  readonly maxRetries429?: number;
}

const DEFAULT_BASE = "https://openrouter.ai/api/v1";
const DEFAULT_MODEL = "openai/gpt-4o-mini";
const MAX_RETRY_AFTER_MS = 15_000;

export class OpenRouterClient {
  readonly #apiKey: string | undefined;
  readonly #baseUrl: string;
  readonly #model: string;
  readonly #temperature: number;
  readonly #seed: number;
  readonly #maxRetries429: number;

  constructor(config: OpenRouterConfig = {}) {
    const envOr = (name: string): string | undefined => {
      const value = process.env[name];
      return value !== undefined && value.length > 0 ? value : undefined;
    };
    this.#apiKey = config.apiKey ?? envOr("OPENROUTER_API_KEY");
    this.#baseUrl = config.baseUrl ?? envOr("OPENROUTER_BASE_URL") ?? DEFAULT_BASE;
    this.#model = config.model ?? envOr("OPENROUTER_MODEL") ?? DEFAULT_MODEL;
    this.#temperature = config.temperature ?? 0;
    this.#seed = config.seed ?? 7;
    this.#maxRetries429 = config.maxRetries429 ?? 2;
  }

  get model(): string {
    return this.#model;
  }

  get provider(): "openrouter" {
    return "openrouter";
  }

  /** Single-turn generation. Throws on transport / non-2xx / missing key. */
  async generate(prompt: string): Promise<OllamaResult> {
    if (this.#apiKey === undefined || this.#apiKey.length === 0) {
      throw new Error("OPENROUTER_API_KEY is not set");
    }
    let attempt = 0;
    let networkRetries = 0;
    for (;;) {
      let res: Response;
      try {
        res = await fetch(`${this.#baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            authorization: `Bearer ${this.#apiKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: this.#model,
            messages: [{ role: "user", content: prompt }],
            temperature: this.#temperature,
            seed: this.#seed,
            stream: false,
          }),
        });
      } catch (error) {
        // Transient transport kills ("terminated", "fetch failed") get one
        // bounded retry; a 96-series run must not die to a single dropped
        // connection. Anything persistent still fails loud.
        if (networkRetries < 2) {
          networkRetries += 1;
          await new Promise((resolveWait) => setTimeout(resolveWait, 750 * networkRetries));
          continue;
        }
        throw error;
      }
      if (res.status === 429 && attempt < this.#maxRetries429) {
        attempt += 1;
        const retryAfterSeconds = Number(res.headers.get("retry-after") ?? "1");
        const waitMs = Math.min(
          Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0 ? retryAfterSeconds * 1000 : 1000,
          MAX_RETRY_AFTER_MS,
        );
        await new Promise((resolveWait) => setTimeout(resolveWait, waitMs));
        continue;
      }
      if (res.status === 402) {
        throw new Error("openrouter generate failed: 402 — credits exhausted; top up at openrouter.ai");
      }
      if (!res.ok) {
        throw new Error(`openrouter generate failed: ${res.status} ${(await res.text()).slice(0, 300)}`);
      }
      const body = (await res.json()) as {
        choices?: ReadonlyArray<{ message?: { content?: string } }>;
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
          cost?: number;
        };
      };
      const promptTokens = body.usage?.prompt_tokens ?? 0;
      const completionTokens = body.usage?.completion_tokens ?? 0;
      const cost = body.usage?.cost;
      return {
        text: (body.choices?.[0]?.message?.content ?? "").trim(),
        promptTokens,
        completionTokens,
        totalTokens: body.usage?.total_tokens ?? promptTokens + completionTokens,
        ...(cost !== undefined ? { costCredits: cost } : {}),
      };
    }
  }

  /** Key presence only — no credit-burning network probe. */
  async available(): Promise<boolean> {
    return this.#apiKey !== undefined && this.#apiKey.length > 0;
  }
}
