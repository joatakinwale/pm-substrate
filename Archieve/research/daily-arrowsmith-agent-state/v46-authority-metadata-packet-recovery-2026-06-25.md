# v46 - Authority Metadata Packet Recovery

Date: 2026-06-25
Status: implementation progress; full three-axis solution remains unverified.

Active question set entering this run: RQ12-RQ20, RQ47.

## Answered Question

| Question | Paper-backed answer | Codebase result | Replacement |
| --- | --- | --- | --- |
| RQ47: How should canonical `ActionOutcomeEnvelope` packet stores preserve or recover workflow authority metadata, especially provider certificate status refs, so strict graph write authority can be reconstructed after amnesiac resume without retaining workflow-only memory? | Data-provenance and lineage work distinguishes a derived view from the source records and transformation path that make the view trustworthy. Secure provenance work adds that history must be integrity-protected and replayable, not reconstructed from a process-local cache. Therefore the canonical terminal packet must carry the provider certificate id/digest/status ref used at the decision boundary, and the packet store must expose a recovery shape compatible with graph write-authority resolution. A recovered packet that only says "accepted" but drops the provider-status event is not sufficient for strict `requireProviderCertificateStatusRef` policy after amnesiac resume. | Added optional provider certificate id, digest, and status-ref fields to canonical `ActionOutcomeEnvelope` and its hash payload. Updated workflow promotion to carry those fields from workflow envelopes into canonical packets. Added those fields to role-projection invariant cores and validation so projection cannot hide or alter provider status. Added `PostgresEvalEventStore.getWorkflowActionOutcomeEnvelope()` and structural recovery types so packet stores can return a workflow-authority envelope shape by tenant/envelope id, including provider status refs, without importing capability-kit. Added tests proving promotion, projection validation, and eval packet recovery preserve provider status refs. | RQ48: How should Axis A and Axis C runners compose `PostgresEvalEventStore.getWorkflowActionOutcomeEnvelope()` with `graphWriteAuthorityResolverFromWorkflowEnvelopeStore()` and strict graph/capability policies to emit EvalEvents proving end-to-end authority reconstruction, while Axis B remains explicitly blocked? |

Active question set leaving this run: RQ12-RQ20, RQ48.

## Peer-Reviewed Sources

- Peter Buneman, Sanjeev Khanna, and Wang-Chiew Tan, "Why and Where: A Characterization of Data Provenance," ICDT 2001. DOI: https://doi.org/10.1007/3-540-44503-X_20. PDF: https://homepages.inf.ed.ac.uk/opb/papers/ICDT2001.pdf
- Yingwei Cui and Jennifer Widom, "Practical Lineage Tracing in Data Warehouses," ICDE 2000. DOI: https://doi.org/10.1109/ICDE.2000.839437.
- Ragib Hasan, Radu Sion, and Marianne Winslett, "The Case of the Fake Picasso: Preventing History Forgery with Secure Provenance," FAST 2009. https://www.usenix.org/conference/fast09/technical-sessions/presentation/hasan
- Boris Glavic and Gustavo Alonso, "Perm: Processing Provenance and Data on the Same Data Model through Query Rewriting," ICDE 2009. DOI: https://doi.org/10.1109/ICDE.2009.15.

## Bridge Hypothesis

Authority metadata is part of the canonical terminal packet's lineage:

```text
workflow envelope provider-status ref
  -> canonical ActionOutcomeEnvelope hash payload
  -> packet store recovery by tenant/envelope id
  -> graph write-authority envelope shape
  -> strict capability/graph resolver after amnesiac resume
```

The packet store does not become the source of operational truth by itself. It becomes replayable evidence that the terminal packet still contains the authority metadata required to reconstruct strict graph write authority.

## Falsification Criteria

The v46 slice fails if:

1. workflow promotion drops provider certificate id, digest, or status-event refs;
2. the provider status ref is outside the canonical outcome hash payload;
3. a role projection can alter provider status without validation failure;
4. packet-store recovery returns only terminal outcome and action id but not provider status refs;
5. evals must import capability-kit to expose a graph-authority recovery shape;
6. this recovery primitive is claimed as three-axis proof before Axis A/C runners compose it with strict policies and EvalEvents.

## Implementation Delta

- Added `ActionOutcomeProviderCertificateStatusRef`.
- Added optional `providerCertificateId`, `providerCertificateDigest`, and `providerCertificateStatusRef` to canonical `ActionOutcomeEnvelope` and `ActionOutcomeEnvelopeInput`.
- Added matching optional fields to `WorkflowInvocationActionOutcomeEnvelopeSource`.
- Updated `buildActionOutcomeEnvelope()` and `promoteWorkflowInvocationOutcomeEnvelope()` to include provider authority metadata in the canonical hash payload.
- Added provider authority metadata to `ActionOutcomeInvariantCore`, role projection, and projection validation.
- Added `WorkflowGraphWriteAuthorityEnvelopeLookup`, `WorkflowGraphWriteAuthorityProviderCertificateStatusRef`, and `WorkflowGraphWriteAuthorityEnvelopePacket` in eval persistence.
- Added `PostgresEvalEventStore.getWorkflowActionOutcomeEnvelope()` as a structural recovery method compatible with capability-kit store-backed authority resolution.
- Added tests for workflow promotion, role-projection tamper detection, and packet-store recovery of provider status refs.

## Proof Status

Focused verification passed:

```text
pnpm --filter @pm/agent-state typecheck
pnpm --filter @pm/evals typecheck
pnpm exec vitest run packages/agent-state/src/external-evidence.test.ts packages/evals/src/persistence/persistence.test.ts
```

Current three-axis state:

| Axis | Status |
| --- | --- |
| Axis A finance | Authority metadata can now survive canonical packet recovery, but ArrowHedge runners still need to compose the recovery method with strict graph/capability policies. |
| Axis B marketing | Still blocked for full verification until PluggedInSocial is restored or accepted authoritative agency fixtures are run. |
| Axis C local lab | Local-lab packet stores can now expose the authority shape, but dynamic local-lab strict-policy execution remains unwired. |

No verified solution is claimed.
