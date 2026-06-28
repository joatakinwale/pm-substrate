# v171 - Operational State Pruning-Policy Admission Witness Authority Topology

Date: 2026-06-27
Question closed: SQ118

## Research Question

What signer, quorum, or policy-admission witness authority topology makes pruning-policy admission witness records accountable instead of self-authored certificate-bearing rows?

## Sources

- Becker, Fournet, and Gordon, "SecPAL: Design and Semantics of a Decentralized Authorization Language", Journal of Computer Security 2010: https://www.microsoft.com/en-us/research/wp-content/uploads/2010/01/jcs-final.pdf
- Appel and Felten, "Proof-Carrying Authentication", ACM CCS 1999: https://www.cs.princeton.edu/~appel/papers/says.pdf
- Clarke, Elien, Ellison, Fredette, Morcos, and Rivest, "Certificate Chain Discovery in SPKI/SDSI", Journal of Computer Security 2001: https://people.csail.mit.edu/rivest/pubs/CEEFx01.pdf
- Malkhi and Reiter, "Byzantine Quorum Systems", Distributed Computing 1998: https://www.cs.utexas.edu/~lorenzo/corsi/cs380d/papers/bquorum-dc.pdf
- Alvisi, Malkhi, Pierce, Reiter, and Wright, "Dynamic Byzantine Quorum Systems", DSN 2000: https://users.ece.cmu.edu/~reiter/papers/2000/DSN.pdf

## Mechanism Extracted

SecPAL makes authorization a derivation over current assertions, delegation, and constraints rather than a caller's private policy memory. Proof-carrying authentication makes the requester present a checkable proof, not merely a statement that authorization exists. SPKI/SDSI certificate-chain discovery adds the threshold-subject mechanism: several principals may be required to authorize a request, and the system must prove those principals are in the authorized set. Byzantine quorum systems and dynamic Byzantine quorum systems add the quorum-topology bridge: a quorum count is meaningful only relative to a membership/failure/threshold configuration that can itself change over time.

The substrate adaptation is a pruning-policy admission witness authority topology. v161 made pruning-policy admission rows accountable to a separate witness ledger, but the witness certificates still carried certificate-local `acceptedWitnessIds`. SQ118 closes that signer/topology gap: strict pruning-policy admission can now require those witness certificates to bind to a replayed authority topology hash, and replay counts only unique active topology principals toward quorum.

## Existing Substrate Map

- v141 added a pruning-policy compiler that derives recovery-lane obligations from tenant/scope policy rather than private implementation memory.
- v151 added pruning-policy admission records so compiled policies must replay as latest admitted policy artifacts before authorizing recovered operational state.
- v161 added pruning-policy admission witness records so policy-admission rows require a separate hash-linked witness ledger over the exact policy record hash.
- v146 added generic authority-transition/topology primitives that project active/suspended/revoked/equivocated principals, quorum thresholds, and topology hashes from replayed authority history.
- v169 and v170 established adjacent topology-bound replay patterns for recovery-cut admission witnesses and history-root settlement certificates.
- Before v171, `replayOperationalStatePruningPolicyAdmissionWitnessRecords()` checked certificate hash, certified status, subject, boundary, and certificate-declared quorum counts.

## Missing Substrate Map

- Before v171, a pruning-policy admission witness certificate could name arbitrary `acceptedWitnessIds`; replay did not prove those witnesses were eligible policy-admission principals.
- The certificate's `authorityTopologyHash` was not enforced against a replayed policy-admission witness topology.
- Duplicate witness ids could satisfy certificate length checks.
- Suspended, revoked, equivocated, or unknown policy-admission witnesses could count as if they were active.
- Existing policy compilation, policy admission, and admission-witness records made policies accountable to rows, not to replayed signer authority.
- Still missing after v171: admission/witness/finality for the pruning-policy admission witness authority-transition ledger itself, policy-admission witness signature/key-status verification, runtime policy-store adoption, authority compaction, and live Postgres privilege/restart proof.

## Primitive Proposal

Name: operational state pruning-policy admission witness authority topology.

Problem it solves: prevents self-authored pruning-policy admission witness records from authorizing recovered operational state by carrying certificates with arbitrary policy-admission witness ids.

Research source: SecPAL decentralized authorization, proof-carrying authentication, SPKI/SDSI certificate-chain discovery with threshold subjects, Byzantine quorum systems, and dynamic Byzantine quorum systems.

Mechanism borrowed: policy admission is authoritative only when a checkable certificate/proof is evaluated against current delegated authority and threshold membership; signer counts are meaningful only under a replayed quorum topology.

Why current substrate lacked it: v161 required witness records over policy-admission rows, but did not bind witness signer ids to replayed policy-admission witness authority.

Why existing primitives are insufficient: generic authority topology can represent eligible principals and thresholds, but pruning-policy admission witness replay did not consume it; policy admission proves the compiled policy artifact, not the eligibility of witness signers certifying that artifact.

State guarantee it should create: strict pruning-policy admission can accept a witnessed policy row only when the witness certificate is bound to a replayed authority topology hash and its unique active topology principals satisfy the topology quorum.

Admission rule it requires: pruning-policy admission witness replay accepts an optional/required witness authority topology derived from authority transitions; when required, missing topology invalidates witness replay, and certificates must bind to that topology hash.

Replay rule it requires: replay rejects missing required topology, tampered topology hashes, topology tenant/scope mismatch, missing topology quorum thresholds, certificate topology mismatch, duplicate policy-admission witnesses, unknown witnesses, inactive witnesses, and topology-quorum failures before a pruning policy can authorize recovered state.

