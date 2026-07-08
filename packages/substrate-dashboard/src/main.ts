import "./styles.css";

import { mountControlPlane } from "./control-plane-page.js";
import { mountIntegrationWorkbench } from "./integration-workbench-page.js";
import { fetchSnapshot, renderLive } from "./live.js";

type Mode = "substrate" | "no_substrate" | "ab_pair";
type SessionStatus = "running" | "completed" | "stopped" | "failed";
type Arm = "substrate" | "no_substrate";

interface ScenarioMeta {
  readonly scenarioId: string;
  readonly failureClass: string;
  readonly realityQualities: readonly number[];
}

interface SummaryMetrics {
  readonly activeAgents: number;
  readonly blockedAgents: number;
  readonly pendingInjections: number;
  readonly pendingMutations: number;
  readonly injectionAppliedCount: number;
  readonly mutationAppliedCount: number;
  readonly unsafeBlockedCount: number;
  readonly unsafeAdmittedCount: number;
  readonly divergenceCount: number;
  readonly substrateProtectedCount: number;
}

interface SessionSummary {
  readonly id: string;
  readonly title: string;
  readonly objective: string;
  readonly scenarioId: string;
  readonly failureClass: string;
  readonly mode: Mode;
  readonly status: SessionStatus;
  readonly agentCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly latestActivity: string;
  readonly summaryMetrics: SummaryMetrics;
  readonly error: string | null;
}

interface SessionEvent {
  readonly id: string;
  readonly type: string;
  readonly sessionId: string;
  readonly scenarioId: string;
  readonly failureClass: string;
  readonly occurredAt: string;
  readonly agentId?: string;
  readonly arm?: Arm;
  readonly message: string;
  readonly result?: "pass" | "fail" | "blocked";
  readonly payload?: Record<string, unknown>;
}

interface ArmRun {
  readonly arm: Arm;
  readonly result: "pass" | "fail" | "blocked";
  readonly actedValue: unknown;
  readonly admitted: boolean;
  readonly refusedReason?: string;
  readonly tokens: number;
  readonly admittedTransitions: number;
  readonly chainValid: boolean;
}

interface AgentResult {
  readonly agentId: string;
  readonly label: string;
  readonly arms: Partial<Record<Arm, ArmRun>>;
  readonly behaviorDiverged: boolean;
}

interface SessionDetail {
  readonly session: SessionSummary;
  readonly events: readonly SessionEvent[];
  readonly agents: readonly AgentResult[];
}

const appRoot = document.querySelector<HTMLDivElement>("#app")!;
if (!appRoot) throw new Error("missing #app root");

type DashboardView = "lab" | "live" | "control-plane" | "integrations";

function currentView(): DashboardView {
  const raw = window.location.hash.replace(/^#\/?/, "");
  if (raw === "live" || raw === "control-plane" || raw === "integrations") return raw;
  return "lab";
}

let mountedShellView: DashboardView | null = null;

/**
 * Persistent shell: a nav rail plus a single `.dashboard-view` container the
 * active view renders into. The Local Agent Lab remains the default view and
 * keeps its existing render path — it just targets the view container now.
 */
function renderShell(active: DashboardView): void {
  if (mountedShellView === active && appRoot.querySelector(".dashboard-view")) return;
  mountedShellView = active;
  const link = (view: DashboardView, label: string): string =>
    `<a href="#${view}" class="${active === view ? "active" : ""}">${label}</a>`;
  appRoot.innerHTML = `
    <main class="substrate-dashboard-shell">
      <aside class="dashboard-rail">
        <strong>pm-substrate</strong>
        ${link("lab", "Lab")}
        ${link("live", "Validation Metrics")}
        ${link("control-plane", "Control Plane")}
        ${link("integrations", "Integrations")}
      </aside>
      <section class="dashboard-view"></section>
    </main>`;
}

function viewRoot(): HTMLElement {
  let root = appRoot.querySelector<HTMLElement>(".dashboard-view");
  if (!root) {
    renderShell(currentView());
    root = appRoot.querySelector<HTMLElement>(".dashboard-view")!;
  }
  return root;
}

let scenarios: ScenarioMeta[] = [];
let sessions: SessionSummary[] = [];
let detail: SessionDetail | null = null;
let stream: EventSource | null = null;
let selectedSessionId: string | null = null;
let startModalOpen = false;

const previewSession: SessionDetail = {
  session: {
    id: "preview-session",
    title: "stale-observation control preview",
    objective: "Test whether stale private representation can become operational state.",
    scenarioId: "stale-observation",
    failureClass: "stale_observation",
    mode: "ab_pair",
    status: "running",
    agentCount: 2,
    createdAt: "2026-06-29T02:00:00.000Z",
    updatedAt: "2026-06-29T02:04:20.000Z",
    latestActivity: "Substrate arm refused stale basis; no-substrate arm admitted the unsafe action.",
    error: null,
    summaryMetrics: {
      activeAgents: 2,
      blockedAgents: 1,
      pendingInjections: 0,
      pendingMutations: 0,
      injectionAppliedCount: 1,
      mutationAppliedCount: 1,
      unsafeBlockedCount: 1,
      unsafeAdmittedCount: 1,
      divergenceCount: 1,
      substrateProtectedCount: 1,
    },
  },
  agents: [
    {
      agentId: "preview-session:agent:1",
      label: "Agent 1",
      behaviorDiverged: true,
      arms: {
        no_substrate: {
          arm: "no_substrate",
          result: "fail",
          actedValue: 100,
          admitted: true,
          tokens: 42,
          admittedTransitions: 3,
          chainValid: true,
        },
        substrate: {
          arm: "substrate",
          result: "blocked",
          actedValue: 100,
          admitted: false,
          refusedReason: "stale_basis position=1 < head=2",
          tokens: 42,
          admittedTransitions: 2,
          chainValid: true,
        },
      },
    },
    {
      agentId: "preview-session:agent:2",
      label: "Agent 2",
      behaviorDiverged: false,
      arms: {
        no_substrate: {
          arm: "no_substrate",
          result: "pass",
          actedValue: "-",
          admitted: false,
          tokens: 18,
          admittedTransitions: 1,
          chainValid: true,
        },
        substrate: {
          arm: "substrate",
          result: "pass",
          actedValue: "-",
          admitted: false,
          tokens: 18,
          admittedTransitions: 1,
          chainValid: true,
        },
      },
    },
  ],
  events: [
    previewEvent("session_created", "Local agent lab session created for stale-observation."),
    previewEvent("agent_started", "Agent 1 started.", "preview-session:agent:1"),
    previewEvent("world_seeded", "Seeded AAPL = 100 as admitted lab state.", "preview-session:agent:1", "no_substrate"),
    previewEvent("agent_observed", "Agent observed AAPL at basis position 1.", "preview-session:agent:1", "no_substrate"),
    previewEvent("injection_applied", "Injected file-context request into the session.", "preview-session:agent:1"),
    previewEvent("mutation_applied", "Lab mutation moved AAPL from 100 to 130 after observation.", "preview-session:agent:1", "no_substrate"),
    previewEvent("action_admitted", "No-substrate action admitted stale AAPL=100.", "preview-session:agent:1", "no_substrate"),
    previewEvent("action_refused", "Substrate refused stale AAPL=100 at admission boundary.", "preview-session:agent:1", "substrate"),
    previewEvent("arm_diverged", "A/B arms diverged after the same lab mutation.", "preview-session:agent:1"),
  ],
};

let previewSessionState: SessionDetail = previewSession;

function previewEvent(
  type: string,
  message: string,
  agentId?: string,
  arm?: Arm,
): SessionEvent {
  return {
    id: `preview-${type}-${agentId ?? "session"}-${arm ?? "all"}`,
    type,
    sessionId: "preview-session",
    scenarioId: "stale-observation",
    failureClass: "stale_observation",
    occurredAt: "2026-06-29T02:04:20.000Z",
    message,
    ...(agentId ? { agentId } : {}),
    ...(arm ? { arm } : {}),
  };
}

void boot();

async function boot(): Promise<void> {
  window.addEventListener("popstate", () => void route());
  window.addEventListener("hashchange", () => void route());
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && startModalOpen) {
      startModalOpen = false;
      renderMain();
    }
  });
  await Promise.all([loadScenarios(), loadSessions()]);
  await route();
  window.setInterval(() => {
    if (currentView() === "lab" && !currentSessionId()) {
      void loadSessions().then(renderMain);
    }
  }, 4000);
}

