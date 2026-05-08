# ADR-0014: Runtime permission enforcement (G7)

**Status:** Draft  
**Date:** 2026-05-08  
**Depends on:** ADR-0013 typed/versioned capability contracts

## Context

G6 made capability contracts explicit: what a capability reads, writes, emits,
and consumes. That is necessary but not sufficient. The substrate still needs a
runtime gate that answers: **is this workflow run allowed to invoke this
capability right now?**

This matters before the agent/action layer. If an agent can trigger workflows
that mutate members, products, leads, contracts, or calendars, permission checks
cannot live in agent prompt text. They must sit in the deterministic substrate
path before capability invocation.

Current descriptors already expose `requiredPermissions: readonly string[]`, but
nothing enforces it. G7 makes those strings load-bearing.

## Decision

Add runtime permission enforcement to `@pm/workflow` at the invocation boundary.

Before `InvocationDispatcher.invoke(ctx)` runs, the workflow runtime will:

1. Load the invoked capability from `@pm/registry`.
2. Read its `requiredPermissions`.
3. Ask a deterministic `PermissionAuthorizer` whether the run is allowed.
4. If denied: record the step as failed, mark the run failed, and **do not call**
   the dispatcher.
5. If allowed: call the dispatcher with the same invocation path as today.

The permission check lives in workflow runtime, not inside individual capability
handlers. Capabilities can still implement domain invariants, but they should not
be the primary enforcement point for cross-cutting authorization.

## Proposed interface

```ts
export interface PermissionAuthorizer {
  authorize(ctx: PermissionCheck): Promise<PermissionDecision>;
}

export interface PermissionCheck {
  readonly tenantId: TenantId;
  readonly workflowId: WorkflowId;
  readonly workflowName: string;
  readonly workflowVersion: number;
  readonly nodeId: string;
  readonly capability: string;
  readonly requiredPermissions: readonly string[];
  readonly triggerEvent: PMEvent;
}

export type PermissionDecision =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly reason: string };
```

`RuntimeDeps` gains:

```ts
readonly authorizer?: PermissionAuthorizer;
```

Migration behavior: if omitted, runtime uses an explicit `allowAllAuthorizer()`
for backward compatibility in tests and existing demos. Production wiring should
pass a real authorizer. This default is intentionally named and exported so it is
visible at call sites; no hidden auth bypass.

## Permission grammar for v1

Keep v1 permission strings simple and exact-match:

```text
<profile-or-common>.<resource-or-capability>.<action>
```

Examples already present:

- `wedding.contracts.write`
- `wedding.tasks.write`
- `wedding.calendar.write`
- `wedding.budget.write`
- `agency.lead-scoring.write`
- `audit.read`

No wildcard grammar in G7. If a product layer wants roles like `admin` or
`planner`, it resolves those roles to exact permission strings before answering
`PermissionAuthorizer.authorize()`.

## Subject / actor source

G7 does not invent identity. It authorizes the current workflow run using data
already present at the substrate edge:

- `triggerEvent.emittedBy`
- `workflowId` / `workflowName` / `nodeId`
- tenant ID
- capability name + required permission strings

A higher layer can implement the authorizer however it wants:

- system workflows: allow if workflow is installed by a trusted system actor
- agent workflows: allow if the agent principal has the required capability
  permissions
- user workflows: allow if the user/session mapped to the triggering event has
  the required permissions

The substrate defines the deterministic hook, not the entire IAM product.

## Why invocation-boundary enforcement

It is the narrowest load-bearing choke point:

- All workflow-driven side effects pass through `InvocationDispatcher.invoke()`.
- Deny-before-dispatch prevents capability code from running at all.
- Step/run tables already record execution state, so denial has an audit trail.
- It composes with G6: the same registry lookup gives both data contract and
  required permission strings.

## What G7 explicitly does not do

- **Does not** enforce field-level graph reads/writes yet. G6 field contracts make
  that possible, but graph-level wrappers are a separate step.
- **Does not** add a full RBAC/ABAC database schema. Product surfaces can back the
  authorizer with whatever identity system they use.
- **Does not** parse wildcard permission strings. Exact strings only.
- **Does not** secure direct calls to capability service classes that bypass
  workflow runtime. Production app wiring must route agent/user actions through
  the authorized workflow/dispatcher boundary.

## Acceptance criteria

- [ ] `PermissionAuthorizer`, `PermissionCheck`, and `PermissionDecision` exported
  from `@pm/workflow`.
- [ ] `PostgresWorkflowRuntime` checks permissions before every invoke node.
- [ ] Denied step records `status='failed'`, records a useful reason, marks run
  failed, and does not call `InvocationDispatcher.invoke()`.
- [ ] Allow path preserves existing workflow behavior.
- [ ] Tests cover allow, deny, and missing-permission/no-required-permission cases.
- [ ] Existing capability descriptors remain unchanged unless a permission string
  is wrong.
- [ ] Full gates pass: typecheck, build, DB-backed tests.

## Sequencing

1. Add `permissions.ts` types/helpers in `packages/workflow/src/`.
2. Wire `RuntimeDeps.authorizer` into `PostgresWorkflowRuntime`.
3. Add tests in `packages/workflow/src/postgres.test.ts` or a focused
   `permission-enforcement.test.ts`.
4. Run full gates.
5. Merge G7, then move to field-level enforcement / graph wrappers if needed.

## Cross-references

- ADR-0013: typed capability contracts. G7 consumes `requiredPermissions` from
  those same descriptors.
- G6 `ReadContract.fields` and `WriteContract.fields`: future field-level checks.
- Agent/application layer: agents can initiate actions, but the deterministic
  substrate decides whether the action is authorized before execution.
