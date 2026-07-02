# pm-substrate — agent session protocol (dogfood rules)

This repo's development runs THROUGH the substrate it builds. Every agent
session (Claude Code, Cowork, or any harness) follows this loop. Chat history
is not the source of truth; the continuity ledger is.

## Session start — always

```bash
PM_DATABASE_URL=postgres://pm:pm_dev_password@127.0.0.1:5432/pm_substrate pnpm dev:resume
```

Then read [`ROADMAP.md`](./ROADMAP.md) — north star, hard requirements, current phase.

Read the briefing before doing anything: last handoff, open work, standing
decisions, lessons, claims under test. Do not re-litigate standing decisions
from chat memory — if you disagree, record a superseding `decision` checkpoint
with your reasoning instead.

If the database is not running: `pnpm db:up && pnpm db:migrate && pnpm db:seed`,
then `pnpm dev:seed-dogfood` (idempotent).

## During the session

- Made a real decision? `pnpm dev:checkpoint -- --kind decision --title "..." --summary "..."`
- Learned something that must survive you? `--kind lesson`
- Started/finished a work item? `--kind work` with `--status open|closed`
  (close by recording the same title with `--status closed`).
- Know your token usage? `pnpm dev:cost -- --prompt N --completion N --model M --source reported --label <session>`

## Session end — always

```bash
pnpm dev:handoff -- --summary "what shipped; what the next session must do first; any traps"
```

## Control plane

`pnpm dev:status` — open work, ledger counts, governance activity (admitted
events by type, stage-gate applications, procedure admissions), token costs,
hash-chain integrity. This is the v0 monitoring interface; the dashboard page
is an open work item.

## Engineering rules (CI-enforced — do not fight them)

- Full verification: `pnpm build && pnpm typecheck && pnpm test` (DB-gated
  tests need `PM_DATABASE_URL`), plus `pnpm validate-contracts --strict`,
  `pnpm validate:budgets`, `pnpm validate:zero-edit`,
  `pnpm validate:arrowsmith-primitives`.
- New code imports `@pm/agent-state-core`; the provenance tower is quarantined
  and frozen (may shrink, never grow).
- Every new exported primitive ships with a runtime (non-test, non-eval)
  consumer in the same change. Unconsumed formalism is the failure mode that
  produced the 85k-line tower — see the `lesson` checkpoint in the ledger.
- Profiles/capabilities plug in with zero substrate-package edits.
- The apps live OUTSIDE this repo (`../plugged_in_social`, `../arrowhedgelab`);
  app-conformance tests activate via `PM_PLUGGED_IN_SOCIAL_DIR`.
