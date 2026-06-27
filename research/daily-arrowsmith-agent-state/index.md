# Daily Arrowsmith Agent-State Research Index

Last updated: 2026-06-26
Scope: pm-substrate agent-state, operational-state, memory, workflow-agent, project-management, cross-domain Arrowsmith research, and multi-agent repository coordination.

## Collaboration Protocol

Each daily research continuation must begin by fetching `origin/main` and checking whether other developers or automations added research files, index changes, changelog entries, or relevant implementation changes. If new research exists, the next version must read it, reconcile it with the local draft, and update this index plus the top-level `research/index.md` ledger before publishing.

The run is not complete until the intended research slice is committed on `main`, pushed to `origin/main`, and the local and remote SHAs are rechecked. If parallel research creates duplicate version numbers, preserve the branch artifact when useful, mark the canonical version, and record the reconciliation in the ledger.

## Current Strongest Thesis

LLM agents are statistical predictors promoted into actors. The state problem appears when parametric model state, prompt/inference state, memory/RAG state, tool-observation state, or inter-agent communication state is treated as current, sufficient, authoritative operational state. pm-substrate is the governed operational-state layer between statistical prediction and valid action.

The immediate primitive now exists as a pure review and artifact boundary: `CurrentStateView + original ObservationContract + ObservationContractEvaluation + ReadSetValidation + ActionProposalReview + StateReviewArtifact`. The durable artifact lifecycle and first external-evidence frontier are now implemented in code: deterministic JSON/JSONL export/import, replay hash validation, ArrowHedge corpus generation, continuity payload linkage, `state_review_artifact` eval refs, artifact-derived metrics, DB/fixture equivalence helpers, observed read-set comparison, all three temporal misalignment fixture phases, an invariant-class `wouldBlock` policy matrix, and committed replayable corpora for external-evidence admission, ArrowHedge state-review artifacts, and write-binding attempts.

The current frontier is now broader and more precise: selected write-capable workflow dispatch can block missing, incomplete, policy-blocked, catalog-unverified, or certificate-invalid evidence bindings when `evidenceBindingMode: "require_for_writes"` is enabled, but broad mutation governance remains unclaimed. The replay/catalog lane now includes deterministic admission certificate ids/digests, validity windows, policy version, revocation epoch, execution identity, and strict tenant/workflow replay checks. v13 closed the memory-write/read taxonomy seam. v14 partly closed the target-receipt seam as a pure replay primitive: `target_receipt` is a first-class evidence kind, dispatch-only pseudo-receipts warn instead of reading as delivery proof, and replay metrics distinguish dispatch-only from applied receipts. v15 identifies status-currentness as the next authority boundary: certificates, receipts, MCP handles, task ids, and PM acknowledgements need decision-time status checks for revocation, suspension, refresh, staleness, status authority, and privacy/correlation risk. v16 adds a stricter enforcement correction from the local June 18 ArrowHedge live-bridge audit: a block event is not proof of mutation prevention unless the action lifecycle has a mutually exclusive terminal outcome. v17 reviews the strongest "reality qualities" papers and converts them into executable bridge concepts. v18 starts the closed research loop with ten peer-reviewed-paper-backed questions and converts the first candidate into pure `ActionOutcomeEnvelope` tests. v19 answers RQ11, adds RQ21, and wires `action_outcome_envelope` refs into Axis A/C eval events while recording Axis B as blocked by missing PluggedInSocial/fixtures. v20 answers RQ21 by adding write-transport outcome-envelope coverage metrics. v21 answers RQ22 by putting runtime outcome-envelope creation at the existing workflow evidence-binding gate; the fixture inventory now reports 4/4 workflow-routed write transports have an outcome-envelope provider. v22 answers RQ23 by promoting runtime workflow envelopes into canonical `@pm/agent-state` envelopes without duplicating terminal claims; ArrowHedge write-binding replay rows now carry accepted/blocked proof packets. v23 answers RQ24 by adding a replay index that resolves EvalEvent `action_outcome_envelope` refs back to committed promoted packets and recovered terminal outcomes. v24 answers RQ25 by adding a Postgres-backed packet table/store for hash-verified terminal envelopes. v25 answers RQ26 by generating canonical Axis C packets in both the deterministic eval scaffold and dynamic local-agent-lab engine, with the DB runner persisting packets before EvalEvents. v26 answers RQ27 by converting dynamic `ScenarioRun` records into packet-backed `live_run` EvalEvents and verifying one stale-observation run end-to-end against local Postgres/Ollama. v27 answers RQ28 by requiring one protective packet-backed live pair per taxonomy class and registering all ten dynamic Axis C scenarios; a local Postgres/Ollama run produced 20 EvalEvents, 20 packets, 10 baseline failures, 0 substrate failures, and complete Axis C live coverage. v28 answers RQ29 by adding a three-axis coverage analyzer over all 30 `(axis, failureClass)` cells, separating protective coverage from stricter verification and preserving Axis B blockers. v29 answers RQ30 by splitting scenario oracle verdict from operational terminal outcome, so terminally blocked protective refusals can verify scenario passes when backed by `ActionOutcomeEnvelope` refs. v30 answers RQ31 by adding a traceable three-axis proof packet and arm-scoped ArrowHedge terminal refs, making the current Axis A incomplete / Axis B blocked / Axis C verified state explicit. v31 corrects the implementation frontier: terminal-ref validity belongs in the substrate codebase first, so `@pm/agent-state` now has a hash-gated terminal outcome index and stronger admission primitive. v32 makes ArrowHedge the first domain consumer of that terminal index at its proposal-review write boundary. v33 adds a dependency-light workflow terminal admission port so `@pm/workflow` can admit accepted/blocked invocation envelopes before dispatch/dead-letter without importing `@pm/agent-state`. v34 adds an agency publication terminal adapter in `@pm/profile-agency`, so accepted authoritative agency fixtures can become canonical terminal envelopes without substrate-package edits. v35 exposes terminal-admission provider refs through typed capability write contracts and registry discovery, so provider coverage can be derived from codebase descriptors rather than hand-edited eval inventories. v36 adds provider-side manifests plus registry verification, so missing, unavailable, deprecated, version-incompatible, package/export-drifted, or narrower provider implementations cannot count as verified coverage. v37 promotes verified manifests into status-bearing provider certificates and adds an opt-in workflow runtime certificate gate before write-capable dispatch. v38 adds a substrate-owned Postgres certificate status store and wires workflow to consume it directly. v39 turns certificate status changes into append-only replayable events and historical lookup. v40 binds exact certificate status-event refs into workflow `ActionOutcomeEnvelope`s. v41 adds an opt-in graph write-authority policy so graph mutations can require accepted workflow authority and provider-certificate status refs before SQL. v42 propagates that authority policy into capability-kit raw graph updates before `apply` or SQL. v43 adds store-backed substrate-record matching so strict policies can reject forged valid-looking refs. v44 adds a structural workflow-to-capability authority connector plus a real lead-scoring adapter hook. The remaining proof boundary is enabling strict policies in Axis A/B/C runners with store-sourced authority resolutions, filling Axis A, and keeping Axis B blocked until PluggedInSocial or accepted authoritative fixture runs exist.

v45 update: `@pm/capability-kit` now has a store-backed resolver factory that loads workflow envelopes by tenant/envelope id before returning graph authority. The remaining proof boundary is preserving/recovering provider-status authority metadata from canonical packet stores, filling Axis A, and keeping Axis B blocked until PluggedInSocial or accepted authoritative fixture runs exist.

v46 update: canonical `ActionOutcomeEnvelope` packets now preserve provider certificate id/digest/status refs, and `PostgresEvalEventStore` can recover the structural workflow-authority envelope shape by tenant/envelope id. The remaining proof boundary is composing that recovery with strict graph/capability policy inside Axis A/C runners while Axis B remains explicitly blocked.

v47 update: `@pm/evals` now has `auditEvalEventGraphWriteAuthority()`, a structural runner/audit primitive that recovers an EvalEvent's outcome packet, composes with a store-backed authority resolver such as `graphWriteAuthorityResolverFromWorkflowEnvelopeStore()`, validates strict graph authority policy, and distinguishes accepted recovered authority from blocked terminal outcomes that correctly refuse authority. The accepted ArrowHedge write-binding replay packet now carries provider-status metadata. The remaining proof boundary is making Axis A/C live/scenario runners require this audit as a gate and feed the result into proof packets; Axis B remains blocked until PluggedInSocial or accepted authoritative fixtures exist.

v48 update: `ThreeAxisProofPacket` now has an opt-in authority-recovery gate. When `requireAuthorityRecovery` is enabled, terminal-proof-backed events need valid authority recoveries with expected statuses before the proof packet can remain `verified`. Missing, invalid, or wrong-status recoveries make the packet unverified. The remaining proof boundary is making Axis A/C runner scripts generate those recoveries from real packet stores and store-backed resolvers.

v49 update: local-lab runner scripts now generate store-derived authority recovery summaries after packet persistence by composing `PostgresEvalEventStore` with `graphWriteAuthorityResolverFromWorkflowEnvelopeStore()` under strict graph policy. `@pm/evals` now has batch authority auditing. The remaining proof boundary is making accepted Axis A/C runner-produced packets carry real provider-status-bearing authority metadata so those store-derived recoveries can pass the strict proof-packet gate.

v50 update: `@pm/agent-state` now has a reusable `buildActionOutcomeProviderAuthority()` helper, dynamic local-agent-lab accepted packets carry local provider certificate/status metadata, deterministic local-lab accepted packets do the same, and strict local-lab authority recovery now passes over generated packets. The remaining proof boundary is feeding runner-generated `authorityRecoveries` into `buildThreeAxisProofPacket({ requireAuthorityRecovery: true })` without hiding Axis B blockers or no-DB runner gaps.

v51 update: `@pm/evals` now exposes `buildStrictThreeAxisProofPacket()`, and local-lab runner scripts print strict proof-packet summaries before and after persisted authority recovery. No-DB deterministic output now remains explicitly unverified with missing authority-recovery obligations instead of implying strict proof. The remaining proof boundary is an all-axis proof-packet assembler that combines Axis A, Axis C, and Axis B blocker/fixture sources with per-source recovery provenance.

v52 update: `@pm/evals` now exposes `buildStrictThreeAxisProofPacketAssembly()`, which accepts source bundles, validates declared event counts, builds one strict proof packet, and returns per-source recovery provenance (`provided`, `missing_required`, or `not_required`). Axis B blocker sources remain blocked without synthetic recovery obligations. The remaining proof boundary is producing real Axis A ArrowHedge finance source bundles with persisted packets and recovery suites.

v53 update: `@pm/evals` now exposes `buildArrowHedgeWriteBindingProofSourceBundle()`, which builds a finance source bundle from the committed ArrowHedge write-binding replay corpus and can consume strict authority recoveries from replay packets. The terminal-outcome partition cell is now recovery-backed, while finance remains incomplete for failure classes that still lack packet-backed pairs.

v54 update: `@pm/capability-finance-research-ingest` now exposes a domain-owned ArrowHedge terminal packet corpus over the canonical state-review inputs. It emits one accepted clean/current packet with provider-status authority metadata and three blocked temporal packets, validates packet hashes, and runs the core terminal index. The default ArrowHedge action-id derivation now distinguishes `refreshId`, `feedbackId`, and missing-observation refreshes so adjacent finance actions do not collapse into one terminal action id. The next proof is mapping these domain packets into Axis A EvalEvents/source bundles with store-derived recoveries.

v55 update: `@pm/evals` now accepts opt-in ArrowHedge scenario specs, and exports canonical temporal packet scenarios for mapping real finance-domain packets into Axis A EvalEvents. The finance adapter test builds the real canonical packet corpus, maps three blocked temporal packets into Axis A, and proves those cells become covered but not verified because baseline terminal proof and authority recoveries are still missing.

v56 update: `@pm/evals` now distinguishes failed baseline terminal observations from substrate authority recovery obligations. A baseline failed comparator event can remain replay evidence without requiring `accepted_authority_recovered`, while substrate accepted/protective outcomes still need the expected store-derived recovery before strict proof can pass. The next proof is persisted baseline-side terminal observation packets plus substrate-side recovery suites for mapped ArrowHedge finance families.

v57 update: `@pm/capability-finance-research-ingest` now exposes `buildArrowHedgeCanonicalPairedActionOutcomeEnvelopeCorpus()`. The paired corpus emits baseline advisory comparator packets with no provider authority and substrate protective packets for the canonical temporal ArrowHedge scenarios, allowing Axis A to verify those three temporal cells with substrate-only recovery while keeping the finance axis incomplete for missing packet-backed failure classes.

v58 update: `@pm/evals` now exposes `buildArrowHedgeTerminalPacketProofSourceBundle()`, and the finance paired-packet test persists paired packets through `PostgresEvalEventStore` before recovering substrate terminal refusals. The current Axis A temporal proof path is now reusable and store-backed, but still incomplete until additional packet-backed failure families cover `memory_drift`, `continuity_break`, and the remaining finance gaps.

v59 update: `@pm/continuity` now exposes a reusable checkpoint-chain verifier, `PostgresContinuityLedger.verify()` consumes it, and ArrowHedge terminal packets can carry continuity checks that block private-memory drift or missing terminal history. Axis A now has store-backed paired packet proof for five failure families, including `memory_drift` and `continuity_break`, while the finance axis and three-axis solution remain unverified until the remaining Axis A gaps and Axis B blocker are resolved.

v60 update: ArrowHedge now classifies risk/signal snapshot mismatches as `source_authority_conflict` instead of generic `state_disagreement`, exports a source-authority packet fixture family, and maps it through Axis A terminal packet scenarios. Store-backed paired Axis A proof now covers six failure families, while `representation_loss`, `workflow_invalidation`, `capability_contract_violation`, `parallel_write_conflict`, and Axis B remain open.

v61 update: The prompt's observation-report / action-proposal / JSON-artifact implementation frontier is corrected as already closed on the current branch. RQ71 is narrowed into an implementation sequence: build `representation_loss` next as a projection-admission packet family using invariant-field preservation and local-view obstruction semantics, then continue to `workflow_invalidation`, `capability_contract_violation`, and `parallel_write_conflict`. Recent LLM framing and human-AI mental-model work downgraded summary/shared-context stability as state proof, while abstract interpretation and handoff literature sharpened the falsification test for lossy projections.

v62 update: The discovery lane resets the next move from Axis A packet expansion to substrate identity. `@pm/agent-state` now has a pure `ProjectionReplayCertificate` state identity kernel: current-state views can carry a hash-verifiable replay certificate binding tenant, subject, authority scope, source refs, projection version, ordered admitted transition refs, transition-history hash, projection hash, and replay frontier. Blocking action review can require replay proof through `requireReplayCertificate`; the remaining frontier is durable event/projection-store certificate generation and enforcement at real write-capable runtime boundaries.

v63 update: SQ01 is closed by adding a sequence-backed projection replay frontier. `@pm/projections` now exposes `ProjectionReplayFrontier`, `ProjectionRunner.getReplayFrontier()`, and a `last_event_seq` cursor over `events.events.seq`; `@pm/agent-state` can mint `ProjectionReplayCertificate`s from that frontier while rejecting tenant/projection-version mismatch. The next substrate question is SQ11: which real write-capable runtime boundary should require replay-frontier certificates, and what obstruction should it emit when frontier proof is absent or stale?

v64 update: SQ11 is closed by adding a projection replay write gate to graph write authority. `@pm/graph` now has `GraphWriteProjectionReplayRef`, replay-proof policy options, and obstruction codes for missing, invalid, mismatched, or stale replay proof; `@pm/capability-kit` inherits the gate before capability `apply()` and graph SQL. The next substrate question is SQ12: persist full projection replay certificates so write gates can verify durable certificate hashes rather than structural refs alone.

v65 update: SQ12 is closed by adding a substrate-owned projection replay certificate store. `@pm/agent-state` now has durable certificate record/store semantics plus in-memory/Postgres implementations, action-outcome envelopes preserve `projectionReplayRef`, eval packet recovery returns replay refs, and `@pm/capability-kit` can verify a replay ref against the certificate store before capability `apply()`. The next substrate question is SQ13: what tamper-evident certificate-store root proves the store is append-only and non-equivocating across agents, resumes, and write gates?

v66 update: SQ13 is closed by adding a projection replay certificate-store root. `@pm/agent-state` now models append-only certificate-store entries and roots, verifies hash-chain consistency proofs, and can require replay refs to cite store sequence, entry hash, and root hash. `@pm/capability-kit` can require store commitments before `apply()`, while `@pm/graph` preserves those fields structurally. The next substrate question is SQ14: what witness or root-gossip protocol forces divergent store roots to become obstructions across agents and resumes?

v67 update: SQ14 is closed by adding a projection replay certificate-store root witness. `@pm/agent-state` now has a pure witness evaluator, in-memory witness, and replayable root obstruction artifact; root advances require consistency proofs from the latest witnessed root and same-sequence forks obstruct. `@pm/capability-kit` can require witness acceptance before returning workflow-derived graph write authority. The next substrate question is SQ15: what durable witness ledger or quorum rule makes root-witness observations themselves replayable across restarts, agents, and independent monitors?

v68 update: SQ15 is closed by adding a projection replay root-witness ledger. `@pm/agent-state` now has hash-linked witness observation records, deterministic witness record hashing, ledger replay with decision recomputation, in-memory/Postgres witness ledgers, and a ledger-backed witness that recovers accepted roots from replay instead of process memory. The next substrate question is SQ16: what quorum or finality policy decides when one or more witnessed roots become settled operational authority rather than provisional authority?

v69 update: SQ16 is closed by adding projection replay root-witness settlement. `@pm/agent-state` can now classify replayed certificate-store roots as `provisional`, `witnessed`, `settled`, or `obstructed` from valid witness-ledger replays plus an explicit quorum policy; tampered ledgers and duplicate witness ids cannot count, and valid same-sequence conflicting roots obstruct settlement. The next substrate question is SQ17: what witness-principal authority topology decides which replayed witness ledgers are eligible to count toward settlement, and how are equivocation, revocation, and membership epochs admitted?

v70 update: SQ17 is closed by adding projection replay root-witness authority topology. `@pm/agent-state` now has hash-linked witness-authority transitions for quorum, admission, suspension, revocation, and equivocation; topology replay derives eligible witness principals for a root sequence, and settlement can count only topology-eligible witness ledgers. The next substrate question is SQ18: what durable authority-transition and settlement-certificate store prevents callers from supplying synthetic witness topology or settlement objects?

v71 update: SQ18 is closed by adding durable projection replay root-witness authority and settlement stores. `@pm/agent-state` now has in-memory/Postgres stores for authority transitions, store-assigned authority sequence/previous-hash admission, settlement-record hashing and replay, in-memory/Postgres settlement stores, and migration `0027_agent_state_projection_replay_witness_authority_settlement.sql`. The next substrate question is SQ19: what strict write-gate admission rule requires durable settled-root certificates before graph/capability mutation, so replayed topology and settlement stores cannot remain advisory?

v72 update: SQ19 is closed by adding a strict projection replay settled-root write gate. `@pm/graph` can require `projectionReplayRootSettlementRef` before SQL, `@pm/capability-kit` can verify that ref against a durable settlement store before constructing graph authority, and canonical action-outcome/eval packet recovery preserves the settled-root proof. The next substrate question is SQ20: what settlement-currentness model prevents an old durable settled-root certificate from authorizing writes after later obstruction, topology change, policy supersession, or settlement-store fork?

v73 update: SQ20 is closed by adding projection replay settlement currentness policy. `@pm/agent-state` now verifies settled-root refs against replayed settlement history under explicit latest-root, latest-same-root, no-later-conflict, no-later-obstruction, minimum-frontier, and topology-hash checks; `@pm/capability-kit` can pass that policy to the settlement store before constructing graph authority. The next substrate question is SQ21: what settlement-store head transparency or witness primitive prevents hidden truncation or forked settlement history when the caller lacks a minimum frontier?

v74 update: SQ21 is closed by adding projection replay settlement-store head witnessing. `@pm/agent-state` now derives settlement-store heads from replayed settlement records, can require a witnessed head during currentness verification, and has replayable head-witness records that reject unproved advances, stale duplicate heads, forked heads, and tampered decisions. `@pm/capability-kit` can observe a settlement-store head and bind it into verification before returning graph authority. The next substrate question is SQ22: what durable cross-agent settlement-head witness store or gossip protocol makes head observations survive process restart and independent agent comparison?

v75 update: SQ22 is closed by adding durable projection replay settlement-head witness storage. `@pm/agent-state` now has a Postgres-backed settlement-head witness ledger and migration `0028_agent_state_projection_replay_settlement_head_witness.sql`; a fresh ledger-backed agent can replay another agent's witnessed settlement heads and reject an old head as a regression. The next substrate question is SQ23: what quorum/topology policy decides which settlement-head witnesses are eligible and how many independent head observations are required before a head can authorize writes?

v76 update: SQ23 is closed by adding settlement-head witness quorum topology. `@pm/agent-state` now has settlement-sequence-scoped head-witness authority transitions, topology replay, and quorum-certificate evaluation over replayed head-witness records; `@pm/capability-kit` can require a certified head quorum before settled-root verification. The next substrate question is SQ24: what durable store and admission boundary persists settlement-head witness authority transitions or quorum certificates so adapters cannot supply synthetic topology?

v77 update: SQ24 is closed by adding a durable settlement-head witness authority-transition store and store-backed quorum certifier. `@pm/agent-state` now has in-memory/Postgres stores for head-witness authority transitions, migration `0029_agent_state_projection_replay_settlement_head_witness_authority.sql`, and a certifier that derives topology from stored transitions plus replayed head-witness records instead of adapter-supplied topology. The next substrate question is SQ25: what non-retroactive authority-epoch or quorum-certificate finality rule prevents later topology transitions from rewriting the eligibility basis of an already certified settlement-store head?

v78 update: SQ25 is closed by adding a settlement-head witness authority epoch seal. `@pm/agent-state` now models `seal_authority_epoch` as a replayed authority transition, binds quorum certificates to the effective authority topology hash, rejects post-seal retroactive transition appends, and obstructs tampered retroactive history during store-backed certification. The next substrate question is SQ26: what signature-bearing witness identity model binds observations, quorum certificates, and authority-epoch seals to principals so durable rows cannot impersonate witnesses or finalizers?

v79 update: SQ26 is closed by adding signature-bound settlement-head witness identity. `@pm/agent-state` now models principal signatures for settlement-head observations and authority-epoch seals, replays payload hashes against admitted head-witness authority topology, checks admitted key metadata, and lets store-backed quorum certification fail closed under a strict identity policy. The next substrate question is SQ27: what durable quorum-certificate record store binds certified settlement-head quorum certificates, witness signatures, and epoch seals into recoverable proof objects?

v80 update: SQ27 is closed by adding durable settlement-head quorum-certificate proof records. `@pm/agent-state` now records certified head quorum certificates with accepted witness observation hashes/signatures and optional epoch-seal linkage, replays the record chain, and rejects tampered evidence or seal mismatches. The next substrate question is SQ28: what key-status and rotation system makes witness signatures decision-time current so revoked or rotated keys cannot authorize new observations, seals, or quorum-certificate records?

v81 update: SQ28 is closed by adding settlement-head witness signature key status. `@pm/agent-state` now models `rotate_signature_key` and `revoke_signature_key` as replayed head-witness authority transitions, projects current key status into principal state, and refuses witness records, authority-epoch seals, and quorum-certificate records whose signatures are no longer current under strict policy. The next substrate question is SQ29: what proof-preserving compaction rule lets witness ledgers and key histories be pruned without losing replay of quorum-certificate records and key-currentness decisions?

v82 update: SQ29 is closed by adding settlement-head witness replay compaction checkpoints. `@pm/agent-state` can now resume witness-ledger, authority/key-history, and quorum-certificate-record replay from a hash-checked checkpoint carrying compacted sequence/hash frontiers plus derived projections; pruned suffixes still fail without the checkpoint, and tampered checkpoints invalidate replay. The next substrate question is SQ30: what checkpoint-admission authority makes replay compaction checkpoints themselves admissible, so arbitrary hash-valid snapshots cannot replace transition-derived state?

v83 update: SQ30 is closed by adding settlement-head witness replay compaction checkpoint admission certificates. `@pm/agent-state` now refuses checkpoint-seeded witness-ledger, authority/key-history, or quorum-certificate-record replay unless a replayed admission certificate proves enough current admitted witnesses signed the exact checkpoint hash under a strict signature policy. The next substrate question is SQ31: what durable checkpoint-admission store and consistency proof make compaction checkpoint certificates recoverable, non-equivocating, and prunable without trusting process memory?

v84 update: SQ31 is closed by adding a durable settlement-head witness replay compaction checkpoint-admission record store. `@pm/agent-state` now records checkpoint bodies and their admitted certificates together in a hash-linked admission history, replays sequence/previous-hash/checkpoint/admission/conflict checks, and exposes in-memory plus Postgres stores. The next substrate question is SQ32: what pruning admission rule makes physical prefix deletion impossible unless a durable admitted checkpoint record and verified suffix continuity already exist?

v85 update: SQ32 is closed by adding a settlement-head witness replay compaction pruning admission. `@pm/agent-state` now requires durable checkpoint-admission record replay plus witness-ledger, authority-history, and quorum-certificate-record suffix replay before pruning can be admitted. The next substrate question is SQ33: what pruning tombstone and store API make actual row deletion replayable and detectable, so out-of-band truncation cannot hide erased conflicting history?

