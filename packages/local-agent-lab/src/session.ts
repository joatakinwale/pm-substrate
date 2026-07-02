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

interface MutableLabSessionAgentResult {
  readonly agentId: string;
  readonly label: string;
  readonly arms: Partial<Record<Arm, ArmRun>>;
  behaviorDiverged: boolean;
}

interface ActiveLabSession {
  readonly sessionId: string;
  readonly title: string;
  readonly request: LabSessionRequest;
  readonly mode: LabSessionMode;
  readonly agents: MutableLabSessionAgentResult[];
  readonly tasks: Set<Promise<void>>;
  nextAgentNumber: number;
}

export class LabSessionRunner {
  readonly #cfg: LabSessionRunnerConfig;
  readonly #listeners = new Set<LabSessionEventListener>();
  readonly #events: LabSessionEvent[] = [];
  readonly #pendingInjections: LabInjection[] = [];
  readonly #pendingMutations: LabMutation[] = [];
  readonly #appliedInjections = new Set<string>();
  readonly #appliedMutations = new Set<string>();
  #active: ActiveLabSession | null = null;
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

  inject(injection: LabInjection): void {
    const active = this.#requireActiveSession("inject into");
    this.#queueInjection(active, injection);
  }

  mutate(mutation: LabMutation): void {
    const active = this.#requireActiveSession("mutate");
    this.#queueMutation(active, mutation);
  }

  addAgent(): LabSessionAgentResult {
    const active = this.#requireActiveSession("add an agent to");
    return this.#startAgent(active, "operator_add_agent");
  }

  async run(request: LabSessionRequest): Promise<LabSessionRun> {
    const sessionId = this.#id("session");
    const mode = request.mode ?? "ab_pair";
    const agentCount = Math.max(1, request.agentCount ?? 1);
    const title = request.title ?? request.scenario.scenarioId;
    const active: ActiveLabSession = {
      sessionId,
      title,
      request,
      mode,
      agents: [],
      tasks: new Set(),
      nextAgentNumber: 0,
    };
    this.#active = active;

    try {
      this.#emit({
        type: "session_created",
        sessionId,
        scenario: request.scenario,
        message: `Local agent lab session created for ${request.scenario.scenarioId}.`,
        payload: { objective: request.objective, mode, agentCount },
      });

      for (const injection of request.injections ?? []) {
        this.#queueInjection(active, injection);
      }
      for (const mutation of request.mutations ?? []) {
        this.#queueMutation(active, mutation);
      }

