#!/usr/bin/env tsx
/**
 * scripts/seed.ts
 *
 * Seeds the dev tenant. Idempotent.
 */

import { env, exit } from "node:process";

import pg from "pg";
const { Client } = pg;

const databaseUrl = env["PM_DATABASE_URL"];
const tenantId = env["PM_DEV_TENANT_ID"] ?? "tenant_dev";

if (!databaseUrl) {
  console.error("PM_DATABASE_URL is not set. Copy .env.example to .env and source it.");
  exit(1);
}

const main = async () => {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  await client.query(
    `INSERT INTO substrate.tenants (id, display_name) VALUES ($1, $2)
     ON CONFLICT (id) DO NOTHING`,
    [tenantId, "Local Dev Tenant"],
  );

  const r = await client.query<{ id: string; display_name: string }>(
    `SELECT id, display_name FROM substrate.tenants WHERE id = $1`,
    [tenantId],
  );

  console.log(`tenant ready: ${r.rows[0]?.id} (${r.rows[0]?.display_name})`);
  await client.end();
};

main().catch((e) => {
  console.error(e);
  exit(1);
});
