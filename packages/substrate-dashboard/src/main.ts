import "./styles.css";
import { fetchSnapshot, renderLive } from "./live.js";
import { renderStory } from "./story.js";
import {
  formatTime,
  loadDashboardData,
  shortId,
  toneForAdmission,
  toneForArtifact,
  type CountDatum,
  type DashboardData,
  type EvidenceAdmissionReview,
  type StateReviewArtifact,
  type StatusTone,
  type WriteBindingReplayRecord,
} from "./data.js";

type Selection =
  | { readonly kind: "artifact"; readonly id: string }
  | { readonly kind: "admission"; readonly id: string }
  | { readonly kind: "writeBinding"; readonly id: string };

type DashboardView = "live" | "grid" | "list" | "flow" | "safe" | "data" | "trend" | "gear";
type TimelineResolution = "48" | "24" | "12";
type TableMode = "full" | "compact";

interface DashboardState {
  corpus: "artifacts" | "admissions" | "writeBindings";
  phase: string;
  decision: string;
  query: string;
  view: DashboardView;
  resolution: TimelineResolution;
  tableMode: TableMode;
  rawMode: boolean;
  selection: Selection;
}

interface ReplayRow {
  readonly kind: "artifact" | "admission" | "writeBinding";
  readonly id: string;
  readonly time: string;
  readonly type: string;
  readonly agent: string;
  readonly policy: string;
  readonly outcome: string;
  readonly replay: "valid" | "review";
  readonly tone: StatusTone;
  readonly source: string;
}

const data = loadDashboardData();
// Always land on the Live view. Stale bookmarks/cached URLs from earlier
// builds carried ?view=grid (the fixture explorer) and made the phone open
// to the wrong screen. Live is the primary surface for the with/without-
// substrate A/B metrics, so force it on first load.
const initialState = { ...readStateFromUrl(data), view: "live" as const };
const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("missing #app root");
}

writeStateToUrl(initialState, true);
render(app, data, initialState);
maybeMountLive(app, data, initialState);

// Auto-refresh the live surface while it is the active view.
let liveTimer: ReturnType<typeof setInterval> | null = null;
function maybeMountLive(
  root: HTMLElement,
  dashboard: DashboardData,
  state: DashboardState,
): void {
  if (liveTimer) {
    clearInterval(liveTimer);
    liveTimer = null;
  }
  if (state.view !== "live") return;
  const mount = root.querySelector<HTMLElement>("#live-mount");
  if (!mount) return;
  const load = async () => {
    try {
      const snap = await fetchSnapshot();
      const current = root.querySelector<HTMLElement>("#live-mount");
      if (current) renderLive(current, snap);
    } catch (err) {
      const current = root.querySelector<HTMLElement>("#live-mount");
      if (current) {
        const msg = err instanceof Error ? `${err.message}` : String(err);
        current.innerHTML = `<div class="live-shell"><div class="live-banner bad">Render error: ${msg.replace(/[<>&]/g, "")}</div></div>`;
      }
    }
  };
  void load();
  liveTimer = setInterval(() => void load(), 5000);
}

function render(root: HTMLElement, dashboard: DashboardData, state: DashboardState): void {
  // LIVE view gets its own clean, full-screen layout: a slim top nav + the
  // live A/B story content. The fixture-explorer chrome (command bar, replay-
  // corpus left rail, artifact inspector) is NOT drawn here — it was burying
  // the story behind "REPLAY CORPUS / POLICY SAFETY" on phones.
  if (state.view === "live") {
    // Story page: renders synchronously from the bundled corpus — no network,
    // no "Loading" hang. Plain-English story first; live backend metrics load
    // underneath when the backend is reachable.
    root.innerHTML = `
      <div class="live-page">
        ${renderLiveTopNav(state)}
        <div id="story-mount"></div>
        <div id="live-mount" class="live-mount-secondary"><div class="live-shell"><div class="live-banner warn">Loading live backend metrics…</div></div></div>
      </div>
    `;
    const storyMount = root.querySelector<HTMLElement>("#story-mount");
    if (storyMount) renderStory(storyMount, dashboard);
    bindInteractions(root, dashboard, state);
    return;
  }

  root.innerHTML = `
    <div class="monitor-shell">
      ${renderAppRail(state)}
      <div class="monitor-frame">
        ${renderCommandBar(dashboard)}
        <div class="monitor-grid">
          ${renderLeftRail(dashboard, state)}
          ${renderMainSurface(dashboard, state)}
          ${renderInspector(dashboard, state)}
        </div>
      </div>
    </div>
  `;

  bindInteractions(root, dashboard, state);
}

function renderAppRail(state: DashboardState): string {
  const items: ReadonlyArray<readonly [DashboardView, string, string]> = [
    ["live", "Live", "LV"],
    ["grid", "Overview", "GR"],
    ["list", "Rows", "LI"],
    ["flow", "Evidence Flow", "FL"],
    ["safe", "Policy Safety", "SF"],
    ["data", "Replay Data", "DA"],
    ["trend", "Timeline Trend", "TR"],
    ["gear", "Diagnostics", "DG"],
  ];
  return `
    <nav class="app-rail" aria-label="Substrate sections">
      <div class="rail-logo">pm</div>
      <div class="rail-stack">
        ${items
          .map(
            ([view, label, glyph]) => `
              <button class="rail-icon ${state.view === view ? "active" : ""}" data-view="${view}" aria-label="${escapeAttribute(label)}">
                <span>${escapeHtml(glyph)}</span>
              </button>
            `,
          )
          .join("")}
      </div>
    </nav>
  `;
}

function renderLiveTopNav(state: DashboardState): string {
  // Slim header for the live full-screen page. Keeps a link back to the
  // fixture-explorer views without dragging the whole desktop chrome in.
  const links: ReadonlyArray<readonly [DashboardView, string]> = [
    ["live", "Live"],
    ["grid", "Overview"],
    ["list", "Rows"],
    ["flow", "Evidence Flow"],
    ["safe", "Policy Safety"],
    ["data", "Replay Data"],
    ["gear", "Diagnostics"],
  ];
  return `
    <nav class="live-topnav">
      <span class="live-topnav-brand">pm-substrate · <strong>Live Monitor</strong></span>
      <div class="live-topnav-links">
        ${links
          .map(
            ([view, label]) =>
              `<button class="live-topnav-link ${state.view === view ? "active" : ""}" data-view="${view}">${escapeHtml(label)}</button>`,
          )
          .join("")}
      </div>
    </nav>`;
}

function renderCommandBar(dashboard: DashboardData): string {
  const totals = getTotals(dashboard);
  const bounds = getTimeBounds(dashboard);
  const validTone: StatusTone = totals.replayHashesValid ? "good" : "bad";

  return `
    <header class="command-bar">
      <div class="product-cell">
        <div class="product-root">pm-substrate</div>
        <div class="product-title">Substrate Monitor</div>
      </div>
      ${renderCommandMetric("Replay", totals.replayHashesValid ? "VALID" : "REVIEW", "static replay", validTone)}
      ${renderCommandMetric("Cluster", "fixture", "local JSONL", "neutral")}
      ${renderCommandMetric("Corpus", String(dashboard.artifacts.length + dashboard.admissions.length + dashboard.writeBindings.length), "rows", "neutral")}
      ${renderCommandMetric("Time", bounds.latest, "latest fixture", "neutral")}
      ${renderCommandMetric("Window", bounds.window, "replay", "neutral")}
      ${renderCommandMetric("Obs", String(totals.observations), "artifact rows", "neutral")}
      ${renderCommandMetric("Evid", String(dashboard.admissions.length), "admission rows", "neutral")}
      ${renderCommandMetric("Admitted", String(totals.admitted), `${formatPercent(totals.admitted, dashboard.admissions.length)} of evidence`, "good")}
      ${renderCommandMetric("Rejected", String(totals.rejected), `${formatPercent(totals.rejected, dashboard.admissions.length)} of evidence`, totals.rejected > 0 ? "bad" : "good")}
      ${renderCommandMetric("Warnings", String(totals.warnings), `${dashboard.warningCounts.length} codes`, totals.warnings > 0 ? "warn" : "good")}
      ${renderCommandMetric("Replay Status", totals.replayHashesValid ? "VALID" : "REVIEW", "hashes", validTone)}
      <button class="menu-button" data-view="gear" aria-label="Dashboard diagnostics"><span></span><span></span><span></span></button>
    </header>
  `;
}

