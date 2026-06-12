import "./styles.css";
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
} from "./data.js";

type Selection =
  | { readonly kind: "artifact"; readonly id: string }
  | { readonly kind: "admission"; readonly id: string };

interface DashboardState {
  corpus: "artifacts" | "admissions";
  phase: string;
  decision: string;
  query: string;
  selection: Selection;
}

const data = loadDashboardData();
const initialState = readStateFromUrl(data);
const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("missing #app root");
}

render(app, data, initialState);

function render(root: HTMLElement, dashboard: DashboardData, state: DashboardState): void {
  root.innerHTML = `
    <div class="app-shell">
      ${renderTopBar(dashboard)}
      <div class="workspace">
        ${renderLeftRail(dashboard, state)}
        ${renderMainSurface(dashboard, state)}
        ${renderInspector(dashboard, state)}
      </div>
    </div>
  `;

  bindInteractions(root, dashboard, state);
}

function renderTopBar(dashboard: DashboardData): string {
  return `
    <header class="topbar">
      <div class="brand">
        <div class="mark" aria-hidden="true">pm</div>
        <div>
          <div class="brand-title">Substrate Monitor</div>
          <div class="brand-subtitle">Replay corpora · operational-state evidence</div>
        </div>
      </div>
      <div class="status-strip" aria-label="dashboard metrics">
        ${dashboard.metrics.map(renderMetric).join("")}
      </div>
    </header>
  `;
}

function renderMetric(metric: { label: string; value: string; detail: string; tone: StatusTone }): string {
  return `
    <div class="metric metric-${metric.tone}">
      <div class="metric-label">${escapeHtml(metric.label)}</div>
      <div class="metric-value">${escapeHtml(metric.value)}</div>
      <div class="metric-detail">${escapeHtml(metric.detail)}</div>
    </div>
  `;
}

function renderLeftRail(dashboard: DashboardData, state: DashboardState): string {
  const artifactRows = filterArtifacts(dashboard.artifacts, state);
  const admissionRows = filterAdmissions(dashboard.admissions, state);
  const rows =
    state.corpus === "artifacts"
      ? artifactRows.map((artifact) => renderArtifactListItem(artifact, state)).join("")
      : admissionRows.map((review) => renderAdmissionListItem(review, state)).join("");

  return `
    <aside class="left-rail" aria-label="Replay corpus controls">
      <section class="rail-section">
        <div class="section-title">Replay Corpus</div>
        <div class="segmented" role="tablist" aria-label="Corpus kind">
          <button class="${state.corpus === "artifacts" ? "active" : ""}" data-corpus="artifacts">Artifacts</button>
          <button class="${state.corpus === "admissions" ? "active" : ""}" data-corpus="admissions">Admissions</button>
        </div>
        <label class="control-label" for="query">Search</label>
        <input id="query" class="search-input" value="${escapeAttribute(state.query)}" placeholder="artifact, review, warning, source..." />
        <div class="filter-grid">
          <label>
            <span>Phase</span>
            <select id="phase-filter">
              ${renderOptions(["all", ...dashboard.phaseCounts.map((count) => count.key)], state.phase)}
            </select>
          </label>
          <label>
            <span>Decision</span>
            <select id="decision-filter">
              ${renderOptions(["all", ...dashboard.decisionCounts.map((count) => count.key)], state.decision)}
            </select>
          </label>
        </div>
        <button class="reset-button" id="reset-filters" type="button">Reset filters</button>
      </section>
      <section class="rail-section list-section">
        <div class="list-header">
          <div class="section-title">${state.corpus === "artifacts" ? "Artifacts" : "Admissions"}</div>
          <div class="list-count">${state.corpus === "artifacts" ? artifactRows.length : admissionRows.length}</div>
        </div>
        <div class="item-list">${rows}</div>
      </section>
    </aside>
  `;
}

