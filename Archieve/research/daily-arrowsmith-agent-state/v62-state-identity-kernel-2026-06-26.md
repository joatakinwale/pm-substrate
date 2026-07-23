# v62 State Identity Kernel

Date: 2026-06-26
Status: substrate primitive implemented and focused tests passed
Parent: `research/daily-arrowsmith-agent-state/v61-representation-loss-packet-gate-2026-06-26.md`

## 1. Research Question Closed

Closed question: What substrate primitive would make an amnesiac agent able to recover current operational state from admitted transition history alone, without trusting conversation memory, summaries, worktree state, connector caches, or private snapshots?

Answer: pm-substrate needs a state identity kernel. The first implemented slice is a `ProjectionReplayCertificate` in `@pm/agent-state`. A current-state view can now carry a hash-verifiable replay certificate binding:

- tenant and subject;
- authority scope;
- projection version;
- ordered transition refs;
- transition-history hash;
- source refs;
- current-state-view projection hash;
- replay frontier position.

When `reviewProposedActionAgainstCurrentState()` is called with `requireReplayCertificate: true`, a view without a valid replay certificate cannot authorize action in blocking mode.

## 2. Peer-Reviewed Mechanism Sources

| Source | Mechanism extracted | Substrate adaptation |
| --- | --- | --- |
| Schneider 1990, "Implementing Fault-Tolerant Services Using the State Machine Approach" ([ACM](https://dl.acm.org/doi/10.1145/98163.98167), [Cornell PDF](https://www.cs.cornell.edu/fbs/publications/SMSurvey.pdf)) | Service state is the deterministic result of applying ordered commands to a state machine, not private replica memory. | Operational projection identity should be derived from replayed admitted transitions plus the deterministic projection function. |
| Mohan et al. 1992, "ARIES: A Transaction Recovery Method..." ([IBM](https://research.ibm.com/publications/aries-a-transaction-recovery-method-supporting-fine-granularity-locking-and-partial-rollbacks-using-write-ahead-logging), [PDF](https://web.stanford.edu/class/cs345d-01/rl/aries.pdf)) | Recovery repeats logged history to reconstruct database state after failure. | Agent resume should recover from durable transition history, not from chat or checkpoint summaries. |
| Chandy and Lamport 1985, "Distributed Snapshots" ([ACM](https://dl.acm.org/doi/10.1145/214451.214456), [PDF](https://lamport.azurewebsites.net/pubs/chandy.pdf)) | A global state is meaningful only when recorded as a consistent cut of local states and in-flight messages. | A current projection needs a named replay frontier; local views without a consistent frontier are representations only. |
| Buneman, Khanna, Tan 2001, "Why and Where: A Characterization of Data Provenance" ([Edinburgh record](https://www.research.ed.ac.uk/en/publications/why-and-where-a-characterization-of-data-provenance/)) | Derived data needs a computable account of where it came from and why it exists. | `CurrentStateView` source refs are not enough; the projection needs a replay proof tying source refs to transition history. |
| Green, Karvounarakis, Tannen 2007, "Provenance Semirings" ([ACM](https://dl.acm.org/doi/10.1145/1265530.1265535), [PDF](https://web.cs.ucdavis.edu/~green/papers/pods07.pdf)) | Query outputs can carry algebraic provenance describing contributing inputs. | Projection identity should include a derivation/provenance hash, not only a fluent representation of the result. |

## 3. Existing Substrate Map

1. Event log: append-only tenant events with content hashes, prior-event hashes, admissibility reports, and chain verification in `@pm/events`.
2. Projection runtime: deterministic projection interface and Postgres runner in `@pm/projections`, but before this run no reusable projection identity proof object.
3. Agent-state review: `CurrentStateView`, `ObservationContract`, read-set validation, `ActionProposalReview`, and replayable `StateReviewArtifact`.
4. External evidence admission: memory, tool handles, receipts, approvals, provider policy, runtime traces, and PM handoffs are admitted as `evidence_only`, never authority.
5. Terminal action outcome: `ActionOutcomeEnvelope`, terminal index, canonical hashes, workflow promotion, and exact one-terminal-outcome partitioning.
6. Workflow gate: write-capable invocation evidence binding, provider certificates, status refs, and terminal admission port.
7. Graph/capability authority: opt-in graph write authority policy, capability-kit resolver, substrate-record matching, and store-backed workflow-envelope authority recovery.
8. Continuity: hash-chained checkpoints, context rebuild, contradiction detection, and checkpoint-chain verification.
9. Local-view obstruction: conflicting local sections produce an obstruction instead of a global projection.
10. Evals: coverage, proof packets, source-bundle assembly, and strict authority recovery as measurement, not operational authority.
11. Domain adapters: ArrowHedge finance and agency publication adapters can produce canonical terminal envelopes without making core packages profile-specific.
12. Domain package absence: the prompt-listed `packages/domain` package is not present; domain attachment currently appears through package-specific adapters rather than a substrate-owned domain authority compiler.

## 4. Missing Substrate Map

1. State identity kernel: partially implemented in this run as `ProjectionReplayCertificate`; still needs durable event-store generation rather than caller-supplied refs.
2. Projection replay admission port: no operational runtime requires replay certificates at all current-state read or mutation boundaries yet.
3. Replay cursor API: `@pm/events` and `@pm/projections` do not yet expose a typed frontier object containing position, last hash, consumed refs, and projection hash.
4. Authority topology: `authorityScope` is still a string, not a typed authority graph with delegation, override, and revocation semantics.
5. Admission calculus: evidence admission, terminal outcomes, provider status, graph authority, and projection replay are separate gates rather than one compositional mutation decision object.
6. General obstruction algebra: local-view obstruction exists, but replay-frontier disagreement, authority-scope disagreement, and connector-cache disagreement do not share one obstruction type.
7. Agent amnesia recovery protocol: continuity can rebuild context, but no kernel yet reconstructs open operational scopes solely from terminal envelopes plus replay-certified projections.
8. Connector/worktree quarantine: filesystem state, connector caches, local branches, and tool outputs can be evidence, but there is no substrate-native lease/quarantine protocol for them.
9. Settlement/finality layer: accepted terminal outcomes can authorize internal writes, but target-side applied receipts and external finality remain fixture/pure evidence lanes.
10. Domain authority compiler: profile/capability packages still hand-select required refs, and no `packages/domain` boundary exists; no compiler derives required replay transitions and authority scopes from domain contracts.
11. Run-wide monitor: no proof object yet says every operational write in a run passed terminal, provider-status, graph-authority, and projection-replay enforcement.

## 5. Active 10-Question Backlog

The active unanswered substrate research backlog contains exactly 10 questions:

1. SQ01: What event-store or projection-runner API should generate `ProjectionReplayCertificate` from durable log records rather than caller-supplied transition refs?
2. SQ02: What typed authority topology should replace raw `authorityScope` strings so delegation, override, and revocation are replayable?
3. SQ03: What admission calculus composes evidence admission, provider status, terminal outcome, graph authority, and projection replay into one mutation decision?
4. SQ04: What replay rule makes connector cache, tool output, MCP handle state, and local filesystem/worktree state expire unless recertified?
5. SQ05: What obstruction algebra should represent disagreement between replay certificates, local views, authority scopes, and inter-agent consensus?
6. SQ06: What settlement/finality object proves an external target-side side effect was applied and cannot be replaced by a dispatch log?
7. SQ07: What recovery kernel lets an amnesiac agent rebuild all open operational scopes from terminal history, replay-certified projections, and continuity checkpoints?
8. SQ08: What domain authority compiler maps profile/capability contracts into required replay transitions without core substrate edits?
9. SQ09: What substrate primitive turns local worktree diffs and draft files into proposals that cannot outrank admitted transition history?
10. SQ10: What monitor/proof object can show that every operational write in a run passed replay-certificate enforcement, not just terminal-outcome recovery?

## 6. Primitive Proposal Ledger

Name: State Identity Kernel, first slice `ProjectionReplayCertificate`.

Problem it solves: `CurrentStateView` could previously act like a representation with source refs and a projection version. It did not prove that its identity came from an admitted replay frontier.

Research source: Schneider state-machine approach, ARIES recovery, Chandy-Lamport consistent cuts, database provenance.

Mechanism borrowed or adapted: deterministic state reconstruction from ordered transition history plus recovery/frontier metadata.

Why current substrate lacked it: The repo had event hashes, projection runners, terminal envelopes, and state-review artifacts, but no reusable certificate binding a projection view to ordered admitted transition refs and a replay frontier.

Why existing primitives were insufficient: `StateReviewArtifact` proves a review artifact hash. `ActionOutcomeEnvelope` proves one terminal action outcome. Continuity checkpoints preserve evidence-linked summaries. None proves that the current projection itself is the admitted replay result.

State guarantee it should create: A projection cannot authorize action when replay proof is required unless its identity hash, transition history hash, authority scope, source refs, subject, tenant, and replay position match the current view.

Admission rule it requires: Write-capable action review may set `requireReplayCertificate: true`; in blocking mode, missing or invalid replay identity blocks execution.

Replay rule it requires: Recompute certificate hash, transition-history hash, and current-state-view identity hash before trusting the projection.

Authority boundary it requires: The certificate binds `authorityScope` to the current view's required authority rule or an explicitly expected scope.

Failure modes it should prevent:

- private memory or document summaries posing as transition history;
- stale replay frontiers authorizing mutation;
- tampered views reusing old certificates;
- hash-valid certificates omitting the projection version of the current view;
- source refs changing after certification;
- certificate authority scope mismatch;
- missing transition hashes under stricter replay policy.

Minimal implementation slice:

- Added `ProjectionReplayCertificate` types and schema constant in `@pm/agent-state`.
- Added certificate builder, hash verification, transition-history hash, current-state-view identity hash, and evaluator.
- Added opt-in `requireReplayCertificate` review option.
- Added `projection_replay` warning source and invariant class.
- Added focused tests for missing, valid, tampered, and private-representation transition cases.

Tests that would falsify it:

- A blocking review with `requireReplayCertificate: true` allows a view with no certificate.
- A tampered view passes with an old certificate.
- A private document/source ref can stand in for an admitted transition.
- A stale replay frontier passes a higher required position.
- A certificate hash mismatch is ignored.

Axis surfaces that could later validate it:

- Axis A representation-loss packet family should consume the new certificate rather than inventing finance-only projection checks.
- Axis B publication and approval views should certify replay from lifecycle/approval events.
- Axis C local lab should replace inline causal-position logic with replay-certified views where possible.

## 7. Falsification Criteria Written Before Implementation

1. Missing certificate under `requireReplayCertificate` must make blocking action review refuse execution.
2. Hash-valid certificate with event transition refs, content hashes, and sufficient replay position must pass.
3. Changing source refs after certification must fail source-ref and projection-hash checks.
4. A private document summary must fail as an invalid transition ref.
5. A replay position lower than the required frontier must fail.
6. A hash-valid replay certificate that omits the current view's projection version must fail.

## 8. Failed Assumption Ledger

| Assumption | Status | Evidence |
| --- | --- | --- |
| `CurrentStateView` plus source refs and projection version is enough state identity. | Falsified for this goal. | It can be constructed by adapters without proving ordered admitted replay. |
| Continuity checkpoints by themselves make agent resume operationally safe. | Downgraded. | Checkpoints preserve evidence-linked context, but summaries are not projection identity. |
| Projection determinism comment in `@pm/projections` is enough. | Falsified. | The rule existed as architecture text but not as a proof object enforceable at action review. |
| Axis packet work is the right first move for memory drift. | Downgraded for this lane. | Axis packets validate pressure; the missing substrate object was replay identity. |

## 9. Implementation Frontier

Implemented now:

- `@pm/agent-state` has a pure `ProjectionReplayCertificate` substrate primitive.
- `reviewProposedActionAgainstCurrentState()` can require replay proof and block action review when proof is absent or invalid.
- `projection_replay` is a policy-visible invariant class.

Remaining frontier:

1. Generate certificates from `@pm/events` or `@pm/projections` stores, not from caller-supplied transition refs.
2. Require replay certificates in real write-capable runtime paths, starting with one adapter under strict policy.
3. Store and recover certificates through durable packet/state-review stores.
4. Connect replay certificates to continuity context so amnesiac resume can rebuild views rather than trust checkpoint summaries.
5. Generalize replay disagreements into obstruction artifacts.

## 10. Proof Status

Commands run:

```bash
pnpm exec vitest run packages/agent-state/src/index.test.ts
pnpm --filter @pm/agent-state typecheck
```

Result:

- `packages/agent-state/src/index.test.ts`: 31 tests passed.
- `@pm/agent-state` typecheck passed.

Proof boundary:

This is a substrate-level pure primitive and opt-in review gate. It does not yet prove all operational writes are replay-certified, because no durable event/projection store generation path or production adapter enforcement has been wired.
