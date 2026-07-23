/**
 * State-factor scoreboard page — renders the capstone A/B telemetry grouped
 * by the six agent-state failure factors (AGENT_STATE_PROBLEM_FACTORS.md),
 * which consolidate the ten-class taxonomy in
 * docs/state-validation/state-failure-taxonomy.md. Purpose: make scenario
 * testing legible per factor — what is covered, what each arm did, and which
 * factors still have NO hazard scenario (the coverage gap itself is the
 * finding).
 *
 * Honesty rule (D6-A): everything here is a conformance diagnostic folded
 * from admitted `eval.token.usage` events. It is mechanism evidence, never
 * efficacy; public task outcomes are reported separately (D6/D7).
 *
 * Data path: the SAME `/api/token-usage` payload the Token KPIs page uses —
 * the server runs the @pm/local-agent-lab fold, so this page cannot disagree
 * with a run's printed table or CSV. Unknown failure classes are surfaced as
 * a theory gap per the taxonomy's Cross-Class Note (never a silent "other").
 */

import { compactNumber } from "./control-plane-page.js";

export const FACTOR_IDS = [
  "continuity-amnesia",
  "stale-observation",
  "duplicate-effects",
  "parallel-write",
  "unverified-self-report",
  "authority-drift",
] as const;

export type FactorId = (typeof FACTOR_IDS)[number];

/** Mirrors @pm/evals FAILURE_CLASSES; the unit test asserts total coverage. */
export const CANONICAL_FAILURE_CLASSES: readonly string[] = [
  "partial_observation",
  "stale_observation",
  "representation_loss",
  "memory_drift",
  "source_authority_conflict",
  "workflow_invalidation",
  "capability_contract_violation",
  "parallel_write_conflict",
  "feedback_disconnection",
  "continuity_break",
];

export interface FactorDef {
  readonly id: FactorId;
  readonly title: string;
  readonly question: string;
  readonly classes: readonly string[];
  readonly mechanism: string;
  readonly firstPartyEvidence: string;
  readonly nextStep: string | null;
}

export const FACTOR_DEFS: readonly FactorDef[] = [
  {
    id: "continuity-amnesia",
    title: "F1 · Continuity break / amnesia",
    question: "Does work survive session death and superseded memory?",
    classes: ["continuity_break", "memory_drift"],
    mechanism: "Continuity ledger — hash-chained checkpoints, dev:resume",
    firstPartyEvidence:
      "evals:amnesia — baseline resumed 0/5 work items, substrate 5/5",
    nextStep: null,
  },
  {
    id: "stale-observation",
    title: "F2 · Stale observation / TOCTOU",
    question: "Is the action's basis still true at admission time?",
    classes: ["stale_observation", "partial_observation"],
    mechanism: "Read-set revalidation — enforce-mode re-review at current head",
    firstPartyEvidence:
      "2026-07-06 MCP self-block incident (substrate-mcp/src/server.ts)",
    nextStep: "superseded-snapshot trade scenario with a non-saturated baseline (v233 H-F2a)",
  },
  {
    id: "duplicate-effects",
    title: "F3 · Non-idempotent retry / duplicate side effects",
    question: "Can a retry after an ambiguous failure execute twice?",
    classes: ["workflow_invalidation"],
    mechanism:
      "Content-addressed envelopes; applied-gate idempotency (ON CONFLICT DO NOTHING)",
    firstPartyEvidence:
      "ToolSandbox derivative — duplicates: native 1, sham 1, substrate 0 (v232)",
    nextStep: null,
  },
  {
    id: "parallel-write",
    title: "F4 · Parallel write conflict / lost update",
    question: "Can two agents commit against the same observed head?",
    classes: ["parallel_write_conflict"],
    mechanism:
      "Tenant/agent advisory lock; append-only Merkle merge (dev:repair-chain)",
    firstPartyEvidence:
      "2026-07-13 real chain fork; 24-writer ablation red → green",
    nextStep: null,
  },
  {
    id: "unverified-self-report",
    title: "F5 · Unverified self-report / no provenance",
    question: "Is claimed state backed by admitted evidence?",
    classes: ["representation_loss", "feedback_disconnection"],
    mechanism:
      "Evidence-bound admission; control plane reads only the admitted log",
    firstPartyEvidence:
      "Capstone A/B — corrupt admissions 12–14 (baseline) → 0 (substrate)",
    nextStep: null,
  },
  {
    id: "authority-drift",
    title: "F6 · Authority drift / out-of-scope action",
    question: "Can an agent act outside its granted write scope?",
    classes: ["source_authority_conflict", "capability_contract_violation"],
    mechanism:
      "RACI exactly:1 edges; stage gates; maker-checker propose/admit split",
    firstPartyEvidence:
      "RACI single-accountability enforced at write time (profile-pmgovernance/src/edges.ts)",
    nextStep: "RACI-violation scenario + least-context canary egress probe (v233 H-F6a/H-F6c)",
  },
];