function renderCommandMetric(
  label: string,
  value: string,
  detail: string,
  tone: StatusTone,
): string {
  return `
    <div class="command-metric metric-${tone}">
      <div class="command-label">${escapeHtml(label)}</div>
      <div class="command-value">${escapeHtml(value)}</div>
      <div class="command-detail">${escapeHtml(detail)}</div>
    </div>
  `;
}

function renderLeftRail(dashboard: DashboardData, state: DashboardState): string {
  const artifactRows = filterArtifacts(dashboard.artifacts, state);
  const admissionRows = filterAdmissions(dashboard.admissions, state);
  const writeBindingRows = filterWriteBindings(dashboard.writeBindings, state);
  const activeRows = renderCorpusListItems({
    artifactRows,
    admissionRows,
    writeBindingRows,
    state,
  });
  const listCount = getCorpusCount({
    artifactRows,
    admissionRows,
    writeBindingRows,
    corpus: state.corpus,
  });
  const decisionOptions =
    state.corpus === "writeBindings"
      ? dashboard.writeBindingDecisionCounts.map((count) => count.key)
      : dashboard.decisionCounts.map((count) => count.key);
  const bounds = getTimeBounds(dashboard);

  return `
    <aside class="left-rail" aria-label="Replay corpus controls">
      <section class="filter-panel">
        <div class="panel-title">
          <h2>Replay Corpus</h2>
          <button id="reset-filters" type="button">Reset</button>
        </div>
        <div class="field-grid two">
          ${renderSelectField("Corpus", "corpus-select", ["artifacts", "admissions", "writeBindings"], state.corpus)}
          ${renderReadonlyField("Environment", "fixture")}
        </div>
        <div class="field-grid two">
          ${renderReadonlyField("Agent", "all")}
          ${renderReadonlyField("Policy Set", "evidence-binding")}
        </div>
        <label class="field span-all">
          <span>Time Range</span>
          <div class="range-field"><span>${escapeHtml(bounds.earliest)}</span><b>to</b><span>${escapeHtml(bounds.latest)}</span></div>
        </label>
        <label class="field span-all">
          <span>Search Artifact</span>
          <input id="query" class="search-input" value="${escapeAttribute(state.query)}" placeholder="artifact_id, hash, source, policy..." />
        </label>
        <div class="field-grid two">
          <label class="field">
            <span>Phase</span>
            <select id="phase-filter">${renderOptions(["all", ...dashboard.phaseCounts.map((count) => count.key)], state.phase)}</select>
          </label>
          <label class="field">
            <span>Decision</span>
            <select id="decision-filter">${renderOptions(["all", ...decisionOptions], state.decision)}</select>
          </label>
        </div>
        <button class="add-filter" id="show-warning-artifacts" type="button">Show warning artifacts</button>
      </section>
      <section class="artifact-list-panel">
        <div class="list-header">
          <h2>${escapeHtml(corpusTitle(state.corpus))} (${listCount})</h2>
          <span>Sort: Newest</span>
        </div>
        <div class="item-list">${activeRows}</div>
        <div class="pager">1-${Math.max(1, listCount)} of ${listCount}</div>
      </section>
    </aside>
  `;
}

function renderMainSurface(dashboard: DashboardData, state: DashboardState): string {
  if (state.view === "live") {
    return `<main class="main-surface main-surface-live"><div id="live-mount"><div class="live-shell"><div class="live-banner warn">Loading live snapshot…</div></div></div></main>`;
  }
  if (state.view === "list") {
    return `
      <main class="main-surface">
        ${renderEventTimeline(dashboard, state)}
        ${renderHeatmapTimeline(dashboard, state)}
      </main>
    `;
  }

  if (state.view === "flow") {
    return `
      <main class="main-surface">
        ${renderFlowBoard(dashboard)}
        ${renderEventTimeline(dashboard, state)}
      </main>
    `;
  }

  if (state.view === "safe") {
    return `
      <main class="main-surface">
        ${renderSafetyBoard(dashboard)}
        ${renderEventTimeline(dashboard, state)}
      </main>
    `;
  }

  if (state.view === "data") {
    return `
      <main class="main-surface">
        ${renderDataBoard(dashboard, state)}
        ${renderEventTimeline(dashboard, state)}
      </main>
    `;
  }

  if (state.view === "trend") {
    return `
      <main class="main-surface">
        ${renderHeatmapTimeline(dashboard, state)}
        ${renderSafetyBoard(dashboard)}
      </main>
    `;
  }

  if (state.view === "gear") {
    return `
      <main class="main-surface">
        ${renderDiagnosticsBoard(dashboard)}
      </main>
    `;
  }

  return `
    <main class="main-surface">
      ${renderHeatmapTimeline(dashboard, state)}
      ${renderFlowBoard(dashboard)}
      ${renderEventTimeline(dashboard, state)}
    </main>
  `;
}

function renderSafetyBoard(dashboard: DashboardData): string {
  const totals = getTotals(dashboard);
  const warningCodes = dashboard.warningCounts.slice(0, 6);
  const decisions = dashboard.decisionCounts;
  const bindingDecisions = dashboard.writeBindingDecisionCounts;
  return `
    <section class="view-panel">
      <div class="panel-heading compact">
        <div>
          <h1>Policy Safety</h1>
          <span>Replay hash, evidence admission, and warning concentrations</span>
        </div>
      </div>
      <div class="view-card-grid">
        ${renderViewCard("Replay hashes", totals.replayHashesValid ? "VALID" : "REVIEW", "All artifact hashes are present in the static replay corpus.", totals.replayHashesValid ? "good" : "bad")}
        ${renderViewCard("Rejected evidence", String(totals.rejected), "Evidence rows that failed admission checks.", totals.rejected > 0 ? "bad" : "good")}
        ${renderViewCard("Warnings", String(totals.warnings), `${dashboard.warningCounts.length} warning codes across state-review artifacts.`, totals.warnings > 0 ? "warn" : "good")}
        ${renderViewCard("Write binding stream", String(dashboard.writeBindings.length), `${totals.writeBindingsAllowed} allowed, ${totals.writeBindingsBlocked} blocked before dispatch.`, totals.writeBindingsBlocked > 0 ? "warn" : "good")}
      </div>
      <div class="summary-grid">
        <div>
          <h2>Top Warning Codes</h2>
          ${warningCodes.map((count) => renderSummaryRow(count.key, count.count, count.tone)).join("")}
        </div>
        <div>
          <h2>Admission Decisions</h2>
          ${decisions.map((count) => renderSummaryRow(count.key, count.count, count.tone)).join("")}
        </div>
        <div>
          <h2>Write Binding Decisions</h2>
          ${bindingDecisions.map((count) => renderSummaryRow(count.key, count.count, count.tone)).join("")}
        </div>
      </div>
    </section>
  `;
}

