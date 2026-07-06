/**
 * Control-plane page (ROADMAP D4, rendering half). Renders the five-question
 * payload from GET /api/control-plane (dashboard server proxy of
 * substrate-http's /tenants/:tenantId/control-plane). Pure renderer —
 * deterministic HTML from data — so it is unit-testable without a browser.
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

const items = (
  rows: readonly { title: string; summary?: string }[],
  empty: string,
): string =>
  rows.length === 0
    ? `<li class="cp-empty">${esc(empty)}</li>`
    : rows
        .map(
          (r) =>
            `<li><strong>${esc(r.title)}</strong>${
              r.summary ? `<div class="cp-summary">${esc(r.summary)}</div>` : ""
            }</li>`,
        )
        .join("");

/** Deterministic HTML for the five questions + integrity. */
export function renderControlPlaneHtml(d: ControlPlanePayload): string {
  return `
<section class="cp-grid">
  <article class="cp-card" data-q="being-done">
    <h2>1 · What is being done</h2>
    ${
      d.beingDone.lastHandoff
        ? `<p class="cp-handoff"><em>Last handoff:</em> ${esc(d.beingDone.lastHandoff.title)}<div class="cp-summary">${esc(d.beingDone.lastHandoff.summary)}</div></p>`
        : ""
    }
    <ul>${items(d.beingDone.openWork, "no open work")}</ul>
  </article>
  <article class="cp-card" data-q="governance">
    <h2>2 · What governance did</h2>
    <ul class="cp-tallies">
      <li>stage-gate applications: <strong>${d.governance.stageGateApplications}</strong></li>
      <li>procedure admissions: <strong>${d.governance.procedureAdmissions}</strong></li>
      <li>MCP actions blocked: <strong>${d.governance.mcpActionsBlocked}</strong></li>
      <li>work dispatched: <strong>${d.governance.workDispatched}</strong></li>
    </ul>
    <ul class="cp-events">${d.governance.eventsByType
      .map((e) => `<li>${esc(e.type)}: <strong>${e.count}</strong></li>`)
      .join("")}</ul>
  </article>
  <article class="cp-card" data-q="costs">
    <h2>3 · What it cost</h2>
    <p><strong>${d.costs.totalTokens.toLocaleString()}</strong> tokens across
    <strong>${d.costs.labeledSessions}</strong> labeled sessions</p>
  </article>
  <article class="cp-card" data-q="integration">
    <h2>Attached apps (integration kit)</h2>
    <ul class="cp-tallies">
      <li>adapters registered: <strong>${d.integration.adaptersRegistered}</strong></li>
      <li>sync upserted: <strong>${d.integration.syncUpserted}</strong> · rejected: <strong>${d.integration.syncRejected}</strong></li>
      <li>executor dispatched: <strong>${d.integration.executorDispatched}</strong> · refused: <strong>${d.integration.executorRefused}</strong> · failed: <strong>${d.integration.executorFailed}</strong></li>
    </ul>
  </article>
  <article class="cp-card" data-q="results">
    <h2>4 · Results (decisions &amp; claims)</h2>
    <ul>${items(d.results.decisions, "no decisions")}</ul>
    <h3>Claims under test</h3>
    <ul>${items(d.results.claimsUnderTest, "none")}</ul>
  </article>
  <article class="cp-card" data-q="optimized">
    <h2>5 · What got optimized</h2>
    <ul>${items(d.optimized.closedWork, "nothing closed yet")}</ul>
    <h3>Lessons</h3>
    <ul>${items(d.optimized.lessons, "none")}</ul>
  </article>
  <article class="cp-card" data-q="integrity">
    <h2>Integrity</h2>
    <p>${d.integrity.checkpointCount} checkpoints · hash chain:
    <strong class="${d.integrity.chainValid ? "cp-ok" : "cp-bad"}">${
      d.integrity.chainValid ? "VALID" : "BROKEN"
    }</strong></p>
    ${
      d.integrity.chainErrors.length > 0
        ? `<ul>${d.integrity.chainErrors.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>`
        : ""
    }
    <p class="cp-meta">tenant ${esc(d.tenantId)} · scope ${esc(d.scope)} · ${esc(d.generatedAt)}</p>
  </article>
</section>`;
}

/** Browser bootstrap: fetch the proxy and render into #control-plane-root. */
export async function mountControlPlane(root: HTMLElement): Promise<void> {
  root.innerHTML = `<p class="cp-empty">loading control plane…</p>`;
  try {
    const res = await fetch("/api/control-plane");
    if (!res.ok) throw new Error(`control-plane proxy returned ${res.status}`);
    const data = (await res.json()) as ControlPlanePayload;
    root.innerHTML = renderControlPlaneHtml(data);
  } catch (err) {
    root.innerHTML = `<p class="cp-bad">control plane unavailable: ${esc(
      String(err),
    )}. Is substrate-http running (SUBSTRATE_BASE_URL) and PM_DATABASE_URL set?</p>`;
  }
}
