# D7 keep/kill memo — pm-substrate (gate: 2026-07-16)

*Generated 2026-07-06T17:00:38.463Z by `pnpm pm:memo` from the admitted log — regenerate any time; only the Verdict section is hand-written. North star: did the substrate make the two labs worth operating (via the generic kit), and does the loop itself run better on it than off it?*

## 1 · Resume fidelity (the original problem)

- Sessions resumed from the ledger: **17**, handoff coverage: **100%**, hash chain: **VALID**
- Standing decisions: **15** · superseded (re-decided with a paper trail): **0** · re-litigated from chat memory: **0 observed**

## 2 · Throughput and cost

- Work closed: **20** of 28 opened (3 open) — **1.18/session**
- Tokens: **899,000** across 18 costed sessions → **44,950 per closed item** (trend across the loop: 88,750 → 72,944 → 60,917 → 55,833 → this)

## 3 · Governance did real work?

- MCP gate: **5** admitted · **4** blocked (block rate 0.444) — ✅ live propose→admit traffic outside tests
- Executor bridge: **0** dispatched · **0** refused · **0** failed
- Shadow verdict: advisory would-have-blocked **0** · enforced blocks **4** · data rejections **0** · pending drift obstructions **0**
- Work dispatched to roles: **0**

## 4 · Zero-rewrite integration held?

- Registered adapters: **3** (canary_web_inspector@36a29a05 v1 · liquid@c904bd82 v1 · pi_harness@e285e90f v1)
- Sync lanes: **1** upserted · **0** rejected — fixture-proven idempotent; Liquid lanes L2–L4 CI-proven against the real `liquid-mcp` vocabulary
- ❌ **GAP** — L1: sidecar run once in the owner's environment (runbook smoke)
- ❌ **GAP** — L5 / D6: one real lab endpoint attached through the kit (owner opens when app logic is ready)

## 5 · Evidence gaps before the gate

The memo is honest only if these are either filled or explicitly waived on 07-16:

1. Live MCP mount: one real session driving substrate_observe→propose→admit (not the test suite).
2. L1 sidecar smoke from the runbook alone.
3. One real governed action end-to-end in shadow (publish or backtest — whichever lab opens first).

## 6 · Verdict (hand-written at the gate — owner + agent)

- **Keep / kill / keep-with-scope-cut:** _(pending)_
- **If keep:** next falsification window and its criteria: _(pending)_
- **If kill:** what gets salvaged (kit? ledger? MCP surface?): _(pending)_
