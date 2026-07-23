# ADR-0030 — Event provenance and admissibility

Accepted — 2026-05-20.

## Context

The coordinated-reality research pass found a useful bridge between court
records / chain-of-custody doctrine and multi-tenant event logs. If the event
log is the substrate's shared baseline of reality, rows cannot be treated as
opaque messages. Each row must be attributable, hashable, and evaluable as
evidence of what happened.

## Decision

Extend the event envelope with chain-of-custody metadata:

- `schemaVersion` — version of the substrate event envelope;
- `authority` — capability/permission/external authority that admitted it;
- `contentHash` — sha256 over canonical envelope fields;
- `priorEventHash` — hash of the immediately prior tenant event.

Add `admissibilityOf(event)` so callers can score whether an event has the
minimum evidence metadata and whether the stored hash matches the canonical
hash.

## Consequences

The event log now provides a tenant-local hash chain. This does not make the
log tamper-proof against a database administrator, but it makes accidental or
application-level history mutation detectable and gives projections/workflows a
shared evidence contract.

Legacy callers do not break: `authority` defaults to `emittedBy`. New real
integrations should pass the specific grant or external trigger identity.

## Validation

- `pnpm typecheck`
- `PM_DATABASE_URL=postgres://pm:pm_dev_password@127.0.0.1:5432/pm_substrate pnpm db:migrate`
- `PM_DATABASE_URL=postgres://pm:pm_dev_password@127.0.0.1:5432/pm_substrate pnpm test`
- `pnpm build`
