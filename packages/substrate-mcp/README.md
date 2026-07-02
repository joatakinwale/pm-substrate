# @pm/substrate-mcp

The substrate's MCP tool surface (ROADMAP **D2**). Any MCP-capable agent mounts
the substrate with a config line:

```bash
claude mcp add pm-substrate \
  --env PM_DATABASE_URL=postgres://pm:pm_dev_password@127.0.0.1:5432/pm_substrate \
  -- node packages/substrate-mcp/dist/stdio.js
```

## The five tools

| Tool | What it does |
|---|---|
| `substrate_resume` | Session-start briefing from the continuity ledger (hash-chain verified). Call FIRST. |
| `substrate_observe` | CurrentStateView + ObservationContract — the basis every action must cite. The ledger head is content-addressed (`head:<hash>`), so a moved head structurally invalidates old bases. |
| `substrate_propose` | Warn-first review against a fresh view; persists a hash-verified StateReviewArtifact as an admitted proposal event. |
| `substrate_admit` | The gate: re-reviews the original action + basis against the CURRENT state in blocking mode; emits a terminal ActionOutcomeEnvelope. Accepted `record_checkpoint` actions execute; everything else is an envelope for an external executor. Stale basis ⇒ `blocked`, nothing executes. |
| `substrate_checkpoint` | Low-ceremony ledger write (decisions/lessons/work/handoffs). |

Design rules: agents get **no write path that bypasses the gate**; proposals are
stateless (carried by their artifact events, so restarts/other instances can
admit them); warn-first at propose, enforced at admit.

Transport: stdio (OS-user trust boundary). The streamable-HTTP transport with
bearer-token auth is a recorded open work item.

Verified by `src/server.test.ts` against a real Postgres substrate, including
the paired stale-basis case: warned at propose, blocked at admit, not executed.
