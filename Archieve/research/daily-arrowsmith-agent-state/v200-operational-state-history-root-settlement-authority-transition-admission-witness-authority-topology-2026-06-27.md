# v200 Operational State History-Root Settlement Authority-Transition Admission Witness Authority Topology

Date: 2026-06-27
Question closed: SQ147
Research lane: substrate discovery, recovered operational state, history-root settlement transparency, nested witness authority accountability

## Question

What witness authority topology, signature, or finality rule makes history-root settlement authority-transition admission witness certificates accountable instead of certificate-local witness rows?

## Existing Substrate Map

- v160 adds history-root settlement records so recovered store roots can require replayed settlement certificates.
- v170 adds history-root settlement authority topology so settlement certificates bind to replayed active principals and thresholds.
- v180 adds history-root settlement authority-transition admission records so settlement authority topology can replay from admitted authority-transition history.
- v190 adds history-root settlement authority-transition admission witness records so the latest settlement-authority transition admission row is witnessed by a separate hash-linked ledger.
- v199 proves the same nested witness-authority topology gap in the recovery-cut lane and supplies the implementation pattern.
- Migration `0107` persists history-root settlement authority-transition admission witness rows.

## Missing Substrate Map

Strict recovery transparency could require history-root settlement authority-transition admission witness records, but the certificates inside that witness ledger still named accepted witnesses locally. That proved the transition-admission row had a certificate, not that the certificate's signers were replayed authority.

This left a recovery-root authority leak: after amnesia, an agent could accept a cached or summarized history-root settlement transition-admission witness certificate whose `acceptedWitnessIds` were private representation rather than admitted topology state.

The missing substrate primitive is a history-root settlement transition-admission witness authority topology: the witness certificates for history-root settlement authority-transition admission witness records must bind to a replayed topology hash and count only unique active principals from that topology.

## Arrowsmith Bridge

A literature: agent resume, memory drift, stale connector state, and local transparency snapshots become operational-state failures when a local certificate's signer list is treated as authority.

B bridge: Byzantine quorum systems separate quorum membership and thresholds from a single operation; key transparency systems make directory state replayable and consistency-checkable; witness cosigning makes an authority statement accountable only through independently authorized witnesses.

C literature:

- Malkhi and Reiter, "Byzantine Quorum Systems" (Distributed Computing 1998), https://link.springer.com/article/10.1007/s004460050050
- Melara et al., "CONIKS: Bringing Key Transparency to End Users" (USENIX Security 2015), https://www.usenix.org/conference/usenixsecurity15/technical-sessions/presentation/melara
- Syta et al., "Keeping Authorities Honest or Bust with Decentralized Witness Cosigning" (IEEE S&P 2016), https://www.ieee-security.org/TC/SP2016/program-papers.html

Mechanism extracted: a certificate's witness list is an assertion, not authority. Authority is replayed membership plus threshold state; the certificate becomes admissible only when its subject, topology hash, unique active witnesses, and quorum threshold all verify under that replayed state.

## Primitive Proposal

Name: history-root settlement transition-admission witness authority topology.

Problem it solves: history-root settlement authority-transition admission witness certificates could self-authorize through certificate-local accepted witness ids.

Research source: Byzantine quorum systems, CONIKS/key transparency, and decentralized witness cosigning.

Mechanism borrowed or adapted: verifier-visible replay of signer-set membership and threshold state before a certificate may count toward current operational state.

Why current substrate lacks it: v190 replayed a witness ledger over exact transition-admission record hashes, but did not bind the witness certificates' accepted witness ids to a replayed topology.

Why existing primitives are insufficient: settlement records, settlement authority topology, admitted settlement authority transitions, and transition-admission witness records each narrow the recovery-root boundary, but none made the transition-admission witness certificates' signer set accountable.

State guarantee it should create: strict recovered operational state cannot consume history-root settlement authority-transition admission witness certificates unless the certificate topology hash matches a replayed witness authority topology and unique active topology principals satisfy quorum.

Admission rule it requires: transition-admission replay can require `requireAdmissionWitnessAuthorityTopology`; root settlement replay can require `requireSettlementAuthorityTransitionAdmissionWitnessAuthorityTopology`; recovery transparency and action review can require `requireRecoveryTransparencyRootSettlementAuthorityTransitionAdmissionWitnessAuthorityTopology`.

Replay rule it requires: transition-admission witness replay verifies topology hash, tenant, scope, threshold presence, certificate topology hash, duplicate witnesses, unknown witnesses, inactive witnesses, and replayed topology quorum.

Authority boundary it requires: witness certificates must use `operational_state_history_root_settlement_authority_transition_admission_witness` and subject kind `operational_state_history_root_settlement_authority_transition_admission_record`, while signer membership comes from a separate history-root settlement transition-admission witness authority topology.

Failure modes it should prevent:

- A certificate-local witness id list authorizes history-root settlement authority-transition admission state.
- Duplicate witness ids satisfy quorum.
- Unknown or suspended witness ids satisfy quorum.
- A certificate binds to a private-memory topology hash instead of the replayed topology hash.
- Blocking action review accepts recovered state whose history-root settlement transition-admission witness certificate lacks topology-bound authority.

Minimal implementation slice:

