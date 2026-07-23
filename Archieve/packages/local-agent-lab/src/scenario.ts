/**
 * ScenarioSpec — the dynamic contract. The engine never changes to add a
 * failure class; you register a new ScenarioSpec. Each spec defines: how to
 * seed the world, how the agent observes, how the failure is induced (a world
 * mutation AFTER observation), how the agent acts, and the repository-authored
 * ORACLE that returns the verdict from operational state rather than model
 * prose. This is mechanism/conformance evidence, not an independent efficacy
 * oracle. See docs/state-validation/local-agent-lab-scenarios.md.
 */

import type { World } from "./world.js";
import type { LabAgent } from "./agent.js";

export type Arm = "no_substrate" | "substrate";
export type EvalResult = "pass" | "fail" | "blocked";
export type ExpectedAdmission = "allow" | "block";

/** What the agent perceived + the causal basis position at read time. */
export interface Observation {
  readonly key: string;
  readonly perceivedValue: unknown;
  readonly basisPosition: number;
}

/** The action the agent intends, parsed from its output (not yet admitted). */
export interface IntendedAction {
  readonly key: string;
  /** The value the action is built on (the agent's basis). */
  readonly actedValue: unknown;
  readonly rawText: string;
}

/** Result of attempting to admit the action (Arm B) or simulate it (Arm A). */
export interface AdmitOutcome {
  readonly admitted: boolean;
  readonly admittedEventId?: string;
  readonly refusedReason?: string;
}

export interface ScenarioContext {
  readonly world: World;
  readonly agent: LabAgent;
  readonly arm: Arm;
}

export interface ScenarioSpec {
  readonly scenarioId: string;
  readonly failureClass: string;
  readonly realityQualities: readonly number[];

  /**
   * Mechanism-control expectation for evidence runs. `block` cases reproduce
   * a seeded hazard; matched `allow` controls prove that a deny-all gate cannot
   * satisfy the lab's coverage claim. Ordinary scenario callers may omit both
   * fields; the evidence registry supplies them explicitly.
   */
  readonly expectedAdmission?: ExpectedAdmission;
  readonly controlGroup?: string;

  /** Seed initial admitted state. */
  seed(ctx: ScenarioContext): Promise<void>;

  /** Agent observes + caches. Returns what it perceived. */
  observe(ctx: ScenarioContext): Promise<Observation>;

  /** Induce the failure: mutate the world AFTER observation. */
  induce(ctx: ScenarioContext): Promise<void>;

  /** Agent plans + emits an intended action from its (possibly stale) memory. */
  act(ctx: ScenarioContext, observation: Observation): Promise<IntendedAction>;

  /**
   * Attempt to make the action operational.
   * - Arm A (no_substrate): no admission gate — the action "happens" as the
   *   agent intended (models the un-Raft'd follower applying from its log).
   * - Arm B (substrate): admission is gated on freshness/authority; a stale or
   *   ungrounded action is REFUSED (no admitted transition created).
   */
  admit(ctx: ScenarioContext, action: IntendedAction): Promise<AdmitOutcome>;

  /**
   * The ORACLE. Reads the admitted log to return the real verdict.
   * pass    = agent acted on current state (or correctly abstained).
   * fail    = a stale/ungrounded action became operational.
   * blocked = substrate refused the stale/ungrounded action (Arm B win).
   */
  oracle(
    ctx: ScenarioContext,
    action: IntendedAction,
    outcome: AdmitOutcome,
  ): Promise<EvalResult>;
}
