# ADR-0002: pnpm monorepo with per-layer packages

**Status:** Accepted (2026-05-01)

## Context

The substrate has six concerns (types, graph, events, registry, workflow, projections) and will eventually publish profiles (wedding, legal, agency, ...) and capability providers (planner-task, gcal-projection, vendor-milestone, ...). These need to be composable, independently versionable, and clearly bounded.

## Decision

pnpm workspaces. Six packages day 1: `@pm/types`, `@pm/graph`, `@pm/events`, `@pm/registry`, `@pm/workflow`, `@pm/projections`. Profiles and providers ship as additional packages later.

TypeScript `composite: true` project references for incremental builds and clean dependency boundaries.

## Consequences

**Positive:**

- Each package has its own `package.json`, version, and public surface.
- Project references catch architectural mistakes at typecheck time (a `graph` import inside `types` would be rejected immediately).
- pnpm hoisting + symlinking keeps `node_modules` lean.
- Future profile packages drop in as new workspace entries with no root configuration changes.

**Negative — accepted:**

- Slight setup overhead vs single-package layout.
- Slightly more friction for tiny refactors that span packages — but the friction is a feature, not a bug, when the architecture is the whole point.

## Alternatives considered

- **Single package with internal modules.** Rejected: the layered ontology is the architecture; the repo should reflect it from commit one. We are explicitly building this so other consumers (future profiles) can depend on individual layers.
- **Turborepo / Nx.** Rejected for now: pnpm is sufficient. Add a task runner if and when build orchestration becomes painful.
- **Yarn workspaces.** Rejected: pnpm's strictness is a feature here.
