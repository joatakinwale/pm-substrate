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
}, null, 2));

const databaseUrl = env["PM_DATABASE_URL"];
if (databaseUrl) {
  const pool = new pg.Pool({ connectionString: databaseUrl });
  try {
    await new PostgresEvalEventStore(pool).recordMany(suite.events);
    console.log(`persisted ${suite.events.length} eval events`);
  } finally {
    await pool.end();
  }
}