const classToFactor: ReadonlyMap<string, FactorId> = new Map(
  FACTOR_DEFS.flatMap((def) => def.classes.map((cls) => [cls, def.id] as const)),
);

export function factorForFailureClass(failureClass: string): FactorId | null {
  return classToFactor.get(failureClass) ?? null;
}

/** Structural subset of @pm/local-agent-lab's TokenUsageScenarioRow. */
export interface FactorScoreboardRow {
  readonly scenario: string;
  readonly mode: "no_substrate" | "substrate";
  readonly expectedAdmission: "allow" | "block";
  readonly failureClass: string;
  readonly tasks: number;
  readonly attempts: number;
  readonly retries: number;
  readonly terminalFailures: number;
  readonly finalSuccesses: number;
  readonly tokensTotal: number;
  readonly tokensWasted: number;
}

export interface FactorArmTotals {
  readonly tasks: number;
  readonly attempts: number;
  readonly retries: number;
  readonly terminalFailures: number;
  readonly tokensTotal: number;
  readonly tokensWasted: number;
}

export interface FactorScore {
  readonly def: FactorDef;
  readonly scenarios: readonly string[];
  readonly hazardScenarios: number;
  readonly allowControls: number;
  readonly covered: boolean;
  readonly byMode: Readonly<Record<"no_substrate" | "substrate", FactorArmTotals>>;
}

export interface FactorScoreboard {
  readonly factors: readonly FactorScore[];
  readonly coveredCount: number;
  readonly hazardScenarioTotal: number;
  readonly allowControlTotal: number;
  readonly unmappedClasses: readonly {
    readonly failureClass: string;
    readonly scenarios: readonly string[];
  }[];
}

const zeroTotals = (): FactorArmTotals => ({
  tasks: 0,
  attempts: 0,
  retries: 0,
  terminalFailures: 0,
  tokensTotal: 0,
  tokensWasted: 0,
});

const addRow = (t: FactorArmTotals, r: FactorScoreboardRow): FactorArmTotals => ({
  tasks: t.tasks + r.tasks,
  attempts: t.attempts + r.attempts,
  retries: t.retries + r.retries,
  terminalFailures: t.terminalFailures + r.terminalFailures,
  tokensTotal: t.tokensTotal + r.tokensTotal,
  tokensWasted: t.tokensWasted + r.tokensWasted,
});

/** Pure fold: run rows → per-factor coverage + per-arm totals. */
export function computeFactorScoreboard(
  rows: readonly FactorScoreboardRow[],
): FactorScoreboard {
  interface Acc {
    scenarios: Set<string>;
    hazard: Set<string>;
    allow: Set<string>;
    no_substrate: FactorArmTotals;
    substrate: FactorArmTotals;
  }
  const accByFactor = new Map<FactorId, Acc>(
    FACTOR_DEFS.map((def) => [
      def.id,
      {
        scenarios: new Set<string>(),
        hazard: new Set<string>(),
        allow: new Set<string>(),
        no_substrate: zeroTotals(),
        substrate: zeroTotals(),
      },
    ]),
  );
  const unmapped = new Map<string, Set<string>>();

  for (const row of rows) {
    const factorId = factorForFailureClass(row.failureClass);
    if (factorId === null) {
      const scenarios = unmapped.get(row.failureClass) ?? new Set<string>();
      scenarios.add(row.scenario);
      unmapped.set(row.failureClass, scenarios);
      continue;
    }
    const acc = accByFactor.get(factorId);
    if (!acc) continue;
    acc.scenarios.add(row.scenario);
    (row.expectedAdmission === "block" ? acc.hazard : acc.allow).add(row.scenario);
    if (row.mode === "no_substrate") acc.no_substrate = addRow(acc.no_substrate, row);
    else acc.substrate = addRow(acc.substrate, row);
  }

  const factors: FactorScore[] = FACTOR_DEFS.map((def) => {
    const acc = accByFactor.get(def.id);
    const hazardScenarios = acc ? acc.hazard.size : 0;
    return {
      def,
      scenarios: acc ? [...acc.scenarios].sort() : [],
      hazardScenarios,
      allowControls: acc ? acc.allow.size : 0,
      covered: hazardScenarios > 0,
      byMode: {
        no_substrate: acc ? acc.no_substrate : zeroTotals(),
        substrate: acc ? acc.substrate : zeroTotals(),
      },
    };
  });

  return {
    factors,
    coveredCount: factors.filter((f) => f.covered).length,
    hazardScenarioTotal: factors.reduce((a, f) => a + f.hazardScenarios, 0),
    allowControlTotal: factors.reduce((a, f) => a + f.allowControls, 0),
    unmappedClasses: [...unmapped.entries()]
      .map(([failureClass, scenarios]) => ({
        failureClass,
        scenarios: [...scenarios].sort(),
      }))
      .sort((a, b) => a.failureClass.localeCompare(b.failureClass)),
  };
}

