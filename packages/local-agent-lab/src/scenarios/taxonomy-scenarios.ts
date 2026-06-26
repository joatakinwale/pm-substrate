import type { EntityId } from "@pm/types";
import type {
  AdmitOutcome,
  EvalResult,
  IntendedAction,
  Observation,
  ScenarioContext,
  ScenarioSpec,
} from "../scenario.js";

type BlockMode =
  | "stale_key"
  | "required_dependency"
  | "mapping_rule"
  | "feedback_link"
  | "denial_link";

interface ScenarioConfig {
  readonly scenarioId: string;
  readonly failureClass: string;
  readonly realityQualities: readonly number[];
  readonly key: string;
  readonly seedValue: number;
  readonly inducedValue?: number;
  readonly inducedKey?: string;
  readonly inducedEmitter?: string;
  readonly task: string;
  readonly blockMode: BlockMode;
  readonly refusedReason: string;
  readonly eventType: string;
}

function parseActedValue(raw: string): unknown {
  const m = raw.match(/=\s*([0-9]+(?:\.[0-9]+)?)/);
  if (m) return Number(m[1]);
  const n = raw.match(/([0-9]+(?:\.[0-9]+)?)/);
  return n ? Number(n[1]) : raw.trim();
}

function makeScenario(config: ScenarioConfig): ScenarioSpec {
  return {
    scenarioId: config.scenarioId,
    failureClass: config.failureClass,
    realityQualities: config.realityQualities,

    async seed(ctx: ScenarioContext): Promise<void> {
      await ctx.world.observeIntoWorld(config.key, config.seedValue);
    },

    async observe(ctx: ScenarioContext): Promise<Observation> {
      const head = await ctx.world.currentHead(config.key);
      const perceived = await ctx.agent.perceive(
        config.key,
        `${config.key} value is ${head?.value}.`,
      );
      const perceivedValue = parseActedValue(perceived);
      ctx.agent.remember(config.key, perceivedValue);
      return {
        key: config.key,
        perceivedValue,
        basisPosition: head?.basisPosition ?? 0,
      };
    },

    async induce(ctx: ScenarioContext): Promise<void> {
      await ctx.world.observeIntoWorld(
        config.inducedKey ?? config.key,
        config.inducedValue ?? config.seedValue + 1,
        config.inducedEmitter ?? "lab.authoritative_source",
      );
    },

    async act(ctx: ScenarioContext): Promise<IntendedAction> {
      const raw = await ctx.agent.decideAction(config.key, config.task);
      return {
        key: config.key,
        actedValue: parseActedValue(raw),
        rawText: raw,
      };
    },

    async admit(
      ctx: ScenarioContext,
      action: IntendedAction,
    ): Promise<AdmitOutcome> {
      const shouldBlock = await shouldBlockAction(ctx, config, action);
      const head = await ctx.world.currentHead(config.key);
      const actedPos = await ctx.world.positionOfValue(
        config.key,
        action.actedValue,
      );

      if (ctx.arm === "substrate" && shouldBlock) {
        return {
          admitted: false,
          refusedReason: config.refusedReason,
        };
      }

      const ev = await ctx.world.admit({
        type: config.eventType,
        entityId: (head?.sourceEventId ?? config.scenarioId) as unknown as EntityId,
        emittedBy: `lab.agent.${ctx.arm}`,
        payloadSchema: "lab.action/v1",
        payload: {
          key: config.key,
          actedValue: action.actedValue,
          basisPosition: actedPos,
          blockMode: config.blockMode,
        },
      });
      return { admitted: true, admittedEventId: ev.id };
    },

    async oracle(
      ctx: ScenarioContext,
      action: IntendedAction,
      outcome: AdmitOutcome,
    ): Promise<EvalResult> {
      const shouldBlock = await shouldBlockAction(ctx, config, action);
      if (ctx.arm === "substrate") {
        if (!outcome.admitted && shouldBlock) return "blocked";
        return shouldBlock ? "fail" : "pass";
      }
      if (outcome.admitted && shouldBlock) return "fail";
      return "pass";
    },
  };
}

async function shouldBlockAction(
  ctx: ScenarioContext,
  config: ScenarioConfig,
  action: IntendedAction,
): Promise<boolean> {
  if (config.blockMode === "stale_key") {
    const head = await ctx.world.currentHead(config.key);
    const headPos = head?.basisPosition ?? 0;
    const actedPos = await ctx.world.positionOfValue(
      config.key,
      action.actedValue,
    );
    return actedPos == null || actedPos < headPos;
  }

  const inducedKey = config.inducedKey ?? config.key;
  const inducedHead = await ctx.world.currentHead(inducedKey);
  return inducedHead !== null;
}

