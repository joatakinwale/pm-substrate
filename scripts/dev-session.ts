#!/usr/bin/env tsx
/**
 * scripts/dev-session.ts — the dogfood loop (refactor plan → prove-demand track).
 *
 * pm-substrate's own development runs THROUGH the substrate: every agent/human
 * session resumes from the continuity ledger instead of chat history, records
 * decisions/lessons/handoffs as checkpoints, logs token costs as events, and
 * reads a control-plane status derived from the admitted log.
 *
 * Commands:
 *   resume                       session-start briefing (context + chain check)
 *   checkpoint --kind K --title T --summary S [--status open|closed] [--refs a,b]
 *   handoff --summary S [--title T]   session-end handoff for the next session
 *   cost --prompt N --completion N [--model M] [--source reported|measured] [--label L]
 *   status                       control plane: work, governance, costs, integrity
 *   seed-dogfood                 one-time seed of the real engagement decisions
 *
 * Conventions: tenant = PM_DEV_TENANT_ID (tenant_dev), agent = PM_DEV_AGENT_ID
 * (joat-dev — shared so all sessions extend ONE hash chain), scope =
 * PM_DEV_SCOPE (pm-substrate-dev).
 */

import { env, argv, exit } from "node:process";
import pg from "pg";

import {
  PostgresContinuityLedger,
  buildContinuityContext,
  findContinuityContradictions,
  verifyContinuityCheckpointChain,
  type CheckpointKind,
  type ContinuityCheckpoint,
} from "../packages/continuity/src/index.js";
import { PostgresEventStore } from "../packages/events/src/index.js";
import type { EntityId, TenantId } from "../packages/types/src/index.js";
import { computeLoopMetrics } from "./loop-metrics.js";

const databaseUrl = env["PM_DATABASE_URL"];
if (!databaseUrl) {
  console.error("dev-session: PM_DATABASE_URL is not set.");
  exit(1);
}
const TENANT = (env["PM_DEV_TENANT_ID"] ?? "tenant_dev") as TenantId;
const AGENT = env["PM_DEV_AGENT_ID"] ?? "joat-dev";
const SCOPE = env["PM_DEV_SCOPE"] ?? "pm-substrate-dev";
const COST_EVENT_TYPE = "dev.session.cost";

const arg = (name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1]!.startsWith("--")
    ? argv[i + 1]
    : undefined;
};

const short = (s: string, n = 96): string =>
  s.length <= n ? s : `${s.slice(0, n - 1)}…`;

const printCheckpoint = (c: ContinuityCheckpoint): void => {
  console.log(
    `  [${c.kind}${c.status === "open" ? "" : `/${c.status}`}] ${c.title}\n      ${short(c.summary, 140)}`,
  );
};

