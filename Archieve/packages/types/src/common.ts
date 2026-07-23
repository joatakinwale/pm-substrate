/**
 * Branded ID types — opaque to consumers, required at every boundary.
 *
 * Discipline rule (architecture.md): partition by tenant from commit one, even at one tenant.
 * Every entity carries a TenantId. There is no "global" entity in this substrate.
 */

declare const __brand: unique symbol;
export type Brand<T, B extends string> = T & { readonly [__brand]: B };

export type TenantId = Brand<string, "TenantId">;
export type EntityId = Brand<string, "EntityId">;
export type EdgeId = Brand<string, "EdgeId">;
export type EventId = Brand<string, "EventId">;
export type CapabilityId = Brand<string, "CapabilityId">;
export type WorkflowId = Brand<string, "WorkflowId">;

export const tenantId = (s: string): TenantId => s as TenantId;
export const entityId = (s: string): EntityId => s as EntityId;
export const edgeId = (s: string): EdgeId => s as EdgeId;
export const eventId = (s: string): EventId => s as EventId;
export const capabilityId = (s: string): CapabilityId => s as CapabilityId;
export const workflowId = (s: string): WorkflowId => s as WorkflowId;

/**
 * ISO-8601 timestamp string. We carry timestamps as strings at the boundary
 * (deterministic, serializable, no timezone gotchas) and parse to Date only
 * inside packages that need to do arithmetic.
 */
export type Timestamp = Brand<string, "Timestamp">;
export const timestamp = (s: string): Timestamp => s as Timestamp;
export const now = (): Timestamp => new Date().toISOString() as Timestamp;

/**
 * Every entity has a profile binding. The substrate does not know what
 * profile types exist; profiles register their concrete entity-type names
 * at tenant configuration time.
 *
 * Examples:
 *   { tier1: "Engagement", profile: "agency", concrete: "Project" }
 *   { tier1: "Counterparty", profile: "legal", concrete: "Client" }
 *   { tier1: "Counterparty", profile: null,    concrete: "Counterparty" }   // raw Tier-1
 */
export interface ProfileBinding {
  readonly tier1: Tier1TypeName;
  readonly profile: string | null;
  readonly concrete: string;
}

export type Tier1TypeName =
  | "Counterparty"
  | "Engagement"
  | "Transaction"
  | "Resource"
  | "Communication"
  | "Document"
  | "Event";
