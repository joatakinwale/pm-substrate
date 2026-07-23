/**
 * pm:adapters — external adapter registry CLI (the D5a runtime consumer).
 *
 *   pnpm pm:adapters -- seed                 # register pi harness + canary
 *   pnpm pm:adapters -- list                 # current registry (folded)
 *   pnpm pm:adapters -- register <file.json> # register a validated contract
 *
 * Env: PM_DATABASE_URL (required), PM_DEV_TENANT_ID (default tenant_dev),
 *      PM_DEV_AGENT_ID (default joat-dev).
 */

import { readFileSync } from "node:fs";
import pg from "pg";

import { PostgresEventStore } from "../packages/events/src/index.js";
import {
  KNOWN_EXTERNAL_ADAPTERS,
  listExternalAdapters,
  parseExternalAdapterContract,
  registerExternalAdapter,
} from "../packages/integration-kit/src/index.js";
import type { TenantId } from "../packages/types/src/index.js";

const TENANT = (process.env["PM_DEV_TENANT_ID"] ?? "tenant_dev") as TenantId;
const AGENT = process.env["PM_DEV_AGENT_ID"] ?? "joat-dev";

async function main(): Promise<void> {
  const databaseUrl = process.env["PM_DATABASE_URL"];
  if (!databaseUrl) {
    console.error("pm:adapters: PM_DATABASE_URL is required.");
    process.exit(1);
  }
  const [command, fileArg] = process.argv
    .slice(2)
    .filter((a) => a !== "--");
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const events = new PostgresEventStore(pool);

  try {
    if (command === "seed") {
      for (const contract of KNOWN_EXTERNAL_ADAPTERS) {
        const result = await registerExternalAdapter(events, {
          tenantId: TENANT,
          registeredBy: AGENT,
          contract,
        });
        console.log(
          `${result.registered ? "registered" : "unchanged "} ${result.adapterId} v${result.version} (${result.contentHash})`,
        );
      }
    } else if (command === "register") {
      if (!fileArg) {
        console.error("pm:adapters register: path to a contract JSON file required.");
        process.exit(1);
      }
      const contract = parseExternalAdapterContract(
        JSON.parse(readFileSync(fileArg, "utf8")),
      );
      const result = await registerExternalAdapter(events, {
        tenantId: TENANT,
        registeredBy: AGENT,
        contract,
      });
      console.log(
        `${result.registered ? "registered" : "unchanged"} ${result.adapterId} v${result.version} (${result.contentHash})`,
      );
    } else if (command === "list" || command === undefined) {
      const adapters = await listExternalAdapters(events, TENANT);
      if (adapters.length === 0) {
        console.log("(no adapters registered — try: pnpm pm:adapters -- seed)");
      }
      for (const a of adapters) {
        console.log(
          `${a.contract.id} v${a.version} [${a.contract.adapterType}/${a.contract.boundary}] ${a.contract.source.url}@${a.contract.source.commit.slice(0, 8)} gates=${a.contract.requiredGates.join(",")}`,
        );
      }
    } else {
      console.error(`pm:adapters: unknown command "${command}" (seed | list | register <file>).`);
      process.exit(1);
    }
  } finally {
    await pool.end();
  }
}

await main();
