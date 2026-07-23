# v199 Operational State Recovery-Cut Admission Witness Authority-Transition Admission Witness Authority Topology

Date: 2026-06-27
Question closed: SQ146
Research lane: substrate discovery, recovered operational state, recovery-cut admission witness authority accountability

## Question

What witness authority topology, signature, or finality rule makes recovery-cut admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?

## Existing Substrate Map

- v149 adds recovery-cut admission records so recovered state must replay through admitted recovery-cut history.
- v159 adds recovery-cut admission witness records so the latest recovery-cut admission row must be separately quorum-certified.
- v169 adds recovery-cut admission witness authority topology so recovery-cut admission witness certificates bind to replayed active principals and thresholds.
- v179 adds recovery-cut admission witness authority-transition admission records so witness topology can replay from admitted authority-transition history.
- v189 adds recovery-cut admission witness authority-transition admission witness records so the latest transition-admission row is witnessed by a separate hash-linked ledger.
- Migration `0106` persists recovery-cut admission witness authority-transition admission witness rows.

## Missing Substrate Map

Strict recovery-cut admission could require a witnessed transition-admission ledger, but the certificates inside that ledger still named accepted witnesses locally. The ledger could prove that some certificate claimed two witness ids; it did not prove those ids belonged to a replayed authority topology, were active, were unique, or satisfied an authority-scoped quorum.

That left a local-authority leak: an amnesiac agent could recover a valid-looking transition-admission witness certificate from a connector cache, worktree snapshot, or summary, and the accepted witness ids could act as operational authority without a replayed witness-authority basis.

The missing substrate primitive is a recovery-cut transition-admission witness authority topology: the witness certificates for recovery-cut admission witness authority-transition admission witness records must bind to a replayed topology hash and count only unique active principals from that topology.

## Arrowsmith Bridge

A literature: agent memory drift and resume discontinuity become operational-state failures when local certificates or cached witness rows are treated as authority.

B bridge: Byzantine quorum systems and dynamic quorum reconfiguration separate the authority set and quorum threshold from any single operation. Witness co-signing separates an authority's statement from independently operated witnesses, while PeerReview makes misbehavior accountable by replaying logs rather than trusting local claims.

C literature:

- Malkhi and Reiter, "Byzantine Quorum Systems" (Distributed Computing 1998), https://people.cs.umass.edu/~arun/cs691ee/reading/BQS97.pdf
- Alvisi et al., "Dynamic Byzantine Quorum Systems" (DSN 2000), https://users.ece.cmu.edu/~reiter/papers/2000/DSN.pdf
- Haeberlen et al., "PeerReview: Practical Accountability for Distributed Systems" (SOSP 2007), https://www.sigops.org/s/conferences/sosp/2007/papers/sosp118-haeberlen.pdf
- Syta et al., "Keeping Authorities Honest or Bust with Decentralized Witness Cosigning" (IEEE S&P 2016), https://dedis.cs.yale.edu/dissent/papers/witness.pdf

Mechanism extracted: a certificate's witness list is not authority. Authority comes from an independently replayable membership/threshold topology, and a certificate is accountable only if its subject, topology hash, unique active witnesses, and quorum threshold all verify under replay.

## Primitive Proposal

Name: recovery-cut transition-admission witness authority topology.

Problem it solves: recovery-cut admission witness authority-transition admission witness certificates could self-authorize through certificate-local accepted witness ids.

Research source: Byzantine quorum systems, dynamic Byzantine quorum reconfiguration, PeerReview accountable logs, and witness co-signing.

Mechanism borrowed or adapted: quorum membership and thresholds are replayed state separate from the operation being certified; witness cosignatures are accountable only when the witness set is independently known and current.

Why current substrate lacks it: v189 replayed transition-admission witness records, but did not bind their certificates to a replayed witness topology.

Why existing primitives are insufficient: recovery-cut admission witnesses, witness-authority topology, admitted topology transitions, and transition-admission witness ledgers each narrow the recovery boundary, but none made the transition-admission witness certificates' accepted witness ids accountable.

State guarantee it should create: strict recovered operational state cannot consume recovery-cut admission witness authority-transition admission witness certificates unless the certificate's topology hash matches a replayed witness authority topology and its unique active topology principals satisfy quorum.

Admission rule it requires: transition-admission replay can require `requireAdmissionWitnessAuthorityTopology`; recovery-cut witness replay and action review can require `requireWitnessAuthorityTransitionAdmissionWitnessAuthorityTopology`.

Replay rule it requires: transition-admission witness replay verifies topology hash, tenant, scope, threshold presence, certificate topology hash, duplicate witnesses, unknown witnesses, inactive witnesses, and replayed topology quorum.

Authority boundary it requires: witness certificates must use `operational_state_recovery_cut_admission_witness_authority_transition_admission_witness` and subject kind `operational_state_recovery_cut_admission_witness_authority_transition_admission_record`, while their signer set must come from a separate recovery-cut transition-admission witness authority topology.

Failure modes it should prevent:

- A certificate-local witness id list authorizes recovery-cut witness authority-transition admission state.
- Duplicate witness ids satisfy quorum.
- Unknown or suspended witness ids satisfy quorum.
- A certificate binds to a private-memory topology hash instead of the replayed topology hash.
- Blocking action review accepts recovered state whose nested transition-admission witness certificate lacks topology-bound authority.

Minimal implementation slice:

