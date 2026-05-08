/**
 * @pm/registry — Capability registry.
 *
 * Architecture rule (architecture.md, Layer 3):
 *   Tools register as capability providers. They declare what nodes/edges
 *   they read, what events they emit, what permissions they require.
 *   "Integration" stops existing as a concept.
 */

export type {
  Capability,
  NormalizedCapability,
  Registry,
} from "./interfaces.js";
export { normalizeCapability } from "./interfaces.js";
export { PostgresRegistry } from "./postgres.js";
export { matchesPattern } from "./pattern.js";
