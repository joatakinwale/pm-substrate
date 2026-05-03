# Validation Framework

> Read this before reading the architecture doc. Architecture without falsification criteria is theology.

## The objective

The PM-layer architecture is validated when **two facts are simultaneously true**:

1. The wedding profile demo runs end-to-end and a 4th capability provider drops in cleanly (P3).
2. A second profile in an unrelated vertical (legal or agency) works on the same substrate without modifying it (P4).

The wedding application is the **forcing function**, not the product. Wedding profile + 2–3 tools written against Tier 1 = proof of concept. The second profile = proof of architecture.

---

## P3 — the demo moment

### The shape of the validated claim

> "A new capability provider plugged into the substrate produced behavior that no individual tool could have produced, and required zero modification to the existing three providers or the substrate itself."

If we cannot write that sentence with concrete subjects after P3, the demo is theater.

### The 4 providers

Drawn from the WeddingWebApp's existing surface area so the demo exercises real workflow, not contrived scenarios:

| # | Provider | Owns | Emits |
|---|----------|------|-------|
| 1 | **Planner / tasks** | `Engagement.Wedding` lifecycle, checklist tasks | task state changes |
| 2 | **Calendar** | Google Calendar projection | availability events |
| 3 | **Vendor + contracts** | `Counterparty.Vendor`, `Transaction.Contract` | contract state changes (sent/signed/expired) |
| 4 | **Comms (the drop-in)** | Twilio + Resend reminders | (subscriber only) |

The 4th is the load-bearing one — comms shares zero code with the first three.

### The cross-tool flow

A flow that the PM layer makes trivial and that no single tool can solve alone:

> Vendor signs a contract → calendar block for the vendor's deliverable shifts from tentative to confirmed → planner's downstream tasks unlock → 72h before the deliverable, comms sends a reminder to both the couple and the vendor referencing the contract terms.

What this exercises:

- **Capability resolution across providers.** Comms doesn't know about contracts directly — it subscribes to a typed event (`Transaction.Contract.signed`) emitted by the contracts provider.
- **Tier-1 tools work uniformly.** Audit, perms, attachments work on `Contract`, `Task`, and `CalendarEntry` with the same code path.
- **Time-travel.** The event log can replay "what did the system know at T-72h" to validate the reminder fired on correct state.
- **Tenant boundary.** Every read/write is owner-scoped without each provider hand-rolling enforcement.

### Acceptance tests for P3

Three automated tests, all must pass:

1. **Drop-in test.** Adding the comms provider modifies *zero lines* outside `packages/provider-comms/` and its registration call. Enforced by a CI check on the PR diff.
2. **Cross-tool flow test.** End-to-end test that runs contract → calendar → tasks → reminder, asserts each event landed in the log with correct causation chain, and asserts the reminder was sent with the contract reference.
3. **Capability-resolution negative test.** Comms is uninstalled mid-flow. The other three providers continue working without errors. (This is what "loosely coupled" means in practice.)

---

## Falsification — what kills the architecture

These failure modes mean the architecture is wrong, not the implementation. Hitting any of them triggers a stop-and-decide.

### From P3

1. **Comms needs to import from `provider-contracts` to function.** → events are under-typed; leaky abstraction.
2. **The drop-in test requires touching the workflow definition AND a substrate file.** → workflow layer isn't actually decoupled from substrate.
3. **The cross-tool flow only works because of a shared utility module.** → we built a monolith with namespaces, not a substrate.
4. **Projection lag exceeds seconds under wedding-demo load.** → Postgres-only day-1 stack was wrong; defer architecture validation until infra is right.
5. **AI placement test fails.** When building reminder logic, the natural home for the LLM is *inside* the comms provider rather than at the workflow / capability-resolution layer. → core thesis is wrong; AI-in-each-tool is the right answer; PM layer is unnecessary.

### From P4

6. **Second profile requires substrate modification.** Writing the legal/agency profile requires diffs in `packages/{types,graph,events,registry,workflow,projections,profile-wedding}/`. → the substrate isn't universal; we built a wedding-shaped thing with a profile-flavored config layer.
7. **Tier 1 leaks domain logic.** We end up adding wedding-specific or contract-specific fields to Tier-1 types to make tools work. → 7-primitive abstraction doesn't hold; layered ontology was wishful thinking.
8. **Profile authoring is harder than just writing an app.** A competent dev cannot ship a working profile in <1 week with substrate docs alone. → boundary isn't real, it's just a naming convention.
9. **Capability registry becomes a god object.** Providers end up coupled through registry config (X must install before Y, Z requires shared registry metadata). → we recreated integration spaghetti one layer up.

---

## Validation criteria — keep building if all are true after P4

1. P4's second profile compiles and runs end-to-end with **only** new files in `packages/profile-{vertical}/`. No diffs in any other package.
2. At least one Tier-1 tool (audit, perms, search, or comments) works against both profiles' data with no profile-specific code paths.
3. The reminder/orchestration logic for the second profile is expressed as a workflow definition, not as imperative code in a provider.

---

## Hard checkpoints

Each phase ends with a written **go / no-go decision**, logged in `memory/YYYY-MM-DD.md` (workspace) and referenced from this doc's changelog.

If a phase ends with any falsification mode active, options are:

- **(a) Fix the architecture.** Identify the specific design flaw, update ADR, retry.
- **(b) Descope.** Reduce the validation claim. Document what we're no longer claiming.
- **(c) Kill it.** Document the negative result and stop.

No "we'll address it later." That's how this kind of project rots.

---

## Changelog

- **2026-05-03** — initial framework written. Pre-implementation, post-scaffold. P0.5 (ProfileDefinition contract + wedding profile skeleton) shipped.
