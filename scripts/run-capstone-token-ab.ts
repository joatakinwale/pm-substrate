#!/usr/bin/env tsx
/**
 * scripts/run-capstone-token-ab.ts — the capstone A/B token meter.
 *
 * Runs lab scenarios in BOTH arms (no_substrate = validation OFF, substrate =
 * validation ON) with a bounded retry loop, records one `eval.token.usage`
 * event per attempt to the durable dev ledger tenant, then folds the admitted
 * events (never in-memory state) into the workbook numbers C7/C8/C9, a CSV
 * (scenario, mode, attempts, retries, tokens_wasted), and a RUNS.md line.
 *
 *   pnpm capstone:token-ab -- --repeats 3 --scenarios stale --provider openrouter \
 *     --models "openai/gpt-4o-mini,deepseek/deepseek-chat" --label my-run
 *
 * Flags: --repeats (3) --max-attempts (3) --scenarios stale|evidence|<ids,>
 *        --provider ollama|openrouter --models <m1,m2> --label <name>
 *        --csv <path> --no-dev-cost
 */

import { mkdirSync, writeFileSync, existsSync, appendFileSync } from "node:fs";
import { relative, resolve, dirname } from "node:path";
import { argv, env, exit } from "node:process";

import pg from "pg";

import {
  EVIDENCE_SCENARIOS,
  defaultLabProvider,
  runArmWithRetries,
  type ArmAttemptSeries,
  type Arm,
  type LabModelClient,
  type LabProviderName,
  type ScenarioSpec,
} from "../packages/local-agent-lab/src/index.js";
import { PostgresEventStore } from "../packages/events/src/index.js";
import type { EntityId, TenantId } from "../packages/types/src/index.js";
import {
  TOKEN_USAGE_EVENT_TYPE,
  computeTokenUsage,
  renderTokenUsageCsv,
  renderTokenUsageTable,
} from "./token-usage-metrics.js";

const ROOT = resolve(import.meta.dirname, "..");
const EVIDENCE_DIR = resolve(ROOT, "docs", "evidence", "capstone");

const databaseUrl = env["PM_DATABASE_URL"];
if (!databaseUrl) {
  console.error("capstone:token-ab: PM_DATABASE_URL is not set (source .env first).");
  exit(1);
}
const TENANT = (env["PM_DEV_TENANT_ID"] ?? "tenant_dev") as TenantId;
const EMITTED_BY = "local-agent-lab:token-ab";

const arg = (name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1]!.startsWith("--") ? argv[i + 1] : undefined;
};
const flag = (name: string): boolean => argv.includes(`--${name}`);

/** Convergent stale-family classes: the gate names a superseded basis and a
 * re-observe can fix it — the subset whose retry semantics match the workbook
 * model. `evidence` = the full registry incl. matched allow-controls. */
const STALE_CLASSES = new Set([
  "stale_observation",
  "memory_drift",
  "source_authority_conflict",
  "workflow_invalidation",
  "capability_contract_violation",
  "parallel_write_conflict",
]);

function selectScenarios(selector: string): readonly ScenarioSpec[] {
  if (selector === "evidence") return EVIDENCE_SCENARIOS;
  if (selector === "stale") {
    // Convergent only: a re-observation can fix the refusal. The two
    // pm-governance scenarios share a contract failure class but need an
    // approval/dispatch action, not a re-read — both arms exhaust attempts by
    // design, so they belong to `evidence`, not the workbook subset.
    return EVIDENCE_SCENARIOS.filter(
      (s) =>
        STALE_CLASSES.has(s.controlGroup ?? s.failureClass) &&
        !s.scenarioId.startsWith("pm-governance"),
    );
  }
  const ids = new Set(selector.split(",").map((s) => s.trim()).filter((s) => s.length > 0));
  const picked = EVIDENCE_SCENARIOS.filter((s) => ids.has(s.scenarioId));
  if (picked.length === 0) {
    throw new Error(`--scenarios matched nothing: ${selector}`);
  }
  return picked;
}

const modelSlug = (model: string): string => model.replaceAll(/[^a-zA-Z0-9._-]+/gu, "_");

