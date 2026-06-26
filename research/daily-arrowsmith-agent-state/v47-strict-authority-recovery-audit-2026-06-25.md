# v47 Strict Authority Recovery Audit

Date: 2026-06-25
Status: implemented primitive, not verified solution

## Question Ledger

| Eliminated question | Paper-backed answer | Code bridge | Replacement question |
| --- | --- | --- | --- |
| RQ48: How should Axis A and Axis C runners compose `PostgresEvalEventStore.getWorkflowActionOutcomeEnvelope()` with `graphWriteAuthorityResolverFromWorkflowEnvelopeStore()` and strict graph/capability policies to emit EvalEvents proving end-to-end authority reconstruction, while Axis B remains explicitly blocked? | The composition belongs at the mutation-admission/audit boundary, not in the verifier narrative. Clark-Wilson integrity requires well-formed transactions and controlled transformation procedures. Schneider's execution-monitor model says enforceable safety policy must observe and suppress invalid actions at execution time. Havelund/Rosu runtime monitors make the safety property executable over traces rather than prose. ARIES recovery shows restart correctness depends on durable log/packet state, not volatile runtime memory. Therefore runners should first recover the durable packet, then use the same store-backed capability resolver that write paths use, then validate the recovered authority under strict graph policy. Accepted packets must pass provider-status and substrate-record checks. Non-accepted packets must be recovered but refuse authority. Missing packets, ambiguous refs, missing provider status, or resolver rejection remain failures, not blocked successes. | Added `auditEvalEventGraphWriteAuthority()` in `@pm/evals`, a structural audit primitive over EvalEvents, packet stores, authority resolvers, and strict graph policy. It recovers the packet via the store, composes with a resolver such as `graphWriteAuthorityResolverFromWorkflowEnvelopeStore()`, validates `GraphWriteAuthorityPolicy`, and distinguishes accepted recovered authority from protective refusal of blocked packets. Added provider certificate status metadata to the accepted ArrowHedge write-binding replay packet and regenerated the golden JSONL. Added tests proving Axis A accepted packet recovery passes strict policy, Axis C blocked packet recovery refuses authority, and accepted packets missing provider-status metadata fail strict policy. | RQ49: How should Axis A and Axis C live/scenario runners promote `auditEvalEventGraphWriteAuthority()` from a sidecar audit into required runner gates and proof-packet inputs without letting blocked Axis B, blocked terminal outcomes, or accepted packets missing provider status count as verified cells? |

## Bridge Hypothesis

Strict graph authority recovery is a three-step executable monitor:

```text
EvalEvent action_outcome_envelope ref
  -> durable ActionOutcomeEnvelope packet recovery
  -> store-backed workflow-envelope resolver
  -> strict GraphWriteAuthorityPolicy validation
```

This is not a new source of authority. It is a way to prove that the same authority bundle used by write-capable capability paths can be reconstructed after amnesiac resume from substrate packet refs.

## Falsification Criteria

1. An accepted packet with provider certificate status metadata must recover into a matched authority ref and substrate record under `requireAuthorityRef`, `requireProviderCertificateStatusRef`, and `requireSubstrateRecord`.
2. A blocked packet must be recoverable but must not authorize a graph write.
3. An accepted packet without provider certificate status metadata must fail strict policy.
4. Missing or ambiguous `action_outcome_envelope` refs must fail the audit.

## Implementation

- Added `packages/evals/src/authority-recovery.ts`.
- Exported authority-recovery audit types from `@pm/evals`.
- Added `@pm/graph` as an eval runtime dependency and `@pm/capability-kit` as an eval test dependency.
- Exported `InvocationActionOutcomeProviderCertificateStatusRef` from `@pm/workflow`.
- Added provider certificate id/digest/status-ref metadata to the accepted ArrowHedge write-binding replay packet.
- Regenerated `packages/evals/fixtures/write-binding-replay.v1.jsonl`.
- Added tests in `packages/evals/src/authority-recovery.test.ts` and strengthened `write-binding.test.ts`.

## Axis Status

| Axis | Status |
| --- | --- |
| Axis A finance | Improved. The accepted ArrowHedge replay packet now carries provider-status metadata and a strict audit proves packet recovery plus capability-kit resolver composition can satisfy graph authority policy. Axis A still lacks all ten failure classes as strict runner-gated cells. |
| Axis B marketing | Blocked. No PluggedInSocial clone or accepted authoritative agency fixture run exists. This remains a whole-solution blocker. |
| Axis C local lab | Improved at the mechanism boundary. A blocked Axis C packet is recovered and shown to refuse authority. Dynamic live runners still need to call the audit as a required gate and accepted Axis C paths still need provider-status-bearing authority where writes are accepted. |

## Sources

- Clark, D. D., & Wilson, D. R. (1987). "A Comparison of Commercial and Military Computer Security Policies." IEEE Symposium on Security and Privacy. https://doi.org/10.1109/SP.1987.10001
- Schneider, F. B. (2000). "Enforceable Security Policies." ACM Transactions on Information and System Security. https://doi.org/10.1145/353323.353382
- Havelund, K., & Rosu, G. (2002). "Synthesizing Monitors for Safety Properties." TACAS 2002. https://doi.org/10.1007/3-540-46002-0_24
- Mohan, C., Haderle, D., Lindsay, B., Pirahesh, H., & Schwarz, P. (1992). "ARIES: A Transaction Recovery Method Supporting Fine-Granularity Locking and Partial Rollbacks Using Write-Ahead Logging." ACM Transactions on Database Systems. https://doi.org/10.1145/128765.128770