async function route(): Promise<void> {
  const view = currentView();
  renderShell(view);
  if (view === "live") {
    disconnectStream();
    viewRoot().innerHTML = `
      <p class="view-note">External-app validation viewer (ArrowHedge attaches through the integration kit; it is a separate system, not part of the Local Agent Lab).</p>
      <div id="live-root"><p class="view-loading">Loading validation metrics…</p></div>`;
    renderLive(viewRoot().querySelector<HTMLElement>("#live-root")!, await fetchSnapshot());
    return;
  }
  if (view === "control-plane") {
    disconnectStream();
    viewRoot().innerHTML = `<div id="control-plane-root"></div>`;
    await mountControlPlane(viewRoot().querySelector<HTMLElement>("#control-plane-root")!);
    return;
  }
  if (view === "integrations") {
    disconnectStream();
    viewRoot().innerHTML = `<div id="integration-workbench-root"></div>`;
    await mountIntegrationWorkbench(
      viewRoot().querySelector<HTMLElement>("#integration-workbench-root")!,
    );
    return;
  }
  const id = currentSessionId();
  if (id) {
    await loadDetail(id);
    renderDetail();
    connectStream(id);
  } else {
    disconnectStream();
    detail = null;
    renderMain();
  }
}

function currentSessionId(): string | null {
  const match = window.location.pathname.match(/^\/sessions\/([^/]+)$/);
  return match?.[1] ?? null;
}

async function loadScenarios(): Promise<void> {
  const res = await fetch("/api/lab/scenarios");
  const body = (await res.json()) as { scenarios?: ScenarioMeta[] };
  scenarios = body.scenarios ?? [];
}

async function loadSessions(): Promise<void> {
  const res = await fetch("/api/sessions");
  const body = (await res.json()) as { sessions?: SessionSummary[] };
  sessions = body.sessions ?? [];
}

async function loadDetail(id: string): Promise<void> {
  if (id === previewSessionState.session.id) {
    detail = previewSessionState;
    return;
  }
  const res = await fetch(`/api/sessions/${encodeURIComponent(id)}`);
  if (!res.ok) {
    detail = null;
    return;
  }
  detail = (await res.json()) as SessionDetail;
}

function connectStream(id: string): void {
  if (id === previewSessionState.session.id) {
    disconnectStream();
    return;
  }
  if (stream?.url.endsWith(`/api/sessions/${id}/stream`)) return;
  disconnectStream();
  stream = new EventSource(`/api/sessions/${encodeURIComponent(id)}/stream`);
  stream.addEventListener("session-event", (evt) => {
    const event = JSON.parse((evt as MessageEvent).data) as SessionEvent;
    if (!detail || detail.session.id !== id) return;
    detail = { ...detail, events: [...detail.events, event] };
    renderDetail();
    if (event.type === "session_completed" || event.type === "session_failed") {
      void loadDetail(id).then(renderDetail);
    }
  });
}

