/**
 * Control-plane page (ROADMAP D4, rendering half). Renders the five-question
 * payload from GET /api/control-plane (dashboard server proxy of
 * substrate-http's /tenants/:tenantId/control-plane). Pure renderer —
 * deterministic HTML from data — so it is unit-testable without a browser.
 *
 * Form choices (dataviz method): headline numbers are a KPI row of stat
 * tiles, not charts; admitted-events-by-type is a single-hue horizontal bar
 * list (magnitude → sequential blue, values labeled per row); long ledger
 * prose (handoff, decisions, lessons) collapses behind <details> so the page
 * stays scannable. Status color appears only on the hash-chain state, with
 * an icon + label.
 */

export interface ControlPlanePayload {
  readonly tenantId: string;
  readonly scope: string;
  readonly generatedAt: string;
  readonly beingDone: {
    readonly openWork: readonly { title: string; summary: string }[];
    readonly lastHandoff: { title: string; summary: string } | null;
  };
  readonly governance: {
    readonly eventsByType: readonly { type: string; count: number }[];
    readonly stageGateApplications: number;
    readonly procedureAdmissions: number;
    readonly mcpActionsBlocked: number;
    readonly workDispatched: number;
  };
  readonly costs: { readonly totalTokens: number; readonly labeledSessions: number };
  readonly integration: {
    readonly adaptersRegistered: number;
    readonly syncUpserted: number;
    readonly syncRejected: number;
    readonly executorDispatched: number;
    readonly executorRefused: number;
    readonly executorFailed: number;
  };
  readonly results: {
    readonly decisions: readonly { title: string; summary: string }[];
    readonly claimsUnderTest: readonly { title: string; summary: string }[];
  };
  readonly optimized: {
    readonly closedWork: readonly { title: string; closedAt: string }[];
    readonly lessons: readonly { title: string; summary: string }[];
  };
  readonly integrity: {
    readonly checkpointCount: number;
    readonly chainValid: boolean;
    readonly chainErrors: readonly string[];
  };
}

const esc = (s: string): string =>
  s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

