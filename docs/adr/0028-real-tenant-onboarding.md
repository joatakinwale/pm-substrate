# ADR-0028 — Real-tenant onboarding directory

Accepted — 2026-05-20. G9 operationalizes tenant lifecycle instead of relying
on seed scripts and direct SQL inserts.

## Context

Before G9, substrate tests and demos created tenants by inserting directly into
`substrate.tenants`. That was acceptable for scaffolding, but it meant a real
customer could not be onboarded through the same substrate surface that all
other runtime state uses.

The substrate already partitioned every layer by `tenant_id`. The missing piece
was the tenant directory itself: create, inspect, list, update, archive, and
restore a tenant without reaching around the API.

## Decision

Add a profile-agnostic `@pm/tenants` package backed by `substrate.tenants` and
mount it in `@pm/substrate-http` at `/tenants`.

The tenant record is deliberately small:

- `id`
- `displayName`
- opaque `metadata`
- `createdAt`
- `updatedAt`
- `archivedAt`

The metadata field is not a profile system and not a product model. It is only
for onboarding-adjacent identifiers such as source, external customer id, plan
label, or operator notes. The substrate core treats it as opaque.

## HTTP contract

- `POST /tenants` — create a tenant
- `GET /tenants` — list active tenants
- `GET /tenants?includeArchived=true` — include archived tenants
- `GET /tenants/:tenantId` — fetch one tenant
- `PATCH /tenants/:tenantId` — update display name / metadata
- `POST /tenants/:tenantId/archive` — archive without deleting data
- `POST /tenants/:tenantId/restore` — restore an archived tenant

## Consequences

Real-tenant onboarding now has a first-class, tested API. Profile installation,
capability registration, graph writes, event publishing, and projection catch-up
already hang off `/tenants/:tenantId/...`; G9 adds the missing parent lifecycle.

Archival is soft. Data remains partitioned by tenant id and existing foreign-key
constraints keep tenant deletion out of the normal runtime path.

## Validation

- `pnpm typecheck`
- `PM_DATABASE_URL=postgres://pm:pm_dev_password@127.0.0.1:5432/pm_substrate pnpm db:migrate`
- `PM_DATABASE_URL=postgres://pm:pm_dev_password@127.0.0.1:5432/pm_substrate pnpm test`
- `pnpm build`

As of implementation: 36 test files passed, 290 tests passed.