function disconnectStream(): void {
  stream?.close();
  stream = null;
}

function renderMain(): void {
  const latest = visibleSessions();
  if (!selectedSessionId || !latest.some((session) => session.id === selectedSessionId)) {
    selectedSessionId = latest[0]?.id ?? null;
  }
  const selectedSession = latest.find((session) => session.id === selectedSessionId) ?? latest[0] ?? null;
  viewRoot().innerHTML = `
    <main class="codex-shell">
      <aside class="codex-sidebar">
        <div class="sidebar-brand">
          <div>
            <strong>Local Agent Lab</strong>
            <span>PM substrate testbed</span>
          </div>
          <button class="new-chat" data-action="open-start-modal">New</button>
        </div>
        <nav class="chat-list" aria-label="Sessions">
          ${latest.map((session) => renderSessionRow(session, selectedSession?.id ?? "")).join("")}
        </nav>
        <div class="sidebar-footer">
          <button class="sidebar-button" data-action="refresh">Refresh</button>
          <button class="sidebar-button" data-action="focus-settings">Lab settings</button>
        </div>
      </aside>
      <section class="codex-workspace">
        ${renderWorkspaceHeader(selectedSession)}
        <div class="workspace-body">
          <section class="conversation-panel">
            ${renderSessionConversation(selectedSession)}
            ${renderMainComposer(selectedSession)}
          </section>
          <aside class="codex-inspector">
            <details class="settings-panel" data-panel="monitor" open>
              <summary>Substrate test evidence</summary>
              ${renderCompactSignals(latest, selectedSession)}
            </details>
          </aside>
        </div>
      </section>
      ${startModalOpen ? renderStartModal() : ""}
    </main>
  `;
  bindMain();
}

function visibleSessions(): readonly SessionSummary[] {
  return [...(sessions.length > 0 ? sessions : [previewSessionState.session])].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
}

function renderActivitySnapshot(latest: readonly SessionSummary[]): string {
  const active = latest.filter((session) => session.status === "running").length;
  const blocked = latest.reduce((sum, session) => sum + session.summaryMetrics.unsafeBlockedCount, 0);
  const admitted = latest.reduce((sum, session) => sum + session.summaryMetrics.unsafeAdmittedCount, 0);
  const diverged = latest.reduce((sum, session) => sum + session.summaryMetrics.divergenceCount, 0);
  return `
    <div class="snapshot-strip">
      ${metric("Running sessions", String(active))}
      ${metric("Unsafe blocked", String(blocked))}
      ${metric("Unsafe admitted", String(admitted))}
      ${metric("A/B diverged", String(diverged))}
    </div>
  `;
}

function renderSessionRow(session: SessionSummary, selectedId: string): string {
  const selected = session.id === selectedId;
  return `
    <button class="chat-row ${selected ? "selected" : ""}" data-action="select-session" data-session-id="${esc(session.id)}">
      <span class="chat-dot status-dot-${esc(session.status)}"></span>
      <span class="chat-row-main">
        <strong>${esc(session.title)}</strong>
        <span>${esc(session.latestActivity || session.objective)}</span>
      </span>
      <span class="chat-count">${session.summaryMetrics.divergenceCount || session.summaryMetrics.unsafeBlockedCount || ""}</span>
    </button>
  `;
}

function renderWorkspaceHeader(session: SessionSummary | null): string {
  if (!session) {
    return `
      <header class="workspace-header">
        <div>
          <h1>Start a lab session</h1>
          <p>Create an objective, choose agent count, then compare substrate behavior.</p>
        </div>
      </header>
    `;
  }
  return `
    <header class="workspace-header">
      <div>
        <h1>${esc(session.title)}</h1>
        <p>${esc(session.objective)}</p>
      </div>
      <div class="header-actions">
        <span class="status status-${esc(session.status)}">${esc(session.status)}</span>
        <button class="secondary" data-action="open" data-session-id="${esc(session.id)}">Open</button>
        <button class="danger" data-action="stop" data-session-id="${esc(session.id)}" ${session.status === "running" ? "" : "disabled"}>Stop</button>
      </div>
    </header>
  `;
}

function renderSessionConversation(session: SessionSummary | null): string {
  if (!session) {
    return `
      <div class="empty-conversation">
        <h2>No session selected</h2>
        <p>Use the settings panel to start a Local Agent Lab run.</p>
      </div>
    `;
  }
  const events = session.id === previewSessionState.session.id
    ? previewSessionState.events
    : sessionCardEvents(session).map((item, index) => ({
        id: `${session.id}:summary:${index}`,
        type: item.label,
        sessionId: session.id,
        scenarioId: session.scenarioId,
        failureClass: session.failureClass,
        occurredAt: session.updatedAt,
        message: item.message,
      }) satisfies SessionEvent);
  return `
    <div class="conversation-scroll">
      <div class="objective-card">
        <span>Objective</span>
        <p>${esc(session.objective)}</p>
      </div>
      ${events.map(renderChatEvent).join("")}
    </div>
  `;
}

function renderChatEvent(event: SessionEvent): string {
  const speaker = event.arm
    ? event.arm === "substrate"
      ? "Substrate"
      : "No substrate"
    : event.agentId
      ? agentLabel(event.agentId)
      : "Lab";
  return `
    <article class="chat-event event-${esc(event.type)}">
      <div class="avatar">${esc(speaker.slice(0, 1).toUpperCase())}</div>
      <div class="bubble">
        <div class="bubble-meta">
          <strong>${esc(speaker)}</strong>
          <span>${esc(event.type.replaceAll("_", " "))} · ${esc(time(event.occurredAt))}</span>
        </div>
        <p>${esc(event.message)}</p>
      </div>
    </article>
  `;
}

