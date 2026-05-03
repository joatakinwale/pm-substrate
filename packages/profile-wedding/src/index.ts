/**
 * @pm/profile-wedding — Tier-2 wedding industry profile.
 *
 * Exports:
 *   - Concrete entity TypeScript types (Wedding, Couple, Guest, Vendor,
 *     Contract, Payment, Invoice) for use by capability providers
 *     binding to wedding-specific shapes.
 *   - The runtime ProfileDefinition (`WEDDING_PROFILE`) for substrate
 *     registration.
 *   - The edge catalog and lifecycle defs as named exports for inspection.
 *
 * Usage:
 *
 *   import { WEDDING_PROFILE } from "@pm/profile-wedding";
 *   await profileRegistry.register(tenantId, WEDDING_PROFILE);
 */

export * from "./entities.js";
export * from "./edges.js";
export * from "./lifecycles.js";
export { WEDDING_PROFILE } from "./profile.js";
