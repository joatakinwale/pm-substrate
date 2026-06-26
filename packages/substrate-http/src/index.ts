/**
 * @pm/substrate-http — HTTP integration surface over the substrate.
 *
 * Discipline rule: every endpoint maps 1:1 onto a method that already exists
 * on a substrate package. No speculative API, no convenience aggregations,
 * no domain-specific endpoints. If the domain capabilities don't need it,
 * it doesn't get built.
 *
 * This is the rule that keeps Tier-1 honest: if the second business model
 * (P4) needs a new endpoint, the architecture failed. The substrate
 * exposes uniform CRUD over Tier-1 + uniform event publish/read + uniform
 * projection access. Domain semantics live in profiles + capabilities,
 * which are HTTP clients of this layer, not server extensions.
 */

export { createSubstrateApp } from "./app.js";
export type { SubstrateAppDeps } from "./app.js";