function renderMainSurface(dashboard: DashboardData, state: DashboardState): string {
  return `
    <main class="main-surface">
      <section class="surface-section timeline-section">
        <div class="section-heading">
          <div>
            <h1>Evidence Timeline</h1>
            <p>Committed replay artifacts and evidence-admission reviews from the current fixture boundary.</p>
          </div>
          <div class="source-note">Static JSONL · ${dashboard.artifacts.length + dashboard.admissions.length} rows</div>
        </div>
        ${renderTimeline(dashboard, state)}
      </section>
      <section class="surface-grid">
        <div class="surface-section flow-section">
          <div class="section-heading compact">
            <h2>Evidence Flow</h2>
            <span>Observation → review → admission → binding</span>
          </div>
          ${renderFlow(dashboard)}
        </div>
        <div class="surface-section heat-section">
          <div class="section-heading compact">
            <h2>Warning Heatmap</h2>
            <span>Invariant and issue concentrations</span>
          </div>
          ${renderCountBars("Temporal phases", dashboard.phaseCounts)}
          ${renderCountBars("Artifact warnings", dashboard.warningCounts)}
          ${renderCountBars("Evidence decisions", dashboard.decisionCounts)}
        </div>
      </section>
      <section class="surface-section event-table-section">
        <div class="section-heading compact">
          <h2>Replay Rows</h2>
          <span>Click a row to inspect the source object</span>
        </div>
        ${renderRowsTable(dashboard, state)}
      </section>
    </main>
  `;
}

function renderTimeline(dashboard: DashboardData, state: DashboardState): string {
  const artifactTimes = dashboard.artifacts.map((artifact) => ({
    kind: "artifact" as const,
    id: artifact.artifactId,
    time: new Date(artifact.generatedAt).getTime(),
    tone: toneForArtifact(artifact),
    label: artifact.metadata.temporalMisalignmentPhase ?? "none",
  }));
  const admissionTimes = dashboard.admissions.map((review) => ({
    kind: "admission" as const,
    id: review.reviewId,
    time: new Date(review.evaluatedAt).getTime(),
    tone: toneForAdmission(review),
    label: review.decision,
  }));
  const points = [...artifactTimes, ...admissionTimes].filter((point) =>
    Number.isFinite(point.time),
  );
  const min = Math.min(...points.map((point) => point.time));
  const max = Math.max(...points.map((point) => point.time));
  const span = Math.max(max - min, 1);

  return `
    <div class="timeline" role="list" aria-label="Replay timeline">
      <div class="time-axis">
        <span>${formatTime(new Date(min).toISOString())}</span>
        <span>${formatTime(new Date(max).toISOString())}</span>
      </div>
      <div class="lane">
        <div class="lane-label">State reviews</div>
        <div class="lane-track">
          ${artifactTimes
            .map((point) => renderTimelinePoint(point, min, span, state))
            .join("")}
        </div>
      </div>
      <div class="lane">
        <div class="lane-label">Evidence admissions</div>
        <div class="lane-track">
          ${admissionTimes
            .map((point) => renderTimelinePoint(point, min, span, state))
            .join("")}
        </div>
      </div>
    </div>
  `;
}

function renderTimelinePoint(
  point: {
    readonly kind: "artifact" | "admission";
    readonly id: string;
    readonly time: number;
    readonly tone: StatusTone;
    readonly label: string;
  },
  min: number,
  span: number,
  state: DashboardState,
): string {
  const left = ((point.time - min) / span) * 100;
  const selected = state.selection.kind === point.kind && state.selection.id === point.id;
  return `
    <button
      class="timeline-point tone-${point.tone} ${selected ? "selected" : ""}"
      style="left:${left}%"
      title="${escapeAttribute(`${point.label} · ${point.id}`)}"
      data-select-kind="${point.kind}"
      data-select-id="${escapeAttribute(point.id)}"
      aria-label="${escapeAttribute(`${point.kind} ${point.label}`)}"
    ></button>
  `;
}

function renderFlow(dashboard: DashboardData): string {
  const items = [
    { label: "Observations", value: dashboard.flow.observations, tone: "neutral" as StatusTone },
    { label: "State reviews", value: dashboard.flow.stateReviews, tone: "good" as StatusTone },
    { label: "Admitted evidence", value: dashboard.flow.admittedEvidence, tone: "good" as StatusTone },
    { label: "Rejected evidence", value: dashboard.flow.rejectedEvidence, tone: "bad" as StatusTone },
    { label: "Write bindings", value: dashboard.flow.writeBindings, tone: "neutral" as StatusTone },
  ];
  const max = Math.max(...items.map((item) => item.value ?? 0), 1);

  return `
    <div class="flow">
      ${items
        .map((item, index) => {
          const width = item.value === null ? 42 : Math.max(18, (item.value / max) * 100);
          return `
            <div class="flow-node tone-${item.tone} ${item.value === null ? "pending" : ""}">
              <div class="flow-label">${escapeHtml(item.label)}</div>
              <div class="flow-value">${item.value === null ? "pending" : item.value}</div>
              <div class="flow-bar"><span style="width:${width}%"></span></div>
            </div>
            ${index < items.length - 1 ? '<div class="flow-link" aria-hidden="true"></div>' : ""}
          `;
        })
        .join("")}
    </div>
  `;
}

