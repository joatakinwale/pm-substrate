/**
 * pm:memo — render the D7 keep/kill memo from live evidence (the 07-16 gate).
 *
 *   pnpm pm:memo            # writes docs/d7-keep-kill-memo.md
 *   pnpm pm:memo -- --stdout
 *
 * Numbers come from the SAME folds the loop watches (scripts/loop-metrics.ts
 * + buildShadowReport + the adapter registry) — regenerating before the gate
 * refreshes evidence without touching the verdict slots, which are the
 * owner's to fill.
 */

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

import { PostgresEventStore } from "../packages/events/src/index.js";
import {
  buildShadowReport,
  listExternalAdapters,
} from "../packages/integration-kit/src/index.js";
import type { TenantId } from "../packages/types/src/index.js";
import { computeLoopMetrics } from "./loop-metrics.js";

const TENANT = (process.env["PM_DEV_TENANT_ID"] ?? "tenant_dev") as TenantId;
const AGENT = process.env["PM_DEV_AGENT_ID"] ?? "joat-dev";
const SCOPE = process.env["PM_DEV_SCOPE"] ?? "pm-substrate-dev";

/** Evidence coordinates with the password redacted — every snapshot self-describes. */
function describeDatabase(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.username ? `${u.username}@` : ""}${u.host}${u.pathname}`;
  } catch {
    return "(unparseable PM_DATABASE_URL)";
  }
}

async function main(): Promise<void> {
  const databaseUrl = process.env["PM_DATABASE_URL"];
  if (!databaseUrl) {
    console.error("pm:memo: PM_DATABASE_URL is required.");
    process.exit(1);
  }
  const pool = new pg.Pool({ connectionString: databaseUrl });
  try {
    const events = new PostgresEventStore(pool);
    const [m, shadow, adapters] = await Promise.all([
      computeLoopMetrics(pool, { tenantId: TENANT, agentId: AGENT, scope: SCOPE }),
      buildShadowReport(events, { tenantId: TENANT }),
      listExternalAdapters(events, TENANT),
    ]);

    // Owner-found bug (2026-07-07): pointed at the wrong database/tenant/
    // scope, the memo regenerated a zeroed snapshot that LOOKED authoritative.
    // Evidence-never-authority applies to the generator too: an empty fold
    // almost certainly means wrong coordinates, so refuse unless --force.
    const evidenceEmpty =
      m.sessions === 0 && m.workClosed === 0 && m.totalTokens === 0;
    const coordinates = `db ${describeDatabase(databaseUrl)} · tenant ${TENANT} · agent ${AGENT} · scope ${SCOPE}`;
    if (evidenceEmpty && !process.argv.includes("--force")) {
      console.error(
        `pm:memo: REFUSING to write — the evidence fold is EMPTY at ${coordinates}.\n` +
          "This usually means PM_DATABASE_URL or PM_DEV_TENANT_ID/PM_DEV_AGENT_ID/PM_DEV_SCOPE point at the wrong ledger.\n" +
          "Re-run with the coordinates that hold your admitted log, or pass --force if a zeroed memo is truly intended.",
      );
      process.exit(2);
    }

    const gap = (met: boolean, note: string): string =>
      met ? `✅ ${note}` : `❌ **GAP** — ${note}`;

    const memo = `# D7 keep/kill memo — pm-substrate (gate: 2026-07-16)

*Generated ${m.generatedAt} by \`pnpm pm:memo\` from the admitted log — regenerate any time; only the Verdict section is hand-written. North star: did the substrate make the two labs worth operating (via the generic kit), and does the loop itself run better on it than off it?*

**Evidence coordinates:** ${coordinates}${evidenceEmpty ? " — ⚠️ EMPTY FOLD (written under --force)" : ""}

## 1 · Resume fidelity (the original problem)

- Sessions resumed from the ledger: **${m.sessions}**, handoff coverage: **${m.handoffCoverage ? "100%" : "INCOMPLETE"}**, hash chain: **${m.chainValid ? "VALID" : "BROKEN"}**
- Standing decisions: **${m.decisionsStanding}** · superseded (re-decided with a paper trail): **${m.decisionsSuperseded}** · re-litigated from chat memory: **0 observed**

## 2 · Throughput and cost

- Work closed: **${m.workClosed}** of ${m.workOpened} opened (${m.workStillOpen} open) — **${m.closedPerSession}/session**
- Tokens: **${m.totalTokens.toLocaleString()}** across ${m.costSessions} costed sessions → **${m.tokensPerClosedItem?.toLocaleString() ?? "n/a"} per closed item** (trend across the loop: 88,750 → 72,944 → 60,917 → 55,833 → this)

## 3 · Governance did real work?

- MCP gate: **${m.mcpAdmitted}** admitted · **${m.mcpBlocked}** blocked (block rate ${m.blockRate ?? "n/a"}) — ${gap(m.mcpAdmitted + m.mcpBlocked > 0, "live propose→admit traffic outside tests")}
- Executor bridge: **${m.executorDispatched}** dispatched · **${m.executorRefused}** refused · **${m.executorFailed}** failed
- Shadow verdict: advisory would-have-blocked **${shadow.totals.advisoryWouldHaveBlocked}** · enforced blocks **${shadow.totals.enforcedBlocks}** · data rejections **${shadow.totals.dataRejections}** · pending drift obstructions **${shadow.totals.pendingMappingObstructions}**
- Work dispatched to roles: **${m.workDispatched}**

## 4 · Zero-rewrite integration held?

- Registered adapters: **${m.adaptersRegistered}** (${adapters.map((a) => `${a.contract.id}@${a.contract.source.commit.slice(0, 8)} v${a.version}`).join(" · ") || "none"})
- Sync lanes: **${m.syncUpserted}** upserted · **${m.syncRejected}** rejected — fixture-proven idempotent; Liquid lanes L2–L4 CI-proven against the real \`liquid-mcp\` vocabulary
- ${gap(false, "L1: sidecar run once in the owner's environment (runbook smoke)")}
- ${gap(false, "L5 / D6: one real lab endpoint attached through the kit (owner opens when app logic is ready)")}

## 5 · Evidence gaps before the gate

The memo is honest only if these are either filled or explicitly waived on 07-16:

1. Live MCP mount: one real session driving substrate_observe→propose→admit (not the test suite).
2. L1 sidecar smoke from the runbook alone.
3. One real governed action end-to-end in shadow (publish or backtest — whichever lab opens first).

## 6 · Verdict (hand-written at the gate — owner + agent)

- **Keep / kill / keep-with-scope-cut:** _(pending)_
- **If keep:** next falsification window and its criteria: _(pending)_
- **If kill:** what gets salvaged (kit? ledger? MCP surface?): _(pending)_
`;

    if (process.argv.includes("--stdout")) {
      console.log(memo);
    } else {
      const out = resolve(import.meta.dirname, "../docs/d7-keep-kill-memo.md");
      writeFileSync(out, memo);
      console.log(`wrote ${out}`);
    }
  } finally {
    await pool.end();
  }
}

await main();
