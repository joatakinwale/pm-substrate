#!/usr/bin/env tsx
/**
 * scripts/report-token-usage.ts — re-render any past capstone token-A/B run
 * from the admitted event log (fold-once/render-many: same computeTokenUsage
 * the runner used, so a re-render can never disagree with the original).
 *
 *   pnpm report:token-usage -- --label token-ab-2026-07-16-21-00 [--csv out.csv]
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { argv, env, exit } from "node:process";

import pg from "pg";

import type { TenantId } from "../packages/types/src/index.js";
import {
  computeTokenUsage,
  renderTokenUsageCsv,
  renderTokenUsageTable,
} from "../packages/local-agent-lab/src/index.js";

const databaseUrl = env["PM_DATABASE_URL"];
if (!databaseUrl) {
  console.error("report:token-usage: PM_DATABASE_URL is not set (source .env first).");
  exit(1);
}

const arg = (name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1]!.startsWith("--") ? argv[i + 1] : undefined;
};

const main = async (): Promise<void> => {
  const label = arg("label");
  if (label === undefined) {
    console.error("usage: pnpm report:token-usage -- --label <runLabel> [--tenant T] [--csv path]");
    exit(1);
  }
  const tenantId = (arg("tenant") ?? env["PM_DEV_TENANT_ID"] ?? "tenant_dev") as TenantId;
  const pool = new pg.Pool({ connectionString: databaseUrl });
  try {
    const metrics = await computeTokenUsage(pool, { tenantId, runLabel: label });
    if (metrics.rows.length === 0) {
      console.error(`no eval.token.usage events found for runLabel=${label} tenant=${tenantId}`);
      exit(1);
    }
    console.log(renderTokenUsageTable(metrics));
    const csv = arg("csv");
    if (csv !== undefined) {
      const path = resolve(csv);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, renderTokenUsageCsv(metrics));
      console.log(`csv: ${path}`);
    }
  } finally {
    await pool.end();
  }
};

void main().catch((error: unknown) => {
  console.error(`report:token-usage failed: ${error instanceof Error ? error.message : String(error)}`);
  exit(1);
});