v86 update: SQ33 is closed by adding settlement-head witness replay compaction pruning tombstones and tombstone-gated store pruning APIs. `@pm/agent-state` now records physical pruning as a hash-linked tombstone record, replays tombstones against admitted checkpoint/pruning material, prunes witness-ledger, authority-history, and quorum-certificate-record stores only through tombstone records, and verifies retained suffix continuity after actual pruning. The next substrate question is SQ34: what pruning-head witness or tombstone consistency proof makes stale or forked tombstone histories unable to authorize a pruned store projection?

v87 update: SQ34 is closed by adding pruning tombstone-store head currentness. `@pm/agent-state` now derives a tombstone-store head from replayed tombstone records and lets pruned-store continuity require an exact witnessed tombstone head; stale, forked, unwitnessed-advance, and hash-invalid heads obstruct the projection. The next substrate question is SQ35: what durable tombstone-head witness ledger makes `requiredTombstoneStoreHead` recoverable after amnesia instead of supplied by local memory or adapter input?

v88 update: SQ35 is closed by adding a durable pruning tombstone-head witness ledger. `@pm/agent-state` now records tombstone-head observations in a hash-linked replay ledger, recomputes witness decisions from prior accepted heads, exposes a replayed `latestHead` for pruned-store continuity, and persists observations through migration `0034`. The next substrate question is SQ36: what tombstone-head witness authority topology and quorum rule prevents a single observer from unilaterally defining tombstone currentness?

v89 update: SQ36 is closed by adding pruning tombstone-head witness authority topology and quorum certificates. `@pm/agent-state` now replays tombstone-head witness authority transitions, projects eligible observers and quorum thresholds, and certifies a tombstone head only when enough replay-eligible observers accepted the exact same head. The next substrate question is SQ37: what durable tombstone-head witness authority-transition store makes quorum topology recoverable after restart instead of supplied by adapters?

v90 update: SQ37 is closed by adding durable pruning tombstone-head witness authority-transition stores. `@pm/agent-state` now has in-memory and Postgres-backed tombstone-head authority stores plus a store-backed quorum certifier that derives topology from stored transitions before evaluating tombstone-head witness records. The next substrate question is SQ38: what tombstone-head authority epoch seal prevents later authority transitions from retroactively changing historical tombstone-head certifications?

v91 update: SQ38 is closed by adding pruning tombstone-head authority epoch seals. `@pm/agent-state` now treats `seal_authority_epoch` as a replayed tombstone-head witness authority transition that binds a pruning tombstone sequence to the effective topology hash and quorum certificate hash, rejects later retroactive authority transitions at append time, and obstructs tampered retroactive history during replay/store-backed certification. The next substrate question is SQ39: what signature-bound tombstone-head witness identity makes observations, authority epoch seals, and future certificate records attributable to admitted principals?

v92 update: SQ39 is closed by adding signature-bound pruning tombstone-head witness identity. `@pm/agent-state` now preserves tombstone-head observation signatures, replays observer signatures against tombstone-head authority topology and admitted key metadata, validates authority epoch-seal finalizer signatures under strict policy, and fails store-backed certification closed when witness rows are unsigned or signed by non-admitted keys. The next substrate question is SQ40: what durable tombstone-head quorum-certificate record store binds accepted witness signatures and authority epoch seals into recoverable proof objects?

v93 update: SQ40 is closed by adding durable pruning tombstone-head quorum-certificate records. `@pm/agent-state` now stores tombstone-head certificate proof records that bind the certified head, accepted witness evidence, witness signatures, optional authority epoch seal, previous record hash, and record hash; replay rejects provisional certificates, bad evidence, mismatched seals, and unsigned evidence under strict tombstone-head authority policy. The next substrate question is SQ41: what tombstone-head witness key-status and rotation semantics keep durable certificate-record replay from accepting revoked or superseded keys?

v94 update: SQ41 is closed by adding replayed pruning tombstone-head witness key status. `@pm/agent-state` now admits tombstone-head `rotate_signature_key` and `revoke_signature_key` authority transitions, projects active/revoked key state into tombstone-head principals, and rejects certification or durable QC record replay when accepted witness evidence was signed by revoked or superseded keys. The next substrate question is SQ42: what tombstone-head proof-preserving compaction checkpoint preserves witness ledgers, key-status history, and quorum-certificate records without letting summaries become authority?

v95 update: SQ42 is closed by adding admitted pruning tombstone-head replay compaction checkpoints. `@pm/agent-state` now has tombstone-head checkpoint/admission certificate types, deterministic checkpoint hashes, and checkpoint-seeded replay for tombstone-head witness ledgers, authority/key histories, and quorum-certificate records. Replay rejects suffix-only histories, missing admissions, and tampered checkpoints. The next substrate question is SQ43: what durable tombstone-head checkpoint-admission record store and consistency proof make admitted checkpoints recoverable and non-equivocating across agents and restarts?

v96 update: SQ43 is closed by adding durable pruning tombstone-head checkpoint-admission record stores. `@pm/agent-state` now persists tombstone-head checkpoint bodies and admission certificates together in a hash-linked record history, replays sequence/previous-hash/checkpoint/admission/conflict checks, revalidates the admission under strict witness signatures, and recovers checkpoint authority after amnesia from durable records instead of memory. The next substrate question is SQ44: what tombstone-head pruning admission rule makes physical prefix deletion impossible unless a durable admitted tombstone-head checkpoint record and retained suffix continuity have both replayed?

v97 update: SQ44 is closed by adding pruning tombstone-head replay compaction pruning admission. `@pm/agent-state` now admits tombstone-head pruning only when durable checkpoint-admission record history replays and retained witness, authority, and quorum-certificate suffixes replay from the admitted checkpoint frontier. The next substrate question is SQ45: what tombstone-head tombstone-gated store pruning API makes actual witness, authority, and QC-record row deletion replayable and makes out-of-band truncation detectable?

v98 update: SQ45 is closed by adding pruning tombstone-head replay compaction pruning tombstone records and tombstone-gated store prune APIs. `@pm/agent-state` now records actual tombstone-head witness, authority, and QC-record row deletion as a durable hash-linked tombstone transition, prunes those stores only through replay-valid tombstone records, persists the tombstone ledger through migration `0040`, and detects retained-suffix truncation after physical pruning. The next substrate question is SQ46: what tombstone-head pruning tombstone-store head currentness or witness protocol makes the new pruning tombstone ledger itself non-stale and non-forked after amnesia?

v99 update: SQ46 is closed by adding tombstone-head pruning tombstone-store head currentness. `@pm/agent-state` now derives a deterministic head from replayed tombstone-head pruning tombstones, lets pruned-store continuity require an exact `requiredPruningTombstoneStoreHead`, returns the replay-derived `pruningTombstoneStoreHead`, and obstructs missing, stale, unwitnessed-advance, same-sequence forked, or hash-invalid pruning tombstone histories before row absence can authorize a projection. The next substrate question is SQ47: what durable witness ledger or quorum protocol makes required tombstone-head pruning tombstone-store heads recoverable and non-equivocating after amnesia rather than supplied by local memory, adapters, or connector caches?

v100 update: SQ47 is closed by adding a durable pruning tombstone-store head witness ledger. `@pm/agent-state` now records pruning tombstone-store head observations as hash-linked witness records, replays those records to recover the latest accepted required head after amnesia, rejects tampered witness decisions or record hashes during replay, and records same-sequence forked heads as durable obstructions without replacing the accepted head. The next substrate question is SQ48: what witness authority topology and quorum certificate protocol prevents a single observer from unilaterally defining tombstone-head pruning tombstone-store head currentness?

v101 update: SQ48 is closed by adding pruning tombstone-store head witness quorum topology. `@pm/agent-state` now replays authority transitions for the v100 pruning tombstone-store head witness ledger, evaluates topology-bound quorum certificates over replayed observations, and lets strict tombstone-head pruned-store continuity require a certified quorum certificate before accepting a required pruning tombstone-store head. The next substrate question is SQ49: what durable pruning tombstone-store head witness authority-transition store prevents adapters from supplying synthetic quorum topology for certified required-head recovery?

v102 update: SQ49 is closed by adding durable pruning tombstone-store head witness authority-transition stores. `@pm/agent-state` now has in-memory and Postgres-backed stores for the v101 topology transitions, append-time replay validation, and a store-backed certifier that reconstructs quorum topology from stored authority history plus stored witness records instead of caller-supplied topology. The next substrate question is SQ50: what signature-bound pruning tombstone-store head witness identity prevents unsigned, wrong-key, or equivocated stored witness/topology evidence from counting toward certified required-head recovery?

v103 update: SQ50 is closed by adding signature-bound pruning tombstone-store head witness identity. `@pm/agent-state` now preserves witness signatures for the v100/v102 required-head witness ledger, projects admitted key metadata from replayed authority transitions, persists signatures and key metadata, and makes store-backed certification replay witness signatures against store-derived topology before quorum evaluation. The next substrate question is SQ51: what key-status replay and rotation semantics prevent revoked or superseded pruning tombstone-store head witness keys from authorizing certified required-head recovery?

v104 update: SQ51 is closed by adding pruning tombstone-store head witness key-status replay. `@pm/agent-state` now admits `rotate_signature_key` and `revoke_signature_key` transitions for this layer, validates them against active admitted principals, projects active/revoked key status into replayed topology, and makes store-backed certification reject old-key or revoked-key witness rows while accepting current rotated-key rows. The next substrate question is SQ52: what non-retroactive authority epoch seal prevents later pruning tombstone-store head witness topology or key-status transitions from rewriting historical required-head certification?

v105 update: SQ52 is closed by adding pruning tombstone-store head witness authority epoch seals. `@pm/agent-state` now admits `seal_authority_epoch` transitions that bind a pruning tombstone-store head sequence to the effective authority topology hash and quorum certificate hash, projects accepted seals into topology, keeps seal hash-chain progress distinct from certification topology, rejects retroactive post-seal replay, and refuses retroactive store appends. The next substrate question is SQ53: what durable quorum-certificate proof record makes certified pruning tombstone-store heads recoverable without transient recertification or later topology/key-status replay?

v106 update: SQ53 is closed by adding durable pruning tombstone-store head quorum-certificate proof records. `@pm/agent-state` now records certified pruning tombstone-store head quorum certificates with accepted witness evidence, witness signatures, optional authority epoch seal linkage, previous-record hashes, and record hashes; replay rejects uncertified certificates, broken hashes, malformed evidence, unsigned evidence under strict policy, and seal mismatches. The next substrate question is SQ54: what proof-preserving compaction checkpoint lets pruning tombstone-store head witness ledgers, authority/key/seal history, and quorum-certificate records recover after pruning without trusting summaries?

v107 update: SQ54 is closed by adding admitted pruning tombstone-store head replay compaction checkpoints. `@pm/agent-state` now builds hash-stable checkpoints over compacted witness, authority/key/seal, and QC-record frontiers; checkpoint admission certificates require enough active pruning tombstone-store head witnesses to sign the exact checkpoint hash under strict policy; and witness, authority, and QC-record replay can resume only from an admitted checkpoint plus retained hash-linked suffixes. The next substrate question is SQ55: what durable checkpoint-admission record store and consistency proof make pruning tombstone-store head replay compaction checkpoints recoverable, non-equivocating, and prunable across agents and restarts?

v108 update: SQ55 is closed by adding durable pruning tombstone-store head replay compaction checkpoint-admission records. `@pm/agent-state` now persists checkpoint bodies and witness admission certificates together in a hash-linked admission-record chain, replays sequence/previous-hash/checkpoint/admission/conflict checks, exposes in-memory and Postgres-backed stores, and proves recovered durable admissions can seed compacted required-head replay without trusting process memory. The next substrate question is SQ56: what pruning admission rule requires durable pruning tombstone-store head checkpoint-admission history plus retained witness, authority, and quorum-certificate suffix continuity before physical prefix deletion?

v109 update: SQ56 is closed by adding pruning tombstone-store head replay compaction pruning admission. `@pm/agent-state` now admits pruning only when the v108 durable checkpoint-admission record history replays and retained witness, authority, and quorum-certificate suffixes replay from the admitted checkpoint frontier. The next substrate question is SQ57: what tombstone-gated store pruning API and durable tombstone record make pruning tombstone-store head witness, authority, and quorum-certificate row deletion replayable and out-of-band truncation detectable?

v110 update: SQ57 is closed by adding pruning tombstone-store head replay compaction pruning tombstone records and tombstone-gated store pruning APIs. `@pm/agent-state` now records actual pruning as a replayable hash-linked tombstone ledger, requires that record before witness/authority/quorum-certificate row deletion, and verifies retained suffix continuity after physical pruning. The next substrate question is SQ58: what currentness or witness rule prevents a replay-valid but stale, forked, or unwitnessed v110 pruning tombstone history from authorizing pruned required-head projections?

v111 update: SQ58 is closed by adding pruning tombstone-store head pruning tombstone history currentness. `@pm/agent-state` now derives a stable head from the v110 pruning tombstone ledger, lets pruned-store continuity require that exact head, and obstructs missing, stale, unwitnessed-advance, same-sequence forked, or hash-invalid tombstone histories before pruned row absence can authorize projection recovery. The next substrate question is SQ59: what durable witness ledger or quorum certificate makes the required v111 pruning tombstone-store head recoverable after amnesia rather than supplied by memory, adapters, or a single local process?

v112 update: SQ59 is closed by adding a durable pruning tombstone history-store head witness ledger. `@pm/agent-state` now records v111 head observations as hash-linked witness records, replays and recomputes decisions from prior accepted heads, recovers the latest accepted required head after amnesia, and preserves same-sequence forks as obstructions instead of replacing accepted currentness. The next substrate question is SQ60: what quorum topology or signature-bound authority makes the v112 witness ledger resistant to one-observer or forged-observer currentness?

v113 update: SQ60 is closed by adding pruning tombstone history-store head witness quorum authority. `@pm/agent-state` now replays v112-specific witness authority transitions into eligible principals and thresholds, requires strict signed observations when that topology is supplied, persists v112 witness signatures, and certifies a required history-store head only when enough admitted signed witnesses accepted the exact head. The next substrate question is SQ61: what durable authority-transition store makes the v113 topology recoverable after amnesia instead of supplied as in-memory transition arrays?

v114 update: SQ61 is closed by adding durable pruning tombstone history-store head witness authority-transition stores. `@pm/agent-state` now persists v113 topology transitions in memory/Postgres stores, validates append-time replay, and can certify a required history-store head through a store-backed certifier that derives topology from durable authority history plus stored witness rows. The next substrate question is SQ62: what key-status replay and rotation semantics prevent revoked or superseded v114 witness keys from authorizing certified currentness?

v115 update: SQ62 is closed by adding pruning tombstone history-store head witness key-status replay. `@pm/agent-state` now admits `rotate_signature_key` and `revoke_signature_key` transitions for this layer, projects active/revoked key status into replayed history-store head witness topology, rejects old-key and revoked-key witness rows during store-backed certification, and accepts rows signed by the replayed rotated key. The next substrate question is SQ63: what non-retroactive authority epoch seal prevents later topology or key-status transitions from rewriting historical certified currentness?

v116 update: SQ63 is closed by adding pruning tombstone history-store head witness authority epoch seals. `@pm/agent-state` now admits `seal_authority_epoch` transitions that bind a pruning tombstone history-store head sequence to the effective authority topology hash and quorum certificate hash, projects accepted seals into topology, keeps seal hash-chain progress distinct from certification topology, rejects retroactive post-seal replay, and refuses retroactive store appends. The next substrate question is SQ64: what durable quorum-certificate proof record makes certified pruning tombstone history-store heads recoverable without transient recertification or later topology/key-status replay?

v117 update: SQ64 is closed by adding durable pruning tombstone history-store head quorum-certificate proof records. `@pm/agent-state` now records certified history-store head quorum certificates with accepted witness evidence, witness signatures, optional authority epoch seal linkage, previous-record hashes, and record hashes; replay rejects uncertified certificates, broken hashes, malformed evidence, unsigned evidence under strict policy, and seal mismatches. The next substrate question is SQ65: what proof-preserving compaction checkpoint lets pruning tombstone history-store head witness ledgers, authority/key/seal history, and quorum-certificate records recover after pruning without trusting summaries?

## Versions

