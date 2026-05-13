# ADR-0027 — Post-commit assertion tests (capability falsification gate)

## Status

Proposed — 2026-05-12. Third and final of the G12-series ADRs framing
the substrate as the runtime for the JOATLABS discovery engine. ADR-0025
(read-staleness, accepted) and ADR-0026 (invocation-input validation,
accepted) precede this one.

**This ADR is not on the substrate's critical path.** As of 2026-05-12,
substrate-internal work is paused pending real composition signal from
JOATLABS-internal (see `research/joatlabs-internal-composition.md` in
the workspace repo). ADR-0027 is documented now so the design is locked
when/if the work is taken up.

## Context

The G12 series reframes the substrate as a discovery-engine runtime by
implementing the discovery-engine SPEC's gate stack at the
capability-dispatch level:

- **Gate 1 — kernel-before-search:** no problem statement in canonical
  form, no retrieval. **Substrate analog:** no valid invocation input,
  no dispatch. Implemented by ADR-0026.
- **Gate 6 — provenance / staleness:** every retrieved fact carries
  freshness metadata. **Substrate analog:** every read carries
  staleness metadata. Implemented by ADR-0025.
- **Gate 4 — falsification:** every claim has a stated way to be
  proven wrong. **Substrate analog:** every capability commit asserts
  observable post-conditions; assertion failure produces a
  non-retryable `assertion_failed` dead-letter.

ADR-0027 is Gate 4.

### The failure class this targets

Today, a capability handler can dispatch successfully, the workflow
runtime records the step as `succeeded`, the run is marked `succeeded`,
and downstream nodes consume the result — even though the capability
did the wrong thing.

Concrete cases this has bitten:

1. A `agency.LeadScoringHandler` runs, returns a `{ score: 42 }`
   payload, and writes the LeadScore node. The handler used a stale
   ScoringConfig because the config update hadn't yet propagated. The
   score is computed against the wrong weights. The substrate sees no
   error — only a downstream operator notices days later when a lead
   ranked "hot" turns out to be cold per the corrected weights.

2. A `wedding.BudgetRollupHandler` runs and emits
   `wedding.budget.recomputed` with `{ total: 24800 }`. Off by $200
   because a line item was double-counted. The rollup downstream is
   wrong, but the substrate has no opinion on whether the total
   matches reality.

3. A `joatlabs.outreach.email_sent` event from yesterday's G9 ingestion
   wrote a Communication node with `attrs.sentAt = "2026-05-09 17:27Z"`
   but the actual Resend send-log row had a different `ts` because of
   timezone parsing in one of two places. Both writes succeeded;
   downstream the substrate would compute follow-ups from a wrong
   timestamp. No error surfaced.

The agent-side analog (and the reason this ADR exists) is the
recall-guard plugin from 2026-05-11: I made seven recall-without-tool
mistakes in a single session, each of which committed to a claim before
verifying it against the source of truth. The substrate's
capability-handler boundary plays the same role: handlers commit to
state changes without verifying the change satisfies its own
post-conditions.

This is **not** caught by ADR-0026 (input validation) or ADR-0014
(permissions). Inputs can be valid, permissions can be granted, and the
handler can still write the wrong result.

## Decision

Add an optional `PostCommitAssertions` declaration to capability
descriptors and run them BEFORE the runtime marks the step as
`succeeded`. Assertion failure produces a non-retryable
`assertion_failed` dead-letter (same class as `input_invalid`,
`permission_denied`, `capability_not_found`).

**Surface (new public exports from `@pm/workflow`):**

```ts
interface PostCommitAssertion {
  /** Human-readable label surfaced in dead-letter rows. */
  readonly id: string;
  /** Optional description for operators. */
  readonly description?: string;
  /**
   * Predicate evaluated AFTER the handler returns but BEFORE the step
   * is marked succeeded. Receives the resolved inputs, the handler's
   * returned outputs, and a read-only view of any state changes the
   * handler made through the graph/event API during this dispatch.
   *
   * Return: { satisfied: true } or { satisfied: false; reason: string }.
   */
  check(ctx: AssertionContext): Promise<AssertionResult>;
}

interface AssertionContext {
  readonly capability: string;
  readonly tenantId: TenantId;
  readonly workflowId: WorkflowId;
  readonly nodeId: string;
  readonly inputs: Readonly<Record<string, unknown>>;
  readonly outputs: Readonly<Record<string, unknown>>;
  /**
   * Read-only summary of nodes/edges/events the handler created or
   * modified during this dispatch. Sourced from the dispatch-scoped
   * change tracker (new — see Implementation).
   */
  readonly committed: CommittedChanges;
}

interface CommittedChanges {
  readonly nodesCreated: ReadonlyArray<{ id: string; concrete: string }>;
  readonly nodesUpdated: ReadonlyArray<{ id: string }>;
  readonly edgesCreated: ReadonlyArray<{ id: string; type: string; fromId: string; toId: string }>;
  readonly eventsPublished: ReadonlyArray<{ id: string; type: string }>;
}

type AssertionResult =
  | { readonly satisfied: true }
  | { readonly satisfied: false; readonly reason: string };
```

