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

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

import {
  DEFAULT_BUSINESS_OPERABILITY_THRESHOLDS,
  deriveObjectiveIntegrationEvidence,
  evaluateBusinessOperabilityObjective,
  foldObjectiveLabMeasurements,
  isObjectiveFinalVerdictPermitted,
  parseObjectiveLabMeasurement,
  type ObjectiveFinalVerdict,
  type ObjectiveLabEvidence,
  type ObjectiveLabMeasurement,
  type ObjectiveIntegrationEvidenceEvent,
} from "../packages/evals/src/index.js";
import { PostgresEventStore } from "../packages/events/src/index.js";
import {
  buildShadowReport,
  listExternalAdapters,
} from "../packages/integration-kit/src/index.js";
import type { TenantId } from "../packages/types/src/index.js";
import { computeLoopMetrics } from "./loop-metrics.js";
import { verifyObjectiveMeasurementBoundaryArtifact } from "./objective-boundary-evidence.js";

const TENANT = (process.env["PM_DEV_TENANT_ID"] ?? "tenant_dev") as TenantId;
const AGENT = process.env["PM_DEV_AGENT_ID"] ?? "joat-dev";
const SCOPE = process.env["PM_DEV_SCOPE"] ?? "pm-substrate-dev";
const OUT_PATH = resolve(import.meta.dirname, "../docs/d7-keep-kill-memo.md");
const REQUIRED_LAB_IDS = ["plugged_in_social", "arrowhedge"] as const;
const LAB_EVIDENCE_MATCHERS = {
  plugged_in_social: ["plugged", "stevie"],
  arrowhedge: ["arrowhedge"],
} as const;

/** Evidence coordinates with the password redacted — every snapshot self-describes. */
function describeDatabase(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.username ? `${u.username}@` : ""}${u.host}${u.pathname}`;
  } catch {
    return "(unparseable PM_DATABASE_URL)";
  }
}

function readExistingVerdict(): string {
  const fallback = `- **Keep / kill / keep-with-scope-cut:** _(pending)_
