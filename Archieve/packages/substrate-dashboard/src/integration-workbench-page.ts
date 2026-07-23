/**
 * Integration Workbench (D5-D) — the human adoption surface for zero-rewrite
 * app onboarding. Config-first lane: paste/edit a mapping JSON, validate,
 * propose, approve/reject by hash. Liquid-assisted lane: operator choices +
 * discovered fields become a PENDING proposal (origin liquid_discovery).
 * Sync is preview-only (dry run); all state shown here is a fold over the
 * admitted log served by the dashboard server's workbench API.
 */

export interface WorkbenchValidationIssue {
  readonly path: string;
  readonly message: string;
}

export interface WorkbenchPendingProposal {
  readonly mappingHash: string;
  readonly origin: string;
  readonly proposedBy: string;
  readonly proposedAt: string;
  readonly reason?: string | null;
}

export interface WorkbenchSyncPreview {
  readonly dryRun: boolean;
  readonly mappingApproved?: boolean;
  readonly created: number;
  readonly updated: number;
  readonly unchanged: number;
  readonly rejected: readonly {
    readonly sourceName: string;
    readonly externalId: string;
    readonly reason: string;
  }[];
}

export interface IntegrationWorkbenchState {
  readonly appName: string;
  readonly approvedHash?: string | null;
  readonly pending: readonly WorkbenchPendingProposal[];
  readonly validation: {
    readonly valid: boolean;
    readonly issues: readonly WorkbenchValidationIssue[];
  } | null;
  readonly draftText: string;
  readonly preview: WorkbenchSyncPreview | null;
  readonly notice?: string | null;
  readonly error?: string | null;
}

type WorkbenchTab = "mapping" | "sync" | "state" | "liquid";

const TIER1_PRIMITIVES = [
  "Counterparty",
  "Engagement",
  "Transaction",
  "Resource",
  "Communication",
  "Document",
  "Event",
] as const;

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderValidation(state: IntegrationWorkbenchState): string {
  if (!state.validation) return "";
  if (state.validation.valid) {
    return `<div class="workbench-feedback workbench-feedback-ok"><strong>Mapping is valid.</strong><span>Ready to propose as a pending admitted-log event.</span></div>`;
  }
  return `
    <div class="workbench-feedback workbench-feedback-error">
      <strong>Validation issues</strong>
      <ul class="workbench-issues">
      ${state.validation.issues
        .map(
          (issue) =>
            `<li><code>${escapeHtml(issue.path || "/")}</code> ${escapeHtml(issue.message)}</li>`,
        )
        .join("")}
      </ul>
    </div>`;
}

function shortHash(value: string): string {
  if (value.length <= 18) return value;
  return `${value.slice(0, 12)}...${value.slice(-6)}`;
}

function renderHash(value: string | null | undefined): string {
  if (!value) return `<span class="workbench-empty-value">none</span>`;
  return `<code class="workbench-hash" title="${escapeHtml(value)}">${escapeHtml(shortHash(value))}</code>`;
}

function validationState(state: IntegrationWorkbenchState): { label: string; tone: string } {
  if (!state.validation) return { label: "not run", tone: "neutral" };
  return state.validation.valid
    ? { label: "valid", tone: "good" }
    : { label: `${state.validation.issues.length} issue${state.validation.issues.length === 1 ? "" : "s"}`, tone: "bad" };
}

function previewState(state: IntegrationWorkbenchState): { label: string; tone: string } {
  if (!state.preview) return { label: "not run", tone: "neutral" };
  if (state.preview.mappingApproved === false) return { label: "would refuse", tone: "bad" };
  return { label: "dry-run ready", tone: "good" };
}

function statusTile(label: string, value: string, meta: string, tone = "neutral"): string {
  return `
    <div class="workbench-status workbench-status-${tone}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <small>${escapeHtml(meta)}</small>
    </div>`;
}

function workbenchTab(activeTab: WorkbenchTab, value: WorkbenchTab, label: string): string {
  const active = activeTab === value;
  return `<button class="page-tab ${active ? "active" : ""}" type="button" data-workbench-tab="${value}" aria-selected="${active ? "true" : "false"}">${label}</button>`;
}

function renderPending(state: IntegrationWorkbenchState): string {
  if (state.pending.length === 0) return `<p class="workbench-empty">No pending mapping proposals.</p>`;
  return state.pending
    .map(
      (p) => `
      <article class="pending-proposal" data-hash="${escapeHtml(p.mappingHash)}">
        <div>
          ${renderHash(p.mappingHash)}
          <span class="proposal-origin">${escapeHtml(p.origin)}</span>
        </div>
        <span class="proposal-meta">${escapeHtml(p.proposedBy)} · ${escapeHtml(p.proposedAt)}</span>
        ${p.reason ? `<p>${escapeHtml(p.reason)}</p>` : ""}
        <div class="proposal-actions">
          <button type="button" class="workbench-button-primary" data-action="approve" data-hash="${escapeHtml(p.mappingHash)}">Approve</button>
          <button type="button" class="workbench-button-danger" data-action="reject" data-hash="${escapeHtml(p.mappingHash)}">Reject</button>
        </div>
      </article>`,
    )
    .join("");
}