| Version | Date | File | Role | Top delta |
| --- | --- | --- | --- | --- |
| Precursor | 2026-06-04 | `research/agent-from-numbers-to-state-arrowsmith_2026-06-04.md` | Immediate predecessor, unnumbered | Located the first-principles fault line: parametric state, prompt state, and retrieval memory are not operational state. |
| v01 | 2026-06-05 | `research/daily-arrowsmith-agent-state/v01-agent-state-arrowsmith-2026-06-05.md` | First numbered daily continuation | Added observation contracts, implicit stale-memory invalidation, read-set validation, stateful workflow evals, and PM shared-cognition implications. |
| v02 | 2026-06-05 | `research/daily-arrowsmith-agent-state/v02-agent-state-arrowsmith-2026-06-05.md` | Repo-grounded correction and implementation bridge | Downgraded synthetic eval pass claims, corrected tautological observation-review path, added subject/read-set binding, and made JSON state-review artifacts the next code slice. |
| v03-local | 2026-06-05 | `research/daily-arrowsmith-agent-state/v03-agent-state-arrowsmith-2026-06-05.md` | Superseded local branch artifact, preserved for provenance | Added CollabSim/ALMANAC, execution-state memory, action-state communication, HarnessFix, WebMCP tool-surface drift, ToolMaze, and TRIAD before syncing with remote `main`. Folded into the ledger rather than treated as canonical latest v03. |
| v03 | 2026-06-06 | `research/daily-arrowsmith-agent-state/v03-agent-state-arrowsmith-2026-06-06.md` | Artifact/provenance and PM-coordination bridge | Marked v02's pure-review TODOs as closed primitives, shifted the frontier to durable replayable artifacts, trace/provenance/object-role metadata, policy gating, and socio-technical coordination metrics. |
| v04 | 2026-06-07 | `research/daily-arrowsmith-agent-state/v04-agent-state-arrowsmith-2026-06-07.md` | Canonical artifact lifecycle, preconditions, and coordination-state bridge | Marked `StateReviewArtifact`, ArrowHedge artifact generation, hash replay, and artifact metrics as closed pure primitives; shifted the frontier to persisted/exported artifacts, observed read-set capture, observation-contract v2, artifact-derived evals, and targeted invariant policy. |
| v05 | 2026-06-08 | `research/daily-arrowsmith-agent-state/v05-agent-state-arrowsmith-2026-06-08.md` | Temporal-state, progressive-constraint, and PM coordination bridge | Added temporal state misalignment phases, AdaPlanBench progressive constraints, typed semantic commit/abort limits, cross-step evidence aggregation, and PM accountability/common-understanding mechanisms; the same-day implementation then closed the first durable ArrowHedge JSON/JSONL artifact lifecycle slice. |
| v06 | 2026-06-09 | `research/daily-arrowsmith-agent-state/v06-agent-state-arrowsmith-2026-06-09.md` | External evidence admission, protocol/tool task state, and team situation-awareness bridge | Audited v05 against same-day code and marked artifact lifecycle, observed read-set comparison, temporal fixtures, DB/fixture equivalence, and invariant policy as closed pure primitives; shifted the frontier to admitting MCP/tool/task, memory, world-model, monitoring, lineage, audit, attestation, and PM handoff evidence before action. |
| v07 | 2026-06-10 | `research/daily-arrowsmith-agent-state/v07-agent-state-arrowsmith-2026-06-10.md` | External evidence admission v1, shared verified context, memory retention, and workflow consistency bridge | Confirmed v06's frontier against current code and added June 8-10 evidence from shared-context MAS, observability-safe memory retention, deployment-time memorization, long-horizon professional workflow benchmarks, MCP explicit state handles, and PM/high-reliability coordination sources; recommended a pure `ExternalStateEvidence` / `EvidenceAdmissionReview` code slice. |
| v08 | 2026-06-11 | `research/daily-arrowsmith-agent-state/v08-agent-state-arrowsmith-2026-06-11.md` | Same-day main audit, committed replay closure, and evidence-action/policy bridge | Audited the June 10 upstream landing against remote `main`, closed the remaining durable-proof gap for evidence admission by committing and drift-testing the JSONL replay corpus, and shifted the research frontier to runtime evidence-action binding, ArrowHedge on-disk replay, trajectory release budgets, policy-transition conformance, state-defect recall, skill-document admission, live MCP revalidation, and real-run PM handoff agreement. |
| v09 | 2026-06-12 | `research/daily-arrowsmith-agent-state/v09-agent-state-arrowsmith-2026-06-12.md` | Fast-forward implementation audit, write-binding/replay correction, and runtime-enforcement bridge | Audited upstream ArrowHedge artifact corpus, write-binding replay, opt-in workflow gate, catalog verifier, and replay dashboard; corrected stale v08 open claims; added new bridges from memory evolution, executable tool wrappers, agentified evals, compiled corrections, memory compaction, environment engineering, runtime-enforcement foundations, and PM risk/communication-under-uncertainty sources; recommended durable verification catalogs and transport coverage metrics. |
| v10 | 2026-06-12 | `research/daily-arrowsmith-agent-state/v10-agent-state-arrowsmith-2026-06-12.md` | Post-catalog audit, certificate/delivery/memory-control bridge, and PM scaffolding correction | Audited the replay-backed verification catalog and write-transport coverage implementation now on `main`; marked the v09 code slice partially closed; added bridges from certificate-bound admission, cross-channel delivery failure, memory-control-flow attacks, evidence-first diagnosis, state-based real-environment benchmarking, AgentOps, MAS marginal-utility evaluation, and human-AI teamwork/scaffolding field experiments; shifted the next frontier to durable certificate/store verification, target-side delivery confirmation, memory influence review, state-based final-environment checks, role-utility metrics, and PM protocol-burden measurement. |
| v11 | 2026-06-12 | `research/daily-arrowsmith-agent-state/v11-agent-state-arrowsmith-2026-06-12.md` | Certificate-bound replay implementation and tenant-alignment correction | Converted v10's certificate-bound admission frontier into workflow/evals code; added certificate-aware catalog verification, deterministic replay certificate ids/digests, recomputed committed-row replay, and tenant-aligned ArrowHedge evidence-admission/write-binding/state-review corpora; kept signed production certificates, DB-backed stores, target-side delivery confirmation, memory-control-flow, and PM burden metrics open. |
| v12 | 2026-06-13 | `research/daily-arrowsmith-agent-state/v12-agent-state-arrowsmith-2026-06-13.md` | Status-bearing evidence, memory influence, target receipts, and PM burden bridge | Audited v11's certificate-bound replay boundary against new memory-poisoning, memory-control-flow, workflow-verification, multimodal-memory, VC/status, MCP, OpenTelemetry, and human-AI teaming sources; kept replay certificates scoped and shifted the next frontier to durable certificate/status stores, target-side receipts, memory-write/read influence admission, policy-transition mini-specs, final-state checks, and protocol-burden metrics. |
| v13 | 2026-06-15 | `research/daily-arrowsmith-agent-state/v13-agent-state-arrowsmith-2026-06-15.md` | Memory write admission and memory-influence taxonomy closure | Converted v12's memory frontier into code: `memory_write` is now a first-class evidence kind, memory writes require source-channel/intended-use metadata, recalled memory is classified by influence kind, control-influencing memory needs override metadata, and replay fixtures/metrics now cover hidden-instruction writes, clean preference writes, and overridden tool-routing memory. |
| v14 | 2026-06-16 | `research/daily-arrowsmith-agent-state/v14-agent-state-arrowsmith-2026-06-16.md` | Target-receipt evidence closure and telemetry-gap correction | Converted the next open v12 frontier into code: `target_receipt` is now a first-class evidence kind, dispatch-only pseudo-receipts warn instead of reading as admitted confirmation, and replay fixtures/metrics distinguish dispatch-only from applied target receipts. |
| v15 | 2026-06-16 | `research/daily-arrowsmith-agent-state/v15-agent-state-arrowsmith-2026-06-16.md` | Status-currentness bridge and durable status-store frontier | Continued from same-day v14 and shifted the next implementation frontier to decision-time status checks for replay certificates, target receipts, MCP task handles, and PM handoff acknowledgements. |
| v16 | 2026-06-19 | `research/daily-arrowsmith-agent-state/v16-agent-state-arrowsmith-2026-06-19.md` | Terminal enforcement correction and live-bridge audit bridge | Added the correction that stale-state detection or block-event emission is not enough; action lifecycles need mutually exclusive terminal outcomes, dashboard metric provenance, and status checks wired into the action gate. |
| v17 | 2026-06-24 | `research/daily-arrowsmith-agent-state/v17-reality-quality-arrowsmith-2026-06-24.md` | Reality-quality cross-paper review and Arrowsmith bridge map | Reviewed the strongest peer-reviewed/scholarly systems papers across quotienting, sheaf gluing, transition semantics, consensus, transactions, content identity, feedback control, boundary objects, transactive memory, and provenance; converted them into new substrate concepts: equivalence classes, obstruction artifacts, terminal action normal forms, admission kernels, evidence leases, conflict algebra, receding-horizon execution, and projection-drift checks. |
| v18 | 2026-06-25 | `research/daily-arrowsmith-agent-state/v18-action-outcome-loop-2026-06-25.md` | Closed-loop question ledger and pure `ActionOutcomeEnvelope` slice | Asked ten agent-state questions, answered them with peer-reviewed papers, added replacement questions RQ11-RQ20, and implemented the first pure terminal normal-form primitive with falsification tests. |
| v19 | 2026-06-25 | `research/daily-arrowsmith-agent-state/v19-action-outcome-eval-wiring-2026-06-25.md` | Outcome-envelope eval wiring and Axis B blocker record | Answered RQ11 with enforcement-boundary papers, added RQ21, added first-class `action_outcome_envelope` eval refs, wired Axis A/C outcome evidence, and added a machine-checkable Axis B blocked eval. |
| v20 | 2026-06-25 | `research/daily-arrowsmith-agent-state/v20-write-transport-outcome-envelope-coverage-2026-06-25.md` | Write-transport outcome-envelope coverage audit | Answered RQ21, added RQ22, extended write-transport coverage metrics with outcome-envelope provider coverage, and made the current 0/4 runtime coverage gap explicit. |
| v21 | 2026-06-25 | `research/daily-arrowsmith-agent-state/v21-workflow-outcome-envelope-boundary-2026-06-25.md` | Workflow runtime outcome-envelope boundary | Answered RQ22, added RQ23, generated accepted/blocked workflow outcome envelopes at the evidence-binding gate, and moved fixture outcome-envelope coverage to 4/4. |
| v22 | 2026-06-25 | `research/daily-arrowsmith-agent-state/v22-workflow-envelope-promotion-2026-06-25.md` | Workflow envelope promotion into proof packets | Answered RQ23, added RQ24, promoted workflow runtime envelopes into canonical `ActionOutcomeEnvelope` proof packets, and added those packets to ArrowHedge write-binding replay records. |
| v23 | 2026-06-25 | `research/daily-arrowsmith-agent-state/v23-outcome-envelope-replay-index-2026-06-25.md` | Outcome-envelope replay index | Answered RQ24, added RQ25, indexed promoted envelope proof packets, and proved Axis A EvalEvents can recover blocked terminal outcomes from replay refs. |
| v24 | 2026-06-25 | `research/daily-arrowsmith-agent-state/v24-live-outcome-envelope-store-2026-06-25.md` | Live outcome-envelope packet store | Answered RQ25, added RQ26, added Postgres packet persistence for hash-verified action outcome envelopes, and kept Axis C runtime packet generation open. |
| v25 | 2026-06-25 | `research/daily-arrowsmith-agent-state/v25-axis-c-outcome-packet-generation-2026-06-25.md` | Axis C outcome packet generation | Answered RQ26, added RQ27, generated packet-backed Axis C scaffold events, and exposed dynamic local-agent-lab outcome packets. |
| v26 | 2026-06-25 | `research/daily-arrowsmith-agent-state/v26-dynamic-axis-c-evalevents-2026-06-25.md` | Dynamic Axis C EvalEvents | Answered RQ27, added RQ28, converted dynamic local-agent-lab runs into packet-backed `live_run` EvalEvents, and verified one live stale-observation run against local Postgres/Ollama. |
| v27 | 2026-06-25 | `research/daily-arrowsmith-agent-state/v27-axis-c-ten-class-live-coverage-2026-06-25.md` | Axis C ten-class live coverage | Answered RQ28, added RQ29, registered all ten dynamic Axis C scenarios, and made live coverage complete only for protective packet-backed pairs. |
| v28 | 2026-06-25 | `research/daily-arrowsmith-agent-state/v28-three-axis-coverage-gate-2026-06-25.md` | Three-axis coverage gate | Answered RQ29, added RQ30, and added a 30-cell coverage/verification analyzer that cannot hide Axis B blockers behind Axis C completeness. |
| v29 | 2026-06-25 | `research/daily-arrowsmith-agent-state/v29-eval-verdict-terminal-outcome-split-2026-06-25.md` | Eval verdict / terminal outcome split | Answered RQ30, added RQ31, and split scenario oracle verdicts from operational terminal outcomes so protective refusals can verify scenario passes without hiding blocked axes. |
| v30 | 2026-06-25 | `research/daily-arrowsmith-agent-state/v30-three-axis-proof-packet-2026-06-25.md` | Three-axis proof packet | Answered RQ31, added RQ32, and added a proof packet that preserves verified, missing, blocked, and terminal-proof-backed cells across the three-axis matrix. |
| v31 | 2026-06-25 | `research/daily-arrowsmith-agent-state/v31-terminal-index-codebase-correction-2026-06-25.md` | Terminal index codebase correction | Answered RQ32, added RQ33, and moved terminal-ref/hash validity back into `@pm/agent-state` via a hash-gated terminal outcome index instead of expanding verifier-only machinery. |
| v32 | 2026-06-25 | `research/daily-arrowsmith-agent-state/v32-arrowhedge-terminal-index-adoption-2026-06-25.md` | ArrowHedge terminal index adoption | Answered RQ33, added RQ34, and made ArrowHedge proposal-review artifacts emit canonical terminal envelopes admitted through the core terminal index. |
| v33 | 2026-06-25 | `research/daily-arrowsmith-agent-state/v33-workflow-terminal-admission-port-2026-06-25.md` | Workflow terminal admission port | Answered RQ34, added RQ35, and added a dependency-light workflow admission port that can reject terminal conflicts before dispatch without making `@pm/workflow` depend on `@pm/agent-state`. |
| v34 | 2026-06-25 | `research/daily-arrowsmith-agent-state/v34-agency-publication-terminal-adapter-2026-06-25.md` | Agency publication terminal adapter | Answered RQ35, added RQ36, and added a profile-owned publication terminal adapter that blocks revoked approvals and indexes same-action publish conflicts through `@pm/agent-state`. |
| v35 | 2026-06-25 | `research/daily-arrowsmith-agent-state/v35-terminal-admission-provider-metadata-2026-06-25.md` | Terminal admission provider metadata | Answered RQ36, added RQ37, and made terminal-admission providers discoverable through typed write-contract metadata and registry helpers. |
| v36 | 2026-06-25 | `research/daily-arrowsmith-agent-state/v36-terminal-provider-manifest-verification-2026-06-25.md` | Terminal provider manifest verification | Answered RQ37, added RQ38, and added live manifest verification so stale provider metadata cannot prove coverage by itself. |
| v37 | 2026-06-25 | `research/daily-arrowsmith-agent-state/v37-terminal-provider-certificates-2026-06-25.md` | Terminal provider certificates | Answered RQ38, added RQ39, and added status-bearing provider certificates plus an opt-in workflow runtime certificate gate before write-capable dispatch. |
| v38 | 2026-06-25 | `research/daily-arrowsmith-agent-state/v38-provider-certificate-status-store-2026-06-25.md` | Provider certificate status store | Answered RQ39, added RQ40, and added a substrate-owned Postgres certificate status store wired into workflow runtime lookup. |
| v39 | 2026-06-25 | `research/daily-arrowsmith-agent-state/v39-provider-certificate-status-event-replay-2026-06-25.md` | Provider certificate status event replay | Answered RQ40, added RQ41, and added append-only hash-linked status events plus historical certificate-status replay. |
| v40 | 2026-06-25 | `research/daily-arrowsmith-agent-state/v40-workflow-status-ref-binding-2026-06-25.md` | Workflow status ref binding | Answered RQ41, added RQ42, and bound exact provider-certificate status event refs into workflow action outcome envelopes. |
| v41 | 2026-06-25 | `research/daily-arrowsmith-agent-state/v41-graph-write-authority-ref-2026-06-25.md` | Graph write authority ref | Answered RQ42, added RQ43, and added an opt-in graph write-authority policy requiring accepted workflow authority plus provider-certificate status refs before graph SQL. |
| v42 | 2026-06-25 | `research/daily-arrowsmith-agent-state/v42-capability-kit-write-authority-2026-06-25.md` | Capability kit write authority | Answered RQ43, added RQ44, and propagated graph write-authority policy into capability-kit raw graph updates before `apply` or SQL. |
| v43 | 2026-06-25 | `research/daily-arrowsmith-agent-state/v43-store-backed-write-authority-2026-06-25.md` | Store backed write authority | Answered RQ44, added RQ45, and added substrate-record matching so strict graph/capability authority cannot rely on forged valid-looking refs. |
| v44 | 2026-06-25 | `research/daily-arrowsmith-agent-state/v44-workflow-authority-injection-2026-06-25.md` | Workflow authority injection | Answered RQ45, added RQ46, added a structural workflow-envelope authority connector, and injected graph write authority into the real lead-scoring capability adapter. |
| v45 | 2026-06-25 | `research/daily-arrowsmith-agent-state/v45-store-backed-authority-resolver-2026-06-25.md` | Store backed authority resolver | Answered RQ46, added RQ47, and added a resolver factory that loads workflow envelopes from a store before returning graph authority. |
| v46 | 2026-06-25 | `research/daily-arrowsmith-agent-state/v46-authority-metadata-packet-recovery-2026-06-25.md` | Authority metadata packet recovery | Answered RQ47, added RQ48, and preserved provider-status authority metadata through canonical packets and eval-store recovery. |
| v47 | 2026-06-25 | `research/daily-arrowsmith-agent-state/v47-strict-authority-recovery-audit-2026-06-25.md` | Strict authority recovery audit | Answered RQ48, added RQ49, added a strict authority recovery audit primitive, and gave ArrowHedge accepted replay packets provider-status metadata. |
| v48 | 2026-06-25 | `research/daily-arrowsmith-agent-state/v48-proof-packet-authority-gate-2026-06-25.md` | Proof packet authority gate | Answered RQ49, added RQ50, and made proof packets optionally require strict authority recoveries before verified status. |
| v49 | 2026-06-25 | `research/daily-arrowsmith-agent-state/v49-runner-authority-recovery-generation-2026-06-25.md` | Runner authority recovery generation | Answered RQ50, added RQ51, and wired local-lab runners to generate store-derived strict authority recovery summaries. |
| v50 | 2026-06-25 | `research/daily-arrowsmith-agent-state/v50-local-lab-provider-authority-metadata-2026-06-25.md` | Local-lab provider authority metadata | Answered RQ51, added RQ52, and made accepted Axis C packets carry provider-status authority metadata that strict recovery can validate. |
| v51 | 2026-06-25 | `research/daily-arrowsmith-agent-state/v51-strict-runner-proof-packet-consumption-2026-06-25.md` | Strict runner proof-packet consumption | Answered RQ52, added RQ53, and made runner proof summaries consume authority recovery suites or expose missing recovery obligations. |
| v52 | 2026-06-25 | `research/daily-arrowsmith-agent-state/v52-all-axis-proof-packet-assembler-2026-06-25.md` | All-axis proof-packet assembler | Answered RQ53, added RQ54, and added per-source recovery provenance for strict all-axis proof-packet assembly. |
| v53 | 2026-06-25 | `research/daily-arrowsmith-agent-state/v53-arrowhedge-finance-source-bundle-2026-06-25.md` | ArrowHedge finance source bundle | Answered RQ54, added RQ55, and made the current ArrowHedge write-binding replay corpus available as a strict finance proof source bundle. |
| v54 | 2026-06-25 | `research/daily-arrowsmith-agent-state/v54-arrowhedge-terminal-packet-corpus-2026-06-25.md` | ArrowHedge terminal packet corpus | Answered RQ55, added RQ56, and made the finance adapter produce hash/index-validated terminal packets from canonical state-review inputs without adding finance logic to substrate packages. |
| v55 | 2026-06-25 | `research/daily-arrowsmith-agent-state/v55-arrowhedge-packet-eval-mapping-2026-06-25.md` | ArrowHedge packet eval mapping | Answered RQ56, added RQ57, and mapped real finance-domain temporal packets into Axis A EvalEvents while keeping cells unverified until paired terminal proof/recovery exists. |
| v56 | 2026-06-25 | `research/daily-arrowsmith-agent-state/v56-axis-a-baseline-recovery-obligations-2026-06-25.md` | Axis A baseline recovery obligations | Answered RQ57 for strict proof semantics, added RQ58, and made baseline failed terminal observations replay evidence rather than accepted authority-recovery obligations. |
| v57 | 2026-06-25 | `research/daily-arrowsmith-agent-state/v57-arrowhedge-paired-temporal-packet-corpus-2026-06-25.md` | ArrowHedge paired temporal packet corpus | Answered RQ58 for canonical paired packet generation, added RQ59, and generated baseline/substrate temporal packet pairs with substrate-only strict recovery. |
| v58 | 2026-06-25 | `research/daily-arrowsmith-agent-state/v58-arrowhedge-packet-store-source-bundle-2026-06-25.md` | ArrowHedge packet-store source bundle | Answered RQ59, added RQ60, and moved paired temporal packet recovery through `PostgresEvalEventStore` plus a reusable strict Axis A source-bundle helper. |
| v59 | 2026-06-26 | `research/daily-arrowsmith-agent-state/v59-axis-a-continuity-packet-families-2026-06-26.md` | Axis A continuity packet families | Answered RQ60, added RQ61-RQ70, extracted reusable continuity-chain verification, and added paired packet-backed `memory_drift` / `continuity_break` Axis A families. |
| v60 | 2026-06-26 | `research/daily-arrowsmith-agent-state/v60-axis-a-source-authority-packet-family-2026-06-26.md` | Axis A source-authority packet family | Answered RQ61, added RQ71, tightened ArrowHedge source-authority conflict classification, and added a paired packet-backed `source_authority_conflict` Axis A family. |
| v61 | 2026-06-26 | `research/daily-arrowsmith-agent-state/v61-representation-loss-packet-gate-2026-06-26.md` | Representation-loss packet gate research | Corrected the stale implementation frontier, answered RQ71 as a sequencing decision, and selected `representation_loss` as the next Axis A packet family using projection-fidelity checks. |
| v62 | 2026-06-26 | `research/daily-arrowsmith-agent-state/v62-state-identity-kernel-2026-06-26.md` | State identity kernel research and implementation | Added existing/missing substrate maps, an exact 10-question discovery backlog, and implemented `ProjectionReplayCertificate` plus opt-in replay-proof action review. |
| v63 | 2026-06-26 | `research/daily-arrowsmith-agent-state/v63-projection-replay-frontier-2026-06-26.md` | Projection replay frontier research and implementation | Closed SQ01 by adding sequence-backed projection replay frontiers, `last_event_seq`, and frontier-to-certificate generation. |
| v64 | 2026-06-26 | `research/daily-arrowsmith-agent-state/v64-projection-replay-write-gate-2026-06-26.md` | Projection replay write gate research and implementation | Closed SQ11 by adding replay-proof graph write authority policy, obstruction codes, and capability-kit enforcement before `apply()` / SQL. |
| v65 | 2026-06-26 | `research/daily-arrowsmith-agent-state/v65-projection-replay-certificate-store-2026-06-26.md` | Projection replay certificate store research and implementation | Closed SQ12 by adding durable replay-certificate record/store semantics, Postgres migration, replay-ref packet recovery, and capability-kit certificate-store verification before `apply()`. |
| v66 | 2026-06-26 | `research/daily-arrowsmith-agent-state/v66-certificate-store-root-2026-06-26.md` | Certificate store root research and implementation | Closed SQ13 by adding append-only certificate-store roots, hash-chain consistency proof verification, and strict store-root replay-ref verification. |
| v67 | 2026-06-26 | `research/daily-arrowsmith-agent-state/v67-certificate-store-root-witness-2026-06-26.md` | Certificate store root witness research and implementation | Closed SQ14 by adding root witness admission, root obstruction artifacts, consistency-proof-required advances, fork obstruction, and capability-kit witness gating before graph write authority. |
| v68 | 2026-06-26 | `research/daily-arrowsmith-agent-state/v68-root-witness-ledger-2026-06-26.md` | Root witness ledger research and implementation | Closed SQ15 by adding hash-linked witness observation records, ledger replay with decision recomputation, in-memory/Postgres witness ledgers, and ledger-backed witness recovery after restart. |
| v69 | 2026-06-26 | `research/daily-arrowsmith-agent-state/v69-root-witness-settlement-2026-06-26.md` | Root witness settlement research and implementation | Closed SQ16 by adding replayed witness-ledger settlement classification, quorum-not-met, invalid-ledger, duplicate-witness, and conflicting-root settlement issues. |
| v70 | 2026-06-26 | `research/daily-arrowsmith-agent-state/v70-witness-authority-topology-2026-06-26.md` | Witness authority topology research and implementation | Closed SQ17 by adding hash-linked witness-authority transitions, topology replay, eligible witness-principal projection, and topology-bound settlement counting. |
| v71 | 2026-06-26 | `research/daily-arrowsmith-agent-state/v71-durable-witness-authority-settlement-store-2026-06-26.md` | Durable witness authority and settlement store research and implementation | Closed SQ18 by adding durable authority-transition stores, durable settlement-record stores, settlement-record replay, migration `0027`, and tamper-rejection tests. |
| v72 | 2026-06-26 | `research/daily-arrowsmith-agent-state/v72-settled-root-write-gate-2026-06-26.md` | Settled-root write-gate research and implementation | Closed SQ19 by adding graph settled-root policy, capability-kit settlement-store verification, action-envelope/eval preservation, and falsification tests. |
| v73 | 2026-06-26 | `research/daily-arrowsmith-agent-state/v73-settlement-currentness-2026-06-26.md` | Settlement-currentness research and implementation | Closed SQ20 by adding settlement currentness policy, stale/conflict/frontier/topology issue codes, settlement-store verification, capability-kit propagation, and falsification tests. |
| v74 | 2026-06-26 | `research/daily-arrowsmith-agent-state/v74-settlement-store-head-witness-2026-06-26.md` | Settlement-store head witness research and implementation | Closed SQ21 by adding settlement-store heads, required-head currentness checks, replayable head-witness decisions, and capability-kit head-witness gating. |
| v75 | 2026-06-26 | `research/daily-arrowsmith-agent-state/v75-durable-settlement-head-witness-store-2026-06-26.md` | Durable settlement-head witness store research and implementation | Closed SQ22 by adding a Postgres-backed settlement-head witness ledger, migration `0028`, and cross-agent shared-ledger regression proof. |
| v76 | 2026-06-26 | `research/daily-arrowsmith-agent-state/v76-settlement-head-witness-quorum-topology-2026-06-26.md` | Settlement-head witness quorum topology research and implementation | Closed SQ23 by adding settlement-head witness authority topology, quorum certificate evaluation, and capability-kit quorum gating before settled-root verification. |
| v77 | 2026-06-26 | `research/daily-arrowsmith-agent-state/v77-durable-settlement-head-witness-authority-store-2026-06-26.md` | Durable settlement-head witness authority store research and implementation | Closed SQ24 by adding durable head-witness authority-transition stores, migration `0029`, and store-backed quorum certification. |
| v78 | 2026-06-26 | `research/daily-arrowsmith-agent-state/v78-settlement-head-authority-epoch-seal-2026-06-26.md` | Settlement-head authority epoch seal research and implementation | Closed SQ25 by adding replayed authority-epoch seals, effective topology hashes, post-seal retroactive-transition refusal, and tamper-obstruction tests. |
| v79 | 2026-06-26 | `research/daily-arrowsmith-agent-state/v79-signature-bound-head-witness-identity-2026-06-26.md` | Signature-bound settlement-head witness identity research and implementation | Closed SQ26 by adding strict principal signatures for settlement-head observations and authority-epoch seals, admitted key replay, migration `0030`, and signature-obstruction tests. |
| v80 | 2026-06-26 | `research/daily-arrowsmith-agent-state/v80-durable-head-quorum-certificate-record-2026-06-26.md` | Durable settlement-head quorum-certificate record research and implementation | Closed SQ27 by adding durable signed quorum-certificate proof records, migration `0031`, and tampered evidence/seal replay tests. |
| v81 | 2026-06-26 | `research/daily-arrowsmith-agent-state/v81-settlement-head-witness-key-status-2026-06-26.md` | Settlement-head witness signature key-status research and implementation | Closed SQ28 by adding replayed key rotation/revocation, current-key replay checks, and revoked-key certification/record replay tests. |
| v82 | 2026-06-26 | `research/daily-arrowsmith-agent-state/v82-proof-preserving-replay-compaction-2026-06-26.md` | Proof-preserving replay compaction research and implementation | Closed SQ29 by adding replay compaction checkpoints for witness ledgers, authority/key histories, and quorum-certificate records. |
| v83 | 2026-06-26 | `research/daily-arrowsmith-agent-state/v83-compaction-checkpoint-admission-authority-2026-06-26.md` | Compaction checkpoint admission authority research and implementation | Closed SQ30 by adding witness-signed admission certificates required before compaction checkpoints can seed replay. |
| v84 | 2026-06-26 | `research/daily-arrowsmith-agent-state/v84-durable-checkpoint-admission-store-2026-06-26.md` | Durable checkpoint admission store research and implementation | Closed SQ31 by adding hash-linked checkpoint-admission record replay and in-memory/Postgres stores. |
| v85 | 2026-06-26 | `research/daily-arrowsmith-agent-state/v85-compaction-pruning-admission-2026-06-26.md` | Compaction pruning admission research and implementation | Closed SQ32 by adding durable-checkpoint plus suffix-continuity admission before pruning. |
| v86 | 2026-06-26 | `research/daily-arrowsmith-agent-state/v86-pruning-tombstone-store-api-2026-06-26.md` | Pruning tombstone store API research and implementation | Closed SQ33 by adding hash-linked pruning tombstones, tombstone-gated prune APIs, migration `0033`, and pruned-store continuity verification. |
| v87 | 2026-06-26 | `research/daily-arrowsmith-agent-state/v87-pruning-tombstone-head-currentness-2026-06-26.md` | Pruning tombstone head currentness research and implementation | Closed SQ34 by requiring pruned-store continuity to match an exact tombstone-store head. |
| v88 | 2026-06-26 | `research/daily-arrowsmith-agent-state/v88-durable-tombstone-head-witness-ledger-2026-06-26.md` | Durable tombstone-head witness ledger research and implementation | Closed SQ35 by making required tombstone heads recoverable from replayed witness history. |
| v89 | 2026-06-26 | `research/daily-arrowsmith-agent-state/v89-tombstone-head-witness-quorum-topology-2026-06-26.md` | Tombstone-head witness quorum topology research and implementation | Closed SQ36 by requiring replayed tombstone-head witness authority topology before head certification. |
| v90 | 2026-06-26 | `research/daily-arrowsmith-agent-state/v90-durable-tombstone-head-witness-authority-store-2026-06-26.md` | Durable tombstone-head witness authority store research and implementation | Closed SQ37 by making tombstone-head witness quorum topology recoverable from stored authority transitions. |
| v91 | 2026-06-26 | `research/daily-arrowsmith-agent-state/v91-tombstone-head-authority-epoch-seal-2026-06-26.md` | Tombstone-head authority epoch seal research and implementation | Closed SQ38 by sealing historical tombstone-head authority epochs against retroactive topology changes. |
| v92 | 2026-06-26 | `research/daily-arrowsmith-agent-state/v92-signature-bound-tombstone-head-witness-identity-2026-06-26.md` | Signature-bound tombstone-head witness identity research and implementation | Closed SQ39 by requiring strict principal/key signatures for tombstone-head observations and authority epoch seals. |
| v93 | 2026-06-26 | `research/daily-arrowsmith-agent-state/v93-durable-tombstone-head-quorum-certificate-record-2026-06-26.md` | Durable tombstone-head quorum-certificate record research and implementation | Closed SQ40 by making certified tombstone-head quorum proof recoverable from durable record history. |
| v94 | 2026-06-26 | `research/daily-arrowsmith-agent-state/v94-tombstone-head-witness-key-status-2026-06-26.md` | Tombstone-head witness key-status research and implementation | Closed SQ41 by replaying tombstone-head key rotation/revocation before certification and QC record replay. |
| v95 | 2026-06-26 | `research/daily-arrowsmith-agent-state/v95-tombstone-head-proof-preserving-compaction-2026-06-26.md` | Tombstone-head proof-preserving compaction research and implementation | Closed SQ42 by adding admitted checkpoint-seeded replay for tombstone-head witness ledgers, authority/key histories, and QC records. |
| v96 | 2026-06-26 | `research/daily-arrowsmith-agent-state/v96-durable-tombstone-head-checkpoint-admission-store-2026-06-26.md` | Durable tombstone-head checkpoint-admission store research and implementation | Closed SQ43 by making admitted tombstone-head checkpoint authority recoverable from hash-linked durable record history. |
| v97 | 2026-06-26 | `research/daily-arrowsmith-agent-state/v97-tombstone-head-compaction-pruning-admission-2026-06-26.md` | Tombstone-head compaction pruning admission research and implementation | Closed SQ44 by requiring durable checkpoint-admission history plus retained suffix replay before tombstone-head pruning can be admitted. |
| v98 | 2026-06-26 | `research/daily-arrowsmith-agent-state/v98-tombstone-head-pruning-tombstone-store-api-2026-06-26.md` | Tombstone-head pruning tombstone store API research and implementation | Closed SQ45 by making actual tombstone-head witness, authority, and QC-row deletion replayable through durable pruning tombstones. |
| v117 | 2026-06-26 | `research/daily-arrowsmith-agent-state/v117-pruning-tombstone-history-store-head-quorum-certificate-record-2026-06-26.md` | Pruning tombstone history-store head quorum-certificate record research and implementation | Closed SQ64 by making certified history-store heads recoverable from durable QC proof records. |
| v116 | 2026-06-26 | `research/daily-arrowsmith-agent-state/v116-pruning-tombstone-history-store-head-witness-authority-epoch-seal-2026-06-26.md` | Pruning tombstone history-store head witness authority epoch seal research and implementation | Closed SQ63 by sealing v115 topology/key-status history against retroactive authority rewrites. |
| v115 | 2026-06-26 | `research/daily-arrowsmith-agent-state/v115-pruning-tombstone-history-store-head-witness-key-status-2026-06-26.md` | Pruning tombstone history-store head witness key-status research and implementation | Closed SQ62 by replaying history-store head witness key rotation/revocation before store-backed certification. |
| v114 | 2026-06-26 | `research/daily-arrowsmith-agent-state/v114-pruning-tombstone-history-store-head-witness-authority-store-2026-06-26.md` | Durable pruning tombstone history-store head witness authority store research and implementation | Closed SQ61 by making v113 topology recoverable from durable authority-transition stores and store-backed certification. |
| v113 | 2026-06-26 | `research/daily-arrowsmith-agent-state/v113-pruning-tombstone-history-store-head-witness-quorum-authority-2026-06-26.md` | Pruning tombstone history-store head witness quorum authority research and implementation | Closed SQ60 by requiring replayed topology, admitted signatures, and two-witness quorum certification for v112 required-head currentness. |
| v112 | 2026-06-26 | `research/daily-arrowsmith-agent-state/v112-pruning-tombstone-history-store-head-witness-ledger-2026-06-26.md` | Pruning tombstone history-store head witness ledger research and implementation | Closed SQ59 by making required v111 heads recoverable from replayed witness history after amnesia. |
| v111 | 2026-06-26 | `research/daily-arrowsmith-agent-state/v111-pruning-tombstone-store-head-pruning-tombstone-history-currentness-2026-06-26.md` | Pruning tombstone-store head pruning tombstone history currentness research and implementation | Closed SQ58 by making v110 pruning tombstone histories currentness-gated through replay-derived required heads. |
| v110 | 2026-06-26 | `research/daily-arrowsmith-agent-state/v110-pruning-tombstone-store-head-pruning-tombstone-store-api-2026-06-26.md` | Pruning tombstone-store head pruning tombstone store API research and implementation | Closed SQ57 by making actual pruning tombstone-store head witness, authority, and QC-row deletion replayable through durable pruning tombstones. |
| v109 | 2026-06-26 | `research/daily-arrowsmith-agent-state/v109-pruning-tombstone-store-head-compaction-pruning-admission-2026-06-26.md` | Pruning tombstone-store head compaction pruning admission research and implementation | Closed SQ56 by requiring durable checkpoint-admission history plus retained suffix replay before pruning tombstone-store head compaction can authorize physical prefix deletion. |
| v108 | 2026-06-26 | `research/daily-arrowsmith-agent-state/v108-pruning-tombstone-store-head-durable-checkpoint-admission-store-2026-06-26.md` | Durable pruning tombstone-store head checkpoint-admission store research and implementation | Closed SQ55 by making admitted pruning tombstone-store head compaction checkpoint authority recoverable from hash-linked durable record history. |
| v107 | 2026-06-26 | `research/daily-arrowsmith-agent-state/v107-pruning-tombstone-store-head-proof-preserving-compaction-2026-06-26.md` | Pruning tombstone-store head proof-preserving compaction research and implementation | Closed SQ54 by requiring admitted checkpoint-seeded replay for pruning tombstone-store head witness ledgers, authority/key/seal history, and QC records. |
| v106 | 2026-06-26 | `research/daily-arrowsmith-agent-state/v106-pruning-tombstone-store-head-quorum-certificate-record-2026-06-26.md` | Pruning tombstone-store head quorum-certificate record research and implementation | Closed SQ53 by making certified pruning tombstone-store heads recoverable from durable QC proof records. |
| v105 | 2026-06-26 | `research/daily-arrowsmith-agent-state/v105-pruning-tombstone-store-head-witness-authority-epoch-seal-2026-06-26.md` | Pruning tombstone-store head witness authority epoch seal research and implementation | Closed SQ52 by sealing pruning tombstone-store head witness authority epochs against retroactive topology/key-status rewrites. |
| v104 | 2026-06-26 | `research/daily-arrowsmith-agent-state/v104-pruning-tombstone-store-head-witness-key-status-2026-06-26.md` | Pruning tombstone-store head witness key-status research and implementation | Closed SQ51 by replaying pruning tombstone-store head witness key rotation/revocation before certification. |
| v103 | 2026-06-26 | `research/daily-arrowsmith-agent-state/v103-signature-bound-pruning-tombstone-store-head-witness-identity-2026-06-26.md` | Signature-bound pruning tombstone-store head witness identity research and implementation | Closed SQ50 by requiring strict principal/key signatures before pruning tombstone-store head witness rows can count toward certified required-head recovery. |
| v102 | 2026-06-26 | `research/daily-arrowsmith-agent-state/v102-durable-pruning-tombstone-store-head-witness-authority-store-2026-06-26.md` | Durable pruning tombstone-store head witness authority store research and implementation | Closed SQ49 by making pruning tombstone-store head witness quorum topology recoverable from stored authority transitions. |
| v101 | 2026-06-26 | `research/daily-arrowsmith-agent-state/v101-pruning-tombstone-store-head-witness-quorum-topology-2026-06-26.md` | Pruning tombstone-store head witness quorum topology research and implementation | Closed SQ48 by requiring topology-bound quorum certification for strict required-head continuity. |
| v100 | 2026-06-26 | `research/daily-arrowsmith-agent-state/v100-durable-pruning-tombstone-store-head-witness-ledger-2026-06-26.md` | Durable pruning tombstone-store head witness ledger research and implementation | Closed SQ47 by recovering required pruning tombstone-store heads from replayed witness records after amnesia. |
| v99 | 2026-06-26 | `research/daily-arrowsmith-agent-state/v99-tombstone-head-pruning-tombstone-store-head-currentness-2026-06-26.md` | Tombstone-head pruning tombstone-store head currentness research and implementation | Closed SQ46 by requiring tombstone-head pruned-store continuity to match an exact pruning tombstone-store head. |

