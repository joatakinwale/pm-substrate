# Dashboard Integration Workbench Implementation Plan

Tracked from `TASKS.md` under roadmap item D5-D. This plan is execution detail, not independent project state; if it disagrees with the continuity ledger, `ROADMAP.md`, or `TASKS.md`, record the ledger decision and fix this file.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `packages/substrate-dashboard` into the D5 front door for zero-rewrite app adoption: control plane, live metrics, lab sessions, and a governed integration workbench for mapping review.

**Architecture:** Keep the deterministic substrate boundary intact. The dashboard may make mapping proposal, approval, rejection, dry-run sync, and Liquid discovery easier to use, but every accepted mapping still passes through `pm.mapping.proposed` -> `pm.mapping.approved`, and every Liquid sync still calls the existing `syncFromLiquid` approval gate.

**Tech Stack:** TypeScript/Vite dashboard, dependency-free Node dashboard server, `@pm/integration-kit`, `@pm/entity-mapping`, `@pm/events`, `@pm/graph`, Liquid MCP over stdio.

---

## What Is Missing Now

- `packages/substrate-dashboard/src/main.ts` mounts the Local Agent Lab control room only.
- `packages/substrate-dashboard/src/live.ts` renders ArrowHedge/Substrate live metrics, but the current shell does not expose it.
- `packages/substrate-dashboard/src/control-plane-page.ts` renders the D4 control-plane payload, but the current shell does not expose it.
- `packages/substrate-dashboard/server/server.mjs` exposes lab session APIs, `/api/dashboard`, and `/api/control-plane`; it does not expose mapping proposal, approval, rejection, dry-run sync, or Liquid discovery endpoints.
- `packages/integration-kit/src/mapping-approval.ts`, `packages/integration-kit/src/liquid-sync.ts`, `scripts/pm:mappings`, and `scripts/pm:sync` already implement the governed backend behavior, but only CLI/code callers can use it today.

## File Structure

- Modify `packages/substrate-dashboard/server/server.mjs`: add integration-workbench API routes and keep existing lab routes unchanged.
- Create `packages/substrate-dashboard/server/integration-workbench.mjs`: route handlers for mapping state, validation, proposal, decisions, dry-run sync, and Liquid discovery.
- Modify `packages/substrate-dashboard/server/server.test.mjs`: prove the new API calls the existing admitted-log mapping functions and never writes unapproved Liquid sync output.
- Create `packages/substrate-dashboard/src/integration-workbench-page.ts`: pure renderer plus browser mount for mapping proposals and dry-run results.
- Modify `packages/substrate-dashboard/src/main.ts`: add a small route switch for `/#lab`, `/#live`, `/#control-plane`, and `/#integrations`, while keeping Local Agent Lab as the default view.
- Modify `packages/substrate-dashboard/src/styles.css`: navigation, editor, validation, proposal list, dry-run diff, and status styles.
- Create `packages/substrate-dashboard/src/integration-workbench-page.test.ts`: renderer tests for valid mapping, invalid mapping, pending proposal, approved mapping, and dry-run refused states.
- Modify `docs/liquid-runbook.md`: add the dashboard path as the human-friendly route, with CLI commands as the deterministic fallback.

---

### Task 1: Add Integration Workbench API

**Files:**
- Create: `packages/substrate-dashboard/server/integration-workbench.mjs`
- Modify: `packages/substrate-dashboard/server/server.mjs`
- Test: `packages/substrate-dashboard/server/server.test.mjs`

- [x] **Step 1: Write API tests first**

Add a `describe.sequential("dashboard integration workbench API", ...)` block to `packages/substrate-dashboard/server/server.test.mjs` that starts the server on a random port and exercises:

