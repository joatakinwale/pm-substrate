# ADR-0032 — Amnesiac-agent continuity evaluation

Accepted — 2026-05-20.

## Context

A continuity ledger is not meaningful unless it changes agent behavior. The
real product claim is not "we store memory"; it is "an amnesiac agent can resume
work, avoid contradiction, and prove prior work from substrate state alone."

## Decision

Add a first substrate-native evaluation in `@pm/continuity`:

1. Session 1 records decisions, research, and open work as checkpoints.
2. Session 2 receives no chat history, only `(tenantId, agentId, scope)`.
3. `buildContinuityContext()` reconstructs the useful working context.
4. `findContinuityContradictions()` flags conflicting open claims/decisions.

This is the first falsifiable test of the AI-state thesis. If the eval fails,
the substrate has not solved amnesia; it has only stored rows.

## Consequences

The substrate now has an executable criterion for the claim Emmanuel articulated:
continuity of identity, compounding work, provable claims, and cross-context
coordination must be measurable as behavior over state.

## Validation

- `pnpm typecheck`
- `PM_DATABASE_URL=postgres://pm:pm_dev_password@127.0.0.1:5432/pm_substrate pnpm test`
- `pnpm build`

As of implementation: 39 test files passed, 302 tests passed.