function renderPreview(state: IntegrationWorkbenchState): string {
  if (!state.preview) return "";
  const p = state.preview;
  const verdict =
    p.mappingApproved === false
      ? `<p class="workbench-refused">A real sync would be REFUSED — this mapping hash is not the approved one.</p>`
      : `<p class="workbench-ok">Approved mapping — a real sync would be admitted.</p>`;
  return `
    <div class="sync-preview">
      <h3>Dry-run result</h3>
      ${verdict}
      <div class="preview-metrics">
        <span>created ${p.created}</span>
        <span>updated ${p.updated}</span>
        <span>unchanged ${p.unchanged}</span>
        <span>rejected ${p.rejected.length}</span>
      </div>
      ${
        p.rejected.length > 0
          ? `<ul class="workbench-issues">${p.rejected
              .map(
                (r) =>
                  `<li><code>${escapeHtml(r.sourceName)}:${escapeHtml(r.externalId)}</code> ${escapeHtml(r.reason)}</li>`,
              )
              .join("")}</ul>`
          : ""
      }
    </div>`;
}

export function renderIntegrationWorkbenchHtml(
  state: IntegrationWorkbenchState,
  activeTab: WorkbenchTab = "mapping",
): string {
  const validation = validationState(state);
  const preview = previewState(state);
  return `
    <section class="integration-workbench">
      <header class="workbench-page-header">
        <div>
          <p class="workbench-eyebrow">D5-D Integration Kit</p>
          <h1>Integration Workbench</h1>
          <p>Map an external app into the seven primitives, admit the mapping hash, and preview sync effects before anything attaches.</p>
        </div>
        <div class="workbench-guardrails" aria-label="Guardrails">
          <span>admitted log</span>
          <span>human approval</span>
          <span>dry-run sync</span>
        </div>
      </header>

      <div class="workbench-alerts">
        ${state.error ? `<p class="workbench-error">${escapeHtml(state.error)}</p>` : ""}
        ${state.notice ? `<p class="workbench-notice">${escapeHtml(state.notice)}</p>` : ""}
      </div>

      <div class="workbench-status-strip">
        ${statusTile("App", state.appName, "current draft target")}
        ${statusTile("Approved hash", state.approvedHash ? shortHash(state.approvedHash) : "none", "sync gate")}
        ${statusTile("Pending", String(state.pending.length), "mapping proposals", state.pending.length > 0 ? "warn" : "neutral")}
        ${statusTile("Validation", validation.label, "draft mapping", validation.tone)}
        ${statusTile("Preview", preview.label, "dry run only", preview.tone)}
      </div>

      <nav class="page-tabs workbench-tabs" aria-label="Integration workbench sections">
        ${workbenchTab(activeTab, "mapping", "Mapping")}
        ${workbenchTab(activeTab, "sync", "Dry-run sync")}
        ${workbenchTab(activeTab, "state", "Admitted state")}
        ${workbenchTab(activeTab, "liquid", "Liquid proposal")}
      </nav>

      <div class="workbench-tab-panels">
        <section class="workbench-tab-panel ${activeTab === "mapping" ? "active" : ""}" data-workbench-panel="mapping" ${activeTab === "mapping" ? "" : "hidden"}>
          <form class="workbench-panel mapping-draft-panel" data-role="mapping-form">
            <div class="workbench-panel-header">
              <div>
                <p class="workbench-kicker">Config path</p>
                <h2>Mapping draft</h2>
              </div>
              <span class="workbench-panel-badge">validate -> propose</span>
            </div>
            <div class="mapping-controls">
              <label><span>App name</span><input name="appName" value="${escapeHtml(state.appName)}" /></label>
            </div>
            <label class="editor"><span>Mapping JSON</span><textarea name="mapping" rows="18" spellcheck="false">${escapeHtml(state.draftText)}</textarea></label>
            <div class="workbench-actions">
              <button type="submit" name="intent" value="validate">Validate</button>
              <button type="submit" class="workbench-button-primary" name="intent" value="propose">Propose mapping</button>
            </div>
            ${renderValidation(state)}
          </form>
        </section>

        <section class="workbench-tab-panel ${activeTab === "sync" ? "active" : ""}" data-workbench-panel="sync" ${activeTab === "sync" ? "" : "hidden"}>
          <form class="workbench-panel sync-panel" data-role="mapping-form">
            <div class="workbench-panel-header">
              <div>
                <p class="workbench-kicker">Sync rehearsal</p>
                <h2>Dry-run preview</h2>
              </div>
              <span class="workbench-panel-badge">writes disabled</span>
            </div>
            <div class="sync-grid">
              <label><span>Source URL / DSN</span><input name="url" /></label>
              <label><span>Source entity</span><input name="sourceName" /></label>
              <label><span>External id field</span><input name="externalIdField" /></label>
            </div>
            <input type="hidden" name="appName" value="${escapeHtml(state.appName)}" />
            <textarea class="workbench-hidden-draft" name="mapping">${escapeHtml(state.draftText)}</textarea>
            <button type="submit" class="workbench-button-primary" name="intent" value="preview">Preview sync</button>
            ${renderPreview(state)}
          </form>
        </section>

        <section class="workbench-tab-panel ${activeTab === "state" ? "active" : ""}" data-workbench-panel="state" ${activeTab === "state" ? "" : "hidden"}>
          <section class="workbench-panel mapping-state">
            <div class="workbench-panel-header">
              <div>
                <p class="workbench-kicker">Admitted state</p>
                <h2>Mapping approvals</h2>
              </div>
            </div>
            <div class="approved-summary">
              <span>Approved mapping</span>
              ${renderHash(state.approvedHash)}
            </div>
            <div class="pending-list">
              <h3>Pending proposals</h3>
              ${renderPending(state)}
            </div>
          </section>
        </section>

        <section class="workbench-tab-panel ${activeTab === "liquid" ? "active" : ""}" data-workbench-panel="liquid" ${activeTab === "liquid" ? "" : "hidden"}>
          <form class="workbench-panel liquid-panel" data-role="liquid-form">
            <div class="workbench-panel-header">
              <div>
                <p class="workbench-kicker">No-config start</p>
                <h2>Liquid-assisted proposal</h2>
              </div>
              <span class="workbench-panel-badge">proposal only</span>
            </div>
            <div class="liquid-grid">
              <label><span>Source URL / DSN</span><input name="url" /></label>
              <label><span>Source entity name</span><input name="sourceName" /></label>
              <label><span>External id field</span><input name="externalIdField" /></label>
              <label><span>Tier-1 primitive</span>
                <select name="tier1">
                  ${TIER1_PRIMITIVES.map((t) => `<option value="${t}">${t}</option>`).join("")}
                </select>
              </label>
              <label><span>Fields from discovery</span><input name="fields" placeholder="id, name, email" /></label>
            </div>
            <button type="submit" class="workbench-button-primary">Create pending mapping</button>
          </form>
        </section>
      </div>
    </section>`;
}

