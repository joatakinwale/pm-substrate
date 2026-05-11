# ADR-0025 — Read-staleness metadata helpers

## Status

Accepted — 2026-05-11. Opens G12 (substrate-as-discovery-engine alignment).

## Context

Substrate reads already carry `createdAt` and `updatedAt`. Callers that
need to reason about freshness compute age ad-hoc:

```ts
const ageMs = Date.now() - new Date(node.updatedAt).getTime();
if (ageMs > MAX_AGE_MS) { /* re-resolve */ }
```

This pattern is correct but uncontrolled — every caller invents its own
clock handling, default thresholds, and null-check conventions. As soon
as we have more than one capability doing it, drift starts.

The discovery-engine spec
(`research/discovery-engine/SPEC.md`, Gates 5 & 6) requires evidence
reads to know their own age, so downstream gates can demote stale
hypotheses or trigger re-retrieval. The substrate as it stands today
doesn't make staleness a first-class read concept.

Recall failure pattern (root cause for this ADR): on 2026-05-11 the
Joat agent repeatedly reported state from in-context memory instead
of re-verifying. The recall-guard plugin
(`.openclaw/plugins/recall-guard/`) addresses this at the agent-context
boundary by injecting a session-start staleness banner. This ADR is the
substrate-side analog at the graph-read boundary: capabilities and
discovery-engine subsystems should be equally well-armed against
trusting stale facts.

## Decision

Add a self-contained `staleness` module to `@pm/graph` that ships:

- `ReadStaleness` — `{ readAt, modifiedAt, ageMs }` shape, mirrors the
  PROV-O-style provenance convention used by the event log.
- `readStalenessOf(source, clock?)` — compute staleness for any record
  with an `updatedAt` field. Null-safe.
- `withNodeStaleness(node, clock?)` — convenience pair-wrapper for
  `getNode()` results.
- `withEdgeStaleness(edge, clock?)` and `withEdgeListStaleness(edges, clock?)`
  for the edge readers.
- `isStale(staleness, maxAgeMs)` — threshold predicate.

All helpers accept an optional `clock: () => Date` for deterministic
testing. Default is `() => new Date()` so callers don't pay for
injection at the call site.

**Key non-decisions** (deliberately):

- `GraphReader` is **not** modified. Existing return types stay as-is.
  Wrapping every read in a `Read<T>` envelope was considered and
  rejected: it forces a substrate-wide caller-side diff, which directly
  violates the anti-fixation rule (substrate change ⇒ profile-side
  code change). The helper-module approach is anti-fixation-clean —
  zero existing callers touched.
- No new database column. `updatedAt` already exists.
- No new HTTP surface. `substrate-http` callers compute staleness
  client-side if they need it.

## Verification

- `pnpm -F @pm/graph run build` clean.
- `pnpm exec vitest run packages/graph/src/staleness.test.ts` — 12 tests
  pass (null handling, ageMs computation under injected clock, clock-skew
  clamp, node/edge/edge-list wrappers, threshold predicate including
  exact-boundary semantics).
- Anti-fixation diff `main...feat/g12-read-staleness-metadata --
  packages/{types,events,registry,workflow,projections,profile-registry,
  capability-audit,substrate-http,substrate-http-demo,profile-wedding,
  profile-agency,capability-*}` — zero output expected; only `@pm/graph`
  internals changed (new file + 1 export added to `index.ts`).

## Consequences

- Capability authors gain a uniform way to ask "is this fact stale?"
  Discovery-engine gates (SPEC §3, Gate 5 assumption check / Gate 6
  provenance) can be implemented on top without inventing a parallel
  abstraction.
- The wedding/agency profiles inherit this for free — any capability
  walking the graph can age-gate its inputs (`Vendor` reads older than
  N days could trigger re-confirmation, etc.) without substrate edits.
- Reusing `updatedAt` (vs. introducing a new "asOf") keeps the schema
  unchanged and time-travel semantics (ADR-0018) unaffected.
- Future enhancement candidate: if downstream consumers consistently
  need a single `readAt` for a multi-read transaction, add a
  `ReadContext` helper that captures `now()` once at the start of a
  request and threads it through all subsequent staleness calls. Not
  built now — premature without a real caller demand.

## Discovery-engine alignment

This is the first of several ADRs (proposed G12 series) reframing the
substrate as the runtime for the JOATLABS discovery engine:

- ADR-0025 (this): read-staleness — Gate 6 provenance prerequisite
- ADR-0026 (proposed): invocation-input validation gate — Gate 1
  ("no kernel → no retrieval")
- ADR-0027 (proposed): post-commit assertion tests — Gate 4
  (falsification gate)

Together these make the discovery engine implementable as a profile
(`discovery`) plus a capability suite on top of the existing substrate,
rather than a parallel system.
