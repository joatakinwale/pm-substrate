# Universal Data Adapter (UDA) — Implementation Plan

**Date:** 2026-06-26
**Owner:** Emmanuel / JOATLABS
**Status:** Design-approved, not yet built (discussion → plan)

## 0. Problem statement

pm-substrate solves two problems:
1. **Agent state** — coordinating agents + coherent, tamper-evident history (already largely built: typed entities, append-only hash-chained event log, capability registry, workflow runtime, projections).
2. **Universal Data Adapter (UDA)** — letting *external systems we do not own* feed data into the substrate **without rewriting those systems**.

The UDA is the open gap. Today, getting data out of an external source (e.g. ArrowHedge) required hand-written bilateral glue, with no guarantee we captured every field. That does not scale to a product: customers cannot be asked to rewrite their architecture to emit substrate-shaped data.

## 1. Core design principle (non-negotiable)

**Agent proposes, code disposes.**

- Intelligence (LLM / pi harness) is spent **once, at discovery/build time** to *understand* a source and *generate* a mapping tool.
- The generated mapping tool is **deterministic code** that runs on every record forever after — no LLM in the runtime path.
- This avoids: per-record LLM cost, non-determinism, hallucinated field mappings on production data, and unobservable silent mis-maps.

Three separate layers — never fuse them:
| Layer | Job | Mechanism | LLM in path? |
|---|---|---|---|
| **Discovery** | Understand an unknown source, propose a typed mapping | Discovery agent + MCP + pi harness | Yes (build time only) |
| **Execution** | Move each record through the approved mapping | Generated deterministic mapper + strict validation | No |
| **Liveness/Cost** | Know if an agent is alive + what it costs | Network-level model-call observation + per-provider cost adapters | No |

This plan covers Layers 1 + 2 (the UDA). Layer 3 (liveness/cost monitoring) is referenced but specced separately.

## 2. The strict inbound contract (foundation — build first)

Everything maps *into* one strict, versioned, typed inbound contract. External systems are never rewritten; they are mapped onto this.

- **`InboundRecordEnvelope`** (new type in `@pm/types`):
  - `sourceId` (which external system/integration)
  - `sourceRecordId` (stable id in the source)
  - `sourceSchemaVersion`
  - `observedAt` (timestamp)
  - `kind` — the substrate concept this maps to: `entity` | `event` | `approval` | `task` | `relationship`
  - `payload` — already-mapped substrate-shaped fields
  - `lineage` — source field provenance for each mapped field (`{ substrateField: sourceFieldPath }`)
  - `mappingId` + `mappingVersion` — which approved mapping produced this
- **Validation:** reuse existing substrate validators (graph `validatorFactory`, workflow `contract-validation`, `input-validation`). A missing/invalid required field **fails loudly** — this is what kills the "did we get everything?" fear: absence becomes a test failure, not a silent gap.
- **Ingest route:** generic `POST /tenants/:id/inbound/records` in `substrate-http-demo` (NOT core — keep core profile-agnostic, follow the `extraRoutes` precedent). Runs validate → map-already-applied → publish typed events → graph nodes → projections.

**Deliverable:** `@pm/types` envelope + a generic inbound capability + DB-backed route test. Zero external-system code touched.

## 3. The Mapping artifact (declarative, the thing pi generates)

A mapping is **declarative config + a generated deterministic transform**, version-controlled and approvable.

- **`MappingSpec`** (stored, hash-stamped, approvable):
  - `mappingId`, `version`, `sourceId`, `sourceSchemaFingerprint`
  - `fieldMappings`: ordered list of `{ sourcePath, substrateField, transform?, required: bool }`
  - `recordKindRules`: how to decide `kind` (entity/event/approval/...) per source record
  - `generatedTool`: path/hash of the deterministic mapper module pi produced
  - `tests`: path/hash of the generated test suite + fixtures
  - `approvalRef`: hash-chained approval event (who/what-version/when) — reuses the substrate approval pattern
- **Why declarative + generated code, not pure code:** the spec is human-reviewable and diffable; the generated module is the fast executor. Both are produced by pi at discovery time.

## 4. Discovery agent (Layer 1) — the "universal" part

A dedicated agent whose only job is: *look at an unknown source → propose a `MappingSpec` → drive pi to generate + self-test the mapper.*