function agentLabel(agentId: string): string {
  const tail = agentId.split(":").at(-1) ?? agentId;
  if (/^\d+$/.test(tail)) return `Agent ${tail}`;
  return tail.startsWith("agent") ? tail.replace(/^agent:?/, "Agent ") : tail;
}

function renderMainComposer(session: SessionSummary | null): string {
  if (!session) return "";
  return `
    <form class="chat-composer" data-role="operator-form">
      <input type="hidden" name="sessionId" value="${esc(session.id)}" />
      <div class="composer-line">
        <textarea name="prompt" rows="1" aria-label="Prompt/task injection" placeholder="Inject a change, task, or context"></textarea>
        <button class="primary" type="submit">Send</button>
      </div>
      <details class="composer-options">
        <summary>Target, files, mutation</summary>
        <div>
          <select name="targetArm" aria-label="A/B target">
            <option value="both">both arms</option>
            <option value="substrate">substrate</option>
            <option value="no_substrate">no substrate</option>
          </select>
          <input name="fileRefs" aria-label="File refs" placeholder="optional files" />
          <input name="mutationDescription" aria-label="Mutation" placeholder="optional mutation" />
          <input type="hidden" name="mutationType" value="changed_working_condition" />
        </div>
      </details>
    </form>
  `;
}

function renderCompactSignals(
  latest: readonly SessionSummary[],
  selectedSession: SessionSummary | null,
): string {
  const session = selectedSession ?? latest[0] ?? null;
  if (!session) return `<div class="empty">No monitoring signals yet.</div>`;
  const m = session.summaryMetrics;
  return `
    <div class="evidence-summary">
      <strong>${esc(session.mode)} substrate test</strong>
      <p>${esc(session.latestActivity || "Waiting for lab events.")}</p>
    </div>
    <div class="signal-list">
      ${metric("Active agents", String(m.activeAgents))}
      ${metric("Blocked at substrate", String(m.unsafeBlockedCount))}
      ${metric("Admitted without guard", String(m.unsafeAdmittedCount))}
      ${metric("Pending injections", String(m.pendingInjections))}
      ${metric("A/B divergence", String(m.divergenceCount))}
      ${metric("Protected comparisons", String(m.substrateProtectedCount))}
    </div>
    <p class="settings-note">These signals are derived from the selected local-agent-lab session events: injection, mutation, action admitted/refused, oracle verdict, and A/B divergence. Open the session for full agent panels.</p>
  `;
}

function renderStartModal(): string {
  return `
    <div class="modal-backdrop" data-action="close-start-modal">
      <section class="start-modal" role="dialog" aria-modal="true" aria-labelledby="start-modal-title">
        <header>
          <div>
            <h2 id="start-modal-title">Start Local Agent Lab</h2>
            <p>Set the objective, agent count, and substrate mode for a new test session.</p>
          </div>
          <button class="ghost icon-button" type="button" data-action="close-start-modal" aria-label="Close start modal">Close</button>
        </header>
        ${renderStartForm()}
      </section>
    </div>
  `;
}

function renderStartForm(): string {
  return `
    <form class="start-form" data-role="start-form">
      <div class="form-title">
        <div>
          <h2>New Session</h2>
          <p>Objective, agents, mode. Keep the rest as lab settings.</p>
        </div>
      </div>
      <label>
        <span>Objective</span>
        <textarea name="objective" rows="5" required>Test whether stale private representation can become operational state.</textarea>
      </label>
      <div class="form-grid">
        <label>
          <span>Mode</span>
          <select name="mode">
            <option value="ab_pair">A/B pair</option>
            <option value="substrate">substrate</option>
            <option value="no_substrate">no substrate</option>
          </select>
        </label>
        <label>
          <span>Agents</span>
          <input name="agentCount" type="number" min="1" max="12" value="1" />
        </label>
      </div>
      <details class="advanced-settings">
        <summary>Scenario setting</summary>
        <label>
          <span>Scenario</span>
          <select name="scenarioId">
            ${scenarios.map((s) => `<option value="${esc(s.scenarioId)}">${esc(s.scenarioId)}</option>`).join("")}
          </select>
        </label>
      </details>
      <button class="primary" type="submit">Start Local Agent Lab</button>
    </form>
  `;
}

function renderInjectionConsole(
  latest: readonly SessionSummary[],
  selectedSession: SessionSummary | null,
): string {
  if (!selectedSession) {
    return `<div class="empty">Start a session before injecting drift.</div>`;
  }
  return `
    <form class="operator-form" data-role="operator-form">
      <div class="form-title">
        <div>
          <p class="kicker">Injection + Mutation</p>
          <h2>Route Change Into Session</h2>
        </div>
        <span class="status status-${esc(selectedSession.status)}">${esc(selectedSession.status)}</span>
      </div>
      <label>
        <span>Target chat/session</span>
        <select name="sessionId">
          ${latest
            .map(
              (session) =>
                `<option value="${esc(session.id)}" ${session.id === selectedSession.id ? "selected" : ""}>${esc(session.title)}</option>`,
            )
            .join("")}
        </select>
      </label>
      <div class="form-grid two">
        <label>
          <span>A/B target</span>
          <select name="targetArm">
            <option value="both">both arms</option>
            <option value="substrate">substrate only</option>
            <option value="no_substrate">no substrate only</option>
          </select>
        </label>
        <label>
          <span>Target agent</span>
          <input name="targetAgentId" placeholder="optional agent id" />
        </label>
      </div>
      <label>
        <span>Prompt/task injection</span>
        <textarea name="prompt" rows="3" placeholder="Tell the chosen session what changed or what to re-check."></textarea>
      </label>
      <label>
        <span>Attach repo files as explicit context</span>
        <input name="fileRefs" placeholder="packages/foo.ts, docs/context.md" />
      </label>
      <div class="form-grid two">
        <label>
          <span>Mutation type</span>
          <select name="mutationType">
            <option value="changed_working_condition">changed working condition</option>
            <option value="stale_state">stale state</option>
            <option value="conflicting_context">conflicting context</option>
            <option value="invalidated_assumption">invalidated assumption</option>
          </select>
        </label>
        <label>
          <span>Lab mutation intent</span>
          <input name="mutationDescription" placeholder="e.g. move observed fact after private basis" />
        </label>
      </div>
      <button class="primary" type="submit">Inject Change Into Selected Session</button>
    </form>
  `;
}

