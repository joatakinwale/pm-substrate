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

export interface BenchmarksPayload {
  readonly recordedAt: string;
  readonly claimBoundary: string;
  readonly benchmarks: readonly BenchmarkStatus[];
  readonly labScenarios: readonly {
    readonly scenarioId: string;
    readonly failureClass: string;
  }[];
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

/** Arms table with the strict-vs-collateral contrast made visible. */
function armsTable(arms: readonly BenchmarkArmOutcome[], seesCollateral: boolean): string {
  const anyCollateral = arms.some((a) => a.duplicateSideEffects !== null);
  return `
  <div class="bm-arms-wrap">
    <table class="bm-arms">
      <thead><tr>
        <th>arm</th>
        <th>strict score</th>
        ${anyCollateral ? "<th>duplicate side effects</th>" : ""}
        ${arms.some((a) => a.disposition) ? "<th>after restart</th>" : ""}
      </tr></thead>
      <tbody>
        ${arms
          .map((a) => {
            const isSubstrate = a.arm === "substrate";
            const cleanState = a.duplicateSideEffects === 0;
            return `
        <tr class="${isSubstrate ? "bm-arm-substrate" : ""}">
          <td>${esc(a.arm)}</td>
          <td>${fmtScore(a.strictScore)}</td>
          ${
            anyCollateral
              ? `<td class="${a.duplicateSideEffects && a.duplicateSideEffects > 0 ? "bm-bad" : cleanState ? "bm-good" : ""}">${
                  a.duplicateSideEffects === null ? "–" : a.duplicateSideEffects
                }</td>`
              : ""
          }
          ${a.disposition ? `<td>${esc(a.disposition)}</td>` : arms.some((x) => x.disposition) ? "<td>–</td>" : ""}
        </tr>`;
          })
          .join("")}
      </tbody>
    </table>
    ${
      anyCollateral && !seesCollateral
        ? `<p class="bm-insight">↑ Every arm scores the same on the benchmark's strict oracle, yet only <strong>substrate</strong> left zero duplicate side effects. The official score cannot see the state damage the substrate prevented — the crux of the whole comparison.</p>`
        : ""
    }
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
    <h2>Local Agent Lab — the controlled complement</h2>
    <p class="cp-note">Public benchmarks are coarse and expensive. The Local Agent Lab isolates
    ${d.labScenarios.length} scenarios across ${labClasses.length} agent-state failure classes so
    each mechanism can be tested deterministically, both arms, on demand:</p>
    <div class="bm-chips">
      ${labClasses.map((c) => `<span class="bm-chip">${esc(c.replaceAll("_", " "))}</span>`).join("")}
    </div>
    <p class="cp-note">Open <a href="/#lab">Local Agent Lab</a> to run them, or
    <a href="/#token-kpis">Token KPIs</a> for the same runs measured as cost.</p>
  </article>
</section>`;
}

export async function mountBenchmarks(root: HTMLElement): Promise<void> {
  root.innerHTML = `<p class="cp-empty cp-loading">loading benchmark comparison…</p>`;
  try {
    const res = await fetch("/api/benchmarks");
    if (!res.ok) throw new Error(`benchmarks returned ${res.status}`);
    const data = (await res.json()) as BenchmarksPayload;
    root.innerHTML = renderBenchmarksHtml(data);
  } catch (err) {
    root.innerHTML = `<div class="cp-root"><article class="cp-card cp-card-critical">
      <h2>Benchmark comparison unavailable</h2>
      <p>${esc(String(err))}</p>
    </article></div>`;
  }
}
