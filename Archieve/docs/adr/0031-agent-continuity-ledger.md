# ADR-0031 — Agent continuity ledger

Accepted — 2026-05-20.

## Context

The AI-operator bottleneck is not raw intelligence; it is situated state. An
agent that forgets every session cannot compound work, prove what it did, or
coordinate with other agents. It remains a tool, not a partner.

The substrate already has tenant partitioning, event provenance, and workflow
soundness. The missing layer is agent continuity: a durable, verifiable trail of
work, decisions, lessons, handoffs, claims, and research conclusions.

## Decision

Add `@pm/continuity`, backed by `continuity.checkpoints`.

A checkpoint records:

- tenant;
- agent;
- scope;
- kind (`work`, `decision`, `lesson`, `research`, `handoff`, `claim`);
- title + summary;
- evidence event ids;
- decision references;
- status;
- payload;
- content hash;
- prior checkpoint hash for this tenant+agent.

This creates an agent-local hash chain. The chain is not a replacement for the
event log; it is the memory/audit layer above it. Claims can point to evidence
events, and the checkpoint itself can be verified against tampering.

## Consequences

Agents can now accumulate and prove continuity:

- "what I worked on" is a query, not recall;
- "why I made that decision" is linked to a checkpoint;
- "prove you did it" can point to checkpoint hash + evidence events;
- multiple agents can coordinate through shared tenant-scoped checkpoints.

## Validation

- `pnpm typecheck`
- `PM_DATABASE_URL=postgres://pm:pm_dev_password@127.0.0.1:5432/pm_substrate pnpm db:migrate`
- `PM_DATABASE_URL=postgres://pm:pm_dev_password@127.0.0.1:5432/pm_substrate pnpm test`
- `pnpm build`

As of implementation: 38 test files passed, 300 tests passed.