async function publishSeries(
  events: PostgresEventStore,
  input: {
    readonly runLabel: string;
    readonly repeatN: number;
    readonly maxAttempts: number;
    readonly series: ArmAttemptSeries;
  },
): Promise<void> {
  const { series } = input;
  const entityId =
    `token_ab:${input.runLabel}:${series.scenarioId}:${series.arm}:r${input.repeatN}` as unknown as EntityId;
  for (const attempt of series.attempts) {
    await events.publish({
      tenantId: TENANT,
      type: TOKEN_USAGE_EVENT_TYPE,
      entityId,
      emittedBy: EMITTED_BY,
      payloadSchema: `${TOKEN_USAGE_EVENT_TYPE}.v1`,
      payload: {
        runLabel: input.runLabel,
        scenario: series.scenarioId,
        failureClass: series.failureClass,
        expectedAdmission: series.expectedAdmission,
        mode: series.arm,
        provider: series.provider,
        model: series.model,
        repeatN: input.repeatN,
        maxAttempts: input.maxAttempts,
        attemptN: attempt.attemptN,
        admitted: attempt.admitted,
        result: attempt.result,
        promptTokens: attempt.promptTokens,
        completionTokens: attempt.completionTokens,
        totalTokens: attempt.totalTokens,
        ...(attempt.costCredits !== undefined ? { costCredits: attempt.costCredits } : {}),
        outcome: attempt.outcome,
        cause: attempt.cause,
      },
    });
  }
}

async function runOneModel(input: {
  readonly pool: pg.Pool;
  readonly events: PostgresEventStore;
  readonly client: LabModelClient;
  readonly scenarios: readonly ScenarioSpec[];
  readonly runLabel: string;
  readonly repeats: number;
  readonly maxAttempts: number;
  readonly csvPath: string;
  readonly scenariosSelector: string;
  readonly devCost: boolean;
}): Promise<void> {
  const { client } = input;
  const modes: readonly Arm[] = ["no_substrate", "substrate"];
  let seriesDone = 0;
  const seriesTotal = input.scenarios.length * modes.length * input.repeats;
  for (const spec of input.scenarios) {
    for (const mode of modes) {
      for (let repeatN = 1; repeatN <= input.repeats; repeatN += 1) {
        const series = await runArmWithRetries(spec, mode, {
          databaseUrl: databaseUrl as string,
          client,
          maxAttempts: input.maxAttempts,
        });
        await publishSeries(input.events, {
          runLabel: input.runLabel,
          repeatN,
          maxAttempts: input.maxAttempts,
          series,
        });
        seriesDone += 1;
        console.error(
          `[${seriesDone}/${seriesTotal}] ${spec.scenarioId} ${mode} r${repeatN}: ` +
            `${series.finalResult} attempts=${series.attempts.length} tokens=${series.totalTokens}`,
        );
      }
    }
  }

  const metrics = await computeTokenUsage(input.pool, {
    tenantId: TENANT,
    runLabel: input.runLabel,
  });
  console.log(`\n${renderTokenUsageTable(metrics)}`);

  mkdirSync(dirname(input.csvPath), { recursive: true });
  writeFileSync(input.csvPath, renderTokenUsageCsv(metrics));
  console.log(`csv: ${relative(ROOT, input.csvPath)}`);

  const runsPath = resolve(EVIDENCE_DIR, "RUNS.md");
  if (!existsSync(runsPath)) {
    mkdirSync(EVIDENCE_DIR, { recursive: true });
    writeFileSync(
      runsPath,
      "# Capstone token A/B runs\n\nAppend-only register; one line per completed run.\n\n",
    );
  }
  const pct = (v: number | null): string => (v === null ? "n/a" : `${(v * 100).toFixed(1)}%`);
  appendFileSync(
    runsPath,
    `- ${metrics.generatedAt} label=${input.runLabel} provider=${client.provider} ` +
      `model=${client.model} scenarios=${input.scenariosSelector} repeats=${input.repeats} ` +
      `maxAttempts=${input.maxAttempts} tasks=${metrics.rows.reduce((n, r) => n + r.tasks, 0)} ` +
      `C7=${pct(metrics.c7BaselineRetryRate)} C8=${pct(metrics.c8SubstrateRetryRate)} ` +
      `C9=${metrics.c9MeanTokensPerWastedAttempt?.toFixed(1) ?? "n/a"} ` +
      `corrupt=${metrics.corruptAdmissions.no_substrate}/${metrics.corruptAdmissions.substrate} ` +
      `csv=${relative(ROOT, input.csvPath)}\n`,
  );

  if (input.devCost) {
    await input.events.publish({
      tenantId: TENANT,
      type: "dev.session.cost",
      entityId: `dev_session:${input.runLabel}` as unknown as EntityId,
      emittedBy: EMITTED_BY,
      payloadSchema: "dev.session.cost.v1",
      payload: {
        promptTokens: metrics.totals.promptTokens,
        completionTokens: metrics.totals.completionTokens,
        totalTokens: metrics.totals.totalTokens,
        model: `${client.provider}:${client.model}`,
        source: "measured",
        scope: env["PM_DEV_SCOPE"] ?? "pm-substrate-dev",
      },
    });
  }
}

