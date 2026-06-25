#!/usr/bin/env tsx
import { env, exit } from "node:process";
import pg from "pg";
import {
  buildDynamicLocalAgentLabEvalSuite,
  PostgresEvalEventStore,
  recordDynamicLocalAgentLabEvalSuite,
} from "../packages/evals/src/index.js";
import {
  SCENARIOS,
  runSuite,
} from "../packages/local-agent-lab/src/index.js";

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
  await recordDynamicLocalAgentLabEvalSuite(store, evalSuite);
  console.log(
    `persisted ${evalSuite.actionOutcomeEnvelopes.length} action outcome packets and ${evalSuite.events.length} live eval events`,
  );
} finally {
  await pool.end();
}