const esc = (s: string): string =>
  s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

export interface FactorScoreboardRunMeta {
  readonly runLabel: string;
  readonly generatedAt: string;
  readonly providers: readonly string[];
  readonly models: readonly string[];
  readonly corruptAdmissions: Readonly<Record<"no_substrate" | "substrate", number>>;
}

export interface FactorScoreboardRunOption {
  readonly runLabel: string;
  readonly lastRecordedAt: string;
  readonly models: readonly string[];
}

/** Empty state teaches the loop, mirroring the Token KPIs page. */
export function renderFactorScoreboardEmptyHtml(): string {
  return `
<section class="cp-root" data-view="state-factors">
  <header class="cp-head">
    <div>
      <h1>State factors</h1>
      <p>Failure-factor scoreboard — conformance diagnostics from admitted eval events; never efficacy.</p>
    </div>
  </header>
  <article class="cp-card">
    <h2>No A/B runs recorded yet</h2>
    <p class="cp-note">Record a run, then each hazard scenario lands in its factor row:</p>
    <pre class="tk-cmd">pnpm capstone:token-ab -- --repeats 3 --scenarios stale --provider openrouter</pre>
    <p class="cp-note">Factors without a hazard scenario stay flagged as coverage gaps — the gap
    itself is a finding (see AGENT_STATE_PROBLEM_FACTORS.md §5).</p>
  </article>
</section>`;
}

const armRow = (label: string, t: FactorArmTotals): string => `
            <tr>
              <td>${esc(label)}</td>
              <td>${t.attempts}</td><td>${t.retries}</td><td>${t.terminalFailures}</td>
              <td>${t.tokensWasted.toLocaleString("en-US")} / ${t.tokensTotal.toLocaleString("en-US")}</td>
            </tr>`;

const factorCard = (f: FactorScore): string => `
    <article class="cp-card${f.covered ? "" : " cp-card-critical"}" data-factor="${f.def.id}">
      <h2>${esc(f.def.title)}</h2>
      <p class="cp-note">${esc(f.def.question)}</p>
      <p>${f.def.classes.map((c) => `<code class="cp-bar-label">${esc(c)}</code>`).join(" ")}</p>
      ${
        f.covered
          ? `<p class="cp-note"><strong class="cp-good">covered</strong> ·
             ${f.hazardScenarios} hazard scenario${f.hazardScenarios === 1 ? "" : "s"} ·
             ${f.allowControls} allow-control${f.allowControls === 1 ? "" : "s"} ·
             ${esc(f.scenarios.join(", "))}</p>
      <div class="tk-table-wrap">
        <table class="tk-table">
          <thead><tr><th>arm</th><th>attempts</th><th>retries</th><th>terminal fails</th><th>tokens wasted / total</th></tr></thead>
          <tbody>${armRow("validation OFF", f.byMode.no_substrate)}${armRow("validation ON", f.byMode.substrate)}
          </tbody>
        </table>
      </div>`
          : `<p class="cp-note"><strong class="cp-critical">no hazard scenario in this run</strong>${
              f.def.nextStep ? ` — next: ${esc(f.def.nextStep)}` : ""
            }</p>`
      }
      <p class="cp-note">Mechanism: ${esc(f.def.mechanism)}</p>
      <p class="cp-note">First-party evidence: ${esc(f.def.firstPartyEvidence)}</p>
    </article>`;