      for (let i = 0; i < agentCount; i += 1) {
        if (this.#stopped) break;
        this.#startAgent(active, "initial");
      }

      await this.#waitForAgents(active);

      const agents = this.#snapshotAgents(active.agents);
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
    } finally {
      this.#active = null;
    }
  }

  #startAgent(
    active: ActiveLabSession,
    source: "initial" | "operator_add_agent",
  ): LabSessionAgentResult {
    const agentNumber = active.nextAgentNumber + 1;
    active.nextAgentNumber = agentNumber;
    const agent: MutableLabSessionAgentResult = {
      agentId: `${active.sessionId}:agent:${agentNumber}`,
      label: `Agent ${agentNumber}`,
      arms: {},
      behaviorDiverged: false,
    };
    active.agents.push(agent);
    this.#emit({
      type: "agent_started",
      sessionId: active.sessionId,
      scenario: active.request.scenario,
      agentId: agent.agentId,
      message:
        source === "operator_add_agent"
          ? `Operator added Agent ${agentNumber}.`
          : `Agent ${agentNumber} started.`,
      payload: { agentNumber, label: agent.label, source },
    });

    let task!: Promise<void>;
    task = this.#runAgent(active, agent, agentNumber).finally(() => {
      active.tasks.delete(task);
    });
    active.tasks.add(task);
    return this.#snapshotAgent(agent);
  }

  async #runAgent(
    active: ActiveLabSession,
    agent: MutableLabSessionAgentResult,
    agentNumber: number,
  ): Promise<void> {
    for (const arm of armsForMode(active.mode)) {
      if (this.#stopped) break;
      agent.arms[arm] = await this.#runArm({
        sessionId: active.sessionId,
        agentId: agent.agentId,
        spec: active.request.scenario,
        arm,
      });
    }
    agent.behaviorDiverged =
      agent.arms.no_substrate !== undefined &&
      agent.arms.substrate !== undefined &&
      agent.arms.no_substrate.result !== agent.arms.substrate.result;
    if (agent.behaviorDiverged) {
      this.#emit({
        type: "arm_diverged",
        sessionId: active.sessionId,
        scenario: active.request.scenario,
        agentId: agent.agentId,
        message: `Agent ${agentNumber} diverged across substrate arms.`,
        payload: {
          noSubstrateResult: agent.arms.no_substrate?.result,
          substrateResult: agent.arms.substrate?.result,
        },
      });
    }
    this.#emit({
      type: "agent_completed",
      sessionId: active.sessionId,
      scenario: active.request.scenario,
      agentId: agent.agentId,
      message: `Agent ${agentNumber} completed.`,
      payload: this.#snapshotAgent(agent) as unknown as Record<string, unknown>,
    });
  }

  async #waitForAgents(active: ActiveLabSession): Promise<void> {
    while (active.tasks.size > 0) {
      await Promise.race([...active.tasks]);
    }
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

      await this.#applyQueuedControls({
        sessionId: input.sessionId,
        spec: input.spec,
        agentId: input.agentId,
        arm: input.arm,
        ctx,
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

      await this.#applyQueuedControls({
        sessionId: input.sessionId,
        spec: input.spec,
        agentId: input.agentId,
        arm: input.arm,
        ctx,
        observation,
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
        payload: armRun as unknown as Record<string, unknown>,
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

  #queueInjection(active: ActiveLabSession, injection: LabInjection): void {
    const queued: LabInjection = {
      ...injection,
      id: injection.id || this.#id("inj"),
      createdAt: injection.createdAt ?? this.#now(),
    };
    this.#pendingInjections.push(queued);
    this.#emit({
      type: "injection_created",
      sessionId: active.sessionId,
      scenario: active.request.scenario,
      message: `Injection ${queued.id} created.`,
      ...(queued.targetAgentId !== undefined
        ? { agentId: queued.targetAgentId }
        : {}),
      payload: { ...queued },
    });
  }

  #queueMutation(active: ActiveLabSession, mutation: LabMutation): void {
    const queued: LabMutation = {
      ...mutation,
      id: mutation.id || this.#id("mut"),
      createdAt: mutation.createdAt ?? this.#now(),
    };
    this.#pendingMutations.push(queued);
    this.#emit({
      type: "mutation_created",
      sessionId: active.sessionId,
      scenario: active.request.scenario,
      message: `Mutation ${queued.id} created.`,
      ...(queued.targetAgentId !== undefined ? { agentId: queued.targetAgentId } : {}),
      payload: { ...queued },
    });
  }

  async #applyQueuedControls(input: {
    readonly sessionId: string;
    readonly spec: ScenarioSpec;
    readonly agentId: string;
    readonly arm: Arm;
    readonly ctx: ScenarioContext;
    readonly observation: LabSessionEvent["observation"];
  }): Promise<void> {
    if (input.observation === undefined) return;

    for (const injection of this.#pendingInjections) {
      const key = this.#controlApplicationKey(injection.id, input.agentId, input.arm);
      if (this.#appliedInjections.has(key)) continue;
      if (!controlTargetsContext(injection, input.agentId, input.arm)) continue;
      this.#appliedInjections.add(key);
      const injectedValue =
        extractControlValue(injection.prompt, input.observation.key) ??
        nonEmpty(injection.prompt) ??
        nonEmpty(injection.fileRefs?.join(", "));
      if (injectedValue !== undefined) {
        input.ctx.agent.remember(input.observation.key, injectedValue);
      }
      input.ctx.agent.remember(`${input.observation.key}:operator_injection:${injection.id}`, {
        ...injection,
        appliedArm: input.arm,
      });
      this.#emit({
        type: "injection_applied",
        sessionId: input.sessionId,
        scenario: input.spec,
        agentId: input.agentId,
        arm: input.arm,
        message: `Injection ${injection.id} applied to ${input.arm}.`,
        payload: {
          ...injection,
          appliedValue: injectedValue,
        },
      });
    }

    for (const mutation of this.#pendingMutations) {
      const key = this.#controlApplicationKey(mutation.id, input.agentId, input.arm);
      if (this.#appliedMutations.has(key)) continue;
      if (!controlTargetsContext(mutation, input.agentId, input.arm)) continue;
      this.#appliedMutations.add(key);
      const head = await input.ctx.world.currentHead(input.observation.key);
      const mutatedValue =
        extractControlValue(mutation.description, input.observation.key) ??
        deriveMutationValue(head?.value, mutation.type);
      await input.ctx.world.observeIntoWorld(
        input.observation.key,
        mutatedValue,
        "lab.operator.mutation",
      );
      this.#emit({
        type: "mutation_applied",
        sessionId: input.sessionId,
        scenario: input.spec,
        agentId: input.agentId,
        arm: input.arm,
        message: `Mutation ${mutation.id} applied to ${input.arm}.`,
        payload: {
          ...mutation,
          key: input.observation.key,
          value: mutatedValue,
        },
      });
    }
  }

  #controlApplicationKey(id: string, agentId: string, arm: Arm): string {
    return `${id}:${agentId}:${arm}`;
  }

  #snapshotAgents(
    agents: readonly MutableLabSessionAgentResult[],
  ): LabSessionAgentResult[] {
    return agents.map((agent) => this.#snapshotAgent(agent));
  }

  #snapshotAgent(agent: MutableLabSessionAgentResult): LabSessionAgentResult {
    return {
      agentId: agent.agentId,
      label: agent.label,
      arms: { ...agent.arms },
      behaviorDiverged: agent.behaviorDiverged,
    };
  }

  #requireActiveSession(action: string): ActiveLabSession {
    if (!this.#active || this.#stopped) {
      throw new Error(`cannot ${action} a session that is not running`);
    }
    return this.#active;
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