## Top Findings

1. **Operational state is distinct from model, prompt, and memory state.** Weights are parametric state, prompts are inference state, memories are retrieval/continuity state, and pm-substrate should supply current admissible operational state.
2. **Observation contracts are now a major bridge.** Tool artifacts may carry expiry, integrity, permission, and allowed-use constraints that must be validated before action.
3. **Memory invalidation is harder than retrieval.** Newer evidence must invalidate stale premises and downstream behavior, not merely appear in search results.
4. **Raw episodes/events should survive summaries.** Summaries are derived views; raw tool observations and event records remain first-class evidence.
5. **Read-set validation turns the thesis into an execution contract.** High-consequence actions should follow read -> propose -> validate -> write.
6. **Project management maps to shared operational cognition.** The PM layer should expose what is known, who/source owns it, what changed, what is blocked, and which next actions are valid.
7. **Action review now has the original-observation primitive.** The next gap is artifact durability and replay, not merely passing an old observation into the pure helper.
8. **Eval maturity labels now matter.** The repo has scaffolded scenarios, detected warnings, and assertion metrics, but not yet mutation blocking or paired behavioral improvement for every claim.
9. **Subject identity is part of action validity.** The pure validator now detects `subject_mismatch`; multi-object roles remain the next object-centric gap.
10. **Provenance, trace, and event standards sharpen artifact shape.** PROV, Trace Context, CloudEvents, and OCEL are not authority systems, but they describe the metadata needed for replayable operational-state evidence.
11. **Project state should measure coordination fit.** Socio-technical congruence and transactive memory point toward owner/source/dependency/handoff metrics, not just task-status completeness.
12. **State-review artifacts now exist as durable code with first coverage primitives.** The implemented lifecycle now covers JSON/JSONL export/import, hash replay, eval linkage, continuity payload linkage, artifact-derived metrics, DB/fixture equivalence helpers, observed read-set comparison, temporal phase fixtures, and invariant policy recommendations.
13. **Observed read sets now have a pure comparison lane.** S-Bus still strengthens the case for reconstructing what agents actually read; the open gap is runtime capture from real tool invocations, not the comparison primitive.
14. **Observation contracts need integrity and binding fields.** RFC 9110, DPoP, HTTP Message Signatures, OAuth Token Exchange, and ContractBench sharpen freshness-only contracts into precondition, signature/integrity, holder/request-binding, and delegation questions.
15. **Coordination is not just communication volume.** Silo-Bench and team-situation-awareness work point toward convergence on correct distributed state as the PM metric.
16. **Research itself is now a substrate test.** Multiple developers and automations are producing research and code; every daily run must pull `main`, inspect new research/code, integrate findings into the ledger, and push back to `main`.
17. **Temporal drift has more than one phase.** ArrowHedge now has deterministic fixture coverage for observation-to-action, action-to-feedback, and feedback-to-observation; the open gap is broader surface coverage.
18. **Progressively disclosed constraints are a better eval shape than one-shot full specs.** AdaPlanBench-style staged constraints map to authority, freshness, workflow, and user/policy constraints revealed across attempts.
19. **Semantic consensus is evidence, not authority.** Typed semantic commit/abort protocols are useful provenance vocabulary, but source authority, tenant, subject, workflow, and read-set checks remain deterministic substrate concerns.
20. **Project COP should produce accountability, predictability, and common understanding.** PM literature supports owner/source/escalation and agreement metrics over richer dashboards alone.
21. **External task/tool state is evidence, not authority.** MCP Tasks, tool annotations, and authorization docs provide useful protocol vocabulary, but substrate admission must still validate source, subject, tenant, freshness, consequence, and workflow position.
22. **Memory search is a trust boundary.** Retrieved memories can reshape task interpretation and action selection, so memory outputs need the same source/ref validation as tool observations.
23. **World models are prediction state.** Text world models can support planning and offline evaluation, but predicted next state must be compared to observed authoritative state before action.
24. **Audit redundancy can expose conflicts.** FHIR-style multi-actor audit/provenance standards suggest duplicate or conflicting records from clients, servers, and intermediaries can be useful substrate warnings.
25. **PM artifacts are boundary objects with invariant cores.** State-review artifacts can travel across product, engineering, ops, audit, and agent roles only if stable invariant fields survive role-specific projections.
26. **Shared context must be admitted, not merely shared.** DeLM-style shared verified context strengthens the substrate thesis, but the transfer mechanism is admission-time verification plus read/write discipline, not a shared scratchpad.
27. **Memory retention now needs deletion, observability, and residue metadata.** Observability-safe memory retention and deployment-time memorization add stale-information risk, online-observable features, deletion mode, and forgetting residue as admission fields.
28. **Workflow consistency is an explicit eval axis.** Workflow-GYM, T1-Bench, ALEM, Emergence World, and SKILL.nb point to workflow-stage omission, objective drift, error propagation, and environment drift as artifact-sequence failures.
29. **MCP state handles are addressability, not authority.** The 2026 MCP release candidate and SEP-2567 support explicit state handles, but handles and tool annotations remain evidence needing substrate validation.
30. **PM handoffs need expertise, authority, and escalation state.** Faraj/Xiao, Bigley/Roberts, Lewis, Hsu et al., and handoff safety literature point to owner/source/expertise/escalation fields as executable PM state.
31. **Committed replay artifacts are part of the proof boundary.** If evidence admission only passes in memory, the substrate cannot honestly claim durable replay for that lane; checked-in corpora and drift tests matter.
32. **Privacy/release validity is trajectory-level.** OCELOT strengthens the bridge that individually acceptable disclosures can cumulatively leak protected facts; pm-substrate needs release-budget fixtures before privacy claims.
33. **Explicit policy conformance is separate from evidence currentness.** The finite-state social-simulation paper shows LLM action selection can drift from a reference policy; fresh evidence does not imply a valid workflow transition.
34. **LLM judges need state-defect recall metrics.** The production transaction-agent study shows automated judges can miss cross-turn state and guardrail defects when rubrics route them to non-operational buckets.
35. **Skill documents are governance evidence.** SkillAxe improves skill quality, but skill trigger/version/scope metadata must be admitted before skills silently affect valid action.
36. **ArrowHedge state-review and write-binding replay corpora are now part of the proof boundary.** v09 corrects v08: the open question is no longer persistence for those lanes, but durable verification and runtime coverage.
37. **Opt-in write binding is real but scoped.** Selected workflow dispatch can now block bad bindings, yet full mutation governance remains false until every external write transport uses a substrate-owned verifier.
38. **Executable tool wrappers increase hidden-dependency risk.** HyperTool-style nested calls make subcall read/write refs part of the observed read-set problem.
39. **Memory evolution and compaction need lineage.** Patches, supersession, deletion residue, and compaction decisions are state-bearing artifacts, not authority by themselves.
40. **Compiled corrections and skills are policy evidence.** TRACE-style runtime rules and skill documents need owner, trigger, scope, version, and source admission before they affect valid action.
41. **Runtime enforcement claims need monitorability classes.** Some invariants can be blocked before write; others are only detectable after execution or by audit/compensation.
42. **PM status, risk, and handoff updates are actions under uncertainty.** Shared mental-model and POMDP communication work imply status announcements should be reviewed for stale risk, authority, and update cost.
43. **Fixture-backed verification catalogs are now replay proof, not durable authority.** v10 corrects v09: committed corpora can now build and test an `EvidenceBindingReferenceCatalog`, but live stores, revocation, policy version, execution identity, and all-transport runtime adoption remain unproven.
44. **Cross-channel delivery needs target-side confirmation.** Scheduled or delegated state writes can silently fail even when dispatch reports success; pm-substrate should admit delivery only after the target channel proves receipt.
45. **Memory can steer control flow.** Retrieved memory that changes tool choice or action ordering is a control input, not passive context.
46. **More agents need marginal-utility proof.** Multi-agent workflows should show unique evidence contribution, conflict reduction, or faster valid action against a single-agent baseline.
47. **PM scaffolding has a burden budget.** Human-AI field experiments show collaboration protocols can improve some outcomes while harming quality, throughput, or diversity; handoff structure must be measured, not assumed good.
48. **Certificate-bound replay is now implemented but scoped.** v11 adds certificate-aware catalog verification and tenant-aligned committed corpora, but signed production certificates, DB-backed revocation, and all-transport adoption remain open.
49. **Replay certificates need durable status authority.** v12 maps W3C VC/Data Integrity/Status List vocabulary onto pm-substrate: issuer/proof/status/revocation fields are useful only when checked against a durable substrate-owned source.
50. **Memory writes are admissions, not personalization magic.** June 2026 memory-poisoning work strengthens the claim that memory creation needs source, channel, intended-use, expiry, and review metadata.
51. **Memory reads can be control inputs.** Memory-control-flow attacks make retrieved memory a tool-routing or policy-interpretation influence, not merely passive context.
52. **Target receipts are separate evidence.** Dispatch logs prove attempted send; target-side receipt events are needed before scheduled, memory, subagent, or PM handoff writes become shared state.
53. **Workflow verification should start as small transition specs.** Lean4Agent-style formalization is useful, but pm-substrate should first add deterministic policy-transition fixtures before broad formal-methods claims.
54. **Multimodal PM memory needs participant/source roles.** H2HMem and M3Exam strengthen the need to preserve speaker, modality, source artifact, conflict, and unresolved-risk fields in handoffs.
55. **Memory write/read taxonomy is now a pure tested primitive.** v13 adds a distinct `memory_write` evidence kind, memory intended-use and influence metadata, override-status warnings, and replay metrics for memory influence.
56. **Persistent agent environments increase urgency, not authority.** OpenAI/Ona, AgentCore, GitHub reliability, and Copilot control-plane sources strengthen the runtime-state pressure while remaining evidence/context rather than operational truth.
57. **Target receipt is now a pure tested primitive.** v14 adds a distinct `target_receipt` evidence kind, explicit receipt metadata, dispatch-only downgrade warnings, and replay metrics for dispatch-only versus applied target receipts.
58. **Status-currentness is the next authority boundary.** v15 separates a certificate or receipt from its current status: revocation, suspension, refresh, checked-at time, status authority, and privacy/correlation risk must be checked before evidence supports valid action.
59. **Block events are not enforcement unless terminal outcomes partition.** v16 corrects the live ArrowHedge bridge boundary: detected stale state, emitted block records, and suppressed actions are separate claims until one stable action id has exactly one terminal outcome.
60. **Terminal outcome normal form is now a pure tested primitive.** v18 adds `ActionOutcomeEnvelope` with outcome hashing, same-action terminal partition checks, stale-evidence demotion from requested `accepted` to `blocked`, local-view obstruction artifacts, role projection preservation, and substrate-ref recovery. This is pure proof only; workflow/runtime adoption and three-axis evals remain open.
61. **Outcome-envelope evidence is now visible in eval events.** v19 adds `action_outcome_envelope` as an eval ref kind and wires Axis A/C substrate events to cite outcome-envelope proof. This improves measurement, but runtime write transports still need required envelope generation before mutation.
62. **Write-transport outcome-envelope coverage is now measurable.** v20 extends the existing write-transport coverage report with outcome-envelope provider coverage; v21 moves the fixture inventory to 4/4 for workflow-routed write transports by generating envelopes inside `@pm/workflow`.
63. **Workflow runtime envelopes can now be promoted without a second terminal claim.** v22 adds a canonical promotion helper and ArrowHedge replay proof packets that cite the workflow envelope as substrate evidence; durable persistence into EvalEvents and amnesiac resume remains open.
64. **EvalEvents can now replay action-outcome refs against promoted proof packets.** v23 adds a replay index and metrics that resolve Axis A `action_outcome_envelope` refs back to valid terminal envelopes; Axis C still needs live packet persistence.
65. **Eval persistence now has a hash-gated terminal packet table.** v24 adds `evals.action_outcome_envelope_packets` and store methods that only accept hash-valid packets and reject same-ref/different-hash overwrites; Axis C still needs to generate those packets live.
66. **Axis C now generates canonical outcome packets before eval persistence.** v25 makes deterministic local-lab EvalEvents packet-backed and exposes packets from the dynamic local-agent-lab engine; full dynamic run-to-EvalEvent conversion remains open.
67. **Dynamic Axis C stale-observation now has packet-backed live EvalEvents.** v26 adds a dynamic local-agent-lab EvalEvent adapter, `live_run` evidence stage, packet-before-event persistence helper, retained live event rows, and a local Postgres/Ollama run whose packet refs resolve from the DB. This is one live failure class, not full Axis C coverage.
68. **Dynamic Axis C now has ten-class live coverage, but not three-axis verification.** v27 adds explicit live coverage reporting, registers all ten failure classes as dynamic `ScenarioSpec`s, and requires a protective packet-backed pair for coverage. The proof boundary shifts to lifting that gate across Axis A/B/C without hiding Axis B's blocked status.
69. **The repo now has a 30-cell three-axis coverage gate.** v28 adds `analyzeThreeAxisCoverage()` so each `(axis, failureClass)` cell is visible, blocked cells stay blocked, and stricter verification requires terminal-proof-backed pass pairs by default.
70. **Scenario verdicts are separate from operational terminal outcomes.** v29 adds `scenarioResult` and `operationalTerminalOutcome` to EvalEvents, so a substrate refusal can be both operationally `blocked` and a scenario `pass` when an `ActionOutcomeEnvelope` proves the terminal outcome.
71. **Three-axis status is now a traceable proof packet.** v30 adds `buildThreeAxisProofPacket()`, which records sources, verified axes, blocked axes, unverified axes, and cell-level proof status instead of allowing scattered event counts to imply completion.
72. **Terminal proof validity is a substrate primitive, not a verifier feature.** v31 hardens `admitActionOutcomeEnvelope()` and adds `buildActionOutcomeTerminalIndex()` so only hash-valid envelopes can become terminal incumbents, exact replays are idempotent, and same-action conflicts are state-plane issues before they are eval claims.
73. **ArrowHedge now consumes terminal admission before verifier accounting.** v32 adds finance-domain helpers that convert proposal-review artifacts into canonical envelopes and run them through the core terminal index, so same-action accepted/blocked conflict is caught at the Axis A code boundary.
74. **Workflow terminal admission is now a dependency-light port.** v33 lets `@pm/workflow` require admission for accepted/blocked invocation outcome envelopes before dispatch or dead-letter, while leaving canonical `@pm/agent-state` admission to adapters outside the workflow package.
75. **Agency publication terminal admission now has a profile adapter.** v34 lets `@pm/profile-agency` convert authoritative publication fixture snapshots into canonical terminal envelopes, block revoked approvals or content-hash drift, and report same-action publish conflicts through the core terminal index.
76. **Projection identity now has a replay certificate primitive.** v62 adds `ProjectionReplayCertificate`, so blocking action review can require hash-verified transition history and projection identity before a `CurrentStateView` authorizes action; durable store generation and runtime enforcement remain open.
77. **Projection replay certificates now have a durable frontier source.** v63 adds a projection-owned replay frontier over `events.events.seq`, so certificates can be generated from consumed event rows instead of caller-supplied transition lists; runtime enforcement remains open.
78. **Replay-certified projection state now gates a real mutation boundary.** v64 extends graph write authority so graph/capability writes can block missing, stale, mismatched, or store-divergent replay proof before mutation logic executes.
79. **Replay refs now require durable full-certificate lookup.** v65 adds a substrate-owned projection replay certificate store so capability write-authority resolution can reject missing or mismatched certificate records before mutation logic executes.
80. **Replay certificate stores now have append-only roots.** v66 adds certificate-store entry/root commitments and consistency proof verification so replay refs can be tied to a tamper-evident admission history.
81. **Replay certificate-store roots now have a witness gate.** v67 adds root witness admission so forked, regressed, tenant-mismatched, unproved, or invalidly proved roots can obstruct workflow-derived graph write authority before capability mutation.
82. **Root witness state now has a replayable ledger.** v68 adds hash-linked witness observation records and decision replay, so an amnesiac witness can recover accepted roots and reject tampered witness history instead of trusting process memory.
83. **Witnessed roots are not settled roots.** v69 adds root-witness settlement over replayed witness ledgers, so one valid witness can be only `witnessed`, an explicit quorum can be `settled`, and valid same-sequence conflicts become `obstructed`.
84. **Settlement witnesses now need replayed principal eligibility.** v70 adds witness-authority topology replay, so non-members, revoked/suspended principals, and equivocated witnesses cannot count toward topology-bound root settlement.
85. **Topology and settlement must be stored before they can be operational authority.** v71 adds durable authority-transition and settlement-record stores, so an amnesiac agent can replay witness eligibility and settled roots rather than accepting synthetic topology or settlement objects.
86. **Settled roots must be required at the mutation boundary.** v72 adds graph/capability settled-root write gating, so durable settlement cannot remain advisory when strict mutation policy is enabled.
87. **Settled roots still need decision-time currentness.** v73 adds settlement-currentness policy, so historically valid settled-root refs can fail as stale, conflicted, obstructed, below a known frontier, or topology-superseded before capability mutation authority is returned.
88. **Settlement currentness needs a witnessed store head.** v74 adds settlement-store head witnessing so a valid old settlement prefix cannot satisfy strict authority once a newer head has been witnessed.
89. **Settlement-head witness state now survives fresh agents.** v75 adds a Postgres-backed settlement-head witness ledger, so independent agents can replay prior head observations and reject stale heads without trusting conversation memory.
90. **Settlement-head observations need quorum topology.** v76 adds settlement-head witness authority topology and quorum certificates, so single, non-member, or equivocated observers cannot certify strict write authority.
91. **Head-witness topology must come from stored authority history.** v77 adds durable settlement-head witness authority stores and a store-backed quorum certifier, so adapters cannot certify head authority from synthetic eligible-witness lists.
92. **Certified head authority needs a sealed epoch.** v78 adds `seal_authority_epoch` transitions and effective topology hashes so later topology changes cannot rewrite an already certified settlement-head authority basis.
93. **Settlement-head witness rows need admitted signatures.** v79 adds strict signature-bound witness identity so stored observations and authority-epoch seals cannot count as operational authority unless replay proves the signing principal, key, and payload are admitted.
94. **Quorum certificates need their own proof records.** v80 adds durable settlement-head quorum-certificate records so signed witness evidence and epoch-seal linkage can be recovered without transient recertification.
95. **Signature currentness is replayed authority state.** v81 adds settlement-head witness key status so revoked or rotated keys cannot authorize observations, seals, or certificate records merely because their signatures still verify.
96. **Compaction is a replay object, not deletion.** v82 adds settlement-head witness replay compaction checkpoints so pruned prefixes can be replaced only by hash-checked frontiers plus derived replay projections.
97. **Checkpoint hashes are not checkpoint authority.** v83 adds settlement-head replay compaction checkpoint admission certificates so hash-valid snapshots cannot seed replay unless current admitted witnesses sign the exact checkpoint hash under replayed authority topology.
98. **Checkpoint admission must itself be durable replay history.** v84 stores checkpoint bodies and admission certificates together in a hash-linked record chain so fresh agents can recover checkpoint authority without process memory.
99. **Pruning is an admitted transition, not a storage side effect.** v85 adds compaction pruning admission so prefix deletion requires durable checkpoint-admission history plus retained suffix replay continuity.
100. **Physical deletion needs a tombstone transition.** v86 adds pruning tombstone records and tombstone-gated store prune APIs so row absence can be replayed as admitted substrate state rather than inferred from storage.
101. **Tombstone replay validity is not tombstone currentness.** v87 adds tombstone-store head currentness so a locally valid but stale or forked tombstone history cannot authorize a pruned projection.
102. **Required tombstone heads must survive amnesia.** v88 adds durable tombstone-head witness records so pruned-store continuity can derive its required head from replayed substrate history rather than memory or adapter input.
103. **Tombstone currentness certification needs witness topology.** v89 adds tombstone-head witness authority topology and quorum certificates so one observer or an unauthorized observer cannot unilaterally certify the current pruning tombstone head.
104. **Tombstone-head topology must come from stored authority history.** v90 adds durable tombstone-head witness authority stores and a store-backed certifier so adapter-supplied witness lists cannot define pruning tombstone currentness.
105. **Certified tombstone-head authority needs a sealed epoch.** v91 adds tombstone-head authority epoch seals so later topology changes cannot retroactively rewrite the authority basis or certificate hash of a historical pruning tombstone-head certification.
106. **Tombstone-head witness rows need admitted signatures.** v92 adds strict tombstone-head witness identity so observations and authority epoch seals cannot count as operational authority unless replay proves signer, payload, key, and tombstone-head authority topology.
107. **Tombstone-head quorum certificates need durable proof identity.** v93 adds hash-chained tombstone-head QC records so accepted witness signatures and epoch seals survive amnesiac recovery as replayable proof objects.
108. **Tombstone-head witness signatures need replayed key currentness.** v94 adds tombstone-head key rotation/revocation transitions so revoked or superseded keys cannot authorize certification or QC record replay.
109. **Tombstone-head compaction checkpoints need replayed admission.** v95 adds tombstone-head replay compaction checkpoints plus witness-signed admission certificates so compacted prefixes can seed replay without turning local summaries into authority.
110. **Tombstone-head checkpoint admissions must be durable replay history.** v96 stores tombstone-head checkpoint bodies and their admission certificates in a hash-linked record chain so recovered checkpoint authority comes from admitted history, not process memory or adapter-supplied summaries.
111. **Tombstone-head physical pruning needs admission before deletion.** v97 adds tombstone-head pruning admission so durable checkpoint records cannot authorize prefix deletion unless retained witness, authority, and QC suffixes replay from the admitted checkpoint frontier.
112. **Tombstone-head row absence needs tombstone history.** v98 adds durable tombstone-head pruning tombstones and tombstone-gated prune APIs so actual witness, authority, and QC row deletion is replayable and retained-suffix truncation is detectable.
113. **Tombstone-head pruning tombstone replay validity is not currentness.** v99 adds pruning tombstone-store head currentness so replay-valid but missing, stale, forked, unwitnessed-advance, or hash-invalid tombstone histories cannot authorize pruned projections.
114. **Required pruning tombstone-store heads must survive amnesia.** v100 adds a durable witness ledger so the required head consumed by tombstone-head pruned-store continuity is recovered from replayed witness records, not memory, adapters, connector caches, or local summaries.
115. **Durable required-head recovery is not quorum authority.** v101 adds pruning tombstone-store head witness quorum topology so strict continuity can require enough replay-eligible observers to certify the exact required head.
116. **Pruning tombstone-store head quorum topology must come from stored authority history.** v102 adds durable authority-transition stores and store-backed certification so caller-supplied topology cannot become certified required-head authority.
117. **Stored pruning tombstone-store head witness rows need signature-bound identity.** v103 requires strict replay of signer, payload, admitted key, and store-derived topology before stored witness observations can count toward certified required-head recovery.
118. **Pruning tombstone-store head witness signatures need replayed key currentness.** v104 adds key rotation/revocation transitions so old or revoked keys cannot authorize store-backed required-head certification.
119. **Pruning tombstone-store head witness authority needs sealed epochs.** v105 adds `seal_authority_epoch` transitions so later topology or key-status changes cannot retroactively govern a sealed required-head certification epoch.
120. **Certified pruning tombstone-store heads need durable proof records.** v106 adds hash-chained quorum-certificate records so certified required heads recover from admitted witness evidence, signatures, and seal linkage rather than transient recertification or memory.
121. **Pruning tombstone-store head compaction checkpoints must be admitted authority, not summaries.** v107 adds checkpoint/admission certificates so compacted witness, authority/key/seal, and QC-record prefixes can seed replay only after active witnesses sign the exact checkpoint hash and retained suffixes chain from the compacted frontiers.
122. **Pruning tombstone-store head checkpoint admission must itself be durable replay history.** v108 stores checkpoint bodies and admission certificates together in a hash-linked record chain so recovered compaction authority comes from admitted transition history, not process memory, adapter input, connector cache, or agent summaries.
123. **Pruning tombstone-store head physical pruning needs its own admission proof.** v109 adds a pruning-admission object so durable checkpoint history cannot authorize prefix deletion unless retained witness, authority, and quorum-certificate suffixes replay from the admitted checkpoint frontier.
124. **Pruning tombstone-store head row absence needs a replayable tombstone transition.** v110 adds a durable pruning tombstone ledger and tombstone-gated prune APIs so physical row deletion is replayable and out-of-band retained-suffix truncation is detectable.
125. **Pruning tombstone-store head row absence also needs current tombstone history.** v111 adds a replay-derived v110 pruning tombstone-store head and required-head continuity checks so stale, forked, unwitnessed-advance, missing, or hash-invalid tombstone histories cannot authorize pruned projection recovery.
126. **Required pruning tombstone history heads must survive amnesia through witness replay.** v112 adds a durable witness ledger for v111 pruning tombstone history-store heads, so currentness can be recovered from hash-linked admitted observations instead of memory, adapters, connector cache, or summaries.
127. **Recovered pruning tombstone history heads still need signed quorum authority.** v113 adds v112-specific topology replay, signed witness observation replay, and quorum certificates so one observer, unsigned rows, wrong keys, or unauthorized observer ids cannot certify required-head currentness.
128. **History-store head witness topology must come from durable authority history.** v114 adds durable authority-transition stores and a store-backed certifier so certified v112 required-head currentness derives eligibility and thresholds from replayed store history instead of in-memory transition arrays.
129. **History-store head witness signatures need replayed key currentness.** v115 adds key rotation/revocation transitions so old or revoked witness keys cannot authorize store-backed certified currentness.
130. **History-store head witness authority needs sealed epochs.** v116 adds `seal_authority_epoch` transitions so later topology or key-status changes cannot retroactively govern a sealed certification epoch.
131. **Certified history-store heads need durable proof records.** v117 adds hash-chained quorum-certificate records so certified required heads recover from admitted witness evidence, signatures, and seal linkage rather than transient recertification or memory.