```js
it("validates a mapping without publishing events", async () => {
  const base = await listen();
  const response = await postJson(base, "/api/integrations/orbit/mappings/validate", {
    mapping: {
      profile: null,
      mappingVersion: 1,
      entities: {
        Customer: {
          tier1: "Counterparty",
          concrete: "Counterparty",
          identityFields: ["name"],
          schemaVersion: 1
        }
      }
    }
  });

  expect(response.res.status).toBe(200);
  expect(response.body).toMatchObject({
    ok: true,
    validation: { valid: true, issues: [] }
  });
  expect(response.body.mappingHash).toMatch(/^[a-f0-9]{16}$/);
});

it("refuses invalid mapping proposals before they reach the event log", async () => {
  const base = await listen();
  const response = await postJson(base, "/api/integrations/orbit/mappings/propose", {
    mapping: {
      profile: null,
      mappingVersion: 1,
      entities: {}
    },
    origin: "manual",
    reason: "empty map should be rejected"
  });

  expect(response.res.status).toBe(400);
  expect(response.body.error).toMatch(/expected at least one entity entry/);
});
```

- [x] **Step 2: Add route handler module**

Create `packages/substrate-dashboard/server/integration-workbench.mjs` with these exported functions:

```js
import pg from "pg";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport, getDefaultEnvironment } from "@modelcontextprotocol/sdk/client/stdio.js";

import { asEntityMapping, validateEntityMapping } from "../../entity-mapping/src/index.js";
import { PostgresEventStore } from "../../events/src/index.js";
import { PostgresGraph } from "../../graph/src/index.js";
import {
  approveEntityMapping,
  entityMappingHash,
  getMappingApprovalState,
  proposeEntityMapping,
  rejectEntityMapping,
  syncFromLiquid
} from "../../integration-kit/src/index.js";

const tenantId = () => process.env.PM_DEV_TENANT_ID ?? "tenant_dev";
const agentId = () => process.env.PM_DEV_AGENT_ID ?? "joat-dev";

export function createIntegrationWorkbench({ databaseUrl = process.env.PM_DATABASE_URL } = {}) {
  if (!databaseUrl) {
    return {
      available: false,
      error: "PM_DATABASE_URL is required for integration workbench routes."
    };
  }
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const events = new PostgresEventStore(pool);
  const graph = new PostgresGraph(pool);
  return { available: true, pool, events, graph };
}
```

Then add handler functions:

```js
export async function getMappingState(deps, appName) {
  const state = await getMappingApprovalState(deps.events, tenantId(), appName);
  return { ok: true, appName, state };
}

export async function validateMappingBody(body) {
  const mapping = asEntityMapping(body.mapping);
  const validation = validateEntityMapping(mapping);
  return {
    ok: validation.valid,
    mapping,
    mappingHash: entityMappingHash(mapping),
    validation
  };
}

export async function proposeMapping(deps, appName, body) {
  const checked = await validateMappingBody(body);
  if (!checked.validation.valid) {
    return { status: 400, body: { ok: false, error: checked.validation.issues.map((i) => i.message).join("; "), validation: checked.validation } };
  }
  const result = await proposeEntityMapping(deps.events, {
    tenantId: tenantId(),
    appName,
    mapping: checked.mapping,
    proposedBy: agentId(),
    origin: body.origin ?? "manual",
    ...(body.reason ? { reason: String(body.reason) } : {})
  });
  return { status: 200, body: { ok: true, ...result } };
}
```

- [x] **Step 3: Wire routes in `server.mjs` before static fallback**

Add route matches before the `// --- static ---` block:

```js
const mappingStateMatch = pathname.match(/^\/api\/integrations\/([^/]+)\/mappings$/);
const mappingValidateMatch = pathname.match(/^\/api\/integrations\/([^/]+)\/mappings\/validate$/);
const mappingProposeMatch = pathname.match(/^\/api\/integrations\/([^/]+)\/mappings\/propose$/);
const mappingDecisionMatch = pathname.match(/^\/api\/integrations\/([^/]+)\/mappings\/([^/]+)\/(approve|reject)$/);
const syncPreviewMatch = pathname.match(/^\/api\/integrations\/([^/]+)\/sync\/preview$/);
const liquidDiscoverMatch = pathname.match(/^\/api\/integrations\/liquid\/discover$/);
```

