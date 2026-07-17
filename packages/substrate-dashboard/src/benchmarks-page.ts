/**
 * Benchmarks page — the project's headline question: how does pm-substrate
 * compare on the public benchmarks built to expose agent-state failure?
 *
 * pm-substrate runs as one of four matched arms (native / sham / plain-KV /
 * substrate) on each benchmark. The load-bearing finding across all of them:
 * a benchmark's own strict task-completion score is frequently BLIND to the
 * collateral-state damage pm-substrate prevents (a duplicate send, a stale
 * write), so we report the strict score AND the state effect side by side.
 *
 * Honesty is the product here: every status below is a QUALIFICATION or
 * MECHANISM result, never an efficacy claim. The renderer must never imply
 * pm-substrate "beat" a benchmark — it shows what was mechanically proven and
 * exactly what still blocks an efficacy verdict. Dynamic status is read from
 * the signed run register (docs/evidence/public-proof-run-register); the
 * descriptive facts (what each benchmark tests, its scorer, its source) are
 * pinned constants here.
 */

import { drawVerticalBars, type Tone } from "./charts.js";

export type BenchmarkId = "toolsandbox" | "statebench" | "sentinel" | "corner";
export type BenchmarkStatusLevel =
  | "mechanism-qualified"
  | "conformance-only"
  | "blocked"
  | "not-run";

export interface BenchmarkArmOutcome {
  readonly arm: string;
  readonly strictScore: number | null;
  readonly duplicateSideEffects: number | null;
  readonly disposition?: string;
}

export interface BenchmarkStatus {
  readonly id: BenchmarkId;
  readonly level: BenchmarkStatusLevel;
  readonly headline: string;
  readonly arms?: readonly BenchmarkArmOutcome[];
  readonly blockedOn?: readonly string[];
  readonly stats?: readonly { readonly label: string; readonly value: string }[];
}

export type LabArmResult = "pass" | "fail" | "blocked" | null;

export interface LabScenarioVerdict {
  readonly scenarioId: string;
  readonly failureClass: string;
  readonly stateBenchCategory: string | null;
  readonly coordinationClass: string | null;
  readonly expectedAdmission: "allow" | "block";
  readonly baselineResult: LabArmResult;
  readonly substrateResult: LabArmResult;
}

export interface BenchmarksPayload {
  readonly recordedAt: string;
  readonly claimBoundary: string;
  readonly benchmarks: readonly BenchmarkStatus[];
  readonly labScenarios: readonly {
    readonly scenarioId: string;
    readonly failureClass: string;
  }[];
  readonly labVerdicts: readonly LabScenarioVerdict[];
}

interface BenchmarkDescriptor {
  readonly name: string;
  readonly org: string;
  readonly tests: string;
  readonly officialScorer: string;
  readonly seesCollateral: boolean;
  readonly source: string;
}

const DESCRIPTORS: Record<BenchmarkId, BenchmarkDescriptor> = {
  toolsandbox: {
    name: "ToolSandbox",
    org: "Apple",
    tests: "Stateful multi-turn tool use — a message send that depends on cellular state, then a lost tool response + hard process restart.",
    officialScorer: "Strict task completion (milestone match)",
    seesCollateral: false,
    source: "arXiv:2408.04682 · apple/ToolSandbox",
  },
  statebench: {
    name: "STATE-Bench",
    org: "Microsoft",
    tests: "450 enterprise tasks (150 held-out) where agents must improve with experience; the deterministic scorer compares final environment state to ground truth.",
    officialScorer: "Deterministic final-state diff + pass^5",
    seesCollateral: true,
    source: "microsoft/STATE-Bench (2026-05)",
  },
  sentinel: {
    name: "SentinelBench",
    org: "Microsoft Research",
    tests: "Long-running monitoring agents across 10 evolving web micro-environments; react when an external event makes progress possible without wasting resources.",
    officialScorer: "Task completion + reaction time + resource use",
    seesCollateral: false,
    source: "arXiv:2606.05342 · microsoft/sentinel_environments",
  },
  corner: {
    name: "Corner battery",
    org: "MemoryAgentBench · τ²-bench",
    tests: "Source-pinned corner cases (fact consolidation over long context; airline customer-service state) that stress memory and multi-turn state from other angles.",
    officialScorer: "Each benchmark's own oracle",
    seesCollateral: false,
    source: "pinned upstreams; efficacy not claimed",
  },
};