## Source Changes

### Added on 2026-06-26 v117

- PBFT supplied the retained-proof bridge: recovery and view change depend on authenticated evidence for prior decisions, not a replica's private memory.
- HotStuff supplied the quorum-certificate bridge: a certified value should travel as an explicit proof object that later replay can verify.
- CHAINIAC supplied the collectively signed log bridge: out-of-date clients catch up from a tamper-proof signed release history rather than live local state.

### Added on 2026-06-26 v116

- Vertical Paxos supplied the reconfiguration-authority bridge: agreement about values and agreement about which authority configuration governs are separate replayable facts.
- PBFT supplied the stable-checkpoint bridge: a finalized frontier should prevent later protocol history from being accepted below that frontier.
- Raft supplied the committed-configuration bridge: membership/topology changes are log transitions, not remembered local facts.
- Viewstamped Replication supplied the view/reconfiguration bridge: later views must not retroactively govern operations certified under earlier views.

### Added on 2026-06-26 v115

- CONIKS supplied the key-transparency bridge: key bindings are auditable directory state, not remembered local facts.
- AKI supplied the accountable-revocation bridge: issuance, update, revocation, and recovery are protocol operations.
- ARPKI supplied the transparent-validation bridge: a signature only counts after replayed key-status validation.
- Enhanced Certificate Transparency supplied the currentness bridge: current authority requires inclusion plus non-revocation evidence.

### Added on 2026-06-26 v114

- Raft supplied the ordered-log bridge: topology changes are state-machine commands in an append-only log, not local facts.
- ARIES supplied the recovery bridge: after amnesia, operational state must be reconstructed by repeating durable history.
- Tamper-evident logging supplied the store-integrity bridge: stored authority rows need sequence and hash commitments before they can be trusted.
- SUNDR supplied the untrusted-store bridge: durable storage is acceptable only when forked or inconsistent histories become detectable.

### Added on 2026-06-26 v113

- PBFT supplied the authenticated quorum bridge: a state claim is not stable because one replica reports it, but because authenticated messages satisfy a threshold.
- Byzantine quorum systems supplied the eligible-set bridge: only replay-admitted witnesses inside the topology can count toward currentness, and thresholds are part of state.
- CoSi supplied the witness-cosigning bridge for binding currentness statements to admitted signers rather than process memory.
- CHAINIAC supplied the collective-transparency bridge: independent signed witness evidence should be preserved as a replayable proof object.

### Added on 2026-06-26 v112

- CoSi supplied the witness-cosigning bridge: a currentness statement should become client-acceptable only after witnessed accountability, not because one authority or process returned it.
- CHAINIAC supplied the collective transparency bridge: independent verification plus tamper-evident history makes a recovered head replayable rather than remembered.
- SUNDR supplied the fork-detection bridge: same-sequence divergent heads must become durable obstructions instead of silently replacing the accepted projection.

### Added on 2026-06-26 v111

- SUNDR supplied the fork-consistency bridge: a locally coherent history is not enough when another admissible head says the history forked.
- CONIKS supplied the snapshot-currentness bridge: clients monitor committed heads for consistency/currentness rather than trusting a provider-returned latest view.
- Tamper-evident log auditing supplied the head-commitment bridge: current log state is challenged against prior commitments, so the substrate needs a stable head object for the v110 tombstone ledger.

### Added on 2026-06-26 v110

- LSM-tree deletion supplied the logged-deletion bridge: deletion must be represented as a write in durable history before physical absence can be treated as state.
- Delete-aware LSM compaction supplied the persistence bridge: logical deletion and physical pruning are distinct steps, so the substrate needs a separate tombstone record for actual row pruning.
- Tamper-evident logging supplied the replay/audit bridge: row absence must be challengeable by a hash-linked tombstone ledger, not inferred from the current store contents.

### Added on 2026-06-26 v109

- PBFT supplied the stable-checkpoint garbage-collection bridge: log prefixes are discarded only after a checkpoint has proof, so deletion is a separate proof step rather than a side effect of checkpoint existence.
- Raft supplied the snapshot boundary bridge: compacted recovery must preserve enough boundary metadata for the retained suffix to pass consistency checks.
- ARIES supplied the logged-recovery bridge: recovery and deletion safety come from checkpoint plus log replay, not buffer memory, process continuity, or inferred current state.

### Added on 2026-06-26 v108

- Crosby and Wallach's tamper-evident logging work supplied the hash-linked commitment and deletion-proof bridge: compacted history remains trustworthy only when pruning/recovery can prove which append-only commitment admitted the checkpoint.
- SUNDR supplied the fork-consistency bridge: a server or local process may equivocate only by creating durable divergent histories that later clients can detect as forks.
- CONIKS supplied the transparency/non-equivocation bridge: clients should monitor compact commitments, not trust a provider or adapter to report the current admitted state honestly.

### Added on 2026-06-26 v107

- ARIES supplied the repeat-history recovery bridge: checkpoints are recovery frontiers, while replay still follows logged sequence/hash history.
- Raft supplied the snapshot-position bridge: compacted state must carry enough frontier metadata for later log entries to continue consistency checks.
- PBFT supplied the stable-checkpoint bridge: log truncation requires quorum proof, so a checkpoint summary cannot seed operational state without witness admission.

### Added on 2026-06-26 v106

- PBFT supplied the stable-proof bridge: committed or checkpointed state needs retained proof messages before logs can be safely truncated.
- HotStuff supplied the quorum-certificate bridge: certified history is a first-class object that later recovery can reason from.
- CHAINIAC supplied the transparency-log bridge: collectively witnessed updates can be validated by out-of-date clients from durable signed log history.

### Added on 2026-06-26 v105

- Vertical Paxos supplied the reconfiguration-authority bridge: configuration authority changes need explicit governance rather than later local inference.
- PBFT supplied the stable-checkpoint bridge: enough checkpoint proof fixes prior protocol history below a low-water mark.
- Raft supplied the configuration-log-entry bridge: authority topology changes are admitted log entries, and historical decisions are not reinterpreted by later configurations.

### Added on 2026-06-26 v104

- CONIKS supplied the key-status bridge: name-to-key bindings are auditable directory state, so a stale local key id cannot stand in for current authority.
- AKI supplied the accountable update/revocation bridge: key changes need checks-and-balances and explicit revocation/recovery semantics rather than private caller facts.
- ARPKI supplied the transparent certificate-operation bridge: issuance, update, revocation, and validation are all accountable operations, not separate adapter concerns.
- CTng supplied the revocation-transparency bridge: relying parties should validate current revocation state from threshold-verifiable updates before accepting cached evidence.

### Added on 2026-06-26 v103

- in-toto supplied the signed-metadata bridge: evidence should count only when a functionary signature binds exact payload hashes to authorized actors.
- CONIKS supplied the key-binding bridge: identity-to-key mappings are auditable state, not local memory or adapter configuration.
- PBFT supplied the authenticated-quorum bridge: quorum progress depends on authenticated messages, not only participant names.
- TrInc carried forward the anti-equivocation bridge: v102 gave this layer monotonic topology history, while v103 binds observations to replay-admitted identity/key state.

### Added on 2026-06-26 v102

- Tamper-evident logging supplied the store-history bridge: authority claims are accepted by replaying append order and hash commitments, not by trusting an untrusted server or caller object.
- Dynamic Byzantine quorum systems supplied the dynamic-topology bridge: quorum membership and thresholds are mutable system state that must change through controlled history.
- TrInc supplied the anti-equivocation bridge: claims need monotonic identity/counter discipline so conflicting histories cannot be silently issued. v102 implements the durable history slice; signature-bound identity remains SQ50.

### Added on 2026-06-26 v101

- CoSi supplied the witness-cosigning bridge: authoritative statements should be accepted only after enough independent witnesses have seen and validated them.
- PBFT supplied the matching-participant bridge: arbitrary faulty behavior is contained by requiring enough matching participants from an authority set.
- Byzantine quorum systems supplied the topology/intersection bridge: only authorized quorums can operate on behalf of a replicated authority.
- Dynamic Byzantine quorum systems supplied the changing-topology bridge: quorum membership and thresholds are state that must be replayed, not caller-supplied context.

### Added on 2026-06-26 v100

- Tamper-evident logging supplied the append-only commitment bridge: current and prior commitments must be replay-consistent before an untrusted log can be treated as authoritative.
- SUNDR supplied the fork-consistency bridge: same-sequence divergent views should become detectable obstructions rather than competing operational memories.
- Practical key transparency supplied the witness-commitment bridge: users recover trusted currentness from witness-certified history instead of a provider response.
- Parakeet supplied the queryable witness-history bridge: commitments and certificates must be recoverable after restart, not reconstructed from process memory.

### Added on 2026-06-26 v99

- Certificate Transparency supplied the signed-tree-head and consistency-proof bridge: local append-only replay still needs a current head object to detect stale or forked views.
- CONIKS supplied the directory-consistency bridge: a signed binding or record is not enough if clients can observe inconsistent authoritative views.
- Append-only authenticated dictionary transparency supplied the user/monitor/auditor bridge: exact head comparison is the minimal currentness slice before durable witness/quorum recovery.
- Accountable Key Infrastructure supplied the checks-and-balances bridge: required heads should ultimately be recovered from monitored substrate history, not a single caller.

### Added on 2026-06-26 v98

- LSM-tree delete nodes supplied the explicit-delete-record bridge: absence is not authoritative unless a delete/tombstone record participates in the merge/replay history.
- ARIES supplied the logged-physical-change bridge: physical row changes must be redoable from history, not reconstructed from process memory or current storage shape.
- Dostoevsky/LSM compaction supplied the storage-reclamation bridge: removing obsolete entries is an optimization governed by merge/replay policy, not a separate authority path.

### Added on 2026-06-26 v97

- Raft supplied the snapshot-position bridge: deletion is safe only when the snapshot preserves the last-included frontier needed by the retained log.
- ARIES supplied the recovery-boundary bridge: truncation is a recovery calculation over logged history, not a guess from current storage state.
- PBFT supplied the stable-checkpoint garbage-collection bridge: old protocol state can be collected only below stable checkpoint evidence.
- BFT systems survey work reinforced that irreversible pruning decisions need stable evidence backed by enough non-faulty replicas or witnesses.

### Added on 2026-06-26 v96

- Tamper-evident logging supplied the hash-linked/auditable-history bridge for making checkpoint-admission records detect missing, reordered, or mutated history.
- Append-only authenticated dictionaries supplied the lookup-plus-consistency bridge for recovering checkpoint admissions without trusting latest-value responses.
- Secure logging and certificate-transparency analysis supplied the distinction between inclusion proof and append-only consistency proof.
- PBFT stable checkpoints reinforced that checkpoint proof material must survive recovery and view changes, not exist only as volatile process state.

### Added on 2026-06-26 v95

- ARIES supplied the checkpoint-plus-log recovery bridge: checkpoints establish a recovery frontier, while replay/redo still comes from log history after that boundary.
- Raft supplied the snapshot-positioning bridge: compacted state must carry a log position so the suffix can continue the history.
- PBFT supplied the stable-checkpoint bridge: checkpoints become safe only when backed by signed proof from enough replicas.

### Added on 2026-06-26 v94

- AKI supplied the accountable key-revocation bridge: key validation needs logged revocation/accountability state.
- CONIKS supplied the key-binding currentness bridge: signatures only count against a consistency-audited current key binding.
- CRLite supplied the fail-closed revocation bridge: unavailable or stale revocation state must not silently validate compromised keys.
- Enhanced Certificate Transparency supplied the current-proof bridge: a key must be issued and not revoked, not merely present in history.

### Added on 2026-06-26 v93

- PBFT supplied the durable signed protocol/checkpoint evidence bridge: recovery depends on retained proof material, not replica memory.
- HotStuff supplied the quorum-certificate bridge: later safety decisions build on explicit vote certificates.
- CHAINIAC supplied the collectively signed transparency-log bridge: clients catch up by validating stored witness-approved updates.

### Added on 2026-06-26 v92

- in-toto supplied the authenticated-functionary bridge that operational statements should be signed by authorized actors and checked against expected parties and payloads.
- PBFT supplied the authenticated-message bridge that recovery and certificate evidence only counts when attributable to protocol participants.
- Tamper-evident logging reinforced that hash-linked history proves integrity but not authorship.
- CONIKS supplied the key-transparency bridge that public-key bindings and signed views need auditable currentness rather than private lookup trust.

### Added on 2026-06-26 v91

- Viewstamped Replication supplied the view-change/recovery bridge that later configurations must preserve quorum-known historical operations.
- Vertical Paxos supplied the configuration-activation bridge that reconfiguration authority needs an explicit boundary rather than local inference by later leaders.
- Raft supplied the committed-log safety bridge that historical commitments are not reinterpreted by later leaders or membership changes.
- Dynamic Byzantine quorum systems reinforced that topology changes are admissible only when quorum safety survives reconfiguration.

### Added on 2026-06-26 v90

- Raft supplied the replicated-log bridge that membership/topology changes belong in a log before they can drive state-machine decisions.
- ARIES supplied the recovery bridge that durable transition records, not volatile process state, reconstruct current authority after restart.
- Tamper-evident logging supplied the append-only hash-chain bridge for detecting hidden edits to authority history.
- Dynamic Byzantine quorum systems supplied the bridge that quorum topology can change only through a correctness-preserving reconfiguration path.

### Added on 2026-06-26 v89

- Practical Byzantine Fault Tolerance supplied the bridge that currentness certificates need quorum evidence rather than one process' local state.
- Byzantine quorum systems supplied the bridge that eligible witness sets and intersection assumptions are topology, not merely counts.
- Certificate-log gossip supplied the bridge that head observations become useful only when compared across clients/monitors.
- Collective signing supplied the bridge that a configured witness group can compact agreement into a public certificate.

### Added on 2026-06-26 v88

- Certificate-log gossip supplied the bridge that clients need shared observed heads to detect inconsistent log views.
- CONIKS supplied the bridge that clients can monitor provider-maintained state and collectively audit non-equivocation.
- Secure logging / Certificate Transparency supplied the monitor/auditor distinction for append-only log behavior across parties and time.
- OPTIKS supplied the bridge that transparency systems should detect incorrect behavior despite restart and machine-failure pressure.
- Tamper-evident logging supplied the bridge that witness observations themselves must be hash-linked replay history.

### Added on 2026-06-26 v87

- Tamper-evident incremental auditing supplied the bridge that local commitment validity is not enough; commitments need currentness/consistency checks.
- CONIKS supplied the non-equivocation bridge for users checking provider-maintained state across observations.
- Certificate-log gossip supplied the bridge that local views need shared-head comparison to detect split views.
- Append-only authenticated dictionaries supplied the bridge that lookup validity and append-only currentness are separate proofs.
- Secure logging / Certificate Transparency supplied the distinction between inclusion/audit proofs and append-only consistency proofs.

### Added on 2026-06-26 v86

- LSM-tree delete-node mechanics supplied the bridge that physical deletion should trail a replay-visible delete marker.
- Timely persistent LSM deletion supplied the bridge that tombstones and compaction progress are distinct from actual deletion completion.
- Tamper-evident safe deletion supplied the bridge that deletion needs proof that no inappropriate history was removed.
- ARIES reinforced that recovery must depend on logged history rather than current storage absence.

### Added on 2026-06-26 v85

- Raft 2014 supplied the snapshot-suffix continuity bridge: snapshots preserve last included metadata so the first retained log entry can be checked.
- PBFT 1999 supplied the low-watermark bridge: garbage collection is allowed below stable checkpoints, not because a local snapshot exists.
- ARIES 1992 supplied the recovery-start bridge: truncation is safe only after determining the earliest log point recovery may need.
- Instant-recovery checkpointing supplied the checkpoint-plus-log-replay bridge for treating checkpoints and retained logs as one recovery system.
- Tamper-evident logging reinforced that pruning decisions need auditable artifacts rather than invisible deletion.

### Added on 2026-06-26 v84

- Crosby and Wallach 2009 supplied the tamper-evident logging bridge: inclusion and consistency both need proof against prior log states.
- Append-only authenticated dictionaries supplied the lookup-plus-append-only bridge for checkpoint-admission histories.
- CONIKS supplied the non-equivocation monitoring bridge: clients should compare provider-maintained bindings across time.
- Secure logging / Certificate Transparency analysis supplied the distinction between audit proof and consistency proof.
- PBFT 1999 reinforced that stable-checkpoint proof material must survive recovery and view changes.

### Added on 2026-06-26 v83

- PBFT 1999 supplied the stable-checkpoint certificate bridge: matching signed checkpoint statements, not local snapshot hashes, make a checkpoint stable.
- Distler 2021 supplied the BFT-SMR recovery bridge: checkpoint certificates must let a recovering replica verify checkpoint contents from another source.
- Zyzzyva 2007 supplied the signed-checkpoint recovery bridge for treating checkpoint evidence as independently attributable participant statements.
- Eischer and Distler 2019 supplied the efficient-verifiable-checkpointing bridge: checkpoint optimization must preserve recovery verifiability.
- Raft 2014 reinforced that snapshot installation is replicated-log recovery state, not private process memory.

### Added on 2026-06-26 v82

- Raft 2014 supplied the snapshot/log-compaction bridge: a discarded prefix must leave the last included frontier needed to continue the log.
- PBFT 1999 supplied the stable-checkpoint bridge: old protocol messages can be garbage-collected only after a checkpoint proof fixes the sequence and state digest.
- ARIES 1992 supplied the fuzzy-checkpoint bridge: recovery can start from a recorded recovery state instead of genesis without stopping ongoing work.
- Authenticated data structures supplied the compact-verification bridge: clients can verify derived data from a digest rather than recomputing all history.
- Append-only authenticated dictionaries supplied the compact transparency-log bridge for auditing state without downloading the full log.

### Added on 2026-06-26 v81

- AKI 2013 supplied the accountable key-status bridge: certificate/key validation needs logged issuance and revocation state, not only local key parsing.
- ARPKI 2014 supplied the multi-authority logged-key bridge for treating key status as a protocol property.
- CONIKS 2015 supplied the auditable key-directory bridge: binding currentness must be monitored and consistent across clients.
- CRLite 2017 supplied the decision-time revocation bridge: stale credentials remain dangerous unless revocation status is cheap and available during validation.

### Added on 2026-06-26 v80

- HotStuff 2019 supplied the quorum-certificate-as-proof-object bridge: later safety decisions consume a certificate rather than re-inferring votes from local state.
- PBFT 1999 supplied the recovery/view-change proof bridge: authenticated log/proof material must survive enough to justify prior decisions after disruption.
- CHAINIAC 2017 supplied the collectively signed transparency-log bridge: out-of-date clients can validate a signed release from durable proof history.
- SBFT 2019 supplied the collector/full-proof bridge: threshold witness shares become compact commit/execute proof objects that clients can verify.

### Added on 2026-06-26 v79

- in-toto 2019 supplied the authenticated-functionary bridge: operational steps should be recorded as signed statements by authorized actors, not trusted artifact fields.
- PBFT 1999 supplied the authenticated-message bridge: quorum evidence only counts when attributable to protocol participants.
- Crosby and Wallach 2009 supplied the tamper-evident-log boundary: hash-linked history detects mutation but still needs authenticated entry authorship.
- CONIKS 2015 supplied the signed-directory-view bridge: accountable current views need signed, monitorable bindings rather than bare values.