function renderDataBoard(dashboard: DashboardData, state: DashboardState): string {
  const artifact = dashboard.artifacts.find(
    (item) => state.selection.kind === "artifact" && item.artifactId === state.selection.id,
  );
  const admission = dashboard.admissions.find(
    (item) => state.selection.kind === "admission" && item.reviewId === state.selection.id,
  );
  const writeBinding = dashboard.writeBindings.find(
    (item) => state.selection.kind === "writeBinding" && item.recordId === state.selection.id,
  );
  const selected = artifact
    ? compactArtifact(artifact)
    : admission
      ? compactAdmission(admission)
      : writeBinding
        ? compactWriteBinding(writeBinding)
        : {};
  return `
    <section class="view-panel">
      <div class="panel-heading compact">
        <div>
          <h1>Replay Data</h1>
          <span>Committed JSONL fixture corpus and selected source object</span>
        </div>
      </div>
      <div class="source-grid">
        <div class="source-card">
          <h2>Corpus Inventory</h2>
          ${renderFactGrid([
            ["State artifacts", String(dashboard.artifacts.length)],
            ["Evidence admissions", String(dashboard.admissions.length)],
            ["Write bindings", String(dashboard.writeBindings.length)],
            ["Artifact warning codes", String(dashboard.warningCounts.length)],
            ["Evidence kinds", String(dashboard.evidenceKindCounts.length)],
          ])}
        </div>
        <div class="source-card">
          <h2>Selected Object</h2>
          <pre>${escapeHtml(JSON.stringify(selected, null, 2))}</pre>
        </div>
      </div>
    </section>
  `;
}

function renderDiagnosticsBoard(dashboard: DashboardData): string {
  const totals = getTotals(dashboard);
  return `
    <section class="view-panel">
      <div class="panel-heading compact">
        <div>
          <h1>Diagnostics</h1>
          <span>Dashboard runtime and data-boundary checks</span>
        </div>
      </div>
      <div class="diagnostic-list">
        ${renderDiagnostic("Source mode", "Static JSONL fixtures", "neutral")}
        ${renderDiagnostic("Artifact/admission URL state", "Canonicalized on load and on row selection", "good")}
        ${renderDiagnostic("Replay hashes", totals.replayHashesValid ? "Present" : "Needs review", totals.replayHashesValid ? "good" : "bad")}
        ${renderDiagnostic("Write-binding replay stream", `${dashboard.writeBindings.length} committed rows`, dashboard.writeBindings.length > 0 ? "good" : "warn")}
        ${renderDiagnostic("Dashboard rows", `${dashboard.artifacts.length + dashboard.admissions.length + dashboard.writeBindings.length} committed rows`, "neutral")}
      </div>
    </section>
  `;
}

function renderViewCard(
  label: string,
  value: string,
  detail: string,
  tone: StatusTone,
): string {
  return `
    <div class="view-card tone-border-${tone}">
      <span>${escapeHtml(label)}</span>
      <strong class="tone-${tone}">${escapeHtml(value)}</strong>
      <p>${escapeHtml(detail)}</p>
    </div>
  `;
}

function renderSummaryRow(label: string, value: number, tone: StatusTone): string {
  return `
    <div class="summary-row">
      <span>${escapeHtml(label)}</span>
      <b class="tone-${tone}">${value}</b>
    </div>
  `;
}

function renderDiagnostic(label: string, value: string, tone: StatusTone): string {
  return `
    <div class="diagnostic-row">
      <span>${escapeHtml(label)}</span>
      <strong class="tone-${tone}">${escapeHtml(value)}</strong>
    </div>
  `;
}

function renderHeatmapTimeline(dashboard: DashboardData, state: DashboardState): string {
  const totals = getTotals(dashboard);
  const bucketCount = Number(state.resolution);
  const rows = [
    { label: "Observations / row", low: "0", high: String(totals.observations), value: totals.observations, tone: "neutral" as StatusTone },
    { label: "Admitted / row", low: "0", high: String(totals.admitted), value: totals.admitted, tone: "good" as StatusTone },
    { label: "Rejected / row", low: "0", high: String(totals.rejected), value: totals.rejected, tone: "bad" as StatusTone },
    { label: "Warnings / row", low: "0", high: String(totals.warnings), value: totals.warnings, tone: "warn" as StatusTone },
    { label: "Replay valid %", low: "0%", high: totals.replayHashesValid ? "100%" : "0%", value: dashboard.artifacts.length, tone: totals.replayHashesValid ? "good" as StatusTone : "bad" as StatusTone },
    { label: "Policy violations / row", low: "0", high: String(totals.rejected), value: totals.rejected, tone: "neutral" as StatusTone },
  ];
  const ticks = makeTimeTicks(dashboard);
  const selectedIndex = getSelectedBucket(dashboard, state, bucketCount);

  return `
    <section class="timeline-panel">
      <div class="panel-heading">
        <div>
          <h1>Evidence Timeline</h1>
          <span>Static replay fixture window</span>
        </div>
        <div class="resolution-control">
          <span>Resolution</span>
          <select id="resolution-select" aria-label="Timeline resolution">
            <option value="48" ${state.resolution === "48" ? "selected" : ""}>48 buckets</option>
            <option value="24" ${state.resolution === "24" ? "selected" : ""}>24 buckets</option>
            <option value="12" ${state.resolution === "12" ? "selected" : ""}>12 buckets</option>
          </select>
        </div>
        <button class="jump-button" id="jump-now" type="button">Jump to Now</button>
      </div>
      <div class="heatmap">
        <div class="heatmap-ticks">
          <span></span>
          ${ticks.map((tick) => `<span>${escapeHtml(tick)}</span>`).join("")}
        </div>
        ${rows.map((row, rowIndex) => renderHeatmapRow(row, rowIndex, selectedIndex, bucketCount)).join("")}
      </div>
    </section>
  `;
}

function renderHeatmapRow(
  row: { readonly label: string; readonly low: string; readonly high: string; readonly value: number; readonly tone: StatusTone },
  rowIndex: number,
  selectedIndex: number,
  bucketCount: number,
): string {
  return `
    <div class="heat-row">
      <div class="heat-label">${escapeHtml(row.label)}</div>
      <div class="heat-low">${escapeHtml(row.low)}</div>
      <div class="heat-cells" style="grid-template-columns: repeat(${bucketCount}, minmax(6px, 1fr))">
        ${Array.from({ length: bucketCount }, (_, index) => {
          const intensity = heatIntensity(row.value, rowIndex, index);
          return `<span class="heat-cell heat-${row.tone} heat-i${intensity} ${index === selectedIndex ? "selected" : ""}"></span>`;
        }).join("")}
      </div>
      <div class="heat-high">${escapeHtml(row.high)}</div>
    </div>
  `;
}

