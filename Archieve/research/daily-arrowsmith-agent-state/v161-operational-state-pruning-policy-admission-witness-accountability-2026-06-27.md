# v161 - Operational State Pruning Policy Admission Witness Accountability

Date: 2026-06-27
Question closed: SQ108

## Research Question

What signer, quorum, or policy-authority topology makes pruning-policy admission records accountable instead of self-authored compiler rows?

## Sources

- Bauer, Schneider, and Felten, "A General and Flexible Access-Control System for the Web", USENIX Security 2002: https://www.usenix.org/conference/11th-usenix-security-symposium/general-and-flexible-access-control-system-web
- Becker, Fournet, and Gordon, "SecPAL: Design and Semantics of a Decentralized Authorization Language", Journal of Computer Security 2010: https://www.microsoft.com/en-us/research/wp-content/uploads/2010/01/jcs-final.pdf
- Myers and Zheng, "Flow-Limited Authorization", IEEE CSF 2015: https://www.cs.cornell.edu/andru/papers/flam/flam-csf15.pdf
- Schneider, Walsh, and Sirer, "Nexus Authorization Logic (NAL): Design Rationale and Applications", ACM TISSEC 2011: https://www.cs.cornell.edu/fbs/publications/NexusNalRationale.pdf

## Mechanism Extracted

Proof-carrying authorization makes the requester carry evidence and leaves the guard with proof verification rather than exploratory policy inference. SecPAL supplies the current-policy database bridge: authority is derived from current clauses, credentials, delegation, and request context, not from implementation memory. FLAM adds the ownership bridge: a delegated or represented principal must not be able to mutate the owner's policy authority by acting through its own trust relationships. NAL frames authorization as credentials and policy statements whose proof objects can cross administrative boundaries.

The substrate adaptation is a policy-admission witness ledger. A pruning-policy admission row is still not enough by itself: the row can only support strict operational recovery when a separate hash-linked witness history quorum-certifies the exact policy-admission record hash under the expected authority boundary. The compiler produces the policy artifact, the policy-admission store makes it durable/current, and the witness ledger makes that admission accountable.

## Existing Substrate Map

- v151 added `OperationalStatePruningPolicyArtifact`, `OperationalStatePruningPolicyAdmissionRecord`, replay-current policy history, and action-review enforcement through `requirePruningPolicyAdmission`.
- v159 added a parallel witness-accountability pattern for recovery-cut admission records.
- v160 added quorum-certified settlement records for signed history roots, proving that one signed observer statement is still not settlement.

## Missing Substrate Map

- Before v161, a hash-valid pruning-policy admission row could be inserted by the same logical authority that supplied the compiler artifact.
- The existing policy-admission replay proved store currentness but not independent admission accountability.
- The compiled policy could be durable and latest, yet still operationally descended from a self-authored policy-row assertion.
- Existing recovery-cut admission witnesses accounted for recovered cuts, not the policy records that shaped the required recovery lanes.
- Still missing after v161: policy-admission witness authority topology, witness key status, witness-record compaction, runtime policy-store adoption, policy-store head transparency, and storage-procedure controls that prevent unauthorized insertion of witness rows.

## Primitive Proposal

Name: operational state pruning policy admission witness record.

Problem it solves: prevents self-authored pruning-policy admission rows from authorizing recovered operational state.

Research source: proof-carrying authorization, SecPAL decentralized authorization, FLAM ownership projections, and NAL credential/policy proof framing.

Mechanism borrowed: the protected operation checks a proof object and its authority boundary; the policy owner retains control over the authorization relation; cross-boundary credentials must name the exact governed subject.

Why current substrate lacked it: v151 made policy artifacts replay-current but left the policy-admission row as the final authority object.

Why existing primitives are insufficient: recovery-cut admission witnesses certify cuts, and history-root settlement certifies roots, but neither certifies that the policy-admission transition authorizing the recovery ladder was admitted by accountable policy authority.

State guarantee it should create: a compiled pruning policy can authorize strict operational recovery only when the latest policy-admission record replays and a separate witness ledger certifies the exact policy record hash, policy sequence, and policy store under the expected authority boundary.

Admission rule it requires: witness records bind tenant, policy-admission witness store, policy store, authority scope, witness sequence, policy sequence, policy id/hash, artifact hash, policy record hash, quorum certificate, previous witness hash, witness metadata, and witness record hash.

Replay rule it requires: replay rejects invalid policy-admission replay, tenant/store/scope mismatch, witness sequence gaps, previous-hash breaks, same-sequence forks, tampered witness records, tampered certificates, non-certified certificates, insufficient witness quorum, wrong certificate subject, wrong authority boundary, missing latest-policy witnesses, and witness/admission record mismatch.

Authority boundary it requires: the quorum certificate subject must be `operational_state_pruning_policy_admission_record`, with subject id equal to the policy store id, subject sequence equal to the policy sequence, and subject hash equal to the policy admission record hash.