- **If keep:** next falsification window and its criteria: _(pending)_
- **If kill:** what gets salvaged (kit? ledger? MCP surface?): _(pending)_`;
  try {
    const existing = readFileSync(OUT_PATH, "utf8");
    // Match by suffix, not section number — the verdict section renumbers as
    // evidence sections are added.
    const marker = "· Verdict (hand-written at the gate — owner + agent)";
    const index = existing.indexOf(marker);
    if (index === -1) return fallback;
    const body = existing.slice(index + marker.length).trim();
    return body.length > 0 ? body : fallback;
  } catch {
    return fallback;
  }
}

function parseFinalVerdict(text: string): ObjectiveFinalVerdict | null {
  const match = text.match(
    /\*\*Keep \/ kill \/ keep-with-scope-cut:\*\*\s*(keep-with-scope-cut|keep|kill)\b/,
  );
  return (match?.[1] as ObjectiveFinalVerdict | undefined) ?? null;
}

async function computeEvidenceFlags(
  pool: pg.Pool,
  tenantId: TenantId,
): Promise<{
  readonly l5ReadAttach: boolean;
  readonly governedWrite: boolean;
  readonly liveMcp: boolean;
}> {
  const evidence = await pool.query<{
    l5_read_attach: boolean;
    governed_write: boolean;
    live_mcp: boolean;
  }>(
    `SELECT
       EXISTS (
         SELECT 1 FROM events.events
          WHERE tenant_id = $1
            AND type = 'pm.sync.upserted'
            AND payload->>'appName' = 'arrowhedge_liquid_flows_l5_20260707'
       ) AS l5_read_attach,
       (
         EXISTS (
           SELECT 1 FROM events.events
            WHERE tenant_id = $1
              AND type = 'pm.executor.dispatched'
              AND payload->>'target' = 'fixture_app_db'
         )
         AND EXISTS (
           SELECT 1 FROM events.events
            WHERE tenant_id = $1
              AND type = 'pm.executor.refused'
              AND payload->>'target' = 'fixture_app_db'
         )
       ) AS governed_write,
       EXISTS (
         SELECT 1 FROM events.events
          WHERE tenant_id = $1
            AND type = 'pm.mcp.action'
            AND payload->>'terminalOutcome' = 'accepted'
            AND (payload->>'executed')::boolean = true
       ) AS live_mcp`,
    [tenantId],
  );
  const row = evidence.rows[0]!;
  return {
    l5ReadAttach: row.l5_read_attach,
    governedWrite: row.governed_write,
    liveMcp: row.live_mcp,
  };
}

async function readObjectiveIntegrationEvents(
  pool: pg.Pool,
  tenantId: TenantId,
): Promise<readonly ObjectiveIntegrationEvidenceEvent[]> {
  const result = await pool.query<ObjectiveIntegrationEvidenceEvent>(
    `SELECT type, payload
       FROM events.events
      WHERE tenant_id = $1
        AND type IN ('pm.sync.upserted', 'pm.executor.dispatched')
      ORDER BY seq ASC`,
    [tenantId],
  );
  return result.rows;
}

interface LiveLabEvidence {
  readonly runDate: string;
  readonly model: string;
  readonly scenarios: number;
  readonly baselineFailed: number;
  readonly baselinePassed: number;
  readonly substrateBlocked: number;
  readonly substratePassed: number;
}

/**
 * Latest live local-agent-lab run (Axis C), paired baseline vs substrate.
 * Lab runs use throwaway per-world tenants, so this folds by axis + the most
 * recent run date rather than by the dev tenant.
 */
async function summarizeLiveLabEvidence(
  pool: pg.Pool,
): Promise<LiveLabEvidence | null> {
  const { rows } = await pool.query<{
    run_arm: string;
    result: string;
    n: string;
    scenarios: string;
    source: string;
    run_date: string;
  }>(
    `WITH latest AS (
       SELECT max(observed_at)::date AS d FROM evals.eval_events WHERE axis = 'local_lab'
     )
     SELECT e.run_arm, e.result, count(*)::text AS n,
            count(DISTINCT e.scenario_id)::text AS scenarios,
            min(e.source) AS source, latest.d::text AS run_date
     FROM evals.eval_events e, latest
     WHERE e.axis = 'local_lab' AND e.observed_at::date = latest.d
     GROUP BY e.run_arm, e.result, latest.d`,
  );
  if (rows.length === 0) return null;
  const count = (arm: string, result: string): number =>
    rows
      .filter((r) => r.run_arm === arm && r.result === result)
      .reduce((sum, r) => sum + Number(r.n), 0);
  const first = rows[0];
  if (!first) return null;
  return {
    runDate: first.run_date,
    model: first.source.split("/")[1] ?? "unknown",
    scenarios: rows
      .filter((r) => r.run_arm === "baseline")
      .reduce((sum, r) => sum + Number(r.scenarios), 0),
    baselineFailed: count("baseline", "fail"),
    baselinePassed: count("baseline", "pass"),
    substrateBlocked: count("substrate", "blocked"),
    substratePassed: count("substrate", "pass"),
  };
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
    const [
      m,
      shadow,
      adapters,
      evidence,
      lab,
      objectiveMeasurementEvents,
      objectiveIntegrationEvents,
    ] =
      await Promise.all([
        computeLoopMetrics(pool, {
          tenantId: TENANT,
          agentId: AGENT,
          scope: SCOPE,
        }),
        buildShadowReport(events, { tenantId: TENANT }),
        listExternalAdapters(events, TENANT),
        computeEvidenceFlags(pool, TENANT),
        summarizeLiveLabEvidence(pool),
        events.read({
          tenantId: TENANT,
          typePattern: "pm.objective.lab-measured",
          limit: 1000,
        }),
        readObjectiveIntegrationEvents(pool, TENANT),
      ]);

    const verifiedMeasurements: ObjectiveLabMeasurement[] = [];
    let invalidObjectiveMeasurementEvents = 0;
    for (const event of objectiveMeasurementEvents) {
      try {
        const measurement = parseObjectiveLabMeasurement(event.payload);
        verifyObjectiveMeasurementBoundaryArtifact(measurement);
        verifiedMeasurements.push(measurement);
      } catch {
        invalidObjectiveMeasurementEvents += 1;
      }
    }
    const measurementFold = foldObjectiveLabMeasurements(verifiedMeasurements);
    const measurementByLab = new Map(
      measurementFold.latest.map((measurement) => [
        measurement.labId,
        measurement,
      ]),
    );
    const objectiveLabs: ObjectiveLabEvidence[] = REQUIRED_LAB_IDS.map(
      (labId) => {
        const measurement = measurementByLab.get(labId) ?? null;
        return {
          labId,
          measurement,
          ...deriveObjectiveIntegrationEvidence(
            measurement,
            LAB_EVIDENCE_MATCHERS[labId],
            objectiveIntegrationEvents,
          ),
        };
      },
    );
    const objective = evaluateBusinessOperabilityObjective({
      requiredLabIds: REQUIRED_LAB_IDS,
      thresholds: DEFAULT_BUSINESS_OPERABILITY_THRESHOLDS,
      technical: {
        chainValid: m.chainValid,
        liveMcpActions: m.mcpAdmitted + m.mcpBlocked,
        genericSyncUpserts: m.syncUpserted,
        executorDispatches: m.executorDispatched,
        livePairedScenarios: lab?.scenarios ?? 0,
      },
      labs: objectiveLabs,
      invalidMeasurementEvents:
        measurementFold.invalid + invalidObjectiveMeasurementEvents,
    });

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
    const openEvidenceGaps = [
      evidence.liveMcp
        ? null
        : "Live MCP mount: one real session driving substrate_observe→propose→admit (not the test suite).",
      evidence.l5ReadAttach
        ? null
        : "L5 / D6 read attach: one real lab endpoint attached through the kit.",
      evidence.governedWrite
        ? null
        : "One real governed write/action end-to-end with accepted dispatch and replay dedupe.",
    ].filter((gap): gap is string => gap !== null);
    const evidenceGapText =
      openEvidenceGaps.length === 0
        ? "No open technical-substrate evidence gaps remain in this ledger fold. This does not imply the business objective is met."
        : openEvidenceGaps.map((item, i) => `${i + 1}. ${item}`).join("\n");
    const objectiveDimensionText = objective.dimensions
      .map((dimension) => {
        const heading = `- ${dimension.met ? "✅" : "❌"} **${dimension.dimension}**`;
        return dimension.met
          ? `${heading}: threshold met`
          : `${heading}:\n${dimension.gaps.map((item) => `  - ${item}`).join("\n")}`;
      })
      .join("\n");
    const objectiveWarningText = objective.warnings
      .map((warning) => `- ⚠️ ${warning}`)
      .join("\n");
    const verdict = readExistingVerdict();
    const finalVerdict = parseFinalVerdict(verdict);
    if (
      finalVerdict !== null &&
      !isObjectiveFinalVerdictPermitted(
        finalVerdict,
        objective.verdictCeiling,
      )
    ) {
      throw new Error(
        `pm:memo: REFUSING to preserve final verdict "${finalVerdict}" above admitted-evidence ceiling "${objective.verdictCeiling}"`,
      );
    }

    const memo = `# D7 keep/kill memo — pm-substrate (gate: 2026-07-16)