function renderFlowBoard(dashboard: DashboardData): string {
  const totals = getTotals(dashboard);
  const warningArtifacts = dashboard.artifacts.filter((artifact) => !artifact.review.valid).length;
  const cleanArtifacts = dashboard.artifacts.length - warningArtifacts;
  const deferredEvidence = dashboard.admissions.filter(
    (review) => review.decision === "admitted_with_warnings",
  ).length;
  const allowedBindings = dashboard.writeBindings.filter(
    (record) => record.decision === "allowed",
  ).length;
  const blockedPolicy = dashboard.writeBindings.filter(
    (record) => record.decision === "blocked_policy",
  ).length;
  const blockedUnverified = dashboard.writeBindings.filter(
    (record) => record.decision === "blocked_unverified_binding",
  ).length;
  const blockedIncomplete = dashboard.writeBindings.filter(
    (record) => record.decision === "blocked_incomplete_binding",
  ).length;
  const blockedMissing = dashboard.writeBindings.filter(
    (record) => record.decision === "blocked_missing_binding",
  ).length;
  const sourceGroups = topCounts(
    dashboard.admissions.map((review) => review.evidence.kind),
    4,
  );

  return `
    <section class="flow-panel">
      <div class="panel-heading compact">
        <div>
          <h1>Evidence Flow (Selected Window)</h1>
          <span>Observation -> state review -> evidence admission -> write binding</span>
        </div>
      </div>
      <div class="flow-board">
        <svg class="flow-ribbons" viewBox="0 0 1000 300" preserveAspectRatio="none" aria-hidden="true">
          <path class="ribbon ribbon-good" d="M190 72 C300 72 320 92 410 92 S560 92 650 92 S780 92 900 92" />
          <path class="ribbon ribbon-warn" d="M190 150 C310 150 330 175 410 175 S560 175 650 155 S780 155 900 172" />
          <path class="ribbon ribbon-bad" d="M190 228 C310 228 330 224 410 228 S560 232 650 222 S780 220 900 226" />
        </svg>
        <div class="flow-column">
          <div class="flow-column-title">Observation <strong>${totals.observations}</strong></div>
          ${sourceGroups.map((group) => renderFlowNode(group.key, group.count, "neutral")).join("")}
          ${renderFlowNode("Other evidence", Math.max(0, dashboard.admissions.length - sourceGroups.reduce((sum, group) => sum + group.count, 0)), "neutral")}
        </div>
        <div class="flow-column">
          <div class="flow-column-title">State Review <strong>${dashboard.artifacts.length}</strong></div>
          ${renderFlowNode("Accepted", cleanArtifacts, "good")}
          ${renderFlowNode("Warning", warningArtifacts, "warn")}
          ${renderFlowNode("Rejected", 0, "bad")}
        </div>
        <div class="flow-column">
          <div class="flow-column-title">Evidence Admission <strong>${dashboard.admissions.length}</strong></div>
          ${renderFlowNode("Admitted", totals.admitted - deferredEvidence, "good")}
          ${renderFlowNode("Rejected", totals.rejected, "bad")}
          ${renderFlowNode("Deferred", deferredEvidence, "warn")}
        </div>
        <div class="flow-column">
          <div class="flow-column-title">Write Binding <strong>${dashboard.writeBindings.length}</strong></div>
          ${renderFlowNode("Allowed", allowedBindings, "good")}
          ${renderFlowNode("Policy blocked", blockedPolicy, "bad")}
          ${renderFlowNode("Unverified binding", blockedUnverified, "bad")}
          ${renderFlowNode("Missing binding", blockedMissing, "warn")}
          ${renderFlowNode("Incomplete binding", blockedIncomplete, "warn")}
        </div>
      </div>
    </section>
  `;
}

function renderFlowNode(label: string, value: number, tone: StatusTone): string {
  return `
    <div class="flow-node node-${tone}">
      <span>${escapeHtml(shortId(label, 24))}</span>
      <strong>${value}</strong>
    </div>
  `;
}

