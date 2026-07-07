# D7 keep/kill memo — pm-substrate (gate: 2026-07-16)

*Generated 2026-07-07T01:30:50.947Z by `pnpm pm:memo` from the admitted log — regenerate any time; only the Verdict section is hand-written. North star: did the substrate make the two labs worth operating (via the generic kit), and does the loop itself run better on it than off it?*

*Replay addendum 2026-07-07: Liquid was replayed with a real `OPENAI_API_KEY` present and forwarded to the MCP sidecar. The literal vendored-tree command in `docs/liquid-runbook.md` failed because this checkout's `liquid/` directory has no root `pyproject.toml`/`uv.lock`; the working sidecar command is `uvx liquid-mcp` for HTTP and `uvx --from liquid-api[pg] liquid-mcp` for Postgres.*

## 1 · Resume fidelity (the original problem)

- Sessions resumed from the ledger: **21**, handoff coverage: **100%**, hash chain: **VALID**
- Standing decisions: **17** · superseded (re-decided with a paper trail): **0** · re-litigated from chat memory: **0 observed**

## 2 · Throughput and cost

- Work closed: **23** of 31 opened (3 open) — **1.1/session**
- Tokens: **1,030,500** across 22 costed sessions → **44,804 per closed item** (trend across the loop: 88,750 → 72,944 → 60,917 → 55,833 → this)

## 3 · Governance did real work?

- MCP gate: **16** admitted · **4** blocked (block rate 0.2) — ✅ live propose→admit traffic outside tests
- Executor bridge: **1** dispatched · **1** refused · **0** failed
- Shadow verdict: advisory would-have-blocked **0** · enforced blocks **5** · data rejections **0** · pending drift obstructions **0**
- Work dispatched to roles: **0**

## 4 · Zero-rewrite integration held?

- Registered adapters: **3** (canary_web_inspector@36a29a05 v1 · liquid@c904bd82 v1 · pi_harness@e285e90f v1)
- Sync lanes: **7** upserted · **0** rejected — fixture-proven idempotent; Liquid lanes L2–L4 CI-proven against the real `liquid-mcp` vocabulary; 2026-07-07 live replay added **2** ArrowHedge `/flows/` upserts through Liquid.
- ✅ L1: sidecar ran in the owner's environment with `uvx liquid-mcp`; original vendored-tree command was corrected because the vendored checkout lacks install metadata.
- ✅ L5 / D6 read attach: ArrowHedge live `/flows/` endpoint attached through the kit. Dry-run: created=2, rejected=0, skippedMissingId=0. Real sync: created=2. Replay: unchanged=2. Events admitted: `pm.mapping.proposed`, `pm.mapping.approved`, `pm.sync.upserted` x2.
- Boundary observed: Liquid omitted numeric `id` from `/flows/` records even when requested in `target_model`; the rehearsal used `name` as the approved external id. Future live attaches should require the chosen external id to appear in the fetched rows or obstruct before sync.

## 5 · Evidence gaps before the gate

The memo is honest only if these are either filled or explicitly waived on 07-16:

1. Live MCP mount: one real session driving substrate_observe→propose→admit (not the test suite).
2. One real governed action end-to-end in shadow (publish or backtest — whichever lab opens first).
3. Fix the evidence tooling mismatch: `pm:memo` regenerated against the default tenant/scope and produced a zeroed snapshot, so the memo generator needs an explicit tenant/scope guard before its numbers can be treated as the gate source of truth.

## 6 · Verdict (hand-written at the gate — owner + agent)

- **Keep / kill / keep-with-scope-cut:** keep-with-scope-cut.
- **If keep:** next falsification window runs to 2026-07-16. Criteria: one live MCP observe→propose→admit session; one governed write/action rehearsal through an accepted envelope with replay dedupe; Liquid external-id obstruction when the fetched rows omit the approved id field; `pm:memo` must refuse ambiguous tenant/scope instead of emitting a misleading zero snapshot.
- **If kill:** salvage the entity-mapping approval gate, idempotent sync runner, executor bridge, adapter registry, and Liquid sidecar process-boundary pattern. Kill only the claim that Liquid is ready as a broad default adapter until L1/L5 evidence repeats on a second real surface and the write path is proven live.
