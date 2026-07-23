#!/usr/bin/env tsx
/**
 * scripts/dispatch-unblocked-work.ts — ROADMAP D3 runtime consumer.
 * Computes unblocked pmgovernance WorkItems and dispatches each to its
 * accountable role as pm.work.dispatched events (basis-hash deduped).
 */
import { env, exit } from "node:process";
import pg from "pg";
import { PostgresEventStore } from "../packages/events/src/index.js";
import { dispatchUnblockedWork } from "../packages/capability-pmgovernance-stage-gate/src/index.js";
import type { TenantId } from "../packages/types/src/index.js";

const url = env["PM_DATABASE_URL"];
if (!url) { console.log("pm:dispatch skipped (PM_DATABASE_URL not set)"); exit(0); }
const tenant = (env["PM_DEV_TENANT_ID"] ?? "tenant_dev") as TenantId;
const main = async () => {
  const pool = new pg.Pool({ connectionString: url });
  const events = new PostgresEventStore(pool);
  try {
    const r = await dispatchUnblockedWork(pool, events, tenant);
    console.log(`pm:dispatch tenant=${tenant} unblocked=${r.unblocked.length} dispatched=${r.dispatched.length} deduped=${r.deduped.length} held=${r.held.length}`);
    for (const d of r.dispatched) console.log(`  -> ${d.workItemId} (${d.eventId})`);
  } finally { await events.close(); await pool.end(); }
};
main().catch((e) => { console.error(e); exit(1); });