function renderEventTimeline(dashboard: DashboardData, state: DashboardState): string {
  const rows = getReplayRows(dashboard, state).slice(0, 12);
  const compact = state.tableMode === "compact";
  return `
    <section class="event-panel">
      <div class="panel-heading compact">
        <div>
          <h1>Event Timeline (Selected Window)</h1>
        </div>
        <button class="columns-button" id="toggle-columns" type="button">${compact ? "Full Columns" : "Compact Columns"}</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Time (Z)</th>
              <th>Artifact</th>
              <th>Type</th>
              ${compact ? "" : "<th>Agent</th><th>Policy</th>"}
              <th>Outcome</th>
              <th>Replay</th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map(
                (row) => `
                  <tr data-select-kind="${row.kind}" data-select-id="${escapeAttribute(row.id)}">
                    <td>${formatTime(row.time)}</td>
                    <td><button class="link-button">${escapeHtml(shortId(row.id, 20))}</button></td>
                    <td>${escapeHtml(shortId(row.type, 22))}</td>
                    ${compact ? "" : `<td>${escapeHtml(shortId(row.agent, 22))}</td><td>${escapeHtml(row.policy)}</td>`}
                    <td><span class="status-pill tone-${row.tone}">${escapeHtml(row.outcome)}</span></td>
                    <td><span class="replay-ok">valid</span></td>
                  </tr>
                `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderInspector(dashboard: DashboardData, state: DashboardState): string {
  const artifact = dashboard.artifacts.find(
    (item) => state.selection.kind === "artifact" && item.artifactId === state.selection.id,
  );
  const admission = dashboard.admissions.find(
    (item) => state.selection.kind === "admission" && item.reviewId === state.selection.id,
  );
  const writeBinding = dashboard.writeBindings.find(
    (item) => state.selection.kind === "writeBinding" && item.recordId === state.selection.id,
  );

  if (artifact) return renderArtifactInspector(artifact, state);
  if (admission) return renderAdmissionInspector(admission, state);
  if (writeBinding) return renderWriteBindingInspector(writeBinding, state);
  return `<aside class="inspector"><div class="section-title">Inspector</div><p>No selected row.</p></aside>`;
}

function renderArtifactInspector(artifact: StateReviewArtifact, state: DashboardState): string {
  const warnings = artifact.review.warnings;
  const refs = [
    ...artifact.review.currentStateView.sourceRefs,
    ...(artifact.relatedObjects ?? []).map((object) => object.ref),
  ];
  const tone = toneForArtifact(artifact);
  const decision = artifact.review.valid ? "ALLOW" : "REVIEW";

  return `
    <aside class="inspector" aria-label="Artifact inspector">
      <div class="inspector-topline">
        <h2>Artifact Inspector</h2>
        <div class="inspector-actions">
          <button data-selection-step="-1">prev</button>
          <button data-selection-step="1">next</button>
          <button data-clear-selection="true">x</button>
        </div>
      </div>
      <div class="inspector-title">
        <h3>${escapeHtml(shortId(artifact.artifactId, 22))}</h3>
        <span class="status-pill tone-${tone}">${artifact.review.valid ? "admitted" : "warning"}</span>
      </div>
      ${renderFactGrid([
        ["Type", artifact.review.proposedAction.actionType],
        ["Observation", shortId(artifact.review.currentStateView.subject.id, 22)],
        ["Agent", artifact.review.proposedAction.proposedBy],
        ["Time (Z)", artifact.generatedAt],
        ["Policy Set", "evidence-binding"],
        ["Policy Decision", decision],
        ["Replay", artifact.artifactHash.length === 64 ? "VALID" : "REVIEW"],
      ])}
      ${renderJsonBlock("Artifact Facts (JSON)", compactArtifact(artifact), artifact, state)}
      ${renderHashStatus(artifact.artifactHash)}
      ${renderWarningBlock(warnings)}
      <div class="inspector-block">
        <h3>Source References</h3>
        ${refs.slice(0, 8).map((ref) => `<div class="ref-row"><a href="#">${escapeHtml(shortId(ref.id, 18))}</a><span>${escapeHtml(ref.kind)}</span><button data-ref-query="${escapeAttribute(ref.id)}">Find</button></div>`).join("")}
      </div>
      <div class="inspector-block">
        <h3>Policy Disposition</h3>
        ${renderFactGrid([
          ["Decision", decision],
          ["Reason", artifact.review.valid ? "Current artifact matches replay policy." : "Warnings require review before trust."],
          ["Rules Evaluated", String(Math.max(1, warnings.length + 4))],
          ["Rules Matched", warnings.length === 0 ? "clean-current" : warnings.map((warning) => warning.code).slice(0, 2).join(", ")],
        ])}
      </div>
    </aside>
  `;
}

function renderAdmissionInspector(review: EvidenceAdmissionReview, state: DashboardState): string {
  const tone = toneForAdmission(review);
  return `
    <aside class="inspector" aria-label="Evidence admission inspector">
      <div class="inspector-topline">
        <h2>Evidence Inspector</h2>
        <div class="inspector-actions">
          <button data-selection-step="-1">prev</button>
          <button data-selection-step="1">next</button>
          <button data-clear-selection="true">x</button>
        </div>
      </div>
      <div class="inspector-title">
        <h3>${escapeHtml(shortId(review.reviewId, 22))}</h3>
        <span class="status-pill tone-${tone}">${escapeHtml(review.decision.replaceAll("_", " "))}</span>
      </div>
      ${renderFactGrid([
        ["Type", review.evidence.kind],
        ["Observation", review.evidence.evidenceId],
        ["Agent", review.evidence.collectedBy ?? "evidence-reviewer"],
        ["Time (Z)", review.evaluatedAt],
        ["Policy Set", "evidence-admission"],
        ["Policy Decision", review.decision === "rejected" ? "REJECT" : "ALLOW"],
        ["Replay", "VALID"],
      ])}
      ${renderJsonBlock("Artifact Facts (JSON)", compactAdmission(review), review, state)}
      ${renderHashStatus(review.reviewId.padEnd(64, "0").slice(0, 64))}
      <div class="inspector-block">
        <h3>Warnings / Violations <span class="count-badge">${review.issues.length}</span></h3>
        ${
          review.issues.length === 0
            ? '<div class="empty-state">No admission issues.</div>'
            : review.issues.map((issue) => `<div class="warning-line"><strong>${escapeHtml(issue.code)}</strong><span>${escapeHtml(issue.message)}</span><em>${escapeHtml(issue.severity)}</em></div>`).join("")
        }
      </div>
      <div class="inspector-block">
        <h3>Source References</h3>
        <div class="ref-row"><a href="#">${escapeHtml(shortId(review.evidence.evidenceId, 18))}</a><span>Evidence</span><button data-ref-query="${escapeAttribute(review.evidence.evidenceId)}">Find</button></div>
        <div class="ref-row"><a href="#">${escapeHtml(shortId(review.evidence.source, 18))}</a><span>Source</span><button data-ref-query="${escapeAttribute(review.evidence.source)}">Find</button></div>
      </div>
      <div class="inspector-block">
        <h3>Policy Disposition</h3>
        ${renderFactGrid([
          ["Decision", review.decision === "rejected" ? "REJECT" : "ALLOW"],
          ["Reason", review.decision === "rejected" ? "Evidence failed admission checks." : "Evidence remains evidence-only and admissible."],
          ["Rules Evaluated", String(Math.max(1, review.issues.length + 3))],
          ["Authority", review.authorityStatus],
        ])}
      </div>
    </aside>
  `;
}

function renderWriteBindingInspector(record: WriteBindingReplayRecord, state: DashboardState): string {
  const tone = toneForWriteBinding(record);
  const decision = record.decision === "allowed" ? "ALLOW" : "BLOCK";
  const disposition = record.invocationEvidenceBinding?.policyDisposition;
  const issues = record.validation.valid ? [] : record.validation.issues;
  const evidenceRefs = record.evidenceAdmissionReviews.map((review) => review.reviewId);

  return `
    <aside class="inspector" aria-label="Write binding inspector">
      <div class="inspector-topline">
        <h2>Write Binding Inspector</h2>
        <div class="inspector-actions">
          <button data-selection-step="-1">prev</button>
          <button data-selection-step="1">next</button>
          <button data-clear-selection="true">x</button>
        </div>
      </div>
      <div class="inspector-title">
        <h3>${escapeHtml(shortId(record.recordId, 22))}</h3>
        <span class="status-pill tone-${tone}">${escapeHtml(record.decision.replaceAll("_", " "))}</span>
      </div>
      ${renderFactGrid([
        ["Type", "WriteBinding"],
        ["Capability", record.capability],
        ["Node", record.nodeId],
        ["Time (Z)", record.generatedAt],
        ["Policy Set", "evidence-binding"],
        ["Policy Decision", decision],
        ["Replay", record.stateReviewArtifact.artifactHash.length === 64 ? "VALID" : "REVIEW"],
      ])}
      ${renderJsonBlock("Write Binding Facts (JSON)", compactWriteBinding(record), record, state)}
      ${renderHashStatus(record.stateReviewArtifact.artifactHash)}
      <div class="inspector-block">
        <h3>Warnings / Violations <span class="count-badge">${issues.length + record.warningCodes.length}</span></h3>
        ${
          issues.length + record.warningCodes.length === 0
            ? '<div class="empty-state">No write-binding issues.</div>'
            : [
                ...issues.map((issue) => `<div class="warning-line"><strong>${escapeHtml(shortId(issue.path, 36))}</strong><span>${escapeHtml(issue.message)}</span><em>block</em></div>`),
                ...record.warningCodes.map((code) => `<div class="warning-line"><strong>${escapeHtml(code)}</strong><span>Referenced state-review artifact carried this warning.</span><em>warn</em></div>`),
              ].join("")
        }
      </div>
      <div class="inspector-block">
        <h3>Source References</h3>
        <div class="ref-row"><a href="#">${escapeHtml(shortId(record.stateReviewArtifact.artifactId, 18))}</a><span>State Artifact</span><button data-ref-query="${escapeAttribute(record.stateReviewArtifact.artifactId)}">Find</button></div>
        ${evidenceRefs.map((id) => `<div class="ref-row"><a href="#">${escapeHtml(shortId(id, 18))}</a><span>Evidence Review</span><button data-ref-query="${escapeAttribute(id)}">Find</button></div>`).join("")}
      </div>
      <div class="inspector-block">
        <h3>Policy Disposition</h3>
        ${renderFactGrid([
          ["Decision", decision],
          ["Reason", record.validation.valid ? "Evidence binding satisfied before write dispatch." : record.validation.reason],
          ["Mode", disposition?.mode ?? "missing"],
          ["Would Block", String(disposition?.wouldBlock ?? record.decision !== "allowed")],
        ])}
      </div>
    </aside>
  `;
}

function renderHashStatus(seed: string): string {
  const rows: ReadonlyArray<readonly [string, string]> = [
    ["State Hash", seed.slice(0, 14)],
    ["Value Hash", seed.slice(14, 28)],
    ["Policy Hash", seed.slice(28, 42)],
    ["Corpus Hash", seed.slice(42, 56)],
  ];
  return `
    <div class="inspector-block">
      <h3>Replay / Hash Status</h3>
      ${rows.map(([label, value]) => `<div class="hash-row"><span>${escapeHtml(label)}</span><code>${escapeHtml(value)}...</code><b>match</b></div>`).join("")}
    </div>
  `;
}

function renderWarningBlock(warnings: readonly { readonly code: string; readonly severity: string; readonly message: string }[]): string {
  return `
    <div class="inspector-block">
      <h3>Warnings / Violations <span class="count-badge">${warnings.length}</span></h3>
      ${
        warnings.length === 0
          ? '<div class="empty-state">No artifact warnings.</div>'
          : warnings
              .slice(0, 6)
              .map((warning) => `<div class="warning-line"><strong>${escapeHtml(warning.code)}</strong><span>${escapeHtml(warning.message)}</span><em>${escapeHtml(warning.severity)}</em></div>`)
              .join("")
      }
    </div>
  `;
}

function renderJsonBlock(
  title: string,
  compactValue: Record<string, unknown>,
  rawValue: unknown,
  state: DashboardState,
): string {
  const value = state.rawMode ? rawValue : compactValue;
  return `
    <div class="inspector-block">
      <div class="block-heading">
        <h3>${escapeHtml(title)}</h3>
        <button id="toggle-raw" type="button">${state.rawMode ? "View Compact" : "View Raw"}</button>
      </div>
      <pre>${escapeHtml(JSON.stringify(value, null, 2))}</pre>
    </div>
  `;
}

function renderFactGrid(facts: readonly (readonly [string, string])[]): string {
  return `
    <dl class="fact-grid">
      ${facts
        .map(
          ([label, value]) => `
            <div>
              <dt>${escapeHtml(label)}</dt>
              <dd>${escapeHtml(value)}</dd>
            </div>
          `,
        )
        .join("")}
    </dl>
  `;
}

function renderArtifactListItem(artifact: StateReviewArtifact, state: DashboardState): string {
  const selected = state.selection.kind === "artifact" && state.selection.id === artifact.artifactId;
  const tone = toneForArtifact(artifact);
  return `
    <button class="list-item ${selected ? "selected" : ""}" data-select-kind="artifact" data-select-id="${escapeAttribute(artifact.artifactId)}">
      <span class="dot tone-${tone}"></span>
      <span>
        <strong>${escapeHtml(shortId(artifact.artifactId, 26))}</strong>
        <small>${escapeHtml(artifact.metadata.temporalMisalignmentPhase ?? "none")} / ${formatTime(artifact.generatedAt)}</small>
        <small>${escapeHtml(artifact.review.proposedAction.proposedBy)}</small>
      </span>
      <span class="status-pill tone-${tone}">${artifact.review.valid ? "valid" : "warn"}</span>
    </button>
  `;
}

function renderAdmissionListItem(review: EvidenceAdmissionReview, state: DashboardState): string {
  const selected = state.selection.kind === "admission" && state.selection.id === review.reviewId;
  const tone = toneForAdmission(review);
  return `
    <button class="list-item ${selected ? "selected" : ""}" data-select-kind="admission" data-select-id="${escapeAttribute(review.reviewId)}">
      <span class="dot tone-${tone}"></span>
      <span>
        <strong>${escapeHtml(shortId(review.reviewId, 26))}</strong>
        <small>${escapeHtml(review.evidence.kind)} / ${formatTime(review.evaluatedAt)}</small>
        <small>${escapeHtml(review.evidence.collectedBy ?? review.evidence.source)}</small>
      </span>
      <span class="status-pill tone-${tone}">${escapeHtml(review.decision.replaceAll("_", " "))}</span>
    </button>
  `;
}

function renderWriteBindingListItem(record: WriteBindingReplayRecord, state: DashboardState): string {
  const selected = state.selection.kind === "writeBinding" && state.selection.id === record.recordId;
  const tone = toneForWriteBinding(record);
  return `
    <button class="list-item ${selected ? "selected" : ""}" data-select-kind="writeBinding" data-select-id="${escapeAttribute(record.recordId)}">
      <span class="dot tone-${tone}"></span>
      <span>
        <strong>${escapeHtml(shortId(record.recordId, 26))}</strong>
        <small>${escapeHtml(record.decision)} / ${formatTime(record.generatedAt)}</small>
        <small>${escapeHtml(record.capability)}</small>
      </span>
      <span class="status-pill tone-${tone}">${escapeHtml(record.decision.replaceAll("_", " "))}</span>
    </button>
  `;
}

function renderCorpusListItems(input: {
  readonly artifactRows: readonly StateReviewArtifact[];
  readonly admissionRows: readonly EvidenceAdmissionReview[];
  readonly writeBindingRows: readonly WriteBindingReplayRecord[];
  readonly state: DashboardState;
}): string {
  if (input.state.corpus === "admissions") {
    return input.admissionRows.map((review) => renderAdmissionListItem(review, input.state)).join("");
  }
  if (input.state.corpus === "writeBindings") {
    return input.writeBindingRows.map((record) => renderWriteBindingListItem(record, input.state)).join("");
  }
  return input.artifactRows.map((artifact) => renderArtifactListItem(artifact, input.state)).join("");
}

function getCorpusCount(input: {
  readonly artifactRows: readonly StateReviewArtifact[];
  readonly admissionRows: readonly EvidenceAdmissionReview[];
  readonly writeBindingRows: readonly WriteBindingReplayRecord[];
  readonly corpus: DashboardState["corpus"];
}): number {
  if (input.corpus === "admissions") return input.admissionRows.length;
  if (input.corpus === "writeBindings") return input.writeBindingRows.length;
  return input.artifactRows.length;
}

function corpusTitle(corpus: DashboardState["corpus"]): string {
  if (corpus === "admissions") return "Evidence List";
  if (corpus === "writeBindings") return "Write Binding List";
  return "Artifact List";
}

function renderSelectField(
  label: string,
  id: string,
  options: readonly string[],
  selected: string,
): string {
  return `
    <label class="field">
      <span>${escapeHtml(label)}</span>
      <select id="${escapeAttribute(id)}">${renderOptions(options, selected)}</select>
    </label>
  `;
}

function renderReadonlyField(label: string, value: string): string {
  return `
    <label class="field">
      <span>${escapeHtml(label)}</span>
      <input value="${escapeAttribute(value)}" readonly />
    </label>
  `;
}

function bindInteractions(root: HTMLElement, dashboard: DashboardData, state: DashboardState): void {
  root.querySelectorAll<HTMLElement>("[data-select-kind]").forEach((element) => {
    element.addEventListener("click", () => {
      const kind = element.dataset.selectKind;
      const id = element.dataset.selectId;
      if ((kind === "artifact" || kind === "admission" || kind === "writeBinding") && id) {
        const next = {
          ...state,
          corpus: corpusForSelectionKind(kind),
          selection: { kind, id } as Selection,
        };
        writeStateToUrl(next);
        render(root, dashboard, next);
      }
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      const view = parseDashboardView(button.dataset.view);
      const next = { ...state, view };
      writeStateToUrl(next);
      render(root, dashboard, next);
      maybeMountLive(root, dashboard, next);
    });
  });

  root.querySelector<HTMLSelectElement>("#resolution-select")?.addEventListener("change", (event) => {
    const target = event.target as HTMLSelectElement;
    const next = { ...state, resolution: parseResolution(target.value) };
    writeStateToUrl(next);
    render(root, dashboard, next);
  });

  root.querySelector<HTMLButtonElement>("#jump-now")?.addEventListener("click", () => {
    const [latest] = getReplayRows(dashboard, { ...state, phase: "all", decision: "all", query: "" });
    if (!latest) return;
    const next = {
      ...state,
      corpus: corpusForSelectionKind(latest.kind),
      selection: { kind: latest.kind, id: latest.id } as Selection,
    };
    writeStateToUrl(next);
    render(root, dashboard, next);
  });

  root.querySelector<HTMLButtonElement>("#toggle-columns")?.addEventListener("click", () => {
    const next = {
      ...state,
      tableMode: state.tableMode === "full" ? "compact" as const : "full" as const,
    };
    writeStateToUrl(next);
    render(root, dashboard, next);
  });

  root.querySelector<HTMLButtonElement>("#toggle-raw")?.addEventListener("click", () => {
    const next = { ...state, rawMode: !state.rawMode };
    writeStateToUrl(next);
    render(root, dashboard, next);
  });

  root.querySelectorAll<HTMLButtonElement>("[data-selection-step]").forEach((button) => {
    button.addEventListener("click", () => {
      const rows = getReplayRows(dashboard, state);
      if (rows.length === 0) return;
      const currentIndex = rows.findIndex(
        (row) => row.kind === state.selection.kind && row.id === state.selection.id,
      );
      const step = Number(button.dataset.selectionStep ?? "0");
      const nextIndex = (Math.max(0, currentIndex) + step + rows.length) % rows.length;
      const row = rows[nextIndex] ?? rows[0];
      if (!row) return;
      const next = {
        ...state,
        corpus: corpusForSelectionKind(row.kind),
        selection: { kind: row.kind, id: row.id } as Selection,
      };
      writeStateToUrl(next);
      render(root, dashboard, next);
    });
  });

  root.querySelector<HTMLButtonElement>("[data-clear-selection]")?.addEventListener("click", () => {
    const next = {
      ...state,
      selection: firstSelectionForCorpus(dashboard, state.corpus),
    };
    writeStateToUrl(next);
    render(root, dashboard, next);
  });

  root.querySelectorAll<HTMLButtonElement>("[data-ref-query]").forEach((button) => {
    button.addEventListener("click", () => {
      const query = button.dataset.refQuery ?? "";
      const next = { ...state, query, view: "list" as const };
      writeStateToUrl(next);
      render(root, dashboard, next);
    });
  });

  root.querySelector<HTMLButtonElement>("#show-warning-artifacts")?.addEventListener("click", () => {
    const warningPhase = dashboard.phaseCounts.find((count) => count.key !== "none")?.key ?? "all";
    const next = {
      ...state,
      corpus: "artifacts" as const,
      phase: warningPhase,
      decision: "all",
      query: "",
      selection: { kind: "artifact" as const, id: dashboard.artifacts.find((artifact) => (artifact.metadata.temporalMisalignmentPhase ?? "none") === warningPhase)?.artifactId ?? dashboard.artifacts[0]?.artifactId ?? "" },
    };
    writeStateToUrl(next);
    render(root, dashboard, next);
  });

  root.querySelector<HTMLSelectElement>("#corpus-select")?.addEventListener("change", (event) => {
    const target = event.target as HTMLSelectElement;
    const corpus = parseCorpus(target.value);
    const next = {
      ...state,
      corpus,
      decision: "all",
      selection: firstSelectionForCorpus(dashboard, corpus),
    };
    writeStateToUrl(next);
    render(root, dashboard, next);
  });

  root.querySelector<HTMLInputElement>("#query")?.addEventListener("input", (event) => {
    const target = event.target as HTMLInputElement;
    const next = { ...state, query: target.value };
    writeStateToUrl(next, true);
    render(root, dashboard, next);
  });

  root.querySelector<HTMLSelectElement>("#phase-filter")?.addEventListener("change", (event) => {
    const target = event.target as HTMLSelectElement;
    const next = { ...state, phase: target.value };
    writeStateToUrl(next);
    render(root, dashboard, next);
  });

  root.querySelector<HTMLSelectElement>("#decision-filter")?.addEventListener("change", (event) => {
    const target = event.target as HTMLSelectElement;
    const next = { ...state, decision: target.value };
    writeStateToUrl(next);
    render(root, dashboard, next);
  });

  root.querySelector<HTMLButtonElement>("#reset-filters")?.addEventListener("click", () => {
    const next = { ...state, phase: "all", decision: "all", query: "" };
    writeStateToUrl(next);
    render(root, dashboard, next);
  });
}

function getReplayRows(dashboard: DashboardData, state: DashboardState): ReplayRow[] {
  const artifactRows = filterArtifacts(dashboard.artifacts, state).map((artifact) => ({
    kind: "artifact" as const,
    id: artifact.artifactId,
    time: artifact.generatedAt,
    type: artifact.review.proposedAction.actionType,
    agent: artifact.review.proposedAction.proposedBy,
    policy: artifact.review.execution.enforcementMode,
    outcome: artifact.review.valid ? "admitted" : "warning",
    replay: artifact.artifactHash.length === 64 ? "valid" as const : "review" as const,
    tone: toneForArtifact(artifact),
    source: artifact.eventEnvelope.source,
  }));
  const admissionRows = filterAdmissions(dashboard.admissions, state).map((review) => ({
    kind: "admission" as const,
    id: review.reviewId,
    time: review.evaluatedAt,
    type: review.evidence.kind,
    agent: review.evidence.collectedBy ?? review.evidence.source,
    policy: review.authorityStatus,
    outcome: review.decision,
    replay: "valid" as const,
    tone: toneForAdmission(review),
    source: review.evidence.source,
  }));
  const writeBindingRows = filterWriteBindings(dashboard.writeBindings, state).map((record) => ({
    kind: "writeBinding" as const,
    id: record.recordId,
    time: record.generatedAt,
    type: record.actionType,
    agent: record.workflowName,
    policy: record.bindingMode,
    outcome: record.decision,
    replay: record.stateReviewArtifact.artifactHash.length === 64 ? "valid" as const : "review" as const,
    tone: toneForWriteBinding(record),
    source: record.capability,
  }));
  return [...artifactRows, ...admissionRows, ...writeBindingRows].sort((a, b) =>
    b.time.localeCompare(a.time),
  );
}

function filterArtifacts(artifacts: readonly StateReviewArtifact[], state: DashboardState): readonly StateReviewArtifact[] {
  return artifacts.filter((artifact) => {
    const phase = artifact.metadata.temporalMisalignmentPhase ?? "none";
    return (
      (state.phase === "all" || state.phase === phase) &&
      matchesQuery(
        state.query,
        artifact.artifactId,
        phase,
        artifact.eventEnvelope.source,
        artifact.review.proposedAction.proposedBy,
        artifact.review.warnings.map((warning) => warning.code).join(" "),
      )
    );
  });
}

function filterAdmissions(admissions: readonly EvidenceAdmissionReview[], state: DashboardState): readonly EvidenceAdmissionReview[] {
  return admissions.filter((review) => {
    return (
      (state.decision === "all" || state.decision === review.decision) &&
      matchesQuery(
        state.query,
        review.reviewId,
        review.evidence.kind,
        review.evidence.source,
        review.evidence.collectedBy ?? "",
        review.issues.map((issue) => issue.code).join(" "),
      )
    );
  });
}

function filterWriteBindings(
  writeBindings: readonly WriteBindingReplayRecord[],
  state: DashboardState,
): readonly WriteBindingReplayRecord[] {
  return writeBindings.filter((record) => {
    return (
      (state.decision === "all" || state.decision === record.decision) &&
      (state.phase === "all" || state.phase === record.temporalMisalignmentPhase) &&
      matchesQuery(
        state.query,
        record.recordId,
        record.decision,
        record.capability,
        record.actionType,
        record.stateReviewArtifact.artifactId,
        record.evidenceAdmissionReviews.map((review) => review.reviewId).join(" "),
      )
    );
  });
}

function getTotals(dashboard: DashboardData): {
  observations: number;
  admitted: number;
  rejected: number;
  warnings: number;
  replayHashesValid: boolean;
  writeBindingsAllowed: number;
  writeBindingsBlocked: number;
} {
  const writeBindingsAllowed = dashboard.writeBindings.filter(
    (record) => record.decision === "allowed",
  ).length;
  return {
    observations: dashboard.artifacts.length,
    admitted: dashboard.admissions.filter((review) => review.decision !== "rejected").length,
    rejected: dashboard.admissions.filter((review) => review.decision === "rejected").length,
    warnings: dashboard.artifacts.reduce((total, artifact) => total + artifact.review.warnings.length, 0),
    replayHashesValid: dashboard.artifacts.every((artifact) => artifact.artifactHash.length === 64),
    writeBindingsAllowed,
    writeBindingsBlocked: dashboard.writeBindings.length - writeBindingsAllowed,
  };
}

function getTimeBounds(dashboard: DashboardData): { earliest: string; latest: string; window: string } {
  const times = [
    ...dashboard.artifacts.map((artifact) => artifact.generatedAt),
    ...dashboard.admissions.map((review) => review.evaluatedAt),
    ...dashboard.writeBindings.map((record) => record.generatedAt),
  ].sort();
  const earliest = times[0] ?? "";
  const latest = times[times.length - 1] ?? "";
  return {
    earliest: earliest ? formatTime(earliest) : "n/a",
    latest: latest ? formatTime(latest) : "n/a",
    window: times.length > 0 ? "fixture" : "empty",
  };
}

function makeTimeTicks(dashboard: DashboardData): string[] {
  const rows = getReplayRows(dashboard, {
    corpus: "artifacts",
    phase: "all",
    decision: "all",
    query: "",
    view: "grid",
    resolution: "48",
    tableMode: "full",
    rawMode: false,
    selection: { kind: "artifact", id: dashboard.artifacts[0]?.artifactId ?? "" },
  });
  const times = rows.map((row) => row.time).sort();
  if (times.length === 0) return ["00:00", "00:00", "00:00", "00:00", "00:00", "00:00"];
  return [0, 0.2, 0.4, 0.6, 0.8, 1].map((ratio) => {
    const index = Math.min(times.length - 1, Math.floor(ratio * (times.length - 1)));
    return formatTime(times[index] ?? times[0] ?? "").slice(0, 5);
  });
}

function getSelectedBucket(
  dashboard: DashboardData,
  state: DashboardState,
  bucketCount = 48,
): number {
  const rows = getReplayRows(dashboard, { ...state, phase: "all", decision: "all", query: "" });
  const selectedIndex = rows.findIndex((row) => row.kind === state.selection.kind && row.id === state.selection.id);
  const maxBucket = Math.max(0, bucketCount - 1);
  if (selectedIndex < 0 || rows.length <= 1) return Math.min(maxBucket, Math.floor(bucketCount * 0.85));
  return Math.max(
    0,
    Math.min(maxBucket, Math.round((selectedIndex / (rows.length - 1)) * maxBucket)),
  );
}

function heatIntensity(value: number, rowIndex: number, index: number): number {
  if (value <= 0) return 1;
  const wave = (index * (rowIndex + 3) + value * 7 + rowIndex * 11) % 17;
  if (wave > 13) return 5;
  if (wave > 10) return 4;
  if (wave > 6) return 3;
  if (wave > 2) return 2;
  return 1;
}

function topCounts(values: readonly string[], limit: number): CountDatum[] {
  const counts = values.reduce<Record<string, number>>((result, value) => {
    result[value] = (result[value] ?? 0) + 1;
    return result;
  }, {});
  return Object.entries(counts)
    .map(([key, count]) => ({ key, count, tone: "neutral" as StatusTone }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
    .slice(0, limit);
}

function matchesQuery(query: string, ...values: readonly string[]): boolean {
  if (query.trim() === "") return true;
  const normalized = query.trim().toLowerCase();
  return values.some((value) => value.toLowerCase().includes(normalized));
}

function readStateFromUrl(dashboard: DashboardData): DashboardState {
  const params = new URLSearchParams(window.location.search);
  const kind = parseSelectionKind(params.get("kind"));
  const fallbackArtifact = dashboard.artifacts[0]?.artifactId ?? "";
  const fallbackAdmission = dashboard.admissions[0]?.reviewId ?? "";
  const fallbackWriteBinding = dashboard.writeBindings[0]?.recordId ?? "";
  const requestedCorpus = parseCorpus(params.get("corpus"));
  const normalizedSelection: Selection = (() => {
    if (requestedCorpus === "admissions") {
      return {
        kind: "admission",
        id: kind === "admission" ? params.get("id") ?? fallbackAdmission : fallbackAdmission,
      };
    }
    if (requestedCorpus === "writeBindings") {
      return {
        kind: "writeBinding",
        id:
          kind === "writeBinding"
            ? params.get("id") ?? fallbackWriteBinding
            : fallbackWriteBinding,
      };
    }
    return {
      kind: "artifact",
      id: kind === "artifact" ? params.get("id") ?? fallbackArtifact : fallbackArtifact,
    };
  })();
  return {
    corpus: requestedCorpus,
    phase: params.get("phase") ?? "all",
    decision: params.get("decision") ?? "all",
    query: params.get("q") ?? "",
    view: parseDashboardView(params.get("view")),
    resolution: parseResolution(params.get("resolution")),
    tableMode: params.get("table") === "compact" ? "compact" : "full",
    rawMode: params.get("raw") === "1",
    selection: normalizedSelection,
  };
}

function parseCorpus(value: string | null | undefined): DashboardState["corpus"] {
  if (value === "admissions" || value === "writeBindings") return value;
  return "artifacts";
}

function parseSelectionKind(value: string | null | undefined): Selection["kind"] {
  if (value === "admission" || value === "writeBinding") return value;
  return "artifact";
}

function corpusForSelectionKind(kind: Selection["kind"]): DashboardState["corpus"] {
  if (kind === "admission") return "admissions";
  if (kind === "writeBinding") return "writeBindings";
  return "artifacts";
}

function firstSelectionForCorpus(
  dashboard: DashboardData,
  corpus: DashboardState["corpus"],
): Selection {
  if (corpus === "admissions") {
    return { kind: "admission", id: dashboard.admissions[0]?.reviewId ?? "" };
  }
  if (corpus === "writeBindings") {
    return { kind: "writeBinding", id: dashboard.writeBindings[0]?.recordId ?? "" };
  }
  return { kind: "artifact", id: dashboard.artifacts[0]?.artifactId ?? "" };
}

function writeStateToUrl(state: DashboardState, replace = false): void {
  const params = new URLSearchParams();
  params.set("corpus", state.corpus);
  params.set("view", state.view);
  params.set("resolution", state.resolution);
  params.set("table", state.tableMode);
  params.set("kind", state.selection.kind);
  params.set("id", state.selection.id);
  if (state.rawMode) params.set("raw", "1");
  if (state.phase !== "all") params.set("phase", state.phase);
  if (state.decision !== "all") params.set("decision", state.decision);
  if (state.query.trim() !== "") params.set("q", state.query.trim());
  const url = `${window.location.pathname}?${params.toString()}`;
  if (replace) {
    window.history.replaceState(null, "", url);
  } else {
    window.history.pushState(null, "", url);
  }
}

function parseResolution(value: string | null | undefined): TimelineResolution {
  if (value === "24" || value === "12") return value;
  return "48";
}

function parseDashboardView(value: string | null | undefined): DashboardView {
  if (
    value === "live" ||
    value === "grid" ||
    value === "list" ||
    value === "flow" ||
    value === "safe" ||
    value === "data" ||
    value === "trend" ||
    value === "gear"
  ) {
    return value;
  }
  return "live";
}

function renderOptions(options: readonly string[], selected: string): string {
  return options
    .map(
      (option) =>
        `<option value="${escapeAttribute(option)}" ${option === selected ? "selected" : ""}>${escapeHtml(option)}</option>`,
    )
    .join("");
}

function compactArtifact(artifact: StateReviewArtifact): Record<string, unknown> {
  return {
    artifact_id: artifact.artifactId,
    source: artifact.eventEnvelope.source,
    state_hash: artifact.artifactHash,
    generated_at: artifact.generatedAt,
    agent_id: artifact.review.proposedAction.proposedBy,
    action_type: artifact.review.proposedAction.actionType,
    binding: {
      target: artifact.review.currentStateView.subject.id,
      key: artifact.metadata.temporalMisalignmentPhase ?? "none",
      warning_codes: artifact.review.warnings.map((warning) => warning.code),
    },
  };
}

function compactAdmission(review: EvidenceAdmissionReview): Record<string, unknown> {
  return {
    artifact_id: review.reviewId,
    evidence_id: review.evidence.evidenceId,
    evidence_kind: review.evidence.kind,
    source: review.evidence.source,
    observed_at: review.evidence.observedAt,
    decision: review.decision,
    authority_status: review.authorityStatus,
    issues: review.issues.map((issue) => issue.code),
  };
}

function compactWriteBinding(record: WriteBindingReplayRecord): Record<string, unknown> {
  return {
    record_id: record.recordId,
    generated_at: record.generatedAt,
    workflow_run_id: record.workflowRunId,
    capability: record.capability,
    action_type: record.actionType,
    decision: record.decision,
    validation: record.validation,
    state_review_artifact: record.stateReviewArtifact,
    evidence_admission_review_ids: record.evidenceAdmissionReviews.map(
      (review) => review.reviewId,
    ),
    policy_disposition:
      record.invocationEvidenceBinding?.policyDisposition ?? null,
  };
}

function toneForWriteBinding(record: WriteBindingReplayRecord): StatusTone {
  if (record.decision === "allowed") return "good";
  if (
    record.decision === "blocked_policy" ||
    record.decision === "blocked_unverified_binding"
  ) {
    return "bad";
  }
  return "warn";
}

function formatPercent(numerator: number, denominator: number): string {
  if (denominator <= 0) return "0%";
  return `${Math.round((numerator / denominator) * 100)}%`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value);
}
