# Virtual Agency Substrate Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make PluggedInSocial's virtual-agency path bootable, deployable, tenant-scoped, contract-validated, and ready to become the live Axis B proof surface for pm-substrate.

**Architecture:** Keep the backend as the deterministic authority for tenants, approvals, capabilities, versions, lineage, and persisted mutations. Workers only relay typed queue messages into internal webhooks; pm-substrate integration is proven by live fixtures/evals that inspect real PluggedInSocial contracts instead of stale placeholder paths.

**Tech Stack:** FastAPI, SQLAlchemy async sessions, Cloudflare Workers/Queues, TypeScript shared message contracts, Vitest, pytest-style backend tests, pm-substrate agency profile/eval packages.

---

### Task 1: Restore Public Virtual-Agency Boot/Auth Boundary

**Files:**
- Modify: `plugged_in_social/backend/app/api/virtual_agency.py`
- Add/modify tests: `plugged_in_social/backend/tests/test_virtual_agency_api_contract.py`

- [ ] **Step 1: Write a failing import/contract test**

```python
def test_virtual_agency_router_imports_without_missing_get_org_id():
    import app.api.virtual_agency as module

    assert module.router.prefix == "/virtual-agency"
```

- [ ] **Step 2: Run the focused test and verify it fails because `get_org_id` is missing**

Run: `cd plugged_in_social/backend && python3 -m pytest tests/test_virtual_agency_api_contract.py::test_virtual_agency_router_imports_without_missing_get_org_id -q`

- [ ] **Step 3: Replace the missing dependency with established auth/RLS dependencies**

Change `virtual_agency.py` to import `get_current_user` and `get_db_with_rls_dep` from `app.auth.deps`, add a local `get_org_id(current_user)` helper that extracts the JWT claim, and change route DB dependencies from `get_db` to `get_db_with_rls_dep`.

- [ ] **Step 4: Run the focused test again**

Run: `cd plugged_in_social/backend && python3 -m pytest tests/test_virtual_agency_api_contract.py::test_virtual_agency_router_imports_without_missing_get_org_id -q`

### Task 2: Harden Internal Virtual-Agency Execution

**Files:**
- Modify: `plugged_in_social/backend/app/api/internal/virtual_agency.py`
- Modify: `plugged_in_social/backend/app/services/virtual_agency_agents.py`
- Modify tests: `plugged_in_social/backend/tests/test_virtual_agency_orchestration.py`

- [ ] **Step 1: Add failing tests for cross-org/project mismatch**

Add tests that call `route_virtual_agency_task` with a valid message except for a mismatched `org_id` or `project_id`, and assert the route rejects before applying mutations.

- [ ] **Step 2: Verify the new tests fail**

Run: `cd plugged_in_social/backend && python3 -m pytest tests/test_virtual_agency_orchestration.py -q`

- [ ] **Step 3: Enforce claimed org/project/task ids in the service**

Parse incoming ids as UUIDs in `route_virtual_agency_task`; after loading the orchestration task, reject mismatched `org_id`, `project_id`, and source `task_id`.

- [ ] **Step 4: Use system-actor RLS in the internal route**

Replace `get_db` dependency with a `RequestContext(org_id=req.org_id, user_id="virtual-agency-worker", role="system")` and `get_db_with_rls(ctx)` session, then commit inside the RLS-scoped session.

- [ ] **Step 5: Run the focused backend virtual-agency tests**

Run: `cd plugged_in_social/backend && python3 -m pytest tests/test_virtual_agency_orchestration.py -q`

### Task 3: Align Worker and Shared Message Contracts

**Files:**
- Modify: `plugged_in_social/agents/packages/shared/src/messages.ts`
- Modify: `plugged_in_social/agents/workers/virtual-agency/src/index.test.ts`

- [ ] **Step 1: Add failing Worker validation tests**

Extend the virtual-agency worker tests so a message missing `orchestration_task_id`, `task_version`, `lineage.client_request`, `lineage.project_id`, or `lineage.legacy_task_id` is rejected as a permanent malformed message.

- [ ] **Step 2: Verify the tests fail**

