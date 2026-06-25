/**
 * Minimal Ollama client for the local-agent lab.
 *
 * Dependency-free (Node >= 18 global fetch). Calls the local Ollama daemon
 * (default http://localhost:11434). Returns the completion text AND token
 * telemetry — token counts are first-class because one of the thesis's
 * measurable claims (Emmanuel, 2026-06-24) is that a real state layer reduces
 * the tokens an agent spends RECONSTRUCTING state. We can only test that if we
 * count tokens per arm.
 *
 * NOTE: this is the agent's "mind". It is identical across both arms — the only
 * thing that differs between Arm A and Arm B is where state comes from and
 * whether the action is admitted. The model is never asked to police itself.
 */

export interface OllamaConfig {
  readonly baseUrl?: string;
  readonly model?: string;
  /** Deterministic by default so runs are reproducible. */
  readonly temperature?: number;
  readonly seed?: number;
}

export interface OllamaResult {
  readonly text: string;
  /** Tokens the model read (prompt) + produced (completion). */
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly totalTokens: number;
}

const DEFAULT_BASE = "http://localhost:11434";
const DEFAULT_MODEL = "llama3.2:3b";

export class OllamaClient {
  readonly #baseUrl: string;
  readonly #model: string;
  readonly #temperature: number;
  readonly #seed: number;

  constructor(config: OllamaConfig = {}) {
    this.#baseUrl = config.baseUrl ?? process.env["OLLAMA_BASE_URL"] ?? DEFAULT_BASE;
    this.#model = config.model ?? process.env["LOCAL_LAB_MODEL"] ?? DEFAULT_MODEL;
    this.#temperature = config.temperature ?? 0;
    this.#seed = config.seed ?? 7;
  }

  get model(): string {
    return this.#model;
  }

  /** Single-turn generation. Throws on transport / non-2xx. */
  async generate(prompt: string): Promise<OllamaResult> {
    const res = await fetch(`${this.#baseUrl}/api/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: this.#model,
        prompt,
        stream: false,
        options: { temperature: this.#temperature, seed: this.#seed },
      }),
    });
    if (!res.ok) {
      throw new Error(`ollama generate failed: ${res.status} ${await res.text()}`);
    }
    const body = (await res.json()) as {
      response?: string;
      prompt_eval_count?: number;
      eval_count?: number;
    };
    const promptTokens = body.prompt_eval_count ?? 0;
    const completionTokens = body.eval_count ?? 0;
    return {
      text: (body.response ?? "").trim(),
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
    };
  }

  /** Liveness probe so a suite can skip cleanly when Ollama is down. */
  async available(): Promise<boolean> {
    try {
      const res = await fetch(`${this.#baseUrl}/api/tags`);
      return res.ok;
    } catch {
      return false;
    }
  }
}