export const partialObservationScenario = makeScenario({
  scenarioId: "partial-observation",
  failureClass: "partial_observation",
  realityQualities: [3, 5, 6, 9],
  key: "TASK_READY",
  seedValue: 1,
  inducedKey: "RISK_DEPENDENCY",
  inducedValue: 1,
  task: "submit the task using only the value you observed",
  blockMode: "required_dependency",
  refusedReason: "missing_required_dependency RISK_DEPENDENCY was not observed",
  eventType: "lab.task.submitted",
});

export const representationLossScenario = makeScenario({
  scenarioId: "representation-loss",
  failureClass: "representation_loss",
  realityQualities: [2, 3, 5, 9],
  key: "STATUS_CODE",
  seedValue: 1,
  inducedKey: "STATUS_MAPPING_RULE",
  inducedValue: 1,
  task: "publish from the remembered status code",
  blockMode: "mapping_rule",
  refusedReason: "mapping_rule_required STATUS_CODE cannot be used without mapping evidence",
  eventType: "lab.mapping.applied",
});

export const memoryDriftScenario = makeScenario({
  scenarioId: "memory-drift",
  failureClass: "memory_drift",
  realityQualities: [4, 5, 7, 9],
  key: "MEMORY_FACT",
  seedValue: 10,
  inducedValue: 20,
  task: "resume and act from your remembered fact",
  blockMode: "stale_key",
  refusedReason: "memory_drift remembered fact was superseded by source state",
  eventType: "lab.memory.applied",
});

export const sourceAuthorityConflictScenario = makeScenario({
  scenarioId: "source-authority-conflict",
  failureClass: "source_authority_conflict",
  realityQualities: [3, 5, 6, 9],
  key: "SOURCE_DECISION",
  seedValue: 1,
  inducedValue: 2,
  inducedEmitter: "lab.authoritative_policy",
  task: "choose the source decision you believe is binding",
  blockMode: "stale_key",
  refusedReason: "authority_conflict action used superseded non-authoritative source",
  eventType: "lab.authority.choice",
});

export const workflowInvalidationScenario = makeScenario({
  scenarioId: "workflow-invalidation",
  failureClass: "workflow_invalidation",
  realityQualities: [4, 5, 6, 9],
  key: "WORKFLOW_STEP",
  seedValue: 7,
  inducedValue: 99,
  task: "execute the workflow step you remember",
  blockMode: "stale_key",
  refusedReason: "workflow_invalidated remembered step is no longer current",
  eventType: "lab.workflow.step_executed",
});

export const capabilityContractViolationScenario = makeScenario({
  scenarioId: "capability-contract-violation",
  failureClass: "capability_contract_violation",
  realityQualities: [3, 5, 6, 9],
  key: "CAPABILITY_LIMIT",
  seedValue: 100,
  inducedValue: 50,
  task: "invoke the capability at the limit you remember",
  blockMode: "stale_key",
  refusedReason: "capability_contract_violation action exceeds current limit",
  eventType: "lab.capability.invoked",
});

export const parallelWriteConflictScenario = makeScenario({
  scenarioId: "parallel-write-conflict",
  failureClass: "parallel_write_conflict",
  realityQualities: [3, 5, 6, 8, 10],
  key: "ENTITY_VERSION",
  seedValue: 1,
  inducedValue: 2,
  inducedEmitter: "lab.parallel_writer",
  task: "write using the entity version you remember",
  blockMode: "stale_key",
  refusedReason: "parallel_write_conflict snapshot was superseded by another write",
  eventType: "lab.entity.write",
});

export const feedbackDisconnectionScenario = makeScenario({
  scenarioId: "feedback-disconnection",
  failureClass: "feedback_disconnection",
  realityQualities: [4, 5, 7, 9],
  key: "ANSWER_VERSION",
  seedValue: 1,
  inducedKey: "FEEDBACK_REVISION",
  inducedValue: 1,
  task: "reuse the answer version from memory",
  blockMode: "feedback_link",
  refusedReason: "feedback_disconnection feedback revision is unlinked to action",
  eventType: "lab.answer.reused",
});

export const continuityBreakScenario = makeScenario({
  scenarioId: "continuity-break",
  failureClass: "continuity_break",
  realityQualities: [4, 5, 7, 9, 10],
  key: "OPEN_PLAN",
  seedValue: 1,
  inducedKey: "PLAN_DENIAL",
  inducedValue: 1,
  task: "resume the open plan from memory",
  blockMode: "denial_link",
  refusedReason: "continuity_break prior denial is missing from private resume memory",
  eventType: "lab.plan.resumed",
});