function renderSnapshotFeed(latest: readonly SessionSummary[]): string {
  const feed = sessions.length > 0 ? latest.map(sessionToSnapshotEvent) : previewSessionState.events.slice(-7);
  return `
    <div class="feed-head">
      <div>
        <p class="kicker">Live Snapshot</p>
        <h2>What changed?</h2>
      </div>
      <span>${feed.length}</span>
    </div>
    <div class="feed-list">
      ${
        feed
          .map((item) =>
            "type" in item
              ? renderEvent(item)
              : `<div class="event event-${esc(item.status)}"><span>${esc(time(item.updatedAt))}</span><strong>${esc(item.title)}</strong><p>${esc(item.latestActivity)}</p></div>`,
          )
          .join("") || `<div class="empty">No live activity yet.</div>`
      }
    </div>
  `;
}

function sessionToSnapshotEvent(session: SessionSummary): SessionSummary {
  return session;
}

function renderSessionCard(session: SessionSummary): string {
  const m = session.summaryMetrics;
  const events = sessionCardEvents(session);
  return `
    <article class="session-card" data-session-id="${esc(session.id)}">
      <header>
        <div>
          <p class="kicker">${esc(session.mode)} · ${esc(session.failureClass)}</p>
          <h3>${esc(session.title)}</h3>
        </div>
        <span class="status status-${esc(session.status)}">${esc(session.status)}</span>
      </header>
      <p class="objective">${esc(session.objective)}</p>
      <div class="metric-row">
        ${metric("Active agents", String(m.activeAgents))}
        ${metric("Pending inj.", String(m.pendingInjections))}
        ${metric("Blocked drift", String(m.unsafeBlockedCount))}
        ${metric("A/B diverged", String(m.divergenceCount))}
      </div>
      <div class="card-stream">
        ${events.map((event) => `<div><span>${esc(event.label)}</span><p>${esc(event.message)}</p></div>`).join("")}
      </div>
      <p class="activity">${esc(session.latestActivity)}</p>
      <footer>
        <button class="secondary" data-action="open" data-session-id="${esc(session.id)}">Open</button>
        <button class="secondary" data-action="prepare-injection" data-session-id="${esc(session.id)}">Inject</button>
        <button class="secondary" data-action="prepare-mutation" data-session-id="${esc(session.id)}">Mutate</button>
        <button class="danger" data-action="stop" data-session-id="${esc(session.id)}" ${session.status === "running" ? "" : "disabled"}>Stop</button>
      </footer>
    </article>
  `;
}

function sessionCardEvents(session: SessionSummary): readonly { label: string; message: string }[] {
  if (session.id === previewSessionState.session.id) {
    return previewSessionState.events.slice(-4).map((event) => ({
      label: event.type.replaceAll("_", " "),
      message: event.message,
    }));
  }
  return [
    { label: "latest activity", message: session.latestActivity },
    {
      label: "monitoring signal",
      message: `${session.summaryMetrics.unsafeBlockedCount} blocked / ${session.summaryMetrics.unsafeAdmittedCount} admitted / ${session.summaryMetrics.divergenceCount} divergences`,
    },
  ];
}

function renderDetail(): void {
  if (!detail) {
    viewRoot().innerHTML = `<main class="control-room"><div class="empty">Session not found.</div></main>`;
    return;
  }
  const { session, events, agents } = detail;
  viewRoot().innerHTML = `
    <main class="session-page">
      <header class="session-topbar">
        <button class="ghost" data-action="back">Back</button>
        <div>
          <p class="kicker">${esc(session.mode)} · ${esc(session.failureClass)}</p>
          <h1>${esc(session.title)}</h1>
          <p>${esc(session.objective)}</p>
        </div>
        <span class="status status-${esc(session.status)}">${esc(session.status)}</span>
        <button class="secondary" data-action="add-agent" data-session-id="${esc(session.id)}">Add Agent</button>
        <button class="secondary" data-action="focus-composer">Inject</button>
        <button class="secondary" data-action="focus-composer">Mutate</button>
        <button class="danger" data-action="stop" data-session-id="${esc(session.id)}" ${session.status === "running" ? "" : "disabled"}>Stop</button>
      </header>
      <section class="session-metrics">
        ${metric("Applied injections", String(session.summaryMetrics.injectionAppliedCount))}
        ${metric("Applied mutations", String(session.summaryMetrics.mutationAppliedCount))}
        ${metric("Unsafe blocked", String(session.summaryMetrics.unsafeBlockedCount))}
        ${metric("Unsafe admitted", String(session.summaryMetrics.unsafeAdmittedCount))}
        ${metric("Protected pairs", String(session.summaryMetrics.substrateProtectedCount))}
      </section>
      ${renderDetailComposer(session, agents)}
      <section class="split-workspace">
        <div class="agent-region">
          ${renderAgentPanels(session, events, agents)}
        </div>
        <aside class="timeline">
          <h2>Session Stream</h2>
          ${events.map(renderEvent).join("") || `<div class="empty">Waiting for session events.</div>`}
        </aside>
      </section>
    </main>
  `;
  bindDetail();
}

