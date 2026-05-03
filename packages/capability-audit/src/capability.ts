import type { Capability } from "@pm/registry";
import type { CapabilityId } from "@pm/types";

/**
 * The audit-log capability descriptor. Registered per-tenant via
 * Registry.register(tenantId, AUDIT_CAPABILITY).
 *
 * `subscribesTo: ["*"]` — matches every event type. This is the explicit
 * statement that audit doesn't care about profile-specific types: it cares
 * about the substrate's event stream as a uniform abstraction.
 *
 * `emits: []` — audit is a pure consumer; it doesn't generate events of
 * its own (the projection's read-model is the only side effect).
 */
export const AUDIT_CAPABILITY = {
  id: "cap_common_audit_log_v1" as CapabilityId,
  name: "common/audit-log",
  version: 1,
  readsInterfaces: [],
  writesInterfaces: [],
  readsEdges: [],
  writesEdges: [],
  emits: [],
  subscribesTo: ["*"],
  requiredPermissions: ["audit.read"],
  description:
    "Tier-1 audit log. Subscribes to every event and records (timestamp, type, entity, emitter) per tenant. Profile-agnostic.",
} as const satisfies Capability;
