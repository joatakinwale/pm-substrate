import { randomUUID } from "node:crypto";
import type { Timestamp } from "@pm/types";
import { LabAgent } from "./agent.js";
import {
  buildLocalAgentLabActionOutcomeEnvelope,
  defaultLocalAgentLabActionOutcomeAuthorityProvider,
  type ArmRun,
  type LocalAgentLabActionOutcomeAuthorityProvider,
} from "./engine.js";
import type { LabInjection } from "./injection.js";
import type { LabMutation } from "./mutation.js";
import { OllamaClient } from "./ollama.js";
import type { Arm, ScenarioContext, ScenarioSpec } from "./scenario.js";
import type {
  LabSessionEvent,
  LabSessionEventListener,
  LabSessionMode,
  LabSessionStatus,
} from "./session-events.js";
import { World } from "./world.js";

export interface LabSessionRequest {
  readonly objective: string;
  readonly scenario: ScenarioSpec;
  readonly mode?: LabSessionMode;
  readonly agentCount?: number;
  readonly title?: string;
  readonly injections?: readonly LabInjection[];
  readonly mutations?: readonly LabMutation[];
}

export interface LabSessionRunnerConfig {
  readonly databaseUrl: string;
  readonly ollama?: OllamaClient;
  readonly model?: string;
  readonly retainWorlds?: boolean;
  readonly worldFactory?: () => Promise<World>;
  readonly agentFactory?: () => LabAgent;
  readonly now?: () => string;
  readonly idFactory?: () => string;
  readonly actionOutcomeAuthorityProvider?: LocalAgentLabActionOutcomeAuthorityProvider;
}

export interface LabSessionAgentResult {
  readonly agentId: string;
  readonly label: string;
  readonly arms: Partial<Record<Arm, ArmRun>>;
  readonly behaviorDiverged: boolean;
}

export interface LabSessionRun {
  readonly sessionId: string;
  readonly title: string;
  readonly objective: string;
  readonly scenarioId: string;
  readonly failureClass: string;
  readonly mode: LabSessionMode;
  readonly status: LabSessionStatus;
  readonly model: string;
  readonly agents: readonly LabSessionAgentResult[];
  readonly events: readonly LabSessionEvent[];
  readonly substrateProtectedCount: number;
  readonly unsafeAdmittedCount: number;
  readonly unsafeBlockedCount: number;
}

export class LabSessionRunner {
  readonly #cfg: LabSessionRunnerConfig;
  readonly #listeners = new Set<LabSessionEventListener>();
  readonly #events: LabSessionEvent[] = [];
  #stopped = false;
  #stopReason = "stopped";

  constructor(cfg: LabSessionRunnerConfig) {
    this.#cfg = cfg;
  }

  get events(): readonly LabSessionEvent[] {
    return this.#events;
  }

  subscribe(listener: LabSessionEventListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  stop(reason = "operator stopped session"): void {
    this.#stopped = true;
    this.#stopReason = reason;
  }

  async run(request: LabSessionRequest): Promise<LabSessionRun> {
    const sessionId = this.#id("session");
    const mode = request.mode ?? "ab_pair";
    const agentCount = Math.max(1, request.agentCount ?? 1);
    const title = request.title ?? request.scenario.scenarioId;
    const agents: LabSessionAgentResult[] = [];

    this.#emit({
      type: "session_created",
      sessionId,
      scenario: request.scenario,
      message: `Local agent lab session created for ${request.scenario.scenarioId}.`,
      payload: { objective: request.objective, mode, agentCount },
    });

    this.#emitInjections(sessionId, request);
    this.#emitMutations(sessionId, request);