function renderDetailComposer(session: SessionSummary, agents: readonly AgentResult[]): string {
  return `
    <form class="detail-composer" data-role="operator-form">
      <input type="hidden" name="sessionId" value="${esc(session.id)}" />
      <div>
        <p class="kicker">Inject Into This Chat</p>
        <h2>Prompt, File Context, Or Lab Mutation</h2>
      </div>
      <label>
        <span>Target agent</span>
        <select name="targetAgentId">
          <option value="">session level</option>
          ${agents.map((agent) => `<option value="${esc(agent.agentId)}">${esc(agent.label)}</option>`).join("")}
        </select>
      </label>
      <label>
        <span>A/B target</span>
        <select name="targetArm">
          <option value="both">both arms</option>
          <option value="substrate">substrate only</option>
          <option value="no_substrate">no substrate only</option>
        </select>
      </label>
      <label class="composer-wide">
        <span>Injected request</span>
        <input name="prompt" placeholder="Ask the agent to re-check against changed context or objective drift" />
      </label>
      <label>
        <span>File refs</span>
        <input name="fileRefs" placeholder="optional file paths" />
      </label>
      <label>
        <span>Mutation</span>
        <input name="mutationDescription" placeholder="optional constrained lab mutation" />
      </label>
      <input type="hidden" name="mutationType" value="changed_working_condition" />
      <button class="primary" type="submit">Inject</button>
    </form>
  `;
}

function renderAgentPanels(
  session: SessionSummary,
  events: readonly SessionEvent[],
  agents: readonly AgentResult[],
): string {
  const knownAgents =
    agents.length > 0
      ? agents
      : Array.from(new Set(events.map((event) => event.agentId).filter(Boolean))).map(
          (agentId) =>
            ({
              agentId: agentId as string,
              label: `Agent ${(agentId as string).split(":").at(-1) ?? "?"}`,
              arms: {},
              behaviorDiverged: false,
            }) satisfies AgentResult,
        );
  if (knownAgents.length === 0) {
    return `<div class="empty">Agent panels appear when the run starts.</div>`;
  }
  return knownAgents.map((agent) => renderAgentPanel(session, events, agent)).join("");
}

function renderAgentPanel(
  session: SessionSummary,
  events: readonly SessionEvent[],
  agent: AgentResult,
): string {
  const agentEvents = events.filter((event) => event.agentId === agent.agentId);
  const arms: Arm[] = session.mode === "ab_pair" ? ["no_substrate", "substrate"] : [session.mode as Arm];
  return `
    <details class="agent-panel" open>
      <summary>
        <div>
          <h2>${esc(agent.label)}</h2>
          <p>${agent.behaviorDiverged ? "Arms diverged after mutation" : "Watching admission boundary"}</p>
        </div>
        <button class="danger" data-action="stop-agent" data-agent-id="${esc(agent.agentId)}">Stop Agent</button>
      </summary>
      <div class="arm-grid">
        ${arms.map((arm) => renderArm(agent, agentEvents, arm)).join("")}
      </div>
    </details>
  `;
}

function renderArm(
  agent: AgentResult,
  events: readonly SessionEvent[],
  arm: Arm,
): string {
  const run = agent.arms[arm];
  const armEvents = events.filter((event) => event.arm === arm);
  return `
    <section class="arm-panel arm-${arm}">
      <header>
        <span>${arm === "no_substrate" ? "No substrate" : "Substrate"}</span>
        <strong>${esc(run?.result ?? "running")}</strong>
      </header>
      <p class="current-task">${arm === "substrate" ? "Current task: resolve against admitted head before action." : "Current task: act from private representation without admission gate."}</p>
      <p class="drift-state">${run?.result === "blocked" ? "Drift state: blocked at admission boundary" : run?.result === "fail" ? "Drift state: stale action became operational" : "Drift state: observing"}</p>
      <div class="arm-facts">
        ${metric("Admitted", run ? String(run.admitted) : "pending")}
        ${metric("Transitions", run ? String(run.admittedTransitions) : "-")}
        ${metric("Tokens", run ? String(run.tokens) : "-")}
      </div>
      ${run?.refusedReason ? `<p class="refusal">${esc(run.refusedReason)}</p>` : ""}
      <div class="arm-stream">
        ${armEvents.map(renderEvent).join("") || `<p class="quiet">No arm events yet.</p>`}
      </div>
    </section>
  `;
}

function renderEvent(event: SessionEvent): string {
  return `
    <div class="event event-${esc(event.type)}">
      <span>${esc(time(event.occurredAt))}</span>
      <strong>${esc(event.type.replaceAll("_", " "))}</strong>
      <p>${esc(event.message)}</p>
    </div>
  `;
}

function metric(label: string, value: string): string {
  return `<div class="metric"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`;
}

