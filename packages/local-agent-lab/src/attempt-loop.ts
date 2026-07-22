/**
 * Bounded multi-attempt arm runner — the capstone token-measurement seam.
 *
 * The engine's runArm is deliberately single-attempt (its ArmRun semantics and
 * envelope identity are load-bearing for the evals bridge), so retries live in
 * this sibling module instead of a flag threaded through the engine. One world
 * and ONE agent per series: a production agent retrying a refused action keeps
 * its memory — the corrective step is re-reading, not amnesia. Every attempt
 * begins with spec.observe, which re-perceives the CURRENT world and overwrites
 * the agent's stale memory entry, so retries proceed from a fresh basis in both
 * arms and the only inter-arm difference remains the admission gate.
 *
 * Per-attempt token deltas come from ledger snapshots (the ledger only ever
 * increments). No ActionOutcomeEnvelopes are built here — nothing consumes
 * them on this path, and unconsumed formalism is this repo's named failure
 * mode.
 */

import { LabAgent } from "./agent.js";
import { defaultLabProvider, type LabModelClient, type LabProviderName } from "./provider.js";
import type {
  Arm,
  EvalResult,
  ExpectedAdmission,
  ScenarioSpec,
} from "./scenario.js";
import { World } from "./world.js";

export type AttemptOutcome = "success" | "retry" | "failure";
export type AttemptCause = "stale_read" | "contract_violation" | "other" | "none";

export interface AttemptRecord {
  /** 1-based. */
  readonly attemptN: number;
  readonly result: EvalResult;
  readonly admitted: boolean;
  readonly refusedReason?: string;
  /** Ledger delta for THIS attempt only. */
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly totalTokens: number;
  readonly costCredits?: number;
  readonly outcome: AttemptOutcome;
  readonly cause: AttemptCause;
}

export interface ArmAttemptSeries {
  readonly scenarioId: string;
  readonly failureClass: string;
  readonly expectedAdmission: ExpectedAdmission;
  readonly arm: Arm;
  readonly provider: LabProviderName;
  readonly model: string;
  readonly attempts: readonly AttemptRecord[];
  readonly finalResult: EvalResult;
  readonly succeeded: boolean;
  /** attempts.length - 1. */
  readonly retries: number;
  readonly totalTokens: number;
  /** Sum of totalTokens over attempts whose outcome !== "success". */
  readonly wastedTokens: number;
}

export interface AttemptLoopConfig {
  readonly databaseUrl: string;
  readonly client?: LabModelClient;
  /** Clamped to >= 1. Default 3. */
  readonly maxAttempts?: number;
  readonly retainWorlds?: boolean;
  /** Test seams (session-runner precedent). */
  readonly worldFactory?: () => Promise<World>;
  readonly agentFactory?: (client: LabModelClient) => LabAgent;
}

/**
 * Gate-derived cause classification. `stale_read` = the gate named a
 * superseded basis (re-observe-fixable). `contract_violation` = the gate named
 * a currently-binding rule/limit/required evidence. A baseline oracle-fail has
 * no gate signal, so it can only ever be `other` — that attribution gap is
 * itself part of the A/B evidence.
 */
const STALE_READ_PREFIXES = [
  "stale_basis",
  "memory_drift",
  "parallel_write_conflict",
  "workflow_invalidated",
  "authority_conflict",
] as const;
const CONTRACT_PREFIXES = [
  "capability_contract_violation",
  "missing_required_dependency",
  "mapping_rule_required",
  "approval_gate_denied",
  "not_dispatched",
] as const;

export function classifyAttemptCause(input: {
  readonly result: EvalResult;
  readonly admitted: boolean;
  readonly refusedReason?: string;
}): AttemptCause {
  if (input.result === "pass") return "none";
  if (input.admitted || input.refusedReason === undefined) return "other";
  const reason = input.refusedReason;
  if (STALE_READ_PREFIXES.some((p) => reason.startsWith(p)) || reason.includes("stale_read_ref")) {
    return "stale_read";
  }
  if (CONTRACT_PREFIXES.some((p) => reason.startsWith(p))) return "contract_violation";
  return "other";
}

export async function runArmWithRetries(
  spec: ScenarioSpec,
  arm: Arm,
  cfg: AttemptLoopConfig,
): Promise<ArmAttemptSeries> {
  const maxAttempts = Math.max(1, cfg.maxAttempts ?? 3);
  const client = cfg.client ?? defaultLabProvider();
  const world = cfg.worldFactory !== undefined
    ? await cfg.worldFactory()
    : await World.create(cfg.databaseUrl);
  const agent = cfg.agentFactory !== undefined ? cfg.agentFactory(client) : new LabAgent(client);
  const ctx = { world, agent, arm };
  const attempts: AttemptRecord[] = [];
  try {
    await spec.seed(ctx);
    for (let attemptN = 1; attemptN <= maxAttempts; attemptN += 1) {
      const before = { ...agent.ledger };
      const observation = await spec.observe(ctx);
      if (attemptN === 1) await spec.induce(ctx);
      const action = await spec.act(ctx, observation);
      const outcome = await spec.admit(ctx, action);
      const result = await spec.oracle(ctx, action, outcome);
      const costDelta =
        agent.ledger.costCredits !== undefined
          ? agent.ledger.costCredits - (before.costCredits ?? 0)
          : undefined;
      const attemptOutcome: AttemptOutcome =
        result === "pass" ? "success" : attemptN < maxAttempts ? "retry" : "failure";
      attempts.push({
        attemptN,
        result,
        admitted: outcome.admitted,
        ...(outcome.refusedReason !== undefined ? { refusedReason: outcome.refusedReason } : {}),
        promptTokens: agent.ledger.promptTokens - before.promptTokens,
        completionTokens: agent.ledger.completionTokens - before.completionTokens,
        totalTokens: agent.ledger.totalTokens - before.totalTokens,
        ...(costDelta !== undefined ? { costCredits: costDelta } : {}),
        outcome: attemptOutcome,
        cause: classifyAttemptCause({
          result,
          admitted: outcome.admitted,
          ...(outcome.refusedReason !== undefined ? { refusedReason: outcome.refusedReason } : {}),
        }),
      });
      if (result === "pass") break;
    }
  } finally {
    if (cfg.retainWorlds === true) {
      await world.close();
    } else {
      await world.destroy();
    }
  }
  const last = attempts[attempts.length - 1];
  if (last === undefined) throw new Error("attempt loop produced no attempts");
  return {
    scenarioId: spec.scenarioId,
    failureClass: spec.failureClass,
    expectedAdmission: spec.expectedAdmission ?? "block",
    arm,
    provider: client.provider,
    model: client.model,
    attempts,
    finalResult: last.result,
    succeeded: last.result === "pass",
    retries: attempts.length - 1,
    totalTokens: attempts.reduce((n, a) => n + a.totalTokens, 0),
    wastedTokens: attempts.reduce(
      (n, a) => n + (a.outcome === "success" ? 0 : a.totalTokens),
      0,
    ),
  };
}