Each route should call `createIntegrationWorkbench()`, return `503` when unavailable, and return JSON only. No integration route may fall through to `index.html`.

- [x] **Step 4: Run the server tests**

Run:

```bash
pnpm --dir packages/substrate-dashboard test -- server/server.test.mjs
```

Expected: existing lab API tests pass; new integration API tests pass.

---

### Task 2: Mount A Real Dashboard Shell

**Files:**
- Modify: `packages/substrate-dashboard/src/main.ts`
- Modify: `packages/substrate-dashboard/src/styles.css`
- Test: `packages/substrate-dashboard/src/control-plane-page.test.ts`

- [x] **Step 1: Add hash-route constants**

At the top of `packages/substrate-dashboard/src/main.ts`, import existing renderers:

```ts
import { mountControlPlane } from "./control-plane-page.js";
import { fetchSnapshot, renderLive } from "./live.js";
```

Add:

```ts
type DashboardView = "lab" | "live" | "control-plane" | "integrations";

function currentView(): DashboardView {
  const raw = window.location.hash.replace(/^#\/?/, "");
  if (raw === "live" || raw === "control-plane" || raw === "integrations") return raw;
  return "lab";
}
```

- [x] **Step 2: Render a persistent shell**

Wrap the current lab content in a view container:

```ts
function renderShell(active: DashboardView, body: string): void {
  appRoot.innerHTML = `
    <main class="substrate-dashboard-shell">
      <aside class="dashboard-rail">
        <strong>pm-substrate</strong>
        <a href="#lab" class="${active === "lab" ? "active" : ""}">Lab</a>
        <a href="#live" class="${active === "live" ? "active" : ""}">Live Metrics</a>
        <a href="#control-plane" class="${active === "control-plane" ? "active" : ""}">Control Plane</a>
        <a href="#integrations" class="${active === "integrations" ? "active" : ""}">Integrations</a>
      </aside>
      <section class="dashboard-view">${body}</section>
    </main>`;
}
```

Then adjust `renderMain()` and `renderDetail()` to render into `.dashboard-view` rather than replacing the entire app shell.

- [x] **Step 3: Route non-lab views**

Update `route()`:

```ts
async function route(): Promise<void> {
  const view = currentView();
  if (view === "live") {
    renderShell("live", `<div id="live-root"></div>`);
    renderLive(document.querySelector<HTMLElement>("#live-root")!, await fetchSnapshot());
    return;
  }
  if (view === "control-plane") {
    renderShell("control-plane", `<div id="control-plane-root"></div>`);
    await mountControlPlane(document.querySelector<HTMLElement>("#control-plane-root")!);
    return;
  }
  if (view === "integrations") {
    renderShell("integrations", `<div id="integration-workbench-root"></div>`);
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
```

- [x] **Step 4: Verify existing lab behavior still works**

Run:

```bash
pnpm --dir packages/substrate-dashboard test
```

Expected: all existing tests pass.

---

### Task 3: Build Mapping Review UI

**Files:**
- Create: `packages/substrate-dashboard/src/integration-workbench-page.ts`
- Create: `packages/substrate-dashboard/src/integration-workbench-page.test.ts`
- Modify: `packages/substrate-dashboard/src/main.ts`
- Modify: `packages/substrate-dashboard/src/styles.css`

- [x] **Step 1: Write renderer tests**

Create tests for:

```ts
import { describe, expect, it } from "vitest";
import { renderIntegrationWorkbenchHtml } from "./integration-workbench-page.js";

describe("integration workbench renderer", () => {
  it("shows approved and pending mapping state", () => {
    const html = renderIntegrationWorkbenchHtml({
      appName: "orbit",
      approvedHash: "abc123",
      pending: [{ mappingHash: "def456", origin: "liquid_discovery", proposedBy: "liquid", proposedAt: "2026-07-08T00:00:00.000Z" }],
      validation: { valid: true, issues: [] },
      draftText: "{}",
      preview: null
    });

    expect(html).toContain("Approved mapping");
    expect(html).toContain("abc123");
    expect(html).toContain("def456");
    expect(html).toContain("liquid_discovery");
  });
});
```