- Extend recovery-cut transition-admission witness replay with `witnessAuthorityTopology` and `requireWitnessAuthorityTopology`.
- Extend recovery-cut transition-admission replay with `requireAdmissionWitnessAuthorityTopology`.
- Extend recovery-cut witness replay, recovery-cut admission evaluation, and action review with strict nested witness-authority-topology requirements.
- Add issue codes for missing/tampered/mismatched nested topology and unauthorized nested witnesses.
- Add migration `0116_agent_state_recovery_cut_admission_witness_authority_transition_admission_witness_authority_transitions.sql`.
- Add focused falsification tests for valid topology-bound certificates, missing topology, certificate-local rows, unknown witnesses, duplicate witnesses, suspended witnesses, and wrong topology hash.

## Falsification Criteria

The primitive is falsified if any of these pass as valid under strict mode:

1. `replayOperationalStateRecoveryCutAdmissionWitnessAuthorityTransitionAdmissionWitnessRecords({ requireWitnessAuthorityTopology: true })` with no witness authority topology.
2. `replayOperationalStateRecoveryCutAdmissionWitnessAuthorityTransitionAdmissionRecords({ requireAdmissionWitnessAuthorityTopology: true })` with a witness ledger that has only certificate-local accepted witness ids.
3. `replayOperationalStateRecoveryCutAdmissionWitnessRecords({ requireWitnessAuthorityTransitionAdmissionWitnessAuthorityTopology: true })` with a nested transition-admission witness ledger that lacks topology-bound authority.
4. A transition-admission witness certificate whose `authorityTopologyHash` differs from the replayed witness authority topology hash.
5. A transition-admission witness certificate whose accepted witness ids contain duplicates, unknown principals, or inactive principals but still satisfies quorum.
6. Blocking action review accepts recovered state when nested transition-admission witness authority is absent or certificate-local.

## Implementation Result

Implemented in `@pm/agent-state`:

- `OperationalStateRecoveryCutAdmissionWitnessAuthorityTransitionAdmissionWitnessReplayInput.witnessAuthorityTopology`
- `OperationalStateRecoveryCutAdmissionWitnessAuthorityTransitionAdmissionWitnessReplayInput.requireWitnessAuthorityTopology`
- `OperationalStateRecoveryCutAdmissionWitnessAuthorityTransitionAdmissionWitnessReplay.witnessAuthorityTopology`
- `OperationalStateRecoveryCutAdmissionWitnessAuthorityTransitionAdmissionReplayInput.requireAdmissionWitnessAuthorityTopology`
- `OperationalStateRecoveryCutAdmissionWitnessReplayInput.requireWitnessAuthorityTransitionAdmissionWitnessAuthorityTopology`
- `OperationalStateRecoveryCutAdmissionEvaluationInput.requireAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTopology`
- `ActionProposalReviewOptions.requireRecoveryCutAdmissionWitnessAuthorityTransitionAdmissionWitnessAuthorityTopology`
- Nested recovery-cut transition-admission witness topology issue codes and quorum checks.
- Migration `0116_agent_state_recovery_cut_admission_witness_authority_transition_admission_witness_authority_transitions.sql`.

## Axis Surfaces

Axis surfaces are validation wind tunnels only:

- Axis A can later require topology-bound recovery-cut transition-admission witness certificates before finance-domain recovery state can authorize action.
- Axis B can require the same nested topology proof for future domain-adapter recovery admissions.
- Axis C can simulate an amnesiac local agent attempting to resume from cached transition-admission witness certificates whose signer set is not replayed authority.

No axis-only work was counted as substrate progress in this loop.

## Active 10-Question Backlog

1. SQ147: What witness authority topology, signature, or finality rule makes history-root settlement authority-transition admission witness certificates accountable instead of certificate-local witness rows?
2. SQ148: What witness authority topology, signature, or finality rule makes pruning-policy admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?
3. SQ149: What witness authority topology, signature, or finality rule makes storage mutation guard authorization admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?
4. SQ150: What witness authority topology, signature, or finality rule makes tombstone-history checkpoint admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?
5. SQ151: What witness authority topology, signature, or finality rule makes witness-ledger checkpoint admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?
6. SQ152: What witness authority topology, signature, or finality rule makes proof-record admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?
7. SQ153: What witness authority topology, signature, or finality rule makes authority-topology checkpoint admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?
8. SQ154: What witness authority topology, signature, or finality rule makes signature-verifier proof admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?
9. SQ155: What witness authority topology, signature, or finality rule makes authority epoch seal finalizer-proof admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?
10. SQ156: What admission, witness, or finality rule makes recovery-cut admission witness authority-transition admission witness authority-transition history accountable instead of self-authored topology rows?

## Failed Assumption Ledger

- Failed assumption: a hash-linked transition-admission witness ledger is enough accountability for recovered operational state. It is not; witness certificates inside that ledger also need replayed authority topology.
- Failed assumption: certificate `acceptedWitnessIds` can stand in for authority membership. They cannot; they are claims that must be checked against a replayed topology.

## Proof Status

Focused verification passed before ledger updates:

- `pnpm typecheck`
- `pnpm vitest run packages/agent-state/src/index.test.ts -t "recovery cut admission witness authority-transition admission witness"`: 1 passed, 216 skipped

Full verification passed after ledger updates:

- `git diff --check`
- `pnpm typecheck`
- `pnpm test`: 621 passed, 143 skipped
