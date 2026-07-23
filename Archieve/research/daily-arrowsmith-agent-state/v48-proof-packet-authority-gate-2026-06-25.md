# v48 Proof Packet Authority Gate

Date: 2026-06-25
Status: implemented primitive, not verified solution

## Question Ledger

| Eliminated question | Paper-backed answer | Code bridge | Replacement question |
| --- | --- | --- | --- |
| RQ49: How should Axis A and Axis C live/scenario runners promote `auditEvalEventGraphWriteAuthority()` from a sidecar audit into required runner gates and proof-packet inputs without letting blocked Axis B, blocked terminal outcomes, or accepted packets missing provider status count as verified cells? | Proof-carrying-code work gives the right shape: the consumer should not trust a producer's claim that code is safe; it should require a machine-checkable proof and validate it against the consumer's safety policy. Runtime-enforcement and runtime-verification papers add that monitor results must be tied to the execution trace/action boundary, not summarized later. Model checking strengthens the stop condition: a verification claim depends on checking the model/trace against the property, not on the idea sounding right. ARIES keeps the proof restart-safe: the proof input must be recoverable from durable records. Therefore proof packets should have an explicit authority-recovery gate. If enabled, a packet cannot be `verified` merely because cells have terminal refs; every terminal-proof-backed event must have a valid authority recovery with the expected status: accepted writes require `accepted_authority_recovered`, while blocked terminal outcomes require `terminal_outcome_refused_authority`. Missing, invalid, or wrong-status recoveries make the proof packet unverified. | Added `authorityRecoveries` and `requireAuthorityRecovery` to `buildThreeAxisProofPacket()`. Added `ThreeAxisAuthorityRecoveryGate` and obligations over terminal-proof-backed EvalEvents. When strict recovery is required, proof packets can only remain verified if all obligations have valid recoveries with expected statuses. Tests prove a 60-event all-axis fixture becomes unverified when recoveries are missing, becomes verified when recoveries are valid, and rejects a blocked terminal outcome that masquerades as accepted authority. | RQ50: How should Axis A and Axis C live/scenario runner scripts generate `authorityRecoveries` from real `PostgresEvalEventStore` packet recovery plus `graphWriteAuthorityResolverFromWorkflowEnvelopeStore()` calls during persistence, so proof packets consume store-derived recoveries rather than synthetic test recoveries? |

## Bridge Hypothesis

`ThreeAxisProofPacket` should be a proof consumer, not an authority producer. Its stricter mode should say:

```text
terminal-proof-backed EvalEvent
  + valid authority-recovery audit with expected terminal status
  -> proof-packet cell may remain verified

terminal-proof-backed EvalEvent
  + missing/invalid/wrong-status authority recovery
  -> proof-packet status is unverified
```

This preserves the user's correction: implementation research improves the substrate codebase by making proof-packet verification stricter; it does not pretend that the testing axis itself is the substrate primitive.

## Falsification Criteria

1. A three-axis fixture that otherwise verifies must become `unverified` when `requireAuthorityRecovery` is true and recoveries are missing.
2. The same fixture must become `verified` when all authority recoveries are valid and have expected statuses.
3. A blocked terminal outcome with `accepted_authority_recovered` must be rejected as a wrong-status recovery.
4. Existing proof packets must remain backward compatible unless strict recovery is explicitly required.

## Implementation

- Added `authorityRecoveries?: EvalGraphWriteAuthorityRecovery[]` and `requireAuthorityRecovery?: boolean` to proof-packet input.
- Added `ThreeAxisAuthorityRecoveryGate` and `ThreeAxisAuthorityRecoveryObligation`.
- Added an authority-recovery gate to `ThreeAxisProofPacket`.
- Exported the new proof-packet gate types.
- Added proof-packet tests for missing recovery, valid recovery, and blocked-outcome wrong-status rejection.

## Axis Status

| Axis | Status |
| --- | --- |
| Axis A finance | Improved. Proof packets can now require strict authority recoveries for terminal-proof-backed finance events. Actual runner scripts still need to generate recoveries from live/replay stores. |
| Axis B marketing | Blocked. The gate does not unblock missing PluggedInSocial or authoritative agency fixtures. |
| Axis C local lab | Improved. Proof packets can require blocked terminal outcomes to carry refusal recoveries instead of accepted authority. Dynamic live runners still need to generate those recoveries during persistence. |

## Sources

- Necula, G. C. (1997). "Proof-Carrying Code." POPL 1997. https://doi.org/10.1145/263699.263712
- Schneider, F. B. (2000). "Enforceable Security Policies." ACM Transactions on Information and System Security. https://doi.org/10.1145/353323.353382
- Havelund, K., & Rosu, G. (2002). "Synthesizing Monitors for Safety Properties." TACAS 2002. https://doi.org/10.1007/3-540-46002-0_24
- Clarke, E. M., Emerson, E. A., & Sifakis, J. (2009). "Model checking: algorithmic verification and debugging." Communications of the ACM. https://doi.org/10.1145/1592761.1592781
- Mohan, C., Haderle, D., Lindsay, B., Pirahesh, H., & Schwarz, P. (1992). "ARIES: A Transaction Recovery Method Supporting Fine-Granularity Locking and Partial Rollbacks Using Write-Ahead Logging." ACM Transactions on Database Systems. https://doi.org/10.1145/128765.128770