Authority boundary it requires: the witness certificate remains over `operational_state_pruning_policy_admission_record`, but the certificate's `authorityTopologyHash` must equal the replayed policy-admission witness authority topology hash; only active principals in that topology count toward witness quorum.

Failure modes it should prevent: compiler-owned witness lists, stale policy witness authority, suspended or revoked policy witnesses, duplicate signer amplification, certificate/topology substitution, connector-cache witness sets, and recovered current state authorized by policy identities not present in replayed authority history.

Minimal implementation slice: extend pruning-policy admission witness replay with `witnessAuthorityTopology` and `requireWitnessAuthorityTopology`, validate certificate/topology binding and active unique topology quorum, expose strict policy-admission/action-review flags, add durable SQL authority-transition storage for this policy witness lane, and add focused tests for valid topology-bound replay plus missing, unknown, suspended, duplicate, and topology-mismatched witness failures.

Tests that would falsify it: a valid topology-bound two-witness policy admission fails; strict policy admission passes when witness authority topology is required but absent; an unknown witness counts toward quorum; a suspended witness counts toward quorum; duplicate witness ids satisfy a two-witness topology quorum; a certificate with a wrong topology hash passes.

Axis surfaces that could later validate it: Axis C amnesiac recovery from a compacted recovery cut with strict pruning policy, Axis A finance recovery after policy/compiler drift, and Axis B/domain adapters attempting to supply connector-owned policy witness identities.

## Falsification Criteria

- A latest pruning-policy admission witness record with a certificate bound to the replayed topology hash and two unique active topology principals must satisfy strict policy admission.
- Strict policy admission must fail if witness authority topology is required but the witness replay does not contain one.
- Witness replay must reject a certificate that names an unknown witness even when the certificate's own required/minimum count is met.
- Witness replay must reject a certificate that names a suspended witness even when the certificate's own required/minimum count is met.
- Witness replay must reject duplicate accepted witness ids as a topology-quorum failure.
- Witness replay must reject a certificate whose authority topology hash does not match the replayed topology.

## Active 10-Question Backlog

1. SQ119: What signer, quorum, or guard-admission witness authority topology makes storage mutation guard authorization admission witness records accountable instead of self-authored certificate-bearing rows?
2. SQ120: What signer, quorum, or checkpoint-admission witness authority topology makes tombstone-history checkpoint admission witness records accountable instead of self-authored certificate-bearing rows?
3. SQ121: What signer, quorum, or checkpoint-admission witness authority topology makes witness-ledger checkpoint admission witness records accountable instead of self-authored certificate-bearing rows?
4. SQ122: What signer, quorum, or proof-admission witness authority topology makes quorum-certificate proof-record admission witness records accountable instead of self-authored certificate-bearing rows?
5. SQ123: What signer, quorum, or checkpoint-admission witness authority topology makes authority-topology checkpoint admission witness records accountable instead of self-authored certificate-bearing rows?
6. SQ124: What signer, quorum, or proof-admission witness authority topology makes signature-verifier proof admission witness records accountable instead of self-authored certificate-bearing rows?
7. SQ125: What signer, quorum, or finalizer-proof admission witness authority topology makes authority epoch seal finalizer-proof admission witness records accountable instead of self-authored certificate-bearing rows?
8. SQ126: What admission, witness, or finality rule makes recovery-cut admission witness authority-transition history accountable instead of self-authored topology rows?
9. SQ127: What admission, witness, or finality rule makes history-root settlement authority-transition history accountable instead of self-authored topology rows?
10. SQ128: What admission, witness, or finality rule makes pruning-policy admission witness authority-transition history accountable instead of self-authored topology rows?

## Failed Assumption Ledger

- Falsified: a certified pruning-policy admission witness record is enough if its certificate hash, subject, boundary, and declared witness count replay.
- Falsified: `acceptedWitnessIds` inside a policy-admission witness certificate can be treated as authority without replaying policy witness topology.
- Falsified: compiled-policy admission plus witness-record accountability are sufficient without lane-specific replay of policy-admission witness authority.
- Still open: pruning-policy admission witness authority transitions now have an append-only durable table, but those transition rows still need their own admission/witness/finality rule before the topology store can be fully accountable.

## Proof Status

Implemented in `@pm/agent-state` and migrations:

- Extended `OperationalStatePruningPolicyAdmissionWitnessReplayInput` with `witnessAuthorityTopology` and `requireWitnessAuthorityTopology`.
- Extended `OperationalStatePruningPolicyAdmissionWitnessReplay` to expose the topology consumed by replay.
- Added pruning-policy admission witness authority issue codes for missing topology, topology hash/tenant/scope mismatch, certificate topology mismatch, missing quorum thresholds, duplicate witnesses, unknown witnesses, inactive witnesses, and topology-quorum failure.
- Strengthened `replayOperationalStatePruningPolicyAdmissionWitnessRecords()` so certificate signers are counted only as unique active principals under the replayed authority topology.
- Extended `evaluateOperationalStatePruningPolicyAdmission()` and `reviewProposedActionAgainstCurrentState()` with policy-admission witness authority topology strictness flags.
- Added migration `0088_agent_state_pruning_policy_admission_witness_authority_transitions.sql` with append-only pruning-policy admission witness authority-transition rows.
- Added tests for valid topology-bound policy admission witness replay, missing required topology refusal, unknown witness refusal, suspended witness refusal, duplicate witness refusal, and certificate topology mismatch refusal.

Verification before ledger publication:

- `pnpm --filter @pm/agent-state typecheck`
- `pnpm test packages/agent-state/src/index.test.ts` (172 passed)

Outcome: SQ118 is closed. SQ119 is now the active next substrate question, with SQ128 added as new pruning-policy admission witness authority-transition accountability pressure.
