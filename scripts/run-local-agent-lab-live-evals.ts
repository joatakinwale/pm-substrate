#!/usr/bin/env tsx
import { env, exit } from "node:process";
import pg from "pg";
import {
  buildDynamicLocalAgentLabEvalSuite,
  PostgresEvalEventStore,
} from "../packages/evals/src/index.js";
import {
  SCENARIOS,
  runSuite,
} from "../packages/local-agent-lab/src/index.js";
import { auditPersistedEvalEventAuthority } from "./authority-recovery.js";

const databaseUrl = env["PM_DATABASE_URL"];
if (!databaseUrl) {
  console.error("PM_DATABASE_URL is required for live local-agent-lab evals.");
  exit(1);
}

const dynamicSuite = await runSuite(SCENARIOS, {
  databaseUrl,
  retainWorlds: true,
});
const evalSuite = buildDynamicLocalAgentLabEvalSuite(dynamicSuite);

console.log(JSON.stringify({
  scenarios: dynamicSuite.runs.length,
  model: dynamicSuite.model,
  events: evalSuite.events.length,
  actionOutcomeEnvelopePackets: evalSuite.actionOutcomeEnvelopes.length,
  baselineFailures: evalSuite.baselineFailures,
  substrateFailures: evalSuite.substrateFailures,
  failureReduction: evalSuite.failureReduction,
  allStageFailureReduction: evalSuite.allStageFailureReduction,
  substrateProtectedCount: dynamicSuite.substrateProtectedCount,
  noFailureCount: dynamicSuite.noFailureCount,
  tokensPerAdmittedTransition: dynamicSuite.tokensPerAdmittedTransition,
  evidenceStages: evalSuite.metrics.evidenceStages,
  liveCoverage: {
    complete: evalSuite.liveCoverage.complete,
    coverageRate: evalSuite.liveCoverage.coverageRate,
    coveredFailureClasses: evalSuite.liveCoverage.coveredFailureClasses,
    missingFailureClasses: evalSuite.liveCoverage.missingFailureClasses,
  },
  byFailureClass: evalSuite.metrics.byFailureClass,
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
  console.log(
    `persisted ${evalSuite.actionOutcomeEnvelopes.length} action outcome packets and ${evalSuite.events.length} live eval events`,
  );
  console.log(JSON.stringify({
    authorityRecovery: authorityRecovery.summary,
  }, null, 2));
} finally {
  await pool.end();
}