**Capability descriptor extension:**

```ts
interface Capability {
  // ... existing fields
  readonly postCommitAssertions?: readonly PostCommitAssertion[];
}
```

**Runtime gate placement:**

In `PostgresWorkflowRuntime.#runInvokeNode()`, AFTER the dispatcher
returns successfully but BEFORE recording the step as `succeeded`:

1. If `capability.postCommitAssertions` is undefined or empty, proceed
   to record `succeeded` (legacy behavior, no change).
2. Otherwise, for each assertion, call `assertion.check(ctx)`.
3. On any assertion failing (`satisfied: false`):
   a. Record step as `failed` with `error: "assertion_failed"`, the
      assertion id, and the reason.
   b. Mark run as `failed`.
   c. Write dead-letter row with `reason='assertion_failed'`,
      `attempts=1`, payload includes `assertionId` and `reason`.
   d. Downstream nodes do NOT fire.
4. If all assertions pass: record `succeeded`, proceed as today.

`assertion_failed` is non-retryable for the same reason `input_invalid`
is: the assertion failed against the actual committed state, so
retrying the handler doesn't change the outcome unless the inputs or
state were different — and if those changed, a new dispatch is the
correct response, not a retry of the failed one.

### Capability-author ergonomics

Most assertions will be one of a small set of shapes. Ship helpers
from `@pm/workflow`:

```ts
// Asserts the handler created at least one node of a given concrete type.
const assertNodeCreated = (concrete: string, opts?: { minCount?: number }) => PostCommitAssertion

// Asserts a handler returned a numeric output within a range.
const assertOutputInRange = (key: string, min: number, max: number) => PostCommitAssertion

// Asserts an event of a given type was published.
const assertEventPublished = (type: string) => PostCommitAssertion

// Asserts a custom invariant.
const assertInvariant = (id: string, description: string, fn: (ctx) => Promise<boolean>) => PostCommitAssertion
```

The four cover ~80% of practical post-conditions. Anything beyond is
authored as a custom `PostCommitAssertion` object.

### Examples (the three failure cases above, prevented)

1. `agency.LeadScoringHandler`:

   ```ts
   postCommitAssertions: [
     assertNodeCreated("LeadScore", { minCount: 1 }),
     assertInvariant(
       "score-uses-current-config",
       "Score computation used the ScoringConfig as of the trigger event's occurredAt",
       async (ctx) => {
         const usedConfigVersion = ctx.outputs["scoring_config_version"];
         const currentConfigVersion = await fetchCurrentConfigVersion(ctx.tenantId);
         return usedConfigVersion === currentConfigVersion;
       },
     ),
   ]
   ```

2. `wedding.BudgetRollupHandler`:

   ```ts
   postCommitAssertions: [
     assertEventPublished("wedding.budget.recomputed"),
     assertInvariant(
       "total-matches-line-item-sum",
       "Rolled-up total equals sum of contributing line items",
       async (ctx) => {
         const claimed = ctx.outputs["total"];
         const lineItems = await readBudgetLineItems(ctx.tenantId, ctx.inputs["budgetId"]);
         const actual = lineItems.reduce((a, x) => a + x.amount, 0);
         return Math.abs(claimed - actual) < 0.01;
       },
     ),
   ]
   ```

