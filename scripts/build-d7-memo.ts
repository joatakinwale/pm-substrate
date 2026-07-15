/**
 * pm:memo — render the D7 public-proof decision memo from verified evidence.
 *
 *   pnpm pm:memo            # writes docs/d7-keep-kill-memo.md
 *   pnpm pm:memo -- --stdout
 *
 * Ledger numbers come from the same folds the loop watches. Public efficacy
 * can enter only through a hash-verified decision bundle with all six
 * externally authenticated verification receipts; repository-authored conformance and app
 * scorecards remain separate evidence layers.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

import {
  DEFAULT_BUSINESS_OPERABILITY_THRESHOLDS,
  deriveObjectiveIntegrationEvidence,
  evaluateBusinessOperabilityObjective,
  foldObjectiveLabMeasurements,
  parseObjectiveLabMeasurement,
  summarizeLocalAgentLabMechanismEvidence,
  type EvalEvent,
  type LocalAgentLabMechanismEvidenceSummary,
  type ObjectiveLabEvidence,
  type ObjectiveLabMeasurement,
  type ObjectiveIntegrationEvidenceEvent,
} from "../packages/evals/src/index.js";
import {
  analyzePublicEval,
  evaluatePublicEvalDecisionBundle,
  type PublicEvalAnalysisReport,
  type PublicEvalDecisionBundleInput,
  type PublicEvalDecisionReport,
} from "../packages/public-eval-analysis/src/index.js";
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

interface PublicEvidenceInput {
  readonly analysis: PublicEvalAnalysisReport | null;
  readonly decision: PublicEvalDecisionReport | null;
  readonly source: "none" | "analysis_only" | "decision_bundle";
}

function argumentValue(flag: string, environmentVariable: string): string | null {
  const argumentIndex = process.argv.indexOf(flag);
  const value =
    (argumentIndex === -1 ? undefined : process.argv[argumentIndex + 1]) ??
    process.env[environmentVariable];
  return value === undefined || value.trim() === "" ? null : value;
}

function readPublicEvidence(): PublicEvidenceInput {
  const decisionPath = argumentValue(
    "--public-decision-bundle",
    "PM_PUBLIC_EVAL_DECISION_BUNDLE",
  );
  const analysisPath = argumentValue(
    "--public-analysis",
    "PM_PUBLIC_EVAL_ANALYSIS_INPUT",
  );
  if (decisionPath !== null && analysisPath !== null) {
    throw new Error(
      "supply either --public-decision-bundle or --public-analysis, not both",
    );
  }
  if (decisionPath !== null) {
    const trustPolicyPath = argumentValue(
      "--public-trust-policy",
      "PM_PUBLIC_EVAL_TRUST_POLICY",
    );
    const expectedTrustPolicyHash = argumentValue(
      "--public-trust-policy-hash",
      "PM_PUBLIC_EVAL_TRUST_POLICY_SHA256",
    );
    if (trustPolicyPath === null || expectedTrustPolicyHash === null) {
      throw new Error(
        "a decision bundle requires --public-trust-policy and an out-of-band --public-trust-policy-hash",
      );
    }
    const input = JSON.parse(
      readFileSync(resolve(decisionPath), "utf8"),
    ) as PublicEvalDecisionBundleInput;
    const trustPolicy = JSON.parse(
      readFileSync(resolve(trustPolicyPath), "utf8"),
    ) as unknown;
    const decision = evaluatePublicEvalDecisionBundle(
      input,
      trustPolicy,
      expectedTrustPolicyHash,
    );
    return { analysis: decision.analysis, decision, source: "decision_bundle" };
  }
  if (analysisPath !== null) {
    const input = JSON.parse(
      readFileSync(resolve(analysisPath), "utf8"),
    ) as Parameters<typeof analyzePublicEval>[0];
    return {
      analysis: analyzePublicEval(input),
      decision: null,
      source: "analysis_only",
    };
  }
  return { analysis: null, decision: null, source: "none" };
}

function publicDecision(evidence: PublicEvidenceInput): {
  readonly status:
    | "unproven"
    | "failed"
    | "confirmatory_only"
    | "owner_authorization_required";
  readonly text: string;
} {
  if (evidence.decision === null) {
    return {
      status: "unproven",
      text:
        evidence.source === "analysis_only"
          ? "A statistical analysis was supplied, but analysis alone cannot authorize KEEP. The exact attempt set still lacks the complete, bound independent-verification bundle."
          : "No verified public evidence bundle was supplied. Harness and conformance work cannot decide efficacy.",
    };
  }
  if (evidence.decision.evidenceEligibleUnderSuppliedPolicy) {
    return {
      status: "owner_authorization_required",
      text: "EVIDENCE ELIGIBLE UNDER THE SUPPLIED POLICY, NOT KEEP: sealed confirmation, distinct-model replication, preregistration/timestamp bindings, and all six signed verification receipts passed the automated checks. The report is evidence only; a separate owner authorization over this exact report hash is still required before any operational consequence.",
    };
  }
  const report = evidence.decision.analysis;
  if (report.confirmatoryPassed) {
    return {
      status: report.replicationPassed ? "failed" : "confirmatory_only",
      text: report.replicationPassed
        ? `NOT ELIGIBLE: statistical confirmation and replication passed, but the evidence-verification gate failed (${evidence.decision.reasons.join("; ")}). Do not resume app transfer work.`
        : "UNPROVEN: confirmation passed, but distinct-model replication did not pass the complete decision gate. Do not resume app transfer work.",
    };
  }
  return {
    status: "failed",
    text: "REPAIR, NARROW, OR KILL the current causal claim: the sealed confirmatory phase failed at least one frozen decision criterion.",
  };
}

function renderPublicPhase(
  report: PublicEvalAnalysisReport | null,
  phase: "qualification" | "confirmatory" | "replication",
): string {
  const result = report?.phases[phase];
  if (result == null) return `- **${phase}:** no verified phase report supplied`;
  return `- **${phase}:** ${result.decision.status} · ${result.taskCount} task(s) · ${result.exactArmTriples} exact native/sham/substrate trio(s) · strict-completion lift **${result.primary.lift.toFixed(4)}** · reliable-task lift **${result.reliableTaskSuccessLift.toFixed(4)}** · paired CI [${result.primary.pairedBootstrap.low.toFixed(4)}, ${result.primary.pairedBootstrap.high.toFixed(4)}] · cost ratio ${result.unitEconomics.costPerStrictSuccessRatio?.toFixed(4) ?? "not comparable"} · latency ratio ${result.unitEconomics.latencyPerStrictSuccessRatio?.toFixed(4) ?? "not comparable"}${result.decision.reasons.length > 0 ? ` · ${result.decision.reasons.join("; ")}` : ""}`;
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

interface LiveLabEvidence extends LocalAgentLabMechanismEvidenceSummary {
  readonly runDate: string;
  readonly model: string;
  readonly suiteRunId: string | null;
}

/**
 * Latest identified local-agent-lab mechanism suite. Unlike the previous
 * date-level count fold, this reopens raw EvalEvents and lets only exact,
 * uniquely identified two-arm attempts contribute. Legacy date aggregates
 * remain visible but cannot produce a passing evidence summary.
 */