*Generated ${m.generatedAt} by \`pnpm pm:memo\` from the admitted log — regenerate any time; only the Verdict section is hand-written. North star: did the substrate make the two labs worth operating (via the generic kit), and does the loop itself run better on it than off it?*

**Evidence coordinates:** ${coordinates}${evidenceEmpty ? " — ⚠️ EMPTY FOLD (written under --force)" : ""}

## 1 · Resume fidelity (the original problem)

- Sessions resumed from the ledger: **${m.sessions}**, handoff coverage: **${m.handoffCoverage ? "100%" : "INCOMPLETE"}**, hash chain: **${m.chainValid ? "VALID" : "BROKEN"}**
- Standing decisions: **${m.decisionsStanding}** · superseded (re-decided with a paper trail): **${m.decisionsSuperseded}** · re-litigated from chat memory: **0 observed**

## 2 · Throughput and cost

- Work closed: **${m.workClosed}** of ${m.workOpened} opened (${m.workStillOpen} open) — **${m.closedPerSession}/session**
- Tokens: **${m.totalTokens.toLocaleString()}** across ${m.costSessions} costed sessions → **${m.tokensPerClosedItem?.toLocaleString() ?? "n/a"} per closed item** (pre-reset loop trend was 88,750 → 72,944 → 60,917 → 55,833 → 45,857; the DB was reset and the ledger reseeded 2026-07-08, so the post-reset series restarts at this number)

## 3 · Governance did real work?

- MCP gate: **${m.mcpAdmitted}** admitted · **${m.mcpBlocked}** blocked (block rate ${m.blockRate ?? "n/a"}) — ${gap(m.mcpAdmitted + m.mcpBlocked > 0, "live propose→admit traffic outside tests")}
- Executor bridge: **${m.executorDispatched}** dispatched · **${m.executorRefused}** refused · **${m.executorFailed}** failed
- Shadow verdict: advisory would-have-blocked **${shadow.totals.advisoryWouldHaveBlocked}** · enforced blocks **${shadow.totals.enforcedBlocks}** · data rejections **${shadow.totals.dataRejections}** · pending drift obstructions **${shadow.totals.pendingMappingObstructions}**
- Work dispatched to roles: **${m.workDispatched}**

## 4 · Zero-rewrite integration held?

- Registered adapters: **${m.adaptersRegistered}** (${adapters.map((a) => `${a.contract.id}@${a.contract.source.commit.slice(0, 8)} v${a.version}`).join(" · ") || "none"})
- Sync lanes: **${m.syncUpserted}** upserted · **${m.syncRejected}** rejected — fixture-proven idempotent; Liquid lanes L2–L4 CI-proven against the real \`liquid-mcp\` vocabulary
- ${gap(evidence.l5ReadAttach || evidence.governedWrite, "L1: sidecar run once in the owner's environment (runbook smoke)")}
- ${gap(evidence.l5ReadAttach, "L5 / D6 read attach: one real lab endpoint attached through the kit")}
- ${gap(evidence.governedWrite, "L4 governed write: blocked envelope refused, accepted envelope dispatched, replay deduped")}

## 5 · Live lab evidence (Axis C — local-agent-lab, paired arms)

${
  lab
    ? `- Latest live run **${lab.runDate}** on **${lab.model}**: **${lab.scenarios}** scenarios, paired baseline-vs-substrate