function renderCountBars(title: string, counts: readonly CountDatum[]): string {
  const max = Math.max(...counts.map((count) => count.count), 1);
  return `
    <div class="count-block">
      <div class="count-title">${escapeHtml(title)}</div>
      <div class="count-bars">
        ${counts
          .slice(0, 7)
          .map(
            (count) => `
              <div class="count-row">
                <span class="count-key">${escapeHtml(count.key)}</span>
                <span class="count-track"><span class="tone-${count.tone}" style="width:${Math.max(8, (count.count / max) * 100)}%"></span></span>
                <span class="count-value">${count.count}</span>
              </div>
            `,
          )
          .join("")}
      </div>
    </div>
  `;
}

function renderRowsTable(dashboard: DashboardData, state: DashboardState): string {
  const artifactRows = filterArtifacts(dashboard.artifacts, state).map((artifact) => ({
    kind: "artifact" as const,
    id: artifact.artifactId,
    time: artifact.generatedAt,
    type: artifact.metadata.temporalMisalignmentPhase ?? "none",
    source: artifact.eventEnvelope.source,
    outcome: artifact.review.valid ? "valid" : "warning",
    tone: toneForArtifact(artifact),
  }));
  const admissionRows = filterAdmissions(dashboard.admissions, state).map((review) => ({
    kind: "admission" as const,
    id: review.reviewId,
    time: review.evaluatedAt,
    type: review.evidence.kind,
    source: review.evidence.source,
    outcome: review.decision,
    tone: toneForAdmission(review),
  }));
  const rows = [...artifactRows, ...admissionRows]
    .sort((a, b) => b.time.localeCompare(a.time))
    .slice(0, 12);

  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Time</th>
            <th>Artifact / review</th>
            <th>Type</th>
            <th>Source</th>
            <th>Outcome</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row) => `
                <tr data-select-kind="${row.kind}" data-select-id="${escapeAttribute(row.id)}">
                  <td>${formatTime(row.time)}</td>
                  <td><button class="link-button">${escapeHtml(shortId(row.id, 24))}</button></td>
                  <td>${escapeHtml(row.type)}</td>
                  <td>${escapeHtml(shortId(row.source, 34))}</td>
                  <td><span class="status-pill tone-${row.tone}">${escapeHtml(row.outcome)}</span></td>
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderInspector(dashboard: DashboardData, state: DashboardState): string {
  const artifact = dashboard.artifacts.find(
    (item) => state.selection.kind === "artifact" && item.artifactId === state.selection.id,
  );
  const admission = dashboard.admissions.find(
    (item) => state.selection.kind === "admission" && item.reviewId === state.selection.id,
  );

  if (artifact) {
    return renderArtifactInspector(artifact);
  }
  if (admission) {
    return renderAdmissionInspector(admission);
  }
  return `<aside class="inspector"><div class="section-title">Inspector</div><p>No selected row.</p></aside>`;
}

function renderArtifactInspector(artifact: StateReviewArtifact): string {
  const warnings = artifact.review.warnings;
  const refs = [
    ...artifact.review.currentStateView.sourceRefs,
    ...(artifact.relatedObjects ?? []).map((object) => object.ref),
  ];

  return `
    <aside class="inspector" aria-label="Artifact inspector">
      <div class="inspector-header">
        <div>
          <div class="section-title">Artifact Inspector</div>
          <h2>${escapeHtml(shortId(artifact.artifactId, 28))}</h2>
        </div>
        <span class="status-pill tone-${toneForArtifact(artifact)}">${artifact.review.valid ? "valid" : "warning"}</span>
      </div>
      ${renderFactGrid([
        ["Type", artifact.review.proposedAction.actionType],
        ["Phase", artifact.metadata.temporalMisalignmentPhase ?? "none"],
        ["Agent", artifact.review.proposedAction.proposedBy],
        ["Time", artifact.generatedAt],
        ["Replay hash", shortId(artifact.artifactHash, 22)],
        ["Policy", artifact.review.execution.enforcementMode],
      ])}
      <div class="inspector-block">
        <h3>Warnings</h3>
        ${
          warnings.length === 0
            ? '<div class="empty-state">No artifact warnings.</div>'
            : warnings
                .map(
                  (warning) => `
                    <div class="warning-row tone-${warning.severity === "fail" ? "bad" : "warn"}">
                      <strong>${escapeHtml(warning.code)}</strong>
                      <span>${escapeHtml(warning.message)}</span>
                    </div>
                  `,
                )
                .join("")
        }
      </div>
      <div class="inspector-block">
        <h3>Source References</h3>
        ${refs.slice(0, 8).map((ref) => `<div class="ref-row"><span>${escapeHtml(ref.kind)}</span><code>${escapeHtml(shortId(ref.id, 32))}</code></div>`).join("")}
      </div>
      <div class="inspector-block">
        <h3>Artifact Facts JSON</h3>
        <pre>${escapeHtml(JSON.stringify(compactArtifact(artifact), null, 2))}</pre>
      </div>
    </aside>
  `;
}

function renderAdmissionInspector(review: EvidenceAdmissionReview): string {
  return `
    <aside class="inspector" aria-label="Evidence admission inspector">
      <div class="inspector-header">
        <div>
          <div class="section-title">Evidence Inspector</div>
          <h2>${escapeHtml(shortId(review.reviewId, 28))}</h2>
        </div>
        <span class="status-pill tone-${toneForAdmission(review)}">${escapeHtml(review.decision)}</span>
      </div>
      ${renderFactGrid([
        ["Evidence", review.evidence.evidenceId],
        ["Kind", review.evidence.kind],
        ["Source", review.evidence.source],
        ["Authority", review.authorityStatus],
        ["Observed", review.evidence.observedAt],
        ["Evaluated", review.evaluatedAt],
      ])}
      <div class="inspector-block">
        <h3>Admission Issues</h3>
        ${
          review.issues.length === 0
            ? '<div class="empty-state">No admission issues.</div>'
            : review.issues
                .map(
                  (issue) => `
                    <div class="warning-row tone-${issue.severity === "fail" ? "bad" : "warn"}">
                      <strong>${escapeHtml(issue.code)}</strong>
                      <span>${escapeHtml(issue.message)}</span>
                    </div>
                  `,
                )
                .join("")
        }
      </div>
      <div class="inspector-block">
        <h3>Admission Facts JSON</h3>
        <pre>${escapeHtml(JSON.stringify(compactAdmission(review), null, 2))}</pre>
      </div>
    </aside>
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