**Inputs it needs (via MCP):**
- An **MCP server per source class** (or a generic introspection MCP) exposing: schema/DDL, sample records (redacted), enums, relationships. MCP is the standard "reach into an unknown system to look" layer.
- The **substrate target schema** (the inbound contract + available `kind`s + required fields) as context.

**Discovery flow:**
1. Agent introspects source via MCP: pulls schema + N sample records.
2. Agent proposes a draft `MappingSpec` (field-by-field, with `kind` rules and `required` flags), citing reasoning/lineage per field.
3. Agent invokes **pi harness** (build-time) to:
   - generate the deterministic mapper module from the `MappingSpec`,
   - generate a **test suite + fixtures from the real sample records**,
   - run the tests (`pi` has bash/edit/write/read),
   - only emit the tool if tests pass.
4. Agent returns: `MappingSpec` + generated mapper + passing tests + a human-readable diff/summary.

**pi integration specifics (this machine):**
- Use `pi` non-interactively as the codegen harness; auth via `~/.pi/agent/auth.json` (already configured; `type: api_key`).
- New pi extension `uda-mapping-tools` (auto-discovered under `~/.pi/agent/extensions/`):
  - `uda_introspect_source` — pull schema + samples via the source MCP.
  - `uda_generate_mapper` — given a `MappingSpec`, write the deterministic mapper module + fixtures.
  - `uda_run_mapper_tests` — run the generated vitest suite, return one-line pass/fail.
  - `uda_validate_against_contract` — dry-run the mapper output through the substrate inbound validators.
- Mechanical/deterministic substeps run as pi tools (zero main-session reasoning), consistent with existing `substrate-tools` / `infra-tools` pattern.

## 5. Human approval (safety gate — non-negotiable)

- Auto-generated mappings touch real business data (money, approvals) → **one-click human approval** before first live use **and** after every regeneration.
- Approval is a **hash-chained event** binding the exact `MappingSpec` version + generated-tool hash. A later attempt to run a different/altered mapper is detectable.
- Same 1-click pattern as the rest of the agency/PluggedInSocial flow — consistent mental model.

## 6. Execution (Layer 2) — deterministic, no LLM

- Approved generated mapper runs on every source record → emits `InboundRecordEnvelope`(s) → inbound route → validate → typed events → graph → projections.
- **Schema-drift self-heal:** the live mapper validates source records against `sourceSchemaFingerprint`. On drift, it **fails loudly** and emits a `mapping.drift.detected` event → triggers re-invocation of the discovery agent + pi to regenerate → new approval → redeploy. The pipeline self-heals through the same path; no human glue-debugging.

## 7. Build order (milestones)

1. **M1 — Inbound contract + generic route.** `InboundRecordEnvelope` in `@pm/types`; generic inbound capability + `extraRoutes` route in `substrate-http-demo`; DB-backed validation test. *(Touches no external system.)*
2. **M2 — MappingSpec + deterministic executor.** Spec type + a hand-written reference mapper + executor + validation-fails-loud test. Proves Layer 2 before any agent.
3. **M3 — pi codegen path.** `uda-mapping-tools` pi extension; `uda_generate_mapper` + `uda_run_mapper_tests` + `uda_validate_against_contract`. Generate a mapper from a hand-written `MappingSpec` (no discovery agent yet).
4. **M4 — Discovery agent + MCP introspection.** Source MCP (start with one concrete source) → agent proposes `MappingSpec` → drives pi (M3) → returns self-tested tool.
5. **M5 — Approval + hash-chained binding.** Wire 1-click approval event binding spec+tool hash; block execution without it.
6. **M6 — Drift self-heal loop.** `mapping.drift.detected` → re-discovery → re-approval → redeploy.

## 8. First proof (recommended)

Prototype the whole loop against **ArrowHedge data** first: we already know that source and hand-wrote glue for it, so we can check the **agent+pi-generated mapper against the hand-written glue** — a real falsification test of the UDA, not a demo. If the generated mapper reproduces (or improves on) the hand glue and its tests catch a deliberately removed field, the UDA concept is proven.

## 9. Falsification criteria (must hold before claiming UDA works)

- Generated mapper output is **byte-equivalent** (or provably superset) to hand-written ArrowHedge glue on the same inputs.
- Removing a required source field → **generated test fails** (not a silent pass).
- Schema drift → mapper fails loudly + emits drift event (no silent mis-map).
- No LLM call occurs in the per-record execution path (assert via logs/metrics).
- Approval binding rejects a tampered/swapped mapper.

