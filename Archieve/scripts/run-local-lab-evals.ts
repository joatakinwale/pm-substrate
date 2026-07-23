#!/usr/bin/env tsx
import { env } from "node:process";
import pg from "pg";
import {
  PostgresEvalEventStore,
  runLocalLabPairedEvals,
  type ThreeAxisProofPacketSource,
} from "../packages/evals/src/index.js";
import {
  auditPersistedEvalEventAuthority,
  buildStrictRunnerProofPacket,
  summarizeThreeAxisProofPacket,
} from "./authority-recovery.js";

const suite = runLocalLabPairedEvals();
const proofGeneratedAt =
  suite.events[0]?.observedAt ?? "2026-06-25T00:00:00.000Z";
const proofSources = [
  {
    sourceId: "axis-c-local-lab-deterministic",
    axis: "local_lab",
    eventCount: suite.events.length,
  },
] as const satisfies readonly ThreeAxisProofPacketSource[];
const prePersistenceProofPacket = buildStrictRunnerProofPacket({
  generatedAt: proofGeneratedAt,
  events: suite.events,
  sources: proofSources,
});

console.log(JSON.stringify({
  scenarios: suite.summaries.length,
  events: suite.events.length,
  baselineFailures: suite.baselineFailures,
  substrateFailures: suite.substrateFailures,
  failureReduction: suite.failureReduction,
  stateBenchCategories: suite.stateBenchCategories,
  coordinationClasses: suite.metrics.coordinationClasses,
  authorityGatePassRate: suite.metrics.authorityGatePassRate,
  convergentUpdateAutoResolutionRate: suite.metrics.convergentUpdateAutoResolutionRate,
  byCoordinationClass: suite.metrics.byCoordinationClass,
  actionOutcomeEnvelopePackets: suite.actionOutcomeEnvelopes.length,
  authorityRecovery: {
    status: "not_run_without_persisted_packet_store",
  },
  strictProofPacket: summarizeThreeAxisProofPacket(prePersistenceProofPacket),
}, null, 2));

const databaseUrl = env["PM_DATABASE_URL"];
if (databaseUrl) {
  const pool = new pg.Pool({ connectionString: databaseUrl });
  try {
    const store = new PostgresEvalEventStore(pool);
    await store.recordActionOutcomeEnvelopes(suite.actionOutcomeEnvelopes);
    const authorityRecovery = await auditPersistedEvalEventAuthority(
      store,
      suite.events,
    );
    await store.recordMany(suite.events);
    const strictProofPacket = buildStrictRunnerProofPacket({
      generatedAt: proofGeneratedAt,
      events: suite.events,
      sources: proofSources,
      authorityRecoverySuite: authorityRecovery,
    });
    console.log(
      `persisted ${suite.actionOutcomeEnvelopes.length} action outcome packets and ${suite.events.length} eval events`,
    );
    console.log(JSON.stringify({
      authorityRecovery: authorityRecovery.summary,
      strictProofPacket: summarizeThreeAxisProofPacket(strictProofPacket),
    }, null, 2));
  } finally {
    await pool.end();
  }
}
