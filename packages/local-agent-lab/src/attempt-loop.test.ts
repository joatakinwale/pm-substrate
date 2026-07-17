import { describe, expect, it } from "vitest";
import type { LabAgent } from "./agent.js";
import { classifyAttemptCause, runArmWithRetries } from "./attempt-loop.js";
import type { LabModelClient } from "./provider.js";
import { staleObservationScenario } from "./scenarios/stale-observation.js";
import type { World } from "./world.js";

const DATABASE_URL = process.env["PM_DATABASE_URL"];
const describeIfDb = DATABASE_URL ? describe : describe.skip;

class FakeWorld {
  readonly tenantId = "tnt_attempt_loop_test";
  readonly observations = new Map<string, unknown[]>();
  events = 0;
  seeds = 0;
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

/**
 * Stateful fake mind: perceives the number embedded in the presented
 * observation, remembers it (the scenario calls remember), and acts from
 * memory — so attempt 1 acts on the stale seed and a retry (which re-observes
 * the moved world) acts on the fresh value. Ledger increments per call so
 * per-attempt deltas are non-trivial.
 */
class FakeAgent {
  readonly ledger = { promptTokens: 0, completionTokens: 0, totalTokens: 0, calls: 0 };
  readonly memory = new Map<string, unknown>();
  readonly alwaysStaleValue: number | undefined;

  constructor(alwaysStaleValue?: number) {
    this.alwaysStaleValue = alwaysStaleValue;
  }

  #tally(): void {
    this.ledger.promptTokens += 4;
    this.ledger.completionTokens += 3;
    this.ledger.totalTokens += 7;
    this.ledger.calls += 1;
  }

  async perceive(_key: string, presented: string): Promise<string> {
    this.#tally();
    if (this.alwaysStaleValue !== undefined) return String(this.alwaysStaleValue);
    const m = presented.match(/([0-9]+(?:\.[0-9]+)?)/);
    return m?.[1] ?? "0";
  }

  remember(key: string, value: unknown): void {
    this.memory.set(key, value);
  }

  recall(key: string): unknown {
    return this.memory.get(key);
  }

  async decideAction(key: string): Promise<string> {
    this.#tally();
    const believed = this.alwaysStaleValue ?? this.memory.get(key);
    return `ACT ${key}=${String(believed)}`;
  }
}

const stubClient: LabModelClient = {
  model: "fake-model",
  provider: "ollama",
  async generate() {
    throw new Error("stub client must not be called when agentFactory is supplied");
  },
  async available() {
    return true;
  },
};

function loopConfig(world: FakeWorld, agent: FakeAgent) {
  return {
    databaseUrl: "postgres://unused/fake",
    client: stubClient,
    worldFactory: async () => world as unknown as World,
    agentFactory: () => agent as unknown as LabAgent,
  };
}

