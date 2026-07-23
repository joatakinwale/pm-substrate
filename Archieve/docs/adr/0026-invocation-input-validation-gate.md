# ADR-0026 — Invocation-input validation gate

## Status

Accepted — 2026-05-11. Second of three G12 ADRs framing the substrate as the
runtime for the JOATLABS discovery engine. See ADR-0025 (read-staleness) for
the first and ADR-0027 (post-commit assertion tests, proposed) for the third.

## Context

Discovery-engine SPEC.md describes a gate stack the system runs every query
through. The first gate is **kernel-before-search**: no problem statement
in canonical form, no retrieval. The substrate analog is **no valid
invocation input, no capability dispatch**.

Before ADR-0026, the workflow runtime resolved each `InvokeNode`'s
`inputs` (dotted-path lookups against the trigger event and prior node
results) and handed the resolved object straight to the dispatcher.
Capabilities had to defensively validate every input field with no shared
contract — and most didn't, which means a misconfigured workflow could
push garbage to a capability that would then fail late inside its handler,
often with a confusing error.

The agent-side analog of this failure shipped the same morning: the
recall-guard plugin (`.openclaw/plugins/recall-guard/`) intercepts
unverified state claims before they reach the user. Substrate side, this
ADR plays the same role at the capability-dispatch boundary.

## Decision

Add an injectable `InputValidator` to the workflow runtime, mirroring
the existing `PermissionAuthorizer` injection from ADR-0014 (G7).

**Surface (new public exports from `@pm/workflow`):**

```ts
interface InputValidator {
  validate(ctx: InputValidationCheck): Promise<InputValidationDecision>;
}

type InputValidationDecision =
  | { valid: true }
  | { valid: false; reason: string; issues?: Array<{ path; message }> };

const acceptAllInputValidator: () => InputValidator;
const rejectAllInputValidator: (reason?: string) => InputValidator;
const builtinInputValidator: () => InputValidator;
```

**Capability descriptor extension:**

`Capability.inputSchema?: Readonly<Record<string, unknown>>` — optional
JSON-Schema-shaped contract for resolved inputs. Persisted in
`registry.capabilities.input_schema` (migration 0013).

**Runtime gate placement:**

`PostgresWorkflowRuntime.#runInvokeNode()` calls
`#inputValidator.validate(...)` BEFORE the permission check. On rejection:

1. Step is recorded as `failed` with `error: "input_invalid"` and structured `issues`.
2. Run is marked `failed`.
3. Dead-letter row is written with `reason='input_invalid'`, attempts=1.
4. Dispatcher is NEVER called.

`input_invalid` is intentionally non-retryable, same class as
`permission_denied` and `capability_not_found` per G8.3 (ADR-0017). The
input shape is not transient; retrying re-incurs the cost.

**Default behavior:** `acceptAllInputValidator()`. Capabilities without
an `inputSchema` see no change. The validator + schema must both be wired
for the gate to apply. This preserves backward compatibility through
migration.

**Built-in validator scope:** `builtinInputValidator()` handles a useful
subset of JSON Schema — top-level `type: object`, `required[]`,
`properties.{type}`, `additionalProperties: false`. Anything more
elaborate (anyOf, nested required, format, pattern) is accepted as valid
by the built-in; callers needing the full spec wire ajv or hyperjump-jsv
as a custom `InputValidator`. Rationale: dragging Ajv into `@pm/workflow`
adds ~600KB of bundle for a convenience feature.

## Why this is substrate-invariant work, not a Tier-2 change

The same logic as ADR-0014 (permission enforcement), ADR-0015 (cycle
detection), and ADR-0017 (retry / dead-letter): this gate enforces a
runtime invariant ("no dispatch without input shape check"), not a
profile-specific behavior. The capability registry gains one column;
the workflow runtime gains one injected dependency. No profile package
edits required — verified by anti-fixation diff against
`packages/{profile-wedding, profile-agency, capability-wedding-*,
capability-agency-*, capability-audit, capability-kit, entity-mapping}`.

## Migration

0013 adds `registry.capabilities.input_schema JSONB NULL`. Default NULL
means existing capabilities are unaffected. Capabilities opt in by
setting `inputSchema` on their descriptor and re-registering.

## Verification

- `pnpm typecheck` — 19 packages, all green.
- `PM_DATABASE_URL=... pnpm test -- --run` — **35 files, 285 tests**
  passing (was 266 pre-branch; +19 from input-validation suite + 3
  integration tests).
- New tests:
  - `packages/workflow/src/input-validation.test.ts` — 16 pure-function
    tests for the validators (accept-all / reject-all / built-in
    JSON-Schema subset, including type mismatch, required missing, null
    handling, additionalProperties, multi-issue reporting).
  - `packages/workflow/src/postgres.test.ts` — 3 DB-backed integration
    tests: (a) rejectAll wired → dispatcher never called, dead-letter
    `input_invalid` with attempts=1; (b) builtinInputValidator + real
    capability `inputSchema` → missing required field rejected; (c)
    default `acceptAll` → legacy dispatch preserved.
- Anti-fixation diff against profile + capability + entity-mapping
  packages: **0 lines**.

## Discovery-engine alignment

This implements Gate 1 (kernel-before-search) of the discovery-engine
SPEC at the substrate-runtime level. Combined with ADR-0025 (read
staleness, Gate 6 prerequisite) and the proposed ADR-0027 (post-commit
assertion tests, Gate 4), the substrate becomes structurally a
discovery-engine runtime. The discovery engine itself can be implemented
as a `discovery` profile + capability suite on top, using only standard
substrate primitives — no parallel system needed.

## Consequences

- New capabilities should declare `inputSchema` as a default discipline.
  Updating documentation and the capability-kit (`@pm/capability-kit`)
  to nudge this is follow-up work, not part of ADR-0026.
- Existing capabilities continue to work unchanged. Migration is
  opt-in, per-capability.
- The dead-letter reason vocabulary grows from
  `retry_exhausted | permission_denied | capability_not_found` to add
  `input_invalid`. Dashboards filtering by reason must be updated.
- `acceptOnly`-default keeps the migration window open. Once enough
  capabilities have `inputSchema`, the default could flip to
  `builtinInputValidator` for new runtimes. Not yet.

## Open question (deferred)

Should the validator also run at **install time** against the workflow's
declared input mapping shape, not just at dispatch? The install-time
check would catch some misconfigurations before any event arrives. The
runtime check is necessary anyway (resolved values can be null at
runtime even with a valid mapping). Adding both would be wasted work
for marginal gain. Deferred until a real workflow ships into production
and we see actual misconfiguration shapes.