- Extend history-root settlement transition-admission witness replay with `witnessAuthorityTopology` and `requireWitnessAuthorityTopology`.
- Extend history-root settlement transition-admission replay with `requireAdmissionWitnessAuthorityTopology`.
- Extend root settlement replay, recovery transparency evaluation, and action review with strict nested witness-authority-topology requirements.
- Add issue codes for missing/tampered/mismatched nested topology and unauthorized nested witnesses.
- Add migration `0117_agent_state_history_root_settlement_authority_transition_admission_witness_authority_transitions.sql`.
- Add focused falsification tests for valid topology-bound certificates, missing topology, certificate-local rows, unknown witnesses, duplicate witnesses, suspended witnesses, and wrong topology hash.

## Falsification Criteria

The primitive is falsified if any of these pass as valid under strict mode:

1. `replayOperationalStateHistoryRootSettlementAuthorityTransitionAdmissionWitnessRecords({ requireWitnessAuthorityTopology: true })` with no witness authority topology.
2. `replayOperationalStateHistoryRootSettlementAuthorityTransitionAdmissionRecords({ requireAdmissionWitnessAuthorityTopology: true })` with a witness ledger that has only certificate-local accepted witness ids.
3. `replayOperationalStateHistoryRootSettlementRecords({ requireSettlementAuthorityTransitionAdmissionWitnessAuthorityTopology: true })` with a nested transition-admission witness ledger that lacks topology-bound authority.
4. `evaluateOperationalStateRecoveryCutTransparency({ requireRootSettlementAuthorityTransitionAdmissionWitnessAuthorityTopology: true })` with root settlement replay whose nested witness authority is certificate-local.
5. A transition-admission witness certificate whose `authorityTopologyHash` differs from the replayed witness authority topology hash.
6. A transition-admission witness certificate whose accepted witness ids contain duplicates, unknown principals, or inactive principals but still satisfies quorum.
7. Blocking action review accepts recovered state when history-root settlement nested transition-admission witness authority is absent or certificate-local.

## Implementation Result

Implemented in `@pm/agent-state`:

- `OperationalStateHistoryRootSettlementAuthorityTransitionAdmissionWitnessReplayInput.witnessAuthorityTopology`
- `OperationalStateHistoryRootSettlementAuthorityTransitionAdmissionWitnessReplayInput.requireWitnessAuthorityTopology`
- `OperationalStateHistoryRootSettlementAuthorityTransitionAdmissionWitnessReplay.witnessAuthorityTopology`
- `OperationalStateHistoryRootSettlementAuthorityTransitionAdmissionReplayInput.requireAdmissionWitnessAuthorityTopology`
- `OperationalStateHistoryRootSettlementReplayInput.requireSettlementAuthorityTransitionAdmissionWitnessAuthorityTopology`
- `OperationalStateRecoveryCutTransparencyEvaluationInput.requireRootSettlementAuthorityTransitionAdmissionWitnessAuthorityTopology`
- `ActionProposalReviewOptions.requireRecoveryTransparencyRootSettlementAuthorityTransitionAdmissionWitnessAuthorityTopology`
- Nested history-root settlement transition-admission witness topology issue codes and quorum checks.
- Migration `0117_agent_state_history_root_settlement_authority_transition_admission_witness_authority_transitions.sql`.

## Axis Surfaces

Axis surfaces are validation wind tunnels only:

- Axis A can require topology-bound history-root settlement transition-admission witness certificates before finance recovery transparency can authorize action.
- Axis B can require the same nested topology proof for future domain-adapter recovery transparency.
- Axis C can simulate an amnesiac local agent attempting to resume from cached history-root settlement transition-admission witness certificates whose signer set is not replayed authority.

No axis-only work was counted as substrate progress in this loop.

## Active 10-Question Backlog

1. SQ148: What witness authority topology, signature, or finality rule makes pruning-policy admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?
2. SQ149: What witness authority topology, signature, or finality rule makes storage mutation guard authorization admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?
3. SQ150: What witness authority topology, signature, or finality rule makes tombstone-history checkpoint admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?
4. SQ151: What witness authority topology, signature, or finality rule makes witness-ledger checkpoint admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?
5. SQ152: What witness authority topology, signature, or finality rule makes proof-record admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?
6. SQ153: What witness authority topology, signature, or finality rule makes authority-topology checkpoint admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?
7. SQ154: What witness authority topology, signature, or finality rule makes signature-verifier proof admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?
8. SQ155: What witness authority topology, signature, or finality rule makes authority epoch seal finalizer-proof admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?
9. SQ156: What admission, witness, or finality rule makes recovery-cut admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?
10. SQ157: What admission, witness, or finality rule makes history-root settlement authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?

## Failed Assumption Ledger

- Failed assumption: a hash-linked history-root settlement transition-admission witness ledger is enough accountability for recovery-root transparency. It is not; witness certificates inside that ledger also need replayed authority topology.
- Failed assumption: certificate `acceptedWitnessIds` can stand in for authority membership. They cannot; they are claims that must be checked against replayed topology state.

## Proof Status

Focused verification passed before ledger updates:

- `pnpm vitest run packages/agent-state/src/index.test.ts -t "history-root settlement authority-transition admission witness"`: 1 passed, 217 skipped
- `pnpm typecheck`

Full verification passed after ledger updates:

- `git diff --check`
- `pnpm typecheck`
- `pnpm test`: 622 passed, 143 skipped
