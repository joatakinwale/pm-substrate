# v151 - Operational State Pruning Policy Admission Records

Date: 2026-06-27
Question closed: SQ98

## Research Question

What proof-carrying policy-artifact or policy-store primitive keeps compiled pruning policies versioned, durable, and replay-current so stale compilers cannot authorize recovery?

## Sources

- Garg and Pfenning, "A Proof-Carrying File System", IEEE Symposium on Security and Privacy 2010: https://people.mpi-sws.org/~dg/papers/oakland10.pdf
- Becker, Fournet, and Gordon, "SecPAL: Design and Semantics of a Decentralized Authorization Language", Journal of Computer Security 2010: https://journals.sagepub.com/doi/abs/10.3233/JCS-2009-0364
- DeYoung et al., "Distributed Programming with Distributed Authorization", TLDI 2010: https://www.andrew.cmu.edu/user/danupam/adh-tldi2010.pdf
- Blaze, Feigenbaum, and Keromytis, "KeyNote: Trust Management for Public-Key Infrastructures", 1998: https://www.cs.yale.edu/homes/jf/BFK-SPW98.pdf

## Mechanism Extracted

Proof-carrying authorization separates policy proof production from the reference monitor: the requester supplies evidence, and the guard checks a compact proof or capability before permitting protected operations. PCFS adds the dynamic-policy bridge: policy consequences can change with time and system state, so enforcement cannot trust an old proof without checking the admitted capability boundary. SecPAL and KeyNote supply the authorization-database bridge: access is derived from current policy clauses, credentials, and action context rather than from an implementation's memory of a policy.

The substrate adaptation is a pruning-policy admission record. A compiled pruning policy can shape recovered operational state only when the exact compiled artifact is admitted into an authority-scoped, hash-linked policy history and is the latest replayed policy for that tenant/scope/store. The compiler may still produce deterministic obligations, but the operational authority comes from replayed policy admission history, not from the local compiler object.

## Existing Substrate Map

- v141 added `OperationalStatePruningPolicyCompilation`, deterministic policy hashes, canonical stage-order checks, recovery-cut policy evaluation, and action-review enforcement through `requirePruningPolicyCompliance`.
- v149 added recovery-cut admission records, proving that a recovered cut itself cannot remain a view-local object.
- v150 added signed observer proofs for history-root transparency, preventing forged root gossip from affecting recovery.

## Missing Substrate Map

- Before v151, a caller could pass any deterministic `OperationalStatePruningPolicyCompilation` to action review.
- A stale compiler output could still authorize a recovery cut if the cut satisfied the stale obligations.
- `policyHash` proved compilation identity, not admission or currentness.
- Existing recovery-cut admission records admitted the cut, not the policy that defined which lanes the cut must contain.
- Still missing after v151: policy-admission authority topology, policy-admission signatures or quorum, runtime policy-store loading, policy-store head transparency, admission compaction, and automatic adoption at live recovery boundaries.

## Primitive Proposal

Name: operational state pruning policy admission record.

Problem it solves: prevents private or stale compiled pruning policies from authorizing recovered operational state.

Research source: proof-carrying authorization and PCFS, SecPAL's current policy database, distributed proof-carrying authorization, and KeyNote trust-management compliance checking.

Mechanism borrowed: protected operations check a proof/capability against current admitted policy evidence; authorization is derived from current policy and credentials, not local implementation memory.

Why current substrate lacked it: v141 produced deterministic compiled obligations, but those obligations were supplied directly by the caller.

Why existing primitives are insufficient: recovery cuts can be admitted while the policy defining the required lane ladder remains private; root transparency can witness lane stores without proving that the lane policy is current.

State guarantee it should create: a compiled pruning policy can authorize action only when replayed policy-admission history admits the exact policy hash as the latest artifact for the tenant, authority scope, and policy store.

Admission rule it requires: policy-admission records bind schema version, tenant, policy store, authority scope, sequence, policy id/hash, previous record hash, compiled artifact, admitted-at/by metadata, and policy-record hash.

Replay rule it requires: replay rejects tenant/scope/store mismatch, sequence gaps, previous-hash breaks, same-sequence forks, tampered artifact hashes, tampered policy hashes, invalid compiled policies, and stale required policy hashes.

Authority boundary it requires: v151 proves durable policy currentness, not who is allowed to admit policy artifacts. SQ108 must define the policy-authority topology, signatures, or quorum that makes admission rows accountable.