const LEVEL_LABEL: Record<BenchmarkStatusLevel, string> = {
  "mechanism-qualified": "Mechanism qualified",
  "conformance-only": "Conformance only",
  blocked: "Blocked",
  "not-run": "Not run",
};

const esc = (s: string): string =>
  s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const fmtScore = (v: number | null): string =>
  v === null ? "–" : Number.isInteger(v) ? v.toFixed(1) : String(v);

const fmtWhen = (iso: string): string => {
  const m = iso.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1]! : iso;
};

/**
 * The crux, made visual: two real SVG bar charts side by side (drawn in
 * hydrateBenchmarkCharts). Left — the benchmark's strict score, identical
 * across arms. Right — the actual duplicate side effects, where only substrate
 * stayed at zero. The divergence between a flat chart and a diverging one is
 * seen, not read.
 */
function stateDamageContrast(): string {
  return `
  <div class="bm-contrast">
    <div class="bm-contrast-panel">
      <div class="bm-contrast-head">Benchmark's strict score</div>
      <svg class="bm-svg" data-bm-chart="strict" viewBox="0 0 420 200" role="img" aria-label="Strict score by arm — all equal"></svg>
      <div class="bm-contrast-note">Identical — the official oracle calls it a tie.</div>
    </div>
    <div class="bm-contrast-panel">
      <div class="bm-contrast-head">Actual state damage <small>duplicate sends after restart</small></div>
      <svg class="bm-svg" data-bm-chart="dup" viewBox="0 0 420 200" role="img" aria-label="Duplicate side effects by arm"></svg>
      <div class="bm-contrast-note">Only <strong>substrate</strong> kept state clean.</div>
    </div>
  </div>`;
}

/** SVG contrast for collateral benchmarks; compact table otherwise. */
function armsTable(arms: readonly BenchmarkArmOutcome[], seesCollateral: boolean): string {
  const anyCollateral = arms.some((a) => a.duplicateSideEffects !== null);
  if (anyCollateral) {
    return `${stateDamageContrast()}${
      seesCollateral
        ? ""
        : `<p class="bm-insight">↑ Strict task completion is <strong>blind</strong> to the state damage the substrate prevented — the crux of the whole comparison.</p>`
    }`;
  }
  return `
  <div class="bm-arms-wrap">
    <table class="bm-arms">
      <thead><tr><th>arm</th><th>strict score</th></tr></thead>
      <tbody>
        ${arms
          .map(
            (a) => `<tr class="${a.arm === "substrate" ? "bm-arm-substrate" : ""}">
          <td>${esc(a.arm)}</td><td>${fmtScore(a.strictScore)}</td></tr>`,
          )
          .join("")}
      </tbody>
    </table>
  </div>`;
}

function benchmarkCard(status: BenchmarkStatus): string {
  const d = DESCRIPTORS[status.id];
  return `
  <article class="bm-card bm-level-${status.level}">
    <header class="bm-card-head">
      <div>
        <h2>${esc(d.name)} <span class="bm-org">${esc(d.org)}</span></h2>
        <p class="bm-tests">${esc(d.tests)}</p>
      </div>
      <span class="bm-badge bm-badge-${status.level}">${esc(LEVEL_LABEL[status.level])}</span>
    </header>

    <p class="bm-headline">${esc(status.headline)}</p>

    ${status.arms && status.arms.length > 0 ? armsTable(status.arms, d.seesCollateral) : ""}

    ${
      status.stats && status.stats.length > 0
        ? `<dl class="bm-stats">${status.stats
            .map((s) => `<div><dt>${esc(s.label)}</dt><dd>${esc(s.value)}</dd></div>`)
            .join("")}</dl>`
        : ""
    }

    <div class="bm-meta">
      <span><strong>Official scorer:</strong> ${esc(d.officialScorer)}${
        d.seesCollateral ? " · sees state damage ✓" : " · blind to state damage"
      }</span>
      <span class="bm-source">${esc(d.source)}</span>
    </div>

    ${
      status.blockedOn && status.blockedOn.length > 0
        ? `<details class="bm-blocked"><summary>What blocks an efficacy verdict (${status.blockedOn.length})</summary>
        <ul>${status.blockedOn.map((b) => `<li>${esc(b)}</li>`).join("")}</ul></details>`
        : ""
    }
  </article>`;
}