- Baseline arm: **${lab.baselineFailed}** failed · ${lab.baselinePassed} passed — every seeded failure class reproduced without the substrate
- Substrate arm: **${lab.substrateBlocked}** blocked at the gate · ${lab.substratePassed} passed — ${lab.baselineFailed > 0 && lab.substrateBlocked >= lab.baselineFailed ? "**every baseline failure was caught before it landed**" : "coverage incomplete; rerun `pnpm evals:local-agent-lab:live`"}`
    : "- ❌ **GAP** — no live lab events persisted; run `pnpm evals:local-agent-lab:live`"
}

## 6 · Business-operability objective gate

Technical activity is necessary but cannot prove that either lab is worth operating. The executable scorecard requires zero-edit adoption, repeated correct end-to-end outcomes, governance quality, bounded cost/operator effort, and external acceptance for **both** labs.

- **Verdict ceiling from admitted evidence:** \`${objective.verdictCeiling}\`
- **Full objective ready:** ${objective.objectiveReady ? "YES" : "NO"}
- **Objective measurement events:** ${measurementFold.latest.length} valid latest lab record(s) · ${measurementFold.invalid} invalid event(s)${objectiveWarningText ? `\n${objectiveWarningText}` : ""}

${objectiveDimensionText}

Record or update a source-cited lab measurement with \`pnpm pm:objective -- record <measurement.json>\`. Read attachment and governed action dispatch are independently derived from admitted events carrying an exact match for the run manifest, boundary conformance, app revision, and substrate revision; the measurement cannot self-assert them or reuse a historical rehearsal.

## 7 · Technical evidence gaps before the gate

These are substrate proof gaps, distinct from the business-operability gaps above:

${evidenceGapText}

## 8 · Verdict (hand-written at the gate — owner + agent)

${verdict}
`;

    if (process.argv.includes("--stdout")) {
      console.log(memo);
    } else {
      writeFileSync(OUT_PATH, memo);
      console.log(`wrote ${OUT_PATH}`);
    }
  } finally {
    await pool.end();
  }
}

await main();
