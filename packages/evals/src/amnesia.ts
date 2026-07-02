/**
 * Amnesiac-resume measurement (refactor plan Phase 1 — "pay the thesis
 * debts"). Promotes the continuity amnesia eval from a passing assertion to a
 * MEASURED paired number: how much session-1 knowledge does an agent recover
 * in session 2 when it resumes from (a) nothing — the baseline arm, chat
 * history is gone by definition of amnesia — versus (b) the substrate's
 * continuity ledger.
 *
 * Nothing is hardcoded: the substrate arm's recall is computed by writing the
 * facts through the real ledger port and reading them back via
 * buildContinuityContext; chain integrity is verified with the real hash
 * chain. Degraded ledgers (the pure-unit test injects one that drops facts)
 * produce measured partial recall, not a scripted pass.
 */

import {
  buildContinuityContext,
  verifyContinuityCheckpointChain,
  type CheckpointKind,
  type ContinuityCheckpoint,
  type ContinuityLedger,
} from "@pm/continuity";
import type { TenantId, Timestamp } from "@pm/types";

export const AMNESIA_RESUME_MEASUREMENT_SCHEMA_VERSION =
  "amnesia-resume-measurement.v1" as const;

export interface AmnesiaFact {
  readonly kind: CheckpointKind;
  readonly title: string;
  readonly summary: string;
}

export interface AmnesiaResumeMeasurementInput {
  readonly tenantId: TenantId;
  readonly agentId: string;
  readonly scope: string;
  /** Session-1 knowledge the agent must be able to recover after amnesia. */
  readonly facts: readonly AmnesiaFact[];
  readonly ledger: ContinuityLedger;
  readonly measuredAt?: Timestamp;
}

export interface AmnesiaResumeMeasurement {
  readonly schemaVersion: typeof AMNESIA_RESUME_MEASUREMENT_SCHEMA_VERSION;
  readonly tenantId: TenantId;
  readonly agentId: string;
  readonly scope: string;
  readonly factCount: number;
  /**
   * Baseline arm: an amnesiac agent with no substrate has no session-1 state
   * by definition (chat history does not survive the context loss this eval
   * models). Kept explicit so the paired comparison is honest about what the
   * baseline is.
   */
  readonly baselineRecalledFactCount: 0;
  readonly baselineRecallRate: 0;
  /** Substrate arm: measured by real ledger round-trip, never assumed. */
  readonly substrateRecalledFactCount: number;
  readonly substrateRecallRate: number;
  readonly missingFactTitles: readonly string[];
  /** Hash-chain verification of everything read back (replay integrity). */
  readonly chainValid: boolean;
  readonly chainErrors: readonly string[];
  readonly measuredAt: Timestamp;
}

const norm = (s: string): string => s.trim().toLowerCase();

const contextCheckpoints = (ctx: {
  readonly decisions: readonly ContinuityCheckpoint[];
  readonly openWork: readonly ContinuityCheckpoint[];
  readonly lessons: readonly ContinuityCheckpoint[];
  readonly research: readonly ContinuityCheckpoint[];
  readonly claims: readonly ContinuityCheckpoint[];
}): readonly ContinuityCheckpoint[] => [
  ...ctx.decisions,
  ...ctx.openWork,
  ...ctx.lessons,
  ...ctx.research,
  ...ctx.claims,
];

/**
 * Record session-1 facts through the ledger, simulate amnesia (no in-memory
 * carry-over — everything below reads back through the port), and measure
 * what the resumed agent can reconstruct.
 */
export async function measureAmnesiaResume(
  input: AmnesiaResumeMeasurementInput,
): Promise<AmnesiaResumeMeasurement> {
  if (input.facts.length === 0) {
    throw new Error("measureAmnesiaResume requires at least one fact");
  }

  // Session 1 — the agent learns things and checkpoints them.
  for (const fact of input.facts) {
    await input.ledger.record({
      tenantId: input.tenantId,
      agentId: input.agentId,
      scope: input.scope,
      kind: fact.kind,
      title: fact.title,
      summary: fact.summary,
    });
  }

  // ~ amnesia ~ (nothing from session 1 is referenced below except the
  // ground-truth fact list, which plays the role of the oracle).

  // Session 2 — resume from substrate state only.
  const resumed = await buildContinuityContext(input.ledger, {
    tenantId: input.tenantId,
    agentId: input.agentId,
    scope: input.scope,
  });
  const recovered = contextCheckpoints(resumed);
  const recoveredTitles = new Set(recovered.map((c) => norm(c.title)));

  const missing = input.facts
    .map((f) => f.title)
    .filter((t) => !recoveredTitles.has(norm(t)));
  const recalled = input.facts.length - missing.length;

  const chain = verifyContinuityCheckpointChain({
    tenantId: input.tenantId,
    agentId: input.agentId,
    checkpoints: recovered,
  });

  return {
    schemaVersion: AMNESIA_RESUME_MEASUREMENT_SCHEMA_VERSION,
    tenantId: input.tenantId,
    agentId: input.agentId,
    scope: input.scope,
    factCount: input.facts.length,
    baselineRecalledFactCount: 0,
    baselineRecallRate: 0,
    substrateRecalledFactCount: recalled,
    substrateRecallRate: recalled / input.facts.length,
    missingFactTitles: missing,
    chainValid: chain.valid,
    chainErrors: chain.errors,
    measuredAt:
      input.measuredAt ?? (new Date().toISOString() as Timestamp),
  };
}

/** Deterministic default fixture used by the CI measurement script. */
export const AMNESIA_DEFAULT_FACTS: readonly AmnesiaFact[] = [
  {
    kind: "decision",
    title: "Discovery product wedge",
    summary: "Sell a discovery sprint before building the full platform.",
  },
  {
    kind: "work",
    title: "Wire freshness gate into lead scoring",
    summary: "Kit-level staleness gate must be exercised end-to-end.",
  },
  {
    kind: "lesson",
    title: "Oracle reads the admitted log",
    summary: "Never hardcode verdicts; derive them from real state.",
  },
  {
    kind: "claim",
    title: "Substrate resume beats chat-history resume",
    summary: "Amnesiac agents recover working context from the ledger.",
  },
  {
    kind: "research",
    title: "State coherence under partial observation",
    summary: "Bounded actors need governed operational state to act safely.",
  },
];