async function summarizeLiveLabEvidence(
  pool: pg.Pool,
): Promise<LiveLabEvidence | null> {
  const latestIdentified = await pool.query<{
    suite_run_id: string;
  }>(
    `SELECT event->>'suiteRunId' AS suite_run_id
       FROM evals.eval_events
      WHERE axis = 'local_lab'
        AND event->>'evidenceStage' = 'live_run'
        AND nullif(event->>'suiteRunId', '') IS NOT NULL
      ORDER BY observed_at DESC, id DESC
      LIMIT 1`,
  );
  const suiteRunId = latestIdentified.rows[0]?.suite_run_id ?? null;
  const { rows } = await pool.query<{
    event: EvalEvent;
    source: string;
    run_date: string;
  }>(
    suiteRunId === null
      ? `WITH latest AS (
           SELECT max(observed_at)::date AS d
             FROM evals.eval_events
            WHERE axis = 'local_lab'
         )
         SELECT e.event, e.source, latest.d::text AS run_date
           FROM evals.eval_events e, latest
          WHERE e.axis = 'local_lab'
            AND e.observed_at::date = latest.d
          ORDER BY e.observed_at ASC, e.id ASC`
      : `SELECT event, source, observed_at::date::text AS run_date
           FROM evals.eval_events
          WHERE axis = 'local_lab'
            AND event->>'evidenceStage' = 'live_run'
            AND event->>'suiteRunId' = $1
          ORDER BY observed_at ASC, id ASC`,
    suiteRunId === null ? [] : [suiteRunId],
  );
  const first = rows[0];
  if (first === undefined) return null;
  const summary = summarizeLocalAgentLabMechanismEvidence(
    rows.map((row) => row.event),
  );
  return {
    ...summary,
    runDate: first.run_date,
    model: first.source.split("/")[1] ?? "unknown",
    suiteRunId,
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
    const publicEvidence = readPublicEvidence();
    const publicReport = publicEvidence.analysis;
    const publicDecisionReport = publicEvidence.decision;
    const publicGate = publicDecision(publicEvidence);
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
        livePairedScenarios:
          lab?.mutantControlGatePassed === true ? lab.exactPairs : 0,
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
    const publicGaps = [
      publicDecisionReport === null
        ? "No complete verified public evidence bundle was supplied to this memo."
        : null,
      publicReport !== null && !publicReport.confirmatoryPassed
        ? "The sealed confirmatory public phase did not pass every frozen criterion."
        : null,
      publicReport !== null && !publicReport.replicationPassed
        ? "Distinct-model replication has not passed every frozen criterion."
        : null,
      publicDecisionReport?.evidenceEligibleUnderSuppliedPolicy === true
        ? `The automated report is conditionally evidence-eligible, but owner authorization over decision report ${publicDecisionReport.decisionReportHash} is still required.`
        : null,
      ...(publicDecisionReport?.reasons ?? []),
    ].filter((item): item is string => item !== null);
    const publicGapText =
      publicGaps.length === 0
        ? "No eligible evidence bundle was supplied; no operational decision can be made."
        : publicGaps.map((item, index) => `${index + 1}. ${item}`).join("\n");

    const memo = `# D7 public-proof decision memo — pm-substrate

*Generated ${m.generatedAt} by \`pnpm pm:memo\`. The north star is a causal one: does pm-substrate improve strict outcomes on independent public agent-state tasks over both native and sham controls? There is no calendar waiver. Repository-authored fixtures, event counts, and blocked actions never substitute for the benchmark oracle.*

**Evidence coordinates:** ${coordinates}${evidenceEmpty ? " — ⚠️ EMPTY FOLD (written under --force)" : ""}

## 1 · Public causal decision gate

- **Current status:** \`${publicGate.status}\`
- **Decision:** ${publicGate.text}
- **Evidence input:** ${publicReport === null ? "none" : `${publicEvidence.source === "decision_bundle" ? "decision bundle" : "analysis only (diagnostic; ineligible for KEEP)"} · experiment \`${publicReport.experimentId}\` · benchmark \`${publicReport.benchmark.benchmarkId}@${publicReport.benchmark.revision}\` · manifest \`${publicReport.manifestHash}\``}
- **Exact-pair admission:** ${publicReport === null ? "not evaluated" : `${publicReport.pairing.admittedAttemptArtifacts}/${publicReport.pairing.expectedAttemptArtifacts} attempt artifact(s), ${publicReport.pairing.exactTaskRepeatTriples} exact task-repeat trio(s)`}
- **Verification evidence (non-authoritative):** ${publicDecisionReport === null ? "not admitted" : `decision report \`${publicDecisionReport.decisionReportHash}\` · out-of-band trust policy \`${publicDecisionReport.trustPolicyHash}\` · attempt-set root \`${publicDecisionReport.attemptSetRootHash}\` · evidence-set root \`${publicDecisionReport.evidenceSetRootHash}\` · ${Object.entries(publicDecisionReport.verificationReceiptHashes).map(([kind, hash]) => `${kind}=\`${hash ?? "missing"}\` signed by \`${publicDecisionReport.verificationSignerIdentities[kind as keyof typeof publicDecisionReport.verificationSignerIdentities] ?? "missing"}\``).join(" · ")}`}

${renderPublicPhase(publicReport, "qualification")}
${renderPublicPhase(publicReport, "confirmatory")}
${renderPublicPhase(publicReport, "replication")}

Qualification is exploratory. Sealed confirmation, distinct-model replication, signed preregistration/timestamp bindings, and all six bound verification receipts can at most set \`evidenceEligibleUnderSuppliedPolicy=true\`. That report is non-authoritative and cannot emit KEEP; a separate owner authorization over the exact decision-report hash is mandatory. Per-strict-success cost and latency are decision criteria, not diagnostics.

## 2 · Continuity and evidence integrity

- Sessions resumed from the ledger: **${m.sessions}**, handoff coverage: **${m.handoffCoverage ? "100%" : "INCOMPLETE"}**, hash chain: **${m.chainValid ? "VALID" : "BROKEN"}**
- Standing decisions: **${m.decisionsStanding}** · superseded (re-decided with a paper trail): **${m.decisionsSuperseded}** · re-litigated from chat memory: **0 observed**
- Work closed: **${m.workClosed}** of ${m.workOpened} opened (${m.workStillOpen} open) — **${m.closedPerSession}/session**
- Tokens: **${m.totalTokens.toLocaleString()}** across ${m.costSessions} costed sessions → **${m.tokensPerClosedItem?.toLocaleString() ?? "n/a"} per closed item**

## 3 · Runtime technical baseline (not public efficacy)

- MCP gate: **${m.mcpAdmitted}** admitted · **${m.mcpBlocked}** blocked (block rate ${m.blockRate ?? "n/a"}) — ${gap(m.mcpAdmitted + m.mcpBlocked > 0, "live propose→admit traffic outside tests")}
- Executor bridge: **${m.executorDispatched}** dispatched · **${m.executorRefused}** refused · **${m.executorFailed}** failed
- Shadow verdict: advisory would-have-blocked **${shadow.totals.advisoryWouldHaveBlocked}** · enforced blocks **${shadow.totals.enforcedBlocks}** · data rejections **${shadow.totals.dataRejections}** · pending drift obstructions **${shadow.totals.pendingMappingObstructions}**
- Work dispatched to roles: **${m.workDispatched}**
- Registered adapters: **${m.adaptersRegistered}** (${adapters.map((a) => `${a.contract.id}@${a.contract.source.commit.slice(0, 8)} v${a.version}`).join(" · ") || "none"})
- Sync lanes: **${m.syncUpserted}** upserted · **${m.syncRejected}** rejected — fixture-proven idempotent; Liquid lanes L2–L4 CI-proven against the real \`liquid-mcp\` vocabulary
- ${gap(evidence.l5ReadAttach || evidence.governedWrite, "L1: sidecar run once in the owner's environment (runbook smoke)")}
- ${gap(evidence.l5ReadAttach, "L5 / D6 read attach: one real lab endpoint attached through the kit")}
- ${gap(evidence.governedWrite, "L4 governed write: blocked envelope refused, accepted envelope dispatched, replay deduped")}

Technical ledger evidence gaps, which do not alter the public decision:

${evidenceGapText}

## 4 · Internal mechanism/conformance evidence (Axis C — not efficacy proof)

${
  lab
    ? `- Classification: \`${lab.evidenceClaim}\`. These repository-authored controls test mechanism behavior only; they cannot establish benefit on an independent task.
- Latest suite: **${lab.runDate}** on **${lab.model}** · suite **${lab.suiteRunId ?? "legacy/unidentified"}** · **${lab.exactPairs}** exact pair(s) across ${lab.scenarios} scenario(s)
- Pair integrity: **${lab.exactPairIntegrityPassed ? "PASS" : "FAIL"}** · ${lab.invalidPairedGroups} imbalanced, duplicate, or identity-mismatched pair group(s)
- Expected-block controls: **${lab.protectivePairs}/${lab.expectedBlockPairs}** produced the predeclared baseline-fail/substrate-block pattern
- Expected-allow controls: **${lab.passingExpectedAllowPairs}/${lab.expectedAllowPairs}** remained accepted in both arms
- Mutant sensitivity: allow-all **${lab.allowAllMutantRejected ? "REJECTED" : "NOT REJECTED"}** · block-all **${lab.blockAllMutantRejected ? "REJECTED" : "NOT REJECTED"}** · gate **${lab.mutantControlGatePassed ? "PASS" : "FAIL"}**`
    : "- ❌ **GAP** — no live lab events persisted; run `pnpm evals:local-agent-lab:live`"
}