/** A verdict pill: teal = clean/caught, red = damage — never green (CVD),
    always with an icon + word so identity is never colour-alone. */
const verdictCell = (result: LabArmResult): string => {
  if (result === null) return `<span class="bm-cell bm-cell-none">–</span>`;
  if (result === "fail") return `<span class="bm-cell bm-cell-fail">✗ fail</span>`;
  if (result === "blocked") return `<span class="bm-cell bm-cell-blocked">✓ blocked</span>`;
  return `<span class="bm-cell bm-cell-pass">✓ pass</span>`;
};

const meterRow = (
  label: string,
  n: number,
  total: number,
  tone: "good" | "bad",
  sub: string,
): string => `
  <div class="bm-meter-row">
    <span class="bm-meter-label">${esc(label)} <small>${esc(sub)}</small></span>
    <span class="bm-meter-track"><span class="bm-meter-fill bm-fill-${tone}" style="width:${total > 0 ? (n / total) * 100 : n === 0 ? 100 : 0}%"></span></span>
    <strong class="bm-txt-${tone}">${total > 0 ? `${n}/${total}` : String(n)}</strong>
  </div>`;

/** The controlled A/B verdict board: a protection meter + a status matrix
    where a column of red baseline failures flips to a column of teal. */
function labVerdictBoard(verdicts: readonly LabScenarioVerdict[]): string {
  if (verdicts.length === 0) {
    return `
    <p class="cp-note">No paired eval runs recorded yet. Populate the board:</p>
    <pre class="tk-cmd">pnpm evals:local-lab                 # deterministic, free
LOCAL_LAB_PROVIDER=openrouter pnpm evals:local-agent-lab:live   # all failure classes</pre>`;
  }
  const blocks = verdicts.filter((v) => v.expectedAdmission === "block");
  const allows = verdicts.filter((v) => v.expectedAdmission === "allow");
  const protectedCount = blocks.filter(
    (v) => v.baselineResult === "fail" && v.substrateResult !== "fail",
  ).length;
  const leaks = verdicts.filter((v) => v.substrateResult === "fail").length;
  const cleanControls = allows.filter(
    (v) => v.baselineResult !== "fail" && v.substrateResult !== "fail",
  ).length;

  const matrixRow = (v: LabScenarioVerdict): string => `
    <div class="bm-matrix-row">
      <span class="bm-matrix-name">${esc(v.scenarioId.replaceAll("-expected-allow", ""))}${
        v.expectedAdmission === "allow" ? ' <em>(control)</em>' : ""
      }<small>${esc(v.failureClass.replaceAll("_", " "))}</small></span>
      ${verdictCell(v.baselineResult)}
      <span class="bm-flip" aria-hidden="true">→</span>
      ${verdictCell(v.substrateResult)}
    </div>`;

  return `
    <div class="bm-meters">
      ${meterRow("Scenarios protected", protectedCount, blocks.length, "good", "baseline shipped bad state · substrate caught it")}
      ${meterRow("Substrate leaks", leaks, 0, leaks === 0 ? "good" : "bad", "wrong state that passed the gate — want 0")}
      ${meterRow("Allow-controls held", cleanControls, allows.length, "good", "deny-mutant guard: substrate didn't over-block")}
    </div>
    <div class="bm-matrix">
      <div class="bm-matrix-legend">
        <span>scenario</span>
        <span>baseline <small>validation OFF</small></span>
        <span></span>
        <span>substrate <small>validation ON</small></span>
      </div>
      ${[...blocks, ...allows].map(matrixRow).join("")}
    </div>`;
}

