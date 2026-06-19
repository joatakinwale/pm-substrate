# Dashboard data audit — 2026-06-18 (Emmanuel: "the data doesn't make sense")

Audited the live dashboard API (`:4178/api/dashboard`) against the raw event store. The rollup math is internally consistent (per-tenant sums == headlines), BUT the **metric semantics are wrong/misleading**. Three real bugs:

## BUG 1 — "authority gate failures" and "stale blocks" are the SAME events, double-presented
- DB: `workflow.blocked.stale_state` events = 3 in `tnt_result` + 3 in `tnt_exp2` = 6 total.
- Dashboard: `gateFailures = 6` AND `staleBlocks = 6` — identical, same tenants.
- A stale block IS the gate failure; they are not independent metrics. The dashboard shows them as two separate KPI cards, implying two distinct failure modes. Investor/operator reads it as "6 gate fails + 6 stale blocks = 12 problems" when it's 6.
- FIX: either (a) make staleBlocks a *breakdown* of gateFailures ("6 gate failures, all 6 due to stale state"), or (b) drop one card. They must be visibly linked, not parallel.

## BUG 2 — the decision funnel doesn't reconcile
- Per tenant (result/exp2): `proposed=6, accepted=5, stale_blocked=3`.
- 5 accepted + 3 stale-blocked = 8 > 6 proposed. The numbers don't form a clean funnel.
- Root cause hypothesis: `accepted` and `stale_blocked` count overlapping or differently-scoped things (e.g. accepted counts a different tick window than the blocks, or a decision is both accepted-then-blocked). Needs the funnel defined: proposed -> (accepted | rejected | stale-blocked) should be mutually exclusive and sum to proposed.
- FIX: define the decision lifecycle as a strict partition and assert `accepted + rejected + blocked == proposed` in a test. Right now nothing enforces it.

## BUG 3 — `validEventCount` is not "valid events", it's a projection counter
- Dashboard "Valid events: 83" sums `cop.summary.validEventCount` across tenants. But subEvents = 263. The 83 is the COP projection's consumed-event count (signals+risk+decisions), NOT a validation pass count. The label "valid events" implies a validation verdict that isn't what's being measured.
- FIX: rename to "COP events consumed" or similar; "valid" is a claim the number doesn't support.

## What IS correct (don't lose this)
- Hash chain: 263/263 verified, genuinely intact.
- The live LLM run (`tnt_live`) decision is real and correctly stored: action=short, qty=63, confidence=0.71, reasoning="Overwhelming bearish consensus (11 of 19 agents bearish)...". Payload has full provenance (sourceSnapshotId, riskStateId, signalSourceSnapshotId). This is NOT a fixture.
- Per-ticker stale counts in the dashboard match the DB exactly (GOOG/NVDA/TSLA in result+exp2).

## Validation work this exposes (the real backlog)
1. Decision-funnel partition test (proposed = accepted + rejected + blocked).
2. Metric provenance: every dashboard number must trace to a documented query, with the label matching what it measures.
3. Distinguish gate-failure CAUSES (stale vs missing-authority vs disagreement) instead of collapsing to one "failures" count.
4. End-to-end semantic test: feed a known scenario (N proposals, K stale), assert the dashboard renders exactly those.
5. The pitool/live "real LLM" runs only have 1 tick each — too thin to trust the rates; need ≥30-tick runs before any pass-rate is meaningful (ties back to the Axis A sprint's N>=30 rule).

---

## RESOLVED 2026-06-18 23:50 — the root cause was a SUBSTRATE ENFORCEMENT HOLE, not a dashboard bug

The dashboard's irreconcilable funnel (accepted + blocked > proposed) traced to a real
substrate defect:

**The hole:** in `packages/capability-finance-research-ingest/src/arrowhedge.ts`, the
decision-acceptance gate was:
```
if (accepted === true && !hasStateDisagreement(snapshot))   // emits decision.accepted
if (hasStateDisagreement || isStale)                        // emits blocked.stale_state
```
The accept guard checked disagreement but NOT staleness. So a stale-but-agreeing decision
emitted BOTH `decision.accepted` AND `workflow.blocked.stale_state` for the same decision —
the stale protection was ADVISORY, not enforced. GOOG/NVDA/TSLA were accepted while stale-blocked.

**The fix:** accept now requires `!hasStateDisagreement && !isStale`. A stale decision can
no longer be accepted.

**Critical gotcha that hid the fix:** the substrate server imports the COMPILED `dist/` of
the capability package, NOT `src/`. Editing source had zero runtime effect until
`pnpm -F @pm/capability-finance-research-ingest run build`. Always rebuild the package dist +
restart the launchd substrate-http job after a capability source change.

**Verified (tenant tnt_fixed_*):**
- Before: GOOG/NVDA/TSLA = {accepted, proposed, blocked}  (overlap = bug)
- After:  GOOG/NVDA/TSLA = {proposed, blocked}            (blocked, NOT accepted)
- Funnel now partitions: proposed=6 = accepted=2 + blocked=3 + hold=1 (AMZN never actionable). No overlap.
- 23/23 arrowhedge tests pass with rebuilt dist.

**Compare experiment (Arm A agents-alone vs Arm B agents+substrate), through the ENFORCED gate:**
- Arm A stale-action rate: 0.60 (raw agents act on stale state 60% of actionable ticks, no gate)
- Arm B blocked rate: 1.00 (substrate caught 100% of stale ticks)
- delta_protection: 3 stale actions blocked that raw agents took
- NOT falsified. This is the falsification test for the whole thesis — and tonight it caught a real defect before the fix.

## Still TODO
- Dashboard: render the funnel as connected MEANING (proposed -> accepted/rejected/blocked one viz), each number query-traceable, relabel "valid events".
- Re-ingest/retire the OLD tenants (result/exp2/exp/pitool/live) that still carry the pre-fix accepted+blocked events, OR mark them "pre-fix" on the dashboard so the bad data isn't shown as current.
- Full substrate hole-audit: are there OTHER capability gates that emit a block event without actually suppressing the action? (same advisory-vs-enforced pattern)
