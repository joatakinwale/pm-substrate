# Liquid runbook (lane L1) — proven commands

*Every command below was executed against the REAL sidecar on 2026-07-06 (sandbox smoke: Python 3.12 via uv, asyncpg introspection of a live Postgres, MCP stdio, approval gate, idempotent sync). Replayed on 2026-07-07 against live ArrowHedge `/flows/` with a real `OPENAI_API_KEY` present. Repeat on your machine to close or re-check L1 for the owner environment.*

## 1 · Install (one time)

```bash
uv python install 3.12          # if the system python is older
uvx liquid-mcp --help           # HTTP/API smoke; command exits after help

# For Postgres/MySQL/etc. sources, launch the MCP sidecar with the needed extra:
uvx --from 'liquid-api[pg]' liquid-mcp
```

Do not use `uv run --directory ./liquid liquid-mcp` in this checkout unless the vendored `liquid/` tree includes a root `pyproject.toml` and `uv.lock`. On 2026-07-07 that literal command failed because this checkout vendors source/docs but not install metadata.

## 2 · LLM config (setup-time only)

Discovery/mapping proposals call an LLM once per interface; the data path never does. Export ONE of:

```bash
export OPENAI_API_KEY=…                      # or GEMINI_API_KEY / ANTHROPIC_API_KEY
# or a local/keyless server:
export OPENAI_BASE_URL=http://127.0.0.1:11434/v1   # LIQUID_LLM_MODEL to pick a model
```

`pm:sync` and `pm:rehearse-write` forward exactly these to the spawned sidecar (`OPENAI_API_KEY`, `OPENAI_BASE_URL`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `LIQUID_LLM_PROVIDER`, `LIQUID_LLM_MODEL`, `LIQUID_LLM_BASE_URL`, `LIQUID_ALLOW_WRITES`, `LIQUID_HOME`) — the MCP stdio transport does NOT inherit your shell env (safelist only), so anything else won't reach it.

## 3 · Approve the mapping (the L3 gate)

```bash
pnpm pm:mappings propose <appName> mapping.json --origin manual --reason "initial attach"
pnpm pm:mappings approve <appName> <hashFromPropose>
pnpm pm:mappings list <appName>
```

If `pnpm` auto-install hangs in this environment, the equivalent direct runner is:

```bash
PM_DATABASE_URL="$PM_DATABASE_URL" node --import tsx scripts/pm-mappings.ts propose <appName> mapping.json --origin manual --reason "initial attach"
PM_DATABASE_URL="$PM_DATABASE_URL" node --import tsx scripts/pm-mappings.ts approve <appName> <hashFromPropose>
PM_DATABASE_URL="$PM_DATABASE_URL" node --import tsx scripts/pm-mappings.ts list <appName>
```

Sync REFUSES unapproved mapping hashes. When Liquid re-maps on upstream drift, the repair arrives as a new proposal — approve or reject it here.

## 4 · Dry run, then sync

```bash
pnpm pm:sync -- --dry-run --source liquid --app <appName> \
  --mapping mapping.json \
  --url "postgresql://user@host:5432/appdb" \
  --entity Customer --external-id id --endpoint /public/customers \
  --liquid-cmd "uvx --from liquid-api[pg] liquid-mcp"
# DRY RUN (nothing written) sync <appName>: created=3 …  ← preview + gate verdict

# drop --dry-run for the real, idempotent sync; re-running is always safe:
# 1st: created=3 · 2nd: unchanged=3
```

`--url` takes anything Liquid can reach: `https://…` API, `postgresql://…`/`mysql://…` DSN, GraphQL, gRPC. For HTTP APIs pass `credentials` at connect time (stored in Liquid's vault, never by the substrate).

HTTP/API example from the 2026-07-07 ArrowHedge L5 read attach:

```bash
pnpm pm:sync -- --dry-run --source liquid --app arrowhedge_liquid_flows_l5_20260707 \
  --mapping mapping.json \
  --url "http://127.0.0.1:8000/flows/" \
  --entity Flow --external-id name \
  --liquid-cmd "uvx liquid-mcp"
# liquid adapter=<id> mapping=a14469... approved=true skippedMissingId=0
# DRY RUN (nothing written) sync arrowhedge_liquid_flows_l5_20260707: created=2 updated=0 unchanged=0 edges+0/=0 rejected=0

# real sync:
# sync arrowhedge_liquid_flows_l5_20260707: created=2 updated=0 unchanged=0 edges+0/=0 rejected=0
# replay:
# sync arrowhedge_liquid_flows_l5_20260707: created=0 updated=0 unchanged=2 edges+0/=0 rejected=0
```

## Traps (all found live)

- **DB fetch auth**: Liquid stores adapters without the DSN password — pass `credentials` to `liquid_connect` (vaulted) or use trust/peer auth for local smokes. A missing password surfaces as `503 … 'NoneType' object has no attribute 'encode'`.
- **External id**: the driver adds `--external-id`'s field to the `target_model` automatically — records Liquid returns without it are skipped and counted (`skippedMissingId`).
- **Returned external id must be verified**: on ArrowHedge `/flows/`, Liquid omitted numeric `id` even when requested, so the rehearsal used `name` as the approved external id. Treat missing external-id fields as an obstruction unless an approved alternate id is deliberately chosen.
- **Sidecar errors** can arrive as `isError: false` with an `error` string payload — the driver treats those as failures (never parsed as data).
- **Review-needed payloads may omit `adapter_id`**: `liquid_connect` can return `status: "review_needed"` without an adapter id. The driver must surface that as a review obstruction, not a parser crash.
- **Adapter registry cross-talk**: Liquid persists adapters under `LIQUID_HOME`/`~/.liquid`. Reusing a home across unrelated targets can make `liquid_connect` remap from the wrong prior service template. For proof runs, set a fresh `LIQUID_HOME=$(mktemp -d /tmp/pm-substrate-liquid.XXXXXX)` and make sure the spawned sidecar receives it.
- **Writes** need `LIQUID_ALLOW_WRITES=1` on the sidecar *and* an accepted envelope through the executor bridge — both gates, always.