const DEFAULT_DRAFT = JSON.stringify(
  {
    profile: null,
    mappingVersion: 1,
    entities: {
      Customer: {
        tier1: "Counterparty",
        concrete: "Counterparty",
        identityFields: ["name"],
        schemaVersion: 1,
      },
    },
  },
  null,
  2,
);

interface MappingStateResponse {
  readonly ok: boolean;
  readonly error?: string;
  readonly approvedHash?: string | null;
  readonly pending?: readonly WorkbenchPendingProposal[];
}

async function fetchJson(
  path: string,
  init?: RequestInit,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await fetch(path, init);
  const body = (await res.json()) as Record<string, unknown>;
  return { status: res.status, body };
}

async function postJson(
  path: string,
  payload: unknown,
): Promise<{ status: number; body: Record<string, unknown> }> {
  return fetchJson(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function mountIntegrationWorkbench(root: HTMLElement): Promise<void> {
  let activeTab: WorkbenchTab = "mapping";
  let state: IntegrationWorkbenchState = {
    appName: "orbit",
    approvedHash: null,
    pending: [],
    validation: null,
    draftText: DEFAULT_DRAFT,
    preview: null,
  };

  const refreshMappingState = async (): Promise<void> => {
    const { status, body } = await fetchJson(
      `/api/integrations/${encodeURIComponent(state.appName)}/mappings`,
    );
    const parsed = body as unknown as MappingStateResponse;
    if (status !== 200 || !parsed.ok) {
      state = { ...state, error: String(parsed.error ?? `mapping state failed (${status})`) };
      return;
    }
    state = {
      ...state,
      approvedHash: parsed.approvedHash ?? null,
      pending: parsed.pending ?? [],
      error: null,
    };
  };

  const parseDraft = (): unknown | undefined => {
    try {
      return JSON.parse(state.draftText) as unknown;
    } catch (err) {
      state = { ...state, error: `mapping JSON does not parse: ${String(err)}` };
      return undefined;
    }
  };

  const render = (): void => {
    root.innerHTML = renderIntegrationWorkbenchHtml(state, activeTab);
    bind();
  };

  const readMappingForm = (form: HTMLFormElement): FormData => {
    const data = new FormData(form);
    const appName = String(data.get("appName") ?? "").trim() || state.appName;
    state = { ...state, appName, draftText: String(data.get("mapping") ?? state.draftText) };
    return data;
  };

  const bind = (): void => {
    for (const button of root.querySelectorAll<HTMLButtonElement>("[data-workbench-tab]")) {
      button.addEventListener("click", () => {
        const tab = button.dataset["workbenchTab"];
        if (tab === "mapping" || tab === "sync" || tab === "state" || tab === "liquid") {
          activeTab = tab;
          render();
        }
      });
    }

    const mappingForms = root.querySelectorAll<HTMLFormElement>('form[data-role="mapping-form"]');
    for (const mappingForm of mappingForms) {
      mappingForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const submitter = (event as SubmitEvent).submitter as HTMLButtonElement | null;
        const intent = submitter?.value ?? "validate";
        const data = readMappingForm(mappingForm);
        void (async () => {
          const mapping = parseDraft();
          if (mapping === undefined) {
            render();
            return;
          }
          if (intent === "validate") {
            const { body } = await postJson(
              `/api/integrations/${encodeURIComponent(state.appName)}/mappings/validate`,
              { mapping },
            );
            state = {
              ...state,
              validation: body["validation"] as IntegrationWorkbenchState["validation"],
              notice: null,
              error: null,
            };
          } else if (intent === "propose") {
            const { status, body } = await postJson(
              `/api/integrations/${encodeURIComponent(state.appName)}/mappings/propose`,
              { mapping, origin: "manual" },
            );
            if (status === 200) {
              state = {
                ...state,
                notice: `Proposed ${String(body["mappingHash"])} (pending approval).`,
                error: null,
              };
              await refreshMappingState();
            } else {
              state = { ...state, error: String(body["error"] ?? `propose failed (${status})`) };
            }
          } else if (intent === "preview") {
            const { status, body } = await postJson(
              `/api/integrations/${encodeURIComponent(state.appName)}/sync/preview`,
              {
                mapping,
                url: String(data.get("url") ?? ""),
                sourceName: String(data.get("sourceName") ?? ""),
                externalIdField: String(data.get("externalIdField") ?? ""),
              },
            );
            if (status === 200) {
              state = {
                ...state,
                preview: body as unknown as WorkbenchSyncPreview,
                notice: null,
                error: null,
              };
            } else {
              state = { ...state, error: String(body["error"] ?? `preview failed (${status})`) };
            }
          }
          render();
        })();
      });
    }

    for (const button of root.querySelectorAll<HTMLButtonElement>("button[data-action]")) {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        const action = button.dataset["action"];
        const hash = button.dataset["hash"];
        if (!hash || (action !== "approve" && action !== "reject")) return;
        void (async () => {
          const { status, body } = await postJson(
            `/api/integrations/${encodeURIComponent(state.appName)}/mappings/${encodeURIComponent(hash)}/${action}`,
            {},
          );
          if (status === 200) {
            state = {
              ...state,
              approvedHash: (body["approvedHash"] as string | null) ?? null,
              pending: (body["pending"] as WorkbenchPendingProposal[]) ?? [],
              notice: `${action === "approve" ? "Approved" : "Rejected"} ${hash}.`,
              error: null,
            };
          } else {
            state = { ...state, error: String(body["error"] ?? `${action} failed (${status})`) };
          }
          render();
        })();
      });
    }

    const liquidForm = root.querySelector<HTMLFormElement>('form[data-role="liquid-form"]');
    liquidForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(liquidForm);
      void (async () => {
        const { status, body } = await postJson("/api/integrations/liquid/discover", {
          appName: state.appName,
          url: String(data.get("url") ?? ""),
          sourceName: String(data.get("sourceName") ?? ""),
          externalIdField: String(data.get("externalIdField") ?? ""),
          tier1: String(data.get("tier1") ?? ""),
          fields: String(data.get("fields") ?? "")
            .split(",")
            .map((f) => f.trim())
            .filter(Boolean),
        });
        if (status === 200) {
          state = {
            ...state,
            notice: `Liquid-assisted proposal ${String(body["mappingHash"])} is pending approval.`,
            error: null,
          };
          await refreshMappingState();
        } else {
          state = { ...state, error: String(body["error"] ?? `discovery failed (${status})`) };
        }
        render();
      })();
    });
  };

  await refreshMappingState();
  render();
}
