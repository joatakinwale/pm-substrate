# v191 Operational State Pruning-Policy Admission Witness Authority-Transition Admission Witness Records

Date: 2026-06-27
Question closed: SQ138
Research lane: substrate discovery, agent operational state, authority-scoped transition admission

## Question

What bootstrap, admission-witness, or finality rule makes pruning-policy admission witness authority-transition admission records accountable instead of certificate-local admission rows?

## Existing Substrate Map

- v141 adds compiled operational state pruning policies as replayable recovery-lane obligations.
- v151 adds pruning-policy admission records so a compiled policy must be latest in an authority-scoped policy-admission history before recovered state can use it.
- v161 adds pruning-policy admission witness records so the latest policy-admission row must be separately quorum-certified by a witness ledger.
- v171 adds pruning-policy admission witness authority topology so witness certificates bind to replayed active principals and quorum thresholds.
- v181 adds pruning-policy admission witness authority-transition admission records so the witness topology can replay from admitted authority-transition history rather than caller memory.
- Migration `0098` persists the admitted pruning-policy admission witness authority-transition rows.

## Missing Substrate Map

The v181 transition-admission row still carried its own certificate as an embedded field. That made the row replayable, but it did not make the row externally accountable. A strict pruning-policy admission path could require the witness authority topology to come from admitted transition history, while the transition-admission history itself could still be treated as sufficient authority once its local certificate fields were hash-valid.

The missing concept was a separate witness ledger over pruning-policy admission witness authority-transition admission record hashes. Without that ledger, a local snapshot, connector cache, worktree row, or adapter-supplied transition-admission list could present certificate-shaped rows and become operational state without a second replayed witness history admitting the exact record hash.

## Arrowsmith Bridge

A literature: agent state failures caused by stale memory and continuity breaks show that internal representation cannot define current authority.

B bridge: proof-carrying authorization and accountable logs separate a claim from an independently checkable proof chain. The key mechanism is not the word "certificate"; it is that the consumer can replay the proof object's subject, scope, issuer boundary, and append-only history.

C literature:

- Appel and Felten, "Proof-Carrying Authentication" (1999), https://www.cs.princeton.edu/~appel/papers/says.pdf
- Genovese, "A Brief Introduction to Proof-Carrying Authorization" (2007), https://people.mpi-sws.org/~dg/papers/intro-pca.pdf
- Becker et al., "SecPAL: Design and Semantics of a Decentralized Authorization Language" (Journal of Computer Security, 2010), https://www.microsoft.com/en-us/research/wp-content/uploads/2010/01/jcs-final.pdf
- Haeberlen et al., "PeerReview: Practical Accountability for Distributed Systems" (SOSP 2007), https://www.sigops.org/s/conferences/sosp/2007/papers/sosp118-haeberlen.pdf
- Maniatis and Baker, "Transparency Logs via Append-Only Authenticated Dictionaries" (CCS 2019), https://www.cs.yale.edu/homes/cpap/published/logs-ccs19.pdf

Mechanism extracted: admission rows must not be their own accountability boundary. A replayed consumer needs a distinct append-only witness history whose certificate subject is the exact admission record hash and whose replay can be required by the parent transition-admission replay.

## Primitive Proposal

Name: operational state pruning-policy admission witness authority-transition admission witness records.

Problem it solves: pruning-policy admission witness authority-transition admission rows could be accepted from a local or adapter-supplied transition-admission history if their embedded certificates were structurally valid.

Research source: proof-carrying authorization, SecPAL, PeerReview, and append-only authenticated transparency logs.

Mechanism borrowed or adapted: proof-carrying authorization's explicit proof object plus accountable append-only log replay. The substrate adaptation is a hash-linked witness ledger over transition-admission record hashes, not a general theorem prover.

Why current substrate lacks it: v181 admitted the witness authority topology transition history but did not require a second replayed ledger to account for each transition-admission record hash.

Why existing primitives are insufficient: the transition-admission certificate proves a row claims to be certified; it does not prove that a separately replayed witness history admitted the exact row as operationally accountable state.

State guarantee it should create: strict pruning-policy admission cannot treat a pruning-policy admission witness authority-transition admission row as operational authority unless the latest required transition-admission record hash is witnessed by a separate replayed ledger under the expected authority boundary.

Admission rule it requires: `replayOperationalStatePruningPolicyAdmissionWitnessAuthorityTransitionAdmissionRecords({ requireAdmissionWitness: true })` must reject missing or invalid transition-admission witness replay and must require the latest transition-admission record to be witnessed.

Replay rule it requires: the witness ledger replays as a contiguous hash chain, verifies witness-record hashes, verifies quorum-certificate hashes, checks tenant/store/scope/topology, checks certificate subject kind/id/sequence/hash, and checks correspondence to the required transition-admission record.

Authority boundary it requires: witness certificates must use `operational_state_pruning_policy_admission_witness_authority_transition_admission_witness` and subject kind `operational_state_pruning_policy_admission_witness_authority_transition_admission_record`.

Failure modes it should prevent:

- Private memory presents certificate-shaped pruning-policy witness authority transition rows as current topology authority.
- A connector cache replays a transition-admission row without a separate witnessed record hash.
- A forged witness certificate signs a different admission record hash.
- A pruning-policy admission evaluation consumes a witness-authority transition replay that lacks the transition-admission witness layer.
- Blocking action review accepts recovered policy state when the pruning-policy admission witness authority-transition admission ledger is not itself witnessed.

