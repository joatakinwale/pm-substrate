# ADR-0013: Typed, versioned capability contracts (G6)

**Status:** Draft (2026-05-07).
**Closes:** Gap audit item G6 — *"Capability contracts are stringly typed"* (`pm-substrate-research-gap-audit-2026-05-05.md`).
**Companion ADR:** ADR-0014 (G7 — runtime permission enforcement). G6 makes the *what*; G7 makes the *who-may*.

---

## Context

Today's `Capability` registry entry is stringly-typed:

```ts
emits:                readonly string[]   // e.g. ["wedding.contract.payment_recorded"]
subscribesTo:         readonly string[]
readsInterfaces:      readonly string[]
writesInterfaces:     readonly string[]
requiredPermissions:  readonly string[]
```

This is fine for a skeleton. It is **structurally insufficient** for a substrate whose central claim is *safe composition of independently-authored capabilities*.

**Failure mode that motivates G6:**

1. Capability A registers `emits: ["wedding.contract.payment_recorded"]`. Payload is whatever A's `publishWith()` call serializes.
2. Capability B registers `subscribesTo: ["wedding.contract.payment_recorded"]`. B trusts the payload shape "by convention."
3. A's payload changes (drops a field, renames one). Tests in A pass. Tests in B pass against B's local fixtures. **Production breaks at the edge between them**, silently, because no one is checking the contract at install time.