const main = async (): Promise<void> => {
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const ledger = new PostgresContinuityLedger(pool);
  const events = new PostgresEventStore(pool);
  const cmd = argv[2] ?? "status";

  const ensureTenant = async (): Promise<void> => {
    await pool.query(
      `INSERT INTO substrate.tenants(id, display_name) VALUES ($1, $1)
       ON CONFLICT DO NOTHING`,
      [TENANT],
    );
  };

  try {
    if (cmd === "resume") {
      const ctx = await buildContinuityContext(ledger, {
        tenantId: TENANT,
        agentId: AGENT,
        scope: SCOPE,
      });
      const all = await ledger.list({
        tenantId: TENANT,
        agentId: AGENT,
        scope: SCOPE,
        limit: 500,
      });
      const chain = verifyContinuityCheckpointChain({
        tenantId: TENANT,
        agentId: AGENT,
        checkpoints: all,
      });
      const handoffs = all
        .filter((c) => c.kind === "handoff")
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

      console.log(`# pm-substrate dev session — resume`);
      console.log(
        `tenant=${TENANT} agent=${AGENT} scope=${SCOPE} checkpoints=${all.length} chainValid=${chain.valid}`,
      );
      if (!chain.valid) {
        console.log(`!! CHAIN ERRORS:`);
        for (const e of chain.errors.slice(0, 5)) console.log(`   ${e}`);
      }
      if (handoffs[0]) {
        console.log(`\n## Last handoff (start here)`);
        printCheckpoint(handoffs[0]);
      }
      if (ctx.openWork.length > 0) {
        console.log(`\n## Open work (${ctx.openWork.length})`);
        for (const c of ctx.openWork.slice(0, 10)) printCheckpoint(c);
      }
      if (ctx.decisions.length > 0) {
        console.log(`\n## Standing decisions (${ctx.decisions.length})`);
        for (const c of ctx.decisions.slice(0, 12)) printCheckpoint(c);
      }
      if (ctx.lessons.length > 0) {
        console.log(`\n## Lessons (${ctx.lessons.length})`);
        for (const c of ctx.lessons.slice(0, 8)) printCheckpoint(c);
      }
      if (ctx.claims.length > 0) {
        console.log(`\n## Claims under test (${ctx.claims.length})`);
        for (const c of ctx.claims.slice(0, 8)) printCheckpoint(c);
      }
      const contradictions = findContinuityContradictions(all);
      if (contradictions.length > 0) {
        console.log(`\n!! Contradiction candidates (${contradictions.length})`);
        for (const f of contradictions.slice(0, 5)) {
          console.log(`   "${f.newer.title}": ${f.reason}`);
        }
      }
      return;
    }

    if (cmd === "checkpoint" || cmd === "handoff") {
      await ensureTenant();
      const kind = (cmd === "handoff" ? "handoff" : arg("kind")) as
        | CheckpointKind
        | undefined;
      const title =
        arg("title") ?? (cmd === "handoff" ? `handoff ${new Date().toISOString().slice(0, 16)}` : undefined);
      const summary = arg("summary");
      if (!kind || !title || !summary) {
        console.error(
          "usage: dev-session checkpoint --kind work|decision|lesson|research|claim --title T --summary S [--status open|closed] [--refs a,b]",
        );
        exit(1);
      }
      if (argv.includes("--governed")) {
        // Dogfood the gate (shadow-first ramp, hard req 5 → live traffic):
        // the SAME write, but through observe → propose → admit. A stale or
        // conflicted basis BLOCKS this checkpoint — that is the point.
        const { buildSubstrateMcpServer } = await import(
          "../packages/substrate-mcp/src/index.js"
        );
        const { Client } = await import(
          "@modelcontextprotocol/sdk/client/index.js"
        );
        const { InMemoryTransport } = await import(
          "@modelcontextprotocol/sdk/inMemory.js"
        );
        const server = buildSubstrateMcpServer({
          pool,
          tenantId: TENANT,
          agentId: AGENT,
          scope: SCOPE,
        });
        const [clientTransport, serverTransport] =
          InMemoryTransport.createLinkedPair();
        const client = new Client({
          name: "dev-session-governed",
          version: "0.1.0",
        });
        await Promise.all([
          server.connect(serverTransport),
          client.connect(clientTransport),
        ]);
        try {
          const obs = (await client.callTool({
            name: "substrate_observe",
            arguments: { scope: SCOPE },
          })) as {
            structuredContent?: {
              view: { subject: unknown; readSet: unknown[] };
              contract: Record<string, unknown>;
            };
          };
          const basis = obs.structuredContent;
          if (!basis) throw new Error("substrate_observe returned no basis");
          const prop = (await client.callTool({
            name: "substrate_propose",
            arguments: {
              actionType: "record_checkpoint",
              subject: basis.view.subject,
              payload: {
                kind,
                title,
                summary,
                ...(arg("status") ? { status: arg("status") } : {}),
              },
              contract: basis.contract,
              readSet: basis.view.readSet,
              scope: SCOPE,
            },
          })) as {
            structuredContent?: { proposalId: string; warningCount: number };
          };
          const proposal = prop.structuredContent;
          if (!proposal) throw new Error("substrate_propose returned no review");
          if (proposal.warningCount > 0) {
            console.error(
              `propose warned (${proposal.warningCount}) — continuing to admit, which will decide`,
            );
          }
          const adm = (await client.callTool({
            name: "substrate_admit",
            arguments: { proposalId: proposal.proposalId, decidedBy: AGENT },
          })) as {
            structuredContent?: {
              terminalOutcome: string;
              executed: boolean;
              envelopeHash: string;
              blockingCauses: readonly { code: string; message: string }[];
            };
          };
          const outcome = adm.structuredContent;
          if (!outcome) throw new Error("substrate_admit returned no envelope");
          if (outcome.terminalOutcome === "accepted" && outcome.executed) {
            console.log(
              `ADMITTED ${kind} "${title}" via the gate (proposal ${proposal.proposalId}, envelope ${outcome.envelopeHash})`,
            );
            return;
          }
          console.error(
            `BLOCKED ${kind} "${title}" (proposal ${proposal.proposalId}): ${outcome.blockingCauses
              .map((c) => c.code)
              .join(", ")} — re-observe and re-propose from the fresh basis`,
          );
          exit(3);
        } finally {
          await client.close().catch(() => {});
          await server.close().catch(() => {});
        }
      }
      const recorded = await ledger.record({
        tenantId: TENANT,
        agentId: AGENT,
        scope: SCOPE,
        kind,
        title,
        summary,
        ...(arg("status") ? { status: arg("status") as "open" | "closed" } : {}),
        ...(arg("refs")
          ? { decisionRefs: arg("refs")!.split(",").map((s) => s.trim()) }
          : {}),
      });
      console.log(`recorded ${recorded.kind} "${recorded.title}" (${recorded.id})`);
      return;
    }

    if (cmd === "cost") {
      await ensureTenant();
      const prompt = Number(arg("prompt") ?? 0);
      const completion = Number(arg("completion") ?? 0);
      if (!Number.isFinite(prompt) || !Number.isFinite(completion) || prompt + completion <= 0) {
        console.error("usage: dev-session cost --prompt N --completion N [--model M] [--source reported|measured] [--label L]");
        exit(1);
      }
      const ev = await events.publish({
        tenantId: TENANT,
        type: COST_EVENT_TYPE,
        entityId: `dev_session:${arg("label") ?? new Date().toISOString().slice(0, 10)}` as unknown as EntityId,
        emittedBy: AGENT,
        payloadSchema: `${COST_EVENT_TYPE}.v1`,
        payload: {
          promptTokens: prompt,
          completionTokens: completion,
          totalTokens: prompt + completion,
          model: arg("model") ?? "unknown",
          source: arg("source") ?? "reported",
          scope: SCOPE,
        },
      });
      console.log(`recorded cost event ${ev.id}: ${prompt + completion} tokens`);
      return;
    }

    if (cmd === "status") {
      const all = await ledger.list({
        tenantId: TENANT,
        agentId: AGENT,
        scope: SCOPE,
        limit: 1000,
      });
      const chain = verifyContinuityCheckpointChain({
        tenantId: TENANT,
        agentId: AGENT,
        checkpoints: all,
      });
      const byKind = new Map<string, number>();
      for (const c of all) byKind.set(c.kind, (byKind.get(c.kind) ?? 0) + 1);
      const openWork = all.filter((c) => c.kind === "work" && c.status === "open");

      const evAgg = await pool.query<{ type: string; c: string }>(
        `SELECT type, count(*)::text AS c FROM events.events
          WHERE tenant_id = $1 GROUP BY type ORDER BY count(*) DESC LIMIT 15`,
        [TENANT],
      );
      const costAgg = await pool.query<{ total: string | null; sessions: string }>(
        `SELECT sum((payload->>'totalTokens')::bigint)::text AS total,
                count(distinct entity_id)::text AS sessions
           FROM events.events WHERE tenant_id = $1 AND type = $2`,
        [TENANT, COST_EVENT_TYPE],
      );
      const gates = await pool.query<{ c: string }>(
        `SELECT count(*)::text AS c FROM pm_governance.applied_gate_events WHERE tenant_id = $1`,
        [TENANT],
      );
      const procs = await pool.query<{ c: string }>(
        `SELECT count(*)::text AS c FROM procedure_admission.admission_records WHERE tenant_id = $1`,
        [TENANT],
      ).catch(() => ({ rows: [{ c: "n/a" }] }));

      console.log(`# pm-substrate control plane — ${new Date().toISOString().slice(0, 16)}`);
      console.log(`tenant=${TENANT} scope=${SCOPE}`);
      console.log(`\n## What is being done`);
      console.log(`open work items: ${openWork.length}`);
      for (const c of openWork.slice(0, 10)) printCheckpoint(c);
      console.log(`\n## Ledger (${all.length} checkpoints, chainValid=${chain.valid})`);
      for (const [k, n] of byKind) console.log(`  ${k}: ${n}`);
      console.log(`\n## Governance activity (admitted events by type)`);
      for (const r of evAgg.rows) console.log(`  ${r.type}: ${r.c}`);
      console.log(`  stage-gate applications: ${gates.rows[0]?.c ?? 0}`);
      console.log(`  procedure admissions: ${procs.rows[0]?.c ?? "n/a"}`);
      console.log(`\n## Token costs (${COST_EVENT_TYPE})`);
      console.log(
        `  total tokens: ${costAgg.rows[0]?.total ?? 0} across ${costAgg.rows[0]?.sessions ?? 0} labeled sessions`,
      );
      console.log(`\n## Integrity`);
      console.log(`  continuity hash chain: ${chain.valid ? "VALID" : "BROKEN"}`);
      return;
    }

    if (cmd === "seed-dogfood") {
      await ensureTenant();
      const existing = new Set(
        (
          await ledger.list({ tenantId: TENANT, agentId: AGENT, scope: SCOPE, limit: 1000 })
        ).map((c) => c.title),
      );
      const seeds: { kind: CheckpointKind; title: string; summary: string; status?: "open" | "closed" }[] = [
        {
          kind: "decision",
          title: "Direction: prove demand via dogfood",
          summary:
            "2026-07-02: pm-substrate exists to make the marketing lab (PluggedInSocial) and the hedge lab (ArrowHedge) worth running. Its own development runs through the substrate. Falsification window to 2026-07-16: if sessions do not measurably improve (resume fidelity, fewer re-decisions), write the keep/kill memo honestly.",
        },
        {
          kind: "decision",
          title: "Product shape: sidecar + thin integration kit",
          summary:
            "Docker+Postgres sidecar in the user's environment. Client authors only: mapping.yaml (entity-mapping), a sync adapter (webhook/poll/CDC), an action executor (admitted action -> app API). Agents integrate via MCP tools (resume/observe/propose/admit/checkpoint). No app rewrite; the substrate governs the agent boundary only. Adoption ramp: shadow mode (warn) -> gate one action type -> expand.",
        },
        {
          kind: "decision",
          title: "Language: TypeScript kernel, protocol edge, Python client SDK later",
          summary:
            "Kernel stays TS (discriminated unions and cardinality types do real enforcement; 880-test verified). Clients integrate via HTTP/MCP/SQL, any language. Add a thin pm-substrate-client on PyPI when the labs need it.",
        },
        {
          kind: "lesson",
          title: "Unconsumed formalism spirals (v62-v229)",
          summary:
            "Left without a consumer, the project produced a 123-migration/85k-line witness tower nothing imported. Guardrails now enforce budgets/name-depth/isolation, but the incentive remains: every primitive must ship with a runtime consumer.",
        },
        {
          kind: "claim",
          title: "Governance is friction for humans, API for agents",
          summary:
            "Agents' only hands are their tools; if the tools are the admission gate, process is physically enforced (git branch-protection analogy). This is why PM methodology can work for agents where it failed for humans. Test via the two labs.",
        },
        {
          kind: "work",
          title: "Build MCP tool surface over substrate-http",
          summary:
            "resume/observe/propose/admit/checkpoint as MCP tools so any Claude/GPT/local agent mounts the substrate with a config line. The productized front door.",
          status: "open",
        },
        {
          kind: "work",
          title: "Unblocked-work projection + dispatcher (gap #1)",
          summary:
            "Projection computing 'what is unblocked now' from WorkItems + depends_on + gates; dispatcher hands exactly those to responsible agents. Turns pmgovernance from governance-that-refuses into governance-that-drives.",
          status: "open",
        },
        {
          kind: "work",
          title: "PluggedInSocial: implement 5 raised anchors",
          summary:
            "agent_harness + browser_qa_harness adapter surfaces; externalAdapterBoundary, metricsReadyAnalyticsDispatch, publicationTerminal gates. The tokened app-side work was uncommitted and lost in the 07-01 revert; re-implement additively in the external checkout, then live Axis-B conformance goes green.",
          status: "open",
        },
        {
          kind: "decision",
          title: "ROADMAP.md is the single forward plan; the ledger is authoritative",
          summary:
            "2026-07-03: root ROADMAP.md carries north star (two labs viable, owner is customer #1), hard requirements (zero-rewrite kit, sidecar, MCP protocol edge, five-question control plane, shadow-first adoption, no unconsumed primitives) and phases D1-D7 with the 07-16 keep/kill gate. Old plans moved to docs/history/. If ledger and documents disagree, ledger wins.",
        },
        {
          kind: "decision",
          title: "Control plane must answer five questions from the admitted log",
          summary:
            "What is being done; what governance did (admitted/blocked/gated); what it cost (tokens per session/agent); what the results are (eval metric lanes); what got optimized (closed work + superseding decisions). Never from agent self-report. v0 = dev:status; v1 = dashboard page (D4).",
        },
        {
          kind: "work",
          title: "ArrowHedge executor + paired 12-metric run (D6)",
          summary:
            "Action executor mapping admitted portfolio decisions back into the backtest engine, then one paired run (gates off vs blocking): 0 false-positive blocks on fresh in-limit actions, 0 false-negatives on stale/source-conflicted ones, replayable event ids for every block.",
          status: "open",
        },
        {
          kind: "work",
          title: "Control-plane dashboard page",
          summary:
            "Extend packages/substrate-dashboard beyond lab sessions: open work, governance tallies (admitted/blocked/gates), token costs from dev.session.cost events, chain integrity. CLI `pnpm dev:status` is the v0.",
          status: "open",
        },
      ];
      let inserted = 0;
      for (const s of seeds) {
        if (existing.has(s.title)) continue;
        await ledger.record({ tenantId: TENANT, agentId: AGENT, scope: SCOPE, ...s });
        inserted++;
      }
      console.log(`seed-dogfood: inserted ${inserted} checkpoint(s), skipped ${seeds.length - inserted} existing`);
      return;
    }

    if (cmd === "metrics") {
      // D7 evidence: loop-health numbers from the shared fold (scripts/
      // loop-metrics.ts) — the SAME implementation pm:memo renders, so the
      // keep/kill memo can never disagree with the loop's own numbers.
      const report = await computeLoopMetrics(pool, {
        tenantId: TENANT,
        agentId: AGENT,
        scope: SCOPE,
        costEventType: COST_EVENT_TYPE,
      });
      console.log(JSON.stringify(report, null, 2));
      return;
    }

    console.error(`unknown command: ${cmd} (resume|checkpoint|handoff|cost|status|metrics|seed-dogfood)`);
    exit(1);
  } finally {
    await events.close().catch(() => {});
    await pool.end();
  }
};

main().catch((e) => {
  console.error(e);
  exit(1);
});
