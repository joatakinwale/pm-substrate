# D7 keep/kill memo — pm-substrate (gate: 2026-07-16)

*Generated 2026-07-08T01:49:12.196Z by `pnpm pm:memo` from the admitted log — regenerate any time; only the Verdict section is hand-written. North star: did the substrate make the two labs worth operating (via the generic kit), and does the loop itself run better on it than off it?*

**Evidence coordinates:** db postgresql://pm@127.0.0.1:5432/pm_substrate · tenant tenant_dev · agent codex-live-mcp · scope pm-substrate-dev

## 1 · Resume fidelity (the original problem)

- Sessions resumed from the ledger: **0**, handoff coverage: **INCOMPLETE**, hash chain: **VALID**
- Standing decisions: **0** · superseded (re-decided with a paper trail): **0** · re-litigated from chat memory: **0 observed**

## 2 · Throughput and cost

- Work closed: **1** of 1 opened (0 open) — **1/session**
- Tokens: **0** across 0 costed sessions → **0 per closed item** (trend across the loop: 88,750 → 72,944 → 60,917 → 55,833 → this)

## 3 · Governance did real work?

- MCP gate: **1** admitted · **0** blocked (block rate 0) — ✅ live propose→admit traffic outside tests
- Executor bridge: **1** dispatched · **5** refused · **8** failed
- Shadow verdict: advisory would-have-blocked **0** · enforced blocks **5** · data rejections **0** · pending drift obstructions **0**
- Work dispatched to roles: **0**

## 4 · Zero-rewrite integration held?

- Registered adapters: **0** (none)
- Sync lanes: **2** upserted · **0** rejected — fixture-proven idempotent; Liquid lanes L2–L4 CI-proven against the real `liquid-mcp` vocabulary
- ✅ L1: sidecar run once in the owner's environment (runbook smoke)
- ✅ L5 / D6 read attach: one real lab endpoint attached through the kit
- ✅ L4 governed write: blocked envelope refused, accepted envelope dispatched, replay deduped

## 5 · Evidence gaps before the gate

The memo is honest only if these are either filled or explicitly waived on 07-16:

No open D7 evidence gaps remain in this ledger fold. Re-run from the same coordinates before the gate if new evidence is admitted.

## 6 · Verdict (hand-written at the gate — owner + agent)

- **Keep / kill / keep-with-scope-cut:** keep-with-scope-cut.
- **If keep:** next falsification window runs to 2026-07-16. Criteria: one live MCP observe→propose→admit session; one governed write/action rehearsal through an accepted envelope with replay dedupe; Liquid external-id obstruction when the fetched rows omit the approved id field; `pm:memo` must refuse ambiguous tenant/scope instead of emitting a misleading zero snapshot.
- **If kill:** salvage the entity-mapping approval gate, idempotent sync runner, executor bridge, adapter registry, and Liquid sidecar process-boundary pattern. Kill only the claim that Liquid is ready as a broad default adapter until L1/L5 evidence repeats on a second real surface and the write path is proven live.
