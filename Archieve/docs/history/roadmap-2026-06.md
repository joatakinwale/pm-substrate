# Roadmap

Anchored to the rewrite thesis (`artifacts/pm_substrate_rewrite.md`) and the validation plan (`docs/validation.md`, T1–T8). Each milestone ends with a demonstrable artifact, not a promise. The wedding-era Phase 0–4 plan is retired; its proofs that survived (profile-agnostic substrate, capability isolation, Tier-1 tool portability) are now continuously enforced tests rather than phases.

## Done (verified by the suite — 387 tests, 0 skipped against a real DB)

- **Substrate skeleton** — graph, hash-chained event log, capability registry, workflow runtime, projections, tenants, profile registry, substrate-http (+ demo), all Postgres-only.
- **Two live profiles** — `finance-research` (ArrowHedge validation artifact) and `agency` (second-profile proof). Substrate profile-agnosticism and capability isolation enforced by always-on tests.
- **Plug-in pipeline v1** — declarative entity mappings, structural + profile-aware semantic validation, dry-run ingestion adapter, typed event contracts, write gates (T1/T2 implemented; T6 partial).
- **Agent operational state (pure primitives)** — `CurrentStateView`, `ObservationContract` v2 (integrity hash, holder binding, allowed use), warn-first `ActionProposalReview`, durable `StateReviewArtifact` + hash replay, observed read-set comparison, temporal-misalignment fixtures, invariant-class policy, multi-object role preconditions.
- **External evidence admission (pure)** — 22 evidence lanes (MCP, memory, monitoring, lineage, audit, attestation, traces, approvals, provider policy, custom stores, subagents, OBO, PM handoffs) with admission review, `evidence_only` authority status, fixture corpus, metrics, run groups, role projections, PM handoff agreement.
- **Selected write-binding gate** — opt-in workflow runtime mode `require_for_writes`, deterministic ArrowHedge write-binding replay corpus, catalog-verifier hook, and dashboard stream for allowed/unverified/missing/incomplete/policy-blocked write attempts.
- **Eval harness** — paired baseline/substrate local-lab scenarios, ArrowHedge corpus (incl. clean-current baseline), artifact-derived metrics.
- **Event-chain integrity fix** — monotonic `seq` ordering (migration 0019) closing the same-transaction chain-fork bug surfaced by the ArrowHedge DB proof.

## Now

1. **Runtime evidence wiring expansion** — the selected workflow gate now consumes state-review artifact ids, evidence-admission review ids, and explicit policy disposition before write-capable dispatch; next is to require that same binding across every external capability transport before broad mutation-governance claims.
2. **T4 amnesiac resume eval** — run session 1 against ArrowHedge, persist continuity checkpoints, delete chat context, resume from tenant/agent/scope; measure resume success and contradicted-claim avoidance.
3. **Plug-in metrics instrumentation** — time-to-plugin, substrate edit count, mapping coverage, validator rejection rate, wired into the eval harness so the plug-in claim has numbers (closes the half of the thesis with no research loop).
4. **Golden fixture persistence** — admission, state-review artifact, and write-binding JSONL corpora committed and replay-verified in CI.

## Next

5. **T6 completion** — ingest the same ArrowHedge scenario from JSON, CSV, and SQL-row exports; assert canonical equivalence.
6. **Live MCP admission lane** — exercise handle/annotation revalidation against a real MCP server (fixtures are pure today).
7. **PM distributed-state evals on real runs** — `comparePmHandoffAgreement` over actual multi-agent ArrowHedge sessions, not synthetic facets.
8. **T3 hardening** — deterministic risk gate output recorded and required by every decision write path, not only the ArrowHedge replay/runtime fixture.

## Later

- Second external platform onboarding (beyond ArrowHedge) to measure time-to-plugin on a system we don't control.
- Day-365 swaps when triggers fire: bus → Kafka/Redpanda (~10k events/sec sustained), search → OpenSearch, analytics → ClickHouse, read replicas.

## Out of scope (deliberately)

No multi-region; no managed-service abstractions; no GraphQL; schema-per-tenant only if a real tenant requires it; no real-trading path in the sandbox.
