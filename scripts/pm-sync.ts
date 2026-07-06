/**
 * pm:sync — entity-mapping sync-runner CLI (D5b + Liquid lane L2 consumer).
 *
 * File source (the dependency-free floor; no approval gate):
 *   pnpm pm:sync -- --app orbit_crm --mapping mapping.json --records records.json
 *
 * Liquid source (governed: refuses unapproved mapping hashes — see
 * `pnpm pm:mappings`; spawns the sidecar over stdio MCP):
 *   pnpm pm:sync -- --source liquid --app orbit_crm --mapping mapping.json \
 *     --url https://api.app.example/customers --entity Customer --external-id id \
 *     [--endpoint /customers] [--liquid-cmd "uvx liquid-mcp"]
 *
 * `mapping.json` is the app's declarative EntityMapping; `records.json` is
 * an array of { sourceName, externalId, row } — export it from the app's
 * EXISTING endpoints. Zero app edits either way; re-running is always safe.
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
  syncFromLiquid,
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
  const source = argValue("--source") ?? "file";
  const appName = argValue("--app");
  const mappingPath = argValue("--mapping");
  if (!databaseUrl || !appName || !mappingPath) {
    console.error(
      "pm:sync: PM_DATABASE_URL env + --app <name> --mapping <file.json> are required.",
    );
    process.exit(1);
  }
  const mapping = asEntityMapping(
    JSON.parse(readFileSync(mappingPath, "utf8")),
  );

  const pool = new pg.Pool({ connectionString: databaseUrl });
  const deps = {
    graph: new PostgresGraph(pool),
    events: new PostgresEventStore(pool),
  };
  try {
    let result;
    if (source === "liquid") {
      const url = argValue("--url");
      const sourceName = argValue("--entity");
      const externalIdField = argValue("--external-id");
      if (!url || !sourceName || !externalIdField) {
        console.error(
          "pm:sync --source liquid: --url --entity --external-id are required.",
        );
        process.exit(1);
      }
      const [command, ...cmdArgs] = (
        argValue("--liquid-cmd") ?? "uvx liquid-mcp"
      ).split(/\s+/);
      const endpoint = argValue("--endpoint");
      // Spawn the sidecar over stdio MCP (SDK loaded lazily so the file
      // source stays dependency-free).
      const { Client } = await import(
        "@modelcontextprotocol/sdk/client/index.js"
      );
      const { StdioClientTransport } = await import(
        "@modelcontextprotocol/sdk/client/stdio.js"
      );
      const client = new Client({ name: "pm-sync-liquid", version: "0.1.0" });
      await client.connect(
        new StdioClientTransport({ command: command!, args: cmdArgs }),
      );
      try {
        result = await syncFromLiquid(deps, client, {
          tenantId: TENANT,
          appName,
          mapping,
          url,
          sourceName,
          externalIdField,
          ...(endpoint ? { endpoint } : {}),
          syncedBy: AGENT,
        });
        console.log(
          `liquid adapter=${result.adapterId} mapping=${result.mappingHash} skippedMissingId=${result.skippedMissingId}`,
        );
      } finally {
        await client.close();
      }
    } else {
      const recordsPath = argValue("--records");
      if (!recordsPath) {
        console.error("pm:sync --source file: --records <file.json> is required.");
        process.exit(1);
      }
      const records = JSON.parse(
        readFileSync(recordsPath, "utf8"),
      ) as readonly SourceRecord[];
      result = await runEntityMappingSync(deps, {
        tenantId: TENANT,
        appName,
        mapping,
        records,
        syncedBy: AGENT,
      });
    }
    console.log(
      `sync ${appName}: created=${result.created} updated=${result.updated} unchanged=${result.unchanged} edges+${result.edgesCreated}/=${result.edgesUnchanged} rejected=${result.rejected.length}`,
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
