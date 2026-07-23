# Liquid × pm-substrate — integration plan

*Adopted 2026-07-06 (decision checkpoint accompanies this doc; registry contract `liquid v1`, source pin `ertad-family/liquid @ c904bd82`). Loop-consumable: each lane below is one work item with a "done when". ROADMAP D5 references this plan.*

## Why Liquid

The substrate governs the agent boundary but must not hand-write a connector per external system. Liquid is the periphery that makes the zero-rewrite promise cheap at scale: one `fetch / query / write / sense` API over web APIs, databases, MCP/A2A agents, email, and IoT/OT — interfaces learned once by an LLM at setup, deterministic data path at runtime, re-mapped on upstream drift. The substrate supplies what Liquid lacks: **authority**. Liquid proposes and transports; the substrate approves and admits.

## Placement and boundary (owner-decided)

- Vendored working tree at **`pm-substrate/liquid/`** (no `.git`; `liquid/tests`, `liquid/examples` gitignored). The adapter-registry pin (`url + commit c904bd82`) remains the identity of record — when the vendored tree is updated, re-register the adapter with the new pin in the same change.
- **Process boundary, never a link boundary.** Liquid is Python 3.12+/AGPL-3.0; the TS kernel never imports it. All contact is over its MCP server (`liquid-mcp`, stdio via `uvx`) or HTTP. If pm-substrate is ever distributed, ship Liquid as a separate sidecar image.
- Substrate gates (`validate:budgets`, `validate:zero-edit`, vitest) scan `packages/` and `scripts/` only — the vendored tree is invisible to them by construction. Keep it that way.

## Governance invariants (already bound in the registry contract)

1. **Agents never mount Liquid directly.** Only substrate machinery (sync driver, executor bridge) talks to it; agents see substrate tools.
2. **`mapping_approval_gate`** — every Liquid-discovered or drift-repaired interface map lands as a *proposal* (`pm.mapping.proposed`, content-hashed). Sync refuses to run against an unapproved mapping hash. Drift = obstruction + a new proposal, never a silent re-map.
3. **`write_gate`** — Liquid's `write` fires only from the executor bridge, on `accepted` envelopes, deduped by `outcomeHash`. Same refuse/dispatch/fail lanes as HTTP targets.
4. **Evidence on the log** — every Liquid interaction leaves `pm.sync.*` / `pm.mapping.*` / `pm.executor.*` events; the control plane reports them (integration lanes already live).

## Lanes (dogfood order)

| Lane | Deliverable | Done when |
|---|---|---|
| **L1 — Runbook + local mount** | `docs/liquid-runbook.md`: run the sidecar (`uv sync` in `liquid/`, or `uvx liquid-mcp`), env (`OPENAI_API_KEY` only for discovery), health check; one recorded smoke: discover a public API → typed records | Owner (or agent with network) reproduces the smoke from the runbook alone; evidence checkpoint recorded |
| **L2 — Liquid as sync source** | `pm:sync --source liquid`: substrate derives Liquid's `target_model` **from the approved `EntityMapping`** (mapping doc stays the single source of truth), calls the sidecar, adapts returned typed records → `SourceRecord[]` → the existing idempotent sync | Fixture stub (HTTP server imitating Liquid's response shape) proves the driver in CI; records flow through `runEntityMappingSync` unchanged — zero new trust |
| **L3 — Mapping proposals + drift as obstruction** | `pm.mapping.proposed` events (content-hashed EntityMapping candidates from Liquid discovery/repair); `pm:mappings` CLI (list / approve / reject → decision checkpoints); sync REFUSES unapproved mapping hashes | Test: drift-simulating stub emits a repaired map → sync blocks citing the pending proposal; approval unblocks; the whole exchange is on the log |
| **L4 — Liquid as executor target** | `ActionExecutorTarget` gains `kind: "liquid"` (endpoint/DSN + path + op); admitted envelope → sidecar `write`; refuse/dedupe/fail identical to HTTP targets | Stub-proven: blocked never fires; accepted fires once; DB-style target reached without app HTTP endpoint |
| **L5 — Live rehearsal (owner-gated)** | One real endpoint (a lab's existing read API or DB, when its app logic is ready) through L2 end-to-end, shadow-mode | Real records land as governed primitives with provenance; this doubles as the D6 attach rehearsal |

Order matters: L2 before L3 (a working transport makes proposal-refusal testable), L3 before L4 (writes demand the approval spine), L5 only when the owner opens a lab.

## Non-goals

- No Liquid types or Python imports in TS packages (process boundary).
- No autonomous re-mapping: Liquid's self-heal is *input* to governance, not a bypass.
- No replacement of the plain-HTTP executor or file-based `pm:sync` — Liquid is an additional driver, and the JSON-export path stays as the dependency-free floor.
- Not before D7 unless the loop has slack: L1–L2 serve the memo; L3–L4 can land after if time is short.

## Risks / honest notes

- **AGPL-3.0**: vendoring in a private repo is fine; distribution of pm-substrate must keep Liquid a separate program (it already is, by process boundary). Never link, never copy code across the boundary.
- **Runtime**: Python ≥3.12 + `uv` on the host; discovery needs an LLM key (setup-time only). The sandbox loop can build L2–L4 against stubs without either.
- **Vendored-tree drift**: if `liquid/` is edited in place, the registry pin lies. Rule: treat `liquid/` as read-only vendor; updates = new upstream commit + re-register (the registry makes the mismatch visible, not silent).
- **`liquid/src` is ~26MB** (embedded data/corpora): acceptable, but if repo weight matters, slim to `src + packages + pyproject + uv.lock + README + LICENSE` and drop `benchmarks/` + `docs/` from the vendored copy.

## How the loop consumes this

Next session: `pnpm dev:resume` → the handoff names L2 as the top open item (L1 is owner-environment work; the loop builds L2's stub-tested driver without waiting on it). Each lane closes with the usual: tests green, gates green, commit, `work closed` checkpoint citing this plan.
