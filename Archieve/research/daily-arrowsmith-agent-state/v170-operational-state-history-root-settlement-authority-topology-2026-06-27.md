# v170 - Operational State History-Root Settlement Authority Topology

Date: 2026-06-27
Question closed: SQ117

## Research Question

What signer, quorum, or settlement authority topology makes history-root settlement records accountable instead of self-authored certificate-bearing rows?

## Sources

- Alvisi, Malkhi, Pierce, Reiter, and Wright, "Dynamic Byzantine Quorum Systems", DSN 2000: https://users.ece.cmu.edu/~reiter/papers/2000/DSN.pdf
- Malkhi and Reiter, "Byzantine Quorum Systems", Distributed Computing 1998: https://www.cs.utexas.edu/~lorenzo/corsi/cs380d/papers/bquorum-dc.pdf
- Melara et al., "CONIKS: Bringing Key Transparency to End Users", USENIX Security 2015: https://www.usenix.org/system/files/conference/usenixsecurity15/sec15-paper-melara.pdf
- Chuat, Szalachowski, Perrig, Laurie, and Messeri, "Efficient Gossip Protocols for Verifying the Consistency of Certificate Logs", IEEE CNS 2015: https://netsec.ethz.ch/publications/papers/gossip2015.pdf
- Naylor et al., "Quantitative Verification of Certificate Transparency Gossip Protocols", 2020: https://www.prismmodelchecker.org/papers/spc20.pdf
- Li, Krohn, Mazieres, and Shasha, "Secure Untrusted Data Repository (SUNDR)", OSDI 2004: https://www.usenix.org/conference/osdi-04/secure-untrusted-data-repository-sundr

## Mechanism Extracted

Dynamic Byzantine quorum systems and Byzantine quorum systems show that a quorum certificate is meaningful only relative to an explicit quorum universe and fault model. CONIKS and certificate-transparency gossip show why signed roots and consistency proofs need non-equivocation monitoring before they become trustworthy recovery evidence. SUNDR adds the fork-consistency bridge: untrusted history can be detected only when clients compare signed histories, so local views cannot settle state by themselves.

The substrate adaptation is a history-root settlement authority topology. v160 made history roots settled by hash-linked settlement records, but settlement certificates still carried self-declared `acceptedWitnessIds`. SQ117 closes that signer/topology gap: settlement certificates can be required to bind to a replayed settlement authority topology hash, and replay counts only unique active principals from that topology toward quorum.

## Existing Substrate Map

- v140 added history-root transparency and split-history detection over store roots.
- v150 added signed history-root observer proofs so root observations are attributable and verifier-bound.
- v160 added `OperationalStateHistoryRootSettlementRecord`, letting strict recovery require roots to be settled through replayed quorum-certified root history.
- v146 added generic authority-transition/topology primitives that can project principal status, quorum thresholds, and topology hashes from replayed authority history.
- v169 established the adjacent recovery-cut admission witness authority topology pattern.
- Before v170, `replayOperationalStateHistoryRootSettlementRecords()` checked certificate hash, subject, boundary, certified status, and certificate-declared quorum counts.

## Missing Substrate Map

- Before v170, a settlement record could name arbitrary `acceptedWitnessIds`; replay did not prove those witnesses were eligible settlement principals.
- The settlement certificate's `authorityTopologyHash` was not enforced against a replayed settlement topology.
- Duplicate settlement witness ids could satisfy certificate length checks.
- Suspended, revoked, equivocated, or unknown settlement witnesses could count as if they were active.
- Existing signed-observer and settlement records made roots accountable to rows, not to replayed signer authority.
- Still missing after v170: admission/witness/finality for the history-root settlement authority-transition ledger itself, settlement witness signature/key-status verification, runtime settlement-store adoption, authority compaction, and live Postgres privilege/restart proof.

## Primitive Proposal

Name: operational state history-root settlement authority topology.

Problem it solves: prevents self-authored history-root settlement records from authorizing recovery-root currentness by carrying certificates with arbitrary settlement witness ids.

Research source: dynamic Byzantine quorum systems, Byzantine quorum systems, CONIKS, certificate-transparency gossip verification, quantitative CT gossip verification, and SUNDR fork consistency.

Mechanism borrowed: a root-settlement statement is authoritative only under a replayed quorum membership/threshold configuration; consistency and non-equivocation require comparing roots under accountable witness authority, not trusting a local monitor or certificate-local signer list.

Why current substrate lacked it: v160 created settlement records over exact root commitments but did not bind settlement signer ids to replayed settlement authority.

Why existing primitives are insufficient: generic authority topology can represent eligible principals and thresholds, but history-root settlement replay did not consume it; signed observer proofs prove observation authenticity, not settlement witness eligibility.

State guarantee it should create: strict recovery transparency can accept a settled history root only when the settlement certificate is bound to a replayed authority topology hash and its unique active topology principals satisfy the topology quorum.

Admission rule it requires: history-root settlement replay accepts an optional/required settlement authority topology derived from authority transitions; when required, missing topology invalidates settlement replay, and certificates must bind to that topology hash.

Replay rule it requires: replay rejects missing required topology, tampered topology hashes, topology tenant/scope mismatch, missing topology quorum thresholds, certificate topology mismatch, duplicate settlement witnesses, unknown witnesses, inactive witnesses, and topology-quorum failures before a settled root can authorize recovery.

Authority boundary it requires: the settlement certificate remains over `operational_state_history_root_settlement`, but the certificate's `authorityTopologyHash` must equal the replayed settlement authority topology hash; only active principals in that topology count toward settlement quorum.