Failure modes it should prevent: self-authored compiler rows, stale but latest-looking policy rows from local stores, wrong-boundary connector cache witnesses, under-quorum policy witnesses, certificate subject substitution, policy-admission witness forks, and recovery lanes authorized by unwitnessed policy history.

Minimal implementation slice: add witness record types, deterministic witness hashing, witness replay, strict evaluation through `requireAdmissionWitnessQuorum`, action-review enforcement via `requirePruningPolicyAdmissionWitnessQuorum`, durable SQL table, and tests for accepted, missing, wrong-subject, and under-quorum cases.

Tests that would falsify it: a valid witnessed latest policy fails; strict action review passes with replay-current policy admission but no witness replay; an under-quorum witness certificate passes; a certificate over a different policy record hash passes; a wrong authority boundary passes.

Axis surfaces that could later validate it: Axis C amnesiac recovery with policy-store resumes, Axis A finance recovery after policy-artifact supersession, and Axis B/domain adapters attempting to smuggle domain policy into core recovery.

## Falsification Criteria

- A latest policy-admission record with a certified witness replay over the exact policy record hash must satisfy strict policy-admission evaluation and blocking action review.
- Strict witness-quorum action review must block when policy-admission replay exists but witness replay is missing.
- A certificate over the wrong policy record hash must invalidate witness replay.
- A certificate with fewer accepted witnesses than required/minimum must invalidate witness replay.
- The stricter witness-quorum flag must imply the base policy-admission gate even if the caller does not set `requirePruningPolicyAdmission`.

## Active 10-Question Backlog

1. SQ109: What signer, quorum, or guard-admission authority topology makes storage mutation guard authorization admission records accountable instead of self-authored procedure rows?
2. SQ110: What signer, quorum, or checkpoint-admission authority topology makes tombstone-history checkpoint admission records accountable instead of self-authored certificate-bearing rows?
3. SQ111: What signer, quorum, or checkpoint-admission authority topology makes witness-ledger checkpoint admission records accountable instead of self-authored certificate-bearing rows?
4. SQ112: What signer, quorum, or proof-admission authority topology makes quorum-certificate proof-record admission records accountable instead of self-authored certificate-bearing rows?
5. SQ113: What signer, quorum, or checkpoint-admission authority topology makes authority-topology checkpoint admission records accountable instead of self-authored topology snapshots?
6. SQ114: What signer, quorum, or proof-admission authority topology makes signature-verifier proof admission records accountable instead of self-authored certificate-bearing rows?
7. SQ115: What signer, quorum, or finalizer-proof admission authority topology makes authority epoch seal finalizer-proof admission records accountable instead of self-authored finality assertions?
8. SQ116: What signer, quorum, or witness-ledger authority topology makes recovery-cut admission witness records accountable instead of self-authored certificate-bearing rows?
9. SQ117: What signer, quorum, or settlement authority topology makes history-root settlement records accountable instead of self-authored certificate-bearing rows?
10. SQ118: What signer, quorum, or policy-admission witness authority topology makes pruning-policy admission witness records accountable instead of self-authored certificate-bearing rows?

## Failed Assumption Ledger

- Falsified: replay-current pruning-policy admission rows are enough to make policy admission accountable.
- Falsified: compiler artifact identity plus durable policy currentness is sufficient to prevent private policy authority.
- Still open: policy-admission witness records carry quorum certificates, but witness authority topology, witness signatures/key status, runtime adoption, and compaction remain open.

## Proof Status

Implemented in `@pm/agent-state` and migrations:

- `OperationalStatePruningPolicyAdmissionWitnessRecord`, replay, evaluation, and issue types.
- `buildOperationalStatePruningPolicyAdmissionWitnessRecord()`, `computeOperationalStatePruningPolicyAdmissionWitnessRecordHash()`, and `replayOperationalStatePruningPolicyAdmissionWitnessRecords()`.
- Strict action-review enforcement through `requirePruningPolicyAdmissionWitnessQuorum` and `pruningPolicyAdmissionWitnessReplay`; the stricter flag implies the base policy-admission gate.
- Migration `0078_agent_state_pruning_policy_admission_witness_records.sql` with append-only witness rows and public DML revocation for policy admission and witness records.
- Tests for valid witness-certified policy admission, missing witness replay refusal, wrong certificate subject refusal, and under-quorum witness refusal.

Verification before ledger publication:

- `pnpm --filter @pm/agent-state typecheck`
- `pnpm test packages/agent-state/src/index.test.ts` (152 passed)
- `pnpm typecheck`
- `pnpm test` (556 passed, 143 skipped)
- `git diff --check`

Outcome: SQ108 is closed. SQ109 is now the active next substrate question, with SQ118 added as new policy-admission witness authority pressure.
