/**
 * @pm/capability-audit — common/audit-log capability.
 *
 * The canonical Tier-1 tool. Subscribes to every event in the stream and
 * materializes an append-only audit log keyed by entity. Works against any
 * tenant regardless of which profiles are installed.
 *
 * Architecture rule (architecture.md, Layered ontology):
 *   "Tools at Tier 1 work everywhere with zero customization."
 *
 * This capability is the test of that claim. If audit ever needs to branch
 * on a profile-specific concrete type, the layered ontology has leaked and
 * the architecture has a problem — see ADR-0009 falsification mode #7.
 */

export { AUDIT_CAPABILITY } from "./capability.js";
export { auditProjection } from "./projection.js";
export type { AuditEntry, AuditState } from "./projection.js";