function bindMain(): void {
  appRoot.querySelector<HTMLFormElement>("[data-role='start-form']")?.addEventListener("submit", (event) => {
    event.preventDefault();
    void startSession(new FormData(event.currentTarget as HTMLFormElement));
  });
  appRoot.querySelector<HTMLFormElement>("[data-role='operator-form']")?.addEventListener("submit", (event) => {
    event.preventDefault();
    void submitOperatorChange(new FormData(event.currentTarget as HTMLFormElement));
  });
  appRoot.querySelector<HTMLSelectElement>("[data-role='operator-form'] select[name='sessionId']")?.addEventListener("change", (event) => {
    selectedSessionId = (event.currentTarget as HTMLSelectElement).value;
    renderMain();
  });
  appRoot.querySelector("[data-action='refresh']")?.addEventListener("click", () => {
    void loadSessions().then(renderMain);
  });
  appRoot.querySelectorAll<HTMLButtonElement>("[data-action='select-session']").forEach((button) => {
    button.addEventListener("click", () => {
      selectedSessionId = button.dataset.sessionId ?? selectedSessionId;
      renderMain();
    });
  });
  appRoot.querySelector("[data-action='open-start-modal']")?.addEventListener("click", () => {
    startModalOpen = true;
    renderMain();
    window.requestAnimationFrame(() => {
      appRoot.querySelector<HTMLTextAreaElement>(".start-modal textarea[name='objective']")?.focus();
    });
  });
  appRoot.querySelectorAll<HTMLElement>("[data-action='close-start-modal']").forEach((element) => {
    element.addEventListener("click", (event) => {
      if (event.target !== element && element.classList.contains("modal-backdrop")) return;
      startModalOpen = false;
      renderMain();
    });
  });
  appRoot.querySelector("[data-action='focus-settings']")?.addEventListener("click", () => {
    appRoot.querySelector<HTMLDetailsElement>("[data-panel='monitor']")?.setAttribute("open", "");
    appRoot.querySelector<HTMLElement>("[data-panel='monitor']")?.scrollIntoView({ block: "nearest" });
  });
  appRoot.querySelectorAll<HTMLButtonElement>("[data-action='open']").forEach((button) => {
    button.addEventListener("click", () => openSession(button.dataset.sessionId ?? ""));
  });
  appRoot.querySelectorAll<HTMLButtonElement>("[data-action='prepare-injection'], [data-action='prepare-mutation']").forEach((button) => {
    button.addEventListener("click", () => {
      selectedSessionId = button.dataset.sessionId ?? selectedSessionId;
      renderMain();
      window.requestAnimationFrame(() => {
        appRoot.querySelector<HTMLElement>(".operator-console textarea, .operator-console input")?.focus();
      });
    });
  });
  appRoot.querySelectorAll<HTMLButtonElement>("[data-action='stop']").forEach((button) => {
    button.addEventListener("click", () => void stopSession(button.dataset.sessionId ?? ""));
  });
}

function bindDetail(): void {
  appRoot.querySelector("[data-action='back']")?.addEventListener("click", () => {
    history.pushState(null, "", "/");
    void route();
  });
  appRoot.querySelector<HTMLFormElement>("[data-role='operator-form']")?.addEventListener("submit", (event) => {
    event.preventDefault();
    void submitOperatorChange(new FormData(event.currentTarget as HTMLFormElement));
  });
  appRoot.querySelectorAll<HTMLButtonElement>("[data-action='focus-composer']").forEach((button) => {
    button.addEventListener("click", () => {
      appRoot.querySelector<HTMLElement>(".detail-composer input[name='prompt']")?.focus();
    });
  });
  appRoot.querySelectorAll<HTMLButtonElement>("[data-action='add-agent']").forEach((button) => {
    button.addEventListener("click", () => void addAgent(button.dataset.sessionId ?? ""));
  });
  appRoot.querySelectorAll<HTMLButtonElement>("[data-action='stop']").forEach((button) => {
    button.addEventListener("click", () => void stopSession(button.dataset.sessionId ?? ""));
  });
  appRoot.querySelectorAll<HTMLButtonElement>("[data-action='stop-agent']").forEach((button) => {
    button.addEventListener("click", () => void stopAgent(button.dataset.agentId ?? ""));
  });
}

async function startSession(form: FormData): Promise<void> {
  const fileRefs = String(form.get("fileRefs") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const injectionPrompt = String(form.get("injectionPrompt") ?? "").trim();
  const mutationDescription = String(form.get("mutationDescription") ?? "").trim();
  const injections =
    injectionPrompt || fileRefs.length > 0
      ? [
          {
            id: `inj_${Date.now()}`,
            type: fileRefs.length > 0 ? "file_context" : "prompt_task",
            prompt: injectionPrompt,
            fileRefs,
          },
        ]
      : [];
  const mutations = mutationDescription
    ? [
        {
          id: `mut_${Date.now()}`,
          type: "changed_working_condition",
          description: mutationDescription,
        },
      ]
    : [];
  const res = await fetch("/api/sessions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      objective: String(form.get("objective") ?? ""),
      scenarioId: String(form.get("scenarioId") ?? ""),
      mode: String(form.get("mode") ?? "ab_pair"),
      agentCount: Number(form.get("agentCount") ?? 1),
      injections,
      mutations,
    }),
  });
  const body = (await res.json()) as { session?: SessionSummary; error?: string };
  if (!res.ok || !body.session) {
    window.alert(body.error ?? "Could not start session.");
    return;
  }
  sessions = [body.session, ...sessions.filter((session) => session.id !== body.session?.id)];
  startModalOpen = false;
  openSession(body.session.id);
}

