# ADR-0012: substrate-http sample server is profile-coupled

**Status:** Accepted, deferred (2026-05-06)
**Trigger:** G5.4 substrate-profile-agnostic test caught two profile-name leaks in `packages/substrate-http/src/server.ts`:

1. `emittedBy: "pm-substrate-http/wedding.budget"` (line 50)
2. Hardcoded handler key `"wedding.contract.payment_recorded"` (line 60)

## What's actually going on

`@pm/substrate-http` has two roles smashed into one package:

1. **Library code** (`app.ts`, `errors.ts`, `index.ts`) — the Hono app factory and error helpers. Profile-agnostic. Consumed by anyone wanting an HTTP surface over substrate primitives.
2. **Sample server entry** (`server.ts`) — a runnable bootstrap that wires the substrate to a concrete capability (wedding budget rollup) so the docker-compose dev demo has something to call. Profile-coupled by necessity.

The library half is correct. The sample-server half violates the substrate-is-profile-agnostic invariant.

## Decision

Keep the sample server profile-coupled for now; document the boundary and exempt it from the G5.4 scan via an explicit allowlist in `packages/registry/src/substrate-profile-agnostic.test.ts` (`SAMPLE_ENTRY_POINTS`).

The right end-state is to extract the sample server into its own package — `@pm/substrate-http-demo` or similar — so:

- `@pm/substrate-http` stays a clean library that any profile/capability composition can depend on.
- The demo package owns the wedding-specific wiring without contaminating the library.
- Adding additional sample bootstraps (e.g., agency demo) doesn't churn the substrate library.

## Why deferred

The refactor is mechanically simple but touches:

- Workspace package structure (new package, new pnpm workspace entry)
- Docker-compose + `pnpm db:reset` flow that currently runs `tsx packages/substrate-http/src/server.ts`
- Any docs or scripts pointing at that path

That's larger than the G5.4 close warrants, and the test catches future leaks from this point forward. Filing as a follow-up.

## Acceptance criteria for closing this ADR

- [ ] New package `@pm/substrate-http-demo` (or named equivalent) created.
- [ ] `server.ts` moves there; `@pm/substrate-http` no longer depends on any `@pm/capability-*` or `@pm/profile-*` package.
- [ ] G5.4 test `SAMPLE_ENTRY_POINTS` allowlist removed; test still green.
- [ ] Dev demo + docker-compose still work end-to-end.

## Cross-references

- G5.4 test: `packages/registry/src/substrate-profile-agnostic.test.ts`
- Pm-substrate research gap audit, item G5.4
