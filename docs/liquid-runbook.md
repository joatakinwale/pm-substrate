# Liquid runbook (lane L1) — proven commands

*Every command below was executed against the REAL sidecar on 2026-07-06 (sandbox smoke: Python 3.12 via uv, asyncpg introspection of a live Postgres, MCP stdio, approval gate, idempotent sync). Repeat on your machine to close L1 for the owner environment.*

## 1 · Install (one time)

```bash
cd pm-substrate/liquid
uv python install 3.12          # if the system python is older
uv sync --python 3.12 --extra pg   # `pg` extra = asyncpg for Postgres sources
```

## 2 · LLM config (setup-time only)

Discovery/mapping proposals call an LLM once per interface; the data path never does. Export ONE of:

```bash
export OPENAI_API_KEY=…                      # or GEMINI_API_KEY / ANTHROPIC_API_KEY
# or a local/keyless server:
export OPENAI_BASE_URL=http://127.0.0.1:11434/v1   # LIQUID_LLM_MODEL to pick a model
```

`pm:sync` forwards exactly these to the spawned sidecar (`OPENAI_API_KEY`, `OPENAI_BASE_URL`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `LIQUID_LLM_PROVIDER`, `LIQUID_LLM_MODEL`, `LIQUID_LLM_BASE_URL`, `LIQUID_ALLOW_WRITES`) — the MCP stdio transport does NOT inherit your shell env (safelist only), so anything else won't reach it.

## 3 · Approve the mapping (the L3 gate)

```bash
pnpm pm:mappings propose <appName> mapping.json --origin manual --reason "initial attach"
pnpm pm:mappings approve <appName> <hashFromPropose>
pnpm pm:mappings list <appName>
```

Sync REFUSES unapproved mapping hashes. When Liquid re-maps on upstream drift, the repair arrives as a new proposal — approve or reject it here.

## 4 · Dry run, then sync

```bash
pnpm pm:sync -- --dry-run --source liquid --app <appName> \
  --mapping mapping.json \
  --url "postgresql://user@host:5432/appdb" \
  --entity Customer --external-id id --endpoint /public/customers \
  --liquid-cmd "uv run --directory ./liquid liquid-mcp"
# DRY RUN (nothing written) sync <appName>: created=3 …  ← preview + gate verdict

# drop --dry-run for the real, idempotent sync; re-running is always safe:
# 1st: created=3 · 2nd: unchanged=3
```

`--url` takes anything Liquid can reach: `https://…` API, `postgresql://…`/`mysql://…` DSN, GraphQL, gRPC. For HTTP APIs pass `credentials` at connect time (stored in Liquid's vault, never by the substrate).

## Dashboard workbench (the human-friendly route)

The Integration Workbench wraps the same governed calls — the CLI commands above stay the deterministic fallback.

```bash
PM_DATABASE_URL=… PORT=4179 node packages/substrate-dashboard/server/server.mjs
```

Open `http://127.0.0.1:4179/#integrations`.

Use the **Config path** when the adopting app already has a `mapping.json`/`mapping.yaml`: paste it, Validate, Propose, then Approve the hash from the pending list. Use the **Liquid-assisted path** when you want a no-config start: Liquid discovery supplies the field list, you choose the Tier-1 primitive and external-id field, and the result lands as a pending `pm.mapping.proposed` with origin `liquid_discovery`. Both paths stop at `pm.mapping.proposed` until a human approves the hash; the dashboard's sync button is dry-run only (it reports the gate verdict and data effects, writes nothing). Real syncs stay on `pm:sync`.

## Traps (all found live)

- **DB fetch auth**: Liquid stores adapters without the DSN password — pass `credentials` to `liquid_connect` (vaulted) or use trust/peer auth for local smokes. A missing password surfaces as `503 … 'NoneType' object has no attribute 'encode'`.
- **External id**: the driver adds `--external-id`'s field to the `target_model` automatically — records Liquid returns without it are skipped and counted (`skippedMissingId`).
- **Sidecar errors** can arrive as `isError: false` with an `error` string payload — the driver treats those as failures (never parsed as data).
- **Writes** need `LIQUID_ALLOW_WRITES=1` on the sidecar *and* an accepted envelope through the executor bridge — both gates, always.
