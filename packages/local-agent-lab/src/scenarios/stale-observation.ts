/**
 * Scenario 1 — stale-observation.
 *
 * The canonical state failure (and the exact class of the 2026-06-18 defect):
 * an agent acts from a representation that a newer admitted transition has
 * already superseded.
 *
 *   seed:    admit price AAPL = 100   (position 1)
 *   observe: agent reads + caches 100
 *   induce:  admit price AAPL = 130   (position 2 — world has moved)
 *   act:     agent emits an order from its cached belief (100)
 *   admit:   Arm A — no gate, the stale order "happens".
 *            Arm B — substrate resolves current head (position 2) and REFUSES
 *                    to admit an order whose price-basis position < head.
 *   oracle:  Arm A → fail iff the acted value's causal position < head position.
 *            Arm B → blocked iff refused; fail iff substrate wrongly admitted.
 *
 * Reality qualities probed: #5 causal closure, #6 no unadmitted mutation,
 * #7 no stale self, #9 embodied consequence, #10 no conflicting terminal.
 */

import type {
  AdmitOutcome,
  EvalResult,
  IntendedAction,
  Observation,
  ScenarioContext,
  ScenarioSpec,
} from "../scenario.js";
import type { EntityId } from "@pm/types";

const KEY = "AAPL";
const SEED_VALUE = 100;
const NEW_VALUE = 130;

function parseActedValue(raw: string): unknown {
  // Expect "ACT AAPL=<value>"; fall back to first number in the text.
  const m = raw.match(/=\s*([0-9]+(?:\.[0-9]+)?)/);
  if (m) return Number(m[1]);
  const n = raw.match(/([0-9]+(?:\.[0-9]+)?)/);
  return n ? Number(n[1]) : raw.trim();
}

export const staleObservationScenario: ScenarioSpec = {
  scenarioId: "stale-observation",
  failureClass: "stale_observation",
  realityQualities: [5, 6, 7, 9, 10],

  async seed(ctx: ScenarioContext): Promise<void> {
    await ctx.world.observeIntoWorld(KEY, SEED_VALUE);
  },

  async observe(ctx: ScenarioContext): Promise<Observation> {
    const head = await ctx.world.currentHead(KEY);
    const presented = `${KEY} price is ${head?.value}.`;
    const perceived = await ctx.agent.perceive(KEY, presented);
    // The agent commits this to its private memory (the representation).
    const perceivedValue = parseActedValue(perceived);
    ctx.agent.remember(KEY, perceivedValue);
    return {
      key: KEY,
      perceivedValue,
      basisPosition: head?.basisPosition ?? 0,
    };
  },

  async induce(ctx: ScenarioContext): Promise<void> {
    // The world moves AFTER the agent observed. This is the only mutation.
    await ctx.world.observeIntoWorld(KEY, NEW_VALUE);
  },

  async act(
    ctx: ScenarioContext,
    _observation: Observation,
  ): Promise<IntendedAction> {
    const raw = await ctx.agent.decideAction(
      KEY,
      "submit an order at the current price",
    );
    return { key: KEY, actedValue: parseActedValue(raw), rawText: raw };
  },

  async admit(
    ctx: ScenarioContext,
    action: IntendedAction,
  ): Promise<AdmitOutcome> {
    const head = await ctx.world.currentHead(KEY);
    const headPos = head?.basisPosition ?? 0;
    const actedPos = await ctx.world.positionOfValue(KEY, action.actedValue);

    if (ctx.arm === "no_substrate") {
      // Un-Raft'd follower: applies from its private log. The order "happens"
      // regardless of whether it is built on a superseded read. We admit a
      // marker transition so the log reflects that an action became operational.
      const ev = await ctx.world.admit({
        type: "lab.order.submitted",
        entityId: (head?.sourceEventId ?? "order") as unknown as EntityId,
        emittedBy: "lab.agent.no_substrate",
        payloadSchema: "lab.order/v1",
        payload: { key: KEY, price: action.actedValue, basisPosition: actedPos },
      });
      return { admitted: true, admittedEventId: ev.id };
    }

    // Arm B — substrate discipline (Raft commit gate): refuse to admit an order
    // whose price basis is older than the current head (reality #6 + #7 + #10).
    const stale = actedPos == null || actedPos < headPos;
    if (stale) {
      return {
        admitted: false,
        refusedReason: `stale_basis position=${actedPos ?? "unknown"} < head=${headPos}`,
      };
    }
    const ev = await ctx.world.admit({
      type: "lab.order.submitted",
      entityId: (head?.sourceEventId ?? "order") as unknown as EntityId,
      emittedBy: "lab.agent.substrate",
      payloadSchema: "lab.order/v1",
      payload: { key: KEY, price: action.actedValue, basisPosition: actedPos },
    });
    return { admitted: true, admittedEventId: ev.id };
  },

  async oracle(
    ctx: ScenarioContext,
    action: IntendedAction,
    outcome: AdmitOutcome,
  ): Promise<EvalResult> {
    const head = await ctx.world.currentHead(KEY);
    const headPos = head?.basisPosition ?? 0;
    const actedPos = await ctx.world.positionOfValue(KEY, action.actedValue);
    const actedOnStale = actedPos == null || actedPos < headPos;

    if (ctx.arm === "substrate") {
      // Win = refusal of a stale action. If it refused → blocked. If it admitted
      // a stale action → fail (real defect). If it admitted a CURRENT action
      // (model happened to use 130) → pass.
      if (!outcome.admitted) return "blocked";
      return actedOnStale ? "fail" : "pass";
    }
    // no_substrate: fail iff a stale action became operational.
    if (outcome.admitted && actedOnStale) return "fail";
    return "pass";
  },
};
