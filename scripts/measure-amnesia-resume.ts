#!/usr/bin/env tsx
/**
 * scripts/measure-amnesia-resume.ts — Phase 1 headline number (T4).
 *
 * Runs the amnesiac-resume measurement against the real database and prints
 * the paired result. CI runs this after the test suite so the number is in
 * every CI log, not buried in a passing assertion.
 */

import { randomUUID } from "node:crypto";
import { env, exit } from "node:process";

import pg from "pg";
import { PostgresContinuityLedger } from "../packages/continuity/src/index.js";
import type { TenantId } from "../packages/types/src/index.js";
import { AMNESIA_DEFAULT_FACTS, measureAmnesiaResume } from "../packages/evals/src/index.js";

const databaseUrl = env["PM_DATABASE_URL"];
if (!databaseUrl) {
  console.log("amnesia-resume: skipped (PM_DATABASE_URL is not set)");
  exit(0);
}

const main = async () => {
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const tenant = `tnt_amnesia_ci_${randomUUID().slice(0, 8)}` as TenantId;
  await pool.query(
    `INSERT INTO substrate.tenants(id, display_name) VALUES ($1, $1)
     ON CONFLICT DO NOTHING`,
    [tenant],
  );
  try {
    const m = await measureAmnesiaResume({
      tenantId: tenant,
      agentId: "agent_amnesia_ci",
      scope: "amnesia-eval-ci",
      facts: AMNESIA_DEFAULT_FACTS,
      ledger: new PostgresContinuityLedger(pool),
    });
    console.log(
      `amnesia-resume: baseline ${m.baselineRecalledFactCount}/${m.factCount} ` +
        `(${(m.baselineRecallRate * 100).toFixed(0)}%) vs substrate ` +
        `${m.substrateRecalledFactCount}/${m.factCount} ` +
        `(${(m.substrateRecallRate * 100).toFixed(0)}%); chainValid=${m.chainValid}`,
    );
    if (m.substrateRecallRate < 1 || !m.chainValid) {
      console.error("amnesia-resume: FAILED (recall < 100% or broken chain)");
      exit(1);
    }
  } finally {
    await pool.query(`DELETE FROM continuity.checkpoints WHERE tenant_id = $1`, [
      tenant,
    ]);
    await pool.query(`DELETE FROM substrate.tenants WHERE id = $1`, [tenant]);
    await pool.end();
  }
};

main().catch((e) => {
  console.error(e);
  exit(1);
});