3. `joatlabs.outreach.IngestEmailSentHandler`:

   ```ts
   postCommitAssertions: [
     assertInvariant(
       "node-sentAt-matches-event-occurredAt",
       "The Communication node's sentAt attr equals the published event's occurredAt",
       async (ctx) => {
         const commNode = ctx.committed.nodesCreated.find(n => n.concrete === "Communication");
         const event = ctx.committed.eventsPublished.find(e => e.type === "joatlabs.outreach.email_sent");
         if (!commNode || !event) return false;
         const node = await readNode(ctx.tenantId, commNode.id);
         const ev = await readEvent(ctx.tenantId, event.id);
         return node.attrs["sentAt"] === ev.occurredAt;
       },
     ),
   ]
   ```

## Implementation

### Change tracker (new substrate primitive)

The assertion context needs `CommittedChanges` — what the handler
actually wrote during this dispatch. Today the runtime doesn't track
this; the handler calls `graph.createNode` / `graph.createEdge` /
`events.publish` directly against the substrate stores.

Two options:

**A. Wrap the stores in a dispatch-scoped recorder.** The runtime
passes the handler a wrapped `graph` and `events` whose mutation
methods record every call into a `CommittedChanges` accumulator and
then delegate. After the handler returns, the runtime hands the
accumulator to the assertions via `ctx.committed`.

**B. Read-after-write reconstruction.** After the handler returns,
query the substrate for everything the handler wrote: nodes/edges/events
in the dispatch's time window scoped to this run. More invasive (needs
event-log-by-dispatch indexing); also unreliable if multiple dispatches
overlap.

**A is the right call.** Cleaner, no schema changes, capability authors
don't see the wrapping. Implementation: new `DispatchRecorder` class in
`@pm/workflow` that wraps `Graph` and `EventStore` interfaces. ~150
lines plus tests.

### Schema migration

`registry.capabilities.post_commit_assertions JSONB NULL` — analogous
to `input_schema` from ADR-0026. NULL = legacy behavior (no
assertions). When non-null, the runtime loads + runs the assertions.

