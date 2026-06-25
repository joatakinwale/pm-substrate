/**
 * Engine — runs a ScenarioSpec across both arms against fresh hermetic worlds
 * and produces a paired result with metrics derived from the admitted log +
 * token ledgers. NOTHING is hardcoded: the verdict comes from each spec's
 * oracle reading the real event store.
 *
 * One run = one scenario × {no_substrate, substrate}. A suite runs many specs.
 */

import { createHash } from "node:crypto";
import {
  buildActionOutcomeEnvelope,
  stateRef,
  type ActionOutcomeEnvelope,
} from "@pm/agent-state";
import type { Timestamp } from "@pm/types";
import { World } from "./world.js";
import { LabAgent } from "./agent.js";
import { OllamaClient } from "./ollama.js";
import type {
  AdmitOutcome,
  Arm,
  EvalResult,
  IntendedAction,
  Observation,
  ScenarioSpec,
} from "./scenario.js";

export interface ArmRun {
  readonly arm: Arm;
  readonly result: EvalResult;
  readonly actedValue: unknown;
  readonly admitted: boolean;
  readonly refusedReason?: string;
  readonly tokens: number;
  readonly admittedTransitions: number;
  readonly chainValid: boolean;
  readonly actionOutcomeEnvelope?: ActionOutcomeEnvelope;
}

export interface ScenarioRun {
  readonly scenarioId: string;
  readonly failureClass: string;
  readonly realityQualities: readonly number[];
  readonly model: string;
  readonly arms: Readonly<Record<Arm, ArmRun>>;
  readonly actionOutcomeEnvelopes: readonly ActionOutcomeEnvelope[];
  /** True iff the two arms genuinely diverged in behavior (the falsifiable bit). */
  readonly behaviorDiverged: boolean;
}

export interface EngineConfig {
  readonly databaseUrl: string;
  readonly ollama?: OllamaClient;
  readonly retainWorlds?: boolean;
}