### Added on 2026-06-26 v78

- Lamport/Malkhi/Zhou 2010 supplied the state-machine reconfiguration bridge: outputs are irrevocable and configuration changes take effect at defined command positions.
- Vertical Paxos 2009 supplied the configuration-master bridge: reconfiguration choices are fixed for later leaders rather than inferred from local state.
- Virtual synchrony 1987 supplied the membership-view boundary bridge: old-view requests and new-view requests are separated by installed membership changes.
- HotStuff 2019 supplied the quorum-certificate finality bridge: proof objects guide safe later decisions rather than recomputing from private votes.

### Added on 2026-06-26 v77

- Raft 2014 supplied the configuration-as-log-entry bridge: membership/current configuration claims must be reconstructed from committed log history.
- ARIES 1992 supplied the recovery-authority bridge: post-restart state is rebuilt by replaying logged history rather than trusting volatile process state.
- Crosby and Wallach 2009 supplied the append-only tamper-evidence bridge: a stored log needs hash/proof structure so inconsistent history becomes detectable.

### Added on 2026-06-26 v76

- PBFT 1999 supplied the quorum-commitment bridge: one replica vote is not enough to commit fault-tolerant state.
- HotStuff 2019 supplied the quorum-certificate bridge: enough votes form a proof object that later safety decisions can consume.
- CHAINIAC 2017 supplied the independent-witness bridge: accepted updates require public, collective witness validation.
- ByzCoin 2016 supplied the collective-signing bridge: distributed votes can become one compact commitment artifact.

### Added on 2026-06-26 v75

- Chuat et al. 2015 supplied the certificate-transparency gossip bridge: independent clients compare compact log-head consistency evidence to detect split views.
- Attested Append-Only Memory 2007 supplied the minimal append-only accountability bridge: prior statements must constrain later accepted state.
- CHAINIAC 2017 supplied the collectively witnessed history bridge: transparent, verifiable append histories are preconditions for distributed update authority.
- Accountable Virtual Machines 2010 supplied the replay/audit bridge: enough durable log data lets a later auditor verify execution without trusting the original process.

### Added on 2026-06-26 v74

- SUNDR 2004 supplied the fork-consistency bridge: untrusted servers can be forced to expose divergent histories once clients compare observations.
- CONIKS 2015 supplied the user-monitorable transparency bridge: clients can efficiently monitor consistency of provider-maintained bindings.
- Crosby and Wallach 2009 supplied the log-head consistency bridge: a logger must prove the current view is consistent with prior views.
- Perspectives 2008 supplied the notary bridge: independent observations can detect server views a single client would accept.
- AKI 2013 reinforced accountable log heads, revocation, and checks-and-balances as authority-currentness machinery.

### Added on 2026-06-26 v73

- Gray and Cheriton 1989 supplied the lease/currentness bridge: cached authority must be revalidated after its term or conflicting writes.
- CRLite 2017 supplied the revocation-status bridge: historical certificates require current status checks and fail-closed behavior.
- AKI 2013 supplied the accountable key-update bridge: public logs, revocation, and hold periods prevent stale keys from remaining current authority.
- ARPKI 2014 supplied the transparent certificate-operation bridge: issuance, update, revocation, and validation are accountable log operations.
- Spanner 2012 supplied the external-consistency bridge: current authority is tied to system-defined order/frontier, not client memory.

### Added on 2026-06-26 v72

- Appel and Felten 1999 supplied the proof-carrying authorization bridge: write authority should carry a checkable proof object.
- PCAL / proof-carrying authorization work supplied the automated access-check bridge for policy proof obligations.
- Ligatti, Bauer, and Walker 2005 supplied the runtime enforcement bridge for suppressing policy-violating actions before mutation.
- Clark-Wilson 1987 supplied the well-formed-transaction integrity bridge for constrained graph/capability writes.
- Schneider 2000 supplied the execution-monitor safety bridge for preventing bad action prefixes.

### Added on 2026-06-26 v71

- Crosby and Wallach 2009 supplied the tamper-evident append-only log bridge for durable authority and settlement records.
- Mohan et al. 1992 ARIES supplied the recovery-from-log bridge for reconstructing topology and settled roots after amnesia/restart.
- Raft 2014 reinforced that configuration is logged state-machine history, not runtime caller configuration.
- CONIKS 2015 and append-only authenticated dictionary work supplied the transparency bridge for monitorable principal eligibility and settlement lookup.

### Added on 2026-06-26 v70

- Raft 2014 supplied the logged membership-change bridge: membership is state-machine history, not caller configuration.
- Vertical Paxos 2009 supplied the configuration-authority bridge for separating data replication from membership decisions.
- RAMBO II supplied the dynamic-configuration bridge for long-lived systems whose quorum participants change.
- CONIKS and AKI supplied the key/principal transparency bridge for revocation, non-equivocation, and accountable eligibility.

### Added on 2026-06-26 v69

- PBFT 1999 and HotStuff 2019 supplied the quorum/finality bridge that settlement should be a replayed certificate over eligible witnesses rather than a local latest-root choice.
- CHAINIAC 2017 and ByzCoin 2016 sharpened the difference between a witnessed timeline and a collectively accepted commitment.
- CoSi 2016 remains the witness-statement bridge; v69 adds the policy boundary that says how many replayed witnesses are enough for settlement.

### Added on 2026-06-26 v68

- Syta et al. 2016 CoSi witness cosigning: supplied the mechanism that authoritative statements should be witnessed before clients accept them.
- CHAINIAC 2017: supplied the collectively signed timeline bridge for clients that are out of date but need to verify a release/history.
- ByzCoin 2016: supplied the strong-consistency collective-signing bridge that separates durable commitment from probabilistic memory.
- Crosby and Wallach 2009: supplied the hash-linked tamper-evident log mechanics for witness observation records.

### Added on 2026-06-26 v67

- SUNDR / fork consistency: supplied the detection bridge for making divergent replay-store histories obstruct once clients observe one another.
- Chuat et al. 2015 Certificate Transparency gossip: supplied the root-exchange and consistency-proof mechanism for detecting split views.
- CONIKS: reinforced self-monitoring of provider-maintained bindings rather than trusting a current lookup response.
- Oxford, Parker, and Ryan 2020: sharpened the claim that gossip/witnessing must be an explicit protocol property, not an assumed side effect of having roots.

### Added on 2026-06-26 v66

- Crosby and Wallach 2009, "Efficient Data Structures for Tamper-Evident Logging": supplied the root/consistency-proof semantics for certificate-store commitments.
- Li, Krohn, Mazières, and Shasha 2004, "SUNDR": supplied the fork-consistency bridge for detecting divergent store histories when agents compare roots.
- Melara et al. 2015, "CONIKS": reinforced that users/agents must monitor provider-maintained bindings for consistency.
- Certificate Transparency / RFC 6962: supplied the append-only consistency-proof shape, adapted here as a linear hash-chain proof rather than a Merkle proof.

### Added on 2026-06-26 v65

- Crosby and Wallach 2009, "Efficient Data Structures for Tamper-Evident Logging": supplied membership/consistency-proof semantics for why certificate-store lookup is the next step after structural refs.
- Melara et al. 2015, "CONIKS": supplied the transparency-service bridge for making provider-maintained bindings monitorable rather than privately believed.
- Tomescu et al. 2019, "Transparency Logs via Append-Only Authenticated Dictionaries": sharpened the next missing primitive as append-only lookup and consistency proof for certificate records.
- Kim et al. 2013, "Accountable Key Infrastructure": supplied the accountable certificate-validation bridge for replay-certificate issuance.
- No axis source was added; the implementation strengthens substrate replay authority before domain validation pressure.

### Added on 2026-06-26 v64

- Ligatti, Bauer, and Walker 2005, "Edit automata": supplied the runtime suppression/monitoring bridge for blocking unsafe writes before they enter the action stream.
- Reference monitor literature: supplied the complete-mediation bridge for making graph write authority the small mutation gate.
- Clark and Wilson 1987: strengthened the well-formed-transaction interpretation of capability graph writes.
- Capobianco et al. 2024, "TALISMAN": sharpened why replay refs must be preserved in substrate records rather than trusted only as request input.
- No axis source was added; the implementation strengthens substrate mutation admission before validation pressure.

### Added on 2026-06-26 v63

- Mohan et al. 1992, "ARIES: A Transaction Recovery Method...": reused the log-sequence/page-state mechanism to justify sequence-backed projection cursors.
- Zhou, Larson, Goldstein, and Ding 2007, "Lazy Maintenance of Materialized Views": added the persistent maintenance-task / commit-sequence bridge for deferred projection proof.
- Colby, Griffin, Libkin, Mumick, and Trickey 1996, "Algorithms for Deferred View Maintenance": added the auxiliary-history-since-refresh bridge for projection frontier certification.
- No axis source was added; the implementation strengthened substrate replay identity before returning to validation pressure.

### Added on 2026-06-26 v62

- Schneider 1990, "Implementing Fault-Tolerant Services Using the State Machine Approach": extracted the deterministic ordered-transition reconstruction rule for projection identity.
- Mohan et al. 1992, "ARIES: A Transaction Recovery Method...": strengthened the recovery-from-log bridge for amnesiac agent resume.
- Chandy and Lamport 1985, "Distributed Snapshots": added the consistent-cut/frontier bridge for current projection claims.
- Buneman, Khanna, and Tan 2001, "Why and Where: A Characterization of Data Provenance": sharpened why source refs need computable derivation proof.
- Green, Karvounarakis, and Tannen 2007, "Provenance Semirings": strengthened the projection-derivation hash requirement.
- No new axis source was used for the implementation slice; systems research drove the substrate primitive first, and axes remain later wind tunnels.

### Added on 2026-06-26 v61

- Han et al. 2026-06-23, "Measuring User's Mental Models of Speech Translation in Human-AI Collaboration": useful PM/human-AI mental-model evidence, but not operational-state authority.
- Bedoui et al. 2026-06-25, "Auditing Framing-Sensitive Behavioral Instability in Large Language Models for Mental Health Interactions": downgraded prompt framing and summary stability as state proof.
- Liu et al. 2026-06-18, "Agentic Electronic Design Automation: A Handoff Perspective": strengthened the handoff-as-acceptance-condition bridge for later `workflow_invalidation` work.
- Mylonas et al. 2026-06-17, "PowerAgentBench-SS": strengthened capability-contract and evidence-log testing implications.
- Wang et al. 2026-06-16 revision, "From Agent Traces to Trust": reinforced typed provenance/evidence tracing for replayable agent-state artifacts.
- Cousot and Cousot 1977 plus Campion et al. 2023: added the abstract-interpretation / incompleteness bridge for treating `representation_loss` as projection-fidelity failure.
- AHRQ TeamSTEPPS handoff guidance: added daily PM evidence that handoffs transfer authority/responsibility and require uncertainty, changes, contingencies, and receiver acknowledgement.

### Added on 2026-06-05

- STALE, 2026-05-07 arXiv preprint/benchmark: implicit conflict, state resolution, premise resistance, policy adaptation.
- Useful Memories Become Faulty, 2026-05-13 arXiv preprint: continuous LLM-written consolidation can degrade; preserve raw episodes.
- ContractBench, 2026-05-17 arXiv preprint/benchmark: observation contracts with temporal validity and byte-level integrity.
- STATE-Bench official repo/release post, May 2026: stateful enterprise tasks with deterministic state assertions and pass^5 reliability.
- Claw-Eval-Live, April/May 2026: live workflow benchmark with service state, audit logs, and post-run workspace artifacts.
- Mental model discrepancy detection, 2026 arXiv preprint: unsupported beliefs, false beliefs, contradictions, omissions.
- PMI Pulse 2026 and PM teamwork bibliometrics: complexity, coordination, shared mental models/transactive memory, and trust as recurring PM mediators.

### Added on 2026-06-05 v02

- Agent Memory systems characterization, 2026-06-04 arXiv preprint: memory systems have construction/retrieval/generation tradeoffs and freshness-latency implications, but do not supply authority by themselves.
- Recuse Signal, 2026-06-04 arXiv preprint: cooperative in-band deny signals can guide agents but are explicitly not enforcement boundaries.
- Handoff Debt, 2026-06-01 arXiv preprint: structured handoff views reduce successor-agent rediscovery cost, giving continuity a measurable handoff-efficiency target.
- S-Bus, 2026-05 arXiv preprint: server-observed read-set reconstruction and Observable-Read Isolation map directly to multi-agent stale-read validation.
- Constraint Drift, 2026-05 arXiv preprint: constraints must remain fresh, inherited, enforceable, and auditable across memory, delegation, communication, tool use, and audit.
- Automated Benchmark Auditing, 2026-05 arXiv preprint: complex agent benchmarks often contain hidden dependencies, specification gaps, and brittle grading logic.
- Wegner 1987, Espinosa/Lerch/Kraut 2004, Marks/Mathieu/Zaccaro 2001, and COP sources: strengthened PM handoff, shared cognition, explicit coordination, and common situational understanding bridges.

### Added on 2026-06-05 v03-local

- CollabSim and ALMANAC, 2026-06-04 arXiv preprints: action-level collaborative competence, mental-model annotations, common ground, partner intent, shared goals, and misalignment repair.
- MAGE and MemGate, 2026-06-04 arXiv preprints: execution-state memory and memory search as a trust boundary.
- PACT, 2026-06-03 arXiv preprint: inter-agent communication as compact action-state records before shared history.
- HarnessFix, 2026-06-04 arXiv preprint: trace-guided provenance and harness-layer failure attribution.
- WebMCP Tool Surface Poisoning, 2026-06-04 arXiv preprint: dynamic tool metadata/origin/lifecycle drift as an agent authority surface.
- ToolMaze and TRIAD, 2026-06-04 arXiv preprints: implicit semantic tool failures and guardrail feedback as remediation, not deterministic enforcement.

### Added on 2026-06-06 v03

- W3C PROV-DM, W3C Trace Context, CloudEvents, and OCEL 2.0: standards-backed vocabulary for provenance, trace correlation, event envelopes, and object-centric process records.
- HearthNet and Message Sequence Chart LLM-agent coordination preprints: useful analogies for stale/unauthorized command rejection and protocol-level coordination guarantees, but not enterprise proof.
- Cataldo/Herbsleb/Carley socio-technical congruence and Lewis transactive memory: stronger PM bridge for dependency-owner coordination and owner/source-of-truth metadata.
- ISO 21502, human-agentic teaming, and human-AI mental-model work: useful PM/team framing, but only Medium/Low as direct architecture proof.

### Added on 2026-06-07 v04

- S-Bus paper, source repo, and benchmark dataset: implemented read-set reconstruction/ORI bridge, with explicit production-hardening limits.
- Claw-Eval-Live official site and repo: released tasks, fixtures, mock services, grader scripts, and trace CLI for live workflow evaluation architecture.
- Silo-Bench paper and repo: communication-reasoning gap, coordination cost, communication density, and distributed-state synthesis as multi-agent metrics.
- From Agent Traces to Trust: June 2026 provenance survey supporting unified trace schemas, claim/action provenance, recovery-oriented eval, and privacy-aware audit.
- RFC 9110, RFC 9449, RFC 9421, and RFC 8693: standards vocabulary for preconditions, proof-of-possession, signed-component expiry/integrity, and delegation/actor chains.
- Coordination-requirement scalability, Team Situation Awareness measurement, and 2021 socio-technical congruence work: PM metrics should be scalable, agreement-based, and outcome-tested rather than overclaimed.

### Added on 2026-06-08 v05

- AdaPlanBench paper, official repo, and dataset: progressive world/user constraint disclosure, repeated violations, valid-plan rate, and run artifacts sharpen ArrowHedge fixture design.
- TIDE temporal state misalignment and LOCOMO-CONV OpenReview submissions: temporal validity and implicit/composed conversational memory gaps extend v04's stale-read framing.
- H-CSC, TRACE, DuMate-DeepResearch, Tree-of-Experience, OPENPATH, and encrypted multi-agent control preprints: typed semantic commit/abort, cross-step evidence, auditable tool traces, structured experience validation, deterministic specialist enforcement, and privacy-aware state-estimation bridges.
- Chandy-Lamport distributed snapshots, Kung/Robinson OCC, Garcia-Molina/Salem sagas, Lewis transactive memory, Faraj/Sproull expertise coordination, Okhuysen/Bechky coordination mechanisms, and COP/common-situational-understanding sources: older mechanisms for consistent snapshots, read validation, long-lived transactions, expertise/authority location, accountability, predictability, and common understanding.

### Added on 2026-06-09 v06

- Bridging the Agent-World Gap / text world models, SentinelBench, Beyond Similarity memory-search security, Agent libOS, AuthGraph, Evidence Tracing and Execution Provenance, AgentAtlas, VerifyMAS, MAST, finance-MAS evaluation, and SEMAP: new agent-state bridge sources for prediction-vs-authority, monitoring lifecycle, memory trust boundaries, capability-controlled runtimes, provenance-vs-authorization, trajectory-level attribution, and protocol/lifecycle engineering.
- MCP official specs for tasks, tools, authorization, and tool annotations: protocol task state and tool metadata become evidence inputs, not automatic substrate authority.
- OpenLineage, FHIR Provenance, FHIR AuditEvent, and in-toto/SLSA: standards vocabulary for run/job/dataset lineage, multi-actor audit/provenance, and attestable subjects/predicates/materials.
- National Academies human-AI situation-awareness chapter, DeChurch/Mesmer-Magnus shared mental-model meta-analysis, Star/Griesemer boundary objects, and Malone/Crowston coordination theory: PM artifacts should expose structured dependencies, source/owner/handoff state, and invariant fields that survive role-specific interpretation.

### Added on 2026-06-10 v07

- Workflow-GYM, T1-Bench, WeaveBench, ALEM, Emergence World, and SKILL.nb: long-horizon professional/GUI/open-ended workflows make workflow-stage omission, objective drift, error propagation, environment drift, gate-conditioned execution, and artifact-sequence evaluation first-class eval targets.
- DeLM shared verified context, ActiveMem distributed memory, OSL-MR observability-safe memory retention, Deployment-Time Memorization, H2HMem, and spatial-memory occlusion work: shared context and memory mechanics improve coordination/retention, but require admission metadata for source, authority, observability, deletion residue, modality, visibility, and stale-information risk.
- MCP 2025-11-25 current spec, 2026 roadmap, tool-annotation risk post, 2026-07-28 release candidate, and SEP-2567 explicit state handles: protocol state is becoming more addressable, but annotations and handles remain untrusted evidence until substrate admission.
- Faraj/Xiao fast-response coordination, Bigley/Roberts incident command, Endsley situation awareness, Lewis TMS field measure, Hsu et al. IS development TMS, and AHRQ handoff safety: PM state-review artifacts need expertise owner, source steward, authority/escalation owner, handoff condition, and valid-next-action fields.

### Added on 2026-06-11 v08

- Evidence-admission replay corpus: `packages/evals/fixtures/evidence-admission-reviews.v1.jsonl` plus drift testing makes the external-evidence admission lane durable and replayable instead of only in-memory.
- OCELOT: trajectory-level inference-leakage budgets, witness-verified declassification, sink trust, and tamper-evident budget ledgers as privacy/release-control bridge concepts.
- Finite-state vs LLM action policies in social simulations: explicit reference policies can be distorted by LLM action selection and prompt/model bias, supporting policy-transition conformance fixtures.
- Catching One in Five: production multi-turn transaction-agent judge failures expose low recall for cross-turn state, guardrail, recovery, and stale-reference defects when rubric routing is wrong.
- SkillAxe: skill documents need trigger precision, instruction compliance, fault attribution, and solution-path coverage checks before they become trusted agent policy.
- MCP latest spec, roadmap, and SEP-2567 re-check: 2025-11-25 remains the latest dated spec page, task expiry/retry/audit gaps remain active roadmap items, and SEP-2567 leaves handles as ordinary strings rather than authoritative state.
- Humans' ALMANAC and human-AI mental-model work: real PM handoffs should measure actor intent, partner intent, shared goal, and source/owner agreement rather than only synthetic handoff facets.

### Added on 2026-06-12 v09

- EvoArena/EvoMem: dynamic environments make memory patches and update histories first-class evidence; memory evolution still does not establish current authority.
- HyperTool: executable MCP-style tool wrappers can hide nested read/write dependencies unless subcall refs are captured and bound.
- AgentBeats and EpiBench: agentified assessment and deterministic scientific workflows strengthen state-defect recall, judge-routing, and intermediate artifact-gate metrics.
- TRACE correction enforcement, MemRefine, and EurekAgent: compiled user corrections, memory compression, permissions, artifacts, budgets, and human supervision are governance/environment evidence lanes.
- Schneider enforceable policies, edit automata, Clark-Wilson, and safety-progress runtime verification: blocking claims need explicit monitorability/enforceability and well-formed transaction boundaries.
- Mohammed/Klimoski/Rentsch, Bierhals/Kohler/Badke-Schaub, cognitive offloading in agile teams, POMDP task-completion updates, and CHOIR organizational memory: PM handoff/status artifacts should measure structured source/owner/dependency agreement, risk capture, and communication cost under uncertainty.

### Added on 2026-06-12 v10

- Sovereign Assurance Boundary: certificate-bound admission strengthens the next write-binding frontier with evidence digests, policy versions, revocation epochs, execution identity, and validity windows.
- Channel Fracture: scheduled/cross-agent memory and handoff writes need target-side delivery confirmation before they become admitted operational state.
- LLM-as-an-Investigator: ambiguous operational requests should collect discriminating evidence before committing to action.
- The Illusion of Multi-Agent Advantage: multi-agent workflows need role-utility and cost-per-valid-action metrics rather than assuming orchestration helps.
- STAGE-Claw and Agent System Operations: state-based final-environment verification and anomaly/root-cause/resolution lifecycle fields should extend replay artifacts and dashboards.
- Memory Control Flow Attacks and Externalization in LLM Agents: memory, skills, protocols, and harnesses are externalized infrastructure, but retrieved memory can steer tool control flow and must be admitted as an influence.
- Collaborating with AI Agents and Scaffolding Human-AI Collaboration: PM handoff protocols should measure risk capture, rework, diversity, quality, and protocol burden because human-AI scaffolding effects are mixed.

### Added on 2026-06-12 v11

- Repo-grounded certificate closure: `@pm/workflow` now rejects certificate digest drift, expired validity windows, revoked certificates, artifact mismatch, tenant/workflow mismatch, and incomplete evidence-review coverage.
- Repo-grounded replay closure: `@pm/evals` now emits deterministic admission certificate ids/digests for complete write-binding replay rows and exposes certificate counts in catalog metrics.
- Repo-grounded test correction: committed write-binding rows are re-verified against the freshly built catalog instead of trusting serialized `record.validation`.
- Repo-grounded tenant correction: the evidence-admission corpus default tenant now aligns with the ArrowHedge state-review/write-binding corpus tenant after strict replay exposed the mismatch.

### Added on 2026-06-13 v12

- Memory Poisoning Attacks / MPBench and Memory Control Flow Attacks / MEMFLOW: memory writes and reads are now explicitly treated as admission and control-flow influence surfaces, not passive recall.
- Lean4Agent and HarnessFix: trajectory/workflow verification and failure localization strengthen policy-transition and artifact-run-group metrics without replacing source-authority validation.
- M3Exam and H2HMem: multimodal and human-human interaction memory benchmarks strengthen participant/source/modality preservation for PM handoff artifacts.
- W3C Verifiable Credentials Data Model, Data Integrity, and Bitstring Status List: stronger vocabulary for issuer, proof, status, and revocation in durable admission certificates.
- MCP SEP-2260/2567/2577 and OpenTelemetry event semantic conventions: protocol correlation and receipt-event vocabulary are useful evidence lanes but remain non-authoritative until admitted.
- National Academies human-AI teaming and Google transactive-memory framing: PM substrate claims should measure calibrated shared understanding, role knowledge, risk capture, and burden.

### Added on 2026-06-15 v13

- Repo-grounded memory taxonomy closure: `@pm/agent-state` now distinguishes `memory_write` from `memory_retrieval` and adds source channel, intended use, influence kind, and override status facets.
- Repo-grounded replay closure: `@pm/evals` now carries hidden-instruction memory write, clean preference memory write, and overridden tool-routing memory retrieval fixtures, plus memory influence metrics.
- Fresh source checks on MPBench and MEMFLOW keep the memory-write/admission and memory-read/control-flow bridge High for risk taxonomy while preserving preprint and implementation-scope limits.
- GitHub Copilot control-plane, GitHub availability, OpenAI/Ona, and AWS AgentCore official sources strengthen the persistent-runtime and provider-policy context without promoting vendor state to substrate authority.
- National Academies human-AI teaming and Google transactive-memory framing remain the PM bridge: memory governance should preserve source/channel/role/override status and be judged by risk capture, rework, and burden.

### Added on 2026-06-16 v14

- GitHub's June 15 Copilot usage-metrics update sharpened the telemetry gap: server-side confirmation can improve coverage while still lacking richer per-surface/per-feature detail.
- AWS AgentCore's current June notes keep widening persistent runtime/session/workflow surfaces through interactive shells, harness embedding, and stateful gateway sessions.
- OpenAI's June 14 partner-network news extends governance/distribution surfaces without changing the operational-state proof boundary.
- Repo-grounded receipt closure: `@pm/agent-state` now distinguishes `target_receipt` from generic telemetry, and `@pm/evals` now carries dispatch-only and applied receipt fixtures plus receipt-status metrics.

