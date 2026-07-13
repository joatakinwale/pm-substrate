# D7 keep/kill memo — pm-substrate (gate: 2026-07-16)

*Generated 2026-07-13T12:47:50.419Z by `pnpm pm:memo` from the admitted log — regenerate any time; only the Verdict section is hand-written. North star: did the substrate make the two labs worth operating (via the generic kit), and does the loop itself run better on it than off it?*

**Evidence coordinates:** db postgres://pm@127.0.0.1:5432/pm_substrate · tenant tenant_dev · agent joat-dev · scope pm-substrate-dev

## 1 · Resume fidelity (the original problem)

- Sessions resumed from the ledger: **4**, handoff coverage: **100%**, hash chain: **VALID**
- Standing decisions: **14** · superseded (re-decided with a paper trail): **0** · re-litigated from chat memory: **0 observed**

## 2 · Throughput and cost

- Work closed: **14** of 28 opened (0 open) — **3.5/session**
- Tokens: **4,980,000** across 2 costed sessions → **355,714 per closed item** (pre-reset loop trend was 88,750 → 72,944 → 60,917 → 55,833 → 45,857; the DB was reset and the ledger reseeded 2026-07-08, so the post-reset series restarts at this number)

## 3 · Governance did real work?

- MCP gate: **44** admitted · **0** blocked (block rate 0) — ✅ live propose→admit traffic outside tests
- Executor bridge: **1** dispatched · **5** refused · **8** failed
- Shadow verdict: advisory would-have-blocked **0** · enforced blocks **5** · data rejections **0** · pending drift obstructions **7**
- Work dispatched to roles: **0**

## 4 · Zero-rewrite integration held?

- Registered adapters: **3** (canary_web_inspector@36a29a05 v1 · liquid@c904bd82 v1 · pi_harness@e285e90f v1)
- Sync lanes: **2** upserted · **0** rejected — fixture-proven idempotent; Liquid lanes L2–L4 CI-proven against the real `liquid-mcp` vocabulary
- ✅ L1: sidecar run once in the owner's environment (runbook smoke)
- ✅ L5 / D6 read attach: one real lab endpoint attached through the kit
- ✅ L4 governed write: blocked envelope refused, accepted envelope dispatched, replay deduped

## 5 · Live lab evidence (Axis C — local-agent-lab, paired arms)

- Latest live run **2026-07-10** on **llama3.2:3b**: **12** scenarios, paired baseline-vs-substrate
- Baseline arm: **12** failed · 0 passed — every seeded failure class reproduced without the substrate
- Substrate arm: **12** blocked at the gate · 0 passed — **every baseline failure was caught before it landed**

## 6 · Business-operability objective gate

Technical activity is necessary but cannot prove that either lab is worth operating. The executable scorecard requires zero-edit adoption, repeated correct end-to-end outcomes, governance quality, bounded cost/operator effort, and external acceptance for **both** labs.

- **Verdict ceiling from admitted evidence:** `keep_with_scope_cut`
- **Full objective ready:** NO
- **Objective measurement events:** 0 valid latest lab record(s) · 0 invalid event(s)

- ✅ **technical_baseline**: threshold met
- ❌ **adoption**:
  - plugged_in_social: no revision-bound admitted read attachment
  - plugged_in_social: no validated lab measurement was admitted
  - arrowhedge: no revision-bound admitted read attachment
  - arrowhedge: no validated lab measurement was admitted
- ❌ **operational_outcomes**:
  - plugged_in_social: no validated lab measurement was admitted
  - arrowhedge: no validated lab measurement was admitted
- ❌ **governance_quality**:
  - plugged_in_social: no revision-bound governed action was dispatched
  - plugged_in_social: no validated lab measurement was admitted
  - arrowhedge: no revision-bound governed action was dispatched
  - arrowhedge: no validated lab measurement was admitted
- ❌ **economic_value**:
  - plugged_in_social: no validated lab measurement was admitted
  - arrowhedge: no validated lab measurement was admitted
- ❌ **external_validity**:
  - plugged_in_social: no validated lab measurement was admitted
  - arrowhedge: no validated lab measurement was admitted

Record or update a source-cited lab measurement with `pnpm pm:objective -- record <measurement.json>`. Read attachment and governed action dispatch are independently derived from admitted events carrying an exact match for the run manifest, boundary conformance, app revision, and substrate revision; the measurement cannot self-assert them or reuse a historical rehearsal.

## 7 · Technical evidence gaps before the gate

These are substrate proof gaps, distinct from the business-operability gaps above:

No open technical-substrate evidence gaps remain in this ledger fold. This does not imply the business objective is met.

## 8 · Verdict (hand-written at the gate — owner + agent)

- **Keep / kill / keep-with-scope-cut:** keep-with-scope-cut.
- **Scope retained:** the continuity loop, MCP admission boundary, generic mapping/sync/executor kit, adapter registry, shadow report, and Liquid process-boundary pattern have sufficient technical evidence to continue. Freeze the Later ladder.
- **Next falsification window:** D6 ends 2026-07-31. Restore and revision-pin both external app boundaries; then require every adoption, correct-outcome, governance, economic-value, and external-validity threshold in `docs/objective-falsification.md`. Missing measurements remain failures to establish the claim, not waivers.
- **If D6 fails:** repair the failed dimension or reduce/kill the two-lab business-operability claim. Salvage the generic kit and continuity/governance surfaces only to the extent their independent evidence remains green.
