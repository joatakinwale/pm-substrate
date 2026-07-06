/**
 * pm:mappings — mapping-approval CLI (Liquid lane L3 runtime consumer).
 *
 *   pnpm pm:mappings -- list <appName>
 *   pnpm pm:mappings -- propose <appName> <mapping.json> [--origin manual|liquid_discovery|liquid_repair] [--reason "…"]
 *   pnpm pm:mappings -- approve <appName> <mappingHash>
 *   pnpm pm:mappings -- reject  <appName> <mappingHash> [--reason "…"]
 *
 * Env: PM_DATABASE_URL (required), PM_DEV_TENANT_ID (default tenant_dev),
 *      PM_DEV_AGENT_ID (default joat-dev).
 */

import { readFileSync } from "node:fs";
import pg from "pg";

import { asEntityMapping } from "../packages/entity-mapping/src/index.js";
import { PostgresEventStore } from "../packages/events/src/index.js";
import {
  approveEntityMapping,
  getMappingApprovalState,
  proposeEntityMapping,
  rejectEntityMapping,
  type MappingProposalOrigin,
} from "../packages/integration-kit/src/index.js";
import type { TenantId } from "../packages/types/src/index.js";

const TENANT = (process.env["PM_DEV_TENANT_ID"] ?? "tenant_dev") as TenantId;
const AGENT = process.env["PM_DEV_AGENT_ID"] ?? "joat-dev";

function flag(name: string): string | undefined {
  const args = process.argv.slice(2);
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

async function main(): Promise<void> {
  const databaseUrl = process.env["PM_DATABASE_URL"];
  if (!databaseUrl) {
    console.error("pm:mappings: PM_DATABASE_URL is required.");
    process.exit(1);
  }
  const positional = process.argv
    .slice(2)
    .filter((a, i, all) => a !== "--" && !a.startsWith("--") && all[i - 1]?.startsWith("--") !== true);
  const [command, appName, third] = positional;
  if (!command || !appName) {
    console.error(
      "pm:mappings: usage — list <app> | propose <app> <mapping.json> | approve <app> <hash> | reject <app> <hash>",
    );
    process.exit(1);
  }
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const events = new PostgresEventStore(pool);
  try {
    if (command === "list") {
      const state = await getMappingApprovalState(events, TENANT, appName);
      console.log(
        state.approvedHash
          ? `approved: ${state.approvedHash} (by ${state.approvedBy})`
          : "approved: (none)",
      );
      for (const p of state.pending) {
        console.log(
          `pending:  ${p.mappingHash} [${p.origin}] by ${p.proposedBy} at ${p.proposedAt}${p.reason ? ` — ${p.reason}` : ""}`,
        );
      }
      if (state.pending.length === 0) console.log("pending:  (none)");
    } else if (command === "propose") {
      if (!third) throw new Error("propose needs <mapping.json>");
      const mapping = asEntityMapping(JSON.parse(readFileSync(third, "utf8")));
      const origin = (flag("--origin") ?? "manual") as MappingProposalOrigin;
      const reason = flag("--reason");
      const result = await proposeEntityMapping(events, {
        tenantId: TENANT,
        appName,
        mapping,
        proposedBy: AGENT,
        origin,
        ...(reason !== undefined ? { reason } : {}),
      });
      console.log(
        result.alreadyApproved
          ? `already approved: ${result.mappingHash}`
          : result.proposed
            ? `proposed: ${result.mappingHash}`
            : `already pending: ${result.mappingHash}`,
      );
    } else if (command === "approve" || command === "reject") {
      if (!third) throw new Error(`${command} needs <mappingHash>`);
      const reason = flag("--reason");
      const input = {
        tenantId: TENANT,
        appName,
        mappingHash: third,
        decidedBy: AGENT,
        ...(reason !== undefined ? { reason } : {}),
      };
      if (command === "approve") await approveEntityMapping(events, input);
      else await rejectEntityMapping(events, input);
      console.log(`${command}d: ${third}`);
    } else {
      console.error(`pm:mappings: unknown command "${command}"`);
      process.exit(1);
    }
  } finally {
    await pool.end();
  }
}

await main();