This is exactly the integration-spaghetti the PM-layer thesis is meant to eliminate. We have G5.8 today (capabilities can't import each other at the source level), but G5.8 stops *direct coupling*. G6 stops *implicit coupling through untyped events*.

**Concrete trigger:** the G4 Phase 2 integration test in `profile-agency` had to assert payload shape via `expect(event.payload).toMatchObject(...)` because there was no compile-time guarantee. If `capability-agency-lead-scoring` had silently changed its emit shape, the wedding-budget test would still pass while the agency-lead-scoring test would break. The substrate did not make the contract enforceable.

## Decision

Capability registry entries become **typed contracts with versioned payload schemas**. Workflow installation validates that producer schemas satisfy subscriber expectations before enabling a workflow. Type-level guarantees where possible; runtime validation where not.

### New contract shape

```ts
// packages/types/src/capability-contract.ts (new)

/**
 * A versioned payload schema reference. The schema itself lives in a
 * separate registry (file-based JSON Schema files in the capability's own
 * package, addressable by ref + version). Substrate does not validate
 * schema syntax — it validates compatibility between producer and consumer.
 */
export interface PayloadSchemaRef {
  /** Stable identifier, e.g. "wedding.contract.payment_recorded". */
  readonly type: string;
  /** Semver-style integer triple. Major bumps are breaking changes. */
  readonly version: { major: number; minor: number; patch: number };
  /** Path to the schema file, relative to the capability package root. */
  readonly schemaPath: string;
}

export interface EmitContract {
  readonly schema: PayloadSchemaRef;
  /** Optional: declare which graph entity changes accompany this emit. */
  readonly affectsEntities?: readonly string[];
}

export interface SubscribeContract {
  /** Pattern matches `PayloadSchemaRef.type` — wildcards allowed (`wedding.contract.*`). */
  readonly pattern: string;
  /**
   * Range of versions this subscriber accepts. If a producer emits a
   * version outside this range, the workflow installer refuses to wire
   * the subscription.
   */
  readonly accepts: { minMajor: number; maxMajor: number };
  /**
   * If true, the subscriber will silently drop events whose schema can't
   * be resolved (forward compatibility). If false, drops are errors.
   * Default: false (strict).
   */
  readonly tolerateUnknown?: boolean;
}

export interface ReadContract {
  /** Tier-1 or profile interface name, e.g. "Counterparty/Couple". */
  readonly interface: string;
  /**
   * Specific fields the capability reads. Used by G7 for least-privilege
   * checks: a capability that only declares `["id", "name"]` cannot read
   * sensitive fields even if the underlying graph row contains them.
   */
  readonly fields: readonly string[];
  /** "exactly-one" | "at-most-one" | "many" — failure to satisfy = workflow error, not silent. */
  readonly cardinality: "exactly-one" | "at-most-one" | "many";
  readonly required: boolean;
}

export interface WriteContract {
  readonly interface: string;
  readonly fields: readonly string[];
  /**
   * "owner" — this capability is the only writer for this (interface, fields) tuple.
   * "contributor" — multiple capabilities can write; conflict resolution is per-field.
   * "delegated" — only writes through another capability's API.
   *
   * Workflow installer rejects two "owner" claims for the same (interface, field).
   */
  readonly ownership: "owner" | "contributor" | "delegated";
}

export interface Capability {
  readonly id: CapabilityId;
  readonly name: string;
  readonly version: number;

  // Typed in v2:
  readonly emits: readonly EmitContract[];
  readonly subscribesTo: readonly SubscribeContract[];
  readonly reads: readonly ReadContract[];
  readonly writes: readonly WriteContract[];

  // Stays string-typed until G7 lands its grammar:
  readonly readsEdges: readonly string[];
  readonly writesEdges: readonly string[];
  readonly requiredPermissions: readonly string[];

  readonly description: string;
}
```

### Workflow-time validation

When a workflow is installed:

1. For every `subscribesTo` entry in the workflow's capabilities, find producers (other capabilities with matching `emits.schema.type`).
2. Verify producer's `schema.version.major` is within consumer's `accepts.minMajor..maxMajor`.
3. Verify producer's schema (loaded from `schemaPath`) is a structural superset of consumer's expectations (additive subtyping is fine; field-removal is breaking).
4. Verify no two `writes` entries claim `ownership: "owner"` on the same `(interface, field)` pair.
5. If any check fails, **refuse to enable the workflow** with a structured error pointing at the offending capability + line.

Validation is a **build-time concern**, not a runtime concern. Install fails fast or succeeds silently — there is no "validation skipped" path.

### Schema storage

Schemas are JSON Schema files inside each capability's own package, e.g.:

```
packages/capability-wedding-budget/
  src/
    capability.ts                  ← imports schema refs
    handler.ts
  schemas/
    payment-recorded.v1.json       ← JSON Schema for payment payload
    budget-applied.v1.json
```

The capability's `EmitContract.schema.schemaPath` resolves to the schema file at install time. Schemas are loaded eagerly, validated against draft-2020-12, and cached. **Schemas are part of the capability's source tree, not a separate registry service** — keeps install and capability-source coupled.

### Migration of existing capabilities

5 existing capabilities to migrate:

1. `capability-wedding-budget`
2. `capability-wedding-contracts`
3. `capability-wedding-tasks`
4. `capability-wedding-calendar`
5. `capability-agency-lead-scoring`

Per-capability migration:

1. Author JSON Schema for each emit in `schemas/<event-name>.v1.json`.
2. Replace string-array `emits`/`subscribesTo` in `capability.ts` with typed contracts.
3. Annotate `reads`/`writes` with field lists + cardinality + ownership.
4. Run new `pnpm validate-contracts` script (introduced by this ADR) — refuses commit if any capability is half-migrated.
5. Update the integration test to verify the workflow installer accepts the now-typed declarations and rejects deliberately-bad versions of them.

### Backward compatibility

The old contract shape stays available for one release as a deprecation path:

```ts
// In the registry: both old (string[]) and new (Contract[]) accepted.
// Old form is auto-converted to new with `version: {1,0,0}, schemaPath: null`,
// and flagged as "untyped — install validator skips schema check."
// `pnpm validate-contracts --strict` refuses this fallback path.
// CI runs --strict on main.
```

This lets us migrate capabilities one PR at a time without breaking the build.

### What G6 explicitly does NOT do

- **Does not** add runtime payload validation on every event publish. That cost is too high and the value is mostly captured at install time. Optional `--validate-runtime` flag for dev environments only.
- **Does not** define the permission grammar. That's G7. G6 only types the data contract.
- **Does not** add edge contracts (`readsEdges`/`writesEdges` stay strings). G7 + G8 cover that.
- **Does not** introduce a separate schema service. Schemas live with capability source code.

## Why this shape (vs alternatives)

### Alternative A — TypeScript types only, no JSON Schema

Cheaper to write, harder to enforce. Two capabilities written in TS share a monorepo today, so types catch some mismatches at compile time. **But:** the substrate's promise is that capabilities can be authored independently, possibly in different repos, possibly in different languages later. JSON Schema is the cross-language lingua franca. Worth the extra ceremony.

### Alternative B — gRPC / Protobuf contracts

Overkill for the v1 of the substrate. Adds a build step, a code-gen step, and locks us out of dynamic schema evolution that JSON Schema allows. Reconsider in Phase 4 if a non-TS capability shows up.

### Alternative C — Schema service (Confluent-style schema registry)

Operational complexity not justified at current scale. Schemas-with-source has the additional virtue that *deleting a capability deletes its schemas* — no orphan schema problem.

## Acceptance criteria

- [ ] `@pm/types/capability-contract.ts` published with new contract shape.
- [ ] `@pm/registry` accepts both old (string-array) and new (typed) contracts during migration window. Strict mode rejects old.
- [ ] Workflow installer validates producer/subscriber compatibility on enable. Fails with structured error.
- [ ] All 5 existing capabilities migrated to typed contracts with JSON schemas.
- [ ] New test: `packages/registry/src/contract-validation.test.ts` — covers (a) compatible producer/subscriber accepts, (b) major-version mismatch rejects, (c) field-removal in producer rejects, (d) ownership conflict rejects, (e) workflow with cycle rejects (foreshadowing G8).
- [ ] CI runs `pnpm validate-contracts --strict` and fails on any untyped contract.
- [ ] Anti-fixation diff: substrate packages (`types`, `graph`, `events`, `projections`, `workflow`, `profile-registry`, `capability-audit`, `substrate-http*`) **only** gain the new types + workflow-validation logic. No business-logic changes. The 5 capability migrations are profile/capability-side work and don't count as substrate edits.

## Risks

1. **Schema bikeshedding.** JSON Schema gives a thousand ways to express the same thing. Mitigation: ship a `pnpm new-capability-schema <event-name>` scaffold that emits a canonical shape (TIMESTAMP, ID, payload object, additionalProperties: false) — most schemas should look near-identical.
2. **Migration tax.** 5 capabilities × ~3 schemas each = ~15 schemas to author. Probably 1 day of mechanical work, well-suited to Sonnet sub-agent delegation per ROUTING.md.
3. **Workflow installer becomes the gatekeeper.** If the installer has a bug, all installs fail. Mitigation: extensive contract-validation.test.ts before any capability migrates.
4. **Forward compatibility.** When a capability bumps to v2, all its subscribers need to widen their `accepts.maxMajor`. This is the price of safety. Document the bump procedure in the ADR; consider a `pnpm bump-schema <event-name> --major` helper.

## Sequencing

This ADR describes G6 only. Recommended order:

1. **Land G6 substrate-side changes first** (new types, registry updated, workflow installer validates) without migrating any capability. CI passes; existing capabilities use the old string-array path under the deprecation flag.
2. **Migrate one capability** (`capability-wedding-budget` — the canonical reference) end-to-end. Verify workflow install succeeds, integration tests pass.
3. **Migrate remaining 4 capabilities** in a single follow-up PR — mechanical work suitable for Sonnet sub-agent delegation.
4. **Flip CI to --strict mode** in a final small PR. Old path removed.
5. **Open ADR-0014 (G7)** and continue.

## Cross-references

- Gap audit G6: `pm-substrate-research-gap-audit-2026-05-05.md`
- ADR-0010 (capability-private idempotency): the `applied_*` table pattern doesn't change under G6; it just gets a typed payload reference.
- G5.8 (registry god-object isolation): G6 strengthens what G5.8 protects — capabilities are still siblings, but now their contracts are typed siblings.
