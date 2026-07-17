/**
 * LabAgent — the minimal real agent loop: observe → represent(memory) → plan →
 * act, backed by Ollama. IDENTICAL across both arms. The agent has its own
 * private memory (a plain map) — this is the REPRESENTATION layer that reality
 * does not have (quality #1). In Arm A the agent acts straight from this
 * memory; in Arm B the scenario resolves the authoritative head before
 * admitting, so the agent's stale memory cannot become operational state.
 *
 * The agent is never asked to police its own staleness. That would smuggle the
 * substrate's job into the thing under test. The model only perceives and
 * decides; the substrate (Arm B) or its absence (Arm A) decides what becomes
 * real.
 */

import type { LabModelClient } from "./provider.js";

export interface AgentTokenLedger {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  calls: number;
  /** Provider-reported spend, when the backend bills per call (OpenRouter). */
  costCredits?: number;
}

export class LabAgent {
  readonly #ollama: LabModelClient;
  /** The agent's private representation of the world. Not authority. */
  readonly #memory = new Map<string, unknown>();
  readonly ledger: AgentTokenLedger = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    calls: 0,
  };

  constructor(ollama: LabModelClient) {
    this.#ollama = ollama;
  }

  remember(key: string, value: unknown): void {
    this.#memory.set(key, value);
  }

  recall(key: string): unknown {
    return this.#memory.get(key);
  }

  /** Ask the model to read a value out of a presented observation. */
  async perceive(key: string, presented: string): Promise<string> {
    const prompt =
      `You are a data agent. You are shown an observation. ` +
      `Extract ONLY the current value of "${key}" as a bare number or word, ` +
      `no units, no sentence.\n\nObservation:\n${presented}\n\nValue:`;
    const r = await this.#ollama.generate(prompt);
    this.#tally(r);
    return r.text;
  }

  /**
   * Ask the model to decide an action from what it currently believes (memory).
   * The model is NOT given the live world — only its own remembered value. This
   * is the crux: a real model acting from a representation.
   */
  async decideAction(key: string, task: string): Promise<string> {
    const believed = this.#memory.get(key);
    const prompt =
      `You are an execution agent. Task: ${task}\n` +
      `Your current knowledge: ${key} = ${String(believed)}.\n` +
      `Respond with a single line of the form: ACT ${key}=<value> ` +
      `where <value> is the value you will act on.`;
    const r = await this.#ollama.generate(prompt);
    this.#tally(r);
    return r.text;
  }

  #tally(r: { promptTokens: number; completionTokens: number; totalTokens: number; costCredits?: number }): void {
    this.ledger.promptTokens += r.promptTokens;
    this.ledger.completionTokens += r.completionTokens;
    this.ledger.totalTokens += r.totalTokens;
    this.ledger.calls += 1;
    if (r.costCredits !== undefined) {
      this.ledger.costCredits = (this.ledger.costCredits ?? 0) + r.costCredits;
    }
  }
}