function renderArtifactListItem(
  artifact: StateReviewArtifact,
  state: DashboardState,
): string {
  const selected = state.selection.kind === "artifact" && state.selection.id === artifact.artifactId;
  return `
    <button class="list-item ${selected ? "selected" : ""}" data-select-kind="artifact" data-select-id="${escapeAttribute(artifact.artifactId)}">
      <span class="dot tone-${toneForArtifact(artifact)}"></span>
      <span>
        <strong>${escapeHtml(shortId(artifact.artifactId, 22))}</strong>
        <small>${escapeHtml(artifact.metadata.temporalMisalignmentPhase ?? "none")} · ${formatTime(artifact.generatedAt)}</small>
      </span>
      <span class="status-pill tone-${toneForArtifact(artifact)}">${artifact.review.valid ? "valid" : "warn"}</span>
    </button>
  `;
}

function renderAdmissionListItem(
  review: EvidenceAdmissionReview,
  state: DashboardState,
): string {
  const selected = state.selection.kind === "admission" && state.selection.id === review.reviewId;
  return `
    <button class="list-item ${selected ? "selected" : ""}" data-select-kind="admission" data-select-id="${escapeAttribute(review.reviewId)}">
      <span class="dot tone-${toneForAdmission(review)}"></span>
      <span>
        <strong>${escapeHtml(shortId(review.reviewId, 22))}</strong>
        <small>${escapeHtml(review.evidence.kind)} · ${formatTime(review.evaluatedAt)}</small>
      </span>
      <span class="status-pill tone-${toneForAdmission(review)}">${escapeHtml(review.decision.replaceAll("_", " "))}</span>
    </button>
  `;
}