export function renderBenchmarksHtml(d: BenchmarksPayload): string {
  const labClasses = [...new Set(d.labScenarios.map((s) => s.failureClass))];
  return `
<section class="cp-root bm-root" data-view="benchmarks">
  <header class="cp-head">
    <div>
      <h1>Agent-state benchmarks</h1>
      <p>How pm-substrate compares on the public benchmarks built to expose agent-state
      failure. Every result is a matched four-arm run (native · sham · plain-KV ·
      <strong>substrate</strong>).</p>
    </div>
    <p class="cp-meta">run register ${esc(fmtWhen(d.recordedAt))}</p>
  </header>

  <div class="bm-boundary">
    <strong>Reading this honestly.</strong> ${esc(d.claimBoundary)} Nothing below is an efficacy
    claim — these are mechanism and conformance results, plus exactly what still blocks a verdict.
  </div>

  <div class="bm-cards">
    ${d.benchmarks.map(benchmarkCard).join("")}
  </div>

  <article class="cp-card bm-lab-link">
    <h2>Local Agent Lab — controlled A/B verdicts</h2>
    <p class="cp-note">Public benchmarks are coarse and expensive. The Local Agent Lab isolates
    ${d.labScenarios.length} scenarios across ${labClasses.length} agent-state failure classes and
    runs each one twice — validation OFF (baseline) vs ON (substrate) — so every mechanism gets a
    deterministic verdict. <strong>fail</strong> = the stale/wrong action became operational;
    <strong>blocked</strong> = the substrate refused it at the admission boundary.</p>
    ${labVerdictBoard(d.labVerdicts)}
    <p class="cp-note">Open <a href="/#lab">Local Agent Lab</a> to run new sessions, or
    <a href="/#token-kpis">Token KPIs</a> for the same runs measured as token cost.</p>
  </article>
</section>`;
}

/** Draw the real SVG charts after the HTML is in the DOM. */
export function hydrateBenchmarkCharts(root: HTMLElement, d: BenchmarksPayload): void {
  const ts = d.benchmarks.find((b) => b.id === "toolsandbox");
  if (!ts?.arms) return;
  const strict = root.querySelector<SVGElement>('[data-bm-chart="strict"]');
  const dup = root.querySelector<SVGElement>('[data-bm-chart="dup"]');
  if (strict) {
    drawVerticalBars(
      strict,
      ts.arms.map((a) => ({
        label: a.arm,
        v: a.strictScore ?? 0,
        tone: "neutral" as const,
        tip: `<b>${a.arm}</b><br>strict score: <b>${(a.strictScore ?? 0).toFixed(1)}</b>`,
      })),
      { max: 1, ticks: 2, fmt: (v) => v.toFixed(1), emphasize: "substrate" },
    );
  }
  if (dup) {
    drawVerticalBars(
      dup,
      ts.arms.map((a) => {
        const n = a.duplicateSideEffects ?? 0;
        const tone: Tone = n === 0 ? "good" : "bad";
        return {
          label: a.arm,
          v: n,
          tone,
          tip: `<b>${a.arm}</b><br>duplicate sends: <b class="${n === 0 ? "tt-teal" : "tt-red"}">${n}</b>${n === 0 ? " — clean" : " — shipped"}`,
        };
      }),
      { max: 2, ticks: 2, fmt: (v) => String(v), emphasize: "substrate" },
    );
  }
}

export async function mountBenchmarks(root: HTMLElement): Promise<void> {
  root.innerHTML = `<p class="cp-empty cp-loading">loading benchmark comparison…</p>`;
  try {
    const res = await fetch("/api/benchmarks");
    if (!res.ok) throw new Error(`benchmarks returned ${res.status}`);
    const data = (await res.json()) as BenchmarksPayload;
    root.innerHTML = renderBenchmarksHtml(data);
    hydrateBenchmarkCharts(root, data);
  } catch (err) {
    root.innerHTML = `<div class="cp-root"><article class="cp-card cp-card-critical">
      <h2>Benchmark comparison unavailable</h2>
      <p>${esc(String(err))}</p>
    </article></div>`;
  }
}
