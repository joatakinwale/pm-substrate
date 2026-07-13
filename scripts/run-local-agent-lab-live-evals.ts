#!/usr/bin/env tsx
import { env, exit } from "node:process";
import pg from "pg";
import {
  buildDynamicLocalAgentLabEvalSuite,
  PostgresEvalEventStore,
  type ThreeAxisProofPacketSource,
} from "../packages/evals/src/index.js";
import {
  EVIDENCE_SCENARIOS,
  runSuite,
} from "../packages/local-agent-lab/src/index.js";
import {
  auditPersistedEvalEventAuthority,
  buildStrictRunnerProofPacket,
  summarizeThreeAxisProofPacket,
} from "./authority-recovery.js";

const databaseUrl = env["PM_DATABASE_URL"];
if (!databaseUrl) {
  console.error("PM_DATABASE_URL is required for live local-agent-lab evals.");
  exit(1);
}

const dynamicSuite = await runSuite(EVIDENCE_SCENARIOS, {
  databaseUrl,
  retainWorlds: true,
});
const evalSuite = buildDynamicLocalAgentLabEvalSuite(dynamicSuite);
const proofGeneratedAt =
  evalSuite.events.at(-1)?.observedAt ?? "2026-06-25T00:00:00.000Z";
const proofSources = [
  {
    sourceId: "axis-c-local-agent-lab-live",
    axis: "local_lab",
    eventCount: evalSuite.events.length,
  },
] as const satisfies readonly ThreeAxisProofPacketSource[];
const prePersistenceProofPacket = buildStrictRunnerProofPacket({
  generatedAt: proofGeneratedAt,
  events: evalSuite.events,
  sources: proofSources,
});

console.log(JSON.stringify({
  evidenceClaim: evalSuite.evidenceClaim,
  suiteRunId: dynamicSuite.suiteRunId,
  scenarios: dynamicSuite.runs.length,
  model: dynamicSuite.model,
  events: evalSuite.events.length,
  actionOutcomeEnvelopePackets: evalSuite.actionOutcomeEnvelopes.length,
  mechanismFailureReduction: evalSuite.mechanismFailureReduction,
  mechanismEvidence: evalSuite.mechanismEvidence,
  rawDiagnostics: {
    baselineFailures: evalSuite.baselineFailures,
    substrateFailures: evalSuite.substrateFailures,
    failureReduction: evalSuite.failureReduction,
    allStageFailureReduction: evalSuite.allStageFailureReduction,
  },
  substrateProtectedCount: dynamicSuite.substrateProtectedCount,
  noFailureCount: dynamicSuite.noFailureCount,
  tokensPerAdmittedTransition: dynamicSuite.tokensPerAdmittedTransition,
  evidenceStages: evalSuite.metrics.evidenceStages,
  liveCoverage: {
    complete: evalSuite.liveCoverage.complete,
    coverageRate: evalSuite.liveCoverage.coverageRate,
    coveredFailureClasses: evalSuite.liveCoverage.coveredFailureClasses,
    missingFailureClasses: evalSuite.liveCoverage.missingFailureClasses,
    mutantControlGatePassed: evalSuite.liveCoverage.mutantControlGatePassed,
  },
  byFailureClass: evalSuite.metrics.byFailureClass,
  authorityRecovery: {
    status: "not_run_before_persisted_packet_store",
  },
  strictProofPacket: summarizeThreeAxisProofPacket(prePersistenceProofPacket),
}, null, 2));

const pool = new pg.Pool({ connectionString: databaseUrl });
try {
  const store = new PostgresEvalEventStore(pool);
  await store.recordActionOutcomeEnvelopes(evalSuite.actionOutcomeEnvelopes);
  const authorityRecovery = await auditPersistedEvalEventAuthority(
    store,
    evalSuite.events,
  );
  await store.recordMany(evalSuite.events);
  const strictProofPacket = buildStrictRunnerProofPacket({
    generatedAt: proofGeneratedAt,
    events: evalSuite.events,
    sources: proofSources,
    authorityRecoverySuite: authorityRecovery,
  });
  console.log(
    `persisted ${evalSuite.actionOutcomeEnvelopes.length} action outcome packets and ${evalSuite.events.length} live eval events`,
  );
  console.log(JSON.stringify({
    authorityRecovery: authorityRecovery.summary,
    strictProofPacket: summarizeThreeAxisProofPacket(strictProofPacket),
  }, null, 2));
} finally {
  await pool.end();
}
