/**
 * @pm/types — Tier-1 entity-interface contracts.
 *
 * No runtime. No I/O. No business logic. Just declared interfaces and
 * branded ID types that every other @pm/* package depends on.
 *
 * Architecture rule (architecture.md):
 *   "Tools written against Tier-1 work everywhere. Tools written against
 *    a Tier-2 profile work in that industry but inherit the Tier-1
 *    substrate for free."
 *
 * If you find yourself adding industry-specific knowledge here — stop.
 * That belongs in a profile package.
 */

export * from "./common.js";
export * from "./node.js";
export * from "./edge.js";
export * from "./event.js";
export * from "./tier1.js";
export * from "./profile.js";
export * from "./capability-contract.js";