Run: `cd plugged_in_social/agents && pnpm --filter @stevie/worker-virtual-agency test`

- [ ] **Step 3: Tighten `VirtualAgencyMessage` and `validateMessage`**

Make `orchestration_task_id`, `task_version`, `lineage`, and `context` required, restrict `agent_role` to backend roles, and validate UUID/string/int/object requirements at runtime.

- [ ] **Step 4: Update the Worker fixture to a backend-realistic payload**

Use `agent_role: "content_creative"` and include approval version/hash and lineage fields.

- [ ] **Step 5: Run Worker tests and typecheck**

Run: `cd plugged_in_social/agents && pnpm --filter @stevie/worker-virtual-agency test && pnpm --filter @stevie/worker-virtual-agency typecheck`

### Task 4: Put Virtual Agency Into Deployment Automation

**Files:**
- Modify: `plugged_in_social/agents/scripts/deploy.sh`

- [ ] **Step 1: Add a deploy-script contract check**

Use `rg` to confirm `virtual-agency`, `stevie-virtual-agency`, and `BACKEND_BASE_URL` all appear in deploy queue, worker, secret, and deploy loops.

- [ ] **Step 2: Update deployment arrays**

Add `stevie-virtual-agency` queue/DLQ, `virtual-agency` worker, and backend URL secret handling wherever the script enumerates Worker names.

- [ ] **Step 3: Re-run the contract check**

Run: `rg -n "virtual-agency|stevie-virtual-agency|BACKEND_BASE_URL" plugged_in_social/agents/scripts/deploy.sh`

### Task 5: Prevent Duplicate AI Generation Claims

**Files:**
- Modify: `plugged_in_social/backend/app/api/internal/ai.py`
- Add/modify tests: `plugged_in_social/backend/tests/test_ai_content_begin_claim.py`

- [ ] **Step 1: Write a failing test that `/begin` claims a queued request**

The test should exercise the begin helper/route and assert a queued request becomes `generating` before provider work starts.

- [ ] **Step 2: Verify the test fails**

Run: `cd plugged_in_social/backend && python3 -m pytest tests/test_ai_content_begin_claim.py -q`

- [ ] **Step 3: Set `req.status = "generating"` in the begin transaction**

Update `started_at` if the model has that field, flush before returning the prompt/model payload, and keep the existing 409 behavior for non-startable statuses.

- [ ] **Step 4: Run the focused test**

Run: `cd plugged_in_social/backend && python3 -m pytest tests/test_ai_content_begin_claim.py -q`

### Task 6: Unblock the Live Axis B Marketing Evaluation Path

**Files:**
- Modify: `packages/evals/src/marketing.ts`
- Add/modify tests: `packages/evals/src/marketing.test.ts`
- Possibly modify: `packages/profile-agency/src/adapter-state-proof.integration.test.ts`

- [ ] **Step 1: Add a failing eval test that resolves the real PluggedInSocial path**

Assert the default marketing source path resolves to `./plugged_in_social` and that required backend/agents/frontend anchors exist.

- [ ] **Step 2: Verify it fails against the stale `./pluggedinsocial` path**

Run: `pnpm --filter @pm-substrate/evals test -- marketing`

- [ ] **Step 3: Update the default source path and evidence requirements**

Change the eval builder to use `./plugged_in_social`, require backend virtual-agency files, Worker contract files, deploy script, and profile-agency publication terminal anchors.

- [ ] **Step 4: Run eval/package tests**

Run: `pnpm --filter @pm-substrate/evals test -- marketing`

### Completion Audit

- [ ] Backend virtual-agency router imports and uses established auth/RLS dependencies.
- [ ] Internal virtual-agency execution rejects tenant/project/task mismatches and runs under system RLS.
- [ ] Worker/shared contracts reject malformed handoffs before backend calls.
- [ ] Deployment script creates/deploys/configures the virtual-agency Worker and queues.
- [ ] AI content begin marks work as claimed before generation.
- [ ] Axis B eval points at the real PluggedInSocial tree and inspects live integration anchors.
- [ ] Focused backend and Worker tests either pass or have explicitly documented environment blockers.