- [x] **Step 2: Implement pure renderer**

Create:

```ts
export interface IntegrationWorkbenchState {
  readonly appName: string;
  readonly approvedHash?: string;
  readonly pending: readonly {
    readonly mappingHash: string;
    readonly origin: string;
    readonly proposedBy: string;
    readonly proposedAt: string;
    readonly reason?: string;
  }[];
  readonly validation: { readonly valid: boolean; readonly issues: readonly { readonly path: string; readonly message: string }[] } | null;
  readonly draftText: string;
  readonly preview: null | {
    readonly dryRun: boolean;
    readonly created: number;
    readonly updated: number;
    readonly unchanged: number;
    readonly rejected: readonly { readonly sourceName: string; readonly externalId: string; readonly reason: string }[];
  };
}

export function renderIntegrationWorkbenchHtml(state: IntegrationWorkbenchState): string {
  return `
    <section class="integration-workbench">
      <header>
        <h1>Integration Workbench</h1>
        <p>Map an external app into the seven primitives, then approve the mapping before sync.</p>
      </header>
      <form data-role="mapping-form">
        <label><span>App name</span><input name="appName" value="${escapeHtml(state.appName)}" /></label>
        <label class="editor"><span>Mapping JSON</span><textarea name="mapping" rows="18">${escapeHtml(state.draftText)}</textarea></label>
        <button type="submit" name="intent" value="validate">Validate</button>
        <button type="submit" name="intent" value="propose">Propose mapping</button>
      </form>
      <aside class="mapping-state">
        <h2>Approved mapping</h2>
        <p>${state.approvedHash ? escapeHtml(state.approvedHash) : "none"}</p>
        <h2>Pending proposals</h2>
        ${state.pending.map((p) => `<article><strong>${escapeHtml(p.mappingHash)}</strong><span>${escapeHtml(p.origin)}</span></article>`).join("") || "<p>none</p>"}
      </aside>
    </section>`;
}
```

- [x] **Step 3: Add browser mount and actions**

Add `mountIntegrationWorkbench(root)` that calls:

- `GET /api/integrations/:appName/mappings`
- `POST /api/integrations/:appName/mappings/validate`
- `POST /api/integrations/:appName/mappings/propose`
- `POST /api/integrations/:appName/mappings/:hash/approve`
- `POST /api/integrations/:appName/mappings/:hash/reject`
- `POST /api/integrations/:appName/sync/preview`

Every write action should render the returned admitted-log state after the action completes.

- [x] **Step 4: Connect shell route**

In `main.ts`, import:

```ts
import { mountIntegrationWorkbench } from "./integration-workbench-page.js";
```

Then mount it in the `integrations` route.

- [x] **Step 5: Run frontend tests**

Run:

```bash
pnpm --dir packages/substrate-dashboard test
```

Expected: renderer tests pass and existing dashboard tests remain green.

---

### Task 4: Add Liquid-Assisted "No Config" Proposal Flow

**Files:**
- Modify: `packages/substrate-dashboard/server/integration-workbench.mjs`
- Modify: `packages/substrate-dashboard/src/integration-workbench-page.ts`
- Test: `packages/substrate-dashboard/server/server.test.mjs`

- [x] **Step 1: Add server test for discovery-as-proposal**

Use a fake Liquid client in tests and assert the server publishes a pending proposal with origin `liquid_discovery`, not an approved mapping:

```js
it("records Liquid discovery as a pending proposal, not an approved mapping", async () => {
  const base = await listen();
  const discovered = await postJson(base, "/api/integrations/liquid/discover", {
    appName: "orbit",
    url: "https://example.invalid/customers",
    sourceName: "Customer",
    tier1: "Counterparty",
    concrete: "Counterparty",
    externalIdField: "id",
    fields: ["id", "name"]
  });

  expect(discovered.res.status).toBe(200);
  expect(discovered.body.mappingHash).toMatch(/^[a-f0-9]{16}$/);
  expect(discovered.body.approved).toBe(false);
  expect(discovered.body.origin).toBe("liquid_discovery");
});
```

