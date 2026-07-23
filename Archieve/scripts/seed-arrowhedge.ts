#!/usr/bin/env tsx
/**
 * Seed the local ArrowHedgeLab tenant and finance-research profile.
 *
 * This is intentionally profile-specific and lives in scripts/, not substrate
 * core packages. It is idempotent and meant for local validation before running
 * ArrowHedge check-env or paired backtest experiments.
 */

import { env, exit } from "node:process";

import pg from "pg";

import { FINANCE_RESEARCH_PROFILE } from "../packages/profile-finance-research/src/profile.js";

const { Client } = pg;

const databaseUrl = env["PM_DATABASE_URL"];
const tenantId =
  env["PM_ARROWHEDGE_TENANT_ID"] ??
  env["PM_DEV_TENANT_ID"] ??
  "tnt_arrowhedge";

if (!databaseUrl) {
  console.error("PM_DATABASE_URL is not set. Copy .env.example to .env and source it.");
  exit(1);
}

const main = async () => {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  await client.query(
    `INSERT INTO substrate.tenants (id, display_name)
     VALUES ($1, $2)
     ON CONFLICT (id) DO UPDATE
       SET display_name = EXCLUDED.display_name`,
    [tenantId, "ArrowHedgeLab Validation Tenant"],
  );

  await client.query(
    `INSERT INTO profiles.installations (tenant_id, name, version, definition)
     VALUES ($1, $2, $3, $4::jsonb)
     ON CONFLICT (tenant_id, name) DO UPDATE
       SET version = EXCLUDED.version,
           definition = EXCLUDED.definition,
           installed_at = now()`,
    [
      tenantId,
      FINANCE_RESEARCH_PROFILE.name,
      FINANCE_RESEARCH_PROFILE.version,
      JSON.stringify(FINANCE_RESEARCH_PROFILE),
    ],
  );

  console.log(
    `arrowhedge ready: tenant=${tenantId} profile=${FINANCE_RESEARCH_PROFILE.name}@${FINANCE_RESEARCH_PROFILE.version}`,
  );
  await client.end();
};

main().catch((e) => {
  console.error(e);
  exit(1);
});