/** Deterministic HTML: tiles + six factor cards + theory-gap card. */
export function renderFactorScoreboardHtml(
  meta: FactorScoreboardRunMeta,
  board: FactorScoreboard,
  runs: readonly FactorScoreboardRunOption[],
): string {
  const b = meta.corruptAdmissions.no_substrate;
  const s = meta.corruptAdmissions.substrate;
  const tokensMetered = board.factors.reduce(
    (a, f) => a + f.byMode.no_substrate.tokensTotal + f.byMode.substrate.tokensTotal,
    0,
  );
  const options = runs
    .map(
      (r) =>
        `<option value="${esc(r.runLabel)}"${r.runLabel === meta.runLabel ? " selected" : ""}>
          ${esc(r.runLabel)} · ${esc(r.models.join(", "))} · ${esc(r.lastRecordedAt.slice(0, 10))}
        </option>`,
    )
    .join("");

  return `
<section class="cp-root" data-view="state-factors">
  <header class="cp-head">
    <div>
      <h1>State factors</h1>
      <p>Six failure factors · scenario coverage and per-arm behavior, folded from admitted
      eval events. <strong>Conformance diagnostics — not efficacy.</strong> Public task
      outcomes are reported separately (D6/D7).</p>
    </div>
    <label class="tk-run-picker"><select data-sf-run>${options}</select></label>
  </header>

  <div class="cp-tiles">
    <div class="cp-tile" data-q="coverage">
      <span class="cp-tile-label">Factors with hazard coverage</span>
      <span class="cp-tile-value${board.coveredCount === board.factors.length ? " cp-good" : ""}">${board.coveredCount}/${board.factors.length}</span>
      <span class="cp-tile-sub">${board.hazardScenarioTotal} hazard · ${board.allowControlTotal} allow-control scenarios</span>
    </div>
    <div class="cp-tile" data-q="wrong-state">
      <span class="cp-tile-label">Wrong-state shipped (run-level)</span>
      <span class="cp-tile-value${s === 0 && b > 0 ? " cp-good" : s > 0 ? " cp-critical" : ""}">${b} → ${s}</span>
      <span class="cp-tile-sub">baseline vs substrate · not attributable per factor</span>
    </div>
    <div class="cp-tile" data-q="tokens">
      <span class="cp-tile-label">Tokens metered</span>
      <span class="cp-tile-value">${compactNumber(tokensMetered)}</span>
      <span class="cp-tile-sub">${esc(meta.providers.join(", "))} · ${esc(meta.models.join(", "))}</span>
    </div>
  </div>

  <div class="cp-grid">
    ${board.factors.map(factorCard).join("")}
    ${
      board.unmappedClasses.length === 0
        ? ""
        : `<article class="cp-card cp-card-critical" data-factor="theory-gap">
      <h2>Theory gap — unmapped failure classes</h2>
      <p class="cp-note">Per the taxonomy's Cross-Class Note: a scenario that fits no class (or
      a class that fits no factor) is a finding to document, never a silent "other".</p>
      <ul>${board.unmappedClasses
        .map(
          (u) =>
            `<li><code>${esc(u.failureClass)}</code> · ${esc(u.scenarios.join(", "))}</li>`,
        )
        .join("")}</ul>
    </article>`
    }
  </div>

  <p class="cp-note">run ${esc(meta.runLabel)} · generated ${esc(meta.generatedAt.slice(0, 16).replace("T", " "))} UTC ·
  same fold inputs as <code>pnpm report:token-usage -- --label ${esc(meta.runLabel)}</code> ·
  factor map: AGENT_STATE_PROBLEM_FACTORS.md → docs/state-validation/state-failure-taxonomy.md</p>
</section>`;
}

interface TokenUsagePayloadSubset extends FactorScoreboardRunMeta {
  readonly rows: readonly FactorScoreboardRow[];
}

/** Browser bootstrap: run list → newest run → render; picker re-fetches. */
export async function mountFactorScoreboard(root: HTMLElement): Promise<void> {
  root.innerHTML = `<p class="cp-empty cp-loading">loading state factors…</p>`;
  try {
    const runsRes = await fetch("/api/token-usage/runs");
    if (!runsRes.ok) throw new Error(`token-usage runs returned ${runsRes.status}`);
    const { runs } = (await runsRes.json()) as { runs: FactorScoreboardRunOption[] };
    const newest = runs[0];
    if (!newest) {
      root.innerHTML = renderFactorScoreboardEmptyHtml();
      return;
    }
    const load = async (label: string): Promise<void> => {
      const res = await fetch(`/api/token-usage?label=${encodeURIComponent(label)}`);
      if (!res.ok) throw new Error(`token-usage returned ${res.status}`);
      const metrics = (await res.json()) as TokenUsagePayloadSubset;
      root.innerHTML = renderFactorScoreboardHtml(
        metrics,
        computeFactorScoreboard(metrics.rows),
        runs,
      );
      root
        .querySelector<HTMLSelectElement>("[data-sf-run]")
        ?.addEventListener("change", (event) => {
          void load((event.target as HTMLSelectElement).value);
        });
    };
    await load(newest.runLabel);
  } catch (err) {
    root.innerHTML = `<div class="cp-root"><article class="cp-card cp-card-critical">
      <h2>State factors unavailable</h2>
      <p>${esc(String(err))}</p>
      <p class="cp-note">Is PM_DATABASE_URL set for the dashboard server?</p>
    </article></div>`;
  }
}
