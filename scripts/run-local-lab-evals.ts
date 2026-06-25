#!/usr/bin/env tsx
import { env } from "node:process";
import pg from "pg";
import {
  PostgresEvalEventStore,
  runLocalLabPairedEvals,
} from "../packages/evals/src/index.js";
import { auditPersistedEvalEventAuthority } from "./authority-recovery.js";

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
    const authorityRecovery = await auditPersistedEvalEventAuthority(
      store,
      suite.events,
    );
    await store.recordMany(suite.events);
    console.log(
      `persisted ${suite.actionOutcomeEnvelopes.length} action outcome packets and ${suite.events.length} eval events`,
    );
    console.log(JSON.stringify({
      authorityRecovery: authorityRecovery.summary,
    }, null, 2));
  } finally {
    await pool.end();
  }
}