function controlTargetsContext(
  control: { readonly targetAgentId?: string; readonly targetArm?: Arm | "both" },
  agentId: string,
  arm: Arm,
): boolean {
  if (control.targetAgentId !== undefined && control.targetAgentId !== agentId) {
    return false;
  }
  return control.targetArm === undefined || control.targetArm === "both" || control.targetArm === arm;
}

function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function extractControlValue(text: string | undefined, key: string): unknown | undefined {
  const raw = nonEmpty(text);
  if (!raw) return undefined;
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const keyed = raw.match(
    new RegExp(`${escapedKey}\\s*(?:=|:|is|to)\\s*("[^"]+"|'[^']+'|[-+]?\\d+(?:\\.\\d+)?|[A-Za-z0-9_.-]+)`, "i"),
  );
  const generic = raw.match(
    /(?:=|:|is|to|value|price)\s*("[^"]+"|'[^']+'|[-+]?\d+(?:\.\d+)?|[A-Za-z0-9_.-]+)/i,
  );
  const fallbackNumber = raw.match(/[-+]?\d+(?:\.\d+)?/);
  const value = keyed?.[1] ?? generic?.[1] ?? fallbackNumber?.[0];
  if (value === undefined) return undefined;
  return coerceControlValue(value);
}

function coerceControlValue(value: string): unknown {
  const unquoted = value.replace(/^["']|["']$/g, "");
  if (/^[-+]?\d+(?:\.\d+)?$/.test(unquoted)) return Number(unquoted);
  return unquoted;
}

function deriveMutationValue(current: unknown, type: LabMutation["type"]): unknown {
  if (typeof current === "number" && Number.isFinite(current)) return current + 1;
  if (typeof current === "boolean") return !current;
  if (typeof current === "string" && current.length > 0) {
    return `${current}:${type}`;
  }
  return type;
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