### Added on 2026-06-16 v15

- W3C Bitstring Status List v1.0 and Verifiable Credentials Overview strengthened the durable status-store frontier: evidence issuer, status authority, status purpose, validity period, revocation, suspension, refresh, and privacy/correlation concerns are separate from initial evidence admission.
- MCP draft statelessness and SEP-2663 Tasks Extension strengthened the addressability-vs-authority correction: explicit state handles and task IDs are lookup keys for status/result checks, not operational state.
- OpenTelemetry event semantics and span-event migration guidance strengthened the receipt/status event-shape requirement: evidence events need stable names, attributes, timestamps, and schema-drift handling.
- STAGE-Claw and STATE-Bench strengthened final-state verification metrics: receipt-backed writes still need refreshed persistent-state checks.
- PABU and Belief Memory strengthened the partial-observability bridge while preserving the implementation boundary: learned belief/memory can guide agents, but pm-substrate should enforce status/currentness with existing runtime evidence.

### Added on 2026-06-19 v16

- Runtime Compliance Verification for AI Agents / C-Trace strengthened the bridge from post-hoc traces to runtime compliance checks: constraints should be represented and checked in the execution path before side effects.
- Formal Modeling of LLM Agents' Context strengthened typed context modeling: a prompt/context window is not a substitute for `currentStateView`, observation contract, and terminal transition semantics.
- Searching for Synergy in Shared Workspace Human-AI Collaboration and Formalising Human-in-the-Loop strengthened the PM burden/oversight correction: shared state and human approval need role/status scaffolding, not generic dashboard exposure.
- ToolGate strengthened the contract-gated execution bridge: preconditions and postconditions should gate tool invocation and state commits, which maps to terminal outcome partitioning for ArrowHedge decisions.
- Local June 18 ArrowHedge bridge and dashboard audits added repo-grounded evidence: seeded stale actions were detected, but pre-fix events could emit both accepted and blocked outcomes for the same decision. This corrects the claim boundary from "block observed" to "block is terminal."

### Added on 2026-06-25 v18

- Peer-reviewed terminal-normal-form sources: Herlihy/Wing linearizability, Winskel event structures, Schneider state-machine replication, Clark-Wilson integrity policy, Kung/Robinson OCC, Cahill/Rohm/Fekete SSI, and Ongaro/Ousterhout Raft.
- Peer-reviewed obstruction/currentness/projection sources: Abramsky/Brandenburger sheaf gluing, Shapiro CRDTs, Dynamo version conflicts, Gray/Cheriton leases, Spanner uncertainty/currentness, Buneman/Khanna/Tan provenance, event-sourced observability, Star/Griesemer boundary objects, Lewis transactive memory, Garcia/Prett/Morari MPC, and ACL LoCoMo.
- Repo-grounded code slice: `@pm/agent-state` now exposes pure `ActionOutcomeEnvelope`, local-view obstruction evaluation, action outcome role projections, terminal partition validation, and substrate-ref recovery helpers.

### Added on 2026-06-25 v19

- RQ11 answered from Schneider state-machine replication, Clark-Wilson integrity policy, Herlihy/Wing linearizability, and Kung/Robinson OCC: terminal partitioning generalizes beyond pure arrays only when operational writes are downstream of a single well-formed admission boundary.
- Repo-grounded eval wiring: `@pm/evals` now recognizes `action_outcome_envelope`, Axis A has a terminal-partition paired scenario requiring that ref, Axis C substrate scaffold events cite outcome envelopes, and Axis B can emit an explicit blocked eval for the missing PluggedInSocial/fixture blocker.

### Added on 2026-06-25 v20

- RQ21 answered from the same enforcement-boundary papers plus repo inventory: every write-capable transport in the fixture coverage set still lacks a pre-side-effect `ActionOutcomeEnvelope` provider.
- Repo-grounded coverage update: `@pm/evals` now tracks outcome-envelope required, covered, missing, coverage rate, and missing transport ids in `analyzeWriteTransportBindingCoverage()`.
- Replay-corpus correction: write-binding replay artifact hashes now match the committed ArrowHedge state-review artifact corpus again, restoring catalog replay consistency.

### Added on 2026-06-25 v21

- RQ22 answered from Schneider state-machine replication, Clark-Wilson integrity policy, Herlihy/Wing linearizability, and Kung/Robinson OCC: the smallest repo boundary is the workflow evidence-binding gate immediately before write-capable dispatch.
- Repo-grounded runtime update: `@pm/workflow` now builds accepted/blocked `InvocationActionOutcomeEnvelope` records at that gate and passes accepted envelopes into dispatcher contexts.
- Repo-grounded coverage update: `@pm/evals` fixture write transports now report 4/4 outcome-envelope provider coverage, while still keeping evidence-binding/provider/verifier coverage separate.

### Added on 2026-06-25 v22

- RQ23 answered from Schneider state-machine replication, Clark-Wilson integrity policy, Herlihy/Wing linearizability, and Kung/Robinson OCC: the workflow runtime envelope remains the terminal source of truth; agent-state promotion wraps and cites it rather than recomputing a second terminal claim.
- Repo-grounded promotion update: `@pm/agent-state` now exposes `promoteWorkflowInvocationOutcomeEnvelope()`, and `action_outcome_envelope` is also a `StateRefKind`.
- Repo-grounded replay update: ArrowHedge write-binding replay records now carry canonical promoted `ActionOutcomeEnvelope` proof packets and metrics count accepted vs blocked envelopes.

### Added on 2026-06-25 v23

- RQ24 answered from ARIES, Buneman/Khanna/Tan provenance, Chandy/Lamport snapshots, and Garcia-Molina/Salem sagas: EvalEvents should carry stable refs while replay recovers and verifies terminal envelopes from durable proof packets.
- Repo-grounded replay update: `@pm/evals` now exposes `ActionOutcomeEnvelopeReplayIndex`, `recoverActionOutcomeEnvelopeFromReplayIndex()`, and `analyzeEvalEventActionOutcomeReplay()`.
- Axis A update: the ArrowHedge terminal-partition EvalEvent ref is now derived from the write-binding replay corpus and resolves to a hash-valid blocked terminal envelope.

### Added on 2026-06-25 v24

- RQ25 answered from ARIES, Buneman/Khanna/Tan provenance, Chandy/Lamport snapshots, and Garcia-Molina/Salem sagas: promoted terminal packets need a live hash-gated store keyed by the same `action_outcome_envelope` refs that EvalEvents cite.
- Repo-grounded persistence update: `evals.action_outcome_envelope_packets` now exists in root and package-local migrations.
- Repo-grounded store update: `PostgresEvalEventStore` can persist hash-valid action outcome envelope packets, reject conflicting packet hashes, and recover terminal packets by EvalEvent substrate ref.

### Added on 2026-06-25 v25

- RQ26 answered from Paxos Made Live, ARIES, Chandy/Lamport snapshots, and Garcia-Molina/Salem sagas: Axis C should generate terminal packets at the runtime admission/refusal boundary and persist them before EvalEvents cite those refs.
- Repo-grounded scaffold update: `runLocalLabPairedEvals()` now returns canonical hash-valid `ActionOutcomeEnvelope` packets aligned with local-lab substrate EvalEvent refs.
- Repo-grounded dynamic-engine update: `@pm/local-agent-lab` now builds `ActionOutcomeEnvelope` packets for admitted/refused arm runs and exposes them on run results.

### Added on 2026-06-25 v26

- RQ27 answered from PASS, workflow provenance views, Provenance-To-Use repeatability, and Distributed Time-aware Provenance: dynamic arm runs should become queryable EvalEvent views over runtime provenance while terminal packets remain the proof objects and are persisted before events.
- Repo-grounded dynamic eval update: `@pm/evals` now exposes `buildDynamicLocalAgentLabEvalSuite()` and `recordDynamicLocalAgentLabEvalSuite()`, with `live_run` evidence-stage metrics and missing-packet rejection.
- Repo-grounded live-run update: `pnpm evals:local-agent-lab:live` ran stale-observation against local Postgres/Ollama and persisted two packets plus two live EvalEvents whose packet refs resolved from the DB.

### Added on 2026-06-25 v27

- RQ28 answered from Ostrand/Balcer category-partition testing, Zhu/Hall/May coverage adequacy, Kuhn/Kacker/Lei/Hunter combinatorial testing, and Jia/Harman mutation testing: each failure class is a coverage obligation, and Axis C coverage requires a live pair that can expose the targeted fault.
- Repo-grounded coverage update: `@pm/evals` now reports `DynamicLocalAgentLabLiveCoverageReport`; a class is covered only by a protective packet-backed pair (`baseline=fail`, `substrate!=fail`) with generated `action_outcome_envelope` refs on both arms.
- Repo-grounded dynamic scenario update: `@pm/local-agent-lab` now registers all ten state-failure classes as dynamic scenarios and the registry test fails if any class is dropped.
- Repo-grounded live-run update: `pnpm evals:local-agent-lab:live` ran all ten scenarios against local Postgres/Ollama, persisted 20 packets plus 20 EvalEvents, reduced baseline failures from 10 to 0 substrate failures, and recovered all latest 20 packet refs from Postgres.

### Added on 2026-06-25 v28

- RQ29 answered from Weyuker test adequacy, Basili/Selby/Hutchens experimentation, Shull/Carver/Vegas/Juristo replication, and Santos/Vegas/Oivo/Juristo grouped-replication analysis: the full verifier must be stratified by axis and failure class, and blocked/missing strata cannot be aggregated away.
- Repo-grounded coverage update: `@pm/evals` now exports `analyzeThreeAxisCoverage()`, which reports all 30 required `(axis, failureClass)` cells with covered, verified, missing, blocked, and reason fields.
- Repo-grounded proof-boundary update: coverage means a protective paired baseline/substrate result with refs; stricter verification means a non-blocked substrate `pass` with terminal `action_outcome_envelope` refs by default.
- Repo-grounded blocked-axis test: a complete Axis C local-lab matrix no longer makes the full report complete when the Axis B marketing fixture remains blocked.

### Added on 2026-06-25 v29

- RQ30 answered from Barr/Harman/McMinn/Shahbaz/Yoo's oracle-problem survey, Leucker/Schallhart and Bauer/Leucker/Schallhart runtime-verification papers, and Utting/Pretschner/Legeard's model-based-testing taxonomy: the observed runtime outcome and the test/monitor verdict should be separate fields.
- Repo-grounded schema update: `EvalEvent` now has optional `scenarioResult` and `operationalTerminalOutcome`; terminal outcomes require `action_outcome_envelope` refs, and blocked operational results with scenario passes must name the terminal outcome.
- Repo-grounded coverage update: Axis C protective refusals now emit `result: "blocked"`, `scenarioResult: "pass"`, and `operationalTerminalOutcome: "blocked"`, and `analyzeThreeAxisCoverage()` verifies those cells through `scenarioPassPairs`.

### Added on 2026-06-25 v30

- RQ31 answered from Gotel/Finkelstein and Ramesh/Jarke traceability, Torkar/Gorschek/Feldt/Svahnberg/Raja/Kamran traceability practice evidence, and Li/Offutt model-based test oracle strategies: three-axis proof needs explicit trace links from requirements/cells to EvalEvents, oracle verdicts, and terminal proof refs.
- Repo-grounded proof-packet update: `@pm/evals` now exports `buildThreeAxisProofPacket()`, with status, source, verified-axis, blocked-axis, missing-cell, unverified-cell, blocked-cell, and terminal-proof-backed scenario-pass-cell lists.
- Repo-grounded Axis A update: ArrowHedge `actionOutcomeEnvelopes` can be arm-scoped and carry `operationalTerminalOutcome`, so paired finance events can cite terminal refs for both baseline and substrate arms when proof packets exist.

### Added on 2026-06-25 v31

- RQ32 answered from Herlihy/Wing linearizability, Clark-Wilson integrity, ARIES recovery, Buneman/Khanna/Tan provenance, and Davidson/Freire workflow provenance: verifier refs are evidence links, while the codebase primitive must admit one hash-valid terminal envelope per stable action id.
- Repo-grounded correction: `@pm/agent-state` now exports `actionOutcomeTerminalKey()` and `buildActionOutcomeTerminalIndex()`, and `admitActionOutcomeEnvelope()` rejects hash-invalid candidate envelopes before admission.
- Verifier-boundary correction: a half-built proof-packet terminal-ref validator was removed from the implementation slice; three-axis artifacts should consume substrate terminal admission rather than define it.

### Added on 2026-06-25 v32

- RQ33 answered from Clark-Wilson integrity, Kung/Robinson optimistic validation, Schneider state-machine services, and Garcia-Molina/Salem sagas: the first terminal-index consumer should be the high-consequence ArrowHedge proposal-review boundary, not the eval reporter.
- Repo-grounded finance update: `@pm/capability-finance-research-ingest` now exports `buildArrowHedgeActionOutcomeEnvelope()` and `buildArrowHedgeActionOutcomeTerminalIndex()`.
- Proof update: ArrowHedge tests now show accepted fresh action, blocked stale action, idempotent replay, and same-action terminal conflict behavior through canonical `ActionOutcomeEnvelope`s.

### Added on 2026-06-25 v33

- RQ34 answered from Parnas modular decomposition, Clark-Wilson integrity, Schneider state-machine services, and Garcia-Molina/Salem sagas: workflow should expose a narrow terminal-admission port instead of importing the canonical terminal store.
- Repo-grounded workflow update: `@pm/workflow` now exposes `InvocationActionOutcomeAdmissionPort` and related decision/request types, and `PostgresWorkflowRuntime` can fail closed on terminal admission rejection before write-capable dispatch.
- Boundary update: blocked evidence-gate envelopes are offered to admission before dead-lettering, accepted envelopes are offered before dispatch, and admission adapter failure becomes `action_outcome_admission_rejected` rather than a bypass.

### Added on 2026-06-25 v34

- RQ35 answered from Wiederhold mediation, Rahm/Bernstein schema matching, Nigam/Caswell business artifacts, Hull semantic heterogeneity, Clark-Wilson integrity, and Schneider state-machine services: Axis B should consume terminal admission through a profile-owned agency publication adapter contract, not through substrate edits or eval placeholders.
- Repo-grounded agency update: `@pm/profile-agency` now exports `AgencyPublicationAuthoritySnapshot`, `buildAgencyPublicationActionOutcomeEnvelope()`, and `buildAgencyPublicationActionOutcomeTerminalIndex()`.
- Boundary update: approved matching publication content can become an accepted terminal envelope, while revoked approvals, stale approvals, content-hash drift, or lifecycle mismatch demote requested accepted writes to blocked terminal outcomes.

### Added on 2026-06-25 v35

- RQ36 answered from component-contract, interface-automata, specification-matching, semantic-capability-matching, and runtime-verification papers: terminal-admission coverage should be discoverable from typed capability write contracts, but provider metadata is not runtime authority.
- Repo-grounded contract update: `@pm/types` now has `TerminalAdmissionProviderRef` and `WriteContract.terminalAdmissionProviders`, while `@pm/registry` exposes `listTerminalAdmissionProviderBindings()`.
- Boundary update: `@pm/capability-finance-research-ingest` advertises the real ArrowHedge action-outcome provider on its Event write contract, `@pm/profile-agency` exposes the publication provider ref, and `@pm/evals` can derive provider coverage from capability descriptors.

### Added on 2026-06-25 v36

- RQ37 answered from semantic-versioning, runtime-contract, behavioral-contract, web-service runtime-verification, and interface-automata papers: terminal-admission refs must be checked against live provider manifests before they can prove coverage.
- Repo-grounded verifier update: `@pm/registry` now exposes `verifyTerminalAdmissionProviderRef()` and `verifyTerminalAdmissionProviderBindings()`, with explicit issue codes for missing, unavailable, deprecated, version-incompatible, export-drifted, and narrower manifests.
- Boundary update: finance and agency provider manifests verify locally, while `@pm/evals` can require verified manifests before counting provider coverage.

### Added on 2026-06-25 v37

- RQ38 answered from distributed authentication, decentralized trust management, lease consistency, and certificate revocation/status papers: verified manifests should become explicit status-bearing certificates checked at dispatch time, not ambient runtime belief.
- Repo-grounded certificate update: `@pm/types` now defines `TerminalAdmissionProviderCertificate`, while `@pm/registry` can issue, digest, and validate provider certificates against subject, manifest, validity window, status, and capability/provider binding.
- Boundary update: `@pm/workflow` can now require a terminal-admission provider certificate before write-capable dispatch, pass valid certificates through admission/dispatcher context, and block missing/invalid certificates with distinct terminal envelopes and metrics.

### Added on 2026-06-25 v38

- RQ39 answered from certificate revocation/update, empirical revocation failure, scalable revocation, and key-transparency papers: immutable provider certificates need a separate, substrate-owned current-status store that dispatch code queries at decision time.
- Repo-grounded status-store update: `@pm/registry` now exports `TerminalAdmissionProviderCertificateStatusStore`, pure integrity/status-record validators, and `PostgresTerminalAdmissionProviderCertificateStore`.
- Boundary update: `@pm/workflow` can consume `actionOutcomeProviderCertificateStore` directly and passes `checkedAt` into certificate lookup, so runtime dispatch no longer requires a private in-memory certificate provider.

### Added on 2026-06-25 v39

- RQ40 answered from transaction-time database, tamper-detecting audit log, tamper-evident logging, and append-only authenticated dictionary papers: current status rows are projections, while decision-time replay needs an append-only status-event stream.
- Repo-grounded replay update: `@pm/registry` now exports `TerminalAdmissionProviderCertificateStatusEvent`, deterministic status-event hashing, replay issue/decision types, and `replayTerminalAdmissionProviderCertificateStatusAt()`.
- Boundary update: `PostgresTerminalAdmissionProviderCertificateStore` appends status events transactionally with projection updates and reconstructs `checkedAt` lookups from replay rather than trusting the latest current row.

### Added on 2026-06-25 v40

- RQ41 answered from provenance, lineage, and secure-provenance papers: workflow outputs must cite the exact source/version/proof event that justified them, not only the current object identity.
- Repo-grounded workflow update: `@pm/workflow` now defines `InvocationActionOutcomeProviderCertificateStatusRef` and carries it in provider lookup results, action outcome envelopes, admission requests, and dispatcher context.
- Boundary update: the registry-backed workflow certificate adapter derives status refs from certificate status events at `checkedAt`, and the runtime rejects status refs that do not match certificate id, digest, or decision time.

### Added on 2026-06-25 v41

- RQ42 answered from protection-system, proof-carrying authentication, decentralized information-flow, and Laminar enforcement papers: workflow status binding is bypassable unless graph mutations themselves can require checkable write-authority evidence.
- Repo-grounded graph update: `@pm/graph` now exports `GraphWriteAuthorityRef`, `GraphWriteProviderCertificateStatusRef`, `GraphWriteAuthorityPolicy`, `validateGraphWriteAuthority()`, `assertGraphWriteAuthority()`, and `GraphWriteAuthorityError`.
- Boundary update: `PostgresGraph` now has an opt-in `writeAuthorityPolicy` that rejects create/update/tombstone mutations before SQL when authority refs are missing, not accepted, missing provider status refs, revoked, or certificate-mismatched.

### Added on 2026-06-25 v42

- RQ43 answered from Clark-Wilson integrity, runtime enforcement, sagas, and edit-automata papers: capability-kit raw graph updates are transformation procedures and must check graph write authority before capability `apply` or SQL side effects.
- Repo-grounded capability-kit update: `@pm/capability-kit` now exports `GraphWriteAuthorityContext`, supports `CapabilitySpec.graphWriteAuthority`, supports `CapabilityRuntimeDeps.graphWriteAuthorityPolicy`, and carries optional `writeAuthorityRef` through apply/emit contexts.
- Boundary update: `defineCapability()` now resolves and checks graph write authority after target-row lock and before `apply`; strict authority rejection rolls back idempotency and prevents raw `UPDATE graph.nodes`.

### Added on 2026-06-25 v43

- RQ44 answered from proof-carrying authentication, secure provenance, tamper-evident logging, and transparency-log papers: graph write authority must resolve to a substrate record, not only a self-asserted ref shape.

### Added on 2026-06-25 v44

- RQ45 answered from modularity, architectural mismatch, connector, and software-aging papers: store-backed authority injection should be a structural connector plus capability runtime hook, not a new substrate/domain dependency edge.
- Repo-grounded store-binding update: `@pm/graph` now defines `GraphWriteAuthoritySubstrateRecord` and `GraphWriteAuthorityPolicy.requireSubstrateRecord`, while graph mutation inputs and capability-kit authority resolutions can carry matched substrate records.
- Boundary update: strict graph/capability policies can reject missing or mismatched substrate records before SQL/apply; real workflow/runtime adapters still need to source those records from substrate stores.

### Added on 2026-06-25 v45

- RQ46 answered from runtime-model and runtime-verification papers: scenario runners should use a store-backed monitor/resolver that rejects missing, blocked, or mismatched workflow envelopes before graph mutation.

### Added on 2026-06-25 v46

- RQ47 answered from data-provenance, lineage, and secure-provenance papers: provider certificate status refs are part of the canonical terminal packet lineage and must be recoverable after amnesiac resume.

## Corrected Claims

- v61 corrects the automation prompt's next-code frontier: executable observation reports, typed proposal reviews, replayable JSON/JSONL state-review artifacts, ArrowHedge fixture families, assertion metrics, mutation-claim boundaries, and DB/fixture equivalence helpers already exist on the current branch. The next code slice is not to rebuild them; it is to add a packet-backed `representation_loss` Axis A family.
- v02's open items for `subject_mismatch`, original-observation review, `evaluatedAt`, explicit advisory/blocking mode, and evidence maturity stages are now treated as closed pure primitives after local code/changelog inspection.
- `StateReviewArtifact` is no longer future work: pure construction, ArrowHedge generation, related objects, PROV-style links, trace context, canonical hash verification, tamper detection, and artifact metrics exist.
- Persisted/golden JSON artifacts remain open: current tests build artifacts in memory, and no stable artifact export/import path was found.
- Trace correlation is partial: artifacts carry optional trace context and metrics count coverage, but there is no full join across source reads, projection, proposal review, eval event, and downstream write.
- Socio-technical congruence was downgraded from broad project-quality predictor to bounded coordination diagnostic after adding mixed/negative longitudinal evidence.
- ContractBench and STALE source-code/data availability remains a source gap until direct official repo/dataset links are located.
- Research automation must now treat `research/index.md` as the shared ledger and update it after pulling `main`.
- v05 corrects the temporal-state claim: current ArrowHedge review primitives primarily prove observation-to-action validation; action-to-feedback and feedback-to-observation drift need explicit artifact stages and fixtures.
- v05 corrects the semantic-consensus bridge: typed commit/abort protocols are useful as provenance and finality vocabulary, not as source authority.
- v05 keeps v04's artifact-lifecycle gap open: no persisted/exported ArrowHedge JSON artifact corpus or artifact-to-eval-event linkage was found.
- v06 corrects v05's implementation frontier: durable artifacts, artifact-to-eval refs, observed read-set comparison, temporal misalignment fixtures, DB/fixture equivalence, and invariant-class policy are now closed pure primitives.
- v06 narrows the next frontier from "more artifact lifecycle" to external evidence admission: protocol task state, memory retrieval, monitoring events, world-model predictions, lineage, audit, and PM handoff artifacts must be validated before action.
- v06 keeps mutation blocking limited: invariant policy now reports recommendations, but external side-effect enforcement remains unclaimed.
- v07 confirms v06's implementation correction against current code: observation reports, action proposal reviews, durable artifacts, temporal ArrowHedge corpora, artifact-derived metrics, DB/fixture equivalence, and policy `wouldBlock` outputs are existing pure primitives rather than the next code slice.
- v07 corrects the external-state frontier: MCP explicit state handles and shared-context MAS designs strengthen addressability, but the missing pm-substrate mechanism is admission-time validation before evidence becomes a `StateRef` or action-review input.
- v07 adds memory deletion and observability as state-review concerns: memory retrieval should carry deletion mode/residue risk, retention policy, online-observable feature boundaries, source modality, and stale-information risk.
- v07 adds professional workflow consistency as an eval axis: stage omission, objective drift, error propagation, and environment drift should be detected across artifact run groups, not only final outcomes.
- v08 narrows the remaining golden-artifact gap: evidence-admission reviews now have a committed replay corpus and drift test; the still-open on-disk corpus gap is ArrowHedge artifact persistence, not admission-review persistence.
- v08 corrects the broader frontier: external evidence admission is now durable as a pure/replayable lane, while runtime evidence-action binding, release budgets, policy-transition conformance, state-defect recall, skill-document admission, live MCP revalidation, and real-run PM handoff agreement remain open.
- v08 corrects the MCP status wording: the official spec page still shows 2025-11-25 as latest on 2026-06-11, while SEP-2567 is an official SEP; handles remain ordinary tool strings and explicit handle marking is left to future work.
- v09 corrects v08's ArrowHedge persistence frontier: the ArrowHedge state-review artifact JSONL corpus is now committed and drift-tested.
- v09 corrects v08's runtime evidence-action frontier: an opt-in workflow write-binding gate, write-binding replay corpus, explicit policy-block handling, and catalog verifier now exist; the remaining gap is durable verification stores and adoption by every external write transport.
- v09 corrects dashboard language: the substrate dashboard is a replay monitor over committed corpora, not proof of live operational telemetry.
- v10 corrects v09's recommended next slice: fixture-backed `EvidenceBindingReferenceCatalog` construction and write-transport coverage metrics now exist on `main`; durable DB/substrate-store-backed verification, certificate/revocation semantics, and all-real-transport adoption remain open.
- v11 partially closes v10's certificate/revocation frontier in the replay/catalog lane: certificate ids/digests, policy version, revocation epoch, execution identity, validity window, tenant/workflow, artifact hash, and evidence-review coverage now verify in code.
- v11 corrects an implementation proof gap: stored JSONL validation is not sufficient; tests now recompute decisions against the constructed catalog.
- v11 corrects a cross-corpus fixture bug: evidence-admission reviews, ArrowHedge state-review artifacts, and write-binding replay records now share the ArrowHedge tenant for strict replay.
- v12 keeps v11's certificate claim scoped: deterministic replay certificate refs are useful proof artifacts, but W3C credential/status sources strengthen the need for durable issuer/status/revocation checks before production authority claims.
- v12 strengthens v10/v11 memory-control claims: memory writes and retrieved memory influence are distinct surfaces, so memory-as-fact, memory-as-preference, memory-as-instruction, and memory-as-tool-routing must not be collapsed.
- v12 corrects dispatch wording: successful workflow dispatch or log emission should be treated as an attempted write until the target channel emits an admitted receipt.
- v13 partially closes v12's memory frontier: replayable evidence admission now distinguishes `memory_write` from `memory_retrieval`, classifies memory influence, and warns when control-surface memory lacks or violates override metadata; live memory-store/runtime enforcement is still open.
- v13 keeps memory safety scoped: replay warnings are not durable memory status/deletion proof, not poisoned-memory denial, not write-binding consumption of memory influence, and not final target-state confirmation.
- v13 corrects persistent-runtime framing: long-running cloud environments and provider controls are market/context evidence, not operational-state authority.
- v16 corrects the local live-bridge proof boundary: an emitted `workflow.blocked.stale_state` event is not itself proof that a stale decision was suppressed. Terminal outcome partitioning must prove accepted/blocked/rejected/held are mutually exclusive for a stable decision id.
- v16 keeps the June 18 bridge scoped as local/uncommitted evidence until those implementation files, experiment outputs, and dashboard semantics are published on `main`.

