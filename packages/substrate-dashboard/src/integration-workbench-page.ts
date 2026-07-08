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
    return `<p class="workbench-ok">Mapping is valid.</p>`;
  }
  return `
    <ul class="workbench-issues">
      ${state.validation.issues
        .map(
          (issue) =>
            `<li><code>${escapeHtml(issue.path || "/")}</code> ${escapeHtml(issue.message)}</li>`,
        )
        .join("")}
    </ul>`;
}

function renderPending(state: IntegrationWorkbenchState): string {
  if (state.pending.length === 0) return `<p class="workbench-empty">none</p>`;
  return state.pending
    .map(
      (p) => `
      <article class="pending-proposal" data-hash="${escapeHtml(p.mappingHash)}">
        <strong>${escapeHtml(p.mappingHash)}</strong>
        <span class="proposal-origin">${escapeHtml(p.origin)}</span>
        <span>${escapeHtml(p.proposedBy)} · ${escapeHtml(p.proposedAt)}</span>
        ${p.reason ? `<p>${escapeHtml(p.reason)}</p>` : ""}
        <div class="proposal-actions">
          <button data-action="approve" data-hash="${escapeHtml(p.mappingHash)}">Approve</button>
          <button data-action="reject" data-hash="${escapeHtml(p.mappingHash)}">Reject</button>
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
      <p>created ${p.created} · updated ${p.updated} · unchanged ${p.unchanged} · rejected ${p.rejected.length}</p>
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

export function renderIntegrationWorkbenchHtml(state: IntegrationWorkbenchState): string {
  return `
    <section class="integration-workbench">
      <header>
        <h1>Integration Workbench</h1>
        <p>Map an external app into the seven primitives, then approve the mapping before sync. Nothing syncs from an unapproved mapping; Liquid never writes directly.</p>
      </header>
      ${state.error ? `<p class="workbench-error">${escapeHtml(state.error)}</p>` : ""}
      ${state.notice ? `<p class="workbench-notice">${escapeHtml(state.notice)}</p>` : ""}
      <div class="workbench-columns">
        <form data-role="mapping-form">
          <h2>Config-first mapping</h2>
          <label><span>App name</span><input name="appName" value="${escapeHtml(state.appName)}" /></label>
          <label class="editor"><span>Mapping JSON</span><textarea name="mapping" rows="18">${escapeHtml(state.draftText)}</textarea></label>
          <div class="workbench-actions">
            <button type="submit" name="intent" value="validate">Validate</button>
            <button type="submit" name="intent" value="propose">Propose mapping</button>
          </div>
          ${renderValidation(state)}
          <h3>Dry-run sync preview</h3>
          <label><span>Source URL / DSN</span><input name="url" /></label>
          <label><span>Source entity</span><input name="sourceName" /></label>
          <label><span>External id field</span><input name="externalIdField" /></label>
          <button type="submit" name="intent" value="preview">Preview sync (dry run)</button>
          ${renderPreview(state)}
        </form>
        <aside class="mapping-state">
          <h2>Approved mapping</h2>
          <p class="approved-hash">${state.approvedHash ? escapeHtml(state.approvedHash) : "none"}</p>
          <h2>Pending proposals</h2>
          ${renderPending(state)}
          <form data-role="liquid-form">
            <h2>Liquid-assisted (no config)</h2>
            <p>Liquid inspects the source; you choose what it means. The result is a pending proposal — never an approval.</p>
            <label><span>Source URL / DSN</span><input name="url" /></label>
            <label><span>Source entity name</span><input name="sourceName" /></label>
            <label><span>External id field</span><input name="externalIdField" /></label>
            <label><span>Tier-1 primitive</span>
              <select name="tier1">
                ${TIER1_PRIMITIVES.map((t) => `<option value="${t}">${t}</option>`).join("")}
              </select>
            </label>
            <label><span>Fields (comma-separated, from discovery)</span><input name="fields" /></label>
            <button type="submit">Create Pending Mapping</button>
          </form>
        </aside>
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
    root.innerHTML = renderIntegrationWorkbenchHtml(state);
    bind();
  };

  const readMappingForm = (form: HTMLFormElement): FormData => {
    const data = new FormData(form);
    const appName = String(data.get("appName") ?? "").trim() || state.appName;
    state = { ...state, appName, draftText: String(data.get("mapping") ?? state.draftText) };
    return data;
  };

  const bind = (): void => {
    const mappingForm = root.querySelector<HTMLFormElement>('form[data-role="mapping-form"]');
    mappingForm?.addEventListener("submit", (event) => {
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