- [x] **Step 2: Implement a conservative proposal builder**

The first no-config path should not infer business semantics by itself. It should build a valid starter mapping from operator choices:

```js
function buildStarterMapping({ sourceName, tier1, concrete, externalIdField, fields }) {
  const optionalFields = fields.filter((field) => field !== externalIdField);
  return {
    profile: null,
    mappingVersion: 1,
    entities: {
      [sourceName]: {
        tier1,
        concrete,
        identityFields: [externalIdField],
        optionalFields,
        schemaVersion: 1
      }
    },
    description: `Liquid-assisted starter mapping for ${sourceName}`
  };
}
```

Liquid discovery can populate `fields`; the operator still chooses `tier1`, `concrete`, and `externalIdField`.

- [x] **Step 3: Expose the no-config UI lane**

Add a second panel to the workbench:

- App name
- Source URL or DSN
- Source entity name
- External id field
- Tier-1 primitive select: `Counterparty`, `Engagement`, `Transaction`, `Resource`, `Communication`, `Document`, `Event`
- Field list from Liquid discovery
- Button: `Create Pending Mapping`

The button must call `/api/integrations/liquid/discover` and then re-fetch mapping state.

- [x] **Step 4: Confirm no direct sync happens**

Run:

```bash
pnpm --dir packages/substrate-dashboard test
pnpm --dir ../.. validate:zero-edit
```

Expected: the no-config path creates only mapping proposal events; no graph nodes are written until a later approved dry-run or sync path is executed.

---

### Task 5: Document The Dashboard Path And Verify Manually

**Files:**
- Modify: `docs/liquid-runbook.md`
- Modify: `README.md` only if the dashboard URL or command changes

- [x] **Step 1: Update runbook**

Add a dashboard section after the CLI mapping approval commands:

```md
## Dashboard workbench

Start the dashboard:

```bash
PORT=4179 node packages/substrate-dashboard/server/server.mjs
```

Open `http://127.0.0.1:4179/#integrations`.

Use the Config path when the adopting app already has a `mapping.json` or `mapping.yaml`.
Use the Liquid-assisted path when the operator wants Liquid to inspect a source and produce a pending proposal. Both paths stop at `pm.mapping.proposed` until a human approves the hash.
```

- [x] **Step 2: Smoke test rendered routes**

Run the dashboard server:

```bash
PORT=4179 node packages/substrate-dashboard/server/server.mjs
```

Open:

- `http://127.0.0.1:4179/#lab`
- `http://127.0.0.1:4179/#live`
- `http://127.0.0.1:4179/#control-plane`
- `http://127.0.0.1:4179/#integrations`

Expected:

- Lab route still shows Local Agent Lab controls.
- Live route shows ArrowHedge/Substrate metrics or an offline banner.
- Control-plane route shows the five D4 questions or an explicit upstream error.
- Integrations route shows mapping state, mapping editor, proposal actions, and Liquid-assisted proposal controls.

- [x] **Step 3: Run final checks**

Run:

```bash
pnpm --dir packages/substrate-dashboard test
pnpm typecheck
pnpm validate:zero-edit
```

Expected:

- Dashboard tests pass.
- Typecheck passes.
- Zero-edit validator still passes, proving the workbench stayed generic and did not add lab-specific substrate hooks.

---

## Self-Review

- Spec coverage: covers dashboard navigation, existing hidden surfaces, mapping config path, Liquid-assisted no-config path, proposal/approval authority, dry-run sync, tests, and docs.
- Placeholder scan: no incomplete implementation notes are left for the worker.
- Type consistency: the plan reuses existing `EntityMapping`, mapping approval events, `syncFromLiquid`, and dashboard server route patterns.