Failure modes it should prevent: one monitor's private settlement list, stale settlement authority, suspended or revoked settlement witnesses, duplicate signer amplification, certificate/topology substitution, connector-cache witness sets, and recovered current state authorized by settlement identities not present in replayed authority history.

Minimal implementation slice: extend history-root settlement replay with `settlementAuthorityTopology` and `requireSettlementAuthorityTopology`, validate certificate/topology binding and active unique topology quorum, expose strict recovery-transparency/action-review flags, add durable SQL authority-transition storage for this settlement lane, and add focused tests for valid topology-bound replay plus missing, unknown, suspended, duplicate, and topology-mismatched witness failures.

Tests that would falsify it: a valid topology-bound two-witness settlement fails; strict recovery transparency passes when settlement authority topology is required but absent; an unknown witness counts toward quorum; a suspended witness counts toward quorum; duplicate witness ids satisfy a two-witness topology quorum; a certificate with a wrong topology hash passes.

Axis surfaces that could later validate it: Axis C amnesiac recovery from split store roots, Axis A finance recovery after connector/worktree divergence, and Axis B/domain adapters attempting to settle roots with connector-owned monitor identities.

## Falsification Criteria

- A latest history-root settlement record with a certificate bound to the replayed topology hash and two unique active topology principals must satisfy strict recovery transparency.
- Strict recovery transparency must fail if settlement authority topology is required but the settlement replay does not contain one.
- Settlement replay must reject a certificate that names an unknown witness even when the certificate's own required/minimum count is met.
- Settlement replay must reject a certificate that names a suspended witness even when the certificate's own required/minimum count is met.
- Settlement replay must reject duplicate accepted witness ids as a topology-quorum failure.
- Settlement replay must reject a certificate whose authority topology hash does not match the replayed topology.

## Active 10-Question Backlog

1. SQ118: What signer, quorum, or policy-admission witness authority topology makes pruning-policy admission witness records accountable instead of self-authored certificate-bearing rows?
2. SQ119: What signer, quorum, or guard-admission witness authority topology makes storage mutation guard authorization admission witness records accountable instead of self-authored certificate-bearing rows?
3. SQ120: What signer, quorum, or checkpoint-admission witness authority topology makes tombstone-history checkpoint admission witness records accountable instead of self-authored certificate-bearing rows?
4. SQ121: What signer, quorum, or checkpoint-admission witness authority topology makes witness-ledger checkpoint admission witness records accountable instead of self-authored certificate-bearing rows?
5. SQ122: What signer, quorum, or proof-admission witness authority topology makes quorum-certificate proof-record admission witness records accountable instead of self-authored certificate-bearing rows?
6. SQ123: What signer, quorum, or checkpoint-admission witness authority topology makes authority-topology checkpoint admission witness records accountable instead of self-authored certificate-bearing rows?
7. SQ124: What signer, quorum, or proof-admission witness authority topology makes signature-verifier proof admission witness records accountable instead of self-authored certificate-bearing rows?
8. SQ125: What signer, quorum, or finalizer-proof admission witness authority topology makes authority epoch seal finalizer-proof admission witness records accountable instead of self-authored certificate-bearing rows?
9. SQ126: What admission, witness, or finality rule makes recovery-cut admission witness authority-transition history accountable instead of self-authored topology rows?
10. SQ127: What admission, witness, or finality rule makes history-root settlement authority-transition history accountable instead of self-authored topology rows?

## Failed Assumption Ledger

- Falsified: a certified history-root settlement record is enough if its certificate hash, subject, boundary, and declared witness count replay.
- Falsified: `acceptedWitnessIds` inside a settlement certificate can be treated as authority without replaying settlement signer topology.
- Falsified: signed-observer accountability plus settlement rows are sufficient without lane-specific replay of settlement witness authority.
- Still open: history-root settlement authority transitions now have an append-only durable table, but those transition rows still need their own admission/witness/finality rule before the topology store can be fully accountable.

## Proof Status

Implemented in `@pm/agent-state` and migrations:

- Extended `OperationalStateHistoryRootSettlementReplayInput` with `settlementAuthorityTopology` and `requireSettlementAuthorityTopology`.
- Extended `OperationalStateHistoryRootSettlementReplay` to expose the topology consumed by replay.
- Added history-root settlement authority issue codes for missing topology, topology hash/tenant/scope mismatch, certificate topology mismatch, missing quorum thresholds, duplicate witnesses, unknown witnesses, inactive witnesses, and topology-quorum failure.
- Strengthened `replayOperationalStateHistoryRootSettlementRecords()` so certificate signers are counted only as unique active principals under the replayed authority topology.
- Extended `evaluateOperationalStateRecoveryCutTransparency()` and `reviewProposedActionAgainstCurrentState()` with settlement-authority-topology strictness flags.
- Added migration `0087_agent_state_history_root_settlement_authority_transitions.sql` with append-only history-root settlement authority-transition rows.
- Added tests for valid topology-bound settlement replay, missing required topology refusal, unknown witness refusal, suspended witness refusal, duplicate witness refusal, and certificate topology mismatch refusal.

Verification before ledger publication:

- `pnpm --filter @pm/agent-state typecheck`
- `pnpm test packages/agent-state/src/index.test.ts` (170 passed)

Outcome: SQ117 is closed. SQ118 is now the active next substrate question, with SQ127 added as new history-root settlement authority-transition accountability pressure.
