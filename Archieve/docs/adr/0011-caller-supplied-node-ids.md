# ADR-0011: Caller-supplied node IDs with idempotent upsert

**Status:** Accepted  
**Date:** 2026-05-04  
**Context:** P2.3a — substrate-side hardening for live end-to-end with WeddingWebApp

---

## Problem

The WeddingWebApp Python client (P2.2, `@pm/substrate-http`) creates `Vendor` and
`BudgetCategory` nodes using deterministic `uuid5`-derived IDs derived from
external system references (e.g., vendor database row UUID). This is the standard
pattern for cross-system idempotency: if the client retries after a timeout or
partial failure, it must not create a duplicate node.

Before P2.3a, `POST /nodes` always generated a server-side ID (`ent_${randomUUID()}`).
There was no way for the Python client to say "I already know what ID this should
be — only create if it doesn't exist." Every retry risked a duplicate node.

---

## Options considered

### (A) Caller-supplied UUID with idempotent upsert ← chosen

`POST /nodes` accepts an optional `id` field. If provided:
- Must be a valid UUID.
- `INSERT ... ON CONFLICT (id) DO NOTHING` — atomic in the same statement.
- If the row existed (same tenant, same profile/type): return 200 + existing node.
- If the row existed (same id, different profile/type): return 409 Conflict.
- If the row existed (different tenant — UUID collision): return 400 with
  "UUID already assigned to a different tenant" (cosmically unlikely with UUID5).
- If no `id` provided: server generates `ent_${randomUUID()}` — existing behaviour.

**Why chosen:** Smallest surface change. Idempotent upsert is a well-understood
pattern. Matches exactly what the Python client already does (it already derives
a UUID5 and passes it on create). No new endpoint or index needed.

### (B) `externalRef` lookup endpoint

Caller supplies an opaque `externalRef` string on create. Server stores it,
adds a secondary index, and exposes `GET /nodes?externalRef=...&type=...&tenant=...`.
Caller must do a lookup before creating to check for existence.

**Why rejected:**
- Larger surface: new index, new query param, new lookup endpoint.
- Caller must do an extra round-trip before every create (lookup → conditional
  create), adding latency and complexity.
- Doesn't eliminate the race between lookup and create (TOCTOU). Upsert on the
  PK eliminates the race.
- Option A achieves the same outcome with less code and no new infrastructure.

---

## Decision

Implement option A.

---

## Implementation

### `@pm/graph` (`CreateNodeInput`)

```typescript
interface CreateNodeInput {
  // ...existing fields...
  readonly id?: string;  // Optional caller-supplied UUID
}
```

`createNode` returns `{ node: NodeBase; created: boolean }`.

Logic:
1. If `id` provided: validate UUID format, reject non-UUID with `InvalidIdError`.
2. Run profile validation (unchanged — still runs before any SQL).
3. `INSERT INTO graph.nodes ... ON CONFLICT (id) DO NOTHING RETURNING ...`
4. If row returned → fresh insert → `{ node, created: true }`.
5. If no row returned → conflict → `getNode(tenantId, id)`.
   - If node found (same tenant) → check profile match.
     - Match → `{ node, created: false }`.
     - Mismatch → `NodeConflictError`.
   - If node not found (different tenant owns that id) → `InvalidIdError`
     with "UUID collision with another tenant" message.

### `@pm/substrate-http` (`POST /nodes`)

- Accepts optional `id` in request body.
- Returns 201 if `created: true`, 200 if `created: false`.
- `NodeConflictError` → 409 with `{ kind: "node_conflict", existing, requested }`.
- `InvalidIdError` → 400 with `{ kind: "invalid_id" }`.

---

## Tenant safety

`graph.nodes` has `id TEXT PRIMARY KEY` — globally unique, not per-tenant.

**UUID5 collision risk across tenants:** UUID5 is deterministic from
`(namespace, name)`. For two different tenants to share the same node UUID,
they would need to have derived UUIDs from the same namespace+name pair. With
proper per-tenant UUID5 namespacing (the Python client uses a tenant-scoped
namespace), this is cosmically unlikely. The implementation detects cross-tenant
collisions and surfaces them as errors rather than silently returning the wrong
node.

**Future mitigation:** If per-tenant PK becomes necessary (e.g., multi-tenant
isolation guarantee demanded at the schema level), migrate `graph.nodes` PK to
`(tenant_id, id)` and update `graph.edges` FKs accordingly. This is a bigger
migration and is deferred until there's evidence the current approach is
insufficient.

---

## Test coverage

The following tests pin this contract:

**`packages/graph/src/postgres.test.ts`:**
- `P2.3a: createNode with explicit UUID returns created=true on first call`
- `P2.3a: createNode with same explicit UUID returns created=false, same node on second call`
- `P2.3a: createNode with explicit UUID matching a different-typed node throws NodeConflictError (409)`
- `P2.3a: createNode with no id uses server-generated id (created=true always)`
- `P2.3a: invalid UUID string is rejected with InvalidIdError (400)`
- `P2.3a: same UUID in two different tenants creates two distinct nodes`

**`packages/substrate-http/src/app.test.ts`:**
- `P2.3a: POST /nodes with explicit id returns 201 on first call`
- `P2.3a: POST /nodes with duplicate id + matching type returns 200 with existing node`
- `P2.3a: POST /nodes with duplicate id + mismatched type returns 409`
- `P2.3a: POST /nodes with invalid UUID string returns 400`
- `P2.3a: same UUID in two tenants creates two distinct nodes`

---

## API contract (P2.3b dependency)

P2.3b (Python client hardening) depends on the following exact contract:

```
POST /tenants/:tenantId/nodes
Body: {
  id?:           string (optional UUID)
  profile:       { tier1, profile, concrete }
  identity:      object
  schemaVersion: number
}

Response:
  201  node    (fresh insert)
  200  node    (idempotent hit, same type)
  400  error   (invalid UUID format)
  409  error   (id exists with different type)
  422  error   (profile validation failure)
```