Note: assertions themselves are code, not data, so the JSONB column
stores only the assertion *declarations* (id, description, type hint
for helper-shaped assertions like `assertNodeCreated`). For custom
`assertInvariant` assertions where the check is a closure, the
registration path resolves the closure from the capability descriptor
at runtime. The column is metadata for operators ("this capability
has 3 post-commit assertions: X, Y, Z") — the actual evaluation lives
in the capability descriptor on the handler side.

### Migration plan

`0014_capability_post_commit_assertions.sql`:

```sql
ALTER TABLE registry.capabilities
  ADD COLUMN IF NOT EXISTS post_commit_assertions JSONB;

COMMENT ON COLUMN registry.capabilities.post_commit_assertions IS
  'G12 / ADR-0027: declarative metadata for post-commit assertions (id + description + type). Actual assertion logic lives in the capability descriptor and runs in @pm/workflow.';
```

Existing capabilities unaffected (NULL default = no assertions).

## Why substrate-invariant, not Tier-2 work

Same reasoning as ADR-0014 (permissions), ADR-0015 (cycle detection),
ADR-0017 (retry/dead-letter), ADR-0026 (input validation): this gate
enforces a runtime invariant ("no commit without post-condition
check"), not profile-specific behavior. The substrate gains one
column, the workflow runtime gains one optional injection. No profile
package edits required.

Anti-fixation diff target: 0 lines against `packages/{profile-wedding,
profile-agency, capability-wedding-*, capability-agency-*,
capability-audit, capability-kit, entity-mapping}`.

## Verification (proposed)

When implemented, the PR should produce:

- `pnpm typecheck` — all packages green.
- `PM_DATABASE_URL=... pnpm test -- --run` — new tests in
  `packages/workflow/src/post-commit-assertions.test.ts`:
  - Pure-function tests for each helper (`assertNodeCreated`,
    `assertOutputInRange`, `assertEventPublished`, `assertInvariant`)
    against fixture `AssertionContext` values.
  - DB-backed integration tests in `postgres.test.ts`:
    - Capability with passing assertions → succeeds normally.
    - Capability with one failing assertion → step `failed`,
      dead-letter `assertion_failed`, attempts=1, downstream nodes
      never fire.
    - Capability with no assertions → legacy path unchanged.
    - Multiple assertions, one fails → first-failure detail in
      dead-letter, remaining assertions short-circuit (don't run).
    - `DispatchRecorder` correctly captures node/edge/event mutations
      done through the wrapped stores.
- Anti-fixation diff: 0 lines.
- Estimated tests added: ~20.

## Consequences

- Capability-author burden shifts from "write defensive validation in
  the handler" to "write declarative post-conditions on the
  descriptor." Net wash for code volume; net gain for testability and
  observability (assertions are queryable metadata).
- Dead-letter reason vocabulary grows from `retry_exhausted |
  permission_denied | capability_not_found | input_invalid` to add
  `assertion_failed`. Dashboards filtering by reason must be updated.
- Performance: each assertion runs synchronously after the handler.
  Cheap assertions (helpers like `assertEventPublished`) are
  microseconds; custom `assertInvariant` checks that do DB reads can
  add real latency. Capability authors should keep assertion checks
  fast or accept the latency cost.
- The `DispatchRecorder` adds a thin proxy layer on every
  graph/events call. Negligible cost in practice; benchmark to
  confirm <1ms overhead per dispatch.
- Assertions are NOT a replacement for capability unit tests. They
  enforce invariants at runtime in production, not pre-merge. Authors
  should write both.

## Open questions

1. **Assertion failure → run failure cascade.** Today, if a step
   fails, the run is marked failed and downstream nodes don't fire.
   Same here. But: should an assertion failure also roll back the
   handler's writes? My read: NO. Rollback is hard (graph mutations
   are not transactional with event publishes), and the assertion
   failure is meant to *surface* the bad commit, not erase it — the
   dead-letter row gives operators evidence. Operator decides whether
   to compensate.

2. **Should assertions be allowed to mutate state?** My read: NO.
   Assertions are pure observers. If an assertion needs to write a
   "drift-detected" event or similar side effect, that's a separate
   `wf.assertion_failed` event the runtime publishes automatically
   (similar to how dead-letter rows are written), not something the
   assertion itself does.

3. **Should the runtime auto-publish a `wf.assertion_failed` event?**
   Probably yes — same pattern as `wf.permission_denied` if that
   exists (it doesn't yet, but should). Defer to a follow-up ADR.

4. **Does this need to interact with G8.3 retry?** No — `input_invalid`
   precedent already handles this. Non-retryable means the retry loop
   doesn't trigger; the failure is committed once.

## Discovery-engine alignment

This implements Gate 4 (falsification) of the discovery-engine SPEC at
the substrate-runtime level. Combined with ADR-0025 (read-staleness =
Gate 6 provenance) and ADR-0026 (input validation = Gate 1
kernel-before-search), the substrate is structurally a discovery-engine
runtime at the capability-dispatch layer.

The discovery engine itself can then be implemented as a `discovery`
profile + capability suite on top of these primitives. The substrate's
job is to enforce the gates; the discovery engine's job is to use them.

## Decision rationale (why now, why this shape)

- **Why now (proposed, not accepted):** substrate-internal work is
  paused pending real composition signal. This ADR locks the design so
  if the work is taken up later, the implementation is unambiguous.
- **Why not a Tier-2 capability wrapper:** post-commit checking has to
  see what the handler actually wrote during its dispatch. That
  requires a dispatch-scoped change tracker (`DispatchRecorder`),
  which is a substrate-runtime primitive. Capability-side wrappers
  can't observe their own writes without re-reading the substrate,
  which is slower and racier.
- **Why optional, not required:** backward compatibility. Existing
  capabilities have zero assertions and continue to work. Migration is
  opt-in, per-capability, exactly like ADR-0026.
- **Why "post-commit" not "pre-commit":** pre-commit assertions would
  need transactional rollback (hard), and the failure case we're
  guarding against is the handler thinking it succeeded when it
  didn't — that's only observable after the writes. Post-commit is the
  right semantic.

## Status when implemented

When this ADR is taken up, the implementation PR should:

1. Add `0014_capability_post_commit_assertions.sql` migration.
2. Add `PostCommitAssertion`, `AssertionContext`, `AssertionResult`,
   `CommittedChanges` types to `@pm/workflow`.
3. Add `DispatchRecorder` to `@pm/workflow` — wraps `Graph` +
   `EventStore` interfaces, accumulates `CommittedChanges`.
4. Add the four helper functions: `assertNodeCreated`,
   `assertOutputInRange`, `assertEventPublished`, `assertInvariant`.
5. Wire the assertion-evaluation step into
   `PostgresWorkflowRuntime.#runInvokeNode()` between handler return
   and step-success recording.
6. Add tests per the Verification section.
7. Anti-fixation verification: 0 lines against profile + capability +
   entity-mapping packages.
8. Update this ADR's Status from "Proposed" to "Accepted — <date>".
