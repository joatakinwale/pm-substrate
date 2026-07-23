/**
 * Provider seam for the lab's "mind". The engine, session runner, and agent
 * consume this structural interface, so any OpenAI-compatible (or local)
 * backend drops in without touching scenarios or the admission discipline.
 *
 * Selection: config wins, then LOCAL_LAB_PROVIDER (ollama | openrouter),
 * then ollama — the free local default. Unknown names fail loud; a silent
 * fallback would quietly change which model produced a run's evidence.
 */

import { OllamaClient, type OllamaResult } from "./ollama.js";
import { OpenRouterClient } from "./openrouter.js";

export type LabProviderName = "ollama" | "openrouter";

export interface LabModelClient {
  readonly model: string;
  readonly provider: LabProviderName;
  generate(prompt: string): Promise<OllamaResult>;
  available(): Promise<boolean>;
}

export interface LabProviderOptions {
  readonly provider?: LabProviderName;
  readonly model?: string;
  readonly temperature?: number;
  readonly seed?: number;
}

export function defaultLabProvider(options: LabProviderOptions = {}): LabModelClient {
  const name = options.provider ?? process.env["LOCAL_LAB_PROVIDER"] ?? "ollama";
  const shared = {
    ...(options.model !== undefined ? { model: options.model } : {}),
    ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
    ...(options.seed !== undefined ? { seed: options.seed } : {}),
  };
  if (name === "ollama") return new OllamaClient(shared);
  if (name === "openrouter") return new OpenRouterClient(shared);
  throw new Error(
    `unknown LOCAL_LAB_PROVIDER "${name}" — expected "ollama" or "openrouter"`,
  );
}
