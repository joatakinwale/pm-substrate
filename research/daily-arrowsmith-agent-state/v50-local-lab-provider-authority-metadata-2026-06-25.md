# v50 Local-Lab Provider Authority Metadata

Date: 2026-06-25
Status: implemented Axis C authority metadata slice, not verified solution

## Question Ledger

| Eliminated question | Paper-backed answer | Code bridge | Replacement question |
| --- | --- | --- | --- |
| RQ51: How should Axis A and Axis C accepted outcome packets acquire real provider-status-bearing authority metadata in runner-produced packets, so store-derived `authorityRecoveries` can pass the strict proof-packet gate instead of only reporting missing-provider-status gaps? | Proof-carrying code says the producer must ship checkable safety material, but the consumer validates it against local policy. Execution-monitoring work says accepted actions must be justified by monitor-observed trace state, not by retrospective summaries. Distributed trust/authentication work says principal, delegation, and credential state must be explicit enough for the receiver to verify who speaks for the action. Clark-Wilson integrity says operational writes should be mediated by certified transformation procedures rather than arbitrary subjects. Therefore accepted runner-produced outcome packets need provider certificate id, certificate digest, and the exact status ref checked at decision time embedded in the canonical packet hash payload. Recovery may read and validate that material, but must not synthesize it. | Added `buildActionOutcomeProviderAuthority()` to `@pm/agent-state` as a reusable authority-metadata constructor. Added a default local-agent-lab authority provider in `@pm/local-agent-lab` and wired accepted dynamic packets to include provider certificate/status metadata while blocked packets carry no write authority. Added equivalent provider-status metadata to deterministic local-lab accepted packets. Added tests proving accepted packets carry status refs, blocked packets do not, and deterministic local-lab strict authority recovery yields one accepted recovery plus two terminal refusals. | RQ52: How should Axis A and Axis C runner-generated `authorityRecoveries` be passed into `buildThreeAxisProofPacket({ requireAuthorityRecovery: true })` so the proof packet consumes store-derived recoveries, preserves Axis B blockers, and refuses verified status when a runner lacks persistence or strict recovery output? |

## Bridge Hypothesis

Accepted terminal packets should be proof-bearing at the point they are built:

```text
terminal outcome accepted
  -> provider certificate id/digest
  -> provider certificate status ref checkedAt decision time
  -> canonical ActionOutcomeEnvelope hash payload
  -> packet store recovery
  -> strict graph authority recovery
```

Blocked terminal packets should not gain authority metadata merely because they are useful evidence. They should recover as terminal refusals.

## Falsification Criteria

1. `@pm/agent-state` must provide one reusable authority-metadata shape instead of per-fixture hand assembly.
2. Accepted local-agent-lab packets must include provider certificate id/digest/status refs in the canonical packet.
3. Blocked local-agent-lab packets must not expose accepted write authority.
4. Strict local-lab authority recovery must pass from generated packets, not synthetic authority refs.
5. Runner execution without `PM_DATABASE_URL` must not be treated as persisted strict recovery proof.

## Implementation

- Added `ActionOutcomeProviderAuthority`, `ActionOutcomeProviderAuthorityInput`, and `buildActionOutcomeProviderAuthority()` in `packages/agent-state/src/index.ts`.
- Added `defaultLocalAgentLabActionOutcomeAuthorityProvider` and optional `EngineConfig.actionOutcomeAuthorityProvider` in `packages/local-agent-lab/src/engine.ts`.
- Updated `buildLocalAgentLabActionOutcomeEnvelope()` so accepted dynamic Axis C packets carry local-lab terminal provider metadata and a status-check ref.
- Updated deterministic `packages/evals/src/local-lab.ts` accepted packets with local-lab provider metadata.
- Added unit and strict recovery tests in `packages/agent-state`, `packages/local-agent-lab`, and `packages/evals`.

## Axis Status

| Axis | Status |
| --- | --- |
| Axis A finance | Partially improved from prior work: ArrowHedge accepted replay packets already carry provider-status metadata. A full Axis A runner-to-proof-packet authority-recovery path is still open. |
| Axis B marketing | Blocked. This work does not restore PluggedInSocial or add accepted authoritative agency fixtures. |
| Axis C local lab | Improved. Deterministic and dynamic accepted local-lab packets now carry provider-status metadata, blocked packets do not become authority, and deterministic strict recovery passes over generated packets. Live DB-backed recovery still requires `PM_DATABASE_URL` at runner time. |

## Verification

```text
pnpm --filter @pm/agent-state typecheck
pnpm --filter @pm/evals typecheck
pnpm --filter @pm/local-agent-lab typecheck
pnpm exec vitest run packages/agent-state/src/index.test.ts packages/local-agent-lab/src/engine.test.ts packages/evals/src/local-lab.test.ts packages/evals/src/authority-recovery.test.ts
pnpm exec tsx scripts/run-local-lab-evals.ts
```

## Sources

- Necula, G. C. (1997). "Proof-Carrying Code." POPL 1997. https://doi.org/10.1145/263699.263712
- Schneider, F. B. (2000). "Enforceable Security Policies." ACM Transactions on Information and System Security. https://doi.org/10.1145/353323.353382
- Havelund, K., & Rosu, G. (2002). "Synthesizing Monitors for Safety Properties." TACAS 2002. https://doi.org/10.1007/3-540-46002-0_24
- Blaze, M., Feigenbaum, J., & Lacy, J. (1996). "Decentralized Trust Management." IEEE Symposium on Security and Privacy. https://doi.org/10.1109/SECPRI.1996.502679
- Lampson, B., Abadi, M., Burrows, M., & Wobber, E. (1992). "Authentication in Distributed Systems: Theory and Practice." ACM Transactions on Computer Systems. https://doi.org/10.1145/138873.138874
- Clark, D. D., & Wilson, D. R. (1987). "A Comparison of Commercial and Military Computer Security Policies." IEEE Symposium on Security and Privacy. https://doi.org/10.1109/SP.1987.10001