Failure modes it should prevent: stale pruning ladders, local compiler memory authorizing recovery, artifact substitution, policy-store forks, hash-valid recovery cuts paired with superseded policy, and policy-id/policy-hash mismatch.

Minimal implementation slice: add policy artifact/admission record types, deterministic artifact and record hashing, replay-current evaluation, action-review enforcement through `requirePruningPolicyAdmission`, append-only migration, and tests for admitted, missing, stale, tampered, and forked policies.

Tests that would falsify it: an admitted latest policy fails; a private compilation passes when admission is required; a stale policy passes after a later policy artifact is admitted; a tampered artifact passes with a recomputed outer record hash; a same-sequence fork passes replay.

Axis surfaces that could later validate it: Axis C amnesiac recovery with superseded pruning policies, Axis A finance recovery after pruning-policy updates, and Axis B/domain adapters attempting to smuggle domain-specific lane policy into core state.

## Falsification Criteria

- A valid compiled policy admitted as the latest hash-linked policy record must satisfy policy admission and blocking action review.
- Missing policy-admission replay under `requirePruningPolicyAdmission` must block even when the recovery cut satisfies the supplied compilation.
- A compiled policy superseded by a later admitted policy record must be rejected as stale.
- Same-sequence policy-admission forks must be replay obstructions.
- Tampered artifacts must fail replay even when the outer policy record hash is recomputed.

## Active 10-Question Backlog

1. SQ99: What role, stored-procedure, or authorization-admission model prevents arbitrary INSERT into storage mutation guard authorization tables from forging tombstone authority?
2. SQ100: What authority admission, witness quorum, or finality rule makes tombstone-history compaction checkpoints admissible rather than self-authored replay seeds?
3. SQ101: What authority admission, witness quorum, or finality rule makes witness-ledger compaction checkpoints admissible rather than self-authored replay seeds?
4. SQ102: What authority admission, witness quorum, or finality rule makes generic quorum-certificate proof records admissible rather than self-authored certificate summaries?
5. SQ103: What authority admission, witness quorum, or finality rule makes authority-topology compaction checkpoints admissible rather than self-authored topology snapshots?
6. SQ104: What verifier registry, witness quorum, or admission rule makes signature-verifier adapter proofs admissible rather than self-authored cryptographic-validity assertions?
7. SQ105: What finalizer-proof admission store, verifier registry, or witness quorum makes authority epoch seal finalizer proofs admissible rather than self-authored finality assertions?
8. SQ106: What observer-signature, witness-quorum, or transparency rule makes recovery-cut admission records accountable instead of self-authored admission rows?
9. SQ107: What quorum, settlement, or finality rule makes signed history-root transparency observations sufficient to bless recovery roots instead of letting one signed observer define currentness?
10. SQ108: What signer, quorum, or policy-authority topology makes pruning-policy admission records accountable instead of self-authored compiler rows?

## Failed Assumption Ledger

- Falsified: deterministic compiled pruning-policy hashes are enough to make the policy operational authority.
- Falsified: recovery-cut admission implies the policy that shaped the cut is current.
- Still open: policy admission records are durable and replay-current, but policy-row authority, signatures/quorum, runtime loading, store-head transparency, and compaction remain open.

## Proof Status

Implemented in `@pm/agent-state` and migrations:

- `OperationalStatePruningPolicyArtifact`, `OperationalStatePruningPolicyAdmissionRecord`, replay, evaluation, and issue types.
- `buildOperationalStatePruningPolicyArtifact()`, `computeOperationalStatePruningPolicyArtifactHash()`, `buildOperationalStatePruningPolicyAdmissionRecord()`, `computeOperationalStatePruningPolicyAdmissionRecordHash()`, `replayOperationalStatePruningPolicyAdmissionRecords()`, and `evaluateOperationalStatePruningPolicyAdmission()`.
- Blocking action-review enforcement through `requirePruningPolicyAdmission` and `pruningPolicyAdmissionReplay`.
- Migration `0068_agent_state_pruning_policy_admission_records.sql` with append-only durable policy admission rows.
- Tests for valid admitted policy replay, missing admission replay refusal, stale policy refusal, same-sequence fork obstruction, and tampered artifact refusal.

Verification before ledger publication:

- `pnpm --filter @pm/agent-state typecheck`
- `pnpm test packages/agent-state/src/index.test.ts` (123 passed)
- `git diff --check`
- `pnpm typecheck`
- `pnpm test` (527 passed, 143 skipped)

Outcome: SQ98 is closed. SQ99 is now the active next substrate question, with SQ108 added as new policy-admission authority pressure.