Minimal implementation slice:

- Add `OperationalStatePruningPolicyAdmissionWitnessAuthorityTransitionAdmissionWitnessRecord` and replay types.
- Add deterministic build/hash/verify/replay functions.
- Extend pruning-policy witness authority-transition admission replay with `admissionWitnessReplay` and `requireAdmissionWitness`.
- Extend pruning-policy admission witness replay, pruning-policy admission evaluation, and action review with transition-admission witness strictness.
- Add migration `0108_agent_state_pruning_policy_admission_witness_authority_transition_admission_witness_records.sql`.
- Add a focused falsification test for valid witnessed rows, missing witness replay, forged valid-looking missing nested witness replay, and wrong witness certificate subject.

## Falsification Criteria

The primitive is falsified if any of these pass as valid under strict mode:

1. A pruning-policy admission witness authority-transition admission replay with `requireAdmissionWitness: true` and no transition-admission witness replay.
2. A pruning-policy admission witness replay with `requireWitnessAuthorityTransitionAdmissionWitness: true` and a transition-admission replay lacking `admissionWitnessReplay`.
3. A pruning-policy admission evaluation with `requireAdmissionWitnessAuthorityTransitionAdmissionWitness: true` and a forged `valid: true` witness replay whose nested transition-admission replay lacks the witness layer.
4. A transition-admission witness record whose certificate subject hash is not the exact transition-admission record hash.
5. A blocking action review that allows recovered pruning-policy state when strict pruning-policy transition-admission witness accountability is missing.

## Implementation Result

Implemented in `@pm/agent-state`:

- `OperationalStatePruningPolicyAdmissionWitnessAuthorityTransitionAdmissionWitnessRecord`
- `buildOperationalStatePruningPolicyAdmissionWitnessAuthorityTransitionAdmissionWitnessRecord()`
- `computeOperationalStatePruningPolicyAdmissionWitnessAuthorityTransitionAdmissionWitnessRecordHash()`
- `verifyOperationalStatePruningPolicyAdmissionWitnessAuthorityTransitionAdmissionWitnessRecordHash()`
- `replayOperationalStatePruningPolicyAdmissionWitnessAuthorityTransitionAdmissionWitnessRecords()`
- `requireAdmissionWitness` on pruning-policy admission witness authority-transition admission replay
- `requireWitnessAuthorityTransitionAdmissionWitness` on pruning-policy admission witness replay
- `requireAdmissionWitnessAuthorityTransitionAdmissionWitness` on pruning-policy admission evaluation
- `requirePruningPolicyAdmissionWitnessAuthorityTransitionAdmissionWitness` on action review
- Migration `0108_agent_state_pruning_policy_admission_witness_authority_transition_admission_witness_records.sql`

## Axis Surfaces

Axis surfaces are validation wind tunnels only:

- Axis A can later require pruning-policy admission witness authority-transition admission witness replay in finance recovery-policy fixtures.
- Axis B can use the same rule for domain-adapter policy stores once authoritative marketing/social fixtures exist.
- Axis C can directly simulate amnesiac local-agent recovery where conversation memory supplies a policy witness topology but admitted transition-admission witness replay is missing.

No axis-only work was counted as substrate progress in this loop.

## Active 10-Question Backlog

1. SQ139: What bootstrap, admission-witness, or finality rule makes storage mutation guard authorization admission witness authority-transition admission records accountable instead of certificate-local admission rows?
2. SQ140: What bootstrap, admission-witness, or finality rule makes tombstone-history checkpoint admission witness authority-transition admission records accountable instead of certificate-local admission rows?
3. SQ141: What bootstrap, admission-witness, or finality rule makes witness-ledger checkpoint admission witness authority-transition admission records accountable instead of certificate-local admission rows?
4. SQ142: What bootstrap, admission-witness, or finality rule makes proof-record admission witness authority-transition admission records accountable instead of certificate-local admission rows?
5. SQ143: What bootstrap, admission-witness, or finality rule makes authority-topology checkpoint admission witness authority-transition admission records accountable instead of certificate-local admission rows?
6. SQ144: What bootstrap, admission-witness, or finality rule makes signature-verifier proof admission witness authority-transition admission records accountable instead of certificate-local admission rows?
7. SQ145: What bootstrap, admission-witness, or finality rule makes authority epoch seal finalizer-proof admission witness authority-transition admission records accountable instead of certificate-local admission rows?
8. SQ146: What witness authority topology, signature, or finality rule makes recovery-cut admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?
9. SQ147: What witness authority topology, signature, or finality rule makes history-root settlement authority-transition admission witness certificates accountable instead of certificate-local witness rows?
10. SQ148: What witness authority topology, signature, or finality rule makes pruning-policy admission witness authority-transition admission witness certificates accountable instead of certificate-local witness rows?

## Failed Assumption Ledger

- Failed assumption: transition-admission rows with embedded certificates are sufficient authority once the topology replay validates. They are not sufficient; the row itself needs separately replayed accountability.
- Failed assumption: strict pruning-policy admission could stop at witness-authority transition admission. It cannot; otherwise a certificate-local row can become policy authority.

## Proof Status

Focused verification passed:

- `pnpm typecheck`
- `pnpm test packages/agent-state/src/index.test.ts -t "pruning policy admission witness authority"`: 3 passed, 206 skipped

Full verification passed after ledger updates:

- `git diff --check`
- `pnpm typecheck`
- `pnpm test`: 613 passed, 143 skipped