function bindInteractions(
  root: HTMLElement,
  dashboard: DashboardData,
  state: DashboardState,
): void {
  root.querySelectorAll<HTMLElement>("[data-select-kind]").forEach((element) => {
    element.addEventListener("click", () => {
      const kind = element.dataset.selectKind;
      const id = element.dataset.selectId;
      if ((kind === "artifact" || kind === "admission") && id) {
        const selection: Selection =
          kind === "admission" ? { kind, id } : { kind, id };
        const next = { ...state, selection };
        writeStateToUrl(next);
        render(root, dashboard, next);
      }
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-corpus]").forEach((button) => {
    button.addEventListener("click", () => {
      const corpus: DashboardState["corpus"] =
        button.dataset.corpus === "admissions" ? "admissions" : "artifacts";
      const next = {
        ...state,
        corpus,
        selection:
          corpus === "admissions"
            ? { kind: "admission" as const, id: dashboard.admissions[0]?.reviewId ?? "" }
            : { kind: "artifact" as const, id: dashboard.artifacts[0]?.artifactId ?? "" },
      };
      writeStateToUrl(next);
      render(root, dashboard, next);
    });
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
    const next = {
      ...state,
      phase: "all",
      decision: "all",
      query: "",
    };
    writeStateToUrl(next);
    render(root, dashboard, next);
  });
}

function filterArtifacts(
  artifacts: readonly StateReviewArtifact[],
  state: DashboardState,
): readonly StateReviewArtifact[] {
  return artifacts.filter((artifact) => {
    const phase = artifact.metadata.temporalMisalignmentPhase ?? "none";
    return (
      (state.phase === "all" || state.phase === phase) &&
      matchesQuery(
        state.query,
        artifact.artifactId,
        phase,
        artifact.eventEnvelope.source,
        artifact.review.warnings.map((warning) => warning.code).join(" "),
      )
    );
  });
}

function filterAdmissions(
  admissions: readonly EvidenceAdmissionReview[],
  state: DashboardState,
): readonly EvidenceAdmissionReview[] {
  return admissions.filter((review) => {
    return (
      (state.decision === "all" || state.decision === review.decision) &&
      matchesQuery(
        state.query,
        review.reviewId,
        review.evidence.kind,
        review.evidence.source,
        review.issues.map((issue) => issue.code).join(" "),
      )
    );
  });
}

function matchesQuery(query: string, ...values: readonly string[]): boolean {
  if (query.trim() === "") return true;
  const normalized = query.trim().toLowerCase();
  return values.some((value) => value.toLowerCase().includes(normalized));
}

function readStateFromUrl(dashboard: DashboardData): DashboardState {
  const params = new URLSearchParams(window.location.search);
  const kind = params.get("kind") === "admission" ? "admission" : "artifact";
  const fallbackArtifact = dashboard.artifacts[0]?.artifactId ?? "";
  const fallbackAdmission = dashboard.admissions[0]?.reviewId ?? "";
  return {
    corpus: params.get("corpus") === "admissions" ? "admissions" : "artifacts",
    phase: params.get("phase") ?? "all",
    decision: params.get("decision") ?? "all",
    query: params.get("q") ?? "",
    selection:
      kind === "admission"
        ? { kind, id: params.get("id") ?? fallbackAdmission }
        : { kind, id: params.get("id") ?? fallbackArtifact },
  };
}

function writeStateToUrl(state: DashboardState, replace = false): void {
  const params = new URLSearchParams();
  params.set("corpus", state.corpus);
  params.set("kind", state.selection.kind);
  params.set("id", state.selection.id);
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
    artifactId: artifact.artifactId,
    generatedAt: artifact.generatedAt,
    artifactHash: artifact.artifactHash,
    phase: artifact.metadata.temporalMisalignmentPhase ?? "none",
    invariantClasses: artifact.metadata.invariantClasses ?? [],
    scenarioId: artifact.metadata.scenarioId,
    proposedAction: artifact.review.proposedAction.actionType,
    valid: artifact.review.valid,
    warnings: artifact.review.warnings.map((warning) => warning.code),
    sourceRefs: artifact.review.currentStateView.sourceRefs.map((ref) => ref.id),
  };
}

function compactAdmission(review: EvidenceAdmissionReview): Record<string, unknown> {
  return {
    reviewId: review.reviewId,
    evidenceId: review.evidence.evidenceId,
    kind: review.evidence.kind,
    source: review.evidence.source,
    decision: review.decision,
    authorityStatus: review.authorityStatus,
    issues: review.issues.map((issue) => issue.code),
    invariantClasses: review.invariantClasses,
  };
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