## Downgraded Claims

- v61 downgrades fluent summaries, shared context, and user/team mental-model calibration as state proof. They can improve coordination or diagnosis, but they do not prove that invariant source fields survived projection into `CurrentStateView`, `StateReviewArtifact`, and `ActionOutcomeEnvelope`.
- RAG-only state claims are downgraded: retrieval helps access but does not supply authority, invalidation, workflow validity, or mutation safety.
- Continuous memory consolidation is rejected as a safe default until gated by raw evidence and regression tests.
- Synthetic eval pass claims are downgraded to scaffold/provisional until outcomes are derived from executable assertions or observed behavior.
- Trace context is downgraded as authority: it provides correlation, not validity or permission.
- Standards are structure, not proof. PROV, Trace Context, CloudEvents, HTTP/OAuth standards, ISO 21502, and OCEL describe useful metadata, but pm-substrate still needs executable validation.
- Research files are downgraded as durable shared memory unless backed by fetch/merge/push discipline and the top-level ledger.
- Semantic consensus is downgraded as an authority mechanism unless backed by substrate source refs, tenant/subject checks, workflow position, and read-set validation.
- Memory belief-clarity metrics are downgraded as operational-state proof; they diagnose summary quality but do not establish currentness or authority.
- Proactive hidden-problem discovery is downgraded as direct action; findings should become evidence-linked warnings/proposals first.
- MCP/task/tool protocol metadata is downgraded as operational truth; it is useful evidence only after substrate admission.
- World-model predictions are downgraded as current-state proof; they are advisory prediction/eval artifacts until reconciled with observed authoritative state.
- Memory-search trust scores are downgraded as authority; memory remains a control channel that requires source, subject, freshness, and workflow validation.
- Boundary objects are downgraded as agreement proof unless invariant fields and agreement metrics show cross-role convergence.
- Shared verified context is downgraded as authority unless every write has admission status, source refs, freshness, read/write discipline, and invalidation semantics.
- Active/distributed/observability-safe memory is downgraded as operational-state proof; it improves retention and reasoning cost tradeoffs but cannot establish authority, deletion fidelity, or currentness alone.
- Memory taxonomy is downgraded as a complete memory-safety solution; v13 proves pure admission/replay warnings only, while durable store currentness, deletion fidelity, write binding, and target receipts remain open.
- Persistent agent environments are downgraded as authority; persistence and session continuity are useful capabilities but still require source, freshness, workflow, and receipt checks.
- MCP 2026-07-28 release-candidate semantics are downgraded as current behavior until the final dated spec ships; they are useful design direction, not current protocol truth.
- Multi-agent consensus remains downgraded after Consistency Illusion: answer agreement can hide incompatible grounds unless claims cite sources and stances.
- Long-horizon benchmark final success rates are downgraded as sufficient state proof; pm-substrate needs intermediate artifact-sequence assertions for omitted stages and objective drift.
- Per-evidence privacy checks are downgraded as sufficient privacy proof; agent releases can leak cumulatively across a trajectory and sink set.
- LLM-as-judge agreement is downgraded as eval quality unless recall is measured against state-failure classes and gate-routing errors.
- Skill self-refinement is downgraded as governance; skills remain instruction artifacts until version, trigger, scope, and fault coverage are admitted.
- Fresh admitted evidence is downgraded as policy conformance; explicit workflow/policy transitions still need validation.
- Self-attested evidence bindings are downgraded as mutation safety; catalog verification and durable store checks are required before broad governance claims.
- Executable tool wrappers are downgraded as clean abstraction when they hide nested subcall dependencies from observed read-set capture.
- Memory compression/evolution is downgraded as state validity unless source refs, supersession, patch lineage, and deletion residue remain replayable.
- Agentified judges are downgraded as operational gates until state-defect recall and routing misses are measured against deterministic fixtures.
- Artifact completeness is downgraded as PM handoff success unless risk capture, owner/source convergence, valid-next-action agreement, and rediscovery cost improve on real traces.
- Dispatch success is downgraded as delivery proof unless the target memory/task/handoff channel emits a replayable target-side confirmation.
- Memory retrieval is downgraded as passive context when it changes tool choice or action ordering; it becomes a control-flow influence requiring admission.
- Multi-agent orchestration is downgraded unless marginal role utility is measured against cost and single-agent baselines.
- PM scaffolding is downgraded as an automatic good; protocol burden, quality, rework, and diversity must be measured.
- Credential standards are downgraded as direct authority; they provide issuer/proof/status/revocation shape, while pm-substrate must still verify tenant, subject, workflow, policy, source, and current state.
- Memory benchmark accuracy is downgraded as safety proof; recall and reasoning scores do not cover poisoning, control-flow steering, or valid-action governance.
- Formal workflow verification is downgraded as source truth; it verifies modeled assumptions and transition semantics, not whether the evidence is current or authoritative.
- Observability receipts are downgraded as authorization; target events can prove receipt/visibility, not valid permission to write.
- Status-rich credentials are downgraded as direct production authority; they provide vocabulary for issuer/status/revocation/currentness, but pm-substrate still needs substrate-owned authority mapping and decision-time checks.
- MCP task handles and explicit state handles are downgraded as durable truth; they are references that require admitted status/result lookup.
- Belief-state or memory-model improvements are downgraded as substitutes for status checks; they estimate hidden state under partial observability but do not verify current operational authority.
- Block-event counts are downgraded as enforcement proof unless the action lifecycle suppresses the competing action and the dashboard can reconcile proposed -> terminal outcome counts.
- Shared-workspace UX is downgraded as PM coordination proof unless role clarity, owner/source agreement, stale status handling, rework, and protocol burden are measured.

## Rejected Bridges

1. Model weights as operational memory.
2. Bigger context window as a state solution.
3. RAG-only state layer.
4. Continuous memory rewrite as default improvement.
5. Protocol-only interoperability.
6. Chat transcript as common operating picture.
7. LLM semantic mapping as direct authority.
8. Biological quorum/stigmergy as direct business authority proof.
9. More agents as proof of better coordination without normalized evals.
10. Research files as durable memory without fetch/merge/push discipline.
11. External protocol task state as direct business authority.
12. Tool or memory trust metadata as a replacement for source authority.
13. World-model predicted state as current operational state.
14. Shared context without admission-time verification.
15. Explicit protocol state handles as current operational state.
16. Memory retention policy as deletion proof without residue checks.
17. Multi-agent answer consensus as reasoning or source-authority alignment.
18. External evidence admission as runtime mutation enforcement.
19. Individual redaction checks as complete trajectory privacy protection.
20. Automated judge agreement as cross-turn state-defect coverage.
21. Fixture admission certificates as production signing authority.
22. Dispatch success as target-side delivery proof.
23. Memory recall benchmark success as safe memory governance.
24. Target receipts as final-state verification.
25. MCP task IDs as current task authority.
26. W3C status-list vocabulary as a mandate to become a VC platform.
27. Block-event emission as mutation enforcement when an accepted event can still coexist for the same action id.

## Current Implementation Implications

1. Promote write binding from selected opt-in workflow paths to a transport-wide invariant for every external write-capable capability path.
2. Promote fixture-backed certificate verification into durable verification stores for state-review artifact ids/hashes, evidence-admission review ids, tenant/workflow binding, rejected-evidence policy disposition, policy version, revocation epoch, execution identity, and validity window.
3. Keep MCP-like task/tool annotations and explicit state handles in the admission lane; prove the same rules against live protocol/runtime handles, not only pure fixtures.
4. Capture nested tool-wrapper subcall read/write refs so executable wrappers do not bypass observed read-set validation.
5. Add memory patch, supersession, and compaction artifacts with source refs, deletion residue, and replay fidelity.
6. Treat skill documents and compiled user-correction rules as external governance evidence; start with owner, trigger, scope, version, source, and fault-coverage fixtures.
7. Classify invariants as pre-write enforceable, compensation-enforceable, monitorable-only, or offline-audit before presenting policy gates as blocks.
8. Add trajectory release-budget fixtures with sink trust, data class, cumulative budget, release atoms, and declassification reason.
9. Add explicit policy-transition conformance fixtures where fresh admitted evidence supports a fact but the proposed workflow transition is invalid.
10. Add LLM-judge recall metrics for stale referents, stale owner/blocker, confirm-gate lockout, recovery/escalation failure, workflow-phase mismatch, and guardrail defects.
11. Run `comparePmHandoffAgreement` over real multi-agent ArrowHedge or automation runs and compare against rediscovery cost and time-to-valid-action.
12. Keep the dashboard claim boundary honest: static replay monitor now, live governance only after live stores/subscriptions feed it.
13. Make every daily research automation pull or remotely verify `main`, inspect new research/code, update the relevant chain-specific index and top-level `research/index.md`, commit, and push.
14. Add pure `EvidenceStatusCheck` semantics before building a durable store: status authority, status purpose, checked-at time, validFrom/validUntil, status list/ref, stale policy, and privacy/correlation note.
15. Feed status checks into replay certificates, target receipts, and MCP task handles before claiming live mutation governance.
16. Add final-state verification fixtures only after status semantics are stable enough to distinguish valid, revoked, suspended, refresh-required, failed, stale, and superseded evidence.
17. Add target-side delivery confirmation for scheduled/subagent/memory/PM handoff writes before admitting them as shared operational state.
18. Add memory-control-flow fixtures that distinguish memory used as evidence from memory used as instruction or tool-routing influence.
19. Measure multi-agent role utility and PM protocol burden before expanding orchestration or handoff scaffolding.
20. Promote replay certificates into a durable status source with issuer, proof, revocation, status checked-at, policy version, validity window, tenant/workflow, and execution identity.
21. Preserve participant, role, modality, source artifact, conflict, and unresolved-risk fields in PM handoff memory rather than flattening into summaries.
22. Add small deterministic policy-transition specs before broad formal workflow verification.
23. Use `analyzeThreeAxisCoverage()` as the current matrix gate: fill Axis A missing classes and terminal proof refs, keep Axis B blocked until PluggedInSocial or accepted fixtures exist, and do not treat Axis C completeness as full verification.
24. Make dashboard metrics query-traceable and lifecycle-aware: stale blocks should be a gate-failure cause, not a separate double-counted KPI.
25. Answer RQ42 by extending provider-certificate status-ref binding to non-workflow graph/capability write boundaries so direct writes cannot bypass workflow action-outcome currentness proof.
26. Answer RQ72 by implementing `representation_loss` as projection-admission failure: define ArrowHedge invariant fields, produce an obstruction or representation-loss issue when a role/local projection drops them, and add paired baseline/substrate packets to the Axis A source-bundle path.
27. Adopt the SQ15 ledger-backed root witness in real write paths so witnessed roots and obstructions survive amnesiac resume, process restart, and independent monitor comparison.
28. Adopt the SQ16 root-witness settlement primitive at real write gates so merely witnessed roots cannot satisfy strict settled-root policies.
29. Adopt the SQ17 witness-authority topology primitive at real write gates so raw witness ids cannot satisfy strict settlement policies.
30. Adopt the SQ18 durable authority-transition and settlement-certificate stores in strict runtime paths so synthetic topology or settlement objects cannot satisfy settlement policy.
31. Adopt the SQ19 settled-root write gate in real Axis A/C runner paths so durable settlement proof is required before graph/capability mutation.
32. Adopt SQ35 tombstone-head witness ledgers in runtime recovery paths so pruned-store continuity never gets `requiredTombstoneStoreHead` from memory or adapters.
33. Adopt SQ36 tombstone-head witness quorum topology in runtime recovery paths so one observer cannot unilaterally certify tombstone currentness.
34. Adopt SQ37 tombstone-head witness authority-transition stores in runtime recovery paths so quorum topology is recovered from durable substrate history.
35. Adopt SQ38 tombstone-head authority epoch seals in runtime recovery paths so later topology transitions cannot retroactively change historical tombstone-head certifications.
36. Adopt SQ39 signature-bound tombstone-head witness identity in runtime recovery paths so unsigned or wrong-key tombstone-head observations and seals cannot authorize pruning currentness.
37. Adopt SQ40 durable tombstone-head quorum-certificate records in runtime recovery paths so accepted witness signatures and authority epoch seals are recovered as proof objects rather than transient recertification results.
38. Adopt SQ41 tombstone-head witness key-status replay in runtime recovery paths so revoked or superseded tombstone-head keys cannot authorize pruned-store currentness.
39. Adopt SQ45 tombstone-head pruning tombstone APIs in runtime recovery paths so actual row absence is accepted only after durable tombstone replay and retained-suffix continuity checks.
40. Adopt SQ46 tombstone-head pruning tombstone-store head currentness in runtime recovery paths so replay-valid but missing, stale, forked, unwitnessed-advance, or hash-invalid tombstone histories cannot authorize pruned projections.
41. Adopt SQ47 durable pruning tombstone-store head witness ledgers in runtime recovery paths so pruned-store continuity derives `requiredPruningTombstoneStoreHead` from replayed witness history rather than memory, adapters, or connector caches.
42. Adopt SQ48 pruning tombstone-store head witness quorum certificates in strict runtime recovery paths so one observer cannot unilaterally certify required pruning tombstone-store head currentness.
43. Adopt SQ49 durable pruning tombstone-store head witness authority-transition stores in runtime recovery paths so certified required-head recovery gets topology from admitted store replay.
44. Adopt SQ50 signature-bound pruning tombstone-store head witness identity in runtime recovery paths so unsigned or wrong-key persisted evidence cannot certify required heads.
45. Answer SQ65 by adding proof-preserving compaction checkpoints for pruning tombstone history-store head witness ledgers, authority/key/seal history, and quorum-certificate records so replay can recover after pruning without trusting summaries.

## Metrics Queue

- `observation_contract_violation_rate`
- `expired_artifact_use_rate`
- `artifact_integrity_failure_rate`
- `implicit_conflict_detection_rate`
- `premise_resistance_rate`
- `memory_regression_rate`
- `episode_trace_coverage`
- `summary_replay_fidelity`
- `stale_read_rejection_rate`
- `false_block_rate`
- `state_assertion_pass_rate`
- `pass5_reliability`
- `audit_log_coverage`
- `owner_resolution_time`
- `action_after_rebase_success_rate`
- `artifact_generation_rate`
- `review_artifact_generation_rate`
- `review_replay_fidelity`
- `artifact_hash_mismatch_rate`
- `trace_join_coverage`
- `orphan_review_rate`
- `object_role_coverage`
- `wrong_object_action_rate`
- `assertion_failure_by_code`
- `warning_assertion_alignment_rate`
- `subject_mismatch_detection_rate`
- `synthetic_eval_pass_count`
- `scaffolded_scenario_count`
- `detected_warning_count`
- `blocked_mutation_count`
- `db_fixture_equivalence_rate`
- `coordination_congruence_gap`
- `dependency_owner_resolution_time`
- `shared_state_convergence_rate`
- `persisted_artifact_count`
- `artifact_schema_validation_rate`
- `artifact_export_import_fidelity`
- `artifact_to_eval_event_link_rate`
- `observed_read_set_coverage`
- `undeclared_read_dependency_rate`
- `multi_object_precondition_coverage`
- `holder_binding_failure_rate`
- `signature_integrity_failure_rate`
- `warning_evidence_link_rate`
- `coordination_cost_per_correct_action`
- `coordination_requirement_precision`
- `salient_event_agreement`
- `artifact_linked_checkpoint_rate`
- `research_sync_delta_count`
- `research_claim_ledger_update_count`
- `research_merge_conflict_resolution_count`
- `temporal_misalignment_phase_coverage`
- `observation_to_action_stale_rate`
- `action_to_feedback_drift_rate`
- `feedback_to_observation_revalidation_rate`
- `constraint_repeated_violation_rate`
- `progressive_constraint_resolution_rate`
- `common_understanding_delta`
- `expertise_owner_resolution_rate`
- `handoff_revalidation_success_rate`
- `external_evidence_admission_rate`
- `external_evidence_denial_rate`
- `external_evidence_warning_by_code`
- `external_evidence_warning_by_severity`
- `capability_annotation_policy_mismatch_rate`
- `explicit_state_handle_revalidation_rate`
- `memory_search_trust_boundary_violation_rate`
- `memory_deletion_residue_rate`
- `offline_supervision_leak_rate`
- `stale_information_retention_rate`
- `wait_condition_reaction_time`
- `premature_contact_rate`
- `no_op_false_action_rate`
- `workflow_stage_omission_rate`
- `objective_drift_warning_rate`
- `world_model_prediction_disagreement_rate`
- `prediction_to_observation_revalidation_rate`
- `provenance_authorization_alignment_rate`
- `unauthorized_parameter_source_detection_rate`
- `trajectory_hypothesis_verification_rate`
- `cross_artifact_failure_localization_rate`
- `artifact_run_group_failure_localization_rate`
- `lineage_facet_coverage`
- `dataset_source_version_coverage`
- `multi_actor_audit_conflict_rate`
- `expected_actor_audit_coverage`
- `boundary_object_reinterpretation_gap`
- `reasoning_alignment_missing_rate`
- `grounded_claim_coverage`
- `dependency_structure_agreement`
- `team_sa_alignment_delta`
- `handoff_condition_resolution_rate`
- `pm_handoff_condition_stale_rate`
- `escalation_owner_resolution_rate`
- `write_without_admission_review_rate`
- `admission_to_write_link_rate`
- `trajectory_leakage_budget_exceeded_rate`
- `least_disclosing_release_rate`
- `policy_transition_deviation_rate`
- `prompt_induced_action_bias_rate`
- `state_defect_recall`
- `judge_routing_miss_rate`
- `skill_trigger_false_positive_rate`
- `skill_version_drift_warning_rate`
- `handle_revalidation_rate`
- `expired_handle_use_rate`
- `handoff_goal_alignment_rate`
- `partner_intent_resolution_rate`
- `time_to_valid_action_after_handoff`
- `write_binding_catalog_verification_rate`
- `write_transport_binding_coverage`
- `action_outcome_envelope_provider_coverage`
- `missing_action_outcome_envelope_transport_count`
- `unverified_binding_block_rate`
- `subtool_read_set_coverage`
- `hidden_subcall_dependency_rate`
- `memory_patch_replay_fidelity`
- `memory_compaction_source_ref_coverage`
- `compiled_rule_scope_violation_rate`
- `skill_policy_binding_rate`
- `invariant_enforcement_capability_coverage`
- `release_budget_exceeded_rate`
- `pm_risk_capture_rate`
- `handoff_time_to_valid_action`
- `status_reannouncement_stability`
- `admission_certificate_verification_rate`
- `revocation_epoch_miss_rate`
- `channel_confirmation_coverage`
- `silent_delivery_failure_rate`
- `memory_steered_tool_rate`
- `memory_control_override_block_rate`
- `clarification_before_write_rate`
- `premature_diagnosis_block_rate`
- `agent_role_utility_rate`
- `state_verification_program_pass_rate`
- `artifact_to_final_state_consistency`
- `anomaly_root_cause_link_rate`
- `resolution_evidence_coverage`
- `protocol_burden_cost`
- `handoff_rework_rate`
- `output_diversity_collapse_rate`
- `durable_certificate_status_verification_rate`
- `revoked_certificate_escape_count`
- `certificate_status_checked_at_coverage`
- `target_receipt_coverage`
- `dispatch_without_receipt_rate`
- `receipt_to_final_state_consistency`
- `memory_write_admission_rejection_rate`
- `poisoned_memory_persistence_rate`
- `memory_influence_kind_coverage`
- `policy_transition_program_pass_rate`
- `invalid_transition_block_rate`
- `failure_layer_localization_rate`
- `participant_source_role_coverage`
- `handoff_conflict_preservation_rate`
- `risk_capture_delta`
- `memoryWriteCount`
- `memoryControlInfluenceCount`
- `memoryInfluenceKinds`
- `memory_write_metadata_coverage`
- `poisoned_memory_admission_escape_count`
- `memory_backed_write_binding_coverage`
- `override_escape_count`
- `evidence_status_checked_rate`
- `stale_status_reuse_count`
- `revoked_certificate_block_rate`
- `suspended_certificate_warning_count`
- `status_authority_mismatch_count`
- `status_lookup_latency_ms`
- `status_event_schema_drift_count`
- `handle_without_status_count`
- `final_state_after_receipt_consistency_rate`
- `state_mutation_false_positive_rate`
- `rework_after_status_check_rate`
- `terminal_outcome_partition_violation_count`
- `decision_funnel_reconciliation_rate`
- `gate_failure_cause_coverage`
- `block_without_suppression_count`
- `handoff_supersession_caught_rate`

## Next-Day Watchlist

1. Add a terminal-outcome partition helper/test before durable status-store work: stale-but-agreeing ArrowHedge decisions must be proposed + blocked, not accepted + blocked.
2. Implement the smallest pure `EvidenceStatusCheck` type and attach it to the terminal decision envelope, `InvocationEvidenceBinding`, replay certificates, target receipts, MCP task handles, and PM handoff acknowledgements.
3. Add valid, revoked, suspended, refresh-required, stale, failed, superseded, and authority-mismatch replay cases.
4. Add status authority mismatch warnings before claiming any production certificate/status authority.
5. Make dashboard metrics query-traceable and reconciled: proposed = accepted + rejected + blocked + held for a defined decision set.
6. Inspect `@pm/workflow` and `@pm/evals` for the smallest store-like abstraction that can load certificate and receipt status without pulling in DB dependencies.
7. Re-check primary code/data availability for MPBench, MEMFLOW, Lean4Agent, HarnessFix, M3Exam, H2HMem, STATE-Bench, OCELOT, ContractBench, and STALE.
8. Exercise MCP admission against a local/live fixture server for handle expiry, annotation trust, task-result revalidation, cleanup metadata, and draft/final spec drift.
9. Capture nested tool-wrapper subcall read/write refs for HyperTool-style executable wrappers.
10. Treat skill documents and compiled corrections as external evidence in one fixture path: version, trigger precision, scope, owner, source, and fault-coverage metadata.
11. Add a trajectory release-budget fixture family inspired by OCELOT: sink trust, data class, cumulative budget, release atoms, and declassification reason.
12. Add explicit policy-transition fixtures where admitted evidence is current but the proposed workflow transition is invalid.
13. Add state-defect recall metrics for LLM judges and route/gate failures: stale referent, stale owner/blocker, confirm-gate lockout, escalation failure, workflow mismatch.
14. Run PM handoff agreement and protocol-burden metrics on real multi-agent ArrowHedge or automation runs.
15. Keep broad mutation governance unclaimed until every external write path has durable verified binding coverage, status checks, target receipt evidence, and terminal outcome partition tests.
16. Run every daily research automation through fetch or remote-SHA verification -> inspect -> integrate -> ledger -> commit -> push and record any conflict handling as substrate evidence.
17. Add the `representation_loss` packet family before the other RQ71 gaps: lossy risk/signal/decision projections should block with source-linked projection-fidelity evidence, while clean-current projections remain accepted.
18. Adopt the durable root-witness ledger in runtime paths and add quorum rules so certificate-store root observations and obstructions are replayable across process restarts, agents, and independent monitors.
19. Add witness quorum/finality semantics so a replay-certified root can be provisional, witnessed, settled, or obstructed rather than only accepted by one ledger.
