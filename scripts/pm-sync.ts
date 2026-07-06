/**
 * pm:sync — entity-mapping sync-runner CLI (the D5b runtime consumer).
 *
 *   pnpm pm:sync -- --app orbit_crm --mapping mapping.json --records records.json
 *
 * `mapping.json` is the app's declarative EntityMapping; `records.json` is
 * an array of { sourceName, externalId, row } — export it from the app's
 * EXISTING endpoints (e.g. `curl https://app/api/customers > records.json`
 * plus a jq reshape). Zero app edits: the app never learns the substrate
 * exists. Re-running is always safe — identity is deterministic and
 * unchanged records write nothing.
 *
 * Env: PM_DATABASE_URL (required), PM_DEV_TENANT_ID (default tenant_dev),
 *      PM_DEV_AGENT_ID (default joat-dev).
 */

import { readFileSync } from "node:fs";
import pg from "pg";

import { asEntityMapping } from "../packages/entity-mapping/src/index.js";
import { PostgresEventStore } from "../packages/events/src/index.js";
import { PostgresGraph } from "../packages/graph/src/index.js";
import {
  runEntityMappingSync,
  type SourceRecord,
} from "../packages/integration-kit/src/index.js";
import type { TenantId } from "../packages/types/src/index.js";

const TENANT = (process.env["PM_DEV_TENANT_ID"] ?? "tenant_dev") as TenantId;
const AGENT = process.env["PM_DEV_AGENT_ID"] ?? "joat-dev";

function argValue(flag: string): string | undefined {
  const args = process.argv.slice(2);
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

async function main(): Promise<void> {
  const databaseUrl = process.env["PM_DATABASE_URL"];
  const appName = argValue("--app");
  const mappingPath = argValue("--mapping");
  const recordsPath = argValue("--records");
  if (!databaseUrl || !appName || !mappingPath || !recordsPath) {
    console.error(
      "pm:sync: PM_DATABASE_URL env + --app <name> --mapping <file.json> --records <file.json> are required.",
    );
    process.exit(1);
  }

  const mapping = asEntityMapping(
    JSON.parse(readFileSync(mappingPath, "utf8")),
  );
  const records = JSON.parse(
    readFileSync(recordsPath, "utf8"),
  ) as readonly SourceRecord[];

  const pool = new pg.Pool({ connectionString: databaseUrl });
  try {
    const result = await runEntityMappingSync(
      { graph: new PostgresGraph(pool), events: new PostgresEventStore(pool) },
      { tenantId: TENANT, appName, mapping, records, syncedBy: AGENT },
    );
    console.log(
      `sync ${appName}: created=${result.created} updated=${result.updated} unchanged=${result.unchanged} rejected=${result.rejected.length}`,
    );
    for (const r of result.rejected) {
      console.error(`  rejected ${r.sourceName}:${r.externalId} — ${r.reason}`);
    }
    if (result.rejected.length > 0) process.exitCode = 2;
  } finally {
    await pool.end();
  }
}

await main();
