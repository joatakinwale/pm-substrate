import { describe, expect, it } from "vitest";
import type { LabAgent } from "./agent.js";
import { LabSessionRunner, armsForMode } from "./session.js";
import { staleObservationScenario } from "./scenarios/stale-observation.js";
import type { World } from "./world.js";

class FakeWorld {
  readonly tenantId = "tnt_lab_session_test";
  readonly observations = new Map<string, unknown[]>();
  events = 0;
  closed = false;
  destroyed = false;

  async observeIntoWorld(key: string, value: unknown): Promise<{ id: string }> {
    const values = this.observations.get(key) ?? [];
    values.push(value);
    this.observations.set(key, values);
    this.events += 1;
    return { id: `evt_${key}_${values.length}` };
  }

  async currentHead(key: string) {
    const values = this.observations.get(key) ?? [];
    if (values.length === 0) return null;
    return {
      key,
      value: values[values.length - 1],
      basisPosition: values.length,
      sourceEventId: `evt_${key}_${values.length}`,
    };
  }

  async positionOfValue(key: string, value: unknown): Promise<number | null> {
    const values = this.observations.get(key) ?? [];
    let position: number | null = null;
    values.forEach((candidate, index) => {
      if (String(candidate) === String(value)) position = index + 1;
    });
    return position;
  }

  async admit(): Promise<{ id: string }> {
    this.events += 1;
    return { id: `evt_action_${this.events}` };
  }

  async verifyChain(): Promise<{ valid: true; checked: number }> {
    return { valid: true, checked: this.events };
  }

  async close(): Promise<void> {
    this.closed = true;
  }

  async destroy(): Promise<void> {
    this.destroyed = true;
    await this.close();
  }
}

class FakeAgent {
  readonly ledger = {
    promptTokens: 4,
    completionTokens: 3,
    totalTokens: 7,
    calls: 2,
  };
  readonly memory = new Map<string, unknown>();

  async perceive(): Promise<string> {
    return "100";
  }

  remember(key: string, value: unknown): void {
    this.memory.set(key, value);
  }

  recall(key: string): unknown {
    return this.memory.get(key);
  }

  async decideAction(): Promise<string> {
    return "ACT AAPL=100";
  }
}

describe("LabSessionRunner", () => {
  it("maps modes to the existing substrate arms", () => {
    expect(armsForMode("no_substrate")).toEqual(["no_substrate"]);
    expect(armsForMode("substrate")).toEqual(["substrate"]);
    expect(armsForMode("ab_pair")).toEqual(["no_substrate", "substrate"]);
  });

  it("runs an A/B local-agent-lab session and emits dashboard-facing events", async () => {
    const emitted: string[] = [];
    let ids = 0;
    const runner = new LabSessionRunner({
      databaseUrl: "postgres://unused",
      model: "test-model",
      now: () => "2026-06-28T00:00:00.000Z",
      idFactory: () => `id_${++ids}`,
      worldFactory: async () => new FakeWorld() as unknown as World,
      agentFactory: () => new FakeAgent() as unknown as LabAgent,
    });
    runner.subscribe((event) => emitted.push(event.type));

    const result = await runner.run({
      objective: "Prove stale private representation cannot become operational state.",
      scenario: staleObservationScenario,
      mode: "ab_pair",
      agentCount: 1,
      injections: [
        {
          id: "inj_file_context",
          type: "file_context",
          prompt: "Use the updated file context.",
          fileRefs: ["src/example.ts"],
        },
      ],
      mutations: [
        {
          id: "mut_stale_price",
          type: "stale_state",
          description: "Move the lab state after observation.",
        },
      ],
    });

    expect(result.status).toBe("completed");
    expect(result.mode).toBe("ab_pair");
    expect(result.agents).toHaveLength(1);
    expect(result.agents[0]?.arms.no_substrate?.result).toBe("fail");
    expect(result.agents[0]?.arms.substrate?.result).toBe("blocked");
    expect(result.agents[0]?.behaviorDiverged).toBe(true);
    expect(result.substrateProtectedCount).toBe(1);
    expect(result.unsafeAdmittedCount).toBe(1);
    expect(result.unsafeBlockedCount).toBe(1);
    expect(emitted).toContain("session_created");
    expect(emitted).toContain("injection_applied");
    expect(emitted).toContain("mutation_created");
    expect(emitted.filter((type) => type === "mutation_applied")).toHaveLength(2);
    expect(emitted).toContain("action_admitted");
    expect(emitted).toContain("action_refused");
    expect(emitted).toContain("oracle_verdict");
    expect(emitted).toContain("arm_diverged");
    expect(emitted.at(-1)).toBe("session_completed");
  });

  it("can run multiple logical agents without changing the scenario engine", async () => {
    const runner = new LabSessionRunner({
      databaseUrl: "postgres://unused",
      model: "test-model",
      worldFactory: async () => new FakeWorld() as unknown as World,
      agentFactory: () => new FakeAgent() as unknown as LabAgent,
    });

    const result = await runner.run({
      objective: "Run the same controlled stale-state test across agents.",
      scenario: staleObservationScenario,
      mode: "substrate",
      agentCount: 3,
    });

    expect(result.agents).toHaveLength(3);
    expect(
      result.agents.every(
        (agent) =>
          agent.arms.substrate?.result === "blocked" &&
          agent.arms.no_substrate === undefined,
      ),
    ).toBe(true);
    expect(result.unsafeBlockedCount).toBe(3);
  });
});
