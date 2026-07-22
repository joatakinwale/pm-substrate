/**
 * Token KPIs page — the capstone "Monitoring & control" view, in the
 * project definition's own KPI vocabulary: token efficiency (retry rate with
 * vs. without read-set validation; tokens wasted per retry), which feeds the
 * budgeting benefit model (the Token Savings Model workbook's blue cells
 * C7/C8/C9). Pure renderer over GET /api/token-usage(?label) — the server
 * runs the SAME @pm/local-agent-lab fold the CLI uses, so these numbers can
 * never disagree with a run's printed table or CSV.
 */

import { drawGroupedBars, drawHorizontalBars } from "./charts.js";
import { compactNumber } from "./control-plane-page.js";

export interface TokenKpiRunSummary {
  readonly runLabel: string;
  readonly lastRecordedAt: string;
  readonly attemptEvents: number;
  readonly providers: readonly string[];
  readonly models: readonly string[];
}

export interface TokenKpiMetrics {
  readonly generatedAt: string;
  readonly runLabel: string;
  readonly providers: readonly string[];
  readonly models: readonly string[];
  readonly totals: {
    readonly promptTokens: number;
    readonly completionTokens: number;
    readonly totalTokens: number;
    readonly costCredits: number | null;
  };
  readonly rows: readonly {
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
    readonly costCredits: number | null;
  }[];
  readonly c7BaselineRetryRate: number | null;
  readonly c8SubstrateRetryRate: number | null;
  readonly c9MeanTokensPerWastedAttempt: number | null;
  readonly c9ByMode: Readonly<Record<"no_substrate" | "substrate", number | null>>;
  readonly allowControlRetryRate: number | null;
  readonly corruptAdmissions: Readonly<Record<"no_substrate" | "substrate", number>>;
  readonly causeCounts: Readonly<Record<string, number>>;
}

const esc = (s: string): string =>
  s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const pct = (v: number | null): string => (v === null ? "–" : `${(v * 100).toFixed(1)}%`);
const num1 = (v: number | null): string => (v === null ? "–" : v.toFixed(1));
const credits = (v: number | null): string => (v === null ? "–" : v.toFixed(6));

const gaugeStat = (
  label: string,
  value: string,
  tone: "good" | "bad" | "neutral",
  hint: string,
): string => `
  <div class="gauge" data-tone="${tone}" title="${esc(hint)}">
    <div class="gauge-label">${esc(label)}</div>
    <div class="gauge-read"><span class="gauge-big gauge-${tone}">${esc(value)}</span></div>
    <div class="gauge-hint">${esc(hint)}</div>
  </div>`;

/** The empty state teaches the loop: run → events → this page + workbook. */
export function renderTokenKpisEmptyHtml(): string {
  return `
<section class="cp-root" data-view="token-kpis">
  <header class="cp-head">
    <div>
      <h1>Token KPIs</h1>
      <p>Monitoring &amp; control — token efficiency, measured from admitted eval events.</p>
    </div>
  </header>
  <article class="cp-card">
    <h2>No A/B runs recorded yet</h2>
    <p class="cp-note">Produce the first measurement, then this page (and the workbook's blue
    cells) fill themselves:</p>
    <pre class="tk-cmd">pnpm capstone:token-ab -- --repeats 3 --scenarios stale --provider openrouter</pre>
    <p class="cp-note">Each run writes a CSV to docs/evidence/capstone/, appends the RUNS.md
    register, and records one eval.token.usage event per attempt in the admitted log — which is
    exactly what this page reads.</p>
  </article>
</section>`;
}