const main = async (): Promise<void> => {
  const repeats = Math.max(1, Number(arg("repeats") ?? 3));
  const maxAttempts = Math.max(1, Number(arg("max-attempts") ?? 3));
  const scenariosSelector = arg("scenarios") ?? "stale";
  const providerName = (arg("provider") ?? env["LOCAL_LAB_PROVIDER"] ?? "ollama") as LabProviderName;
  const models = (arg("models") ?? "")
    .split(",")
    .map((m) => m.trim())
    .filter((m) => m.length > 0);
  const baseLabel =
    arg("label") ?? `token-ab-${new Date().toISOString().slice(0, 16).replaceAll(/[:T]/gu, "-")}`;
  const scenarios = selectScenarios(scenariosSelector);

  const pool = new pg.Pool({ connectionString: databaseUrl });
  const events = new PostgresEventStore(pool);
  try {
    await pool.query(
      `INSERT INTO substrate.tenants(id, display_name) VALUES ($1, $1) ON CONFLICT DO NOTHING`,
      [TENANT],
    );
    const modelList: readonly (string | undefined)[] = models.length > 0 ? models : [undefined];
    const explicitCsv = arg("csv");
    if (explicitCsv !== undefined && modelList.length > 1) {
      console.error("--csv is ignored with multiple --models (each model writes its own default path)");
    }
    for (const model of modelList) {
      const client = defaultLabProvider({
        provider: providerName,
        ...(model !== undefined ? { model } : {}),
      });
      if (!(await client.available())) {
        console.error(
          client.provider === "ollama"
            ? "ollama is not reachable — start it (ollama serve) or use --provider openrouter"
            : "OPENROUTER_API_KEY is not set — add it to .env",
        );
        exit(1);
      }
      const runLabel =
        modelList.length > 1 ? `${baseLabel}-${modelSlug(client.model)}` : baseLabel;
      const preexisting = await pool.query(
        `SELECT count(*)::int AS n FROM events.events
          WHERE tenant_id = $1 AND type = $2 AND payload->>'runLabel' = $3`,
        [TENANT, TOKEN_USAGE_EVENT_TYPE, runLabel],
      );
      const preexistingCount = (preexisting.rows[0] as { n: number } | undefined)?.n ?? 0;
      if (preexistingCount > 0) {
        console.error(
          `warning: ${preexistingCount} eval.token.usage event(s) already exist under ` +
            `label ${runLabel} (an earlier/aborted run?). The fold dedupes per ` +
            `(task, attempt) with last-recorded-wins; use a fresh --label for a clean register.`,
        );
      }
      const csvPath = resolve(
        modelList.length === 1 && explicitCsv !== undefined
          ? explicitCsv
          : resolve(EVIDENCE_DIR, `${runLabel}.csv`),
      );
      console.error(
        `run ${runLabel}: provider=${client.provider} model=${client.model} ` +
          `scenarios=${scenarios.length} modes=2 repeats=${repeats} maxAttempts=${maxAttempts}`,
      );
      await runOneModel({
        pool,
        events,
        client,
        scenarios,
        runLabel,
        repeats,
        maxAttempts,
        csvPath,
        scenariosSelector,
        devCost: !flag("no-dev-cost"),
      });
    }
  } finally {
    await pool.end();
  }
};

void main().catch((error: unknown) => {
  console.error(
    `capstone:token-ab failed: ${error instanceof Error ? error.message : String(error)}`,
  );
  console.error("no CSV or RUNS.md line was written for the failed run; events already published are label-scoped and harmless.");
  exit(1);
});