describe("runArmWithRetries", () => {
  it("substrate arm: blocked stale attempt, then fresh re-observe passes", async () => {
    const world = new FakeWorld();
    const agent = new FakeAgent();
    const series = await runArmWithRetries(staleObservationScenario, "substrate", {
      ...loopConfig(world, agent),
      maxAttempts: 3,
    });
    expect(series.attempts.length).toBe(2);
    expect(series.attempts[0]).toMatchObject({
      attemptN: 1,
      result: "blocked",
      admitted: false,
      outcome: "retry",
      cause: "stale_read",
      totalTokens: 14,
    });
    expect(series.attempts[0]?.refusedReason).toContain("stale_basis");
    expect(series.attempts[1]).toMatchObject({
      attemptN: 2,
      result: "pass",
      admitted: true,
      outcome: "success",
      cause: "none",
      totalTokens: 14,
    });
    expect(series).toMatchObject({
      succeeded: true,
      retries: 1,
      totalTokens: 28,
      wastedTokens: 14,
      expectedAdmission: "block",
      provider: "ollama",
      model: "fake-model",
    });
    expect(world.destroyed).toBe(true);
  });

  it("no_substrate arm: stale action is admitted, oracle fails, retry passes", async () => {
    const world = new FakeWorld();
    const agent = new FakeAgent();
    const series = await runArmWithRetries(staleObservationScenario, "no_substrate", {
      ...loopConfig(world, agent),
      maxAttempts: 3,
    });
    expect(series.attempts.length).toBe(2);
    expect(series.attempts[0]).toMatchObject({
      attemptN: 1,
      result: "fail",
      admitted: true,
      outcome: "retry",
      cause: "other",
    });
    expect(series.attempts[1]).toMatchObject({ result: "pass", outcome: "success" });
    expect(series.succeeded).toBe(true);
    expect(series.wastedTokens).toBe(14);
  });

  it("exhausts maxAttempts on a never-converging agent and marks terminal failure", async () => {
    const world = new FakeWorld();
    const agent = new FakeAgent(100);
    const series = await runArmWithRetries(staleObservationScenario, "substrate", {
      ...loopConfig(world, agent),
      maxAttempts: 3,
    });
    expect(series.attempts.length).toBe(3);
    expect(series.attempts.map((a) => a.outcome)).toEqual(["retry", "retry", "failure"]);
    expect(series.succeeded).toBe(false);
    expect(series.wastedTokens).toBe(42);
    expect(series.retries).toBe(2);
  });

  it("clamps maxAttempts to at least 1 and seeds exactly once", async () => {
    const world = new FakeWorld();
    const agent = new FakeAgent(100);
    const series = await runArmWithRetries(staleObservationScenario, "substrate", {
      ...loopConfig(world, agent),
      maxAttempts: 0,
    });
    expect(series.attempts.length).toBe(1);
    expect(series.attempts[0]?.outcome).toBe("failure");
    // seed admits AAPL=100 once; induce admits once; nothing else observed in.
    expect(world.observations.get("AAPL")?.length).toBe(2);
  });

  it("expected-allow control (suppressed induce) passes on attempt 1 with zero retries", async () => {
    const world = new FakeWorld();
    const agent = new FakeAgent();
    const allowControl = {
      ...staleObservationScenario,
      scenarioId: "stale-observation-expected-allow",
      expectedAdmission: "allow" as const,
      async induce(): Promise<void> {
        /* hazard suppressed */
      },
    };
    const series = await runArmWithRetries(allowControl, "substrate", loopConfig(world, agent));
    expect(series.attempts.length).toBe(1);
    expect(series.attempts[0]).toMatchObject({ result: "pass", outcome: "success", cause: "none" });
    expect(series.retries).toBe(0);
    expect(series.expectedAdmission).toBe("allow");
  });

  it("retains the world when retainWorlds is set", async () => {
    const world = new FakeWorld();
    const agent = new FakeAgent();
    await runArmWithRetries(staleObservationScenario, "substrate", {
      ...loopConfig(world, agent),
      retainWorlds: true,
    });
    expect(world.closed).toBe(true);
    expect(world.destroyed).toBe(false);
  });
});

describe("classifyAttemptCause", () => {
  const blocked = (refusedReason: string) =>
    classifyAttemptCause({ result: "blocked", admitted: false, refusedReason });

  it("maps every stale-family prefix to stale_read", () => {
    for (const reason of [
      "stale_basis position=1 < head=2",
      "memory_drift acted value is not the current head",
      "parallel_write_conflict snapshot was superseded",
      "workflow_invalidated plan basis behind head",
      "authority_conflict acted on non-authoritative source",
      "gate code stale_read_ref freshness_window",
    ]) {
      expect(blocked(reason)).toBe("stale_read");
    }
  });

  it("maps contract-family prefixes to contract_violation", () => {
    for (const reason of [
      "capability_contract_violation exceeded declared write limit",
      "missing_required_dependency upstream artifact absent",
      "mapping_rule_required no approved mapping",
      "approval_gate_denied pending owner approval",
      "not_dispatched work item is not assigned",
    ]) {
      expect(blocked(reason)).toBe("contract_violation");
    }
  });

  it("maps unknown blocked reasons and silent baseline failures to other", () => {
    expect(blocked("feedback_disconnection terminal outcome unlinked")).toBe("other");
    expect(blocked("continuity_break session resumed without ledger")).toBe("other");
    expect(classifyAttemptCause({ result: "fail", admitted: true })).toBe("other");
  });

  it("maps pass to none regardless of admission", () => {
    expect(classifyAttemptCause({ result: "pass", admitted: true })).toBe("none");
    expect(classifyAttemptCause({ result: "pass", admitted: false })).toBe("none");
  });
});

describeIfDb("runArmWithRetries against a real world", () => {
  it("runs the stale-observation series with a fake mind and cleans up its tenant", async () => {
    const agent = new FakeAgent();
    const series = await runArmWithRetries(staleObservationScenario, "substrate", {
      databaseUrl: DATABASE_URL as string,
      client: stubClient,
      agentFactory: () => agent as unknown as LabAgent,
      maxAttempts: 3,
    });
    expect(series.succeeded).toBe(true);
    expect(series.attempts[0]?.cause).toBe("stale_read");
    expect(series.retries).toBe(1);
  });
});