export function renderTokenKpisHtml(
  d: TokenKpiMetrics,
  runs: readonly TokenKpiRunSummary[],
): string {
  const baselineShipped = d.corruptAdmissions.no_substrate;
  const substrateShipped = d.corruptAdmissions.substrate;
  const causes = Object.entries(d.causeCounts).filter(([cause]) => cause !== "none");
  const causeMax = Math.max(...causes.map(([, count]) => count), 1);
  const options = runs
    .map(
      (r) =>
        `<option value="${esc(r.runLabel)}"${r.runLabel === d.runLabel ? " selected" : ""}>
          ${esc(r.runLabel)} · ${esc(r.models.join(", "))} · ${esc(r.lastRecordedAt.slice(0, 10))}
        </option>`,
    )
    .join("");

  return `
<section class="cp-root" data-view="token-kpis">
  <div class="gate-console">
    <div class="gate-bar">
      <span class="gate-led" aria-hidden="true" style="animation-duration: 4.8s;"></span>
      <span class="gate-status">Token efficiency telemetry</span>
      <span class="gate-run">run ${esc(d.runLabel)}</span>
      <details class="bm-honesty">
         <summary>?</summary>
         <p>Derived from the same raw telemetry used in the Token Savings Model workbook.</p>
      </details>
    </div>
    
    <div class="gate-hero" style="padding-bottom: 20px">
      <span class="bm-kicker">Budgeting</span>
      <div style="display: flex; justify-content: space-between; align-items: start; flex-wrap: wrap; gap: 16px;">
        <h1 style="margin:0">Token Savings &amp; Efficiency</h1>
        <label class="tk-run-picker">
          <select data-tk-run>${options}</select>
        </label>
      </div>
    </div>

    <div class="tk-gauges" style="margin-bottom: 20px;">
      ${gaugeStat("Retry rate — val OFF (C7)", pct(d.c7BaselineRetryRate), "neutral", "baseline arm (no substrate)")}
      ${gaugeStat("Retry rate — val ON (C8)", pct(d.c8SubstrateRetryRate), "neutral", "substrate arm (read-set validation)")}
      ${gaugeStat("Tokens wasted per retry (C9)", num1(d.c9MeanTokensPerWastedAttempt), "neutral", `baseline ${num1(d.c9ByMode.no_substrate)} · substrate ${num1(d.c9ByMode.substrate)}`)}
      ${gaugeStat("Wrong-state shipped", `${baselineShipped} → ${substrateShipped}`, substrateShipped > 0 ? "bad" : baselineShipped > 0 ? "good" : "neutral", "baseline vs substrate (admitted but wrong)")}
      ${gaugeStat("Tokens metered", compactNumber(d.totals.totalTokens), "neutral", `${compactNumber(d.totals.promptTokens)} prompt · ${compactNumber(d.totals.completionTokens)} completion`)}
      ${gaugeStat("Metered cost", d.totals.costCredits === null ? "free (local)" : credits(d.totals.costCredits), "neutral", d.totals.costCredits === null ? "Ollama run" : "OpenRouter credits (≈ USD)")}
    </div>
  </div>

  <div class="cp-grid tk-charts">
    <article class="cp-card">
      <div class="tk-chart-head">Wrong-state writes shipped</div>
      <p class="cp-note" style="margin-top:2px">Admitted actions the oracle later judged wrong — validation OFF vs ON.</p>
      <svg class="tk-svg" data-tk-chart="corrupt" viewBox="0 0 640 150" role="img" aria-label="Corrupt admissions: baseline vs substrate"></svg>
    </article>
    <article class="cp-card">
      <div class="controls">
        <div class="tk-chart-head">Tokens per hazard scenario</div>
        <div class="tk-spacer"></div>
        <div class="tk-seg" role="group" aria-label="Metric">
          <button type="button" data-tk-metric="wasted" aria-pressed="true">wasted</button>
          <button type="button" data-tk-metric="total" aria-pressed="false">total</button>
        </div>
      </div>
      <div class="tk-legend">
        <span><i class="tk-sw" style="background:var(--slate)"></i> baseline (OFF)</span>
        <span><i class="tk-sw" style="background:var(--teal)"></i> substrate (ON)</span>
      </div>
      <svg class="tk-svg" data-tk-chart="tokens" viewBox="0 0 720 260" role="img" aria-label="Tokens per scenario, baseline vs substrate"></svg>
    </article>
  </div>

  <div class="cp-grid">
    <article class="cp-card" data-kpi="reading">
      <h2>How to read this run</h2>
      <p class="cp-note">Both arms re-attempt after a <em>detected</em> failure, so on
      deterministic hazards the two retry rates converge — that is expected, not a null.
      The measured difference is the row above: the baseline arm <strong>shipped the wrong
      state ${baselineShipped} time${baselineShipped === 1 ? "" : "s"} before recovering</strong>;
      the substrate blocked every one pre-commit with a named cause. In production the
      baseline's failures have no oracle to catch them — that is where the workbook's
      modeled savings apply.</p>
      <h3>Why each retry happened (gate-attributed)</h3>
      ${
        causes.length === 0
          ? `<p class="cp-empty">no failed attempts</p>`
          : `<div class="cp-bars">${causes
              .map(
                ([cause, count]) => `
      <div class="cp-bar-row" title="${esc(cause)}: ${count}">
        <code class="cp-bar-label">${esc(cause)}</code>
        <span class="cp-bar-track"><span class="cp-bar-fill" style="width:${Math.max((count / causeMax) * 100, 2).toFixed(1)}%"></span></span>
        <span class="cp-bar-value">${count}</span>
      </div>`,
              )
              .join("")}</div>`
      }
      <p class="cp-note">Deny-mutant guard — retry rate on expected-allow controls (must stay
      ~0 or the gate is over-blocking): <strong>${pct(d.allowControlRetryRate)}</strong></p>
    </article>

    <article class="cp-card" data-kpi="scenarios">
      <h2>Per-scenario A/B detail</h2>
      <div class="tk-table-wrap">
        <table class="tk-table">
          <thead><tr>
            <th>scenario</th><th>arm</th><th>tasks</th><th>attempts</th><th>retries</th>
            <th>terminal fails</th><th>tokens wasted / total</th><th>credits</th>
          </tr></thead>
          <tbody>
            ${d.rows
              .map(
                (r) => `
            <tr class="${r.expectedAdmission === "allow" ? "tk-allow" : ""}">
              <td>${esc(r.scenario)}${r.expectedAdmission === "allow" ? " <em>(allow-control)</em>" : ""}</td>
              <td>${r.mode === "no_substrate" ? "validation OFF" : "validation ON"}</td>
              <td>${r.tasks}</td><td>${r.attempts}</td><td>${r.retries}</td>
              <td>${r.terminalFailures}</td>
              <td>${r.tokensWasted.toLocaleString("en-US")} / ${r.tokensTotal.toLocaleString("en-US")}</td>
              <td>${r.costCredits === null ? "–" : credits(r.costCredits)}</td>
            </tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </div>
      <p class="cp-note">run ${esc(d.runLabel)} · ${esc(d.providers.join(", "))} ·
      ${esc(d.models.join(", "))} · generated ${esc(d.generatedAt.slice(0, 16).replace("T", " "))} UTC ·
      same fold as <code>pnpm report:token-usage -- --label ${esc(d.runLabel)}</code></p>
    </article>
  </div>
</section>`;
}

const niceMax = (v: number, step: number): number => Math.max(step, Math.ceil(v / step) * step);

/** Draw the real SVG charts once the HTML is mounted. */
export function hydrateTokenKpiCharts(root: HTMLElement, d: TokenKpiMetrics): void {
  const corrupt = root.querySelector<SVGElement>('[data-tk-chart="corrupt"]');
  if (corrupt) {
    const b = d.corruptAdmissions.no_substrate;
    const s = d.corruptAdmissions.substrate;
    drawHorizontalBars(
      corrupt,
      [
        { name: "baseline", sub: "validation OFF", v: b, tone: "bad", tip: `<b>baseline</b><br>wrong-state writes: <b class="tt-red">${b}</b>` },
        { name: "substrate", sub: "validation ON", v: s, tone: "good", tip: `<b>substrate</b><br>wrong-state writes: <b class="tt-teal">${s}</b>` },
      ],
      { max: niceMax(Math.max(b, s, 1) + 1, 2) },
    );
  }

  const tokensSvg = root.querySelector<SVGElement>('[data-tk-chart="tokens"]');
  if (tokensSvg) {
    const byScenario = new Map<string, { scenario: string; baseW: number; baseT: number; subW: number; subT: number }>();
    for (const r of d.rows.filter((x) => x.expectedAdmission === "block")) {
      const e = byScenario.get(r.scenario) ?? { scenario: r.scenario, baseW: 0, baseT: 0, subW: 0, subT: 0 };
      if (r.mode === "no_substrate") {
        e.baseW = r.tokensWasted;
        e.baseT = r.tokensTotal;
      } else {
        e.subW = r.tokensWasted;
        e.subT = r.tokensTotal;
      }
      byScenario.set(r.scenario, e);
    }
    const scen = [...byScenario.values()];
    let metric: "wasted" | "total" = "wasted";
    const draw = (): void => {
      const max = niceMax(Math.max(...scen.flatMap((s) => (metric === "wasted" ? [s.baseW, s.subW] : [s.baseT, s.subT])), 1), 100);
      drawGroupedBars(
        tokensSvg,
        scen.map((s) => ({
          label: s.scenario,
          a: metric === "wasted" ? s.baseW : s.baseT,
          b: metric === "wasted" ? s.subW : s.subT,
          tipA: `<b>${s.scenario}</b><br>baseline ${metric}: <b>${metric === "wasted" ? s.baseW : s.baseT}</b> tokens`,
          tipB: `<b>${s.scenario}</b><br>substrate ${metric}: <b class="tt-teal">${metric === "wasted" ? s.subW : s.subT}</b> tokens`,
        })),
        { max, ticks: 4 },
      );
    };
    draw();
    root.querySelectorAll<HTMLButtonElement>("[data-tk-metric]").forEach((btn) =>
      btn.addEventListener("click", () => {
        root.querySelectorAll("[data-tk-metric]").forEach((x) => x.setAttribute("aria-pressed", "false"));
        btn.setAttribute("aria-pressed", "true");
        metric = btn.dataset["tkMetric"] === "total" ? "total" : "wasted";
        draw();
      }),
    );
  }
}

/** Browser bootstrap: run list → newest run → render; picker re-fetches. */
export async function mountTokenKpis(root: HTMLElement): Promise<void> {
  root.innerHTML = `<p class="cp-empty cp-loading">loading token KPIs…</p>`;
  try {
    const runsRes = await fetch("/api/token-usage/runs");
    if (!runsRes.ok) throw new Error(`token-usage runs returned ${runsRes.status}`);
    const { runs } = (await runsRes.json()) as { runs: TokenKpiRunSummary[] };
    if (runs.length === 0) {
      root.innerHTML = renderTokenKpisEmptyHtml();
      return;
    }
    const load = async (label: string): Promise<void> => {
      const res = await fetch(`/api/token-usage?label=${encodeURIComponent(label)}`);
      if (!res.ok) throw new Error(`token-usage returned ${res.status}`);
      const metrics = (await res.json()) as TokenKpiMetrics;
      root.innerHTML = renderTokenKpisHtml(metrics, runs);
      hydrateTokenKpiCharts(root, metrics);
      root
        .querySelector<HTMLSelectElement>("[data-tk-run]")
        ?.addEventListener("change", (event) => {
          void load((event.target as HTMLSelectElement).value);
        });
    };
    await load(runs[0]!.runLabel);
  } catch (err) {
    root.innerHTML = `<div class="cp-root"><article class="cp-card cp-card-critical">
      <h2>Token KPIs unavailable</h2>
      <p>${esc(String(err))}</p>
      <p class="cp-note">Is PM_DATABASE_URL set for the dashboard server?</p>
    </article></div>`;
  }
}