async function runArm(
  spec: ScenarioSpec,
  arm: Arm,
  cfg: EngineConfig,
): Promise<ArmRun> {
  const world = await World.create(cfg.databaseUrl);
  const agent = new LabAgent(cfg.ollama ?? new OllamaClient());
  const ctx = { world, agent, arm };
  try {
    await spec.seed(ctx);
    const observation = await spec.observe(ctx);
    await spec.induce(ctx);
    const action = await spec.act(ctx, observation);
    const outcome = await spec.admit(ctx, action);
    const result = await spec.oracle(ctx, action, outcome);
    const actionOutcomeEnvelope = buildLocalAgentLabActionOutcomeEnvelope({
      spec,
      arm,
      tenantId: world.tenantId,
      decidedAt: new Date().toISOString() as Timestamp,
      observation,
      action,
      outcome,
      result,
    });

    // admitted transitions for this run = full tenant log length.
    const chain = await world.verifyChain();
    return {
      arm,
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
  } finally {
    if (cfg.retainWorlds === true) {
      await world.close();
    } else {
      await world.destroy();
    }
  }
}

export async function runScenario(
  spec: ScenarioSpec,
  cfg: EngineConfig,
): Promise<ScenarioRun> {
  const ollama = cfg.ollama ?? new OllamaClient();
  const a = await runArm(spec, "no_substrate", { ...cfg, ollama });
  const b = await runArm(spec, "substrate", { ...cfg, ollama });
  return {
    scenarioId: spec.scenarioId,
    failureClass: spec.failureClass,
    realityQualities: spec.realityQualities,
    model: ollama.model,
    arms: { no_substrate: a, substrate: b },
    actionOutcomeEnvelopes: [
      a.actionOutcomeEnvelope,
      b.actionOutcomeEnvelope,
    ].filter((envelope): envelope is ActionOutcomeEnvelope => envelope !== undefined),
    behaviorDiverged: a.result !== b.result,
  };
}

export interface SuiteResult {
  readonly runs: readonly ScenarioRun[];
  readonly model: string;
  readonly actionOutcomeEnvelopes: readonly ActionOutcomeEnvelope[];
  /** Across runs: how many had Arm A fail while Arm B did not fail. */
  readonly substrateProtectedCount: number;
  /** Honest negatives: Arm A did not fail (substrate not needed this run). */
  readonly noFailureCount: number;
  readonly tokensPerAdmittedTransition: Readonly<Record<Arm, number>>;
}

export async function runSuite(
  specs: readonly ScenarioSpec[],
  cfg: EngineConfig,
): Promise<SuiteResult> {
  const runs: ScenarioRun[] = [];
  for (const spec of specs) {
    runs.push(await runScenario(spec, cfg));
  }
  let substrateProtectedCount = 0;
  let noFailureCount = 0;
  const tok = { no_substrate: { t: 0, n: 0 }, substrate: { t: 0, n: 0 } };
  for (const r of runs) {
    const a = r.arms.no_substrate;
    const b = r.arms.substrate;
    if (a.result === "fail" && b.result !== "fail") substrateProtectedCount += 1;
    if (a.result !== "fail") noFailureCount += 1;
    tok.no_substrate.t += a.tokens;
    tok.no_substrate.n += a.admittedTransitions;
    tok.substrate.t += b.tokens;
    tok.substrate.n += b.admittedTransitions;
  }
  const tpa = (x: { t: number; n: number }) => (x.n > 0 ? x.t / x.n : x.t);
  return {
    runs,
    model: cfg.ollama?.model ?? new OllamaClient().model,
    actionOutcomeEnvelopes: runs.flatMap((run) => run.actionOutcomeEnvelopes),
    substrateProtectedCount,
    noFailureCount,
    tokensPerAdmittedTransition: {
      no_substrate: tpa(tok.no_substrate),
      substrate: tpa(tok.substrate),
    },
  };
}

export function buildLocalAgentLabActionOutcomeEnvelope(input: {
  readonly spec: Pick<ScenarioSpec, "scenarioId" | "failureClass">;
  readonly arm: Arm;
  readonly tenantId: string;
  readonly decidedAt: Timestamp;
  readonly observation: Observation;
  readonly action: IntendedAction;
  readonly outcome: AdmitOutcome;
  readonly result: EvalResult;
}): ActionOutcomeEnvelope {
  const terminalOutcome = input.outcome.admitted ? "accepted" : "blocked";
  const envelopeId = `outcome_local_agent_lab_${input.spec.scenarioId}_${input.arm}`;
  const evidenceRefs = [
    stateRef("document", `local-agent-lab:${input.spec.scenarioId}:observation`),
  ];
  const substrateRefs = [
    stateRef(
      "action_outcome_envelope",
      envelopeId,
      "Local agent lab ActionOutcomeEnvelope",
    ),
    stateRef("continuity_checkpoint", `basis:${input.observation.basisPosition}`),
    ...(input.outcome.admittedEventId === undefined
      ? []
      : [stateRef("event", input.outcome.admittedEventId)]),
  ];

  return buildActionOutcomeEnvelope({
    tenantId: input.tenantId as ActionOutcomeEnvelope["tenantId"],
    actionId: `local_agent_lab:${input.spec.scenarioId}:${input.arm}`,
    subject: stateRef("document", input.spec.scenarioId),
    proposalReviewId: `local_agent_lab:${input.spec.scenarioId}:${input.arm}:proposal_review`,
    stateReviewArtifactHash: localAgentLabArtifactHash(input),
    evidenceAdmissionReviewIds: [
      `local_agent_lab:${input.spec.scenarioId}:${input.arm}:evidence_review`,
    ],
    requestedTerminalOutcome: terminalOutcome,
    decidedAt: input.decidedAt,
    decidedBy: `local-agent-lab:${input.arm}`,
    evidenceRefs,
    substrateRefs,
    blockingCauses:
      terminalOutcome === "blocked"
        ? [
            {
              source: "policy",
              code: input.outcome.refusedReason ?? input.spec.failureClass,
              message:
                input.outcome.refusedReason ??
                `Local agent lab ${input.arm} run blocked ${input.spec.scenarioId}.`,
              refs: substrateRefs,
            },
          ]
        : [],
  });
}

function localAgentLabArtifactHash(input: {
  readonly spec: Pick<ScenarioSpec, "scenarioId" | "failureClass">;
  readonly arm: Arm;
  readonly observation: Observation;
  readonly action: IntendedAction;
  readonly outcome: AdmitOutcome;
  readonly result: EvalResult;
}): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        scenarioId: input.spec.scenarioId,
        failureClass: input.spec.failureClass,
        arm: input.arm,
        observation: input.observation,
        action: input.action,
        outcome: input.outcome,
        result: input.result,
      }),
    )
    .digest("hex");
}
