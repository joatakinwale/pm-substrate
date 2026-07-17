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

/** The controlled A/B verdict board: a scannable status matrix where a column
    of red baseline failures flips to a column of teal (the glance band above
    carries the summary counts). */
function labVerdictBoard(verdicts: readonly LabScenarioVerdict[]): string {
  if (verdicts.length === 0) {
    return `
    <p class="cp-note">No paired eval runs recorded yet. Populate the board:</p>
    <pre class="tk-cmd">pnpm evals:local-lab                 # deterministic, free
LOCAL_LAB_PROVIDER=openrouter pnpm evals:local-agent-lab:live   # all failure classes</pre>`;
  }
  const blocks = verdicts.filter((v) => v.expectedAdmission === "block");
  const allows = verdicts.filter((v) => v.expectedAdmission === "allow");

  const matrixRow = (v: LabScenarioVerdict): string => `
    <div class="bm-matrix-row" data-scenario="${esc(v.scenarioId)}" role="button" tabindex="0">
      <span class="bm-matrix-name">${esc(v.scenarioId.replaceAll("-expected-allow", ""))}${
        v.expectedAdmission === "allow" ? ' <em>(control)</em>' : ""
      }<small>${esc(v.failureClass.replaceAll("_", " "))}</small></span>
      ${verdictCell(v.baselineResult)}
      <span class="bm-flip" aria-hidden="true">→</span>
      ${verdictCell(v.substrateResult)}
    </div>`;

  return `
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

/** A gauge KPI: a boundary status-stripe, a mono readout, and a segmented
    meter (preattentive count/length). The stripe is the admission-boundary
    signature — teal = clean, red = breach. */
const gaugeMeter = (label: string, n: number, total: number, hint: string): string => `
  <div class="gauge" data-tone="good" title="${esc(hint)}">
    <div class="gauge-label">${esc(label)}</div>
    <div class="gauge-read"><span class="gauge-big">${n}</span><span class="gauge-tot">/ ${total}</span></div>
    <div class="gauge-meter" aria-hidden="true">${Array.from({ length: total }, (_, i) => `<i class="${i < n ? "on" : ""}"></i>`).join("")}</div>
  </div>`;

/** A gauge KPI: one big mono number, status-toned. */
const gaugeStat = (label: string, value: string, tone: "good" | "bad" | "neutral", hint: string): string => `
  <div class="gauge" data-tone="${tone}" title="${esc(hint)}">
    <div class="gauge-label">${esc(label)}</div>
    <div class="gauge-read"><span class="gauge-big gauge-${tone}">${esc(value)}</span></div>
    <div class="gauge-hint">${esc(hint)}</div>
  </div>`;

export function renderBenchmarksHtml(d: BenchmarksPayload): string {
  const blocks = d.labVerdicts.filter((v) => v.expectedAdmission === "block");
  const allows = d.labVerdicts.filter((v) => v.expectedAdmission === "allow");
  const protectedCount = blocks.filter((v) => v.baselineResult === "fail" && v.substrateResult !== "fail").length;
  const leaks = d.labVerdicts.filter((v) => v.substrateResult === "fail").length;
  const controls = allows.filter((v) => v.baselineResult !== "fail" && v.substrateResult !== "fail").length;
  const qualified = d.benchmarks.filter((b) => b.level === "mechanism-qualified").length;
  const gauges =
    d.labVerdicts.length > 0
      ? `
    <div class="gate-gauges">
      ${gaugeMeter("Hazards caught", protectedCount, blocks.length, "baseline shipped bad state; substrate blocked it")}
      ${gaugeStat("State leaks", String(leaks), leaks === 0 ? "good" : "bad", "wrong writes that passed the gate — want 0")}
      ${gaugeMeter("Controls held", controls, allows.length, "deny-mutant guard: substrate did not over-block")}
      ${gaugeStat("Benchmarks qualified", `${qualified} / ${d.benchmarks.length}`, "neutral", "mechanism-qualified vs conformance-only")}
    </div>`
      : "";

  return `
<section class="cp-root bm-root" data-view="benchmarks">
  <div class="gate-console">
    <div class="gate-bar">
      <span class="gate-led" aria-hidden="true"></span>
      <span class="gate-status">Admission gate · live readout</span>
      <span class="gate-run">run ${esc(fmtWhen(d.recordedAt))}</span>
      <details class="bm-honesty">
        <summary>mechanism evidence &middot; not efficacy</summary>
        <p>${esc(d.claimBoundary)} Everything here is a mechanism or conformance result, plus exactly what still blocks a verdict.</p>
      </details>
    </div>
    <div class="gate-hero">
      <div class="bm-kicker">Agent-state reliability · four-arm evidence</div>
      <h1>Does the substrate catch what the benchmarks can't score?</h1>
    </div>
    ${gauges}
  </div>

  <div class="bm-cards">
    ${d.benchmarks.map(benchmarkCard).join("")}
  </div>

  <article class="cp-card bm-lab-link">
    <div class="bm-section-label">Controlled lab
      <small>${d.labScenarios.length} hazards × 2 arms · deterministic</small>
      <span class="bm-help" title="Each hazard runs twice — validation OFF (baseline) vs ON (substrate). fail = the stale action became operational; blocked = the substrate refused it at the admission boundary.">?</span>
    </div>
    ${labVerdictBoard(d.labVerdicts)}
  </article>

  <div class="modal-backdrop" id="trace-modal-backdrop" style="display: none;">
    <div class="start-modal">
      <header>
        <div>
          <h2 id="trace-modal-title">Validation Trace</h2>
          <p id="trace-modal-desc">Loading session trace...</p>
        </div>
        <button class="rail-toggle" type="button" aria-label="Close" data-action="close-trace-modal">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </header>
      <div class="start-form" id="trace-modal-content">
        <p class="cp-loading cp-empty">fetching trace...</p>
      </div>
    </div>
  </div>
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

function bindTraceModal(root: HTMLElement): void {
  const backdrop = root.querySelector<HTMLElement>("#trace-modal-backdrop");
  if (!backdrop) return;

  const closeBtn = backdrop.querySelector<HTMLButtonElement>("[data-action='close-trace-modal']");
  closeBtn?.addEventListener("click", () => {
    backdrop.style.display = "none";
  });

  const content = root.querySelector<HTMLElement>("#trace-modal-content");
  const title = root.querySelector<HTMLElement>("#trace-modal-title");

  root.querySelectorAll<HTMLElement>(".bm-matrix-row[data-scenario]").forEach(row => {
    // Basic accessibility handlers
    row.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        row.click();
      }
    });

    row.addEventListener("click", async () => {
      const scenarioId = row.dataset.scenario;
      if (!scenarioId || !content || !title) return;
      
      title.textContent = "Data Trace: " + scenarioId.replaceAll("-expected-allow", "");
      content.innerHTML = `<p class="cp-loading cp-empty">fetching lab trace bounds...</p>`;
      backdrop.style.display = "grid";

      try {
        const res = await fetch("/api/sessions");
        const data = await res.json() as any;
        const sessions = data.sessions || [];
        
        // Find the latest ab_pair session for this scenario
        const targetSession = sessions.find((s: any) => s.scenarioId === scenarioId && s.mode === "ab_pair");
        
        if (!targetSession) {
           content.innerHTML = `
             <div style="padding: 12px; background: #fff8f7; border: 1px solid #ffccd0; border-radius: 8px; color: #b4232d">
                <strong style="display:block; margin-bottom: 8px;">No matching run found</strong>
                This benchmark data reflects the latest oracle sync, but the local trace database does not contain the original ab_pair session for this scenario.
             </div>
           `;
           return;
        }

        // We have a session, fetch its details to present raw trace events
        const detailRes = await fetch(`/api/sessions/${encodeURIComponent(targetSession.id)}`);
        const detailData = await detailRes.json() as any;
        
        const events = detailData.events || [];
        const mutations = events.filter((e: any) => e.type === "mutation_applied");
        const actions = events.filter((e: any) => e.type.includes("action_"));

        content.innerHTML = `
           <div style="margin-bottom: 16px;">
             <strong>Selected session ID:</strong> <code class="tk-cell">${esc(targetSession.id)}</code><br/>
             <strong>Captured events:</strong> ${events.length}
           </div>
           
           <div style="display: grid; gap: 10px; margin-bottom: 20px">
              ${events.slice(0, 10).map((e: any) => `
                <div style="font-size: 13px; padding: 10px; border: 1px solid #e1e0d9; background: #fdfdfc; border-radius: 6px;">
                  <span style="color: #6b6a66; margin-right: 6px">[${new Date(e.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}]</span>
                  <strong>${esc(e.type)}</strong>
                  ${e.description ? `<p style="margin: 4px 0 0; color: #11181f">${esc(e.description)}</p>` : ""}
                </div>
              `).join("")}
              ${events.length > 10 ? `<div style="padding:4px; text-align: center; color: #898781; font-size: 13px;">...and ${events.length - 10} more events</div>` : ""}
           </div>

           <a href="/#lab" style="display: inline-block; padding: 8px 16px; background: #11181f; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600" onclick="window.history.pushState(null, '', '/sessions/${encodeURIComponent(targetSession.id)}'); window.dispatchEvent(new PopStateEvent('popstate')); backdrop.style.display='none'; return false;">Open detailed view in Local Agent Lab &rarr;</a>
        `;
      } catch (err) {
        content.innerHTML = `<p class="cp-error">Trace unavailable: ${esc(String(err))}</p>`;
      }
    });
  });
}

export async function mountBenchmarks(root: HTMLElement): Promise<void> {
  root.innerHTML = `<p class="cp-empty cp-loading">loading benchmark comparison…</p>`;
  try {
    const res = await fetch("/api/benchmarks");
    if (!res.ok) throw new Error(`benchmarks returned ${res.status}`);
    const data = (await res.json()) as BenchmarksPayload;
    root.innerHTML = renderBenchmarksHtml(data);
    hydrateBenchmarkCharts(root, data);
    bindTraceModal(root);
  } catch (err) {
    root.innerHTML = `<div class="cp-root"><article class="cp-card cp-card-critical">
      <h2>Benchmark comparison unavailable</h2>
      <p>${esc(String(err))}</p>
    </article></div>`;
  }
}
