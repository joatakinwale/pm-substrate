/**
 * pm:shadow — the "what would have been blocked" report (hard req 5).
 *
 *   pnpm pm:shadow [-- --since 2026-07-01T00:00:00Z] [--until …] [--json]
 *
 * Folds the admitted log (never agent self-report): advisory warnings that
 * enforcement would have stopped, enforced blocks, data rejections, and
 * drift proposals awaiting a decision.
 */

import pg from "pg";

import { PostgresEventStore } from "../packages/events/src/index.js";
import { buildShadowReport } from "../packages/integration-kit/src/index.js";
import type { TenantId, Timestamp } from "../packages/types/src/index.js";

const TENANT = (process.env["PM_DEV_TENANT_ID"] ?? "tenant_dev") as TenantId;

function flag(name: string): string | undefined {
  const args = process.argv.slice(2);
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

async function main(): Promise<void> {
  const databaseUrl = process.env["PM_DATABASE_URL"];
  if (!databaseUrl) {
    console.error("pm:shadow: PM_DATABASE_URL is required.");
    process.exit(1);
  }
  const pool = new pg.Pool({ connectionString: databaseUrl });
  try {
    const since = flag("--since") as Timestamp | undefined;
    const until = flag("--until") as Timestamp | undefined;
    const report = await buildShadowReport(new PostgresEventStore(pool), {
      tenantId: TENANT,
      ...(since ? { since } : {}),
      ...(until ? { until } : {}),
    });
    if (process.argv.includes("--json")) {
      console.log(JSON.stringify(report, null, 2));
      return;
    }
    console.log(`# Shadow report — ${report.tenantId} @ ${report.generatedAt}`);
    console.log(
      `WOULD HAVE BLOCKED (advisory warnings): ${report.totals.advisoryWouldHaveBlocked}`,
    );
    console.log(`Enforced blocks:                        ${report.totals.enforcedBlocks}`);
    console.log(`Data rejections:                        ${report.totals.dataRejections}`);
    console.log(`Pending mapping obstructions:           ${report.totals.pendingMappingObstructions}`);
    console.log(
      `MCP: ${report.mcp.proposalsReviewed} proposals (${report.mcp.proposalsWithWarnings} warned, ${report.mcp.unverifiableArtifacts} unverifiable) · ${report.mcp.actionsAdmitted} admitted · ${report.mcp.actionsBlocked} blocked`,
    );
    for (const [code, n] of Object.entries(report.mcp.warningCodes)) {
      console.log(`  warn ${code}: ${n}`);
    }
    for (const [code, n] of Object.entries(report.mcp.blockingCauseCodes)) {
      console.log(`  block ${code}: ${n}`);
    }
    console.log(
      `Executor: ${report.executor.dispatched} dispatched · ${report.executor.refused} refused · ${report.executor.failed} failed`,
    );
    console.log(
      `Sync: ${report.sync.upserted} upserted · ${report.sync.rejected} rejected`,
    );
    for (const p of report.mappings.pendingProposals) {
      console.log(
        `PENDING mapping ${p.appName} ${p.mappingHash} [${p.origin}] since ${p.proposedAt} — decide with pm:mappings`,
      );
    }
  } finally {
    await pool.end();
  }
}

await main();
