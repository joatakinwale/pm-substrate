# v222 Operational State Separation-of-Duty Proof

Date: 2026-06-27

Closed question: SQ169 - What separation-of-duty proof primitive prevents the same authority path from both admitting and executing protected mutation while remaining replayable across nested authority recursion?

New question: SQ179 - What verifier-authority admission primitive makes separation-of-duty proof verifiers replayable and non-self-authored so role-separation checks cannot become private authority?

Outcome: add a new substrate mechanism.

## Research Sources

- David D. Clark and David R. Wilson, "A Comparison of Commercial and Military Computer Security Policies," IEEE Symposium on Security and Privacy, 1987. Mechanism: commercial integrity is protected through well-formed transactions and separation of duty rather than trusting the user who is authorized to act. Source: https://www.semanticscholar.org/paper/A-Comparison-of-Commercial-and-Military-Computer-Clark-Wilson/f97356ffef4cab0adc41e57f7c5b8df53ba481db
- David R. Kuhn, "Mutual Exclusion of Roles as a Means of Implementing Separation of Duty in Role-Based Access Control Systems," ACM RBAC 1997. Mechanism: formal safety condition that no one user should possess privileges to execute every step of a task. Source: https://www.nist.gov/publications/mutual-exclusion-roles-means-implementing-separation-duty-role-based-access-control
- Ravi Sandhu et al., RBAC feature/motivation work. Mechanism: dynamic separation of duty constrains simultaneous role activation, while operational separation of duty prevents one user from performing all operations in a critical function. Source: https://tsapps.nist.gov/publication/get_pdf.cfm?pub_id=916537
- Ninghui Li, Mahesh V. Tripunitara, Qihua Wang, "On Mutually Exclusive Roles and Separation-of-Duty." Mechanism: mutual exclusion is a mechanism for enforcing SoD; workflow constraints can be expressed as subject/task non-coexecution rules. Source: https://www.cs.purdue.edu/homes/ninghui/papers/sod-j.pdf

## Existing Substrate Map

- Storage mutation guards already compile protected `DELETE`/`UPDATE` table rules and require tombstone-derived authorization hashes.
- `OperationalStateStorageMutationGuardAuthorizationAdmissionRecord` makes guard authorizations replayable.
- Guard authorization admission witness records and nested witness-authority transition-admission replay can prove that the admission row is current and witness-certified.
- `evaluateOperationalStateStorageMutationGuard()` already rejects missing, stale, mismatched, unwitnessed, or non-replay-current guard authorizations.

## Missing Substrate Map

- No primitive proved that the principal/path admitting a protected mutation was different from the principal/path executing it.
- A replay-current admission row could still authorize execution by the same authority path that admitted or witnessed the row.
- Existing witness quorums prove row accountability, but not role-path disjointness across admission and execution.
- The database had no append-only proof ledger requiring conflict-free separation before protected mutation execution.
- The next gap is SoD verifier authority: v222 can record `evaluatedBy`/`verifierId`, but it does not yet prove that the verifier itself is admitted authority.

## Primitive Proposal

Name: `OperationalStateSeparationOfDutyProof`

Problem it solves: protected mutation authority must not collapse into a single private or local authority path that both admits the authorization and executes the destructive write.

Mechanism borrowed or adapted: RBAC mutual exclusion and dynamic/operational separation of duty become a replayable proof over two authority paths: admission path and execution path. Clark-Wilson supplies the integrity frame: mutation must go through certified procedures and separated duties, not arbitrary trusted users.

Why current substrate lacked it: guard admission replay and witness quorum were about whether an authorization row was current and accountable. They did not compare the admitting/witnessing path with the executor path.

Why existing primitives were insufficient: quorum certificates can still be produced by a path that later executes the mutation. Authority topology answers "who may witness"; it does not answer "may that same path execute this protected mutation."

State guarantee it should create: a protected mutation cannot consume an admitted guard authorization under strict mode unless a replayable proof binds the latest admission record and concrete mutation request to disjoint admission and execution authority ids.

Admission rule it requires: strict guard evaluation may set `requireSeparationOfDutyProof`. Evaluation fails if the proof is missing, invalid, hash-tampered, tenant/scope/subject/authorization mismatched, lacks replayed admission authorities, lacks executor identity, overlaps admission/execution authority ids, or claims operational mutation authority.

Replay rule it requires: `separationOfDutyProofHash` is computed over the canonical proof envelope. The proof binds tenant, authority scope, authority boundary, subject kind/id/sequence/hash, guard/table/operation, target sequence, authorization hash, admission-record hash, admission role/path, execution role/path, proof rule, verifier identity, result, and adapter claims.

Authority boundary it requires: the proof may establish only admission/execution disjointness and request binding. It cannot itself claim mutation admission, finality, or currentness.

Failure modes it should prevent:

- The same witness id admits a guard authorization and executes the protected deletion.
- A SoD proof for one admission record is replayed against another admitted authorization.
- A SoD proof for one target sequence is replayed against a different destructive request.
- A local adapter claims "protected mutation authorized" inside the SoD proof.
- A database row stores a non-disjoint or invalid proof as admitted proof state.

Minimal implementation slice:

- Added `OperationalStateSeparationOfDutyProof` and `OperationalStateSeparationOfDutyProofInput`.
- Added `buildOperationalStateSeparationOfDutyProof()`, `computeOperationalStateSeparationOfDutyProofHash()`, and `verifyOperationalStateSeparationOfDutyProofHash()`.
- Extended `evaluateOperationalStateStorageMutationGuard()` with `separationOfDutyProof` and `requireSeparationOfDutyProof`.
- Made SoD proof use force replay of guard authorization admission history, because role separation without the admitted record would be memory-only assertion.
- Added migration `0139_agent_state_separation_of_duty_proofs.sql`, an append-only proof ledger requiring `result = 'valid'`, `disjoint = true`, non-empty admission/execution authority ids, and empty conflict ids.
- Added a focused falsification test proving valid disjoint execution plus missing-proof, overlapping-authority, subject-mismatch, and claim-overreach rejection.

Tests that would falsify it:

- Strict storage mutation guard execution succeeds with no SoD proof.
- A proof where any admission authority id is also an execution authority id succeeds.
- A proof bound to a different admission record succeeds.
- A proof for a different target sequence or authorization hash succeeds.
- A proof with no execution authority id succeeds.
- A proof with an adapter claim such as `protected_mutation_authorized` succeeds.
- The SQL ledger accepts invalid, non-disjoint, or conflict-bearing proof rows.

Axis surfaces that could later validate it:

- Axis A: finance research ingestion pruning/deletion where the actor admitting deletion authority cannot be the actor executing it.
- Axis B: domain adapter mutation where campaign/customer table mutation requires separated admitter/executor paths.
- Axis C: direct local agent-state protected mutation where an amnesiac agent must recover both the admitted authorization and disjoint execution proof from history, not memory.

## Implementation Frontier

v222 strengthens storage mutation guard execution. It does not yet provide verifier-authority admission, verifier key transparency, SoD proof revocation/currentness, proof-ledger replay APIs, cross-domain runtime adoption, or recursive SoD for every authority-transition admission lane. SQ179 captures the next self-authoring risk: the SoD verifier id must become replayable authority.

## Proof Status

Implemented and locally verified in `@pm/agent-state` with focused typecheck and the new separation-of-duty falsification test. Broader package and repo verification remain required before promotion.