## 10. Explicit non-goals / cautions

- **Not** "zero-touch automatic ingestion." That promise is what makes integration platforms never ship. The win is *minimal declarative mapping into a strict contract*, generated and self-tested — not magic.
- The mapping agent is the universal **mapper**, **not** the universal **pipe**. It writes the adapter; it is never the runtime adapter.
- Liveness/cost monitoring (Layer 3: network model-call observation + per-provider cost adapters) is a **separate** workstream; do not fuse it into the UDA. Specced in §11.

## 11. Layer 3 — Agent Work & Cost Monitoring (the "physics of agent work")

**Principle:** measure agent work as a conserved physical quantity at a boundary the agent *cannot avoid crossing* — never as a status the agent self-reports. A self-reporting monitor is blind to exactly the failure it must catch: a stuck agent reports nothing.

### 11.1 The conserved quantity

An agent does exactly one kind of irreducible, expensive, measurable work: it moves a prompt to a model and gets tokens back. Everything else (tool calls, file edits, fetches) is ordinary compute. Therefore:
- **Unit of agent work = the token** (input + output).
- **Quantum of work = one model round-trip** (the inference call).

### 11.2 The three measurable properties of each quantum

For every observed model call, capture a tuple:
`{ agentId, taskId, modelId, provider, inputTokens, outputTokens, startTs, endTs, status }`

From that tuple, the physics maps as:
| Physical analogue | Measured as |
|---|---|
| Work done | tokens consumed (in + out) |
| Time | round-trip latency (`endTs - startTs`) |
| Power (rate of work) | tokens / second |
| Direction / attribution | agentId → modelId, for taskId |
| Cost | `inputTokens × priceIn + outputTokens × priceOut` (per-model price table) |
| Liveness | presence/absence of a quantum within an expected interval |

### 11.3 Derived metrics

- **Cumulative cost** per agent / task / tenant / window = sum over tuples.
- **Throughput** = tokens/sec.
- **Efficiency (the key health metric)** = useful output (tasks completed) per token spent. High token burn with **no** task-completion events = the signature of a looping/thrashing/confused agent. Only visible because Layer 3 (token boundary) is correlated with the agent-state event log (task-completion boundary).
- **Stall detection** = a `claimed` task with an open or no model call past its deadline → stalled. Silence at the token boundary *is* the stall measurement.

### 11.4 Measurement boundary (where to meter)

- **Inference gateway / proxy** that all agent model traffic routes through — the one place to meter tokens, latency, and liveness **without touching agent code** (integration-friendly; same philosophy as the UDA).
- Captured signal is emitted as **typed events** onto the substrate log (`agent.work.quantum`, `agent.work.stall`), so monitoring data lives in the same hash-chained ledger as everything else — not a separate observability tower.

### 11.5 Honest caveats

- **Price/usage is not universal.** Each provider reports token usage differently and prices differently → needs a bounded **per-provider usage parser + price table** (~6 providers cover the market). Magnitude (tokens) is near-universal; magnitude→cost conversion is per-provider.
- **Local models with no network hop** make the token boundary go quiet → fall back to process/GPU-level signals. For hosted models, the gateway sees everything involuntarily.
- Encrypted traffic not terminated at the proxy: you still get timing + size + (often) provider usage API, but not content.

### 11.6 Build order (Layer 3, independent of UDA milestones)

1. **L3-M1** — `AgentWorkQuantum` event type in `@pm/types` + ingest of the tuple onto the event log.
2. **L3-M2** — per-provider price table + usage parsers (start with the providers actually in use).
3. **L3-M3** — inference gateway/proxy that meters real agent traffic and emits `agent.work.quantum` events.
4. **L3-M4** — derived projections: cost-by-agent/task/tenant, throughput, efficiency, stall detection.
5. **L3-M5** — dashboard panel: live cost + liveness + efficiency, every number traceable to the underlying quanta.

### 11.7 Falsification criteria (Layer 3)

- A deliberately stalled agent (hangs after `claimed`) is flagged **without** any self-report from it.
- Summed per-tuple cost matches the provider's billed usage within tolerance.
- A looping agent (high tokens, zero task-completions) is surfaced by the efficiency metric.
- No agent code modification is required for a hosted-model agent to be measured.