/** Stat-tile value formatting: 1,284 / 349.5K / 2.3M. */
export function compactNumber(n: number): string {
  if (!Number.isFinite(n)) return "–";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${trimTo1(n / 1_000_000)}M`;
  if (abs >= 10_000) return `${trimTo1(n / 1_000)}K`;
  return n.toLocaleString("en-US");
}

const trimTo1 = (v: number): string => {
  const s = v.toFixed(1);
  return s.endsWith(".0") ? s.slice(0, -2) : s;
};

const fmtWhen = (iso: string): string => {
  const m = iso.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  return m ? `${m[1]} ${m[2]} UTC` : iso;
};

const fmtDay = (iso: string): string => iso.slice(0, 10);

const tile = (opts: {
  q: string;
  label: string;
  value: string;
  sub?: string;
  tone?: "good" | "critical";
}): string => `
  <div class="cp-tile" data-q="${opts.q}">
    <span class="cp-tile-label">${esc(opts.label)}</span>
    <span class="cp-tile-value${opts.tone ? ` cp-${opts.tone}` : ""}">${opts.value}</span>
    ${opts.sub ? `<span class="cp-tile-sub">${esc(opts.sub)}</span>` : ""}
  </div>`;

/** Collapsible prose item: scannable title, full text on demand. */
const foldItem = (r: { title: string; summary: string }): string => `
  <details class="cp-fold">
    <summary>${esc(r.title)}</summary>
    <p>${esc(r.summary)}</p>
  </details>`;

const foldList = (
  rows: readonly { title: string; summary: string }[],
  empty: string,
): string =>
  rows.length === 0
    ? `<p class="cp-empty">${esc(empty)}</p>`
    : rows.map(foldItem).join("");

/** Single-hue horizontal bar list: label · track+fill · value per row. */
const barList = (rows: readonly { type: string; count: number }[]): string => {
  if (rows.length === 0) return `<p class="cp-empty">no admitted events yet</p>`;
  const max = Math.max(...rows.map((r) => r.count), 1);
  return `
  <div class="cp-bars">
    ${rows
      .map(
        (r) => `
    <div class="cp-bar-row" title="${esc(r.type)}: ${r.count.toLocaleString("en-US")}">
      <code class="cp-bar-label">${esc(r.type)}</code>
      <span class="cp-bar-track"><span class="cp-bar-fill" style="width:${Math.max(
        (r.count / max) * 100,
        2,
      ).toFixed(1)}%"></span></span>
      <span class="cp-bar-value">${r.count.toLocaleString("en-US")}</span>
    </div>`,
      )
      .join("")}
  </div>`;
};

const kv = (label: string, value: string): string => `
  <div class="cp-kv"><dt>${esc(label)}</dt><dd>${value}</dd></div>`;

/** Deterministic HTML for the five questions + integrity. */
export function renderControlPlaneHtml(d: ControlPlanePayload): string {
  const admittedTotal = d.governance.eventsByType.reduce((a, e) => a + e.count, 0);
  const openWork = d.beingDone.openWork;

  return `
<section class="cp-root">
  <header class="cp-head">
    <div>
      <h1>Control plane</h1>
      <p>Five questions, answered from the admitted log — never from self-report.</p>
    </div>
    <p class="cp-meta">${esc(d.tenantId)} · ${esc(d.scope)} · generated ${esc(fmtWhen(d.generatedAt))}</p>
  </header>

  <div class="cp-tiles">
    ${tile({ q: "being-done", label: "Open work", value: String(openWork.length) })}
    ${tile({
      q: "governance",
      label: "Admitted events",
      value: compactNumber(admittedTotal),
      sub: `across ${d.governance.eventsByType.length} event types`,
    })}
    ${tile({
      q: "governance",
      label: "Actions blocked",
      value: String(d.governance.mcpActionsBlocked + d.integration.executorRefused),
      sub: `${d.governance.mcpActionsBlocked} MCP · ${d.integration.executorRefused} executor`,
    })}
    ${tile({ q: "governance", label: "Work dispatched", value: String(d.governance.workDispatched) })}
    ${tile({
      q: "costs",
      label: "Tokens spent",
      value: compactNumber(d.costs.totalTokens),
      sub: `${d.costs.labeledSessions} labeled session${d.costs.labeledSessions === 1 ? "" : "s"}`,
    })}
    ${tile({
      q: "integrity",
      label: "Hash chain",
      value: d.integrity.chainValid ? "✓ Valid" : "✕ Broken",
      sub: `${d.integrity.checkpointCount} checkpoints`,
      tone: d.integrity.chainValid ? "good" : "critical",
    })}
  </div>

  <nav class="page-tabs cp-tabs" aria-label="Control plane sections">
    <button class="page-tab active" type="button" data-cp-tab="overview" aria-selected="true">Overview</button>
    <button class="page-tab" type="button" data-cp-tab="governance" aria-selected="false">Governance</button>
    <button class="page-tab" type="button" data-cp-tab="results" aria-selected="false">Results</button>
    <button class="page-tab" type="button" data-cp-tab="optimization" aria-selected="false">Optimization</button>
  </nav>

  <div class="cp-tab-panels">
    <section class="cp-tab-panel active" data-cp-panel="overview">
      <div class="cp-grid">
        <article class="cp-card" data-q="being-done">
          <h2>What is being done</h2>
          ${
            openWork.length === 0
              ? `<p class="cp-empty">No open work — the ledger is clear.</p>`
              : openWork
                  .map(
                    (w) => `
          <div class="cp-work">
            <strong>${esc(w.title)}</strong>
            <p class="cp-clamp">${esc(w.summary)}</p>
          </div>`,
                  )
                  .join("")
          }
          ${
            d.beingDone.lastHandoff
              ? `<details class="cp-fold cp-handoff">
            <summary>Last handoff · ${esc(d.beingDone.lastHandoff.title)}</summary>
            <p>${esc(d.beingDone.lastHandoff.summary)}</p>
          </details>`
              : ""
          }
        </article>
        ${
          d.integrity.chainValid
            ? ""
            : `
        <article class="cp-card cp-card-critical" data-q="integrity-errors">
          <h2>Chain integrity errors</h2>
          <ul>${d.integrity.chainErrors.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>
        </article>`
        }
      </div>
    </section>

    <section class="cp-tab-panel" data-cp-panel="governance" hidden>
      <div class="cp-grid">
        <article class="cp-card" data-q="governance">
          <h2>What governance did</h2>
          <dl class="cp-kvs">
            ${kv("Stage-gate applications", String(d.governance.stageGateApplications))}
            ${kv("Procedure admissions", String(d.governance.procedureAdmissions))}
            ${kv("MCP actions blocked", String(d.governance.mcpActionsBlocked))}
            ${kv("Work dispatched", String(d.governance.workDispatched))}
          </dl>
          <h3>Admitted events by type</h3>
          ${barList(d.governance.eventsByType)}
        </article>

        <article class="cp-card" data-q="integration">
          <h2>Attached apps</h2>
          <p class="cp-note">Integration-kit activity — external apps governed through mapping + admission.</p>
          <dl class="cp-kvs">
            ${kv("Adapters registered", String(d.integration.adaptersRegistered))}
            ${kv("Sync upserted", String(d.integration.syncUpserted))}
            ${kv("Sync rejected", String(d.integration.syncRejected))}
            ${kv("Executor dispatched", String(d.integration.executorDispatched))}
            ${kv("Executor refused", String(d.integration.executorRefused))}
            ${kv("Executor failed", String(d.integration.executorFailed))}
          </dl>
        </article>
      </div>
    </section>

    <section class="cp-tab-panel" data-cp-panel="results" hidden>
      <div class="cp-grid">
        <article class="cp-card" data-q="results">
          <h2>Decisions &amp; claims</h2>
          ${foldList(d.results.decisions, "no standing decisions")}
          <h3>Claims under test</h3>
          ${foldList(d.results.claimsUnderTest, "none")}
        </article>
      </div>
    </section>

    <section class="cp-tab-panel" data-cp-panel="optimization" hidden>
      <div class="cp-grid">
        <article class="cp-card" data-q="optimized">
          <h2>What got optimized</h2>
          ${
            d.optimized.closedWork.length === 0
              ? `<p class="cp-empty">nothing closed yet</p>`
              : `<ul class="cp-closed">${d.optimized.closedWork
                  .map(
                    (w) =>
                      `<li><span>${esc(w.title)}</span><time>${esc(fmtDay(w.closedAt))}</time></li>`,
                  )
                  .join("")}</ul>`
          }
          <h3>Lessons</h3>
          ${foldList(d.optimized.lessons, "none")}
        </article>
      </div>
    </section>
  </div>
</section>`;
}

function bindControlPlaneTabs(root: HTMLElement): void {
  const buttons = root.querySelectorAll<HTMLButtonElement>("[data-cp-tab]");
  for (const button of buttons) {
    button.addEventListener("click", () => {
      const tab = button.dataset["cpTab"];
      if (!tab) return;
      for (const item of buttons) {
        const active = item === button;
        item.classList.toggle("active", active);
        item.setAttribute("aria-selected", active ? "true" : "false");
      }
      for (const panel of root.querySelectorAll<HTMLElement>("[data-cp-panel]")) {
        const active = panel.dataset["cpPanel"] === tab;
        panel.toggleAttribute("hidden", !active);
        panel.classList.toggle("active", active);
      }
    });
  }
}

/** Browser bootstrap: fetch the proxy and render into #control-plane-root. */
export async function mountControlPlane(root: HTMLElement): Promise<void> {
  root.innerHTML = `<p class="cp-empty cp-loading">loading control plane…</p>`;
  try {
    const res = await fetch("/api/control-plane");
    if (!res.ok) throw new Error(`control-plane proxy returned ${res.status}`);
    const data = (await res.json()) as ControlPlanePayload;
    root.innerHTML = renderControlPlaneHtml(data);
    bindControlPlaneTabs(root);
  } catch (err) {
    root.innerHTML = `<div class="cp-root"><article class="cp-card cp-card-critical">
      <h2>Control plane unavailable</h2>
      <p>${esc(String(err))}</p>
      <p class="cp-note">Is substrate-http running (SUBSTRATE_BASE_URL) with PM_DATABASE_URL set?</p>
    </article></div>`;
  }
}
