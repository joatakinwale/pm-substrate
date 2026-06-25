#!/usr/bin/env tsx
import { env } from "node:process";
import pg from "pg";
import {
  PostgresEvalEventStore,
  runLocalLabPairedEvals,
} from "../packages/evals/src/index.js";

const suite = runLocalLabPairedEvals();

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
}, null, 2));

const databaseUrl = env["PM_DATABASE_URL"];
if (databaseUrl) {
  const pool = new pg.Pool({ connectionString: databaseUrl });
  try {
    const store = new PostgresEvalEventStore(pool);
    await store.recordActionOutcomeEnvelopes(suite.actionOutcomeEnvelopes);
    await store.recordMany(suite.events);
    console.log(
      `persisted ${suite.actionOutcomeEnvelopes.length} action outcome packets and ${suite.events.length} eval events`,
    );
  } finally {
    await pool.end();
  }
}