async function submitOperatorChange(form: FormData): Promise<void> {
  const sessionId = String(form.get("sessionId") ?? selectedSessionId ?? "").trim();
  if (!sessionId) return;
  const targetAgentId = String(form.get("targetAgentId") ?? "").trim();
  const payload = {
    prompt: String(form.get("prompt") ?? "").trim(),
    fileRefs: String(form.get("fileRefs") ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    targetArm: String(form.get("targetArm") ?? "both"),
    mutationType: String(form.get("mutationType") ?? "changed_working_condition"),
    mutationDescription: String(form.get("mutationDescription") ?? "").trim(),
    ...(targetAgentId ? { targetAgentId } : {}),
  };

  if (sessionId === previewSessionState.session.id) {
    appendPreviewOperatorEvents(payload);
    if (currentSessionId() === sessionId) {
      detail = previewSessionState;
      renderDetail();
    } else {
      renderMain();
    }
    return;
  }

  const res = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/injections`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = (await res.json()) as { session?: SessionSummary; error?: string };
  if (!res.ok) {
    window.alert(body.error ?? "Could not inject change.");
    return;
  }
  await loadSessions();
  if (currentSessionId() === sessionId) {
    await loadDetail(sessionId);
    renderDetail();
  } else {
    renderMain();
  }
}

async function stopSession(id: string): Promise<void> {
  if (!id) return;
  if (id === previewSessionState.session.id) {
    appendPreviewEvent("session_stopped", "Operator requested preview session stop.");
    previewSessionState = {
      ...previewSessionState,
      session: {
        ...previewSessionState.session,
        status: "stopped",
        summaryMetrics: { ...previewSessionState.session.summaryMetrics, activeAgents: 0 },
      },
    };
    currentSessionId() ? renderDetail() : renderMain();
    return;
  }
  await fetch(`/api/sessions/${encodeURIComponent(id)}/stop`, { method: "POST" });
  await loadSessions();
  if (currentSessionId() === id) await loadDetail(id);
  currentSessionId() ? renderDetail() : renderMain();
}

async function addAgent(id: string): Promise<void> {
  if (!id) return;
  if (id === previewSessionState.session.id) {
    const nextAgentNumber = previewSessionState.agents.length + 1;
    const agentId = `${id}:agent:${nextAgentNumber}`;
    previewSessionState = {
      ...previewSessionState,
      session: {
        ...previewSessionState.session,
        agentCount: nextAgentNumber,
        summaryMetrics: {
          ...previewSessionState.session.summaryMetrics,
          activeAgents: previewSessionState.session.summaryMetrics.activeAgents + 1,
        },
      },
      agents: [
        ...previewSessionState.agents,
        {
          agentId,
          label: `Agent ${nextAgentNumber}`,
          arms: {},
          behaviorDiverged: false,
        },
      ],
    };
    appendPreviewEvent("agent_started", `Operator added Agent ${nextAgentNumber}.`, agentId);
    detail = previewSessionState;
    renderDetail();
    return;
  }
  const res = await fetch(`/api/sessions/${encodeURIComponent(id)}/agents`, { method: "POST" });
  const body = (await res.json()) as { error?: string };
  if (!res.ok) {
    window.alert(body.error ?? "Could not add agent.");
    return;
  }
  await loadSessions();
  if (currentSessionId() === id) {
    await loadDetail(id);
    renderDetail();
  }
}

async function stopAgent(id: string): Promise<void> {
  if (!id) return;
  if (id.startsWith(`${previewSessionState.session.id}:agent:`)) {
    appendPreviewEvent("agent_stopped", `Operator requested stop for ${id}.`, id);
    if (detail?.session.id === previewSessionState.session.id) {
      detail = previewSessionState;
      renderDetail();
    }
    return;
  }
  await fetch(`/api/agents/${encodeURIComponent(id)}/stop`, { method: "POST" });
  const sessionId = currentSessionId();
  if (sessionId) {
    await loadDetail(sessionId);
    renderDetail();
  }
}

function appendPreviewOperatorEvents(payload: {
  readonly prompt: string;
  readonly fileRefs: readonly string[];
  readonly targetAgentId?: string;
  readonly targetArm: string;
  readonly mutationType: string;
  readonly mutationDescription: string;
}): void {
  if (payload.prompt || payload.fileRefs.length > 0) {
    appendPreviewEvent(
      "injection_created",
      "Operator queued a prompt/file-context injection.",
      payload.targetAgentId,
      undefined,
      payload,
    );
    appendPreviewEvent(
      "injection_applied",
      "Operator injection entered the preview session stream.",
      payload.targetAgentId,
      undefined,
      payload,
    );
  }
  if (payload.mutationDescription) {
    appendPreviewEvent(
      "mutation_created",
      "Operator queued a constrained lab mutation.",
      payload.targetAgentId,
      undefined,
      payload,
    );
    appendPreviewEvent(
      "mutation_applied",
      "Operator lab mutation was applied to the preview session.",
      payload.targetAgentId,
      undefined,
      payload,
    );
  }
}

function appendPreviewEvent(
  type: string,
  message: string,
  agentId?: string,
  arm?: Arm,
  payload?: Record<string, unknown>,
): void {
  const event: SessionEvent = {
    id: `preview-${type}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type,
    sessionId: previewSessionState.session.id,
    scenarioId: previewSessionState.session.scenarioId,
    failureClass: previewSessionState.session.failureClass,
    occurredAt: new Date().toISOString(),
    message,
    ...(agentId ? { agentId } : {}),
    ...(arm ? { arm } : {}),
    ...(payload ? { payload } : {}),
  };
  const metrics = { ...previewSessionState.session.summaryMetrics };
  if (type === "injection_created") metrics.pendingInjections += 1;
  if (type === "injection_applied") {
    metrics.injectionAppliedCount += 1;
    metrics.pendingInjections = Math.max(0, metrics.pendingInjections - 1);
  }
  if (type === "mutation_created") metrics.pendingMutations += 1;
  if (type === "mutation_applied") {
    metrics.mutationAppliedCount += 1;
    metrics.pendingMutations = Math.max(0, metrics.pendingMutations - 1);
  }
  if (type === "agent_stopped") metrics.activeAgents = Math.max(0, metrics.activeAgents - 1);
  previewSessionState = {
    ...previewSessionState,
    session: {
      ...previewSessionState.session,
      updatedAt: event.occurredAt,
      latestActivity: event.message,
      summaryMetrics: metrics,
    },
    events: [...previewSessionState.events, event],
  };
}

function openSession(id: string): void {
  if (!id) return;
  history.pushState(null, "", `/sessions/${id}`);
  void route();
}

function time(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function esc(value: unknown): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