## 5 · Deferred app-transfer scorecard (excluded from D6/D7 efficacy)

PluggedInSocial and ArrowHedge remain frozen. Their historical business-operability scorecard is preserved for a possible post-keep transfer phase, but neither app may design, tune, score, or rescue the public causal claim.

- **Historical transfer verdict ceiling:** \`${objective.verdictCeiling}\`
- **Historical transfer objective ready:** ${objective.objectiveReady ? "YES" : "NO"}
- **Objective measurement events:** ${measurementFold.latest.length} valid latest lab record(s) · ${measurementFold.invalid} invalid event(s)${objectiveWarningText ? `\n${objectiveWarningText}` : ""}

${objectiveDimensionText}

## 6 · Open public-proof gates

${publicGapText}

Use \`pnpm pm:memo -- --public-decision-bundle path/to/decision-bundle.json --public-trust-policy path/to/trust-policy.json --public-trust-policy-hash OWNER_PINNED_SHA256\` to verify the sealed manifest, 31 procedure-versioned structured assertions, preregistration/timestamp attestations, and six signed receipts. The current D7 v4 path remains diagnostic-only and always \`not_eligible\` until adapter-specific procedures derive each fact from bound raw records. The expected policy hash must come from an owner/CI channel outside the bundle. \`--public-analysis\` remains diagnostic-only. Neither this command nor a hand-written verdict can authorize KEEP; owner authorization is a separate trust boundary.

## 7 · Operational consequence

- **Apps:** remain frozen; this evidence report cannot authorize PluggedInSocial or ArrowHedge transfer work.
- **Claim:** ${publicGate.status === "owner_authorization_required" ? "the exact benchmark/model/task evidence is conditionally eligible under the supplied policy, but no KEEP decision exists" : "no demonstrated public causal benefit yet"}.
- **Next action:** ${publicGate.status === "failed" ? "classify the observed failures, research the smallest repair, rerun qualification, and seal a new confirmatory manifest" : publicGate.status === "owner_authorization_required" ? "archive the exact signed bundle, externally anchored preregistration, policy pin, and decision-report hash; request a separate owner decision without changing app state" : "complete real public matched-arm execution and distinct-model replication"}.
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