    for (let i = 0; i < agentCount; i += 1) {
      if (this.#stopped) break;
      const agentId = `${sessionId}:agent:${i + 1}`;
      this.#emit({
        type: "agent_started",
        sessionId,
        scenario: request.scenario,
        agentId,
        message: `Agent ${i + 1} started.`,
      });
      const arms: Partial<Record<Arm, ArmRun>> = {};
      for (const arm of armsForMode(mode)) {
        if (this.#stopped) break;
        arms[arm] = await this.#runArm({ sessionId, agentId, spec: request.scenario, arm });
      }
      const behaviorDiverged =
        arms.no_substrate !== undefined &&
        arms.substrate !== undefined &&
        arms.no_substrate.result !== arms.substrate.result;
      if (behaviorDiverged) {
        this.#emit({
          type: "arm_diverged",
          sessionId,
          scenario: request.scenario,
          agentId,
          message: `Agent ${i + 1} diverged across substrate arms.`,
          payload: {
            noSubstrateResult: arms.no_substrate?.result,
            substrateResult: arms.substrate?.result,
          },
        });
      }
      agents.push({
        agentId,
        label: `Agent ${i + 1}`,
        arms,
        behaviorDiverged,
      });
    }

    const status: LabSessionStatus = this.#stopped ? "stopped" : "completed";
    this.#emit({
      type: this.#stopped ? "session_stopped" : "session_completed",
      sessionId,
      scenario: request.scenario,
      message: this.#stopped ? this.#stopReason : "Local agent lab session completed.",
    });

    return {
      sessionId,
      title,
      objective: request.objective,
      scenarioId: request.scenario.scenarioId,
      failureClass: request.scenario.failureClass,
      mode,
      status,
      model: this.#cfg.model ?? this.#cfg.ollama?.model ?? "unknown",
      agents,
      events: [...this.#events],
      substrateProtectedCount: agents.filter(
        (agent) =>
          agent.arms.no_substrate?.result === "fail" &&
          agent.arms.substrate?.result !== "fail",
      ).length,
      unsafeAdmittedCount: agents.reduce(
        (count, agent) =>
          count +
          Object.values(agent.arms).filter((run) => run?.result === "fail").length,
        0,
      ),
      unsafeBlockedCount: agents.reduce(
        (count, agent) =>
          count +
          Object.values(agent.arms).filter((run) => run?.result === "blocked").length,
        0,
      ),
    };
  }

  async #runArm(input: {
    readonly sessionId: string;
    readonly agentId: string;
    readonly spec: ScenarioSpec;
    readonly arm: Arm;
  }): Promise<ArmRun> {
    const world = await (this.#cfg.worldFactory?.() ?? World.create(this.#cfg.databaseUrl));
    const agent = this.#cfg.agentFactory?.() ?? new LabAgent(this.#cfg.ollama ?? new OllamaClient());
    const ctx: ScenarioContext = { world, agent, arm: input.arm };

    this.#emit({
      type: "arm_started",
      sessionId: input.sessionId,
      scenario: input.spec,
      agentId: input.agentId,
      arm: input.arm,
      message: `${input.arm} arm started.`,
    });

    try {
      await input.spec.seed(ctx);
      this.#emit({
        type: "world_seeded",
        sessionId: input.sessionId,
        scenario: input.spec,
        agentId: input.agentId,
        arm: input.arm,
        message: `${input.arm} world seeded.`,
      });

      const observation = await input.spec.observe(ctx);
      this.#emit({
        type: "agent_observed",
        sessionId: input.sessionId,
        scenario: input.spec,
        agentId: input.agentId,
        arm: input.arm,
        message: `${input.arm} agent observed ${observation.key}.`,
        observation,
      });
      this.#emit({
        type: "representation_stored",
        sessionId: input.sessionId,
        scenario: input.spec,
        agentId: input.agentId,
        arm: input.arm,
        message: `${input.arm} agent stored a private representation.`,
        observation,
      });

      await input.spec.induce(ctx);
      this.#emit({
        type: "mutation_applied",
        sessionId: input.sessionId,
        scenario: input.spec,
        agentId: input.agentId,
        arm: input.arm,
        message: `${input.arm} lab mutation applied after observation.`,
        payload: { source: "scenario.induce" },
      });

      const action = await input.spec.act(ctx, observation);
      this.#emit({
        type: "action_proposed",
        sessionId: input.sessionId,
        scenario: input.spec,
        agentId: input.agentId,
        arm: input.arm,
        message: `${input.arm} agent proposed an action.`,
        action,
      });
      this.#emit({
        type: "unsafe_action_attempted",
        sessionId: input.sessionId,
        scenario: input.spec,
        agentId: input.agentId,
        arm: input.arm,
        message: `${input.arm} action reached the admission boundary.`,
        action,
      });

      const outcome = await input.spec.admit(ctx, action);
      this.#emit({
        type: outcome.admitted ? "action_admitted" : "action_refused",
        sessionId: input.sessionId,
        scenario: input.spec,
        agentId: input.agentId,
        arm: input.arm,
        message: outcome.admitted
          ? `${input.arm} action admitted as operational state.`
          : `${input.arm} action refused at the admission boundary.`,
        action,
        payload: {
          admitted: outcome.admitted,
          admittedEventId: outcome.admittedEventId,
          refusedReason: outcome.refusedReason,
        },
      });

      const result = await input.spec.oracle(ctx, action, outcome);
      this.#emit({
        type: "oracle_verdict",
        sessionId: input.sessionId,
        scenario: input.spec,
        agentId: input.agentId,
        arm: input.arm,
        message: `${input.arm} oracle verdict: ${result}.`,
        action,
        result,
      });

      const actionOutcomeEnvelope = buildLocalAgentLabActionOutcomeEnvelope({
        spec: input.spec,
        arm: input.arm,
        tenantId: world.tenantId,
        decidedAt: this.#now() as Timestamp,
        observation,
        action,
        outcome,
        result,
        authorityProvider:
          this.#cfg.actionOutcomeAuthorityProvider ??
          defaultLocalAgentLabActionOutcomeAuthorityProvider,
      });
      const chain = await world.verifyChain();
      const armRun: ArmRun = {
        arm: input.arm,
        result,
        actedValue: action.actedValue,
        admitted: outcome.admitted,
        ...(outcome.refusedReason !== undefined
          ? { refusedReason: outcome.refusedReason }
          : {}),
        tokens: agent.ledger.totalTokens,
        admittedTransitions: chain.checked ?? 0,
        chainValid: chain.valid === true,
        actionOutcomeEnvelope,
      };
      this.#emit({
        type: "arm_completed",
        sessionId: input.sessionId,
        scenario: input.spec,
        agentId: input.agentId,
        arm: input.arm,
        message: `${input.arm} arm completed.`,
        result,
      });
      return armRun;
    } finally {
      if (this.#cfg.retainWorlds === true) {
        await world.close();
      } else {
        await world.destroy();
      }
    }
  }

  #emitInjections(sessionId: string, request: LabSessionRequest): void {
    for (const injection of request.injections ?? []) {
      this.#emit({
        type: "injection_created",
        sessionId,
        scenario: request.scenario,
        message: `Injection ${injection.id} created.`,
        ...(injection.targetAgentId !== undefined
          ? { agentId: injection.targetAgentId }
          : {}),
        payload: { ...injection },
      });
      this.#emit({
        type: "injection_applied",
        sessionId,
        scenario: request.scenario,
        message: `Injection ${injection.id} applied to the lab session.`,
        ...(injection.targetAgentId !== undefined
          ? { agentId: injection.targetAgentId }
          : {}),
        payload: { ...injection },
      });
    }
  }

  #emitMutations(sessionId: string, request: LabSessionRequest): void {
    for (const mutation of request.mutations ?? []) {
      this.#emit({
        type: "mutation_created",
        sessionId,
        scenario: request.scenario,
        message: `Mutation ${mutation.id} created.`,
        ...(mutation.targetAgentId !== undefined
          ? { agentId: mutation.targetAgentId }
          : {}),
        payload: { ...mutation },
      });
    }
  }

  #emit(input: {
    readonly type: LabSessionEvent["type"];
    readonly sessionId: string;
    readonly scenario: Pick<ScenarioSpec, "scenarioId" | "failureClass">;
    readonly message: string;
    readonly agentId?: string;
    readonly arm?: Arm;
    readonly observation?: LabSessionEvent["observation"];
    readonly action?: LabSessionEvent["action"];
    readonly result?: LabSessionEvent["result"];
    readonly payload?: LabSessionEvent["payload"];
  }): void {
    const event: LabSessionEvent = {
      id: this.#id("event"),
      type: input.type,
      sessionId: input.sessionId,
      scenarioId: input.scenario.scenarioId,
      failureClass: input.scenario.failureClass,
      occurredAt: this.#now(),
      message: input.message,
      ...(input.agentId !== undefined ? { agentId: input.agentId } : {}),
      ...(input.arm !== undefined ? { arm: input.arm } : {}),
      ...(input.observation !== undefined ? { observation: input.observation } : {}),
      ...(input.action !== undefined ? { action: input.action } : {}),
      ...(input.result !== undefined ? { result: input.result } : {}),
      ...(input.payload !== undefined ? { payload: input.payload } : {}),
    };
    this.#events.push(event);
    for (const listener of this.#listeners) listener(event);
  }

  #id(prefix: string): string {
    return this.#cfg.idFactory?.() ?? `${prefix}_${randomUUID()}`;
  }

  #now(): string {
    return this.#cfg.now?.() ?? new Date().toISOString();
  }
}

export async function runLabSession(
  request: LabSessionRequest,
  cfg: LabSessionRunnerConfig,
): Promise<LabSessionRun> {
  return new LabSessionRunner(cfg).run(request);
}

export function armsForMode(mode: LabSessionMode): readonly Arm[] {
  if (mode === "substrate") return ["substrate"];
  if (mode === "no_substrate") return ["no_substrate"];
  return ["no_substrate", "substrate"];
}
